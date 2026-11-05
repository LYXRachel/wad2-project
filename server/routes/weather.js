import express from 'express'
import { requireAuth } from './auth.js'
import { sharedCache, cacheAndFetch, DAY } from '../sharedCache.js'

const router = express.Router()

// (kept in the database: see sharedCache.js for how saved answers and the service are combined)
const weatherCache = sharedCache('weather', { keepDays: 1 })        // "lat,lon" -> forecast
const placeCache = sharedCache('weather-places', { keepDays: 365 }) // "kyoto, japan" -> { lat, lon }
const FORECAST_MAX_AGE = 12 * 60 * 60 * 1000 // an older forecast is not shown

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error('OpenWeather ' + res.status + ': ' + (await res.text()).slice(0, 200))
  return res.json()
}

// GET /api/weather?lat=37.56&lon=126.97   OR   /api/weather?q=Kyoto, Japan
router.get('/', requireAuth, async (req, res) => {
  const key = process.env.OPENWEATHER_API_KEY
  if (!key) {
    return res.status(503).json({ message: 'Weather is not set up yet (OPENWEATHER_API_KEY missing in server/.env).' })
  }

  let lat = Number(req.query.lat)
  let lon = Number(req.query.lon)

  // A place name: its coordinates
  if (req.query.q) {
    const q = String(req.query.q).slice(0, 100)
    const place = await cacheAndFetch(placeCache, q.toLowerCase(), async () => {
      const geo = await getJson('https://api.openweathermap.org/geo/1.0/direct?' + new URLSearchParams({ q, limit: '1', appid: key }))
      return geo.length ? { lat: geo[0].lat, lon: geo[0].lon } : null
    }, { maxAgeMs: 365 * DAY })
    if (!place) return res.status(404).json({ message: 'No weather data for that destination.' })
    lat = place.value.lat
    lon = place.value.lon
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ message: 'Please give lat and lon, or a place name (q).' })
  }

  const cacheKey = lat.toFixed(2) + ',' + lon.toFixed(2)
  const got = await cacheAndFetch(weatherCache, cacheKey, async () => {
    const data = await getJson('https://api.openweathermap.org/data/2.5/forecast?' + new URLSearchParams({ lat, lon, units: 'metric', appid: key }))
    return data.list && data.list.length ? { city: { timezone: data.city.timezone }, list: data.list } : null
  }, { maxAgeMs: FORECAST_MAX_AGE })
  if (!got) return res.status(404).json({ message: 'No weather data right now.' })
  res.json(got.value)
})

export default router
