// Geoapify (geoapify.com): hosted OpenStreetMap search with our own free allowance (3,000 requests a day),
// so it doesn't turn us away when the free public servers are busy.
// Used first when GEOAPIFY_KEY is set in server/.env; Photon, Nominatim and Overpass stay as backups.
// Their terms ask for a "Powered by Geoapify" link next to what it found (see the Places tab).

const BASE = 'https://api.geoapify.com'

function apiKey() {
  return (process.env.GEOAPIFY_KEY || '').trim()
}
export function geoapifyReady() {
  return !!apiKey()
}

async function getJson(path, params, ms) {
  const url = BASE + path + '?' + new URLSearchParams({ ...params, apiKey: apiKey() })
  // Too many requests at once (429): wait a moment and ask again, twice at most
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(ms || 8000) })
    if (res.status === 429 && attempt < 2) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
      continue
    }
    if (!res.ok) throw Object.assign(new Error('Geoapify ' + res.status), { status: res.status })
    return res.json()
  }
}

// Find a place by text. Answers in Photon's shape ({ features: [...] }), so code written for Photon works with it.
// lat/lon = prefer results near there. Without them, no country is preferred
// (by default Geoapify prefers the country our server is in).
export async function geoapifySearch({ q, limit = 5, lat, lon, type }) {
  const params = { text: q, format: 'json', limit: String(limit), lang: 'en' }
  if (type) params.type = type
  params.bias = lat != null && lon != null ? 'proximity:' + lon + ',' + lat : 'countrycode:none'
  const data = await getJson('/v1/geocode/search', params)
  const features = []
  for (const r of data.results || []) {
    features.push({
      geometry: { coordinates: [r.lon, r.lat] },
      properties: {
        name: r.name || r.address_line1 || '',
        housenumber: r.housenumber, street: r.street, district: r.district || r.suburb,
        city: r.city, postcode: r.postcode,
        countrycode: (r.country_code || '').toUpperCase(), country: r.country || '',
        osm_value: r.result_type, // 'city', 'country', 'amenity'...
        place_id: r.place_id      // its boundary, for searching places inside it
      }
    })
  }
  return { features }
}

// How long a route takes: { min, km } or null. from/to = { lat, lon }.
// mode: 'walk' | 'bicycle' | 'drive' | 'approximated_transit' (public transport worked out from
// OpenStreetMap's bus/train lines; no timetables, so it's an estimate).
// null = Geoapify says there's no route this way (e.g. no road to that point); a failed request throws
// withPath: also return the route's points, path: [{ lat, lon }, ...] from start to end
export async function geoapifyRoute(from, to, mode, { withPath = false } = {}) {
  let data
  try {
    data = await getJson('/v1/routing', {
      waypoints: from.lat + ',' + from.lon + '|' + to.lat + ',' + to.lon,
      mode
    }, 10000)
  } catch (err) {
    if (err.status === 400) return null // "No path could be found for input"
    throw err
  }
  const f = data.features && data.features[0]
  const p = f && f.properties
  if (!p || p.time == null) return null
  // An empty route (0 m) is no route (Geoapify's transit sometimes answers 0 m, 1 min)
  if (!p.distance) return null
  const route = { min: Math.max(1, Math.round(p.time / 60)), km: Math.round((p.distance || 0) / 100) / 10 }
  if (withPath && f.geometry) {
    // LineString: [[lon, lat], ...]; MultiLineString (one line per leg): [[[lon, lat], ...], ...]
    const lines = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates
    route.path = lines.flat().map(([lon, lat]) => ({ lat, lon }))
  }
  return route
}

// One place as the app stores it: { name, address, lat, lon, kind, city, countryCode }
function toPlace(r) {
  return {
    name: r.name || r.address_line1 || r.formatted || '',
    address: r.name ? (r.address_line2 || r.formatted || '') : (r.formatted || ''),
    lat: r.lat,
    lon: r.lon,
    kind: r.category || r.result_type || '',
    city: r.city || '',
    countryCode: (r.country_code || '').toUpperCase()
  }
}

// Type-ahead: real places that match what was typed. near = { lat, lon } keeps results within 60 km.
// Text that matches nothing gives an empty list (no guessing).
export async function geoapifyAutocomplete({ q, near, limit = 8 }) {
  const params = { text: q, format: 'json', limit: String(limit), lang: 'en' }
  if (near) {
    params.bias = 'proximity:' + near.lon + ',' + near.lat
    params.filter = 'circle:' + near.lon + ',' + near.lat + ',60000'
  }
  const data = await getJson('/v1/geocode/autocomplete', params)
  return (data.results || []).map(toPlace).filter((p) => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lon))
}

// What is at this point (for a dropped pin or a Maps link without a name). null = nothing known there.
export async function geoapifyReverse(lat, lon) {
  const data = await getJson('/v1/geocode/reverse', { lat: String(lat), lon: String(lon), format: 'json', lang: 'en' })
  const r = data.results && data.results[0]
  return r ? toPlace(r) : null
}
