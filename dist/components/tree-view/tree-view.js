// -- Tree View ------------------------------------------------
// Keyboard navigation and ARIA state for tree views, plus the named-state
// API bound per branch (<details class="tree-branch">), so agents/tests can
// expand branches by name (AGENTS.md "State API").
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
const treeViewStates = ['default', 'expanded'];
/**
 * UI side of setState (per branch): 'expanded' opens the branch, 'default'
 * restores the authored open/closed snapshot taken at init. The <details>
 * toggle event keeps aria-expanded on the treeitem in sync automatically.
 */
function triggerStateChange(details, stateName, _config) {
    switch (stateName) {
        case 'default':
            details.open = details._defaultOpen ?? false;
            break;
        case 'expanded':
            details.open = true;
            break;
    }
}
/** Registry-level API; pass the branch element explicitly. Unknown names throw. */
export const treeViewApi = {
    setState(details, stateName, config = {}) {
        if (!treeViewStates.includes(stateName)) {
            throw new Error(`tree-view: unknown state "${stateName}" (supported: ${treeViewStates.join(', ')})`);
        }
        triggerStateChange(details, stateName, config);
        // state lives on the ELEMENT, not the module (many branches per tree)
        details.dataset.stateName = stateName;
        details._stateConfig = config;
    },
    getState(details) {
        // reflect reality: summary clicks and ArrowLeft/Right change it too
        return {
            name: details.open ? 'expanded' : 'default',
            config: details._stateConfig ?? {},
        };
    },
};
_defussShadcn.treeViewApi = treeViewApi;
_defussShadcn.treeViewStates = treeViewStates;
function init() {
    document.querySelectorAll('.tree[role="tree"]:not([data-init])').forEach((tree) => {
        tree.dataset.init = '';
        /* Keep aria-expanded in sync with <details> open state */
        tree.querySelectorAll('.tree-branch').forEach((details) => {
            const treeitem = details.closest('[role="treeitem"]');
            if (!treeitem)
                return;
            // snapshot the authored state + bind the api per branch:
            // `$('#my-branch').api.setState('expanded')`
            details._defaultOpen = details.open;
            details.api = {
                setState: (stateName, config) => treeViewApi.setState(details, stateName, config),
                getState: () => treeViewApi.getState(details),
            };
            details.addEventListener('toggle', () => {
                treeitem.setAttribute('aria-expanded', String(details.open));
                // user interaction also moves the named state (keeps getState honest)
                details.dataset.stateName = details.open ? 'expanded' : 'default';
            });
        });
        /* Keyboard navigation */
        tree.addEventListener('keydown', (e) => {
            const target = e.target.closest('.tree-branch-trigger, .tree-leaf');
            if (!target)
                return;
            const allItems = Array.from(tree.querySelectorAll('.tree-branch-trigger, .tree-leaf'));
            const visibleItems = allItems.filter((item) => item.checkVisibility());
            const index = visibleItems.indexOf(target);
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    if (index < visibleItems.length - 1)
                        visibleItems[index + 1].focus();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    if (index > 0)
                        visibleItems[index - 1].focus();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    {
                        const detailsR = target.closest('details.tree-branch');
                        if (detailsR && !detailsR.open)
                            detailsR.open = true;
                    }
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    {
                        const detailsL = target.closest('details.tree-branch');
                        if (detailsL && detailsL.open)
                            detailsL.open = false;
                    }
                    break;
                case 'Home':
                    e.preventDefault();
                    if (visibleItems.length)
                        visibleItems[0].focus();
                    break;
                case 'End':
                    e.preventDefault();
                    if (visibleItems.length)
                        visibleItems[visibleItems.length - 1].focus();
                    break;
            }
        });
    });
}
init();
new MutationObserver(init).observe(document, { childList: true, subtree: true });
