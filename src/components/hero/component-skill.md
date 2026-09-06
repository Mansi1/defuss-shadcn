---
name: Hero
why: Headline, description, CTAs and a 5:3 showcase — all native flow layout, aspect-ratio and a real <button> for play.
when: First section of a marketing page; not for app screens or dashboards.
where: dist/components/hero/hero.css
supportedStates: default
---

# Pattern: Hero

## Native basis
Plain sectioning content; the showcase uses `aspect-ratio` (no
padding-bottom hack) and the play control is a real `<button>` with
`aria-label` — focusable and announced by default.

---

## Native Web APIs
- [`aspect-ratio`](https://developer.mozilla.org/en-US/docs/Web/CSS/aspect-ratio) — intrinsic 5:3 media frame
- [`text-wrap: balance`](https://developer.mozilla.org/en-US/docs/Web/CSS/text-wrap) — optical headline balancing
- [`object-fit`](https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit) — cover-crop showcase image
- [Container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries) — size steps follow the container
- Individual transform [`scale`](https://developer.mozilla.org/en-US/docs/Web/CSS/scale) — play-button hover, no transform strings

---

## Structure

```html
<section class="mk-hero">
  <div class="mk-hero-copy">
    <span class="mk-hero-badge">New features released</span>
    <h1 class="mk-hero-title">Make Better Decisions, With Ease</h1>
    <p class="mk-hero-desc">Your personal AI helps you cut through the noise.</p>
    <div class="mk-hero-actions">
      <button class="btn">Get Started</button>
    </div>
  </div>
  <figure class="mk-hero-media">
    <img src="images/mk-wide.png" alt="Product showcase" />
    <button class="mk-hero-play" aria-label="Play video">
      <i data-lucide="play"></i>
    </button>
  </figure>
</section>
```

CTAs compose the [Button](../button/component-skill.md) component.

---

## ARIA

| Attribute    | Element          | Purpose                        |
|--------------|------------------|--------------------------------|
| `aria-label` | play button      | Names the icon-only control    |
| `alt`        | showcase `img`   | Describes the screenshot       |
| `<figure>`   | media wrapper    | Associates image with caption  |

---

## Notes
- The play button centers via `position: absolute; inset: 0; margin: auto` — no transforms or JS.
- Wire the play button to open a [Dialog](../dialog/component-skill.md) with a `<video controls>`; the block itself stays behavior-free.
- One `<h1>` per page: keep the hero title as `<h1>`, all other section titles as `<h2>`.
