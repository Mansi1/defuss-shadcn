// -- Sheet ----------------------------------------------------
// Wires [data-sheet-trigger] buttons to <dialog class="sheet"> elements,
// plus the named-state API so agents/tests can drive open/closed by name
// (AGENTS.md "State API").
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
const sheetStates = ['default', 'open'];
/**
 * UI side of setState: 'default' closes, 'open' opens modally. Native
 * <dialog> mechanics; close-focus-return is handled by the close listener.
 */
function triggerStateChange(sheet, stateName, _config) {
    switch (stateName) {
        case 'default':
            if (sheet.open)
                sheet.close();
            break;
        case 'open':
            if (!sheet.open)
                sheet.showModal();
            break;
    }
}
/** Registry-level API; pass the sheet element explicitly. Unknown names throw. */
export const sheetApi = {
    setState(sheet, stateName, config = {}) {
        if (!sheetStates.includes(stateName)) {
            throw new Error(`sheet: unknown state "${stateName}" (supported: ${sheetStates.join(', ')})`);
        }
        triggerStateChange(sheet, stateName, config);
        // state lives on the ELEMENT, not the module (multiple sheets per page)
        sheet.dataset.stateName = stateName;
        sheet._stateConfig = config;
    },
    getState(sheet) {
        return { name: sheet.dataset.stateName || 'default', config: sheet._stateConfig ?? {} };
    },
};
_defussShadcn.sheetApi = sheetApi;
_defussShadcn.sheetStates = sheetStates;
function init() {
    document.querySelectorAll('[data-sheet-trigger]:not([data-init])').forEach((trigger) => {
        trigger.dataset.init = '';
        const sheet = document.getElementById(trigger.dataset.sheetTrigger);
        if (!sheet)
            return;
        trigger.addEventListener('click', () => {
            sheet._trigger = trigger;
            sheet.showModal();
        });
    });
    document.querySelectorAll('dialog.sheet:not([data-init])').forEach((sheet) => {
        sheet.dataset.init = '';
        // bind-scope the api per instance: `$('#sheet-right').api.setState('open')`
        sheet.api = {
            setState: (stateName, config) => sheetApi.setState(sheet, stateName, config),
            getState: () => sheetApi.getState(sheet),
        };
        sheet.addEventListener('click', (e) => {
            if (e.target === sheet)
                sheet.close();
        });
        sheet.querySelectorAll('[data-sheet-close]').forEach((btn) => {
            btn.addEventListener('click', () => { sheet.close(); });
        });
        sheet.addEventListener('close', () => {
            // `close` fires AFTER the exit transition (display allow-discrete), so a
            // fast re-open can beat it — a stale event must not downgrade an open
            // sheet back to 'default' or yank focus out of it while it's showing.
            if (sheet.open)
                return;
            // reflect the actual UI state: any close path (Escape, backdrop, close
            // button) returns the sheet to 'default', even when it wasn't setState'd
            sheet.dataset.stateName = 'default';
            if (sheet._trigger)
                sheet._trigger.focus();
        });
    });
}
init();
new MutationObserver(init).observe(document, { childList: true, subtree: true });
//# sourceMappingURL=sheet.js.map