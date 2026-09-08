// -- Calendar -------------------------------------------------
// Interactive calendar grid with month navigation and day selection, plus
// the named-state API (AGENTS.md "State API"). The calendar's observable
// state is its view (visible month + selected day), so 'default' resets to
// today (or navigates/selects via { year, month, day }) and getState()
// reports the live view.
// Shared preamble (AGENTS.md "State API"); build.ts inlines it into the
// shipped .js, so this import never appears in dist/.
/**
 * Why: every interactive component needs the same preamble (global registry +
 * `$` query alias). Single-sourced here instead of duplicated in 26 files;
 * scripts/build.ts inlines the compiled functions into each shipped component
 * .js so dist files stay isolated and copy-paste/CDN-ready. The function is
 * idempotent: whichever component loads first wins, the rest are no-ops.
 * Contract: AGENTS.md "State API"; types: src/types/defuss-shadcn.d.ts.
 */
function defussGlobals() {
    globalThis._defussShadcn = globalThis._defussShadcn || {};
    if (typeof globalThis.$ !== 'function')
        globalThis.$ = document.querySelector.bind(document);
    return globalThis._defussShadcn;
}
/**
 * Why: calling showPopover() on a popover while its exit transition is still
 * running — the exact setState('open') path right after a light dismiss,
 * whose display:none is delayed by `transition: display … allow-discrete` —
 * crashes the headless renderer (reproduced: headless Chromium dies outright,
 * popover + nav-menu + dropdown + tooltip share the CSS pattern). Wait until
 * the element's computed display has actually flipped to none (the exit
 * committed), then show. A stable-open element polls to the cap and the
 * guarded showPopover() is a harmless no-op. Inlined by build.ts like
 * defussGlobals(); keep self-contained.
 */
function safeShowPopover(el) {
    const show = () => {
        try {
            el.showPopover();
        }
        catch { /* already open */ }
    };
    const displayed = () => getComputedStyle(el).display !== 'none';
    if (!displayed()) {
        show();
        return;
    }
    // displayed: either stably open (nothing to do) or mid-exit (must wait).
    // Cap the poll at ~500ms — longer than any component's exit transition.
    const deadline = performance.now() + 500;
    const tick = () => {
        if (!displayed() || performance.now() > deadline)
            show();
        else
            requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}
const _defussShadcn = defussGlobals();
const calendarStates = ['default'];
/**
 * UI side of setState: 'default' (re)renders the view. Without config it
 * resets to today with no selection; { year, month, day } navigates to that
 * month (month is 0-based, like Date) and optionally selects a day.
 */
function triggerStateChange(cal, stateName, config) {
    const state = cal._calState;
    if (!state || stateName !== 'default')
        return;
    const now = new Date();
    state.year = config?.year ?? now.getFullYear();
    state.month = config?.month ?? now.getMonth();
    state.selected = config?.day ?? null;
    renderCalendar(cal, state.year, state.month, state.selected);
}
/** Registry-level API; pass the calendar element explicitly. Unknown names throw. */
export const calendarApi = {
    setState(cal, stateName, config = {}) {
        if (!calendarStates.includes(stateName)) {
            throw new Error(`calendar: unknown state "${stateName}" (supported: ${calendarStates.join(', ')})`);
        }
        triggerStateChange(cal, stateName, config);
        // state lives on the ELEMENT, not the module (many calendars per page)
        cal.dataset.stateName = stateName;
        cal._stateConfig = config;
    },
    getState(cal) {
        const state = cal._calState ?? {};
        return {
            name: cal.dataset.stateName || 'default',
            // live view — reflects nav clicks and day selection, not just setState
            config: {
                ...cal._stateConfig,
                year: state.year,
                month: state.month,
                selected: state.selected,
            },
        };
    },
};
_defussShadcn.calendarApi = calendarApi;
_defussShadcn.calendarStates = calendarStates;
const DAYS = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(2024, 0, i)));
const MONTHS = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(undefined, { month: 'long' }).format(new Date(2024, i, 1)));
const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
const isToday = (year, month, day) => {
    const now = new Date();
    return now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;
};
const renderCalendar = (el, year, month, selectedDay) => {
    const total = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);
    const prevTotal = daysInMonth(year, month - 1);
    /* Header */
    const heading = el.querySelector('.calendar-heading');
    if (heading)
        heading.textContent = `${MONTHS[month]} ${year}`;
    /* Grid */
    const grid = el.querySelector('.calendar-grid');
    if (!grid)
        return;
    let html = '<thead><tr>';
    for (let d = 0; d < 7; d++) {
        html += `<th class="calendar-day-label" scope="col">${DAYS[d]}</th>`;
    }
    html += '</tr></thead><tbody>';
    let dayNum = 1;
    let nextDayNum = 1;
    const rows = Math.ceil((startDay + total) / 7);
    for (let r = 0; r < rows; r++) {
        html += '<tr>';
        for (let c = 0; c < 7; c++) {
            const cellIndex = r * 7 + c;
            if (cellIndex < startDay) {
                const prevDay = prevTotal - startDay + cellIndex + 1;
                html += `<td class="calendar-day" data-outside><button tabindex="-1" data-day="${prevDay}" data-outside="prev">${prevDay}</button></td>`;
            }
            else if (dayNum > total) {
                html += `<td class="calendar-day" data-outside><button tabindex="-1" data-day="${nextDayNum}" data-outside="next">${nextDayNum}</button></td>`;
                nextDayNum++;
            }
            else {
                let cls = 'calendar-day';
                let attrs = '';
                if (isToday(year, month, dayNum))
                    attrs += ' data-today';
                if (dayNum === selectedDay)
                    attrs += ' data-selected';
                html += `<td class="${cls}"${attrs}><button data-day="${dayNum}">${dayNum}</button></td>`;
                dayNum++;
            }
        }
        html += '</tr>';
    }
    html += '</tbody>';
    grid.innerHTML = html;
};
function init() {
    document.querySelectorAll('.calendar:not([data-init])').forEach((cal) => {
        cal.dataset.init = '';
        const now = new Date();
        // state lives on the ELEMENT, not module scope (AGENTS.md "State API")
        const state = (cal._calState = {
            year: now.getFullYear(),
            month: now.getMonth(),
            selected: null,
        });
        // bind-scope the api per instance: `$('#my-calendar').api.setState('default', { year: 2024, month: 0, day: 15 })`
        cal.api = {
            setState: (stateName, config) => calendarApi.setState(cal, stateName, config),
            getState: () => calendarApi.getState(cal),
        };
        renderCalendar(cal, state.year, state.month, state.selected);
        /* Navigation */
        cal.addEventListener('click', (e) => {
            const nav = e.target.closest('.calendar-nav');
            if (nav) {
                const action = nav.dataset.action;
                if (action === 'prev-month') {
                    state.month--;
                    if (state.month < 0) {
                        state.month = 11;
                        state.year--;
                    }
                    state.selected = null;
                }
                else if (action === 'next-month') {
                    state.month++;
                    if (state.month > 11) {
                        state.month = 0;
                        state.year++;
                    }
                    state.selected = null;
                }
                renderCalendar(cal, state.year, state.month, state.selected);
                return;
            }
            /* Day selection */
            const dayBtn = e.target.closest('.calendar-day button');
            if (dayBtn && !dayBtn.closest('[data-disabled]')) {
                const day = parseInt(dayBtn.dataset.day, 10);
                const outside = dayBtn.dataset.outside;
                if (outside === 'prev') {
                    state.month--;
                    if (state.month < 0) {
                        state.month = 11;
                        state.year--;
                    }
                    state.selected = day;
                }
                else if (outside === 'next') {
                    state.month++;
                    if (state.month > 11) {
                        state.month = 0;
                        state.year++;
                    }
                    state.selected = day;
                }
                else {
                    state.selected = day;
                }
                renderCalendar(cal, state.year, state.month, state.selected);
                /* Dispatch custom event */
                cal.dispatchEvent(new CustomEvent('calendar:select', {
                    detail: { date: new Date(state.year, state.month, state.selected) },
                    bubbles: true
                }));
            }
        });
        /* Keyboard navigation in grid */
        cal.addEventListener('keydown', (e) => {
            const dayBtn = e.target.closest('.calendar-day button');
            if (!dayBtn)
                return;
            const allBtns = Array.from(cal.querySelectorAll('.calendar-day button'));
            const idx = allBtns.indexOf(dayBtn);
            let next = null;
            switch (e.key) {
                case 'ArrowRight':
                    e.preventDefault();
                    next = allBtns[idx + 1];
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    next = allBtns[idx - 1];
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    next = allBtns[idx + 7];
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    next = allBtns[idx - 7];
                    break;
            }
            if (next)
                next.focus();
        });
    });
}
init();
new MutationObserver(init).observe(document, { childList: true, subtree: true });
//# sourceMappingURL=calendar.js.map