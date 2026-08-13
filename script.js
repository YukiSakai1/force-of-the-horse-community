// ===================================================================
// Force of the Horse Community Site - script.js
// Real calendar (synced to today's date) + UI interactions
// ===================================================================

// ここにGoogle Apps ScriptのウェブアプリURLを設定してください
// (デプロイ後に発行されるURL。/mnt/user-data/outputs/apps-script/Code.gs の
//  デプロイ手順を参照)
const CONFIG = {
    GAS_WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbxa6-eG29iGiITzdjtJZ8rn-slapCmFZz-7EVvcgLadhe69zMkDjVqey0Zzh33IvFPi/exec',
    // Code.gs の スクリプトプロパティ FORM_TOKEN と同じ値をここに設定してください。
    // （雑なURL直叩きスパムを減らすための簡易フィルタです。詳細はCode.gsのコメント参照）
    FORM_TOKEN: '4b88a23d80d3eb2e2646dd6e847fab88'
};

// =====================================================================
// ★★★ 動作確認用の仮データ ★★★
// カレンダーの見た目・挙動（1件/2件/3件以上の表示、ポップアップ、アコーディオン等）を
// スプレッドシート連携なしですぐ確認できるよう、仮の大会情報を差し込んでいます。
// スプレッドシート側に本物の承認済みイベントが入ったら、この DEMO_MODE を
// false に変更してください（true のままだと本番データより仮データが優先されます）。
// =====================================================================
const DEMO_MODE = true;

// =====================================================================
// ★★★ 申請フォームの動作確認用モード ★★★
// Google Apps Script側の準備がまだでも、申請フォームを送信すると（実際には
// どこにも送信せず）完了画面（✓ 申請を受け付けました）が表示されるようにします。
// Apps Scriptのデプロイ・動作確認が済んだら、この APPLY_DEMO_MODE を
// false に変更してください（true のままだと、本番でも実際には送信されません）。
// =====================================================================
const APPLY_DEMO_MODE = true;

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
// token と honeypot(hp_verify) は全送信に共通で自動付与する。
function submitToBackend(payload) {
    if (!CONFIG.GAS_WEB_APP_URL || CONFIG.GAS_WEB_APP_URL === 'YOUR_GAS_WEB_APP_URL_HERE') {
        return Promise.reject(new Error('GAS_WEB_APP_URL未設定'));
    }
    const fullPayload = Object.assign({ token: CONFIG.FORM_TOKEN }, payload);
    return fetch(CONFIG.GAS_WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(fullPayload)
    }).then(res => res.json());
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
function fetchPublicData() {
    const empty = { faq: [], announcements: [], events: [] };
    if (!CONFIG.GAS_WEB_APP_URL || CONFIG.GAS_WEB_APP_URL === 'YOUR_GAS_WEB_APP_URL_HERE') {
        return Promise.resolve(empty);
    }
    return fetch(`${CONFIG.GAS_WEB_APP_URL}?action=all`)
        .then(res => res.json())
        .then(json => ({
            faq: (json && json.ok && Array.isArray(json.faq)) ? json.faq : [],
            announcements: (json && json.ok && Array.isArray(json.announcements)) ? json.announcements : [],
            events: (json && json.ok && Array.isArray(json.events)) ? json.events : []
        }))
        .catch(() => empty);
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
        this.monthListNextBtn = opts.monthListNextBtn || null; // 「来月を見る」矢印（カレンダー本体とは独立して一覧だけ月送りする）
        this.monthListPrevBtn = opts.monthListPrevBtn || null; // 「先月を見る」矢印（同上、逆方向）

        const now = new Date();
        this.year = now.getFullYear();
        this.month = now.getMonth();
        this.today = now;

        // 月間イベント一覧（アコーディオン）は、カレンダー本体の月送りとは独立して
        // 動かせるように、専用の年月state（listYear/listMonth）を別に持たせる。
        this.listYear = now.getFullYear();
        this.listMonth = now.getMonth();

        if (this.prevBtn) this.prevBtn.addEventListener('click', () => this.shift(-1));
        if (this.nextBtn) this.nextBtn.addEventListener('click', () => this.shift(1));
        if (this.monthListNextBtn) this.monthListNextBtn.addEventListener('click', () => this.shiftList(1));
        if (this.monthListPrevBtn) this.monthListPrevBtn.addEventListener('click', () => this.shiftList(-1));

        this.render();
        if (this.monthListEl) this.renderMonthAccordion();
    }

    shift(delta) {
        this.month += delta;
        if (this.month < 0) { this.month = 11; this.year--; }
        if (this.month > 11) { this.month = 0; this.year++; }
        this.render();
    }

    shiftList(delta) {
        this.listMonth += delta;
        if (this.listMonth < 0) { this.listMonth = 11; this.listYear--; }
        if (this.listMonth > 11) { this.listMonth = 0; this.listYear++; }
        this.renderMonthAccordion();
    }

    isToday(d) {
        return this.year === this.today.getFullYear() && this.month === this.today.getMonth() && d === this.today.getDate();
    }

    render() {
        const byDay = getMonthEvents(this.year, this.month);
        if (this.gridEl) this.renderGrid(byDay);
        if (this.labelEl) this.labelEl.textContent = `${this.year}年${MONTH_NAMES[this.month]}`;
        if (this.upcomingEl) this.renderUpcomingCompact();
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

    // ポップアップ内のカードをクリックすると、下の月間イベント一覧（アコーディオン）を
    // クリックした日の月に合わせてから、該当項目までスクロールして自動的に開く。
    // （一覧側の矢印はカレンダー本体と独立して動くため、通常のカレンダー月送りでは
    //   一覧の表示月は変わらない。ジャンプ時だけ一致させる。）
    jumpToAccordionItem(year, month, day, ev) {
        if (!this.monthListEl) return;
        if (this.listYear !== year || this.listMonth !== month) {
            this.listYear = year;
            this.listMonth = month;
            this.renderMonthAccordion();
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

    // TOPページのミニカレンダーのポップアップ内カードから「?y=2026&m=8&d=23&t=イベント名」の
    // ような形でリンクされてきた時、日付ポップアップは経由せず、その月まで移動してから
    // 該当イベントのアコーディオン項目を直接開く（TOP側で一覧→カード選択まで済んでいるため）。
    // title未指定（後方互換）の場合は、その日の先頭のイベントを開く。
    goToDayFromLink(year, month, day, title) {
        this.year = year;
        this.month = month;
        this.render();
        const byDay = getMonthEvents(year, month);
        const evs = byDay[day];
        if (evs && evs.length) {
            let ev = evs[0];
            if (title) {
                // evs[].name は getMonthEvents() で escapeHtml 済みなので、比較対象も揃える
                const escapedTitle = escapeHtml(title);
                const found = evs.find(e => e.name === escapedTitle);
                if (found) ev = found;
            }
            this.jumpToAccordionItem(year, month, day, ev);
        }
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
            li.innerHTML = `<span class="u-date">${e.year}/${formatDateShort(e.year, e.month, e.day)}</span><span class="u-name">${e.name}</span>`;
            this.upcomingEl.appendChild(li);
        });
    }

    // 当月のイベントだけを、開催日時・タイトル・開催場所・参加費・募集人数・主催者名・
    // 問い合わせ先を含むアコーディオンとして表示する（空欄の項目は表示しない）。
    renderMonthAccordion() {
        if (this.monthListHeadEl) this.monthListHeadEl.textContent = `${this.listYear}年${MONTH_NAMES[this.listMonth]}のイベント`;
        const list = getMonthEventsFlat(this.listYear, this.listMonth);
        this.monthListEl.innerHTML = '';
        if (list.length === 0) {
            this.monthListEl.innerHTML = '<p class="no-events">この月に開催予定のイベントはありません</p>';
            return;
        }
        const year = this.listYear, month = this.listMonth;
        list.forEach(ev => {
            const item = document.createElement('div');
            item.className = 'acc-item event-acc-item';
            item.dataset.day = ev.day;
            item.dataset.name = ev.name;

            const rows = [
                ['開催日時', `${formatDateFull(year, month, ev.day)}${ev.time ? ' ' + ev.time : ''}`],
                ['タイトル', ev.name]
            ];
            if (ev.location) rows.push(['開催場所', ev.location]);
            if (ev.fee) rows.push(['参加費', ev.fee + '円']);
            if (ev.capacity) rows.push(['募集人数', ev.capacity + '名']);
            if (ev.organizer) rows.push(['主催者名', ev.organizer]);
            if (ev.contact) rows.push(['問い合わせ先', ev.contact]);

            item.innerHTML = `
                <div class="acc-head">
                    <span><span class="event-tag-pill tag-${ev.cls}">${ev.tag}</span>${formatDateShort(year, month, ev.day)}　${ev.name}</span>
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

            // TOPページのミニカレンダーのポップアップから「?y=2026&m=8&d=23&t=イベント名」の
            // 形でリンクされてきた場合、該当の月へ移動し、日付ポップアップは経由せず
            // 該当イベントのアコーディオン項目を直接開く。
            const params = new URLSearchParams(window.location.search);
            const linkY = Number(params.get('y'));
            const linkM = Number(params.get('m')); // 1-12（TOPページのdata-month基準）
            const linkD = Number(params.get('d'));
            const linkT = params.get('t');
            if (linkY && linkM && linkD) {
                pageCalendar.goToDayFromLink(linkY, linkM - 1, linkD, linkT);
            }
        }
    });

    // FAQ詳細ページ（faq-vol1〜5.html）の質問一覧を
    // スプレッドシートで「回答済み」にした内容から動的に表示する。
    // ※ スターターキット（vol === 'starter'）は faq-starter.json から表示するため、
    //   ここでは対象外にする（対象にすると下の処理と競合し、後勝ちで表示が消えてしまう）。
    const faqListEl = document.getElementById('faq-list');
    if (faqListEl && faqListEl.dataset.vol !== 'starter') {
        const vol = faqListEl.dataset.vol;
        publicDataPromise.then(data => {
            const items = data.faq.filter(f => f.vol === vol);
            renderFaqList(faqListEl, items);
            const pageDesc = document.querySelector('.page-desc');
            if (pageDesc) pageDesc.textContent = `${items.length}件のQ&A`;
        });
    }

    // Tapping anywhere outside a calendar day closes an open tooltip (touch devices).
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

    // ---------- FAQ question posting form + confirmation modal ----------
    const postForm = document.getElementById('question-form');
    if (postForm) {
        const confirmBtn = document.getElementById('confirm-post-btn');
        const modal = document.getElementById('post-modal');
        const modalBody = document.getElementById('post-modal-body');
        const volSelect = document.getElementById('q-vol');
        const cardInput = document.getElementById('q-card');
        const contentInput = document.getElementById('q-content');

        confirmBtn.addEventListener('click', function () {
            if (!volSelect.value || !contentInput.value.trim()) {
                alert('対象弾と質問内容を入力してください');
                return;
            }
            modalBody.innerHTML = `
                <h3>投稿内容をご確認ください</h3>
                <p class="modal-desc">以下の内容で投稿します。投稿後の内容変更はできません。</p>
                <dl class="preview-box">
                    <dt>対象弾</dt><dd>${volSelect.options[volSelect.selectedIndex].text}</dd>
                    <dt>カード名</dt><dd>${cardInput.value.trim() || '（未入力）'}</dd>
                    <dt>質問内容</dt><dd>${contentInput.value.trim()}</dd>
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
                submitBtn.disabled = true;
                submitBtn.textContent = '送信中...';

                submitToBackend({
                    type: 'faq',
                    vol: volSelect.options[volSelect.selectedIndex].text,
                    card: cardInput.value.trim(),
                    content: contentInput.value.trim(),
                    hp_verify: getHoneypotValue(postForm)
                }).then(result => {
                    if (!result || result.ok !== true) throw new Error(result && result.error);
                    modalBody.innerHTML = `
                        <div class="success-box">
                            <div class="s-icon">✓</div>
                            <h3>投稿を受け付けました</h3>
                            <p>ご投稿ありがとうございます。運営にて内容を確認のうえ、順次回答を掲載いたします。</p>
                            <button type="button" class="btn btn-primary" id="modal-close">閉じる</button>
                        </div>`;
                    postForm.reset();
                    document.getElementById('modal-close').addEventListener('click', () => modal.classList.remove('open'));
                }).catch(() => {
                    modalBody.innerHTML = `
                        <div class="success-box">
                            <h3>送信に失敗しました</h3>
                            <p>通信エラーが発生しました。お手数ですが、時間をおいて再度お試しください。</p>
                            <button type="button" class="btn btn-outline" id="modal-close">閉じる</button>
                        </div>`;
                    document.getElementById('modal-close').addEventListener('click', () => modal.classList.remove('open'));
                });
            });
        });

        modal.addEventListener('click', function (e) {
            if (e.target === modal) modal.classList.remove('open');
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

        // 申請フォームの入力内容を、確認画面用の「見出し + dt/dd」HTMLに組み立てる。
        // 未入力の任意項目（Xアカウント・過去実績など）は行ごと表示しない。
        const EVENT_TYPE_LABELS = {}; // eventTypeはoptionのテキストがそのまま値なので変換不要
        function formatDateJP(iso) {
            if (!iso) return '';
            const [y, m, d] = iso.split('-');
            if (!y || !m || !d) return iso;
            return `${y}年${Number(m)}月${Number(d)}日`;
        }
        function buildApplyConfirmHtml(fd) {
            const g = (name) => (fd.get(name) || '').toString().trim();
            const format = g('eventFormat');

            const venueRows = [];
            if (format === 'オフライン') {
                venueRows.push(['会場名', g('venueNameOffline')]);
                venueRows.push(['ご住所', g('venueAddressOffline')]);
            } else if (format === 'オンライン') {
                venueRows.push(['会場名（サーバー名など）', g('venueNameOnline')]);
            } else if (format === 'ハイブリッド') {
                venueRows.push(['現地会場名', g('venueNameHybridOnsite')]);
                venueRows.push(['ご住所', g('venueAddressHybrid')]);
                venueRows.push(['オンライン会場名', g('venueNameHybridOnline')]);
            }

            const sections = [
                {
                    title: '1. 主催者情報',
                    rows: [
                        ['主催者名', g('organizerName')],
                        ['お問い合わせメールアドレス', g('organizerEmail')],
                        ['Xアカウント', g('xAccount')],
                        ['Discord ID', g('discordId')]
                    ]
                },
                {
                    title: '2. イベント基本情報',
                    rows: [
                        ['イベント名', g('eventName')],
                        ['開催日', formatDateJP(g('eventDate'))],
                        ['開始時間', g('startTime')],
                        ['終了予定時間', g('endTime')]
                    ]
                },
                {
                    title: '3. 開催場所',
                    rows: [['開催形式', format]].concat(venueRows)
                },
                {
                    title: '4. イベント内容',
                    rows: [
                        ['イベント種別', g('eventType')],
                        ['定員', g('capacity') ? g('capacity') + '名' : ''],
                        ['参加費', g('fee') ? g('fee') + '円' : ''],
                        ['イベント説明文', g('eventDescription')]
                    ]
                },
                {
                    title: '5. 主催者実績',
                    rows: [
                        ['過去開催回数', g('pastCount') ? g('pastCount') + '回' : ''],
                        ['過去のイベントURL', g('pastUrl')]
                    ]
                }
            ];

            const sectionsHtml = sections.map(sec => {
                const rowsHtml = sec.rows
                    .filter(([, value]) => value)
                    .map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`)
                    .join('');
                if (!rowsHtml) return '';
                return `
                    <div class="form-section">
                        <h2>${escapeHtml(sec.title)}</h2>
                        <dl class="preview-box">${rowsHtml}</dl>
                    </div>`;
            }).join('');

            // 6. 確認事項: フォーム送信済み＝すべて同意済みなので、内容を再掲するだけの確認リストにする
            const agreementLabels = Array.from(
                applyForm.querySelectorAll('#agreement-section .check-group label span')
            ).map(span => span.textContent.trim());
            const agreementsHtml = agreementLabels.map(label =>
                `<li>${escapeHtml(label)}</li>`
            ).join('');

            return `
                ${sectionsHtml}
                <div class="form-section">
                    <h2>6. 確認事項</h2>
                    <ul class="preview-box" style="list-style:disc; padding-left:1.2em;">${agreementsHtml}</ul>
                </div>`;
        }

        const applyFormWrap = document.getElementById('apply-form-wrap');
        const applyConfirmWrap = document.getElementById('apply-confirm-wrap');
        const applyConfirmBody = document.getElementById('apply-confirm-body');
        const applyEyebrow = document.getElementById('apply-eyebrow');
        const applyTitle = document.getElementById('apply-title');
        const applyDesc = document.getElementById('apply-desc');
        const applyBreadcrumb = document.getElementById('apply-breadcrumb-current');
        const applyConfirmSubmitBtn = document.getElementById('apply-confirm-submit');

        function showApplyForm() {
            applyConfirmWrap.style.display = 'none';
            applyFormWrap.style.display = 'block';
            if (applyEyebrow) applyEyebrow.textContent = 'APPLICATION';
            if (applyTitle) applyTitle.textContent = 'Force of the Horse 公認イベント申請';
            if (applyDesc) applyDesc.textContent = 'Force of the Horseの公認イベント・交流会・大会の開催申請フォームです。必要事項をご入力の上、申請してください。';
            if (applyBreadcrumb) applyBreadcrumb.textContent = '公認イベント申請';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function showApplyConfirm(fd) {
            applyConfirmBody.innerHTML = buildApplyConfirmHtml(fd);
            applyFormWrap.style.display = 'none';
            applyConfirmWrap.style.display = 'block';
            if (applyEyebrow) applyEyebrow.textContent = 'CONFIRM';
            if (applyTitle) applyTitle.textContent = '入力内容の確認';
            if (applyDesc) applyDesc.textContent = '以下の内容で申請を送信します。内容をご確認のうえ、「申請する」を押してください。';
            if (applyBreadcrumb) applyBreadcrumb.textContent = '入力内容の確認';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // 1ステップ目: フォーム送信 → 直接送信せず、確認画面を表示する
        // （必須項目はHTML標準のrequired検証を通過済みなのでここでは組み立てだけ行う）
        applyForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const formData = new FormData(applyForm);
            showApplyConfirm(formData);
        });

        const applyConfirmBackBtn = document.getElementById('apply-confirm-back');
        if (applyConfirmBackBtn) {
            applyConfirmBackBtn.addEventListener('click', showApplyForm);
        }

        // 2ステップ目: 確認画面の「申請する」 → ここで実際にバックエンドへ送信する
        if (applyConfirmSubmitBtn) {
            applyConfirmSubmitBtn.addEventListener('click', function () {
                applyConfirmSubmitBtn.disabled = true;
                applyConfirmSubmitBtn.textContent = '送信中...';
                if (applyConfirmBackBtn) applyConfirmBackBtn.disabled = true;

                const formData = new FormData(applyForm);
                const payload = { type: 'application', hp_verify: getHoneypotValue(applyForm) };
                formData.forEach((value, key) => { payload[key] = value; });

                const showSuccess = () => {
                    applyConfirmWrap.style.display = 'none';
                    document.getElementById('apply-complete').style.display = 'block';
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                };

                const resetSubmitBtn = () => {
                    applyConfirmSubmitBtn.disabled = false;
                    applyConfirmSubmitBtn.textContent = '申請する';
                    if (applyConfirmBackBtn) applyConfirmBackBtn.disabled = false;
                };

                if (APPLY_DEMO_MODE) {
                    // テストモード: 実際には送信せず、少し待ってから完了画面だけ表示する
                    console.info('[APPLY_DEMO_MODE] 実際には送信していません。動作確認用の仮表示です。');
                    setTimeout(showSuccess, 500);
                    return;
                }

                submitToBackend(payload).then(result => {
                    if (!result || result.ok !== true) throw new Error(result && result.error);
                    showSuccess();
                }).catch(() => {
                    resetSubmitBtn();
                    alert('送信に失敗しました。通信環境をご確認のうえ、時間をおいて再度お試しください。');
                });
            });
        }
    }

    // ---------- Vol detail pages: quick question form (no confirm modal) ----------
    document.querySelectorAll('.vol-question-form').forEach(form => {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]');
            const contentField = form.querySelector('[name="content"]');
            if (!contentField.value.trim()) {
                alert('質問内容を入力してください');
                return;
            }
            const volField = form.querySelector('[name="vol"]');
            const cardField = form.querySelector('[name="card"]');

            const originalLabel = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = '送信中...';

            submitToBackend({
                type: 'faq',
                vol: volField.options[volField.selectedIndex].text,
                card: cardField.value.trim(),
                content: contentField.value.trim(),
                hp_verify: getHoneypotValue(form)
            }).then(result => {
                if (!result || result.ok !== true) throw new Error(result && result.error);
                submitBtn.textContent = '投稿しました ✓';
                form.reset();
                setTimeout(() => {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalLabel;
                }, 3000);
            }).catch(() => {
                submitBtn.disabled = false;
                submitBtn.textContent = originalLabel;
                alert('送信に失敗しました。時間をおいて再度お試しください。');
            });
        });
    });

    // ---------- FAQ JSON loading for starter kit ----------
    const faqList = document.getElementById('faq-list');
    const faqCount = document.getElementById('faq-count');
    if (faqList && faqList.dataset.vol === 'starter') {
        fetch('faq-starter.json')
            .then(response => response.json())
            .then(data => {
                // Update count
                if (faqCount) {
                    faqCount.textContent = `${data.questions.length}件のQ&A`;
                }

                // Clear loading state
                faqList.innerHTML = '';

                // Render FAQ items
                data.questions.forEach((item, index) => {
                    const faqItem = document.createElement('div');
                    faqItem.className = 'faq-item';
                    faqItem.innerHTML = `
                        <div class="faq-question">
                            <span class="faq-icon">Q</span>
                            <span class="faq-question-text">${escapeHtml(item.question)}</span>
                            <span class="faq-toggle">▼</span>
                        </div>
                        <div class="faq-answer">
                            <span class="faq-icon">A</span>
                            <p>${escapeHtml(item.answer)}</p>
                            <span class="answer-date">回答日: ${escapeHtml(item.answerDate)}</span>
                        </div>
                    `;
                    faqList.appendChild(faqItem);

                    // Add click handler for accordion
                    // ※ 表示/非表示はCSS側の .faq-item.active で制御しているため
                    //   'active' クラスをトグルする（'open' だとCSSと一致せず何も起きない）
                    const question = faqItem.querySelector('.faq-question');
                    question.addEventListener('click', function() {
                        const isActive = faqItem.classList.contains('active');
                        faqList.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
                        if (!isActive) faqItem.classList.add('active');
                    });
                });
            })
            .catch(error => {
                console.error('FAQ JSONの読み込みに失敗しました:', error);
                if (faqList) {
                    faqList.innerHTML = '<p class="faq-empty">FAQの読み込みに失敗しました。</p>';
                }
                if (faqCount) {
                    faqCount.textContent = '読み込みエラー';
                }
            });
    }
});

