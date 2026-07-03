import { describe, expect, it } from 'bun:test'

// Unit tests for the client-side locale logic in assets/static/js/locale.js.
// These pure helpers were extracted from main.js into their own ES module so
// they can be imported directly here, while main.js stays an export-free
// self-executing browser script (bundled with locale.js inlined).
import {
  resolveLocale,
  setLocale,
  setTimeZone,
  setHourFormat,
  formatTime,
  formatTimeParts,
  formatDate,
  getZonedHour,
  getDayPeriod
} from '../assets/static/js/locale.js'

// A fixed absolute instant: Saturday 2026-06-20 13:30:00 UTC. Pairing it with an
// explicit timezone makes every assertion independent of the machine timezone.
const INSTANT = new Date('2026-06-20T13:30:00Z')

describe('resolveLocale', () => {
  it('maps known country codes to their locale', () => {
    expect(resolveLocale('US')).toBe('en-US')
    expect(resolveLocale('FR')).toBe('fr-FR')
    expect(resolveLocale('JP')).toBe('ja-JP')
    expect(resolveLocale('PR')).toBe('es-PR')
  })

  it('falls back to en-GB for unknown / missing codes', () => {
    expect(resolveLocale('ZZ')).toBe('en-GB')
    expect(resolveLocale('')).toBe('en-GB')
    expect(resolveLocale(undefined)).toBe('en-GB')
  })
})

describe('time formatting (12h / 24h, localized, zoned)', () => {
  it('renders a 12-hour clock with AM/PM for en-US', () => {
    setLocale('US')
    setTimeZone('America/New_York')
    const { time, period } = formatTimeParts(INSTANT)
    expect(time).toBe('9:30')
    expect(period).toMatch(/AM/i)
  })

  it('renders a 24-hour clock with no day period for en-GB / fr-FR / de-DE', () => {
    setLocale('GB')
    setTimeZone('Europe/London')
    let parts = formatTimeParts(INSTANT)
    expect(parts.time).toBe('14:30')
    expect(parts.period).toBe('')

    setLocale('FR')
    setTimeZone('Europe/Paris')
    parts = formatTimeParts(INSTANT)
    expect(parts.time).toBe('15:30')
    expect(parts.period).toBe('')
  })

  it('keeps the day period before the time for ko / zh-Hant (periodFirst)', () => {
    setLocale('KR')
    setTimeZone('Asia/Seoul')
    // 13:30 UTC -> 22:30 Seoul, i.e. 10:30 PM. Korean prints "오후 10:30".
    let parts = formatTimeParts(INSTANT)
    expect(parts.time).toBe('10:30')
    expect(parts.period).not.toBe('')
    expect(parts.periodFirst).toBe(true)

    // en-US prints the period last.
    setLocale('US')
    setTimeZone('America/New_York')
    parts = formatTimeParts(INSTANT)
    expect(parts.periodFirst).toBe(false)
  })

  it('preserves the locale-native hour:minute separator', () => {
    // Finnish uses "." rather than ":" between hour and minute.
    setLocale('FI')
    setTimeZone('Europe/Helsinki')
    expect(formatTimeParts(INSTANT).time).toBe('16.30')
  })

  it('renders the location wall clock from its IANA timezone', () => {
    setLocale('JP')
    setTimeZone('Asia/Tokyo')
    expect(formatTime(INSTANT)).toBe('22:30')
  })

  it('falls back to the device zone when the timezone is cleared', () => {
    setLocale('GB')
    setTimeZone('')
    // No throw, and a well-formed 24h string for en-GB.
    expect(formatTime(INSTANT)).toMatch(/^\d{1,2}:\d{2}$/)
  })
})

describe('setHourFormat (?24h launch setting override)', () => {
  // Force a locale whose native convention is the opposite of each override, so a
  // passing assertion proves the override — not the locale default — is in effect.
  it("forces 24-hour with '1' even for a 12h locale (en-US)", () => {
    setLocale('US')
    setTimeZone('America/New_York')
    setHourFormat('1')
    const { time, period } = formatTimeParts(INSTANT)
    // 13:30 UTC -> 09:30 New York (EDT), shown 24-hour with no AM/PM part.
    expect(time).toBe('09:30')
    expect(period).toBe('')
    setHourFormat('')
  })

  it("forces 12-hour with '0' even for a 24h locale (en-GB)", () => {
    setLocale('GB')
    setTimeZone('Europe/London')
    setHourFormat('0')
    const { time, period } = formatTimeParts(INSTANT)
    expect(time).toBe('2:30')
    expect(period).toMatch(/PM/i)
    setHourFormat('')
  })

  it("follows the locale default for '' / null / unknown values", () => {
    setLocale('US')
    setTimeZone('America/New_York')
    setHourFormat('1')
    // Clearing the override restores en-US's native 12-hour clock.
    setHourFormat('')
    expect(formatTimeParts(INSTANT).period).toMatch(/AM/i)
    setHourFormat(null)
    expect(formatTimeParts(INSTANT).period).toMatch(/AM/i)
    setHourFormat('bogus')
    expect(formatTimeParts(INSTANT).period).toMatch(/AM/i)
  })
})

describe('date localization', () => {
  it('renders month/weekday names in the location language', () => {
    setLocale('US')
    setTimeZone('America/New_York')
    expect(formatDate(INSTANT)).toMatch(/June/)

    setLocale('FR')
    setTimeZone('Europe/Paris')
    expect(formatDate(INSTANT)).toMatch(/juin/)

    setLocale('DE')
    setTimeZone('Europe/Berlin')
    expect(formatDate(INSTANT)).toMatch(/Juni/)
  })

  it('pins the Gregorian calendar even for ar-SA (not Hijri)', () => {
    setLocale('SA')
    setTimeZone('Asia/Riyadh')
    const date = formatDate(INSTANT)
    // Gregorian day 20 (Latin or Arabic-Indic digits, depending on ICU);
    // a Hijri rendering would show day 5 in Muharram instead.
    expect(date).toMatch(/20|٢٠/)
    expect(date).not.toMatch(/محرم/) // محرم (Muharram)
  })
})

describe('getZonedHour + getDayPeriod (time-of-day accent)', () => {
  it('reads the hour in the active timezone', () => {
    setTimeZone('Asia/Tokyo')
    expect(getZonedHour(INSTANT)).toBe(22)
    setTimeZone('America/New_York')
    expect(getZonedHour(INSTANT)).toBe(9)
  })

  it('bands the hour into dawn / day / dusk / night', () => {
    expect(getDayPeriod(6)).toBe('dawn')
    expect(getDayPeriod(12)).toBe('day')
    expect(getDayPeriod(18)).toBe('dusk')
    expect(getDayPeriod(23)).toBe('night')
    expect(getDayPeriod(3)).toBe('night')
  })
})
