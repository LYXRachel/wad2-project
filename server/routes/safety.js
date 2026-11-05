import express from 'express'
import { requireAuth } from './auth.js'
import { askOverpassFast } from './places.js'
import { geoapifyReady, geoapifySearch } from '../geoapify.js'
import { sharedCache, cacheAndFetch } from '../sharedCache.js'
import { AIRPORTS } from '../../shared/airports.js'

// Safety tab helpers. These run on our server (not in the browser) so that:
//  - busy OpenStreetMap servers are retried and results are cached (no more 504s in the browser)
//  - the same answer is reused by everyone on the trip
const router = express.Router()
const HEADERS = { 'User-Agent': 'ChuiseYourTrip/1.0 (SMU IS216 student project)' }
const DAY = 24 * 60 * 60 * 1000

// (kept in the database: see sharedCache.js)
const nearbyCache = sharedCache('safety-nearby-v2', { keepDays: 2 }) // 'lat,lon,home' -> { lat, lon, places, partial }
const placeCache = sharedCache('located-places', { keepDays: 180 }) // 'kyoto, japan|' -> place

// Round to 3 decimals (about 100 m): enough for safety info, kinder to privacy, and cache-friendly
const round = (n) => Math.round(Number(n) * 1000) / 1000

// Photon (OpenStreetMap search). lang 'default' gives local names, e.g. Japanese.
async function photon(params, options = {}) {
  // A plain place search goes to Geoapify first when there's a key (it doesn't turn us away when busy).
  // Searches by OSM tag (hospitals...) and the hotel search (it pairs English and local-language
  // Photon answers by their OpenStreetMap id) stay on Photon.
  if (geoapifyReady() && options.geoapify !== false && params.q && !params.osm_tag) {
    try {
      return await geoapifySearch({ q: params.q, limit: Number(params.limit) || 5, lat: params.lat, lon: params.lon })
    } catch (err) {
      console.warn('Geoapify search failed:', err.message, '(trying Photon)')
    }
  }
  const url = 'https://photon.komoot.io/api/?' + new URLSearchParams(params)
  let lastError = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) })
      if (!res.ok) throw new Error('Photon ' + res.status)
      return await res.json()
    } catch (err) {
      lastError = err
    }
  }
  // Photon is busy or down (it limits how often one server may ask): a plain place search can use
  // Nominatim (OpenStreetMap's own search) instead. Searches by OSM tag (hospitals...) can't.
  if (params.q && !params.osm_tag) {
    try {
      return await nominatimAsPhoton(params)
    } catch (err) {
      console.warn('Nominatim backup failed too:', err.message)
    }
  }
  throw lastError
}

// Nominatim's answer, in Photon's shape (so the code above works with either)
async function nominatimAsPhoton(params) {
  const query = { q: params.q, format: 'jsonv2', limit: params.limit || '5', addressdetails: '1', 'accept-language': 'en' }
  // Prefer results around a point (like Photon's lat/lon bias), about 100 km each way
  if (params.lat && params.lon) {
    const lat = Number(params.lat)
    const lon = Number(params.lon)
    query.viewbox = [lon - 1, lat + 1, lon + 1, lat - 1].join(',')
  }
  const res = await fetch('https://nominatim.openstreetmap.org/search?' + new URLSearchParams(query), { headers: HEADERS, signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error('Nominatim ' + res.status)
  const features = []
  for (const r of await res.json()) {
    const a = r.address || {}
    features.push({
      geometry: { coordinates: [Number(r.lon), Number(r.lat)] },
      properties: {
        name: r.name || (r.display_name || '').split(',')[0],
        housenumber: a.house_number, street: a.road, district: a.suburb || a.neighbourhood,
        city: a.city || a.town || a.village || a.county, postcode: a.postcode,
        countrycode: (a.country_code || '').toUpperCase(), country: a.country || ''
      }
    })
  }
  return { features }
}

function addressOf(p) {
  const street = [p.housenumber, p.street].filter(Boolean).join(' ')
  return [street, p.district || p.locality, p.city, p.postcode].filter(Boolean).join(', ')
}

// GET /api/safety/locate?place=Kyoto, Japan[&near=Chengdu, China] -> { lat, lon, city, countryCode, countryName }
// "near" = the trip city the place belongs to. Many names exist in several places (there are
// Mao Zedong statues all over China), so we search around that city and keep a match within 80 km.
async function locateOne(place) {
  const data = await photon({ q: place, limit: '1', lang: 'en' })
  return data.features && data.features[0]
}
function toResult(f, place) {
  const p = f.properties || {}
  return {
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0],
    city: p.city || p.name || place,
    countryCode: (p.countrycode || '').toUpperCase(),
    countryName: p.country || ''
  }
}
function kmBetween(a, b) {
  const r = Math.PI / 180
  const x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r)
  const y = (b.lat - a.lat) * r
  return Math.sqrt(x * x + y * y) * 6371
}

router.get('/locate', requireAuth, async (req, res) => {
  const place = String(req.query.place || '').trim().slice(0, 200)
  const near = String(req.query.near || '').trim().slice(0, 120)
  if (!place) return res.status(400).json({ message: 'Which place?' })
  const got = await cacheAndFetch(placeCache, (place + '|' + near).toLowerCase(), () => findPlace(place, near), { maxAgeMs: 180 * DAY })
  if (!got) return res.status(404).json({ message: 'Could not find that place.' })
  res.json(got.value)
})

// ---------- Airport search (for "Which airport do you land at?") ----------
// A plain place search for "kyoto airport" finds things like "Kyoto Sushi, Airport North, Orlando",
// so this only ever returns airports. It's fast because the main airports are built in (shared/airports.js):
//   1. typed an airport, code, city or country we know ("kansai", "KIX", "osaka"): answered at once
//   2. typed another place ("kyoto", which has no airport): find where it is, then the closest airports
//   3. nothing near in our list: ask OpenStreetMap, but never wait more than a few seconds
const airportCache = new Map()

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))])
}
function airportRow(a, away, from) {
  // a = [IATA, name, city, country, lat, lon]
  let address = a[0] + ' · ' + a[2] + ', ' + a[3]
  if (away !== null) address = a[0] + ' · ' + away + ' km from ' + from
  return { name: a[1], address, nameLocal: '', addressLocal: '', lat: a[4], lon: a[5] }
}

async function airportSearch(q, near) {
  const text = q.replace(/\bairport\b/i, '').trim().toLowerCase() || q.toLowerCase()
  const cacheKey = text + '|' + near.toLowerCase()
  if (airportCache.has(cacheKey)) return airportCache.get(cacheKey)

  // 1. Airports we know by code, name, city or country
  const exact = []
  const matches = []
  for (const a of AIRPORTS) {
    if (a[0].toLowerCase() === text) exact.push(a)
    else if (a[1].toLowerCase().includes(text) || a[2].toLowerCase().includes(text) || a[3].toLowerCase() === text) matches.push(a)
  }
  let result = []
  for (const a of exact.concat(matches).slice(0, 6)) result.push(airportRow(a, null, ''))

  // 2. Another place: where is it? (the typed place, else the trip city)
  if (!result.length) {
    let centre = null
    for (const place of [text, near]) {
      if (centre || !place) continue
      const f = await withTimeout(locateOne(place).catch(() => null), 4000)
      if (f) centre = { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], label: (f.properties && f.properties.name) || place }
    }
    if (centre) {
      const close = []
      for (const a of AIRPORTS) {
        const d = km(centre.lat, centre.lon, a[4], a[5])
        if (d <= 250) close.push({ a, d })
      }
      close.sort((x, y) => x.d - y.d)
      for (const c of close.slice(0, 6)) result.push(airportRow(c.a, Math.round(c.d), centre.label))

      // 3. Nothing near in our list: ask OpenStreetMap for airports with a code (at most 6 seconds)
      if (!result.length) {
        const query = '[out:json][timeout:8];nwr["aeroway"="aerodrome"]["iata"](around:150000,' + centre.lat + ',' + centre.lon + ');out tags center 10;'
        const data = await withTimeout(askOverpassFast(query, 8).catch(() => null), 6000)
        const list = []
        for (const el of (data && data.elements) || []) {
          const t = el.tags || {}
          const lat = el.lat !== undefined ? el.lat : el.center && el.center.lat
          const lon = el.lon !== undefined ? el.lon : el.center && el.center.lon
          if (lat === undefined || !t.iata) continue
          list.push({ a: [t.iata, t['name:en'] || t.name || t.iata, '', '', lat, lon], d: km(centre.lat, centre.lon, lat, lon) })
        }
        list.sort((x, y) => x.d - y.d)
        for (const c of list.slice(0, 6)) result.push(airportRow(c.a, Math.round(c.d), centre.label))
      }
    }
  }
  if (result.length) airportCache.set(cacheKey, result) // only remember answers, so a miss is tried again
  return result
}

// The place, ranked around the city `near` when there is one: a result, or null
async function findPlace(place, near) {
  let found = null
  if (near) {
    // Where the city is (cached like any other lookup)
    const cityGot = await cacheAndFetch(placeCache, (near + '|').toLowerCase(), async () => {
      const f = await locateOne(near)
      return f ? toResult(f, near) : null
    }, { maxAgeMs: 180 * DAY })
    const city = cityGot ? cityGot.value : null
    if (city) {
      // Results ranked around the city; keep the closest one that's actually nearby
      const data = await photon({ q: place, limit: '8', lang: 'en', lat: String(city.lat), lon: String(city.lon) })
      let best = null
      let bestKm = Infinity
      for (const f of data.features || []) {
        const r = toResult(f, place)
        const km = kmBetween(city, r)
        if (km < bestKm) {
          best = r
          bestKm = km
        }
      }
      if (best && bestKm <= 80) found = best
      // Nothing that close: try the name together with the city
      if (!found) {
        const f = await locateOne(place + ', ' + near)
        if (f) {
          const r = toResult(f, place)
          if (kmBetween(city, r) <= 80) found = r
        }
      }
      if (!found && best) found = best // closest we have
    }
  }
  if (!found) {
    const f = await locateOne(place)
    if (f) found = toResult(f, place)
  }
  return found
}

// GET /api/safety/stay-search?q=Hotel Gracery&near=Tokyo, Japan
// -> [{ name, address, nameLocal, addressLocal, lat, lon }] English + local script (for taxi drivers)
router.get('/stay-search', requireAuth, async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 120)
  const near = String(req.query.near || '').trim().slice(0, 80)
  if (q.length < 3) return res.json([])
  if (req.query.kind === 'airport') return res.json(await airportSearch(q, near))
  try {
    const params = { q: near ? q + ', ' + near : q, limit: '5' }
    const [en, local] = await Promise.all([photon({ ...params, lang: 'en' }, { geoapify: false }), photon({ ...params, lang: 'default' }, { geoapify: false })])
    const out = []
    for (const f of en.features || []) {
      const p = f.properties || {}
      if (!p.name) continue
      // The same place in the local-language answer (matched by its OpenStreetMap id)
      const twin = (local.features || []).find((g) => g.properties && g.properties.osm_id === p.osm_id) || f
      const lp = twin.properties || {}
      out.push({
        name: p.name,
        address: addressOf(p),
        nameLocal: lp.name || '',
        addressLocal: addressOf(lp),
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0]
      })
    }
    res.json(out)
  } catch (err) {
    res.status(502).json({ message: 'Place search is unavailable right now.' })
  }
})

// ---------- Help nearby ----------
const LABELS = { hospital: 'Hospital', clinic: 'Clinic', police: 'Police', fire_station: 'Fire station', shelter: 'Evacuation point', embassy: 'Embassy' }

// Overpass elements -> our places
function toPlaces(elements) {
  const places = []
  for (const el of elements || []) {
    const t = el.tags || {}
    const pLat = el.lat !== undefined ? el.lat : el.center && el.center.lat
    const pLon = el.lon !== undefined ? el.lon : el.center && el.center.lon
    if (pLat === undefined) continue
    let kind = t.amenity
    if (t.emergency === 'assembly_point' || t.amenity === 'shelter') kind = 'shelter'
    if (t.diplomatic === 'embassy' || t.amenity === 'embassy') kind = 'embassy'
    places.push({
      id: el.type + el.id,
      kind,
      name: t['name:en'] || t.name || LABELS[kind] || 'Unnamed',
      nameLocal: t['name:en'] && t.name && t.name !== t['name:en'] ? t.name : '',
      lat: pLat,
      lon: pLon,
      phone: t.phone || t['contact:phone'] || null,
      openingHours: t.opening_hours || null, // e.g. "24/7" or "Mo-Fr 09:00-18:00; Sa 09:00-12:00"
      emergency: t.emergency === 'yes' // hospitals with an A&E
    })
  }
  return places
}

function km(aLat, aLon, bLat, bLon) {
  const r = Math.PI / 180
  const x = (bLon - aLon) * r * Math.cos(((aLat + bLat) / 2) * r)
  const y = (bLat - aLat) * r
  return Math.sqrt(x * x + y * y) * 6371
}

// Backup when Overpass is down: Photon (fast OpenStreetMap search), one search per kind, kept within 8 km
async function photonNearby(lat, lon) {
  const kinds = ['hospital', 'clinic', 'police', 'fire_station']
  const answers = await Promise.allSettled(kinds.map((kind) =>
    photon({ q: kind.replace('_', ' '), lat: String(lat), lon: String(lon), osm_tag: 'amenity:' + kind, limit: '10', lang: 'en' })
  ))
  const places = []
  for (let i = 0; i < kinds.length; i++) {
    if (answers[i].status !== 'fulfilled') continue
    for (const f of answers[i].value.features || []) {
      const p = f.properties || {}
      const pLat = f.geometry.coordinates[1]
      const pLon = f.geometry.coordinates[0]
      if (km(lat, lon, pLat, pLon) > 8) continue
      places.push({
        id: (p.osm_type || 'x') + p.osm_id,
        kind: kinds[i],
        name: p.name || LABELS[kinds[i]],
        nameLocal: '',
        lat: pLat,
        lon: pLon,
        phone: null,
        openingHours: null,
        emergency: false
      })
    }
  }
  if (!places.length && answers.every((a) => a.status === 'rejected')) throw new Error('Photon backup failed')
  return places
}

// GET /api/safety/nearby?lat=35.0&lon=135.7&home=SG
// -> hospitals, clinics, police, fire stations, evacuation points / shelters within 3 km,
//    plus your country's embassy within 40 km. Each: { id, kind, name, lat, lon, phone, openingHours, emergency }
// Fast path: every Overpass server is asked at once; the embassy search runs alongside;
// if Overpass is down, Photon fills in hospitals/clinics/police/fire stations within a few seconds.
const round2 = (n) => Math.round(Number(n) * 100) / 100 // about 1 km: walking around reuses the same answer
router.get('/nearby', requireAuth, async (req, res) => {
  const lat = round2(req.query.lat)
  const lon = round2(req.query.lon)
  const home = /^[A-Z]{2}$/.test(String(req.query.home || '')) ? req.query.home : 'SG'
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return res.status(400).json({ message: 'Invalid location.' })
  }
  const key = lat + ',' + lon + ',' + home
  const got = await cacheAndFetch(nearbyCache, key, () => lookUpNearby(lat, lon, home), { maxAgeMs: DAY })
  if (!got) return res.status(502).json({ message: 'Nearby services are unavailable right now.' })
  res.json(got.value)
})

// Hospitals, police, shelters and the home country's embassy around a point, or null
async function lookUpNearby(lat, lon, home) {
  const at = lat + ',' + lon
  const coreQuery = '[out:json][timeout:10];(' +
    'nwr["amenity"~"^(hospital|clinic|police|fire_station)$"](around:3000,' + at + ');' +
    'nwr["emergency"="assembly_point"](around:3000,' + at + ');' +
    'nwr["amenity"="shelter"]["shelter_type"!~"public_transport|picnic_shelter|lean_to|field_shelter"](around:3000,' + at + ');' +
    ');out tags center 200;'
  const embassyQuery = '[out:json][timeout:12];(' +
    'nwr["diplomatic"="embassy"]["country"="' + home + '"](around:40000,' + at + ');' +
    'nwr["amenity"="embassy"]["country"="' + home + '"](around:40000,' + at + ');' +
    ');out tags center 5;'

  // All at the same time
  const [core, embassy] = await Promise.allSettled([askOverpassFast(coreQuery, 12), askOverpassFast(embassyQuery, 14)])

  let places = []
  let complete = true
  if (core.status === 'fulfilled') {
    places = toPlaces(core.value.elements)
  } else {
    console.error('Safety nearby (Overpass) failed:', core.reason.message)
    complete = false
    try {
      places = await photonNearby(lat, lon)
    } catch (err) {
      console.error('Safety nearby (Photon backup) failed:', err.message)
      return null
    }
  }
  if (embassy.status === 'fulfilled') places = places.concat(toPlaces(embassy.value.elements))
  else complete = false

  return { lat, lon, places, partial: !complete }
}

export default router
