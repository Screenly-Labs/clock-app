# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A full-screen localized clock for digital signage, deployed as a Cloudflare Worker. The page is server-rendered by [Hono](https://hono.dev/) JSX at the edge; the worker reads the viewer's location from Cloudflare's `cf` object (country + IANA timezone) and injects it into the HTML, then client-side JS uses `Intl` to render the local wall-clock time, date, and 12/24h format in the location's language.

Note: active development has moved to the Clock Edge App, but this codebase is current and tested.

## Commands

Bun is the package manager and test runner. Wrangler is installed locally (run via `bunx wrangler`).

```bash
bun install              # install deps
bun run dev              # wrangler dev on port 8888 (see screenshotting note below)
bun run lint             # biome lint, warnings are errors (must pass in CI)
bun run lint:fix         # autofix lint
bun run format           # biome format --write
bun test                 # run all tests
bun test:watch           # watch mode
bun test src/index.test.js          # run a single test file
bun test -t "coverage"              # run tests matching a name
bun run build            # vendor fonts + minify JS/CSS in place (see below)
bun run sync-fonts       # vendor webfonts only
bunx wrangler deploy --env <dev|stage|production>
```

CI (`.github/workflows/ci.yml`) runs `bun run lint` then `bun test` on every PR. Pushing to `master` deploys to **stage**; pushing to `production` deploys to **production**.

## Architecture

### Request flow (`src/index.jsx`)
1. `GET /` reads `c.req.raw.cf.country` and `.timezone` (only available at the Cloudflare edge — the device's own clock/locale is **not** trusted).
2. Renders `<App>` to an HTML string, embedding location in a `<span id="clock-data" data-country data-timezone>`.
3. SSR responses are cached in `caches.default` with `s-maxage=43200` (12h). **The cache key is versioned by `ASSET_VERSION` + country + timezone** — this is load-bearing: it prevents a cached HTML shell from being paired with a different deploy's assets, or served with the wrong region's locale.
4. `/static/*` is served from `./assets` via `serveStatic`. Versioned URLs (`?v=<ASSET_VERSION>`) get `immutable` 1-year cache; unversioned legacy URLs get 5 min.

`ASSET_VERSION` is a hash of the static-asset manifest — it changes exactly when a deploy ships new assets, which is what busts both the SSR page cache and asset URLs.

### Server vs. client split
- **Server (`src/`, Hono JSX)**: `index.jsx` (worker + caching) → `components/App.jsx` → `Layout.jsx` (full HTML doc, font preloads, Sentry/GA tags, `#clock-data`), `Header.jsx`, `Footer.jsx`. JSX is configured via `jsconfig.json` (`jsxImportSource: hono/jsx`).
- **Client (`assets/static/js/`)**: `main.js` is the only JS entry — a self-executing IIFE. It reads `#clock-data`, drives the clock, the day-period ambient accent (`document.body.dataset.period`), the CSS minute-progress bar, and the rotating Screenly CTA banner (shown only on non-`screenly-viewer` user agents).
- **`assets/static/js/locale.js`** holds the pure, unit-tested locale/formatting helpers and the `COUNTRY_LOCALES` table (ISO-3166 → BCP-47). `main.js` imports it; `locale.js` is **never served on its own**.

### The build constraint (read before touching `build.js`, `main.js`, or `locale.js`)
`build.js` minifies JS/CSS **in place** (overwriting source under `assets/`, which `serveStatic` ships directly). `main.js` bundles `locale.js` in via `external: []` and must remain a classic self-executing script with **no top-level `export` token** — that keeps the bundle loadable by every cached HTML variant (plain `<script>` and `type="module"`) so a deploy never strands cached pages. Keep testable logic in `locale.js` (importable by tests) and keep `main.js` export-free. CSS is built with `external: ['*']` so `url(/static/...)` refs are left untouched. Fonts are vendored from `@fontsource` packages into `assets/static/fonts/` by `sync-fonts.js` (no CDN).

### Locale correctness
The `COUNTRY_LOCALES` map (in `locale.js`) is the source of truth for 250+ country→locale mappings. A few territories with no CLDR data are mapped to `"en"` on purpose. `test/locale-coverage.test.js` walks the **entire** table and fails if any entry throws, silently resolves to a different language, or fails to localize month names — run it after editing the map. Default/fallback locale is `en-GB` (24h, neutral English). RTL languages get `dir="rtl"` applied to just the `#date`/`#time` elements, not the whole layout.

## Conventions
- Biome enforces: single quotes, no semicolons (`asNeeded`), no trailing commas, 2-space indent, 100 col width. Run `bun run lint:fix` before committing.
- Sentry/GA IDs per environment live in `src/constants.js`; `App.jsx` only injects the tags when the env has an ID (guards against unset `ENV`).

## Screenshotting / running the app locally
`wrangler dev` is unstable in this environment. To screenshot or verify rendering, run `bun run build`, then serve `assets/` with `Bun.serve` and drive it with Playwright using absolute paths (see the `screenshotting-the-app` memory).
