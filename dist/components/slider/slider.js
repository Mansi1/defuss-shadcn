/* -- Slider component ------------------------------------------- */
// Fill-track painting for native range inputs, plus the named-state API so
// agents/tests can enable/disable (and preset) a slider by name (AGENTS.md
// "State API").
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
const sliderStates = ['default', 'disabled'];
function updateSliderValue(el) {
    const min = parseFloat(el.min || 0);
    const max = parseFloat(el.max || 100);
    const value = parseFloat(el.value);
    const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;
    el.style.setProperty('--slider-value', `${percent}%`);
}
/**
 * UI side of setState: 'default' restores the authored enabled state and
 * optionally presets { value }; 'disabled' uses the native disabled
 * attribute (CSS :disabled styles it, keyboard/pointer go inert for free).
 */
function triggerStateChange(el, stateName, config) {
    switch (stateName) {
        case 'default':
            el.disabled = el._defaultDisabled ?? false;
            if (config?.value !== undefined)
                el.value = String(config.value);
            updateSliderValue(el);
            break;
        case 'disabled':
            el.disabled = true;
            break;
    }
}
/** Registry-level API; pass the input element explicitly. Unknown names throw. */
export const sliderApi = {
    setState(el, stateName, config = {}) {
        if (!sliderStates.includes(stateName)) {
            throw new Error(`slider: unknown state "${stateName}" (supported: ${sliderStates.join(', ')})`);
        }
        triggerStateChange(el, stateName, config);
        // state lives on the ELEMENT, not the module (many sliders per page)
        el.dataset.stateName = stateName;
        el._stateConfig = config;
    },
    getState(el) {
        // reflect reality: dragging/disabling changes the UI without setState()
        return {
            name: el.disabled ? 'disabled' : 'default',
            config: { ...el._stateConfig, value: el.value },
        };
    },
};
_defussShadcn.sliderApi = sliderApi;
_defussShadcn.sliderStates = sliderStates;
function init() {
    document.querySelectorAll('.slider:not([data-init])').forEach((el) => {
        el.dataset.init = '';
        // remember the authored disabled state so setState('default') restores it
        el._defaultDisabled = el.disabled;
        // bind-scope the api per instance: `$('#volume').api.setState('disabled')`
        el.api = {
            setState: (stateName, config) => sliderApi.setState(el, stateName, config),
            getState: () => sliderApi.getState(el),
        };
        updateSliderValue(el);
        el.addEventListener('input', () => updateSliderValue(el));
    });
}
init();
new MutationObserver(init).observe(document, { childList: true, subtree: true });
