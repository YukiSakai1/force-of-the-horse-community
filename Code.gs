/**
 * Force of the Horse - フォーム受信バックエンド (Google Apps Script)
 *
 * 使い方:
 * 1. Googleスプレッドシートを新規作成
 * 2. 拡張機能 > Apps Script を開き、このファイルの内容を貼り付け
 * 3. (任意) Slack通知を使う場合は、スクリプトプロパティに SLACK_WEBHOOK_URL を設定
 * 4. デプロイ > 新しいデプロイ > 種類「ウェブアプリ」
 *      - 実行するユーザー: 自分
 *      - アクセスできるユーザー: 全員
 * 5. 発行されたウェブアプリURLを script.js の CONFIG.GAS_WEB_APP_URL に設定
 */

// ===== スパム/不正送信対策 =====
// スクリプトプロパティに FORM_TOKEN を設定してください（任意の文字列でOK）。
// 設定方法: Apps Scriptエディタ左メニュー「プロジェクトの設定」→「スクリプトプロパティ」
//          → プロパティ名 FORM_TOKEN / 値に好きなランダム文字列（例: 32文字程度のランダム英数字）
// この値は script.js の CONFIG.FORM_TOKEN と必ず一致させてください。
// 注意: これはURLを直接叩くような雑なスパム/botを弾くための簡易フィルタであり、
//       本気の攻撃者に対する強固な認証ではありません（値はブラウザ側JSに書かれるため見えます）。
//       重要なのは honeypot と組み合わせて「サイトを経由しない機械的な連投」を減らすことです。
//       本格的な対策としては reCAPTCHA v3 の導入を推奨します。
function getExpectedToken() {
  return PropertiesService.getScriptProperties().getProperty('FORM_TOKEN') || '';
}

// 各フィールドの最大文字数（想定外の大量データ・スクリプト埋め込み対策）
const MAX_LENGTHS = {
  short: 200,   // 名前・メール・URL・タイトルなど
  long: 3000    // 質問内容・説明文・レギュレーションなど
};

function clip(value, maxLen) {
  const s = (value === undefined || value === null) ? '' : String(value);
  return s.slice(0, maxLen);
}

// リクエストの基本チェック（token不一致 or honeypot欄に入力あり → スパム扱いで拒否）
function isSpammyRequest(data) {
  const expected = getExpectedToken();
  if (expected && data.token !== expected) return true;
  if (data.hp_verify) return true; // honeypot欄（人間の目には見えない想定の欄）に値が入っていたらbot
  return false;
}

// シート名（このままでOK。変える場合は下の定数も変更）
const SHEET_APPLICATION = '申請';
const SHEET_FAQ = 'FAQ質問';
const SHEET_ANNOUNCEMENT = 'お知らせ';

// 申請フォームの列見出し（スプレッドシートの1行目に自動生成されます）
// ステータス列は '未確認' → 内容を確認して問題なければ '承認済み' に変更すると、
// サイトのイベントカレンダーに自動で表示されます（却下する場合は '却下' 等、任意の文字列でOK）。
const APPLICATION_HEADERS = [
  '受付日時', 'ステータス',
  '主催者名', 'お問い合わせメールアドレス', 'Xアカウント', 'DiscordID',
  'イベント名', '開催日', '開始時間', '終了時間', '開催形式', '開催場所',
  'イベント種別', '定員', '参加費', 'イベント説明文',
  '過去開催回数', '過去イベントURL'
];

// FAQ質問フォームの列見出し
// ステータス列は '未回答' → '回答' 列に回答を書いた上で '回答済み' に変更すると、
// 対応するFAQページ（faq-starter.html / faq-vol1〜4.html）に自動で表示されます。
const FAQ_HEADERS = [
  '受付日時', 'ステータス', '対象弾', 'カード名', '質問内容', '回答'
];

// お知らせシートの列見出し（このシートは自動では作られないため、初回は
// 下記のいずれかの方法で作成してください:
//   1. Apps Scriptエディタで initAnnouncementSheet 関数を選んで一度実行する
//   2. または、下記6列を1行目に手入力したシートを「お知らせ」という名前で作成する
// '公開' 列に「公開」と入力した行だけがトップページに表示されます。
const ANNOUNCEMENT_HEADERS = [
  '掲載日', 'タグ', 'タイトル', '本文', '公開'
];

// お知らせシートが無い場合に、手動で一度だけ実行して作成するための関数。
// Apps Scriptエディタ上部の関数選択メニューで「initAnnouncementSheet」を選び、実行ボタンを押してください。
function initAnnouncementSheet() {
  getOrCreateSheet(SHEET_ANNOUNCEMENT, ANNOUNCEMENT_HEADERS);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const type = data.type;

    if (isSpammyRequest(data)) {
      // botや直接URL叩きと判定。詳細を教えないよう同じ成功風レスポンスにせず、
      // シンプルに拒否として返す（呼び出し側は「送信に失敗しました」を表示する）
      return jsonResponse({ ok: false, error: 'rejected' });
    }

    if (type === 'application') {
      return handleApplication(data);
    } else if (type === 'faq') {
      return handleFaq(data);
    } else {
      return jsonResponse({ ok: false, error: 'unknown type' });
    }
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

// 動作確認用（ブラウザでURLを開くとこれが返る）
// ?action=all を付けてアクセスすると、公開済みのFAQ・お知らせ・承認済みイベントを
// JSONで返す（サイト側のscript.js/index.htmlが読みに来る）。
function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === 'all') {
    return jsonResponse({
      ok: true,
      faq: getPublishedFaq(),
      announcements: getPublishedAnnouncements(),
      events: getApprovedEvents()
    });
  }
  return jsonResponse({ ok: true, message: 'Force of the Horse backend is running' });
}

// シートの全行を、見出し行をキーにしたオブジェクトの配列に変換する共通ヘルパー
function sheetToObjects(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1)
    .filter(row => row.some(cell => String(cell).trim() !== '')) // 完全な空行はスキップ
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
}

// 「対象弾」の表示テキストを、FAQページ側が使うキー(starter/vol1〜vol4)に変換する。
// 新しいVolを追加する場合はここにも1行足してください。
function volKeyFromText(text) {
  const t = String(text || '');
  if (t.indexOf('スターター') !== -1) return 'starter';
  if (t.indexOf('01') !== -1 || t.indexOf('競馬、新章') !== -1) return 'vol1';
  if (t.indexOf('02') !== -1 || t.indexOf('英雄VS豪傑') !== -1) return 'vol2';
  if (t.indexOf('03') !== -1 || t.indexOf('砂の王') !== -1) return 'vol3';
  if (t.indexOf('04') !== -1 || t.indexOf('GO FASTER') !== -1) return 'vol4';
  if (t.indexOf('05') !== -1 || t.indexOf('覚醒の蹄') !== -1) return 'vol5';
  return '';
}

function formatDateJa(value) {
  if (!value) return '';
  const d = (value instanceof Date) ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy年M月d日');
}

function formatDateISO(value) {
  if (!value) return '';
  const d = (value instanceof Date) ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

// 「FAQ質問」シートのうち、ステータスが「回答済み」かつ回答が入力済みの行だけを公開する
function getPublishedFaq() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_FAQ);
  if (!sheet) return [];
  return sheetToObjects(sheet)
    .filter(r => r['ステータス'] === '回答済み' && String(r['回答'] || '').trim())
    .map(r => ({
      vol: volKeyFromText(r['対象弾']),
      card: r['カード名'] || '',
      question: r['質問内容'] || '',
      answer: r['回答'] || '',
      date: formatDateJa(r['受付日時'])
    }))
    .filter(r => r.vol); // 対象弾がどのVolか判別できないものは念のため除外
}

// 「お知らせ」シートのうち、公開列が「公開」になっている行だけを、新しい順に最大10件返す
function getPublishedAnnouncements() {
  const sheet = getOrCreateSheet(SHEET_ANNOUNCEMENT, ANNOUNCEMENT_HEADERS);
  return sheetToObjects(sheet)
    .filter(r => String(r['公開'] || '').trim() === '公開')
    .map(r => ({
      date: formatDateJa(r['掲載日']),
      tag: r['タグ'] || 'お知らせ',
      title: r['タイトル'] || '',
      body: r['本文'] || ''
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 10);
}

// 申請フォームの「イベント種別」を、カレンダー表示用の3区分（公式大会／公認イベント／
// ショップイベント）に変換する。「公認大会」だけを公式大会扱いにし、シート上で手動で
// 「ショップイベント」と入力した行はショップイベント扱いにする。それ以外は公認イベント扱い。
function mapEventCategory(type) {
  const t = String(type || '');
  if (t === '公認大会') return '公式大会';
  if (t === 'ショップイベント') return 'ショップイベント';
  return '公認イベント';
}

// 「申請」シートのうち、ステータスが「承認済み」の行だけをイベントカレンダー用に返す
function getApprovedEvents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_APPLICATION);
  if (!sheet) return [];
  return sheetToObjects(sheet)
    .filter(r => r['ステータス'] === '承認済み' && r['開催日'])
    .map(r => ({
      date: formatDateISO(r['開催日']),
      title: r['イベント名'] || '',
      location: r['開催場所'] || '',
      type: mapEventCategory(r['イベント種別']),
      time: [r['開始時間'], r['終了時間']].filter(Boolean).join('〜'),
      fee: r['参加費'] !== '' && r['参加費'] !== undefined ? String(r['参加費']) : '',
      capacity: r['定員'] !== '' && r['定員'] !== undefined ? String(r['定員']) : '',
      organizer: r['主催者名'] || '',
      // 個人情報保護のため、公開カレンダーには申請時のメールアドレスではなく
      // X/DiscordなどSNS上の連絡先のみを表示する（メールはスプレッドシート内のみで保管）。
      contact: r['Xアカウント'] || r['DiscordID'] || ''
    }));
}

// 開催形式（オフライン/オンライン/ハイブリッド）に応じて入力された開催場所の項目を
// 1つの読みやすいテキストにまとめる。
function buildVenueText(data) {
  const fmt = data.eventFormat;
  if (fmt === 'オフライン') {
    return [data.venueNameOffline, data.venueAddressOffline].filter(v => String(v || '').trim()).join(' / ');
  }
  if (fmt === 'オンライン') {
    return String(data.venueNameOnline || '').trim();
  }
  if (fmt === 'ハイブリッド') {
    const onsite = [data.venueNameHybridOnsite, data.venueAddressHybrid].filter(v => String(v || '').trim()).join(' / ');
    const online = String(data.venueNameHybridOnline || '').trim();
    return [onsite, online ? `オンライン: ${online}` : ''].filter(Boolean).join(' ／ ');
  }
  return '';
}

function handleApplication(data) {
  // 必須項目チェック（フロント側のrequiredをすり抜けて直接送られてきた場合の保険）
  const required = ['organizerName', 'organizerEmail', 'eventName', 'eventDate', 'startTime', 'endTime', 'eventFormat', 'eventType', 'capacity', 'fee', 'eventDescription'];
  for (const key of required) {
    if (!data[key] || !String(data[key]).trim()) {
      return jsonResponse({ ok: false, error: 'missing required field: ' + key });
    }
  }

  // 開催形式ごとに必要な開催場所の項目が入力されているかを確認する
  const venueText = buildVenueText(data);
  if (!venueText) {
    return jsonResponse({ ok: false, error: 'missing required field: venue' });
  }

  const sheet = getOrCreateSheet(SHEET_APPLICATION, APPLICATION_HEADERS);
  const row = [
    new Date(),
    '未確認',
    clip(data.organizerName, MAX_LENGTHS.short),
    clip(data.organizerEmail, MAX_LENGTHS.short),
    clip(data.xAccount, MAX_LENGTHS.short),
    clip(data.discordId, MAX_LENGTHS.short),
    clip(data.eventName, MAX_LENGTHS.short),
    clip(data.eventDate, MAX_LENGTHS.short),
    clip(data.startTime, MAX_LENGTHS.short),
    clip(data.endTime, MAX_LENGTHS.short),
    clip(data.eventFormat, MAX_LENGTHS.short),
    clip(venueText, MAX_LENGTHS.short),
    clip(data.eventType, MAX_LENGTHS.short),
    clip(data.capacity, MAX_LENGTHS.short),
    clip(data.fee, MAX_LENGTHS.short),
    clip(data.eventDescription, MAX_LENGTHS.long),
    clip(data.pastCount, MAX_LENGTHS.short),
    clip(data.pastUrl, MAX_LENGTHS.short)
  ];
  sheet.appendRow(row);

  notifySlack(
    `📅 新しいイベント申請が届きました\n` +
    `イベント名: ${data.eventName || '(未入力)'}\n` +
    `開催日: ${data.eventDate || '-'} ${data.startTime || ''}〜${data.endTime || ''}\n` +
    `開催場所: ${venueText || '-'}\n` +
    `主催者: ${data.organizerName || '-'} (${data.organizerEmail || '-'})\n` +
    `種別: ${data.eventType || '-'}`
  );

  notifyEmail(
    '新しいイベント申請が届きました',
    `イベント名: ${data.eventName || '(未入力)'}\n` +
    `開催日: ${data.eventDate || '-'} ${data.startTime || ''}〜${data.endTime || ''}\n` +
    `開催場所: ${venueText || '-'}\n` +
    `主催者: ${data.organizerName || '-'} (${data.organizerEmail || '-'})\n` +
    `種別: ${data.eventType || '-'}\n\n` +
    `スプレッドシートの「申請」シートで詳細を確認し、内容に問題なければステータスを「承認済み」に変更してください。`
  );

  return jsonResponse({ ok: true });
}

function handleFaq(data) {
  if (!data.vol || !data.content || !String(data.content).trim()) {
    return jsonResponse({ ok: false, error: 'missing required field' });
  }

  const sheet = getOrCreateSheet(SHEET_FAQ, FAQ_HEADERS);
  const row = [
    new Date(),
    '未回答',
    clip(data.vol, MAX_LENGTHS.short),
    clip(data.card, MAX_LENGTHS.short),
    clip(data.content, MAX_LENGTHS.long),
    ''
  ];
  sheet.appendRow(row);

  notifySlack(
    `❓ 新しいFAQ質問が届きました\n` +
    `対象弾: ${data.vol || '-'}\n` +
    `カード名: ${data.card || '(未入力)'}\n` +
    `質問: ${data.content || '-'}`
  );

  notifyEmail(
    '新しいFAQ質問が届きました',
    `対象弾: ${data.vol || '-'}\n` +
    `カード名: ${data.card || '(未入力)'}\n` +
    `質問: ${data.content || '-'}\n\n` +
    `スプレッドシートの「FAQ質問」シートの「回答」欄に記入し、ステータスを「回答済み」に変更すると公開されます。`
  );

  return jsonResponse({ ok: true });
}

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function notifySlack(message) {
  const webhookUrl = PropertiesService.getScriptProperties().getProperty('SLACK_WEBHOOK_URL');
  if (!webhookUrl) return; // Slack未設定なら何もしない
  try {
    UrlFetchApp.fetch(webhookUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ text: message }),
      muteHttpExceptions: true
    });
  } catch (err) {
    // 通知失敗はスプレッドシート保存自体を失敗させない
    console.error('Slack notification failed: ' + err);
  }
}

// メール通知（任意）。スクリプトプロパティに NOTIFY_EMAIL を設定すると、
// 送信があるたびにそのアドレス宛にメールが届く。設定方法はSlackと同じく
// 「プロジェクトの設定」→「スクリプトプロパティ」から。複数人に送りたい場合は
// カンマ区切りで複数アドレスを入力可能（例: a@example.com,b@example.com）。
// 初回実行時にGoogleアカウントからのメール送信権限の許可を求められる場合があります。
function notifyEmail(subject, message) {
  const to = PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL');
  if (!to) return; // 未設定なら何もしない
  try {
    MailApp.sendEmail({
      to: to,
      subject: `[Force of the Horse] ${subject}`,
      body: message
    });
  } catch (err) {
    // メール送信失敗はスプレッドシート保存自体を失敗させない
    console.error('Email notification failed: ' + err);
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
