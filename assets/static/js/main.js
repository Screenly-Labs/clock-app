// Side-effect import: installs the replaceChildren shim for the older-browser
// degraded mode. Must stay first so the shim is in place before any render.
import '@screenly-labs/signage-kit/polyfills'
import { removeScreenlyBranding } from '@screenly-labs/signage-kit/branding'
import { detectPlayer } from '@screenly-labs/signage-kit/profiler'
import { trackPlayer } from '@screenly-labs/signage-kit/analytics'
import { PLAYER_PROFILE_PATH } from '@screenly-labs/signage-kit/analytics-server'
import { isStalePlayer, mountStaleNotice } from './stale-player.js'
import {
  setLocale,
  setTimeZone,
  setHourFormat,
  formatTimeParts,
  formatDate,
  getZonedHour,
  getDayPeriod
} from './locale.js'

// This file is bundled by esbuild and served as a PLAIN classic <script>.
// It must therefore stay a self-executing IIFE with NO top-level `export`:
// the testable helpers live in ./locale.js (bundled in here), and this file
// exports nothing. That keeps the served bundle loadable by every cached HTML
// variant — both a classic <script> tag and a type="module" tag run a
// self-executing script identically — so a deploy never strands cached pages.
;(() => {
  let clockTimer

  const getCountry = () => document.querySelector('#clock-data')?.dataset.country || ''
  const getTimeZone = () => document.querySelector('#clock-data')?.dataset.timezone || ''
  const getAssetVersion = () => document.querySelector('#clock-data')?.dataset.v || ''

  // Sync the pure-CSS minute progress bar to real wall-clock seconds. The bar
  // animates scaleX 0→1 over 60s on a loop; a negative delay offsets it to the
  // current position so no per-frame JS is needed afterwards.
  const syncMinuteFill = () => {
    const fill = document.querySelector('#minute-fill')
    if (!fill) return
    const now = new Date()
    fill.style.animationDelay = `-${now.getSeconds() + now.getMilliseconds() / 1000}s`
  }

  const renderClock = () => {
    clearTimeout(clockTimer)
    const now = new Date()

    const { time, period, periodFirst } = formatTimeParts(now)
    document.querySelector('#time').textContent = time
    document.querySelector('#ampm').textContent = period
    // ko / zh-Hant etc. print the day period before the time; flag the clock so
    // CSS can reorder the marker instead of always trailing it.
    document.querySelector('.clock')?.classList.toggle('period-first', periodFirst && period !== '')
    document.querySelector('#date').textContent = formatDate(now)
    document.body.dataset.period = getDayPeriod(getZonedHour(now))

    // Re-render exactly on the next minute boundary (the displayed value only
    // changes by the minute); the +50ms guards against firing a hair early.
    const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds()
    clockTimer = setTimeout(renderClock, msToNextMinute + 50)
  }


  // Report the player, preferring the Worker's profile over the browser's.
  //
  // The notice above deliberately uses the SYNCHRONOUS browser profile: it has to render
  // immediately and only needs "old Anthias or not", which the user agent already says.
  // Telemetry can afford to wait and wants the better answer, because only a request
  // carries X-Requested-With, the one signal that names an Android WebView vendor. The
  // endpoint is no-store, so it describes THIS screen and not whichever one missed the
  // page cache.
  //
  // player_stale stays an app judgement rather than a kit field, so it goes as `extra`
  // (event only, since a user property is last-write-wins). It is computed from the
  // profile actually reported, so an enriched profile gives an enriched verdict.
  const reportPlayer = async (browserProfile) => {
    let profile = browserProfile
    try {
      const response = await fetch(PLAYER_PROFILE_PATH, { cache: 'no-store' })
      if (response.ok) profile = await response.json()
    } catch {
      // Keep the browser-built profile.
    }
    trackPlayer(profile, {
      app: 'clock',
      config: {
        hour_format: new URLSearchParams(window.location.search).get('24h') === '1' ? '24' : 'auto'
      },
      extra: { player_stale: String(isStalePlayer(profile)) }
    })
  }

  const init = () => {
    // Location comes from the Cloudflare edge (country + IANA timezone), so the
    // sign shows the local wall clock even if the device's own clock is wrong.
    setLocale(getCountry())
    setTimeZone(getTimeZone())
    // Optional ?24h launch setting (from the signage-app manifest) overrides the
    // locale's default 12/24h clock face; absent => locale decides.
    setHourFormat(new URLSearchParams(window.location.search).get('24h'))
    syncMinuteFill()
    renderClock()
    removeScreenlyBranding()
    // Profile the player once and use it for both consumers below — the two
    // questions ("should this screen be warned?" and "what is out there?") are
    // the same detection, and one call keeps them from ever disagreeing.
    const profile = detectPlayer()
    // Warn old-Anthias viewers that their player is out of date. Client-side on
    // purpose: the SSR page cache is keyed by asset version + country + timezone
    // and carries no user-agent component, so a server-rendered notice would be
    // cached and then served to every player regardless of what it is running.
    mountStaleNotice(profile, document, getAssetVersion())
    // Report to GA4, so the stale-player population we are warning is measurable
    // rather than assumed. Telemetry now comes from the kit, so every app reports the
    // same shape; the local analytics module this replaced was the prototype for it.
    reportPlayer(profile)
  }

  // Only auto-run in a real browser; under a test runner there is no document.
  // The script is loaded async, so wait for the DOM before reading elements.
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init)
    } else {
      init()
    }
  }
})()
