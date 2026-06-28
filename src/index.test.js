import { afterEach, describe, expect, it, mock } from 'bun:test'
import { jsx } from 'hono/jsx'
import App from './components/App'

// The Cloudflare static-assets middleware and its build-time manifest only
// exist in the Workers runtime; stub both before importing the app.
mock.module('__STATIC_CONTENT_MANIFEST', () => ({ default: '{}' }))
mock.module('hono/cloudflare-workers', () => ({
  serveStatic: () => async (_c, next) => next()
}))

// A Map-backed Cache API stub for caches.default (the SSR page cache, keyed by
// Request). Clone on store/return — mirroring the real Cache API — so a cached
// Response body is never consumed twice ("Body has already been used").
const makeCache = () => {
  const store = new Map()
  const keyOf = (k) => (typeof k === 'string' ? k : k.url)
  return {
    store,
    match: async (k) => store.get(keyOf(k))?.clone(),
    put: async (k, res) => {
      store.set(keyOf(k), res.clone())
    }
  }
}

const BASELINE_CACHE = { default: makeCache() }
globalThis.caches = BASELINE_CACHE

const app = (await import('.')).default

const runWaitUntil = async (promises) => {
  await Promise.all(promises)
}

afterEach(() => {
  globalThis.caches = BASELINE_CACHE
})

describe('Page render (/ route)', () => {
  it('renders the clock page HTML via hono JSX (server-side)', () => {
    // Mirrors the route's `new Response((<App/>).toString())`.
    const body = jsx(App, {
      env: 'production',
      country: 'US',
      timezone: 'America/New_York',
      v: 'testver'
    }).toString()

    expect(body).toContain('<!DOCTYPE html>')
    expect(body).toContain('id="time"')
    expect(body).toContain('id="date"')
    // Location comes from the Cloudflare edge and is injected for the client.
    expect(body).toContain('data-country="US"')
    expect(body).toContain('data-timezone="America/New_York"')
    expect(body).not.toContain('[object Object]')
    // main.js is a self-executing classic script (no ES module export), loaded
    // via a plain async <script> so cached HTML stays compatible across deploys.
    expect(body).toContain('<script src="/static/js/main.js?v=testver" async defer>')
    // Static asset URLs are cache-busted with the deploy version.
    expect(body).toContain('/static/styles/main.css?v=testver')
  })

  it('renders on a cache miss, caching under a real Request key with the edge Cache-Control', async () => {
    const keys = []
    const puts = []
    globalThis.caches = {
      default: {
        match: async (k) => {
          keys.push(k)
          return undefined
        },
        put: async (k) => {
          keys.push(k)
        }
      }
    }
    const ctx = { waitUntil: (p) => puts.push(p), passThroughOnException() {} }

    const res = await app.request('http://localhost/', {}, { ENV: 'production' }, ctx)

    expect(res.status).toBe(200)
    expect(await res.text()).toContain('<!DOCTYPE html>')
    // 12h shared-cache TTL must survive the migration.
    expect(res.headers.get('Cache-Control')).toBe('s-maxage=43200')
    await runWaitUntil(puts)
    // The page cache key must be a real Request (c.req.raw). hono's HonoRequest
    // wrapper also exposes .url, so assert the concrete type to lock the
    // contract — using c.req would fail this instanceof check.
    expect(keys.length).toBeGreaterThan(0)
    for (const key of keys) expect(key).toBeInstanceOf(Request)
    // The key must be versioned by the asset bundle so a deploy busts the page
    // cache instead of serving HTML that references the previous build's assets.
    for (const key of keys) expect(new URL(key.url).searchParams.get('v')).toBeTruthy()
  })

  it('serves the cached page on a repeat request without re-rendering', async () => {
    const cached = new Response('CACHED PAGE', { status: 200 })
    globalThis.caches = { default: { match: async () => cached, put: async () => {} } }
    const ctx = { waitUntil() {}, passThroughOnException() {} }

    const res = await app.request('http://localhost/', {}, { ENV: 'production' }, ctx)

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('CACHED PAGE')
  })
})

describe('Static asset caching (/static/*)', () => {
  it('caches versioned assets immutably and unversioned ones briefly', async () => {
    // Versioned URL (?v=...) is content-addressed via the query, so it is safe
    // to cache forever; the unversioned legacy URL must stay short-lived so old
    // cached HTML can pick up the current bundle.
    const versioned = await app.request('http://localhost/static/js/main.js?v=abc')
    expect(versioned.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')

    const unversioned = await app.request('http://localhost/static/js/main.js')
    expect(unversioned.headers.get('Cache-Control')).toBe('public, max-age=300')
  })
})
