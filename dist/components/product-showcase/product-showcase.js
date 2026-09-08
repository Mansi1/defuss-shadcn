// -- Product Showcase ----------------------------------------
// A poster frame with a circular play button; clicking it swaps to the
// native <video> (which then carries its own controls). No custom player
// chrome — the browser draws everything once the video is visible.
// State API per AGENTS.md: 'default' (poster) | 'playing' (video).
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
const productShowcaseStates = ['default', 'playing'];
/**
 * UI side of setState: the only function touching the DOM for a state
 * change. 'playing' hides the poster/play button (CSS, via data-state) and
 * starts playback; 'default' pauses and rewinds so the poster returns.
 */
function triggerStateChange(showcase, stateName, _config) {
    const video = showcase.querySelector('video');
    switch (stateName) {
        case 'default':
            if (video) {
                video.pause();
                video.currentTime = 0;
            }
            showcase.dataset.state = 'default';
            break;
        case 'playing':
            showcase.dataset.state = 'playing';
            // muted: playback must never be blocked (or blast audio) when a
            // screenshot/agent drives setState without a user gesture
            if (video) {
                video.muted = true;
                video.play().catch(() => { });
            }
            break;
    }
}
/** Registry-level API; pass the showcase element explicitly. Unknown names throw. */
export const productShowcaseApi = {
    setState(showcase, stateName, config = {}) {
        if (!productShowcaseStates.includes(stateName)) {
            throw new Error(`product-showcase: unknown state "${stateName}" (supported: ${productShowcaseStates.join(', ')})`);
        }
        triggerStateChange(showcase, stateName, config);
        // state lives on the ELEMENT, not the module (multiple showcases per page)
        showcase.dataset.stateName = stateName;
        showcase._stateConfig = config;
    },
    getState(showcase) {
        // reflect reality: a user pausing the native controls returns to the poster
        const playing = showcase.dataset.state === 'playing';
        return {
            name: showcase.dataset.stateName || (playing ? 'playing' : 'default'),
            config: showcase._stateConfig ?? {},
        };
    },
};
_defussShadcn.productShowcaseApi = productShowcaseApi;
_defussShadcn.productShowcaseStates = productShowcaseStates;
function init() {
    document.querySelectorAll('.mk-showcase:not([data-init])').forEach((showcase) => {
        showcase.dataset.init = '';
        showcase.dataset.state = 'default';
        // bind-scope the api per instance: `$('#showcase').api.setState('playing')`
        showcase.api = {
            setState: (stateName, config) => productShowcaseApi.setState(showcase, stateName, config),
            getState: () => productShowcaseApi.getState(showcase),
        };
        showcase.querySelector('.mk-showcase-play')?.addEventListener('click', () => {
            productShowcaseApi.setState(showcase, 'playing');
        });
        // native pause/ended returns to the poster: route it through the API so
        // the visible state and getState() never diverge (pause covers `ended` too)
        showcase.querySelector('video')?.addEventListener('pause', () => {
            if (showcase.dataset.state === 'playing')
                productShowcaseApi.setState(showcase, 'default');
        });
    });
}
init();
new MutationObserver(init).observe(document, { childList: true, subtree: true });
//# sourceMappingURL=product-showcase.js.map