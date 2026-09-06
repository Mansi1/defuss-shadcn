---
name: Product Showcase
why: A 5:3 media frame with a play affordance — aspect-ratio + one absolutely-centered real button, nothing else.
when: Standalone product shot/video poster inside any marketing section; reuse of the Hero's media block.
where: dist/components/product-showcase/product-showcase.css
supportedStates: default
---

# Pattern: Product Showcase

## Native basis
`<figure>` + `aspect-ratio` + a real `<button>`. No script, no wrapper divs.

---

## Native Web APIs
- [(`<figure>`)](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/figure) — self-contained media unit
- [`aspect-ratio`](https://developer.mozilla.org/en-US/docs/Web/CSS/aspect-ratio) — stable 5:3 box, zero layout shift
- [`object-fit`](https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit) — cover-crop without cropping the button layer

---

## Structure

```html
<figure class="mk-showcase">
  <img src="images/mk-wide.png" alt="Product dashboard preview" />
  <button class="mk-showcase-play" aria-label="Play video">
    <i data-lucide="play"></i>
  </button>
</figure>
```

---

## ARIA

| Attribute    | Element        | Purpose                     |
|--------------|----------------|-----------------------------|
| `aria-label` | play button    | Names the icon-only control |
| `alt`        | `img`          | Describes the shot          |

---

## Notes
- Same play-button pattern as [Hero](../hero/component-skill.md); use this one when the block stands alone (no headline/copy).
- On click, open the video in a [Dialog](../dialog/component-skill.md) — the block intentionally ships no behavior.
- Set `alt=""` and drop `aria-label` only when the shot is purely decorative (rare for product shots).
