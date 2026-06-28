import { describe, expect, it } from 'bun:test'

// Whole-map coverage. The hand-picked spot checks in locale.test.js only touch
// a few of the 250+ country->locale mappings, so a stale or unsupported entry
// (e.g. a language with no Unicode CLDR data) used to slip through CI silently.
// These tests walk every entry and fail if any of them stops localizing.
//
// Caveat: this runs under the test runtime's ICU, not the viewer's browser.
// Data availability is ultimately a property of the device's engine, but a
// full-table assertion is the strongest automated guard we can run in CI and it
// catches the regressions a spot check cannot.
import { COUNTRY_LOCALES } from '../assets/static/js/locale.js'

const INSTANT = new Date('2026-06-20T13:30:00Z')
const DATE_OPTS = { weekday: 'long', month: 'long', day: 'numeric', calendar: 'gregory' }
const enMonth = new Intl.DateTimeFormat('en', { month: 'long' }).format(INSTANT) // "June"

describe('locale map coverage (every country -> locale entry)', () => {
  it('has a non-empty table', () => {
    expect(Object.keys(COUNTRY_LOCALES).length).toBeGreaterThan(200)
  })

  it('builds a working date+time formatter for every entry (none throw)', () => {
    const offenders = []
    for (const [cc, loc] of Object.entries(COUNTRY_LOCALES)) {
      try {
        new Intl.DateTimeFormat(loc, DATE_OPTS).format(INSTANT)
        new Intl.DateTimeFormat(loc, { hour: 'numeric', minute: '2-digit' }).format(INSTANT)
      } catch (e) {
        offenders.push(`${cc}:${loc} (${e.message})`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('does not silently fall back to a different language', () => {
    // ICU substitutes another language when it lacks data for the requested one
    // (e.g. "dv" -> "en"). Such entries render the wrong language with no error;
    // map them to "en" explicitly instead (see the note in locale.js).
    const offenders = []
    for (const [cc, loc] of Object.entries(COUNTRY_LOCALES)) {
      const resolved = new Intl.DateTimeFormat(loc).resolvedOptions().locale
      if (loc.split('-')[0] !== resolved.split('-')[0]) {
        offenders.push(`${cc}: requested ${loc} -> resolved ${resolved}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('renders localized month names for every non-English locale', () => {
    const offenders = []
    for (const [cc, loc] of Object.entries(COUNTRY_LOCALES)) {
      if (loc.split('-')[0] === 'en') continue // English locales are English by definition
      const month = new Intl.DateTimeFormat(loc, { month: 'long' }).format(INSTANT)
      if (month === enMonth) offenders.push(`${cc}:${loc}`)
    }
    expect(offenders).toEqual([])
  })
})
