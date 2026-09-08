// -- Number Input ---------------------------------------------
// Increment/decrement buttons for .number-input containers, plus the
// named-state API (AGENTS.md "State API"). The component's only observable
// state is the number itself, so 'default' carries an optional { value }
// preset and getState().config.value reports the live value.
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
const numberInputStates = ['default'];
const getInput = (wrapper) => wrapper.querySelector('input[type="number"]');
/**
 * UI side of setState: 'default' optionally presets { value } through the
 * native input (events dispatched so listeners see the change).
 */
function triggerStateChange(wrapper, config) {
    const input = getInput(wrapper);
    if (!input || config?.value === undefined)
        return;
    input.value = String(config.value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
}
/** Registry-level API; pass the wrapper explicitly. Unknown names throw. */
export const numberInputApi = {
    setState(wrapper, stateName, config = {}) {
        if (!numberInputStates.includes(stateName)) {
            throw new Error(`number-input: unknown state "${stateName}" (supported: ${numberInputStates.join(', ')})`);
        }
        triggerStateChange(wrapper, config);
        // state lives on the ELEMENT, not the module (many inputs per page)
        wrapper.dataset.stateName = stateName;
        wrapper._stateConfig = config;
    },
    getState(wrapper) {
        const input = getInput(wrapper);
        return {
            name: wrapper.dataset.stateName || 'default',
            // live value — reflects stepper clicks and typing, not just setState
            config: { ...wrapper._stateConfig, value: input ? input.value : '' },
        };
    },
};
_defussShadcn.numberInputApi = numberInputApi;
_defussShadcn.numberInputStates = numberInputStates;
function init() {
    document.querySelectorAll('.number-input:not([data-init])').forEach((wrapper) => {
        wrapper.dataset.init = '';
        // bind-scope the api per instance: `$('#qty').api.setState('default', { value: 5 })`
        wrapper.api = {
            setState: (stateName, config) => numberInputApi.setState(wrapper, stateName, config),
            getState: () => numberInputApi.getState(wrapper),
        };
        const input = wrapper.querySelector('input[type="number"]');
        const decBtn = wrapper.querySelector('[data-action="decrement"]');
        const incBtn = wrapper.querySelector('[data-action="increment"]');
        if (!input)
            return;
        const update = (direction) => {
            try {
                if (direction > 0)
                    input.stepUp();
                else
                    input.stepDown();
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
            catch { /* min/max boundary */ }
        };
        if (decBtn)
            decBtn.addEventListener('click', () => { update(-1); });
        if (incBtn)
            incBtn.addEventListener('click', () => { update(1); });
    });
}
init();
new MutationObserver(init).observe(document, { childList: true, subtree: true });
//# sourceMappingURL=number-input.js.map