// -- Toggle Group ---------------------------------------------
// Manages single/multiple selection and roving tabindex across .toggle
// buttons, plus the named-state API bound per group, so agents/tests can
// enable/disable a whole group by name (AGENTS.md "State API").
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
const toggleGroupStates = ['default', 'disabled'];
/**
 * UI side of setState: 'disabled' mirrors the documented data-disabled
 * attribute (CSS kills pointer events + dims items); 'default' removes it.
 */
function triggerStateChange(group, stateName, _config) {
    switch (stateName) {
        case 'default':
            group.removeAttribute('data-disabled');
            break;
        case 'disabled':
            group.setAttribute('data-disabled', '');
            break;
    }
}
/** Registry-level API; pass the group element explicitly. Unknown names throw. */
export const toggleGroupApi = {
    setState(group, stateName, config = {}) {
        if (!toggleGroupStates.includes(stateName)) {
            throw new Error(`toggle-group: unknown state "${stateName}" (supported: ${toggleGroupStates.join(', ')})`);
        }
        triggerStateChange(group, stateName, config);
        // state lives on the ELEMENT, not the module (many groups per page)
        group.dataset.stateName = stateName;
        group._stateConfig = config;
    },
    getState(group) {
        return {
            name: group.hasAttribute('data-disabled') ? 'disabled' : 'default',
            config: group._stateConfig ?? {},
        };
    },
};
_defussShadcn.toggleGroupApi = toggleGroupApi;
_defussShadcn.toggleGroupStates = toggleGroupStates;
function init() {
    document.querySelectorAll('.toggle-group:not([data-init])').forEach((group) => {
        group.dataset.init = '';
        // bind-scope the api per group: `$('#align').api.setState('disabled')`
        group.api = {
            setState: (stateName, config) => toggleGroupApi.setState(group, stateName, config),
            getState: () => toggleGroupApi.getState(group),
        };
        const type = group.getAttribute('data-type') || 'single';
        const getToggles = () => Array.from(group.querySelectorAll('.toggle:not(:disabled)'));
        // Roving tabindex: only one item tabbable at a time
        const initTabindex = () => {
            const toggles = getToggles();
            if (toggles.length === 0)
                return;
            const pressed = toggles.find((t) => t.getAttribute('aria-pressed') === 'true');
            const active = pressed || toggles[0];
            toggles.forEach((t) => {
                t.setAttribute('tabindex', t === active ? '0' : '-1');
            });
        };
        initTabindex();
        group.addEventListener('click', (e) => {
            const toggle = e.target.closest('.toggle');
            if (!toggle || toggle.disabled || group.hasAttribute('data-disabled'))
                return;
            const toggles = getToggles();
            const pressed = toggle.getAttribute('aria-pressed') === 'true';
            if (type === 'single') {
                toggles.forEach((t) => t.setAttribute('aria-pressed', 'false'));
                if (!pressed)
                    toggle.setAttribute('aria-pressed', 'true');
            }
            else {
                toggle.setAttribute('aria-pressed', String(!pressed));
            }
            // Update roving tabindex to current item
            toggles.forEach((t) => t.setAttribute('tabindex', t === toggle ? '0' : '-1'));
        });
        group.addEventListener('keydown', (e) => {
            const toggle = e.target.closest('.toggle');
            if (!toggle || group.hasAttribute('data-disabled'))
                return;
            const toggles = getToggles();
            const idx = toggles.indexOf(toggle);
            if (idx === -1)
                return;
            const vertical = group.getAttribute('data-orientation') === 'vertical';
            const fwd = vertical ? 'ArrowDown' : 'ArrowRight';
            const bwd = vertical ? 'ArrowUp' : 'ArrowLeft';
            let next;
            if (e.key === fwd) {
                e.preventDefault();
                next = (idx + 1) % toggles.length;
            }
            else if (e.key === bwd) {
                e.preventDefault();
                next = (idx - 1 + toggles.length) % toggles.length;
            }
            else if (e.key === 'Home') {
                e.preventDefault();
                next = 0;
            }
            else if (e.key === 'End') {
                e.preventDefault();
                next = toggles.length - 1;
            }
            if (next !== undefined) {
                toggles[idx].setAttribute('tabindex', '-1');
                toggles[next].setAttribute('tabindex', '0');
                toggles[next].focus();
            }
        });
    });
}
init();
new MutationObserver(init).observe(document, { childList: true, subtree: true });
//# sourceMappingURL=toggle-group.js.map