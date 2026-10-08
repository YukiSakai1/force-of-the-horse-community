# 公認イベント申請フォーム改修仕様

## 方針

公認イベント制度は一つのまま、フォーム先頭で入力方法だけを分ける。

- `single`: 個人・単発主催者向け。開催日程は1件に固定する。
- `recurring`: 定期開催店・継続主催者向け。共通情報を一度入力し、開催日程を1行に1回分、最大12件まで追加する。

既存の入力確認、reCAPTCHA、honeypot、クライアント/サーバーのレート制限、Google Apps Script送信は維持する。主催者実績も任意項目として残す。

特典発送先は申請時には取得しない。承認後、申請時のメールアドレスへ発送先確認を送り、住所情報はイベント申請データから分離する。申請時の入力負荷と、住所を長期間保持するセキュリティリスクを抑えるための判断である。

## 送信payload

```json
{
  "type": "application",
  "applicationMode": "single | recurring",
  "organizerName": "主催者名（ハンドルネーム可）",
  "organizerEmail": "contact@example.com",
  "xAccount": "@account",
  "discordId": "account",
  "eventName": "イベント名",
  "eventFormat": "オフライン | オンライン | ハイブリッド",
  "eventDescription": "説明",
  "schedules": [
    {
      "eventDate": "YYYY-MM-DD",
      "startTime": "HH:mm",
      "endTime": "HH:mm",
      "eventType": "公認大会",
      "capacity": 32,
      "fee": 500
    }
  ],
  "pastCount": 10,
  "pastUrl": "https://example.com/event",
  "benefitFulfillment": "email_after_approval"
}
```

開催場所は従来どおり、開催形式に応じた `venueName*` / `venueAddress*` の各フィールドを送る。主催者情報も従来どおり、`organizerName`、`organizerEmail`、`xAccount`、`discordId` を使用する。

## スプレッドシートと承認フロー

現行の「申請」シートは、1行を1件の掲載イベントとして扱う。複数日程申請もこの構造を維持し、Google Apps Scriptが `schedules` を複数行へ展開する。

- 申請単位の共通情報は各行へコピーする。
- 同じ申請の行には内部用の「申請グループID」を付ける。主催者には申請番号として要求・表示しない。
- 「日程番号」「日程数」で、まとまった申請であることを管理者が確認できるようにする。
- 各行の初期ステータスは従来どおり「未確認」。承認済みにした日程だけがカレンダー/Players Portalへ掲載される。
- 一括承認が必要になった場合は、申請グループIDで行を絞り込んでステータスを更新できる。

既存シートの列順は変更しない。次の列だけを末尾へ自動追加する。

1. 申請グループID
2. 申請方法
3. 店舗・団体名
4. 担当者名
5. 電話番号
6. Webサイト・SNS URL
7. 日程番号
8. 日程数
9. 特典対応

店舗・団体名、担当者名、電話番号、Webサイト・SNS URLの列は、先行版フォームとの互換性と既存データ保持のため削除しない。従来構成へ戻したフォームからの新規申請では空欄になる。

既存の単一日程payloadも受信できるため、フォームとApps Scriptのデプロイに時間差があっても従来申請を取りこぼさない。

## サーバー検証

- `single` は日程1件、`recurring` は1〜12件。
- 各日程で開催日、開始・終了時刻、イベント種別、定員、参加費を必須にする。
- 終了時刻は開始時刻より後、定員は1以上、参加費は0以上。
- 主催者名とメールアドレスを必須にする。
- URL、メールアドレス、NGワード、URL件数、reCAPTCHA、honeypot、送信頻度は従来の検証を維持する。
- 発送先住所は申請payloadや「申請」シートへ保存しない。
