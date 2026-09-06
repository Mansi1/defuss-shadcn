---
name: Number Input
why: Input plus stepper buttons bound to native min/max/step and arrow-key behavior.
when: Numeric values where nudging or a bounded range matters — quantity, price.
where: dist/components/number-input/number-input.css + dist/components/number-input/number-input.js
supportedStates: default
---

# Pattern: Number Input

## Native basis
`<input type="number">` with custom increment/decrement buttons.

---

## Native Web APIs
- [`<input type="number">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/number) — native number input with built-in validation and step increment

---

## Structure

```html
<label class="label" for="quantity">Quantity</label>
<input class="input" type="number" id="quantity" min="0" max="100" step="1" value="1">
```

---

## States

The component's observable state is the number itself. Declared states:
`default` (enabled; `{ value }` presets it through the native input, events
fire). `getState().config.value` reports the live value.

```js
document.querySelector('#qty').api.setState('default', { value: 5 });
document.querySelector('#qty').api.getState(); // { name: 'default', config: { value: '5' } }
```

The api is bound per wrapper; the registry global is
`_defussShadcn.numberInputApi` / `_defussShadcn.numberInputStates` (camelCase).

## Notes

- Reuses the `.input` class for consistent styling.
- Native spinner buttons are hidden with `::-webkit-inner-spin-button`.
- Use `min`, `max`, and `step` for range constraints.
- Keyboard: arrow keys increment/decrement by step value.
