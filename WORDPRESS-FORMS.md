# お問い合わせ・大会申請フォームをWordPressに統一する

## おすすめの方針: Contact Form 7 + Flamingo（無料）

理由:
- 無料で、エントリー管理(Flamingo)・メール通知・スパム対策(Akismetとの連携)が揃っている
- 今のフォームの項目数(申請フォームは20項目以上)にも問題なく対応できる
- 将来、申請件数が増えて「ステータス管理・承認フロー」が本格的に必要になった時点で
  Gravity Forms（有料）に乗り換える、という段階的な移行がしやすい

大会申請の審査・承認プロセス自体は最初はスプレッドシート運用時と同じく
「Flamingoの一覧を見て、WordPress側のメモ機能や外部シートに手動でステータスを記録する」
運用で十分に回ります。件数が増えて辛くなったら本格的なワークフロー管理を検討してください。

---

## 全体の流れ

今の構成:
```
静的サイトのフォーム → (fetch) → Google Apps Script → Googleスプレッドシート
```

移行後:
```
静的サイトのフォーム → (fetch) → WordPressのCF7 REST APIエンドポイント → Flamingo（WP管理画面）
```

フロント側（HTML・確認モーダルのデザイン）はほぼ変更不要です。送信先とペイロードの形式だけ変わります。

---

## 手順1: WordPress側の準備

1. プラグイン「Contact Form 7」と「Flamingo」をインストール・有効化
2. 固定ページのエディタは使わず、CF7の管理画面から直接フォームを2つ作成します
   （静的サイト側は独自デザインのフォームをそのまま使うので、CF7のショートコードをページに埋め込む必要はありません。
   CF7を「フォームの定義＋受信エンドポイント」としてだけ使うイメージです）
   - フォームA: 「FAQ質問」— 項目: 対象弾(vol) / カード名(card) / 質問内容(content)
   - フォームB: 「大会申請」— apply.htmlの全項目(organizerName, organizerEmail, xAccount, discordId,
     eventName, eventDate, startTime, endTime, venue, eventFormat, eventType, eventPurpose,
     capacity, fee, cardFormat, regulation, announceTitle, announceDesc, imageUrl, eventPageUrl,
     pastCount, pastUrl) と同じ name 属性でタグを作成
3. 各フォームの「フォーム」タブで、必ず `name="organizerName"` のように、今のHTMLフォームの
   `name` 属性と完全に一致するタグ名で入力欄を定義してください（一致していないと値が届きません）
4. 各フォーム編集画面のURLやショートコード `[contact-form-7 id="123" ...]` の `id="123"` の数字を控えておく
   （これがエンドポイントURLに必要な「フォームID」です）
5. CF7の「メール」タブで、送信時の通知先メールアドレスを設定（Slack通知が欲しい場合は
   後述のWP Webhook系プラグイン、または簡易にIFTTT/Zapier経由でメール→Slack転送も可）
6. Flamingoの管理画面で受信メッセージの一覧・検索ができることを確認

---

## 手順2: エンドポイントURLの確認

CF7はデフォルトで以下のREST APIエンドポイントを提供しています(WordPressで自動的に有効):

```
POST https://あなたのドメイン/wp-json/contact-form-7/v1/contact-forms/{フォームID}/feedback
```

ブラウザで `https://あなたのドメイン/wp-json/contact-form-7/v1/contact-forms/{フォームID}/feedback` に
何もつけずアクセスして405/404以外のレスポンス(GETなので通常405 Method Not Allowedが返れば正常)が
返ることを確認してください。

**重要な違い**: GASのようにJSON文字列を送るのではなく、CF7は`multipart/form-data`(FormDataオブジェクト)
を期待します。JSONではPOSTしても受け付けてくれないので注意してください。

---

## 手順3: script.js の書き換え（サンプルコード）

`submitToBackend`関数を、CF7エンドポイント用に書き換えます。フォーム種別ごとにエンドポイントが
異なる点に注意してください。

```js
const CONFIG = {
    WP_BASE_URL: 'https://あなたのドメイン', // 末尾スラッシュなし
    CF7_FAQ_FORM_ID: '123',       // FAQ質問フォームのID
    CF7_APPLICATION_FORM_ID: '456' // 大会申請フォームのID
};

// CF7へFormDataとして送信する共通関数
function submitToWordPress(formId, dataObj) {
    const endpoint = `${CONFIG.WP_BASE_URL}/wp-json/contact-form-7/v1/contact-forms/${formId}/feedback`;
    const fd = new FormData();
    Object.keys(dataObj).forEach(key => fd.append(key, dataObj[key] ?? ''));

    return fetch(endpoint, {
        method: 'POST',
        body: fd
        // Content-Typeは指定しない（FormData使用時はブラウザが自動でboundary付きmultipartに設定するため）
    }).then(res => res.json()).then(json => {
        // CF7のレスポンスは { status: "mail_sent" | "validation_failed" | ... } という形式
        return { ok: json.status === 'mail_sent', raw: json };
    });
}
```

3つの送信箇所の呼び出し例(既存のGAS呼び出しを置き換える):

```js
// FAQ質問（vol詳細ページ・FAQ一覧ページ共通）
submitToWordPress(CONFIG.CF7_FAQ_FORM_ID, {
    vol: volField.options[volField.selectedIndex].text,
    card: cardField.value.trim(),
    content: contentField.value.trim(),
    website: getHoneypotValue(form) // ハニーポットもそのまま一緒に送ってOK（CF7側は無視するだけ）
}).then(result => { /* 既存の成功/失敗処理はそのまま使えます */ });

// 大会申請（apply.html）
const formData = new FormData(applyForm); // そのままCF7に渡せる形
formData.append('type', 'application'); // 任意（無くても動作します）
fetch(`${CONFIG.WP_BASE_URL}/wp-json/contact-form-7/v1/contact-forms/${CONFIG.CF7_APPLICATION_FORM_ID}/feedback`, {
    method: 'POST',
    body: formData
}).then(res => res.json()).then(json => {
    if (json.status === 'mail_sent') { /* 成功表示 */ }
});
```

---

## 手順4: CORSについて

静的サイトとWordPressが**同じドメイン**（例:`community.example.com`もWordPress本体も同じ
`example.com`配下）であれば、CORSの問題は起きません。サブドメインを分けている場合
(例: サイトは`community.example.com`、WordPressは`example.com`)は、WordPress側で
CORSヘッダーを許可する設定が必要になります(functions.phpに`Access-Control-Allow-Origin`を
追加するか、CORS対応プラグインを利用)。

---

## 手順5: 既存のCode.gs / GASは無効化・撤去

移行が完了し、スプレッドシートに新規データが来なくなったことを確認したら、
GASのWebアプリのデプロイを「アーカイブ」して閉じておくと安全です(古いURLが残っていても
誰にも呼ばれない状態にする)。今回追加したtoken/honeypotのチェックは、CF7に移行後は
そのまま残しておいても無害です(単に使われなくなるだけ)。

---

## まとめ

| 項目 | Google Apps Script(現状) | Contact Form 7 + Flamingo(移行後) |
|---|---|---|
| 管理画面 | Googleスプレッドシート | WordPress管理画面(Flamingo) |
| 通知 | Slack Webhook(自作コード) | メール標準対応、Slackは別途連携が必要 |
| スパム対策 | 自作(token/honeypot) | Akismet連携、reCAPTCHA連携プラグインあり |
| 費用 | 無料 | 無料 |
| 承認ワークフロー | なし(手動でシートのステータス列を更新) | なし(手動でFlamingoのタグ・メモ機能を活用) |

まずはこの構成で運用してみて、申請件数が増えてワークフローが必要になったタイミングで
Gravity Forms等への移行を検討するのがおすすめです。
