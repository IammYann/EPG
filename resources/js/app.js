// ─────────────────────────────────────────────────
//  EPG TV Guide  ·  Single Page Application
// ─────────────────────────────────────────────────

// ─── State ───────────────────────────────────────
const state = {
    user: null,
    channels: [],
    currentDate: null,
    programsByChannel: {},  // { slug: [...programs] }
    reminders: [],
    notifications: [],
    unreadCount: 0,
    activeProgram: null,
    reminderTarget: null,
    activeLiveChannel: null,
    activeHoverChannelId: null,
    activeHoverProgramId: null,
    loading: false,
    epgInitialScrollDone: false, // guards one-time current-time positioning
};



// ─── Axios setup ─────────────────────────────────
axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
const _csrf = document.querySelector('meta[name="csrf-token"]')?.content;
if (_csrf) axios.defaults.headers.common['X-CSRF-TOKEN'] = _csrf;

// ─── Nepal timezone helper ────────────────────────
// Asia/Kathmandu = UTC + 5h 45m = UTC + 345 minutes
const NPT_OFFSET_MS = 345 * 60 * 1000;

function toNPT(isoOrDate) {
    return new Date(new Date(isoOrDate).getTime() + NPT_OFFSET_MS);
}

function nptMinutes(isoOrDate) {
    const d = toNPT(isoOrDate);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function fmtNPT(isoOrDate) {
    const d = toNPT(isoOrDate);
    let h = d.getUTCHours(), m = d.getUTCMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

function todayNPT() {
    const d = toNPT(new Date());
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// ─── Toast ───────────────────────────────────────
function toast(msg, type = 'ok') {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const el = document.createElement('div');
    const ok = type === 'ok';
    el.className = 'flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold shadow-2xl border backdrop-blur-md transition-all duration-300 opacity-0 translate-y-2 ' +
        (ok ? 'bg-slate-900/90 border-emerald-500/20 text-emerald-400'
            : 'bg-slate-900/90 border-rose-500/20 text-rose-400');
    el.innerHTML = `<i class="fa-solid ${ok ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i><span>${msg}</span>`;
    c.appendChild(el);
    requestAnimationFrame(() => el.classList.remove('opacity-0', 'translate-y-2'));
    setTimeout(() => { el.classList.add('opacity-0', 'translate-y-2'); setTimeout(() => el.remove(), 300); }, 3000);
}

// ─── API ─────────────────────────────────────────
async function apiGet(url) { return (await axios.get(url)).data; }

async function loadUser() { try { state.user = (await apiGet('/api/auth/me')).user; } catch { state.user = null; } }
async function loadChannels() {
    const data = await apiGet('/api/channels');
    state.channels = data;
    if (!state.currentDate && data.length) {
        const today = todayNPT();
        const allDates = [...new Set(data.flatMap(c => c.dates))].sort();
        state.currentDate = allDates.includes(today) ? today : allDates[0];
    }
}
async function loadProgramsForDate(date) {
    state.loading = true;
    renderApp();
    const results = await Promise.all(
        state.channels.map(ch =>
            apiGet(`/api/channels/${ch.slug}/programs?date=${date}`)
                .then(r => ({ slug: ch.slug, programs: r.programs }))
                .catch(() => ({ slug: ch.slug, programs: [] }))
        )
    );
    results.forEach(r => { state.programsByChannel[r.slug] = r.programs; });
    state.loading = false;
}
async function loadReminders() { if (state.user) try { state.reminders = await apiGet('/api/reminders'); } catch { } }
async function loadNotifications() {
    if (!state.user) return;
    try { const d = await apiGet('/api/notifications'); state.notifications = d.notifications; state.unreadCount = d.unread_count; } catch { }
}

// ─── Router ──────────────────────────────────────
function route() {
    const hash = location.hash || '#/epg';
    if (hash === '#/login') { if (state.user) { location.hash = '#/epg'; return; } return renderLogin(); }
    if (!state.user) { location.hash = '#/login'; return; }
    if (hash === '#/epg') {
        if (!state.currentDate) { loadChannels().then(() => loadProgramsForDate(state.currentDate).then(renderApp)); }
        else renderApp();
    } else if (hash === '#/reminders') {
        state.epgInitialScrollDone = false; // reset so returning to EPG re-centers
        loadReminders().then(renderApp);
    } else if (hash.startsWith('#/live/')) {
        state.epgInitialScrollDone = false; // reset so returning to EPG re-centers
        const slug = hash.replace('#/live/', '');
        if (!state.channels.length) {
            loadChannels().then(() => {
                state.activeLiveChannel = state.channels.find(c => c.slug === slug) || state.channels[0];
                renderApp();
            });
        } else {
            state.activeLiveChannel = state.channels.find(c => c.slug === slug) || state.channels[0];
            renderApp();
        }
    } else if (hash.startsWith('#/recorded/')) {
        state.epgInitialScrollDone = false; // reset so returning to EPG re-centers
        // Ensure channel/program data is loaded before rendering
        if (!state.channels.length) {
            loadChannels().then(() =>
                loadProgramsForDate(state.currentDate).then(renderApp)
            );
        } else if (Object.keys(state.programsByChannel).length === 0) {
            loadProgramsForDate(state.currentDate).then(renderApp);
        } else {
            renderApp();
        }
    }
}


window.addEventListener('hashchange', route);

// ─── Global click handler ─────────────────────────
document.addEventListener('click', e => {
    const bell = document.getElementById('bell-btn');
    const drop = document.getElementById('notif-drop');
    if (bell?.contains(e.target)) { drop?.classList.toggle('hidden'); return; }
    if (!drop?.contains(e.target)) drop?.classList.add('hidden');
});

// ─── HEADER ──────────────────────────────────────
function renderHeader() {
    const isEPG = (location.hash || '#/epg') === '#/epg';
    const isRem = location.hash === '#/reminders';
    return `
    <header style="background:var(--color-surface);border-bottom:1px solid var(--color-border);backdrop-filter:blur(12px)"
            class="sticky top-0 z-50 flex items-center justify-between px-5 py-3">
        <div class="flex items-center gap-6">
            <a href="#/epg" class="flex items-center gap-2">
                <i class="fa-solid fa-tv text-[var(--color-primary)] text-base"></i>
                <span class="text-white font-black text-sm tracking-widest">EPG</span>
            </a>
            <nav class="hidden sm:flex gap-1">
                <a href="#/epg" class="px-3 py-1.5 rounded-lg text-[11px] font-bold transition
                    ${isEPG ? 'bg-[var(--color-primary)] text-white border border-[var(--color-primary)]' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}">
                    Timeline
                </a>
                <a href="#/reminders" class="px-3 py-1.5 rounded-lg text-[11px] font-bold transition
                    ${isRem ? 'bg-[var(--color-primary)] text-white border border-[var(--color-primary)]' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}">
                    My Alerts <span class="ml-1 ${state.reminders.length ? 'opacity-100' : 'opacity-0'} bg-[var(--color-secondary)] text-[#111111] text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">${state.reminders.length}</span>
                </a>
            </nav>
        </div>
        <div class="flex items-center gap-3">
            <!-- Bell -->
            <div class="relative">
                <button id="bell-btn" class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 border border-white/5 transition relative">
                    <i class="fa-solid fa-bell text-xs"></i>
                    ${state.unreadCount > 0 ? `<span class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[var(--color-secondary)] rounded-full text-[8px] font-extrabold flex items-center justify-center text-[#111111]">${state.unreadCount}</span>` : ''}
                </button>
                <div id="notif-drop" class="hidden absolute right-0 mt-1.5 w-72 max-h-80 overflow-y-auto rounded-xl border border-white/10 shadow-2xl z-50"
                     style="background:var(--color-surface);backdrop-filter:blur(12px)">
                    <div class="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
                        <span class="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Notifications</span>
                        ${state.unreadCount ? `<button onclick="markAllRead()" class="text-[10px] text-[var(--color-secondary)] font-bold hover:underline">Mark all read</button>` : ''}
                    </div>
                    ${state.notifications.length === 0
            ? `<div class="px-4 py-8 text-center text-[11px] text-slate-400">No notifications yet</div>`
            : state.notifications.map(n => `
                            <div class="px-4 py-3 border-b border-white/5 hover:bg-white/5 relative ${!n.read_at ? 'bg-white/5' : ''}">
                                <div class="text-[11px] font-bold text-white pr-5">${n.title}</div>
                                <div class="text-[10px] text-slate-400 mt-0.5 leading-relaxed">${n.body}</div>
                                ${!n.read_at ? `<button onclick="markRead(${n.id})" class="absolute top-3 right-3 text-[var(--color-secondary)] text-[10px]"><i class="fa-solid fa-check"></i></button>` : ''}
                            </div>`).join('')}
                </div>
            </div>
            <!-- User -->
            <div class="flex items-center gap-2.5 pl-2.5 border-l border-white/10">
                <span class="hidden sm:inline text-[11px] font-bold text-slate-300">${state.user.name}</span>
                <button id="logout-btn" class="px-2.5 py-1.5 rounded-lg border border-white/10 text-[10px] font-bold text-slate-400 hover:text-rose-400 hover:border-rose-900/40 transition">
                    <i class="fa-solid fa-right-from-bracket mr-1"></i>Logout
                </button>
            </div>
        </div>
    </header>`;
}

// ─── EPG TIMELINE ────────────────────────────────
const PX_PER_MIN = 3;    // 3px per minute → 4320px for 24h (sharper resolution)
const GRID_W = 4320; // 24h × 60min × 3px
const LABEL_W = 140;  // px for the left sticky channel label column
const HEADER_H = 36;   // px for time axis header
const CARD_GAP = 2;    // px gap between adjacent cards
const HOVER_POPOUT_DELAY_MS = 600; // 600ms delay before hover popout appears
const HOVER_HIDE_GRACE_MS  = 120; // 120ms grace period to move cursor into popout card
let hoverPopoutTimer = null;
let popoutHideTimer  = null;
let isOverPopout     = false;

// ─── Centralized Program Background Video Mapping ───
const PROGRAM_VIDEO_MAP = {
    "Cricket Highlights": "crickethighlights.mp4",
    "ICC CWC Highlights": "ICCCWCHighlights.mp4",
    "One-Day International Cricket": "One-DayInternationalCricket.mp4",
    "ICC Champions Trophy Highlights": "ICCChampionsTrophyHighlights.mp4",
    "Assam Premier League Cricket Highlights": "AssamPremierLeagueCricketHighlights.mp4",
    "Cricket Countdown": "CricketHighlights.mp4",
    "IDFC FIRST Bank India vs England ODI 2025 Highlights": "IDFCFIRSTBankIndiavsEnglandODI2025Highlights.mp4",
    "ICC Cricket World Cup Highlights": "ICCChampionsTrophyHighlights.mp4",
    "CPL T20 Highlights": "crickethighlights.mp4",
    "Assam Premier League Cricket": "AssamPremierLeagueCricketHighlights.mp4",
    "To Be Announced": "short.mp4",
};

const DEFAULT_VIDEO = "short.mp4";

function getProgramHoverVideoSrc(title) {
    const filename = PROGRAM_VIDEO_MAP[title] ?? DEFAULT_VIDEO;
    return `/storage/${filename}`;
}

// ─── Dynamic Row Height Helper (Targets 10 rows visible in viewport) ───
function getTargetRowH() {
    const overhead = 134; // Top header (~53px) + Toolbar (~45px) + Time axis header (36px)
    const availH = (window.innerHeight || 800) - overhead;
    const targetH = Math.floor(availH / 10);
    return Math.max(38, targetH);
}

// ─── Program State Helper ─────────────────────────
function programState(p) {
    const now = Date.now();
    const start = new Date(p.start_time).getTime();
    const end = new Date(p.end_time).getTime();
    if (now >= end) return 'past';
    if (now >= start) return 'live';
    return 'upcoming';
}

function watchReplay(id, url) { window.open(url, '_blank'); }
function watchLive(slug) { location.hash = `#/live/${slug}`; }

function buildTimeAxis() {
    let html = '';
    for (let h = 0; h <= 24; h++) {
        const label = h === 24 ? '' : `${String(h).padStart(2, '0')}:00`;
        const x = h * 60 * PX_PER_MIN;
        html += `<div style="position:absolute;left:${x}px;top:0;width:${60 * PX_PER_MIN}px;height:${HEADER_H}px;
                      border-left:1px solid rgba(255,255,255,0.05);box-sizing:border-box;">
                    <span style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.5);padding-left:4px;padding-top:8px;display:block;letter-spacing:.5px;">${label}</span>
                </div>`;
    }
    return html;
}

function renderGapFiller(startM, endM, rowH = getTargetRowH()) {
    const gapStartM = Math.max(0, Math.min(startM, 1440));
    const gapEndM = Math.max(0, Math.min(endM, 1440));
    if (gapEndM <= gapStartM) return '';

    const rawL = gapStartM * PX_PER_MIN;
    const rawW = (gapEndM - gapStartM) * PX_PER_MIN;
    const left = Math.max(0, Math.min(rawL, GRID_W));
    const width = Math.max(0, Math.min(rawW - CARD_GAP, GRID_W - left));

    if (width <= 0) return '';

    return `
    <div style="position:absolute;top:3px;left:${left}px;width:${width}px;height:${rowH - 6}px;
                box-sizing:border-box;border-radius:6px;
                background:repeating-linear-gradient(45deg, rgba(239,68,68,0.12), rgba(239,68,68,0.12) 6px, transparent 6px, transparent 12px);
                border:1px dashed rgba(239,68,68,0.2);
                display:flex;align-items:center;justify-content:center;
                pointer-events:none;z-index:0;user-select:none;overflow:hidden;">
        ${width > 40 ? '<span style="font-size:9px;font-weight:700;color:rgba(239,68,68,0.45);letter-spacing:.05em;pointer-events:none;white-space:nowrap;">NO DATA</span>' : ''}
    </div>`;
}

function buildChannelRow(channel, programs, isExpanded, hoveredProgram, rowH = getTargetRowH()) {
    const lane0 = programs.filter(p => (p.lane ?? 0) === 0);
    const sorted = [...lane0].sort((a, b) => nptMinutes(a.start_time) - nptMinutes(b.start_time));
    let html = '';

    // ── Render gap fillers for unscheduled time slots ──
    let lastEndM = 0;
    for (const p of sorted) {
        const startM = nptMinutes(p.start_time);
        if (startM > lastEndM) {
            html += renderGapFiller(lastEndM, startM, rowH);
        }
        const pEndM = startM + (p.duration_minutes || 0);
        if (pEndM > lastEndM) {
            lastEndM = pEndM;
        }
    }
    if (lastEndM < 1440) {
        html += renderGapFiller(lastEndM, 1440, rowH);
    }

    // ── Render program cards ──
    for (const p of lane0) {
        const startM = nptMinutes(p.start_time);
        const rawL = startM * PX_PER_MIN;
        const rawW = p.duration_minutes * PX_PER_MIN;
        const left = Math.max(0, Math.min(rawL, GRID_W));
        const width = Math.max(3, Math.min(rawW - CARD_GAP, GRID_W - left));

        const pState = programState(p);
        const isNow = pState === 'live';
        const isPast = pState === 'past';
        const hasRem = !!p.reminder;
        const isHovered = isExpanded && hoveredProgram?.id === p.id;
        const accent = channel.logo_color || 'var(--color-primary)';

        let cardBg = 'var(--color-surface)';
        let cardBorder = 'var(--color-border)';
        if (isHovered) { cardBg = 'var(--color-surface-hover)'; cardBorder = 'var(--color-primary)'; }
        else if (isNow) { cardBg = 'rgba(0,102,179,0.2)'; cardBorder = 'var(--color-primary)'; }
        else if (isPast) { cardBg = 'rgba(25,25,25,0.6)'; cardBorder = 'rgba(255,255,255,0.03)'; }

        let statusBadge = '';
        if (isNow) statusBadge = '<span style="font-size:8px;font-weight:800;color:#ef4444;letter-spacing:.04em;">● LIVE</span>';
        else if (isPast) statusBadge = '<span style="font-size:8px;font-weight:800;color:var(--color-secondary);letter-spacing:.03em;">● REC</span>';
        else if (hasRem) statusBadge = '<i class="fa-solid fa-bell" style="font-size:8px;color:var(--color-secondary);"></i>';

        html += `
        <div onclick="openDetail(${p.id})"
             onmouseenter="handleProgramHover(${channel.id}, ${p.id})"
             onmouseleave="handleProgramLeave()"
             style="position:absolute;top:3px;left:${left}px;width:${width}px;height:${rowH - 6}px;
                    box-sizing:border-box;cursor:pointer;overflow:hidden;border-radius:6px;
                    background:${cardBg};border:1px solid ${cardBorder};
                    transform:${isHovered ? 'scale(1.04)' : 'scale(1)'};
                    box-shadow:${isHovered ? `0 8px 20px -4px var(--color-primary)` : 'none'};
                    opacity:${isPast && !isHovered ? '0.65' : '1'};
                    z-index:${isHovered ? 25 : 1};
                    transition:all 0.2s cubic-bezier(0.16, 1, 0.3, 1);padding:4px 6px;display:flex;flex-direction:column;justify-content:space-between;">
            <div style="font-size:10px;font-weight:600;color:${isHovered ? '#ffffff' : isPast ? 'rgba(255,255,255,0.5)' : '#ffffff'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.title}</div>
            <div style="display:flex;align-items:center;justify-content:space-between;">
                <span style="font-size:9px;color:${isHovered ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)'}">${fmtNPT(p.start_time)}</span>
                ${statusBadge}
            </div>
        </div>`;
    }
    return html;
}

function buildVerticalGridLines() {
    let html = '';
    for (let h = 0; h <= 24; h++) {
        const x = h * 60 * PX_PER_MIN;
        html += `<div style="position:absolute;left:${x}px;top:0;bottom:0;width:1px;background:rgba(255,255,255,0.03);"></div>`;
    }
    return html;
}

function renderEPG() {
    const today = todayNPT();
    const viewingToday = state.currentDate === today;

    // Collect all dates across channels
    const allDates = [...new Set(state.channels.flatMap(c => c.dates || []))].sort();

    // Date selector
    const dateSel = `
    <div style="display:flex;align-items:center;gap:8px;">
        <button onclick="shiftDate(-1)" style="width:32px;height:32px;border-radius:8px;border:1px solid var(--color-border);background:var(--color-surface);color:rgba(255,255,255,0.7);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:10px;" onmouseenter="this.style.borderColor='var(--color-primary)';this.style.color='#fff'" onmouseleave="this.style.borderColor='var(--color-border)';this.style.color='rgba(255,255,255,0.7)'">
            <i class="fa-solid fa-chevron-left"></i>
        </button>
        <select id="date-sel" onchange="changeDate(this.value)" style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:8px;padding:6px 10px;font-size:11px;font-weight:700;color:#ffffff;cursor:pointer;outline:none;">
            ${allDates.map(d => {
        const label = d === today ? 'Today' : new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
        return `<option value="${d}" ${state.currentDate === d ? 'selected' : ''}>${label}</option>`;
    }).join('')}
        </select>
        <button onclick="shiftDate(1)" style="width:32px;height:32px;border-radius:8px;border:1px solid var(--color-border);background:var(--color-surface);color:rgba(255,255,255,0.7);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:10px;" onmouseenter="this.style.borderColor='var(--color-primary)';this.style.color='#fff'" onmouseleave="this.style.borderColor='var(--color-border)';this.style.color='rgba(255,255,255,0.7)'">
            <i class="fa-solid fa-chevron-right"></i>
        </button>
        <button onclick="goToNow()" style="padding:6px 12px;border-radius:8px;border:1px solid var(--color-primary);background:rgba(0,102,179,0.15);color:#ffffff;font-size:10px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;" onmouseenter="this.style.background='var(--color-primary)'" onmouseleave="this.style.background='rgba(0,102,179,0.15)'">
            <i class="fa-solid fa-circle-dot" style="font-size:8px;color:var(--color-secondary);"></i> Now
        </button>
    </div>`;

    // Now-indicator position
    const nowMinutes = nptMinutes(new Date());
    const nowX = nowMinutes * PX_PER_MIN;

    // Build rows HTML
    const rowH = getTargetRowH();
    let channelLabelsHtml = '';
    let rowsHtml = '';
    for (const ch of state.channels) {
        const programs = state.programsByChannel[ch.slug] || [];
        const isExpanded = state.activeHoverChannelId === ch.id;
        const hoveredProgram = isExpanded ? programs.find(p => p.id === state.activeHoverProgramId) : null;
        const rowHeight = isExpanded ? Math.max(200, rowH + 165) : rowH;
        const accent = ch.logo_color || 'var(--color-primary)';

        // Expanded metadata fields
        const tags = hoveredProgram ? [hoveredProgram.genre, hoveredProgram.language, hoveredProgram.programme_type, hoveredProgram.season ? `S${hoveredProgram.season}` : null, hoveredProgram.episode ? `E${hoveredProgram.episode}` : null].filter(Boolean) : [];
        const hasReminder = hoveredProgram?.reminder;

        const logoSrc = ch.logo_url || '/assets/kantipur.png';

        channelLabelsHtml += `
        <div style="height:${rowHeight}px;transition:height 0.25s cubic-bezier(0.16, 1, 0.3, 1);display:flex;flex-direction:column;align-items:${isExpanded ? 'center' : 'stretch'};justify-content:space-between;padding:${isExpanded ? '14px 10px' : '4px 10px'};border-bottom:1px solid ${isExpanded ? 'var(--color-primary)' : 'var(--color-border)'};box-sizing:border-box;background:${isExpanded ? 'var(--color-surface)' : 'transparent'};overflow:hidden;">
            ${isExpanded ? `
            <!-- Prominent Expanded Channel Logo Image Badge -->
            <div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;width:100%;">
                <!-- Channel Logo Container -->
                <div style="width:100%;height:50px;display:flex;align-items:center;justify-content:center;padding:4px;box-sizing:border-box;animation:logoFade 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
                    <img src="${logoSrc}" alt="${ch.name} Logo" style="max-width:100%;max-height:100%;object-fit:contain;filter:drop-shadow(0 4px 10px rgba(0,102,179,0.4));" onerror="this.onerror=null;this.parentElement.innerHTML='<div style=\'width:40px;height:40px;border-radius:10px;background:rgba(0,102,179,0.2);border:1px solid var(--color-primary);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:16px;\'>${ch.name.charAt(0)}</div>';">
                </div>

                <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
                    <span style="font-size:11px;font-weight:900;color:#ffffff;line-height:1.2;letter-spacing:.02em;max-width:115px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${ch.name}</span>
                    <a href="#/live/${ch.slug}" style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#f87171;font-size:9px;font-weight:800;text-decoration:none;transition:all .15s;" onmouseenter="this.style.background='rgba(239,68,68,0.3)';this.style.color='#fff'" onmouseleave="this.style.background='rgba(239,68,68,0.15)';this.style.color='#f87171'">
                        <i class="fa-solid fa-play" style="font-size:7px;"></i> LIVE
                    </a>
                </div>
            </div>
            ` : `
            <!-- Normal Compact Channel Identity -->
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;width:100%;height:100%;">
                <div style="display:flex;align-items:center;gap:6px;min-width:0;">
                    <img src="${logoSrc}" alt="${ch.name}" style="max-height:18px;max-width:32px;object-fit:contain;flex-shrink:0;" onerror="this.style.display='none';">
                    <span style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${ch.name}</span>
                </div>
                <a href="#/live/${ch.slug}" style="display:inline-flex;align-items:center;gap:4px;padding:3px 7px;border-radius:6px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#f87171;font-size:9px;font-weight:800;text-decoration:none;transition:all .15s;flex-shrink:0;" onmouseenter="this.style.background='rgba(239,68,68,0.3)';this.style.color='#fff'" onmouseleave="this.style.background='rgba(239,68,68,0.15)';this.style.color='#f87171'">
                    <i class="fa-solid fa-play" style="font-size:7px;"></i> LIVE
                </a>
            </div>
            `}
        </div>`;



        rowsHtml += `
        <div style="position:relative;height:${rowHeight}px;width:${GRID_W}px;border-bottom:1px solid ${isExpanded ? 'var(--color-primary)' : 'var(--color-border)'};transition:height 0.25s cubic-bezier(0.16, 1, 0.3, 1);box-sizing:border-box;background:${isExpanded ? 'rgba(20,20,20,0.95)' : 'transparent'};overflow:hidden;">
            ${buildVerticalGridLines()}
            
            <!-- Timeline Row Container (Fixed Top Height = rowH) -->
            <div style="position:relative;height:${rowH}px;width:100%;">
                ${buildChannelRow(ch, programs, isExpanded, hoveredProgram, rowH)}
            </div>

            <!-- Expanded Details Panel inside Channel Row -->
            ${isExpanded && hoveredProgram ? `
            ${(() => {
                    const startM = nptMinutes(hoveredProgram.start_time);
                    const rawLeft = startM * PX_PER_MIN;
                    const panelW = 420; // px width for details box
                    // Keep panel within the 4320px grid bounds
                    const clampLeft = Math.max(10, Math.min(rawLeft, GRID_W - panelW - 10));
                    return `
                <div onmouseenter="handlePopoutMouseEnter()" onmouseleave="handlePopoutMouseLeave()" style="position:absolute;top:${rowH + 4}px;left:${clampLeft}px;width:${panelW}px;height:160px;padding:14px 20px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;border:1px solid var(--color-primary);border-radius:10px;background:var(--color-surface);backdrop-filter:blur(12px);z-index:30;box-shadow:0 12px 30px rgba(0,0,0,0.8);overflow:hidden;">
                    <!-- Background Looping Video -->
                    <video autoplay loop muted playsinline
                           style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;pointer-events:none;"
                           onerror="this.style.display='none';">
                        <source src="${getProgramHoverVideoSrc(hoveredProgram.title)}" type="video/mp4">
                    </video>

                    <!-- Dark Overlay for Readability -->
                    <div style="position:absolute;inset:0;background:rgba(17,17,17,0.72);z-index:1;pointer-events:none;"></div>

                    <!-- Card Content Layer -->
                    <div style="position:relative;z-index:2;display:flex;flex-direction:column;justify-content:space-between;height:100%;width:100%;">
                        <div>
                            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
                                <span style="font-size:13px;font-weight:800;color:var(--color-text-primary);line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px;">${hoveredProgram.title}</span>
                                ${tags.map(t => `<span style="padding:2px 7px;border-radius:4px;font-size:9px;font-weight:800;color:#111111;background:var(--color-secondary);">${t}</span>`).join('')}
                            </div>

                            <div style="display:flex;align-items:center;gap:12px;font-size:10px;color:var(--color-secondary);font-weight:700;margin-bottom:8px;">
                                <span><i class="fa-regular fa-clock" style="margin-right:4px;"></i>${fmtNPT(hoveredProgram.start_time)} — ${fmtNPT(hoveredProgram.end_time)}</span>
                                <span>•</span>
                                <span>${hoveredProgram.duration_minutes} min</span>
                            </div>

                            ${hoveredProgram.description ? `
                            <p style="font-size:10.5px;color:rgba(255,255,255,0.7);line-height:1.5;margin:0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">
                                ${hoveredProgram.description}
                            </p>
                            ` : ''}
                        </div>

                        ${(() => {
                            const pSt = programState(hoveredProgram);
                            // ── PAST (RECORDED) ─────────────────────────────────
                            if (pSt === 'past') {
                                return `
                                <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;">
                                    <span style="font-size:10px;font-weight:800;color:var(--color-secondary);display:inline-flex;align-items:center;gap:5px;">
                                        ● RECORDED
                                    </span>
                                    <div style="display:flex;align-items:center;gap:8px;">
                                        <a href="#/recorded/${hoveredProgram.id}" style="padding:6px 14px;border-radius:6px;border:none;background:var(--color-primary);color:#ffffff;font-size:10px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none;">
                                            <i class="fa-solid fa-play"></i> Play Recording
                                        </a>
                                    </div>
                                </div>`;
                            }
                            // ── LIVE ────────────────────────────────────────────
                            if (pSt === 'live') {
                                return `
                                <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;">
                                    <span style="font-size:10px;font-weight:800;color:#ef4444;display:inline-flex;align-items:center;gap:5px;">
                                        <span style="width:7px;height:7px;border-radius:50%;background:#ef4444;display:inline-block;box-shadow:0 0 6px #ef4444;"></span> LIVE NOW
                                    </span>
                                    <div>
                                        <a href="#/live/${ch.slug}" style="padding:6px 14px;border-radius:6px;border:none;background:#ef4444;color:#ffffff;font-size:10px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none;box-shadow:0 4px 12px rgba(239,68,68,0.4);">
                                            <i class="fa-solid fa-play"></i> Watch Live
                                        </a>
                                    </div>
                                </div>`;
                            }
                            // ── UPCOMING ────────────────────────────────────────
                            return `
                            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;">
                                <div>
                                    ${hasReminder ? `
                                    <span style="font-size:10px;color:var(--color-secondary);font-weight:700;display:inline-flex;align-items:center;gap:5px;">
                                        <i class="fa-solid fa-bell"></i> Reminder set (${hasReminder.minutes_before}m before)
                                    </span>
                                    ` : `
                                    <span style="font-size:10px;font-weight:700;color:var(--color-secondary);display:inline-flex;align-items:center;gap:5px;">
                                        🕐 Upcoming
                                    </span>
                                    `}
                                </div>
                                <div style="display:flex;align-items:center;gap:8px;">
                                    ${hasReminder ? `
                                    <button onclick="cancelReminder(${hasReminder.id})" style="padding:5px 10px;border-radius:6px;border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.1);color:#f87171;font-size:10px;font-weight:700;cursor:pointer;">Cancel Alert</button>
                                    <button onclick="openReminderModal(${hoveredProgram.id})" style="padding:5px 10px;border-radius:6px;border:1px solid var(--color-border);background:var(--color-surface);color:#ffffff;font-size:10px;font-weight:700;cursor:pointer;">Modify Alert</button>
                                    ` : `
                                    <button onclick="openReminderModal(${hoveredProgram.id})" style="padding:6px 14px;border-radius:6px;border:none;background:var(--color-primary);color:#ffffff;font-size:10px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 4px 12px rgba(0,102,179,0.4);">
                                        <i class="fa-solid fa-bell"></i> Set Reminder
                                    </button>
                                    `}
                                </div>
                            </div>`;
                        })()}
                    </div>
                </div>
                `;
                })()}
            ` : ''}
        </div>`;
    }

    return `
    <div style="flex:1;display:flex;flex-direction:column;min-height:0;background:var(--color-bg);" onmouseleave="handleEpgLeave()">
        <!-- Toolbar -->
        <div style="padding:14px 20px;border-bottom:1px solid var(--color-border);display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--color-surface);flex-shrink:0;">
            <div style="font-size:10px;font-weight:800;color:rgba(255,255,255,0.6);letter-spacing:.1em;text-transform:uppercase;">TV Guide — ${state.channels.map(c => `<span style="color:${c.logo_color || 'var(--color-primary)'}">${c.name}</span>`).join(' · ')}</div>
            ${dateSel}
        </div>

        <!-- EPG Grid -->
        <div style="flex:1;display:flex;min-height:0;overflow:hidden;">

            <!-- Left sticky channel labels -->
            <div id="channel-labels-scroll" style="width:${LABEL_W}px;flex-shrink:0;background:var(--color-surface);border-right:1px solid var(--color-border);z-index:10;display:flex;flex-direction:column;overflow:hidden;">
                <!-- Time axis spacer -->
                <div style="position:sticky;top:0;z-index:20;height:${HEADER_H}px;flex-shrink:0;background:var(--color-surface);border-bottom:1px solid var(--color-border);"></div>
                <div id="channel-labels-container" style="display:flex;flex-direction:column;will-change:transform;">
                    ${channelLabelsHtml}
                </div>
            </div>

            <!-- Right scrollable timeline -->
            <div id="timeline-scroll" style="flex:1;overflow:auto;display:flex;flex-direction:column;" onscroll="syncVerticalScroll(this)">
                <!-- Sticky time axis header -->
                <div style="position:sticky;top:0;z-index:20;height:${HEADER_H}px;width:${GRID_W}px;flex-shrink:0;
                            background:var(--color-surface);border-bottom:1px solid var(--color-border);">
                    ${buildTimeAxis()}
                    ${viewingToday ? `
                    <!-- Now line in axis -->
                    <div style="position:absolute;left:${nowX}px;top:0;bottom:0;width:1px;background:#ef4444;opacity:.8;z-index:5;"></div>
                    ` : ''}
                </div>

                <!-- Channel rows -->
                <div style="position:relative;width:${GRID_W}px;">
                    ${viewingToday ? `
                    <!-- Vertical now indicator across all rows -->
                    <div id="now-line" style="position:absolute;left:${nowX}px;top:0;bottom:0;width:1px;background:#ef4444;opacity:.6;z-index:5;pointer-events:none;">
                        <div style="position:absolute;top:0;left:-3px;width:7px;height:7px;background:#ef4444;border-radius:50%;"></div>
                    </div>
                    ` : ''}
                    ${rowsHtml}
                </div>
            </div>
        </div>
    </div>`;
}


// ─── Reminders page ───────────────────────────────
function renderReminders() {
    return `
    <div style="flex:1;overflow-y:auto;padding:32px 24px;background:var(--color-bg);">
        <div style="max-width:720px;margin:0 auto;">
            <div style="margin-bottom:24px;">
                <h1 style="font-size:14px;font-weight:800;color:var(--color-text-primary);letter-spacing:.05em;text-transform:uppercase;">My Alerts</h1>
                <p style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:4px;">Manage your scheduled program reminders</p>
            </div>
            ${state.reminders.length === 0 ? `
            <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:12px;padding:48px;text-align:center;">
                <i class="fa-regular fa-bell-slash" style="font-size:28px;color:rgba(255,255,255,0.3);display:block;margin-bottom:12px;"></i>
                <span style="font-size:11px;color:rgba(255,255,255,0.6);">No reminders scheduled. Tap any show on the timeline to add one.</span>
            </div>` : state.reminders.map(r => `
            <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:10px;padding:14px 16px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
                <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
                        <span style="padding:2px 6px;border-radius:4px;font-size:9px;font-weight:800;color:#111111;background:var(--color-secondary);">${r.channel_name}</span>
                        <span style="font-size:9px;color:rgba(255,255,255,0.5);text-transform:capitalize;">${r.status}</span>
                    </div>
                    <div style="font-size:12px;font-weight:700;color:var(--color-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.programme_name}</div>
                    <div style="font-size:10px;color:rgba(255,255,255,0.5);margin-top:3px;">${new Date(r.programme_start_time).toLocaleString('en-US', { timeZone: 'Asia/Kathmandu' })}</div>
                    <div style="font-size:10px;color:var(--color-secondary);margin-top:3px;"><i class="fa-solid fa-clock-rotate-left" style="margin-right:4px;"></i>${r.reminder_minutes_before} min before</div>
                </div>
                <div style="display:flex;gap:6px;flex-shrink:0;">
                    <button onclick="cancelReminder(${r.id})" style="padding:6px 10px;border-radius:7px;border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.1);color:#f87171;font-size:10px;font-weight:700;cursor:pointer;" onmouseenter="this.style.background='rgba(239,68,68,.2)'" onmouseleave="this.style.background='rgba(239,68,68,.1)'">Cancel</button>
                </div>
            </div>`).join('')}
        </div>
    </div>`;
}

// ─── Live Player Stream Page ─────────────────────
function renderLivePlayer() {
    const ch = state.activeLiveChannel || state.channels[0] || { name: 'Live Stream', logo_color: '#ef4444', slug: 'live' };
    const programs = state.programsByChannel[ch.slug] || [];
    const now = Date.now();
    const currentShow = programs.find(p => {
        const s = new Date(p.start_time).getTime();
        const e = new Date(p.end_time).getTime();
        return now >= s && now <= e;
    }) || programs[0];

    return `
    <div style="flex:1;overflow-y:auto;padding:24px;background:var(--color-bg);display:flex;flex-direction:column;align-items:center;">
        <div style="width:100%;max-width:960px;">
            <!-- Top Nav Back Button -->
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
                <a href="#/epg" style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:9px;background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-text-primary);font-size:11px;font-weight:700;text-decoration:none;transition:all .15s;" onmouseenter="this.style.borderColor='var(--color-primary)'" onmouseleave="this.style.borderColor='var(--color-border)'">
                    <i class="fa-solid fa-arrow-left"></i> Back to Timeline
                </a>
                <div style="display:flex;align-items:center;gap:8px;padding:5px 12px;border-radius:20px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);">
                    <span style="width:7px;height:7px;border-radius:50%;background:#ef4444;box-shadow:0 0 8px #ef4444;" class="animate-pulse"></span>
                    <span style="font-size:10px;font-weight:800;color:#f87171;letter-spacing:.08em;">LIVE BROADCAST</span>
                </div>
            </div>

            <!-- Video Player Box -->
            <div style="position:relative;width:100%;padding-top:56.25%;background:#000;border-radius:16px;overflow:hidden;border:1px solid var(--color-border);box-shadow:0 25px 60px rgba(0,0,0,0.8);">
                <video controls playsinline
                     style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"
                     onerror="this.outerHTML='<div style=\'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:var(--color-bg);\'><i class=\'fa-solid fa-circle-exclamation\' style=\'font-size:28px;color:rgba(255,255,255,0.3);\'></i><p style=\'font-size:11px;color:rgba(255,255,255,0.6);\'>Unable to play this video.</p><a href=\'#/epg\' style=\'font-size:11px;color:var(--color-primary);font-weight:700;text-decoration:none;\'>\u2190 Back to EPG</a></div>'">
                    <source src="${VIDEO_SOURCES.live}" type="video/mp4">
                    Your browser does not support video playback.
                </video>
                <!-- On-Screen Channel Watermark -->
                <div style="position:absolute;top:20px;left:20px;z-index:10;pointer-events:none;display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:8px;background:rgba(30,30,30,0.85);backdrop-filter:blur(8px);border:1px solid var(--color-border);">
                    <span style="width:10px;height:10px;border-radius:50%;background:${ch.logo_color}"></span>
                    <span style="font-size:11px;font-weight:800;color:#fff;letter-spacing:.05em;">${ch.name}</span>
                </div>
            </div>

            <!-- Live Show Info Metadata Card -->
            <div style="margin-top:20px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:14px;padding:20px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
                <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                        <span style="font-size:9px;font-weight:800;color:#111111;background:var(--color-secondary);padding:2px 8px;border-radius:4px;">NOW PLAYING</span>
                        <span style="font-size:10px;color:rgba(255,255,255,0.5);">${ch.name}</span>
                    </div>
                    <h2 style="font-size:16px;font-weight:800;color:var(--color-text-primary);margin-bottom:6px;">${currentShow ? currentShow.title : 'Live Stream Schedule'}</h2>
                    <p style="font-size:11px;color:rgba(255,255,255,0.7);line-height:1.5;">${currentShow && currentShow.description ? currentShow.description : 'Streaming live TV schedule in Nepal Standard Time.'}</p>
                </div>
                ${currentShow ? `
                <div style="text-align:right;flex-shrink:0;">
                    <div style="font-size:9px;color:rgba(255,255,255,0.5);text-transform:uppercase;margin-bottom:2px;">AIR TIME (NPT)</div>
                    <div style="font-size:11px;font-weight:700;color:var(--color-text-primary);">${fmtNPT(currentShow.start_time)} – ${fmtNPT(currentShow.end_time)}</div>
                </div>` : ''}
            </div>

            <!-- Other Channel Selector Cards -->
            <div style="margin-top:24px;">
                <div style="font-size:10px;font-weight:800;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;">Switch Channel</div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:12px;">
                    ${state.channels.map(c => `
                    <a href="#/live/${c.slug}" style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:10px;background:${c.slug === ch.slug ? 'rgba(0,102,179,0.2)' : 'var(--color-surface)'};border:1px solid ${c.slug === ch.slug ? 'var(--color-primary)' : 'var(--color-border)'};text-decoration:none;transition:all .15s;" onmouseenter="this.style.borderColor='var(--color-primary)'" onmouseleave="this.style.borderColor='${c.slug === ch.slug ? 'var(--color-primary)' : 'var(--color-border)'}'">
                        <span style="width:10px;height:10px;border-radius:50%;background:${c.logo_color}"></span>
                        <div style="flex:1;min-width:0;">
                            <div style="font-size:11px;font-weight:700;color:var(--color-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.name}</div>
                            <div style="font-size:9px;color:${c.slug === ch.slug ? 'var(--color-secondary)' : 'rgba(255,255,255,0.5)'};margin-top:2px;">${c.slug === ch.slug ? 'Currently Playing' : 'Tap to Watch'}</div>
                        </div>
                        <i class="fa-solid fa-circle-play" style="color:${c.slug === ch.slug ? 'var(--color-secondary)' : 'rgba(255,255,255,0.4)'};font-size:14px;"></i>
                    </a>`).join('')}
                </div>
            </div>
        </div>
    </div>`;
}


// ─── Program detail modal ─────────────────────────
function renderDetailModal() {
    if (!state.activeProgram) return '';
    const p = state.activeProgram;
    const tags = [p.genre, p.language, p.programme_type, p.season ? `S${p.season}` : null, p.episode ? `E${p.episode}` : null]
        .filter(Boolean)
        .map(t => `<span style="padding:2px 7px;border-radius:4px;font-size:9px;font-weight:800;color:#111111;background:var(--color-secondary);">${t}</span>`)
        .join('');

    return `
    <div onclick="if(event.target===this)closeDetail()" style="position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.7);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;">
        <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:16px;width:100%;max-width:440px;overflow:hidden;box-shadow:0 25px 60px rgba(0,0,0,.8);">
            <div style="padding:20px 20px 16px;">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px;">
                    <div>
                        <span style="padding:2px 7px;border-radius:4px;font-size:9px;font-weight:800;color:#111111;background:var(--color-secondary);">${p.channel_name}</span>
                        <h2 style="font-size:15px;font-weight:800;color:var(--color-text-primary);margin-top:8px;line-height:1.3;">${p.title}</h2>
                    </div>
                    <button onclick="closeDetail()" style="width:30px;height:30px;border-radius:8px;background:var(--color-bg);border:none;color:rgba(255,255,255,0.6);cursor:pointer;flex-shrink:0;font-size:12px;" onmouseenter="this.style.color='#fff'" onmouseleave="this.style.color='rgba(255,255,255,0.6)'">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                ${tags ? `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px;">${tags}</div>` : ''}
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:12px 0;border-top:1px solid var(--color-border);border-bottom:1px solid var(--color-border);margin-bottom:12px;">
                    <div>
                        <div style="font-size:9px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;">Date</div>
                        <div style="font-size:11px;font-weight:600;color:var(--color-text-primary);">${new Date(p.start_time).toLocaleDateString('en-US', { timeZone: 'Asia/Kathmandu', weekday: 'short', month: 'short', day: 'numeric' })}</div>
                    </div>
                    <div>
                        <div style="font-size:9px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;">Time (NPT)</div>
                        <div style="font-size:11px;font-weight:600;color:var(--color-text-primary);">${fmtNPT(p.start_time)} – ${fmtNPT(p.end_time)}</div>
                    </div>
                    <div>
                        <div style="font-size:9px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;">Duration</div>
                        <div style="font-size:11px;font-weight:600;color:var(--color-text-primary);">${p.duration_minutes} min</div>
                    </div>
                    ${p.original_air_date ? `<div>
                        <div style="font-size:9px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;">Original Air</div>
                        <div style="font-size:11px;font-weight:600;color:var(--color-text-primary);">${p.original_air_date}</div>
                    </div>` : ''}
                </div>
                ${p.description ? `<p style="font-size:11px;color:rgba(255,255,255,0.7);line-height:1.6;margin-bottom:12px;">${p.description}</p>` : ''}
                <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;">
                    ${(() => {
            const mSt = programState(p);
            if (mSt === 'past') {
                return `
                            <span style="font-size:10px;font-weight:800;color:var(--color-secondary);flex:1;">● RECORDED</span>
                            <a href="#/recorded/${p.id}" onclick="closeDetail()" style="padding:8px 16px;border-radius:8px;border:none;background:var(--color-primary);color:#ffffff;font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none;">
                                <i class="fa-solid fa-play"></i> Play Recording
                            </a>`;
            }
            if (mSt === 'live') {
                return `
                            <span style="font-size:10px;font-weight:800;color:#ef4444;flex:1;display:inline-flex;align-items:center;gap:5px;">
                                <span style="width:7px;height:7px;border-radius:50%;background:#ef4444;box-shadow:0 0 6px #ef4444;display:inline-block;"></span> LIVE NOW
                            </span>
                            <a href="#/live/${p.channel_slug || ''}" onclick="closeDetail()" style="padding:8px 16px;border-radius:8px;border:none;background:#ef4444;color:#fff;font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none;box-shadow:0 4px 12px rgba(239,68,68,0.4);">
                                <i class="fa-solid fa-play"></i> Watch Live
                            </a>`;
            }
            // Upcoming
            return p.reminder ? `
                            <span style="font-size:11px;color:var(--color-secondary);font-weight:600;flex:1;"><i class="fa-solid fa-bell" style="margin-right:5px;"></i>Alert: ${p.reminder.minutes_before} min before</span>
                            <button onclick="cancelReminder(${p.reminder.id})" style="padding:7px 12px;border-radius:8px;border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.1);color:#f87171;font-size:10px;font-weight:700;cursor:pointer;">Remove</button>
                            <button onclick="openReminderModal(${p.id})" style="padding:7px 12px;border-radius:8px;border:1px solid var(--color-border);background:var(--color-bg);color:var(--color-text-primary);font-size:10px;font-weight:700;cursor:pointer;">Modify</button>
                        ` : `
                            <button onclick="openReminderModal(${p.id})" style="padding:8px 16px;border-radius:8px;border:none;background:var(--color-primary);color:#fff;font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;">
                                <i class="fa-solid fa-bell"></i> Set Reminder
                            </button>`;
        })()}
                </div>
            </div>
        </div>
    </div>`;
}

// ─── Reminder modal ───────────────────────────────
function renderReminderModal() {
    if (!state.reminderTarget) return '';
    const p = state.reminderTarget;
    const opts = [{ v: 0, l: 'At start time' }, { v: 5, l: '5 min before' }, { v: 15, l: '15 min before' }, { v: 30, l: '30 min before' }, { v: 60, l: '1 hour before' }];
    return `
    <div onclick="if(event.target===this)closeReminderModal()" style="position:fixed;inset:0;z-index:70;background:rgba(0,0,0,.75);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;">
        <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:16px;width:100%;max-width:340px;overflow:hidden;box-shadow:0 25px 60px rgba(0,0,0,.8);">
            <div style="padding:18px 18px 16px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                    <span style="font-size:11px;font-weight:800;color:var(--color-text-primary);text-transform:uppercase;letter-spacing:.06em;">Set Reminder</span>
                    <button onclick="closeReminderModal()" style="width:28px;height:28px;border-radius:7px;background:var(--color-bg);border:none;color:rgba(255,255,255,0.6);cursor:pointer;font-size:11px;" onmouseenter="this.style.color='#fff'" onmouseleave="this.style.color='rgba(255,255,255,0.6)'"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div style="margin-bottom:14px;">
                    <div style="font-size:12px;font-weight:700;color:var(--color-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.title}</div>
                    <div style="font-size:10px;color:rgba(255,255,255,0.5);margin-top:2px;">Starts ${fmtNPT(p.start_time)}</div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
                    ${opts.map((o, i) => `
                    <label style="display:flex;align-items:center;gap:7px;padding:9px 10px;border-radius:7px;background:var(--color-bg);border:1px solid var(--color-border);cursor:pointer;">
                        <input type="radio" name="ropt" value="${o.v}" ${i === 2 ? 'checked' : ''} style="accent-color:var(--color-primary);">
                        <span style="font-size:10px;color:rgba(255,255,255,0.8);">${o.l}</span>
                    </label>`).join('')}
                    <label style="display:flex;align-items:center;gap:7px;padding:9px 10px;border-radius:7px;background:var(--color-bg);border:1px solid var(--color-border);cursor:pointer;" onclick="document.getElementById('custom-box').style.display='block'">
                        <input type="radio" name="ropt" value="custom" style="accent-color:var(--color-primary);">
                        <span style="font-size:10px;color:rgba(255,255,255,0.8);">Custom</span>
                    </label>
                </div>
                <div id="custom-box" style="display:none;margin-bottom:10px;">
                    <input type="number" id="custom-min" value="10" min="0" max="1440"
                           style="width:100%;background:var(--color-bg);border:1px solid var(--color-border);border-radius:7px;padding:8px 10px;font-size:11px;color:#ffffff;outline:none;box-sizing:border-box;"
                           placeholder="Minutes before start">
                </div>
                <div style="display:flex;justify-content:flex-end;gap:6px;">
                    <button onclick="closeReminderModal()" style="padding:7px 14px;border-radius:8px;border:1px solid var(--color-border);background:var(--color-bg);color:rgba(255,255,255,0.7);font-size:10px;font-weight:700;cursor:pointer;">Cancel</button>
                    <button onclick="saveReminder(${p.id})" style="padding:7px 14px;border-radius:8px;border:none;background:var(--color-primary);color:#fff;font-size:10px;font-weight:700;cursor:pointer;">Save</button>
                </div>
            </div>
        </div>
    </div>`;
}

// ─── Login page ───────────────────────────────────
function renderLogin() {
    document.getElementById('app').innerHTML = `
    <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--color-bg);">
        <div style="width:100%;max-width:360px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:18px;padding:32px;box-shadow:0 25px 60px rgba(0,0,0,.8);">
            <div style="text-align:center;margin-bottom:28px;">
                <i class="fa-solid fa-tv" style="font-size:28px;color:var(--color-primary);display:block;margin-bottom:10px;"></i>
                <span style="font-size:18px;font-weight:900;color:var(--color-text-primary);letter-spacing:.12em;">EPG GUIDE</span>
                <p style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:6px;">Sign in to browse the TV guide & set alerts</p>
            </div>
            <form id="login-form" style="display:flex;flex-direction:column;gap:14px;">
                <div>
                    <label style="display:block;font-size:9px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px;">Email</label>
                    <input type="email" id="em" required placeholder="demo@epg.local"
                           style="width:100%;background:var(--color-bg);border:1px solid var(--color-border);border-radius:10px;padding:10px 14px;font-size:12px;color:#ffffff;outline:none;box-sizing:border-box;transition:border-color .15s;"
                           onfocus="this.style.borderColor='var(--color-primary)'" onblur="this.style.borderColor='var(--color-border)'">
                </div>
                <div>
                    <label style="display:block;font-size:9px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px;">Password</label>
                    <div style="position:relative;">
                        <input type="password" id="pw" required placeholder="••••••••"
                               style="width:100%;background:var(--color-bg);border:1px solid var(--color-border);border-radius:10px;padding:10px 38px 10px 14px;font-size:12px;color:#ffffff;outline:none;box-sizing:border-box;transition:border-color .15s;"
                               onfocus="this.style.borderColor='var(--color-primary)'" onblur="this.style.borderColor='var(--color-border)'">
                        <button type="button" onclick="togglePw()" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;color:rgba(255,255,255,0.5);cursor:pointer;font-size:11px;" onmouseenter="this.style.color='#ffffff'" onmouseleave="this.style.color='rgba(255,255,255,0.5)'">
                            <i id="pw-icon" class="fa-solid fa-eye"></i>
                        </button>
                    </div>
                </div>
                <button type="submit" id="login-btn" style="padding:11px;border-radius:10px;border:none;background:var(--color-primary);color:#fff;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:background .15s;">Sign In</button>
            </form>
            <div style="margin-top:20px;padding:12px;background:rgba(0,102,179,.1);border:1px solid rgba(0,102,179,.3);border-radius:10px;font-size:10px;color:rgba(255,255,255,0.6);line-height:1.6;">
                <span style="display:block;font-weight:700;color:var(--color-secondary);text-transform:uppercase;font-size:9px;letter-spacing:.05em;margin-bottom:4px;">Demo Login</span>
                demo@epg.local / <strong style="color:#ffffff;">password</strong>
            </div>
        </div>
    </div>`;

    document.getElementById('login-form').addEventListener('submit', async e => {
        e.preventDefault();
        const btn = document.getElementById('login-btn');
        btn.innerHTML = '<div style="width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin 0.6s linear infinite;"></div>';
        btn.disabled = true;
        try {
            const r = await axios.post('/api/auth/login', { email: document.getElementById('em').value, password: document.getElementById('pw').value });
            state.user = r.data.user;
            toast('Welcome back, ' + state.user.name);
            await loadChannels();
            await loadNotifications();
            await loadReminders();
            await loadProgramsForDate(state.currentDate);
            location.hash = '#/epg';
        } catch (err) {
            toast(err.response?.data?.message || 'Invalid credentials', 'err');
            btn.innerHTML = 'Sign In'; btn.disabled = false;
        }
    });
}

window.togglePw = function () {
    const pw = document.getElementById('pw');
    const ic = document.getElementById('pw-icon');
    if (!pw) return;
    pw.type = pw.type === 'password' ? 'text' : 'password';
    ic.className = pw.type === 'password' ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
};

// ─── Recorded Player Page ─────────────────────────
// ─── Video Sources (change these to swap recordings) ────────────
// Files live in storage/app/public/ and are served via the /storage symlink.
// To swap in a real recording later: set program.recording_url instead.
const VIDEO_SOURCES = {
    recorded: '/storage/cricket.mp4',  // storage/app/public/cricket.mp4
    live: '/storage/football.mp4', // storage/app/public/football.mp4
};

function renderRecordedPlayer() {
    const hash = location.hash || '';
    const programId = parseInt(hash.replace('#/recorded/', ''), 10);

    // Find the program across all loaded channels
    let program = null;
    let channel = null;
    for (const ch of state.channels) {
        const progs = state.programsByChannel[ch.slug] || [];
        const found = progs.find(p => p.id === programId);
        if (found) { program = found; channel = ch; break; }
    }

    // Loading state
    if (!program && Object.keys(state.programsByChannel).length === 0) {
        return `<div style="flex:1;overflow-y:auto;padding:24px;background:var(--color-bg);display:flex;align-items:center;justify-content:center;">
            <div style="font-size:12px;color:rgba(255,255,255,0.5);">Loading program data…</div></div>`;
    }

    // Not found
    if (!program) {
        return `
        <div style="flex:1;overflow-y:auto;padding:24px;background:var(--color-bg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;">
            <i class="fa-regular fa-circle-xmark" style="font-size:36px;color:rgba(255,255,255,0.3);"></i>
            <p style="font-size:13px;font-weight:700;color:var(--color-text-primary);">Program Not Found</p>
            <p style="font-size:11px;color:rgba(255,255,255,0.5);text-align:center;">This recorded program could not be found.</p>
            <a href="#/epg" style="padding:8px 18px;border-radius:9px;background:var(--color-primary);color:#ffffff;font-size:11px;font-weight:700;text-decoration:none;">
                ← Back to EPG
            </a>
        </div>`;
    }

    const accent = channel?.logo_color || 'var(--color-primary)';
    const logoSrc = channel?.logo_url || '';
    const recordingUrl = program.recording_url || VIDEO_SOURCES.recorded;
    const tags = [program.genre, program.language, program.programme_type]
        .filter(Boolean)
        .map(t => `<span style="padding:2px 8px;border-radius:4px;font-size:9px;font-weight:800;color:#111111;background:var(--color-secondary);">${t}</span>`)
        .join('');

    return `
    <div style="flex:1;overflow-y:auto;padding:24px;background:var(--color-bg);display:flex;flex-direction:column;align-items:center;">
        <div style="width:100%;max-width:960px;">

            <!-- Back Navigation -->
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
                <a href="#/epg" style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:9px;background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-text-primary);font-size:11px;font-weight:700;text-decoration:none;transition:all .15s;" onmouseenter="this.style.borderColor='var(--color-primary)'" onmouseleave="this.style.borderColor='var(--color-border)'">
                    <i class="fa-solid fa-arrow-left"></i> Back to EPG
                </a>
                <div style="display:flex;align-items:center;gap:8px;padding:5px 12px;border-radius:20px;background:rgba(252,199,57,0.15);border:1px solid rgba(252,199,57,0.3);">
                    <span style="width:7px;height:7px;border-radius:50%;background:var(--color-secondary);display:inline-block;"></span>
                    <span style="font-size:10px;font-weight:800;color:var(--color-secondary);letter-spacing:.08em;">RECORDING</span>
                </div>
            </div>

            <!-- Video Player -->
            <div style="position:relative;width:100%;padding-top:56.25%;background:#000;border-radius:16px;overflow:hidden;border:1px solid var(--color-border);box-shadow:0 25px 60px rgba(0,0,0,0.8);">
                <video controls playsinline
                     style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"
                     onerror="this.outerHTML='<div style=\'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:var(--color-bg);\'><i class=\'fa-solid fa-circle-exclamation\' style=\'font-size:28px;color:rgba(255,255,255,0.3);\'></i><p style=\'font-size:11px;color:rgba(255,255,255,0.6);\'>Unable to play this video.</p><a href=\'#/epg\' style=\'font-size:11px;color:var(--color-primary);font-weight:700;text-decoration:none;\'>&#8592; Back to EPG</a></div>'">
                    <source src="${recordingUrl}" type="video/mp4">
                    Your browser does not support video playback.
                </video>
                <!-- Channel Watermark -->
                <div style="position:absolute;top:20px;left:20px;z-index:10;pointer-events:none;display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:8px;background:rgba(30,30,30,0.85);backdrop-filter:blur(8px);border:1px solid var(--color-border);">
                    ${logoSrc
            ? `<img src="${logoSrc}" alt="${channel.name}" style="height:16px;object-fit:contain;">`
            : `<span style="width:10px;height:10px;border-radius:50%;background:${accent};"></span>`
        }
                    <span style="font-size:11px;font-weight:800;color:#fff;letter-spacing:.05em;">${channel?.name || ''}</span>
                </div>
            </div>

            <!-- Program Info Card -->
            <div style="margin-top:20px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:14px;padding:20px;">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;">
                    <div style="flex:1;min-width:0;">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
                            <span style="font-size:9px;font-weight:700;color:#64748b;background:rgba(71,85,105,0.15);padding:2px 8px;border-radius:4px;border:1px solid rgba(71,85,105,0.2);">● RECORDED</span>
                            <span style="font-size:10px;color:#64748b;">${channel?.name || ''}</span>
                            ${tags}
                        </div>
                        <h1 style="font-size:18px;font-weight:900;color:#f1f5f9;line-height:1.25;margin-bottom:8px;">${program.title}</h1>
                        <div style="display:flex;align-items:center;gap:12px;font-size:10px;color:var(--color-secondary);font-weight:700;margin-bottom:10px;">
                            <span><i class="fa-regular fa-clock" style="margin-right:4px;"></i>${fmtNPT(program.start_time)} — ${fmtNPT(program.end_time)}</span>
                            <span>•</span>
                            <span>${program.duration_minutes} min</span>
                        </div>
                        ${program.description ? `<p style="font-size:11px;color:#94a3b8;line-height:1.6;margin:0;">${program.description}</p>` : ''}
                    </div>
                    ${logoSrc ? `
                    <div style="flex-shrink:0;display:flex;align-items:center;justify-content:center;width:80px;height:60px;">
                        <img src="${logoSrc}" alt="${channel.name}" style="max-width:100%;max-height:100%;object-fit:contain;opacity:0.85;">
                    </div>` : ''}
                </div>
            </div>

        </div>
    </div>`;
}

// ─── Main render ──────────────────────────────────
function renderApp() {
    const el = document.getElementById('app');
    if (!state.user) { location.hash = '#/login'; return; }
    const hash = location.hash || '#/epg';
    const isEPG = hash === '#/epg';
    const isLive = hash.startsWith('#/live/');
    if (!isEPG) {
        if (hoverPopoutTimer) { clearTimeout(hoverPopoutTimer); hoverPopoutTimer = null; }
        state.activeHoverChannelId = null;
        state.activeHoverProgramId = null;
    }

    // Capture current timeline horizontal scroll position before re-rendering DOM
    const oldScroll = document.getElementById('timeline-scroll')?.scrollLeft;

    let mainContent = renderReminders();
    if (isEPG) mainContent = renderEPG();
    else if (isLive) mainContent = renderLivePlayer();
    else if (isRecorded) mainContent = renderRecordedPlayer();

    el.innerHTML = `
        ${renderHeader()}
        <main style="flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden;">
            ${mainContent}
        </main>
        ${renderDetailModal()}
        ${renderReminderModal()}
        <style>@keyframes spin{to{transform:rotate(360deg)}}@keyframes logoFade{from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}}</style>
    `;

    // ── Scroll management ──────────────────────────────────────────────────
    if (isEPG) {
        const sc = document.getElementById('timeline-scroll');
        if (sc) {
            if (oldScroll !== undefined) {
                // Subsequent renders: restore user's existing scroll position exactly
                sc.scrollLeft = oldScroll;
            } else if (!state.epgInitialScrollDone && state.currentDate === todayNPT()) {
                // First EPG mount for today: scroll so the NOW line is ~50% across the viewport
                const nowPx = nptMinutes(new Date()) * PX_PER_MIN;
                const viewportW = sc.clientWidth || sc.offsetWidth || 800;
                const target = Math.max(0, Math.min(nowPx - viewportW * 0.50, GRID_W - viewportW));
                // Small RAF delay to ensure the container has its real dimensions
                requestAnimationFrame(() => {
                    const vw = sc.clientWidth || sc.offsetWidth || 800;
                    const tgt = Math.max(0, Math.min(nowPx - vw * 0.50, GRID_W - vw));
                    sc.scrollTo({ left: tgt, behavior: 'smooth' });
                });
                sc.scrollLeft = target; // instant fallback in same frame
                state.epgInitialScrollDone = true;
            }
        }
    }

    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        try { await axios.post('/api/auth/logout'); state.user = null; location.hash = '#/login'; } catch { }
    });
    document.getElementById('mark-all-read-btn')?.addEventListener('click', () => markAllRead());

    if (isEPG) updateNowLine();
}


// ─── Hover Interaction Handlers ─────────────────
window.handleProgramHover = function (channelId, programId) {
    if (state.activeHoverChannelId === channelId && state.activeHoverProgramId === programId) {
        if (popoutHideTimer) {
            clearTimeout(popoutHideTimer);
            popoutHideTimer = null;
        }
        return;
    }

    // Cancel any pending timers for a previously hovered program
    if (hoverPopoutTimer) { clearTimeout(hoverPopoutTimer); hoverPopoutTimer = null; }
    if (popoutHideTimer)  { clearTimeout(popoutHideTimer);  popoutHideTimer  = null; }

    // Instantly close any open popout when moving to a different program
    if (state.activeHoverChannelId !== null || state.activeHoverProgramId !== null) {
        state.activeHoverChannelId = null;
        state.activeHoverProgramId = null;
        isOverPopout = false;
        renderApp();
    }

    // Start 600ms hover delay timer
    hoverPopoutTimer = setTimeout(() => {
        state.activeHoverChannelId = channelId;
        state.activeHoverProgramId = programId;
        hoverPopoutTimer = null;
        renderApp();
    }, HOVER_POPOUT_DELAY_MS);
};

window.handleProgramLeave = function () {
    if (hoverPopoutTimer) {
        clearTimeout(hoverPopoutTimer);
        hoverPopoutTimer = null;
    }
    if (state.activeHoverChannelId !== null || state.activeHoverProgramId !== null) {
        if (popoutHideTimer) clearTimeout(popoutHideTimer);
        popoutHideTimer = setTimeout(() => {
            if (!isOverPopout) {
                state.activeHoverChannelId = null;
                state.activeHoverProgramId = null;
                renderApp();
            }
            popoutHideTimer = null;
        }, HOVER_HIDE_GRACE_MS);
    }
};

window.handlePopoutMouseEnter = function () {
    isOverPopout = true;
    if (popoutHideTimer) {
        clearTimeout(popoutHideTimer);
        popoutHideTimer = null;
    }
};

window.handlePopoutMouseLeave = function () {
    isOverPopout = false;
    if (state.activeHoverChannelId !== null || state.activeHoverProgramId !== null) {
        if (popoutHideTimer) clearTimeout(popoutHideTimer);
        popoutHideTimer = setTimeout(() => {
            if (!isOverPopout) {
                state.activeHoverChannelId = null;
                state.activeHoverProgramId = null;
                renderApp();
            }
            popoutHideTimer = null;
        }, HOVER_HIDE_GRACE_MS);
    }
};

window.handleEpgLeave = function () {
    if (hoverPopoutTimer) { clearTimeout(hoverPopoutTimer); hoverPopoutTimer = null; }
    if (popoutHideTimer)  { clearTimeout(popoutHideTimer);  popoutHideTimer  = null; }
    isOverPopout = false;
    if (state.activeHoverChannelId !== null || state.activeHoverProgramId !== null) {
        state.activeHoverChannelId = null;
        state.activeHoverProgramId = null;
        renderApp();
    }
};


// ─── Actions ─────────────────────────────────────
window.changeDate = function (d) {
    state.currentDate = d;
    state.epgInitialScrollDone = false; // re-center if switching back to today
    loadProgramsForDate(d).then(renderApp);
};
window.shiftDate = function (dir) {
    const all = [...new Set(state.channels.flatMap(c => c.dates || []))].sort();
    const i = all.indexOf(state.currentDate);
    if (i === -1) return;
    const ni = i + dir;
    if (ni >= 0 && ni < all.length) {
        state.currentDate = all[ni];
        state.epgInitialScrollDone = false; // re-center if switching back to today
        loadProgramsForDate(all[ni]).then(renderApp);
    }
};
window.goToNow = function () {
    const today = todayNPT();
    if (state.currentDate !== today) {
        state.currentDate = today;
        loadProgramsForDate(today).then(() => {
            renderApp();
            setTimeout(() => {
                const sc = document.getElementById('timeline-scroll');
                if (!sc) return;
                const nowX = nptMinutes(new Date()) * PX_PER_MIN;
                sc.scrollTo({ left: Math.max(0, nowX - sc.clientWidth / 2), behavior: 'smooth' });
            }, 100);
        });
    } else {
        const sc = document.getElementById('timeline-scroll');
        if (!sc) return;
        const nowX = nptMinutes(new Date()) * PX_PER_MIN;
        sc.scrollTo({ left: Math.max(0, nowX - sc.clientWidth / 2), behavior: 'smooth' });
    }
};


window.openDetail = async function (id) {
    try {
        const r = await apiGet(`/api/programs/${id}`);
        state.activeProgram = r.program;
        state.activeProgram.reminder = r.reminder;
        renderApp();
    } catch { toast('Could not load program details', 'err'); }
};
window.closeDetail = function () { state.activeProgram = null; renderApp(); };

window.openReminderModal = async function (programId) {
    // Find program from state or fetch it
    let p = null;
    for (const progs of Object.values(state.programsByChannel)) {
        p = progs.find(x => x.id === programId);
        if (p) break;
    }
    if (!p && state.activeProgram?.id === programId) p = state.activeProgram;
    if (!p) {
        try { p = (await apiGet(`/api/programs/${programId}`)).program; } catch { return; }
    }
    state.reminderTarget = p;
    renderApp();
};
window.closeReminderModal = function () { state.reminderTarget = null; renderApp(); };

window.saveReminder = async function (programId) {
    const sel = document.querySelector('input[name="ropt"]:checked');
    let minutes = sel ? sel.value : '15';
    if (minutes === 'custom') {
        minutes = document.getElementById('custom-min')?.value ?? '10';
    }
    try {
        await axios.post('/api/reminders', { program_id: programId, reminder_minutes_before: parseInt(minutes) });
        toast('Reminder saved!');
        state.reminderTarget = null;
        state.activeProgram = null;
        await loadReminders();
        await loadProgramsForDate(state.currentDate);
        renderApp();
    } catch (e) { toast(e.response?.data?.message || 'Could not save reminder', 'err'); }
};

window.cancelReminder = async function (id) {
    try {
        await axios.delete(`/api/reminders/${id}`);
        toast('Reminder removed');
        await loadReminders();
        await loadProgramsForDate(state.currentDate);
        state.activeProgram = null;
        renderApp();
    } catch { toast('Could not remove reminder', 'err'); }
};

window.markRead = async function (id) {
    try { await axios.patch(`/api/notifications/${id}/read`); await loadNotifications(); renderApp(); } catch { }
};
window.markAllRead = async function () {
    try { await axios.patch('/api/notifications/read-all'); await loadNotifications(); renderApp(); } catch { }
};

function updateNowLine() {
    const line = document.getElementById('now-line');
    if (!line) return;
    const nowX = nptMinutes(new Date()) * PX_PER_MIN;
    line.style.left = `${nowX}px`;
}

// ─── Polling ─────────────────────────────────────
setInterval(async () => {
    if (!state.user) return;
    await loadNotifications();
    updateNowLine();
    // Refresh bell badge without full re-render
    const badge = document.querySelector('#bell-btn span');
    if (badge) badge.textContent = state.unreadCount;
}, 15000);

window.syncVerticalScroll = function (el) {
    const container = document.getElementById('channel-labels-container');
    if (container) {
        container.style.transform = `translateY(-${el.scrollTop}px)`;
    }
};

let resizeTimer = null;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (!location.hash || location.hash === '#/epg') {
            renderApp();
        }
    }, 100);
});

// ─── Boot ─────────────────────────────────────────
window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', async () => {
    await loadUser();
    if (state.user) {
        await loadChannels();
        await Promise.all([loadNotifications(), loadReminders()]);
        await loadProgramsForDate(state.currentDate);
    }
    route();
});
