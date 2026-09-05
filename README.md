# defuss-shadcn

[![GitHub stars](https://img.shields.io/github/stars/codylindley/defuss-shadcn?style=flat&logo=github)](https://github.com/codylindley/defuss-shadcn)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![No dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
![HTML CSS JS](https://img.shields.io/badge/stack-HTML%20·%20CSS%20·%20JS-orange)

**A UI component system that scales with AI.** Themeable components built on semantic HTML, modern CSS, and vanilla JavaScript. No framework. No build step for consumers — `dist/` is committed and ready to use as-is. The simplest possible foundation for AI-driven prototyping.

**[Documentation & Live Demos →](https://kyr0.github.io/defuss-shadcn/documentation/)**

## What this is

A portable UI component system built on the [shadcn/ui](https://ui.shadcn.com) token model.

- **Themeable** — full shadcn semantic token model. Swap a [tweakcn](https://tweakcn.com) theme and every component updates instantly
- **Component Skills** — every component includes a structured skill — markup, variants, ARIA, and wiring conventions — grounded in web standards
- **Accessible** — built on native HTML elements and WAI-ARIA patterns. Keyboard navigation, focus management, and screen reader support by default
- **Framework Free** — runs in any browser, zero dependencies, no build pipeline required

## Quick start

### Via CDN

```html
<!-- 1. Add a theme -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/codylindley/defuss-shadcn@latest/dist/theme/default-semantic-tokens.css">

<!-- 2. Add the icons -->
<script src="https://unpkg.com/lucide@1.8.0"></script>
<script>lucide.createIcons();</script>

<!-- 3. Select the components you want -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/codylindley/defuss-shadcn@latest/dist/components/button/button.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/codylindley/defuss-shadcn@latest/dist/components/dialog/dialog.css">
<script type="module" src="https://cdn.jsdelivr.net/gh/codylindley/defuss-shadcn@latest/dist/components/dialog/dialog.js"></script>
```

### Self-hosting

Download the full system and drop it into any project. All the files are static — no build step, no dependencies. Point an AI at the folder and it has everything it needs: component skills to read, CSS to include, JS to wire up, and the entire documentation site with working examples of every component.

**[Download latest (.zip)](https://github.com/codylindley/defuss-shadcn/archive/refs/heads/main.zip)**

## Built on five layers

Each component is a self-contained folder with up to five layers:

```
components/
└── dialog/
    ├── component-skill.md    ← structured skill: HTML structure, attributes, ARIA
    ├── dialog.css            ← stylesheet (uses design tokens)
    └── dialog.js             ← interaction behavior (when needed)
```

1. **Semantic tokens** — `default-semantic-tokens.css` defines every design token for the default light and dark theme. To switch themes, you just switch this file.
2. **Component CSS** — each component's stylesheet, built entirely on tokens.
3. **Semantic HTML** — native HTML elements with data attributes for variants and wiring.
4. **Vanilla JavaScript** — interaction logic, only when HTML and CSS can't express the behavior.
5. **Component skill** — a structured instruction set that documents how to build the component: markup, variants, ARIA, and wiring conventions.

Some components — like Button and Badge — are CSS-only. No JavaScript needed.

## Theming

Tokens are compatible with [tweakcn.com](https://tweakcn.com) theme exports. To switch themes, you just switch the token file — that's all the theme selector in the documentation site is doing.

1. Export a theme from tweakcn.com
2. Replace the `:root` and `.dark` blocks in `dist/theme/default-semantic-tokens.css`
3. Everything updates automatically — all components, the doc site, dark mode

## Components

See the **[full component list with live demos →](https://kyr0.github.io/defuss-shadcn/documentation/)**

## Design principles

### Native web platform first

Every component starts from a native HTML element or browser API. If the browser can do it, we don't write JavaScript for it.

| Instead of... | We use... |
|---------------|----------|
| JS modal with overlay div | `<dialog>` + `showModal()` + `::backdrop` |
| JS show/hide dropdowns | `popover` API |
| JS accordion toggle | `<details>` / `<summary>` |
| JS enter animations | `@starting-style` |
| Floating UI / Popper.js | CSS anchor positioning |
| JS class toggling for parent state | `:has()` selector |
| JS textarea auto-resize | `field-sizing: content` |
| Sass / Less / PostCSS | Native CSS nesting, `@layer`, container queries |

### Other principles

- **Token-driven** — every color, radius, and shadow comes from CSS custom properties
- **Dark mode automatic** — the token cascade handles it, no overrides needed
- **Variant via data attributes** — `data-variant="primary"`, not `btn-primary`

## Development

The repo now has a build step — but it is for **maintainers and coding agents only**.
`dist/` is committed, dependency-free, and usable at any time without building anything:
CDN, self-hosting, and copy-paste all work exactly as before. Just drop `dist/` into a
project, or download the `.zip`.

The toolchain exists so coding agents can **verify correctness of the implementation**,
not to produce it:

- **TypeScript** — component sources live in `src/` as `.ts`, giving agents type-checkable
  contracts; the build strips types to plain JS (`noCheck`, see [`tsconfig.json`](tsconfig.json))
  so what ships is still zero-dependency vanilla JS
- **E2E tests** — every component is exercised in a real browser (see [Testing](#testing));
  an agent can prove a change works instead of guessing
- **oxlint** — `make lint` catches dead code and mistakes instantly, in milliseconds

```bash
bun install        # install dev dependencies
bun run build      # compile src/ → dist/ (TypeScript → JS + copy everything else 1:1)
bun run dev        # doc site at http://localhost:3000/
bun run test:run   # run the UI test suite (headless Chromium)
```

`src/` is the authoring tree (`.ts` + html/css/md/fonts); `dist/` is its compiled, 1:1
mirror, committed and the only thing that ships.

A `Makefile` wraps the common tasks: `make setup` (install deps + Playwright browsers),
`make dev`, `make test-run`, `make coverage`, `make e2e`, `make lint` (oxlint),
`make verify`, `make screenshots`. **`make build`** runs the whole pipeline —
lint → compile → screenshots → verify → tests → e2e — the same loop CI runs.

`bun run verify` is the static consistency gate — it runs automatically at the end of
every `bun run build` and checks: component skills, doc pages, E2E coverage, token usage,
undefined utility classes, snippet sync + escaping, cross-page imports, sidebar links,
lint, `dist/` freshness (1:1 with `src/`), `.preview` blocks, screenshot freshness
(content-hash manifest — `bun run screenshots` re-shoots only changed components),
the State API contract + per-state coverage (screenshots, docs, skill, e2e), inlined
preamble in shipped JS, skill ↔ docs ↔ CSS variant parity, `prefers-reduced-motion`
coverage, init idempotency, doc command references, dead links (linkedom), machine-absolute
paths, and render drift. Known rollout gaps print as ⚠ warnings with a migration
procedure (fix source first, e2e after). Each failing check prints the offending file
and the exact fix command.

## Testing

Tests exist so agents (and humans) can verify the implementation end-to-end instead of trusting it.

UI tests run in a real browser (Chromium via Playwright) with **Vitest browser mode** — no mocking. The suite in [`tests/ui.test.js`](tests/ui.test.js) loads the actual documentation pages from `dist/documentation/` in a same-origin iframe and drives them end-to-end: web-component shell rendering, the SPA router, dark-mode toggle, dialog open/close/focus-return, and the single-open accordion.

```bash
bun run test         # watch mode
bun run test:run     # single run
bun run test:coverage
```

The first run needs Playwright's browser: `bunx playwright install chromium`.

Each component also ships with an E2E smoke test in [`tests/e2e/`](tests/e2e/): a static
fixture page using the component in **all** of its documented configurations, driven by
plain Playwright against the unmodified files in `dist/` (`bun run e2e`). This is the
verification loop a coding agent runs after touching any component — the shipped files
themselves are asserted, so "it compiles" is never mistaken for "it works".

## Author

Built by [Cody Lindley](https://codylindley.com)

## License

Licensed under the [MIT License](LICENSE).
