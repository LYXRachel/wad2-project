import express from 'express'
import { requireAuth } from './auth.js'
import { sharedCache, cacheAndFetch } from '../sharedCache.js'

const router = express.Router()

// A saved answer (in the database) is used when Aviationstack has none, for up to 15 minutes.
// (The free plan allows about 100 requests a month.)
const cache = sharedCache('flights', { keepDays: 2 })
const MAX_AGE = 15 * 60 * 1000

// GET /api/flights?flight=KE621
router.get('/', requireAuth, async (req, res) => {
  const flight = String(req.query.flight || '').trim().toUpperCase()
  if (!/^[A-Z0-9]{2,8}$/.test(flight)) {
    return res.status(400).json({ message: 'Please give a flight number like KE621.' })
  }
  if (!process.env.AVIATIONSTACK_API_KEY) {
    return res.status(503).json({ message: 'Flights are not set up yet (AVIATIONSTACK_API_KEY missing in server/.env).' })
  }

  const got = await cacheAndFetch(cache, flight, async () => {
    const params = new URLSearchParams({ access_key: process.env.AVIATIONSTACK_API_KEY, flight_iata: flight })
    const response = await fetch('http://api.aviationstack.com/v1/flights?' + params, { signal: AbortSignal.timeout(10000) })
    const body = await response.json()
    if (body.error) throw new Error('Aviationstack: ' + body.error.message)
    const f = body.data && body.data[0]
    if (!f) return null

    // Delay = how much later than scheduled the flight arrives (or arrived).
    // Comparing the times is more reliable than the API's "delay" field.
    const arr = f.arrival || {}
    const arrivedAt = arr.actual || arr.estimated
    let delayMinutes
    if (arr.scheduled && arrivedAt) {
      delayMinutes = Math.round((new Date(arrivedAt) - new Date(arr.scheduled)) / 60000)
    } else {
      delayMinutes = arr.delay || 0
    }
    return {
      flight,
      status: f.flight_status,
      delayMinutes: Math.max(0, delayMinutes), // early arrivals count as 0, not negative
      originalArrival: arr.scheduled,
      newArrival: arrivedAt
    }
  }, { maxAgeMs: MAX_AGE })
  if (!got) return res.status(404).json({ message: 'No live data for that flight right now.' })
  res.json(got.value)
})

export default router