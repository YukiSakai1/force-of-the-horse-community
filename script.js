// ===================================================================
// Force of the Horse Community Site - script.js
// Real calendar (synced to today's date) + UI interactions
// ===================================================================

const MONTH_NAMES = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const DAY_NAMES = ['日','月','火','水','木','金','土'];
const CITIES = ['東京','大阪','名古屋','仙台','福岡','札幌','広島','横浜','金沢','京都'];

function daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function firstWeekday(year, month) {
    return new Date(year, month, 1).getDay();
}

function cityFor(index) {
    return CITIES[((index % CITIES.length) + CITIES.length) % CITIES.length];
}

// Generates a realistic set of sample "certified events" for a given month.
// Events fall on every Sunday of the month; the last Sunday is a meetup (交流会)
// instead of an area qualifier (エリア予選), mirroring the official schedule pattern.
function getMonthEvents(year, month) {
    const total = daysInMonth(year, month);
    const events = [];
    let cityIndex = (year + month) % CITIES.length;
    let sundays = [];
    for (let d = 1; d <= total; d++) {
        if (new Date(year, month, d).getDay() === 0) sundays.push(d);
    }
    sundays.forEach((d, i) => {
        const isLast = i === sundays.length - 1;
        const isFinal = (year === new Date().getFullYear() + 1 && month === 8 && isLast); // placeholder, unused normally
        const tag = isLast ? '交流会' : 'エリア予選';
        const city = cityFor(cityIndex + i);
        const name = isLast ? `公認交流会 － ${city}` : `エリア予選 － ${city}`;
        events.push({
            day: d,
            tag: tag,
            name: name,
            city: city,
            location: `${city}国際会議場`,
            time: isLast ? '13:00開場 / 14:00開始' : '10:00開場 / 11:00開始'
        });
    });
    return events;
}

function formatDateShort(year, month, day) {
    return `${month + 1}/${day}`;
}

function formatDateFull(year, month, day) {
    return `${year}年${MONTH_NAMES[month]}${day}日`;
}

function isToday(year, month, day) {
    const t = new Date();
    return t.getFullYear() === year && t.getMonth() === month && t.getDate() === day;
}

// ---------- Calendar widget ----------
class EventCalendar {
    constructor(opts) {
        this.gridEl = opts.gridEl || null;
        this.labelEl = opts.labelEl || null;
        this.prevBtn = opts.prevBtn || null;
        this.nextBtn = opts.nextBtn || null;
        this.upcomingEl = opts.upcomingEl || null;   // simple compact list (TOP page)
        this.monthListEl = opts.monthListEl || null; // detailed list for the displayed month (calendar page)
        this.monthListHeadEl = opts.monthListHeadEl || null;
        this.allEventsEl = opts.allEventsEl || null; // full upcoming list across months (calendar page)

        const now = new Date();
        this.year = now.getFullYear();
        this.month = now.getMonth();

        if (this.prevBtn) this.prevBtn.addEventListener('click', () => this.shift(-1));
        if (this.nextBtn) this.nextBtn.addEventListener('click', () => this.shift(1));

        this.render();
    }

    shift(delta) {
        this.month += delta;
        if (this.month < 0) { this.month = 11; this.year--; }
        if (this.month > 11) { this.month = 0; this.year++; }
        this.render();
    }

    render() {
        const events = getMonthEvents(this.year, this.month);
        if (this.gridEl) this.renderGrid(events);
        if (this.labelEl) this.labelEl.textContent = `${this.year}年${MONTH_NAMES[this.month]}`;
        if (this.upcomingEl) this.renderUpcomingCompact();
        if (this.monthListEl) this.renderMonthList(events);
        if (this.allEventsEl) this.renderAllUpcoming();
    }

    renderGrid(events) {
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
            const ev = events.find(e => e.day === d);
            const el = document.createElement('div');
            el.className = 'calendar-day' +
                (ev ? ' event-day' : '') +
                (wd === 0 ? ' sun' : '') +
                (wd === 6 ? ' sat' : '') +
                (isToday(this.year, this.month, d) ? ' today' : '');

            const num = document.createElement('span');
            num.className = 'day-number';
            num.textContent = d;
            el.appendChild(num);

            if (ev) {
                const tag = document.createElement('span');
                tag.className = 'event-tag ' + (ev.tag === 'エリア予選' ? 'tag-area' : 'tag-meetup');
                tag.textContent = ev.name;
                el.appendChild(tag);
                el.addEventListener('click', () => {
                    alert(`${this.year}/${this.month + 1}/${d}\n${ev.name}\n${ev.location}\n${ev.time}`);
                });
            }
            this.gridEl.appendChild(el);
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
            getMonthEvents(yy, mm).forEach(e => {
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

    renderMonthList(events) {
        if (this.monthListHeadEl) this.monthListHeadEl.textContent = `${this.year}年${MONTH_NAMES[this.month]}のイベント`;
        this.monthListEl.innerHTML = '';
        if (events.length === 0) {
            this.monthListEl.innerHTML = '<p class="no-events">この月に開催予定のイベントはありません</p>';
            return;
        }
        events.forEach(e => {
            const item = document.createElement('div');
            item.className = 'event-item';
            item.innerHTML = `
                <span class="event-tag-pill ${e.tag === 'エリア予選' ? 'tag-area' : 'tag-meetup'}">${e.tag}</span>
                <p class="event-item-date">${formatDateFull(this.year, this.month, e.day)}</p>
                <h3 class="event-item-title">${e.name}</h3>
                <p class="event-item-loc">${e.location}</p>`;
            this.monthListEl.appendChild(item);
        });
    }

    renderAllUpcoming() {
        const list = this.getUpcoming(10);
        this.allEventsEl.innerHTML = '';
        if (list.length === 0) {
            this.allEventsEl.innerHTML = '<p class="no-events">予定されているイベントはありません</p>';
            return;
        }
        list.forEach(e => {
            const li = document.createElement('li');
            li.className = 'event-item';
            li.innerHTML = `
                <span class="event-tag-pill ${e.tag === 'エリア予選' ? 'tag-area' : 'tag-meetup'}">${e.tag}</span>
                <p class="event-item-date">${formatDateFull(e.year, e.month, e.day)}</p>
                <h3 class="event-item-title">${e.name}</h3>
                <p class="event-item-loc">${e.location}</p>`;
            this.allEventsEl.appendChild(li);
        });
    }
}

// ---------- Init on DOM ready ----------
document.addEventListener('DOMContentLoaded', function () {

    // Mobile nav toggle
    const navToggle = document.querySelector('.nav-toggle');
    const mainNav = document.querySelector('.main-nav');
    if (navToggle && mainNav) {
        navToggle.addEventListener('click', () => mainNav.classList.toggle('open'));
    }

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
        new EventCalendar({
            gridEl: pageGrid,
            labelEl: document.getElementById('page-calendar-month'),
            prevBtn: document.getElementById('page-cal-prev'),
            nextBtn: document.getElementById('page-cal-next'),
            monthListEl: document.getElementById('month-event-list'),
            monthListHeadEl: document.getElementById('month-event-heading'),
            allEventsEl: document.getElementById('all-upcoming-list')
        });
    }

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
                modalBody.innerHTML = `
                    <div class="success-box">
                        <div class="s-icon">✓</div>
                        <h3>投稿を受け付けました</h3>
                        <p>ご投稿ありがとうございます。運営にて内容を確認のうえ、順次回答を掲載いたします。</p>
                        <button type="button" class="btn btn-primary" id="modal-close">閉じる</button>
                    </div>`;
                postForm.reset();
                document.getElementById('modal-close').addEventListener('click', () => modal.classList.remove('open'));
            });
        });

        modal.addEventListener('click', function (e) {
            if (e.target === modal) modal.classList.remove('open');
        });
    }

    // ---------- Apply form (公認イベント申請) ----------
    const applyForm = document.getElementById('apply-form');
    if (applyForm) {
        applyForm.addEventListener('submit', function (e) {
            e.preventDefault();
            document.getElementById('apply-form-wrap').style.display = 'none';
            document.getElementById('apply-complete').style.display = 'block';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
});
