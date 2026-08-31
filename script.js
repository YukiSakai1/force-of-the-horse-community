// ===================================================================
// Force of the Horse Community Site - script.js
// Real calendar (synced to today's date) + UI interactions
// ===================================================================

// ここにGoogle Apps ScriptのウェブアプリURLを設定してください
// (デプロイ後に発行されるURL。/mnt/user-data/outputs/apps-script/Code.gs の
//  デプロイ手順を参照)
const CONFIG = {
    GAS_WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbxMl0EVZDiYByaBy3RQcR01GO7Z7Kw4xOnv6KKqDNy800aRdJyJ8CmblubWR3I8T0M/exec',
    // Code.gs の スクリプトプロパティ FORM_TOKEN と同じ値をここに設定してください。
    // （雑なURL直叩きスパムを減らすための簡易フィルタです。詳細はCode.gsのコメント参照）
    FORM_TOKEN: '4b88a23d80d3eb2e2646dd6e847fab88',
    // reCAPTCHA v3 のサイトキー（公開しても問題ない方の値。シークレットキーは絶対にここに書かない）。
    // https://www.google.com/recaptcha/admin でサイト登録すると発行されます。
    // 未設定（このままYOUR_RECAPTCHA_SITE_KEY_HEREの間）は reCAPTCHA なしで今まで通り動作します。
    RECAPTCHA_SITE_KEY: 'YOUR_RECAPTCHA_SITE_KEY_HERE'
};

// reCAPTCHA v3 のスクリプトを読み込む（サイトキーが設定されている時だけ）。
if (CONFIG.RECAPTCHA_SITE_KEY && CONFIG.RECAPTCHA_SITE_KEY !== 'YOUR_RECAPTCHA_SITE_KEY_HERE') {
    const recaptchaScriptEl = document.createElement('script');
    recaptchaScriptEl.src = `https://www.google.com/recaptcha/api.js?render=${CONFIG.RECAPTCHA_SITE_KEY}`;
    document.head.appendChild(recaptchaScriptEl);
}

// フォーム送信の直前に呼び、reCAPTCHA v3のトークンを1つ発行してもらうヘルパー。
// サイトキー未設定・読み込み前などは null を返し、送信自体は止めない。
function getRecaptchaToken(action) {
    if (!CONFIG.RECAPTCHA_SITE_KEY || CONFIG.RECAPTCHA_SITE_KEY === 'YOUR_RECAPTCHA_SITE_KEY_HERE') {
        return Promise.resolve(null);
    }
    if (typeof grecaptcha === 'undefined') {
        return Promise.resolve(null);
    }
    return new Promise(resolve => {
        try {
            grecaptcha.ready(() => {
                grecaptcha.execute(CONFIG.RECAPTCHA_SITE_KEY, { action: action || 'submit' })
                    .then(token => resolve(token))
                    .catch(() => resolve(null));
            });
        } catch (err) {
            resolve(null);
        }
    });
}

// =====================================================================
// ★★★ 送信頻度制限（レート制限）用のクライアントID ★★★
// Apps Scriptは呼び出し元のIPアドレスを取得できないため、代わりにブラウザごとに
// ランダムなIDを1つ発行してlocalStorageに保存し、送信のたびに一緒に送る。
// サーバー側(Code.gs)はこのIDを使って「同じブラウザからの短時間の連続送信」を制限する。
// （localStorageを消す・別ブラウザ/シークレットモードを使う等で回避はできてしまうため、
// 　完全なIPベースの制限ではなく、あくまで雑な連投・誤操作対策）
// =====================================================================
function getClientId() {
    const KEY = 'foth_client_id';
    try {
        let id = localStorage.getItem(KEY);
        if (!id) {
            id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
            localStorage.setItem(KEY, id);
        }
        return id;
    } catch (err) {
        // localStorageが使えない環境（プライベートモード等）では毎回ランダムなIDになる
        return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
}

// 直近の送信からあまり間を置かずに再送信しようとした場合、通信すら行わずその場で止める
// （サーバー側のレート制限と二重の対策。こちらはネットワーク往復なしで即座にわかる分、
// 　誤操作・連打によるムダな送信をより早く防げる）。
// type: 'faq' | 'application'。cooldownSeconds: 何秒あければ再送信できるか。
function checkClientCooldown(type, cooldownSeconds) {
    const KEY = `foth_last_submit_${type}`;
    try {
        const last = Number(localStorage.getItem(KEY) || 0);
        const remain = cooldownSeconds - (Date.now() - last) / 1000;
        return remain > 0 ? Math.ceil(remain) : 0;
    } catch (err) {
        return 0;
    }
}
function markClientSubmitted(type) {
    try {
        localStorage.setItem(`foth_last_submit_${type}`, String(Date.now()));
    } catch (err) { /* localStorage不可の環境は無視 */ }
}

// =====================================================================
// ★★★ 動作確認用の仮データ ★★★
// カレンダーの見た目・挙動（1件/2件/3件以上の表示、ポップアップ、アコーディオン等）を
// スプレッドシート連携なしですぐ確認できるよう、仮の大会情報を差し込んでいます。
// スプレッドシート側に本物の承認済みイベントが入ったら、この DEMO_MODE を
// false に変更してください（true のままだと本番データより仮データが優先されます）。
// =====================================================================
const DEMO_MODE = false;

// =====================================================================
// ★★★ 申請フォームの動作確認用モード ★★★
// Google Apps Script側の準備がまだでも、申請フォームを送信すると（実際には
// どこにも送信せず）完了画面（✓ 申請を受け付けました）が表示されるようにします。
// Apps Scriptのデプロイ・動作確認が済んだら、この APPLY_DEMO_MODE を
// false に変更してください（true のままだと、本番でも実際には送信されません）。
// =====================================================================
const APPLY_DEMO_MODE = false;

// 開催場所（施設名+住所の自由入力）から都道府県名だけを取り出すためのヘルパー。
// 申請フォームの「開催場所」欄は都道府県専用の入力欄になっていないため完全ではないが、
// 一般的な入力（「東京都〜」「大阪府大阪市〜」など都道府県名が含まれる書き方）であれば拾える。
// 見つからない場合は空文字を返し、呼び出し側で開催場所の全文にフォールバックする。
const PREFECTURES = [
    '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
    '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
    '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
    '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
    '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
    '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
    '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
];
function extractPrefecture(location) {
    if (!location) return '';
    const found = PREFECTURES.find(pref => location.includes(pref));
    return found || '';
}

function buildDemoEvents() {
    const today = new Date();
    const toISO = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };
    const plusDays = (n) => {
        const d = new Date(today);
        d.setDate(d.getDate() + n);
        return d;
    };

    return [
        // 今日: 1件（今日の日付が枠で囲まれることも確認できます）
        {
            date: toISO(today), type: '公式大会', title: '全国選手権 東京予選',
            location: '東京都・秋葉原イベントホール', time: '10:00〜18:00',
            fee: '2000', capacity: '32', organizer: 'FOTH運営事務局', contact: '@foth_official'
        },
        // 今日+3日: 2件（セル分割表示の確認用）
        {
            date: toISO(plusDays(3)), type: '公認イベント', title: '交流会 大阪',
            location: '大阪府大阪市・なんばカードショップ', time: '13:00〜17:00',
            fee: '500', capacity: '16', organizer: 'なんばカードショップ', contact: '@namba_cardshop'
        },
        {
            date: toISO(plusDays(3)), type: 'ショップイベント', title: '新弾発売記念大会',
            location: '大阪府大阪市・梅田ホビーステーション', time: '11:00〜15:00',
            fee: '1000', capacity: '24', organizer: 'ホビーステーション梅田店', contact: '@hobby_umeda'
        },
        // 今日+7日: 3件以上（ドット+件数表示の確認用）
        {
            date: toISO(plusDays(7)), type: '公式大会', title: '全国選手権 名古屋予選',
            location: '愛知県名古屋市・栄イベントスペース', time: '10:00〜18:00',
            fee: '2000', capacity: '32', organizer: 'FOTH運営事務局', contact: '@foth_official'
        },
        {
            date: toISO(plusDays(7)), type: '公認イベント', title: '初心者体験会',
            location: '愛知県名古屋市・大須カードスタジオ', time: '13:00〜16:00',
            fee: '無料', capacity: '10', organizer: '大須カードスタジオ', contact: '@osu_cardstudio'
        },
        {
            date: toISO(plusDays(7)), type: 'ショップイベント', title: '週末ミニ大会',
            location: '愛知県名古屋市・金山ホビーショップ', time: '19:00〜21:00',
            fee: '300', capacity: '12', organizer: '金山ホビーショップ', contact: '@kanayama_hobby'
        },
        // 来月分も1件用意（月送りの動作確認用）
        {
            date: toISO(plusDays(28)), type: '公認イベント', title: '交流会 札幌',
            location: '北海道札幌市・すすきのゲームカフェ', time: '14:00〜18:00',
            fee: '800', capacity: '20', organizer: 'すすきのゲームカフェ', contact: '@sapporo_gamecafe'
        }
    ];
}

// GASへJSONを送信する共通関数。
// Content-Type を text/plain にすることでブラウザのCORSプリフライトを回避している
// （GASのウェブアプリはOPTIONSリクエストにうまく応答できないため）。
// token・honeypot(hp_verify)・reCAPTCHAトークン・clientId（レート制限用）は
// 全送信に共通で自動付与する。
function submitToBackend(payload) {
    if (!CONFIG.GAS_WEB_APP_URL || CONFIG.GAS_WEB_APP_URL === 'YOUR_GAS_WEB_APP_URL_HERE') {
        return Promise.reject(new Error('GAS_WEB_APP_URL未設定'));
    }
    return getRecaptchaToken(payload.type || 'submit').then(recaptchaToken => {
        const fullPayload = Object.assign(
            {
                token: CONFIG.FORM_TOKEN,
                recaptchaToken: recaptchaToken || '',
                clientId: getClientId()
            },
            payload
        );
        return fetch(CONFIG.GAS_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(fullPayload)
        }).then(res => res.json());
    });
}

// バックエンド(Code.gs)から返るエラーコードを、ユーザー向けの分かりやすい文言に変換する。
// title/messageの2つを返す（アラート表示・モーダル表示のどちらでも使えるように）。
function getSubmitErrorText(err) {
    const code = err && err.message;
    switch (code) {
        case 'rate_limited':
            return {
                title: '送信が集中しています',
                message: '短時間に送信が集中したため、一時的に制限されています。しばらく時間をおいて再度お試しください。'
            };
        case 'invalid_email':
            return {
                title: 'メールアドレスをご確認ください',
                message: 'お問い合わせメールアドレスの形式が正しくないようです。ご確認のうえ、再度お試しください。'
            };
        case 'invalid_url':
            return {
                title: 'URLをご確認ください',
                message: '入力されたURLの形式が正しくないようです。http:// または https:// から始まるURLをご入力ください。'
            };
        case 'ng_word':
            return {
                title: '送信できませんでした',
                message: '入力内容に掲載できない可能性のある表現が含まれています。お手数ですが表現を変えて再度お試しください。'
            };
        case 'too_many_urls':
            return {
                title: '送信できませんでした',
                message: '入力内容に含まれるURLの数が多いため、送信できませんでした。URLの数を減らして再度お試しください。'
            };
        default:
            return {
                title: '送信に失敗しました',
                message: '通信エラーが発生しました。お手数ですが、時間をおいて再度お試しください。'
            };
    }
}

// honeypot欄（name="hp_verify"）の値を拾う共通ヘルパー。
// 人間には見えない/操作されない前提の欄なので、値が入っていたら送信ペイロードに
// そのまま乗せてサーバー側(Code.gs)で弾く。
function getHoneypotValue(formEl) {
    const el = formEl.querySelector('[name="hp_verify"]');
    return el ? el.value : '';
}

// スプレッドシート由来の文字列（FAQ回答・お知らせ・イベント申請内容など、非エンジニアが
// 入力したりユーザーが投稿した内容）をそのままinnerHTMLに差し込むとHTML/スクリプト注入の
// リスクがあるため、表示前に必ずこれを通す。
function escapeHtml(str) {
    return String(str === undefined || str === null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Code.gsの doGet?action=all を呼び、公開済みのFAQ・お知らせ・承認済みイベントを取得する。
// スクリプト読み込み直後に呼び出しておくことで、DOMContentLoaded時点ではほぼ取得済みになる。
function fetchPublicDataOnce(timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(`${CONFIG.GAS_WEB_APP_URL}?action=all`, { signal: controller.signal })
        .then(res => res.json())
        .then(json => (json && json.ok) ? json : null)
        .catch(err => {
            console.warn('[FAQ/お知らせ/イベント取得] 失敗しました:', err);
            return null;
        })
        .finally(() => clearTimeout(timer));
}

// =====================================================================
// FAQ/お知らせ/イベントデータのブラウザ内キャッシュ（sessionStorage）。
// Apps ScriptのウェブアプリはURLを叩くたびに数秒かかることがあるため、直近に取得した
// 内容を短時間だけ使い回し、同じセッション内でのページ間移動（TOP→カレンダー→FAQ等）を
// 速くする。index.html側も同じキー・同じ有効期限で読み書きしているので、ページをまたいでも
// キャッシュが効く。スプレッドシートを更新した直後はこの秒数だけ反映が遅れうる点に注意。
// =====================================================================
const PUBLIC_DATA_CACHE_KEY = 'foth_public_data_cache_v1';
const PUBLIC_DATA_CACHE_MS = 60 * 1000; // 60秒

function getCachedPublicData() {
    try {
        const raw = sessionStorage.getItem(PUBLIC_DATA_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.savedAt !== 'number') return null;
        if (Date.now() - parsed.savedAt > PUBLIC_DATA_CACHE_MS) return null;
        return parsed.data;
    } catch (err) {
        return null;
    }
}

function setCachedPublicData(data) {
    try {
        sessionStorage.setItem(PUBLIC_DATA_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
    } catch (err) {
        // プライベートモード等でsessionStorageが使えない場合は諦めて無視（キャッシュなしで動く）
    }
}

// 1回目が失敗・タイムアウトした場合、少し待ってからもう1回だけ再試行する。
function fetchPublicData() {
    const empty = { faq: [], announcements: [], events: [] };
    if (!CONFIG.GAS_WEB_APP_URL || CONFIG.GAS_WEB_APP_URL === 'YOUR_GAS_WEB_APP_URL_HERE') {
        return Promise.resolve(empty);
    }

    // 同じセッション内で少し前に取得済みならそれをそのまま使い、通信を省略する
    const cached = getCachedPublicData();
    if (cached) return Promise.resolve(cached);

    const toResult = (json) => ({
        faq: (json && Array.isArray(json.faq)) ? json.faq : [],
        announcements: (json && Array.isArray(json.announcements)) ? json.announcements : [],
        events: (json && Array.isArray(json.events)) ? json.events : []
    });
    return fetchPublicDataOnce(5000).then(json => {
        if (json) return toResult(json);
        return new Promise(resolve => setTimeout(resolve, 800))
            .then(() => fetchPublicDataOnce(8000))
            .then(toResult);
    }).then(result => {
        setCachedPublicData(result);
        return result;
    });
}

// ページ読み込み直後にリクエストを開始しておく（DOMContentLoadedで待つのは結果だけ）。
const publicDataPromise = fetchPublicData();

const MONTH_NAMES = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const DAY_NAMES = ['日','月','火','水','木','金','土'];

function daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function firstWeekday(year, month) {
    return new Date(year, month, 1).getDay();
}

// 承認済みイベント（申請フォーム経由でスプレッドシートに保存され、ステータスを
// 「承認済み」に変更したもの）を、Code.gsのdoGetから取得して入れる配列。
// フェッチが完了するまでは空配列で、カレンダーには「開催予定のイベントはありません」と表示される。
let REAL_EVENTS = [];

// Code.gs側で「イベント種別」はすでに公式大会／公認イベント／ショップイベントの
// 3区分に変換済みなので、ここでは表示用のCSSクラス名にマッピングするだけでよい。
function categoryClass(tag) {
    if (tag === '公式大会') return 'final';
    if (tag === 'ショップイベント') return 'meetup';
    return 'area'; // 公認イベント
}

// 指定した年月の承認済みイベントを、日付(day)をキーにしたオブジェクトへグループ化する。
// 同じ日に複数件のイベントがあってもすべて保持する（以前は1日1件までしか扱えなかった）。
function getMonthEvents(year, month) {
    const byDay = {};
    REAL_EVENTS
        .map(e => {
            const d = new Date(e.date + 'T00:00:00');
            return { raw: e, d: d };
        })
        .filter(x => !isNaN(x.d.getTime()) && x.d.getFullYear() === year && x.d.getMonth() === month)
        .forEach(x => {
            const day = x.d.getDate();
            const ev = {
                day: day,
                tag: x.raw.type,
                cls: categoryClass(x.raw.type),
                name: escapeHtml(x.raw.title),
                location: escapeHtml(x.raw.location),
                time: escapeHtml(x.raw.time || ''),
                fee: escapeHtml(x.raw.fee || ''),
                capacity: escapeHtml(x.raw.capacity || ''),
                organizer: escapeHtml(x.raw.organizer || ''),
                contact: escapeHtml(x.raw.contact || '')
            };
            if (!byDay[day]) byDay[day] = [];
            byDay[day].push(ev);
        });
    return byDay;
}

function getMonthEventsFlat(year, month) {
    const byDay = getMonthEvents(year, month);
    const list = [];
    Object.keys(byDay).forEach(day => byDay[day].forEach(ev => list.push(ev)));
    list.sort((a, b) => a.day - b.day);
    return list;
}

function formatDateShort(year, month, day) {
    return `${month + 1}/${day}`;
}

function formatDateFull(year, month, day) {
    return `${year}年${MONTH_NAMES[month]}${day}日`;
}

// ---------- Day click popup (list of that day's events, shared across calendars) ----------
let dayPopupBound = false;
let dayPopupOverlay = null;
let dayPopupDateEl = null;
let dayPopupListEl = null;
let dayPopupOnCardClick = null;

function ensureDayPopupBound() {
    if (dayPopupBound) return;
    dayPopupOverlay = document.getElementById('day-popup-overlay');
    if (!dayPopupOverlay) return;
    dayPopupDateEl = document.getElementById('day-popup-date');
    dayPopupListEl = document.getElementById('day-popup-list');
    const closeBtn = document.getElementById('day-popup-close');
    if (closeBtn) closeBtn.addEventListener('click', hideDayPopup);
    dayPopupOverlay.addEventListener('click', (e) => {
        if (e.target === dayPopupOverlay) hideDayPopup();
    });
    dayPopupBound = true;
}

function hideDayPopup() {
    if (dayPopupOverlay) dayPopupOverlay.classList.remove('open');
}

// その日の全イベントをカード形式で表示するポップアップ。カードをクリックすると
// 下の月間イベント一覧（アコーディオン）の該当箇所まで飛んで開く。
function showDayPopup(year, month, day, evs, onCardClick) {
    ensureDayPopupBound();
    if (!dayPopupOverlay) return;
    dayPopupOnCardClick = onCardClick;
    dayPopupDateEl.textContent = formatDateFull(year, month, day);
    dayPopupListEl.innerHTML = evs.map((ev, i) => `
        <button type="button" class="day-popup-card" data-index="${i}">
            <span class="event-tag-pill tag-${ev.cls}">${ev.tag}</span>
            <span class="dp-title">${ev.name}</span>
            <span class="dp-row">📍 ${ev.location}</span>
            <span class="dp-row">🕒 ${ev.time}</span>
        </button>`).join('');
    dayPopupListEl.querySelectorAll('.day-popup-card').forEach(card => {
        card.addEventListener('click', () => {
            const idx = Number(card.dataset.index);
            hideDayPopup();
            if (dayPopupOnCardClick) dayPopupOnCardClick(evs[idx]);
        });
    });
    dayPopupOverlay.classList.add('open');
}

// ---------- Calendar widget ----------
class EventCalendar {
    constructor(opts) {
        this.gridEl = opts.gridEl || null;
        this.labelEl = opts.labelEl || null;
        this.prevBtn = opts.prevBtn || null;
        this.nextBtn = opts.nextBtn || null;
        this.upcomingEl = opts.upcomingEl || null;       // simple compact list (unused on the calendar page)
        this.monthListEl = opts.monthListEl || null;     // accordion list for the displayed month only
        this.monthListHeadEl = opts.monthListHeadEl || null;
        this.monthListNextBtn = opts.monthListNextBtn || null; // 「来月を見る」矢印（カレンダー本体の月送りと連動）
        this.monthListPrevBtn = opts.monthListPrevBtn || null; // 「先月を見る」矢印（同上、逆方向）

        const now = new Date();
        this.year = now.getFullYear();
        this.month = now.getMonth();
        this.today = now;

        if (this.prevBtn) this.prevBtn.addEventListener('click', () => this.shift(-1));
        if (this.nextBtn) this.nextBtn.addEventListener('click', () => this.shift(1));
        // 月間イベント一覧側の矢印も、カレンダー本体と同じ shift() を呼ぶことで
        // 常に同じ月を指すように連動させる（以前は一覧だけ独立して月送りできる仕様だった）。
        if (this.monthListNextBtn) this.monthListNextBtn.addEventListener('click', () => this.shift(1));
        if (this.monthListPrevBtn) this.monthListPrevBtn.addEventListener('click', () => this.shift(-1));

        this.render();
    }

    shift(delta) {
        this.month += delta;
        if (this.month < 0) { this.month = 11; this.year--; }
        if (this.month > 11) { this.month = 0; this.year++; }
        this.render();
    }

    isToday(d) {
        return this.year === this.today.getFullYear() && this.month === this.today.getMonth() && d === this.today.getDate();
    }

    render() {
        const byDay = getMonthEvents(this.year, this.month);
        if (this.gridEl) this.renderGrid(byDay);
        if (this.labelEl) this.labelEl.textContent = `${this.year}年${MONTH_NAMES[this.month]}`;
        if (this.upcomingEl) this.renderUpcomingCompact();
        // 月間イベント一覧（アコーディオン）はカレンダー本体と同じ月を常に表示するので、
        // ここで一緒に再描画して連動させる。
        if (this.monthListEl) this.renderMonthAccordion();
    }

    renderGrid(byDay) {
        this.gridEl.innerHTML = '';
        DAY_NAMES.forEach((n, i) => {
            const el = document.createElement('div');
            el.className = 'calendar-day-name' + (i === 0 ? ' sun' : '') + (i === 6 ? ' sat' : '');
            el.textContent = n;
            this.gridEl.appendChild(el);
        });

        const startWd = firstWeekday(this.year, this.month);
        for (let i = 0; i < startWd; i++) {
            const el = document.createElement('div');
            el.className = 'calendar-day empty';
            this.gridEl.appendChild(el);
        }

        const total = daysInMonth(this.year, this.month);
        for (let d = 1; d <= total; d++) {
            const wd = new Date(this.year, this.month, d).getDay();
            const evs = byDay[d] || [];
            const el = document.createElement('div');
            el.className = 'calendar-day' +
                (evs.length ? ' event-day' : '') +
                (wd === 0 ? ' sun' : '') +
                (wd === 6 ? ' sat' : '') +
                (this.isToday(d) ? ' today' : '');

            const num = document.createElement('span');
            num.className = 'day-number';
            num.textContent = d;
            el.appendChild(num);

            // 1件: 従来通り色付きの帯にイベント名を表示。
            // 2件: セルを上下に分割し、それぞれカテゴリ色の帯に「イベント名」を表示
            //      （＝月間イベント一覧と同じく、日付の後の情報＝ev.nameを使う。収まらない分は…で省略）。
            // 3件以上: 内訳が伝わるよう、種別ごとの色付きドット+件数を表示（クリックでポップアップに全件表示）。
            if (evs.length === 1) {
                const tag = document.createElement('span');
                tag.className = 'event-tag tag-' + evs[0].cls;
                tag.textContent = evs[0].name;
                el.appendChild(tag);
            } else if (evs.length === 2) {
                const split = document.createElement('div');
                split.className = 'day-split';
                evs.forEach(ev => {
                    const half = document.createElement('span');
                    half.className = 'day-split-half tag-' + ev.cls;
                    half.textContent = ev.name;
                    half.title = `${ev.tag}${ev.location ? ' - ' + ev.location : ''}: ${ev.name}`;
                    split.appendChild(half);
                });
                el.appendChild(split);
            } else if (evs.length >= 3) {
                const dots = document.createElement('div');
                dots.className = 'day-dots';
                evs.forEach(ev => {
                    const dot = document.createElement('span');
                    dot.className = 'day-dot tag-' + ev.cls;
                    dot.title = `${ev.tag}: ${ev.name}`;
                    dots.appendChild(dot);
                });
                el.appendChild(dots);
                const count = document.createElement('span');
                count.className = 'day-count';
                count.textContent = `${evs.length}件`;
                el.appendChild(count);
            }

            if (evs.length) {
                const year = this.year, month = this.month, day = d;
                el.addEventListener('click', (e) => {
                    showDayPopup(year, month, day, evs, (ev) => this.jumpToAccordionItem(year, month, day, ev));
                    e.stopPropagation();
                });
            }
            this.gridEl.appendChild(el);
        }
    }

    // ポップアップ内のカードをクリックすると、カレンダー本体・月間イベント一覧（アコーディオン）
    // 両方をクリックした日の月に合わせてから、該当項目までスクロールして自動的に開く。
    jumpToAccordionItem(year, month, day, ev) {
        if (!this.monthListEl) return;
        if (this.year !== year || this.month !== month) {
            this.year = year;
            this.month = month;
            this.render();
        }
        const items = this.monthListEl.querySelectorAll('.event-acc-item');
        let target = null;
        items.forEach(item => {
            if (Number(item.dataset.day) === day && item.dataset.name === ev.name) target = item;
        });
        if (!target) return;
        items.forEach(item => item.classList.remove('open'));
        target.classList.add('open');
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // TOPページのミニカレンダーから「?y=2026&m=8&d=23」のような形でリンクされてきた時、
    // その月まで移動してから、その日のポップアップを自動的に開く。
    goToDayFromLink(year, month, day) {
        this.year = year;
        this.month = month;
        this.render();
        const byDay = getMonthEvents(year, month);
        const evs = byDay[day];
        if (evs && evs.length) {
            showDayPopup(year, month, day, evs, (ev) => this.jumpToAccordionItem(year, month, day, ev));
        }
    }

    // TOPページのミニカレンダーから「?y=2026&m=8&d=23&n=イベント名」の形でリンクされてきた時、
    // その日のポップアップを経由せず、該当月へ移動した上で対象イベントのアコーディオン項目を
    // 直接開く（jumpToAccordionItemと同じ検索ロジックだが、ポップアップのクリックを介さない）。
    goToAccordionItemFromLink(year, month, day, name) {
        this.year = year;
        this.month = month;
        this.render();
        this.jumpToAccordionItem(year, month, day, { name: name });
    }

    getUpcoming(limit) {
        const list = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let y = today.getFullYear();
        let m = today.getMonth();
        for (let i = 0; i < 8 && list.length < limit; i++) {
            let yy = y, mm = m + i;
            yy += Math.floor(mm / 12);
            mm = ((mm % 12) + 12) % 12;
            getMonthEventsFlat(yy, mm).forEach(e => {
                const d = new Date(yy, mm, e.day);
                if (d >= today) list.push(Object.assign({}, e, { year: yy, month: mm, dateObj: d }));
            });
        }
        list.sort((a, b) => a.dateObj - b.dateObj);
        return list.slice(0, limit);
    }

    renderUpcomingCompact() {
        const list = this.getUpcoming(4);
        this.upcomingEl.innerHTML = '';
        if (list.length === 0) {
            this.upcomingEl.innerHTML = '<p class="no-events">今後のイベント予定はありません</p>';
            return;
        }
        list.forEach(e => {
            const li = document.createElement('li');
            li.innerHTML = `<span class="u-date">${e.year}/${formatDateShort(e.year, e.month, e.day)}</span><span class="u-name">${escapeHtml(e.name)}</span>`;
            this.upcomingEl.appendChild(li);
        });
    }

    // 当月のイベントだけを、開催日時・タイトル・開催場所・参加費・募集人数・主催者名・
    // 問い合わせ先を含むアコーディオンとして表示する（空欄の項目は表示しない）。
    renderMonthAccordion() {
        if (this.monthListHeadEl) this.monthListHeadEl.textContent = `${this.year}年${MONTH_NAMES[this.month]}のイベント`;
        const list = getMonthEventsFlat(this.year, this.month);
        this.monthListEl.innerHTML = '';
        if (list.length === 0) {
            this.monthListEl.innerHTML = '<p class="no-events">この月に開催予定のイベントはありません</p>';
            return;
        }
        const year = this.year, month = this.month;
        list.forEach(ev => {
            const item = document.createElement('div');
            item.className = 'acc-item event-acc-item';
            item.dataset.day = ev.day;
            item.dataset.name = ev.name;

            const rows = [
                ['開催日時', escapeHtml(`${formatDateFull(year, month, ev.day)}${ev.time ? ' ' + ev.time : ''}`)],
                ['タイトル', escapeHtml(ev.name)]
            ];
            if (ev.location) rows.push(['開催場所', escapeHtml(ev.location)]);
            if (ev.fee) rows.push(['参加費', escapeHtml(ev.fee) + '円']);
            if (ev.capacity) rows.push(['募集人数', escapeHtml(ev.capacity) + '名']);
            if (ev.organizer) rows.push(['主催者名', escapeHtml(ev.organizer)]);
            if (ev.contact) rows.push(['問い合わせ先', escapeHtml(ev.contact)]);

            item.innerHTML = `
                <div class="acc-head">
                    <span><span class="event-tag-pill tag-${ev.cls}">${escapeHtml(ev.tag)}</span>${formatDateShort(year, month, ev.day)}　${escapeHtml(ev.name)}</span>
                    <span class="acc-toggle">▼</span>
                </div>
                <div class="acc-body">
                    <dl class="event-detail-list">
                        ${rows.map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`).join('')}
                    </dl>
                </div>`;
            item.querySelector('.acc-head').addEventListener('click', () => {
                item.classList.toggle('open');
            });
            this.monthListEl.appendChild(item);
        });
    }
}

// スプレッドシートで「回答済み」にしたFAQを、既存の.faq-itemと同じ見た目で描画する。
// 質問・回答はユーザー投稿／スタッフ入力の内容なので、必ずescapeHtmlを通してから差し込む。
function renderFaqList(container, items) {
    container.innerHTML = '';
    if (!items || items.length === 0) {
        container.innerHTML = '<p class="faq-empty">現在、このVolについて公開されているQ&Aはありません。下記フォームよりご質問をお寄せください。</p>';
        return;
    }
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'faq-item';
        div.innerHTML = `
            <div class="faq-question">
                <span class="faq-icon">Q</span>
                <span class="faq-question-text">${escapeHtml(item.question)}</span>
                <span class="faq-toggle">▼</span>
            </div>
            <div class="faq-answer">
                <span class="faq-icon">A</span>
                <p>${escapeHtml(item.answer)}</p>
                <span class="answer-date">回答日: ${escapeHtml(item.date)}</span>
            </div>`;
        container.appendChild(div);
    });
    // 新しく追加した.faq-itemにも開閉の挙動を効かせる
    container.querySelectorAll('.faq-question').forEach(question => {
        question.addEventListener('click', function () {
            const item = this.parentElement;
            const isActive = item.classList.contains('active');
            item.parentElement.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
            if (!isActive) item.classList.add('active');
        });
    });
}

// ---------- Apply form: 確認画面（入力内容の確認）で表示する項目定義 ----------
// key: FormDataのname属性 / label: 確認画面に出す見出し / suffix: 値の後ろに付ける単位（任意）
// 値が空（未入力の任意項目や、選択した開催形式に応じて隠れている項目）はセクションごと・行ごとにスキップされる
const APPLY_CONFIRM_SECTIONS = [
    {
        title: '1. 主催者情報',
        fields: [
            ['organizerName', '主催者名（ハンドルネーム可）'],
            ['organizerEmail', 'お問い合わせメールアドレス'],
            ['xAccount', 'Xアカウント'],
            ['discordId', 'Discord ID']
        ]
    },
    {
        title: '2. イベント基本情報',
        fields: [
            ['eventName', 'イベント名'],
            ['eventDate', '開催日'],
            ['startTime', '開始時間'],
            ['endTime', '終了予定時間']
        ]
    },
    {
        title: '3. 開催場所',
        fields: [
            ['eventFormat', '開催形式'],
            ['venueNameOffline', '会場名'],
            ['venueAddressOffline', 'ご住所'],
            ['venueNameOnline', '会場名（サーバー名など）'],
            ['venueNameHybridOnsite', '現地会場名'],
            ['venueAddressHybrid', 'ご住所'],
            ['venueNameHybridOnline', 'オンライン会場名']
        ]
    },
    {
        title: '4. イベント内容',
        fields: [
            ['eventType', 'イベント種別'],
            ['capacity', '定員', '名'],
            ['fee', '参加費', '円'],
            ['eventDescription', 'イベント説明文']
        ]
    },
    {
        title: '5. 主催者実績',
        fields: [
            ['pastCount', '過去開催回数', '回'],
            ['pastUrl', '過去のイベントURL']
        ]
    }
];

// FormDataから作ったpayloadオブジェクトを渡すと、確認画面用のHTML（セクション+項目）を組み立てる。
// 空欄の項目・セクションは自動的に非表示になる（例：開催形式で選ばなかった会場欄など）。
function buildApplyConfirmHtml(payload) {
    return APPLY_CONFIRM_SECTIONS.map(section => {
        const rows = section.fields
            .map(([key, label, suffix]) => {
                const raw = (payload[key] || '').toString().trim();
                if (!raw) return null;
                return { label, value: raw + (suffix || '') };
            })
            .filter(Boolean);
        if (rows.length === 0) return '';
        return `
            <div class="form-section">
                <h2>${escapeHtml(section.title)}</h2>
                ${rows.map(row => `
                    <div class="confirm-field">
                        <span class="cf-label">${escapeHtml(row.label)}</span>
                        <span class="cf-value">${escapeHtml(row.value)}</span>
                    </div>`).join('')}
            </div>`;
    }).join('');
}

// ---------- Init on DOM ready ----------
document.addEventListener('DOMContentLoaded', function () {

    // Mobile nav toggle
    const navToggle = document.querySelector('.nav-toggle');
    const mainNav = document.querySelector('.main-nav');
    if (navToggle && mainNav) {
        navToggle.addEventListener('click', () => mainNav.classList.toggle('open'));
    }

    // カレンダー系は「承認済み」の実イベントデータが揃ってから初期化する
    // （揃うまでは一瞬「開催予定のイベントはありません」と出るだけで、レイアウトは変わらない）。
    publicDataPromise.then(data => {
        REAL_EVENTS = DEMO_MODE ? buildDemoEvents() : data.events;

        // TOP page compact calendar
        const topGrid = document.getElementById('top-calendar-grid');
        if (topGrid) {
            new EventCalendar({
                gridEl: topGrid,
                labelEl: document.getElementById('top-calendar-month'),
                prevBtn: document.getElementById('top-cal-prev'),
                nextBtn: document.getElementById('top-cal-next'),
                upcomingEl: document.getElementById('top-upcoming-list')
            });
        }

        // Full event calendar page
        const pageGrid = document.getElementById('page-calendar-grid');
        if (pageGrid) {
            const pageCalendar = new EventCalendar({
                gridEl: pageGrid,
                labelEl: document.getElementById('page-calendar-month'),
                prevBtn: document.getElementById('page-cal-prev'),
                nextBtn: document.getElementById('page-cal-next'),
                monthListEl: document.getElementById('month-event-list'),
                monthListHeadEl: document.getElementById('month-event-heading'),
                monthListNextBtn: document.getElementById('month-list-next'),
                monthListPrevBtn: document.getElementById('month-list-prev')
            });

            // TOPページのミニカレンダーから「?y=2026&m=8&d=23」の形でリンクされてきた場合、
            // 該当の月へ移動し、その日のポップアップを自動的に開く。
            // イベント名(n)まで指定されている場合は、日付ポップアップを経由せず、
            // 該当イベントのアコーディオン項目を直接開く。
            const params = new URLSearchParams(window.location.search);
            const linkY = Number(params.get('y'));
            const linkM = Number(params.get('m')); // 1-12（TOPページのdata-month基準）
            const linkD = Number(params.get('d'));
            const linkN = params.get('n');
            if (linkY && linkM && linkD) {
                if (linkN) {
                    pageCalendar.goToAccordionItemFromLink(linkY, linkM - 1, linkD, linkN);
                } else {
                    pageCalendar.goToDayFromLink(linkY, linkM - 1, linkD);
                }
            }
        }
    });

    // FAQ詳細ページ（faq-starter.html / faq-vol1〜5.html）の質問一覧を
    // スプレッドシートで「回答済み」にした内容から動的に表示する。
    const faqListEl = document.getElementById('faq-list');
    if (faqListEl) {
        const vol = faqListEl.dataset.vol;
        publicDataPromise.then(data => {
            const items = data.faq.filter(f => f.vol === vol);
            renderFaqList(faqListEl, items);
            const pageDesc = document.querySelector('.page-desc');
            if (pageDesc) pageDesc.textContent = `${items.length}件のQ&A`;
        });
    }

    // Tapping anywhere outside a calendar day closes an open tooltip (touch devices).
    function hideCalendarTooltip() {
        // カレンダーツールチップを非表示にする処理
        const tooltip = document.querySelector('.calendar-tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.calendar-day.event-day')) hideCalendarTooltip();
    });

    // Generic action buttons pointing to "#"
    document.querySelectorAll('.action-button, .action-link-btn').forEach(btn => {
        btn.addEventListener('click', function (e) {
            if (this.getAttribute('href') === '#') {
                e.preventDefault();
                alert(`${this.textContent.trim()}の機能は現在準備中です`);
            }
        });
    });

    // FAQ / Guideline accordion (shared behaviour)
    document.querySelectorAll('.faq-question').forEach(question => {
        question.addEventListener('click', function () {
            const item = this.parentElement;
            const isActive = item.classList.contains('active');
            item.parentElement.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
            if (!isActive) item.classList.add('active');
        });
    });

    document.querySelectorAll('.acc-head').forEach(head => {
        head.addEventListener('click', function () {
            this.parentElement.classList.toggle('open');
        });
    });

    // Vol card placeholders
    document.querySelectorAll('.vol-more, .vol-card').forEach(el => {
        if (el.getAttribute('href') === '#') {
            el.addEventListener('click', function (e) {
                e.preventDefault();
                alert('このVolのQ&Aページは現在準備中です');
            });
        }
    });

    // ---------- FAQ question posting: 確認モーダル（faq.html本体・各Vol詳細ページ共通） ----------
    // モーダル本体（#post-modal / #post-modal-body）は各ページのHTMLに配置済み。
    // 対象弾・カード名・質問内容を渡すと、確認画面を出してから実際に送信する。
    function showQuestionConfirmModal(form, vol, card, content) {
        const modal = document.getElementById('post-modal');
        const modalBody = document.getElementById('post-modal-body');
        if (!modal || !modalBody) return;

        modalBody.innerHTML = `
            <h3>投稿内容をご確認ください</h3>
            <p class="modal-desc">以下の内容で投稿します。投稿後の内容変更はできません。</p>
            <dl class="preview-box">
                <dt>対象弾</dt><dd>${escapeHtml(vol)}</dd>
                <dt>カード名</dt><dd>${escapeHtml(card) || '（未入力）'}</dd>
                <dt>質問内容</dt><dd>${escapeHtml(content)}</dd>
            </dl>
            <div class="check-group">
                <label><input type="checkbox" id="chk1"> 入力内容に誤りはありません。</label>
                <label><input type="checkbox" id="chk2"> 投稿内容は運営判断で編集・要約・非掲載・削除される場合があることに同意します。</label>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-outline" id="modal-back">戻る</button>
                <button type="button" class="btn btn-primary" id="modal-submit" disabled>投稿する</button>
            </div>`;
        modal.classList.add('open');

        const chk1 = document.getElementById('chk1');
        const chk2 = document.getElementById('chk2');
        const submitBtn = document.getElementById('modal-submit');
        const updateSubmit = () => { submitBtn.disabled = !(chk1.checked && chk2.checked); };
        chk1.addEventListener('change', updateSubmit);
        chk2.addEventListener('change', updateSubmit);

        document.getElementById('modal-back').addEventListener('click', () => modal.classList.remove('open'));

        submitBtn.addEventListener('click', () => {
            const waitSec = checkClientCooldown('faq', 30);
            if (waitSec > 0) {
                modalBody.innerHTML = `
                    <div class="success-box">
                        <h3>連続投稿はできません</h3>
                        <p>短時間に連続して投稿することはできません。あと${waitSec}秒ほどお待ちいただき、再度お試しください。</p>
                        <button type="button" class="btn btn-outline" id="modal-close">閉じる</button>
                    </div>`;
                document.getElementById('modal-close').addEventListener('click', () => modal.classList.remove('open'));
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = '送信中...';

            submitToBackend({
                type: 'faq',
                vol: vol,
                card: card,
                content: content,
                hp_verify: getHoneypotValue(form)
            }).then(result => {
                if (!result || result.ok !== true) throw new Error((result && result.error) || 'unknown');
                markClientSubmitted('faq');
                modalBody.innerHTML = `
                    <div class="success-box">
                        <div class="s-icon">✓</div>
                        <h3>投稿を受け付けました</h3>
                        <p>ご投稿ありがとうございます。運営にて内容を確認のうえ、順次回答を掲載いたします。</p>
                        <button type="button" class="btn btn-primary" id="modal-close">閉じる</button>
                    </div>`;
                form.reset();
                document.getElementById('modal-close').addEventListener('click', () => modal.classList.remove('open'));
            }).catch(err => {
                const t = getSubmitErrorText(err);
                modalBody.innerHTML = `
                    <div class="success-box">
                        <h3>${escapeHtml(t.title)}</h3>
                        <p>${escapeHtml(t.message)}</p>
                        <button type="button" class="btn btn-outline" id="modal-close">閉じる</button>
                    </div>`;
                document.getElementById('modal-close').addEventListener('click', () => modal.classList.remove('open'));
            });
        });
    }

    // モーダルの背景クリックで閉じる（ページ内に#post-modalがある場合のみ）
    const postModalEl = document.getElementById('post-modal');
    if (postModalEl) {
        postModalEl.addEventListener('click', function (e) {
            if (e.target === postModalEl) postModalEl.classList.remove('open');
        });
    }

    // FAQ一覧ページ（faq.html）本体の質問投稿フォーム
    const postForm = document.getElementById('question-form');
    if (postForm) {
        const confirmBtn = document.getElementById('confirm-post-btn');
        const volSelect = document.getElementById('q-vol');
        const cardInput = document.getElementById('q-card');
        const contentInput = document.getElementById('q-content');

        confirmBtn.addEventListener('click', function () {
            if (!volSelect.value || !contentInput.value.trim()) {
                alert('対象弾と質問内容を入力してください');
                return;
            }
            showQuestionConfirmModal(
                postForm,
                volSelect.options[volSelect.selectedIndex].text,
                cardInput.value.trim(),
                contentInput.value.trim()
            );
        });
    }

    // ---------- Apply form (公認イベント申請) ----------
    const applyForm = document.getElementById('apply-form');
    if (applyForm) {
        // 開催形式（オフライン/オンライン/ハイブリッド）に応じて、開催場所の入力欄を
        // 切り替える。表示中の欄だけを必須にし、隠れている欄の値は送信時に空のまま送る
        // （Code.gs側でも同じ組み合わせを検証しているので、二重のチェックになる）。
        const venueGroups = applyForm.querySelectorAll('.venue-fields');
        const venuePlaceholder = applyForm.querySelector('.venue-placeholder');
        const formatRadios = applyForm.querySelectorAll('input[name="eventFormat"]');
        function updateVenueFields() {
            const selected = applyForm.querySelector('input[name="eventFormat"]:checked');
            const format = selected ? selected.value : '';
            venueGroups.forEach(group => {
                const match = group.dataset.format === format;
                group.style.display = match ? '' : 'none';
                group.querySelectorAll('input').forEach(input => {
                    input.required = match;
                    if (!match) input.value = '';
                });
            });
            if (venuePlaceholder) venuePlaceholder.style.display = format ? 'none' : '';
        }
        formatRadios.forEach(r => r.addEventListener('change', updateVenueFields));
        updateVenueFields();

        // 「入力 → 確認 → 送信」の3ステップ。
        // フォーム送信（確認するボタン）ではまだバックエンドへ送らず、入力内容の確認画面を挟む。
        // 実際の送信は確認画面の「申請する」ボタンを押した時点で行う。
        const formWrap = document.getElementById('apply-form-wrap');
        const confirmWrap = document.getElementById('apply-confirm');
        const confirmBody = document.getElementById('apply-confirm-body');
        const completeWrap = document.getElementById('apply-complete');
        const pageHead = document.getElementById('apply-page-head');
        const bcSep = document.getElementById('bc-confirm-sep');
        const bcCurrent = document.getElementById('bc-confirm-current');
        let pendingApplyPayload = null;

        function showApplyFormStep() {
            confirmWrap.style.display = 'none';
            formWrap.style.display = 'block';
            if (pageHead) pageHead.style.display = '';
            if (bcSep) bcSep.style.display = 'none';
            if (bcCurrent) bcCurrent.style.display = 'none';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function showApplyConfirmStep(payload) {
            confirmBody.innerHTML = buildApplyConfirmHtml(payload);
            formWrap.style.display = 'none';
            confirmWrap.style.display = 'block';
            if (pageHead) pageHead.style.display = 'none';
            if (bcSep) bcSep.style.display = '';
            if (bcCurrent) bcCurrent.style.display = '';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // ブラウザのtype="email"/type="url"検証を補う簡易チェック。
        // 最終的な検証はCode.gs側（サーバー）で行っているが、確認画面まで進んでから
        // エラーになるより、ここで早めに気づけた方が親切なため。
        const APPLY_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const APPLY_URL_REGEX = /^https?:\/\/\S+$/i;

        applyForm.addEventListener('submit', function (e) {
            e.preventDefault();

            const formData = new FormData(applyForm);
            const payload = { type: 'application', hp_verify: getHoneypotValue(applyForm) };
            formData.forEach((value, key) => { payload[key] = value; });

            if (!APPLY_EMAIL_REGEX.test((payload.organizerEmail || '').trim())) {
                alert('お問い合わせメールアドレスの形式が正しくないようです。ご確認ください。');
                return;
            }
            if (payload.pastUrl && payload.pastUrl.trim() && !APPLY_URL_REGEX.test(payload.pastUrl.trim())) {
                alert('過去のイベントURLの形式が正しくないようです。http:// または https:// から始まるURLをご入力ください。');
                return;
            }

            pendingApplyPayload = payload;
            showApplyConfirmStep(payload);
        });

        const applyConfirmBackBtn = document.getElementById('apply-confirm-back');
        if (applyConfirmBackBtn) {
            applyConfirmBackBtn.addEventListener('click', showApplyFormStep);
        }

        const applyConfirmSubmitBtn = document.getElementById('apply-confirm-submit');
        if (applyConfirmSubmitBtn) {
            applyConfirmSubmitBtn.addEventListener('click', function () {
                if (!pendingApplyPayload) return;

                const waitSec = checkClientCooldown('application', 30);
                if (waitSec > 0) {
                    alert(`短時間に連続して送信することはできません。あと${waitSec}秒ほどお待ちいただき、再度お試しください。`);
                    return;
                }

                applyConfirmSubmitBtn.disabled = true;
                applyConfirmSubmitBtn.textContent = '送信中...';

                const showSuccess = () => {
                    markClientSubmitted('application');
                    confirmWrap.style.display = 'none';
                    completeWrap.style.display = 'block';
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                };

                if (APPLY_DEMO_MODE) {
                    // テストモード: 実際には送信せず、少し待ってから完了画面だけ表示する
                    console.info('[APPLY_DEMO_MODE] 実際には送信していません。動作確認用の仮表示です。');
                    setTimeout(showSuccess, 500);
                    return;
                }

                submitToBackend(pendingApplyPayload).then(result => {
                    if (!result || result.ok !== true) throw new Error((result && result.error) || 'unknown');
                    showSuccess();
                }).catch(err => {
                    applyConfirmSubmitBtn.disabled = false;
                    applyConfirmSubmitBtn.textContent = '申請する';
                    const t = getSubmitErrorText(err);
                    alert(`${t.title}\n${t.message}`);
                });
            });
        }
    }

    // ---------- Vol detail pages: quick question form（投稿前に確認モーダルを挟む） ----------
    document.querySelectorAll('.vol-question-form').forEach(form => {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            const contentField = form.querySelector('[name="content"]');
            if (!contentField.value.trim()) {
                alert('質問内容を入力してください');
                return;
            }
            const volField = form.querySelector('[name="vol"]');
            const cardField = form.querySelector('[name="card"]');

            showQuestionConfirmModal(
                form,
                volField.options[volField.selectedIndex].text,
                cardField.value.trim(),
                contentField.value.trim()
            );
        });
    });

});

