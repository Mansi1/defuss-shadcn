// -- Sidebar --------------------------------------------------
// Toggle collapse, keyboard shortcut (Cmd+B), and mobile dialog,
// plus the named-state API bound per .app-sidebar (AGENTS.md "State API").
// The component's own data-state attribute ("expanded"/"collapsed") is the
// observable state; 'default' means the authored expanded view.
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
const sidebarStates = ['default', 'collapsed'];
/**
 * UI side of setState: 'collapsed' docks the rail to icon-width (CSS key is
 * the documented data-state attribute); 'default' restores the authored
 * state (expanded unless the markup says otherwise).
 */
function triggerStateChange(sidebar, stateName, _config) {
    switch (stateName) {
        case 'default':
            sidebar.dataset.state = sidebar._defaultState ?? 'expanded';
            break;
        case 'collapsed':
            sidebar.dataset.state = 'collapsed';
            break;
    }
}
/** Registry-level API; pass the sidebar element explicitly. Unknown names throw. */
export const sidebarApi = {
    setState(sidebar, stateName, config = {}) {
        if (!sidebarStates.includes(stateName)) {
            throw new Error(`sidebar: unknown state "${stateName}" (supported: ${sidebarStates.join(', ')})`);
        }
        triggerStateChange(sidebar, stateName, config);
        // state lives on the ELEMENT, not the module (many sidebars per page)
        sidebar.dataset.stateName = stateName;
        sidebar._stateConfig = config;
    },
    getState(sidebar) {
        // reflect reality: trigger clicks and Cmd+B change data-state directly
        return {
            name: sidebar.dataset.state === 'collapsed' ? 'collapsed' : 'default',
            config: sidebar._stateConfig ?? {},
        };
    },
};
_defussShadcn.sidebarApi = sidebarApi;
_defussShadcn.sidebarStates = sidebarStates;
function init() {
    document.querySelectorAll('.app-sidebar:not([data-init])').forEach((sidebar) => {
        sidebar.dataset.init = '';
        // snapshot the authored state + bind per sidebar: `$('#my-sidebar').api.setState('collapsed')`
        sidebar._defaultState = sidebar.dataset.state || 'expanded';
        sidebar.api = {
            setState: (stateName, config) => sidebarApi.setState(sidebar, stateName, config),
            getState: () => sidebarApi.getState(sidebar),
        };
        // -- Toggle button → collapse/expand -----------------------
        const triggerId = sidebar.id ? `[data-sidebar-trigger="${sidebar.id}"]` : '.sidebar-trigger';
        document.querySelectorAll(triggerId).forEach((trigger) => {
            trigger.addEventListener('click', () => {
                const state = sidebar.dataset.state === 'collapsed' ? 'expanded' : 'collapsed';
                sidebar.dataset.state = state;
                // user interaction also moves the named state (keeps getState honest)
                sidebar.dataset.stateName = state === 'collapsed' ? 'collapsed' : 'default';
            });
        });
    });
    // -- Mobile dialog triggers ----------------------------------
    document.querySelectorAll('[data-sidebar-mobile]:not([data-init])').forEach((trigger) => {
        trigger.dataset.init = '';
        const dialog = document.getElementById(trigger.dataset.sidebarMobile);
        if (!dialog)
            return;
        trigger.addEventListener('click', () => {
            dialog.showModal();
        });
        // Close button inside the dialog
        dialog.querySelectorAll('.sidebar-mobile-close').forEach((btn) => {
            btn.addEventListener('click', () => { dialog.close(); });
        });
    });
}
init();
new MutationObserver(init).observe(document, { childList: true, subtree: true });
// -- Keyboard shortcut: Cmd+B / Ctrl+B ----------------------
if (!document.__sidebarKbInit) {
    document.__sidebarKbInit = true;
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
            e.preventDefault();
            // Toggle the first sidebar found on the page
            const sidebar = document.querySelector('.app-sidebar');
            if (sidebar) {
                sidebar.dataset.state = sidebar.dataset.state === 'collapsed' ? 'expanded' : 'collapsed';
            }
        }
    });
}
//# sourceMappingURL=sidebar.js.map