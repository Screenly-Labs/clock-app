import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/cloudflare-workers'
import manifest from '__STATIC_CONTENT_MANIFEST'
import App from './components/App'
import signageManifest from '../signage-app.json'

const app = new Hono()

// A short, deploy-stable token derived from the hashed static-asset manifest.
// It changes whenever any asset (JS/CSS/font) changes, which is exactly when a
// deploy ships. Folding it into the page-cache key means a new deploy lands on
// a fresh key instead of serving a previously cached HTML shell that points at
// the previous build's assets. Without this, the 12h SSR page cache outlives a
// deploy and pairs stale HTML with freshly served /static assets.
const ASSET_VERSION = (() => {
  const source = typeof manifest === 'string' ? manifest : JSON.stringify(manifest)
  let hash = 0
  for (let i = 0; i < source.length; i++) {
    hash = (Math.imul(31, hash) + source.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(36)
})()

app.use('*', logger())

// Cache headers for static assets. Asset URLs in the HTML carry ?v=<version>
// (see ASSET_VERSION / the components), so a versioned request is safe to cache
// forever — a content change ships a new ?v and therefore a new URL. Legacy
// unversioned URLs (only referenced by pre-cache-busting HTML still sitting in
// the edge cache) get a short TTL so they can pick up the current bundle.
app.use('/static/*', async (c, next) => {
  await next()
  const versioned = c.req.query('v') !== undefined
  c.header(
    'Cache-Control',
    versioned ? 'public, max-age=31536000, immutable' : 'public, max-age=300'
  )
})
app.use('/static/*', serveStatic({ root: './', manifest }))

// Signage-app manifest: the app-store index and signage players fetch this
// cross-origin to render the settings form and build the launch URL, so it must
// be anonymous, JSON, and CORS-open. Served from the worker (not /static) so the
// dotfile `.well-known/` path and headers are guaranteed regardless of host.
app.get('/.well-known/signage-app.json', (c) => {
  c.header('Content-Type', 'application/json')
  c.header('Access-Control-Allow-Origin', '*')
  c.header('Cache-Control', 'public, max-age=3600')
  return c.body(JSON.stringify(signageManifest))
})

app.get('/', async (c) => {
  const env = c.env.ENV
  // Location comes from the Cloudflare edge, not a hardcoded default: country
  // seeds the client-side locale (12/24h clock, localized date) and timezone is
  // the IANA zone the clock renders its wall time in. Both are server-injected
  // because cf.* is only available at the edge; the device clock isn't trusted.
  const cf = c.req.raw.cf || {}
  const country = cf.country || ''
  const timezone = cf.timezone || ''

  const cache = caches.default
  // Version the page-cache key by the deployed asset bundle so each deploy busts
  // the SSR cache, and by location (country + timezone) so a cached page is
  // never served with another region's locale/zone baked into #clock-data.
  const keyUrl = new URL(c.req.url)
  keyUrl.searchParams.set('v', ASSET_VERSION)
  keyUrl.searchParams.set('c', country)
  keyUrl.searchParams.set('tz', timezone)
  const key = new Request(keyUrl.toString(), c.req.raw)
  let response = await cache.match(key)

  if (!response) {
    const body = (
      <App env={env} country={country} timezone={timezone} v={ASSET_VERSION} />
    ).toString()
    response = new Response(body, {
      status: 200,
      headers: {
        'Cache-Control': 's-maxage=43200',
        'Content-Type': 'text/html; charset=UTF-8'
      }
    })

    c.executionCtx.waitUntil(cache.put(key, response.clone()))
  }

  return response
})

export default app
