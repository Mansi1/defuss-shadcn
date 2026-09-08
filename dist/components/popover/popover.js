// -- Popover --------------------------------------------------
// CSS anchor positioning for popover components, plus the named-state API
// so agents/tests can drive open/closed by name (AGENTS.md "State API").
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
const popoverStates = ['default', 'open'];
/**
 * UI side of setState: 'default' hides, 'open' shows. Open/close mechanics
 * stay native (Popover API); this only dispatches to show/hidePopover().
 */
function triggerStateChange(popover, stateName, _config) {
    switch (stateName) {
        case 'default':
            try {
                popover.hidePopover();
            }
            catch { /* already closed */ }
            break;
        case 'open':
            // deferred show (safeShowPopover): showPopover() mid-exit (right after
            // light dismiss) crashes the headless renderer; exclusion stays native.
            safeShowPopover(popover);
            break;
    }
}
/** Registry-level API; pass the popover element explicitly. Unknown names throw. */
export const popoverApi = {
    setState(popover, stateName, config = {}) {
        if (!popoverStates.includes(stateName)) {
            throw new Error(`popover: unknown state "${stateName}" (supported: ${popoverStates.join(', ')})`);
        }
        triggerStateChange(popover, stateName, config);
        // state lives on the ELEMENT, not the module (multiple popovers per page)
        popover.dataset.stateName = stateName;
        popover._stateConfig = config;
    },
    getState(popover) {
        return { name: popover.dataset.stateName || 'default', config: popover._stateConfig ?? {} };
    },
};
_defussShadcn.popoverApi = popoverApi;
_defussShadcn.popoverStates = popoverStates;
function init() {
    document.querySelectorAll('[popovertarget]:not([data-init])').forEach((trigger) => {
        const id = trigger.getAttribute('popovertarget');
        const popover = document.getElementById(id);
        // Ownership boundary (AGENTS.md "Each component owns its dialog", popover
        // edition): only claim triggers whose target is a .popover panel. Stamping
        // every [popovertarget] starved sibling components — navigation-menu's
        // triggers got claimed here, then skipped (panel isn't .popover), and
        // nav-menu's own :not([data-init]) scan never anchored them.
        if (!popover || !popover.classList.contains('popover'))
            return;
        trigger.dataset.init = '';
        // CSS anchor positioning - unique name per trigger-popover pair
        const anchorId = `--popover-${id}`;
        trigger.style.anchorName = anchorId;
        popover.style.positionAnchor = anchorId;
    });
    // bind-scope the api per popover instance: `$('#demo').api.setState('open')`
    document.querySelectorAll('.popover[popover]:not([data-init])').forEach((popover) => {
        popover.dataset.init = '';
        popover.api = {
            setState: (stateName, config) => popoverApi.setState(popover, stateName, config),
            getState: () => popoverApi.getState(popover),
        };
    });
}
init();
new MutationObserver(init).observe(document, { childList: true, subtree: true });
//# sourceMappingURL=popover.js.map