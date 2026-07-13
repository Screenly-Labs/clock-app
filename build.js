#!/usr/bin/env bun
/* global Bun */
// Builds the served static assets in place. The client JS is bundled to a self-
// executing classic script and the CSS is down-leveled + minified in place, both
// through @screenly-labs/signage-kit (shared support floor + pipeline). The shared
// degraded-mode kill-switch is prepended to the CSS by the kit (includeDegraded),
// so it lives in the package, not here. The assets are served directly from
// ./assets by wrangler's [site] config and referenced at /static/..., so the
// minified output overwrites the source (CI builds from a fresh checkout).

import { readFileSync } from 'node:fs'
import { Glob } from 'bun'
import { bundleJs, processCss } from '@screenly-labs/signage-kit/build'
import { run as syncFonts } from './sync-fonts.js'

// Shared chrome CSS from @screenly-labs/signage-kit — the canonical @font-face set
// and the standardized fixed footer badge. Prepended to this app's raw main.css at
// build time (a raw-CSS Worker can't resolve a bare `@import`), so the shared rules
// land before the app's, which override where they overlap.
const sharedCss = ['fonts.css', 'brand.css']
  .map((f) => readFileSync(Bun.resolveSync(`@screenly-labs/signage-kit/styles/${f}`, import.meta.dir), 'utf8'))
  .join('\n')

// Vendor the Bun-managed webfonts into ./assets before minifying.
await syncFonts()

// main.js is the only JS entry. It imports ./locale.js (and the shared polyfills
// shim); the kit's bundleJs inlines those and lowers modern syntax to the shared
// ES2017 floor, emitting a self-executing classic script (iife) with no
// `export`/`import` token — loadable by every cached HTML variant so a deploy
// never strands cached pages. bundleJs now overwrites the in-place entry directly
// (allowOverwrite), so we bundle straight over the source with no temp file.
const jsEntry = 'assets/static/js/main.js'
try {
  await bundleJs(jsEntry, jsEntry)
} catch (error) {
  console.error('✗ Failed to build assets/static/js/main.js')
  console.error(error)
  process.exit(1)
}
console.log('✓ JS: assets/static/js/main.js (bundleJs, iife, es2017)')

// CSS: the kit down-levels each stylesheet to the shared floor, minifies it, and
// prepends the shared html.legacy kill-switch (includeDegraded). Written in place;
// url(/static/...) refs are left untouched.
let count = 1
for await (const path of new Glob('assets/static/styles/*.css').scan('.')) {
  try {
    const code = await processCss(`${sharedCss}\n${await Bun.file(path).text()}`, {
      includeDegraded: true,
      filename: path
    })
    await Bun.write(path, code)
  } catch (error) {
    console.error(`✗ Failed to build ${path}`)
    console.error(error)
    process.exit(1)
  }
  console.log(`✓ CSS: ${path}`)
  count++
}

console.log(`Build complete — ${count} file(s) built in place.`)
