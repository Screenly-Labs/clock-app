import { describe, it, expect } from 'bun:test'
import { detectPlayer } from '@screenly-labs/signage-kit/profiler'
import {
  playerEventParams,
  trackPlayer,
  PLAYER_EVENT,
  UNKNOWN
} from '../assets/static/js/analytics.js'

// The same real UA strings the stale-notice suite pins, so both features are
// asserted against one story about what each player actually sends.
const UA = {
  oldAnthias:
    'Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) QtWebEngine/5.15.2 Chrome/83.0.4103.122 Safari/537.36',
  currentAnthias:
    'Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) QtWebEngine/6.8.2 Chrome/122.0.6261.171 Safari/537.36 Anthias/2026.7.1',
  brightsign:
    'BrightSign/UJE9C2001890/8.0.94 (XT1144)Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) QtWebEngine/5.11.2 Chrome/65.0.3325.230 Safari/537.36',
  screenly:
    'Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) QtWebEngine/5.15.2 Chrome/83.0.4103.122 Safari/537.36 screenly-viewer/2.0',
  bot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
}

const params = (ua) => playerEventParams(detectPlayer(ua, ''))

// A window stub that records what gtag was called with.
const fakeWindow = () => {
  const calls = []
  return { calls, gtag: (...args) => calls.push(args) }
}

describe('playerEventParams', () => {
  it('reports a self-tagged player by vendor, engine and version', () => {
    const p = params(UA.currentAnthias)
    expect(p.player_vendor).toBe('anthias')
    expect(p.player_category).toBe('signage')
    expect(p.player_engine).toBe('qtwebengine')
    expect(p.player_engine_version).toBe(122)
    expect(p.player_below_floor).toBe('false')
    expect(p.player_stale).toBe('false')
  })

  it('marks the untagged old-Anthias bucket as stale with no vendor', () => {
    // The population the whole notice exists for has to be countable, and the
    // profiler will not name a vendor for it — so `player_stale`, not
    // `player_vendor`, is the dimension a report segments on.
    const p = params(UA.oldAnthias)
    expect(p.player_vendor).toBe(UNKNOWN)
    expect(p.player_stale).toBe('true')
    expect(p.player_below_floor).toBe('true')
  })

  it('carries the hardware model when the UA gives one', () => {
    expect(params(UA.brightsign).player_model).toBe('XT1144')
    expect(params(UA.brightsign).player_vendor).toBe('brightsign')
  })

  it('sends nulls as an explicit value, never as an absent param', () => {
    // An omitted param is "(not set)" in GA4, which reads identically to a
    // dimension nobody registered — so "we could not tell" must be its own value.
    const p = params(UA.screenly)
    expect(p.player_model).toBe(UNKNOWN)
    for (const value of Object.values(p)) expect(value).toBeDefined()
  })

  it('keeps engine version numeric so GA4 can aggregate it', () => {
    expect(typeof params(UA.screenly).player_engine_version).toBe('number')
    // A bot has no engine at all; 0 stands in, since GA4 would coerce a string
    // and lose every median across the property.
    expect(params(UA.bot).player_engine_version).toBe(0)
    expect(params(UA.bot).player_engine).toBe(UNKNOWN)
    expect(params(UA.bot).player_category).toBe('bot')
  })

  it('sends an unreadable engine and floor verdict as unknown, not as a guess', () => {
    // `belowFloor` is null when the engine version could not be read; reporting
    // that as `false` would quietly count an unknown player as supported.
    const p = playerEventParams({
      vendor: null,
      platform: null,
      model: null,
      category: 'browser',
      engine: { name: null, version: null },
      belowFloor: null,
      confidence: 'low'
    })
    expect(p.player_engine).toBe(UNKNOWN)
    expect(p.player_engine_version).toBe(0)
    expect(p.player_below_floor).toBe(UNKNOWN)
  })

  it('clamps a value to GA4’s 100-char param limit', () => {
    const p = playerEventParams({
      vendor: null,
      platform: null,
      model: 'M'.repeat(500),
      category: 'signage',
      engine: { name: 'chromium', version: 90 },
      belowFloor: false,
      confidence: 'low'
    })
    expect(p.player_model.length).toBe(100)
  })

  it('names every param within GA4’s 40-char limit and stays under 25 params', () => {
    const p = params(UA.currentAnthias)
    expect(Object.keys(p).length).toBeLessThanOrEqual(25)
    for (const name of Object.keys(p)) {
      expect(name.length).toBeLessThanOrEqual(40)
      expect(name).toMatch(/^[a-z][a-z0-9_]*$/)
    }
  })
})

describe('trackPlayer', () => {
  it('sends one GA4 event carrying the params', () => {
    const win = fakeWindow()
    expect(trackPlayer(detectPlayer(UA.currentAnthias, ''), win)).toBe(true)
    expect(win.calls.length).toBe(1)
    const [command, name, sent] = win.calls[0]
    expect(command).toBe('event')
    expect(name).toBe(PLAYER_EVENT)
    expect(sent.player_vendor).toBe('anthias')
  })

  it('is a silent no-op when gtag is absent', () => {
    // No GA id in dev, and a blocked tag in the field — neither is worth throwing
    // over on an unattended screen that should just keep showing the time.
    expect(trackPlayer(detectPlayer(UA.screenly, ''), {})).toBe(false)
    expect(trackPlayer(detectPlayer(UA.screenly, ''), { gtag: 'not-a-function' })).toBe(false)
  })
})
