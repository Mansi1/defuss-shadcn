---
name: Color Picker
type: ATM
why: Native <input type=color> plus a swatch popover — the browser owns the picking itself.
when: A form field where the user chooses a color; use the bare native input when a popover is overkill.
where: dist/components/color-picker/color-picker.css + dist/components/color-picker/color-picker.js
supportedStates: default
---

# Pattern: Color Picker

## Native basis
`<input type="color">` element with label.

---

## Native Web APIs
- [`<input type="color">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/color) — native color picker dialog

---

## Structure

```html
<label class="label" for="bg-color">Background Color</label>
<div class="color-picker">
  <input type="color" id="bg-color" value="#6366f1">
  <span class="color-picker-value">#6366f1</span>
</div>
```

---

## States

The picker's observable state is the chosen color. Declared states:
`default` (`{ value }` presets the hex through the native input, events
fire). `getState().config.value` reports the live hex.

```js
document.querySelector('#theme-color').api.setState('default', { value: '#ff0000' });
document.querySelector('#theme-color').api.getState(); // { name: 'default', config: { value: '#ff0000' } }
```

The api is bound per wrapper; the registry global is
`_defussShadcn.colorPickerApi` / `_defussShadcn.colorPickerStates` (camelCase).

## Notes

- The native color picker renders a full-featured dialog — no JS needed.
- The wrapper adds a styled border and displays the current hex value.
- The color swatch is provided by the browser's native `<input type="color">`.
