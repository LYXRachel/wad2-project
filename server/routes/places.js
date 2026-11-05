import express from 'express'
import { wikiFetch, overpassInTurn, serverIsResting, restServer } from '../politeFetch.js'
import { sharedCache } from '../sharedCache.js'
import { requireAuth } from './auth.js'
import Attraction from '../models/Attraction.js'
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

  const key = q.toLowerCase()
  const known = await cache.get(key)
  if (known) return res.json(known.value)

  let data
  try {
    const url = 'https://photon.komoot.io/api/?' + new URLSearchParams({ q, limit: '15', lang: 'en', osm_tag: 'place' })
    const response = await fetch(url, {
      headers: { 'User-Agent': 'ChuiseYourTrip/1.0 (SMU IS216 student project)' },
      signal: AbortSignal.timeout(5000)
    })
    data = await response.json()
  } catch (err) {
    return res.status(502).json({ message: 'Place search is unavailable right now.' })
  }

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

  await cache.set(key, results)
  res.json(results)
})

// ---------------------------------------------------------------------
// GET /api/places/attractions?destination=Kyoto, Japan
// -> up to 20 popular places there: [{ name, type, indoor, address, lat, lon }]
// One Google Places text search ("popular places to visit in Kyoto, Japan"): Google decides what is
// popular and in what order, like typing it into Google Maps. Saved in MongoDB for 30 days.
// ---------------------------------------------------------------------
const CACHE_DAYS = 30
// Raise this when the way the list is built changes, so saved lists are looked up again
// (4: Google Places text search replaces the OpenStreetMap + Wikidata lookup)
const LIST_VERSION = 4
const lookups = new Map() // destination key -> the lookup that is running (one per destination)

router.get('/attractions', requireAuth, async (req, res) => {
  const destination = (req.query.destination || '').trim()
  if (!destination || destination.length > 80) return res.json([])

  const key = destination.toLowerCase()
  const saved = await Attraction.findOne({ key })
  const fresh = saved && saved.items.length && saved.version === LIST_VERSION &&
    (Date.now() - saved.fetchedAt.getTime()) / 86400000 < CACHE_DAYS
  if (fresh) return res.json(saved.items)

  let job = lookups.get(key)
  if (!job) {
    job = searchPopularPlaces(destination).finally(() => lookups.delete(key))
    lookups.set(key, job)
  }
  try {
    const items = await job
    // Only a real answer is saved; a failure is tried again next time
    if (items.length) await Attraction.findOneAndUpdate({ key }, { key, items, version: LIST_VERSION, fetchedAt: new Date() }, { upsert: true })
    res.json(items)
  } catch (err) {
    console.error('Popular places lookup failed for "' + destination + '":', err.message)
    res.status(err.status === 503 ? 503 : 502).json({
      message: err.status === 503 ? 'Popular places are not set up yet (GOOGLE_PLACES_API_KEY missing).' : 'Could not load popular places right now. Try again in a minute.'
    })
  }
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
// A photo for each place, trying (in order):
//   1. the Wikipedia article OpenStreetMap links to   2. the Wikidata entry's main image
//   3. a Wikipedia search for "name city"              4. a Wikimedia Commons photo search
// Answers are kept in the database (photos for a day, "no photo" for an hour).
// ---------------------------------------------------------------------
const placePhotos = sharedCache('place-photos', { keepDays: 7 }) // 'name|city' -> url (null = no photo found)

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
// 1. "en:Arch of Triumph (Pyongyang)" -> that article's picture
async function photoFromArticle(tag) {
  const at = tag.indexOf(':')
  const lang = at > 0 && at < 4 ? tag.slice(0, at) : 'en'
  const title = at > 0 && at < 4 ? tag.slice(at + 1) : tag
  const data = await wikiJson('https://' + lang + '.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_')))
  return (data.thumbnail && data.thumbnail.source) || null
}
// 2. Q-number -> its "image" (P18) on Wikimedia Commons
async function photoFromWikidata(id) {
  if (!/^Q\d+$/.test(id)) return null
  const data = await wikiJson('https://www.wikidata.org/wiki/Special:EntityData/' + id + '.json')
  const entity = data.entities && data.entities[id]
  const claim = entity && entity.claims && entity.claims.P18 && entity.claims.P18[0]
  const file = claim && claim.mainsnak && claim.mainsnak.datavalue && claim.mainsnak.datavalue.value
  return file ? 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(file) + '?width=800' : null
}
// 3. Search Wikipedia for "name city" and take the first matching article with a picture
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
// 4. Search Wikimedia Commons for a photo file named after the place
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
async function photoForPlace(name, city, item) {
  const key = plain(name) + '|' + plain(city)
  const known = await placePhotos.get(key)
  if (known && Date.now() - known.at < (known.value ? 86400000 : 3600000)) return known.value
  const steps = []
  if (item && item.wiki) steps.push(() => photoFromArticle(item.wiki))
  if (item && item.wikidata) steps.push(() => photoFromWikidata(item.wikidata))
  steps.push(() => photoFromSearch(name, city))
  steps.push(() => photoFromCommons(name, city))
  let url = null
  for (const step of steps) {
    try {
      url = await step()
    } catch (err) {
      url = null // that source failed; try the next one
    }
    if (url) break
  }
  await placePhotos.set(key, url)
  return url
}

router.get('/photos', async (req, res) => {
  const city = String(req.query.city || '').trim().slice(0, 80)
  const names = String(req.query.names || '').split('|').map((n) => n.trim().slice(0, 120)).filter(Boolean).slice(0, 40)
  const cityName = city.split(', ')[0]
  // The saved popular places know their Wikipedia/Wikidata links
  let items = []
  try {
    const saved = city ? await Attraction.findOne({ key: city.toLowerCase() }) : null
    items = saved ? saved.items : []
  } catch (err) {
    items = []
  }
  const out = {}
  let next = 0
  async function worker() {
    while (next < names.length) {
      const name = names[next++]
      const item = items.find((x) => x.name === name)
      out[name] = await photoForPlace(name, cityName, item)
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
  const key = width + '|' + destination.toLowerCase()
  const known = await photos.get(key)
  if (known) return res.json(known.value)

  const parts = destination.split(',').map((x) => x.trim()).filter(Boolean)
  const place = parts[0]
  const country = parts.length > 1 ? parts[parts.length - 1] : parts[0]
  // e.g. "New York" is the state's article (map), but "New York City" has a skyline photo
  const titles = [place, place + ' City', 'Tourism in ' + place, 'Tourism in ' + country, country]

  let result = { url: null }
  for (const title of titles) {
    try {
      const found = await wikiPhoto(title, width)
      if (found) {
        result = found
        break
      }
    } catch (err) {
      console.error('Wikipedia photo lookup failed for "' + title + '":', err.message)
    }
  }
  // No usable main picture anywhere: look through the city's other photos
  if (!result.url) {
    for (const title of [place + ' City', place]) {
      try {
        const found = await wikiGalleryPhoto(title, width)
        if (found) {
          result = found
          break
        }
      } catch (err) {
        console.error('Wikipedia gallery lookup failed for "' + title + '":', err.message)
      }
    }
  }
  // Only remember found photos, so a miss (or a network hiccup) is tried again next time
  if (result.url) await photos.set(key, result)
  res.json(result)
})

export default router
