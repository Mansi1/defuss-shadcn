---
name: Site Header
why: A marketing page header is pure layout — flexbox + a container query replace any JS show/hide of the nav.
when: Top of a marketing/landing page — for the doc site's own chrome use <site-header> instead.
where: dist/components/site-header/site-header.css
supportedStates: default
---

# Pattern: Site Header

## Native basis
`<header>` landmark with `<nav>`; no script. The nav collapses via a
container query (`@container`), so the block adapts to the width it is
placed in, not the viewport.

---

## Native Web APIs
- [`<header>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/header) — banner landmark
- [`<nav>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/nav) — navigation landmark with `aria-label`
- [`position: sticky`](https://developer.mozilla.org/en-US/docs/Web/CSS/position#sticky_positioning) — opt-in sticky header, no scroll JS
- [Container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries) — width-aware nav collapse
- [`:focus-visible`](https://developer.mozilla.org/en-US/docs/Web/CSS/:focus-visible) — keyboard-only focus rings

---

## Structure

```html
<header class="mk-header">
  <div class="mk-header-inner">
    <a href="#" class="mk-header-brand">
      <i data-lucide="zap"></i>
      <span class="mk-header-name">Acme Inc.</span>
    </a>
    <nav class="mk-header-nav" aria-label="Main">
      <a href="#" class="mk-header-link">Products</a>
      <a href="#" class="mk-header-link">Solutions</a>
    </nav>
    <div class="mk-header-actions">
      <button class="btn" data-variant="ghost" data-size="sm">Login</button>
      <button class="btn" data-size="sm">Get started</button>
    </div>
  </div>
</header>
```

Actions compose the [Button](../button/component-skill.md) component.

---

## Variants

| `data-variant` | Purpose                                        |
|----------------|------------------------------------------------|
| `sticky`       | Header sticks to the top on scroll (opt-in)    |

---

## ARIA

| Attribute        | Element | Purpose                          |
|------------------|---------|----------------------------------|
| `aria-label`     | `nav`   | Names the navigation region      |
| native `:focus`  | links   | Keyboard traversal, no JS needed |

---

## Notes
- Icons render via lucide (`<i data-lucide="…">` + `lucide.createIcons()`); an inline `<svg>` works identically with zero dependencies.
- `.mk-header-nav` is hidden below a 48rem **container** width — put the header in a wide container to see the links.
- The nav is links, not `<button>`s — a link that navigates is a link.
