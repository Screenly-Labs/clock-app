// GA4 player telemetry: reports which player is showing the clock, from the
// profile signage-kit already builds for the stale-player notice. Extracted from
// main.js so the param mapping can be unit-tested with a real ES module import —
// main.js bundles this in and must stay export-free (see the build note there).
//
// Client-side on purpose, for the same reason the stale notice is: the SSR page
// cache is keyed by asset version + country + timezone and carries no user-agent
// component, so a server-side `detectPlayerFromRequest` would profile whichever
// player happened to miss the cache and then attribute every subsequent hit to
// it. The page has to report itself.

import { isStalePlayer } from './stale-player.js'

// GA4 has no null and no boolean in a param value — an absent param just makes
// the dimension read "(not set)", which is indistinguishable from "we never
// registered it". Send the profiler's nulls as an explicit value instead, so
// "we looked and could not tell" is its own bucket in a report.
export const UNKNOWN = 'unknown'

// GA4 truncates a param value at 100 chars and drops the event if a param name
// exceeds 40. Names here are well inside that; `model` is the only free-form
// value (parsed straight out of a UA) so it is the only one worth clamping.
const MAX_VALUE = 100

const str = (value) => (value == null ? UNKNOWN : String(value).slice(0, MAX_VALUE))
const bool = (value) => (value == null ? UNKNOWN : String(value))

export const PLAYER_EVENT = 'player_detected'

// Flatten a PlayerProfile into GA4 event params. Every field is prefixed
// `player_` because these become custom dimensions in a property shared with the
// other Screenly-Labs apps, where an unprefixed `vendor` or `model` would be
// ambiguous.
//
// `sources` is deliberately not sent: in the browser only the user agent and
// referrer are readable (the X-Requested-With header is not exposed to page JS),
// so it is near-constant here and would spend a custom dimension on nothing.
export const playerEventParams = (profile) => ({
  player_vendor: str(profile.vendor),
  player_platform: str(profile.platform),
  player_model: str(profile.model),
  player_category: str(profile.category),
  // `engine` is always an object off detectPlayer (its fields are what go null),
  // same assumption isStalePlayer makes about the very same profile.
  player_engine: str(profile.engine.name),
  // A number stays a number: this is the one field worth taking a median of, and
  // GA4 will only do that for a numeric param.
  player_engine_version: profile.engine.version ?? 0,
  player_below_floor: bool(profile.belowFloor),
  player_confidence: str(profile.confidence),
  // Sent even though it is derivable from vendor + engine, because the
  // definition of "stale" is a judgement call this app makes (see the note in
  // stale-player.js) rather than something a report author should re-derive —
  // and it is what makes notice impressions countable against upgrades.
  player_stale: String(isStalePlayer(profile))
})

// Report the profile, once. `gtag` is absent whenever the env has no GA id (dev)
// or the tag was blocked/failed to load, which is not an error worth surfacing on
// an unattended screen — the clock is the product, telemetry is not. Returns
// whether the event went out, so the caller and the tests can tell the no-op
// case apart.
export const trackPlayer = (profile, win = typeof window !== 'undefined' ? window : undefined) => {
  if (typeof win?.gtag !== 'function') return false
  win.gtag('event', PLAYER_EVENT, playerEventParams(profile))
  return true
}
