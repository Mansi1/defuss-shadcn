// -- Avatar ---------------------------------------------------
// Hides broken avatar images and shows the fallback, plus the named-state
// API bound per .avatar wrapper, so agents/tests can show the fallback
// without a network failure (AGENTS.md "State API").
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
const avatarStates = ['default', 'error'];
/**
 * UI side of setState (per wrapper): 'error' forces the broken-image look
 * (same DOM changes the error event makes); 'default' clears it, restoring
 * the image view. Wrappers without an <img> have nothing to toggle.
 */
function triggerStateChange(wrapper, stateName, _config) {
    const img = wrapper.querySelector('.avatar-image');
    if (!img)
        return;
    switch (stateName) {
        case 'default':
            img.removeAttribute('data-error');
            img.style.display = '';
            break;
        case 'error':
            img.setAttribute('data-error', '');
            img.style.display = 'none';
            break;
    }
}
/** Registry-level API; pass the wrapper explicitly. Unknown names throw. */
export const avatarApi = {
    setState(wrapper, stateName, config = {}) {
        if (!avatarStates.includes(stateName)) {
            throw new Error(`avatar: unknown state "${stateName}" (supported: ${avatarStates.join(', ')})`);
        }
        triggerStateChange(wrapper, stateName, config);
        // state lives on the ELEMENT, not the module (many avatars per page)
        wrapper.dataset.stateName = stateName;
        wrapper._stateConfig = config;
    },
    getState(wrapper) {
        // reflect reality: a network failure flips it without setState()
        const img = wrapper.querySelector('.avatar-image');
        const errored = img ? img.hasAttribute('data-error') : true;
        return {
            name: errored ? 'error' : 'default',
            config: wrapper._stateConfig ?? {},
        };
    },
};
_defussShadcn.avatarApi = avatarApi;
_defussShadcn.avatarStates = avatarStates;
function init() {
    document.querySelectorAll('.avatar:not([data-init])').forEach((wrapper) => {
        wrapper.dataset.init = '';
        // bind-scope the api per avatar: `$('#my-avatar').api.setState('error')`
        wrapper.api = {
            setState: (stateName, config) => avatarApi.setState(wrapper, stateName, config),
            getState: () => avatarApi.getState(wrapper),
        };
        const img = wrapper.querySelector('.avatar-image');
        if (!img)
            return;
        img.dataset.init = '';
        img.addEventListener('error', () => {
            img.setAttribute('data-error', '');
            img.style.display = 'none';
            // network failure also moves the named state (keeps getState honest)
            wrapper.dataset.stateName = 'error';
        });
    });
}
init();
new MutationObserver(init).observe(document, { childList: true, subtree: true });
