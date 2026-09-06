import { cssSmoke } from './lib/css-smoke.ts';

/**
 * Why: date-picker is CSS-only (a styled native <input type="date">) —
 * verify the 40px control box and disabled dimming. The calendar indicator
 * is UA shadow-DOM and intentionally not asserted.
 */
await cssSmoke('date-picker', [
  {
    label: '.date-input is a 40px control with 12px inline padding',
    selector: '#dp-default',
    css: { height: '40px', padding: '0px 12px', 'font-size': '14px', 'border-top-width': '1px', cursor: 'pointer' },
  },
  {
    label: 'disabled dims to 0.5 with not-allowed',
    selector: '#dp-disabled',
    css: { opacity: '0.5', cursor: 'not-allowed' },
  },
]);
