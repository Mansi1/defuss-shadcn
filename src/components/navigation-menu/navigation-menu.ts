// -- Navigation Menu -----------------------------------------
// CSS anchor positioning for dropdown navigation menus, plus the named-state
// API so agents/tests can drive menus open/closed by name (AGENTS.md
// "State API").

// Shared preamble (AGENTS.md "State API"); build.ts inlines it into the
// shipped .js, so this import never appears in dist/.
import { defussGlobals, safeShowPopover } from '../../shared/state-api.js';

const _defussShadcn = defussGlobals();

const navigationMenuStates = ['default', 'open'];

/**
 * UI side of setState: 'default' hides, 'open' shows. Open/close mechanics
 * stay native (Popover API via popovertarget on the trigger).
 */
function triggerStateChange(content, stateName, _config) {
  switch (stateName) {
    case 'default':
      try { content.hidePopover(); } catch { /* already closed */ }
      break;
    case 'open':
      // deferred show (safeShowPopover): calling showPopover() on an element
      // mid-its-own exit animation — e.g. just light-dismissed by a sibling
      // trigger's click — crashed the headless renderer. Sibling exclusion
      // stays native via popover="auto".
      safeShowPopover(content);
      break;
  }
}

/** Registry-level API; pass the content element explicitly. Unknown names throw. */
export const navigationMenuApi = {
  setState(content, stateName, config = {}) {
    if (!navigationMenuStates.includes(stateName)) {
      throw new Error(`navigation-menu: unknown state "${stateName}" (supported: ${navigationMenuStates.join(', ')})`);
    }
    triggerStateChange(content, stateName, config);
    // state lives on the ELEMENT, not the module (multiple menus per page)
    content.dataset.stateName = stateName;
    content._stateConfig = config;
  },
  getState(content) {
    return { name: content.dataset.stateName || 'default', config: content._stateConfig ?? {} };
  },
};

_defussShadcn.navigationMenuApi = navigationMenuApi;
_defussShadcn.navigationMenuStates = navigationMenuStates;

function init() {
  document.querySelectorAll('.nav-menu:not([data-init])').forEach((nav) => {
  nav.dataset.init = '';
  nav.querySelectorAll('.nav-menu-trigger[popovertarget]').forEach((trigger) => {
    const id = trigger.getAttribute('popovertarget');
    const content = document.getElementById(id);
    if (!content) return;

    // CSS anchor positioning - unique name per trigger-content pair
    const anchorId = `--nav-menu-${id}`;
    trigger.style.anchorName = anchorId;
    content.style.positionAnchor = anchorId;
  });

  // bind-scope the api per content element: `$('#nav-products').api.setState('open')`
  document.querySelectorAll('.nav-menu-content[popover]:not([data-init])').forEach((content) => {
    content.dataset.init = '';
    content.api = {
      setState: (stateName, config) => navigationMenuApi.setState(content, stateName, config),
      getState: () => navigationMenuApi.getState(content),
    };
  });
});
}

init();
new MutationObserver(init).observe(document, { childList: true, subtree: true });
