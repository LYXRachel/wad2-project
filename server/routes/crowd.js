import express from 'express'
import { requireAuth } from './auth.js'
import { sharedCache, cacheAndFetch, DAY } from '../sharedCache.js'

const router = express.Router()
// 'name|address' -> forecast. A saved forecast is used when BestTime has none, for up to 30 days.
const forecasts = sharedCache('crowd-forecasts', { keepDays: 30 })

// ---------- Guess a sensible default from the place's name/type ----------
// Checked in order; first match wins.
// [words to look for, best time, typical hours spent, category for the typical pattern]
const PLACE_RULES = [
  [['night market'], 'night', 2, 'nightMarket'],
  [['night_club', 'bar', 'itaewon', 'nightlife'], 'night', 2, 'evening'],
  [['street', 'shopping district'], 'night', 2, 'shopping'],
  [['tower', 'observation', 'skypark', 'sky park', 'skydeck', 'viewpoint'], 'sunset', 1.5, 'evening'],
  [['great wall', 'hike', 'hiking', 'trail', 'mountain', 'natural_feature'], 'morning', 3, 'nature'],
  [['zoo', 'aquarium', 'amusement_park', 'theme park'], 'morning', 4, 'museum'],
  [['park', 'garden', 'beach', 'palace', 'temple', 'shrine'], 'morning', 1.5, 'park'],
  [['museum', 'art_gallery', 'gallery'], 'any', 2, 'museum'],
  [['shopping_mall', 'mall', 'market', 'store'], 'afternoon', 2, 'shopping'],
  [['restaurant', 'cafe', 'food'], 'any', 1.5, 'restaurant']
]

function guessDefaults(name, venueTypes) {
  const text = (name + ' ' + venueTypes.join(' ')).toLowerCase()
  for (const [words, bestTime, hours, category] of PLACE_RULES) {
    for (const word of words) {
      if (text.includes(word)) return { bestTimeDefault: bestTime, durationDefault: hours, category }
    }
  }
  return { bestTimeDefault: 'any', durationDefault: 1.5, category: 'general' }
}

// ---------- opening hours ----------
// BestTime's busyness for one day: 24 numbers, index 0 = 6 AM. The hours with visitors -> { open, close }, or null.
function hoursFromRaw(raw) {
  if (!Array.isArray(raw)) return null
  let first = -1
  let last = -1
  raw.forEach((v, i) => {
    if (v > 0) {
      if (first < 0) first = i
      last = i
    }
  })
  return first < 0 ? null : { open: 6 + first, close: 6 + last + 1 } // (after midnight runs past 24, like closes-after-midnight)
}

// "Closed" must mean closed: BestTime listing a week of opening times but none for this day, and no visitors.
// No times at all (BestTime just doesn't know) is not closed: the hours with visitors are used instead,
// or none (unknown, so no warning). Also fixes days saved before this rule (they said closed for "unknown").
function settleHours(day, listedWeek) {
  if (day.open != null || !day.closed) return { ...day, closed: false }
  const seen = hoursFromRaw(day.raw)
  if (seen) return { ...day, open: seen.open, close: seen.close, closed: false }
  return { ...day, closed: !!listedWeek }
}

// ---------- Turn BestTime's big response into the small shape our app needs ----------
function simplify(name, address, data) {
  const venueTypes = (data.venue_info && data.venue_info.venue_types) || []
  const defaults = guessDefaults(name, venueTypes)

  // Use BestTime's average visit length if it has one (minutes -> hours, rounded to 0.5)
  const dwell = data.venue_info && data.venue_info.venue_dwell_time_avg
  if (dwell > 0) defaults.durationDefault = Math.max(0.5, Math.round(dwell / 30) / 2)

  const days = {}
  // Does BestTime list opening times for this place at all (then a day without any is a closed day)?
  const listedWeek = data.analysis.some((a) => a.day_info.venue_open_close_v2)
  for (const a of data.analysis) {
    const info = a.day_info
    const v2 = info.venue_open_close_v2
    let open = null
    let close = null

    if (v2 && v2.open_24h) {
      open = 0
      close = 24
    } else if (v2 && v2['24h'] && v2['24h'].length > 0) {
      const first = v2['24h'][0]
      const last = v2['24h'][v2['24h'].length - 1]
      open = first.opens + (first.opens_minutes || 0) / 60
      close = last.closes + (last.closes_minutes || 0) / 60
      if (close <= open) close += 24 // closes after midnight
    } else if (v2) {
      // v2 present but no opening times listed = closed all day (e.g. palace on Tuesdays)
      open = null
    } else if (typeof info.venue_open === 'number' && typeof info.venue_closed === 'number' && info.venue_open !== info.venue_closed) {
      open = info.venue_open
      close = info.venue_closed <= open ? info.venue_closed + 24 : info.venue_closed
    }

    days[info.day_text] = settleHours({
      open,
      close,
      closed: open === null,
      raw: a.day_raw // 24 values, index 0 = 6am
    }, listedWeek)
    days[info.day_text].hoursChecked = true
  }

  return {
    found: true,
    venueType: venueTypes[0] || (data.venue_info && data.venue_info.venue_type) || 'unknown',
    ...defaults,
    days
  }
}

// GET /api/crowd?name=N Seoul Tower&address=105 Namsangongwon-gil, Seoul&lat=37.55&lon=126.99
// Only for places with a map point (picked from search, a pin or a Maps link); the address is the one that came with it.
// Logged-in users only, so strangers can't spend our BestTime credits.
// No forecast from BestTime and none saved -> 404 "no crowd data" (nothing is made up).
router.get('/', requireAuth, async (req, res) => {
  const name = (req.query.name || '').trim()
  const address = (req.query.address || '').trim()
  const point = { lat: Number(req.query.lat), lon: Number(req.query.lon) }
  if (!name || !address) {
    return res.status(400).json({ message: 'Please give both a place name and an address.' })
  }
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon) || Math.abs(point.lat) > 90 || Math.abs(point.lon) > 180) {
    return res.status(400).json({ message: 'This place has no location yet. Set its location first.' })
  }
  if (!process.env.BESTTIME_PRIVATE_KEY) {
    return res.status(503).json({ message: 'Crowd data is not set up yet (BESTTIME_PRIVATE_KEY missing in server/.env).' })
  }

  const got = await cacheAndFetch(forecasts, (name + '|' + address).toLowerCase(), async () => {
    const params = new URLSearchParams({ api_key_private: process.env.BESTTIME_PRIVATE_KEY, venue_name: name, venue_address: address })
    const response = await fetch('https://besttime.app/api/v1/forecasts?' + params, { method: 'POST', signal: AbortSignal.timeout(20000) })
    const data = await response.json()
    if (data.status !== 'OK') {
      console.warn('BestTime has no forecast for "' + name + '":', data.message)
      return null
    }
    // (BestTime echoes our private key back: only the simplified forecast is kept, never the raw response)
    return { name, address, ...simplify(name, address, data), fetchedAt: new Date().toISOString() }
  }, { maxAgeMs: 30 * DAY })
  if (!got) return res.status(404).json({ message: 'No crowd data for this place.' })
  res.json(got.value)
})

export default router

// Exported so it can be unit-tested without calling BestTime
export { simplify, guessDefaults }
