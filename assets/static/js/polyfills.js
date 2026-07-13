// Minimal runtime shims for the older-browser degraded mode (target floor ~2018:
// Chrome 65 / Safari 11.1). esbuild lowers modern *syntax* (?., ??, spread) at
// build time, but it does not add missing runtime APIs. At this floor the only
// gap the apps hit is Element.prototype.replaceChildren (Chrome 86 / Safari 14,
// 2020). Everything else the app needs (Intl, URLSearchParams) already exists at
// the floor, so this stays a few lines rather than pulling in core-js.
//
// Imported for side effects as the first line of main.js. Keep export-free so it
// never turns the bundle into an ES module.

if (typeof Element !== 'undefined' && !Element.prototype.replaceChildren) {
  Element.prototype.replaceChildren = function replaceChildren(...nodes) {
    while (this.firstChild) this.removeChild(this.firstChild)
    this.append(...nodes)
  }
}
