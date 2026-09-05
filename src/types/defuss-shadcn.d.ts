// Why: ambient types for the State API globals that the shared preamble helper
// (src/shared/state-api.ts) puts on globalThis. Kept as a global script (no
// imports/exports) so the interfaces below are ambient and usable from any
// component source. Contract: AGENTS.md "State API".

/** Per-instance bound API: `document.querySelector('#x').api.setState('open')`. */
interface DefussShadcnComponentApi {
  setState(stateName: string, config?: Record<string, unknown>): void;
  getState(): DefussShadcnComponentState;
}

interface DefussShadcnComponentState {
  /** Declared state name ('default' unless setState() was called). */
  name: string;
  /** Free-form config passed to setState(); components may ignore it. */
  config: Record<string, unknown>;
}

/** Registry populated by components: `_defussShadcn.dialogApi`, `_defussShadcn.dialogStates`, … */
interface DefussShadcnRegistry {
  [key: `${string}Api`]: DefussShadcnComponentApi | undefined;
  [key: `${string}States`]: readonly string[] | undefined;
  [key: string]: unknown;
}

/** `document.querySelector` alias — defined once, by the shared preamble helper. */
declare var $: typeof document.querySelector;
declare var _defussShadcn: DefussShadcnRegistry;

interface HTMLElement {
  /** Present on elements whose component bound the state API. */
  api?: DefussShadcnComponentApi;
  /** Config from the last setState() call (state name lives in dataset.stateName). */
  _stateConfig?: Record<string, unknown>;
  /** Accordion-only: authored open flags snapshotted at init, for the 'default' state. */
  _defaultOpen?: boolean[];
  /** Accordion-only: set while triggerStateChange() is applying (suspends enforcement). */
  _applying?: boolean;
  /** Accordion-only: generation counter so queued toggle events can't clear a newer _applying. */
  _applyGen?: number;
}

interface HTMLDialogElement {
  /** Trigger to refocus when the dialog closes (set by dialog.js). */
  _trigger?: HTMLElement | null;
}
