# defuss-shadcn — Maintainer Instructions

You are working on the **defuss-shadcn** design system repo.
The consumer-facing system lives in `dist/` — **it is generated**: edit sources in
`src/` (`bun run build` compiles `.ts` → `.js` and copies everything else 1:1).
Never edit `dist/` directly; it is deleted and rebuilt on every build.

---

## Project structure

```
defuss-shadcn/
├── dist/                              ← the distributable (drop into any project)
│   ├── theme/default-semantic-tokens.css      ← design tokens (source of truth for colors, radius, shadows)
│   ├── components/                    ← self-contained component folders
│   │   └── {name}/
│   │       ├── component-skill.md      ← component skill (HTML structure & ARIA reference)
│   │       ├── {name}.css             ← component stylesheet (edit directly)
│   │       └── {name}.js              ← interaction JS (only for interactive components)
│   └── documentation/                 ← reference implementations + public website
│       ├── *.html                     ← one page per component + overview pages
│       ├── css/docs-utilities.css    ← hand-written utility classes for doc pages
│       ├── css/docs-theme.css         ← doc-site font overrides (not part of the system)
│       ├── css/layout.css             ← doc-site layout (not part of the system)
│       ├── js/layout.js               ← SPA router, <site-header>/<site-nav> web components
│       ├── js/site.js                 ← doc-site-only JS (tabs, copy buttons, skill modal, code collapse)
│       ├── js/shiki-highlight.js      ← Shiki-based syntax highlighting (ES module, CDN)
│       ├── js/themes.js               ← tweakcn color theme presets (global THEMES array)
│       └── js/theme-switcher.js       ← applies theme overrides to CSS custom properties
│
├── .github/
│   ├── instructions/                  ← auto-attached instruction files for Copilot
│   │   ├── documentation.instructions.md
│   │   ├── specifications.instructions.md
│   │   └── tokens.instructions.md
│   └── prompts/                       ← reusable prompt files
│       └── component-review.prompt.md
│
├── scripts/                           ← build & maintenance scripts (no one-shot migrations)
│   ├── build.ts                       ← src/ → dist/ (tsc type-strip + copy everything else 1:1)
│   ├── sync-css-snippets.ts           ← re-embed component CSS into doc pages after edits
│   ├── sync-js-snippets.ts            ← re-embed component JS into doc pages after edits
│   ├── audit-utilities.ts             ← find utility-shaped classes missing from docs-utilities.css
│   ├── push.sh                        ← commit + push dev → main (non-release)
│   └── deploy.sh                      ← release: version bump, changelog, tag, GitHub release
├── tests/                             ← UI tests (Vitest browser mode + Playwright)
│   ├── helpers.js                     ← loads real doc pages in a same-origin iframe
│   ├── ui.test.js                     ← end-to-end tests of the actual site UI
│   └── e2e/                           ← per-component smoke tests (plain Playwright)
│       ├── run.mjs                    ← `bun run e2e` runner: every *.e2e.mjs file
│       ├── server.mjs                 ← Bun static server exposing /dist and /tests/e2e
│       └── accordion.e2e-{fixture.html,mjs}  ← fixture + test for one component
├── vitest.config.mjs                  ← browser-mode test config (root = repo root)
├── Makefile                           ← setup / dev / test / e2e shortcuts (wrappers for bun scripts)
│
└── AGENTS.md                          ← this file (maintainer instructions)
```

---

## Critical rules

### Native web platform first

Every component starts from a native HTML element or browser API. If the browser
can do it, we don't write JavaScript for it.

**HTML elements & attributes**

- Use `<dialog>` for modals — not divs with JS show/hide
- Use `popover` API for dropdowns, tooltips, toasts — not JS positioning
- Use `popover="hint"` for tooltips — not `popover="auto"` (hints don't
  close other popovers)
- Use `<details>/<summary>` for accordions — not JS toggle logic
- Use `<details name="group">` for exclusive (single-open) accordions — not
  JS that closes siblings
- Use `commandfor` / `command` attributes for declarative button→dialog/popover
  triggers — not JS click handlers that call `showModal()` or `togglePopover()`
- Use `<progress>` for completion indicators — not div-based progress bars
- Use `<meter>` for scalar values in a range — not custom gauge components
- Use `<output>` for computed/live results — not manual `aria-live` regions
- Use `inert` attribute to disable interaction on background content — not
  JS focus traps or `aria-hidden` toggling
- Use `loading="lazy"` for images/iframes — not JS lazy load libraries
- Use `autofocus` in dialogs/popovers — not JS `.focus()` calls
- Use `inputmode` for mobile keyboard hints — not separate input types
- Use `enterkeyhint` for mobile Enter key labels (`search`, `send`, `go`)
- Use `autocomplete` with proper field names — not custom autofill
- Use `<datalist>` for native type-ahead suggestions — not custom dropdowns
- Use `fetchpriority` for resource priority hints (`high`/`low`)
- Use `disabled` / `readonly` for native form states — not JS class toggling

**CSS**

- Use `@starting-style` + `transition-behavior: allow-discrete` for
  enter/exit animations on `display: none` elements — not JS class toggling
- Use CSS anchor positioning for popover placement — not Floating UI / Popper
- Use `::backdrop` + `backdrop-filter` for dialog/sheet overlays — not
  JS-managed overlay divs or canvas blur
- Use `:has()` for parent-state reactions — not JS class propagation
- Use `:focus-visible` for keyboard-only focus rings — not JS focus detection
- Use `:user-valid` / `:user-invalid` for post-interaction validation
  styling — not JS blur listeners with class toggling
- Use `field-sizing: content` for auto-growing textareas — not JS resize
- Use `oklch()` and relative color syntax for wide-gamut, derived colors — not
  hardcoded hex/hsl palettes
- Use `color-mix(in oklch, ...)` for hover/disabled color derivation — not
  Sass `darken()`/`lighten()` or hardcoded variants
- Use `light-dark()` for inline dark mode values — not media queries or
  class toggles when `color-scheme` is already set
- Use `color-scheme` property for dark mode browser defaults — not all-manual
  dark overrides on every native element
- Use `accent-color` for theming native form controls — not custom replacements
- Use `text-wrap: balance` for headings and labels — not JS text-balancing
- Use `text-wrap: pretty` for body text orphan prevention — not manual `&nbsp;`
- Use `overscroll-behavior: contain` on scroll containers inside overlays — not
  JS scroll-lock libraries
- Use `scroll-snap` for carousel/slider snap points — not JS snap calculations
- Use `scrollbar-gutter: stable` to prevent layout shift from scrollbars — not
  padding hacks
- Use individual transform properties (`rotate`, `scale`, `translate`) — not
  compound `transform` strings
- Use CSS nesting, `@layer`, container queries — not preprocessors
- Use `aspect-ratio` for intrinsic ratios — not padding-bottom hacks
- Use `content-visibility` for expand/collapse transitions — not JS lazy rendering
- Use `interpolate-size: allow-keywords` for animating to `auto` height — not
  JS measurement or `max-height` hacks
- Use `@property` for typed, animatable custom properties — not JS animation
  of CSS values
- Use scroll-driven animations (`animation-timeline: scroll()` / `view()`) for
  scroll-linked effects — not scroll listeners or IntersectionObserver
- Use View Transitions API for smooth DOM state changes — not JS crossfades
- Use `@supports` for CSS feature detection — not Modernizr or JS detection
- Use logical properties (`margin-inline`, `padding-block`) for RTL support — not
  separate LTR/RTL stylesheets
- Use subgrid for aligned child layouts — not manually synchronized columns
- Use dynamic viewport units (`dvh`, `svh`, `lvh`) — not JS `innerHeight` hacks
- Use CSS math functions (`clamp()`, `min()`, `max()`) for responsive sizing — not
  JS resize calculations
- Use `:is()` / `:where()` for selector grouping — not repeated selectors
- Use `hanging-punctuation` for optical quote alignment — not negative text-indent
- Use `@layer` + descriptive prefixed class names (`card-header`, `slider-track`) for
  style scoping — not `@scope` (generic class names lose context for AI generation)
  or Shadow DOM
- Use `@media (scripting)` for no-JS progressive enhancement — not `<noscript>` alone

**Accessibility (REQUIRED)**

- Use `prefers-reduced-motion: reduce` to suppress/simplify all animations — not
  ignoring motion preferences (this is an accessibility requirement, not optional)
- Use `prefers-contrast: more` to increase contrast when requested
- Use `forced-colors: active` to support Windows High Contrast Mode with system colors
- Use `prefers-color-scheme` for automatic dark mode defaults

**JavaScript (only when HTML/CSS cannot express it)**

- Use Web Animations API (`el.animate()`) for imperative animations — not CSS
  class toggling when JS needs to coordinate timing
- Use `Intl` APIs (`DateTimeFormat`, `NumberFormat`, `RelativeTimeFormat`,
  `ListFormat`) for locale-aware formatting — not moment.js or date-fns
- Use native Drag and Drop API for reordering — not SortableJS or drag libraries
- Use `CustomEvent` for component-to-component communication — not framework
  event systems
- Use `element.checkVisibility()` for visibility detection — not manual
  offset calculations
- Use `IntersectionObserver` for viewport-entry detection — not scroll listeners
  with `getBoundingClientRect()`
- Use `ResizeObserver` for element size changes — not window resize listeners
- Use `MutationObserver` for DOM change reactions — not polling loops
- Use `navigator.clipboard` for clipboard access — not `document.execCommand('copy')`
- Use `CloseWatcher` for platform close signals in custom UI — not manual
  Escape key listeners
- Use `AbortController` for canceling fetches/listeners — not boolean flags
- Use `FormData` for form serialization — not manual value collection loops
- Use `structuredClone()` for deep cloning — not `JSON.parse(JSON.stringify())`
- Use `ElementInternals` for custom form elements — not hidden input proxies
- Use Navigation API for SPA routing — not History API hacks

JavaScript is only for behavior that HTML and CSS cannot express: keyboard
navigation patterns, focus management, and state coordination between elements.
Use modern ECMAScript (ES modules, arrow functions, `const`/`let`, etc.) —
no libraries, no frameworks.

All `querySelectorAll` loops that add event listeners **must** guard against
double-initialization using `:not([data-init])` in the selector and setting
`element.dataset.init = ''` as the first line inside the loop.

Component JS files wrap initialization in an `init()` function, call it once,
then use a `MutationObserver` to auto-initialize new elements after SPA
navigation or dynamic DOM changes:

```js
function init() {
  document.querySelectorAll('.my-component:not([data-init])').forEach((el) => {
    el.dataset.init = '';
    el.addEventListener('click', () => { /* … */ });
  });
}

init();
new MutationObserver(init).observe(document, { childList: true, subtree: true });
```

For document-level event delegation (no per-element loop), use a global flag:
```js
if (!document.__myComponentInit) {
  document.__myComponentInit = true;
  document.addEventListener('click', (e) => { /* … */ });
}
```

### Each component is a self-contained folder

Each component at `dist/components/{name}/` contains:
- `component-skill.md` — component skill: HTML structure, attributes, ARIA, and usage notes
- `{name}.css` — the component stylesheet (edit directly)
- `{name}.js` — interaction JS (only for interactive components, edit directly)

The component skill `.md` file documents **how to build the HTML**. The `.css` and `.js` files
are the actual implementation — edit them directly, no build step needed.

### Tokens are the source of truth for design values

`dist/theme/default-semantic-tokens.css` defines all CSS custom properties. These must match
the shape of tweakcn.com theme exports so themes are drop-in compatible.

The token file provides:
- Color pairs (surface + foreground) for light and dark modes
- `--radius` (base) — derived values (`--radius-sm/md/lg/xl`) are computed in the token file
- Shadow scale and composition tokens
- Font stacks (generic — overridden by doc site)
- Spacing and tracking

#### Tokens & Theme

##### Token boundary rule (CRITICAL)

**Components must only use the tokens that exist in the TweakCN export shape.**

- `default-semantic-tokens.css` defines the complete set of available CSS custom properties.
- No new custom properties may be added to `default-semantic-tokens.css` beyond what TweakCN provides.
- Components CSS (`dist/components/{name}/{name}.css`)
  must reference only these tokens via `var(--*)`.
- If a component needs a color that has no token (e.g., status colors like
  green/amber/blue), use a hardcoded CSS value directly in the component CSS.
  Do NOT invent a new `--*` token for it.

###### Why
TweakCN themes are drop-in replacements. If we add tokens that TweakCN doesn't
export, swapping a theme will leave those tokens undefined and break components.
The token file must be a pure subset of what TweakCN produces.

###### Allowed token list (exhaustive)

**Color pairs** (surface + foreground):
`--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`,
`--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`,
`--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`,
`--accent-foreground`, `--destructive`, `--destructive-foreground`

**Utility tokens**: `--border`, `--input`, `--ring`

**Sidebar tokens**: `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`,
`--sidebar-primary-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`,
`--sidebar-border`, `--sidebar-ring`

**Chart tokens**: `--chart-1` through `--chart-5`

**Typography**: `--font-sans`, `--font-serif`, `--font-mono`

**Radius**: `--radius` (base), `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl` (derived)

**Shadow scale**: `--shadow-2xs` through `--shadow-2xl`

**Spacing**: `--spacing`

**Tracking**: `--tracking-normal`

**Nothing else.** If a value is not on this list, it cannot be a `var(--*)` reference
in component CSS. Use a literal CSS value instead.

###### Token shape (tweakcn compatible)

`dist/theme/default-semantic-tokens.css` must match the shape of theme exports from tweakcn.com:

###### `:root` block provides:
- Color pairs: `--primary` / `--primary-foreground` (and all other semantic pairs)
- Utility tokens: `--border`, `--input`, `--ring`
- Sidebar tokens: `--sidebar`, `--sidebar-foreground`, etc.
- Chart tokens: `--chart-1` through `--chart-5`
- Font stacks: `--font-sans`, `--font-serif`, `--font-mono` (generic defaults)
- Base radius: `--radius`
- Derived radius: `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl` (computed from `var(--radius)`)
- Shadow scale: `--shadow-2xs` through `--shadow-2xl`
- Spacing: `--spacing`
- Tracking: `--tracking-normal`

###### `.dark` block overrides:
- All color pairs for dark mode
- Same tokens, different values

###### Derived radius values

Tweakcn themes provide `--radius` and derived values. The derived values use additive offsets:
```css
--radius-sm: calc(var(--radius) - 4px);
--radius-md: calc(var(--radius) - 2px);
--radius-lg: var(--radius);
--radius-xl: calc(var(--radius) + 4px);
```

These exist as real CSS custom properties because component CSS uses `var(--radius-md)` directly.

### Documentation site architecture

The doc site dev server runs on `http://localhost:3000/` via `bun run dev` (Vite).
When testing, use the existing dev server — don't start a new one.

The doc site is a **SPA-style multi-page app**. `layout.js` loads synchronously in
`<head>` and provides:

- `<site-header>` — renders the fixed header (logo, GitHub link, dark mode toggle)
- `<site-nav>` — renders the sidebar from a centralized `NAV` array, auto-detecting the active page
- **SPA router** — intercepts nav clicks, fetches HTML, swaps `<main>` content
  without full-page reloads (uses View Transitions API for smooth crossfade)

**Sidebar nav is centralized in `layout.js`.** To add or reorder nav links, edit
the `NAV` array and the `BUILT` set in that one file — individual HTML pages
do not contain nav markup.

Each HTML page duplicates the full list of component CSS `<link>` tags in `<head>`
and component JS `<script>` tags at end of `<body>`. When adding a new component,
these imports must be added to **every** HTML file.

---

## Adding a new component

### Reference sites (REQUIRED)

Before writing any component skill or documentation page, **fetch and review** the component on these sites:

#### Feature checklist (what to build)
1. **shadcn/ui** → `https://ui.shadcn.com/docs/components/{name}`
2. **Basecoat UI** → `https://basecoatui.com/components/{name}/`

These define the completeness bar. Every variant, size, state, and composition pattern
shown on those pages must be accounted for in the component skill and doc page — adapted
to our semantic HTML / CSS custom property / vanilla JS model. Do not copy their markup;
use them as a feature checklist.

#### Native implementation (how to build it)
3. **WAI-ARIA APG** → `https://www.w3.org/WAI/ARIA/apg/patterns/{name}/` — canonical keyboard navigation and ARIA patterns
4. **MDN Web Docs** → `https://developer.mozilla.org/` — authoritative reference for HTML elements, CSS properties, and JS APIs
5. **Open UI** → `https://open-ui.org` — W3C community group defining native component standards
6. **Base UI** → `https://base-ui.com/react/components/{name}` — headless component architecture (closest to our approach in spirit)

Always prefer native browser APIs over JS workarounds. Check MDN for the latest
support status of newer APIs (`popover`, anchor positioning, `@starting-style`, etc.).

### Steps

1. **Create the component folder** → `dist/components/{name}/`

2. **Write the component skill** → `dist/components/{name}/component-skill.md`
   - Follow the template: Native basis → Native Web APIs → Structure → Variants → Sizes → ARIA → Notes
   - Documents the HTML pattern, not CSS/JS (those are the actual files)
   - Cross-check variants, sizes, and states against the reference sites above

3. **Write the CSS** → `dist/components/{name}/{name}.css`
   - Edit directly — no build step

4. **Write the JS** (if interactive) → `dist/components/{name}/{name}.js`
   - Plain ES module — wrap initialization in an `init()` function
   - Call `init()` immediately, then add `new MutationObserver(init).observe(document, { childList: true, subtree: true });`
   - This auto-initializes new elements after SPA navigation or dynamic DOM changes
   - No `export`, no `window.onPageReady` — just the init function + MutationObserver

5. **Create the doc page** → `dist/documentation/{name}.html`
   - Copy an existing component page as template (e.g., badge.html)
   - Add `<link rel="stylesheet" href="../components/{name}/{name}.css">` to the head
   - Add `<script type="module" src="../components/{name}/{name}.js"></script>` if interactive
   - Replace demo content with working examples

6. **Update layout.js** → add the component to the `NAV` array and `BUILT` set
   in `dist/documentation/js/layout.js` (this is the single source of truth for sidebar nav)

7. **Add CSS/JS imports to all HTML pages** → add the new component's `<link>` and
   `<script>` tags to every HTML file in `dist/documentation/`

8. **Sync inline source snippets** → run `bun run sync-snippets` to replace the inline
    `<pre><code>` blocks in every doc page with the actual contents of each component's
    `.css` and `.ts` files. This must be done after any change to a component's CSS or
    JS — not just for new components.


# Component Skill Editing

## Reference sites (REQUIRED)

Before writing or updating any component skill, fetch and review the component:

### Feature checklist (what to build)
1. **shadcn/ui** → `https://ui.shadcn.com/docs/components/{name}`
2. **Basecoat UI** → `https://basecoatui.com/components/{name}/`

Every variant, size, state, and composition pattern shown on those pages must be
accounted for in the component skill — adapted to our semantic HTML / CSS custom property /
vanilla JS model.

### Native implementation (how to build it)
3. **WAI-ARIA APG** → `https://www.w3.org/WAI/ARIA/apg/patterns/{name}/` — canonical keyboard navigation and ARIA patterns
4. **MDN Web Docs** → `https://developer.mozilla.org/` — authoritative reference for HTML elements, CSS properties, and JS APIs
5. **Open UI** → `https://open-ui.org` — W3C community group defining native component standards
6. **Base UI** → `https://base-ui.com/react/components/{name}` — headless component architecture reference

Always prefer native browser APIs over JS workarounds. Check MDN for support
status of newer APIs (`popover`, anchor positioning, `@starting-style`, etc.).

## Component skill template

Component skills document **how to build the HTML** for a component. CSS and JS live in
their own files alongside the skill — edit `.css` and `.js` directly.

Every component skill must include these sections in order:

1. **Native basis** — which HTML element/API it builds on
2. **Native Web APIs** — bulleted list of significant platform APIs with MDN links (see format below)
3. **Structure** — complete HTML markup with all attributes
4. **Variants** — variant table mapping `data-variant` values to visual behavior
5. **Sizes** — size table (if applicable)
6. **ARIA** — accessibility attributes table
7. **Notes** — edge cases, composition tips, caveats

Do NOT include CSS or JavaScript code blocks in the component skill. The `.css` and `.js` files
in the same folder are the source of truth for styles and behavior.

## Native Web APIs section format

Every component skill must include a `## Native Web APIs` section immediately after
`## Native basis`. This section lists the significant web platform APIs the component
relies on, with MDN links. Use this format:

```markdown
## Native Web APIs
- [`<dialog>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog) — native modal with focus trap and Escape-to-close
- [`@starting-style`](https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style) — entry animation starting values
```

### What to include
- HTML elements that provide core behavior (`<dialog>`, `<details>`, `<summary>`, `<progress>`, `<meter>`, `<output>`)
- HTML attributes that replace JS (`popover`, `popover="hint"`, `commandfor`/`command`, `inert`, `autofocus`, `loading="lazy"`)
- Browser APIs (`Popover API`, `showModal()`, `View Transitions API`, `Navigation API`)
- Significant CSS features (`CSS Anchor Positioning`, `@starting-style`, `::backdrop`, `::details-content`, Container Queries, `:has()`, `field-sizing: content`, `interpolate-size`, `content-visibility`, `@property`, `scroll-driven animations`, `light-dark()`, `color-mix()`)
- Accessibility features (`prefers-reduced-motion`, `prefers-contrast`, `forced-colors`)
- JS APIs used (`IntersectionObserver`, `ResizeObserver`, `MutationObserver`, `Clipboard API`, `Intl.*`, `CloseWatcher`, `AbortController`, `FormData`, `structuredClone()`)
- WAI-ARIA patterns when the component follows a specific APG pattern

### What to exclude
- Basic DOM methods (`querySelector`, `classList`, `addEventListener`)
- Standard CSS layout (`flexbox`, `grid` unless using subgrid/container queries)
- Common pseudo-classes (`:hover`, `:disabled`) unless component-defining (`:focus-visible`, `:has()`)

## CSS authoring conventions

### `@layer components`
All component CSS must be wrapped in `@layer components { ... }`. This establishes
explicit cascade priority: tokens → components → utilities. Never write component CSS
outside a layer.

### Native CSS nesting
Use `&` nesting for all related selectors. Group variants, sizes, states, and child
element styles inside the base selector:
```css
@layer components {
  .btn {
    /* base styles */
    &[data-variant="outline"] { /* ... */ }
    &[data-size="sm"] { /* ... */ }
    &:hover { /* ... */ }
    &:disabled { /* ... */ }
    & svg { /* child styles */ }
  }
}
```

### Modern CSS features (use where applicable)
- **CSS anchor positioning** — for popover/dropdown/combobox placement (`position-anchor`, `anchor()`, `position-try-fallbacks: flip-block`). No JS positioning code needed.
- **`:has()` selector** — for parent/sibling state reactions (e.g., label styling when input is focused)
- **`field-sizing: content`** — for auto-growing textareas with zero JS
- **Container queries** — for components that adapt to their container width (`container-type: inline-size`, `@container`)
- **`@starting-style`** — for enter animations on elements added to DOM or moving to top layer
- **`interpolate-size: allow-keywords`** — for smooth height-to-`auto` transitions (accordion, collapsible)
- **`content-visibility`** — for expand/collapse transitions with `allow-discrete`
- **`@property`** — for typed, animatable custom properties (progress rings, gradient transitions)
- **`color-mix(in oklch, ...)`** — for deriving hover/disabled states from token colors
- **`light-dark()`** — for inline dark mode values when `color-scheme` is set
- **`accent-color`** — for theming native form controls (checkbox, radio, range, progress)
- **Scroll-driven animations** — `animation-timeline: scroll()` / `view()` for scroll-linked effects
- **View Transitions API** — `startViewTransition()` for smooth DOM state changes
- **Logical properties** — `margin-inline`, `padding-block`, `inset-inline-start` for RTL support
- **Subgrid** — `grid-template-columns: subgrid` for child alignment to parent grid tracks
- **`:is()` / `:where()`** — selector grouping; `:where()` has zero specificity (ideal for resets)
- **`@scope`** — bounded style scoping with upper and lower boundaries (available but
  **not used in this project** — we use `@layer` + descriptive prefixed class names instead;
  see cascade-layers.html for rationale)
- **Dynamic viewport units** — `dvh`, `svh`, `lvh` for mobile browser chrome awareness
- **CSS math** — `clamp()`, `min()`, `max()`, `round()` for responsive sizing

### Accessibility CSS (REQUIRED for all components)
- **`prefers-reduced-motion: reduce`** — suppress/simplify all transitions and animations
- **`prefers-contrast: more`** — increase contrast when requested by the user
- **`forced-colors: active`** — support Windows High Contrast Mode with system colors
- **`prefers-color-scheme`** — automatic dark mode defaults from OS preference

### After editing component CSS or JS

Doc pages display each component's CSS and JS in inline `<pre><code>` blocks.
After changing any `.css` or `.js` file, run the sync scripts to keep doc pages accurate:

```
bun run sync-snippets
```

## Accuracy requirements

- All CSS values must match what the documentation site actually renders
- All class names must match the CSS selectors exactly
- Token references must use `var(--*)` — never raw color values (see token boundary rule in tokens.instructions.md)
- `<dialog>` components must include `margin: auto; position: fixed; inset: 0;` for centering (some browsers need this explicitly)

## Variant and size API (data attributes)

Components use `data-*` attributes — never CSS class modifiers — for variants and sizes.

### Rules
- **`data-variant`** for visual variations (e.g., `default`, `outline`, `ghost`, `destructive`)
- **`data-size`** for size variations (e.g., `sm`, `lg`, `icon`)
- **`data-side`**, **`data-position`**, etc. for structural variations where applicable
- **One base class** per component (`.btn`, `.badge`, `.card`) — this identifies *what* it is
- **Data attributes** express *which version* — never add modifier classes like `.btn-primary` or `.btn--ghost`
- CSS selectors combine the base class with the attribute: `.btn[data-variant="outline"]`

### Why
- Flat specificity — all selectors have equal weight, no conflicts
- Uniform API — every component follows the same pattern, easy for AI to learn
- Independent axes — variant and size combine freely without combinatorial class names
- Clean `class` attribute — no long modifier chains

### Correct
```html
<button class="btn" data-variant="destructive" data-size="lg">Delete</button>
<span class="badge" data-variant="outline">Status</span>
```

### Wrong
```html
<button class="btn btn-destructive btn-lg">Delete</button>
<span class="badge badge-outline">Status</span>
```

## Reference

Check shadcn/ui (ui.shadcn.com) for the expected behavior and API of each component.
Translate React/Radix patterns into semantic HTML + vanilla JS.

---

## Linting

`make lint` (oxlint over `src/`, `tests/`, `scripts/`) reports warnings but must stay
**non-blocking** — do not configure it to fail on warnings (`--deny-warnings` is banned);
only real errors should gate CI.

Keep the log clean: fix every warning an edit introduces. For a variable that is
**known to be intentionally unused**, prefix it with `_` (e.g. `var _copyBtn = …`) —
oxlint's `no-unused-vars` accepts that convention. For intentionally unused
**caught errors**, omit the parameter entirely (`catch { … }`, ES2019) — oxlint flags
`catch (_e)` too. Do not silence warnings with ignore comments, and do not delete
code that linters flag without checking why it exists (e.g. `window.THEMES` in
`themes.ts` is a cross-file global contract — make the contract explicit instead
of removing it).

## Testing

`make help` lists the shortcuts (`setup`, `dev`, `test`, `test-run`, `coverage`, `e2e`, `lint`) —
they wrap the equivalent `bun run <script>` commands; package.json stays the single source of truth.

`bun run test:run` runs the UI suite in headless Chromium (Vitest browser mode + Playwright).
First run needs `make setup` (or `bunx playwright install`).

Tests load the real pages from `dist/documentation/` inside a **same-origin iframe**
(`openDocPage()` in `tests/helpers.js`) — Vitest browser mode has no `page.goto()`.
Interactions go through `userEvent.click()` on elements queried from the iframe's
`document` (trusted Playwright input); state is asserted by reading that same
same-origin `document` directly. `frame.getBy*()` locators work too, but Vitest's
ARIA-tree queries are slow/flaky on these very large doc pages, so prefer
`doc.querySelector` + `expect` for assertions.

When adding a component, add at least one interaction test in `tests/ui.test.js`
covering its JS behavior (see the dialog/accordion tests as templates).

### Component E2E smoke tests (`bun run e2e`)

Per-component smoke tests live in `tests/e2e/` and run with **plain Playwright**
(no Vitest). Each component gets two files:

- `{name}.e2e-fixture.html` — uses the component **in every configuration** the
  component skill documents (all variants/sizes/states/compositions), linking the
  real files by absolute path (`/dist/theme/default-semantic-tokens.css`,
  `/dist/components/{name}/{name}.css` + `.js`). The fixture is served by
  `server.mjs`, a static Bun server rooted at the repo root that exposes only
  `/dist/` and `/tests/e2e/`.
- `{name}.e2e.mjs` — a standalone script (exits non-zero on failure) that launches
  Chromium, serves the fixture, and asserts behavior: init markers, initial state,
  applied CSS (via computed styles), each interaction, and keyboard behavior.
  `accordion.e2e.mjs` is the reference template.

`tests/e2e/run.mjs` globs and runs every `*.e2e.mjs` in isolated child processes.
When adding a component, add both files (see the accordion pair as the template).

## Common pitfalls

- **Dialog/Sheet centering**: Always set `margin: auto; position: fixed; inset: 0;`
  explicitly for centered dialogs.
- **CSS drift**: If the component skill's variant/size tables don't match the `.css` file,
  update the component skill to stay in sync — the `.css` file is the source of truth for styles.
- **CSS/JS import drift**: When adding a component, you must add its `<link>` and
  `<script>` tags to ALL HTML pages. Missing imports cause components in cross-page
  demos to break silently.
- **SPA re-initialization**: Component JS modules use `MutationObserver` to
  auto-initialize new elements when the DOM changes — no manual re-import needed.
  Doc-site-only scripts (site.js) use `window.onPageReady(fn)` for their own re-init.
- **Font stacks**: The system tokens use generic font stacks. The doc site overrides
  them in `css/docs-theme.css`. Don't put custom fonts in `default-semantic-tokens.css`.
- **Inline source snippet drift**: Doc pages show the component's CSS and JS in
  `<pre><code>` blocks. These must always match the actual files. After editing any
  component `.css` or `.ts`, run `bun run sync-snippets` to update all doc pages
  automatically (the syncers edit `src/`, never `dist/`).

# Documentation Pages

## Shared layout (Web Components)

The header and sidebar navigation are centralized in `dist/documentation/js/layout.js`
using two custom elements:

- `<site-header>` — renders the fixed header (logo, GitHub link, dark mode toggle)
- `<site-nav>` — renders the sidebar with navigation links, auto-detecting the active page

**To add/remove/reorder nav links or change the header, edit `layout.js` only.**
No need to touch individual HTML files for navigation changes.

`layout.js` is loaded **synchronously** in `<head>` (no `defer`) so the custom
elements render without FOUC when the parser encounters them in `<body>`.

### layout.js data structures

- `NAV` — array of `{ heading, items: [{ label, href }] }` defining the sidebar sections
- `BUILT` — `Set` of page filenames that have real doc pages (non-built pages render as disabled links)

## Adding a component page

1. Copy an existing component page (e.g., `badge.html`) as the template
2. Change the `<title>`, `<h1>`, breadcrumb, and main content
3. Add `<link rel="stylesheet" href="../components/{name}/{name}.css">` to the head
4. Add `<script type="module" src="../components/{name}/{name}.js"></script>` if interactive
5. In `layout.js`: add the page to the `NAV` array and the `BUILT` set

No need to update sidebar nav links in other files — `<site-nav>` handles it globally.

## Sidebar nav order

The sidebar is ordered by dependency (primitives first):
1. Overview (Introduction, Installation, Theming, Dark Mode, Data Attribute API, Cascade Layers, ES Modules, Native Web APIs, Animations, Accessibility, Component Skills, Changelog)
2. Primitives (Typography, Separator, Icon)
3. Layout (Scroll Area, Carousel, Sortable)
4. Actions (Button, Toggle, Toggle Group, Button Group, Toolbar)
5. Forms & Inputs (Label, Input, Textarea, Checkbox, Radio Group, Switch, Slider, Select, Number Input, File Input, Color Picker, Date Picker, Combobox, Form)
6. Data Display (Badge, Avatar, Card, Image, Statistic, Table, Collapsible, Timeline, Tree View, Calendar)
7. Feedback & Status (Spinner, Skeleton, Progress, Alert, Alert Dialog, Toast)
8. Overlays (Popover, Tooltip, Context Menu, Dialog, Sheet, Accordion, Command)
9. Navigation (Breadcrumb, Pagination, Steps, Tabs, Dropdown Menu, Navigation Menu)
10. Application (Sidebar)

To reorder, edit the `NAV` array in `layout.js`.

## CSS and JS imports

Every page imports ALL component CSS and JS files (not just its own). This ensures
components used in demos on other pages render correctly. CSS and JS files live in
`../components/{name}/{name}.css` and `../components/{name}/{name}.js` respectively.

## Inline source code snippets

Each component doc page displays the component's CSS and JS in `<pre><code>` blocks.
These inline snippets must always match the actual files in `dist/components/`.
After editing any component `.css` or `.js` file, run:

```
bun run sync-snippets
```

These scripts replace every inline snippet with the current file content.
Do NOT manually edit the `<pre><code>` blocks — they will be overwritten by the sync scripts.

## Doc-site utility classes

The doc site uses a small, hand-written set of utility classes for layout and
spacing inside doc pages (`css/docs-utilities.css`). The utilities are plain
class rules — they only affect elements that explicitly opt in by using the
class name, so they cannot leak into component styles.

If you need a new utility (e.g. `mt-4`, `gap-5`), add it directly to
`css/docs-utilities.css`. Keep the utility set minimal — prefer inline `style`
attributes for one-off layout tweaks in demo wrappers.
