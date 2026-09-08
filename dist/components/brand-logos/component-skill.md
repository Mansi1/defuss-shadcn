---
name: Brand Logos
type: BLK
why: Logos as currentColor SVGs recolor with the theme automatically — a row of marks needs zero behavior.
when: "Trusted by" social proof band under a Hero — not for user-uploaded arbitrary images.
where: dist/components/brand-logos/brand-logos.css
supportedStates: default
---

# Pattern: Brand Logos

## Native basis
A flex-wrap row of inline SVGs. `currentColor` makes every mark follow
`--foreground` — black in light mode, white in dark (the tokens flip) — so
logos read at full theme ink; the row is softened with `opacity` instead of
a muted color, and the name text stays `--muted-foreground`.

---

## Native Web APIs
- [Inline `<svg>`](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/svg) — vector marks that inherit text color
- [`currentColor`](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/currentcolor) — one color source for all logos
- [`flex-wrap`](https://developer.mozilla.org/en-US/docs/Web/CSS/flex-wrap) — graceful wrapping without breakpoints

---

## Structure

```html
<section class="mk-logos">
  <div class="mk-logos-row">
    <span class="mk-logo">
      <svg viewBox="0 0 40 40" fill="currentColor" aria-hidden="true"><!-- path --></svg>
      <span class="mk-logo-name">Logoipsum</span>
    </span>
    <span class="mk-logo">
      <svg viewBox="0 0 40 40" fill="currentColor" aria-hidden="true"><!-- path --></svg>
      <span class="mk-logo-name">Logoipsum</span>
    </span>
  </div>
  <p class="mk-logos-caption">Trusted by leading companies</p>
</section>
```

---

## ARIA

| Attribute       | Element    | Purpose                                       |
|-----------------|------------|-----------------------------------------------|
| `aria-hidden`   | `svg`      | Mark is decorative; the name text conveys it  |
| visible text    | logo name  | Screen readers read real text, never alt      |

---

## Notes
- Use brand SVGs with `fill="currentColor"` (or set `fill` per brand and keep `color` for name) — never screenshot-rasterized logos on the muted layer.
- If the row is purely decorative proof (names also listed elsewhere), `aria-hidden="true"` on the whole row is acceptable.
- 3–6 logos reads as social proof; more dilutes it and forces wrapping.
