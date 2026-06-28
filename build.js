#!/usr/bin/env bun
/* global Bun */
// Minifies the static JS and CSS assets in place, replacing the gulp build.
// The assets are served directly from ./assets by wrangler's [site] config and
// referenced at /static/..., so the minified output must overwrite the source.

import { Glob } from 'bun'
import { run as syncFonts } from './sync-fonts.js'

// Vendor the Bun-managed webfonts into ./assets before minifying.
await syncFonts()

// main.js is the only JS *entry*. It imports ./locale.js (the unit-tested pure
// helpers), and `external: []` tells Bun to inline that import. main.js itself
// exports nothing, so the bundle is a self-executing classic script with no
// `export` token — loadable by every cached HTML variant (plain <script> or
// type="module") so a deploy never strands cached pages. locale.js is a
// dependency, not an entry, so it is never built/served on its own.
const cssEntries = []
for await (const path of new Glob('assets/static/styles/*.css').scan('.')) {
  cssEntries.push(path)
}

const targets = [
  // Bundle local imports (external: []).
  { label: 'JS', entries: ['assets/static/js/main.js'], external: [] },
  // Leave url(/static/...) refs untouched rather than resolving them as
  // build-time assets (external: ['*']).
  { label: 'CSS', entries: cssEntries, external: ['*'] }
]

let count = 0

for (const { label, entries, external } of targets) {
  for (const path of entries) {
    const result = await Bun.build({
      entrypoints: [path],
      minify: true,
      target: 'browser',
      external
    })

    if (!result.success) {
      console.error(`✗ Failed to build ${path}`)
      for (const message of result.logs) console.error(message)
      process.exit(1)
    }

    // Build fully into memory before writing, so overwriting the source is safe.
    const minified = await result.outputs[0].text()
    await Bun.write(path, minified)
    console.log(`✓ ${label}: ${path}`)
    count++
  }
}

console.log(`Build complete — ${count} file(s) minified in place.`)
