// -- Toolbar --------------------------------------------------
// Roving tabindex for role="toolbar" containers.
// Arrow keys move focus between focusable children, plus the named-state API
// so agents/tests can reset the roving position by name (AGENTS.md
// "State API"). The toolbar's only observable state is *which item holds the
// roving tabindex*, so 'default' means "back to the authored position" and
// getState() reports where the roving stop currently is.
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
const toolbarStates = ['default'];
/**
 * UI side of setState: 'default' restores the roving tabindex to the first
 * enabled item (the authored position); optional { focus: n } config parks
 * the roving stop on the nth item instead — focus is only moved there if the
 * toolbar already contains the focus, matching native roving semantics.
 */
function triggerStateChange(toolbar, items, stateName, config) {
    if (stateName !== 'default' || items.length === 0)
        return;
    const target = items[Math.min(Number(config?.focus ?? 0), items.length - 1)] || items[0];
    items.forEach((item) => item.setAttribute('tabindex', item === target ? '0' : '-1'));
    if (toolbar.contains(document.activeElement))
        target.focus();
}
/** Registry-level API; pass the toolbar element explicitly. Unknown names throw. */
export const toolbarApi = {
    setState(toolbar, stateName, config = {}) {
        if (!toolbarStates.includes(stateName)) {
            throw new Error(`toolbar: unknown state "${stateName}" (supported: ${toolbarStates.join(', ')})`);
        }
        const items = toolbarItems(toolbar);
        triggerStateChange(toolbar, items, stateName, config);
        // state lives on the ELEMENT, not the module (many toolbars per page)
        toolbar.dataset.stateName = stateName;
        toolbar._stateConfig = config;
    },
    getState(toolbar) {
        const items = toolbarItems(toolbar);
        const idx = items.findIndex((item) => item.getAttribute('tabindex') === '0');
        return {
            name: toolbar.dataset.stateName || 'default',
            // observable roving position — reflects arrow-key movement too
            config: { ...toolbar._stateConfig, rovingIndex: idx },
        };
    },
};
_defussShadcn.toolbarApi = toolbarApi;
_defussShadcn.toolbarStates = toolbarStates;
const toolbarItems = (toolbar) => Array.from(toolbar.querySelectorAll('button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'));
function init() {
    document.querySelectorAll('.toolbar[role="toolbar"]:not([data-init])').forEach((toolbar) => {
        toolbar.dataset.init = '';
        // bind-scope the api per instance: `$('#fmt').api.setState('default')`
        toolbar.api = {
            setState: (stateName, config) => toolbarApi.setState(toolbar, stateName, config),
            getState: () => toolbarApi.getState(toolbar),
        };
        const items = toolbarItems(toolbar);
        if (items.length === 0)
            return;
        items.forEach((item, i) => {
            item.setAttribute('tabindex', i === 0 ? '0' : '-1');
        });
        toolbar.addEventListener('keydown', (e) => {
            const current = items.indexOf(document.activeElement);
            if (current === -1)
                return;
            const vertical = toolbar.getAttribute('aria-orientation') === 'vertical';
            const fwd = vertical ? 'ArrowDown' : 'ArrowRight';
            const bwd = vertical ? 'ArrowUp' : 'ArrowLeft';
            let next;
            if (e.key === fwd) {
                e.preventDefault();
                next = (current + 1) % items.length;
            }
            else if (e.key === bwd) {
                e.preventDefault();
                next = (current - 1 + items.length) % items.length;
            }
            else if (e.key === 'Home') {
                e.preventDefault();
                next = 0;
            }
            else if (e.key === 'End') {
                e.preventDefault();
                next = items.length - 1;
            }
            if (next !== undefined) {
                items[current].setAttribute('tabindex', '-1');
                items[next].setAttribute('tabindex', '0');
                items[next].focus();
            }
        });
    });
}
init();
new MutationObserver(init).observe(document, { childList: true, subtree: true });
