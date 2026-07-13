#!/usr/bin/env bun
/* global Bun */
// Minifies the static JS and CSS assets in place, replacing the gulp build.
// The assets are served directly from ./assets by wrangler's [site] config and
// referenced at /static/..., so the minified output must overwrite the source.

import { Glob } from 'bun'
import browserslist from 'browserslist'
import { build as esbuild } from 'esbuild'
import { browserslistToTargets, transform as lightningcss } from 'lightningcss'
import { run as syncFonts } from './sync-fonts.js'

// Single browser-support floor for the whole build: the `browserslist` field in
// package.json drives both the CSS down-leveling (Lightning CSS) and the JS
// syntax floor, so old signage players get a build they can actually run. See
// the degraded-mode notes in Layout.jsx / main.css.
const cssTargets = browserslistToTargets(browserslist())

// Vendor the Bun-managed webfonts into ./assets before minifying.
await syncFonts()

// main.js is the only JS *entry*. It imports ./locale.js (and the polyfills shim);
// esbuild inlines those and lowers modern syntax (?., ??, spread) to the ES2017
// floor so old engines can parse it. format:'iife' keeps the output a self-
// executing classic script with no `export`/`import` token — loadable by every
// cached HTML variant so a deploy never strands cached pages. allowOverwrite lets
// esbuild write back over the entry (assets are served in place by wrangler).
try {
  await esbuild({
    entryPoints: ['assets/static/js/main.js'],
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['es2017'],
    outfile: 'assets/static/js/main.js',
    allowOverwrite: true
  })
} catch (error) {
  console.error('✗ Failed to build assets/static/js/main.js')
  console.error(error)
  process.exit(1)
}
console.log('✓ JS: assets/static/js/main.js (esbuild, iife, es2017)')

// CSS: Lightning CSS down-levels each stylesheet to the browserslist floor and
// minifies in place. url(/static/...) refs are left untouched.
let count = 1
for await (const path of new Glob('assets/static/styles/*.css').scan('.')) {
  const { code } = lightningcss({
    filename: path,
    code: await Bun.file(path).bytes(),
    minify: true,
    targets: cssTargets
  })
  await Bun.write(path, code)
  console.log(`✓ CSS: ${path}`)
  count++
}

console.log(`Build complete — ${count} file(s) built in place.`)
