// -- Alert Dialog ----------------------------------------------
// Wires [data-alert-dialog-trigger] buttons to <dialog class="alert-dialog">.
// Unlike regular dialogs: no backdrop-close, Escape key blocked. Named-state
// API per AGENTS.md "State API" (camelCase alert-dialog → alertDialogApi).

// Shared preamble (AGENTS.md "State API"); build.ts inlines it into the
// shipped .js, so this import never appears in dist/.
import { defussGlobals } from '../../shared/state-api.js';

const _defussShadcn = defussGlobals();

const alertDialogStates = ['default', 'open'];

/**
 * UI side of setState: 'default' closes, 'open' opens modally. Escape and
 * backdrop dismissal stay blocked by the listeners below; closing is
 * programmatic only (close buttons / api).
 */
function triggerStateChange(dialog, stateName, _config) {
  switch (stateName) {
    case 'default':
      if (dialog.open) dialog.close();
      break;
    case 'open':
      if (!dialog.open) dialog.showModal();
      break;
  }
}

/** Registry-level API; pass the dialog element explicitly. Unknown names throw. */
export const alertDialogApi = {
  setState(dialog, stateName, config = {}) {
    if (!alertDialogStates.includes(stateName)) {
      throw new Error(`alert-dialog: unknown state "${stateName}" (supported: ${alertDialogStates.join(', ')})`);
    }
    triggerStateChange(dialog, stateName, config);
    // state lives on the ELEMENT, not the module (multiple dialogs per page)
    dialog.dataset.stateName = stateName;
    dialog._stateConfig = config;
  },
  getState(dialog) {
    return { name: dialog.dataset.stateName || 'default', config: dialog._stateConfig ?? {} };
  },
};

_defussShadcn.alertDialogApi = alertDialogApi;
_defussShadcn.alertDialogStates = alertDialogStates;

function init() {
/* Wire triggers */
document.querySelectorAll('[data-alert-dialog-trigger]:not([data-init])').forEach((trigger) => {
  trigger.dataset.init = '';
  const dialog = document.getElementById(trigger.dataset.alertDialogTrigger);
  if (!dialog) return;
  trigger.addEventListener('click', () => {
    dialog._trigger = trigger;
    dialog.showModal();
  });
});

/* Wire close buttons and block Escape */
document.querySelectorAll('dialog.alert-dialog:not([data-init])').forEach((dialog) => {
  dialog.dataset.init = '';
  // bind-scope the api per instance: `$('#confirm').api.setState('open')`
  dialog.api = {
    setState: (stateName, config) => alertDialogApi.setState(dialog, stateName, config),
    getState: () => alertDialogApi.getState(dialog),
  };
  /* Block Escape key */
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
  });

  /* Wire close buttons */
  dialog.querySelectorAll('[data-alert-dialog-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      dialog.close();
    });
  });

  /* Return focus to trigger */
  dialog.addEventListener('close', () => {
    // reflect the actual UI state: close buttons (the only close path) or
    // setState('default') land the dialog back at 'default'
    dialog.dataset.stateName = 'default';
    if (dialog._trigger) dialog._trigger.focus();
  });
});
}

init();
new MutationObserver(init).observe(document, { childList: true, subtree: true });
