---
name: Product Showcase
why: A 5:3 video frame with browser-drawn controls — <video controls> ships play, scrub, keyboard and fullscreen for free.
when: Hero pairing or standalone video/product shot; a static screenshot needs only the <img> variant.
where: dist/components/product-showcase/product-showcase.css
supportedStates: default
---

# Pattern: Product Showcase

## Native basis
`<video controls>` in an `aspect-ratio: 5/3` frame. The UA renders the
play button, scrubber, volume, captions and fullscreen — every affordance
is browser-provided (keyboard included), so the block has no script.
An `<img>` child is styled identically for poster-only use.

---

## Native Web APIs
- [(`<video>`)](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video) — native playback UI + `controls`
- [`poster`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video#poster) — first-paint image before load
- [`<source type>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/source) — codec fallback (webm → mp4)
- [`preload="metadata"`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video#preload) — cheap first paint
- [`aspect-ratio`](https://developer.mozilla.org/en-US/docs/Web/CSS/aspect-ratio) — stable 5:3 box, zero layout shift
- [(`<track>`)](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/track) — captions for real videos

---

## Structure

```html
<figure class="mk-showcase">
  <video controls preload="metadata" playsinline poster="images/poster.png">
    <source src="videos/demo.webm" type="video/webm" />
    <source src="videos/demo.mp4" type="video/mp4" />
    Your browser does not support embedded video.
  </video>
</figure>
```

---

## ARIA

| Attribute    | Element  | Purpose                                     |
|--------------|----------|---------------------------------------------|
| `controls`   | `video`  | Full native keyboard + pointer operation    |
| fallback text| `video`  | Shown when no source plays                  |
| `<track>`    | captions | Required accessibility for real videos      |

---

## Notes
- Ship both webm (VP9/AV1) and mp4 (H.264) `<source>`s — Safari wants mp4, Firefox prefers webm.
- Captions are a hard accessibility requirement for real product videos: add `<track kind="captions" src="captions.vtt" default>`.
- No custom play overlay: an overlaid `<button>` would steal the first click from the native control and re-add all the JS the UA already gives you.
