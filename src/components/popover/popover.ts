// -- Popover --------------------------------------------------
// CSS anchor positioning for popover components, plus the named-state API
// so agents/tests can drive open/closed by name (AGENTS.md "State API").

// Shared preamble (AGENTS.md "State API"); build.ts inlines it into the
// shipped .js, so this import never appears in dist/.
import { defussGlobals, safeShowPopover } from '../../shared/state-api.js';

const _defussShadcn = defussGlobals();

const popoverStates = ['default', 'open'];

/**
 * UI side of setState: 'default' hides, 'open' shows. Open/close mechanics
 * stay native (Popover API); this only dispatches to show/hidePopover().
 */
function triggerStateChange(popover, stateName, _config) {
  switch (stateName) {
    case 'default':
      try { popover.hidePopover(); } catch { /* already closed */ }
      break;
    case 'open':
      // deferred show (safeShowPopover): showPopover() mid-exit (right after
      // light dismiss) crashes the headless renderer; exclusion stays native.
      safeShowPopover(popover);
      break;
  }
}

/** Registry-level API; pass the popover element explicitly. Unknown names throw. */
export const popoverApi = {
  setState(popover, stateName, config = {}) {
    if (!popoverStates.includes(stateName)) {
      throw new Error(`popover: unknown state "${stateName}" (supported: ${popoverStates.join(', ')})`);
    }
    triggerStateChange(popover, stateName, config);
    // state lives on the ELEMENT, not the module (multiple popovers per page)
    popover.dataset.stateName = stateName;
    popover._stateConfig = config;
  },
  getState(popover) {
    return { name: popover.dataset.stateName || 'default', config: popover._stateConfig ?? {} };
  },
};

_defussShadcn.popoverApi = popoverApi;
_defussShadcn.popoverStates = popoverStates;

function init() {
  document.querySelectorAll('[popovertarget]:not([data-init])').forEach((trigger) => {
    trigger.dataset.init = '';
    const id = trigger.getAttribute('popovertarget');
    const popover = document.getElementById(id);
    if (!popover || !popover.classList.contains('popover')) return;

    // CSS anchor positioning - unique name per trigger-popover pair
    const anchorId = `--popover-${id}`;
    trigger.style.anchorName = anchorId;
    popover.style.positionAnchor = anchorId;
  });

  // bind-scope the api per popover instance: `$('#demo').api.setState('open')`
  document.querySelectorAll('.popover[popover]:not([data-init])').forEach((popover) => {
    popover.dataset.init = '';
    popover.api = {
      setState: (stateName, config) => popoverApi.setState(popover, stateName, config),
      getState: () => popoverApi.getState(popover),
    };
  });
}

init();
new MutationObserver(init).observe(document, { childList: true, subtree: true });
