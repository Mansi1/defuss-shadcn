// -- Color Picker ---------------------------------------------
// Syncs the hex value display with the color input, plus the named-state API
// (AGENTS.md "State API"). The picker's observable state is the chosen color,
// so 'default' carries an optional { value } preset and getState().config
// reports the live value.
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
const colorPickerStates = ['default'];
const getInput = (picker) => picker.querySelector('input[type="color"]');
/**
 * UI side of setState: 'default' optionally presets { value } through the
 * native color input (input event dispatched so the display stays in sync).
 */
function triggerStateChange(picker, config) {
    const input = getInput(picker);
    if (!input || config?.value === undefined)
        return;
    input.value = String(config.value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
}
/** Registry-level API; pass the wrapper explicitly. Unknown names throw. */
export const colorPickerApi = {
    setState(picker, stateName, config = {}) {
        if (!colorPickerStates.includes(stateName)) {
            throw new Error(`color-picker: unknown state "${stateName}" (supported: ${colorPickerStates.join(', ')})`);
        }
        triggerStateChange(picker, config);
        // state lives on the ELEMENT, not the module (many pickers per page)
        picker.dataset.stateName = stateName;
        picker._stateConfig = config;
    },
    getState(picker) {
        const input = getInput(picker);
        return {
            name: picker.dataset.stateName || 'default',
            // live value — reflects picking and typing, not just setState
            config: { ...picker._stateConfig, value: input ? input.value : '' },
        };
    },
};
_defussShadcn.colorPickerApi = colorPickerApi;
_defussShadcn.colorPickerStates = colorPickerStates;
function init() {
    document.querySelectorAll('.color-picker:not([data-init])').forEach((picker) => {
        picker.dataset.init = '';
        // bind-scope the api per instance: `$('#theme-color').api.setState('default', { value: '#ff0000' })`
        picker.api = {
            setState: (stateName, config) => colorPickerApi.setState(picker, stateName, config),
            getState: () => colorPickerApi.getState(picker),
        };
        const input = picker.querySelector('input[type="color"]');
        const display = picker.querySelector('.color-picker-value');
        if (!input || !display)
            return;
        display.textContent = input.value;
        input.addEventListener('input', () => {
            display.textContent = input.value;
        });
    });
}
init();
new MutationObserver(init).observe(document, { childList: true, subtree: true });
//# sourceMappingURL=color-picker.js.map