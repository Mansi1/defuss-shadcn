// -- Toggle ---------------------------------------------------
// Toggles aria-pressed on .toggle buttons, plus the named-state API so
// agents/tests can drive the pressed state by name (AGENTS.md "State API").
// Skips toggles inside .toggle-group — those are managed by toggle-group.js.
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
const toggleStates = ['default', 'pressed'];
/**
 * UI side of setState: 'pressed' sets aria-pressed=true, 'default' restores
 * the authored aria-pressed value (snapshotted at init per instance).
 */
function triggerStateChange(toggle, stateName, _config) {
    switch (stateName) {
        case 'default':
            toggle.setAttribute('aria-pressed', toggle._defaultPressed ?? 'false');
            break;
        case 'pressed':
            toggle.setAttribute('aria-pressed', 'true');
            break;
    }
}
/** Registry-level API; pass the toggle button explicitly. Unknown names throw. */
export const toggleApi = {
    setState(toggle, stateName, config = {}) {
        if (!toggleStates.includes(stateName)) {
            throw new Error(`toggle: unknown state "${stateName}" (supported: ${toggleStates.join(', ')})`);
        }
        triggerStateChange(toggle, stateName, config);
        // state lives on the ELEMENT, not the module (many toggles per page)
        toggle.dataset.stateName = stateName;
        toggle._stateConfig = config;
    },
    getState(toggle) {
        // reflect reality: user clicks change aria-pressed without setState()
        const pressed = toggle.getAttribute('aria-pressed') === 'true';
        return {
            name: toggle.dataset.stateName || (pressed ? 'pressed' : 'default'),
            config: toggle._stateConfig ?? {},
        };
    },
};
_defussShadcn.toggleApi = toggleApi;
_defussShadcn.toggleStates = toggleStates;
function init() {
    document.querySelectorAll('.toggle:not([data-init]):not(.toggle-group .toggle)').forEach((toggle) => {
        toggle.dataset.init = '';
        // remember the authored pressed state so setState('default') can restore it
        toggle._defaultPressed = toggle.getAttribute('aria-pressed') || 'false';
        // bind-scope the api per instance: `$('#my-toggle').api.setState('pressed')`
        toggle.api = {
            setState: (stateName, config) => toggleApi.setState(toggle, stateName, config),
            getState: () => toggleApi.getState(toggle),
        };
        toggle.addEventListener('click', () => {
            const pressed = toggle.getAttribute('aria-pressed') === 'true';
            toggle.setAttribute('aria-pressed', !pressed);
            // user interaction also moves the named state (keeps getState honest)
            toggle.dataset.stateName = !pressed ? 'pressed' : 'default';
        });
    });
}
init();
new MutationObserver(init).observe(document, { childList: true, subtree: true });
//# sourceMappingURL=toggle.js.map