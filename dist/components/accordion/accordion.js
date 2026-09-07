// -- Accordion -----------------------------------------------
// Single-open accordion behavior using native <details> elements, plus the
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
const accordionStates = ['default', 'all-open', 'all-closed'];
/**
 * UI side of setState: syncs the DOM to a declared state. `_applying` suspends
 * the single-open/collapsible enforcement in the toggle listeners, otherwise
 * 'all-closed'/'all-open' would be undone by the enforcement. The `toggle`
 * event is queued (async), so the guard must outlive this function: it is
 * released on the next macrotask, after the queued toggle events have fired —
 * toggle-event tasks are queued synchronously by our `open` mutations, so they
 * always run before the timeout scheduled after them. The generation token
 * keeps back-to-back setState calls from releasing each other's guard.
 */
function triggerStateChange(accordion, stateName, _config) {
    const items = Array.from(accordion.querySelectorAll('.accordion-item'));
    const gen = (accordion._applyGen ?? 0) + 1;
    accordion._applyGen = gen;
    accordion._applying = true;
    switch (stateName) {
        case 'default':
            items.forEach((item, i) => { item.open = (accordion._defaultOpen ?? [])[i] ?? item.open; });
            break;
        case 'all-open':
            items.forEach((item) => { item.open = true; });
            break;
        case 'all-closed':
            items.forEach((item) => { item.open = false; });
            break;
    }
    // toggle events queue as tasks AFTER our mutations, before this timeout task
    setTimeout(() => {
        if (accordion._applyGen === gen)
            accordion._applying = false;
    }, 0);
}
/** Registry-level API; pass the accordion element explicitly. Unknown names throw. */
export const accordionApi = {
    setState(accordion, stateName, config = {}) {
        if (!accordionStates.includes(stateName)) {
            throw new Error(`accordion: unknown state "${stateName}" (supported: ${accordionStates.join(', ')})`);
        }
        triggerStateChange(accordion, stateName, config);
        // state lives on the ELEMENT, not the module: 26 components share one page,
        // and each instance may sit in a different state
        accordion.dataset.stateName = stateName;
        accordion._stateConfig = config;
    },
    getState(accordion) {
        return { name: accordion.dataset.stateName || 'default', config: accordion._stateConfig ?? {} };
    },
};
_defussShadcn.accordionApi = accordionApi;
_defussShadcn.accordionStates = accordionStates;
function init() {
    document.querySelectorAll('.accordion[data-type="single"]:not([data-init])').forEach((accordion) => {
        accordion.dataset.init = '';
        const items = accordion.querySelectorAll('.accordion-item');
        const collapsible = accordion.hasAttribute('data-collapsible');
        // snapshot the authored markup — that is the 'default' state to return to
        accordion._defaultOpen = Array.from(items).map((item) => item.open);
        // bind-scope the api per instance: `$('#x').api.setState('all-open')`
        accordion.api = {
            setState: (stateName, config) => accordionApi.setState(accordion, stateName, config),
            getState: () => accordionApi.getState(accordion),
        };
        items.forEach((item) => {
            // Cancellable pre-event: closing the LAST open item of a non-collapsible
            // single accordion is denied here, before the DOM changes. Reopening it
            // in the `toggle` handler instead would visibly flicker close→open now
            // that the ::details-content height transition animates.
            item.addEventListener('beforetoggle', (e) => {
                if (accordion._applying)
                    return; // programmatic state change in progress
                if (e.newState !== 'closed' || collapsible)
                    return;
                if (!Array.from(items).some((i) => i !== item && i.open))
                    e.preventDefault();
            });
            item.addEventListener('toggle', () => {
                if (accordion._applying)
                    return; // programmatic state change in progress
                if (item.open) {
                    items.forEach((sibling) => {
                        if (sibling !== item && sibling.open)
                            sibling.open = false;
                    });
                }
                else if (!collapsible) {
                    // fallback for browsers without beforetoggle (which the deny above
                    // needs): reopen, accepting the flicker — better than losing the
                    // single-open guarantee. Modern browsers never reach this branch
                    // because a denied beforetoggle fires no toggle event at all.
                    const anyOpen = Array.from(items).some((i) => i.open);
                    if (!anyOpen)
                        item.open = true;
                }
            });
        });
    });
}
init();
new MutationObserver(init).observe(document, { childList: true, subtree: true });
