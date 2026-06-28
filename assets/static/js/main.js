import {
  setLocale,
  setTimeZone,
  formatTimeParts,
  formatDate,
  getZonedHour,
  getDayPeriod
} from './locale.js'

// This file is bundled by Bun.build and served as a PLAIN classic <script>.
// It must therefore stay a self-executing IIFE with NO top-level `export`:
// the testable helpers live in ./locale.js (bundled in here), and this file
// exports nothing. That keeps the served bundle loadable by every cached HTML
// variant — both a classic <script> tag and a type="module" tag run a
// self-executing script identically — so a deploy never strands cached pages.
;(() => {
  let clockTimer
  let ctaTimer

  const generateAnalyticsEvent = (name, payload) => {
    typeof gtag !== 'undefined' && gtag('event', name, payload)
  }

  const getCountry = () => document.querySelector('#clock-data')?.dataset.country || ''
  const getTimeZone = () => document.querySelector('#clock-data')?.dataset.timezone || ''

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

    const { time, period } = formatTimeParts(now)
    document.querySelector('#time').textContent = time
    document.querySelector('#ampm').textContent = period
    document.querySelector('#date').textContent = formatDate(now)
    document.body.dataset.period = getDayPeriod(getZonedHour(now))

    // Re-render exactly on the next minute boundary (the displayed value only
    // changes by the minute); the +50ms guards against firing a hair early.
    const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds()
    clockTimer = setTimeout(renderClock, msToNextMinute + 50)
  }

  /**
   * Rotating Screenly call-to-action.
   *
   * The banner is only shown on non-Screenly devices (a browser tab or a rival
   * signage system), so the copy pitches the viewer to switch to Screenly. It
   * is non-interactive (a digital sign has no cursor/touch) and surfaces
   * screenly.io as the destination a viewer types in themselves.
   */
  const ctaMessages = [
    'Powerful, secure, simple digital signage',
    'Secure by default: SOC 2, zero-trust',
    'Manage every screen from anywhere',
    'Run Screenly on hardware you already own',
    'Powering 10,000+ screens worldwide'
  ]
  let ctaIndex = 0

  const rotateCta = () => {
    const msg = document.querySelector('#cta-msg')
    if (!msg) return

    ctaIndex = (ctaIndex + 1) % ctaMessages.length
    const next = ctaMessages[ctaIndex]
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false

    if (reduceMotion) {
      msg.textContent = next
      return
    }

    msg.classList.add('is-out')
    setTimeout(() => {
      msg.textContent = next
      msg.classList.remove('is-out')
    }, 450)
  }

  const setBanner = () => {
    const banner = document.querySelector('.upgrade-banner')
    const { userAgent } = navigator
    const isScreenlyDevice = userAgent.includes('screenly-viewer')

    if (banner && !isScreenlyDevice) {
      banner.classList.add('visible')
      clearInterval(ctaTimer)
      ctaTimer = setInterval(rotateCta, 5000)
    }

    generateAnalyticsEvent('device', {
      app_name: 'Screenly Clock App',
      screenly_device: isScreenlyDevice
    })
  }

  const init = () => {
    // Location comes from the Cloudflare edge (country + IANA timezone), so the
    // sign shows the local wall clock even if the device's own clock is wrong.
    setLocale(getCountry())
    setTimeZone(getTimeZone())
    syncMinuteFill()
    renderClock()
    setBanner()
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
