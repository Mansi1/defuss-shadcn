# Pattern: Select

## Native basis
`<select>` element with custom styling via `appearance: none`.

---

## Native Web APIs
- [`<select>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/select) — native dropdown with keyboard navigation and form integration
- [`<optgroup>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/optgroup) — groups options with a label

---

## Structure

### Basic
```html
<label class="label" for="fruit">Fruit</label>
<select class="select" id="fruit">
  <option value="" disabled selected>Select a fruit</option>
  <option value="apple">Apple</option>
  <option value="banana">Banana</option>
  <option value="cherry">Cherry</option>
</select>
```

### With groups
```html
<select class="select" id="timezone">
  <optgroup label="Americas">
    <option>New York</option>
    <option>Los Angeles</option>
  </optgroup>
  <optgroup label="Europe">
    <option>London</option>
    <option>Paris</option>
  </optgroup>
</select>
```

---

## Accessibility

- Native `<select>` provides full keyboard navigation (arrow keys, type-ahead).
- Use `<label>` with `for` for description.
- Use `disabled` on `<option>` elements for placeholder text.

---

## Sizes

Set `data-size` on the `.select` trigger button.

| Size | Height | Use |
| --- | --- | --- |
| (default) | 2.25rem | Standard forms |
| `sm` | 2rem | Dense toolbars |
| `lg` | 2.75rem | Prominent landing/form fields |

```html
<button class="select" data-size="sm" aria-haspopup="listbox" aria-expanded="false">…</button>
```

## Notes

- Uses `appearance: none` with a custom chevron via `background-image` SVG.
- The dropdown list is rendered by the browser — it cannot be styled.
- For a fully custom dropdown, use the Combobox component instead.
