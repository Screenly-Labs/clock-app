// Locale and formatting helpers, extracted from main.js so they can be
// unit-tested with a real ES module import. main.js bundles this in at build
// time; keeping these here (and OUT of main.js's exports) is what lets main.js
// stay a plain self-executing browser script with no `export` token — see the
// build note in main.js / Layout.jsx.

const locales = JSON.parse(
  '{"AF":"ps-AF","AL":"sq-AL","DZ":"ar-DZ","AS":"en-AS","AD":"ca","AO":"pt","AI":"en","AQ":"en-US","AG":"en","AR":"es-AR","AM":"hy-AM","AW":"nl","AU":"en-AU","AT":"de-AT","AZ":"az-Cyrl-AZ","BS":"en","BH":"ar-BH","BD":"bn-BD","BB":"en","BY":"be-BY","BE":"nl-BE","BZ":"en-BZ","BJ":"fr-BJ","BM":"en","BT":"dz","BO":"es-BO","BQ":"nl","BA":"bs-BA","BW":"en-BW","BV":"no","BR":"pt-BR","IO":"en","BN":"ms-BN","BG":"bg-BG","BF":"fr-BF","BI":"fr-BI","CV":"kea-CV","KH":"km-KH","CM":"fr-CM","CA":"en-CA","KY":"en","CF":"fr-CF","TD":"fr-TD","CL":"es-CL","CN":"zh-CN","CX":"en","CC":"en","CO":"es-CO","KM":"fr-KM","CD":"fr-CD","CG":"fr-CG","CK":"en","CR":"es-CR","HR":"hr-HR","CU":"es","CW":"nl","CY":"el-CY","CZ":"cs-CZ","CI":"fr-CI","DK":"da-DK","DJ":"fr-DJ","DM":"en","DO":"es-DO","EC":"es-EC","EG":"ar-EG","SV":"es-SV","GQ":"fr-GQ","ER":"ti-ER","EE":"et-EE","SZ":"en","ET":"am-ET","FK":"en","FO":"fo-FO","FJ":"en","FI":"fi-FI","FR":"fr-FR","GF":"fr","PF":"fr","TF":"fr","GA":"fr-GA","GM":"en","GE":"ka-GE","DE":"de-DE","GH":"ak-GH","GI":"en","GR":"el-GR","GL":"kl-GL","GD":"en","GP":"fr-GP","GU":"en-GU","GT":"es-GT","GG":"en","GN":"fr-GN","GW":"pt-GW","GY":"en","HT":"fr","HM":"en","VA":"it","HN":"es-HN","HK":"en-HK","HU":"hu-HU","IS":"is-IS","IN":"hi-IN","ID":"id-ID","IR":"fa-IR","IQ":"ar-IQ","IE":"en-IE","IM":"en","IL":"he-IL","IT":"it-IT","JM":"en-JM","JP":"ja-JP","JE":"en","JO":"ar-JO","KZ":"kk-Cyrl-KZ","KE":"ebu-KE","KI":"en","KP":"ko","KR":"ko-KR","KW":"ar-KW","KG":"ky","LA":"lo","LV":"lv-LV","LB":"ar-LB","LS":"en","LR":"en","LY":"ar-LY","LI":"de-LI","LT":"lt-LT","LU":"fr-LU","MO":"zh-Hans-MO","MG":"fr-MG","MW":"en","MY":"ms-MY","MV":"dv","ML":"fr-ML","MT":"en-MT","MH":"en-MH","MQ":"fr-MQ","MR":"ar","MU":"en-MU","YT":"fr","MX":"es-MX","FM":"en","MD":"ro-MD","MC":"fr-MC","MN":"mn","ME":"sr-Cyrl-ME","MS":"en","MA":"ar-MA","MZ":"pt-MZ","MM":"my-MM","NA":"en-NA","NR":"en","NP":"ne-NP","NL":"nl-NL","AN":"nl-AN","NC":"fr","NZ":"en-NZ","NI":"es-NI","NE":"fr-NE","NG":"ha-Latn-NG","NU":"en","NF":"en","MK":"mk-MK","MP":"en-MP","NO":"nb-NO","OM":"ar-OM","PK":"en-PK","PW":"en","PS":"ar","PA":"es-PA","PG":"en","PY":"es-PY","PE":"es-PE","PH":"en-PH","PN":"en","PL":"pl-PL","PT":"pt-PT","PR":"es-PR","QA":"ar-QA","RO":"ro-RO","RU":"ru-RU","RW":"fr-RW","RE":"fr-RE","BL":"fr-BL","SH":"en","KN":"en","LC":"en","MF":"fr-MF","PM":"fr","VC":"en","WS":"sm","SM":"it","ST":"pt","SA":"ar-SA","SN":"fr-SN","RS":"sr-Cyrl-RS","SC":"fr","SL":"en","SG":"en-SG","SX":"nl","SK":"sk-SK","SI":"sl-SI","SB":"en","SO":"so-SO","ZA":"af-ZA","GS":"en","SS":"en","ES":"es-ES","LK":"si-LK","SD":"ar-SD","SR":"nl","SJ":"no","SE":"sv-SE","CH":"fr-CH","SY":"ar-SY","TW":"zh-Hant-TW","TJ":"tg","TZ":"asa-TZ","TH":"th-TH","TL":"pt","TG":"fr-TG","TK":"en","TO":"to-TO","TT":"en-TT","TN":"ar-TN","TR":"tr-TR","TM":"tk","TC":"en","TV":"en","UG":"cgg-UG","UA":"uk-UA","AE":"ar-AE","GB":"en-GB","UM":"en-UM","US":"en-US","UY":"es-UY","UZ":"uz-Cyrl-UZ","VU":"bi","VE":"es-VE","VN":"vi-VN","VG":"en","VI":"en-VI","WF":"fr","EH":"es","YE":"ar-YE","ZM":"bem-ZM","ZW":"en-ZW","AX":"sv","XK":"sq"}'
)

// Default locale when the country is unknown. en-GB gives 24h time and neutral
// English month/day names (better for signage than the player's own device
// locale, which is effectively random).
const FALLBACK_LOCALE = 'en-GB'

// Right-to-left primary language subtags that appear in the locale map.
const rtlLanguages = ['ar', 'fa', 'he', 'ps', 'dv', 'ur', 'ckb', 'sd', 'yi']

// BCP-47 locale for the viewer, the IANA timezone of the viewer's location, and
// the cached Intl formatters built from both. timeZone is undefined until the
// Cloudflare-derived value is applied, in which case Intl uses the runtime's
// own zone (the signage device's clock).
let locale = FALLBACK_LOCALE
let timeZone
let timeFormatter
let dateFormatterLong
let dateFormatterShort
let hourFormatter

// Only pass timeZone to Intl when it is a non-empty, valid IANA name; an
// invalid zone makes the DateTimeFormat constructor throw.
const zoneOpt = () => (timeZone ? { timeZone } : {})

const buildFormatters = () => {
  // Pin the Gregorian calendar so the date is stable across locales (e.g. ar-SA
  // would otherwise render a Hijri date). Names, ordering and numerals stay
  // localized; Intl also picks 12h vs 24h and AM/PM per locale. The timeZone
  // makes every formatter render the location's wall clock from an absolute
  // instant, independent of the device's own timezone.
  const z = zoneOpt()
  const timeOpts = { hour: 'numeric', minute: '2-digit', ...z }
  const dateLongOpts = { weekday: 'long', month: 'long', day: 'numeric', calendar: 'gregory', ...z }
  const dateShortOpts = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    calendar: 'gregory',
    ...z
  }
  // hour12:false in a neutral locale so the parsed hour drives the day-period
  // band (dawn/day/dusk/night) in the location's timezone.
  const hourOpts = { hour: 'numeric', hour12: false, ...z }
  try {
    timeFormatter = new Intl.DateTimeFormat(locale, timeOpts)
    dateFormatterLong = new Intl.DateTimeFormat(locale, dateLongOpts)
    dateFormatterShort = new Intl.DateTimeFormat(locale, dateShortOpts)
    hourFormatter = new Intl.DateTimeFormat('en-GB', hourOpts)
  } catch {
    // Malformed locale or timezone string: drop the timezone and fall back to a
    // safe locale rather than break the clock.
    locale = FALLBACK_LOCALE
    timeZone = undefined
    timeFormatter = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' })
    dateFormatterLong = new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      calendar: 'gregory'
    })
    dateFormatterShort = new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      calendar: 'gregory'
    })
    hourFormatter = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false })
  }
}

export const resolveLocale = (code) => locales[code] || FALLBACK_LOCALE

// Apply the Cloudflare-derived IANA timezone (e.g. "America/New_York"). Passing
// a falsy value clears it, so the clock uses the device's own zone.
export const setTimeZone = (tz) => {
  timeZone = tz || undefined
  buildFormatters()
}

export const setLocale = (code) => {
  locale = resolveLocale(code)
  buildFormatters()
  // Only the time and date render in the viewer's language; tag just those
  // elements with the right lang/dir so RTL scripts (e.g. ar) and assistive
  // tech are handled without mirroring the whole (English, LTR) layout.
  if (typeof document !== 'undefined') {
    const dir = rtlLanguages.includes(locale.split('-')[0]) ? 'rtl' : 'ltr'
    for (const id of ['date', 'time']) {
      const el = document.querySelector(`#${id}`)
      if (el) {
        el.lang = locale
        el.dir = dir
      }
    }
  }
}

// Build defaults up front so the clock works even before setLocale is called.
buildFormatters()

// Full localized time string, e.g. "9:30 AM" (12h locales) or "14:30" (24h).
export const formatTime = (dateObj) => timeFormatter.format(dateObj)

// Time split into the clock face ("9:30") and the day period ("AM"/"PM"), so
// the UI can typeset the period as a smaller marker. The period is '' for 24h
// locales (no dayPeriod part), which the UI hides.
export const formatTimeParts = (dateObj) => {
  const parts = timeFormatter.formatToParts(dateObj)
  const period = parts.find((p) => p.type === 'dayPeriod')?.value || ''
  const time = parts
    .filter((p) => p.type !== 'dayPeriod' && p.type !== 'literal')
    .map((p) => p.value)
    .join(':')
  return { time, period }
}

export const formatDate = (dateObj) => {
  const wide = typeof window === 'undefined' || window.innerWidth >= 480
  const formatter = wide ? dateFormatterLong : dateFormatterShort
  return formatter.format(dateObj)
}

// Hour (0–23) of an absolute instant in the active timezone — feeds getDayPeriod.
export const getZonedHour = (dateObj) => Number.parseInt(hourFormatter.format(dateObj), 10)

// Coarse time-of-day band used to drive the ambient accent (dawn / day / dusk /
// night), the clock analogue of the weather app's condition-reactive accent.
export const getDayPeriod = (hour) => {
  if (hour >= 5 && hour < 8) return 'dawn'
  if (hour >= 8 && hour < 17) return 'day'
  if (hour >= 17 && hour < 20) return 'dusk'
  return 'night'
}
