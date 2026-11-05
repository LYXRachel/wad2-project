import express from 'express'
import { wikiFetch, overpassInTurn, serverIsResting, restServer } from '../politeFetch.js'
import { sharedCache, cacheAndFetch, DAY } from '../sharedCache.js'
import { requireAuth } from './auth.js'
import { searchPopularPlaces } from '../googlePlaces.js'
const router = express.Router()

// Remember searches so typing the same letters again is instant and free (kept in the database)
const cache = sharedCache('destination-search', { keepDays: 30 })

// Place types we want to suggest (cities, towns, regions, countries...)

// GET /api/places?q=kyo  -> [{ label: 'Kyoto, Japan', name, country, countryCode: 'JP', type }]
// Uses Photon (photon.komoot.io): a free place search built for type-ahead, based on OpenStreetMap.
router.get('/', requireAuth, async (req, res) => {
  const q = (req.query.q || '').trim()
  if (q.length < 2 || q.length > 60) return res.json([])

  const got = await cacheAndFetch(cache, q.toLowerCase(), () => searchDestinations(q), { maxAgeMs: 30 * DAY })
  res.json(got ? got.value : []) // [] = nothing found
})

// Photon's matches for the typed text, ranked: [{ label, name, country, countryCode, type }], or null
async function searchDestinations(q) {
  const url = 'https://photon.komoot.io/api/?' + new URLSearchParams({ q, limit: '15', lang: 'en', osm_tag: 'place' })
  const response = await fetch(url, {
    headers: { 'User-Agent': 'ChuiseYourTrip/1.0 (SMU IS216 student project)' },
    signal: AbortSignal.timeout(5000)
  })
  if (!response.ok) throw new Error('Photon ' + response.status)
  const data = await response.json()

  // Rank what came back so travel destinations win over same-named small towns:
  // a country or big city beats a town, and an exact name match beats a partial one.
  // Searching "Russia" should give Russia, not Russia (Ohio), Russiaville or Russian Island.
  const TYPE_WEIGHT = { country: 100, city: 80, state: 60, province: 60, region: 60, island: 40, town: 30 }
  const wantedName = q.toLowerCase()
  const ranked = []
  const seen = []
  for (const f of data.features || []) {
    const p = f.properties || {}
    const weight = TYPE_WEIGHT[p.osm_value]
    if (!p.name || weight === undefined) continue // villages, hamlets, counties... aren't trip destinations
    // A country, or a city-state named after itself ("Singapore, Singapore"), is just its name
    const label = p.osm_value === 'country' || !p.country || p.name === p.country ? p.name : p.name + ', ' + p.country
    if (seen.includes(label)) continue
    seen.push(label)
    const name = p.name.toLowerCase()
    const match = name === wantedName ? 50 : name.startsWith(wantedName) ? 20 : 0
    ranked.push({ label, name: p.name, country: p.country || '', countryCode: (p.countrycode || '').toUpperCase(), type: p.osm_value, score: weight + match })
  }
  ranked.sort((x, y) => y.score - x.score)
  // Keep only results close to the best one (a famous match hides obscure look-alikes), max 6
  const best = ranked.length ? ranked[0].score : 0
  const results = []
  for (const r of ranked) {
    if (r.score < best - 60 || results.length === 6) break
    results.push({ label: r.label, name: r.name, country: r.country, countryCode: r.countryCode, type: r.type })
  }

  return results.length ? results : null
}

// ---------------------------------------------------------------------
// GET /api/places/attractions?destination=Kyoto, Japan
// -> up to 20 popular places there: [{ name, type, indoor, address, lat, lon }]
// One Google Places text search ("popular places to visit in Kyoto, Japan"): Google decides what is
// popular and in what order, like typing it into Google Maps.
// ---------------------------------------------------------------------
const popular = sharedCache('popular-places', { keepDays: 30 }) // 'kyoto, japan' -> [place]

router.get('/attractions', requireAuth, async (req, res) => {
  const destination = (req.query.destination || '').trim()
  if (!destination || destination.length > 80) return res.json([])
  if (!process.env.GOOGLE_PLACES_API_KEY) return res.status(503).json({ message: 'Popular places are not set up yet (GOOGLE_PLACES_API_KEY missing).' })
  const got = await cacheAndFetch(popular, destination.toLowerCase(), async () => {
    const items = await searchPopularPlaces(destination)
    return items.length ? items : null
  }, { maxAgeMs: 30 * DAY })
  res.json(got ? got.value : []) // [] = no popular places known
})

const HEADERS = { 'User-Agent': 'ChuiseYourTrip/1.0 (SMU IS216 student project)' }
const OVERPASS_SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']

export async function askOverpass(query, waitSeconds) {
  let lastError = null
  for (const server of OVERPASS_SERVERS) {
    try {
      const response = await fetch(server, {
        method: 'POST',
        headers: { ...HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout((waitSeconds + 5) * 1000)
      })
      const text = await response.text()
      if (!response.ok) throw new Error('Overpass ' + response.status + ' (' + server + ')')
      const data = JSON.parse(text) // throws if Overpass sent an HTML error page
      // When busy, Overpass can answer "OK" with no places and a remark like "Query timed out"
      if (data.remark && !(data.elements || []).length) throw new Error('Overpass: ' + data.remark)
      return data
    } catch (err) {
      lastError = err
      console.error('Overpass attempt failed:', err.message)
    }
  }
  throw lastError
}

// Same as askOverpass, but asks every server at once and takes the first good answer
// (the others are cancelled). Much faster when one server is busy: no waiting for it to time out first.
export function askOverpassFast(query, waitSeconds) {
  return overpassInTurn(() => askAllOverpass(query, waitSeconds))
}
async function askAllOverpass(query, waitSeconds) {
  const stop = new AbortController()
  // Servers that told us "too many requests" in the last minute are left alone
  let servers = OVERPASS_SERVERS.filter((s) => !serverIsResting(s))
  if (!servers.length) servers = OVERPASS_SERVERS
  const tries = servers.map(async (server) => {
    // Stops when time runs out, or when another server already answered
    const own = new AbortController()
    const timer = setTimeout(() => own.abort(), waitSeconds * 1000)
    stop.signal.addEventListener('abort', () => own.abort())
    try {
      const response = await fetch(server, {
        method: 'POST',
        headers: { ...HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
        signal: own.signal
      })
      if (response.status === 429) restServer(server, 60)
      if (!response.ok) throw new Error('Overpass ' + response.status + ' (' + server + ')')
      const data = JSON.parse(await response.text())
      if (data.remark && !(data.elements || []).length) throw new Error('Overpass: ' + data.remark)
      return data
    } finally {
      clearTimeout(timer)
    }
  })
  try {
    const data = await Promise.any(tries)
    stop.abort() // cancel the slower servers
    return data
  } catch (err) {
    throw new Error('All Overpass servers failed: ' + (err.errors || []).map((e) => e.message).join('; '))
  }
}


// ---------------------------------------------------------------------
// GET /api/places/photos?city=Pyongyang, North Korea&names=Juche Tower|Arch of Triumph
// -> { "Juche Tower": "https://upload.wikimedia.org/...jpg", "Arch of Triumph": null }
// A photo for each place: a Wikipedia search for "name city", then a Wikimedia Commons photo search.
// (Saved in the database; see sharedCache.js.)
// ---------------------------------------------------------------------
const placePhotos = sharedCache('place-photos-v2', { keepDays: 7 }) // 'name|city' -> url

function plainWords(text) {
  return plain(text).split(/[^a-z0-9]+/).filter((w) => w.length > 2)
}
// Does a page/file title look like it's about this place? (shares a real word with its name)
function sameThing(name, title) {
  const words = plainWords(name).filter((w) => !['the', 'and', 'museum', 'park', 'temple', 'tower', 'palace', 'bridge'].includes(w))
  const t = plain(title)
  if (!words.length) return t.includes(plain(name))
  for (const w of words) if (t.includes(w)) return true
  return false
}
async function wikiJson(url) {
  const res = await wikiFetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return res.json()
}
// Search Wikipedia for "name city" and take the first matching article with a picture
async function photoFromSearch(name, city) {
  const data = await wikiJson('https://en.wikipedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', generator: 'search', gsrsearch: name + ' ' + city, gsrlimit: '5',
    prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '800', format: 'json'
  }))
  const pages = Object.values((data.query && data.query.pages) || {}).sort((a, b) => a.index - b.index)
  for (const pg of pages) {
    if (pg.thumbnail && sameThing(name, pg.title)) return pg.thumbnail.source
  }
  return null
}
// Search Wikimedia Commons for a photo file named after the place
async function photoFromCommons(name, city) {
  const data = await wikiJson('https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', generator: 'search', gsrnamespace: '6', gsrsearch: name + ' ' + city + ' filetype:bitmap', gsrlimit: '6',
    prop: 'imageinfo', iiprop: 'url|size|mime', iiurlwidth: '800', format: 'json'
  }))
  const pages = Object.values((data.query && data.query.pages) || {}).sort((a, b) => a.index - b.index)
  for (const pg of pages) {
    const info = pg.imageinfo && pg.imageinfo[0]
    if (!info || info.mime !== 'image/jpeg' || info.width < 400) continue
    if (/map|flag|logo|seal|diagram|plan/i.test(pg.title)) continue
    if (sameThing(name, pg.title)) return info.thumburl || info.url
  }
  return null
}
async function photoForPlace(name, city) {
  const got = await cacheAndFetch(placePhotos, plain(name) + '|' + plain(city), async () => {
    for (const step of [() => photoFromSearch(name, city), () => photoFromCommons(name, city)]) {
      try {
        const url = await step()
        if (url) return url
      } catch (err) {
        // that source failed; try the next one
      }
    }
    return null
  }, { maxAgeMs: 7 * DAY })
  return got ? got.value : null
}

router.get('/photos', async (req, res) => {
  const city = String(req.query.city || '').trim().slice(0, 80)
  const names = String(req.query.names || '').split('|').map((n) => n.trim().slice(0, 120)).filter(Boolean).slice(0, 40)
  const cityName = city.split(', ')[0]
  const out = {}
  let next = 0
  async function worker() {
    while (next < names.length) {
      const name = names[next++]
      out[name] = await photoForPlace(name, cityName)
    }
  }
  const workers = []
  for (let i = 0; i < 4; i++) workers.push(worker())
  await Promise.all(workers)
  res.json(out)
})

// "Café Mozart" -> "cafe mozart" (no accents or capitals, so "cafe" finds "Café")
function plain(text) {
  return String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

// ---------------------------------------------------------------------
// GET /api/places/photo?destination=Tokyo, Japan[&size=small]   (small = 960px wide, for cards)
// -> { url, page } a landscape photo of the place from Wikipedia (free, no key), or { url: null }
// Tries the city's article, then "Tourism in <country>", then the country.
// Flags and maps (usually .svg) are skipped so we get a real photo.
// ---------------------------------------------------------------------
const photos = sharedCache('destination-photos', { keepDays: 90 }) // destination -> result (kept in the database)

async function wikiPhoto(title, width) {
  const url = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_'))
  const response = await wikiFetch(url, { headers: HEADERS, signal: AbortSignal.timeout(6000) })
  if (!response.ok) return null
  const data = await response.json()
  if (data.type === 'disambiguation') return null
  const original = data.originalimage
  const thumb = data.thumbnail
  if (!original || !thumb) return null
  const file = original.source.toLowerCase()
  if (file.endsWith('.svg') || file.endsWith('.png') || file.includes('flag_of') || file.includes('map')) return null
  if (original.width < original.height) return null // portrait photos look bad as a wide banner
  // Ask Wikimedia for a smaller copy instead of the (often huge) original.
  // (Wikimedia only makes thumbnails in standard widths like 960, 1280 and 1920.)
  let src = original.source
  if (original.width > width) src = thumb.source.replace(/\/\d+px-/, '/' + width + 'px-')
  return { url: src, page: data.content_urls && data.content_urls.desktop ? data.content_urls.desktop.page : null }
}

// Backup: any wide photo from the article (e.g. when its main picture is a tall collage, like New York City)
export async function wikiGalleryPhoto(title, width, priority = 'first') {
  const url = 'https://en.wikipedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', generator: 'images', titles: title, gimlimit: '40', redirects: '1',
    prop: 'imageinfo', iiprop: 'url|size|mime', iiurlwidth: String(width), format: 'json'
  })
  const response = await wikiFetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) }, priority)
  if (!response.ok) return null
  const data = await response.json()
  const pages = (data.query && data.query.pages) || {}
  const skip = ['map', 'flag', 'logo', 'seal', 'icon', 'coat', 'locator', 'symbol', 'diagram', 'chart', 'signature']
  for (const id in pages) {
    const info = pages[id].imageinfo && pages[id].imageinfo[0]
    if (!info || info.mime !== 'image/jpeg') continue
    const name = pages[id].title.toLowerCase()
    if (skip.some((w) => name.includes(w))) continue
    if (info.width < 1200 || info.width < info.height * 1.3) continue // wide photos only
    return { url: info.thumburl || info.url, page: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(title.replace(/ /g, '_')) }
  }
  return null
}

router.get('/photo', requireAuth, async (req, res) => {
  const destination = (req.query.destination || '').trim()
  if (!destination || destination.length > 80) return res.json({ url: null })
  // Wikimedia's standard widths: 330 for little thumbnails (itinerary stops), 960 for cards, 1920 for banners
  const width = req.query.size === 'thumb' ? 330 : req.query.size === 'small' ? 960 : 1920
  const got = await cacheAndFetch(photos, width + '|' + destination.toLowerCase(), () => destinationPhoto(destination, width), { maxAgeMs: 90 * DAY })
  res.json(got ? got.value : { url: null })
})

// A wide photo of a destination from Wikipedia: { url, page }, or null
async function destinationPhoto(destination, width) {
  const parts = destination.split(',').map((x) => x.trim()).filter(Boolean)
  const place = parts[0]
  const country = parts.length > 1 ? parts[parts.length - 1] : parts[0]
  // e.g. "New York" is the state's article (map), but "New York City" has a skyline photo
  const titles = [place, place + ' City', 'Tourism in ' + place, 'Tourism in ' + country, country]
  for (const title of titles) {
    try {
      const found = await wikiPhoto(title, width)
      if (found) return found
    } catch (err) {
      console.error('Wikipedia photo lookup failed for "' + title + '":', err.message)
    }
  }
  // No usable main picture anywhere: look through the city's other photos
  for (const title of [place + ' City', place]) {
    try {
      const found = await wikiGalleryPhoto(title, width)
      if (found) return found
    } catch (err) {
      console.error('Wikipedia gallery lookup failed for "' + title + '":', err.message)
    }
  }
  return null
}

export default router
