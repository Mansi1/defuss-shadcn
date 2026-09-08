// -- Dialog ---------------------------------------------------
// Wires [data-dialog-trigger] buttons to <dialog> elements, plus the
// named-state API so agents/tests can drive states by name (AGENTS.md "State API").
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
const dialogStates = ['default', 'open'];
/**
 * UI side of setState: 'default' closes, 'open' opens modally. Native
 * <dialog> can't animate to a declared state it's not in, so this is a
 * direct showModal()/close() dispatch; unknown names are rejected upstream.
 */
function triggerStateChange(dialog, stateName, _config) {
    switch (stateName) {
        case 'default':
            if (dialog.open)
                dialog.close();
            break;
        case 'open':
            if (!dialog.open)
                dialog.showModal();
            break;
    }
}
/** Registry-level API; pass the dialog element explicitly. Unknown names throw. */
export const dialogApi = {
    setState(dialog, stateName, config = {}) {
        if (!dialogStates.includes(stateName)) {
            throw new Error(`dialog: unknown state "${stateName}" (supported: ${dialogStates.join(', ')})`);
        }
        triggerStateChange(dialog, stateName, config);
        // state lives on the ELEMENT, not the module (multiple dialogs per page)
        dialog.dataset.stateName = stateName;
        dialog._stateConfig = config;
    },
    getState(dialog) {
        return { name: dialog.dataset.stateName || 'default', config: dialog._stateConfig ?? {} };
    },
};
_defussShadcn.dialogApi = dialogApi;
_defussShadcn.dialogStates = dialogStates;
function init() {
    document.querySelectorAll('[data-dialog-trigger]:not([data-init])').forEach((trigger) => {
        trigger.dataset.init = '';
        const dialog = document.getElementById(trigger.dataset.dialogTrigger);
        if (!dialog)
            return;
        trigger.addEventListener('click', () => {
            dialog._trigger = trigger;
            dialog.showModal();
        });
    });
    /* .command excluded: the command component owns its dialogs (own backdrop
       close, filtering, focus). Without this, dialog.js — which loads first —
       claims them via data-init and command.js's init silently skips them. */
    document.querySelectorAll('dialog:not(.alert-dialog):not(.sheet):not(.command):not([data-init])').forEach((dialog) => {
        dialog.dataset.init = '';
        // bind-scope the api per instance: `$('#confirm').api.setState('open')`
        dialog.api = {
            setState: (stateName, config) => dialogApi.setState(dialog, stateName, config),
            getState: () => dialogApi.getState(dialog),
        };
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog)
                dialog.close();
        });
        dialog.querySelectorAll('[data-dialog-close]').forEach((btn) => {
            btn.addEventListener('click', () => { dialog.close(); });
        });
        dialog.addEventListener('close', () => {
            // `close` fires AFTER the exit transition (display allow-discrete), so a
            // fast re-open can beat it — a stale event must not downgrade an open
            // dialog back to 'default' or yank focus out of it while it's showing.
            if (dialog.open)
                return;
            // reflect the actual UI state: any close path (Escape, backdrop, close
            // button) returns the dialog to 'default', even when it wasn't setState'd
            dialog.dataset.stateName = 'default';
            if (dialog._trigger)
                dialog._trigger.focus();
        });
    });
}
init();
new MutationObserver(init).observe(document, { childList: true, subtree: true });
//# sourceMappingURL=dialog.js.map