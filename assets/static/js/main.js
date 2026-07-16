// Side-effect import: installs the replaceChildren shim for the older-browser
// degraded mode. Must stay first so the shim is in place before any render.
import '@screenly-labs/signage-kit/polyfills'
import { removeScreenlyBranding } from '@screenly-labs/signage-kit/branding'
import { detectPlayer } from '@screenly-labs/signage-kit/profiler'
import { mountStaleNotice } from './stale-player.js'
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
    // Warn old-Anthias viewers that their player is out of date. Client-side on
    // purpose: the SSR page cache is keyed by asset version + country + timezone
    // and carries no user-agent component, so a server-rendered notice would be
    // cached and then served to every player regardless of what it is running.
    mountStaleNotice(detectPlayer(), document, getAssetVersion())
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
