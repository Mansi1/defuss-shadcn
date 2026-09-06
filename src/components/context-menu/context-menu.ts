// -- Context Menu ---------------------------------------------
// Right-click context menu using the Popover API, plus the named-state
// API bound per menu popover, so agents/tests can open it without a real
// right-click (AGENTS.md "State API").

// Shared preamble (AGENTS.md "State API"); build.ts inlines it into the
// shipped .js, so this import never appears in dist/.
import { defussGlobals, safeShowPopover } from '../../shared/state-api.js';

const _defussShadcn = defussGlobals();

const contextMenuStates = ['default', 'open'];

/**
 * UI side of setState (per menu popover): 'open' shows the menu at { x, y }
 * (falling back to the top-left of the viewport — there is no pointer event
 * to anchor to); 'default' hides it.
 */
function triggerStateChange(menu, stateName, config) {
  switch (stateName) {
    case 'default':
      menu.hidePopover();
      break;
    case 'open': {
      const x = Number(config?.x ?? 8);
      const y = Number(config?.y ?? 8);
      menu.style.position = 'fixed';
      menu.style.top = `${y}px`;
      menu.style.left = `${x}px`;
      // deferred show: showPopover() while a previous exit transition is
      // still running crashes the headless renderer (setState after Escape)
      safeShowPopover(menu);
      break;
    }
  }
}

/** Registry-level API; pass the menu popover explicitly. Unknown names throw. */
export const contextMenuApi = {
  setState(menu, stateName, config = {}) {
    if (!contextMenuStates.includes(stateName)) {
      throw new Error(`context-menu: unknown state "${stateName}" (supported: ${contextMenuStates.join(', ')})`);
    }
    triggerStateChange(menu, stateName, config);
    // state lives on the ELEMENT, not the module (many menus per page)
    menu.dataset.stateName = stateName;
    menu._stateConfig = config;
  },
  getState(menu) {
    // reflect reality: right-clicks and item clicks change the UI too
    return {
      name: menu.matches(':popover-open') ? 'open' : 'default',
      config: menu._stateConfig ?? {},
    };
  },
};

_defussShadcn.contextMenuApi = contextMenuApi;
_defussShadcn.contextMenuStates = contextMenuStates;

function init() {
  document.querySelectorAll('[data-context-menu]:not([data-init])').forEach((trigger) => {
  trigger.dataset.init = '';
  const menu = document.getElementById(trigger.dataset.contextMenu);
  if (!menu) return;
  // bind-scope the api per menu popover: `$('#my-ctx').api.setState('open', { x: 40, y: 40 })`
  menu.api = {
    setState: (stateName, config) => contextMenuApi.setState(menu, stateName, config),
    getState: () => contextMenuApi.getState(menu),
  };
  trigger.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    menu.style.position = 'fixed';
    menu.style.top = `${e.clientY}px`;
    menu.style.left = `${e.clientX}px`;
    // showPopover() INSIDE the contextmenu event is instantly light-dismissed
    // by the platform's own context-menu gesture (auto popover); deferring a
    // frame lets the gesture finish first (rAF-then-show verified empirically)
    requestAnimationFrame(() => safeShowPopover(menu));
    menu.dataset.stateName = 'open';
  });
  menu.addEventListener('click', (e) => {
    if (e.target.closest('.context-menu-item')) {
      menu.hidePopover();
      menu.dataset.stateName = 'default';
    }
  });
  // right out of the top layer via Escape: keep the named state honest
  menu.addEventListener('toggle', (e) => {
    if (e.newState === 'closed') menu.dataset.stateName = 'default';
  });
});
}

init();
new MutationObserver(init).observe(document, { childList: true, subtree: true });
