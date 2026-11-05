// Discover: public holidays, climate and a photo + description per city.
// Every outside answer goes through cacheAndFetch (see sharedCache.js).
import express from 'express'
import { wikiFetch } from '../politeFetch.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { requireAuth } from './auth.js'
import { warmFlags } from '../images.js'
import { wikiGalleryPhoto } from './places.js'
import { sharedCache, cacheAndFetch, DAY } from '../sharedCache.js'

const router = express.Router()
const holidayCache = sharedCache('holidays', { keepDays: 90 }) // 'JP-2026' -> [{ date, name }]

// Public holidays (Nager.Date, free, no key): [{ date, name }], or [] when unknown
async function holidaysFor(cc, year) {
  const got = await cacheAndFetch(holidayCache, cc + '-' + year, async () => {
    const res = await fetch('https://date.nager.at/api/v3/PublicHolidays/' + year + '/' + cc, { signal: AbortSignal.timeout(8000) })
    if (res.status !== 200) return null
    const data = await res.json()
    return data.map((h) => ({ date: h.date, name: h.localName && h.localName !== h.name ? h.name + ' (' + h.localName + ')' : h.name }))
  }, { maxAgeMs: 90 * DAY })
  return got ? got.value : []
}

// GET /api/discover/holidays?countries=JP,TH&years=2026,2027 -> { JP: [{ date, name }], TH: [...] }
router.get('/holidays', requireAuth, async (req, res) => {
  const countries = String(req.query.countries || '').split(',').filter((c) => /^[A-Z]{2}$/.test(c)).slice(0, 30)
  const years = String(req.query.years || '').split(',').map(Number).filter((y) => y >= 2024 && y <= 2035).slice(0, 2)
  const out = {}
  await Promise.all(countries.map(async (cc) => {
    out[cc] = []
    for (const y of years) out[cc] = out[cc].concat(await holidaysFor(cc, y))
  }))
  res.json(out)
})

// ---------- climate for any city (Open-Meteo, free, no key) ----------
const climateCache = sharedCache('climate-v2', { keepDays: 365 }) // last year's weather doesn't change

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return res.json()
}

// 'Kyoto, Japan' -> { label, lat, lon, cc, temp[12], rain[12] }  (last full year's weather, by month), or null
// want = the country code the browser expects, e.g. 'TR' for "Cappadocia, Turkey" (part of the saved key)
async function climateFor(label, want) {
  const got = await cacheAndFetch(climateCache, label + '|' + want, () => lookUpClimate(label, want), { maxAgeMs: 365 * DAY })
  return got ? got.value : null
}
async function lookUpClimate(label, want) {
  const name = label.split(', ')[0]
  const geo = await getJson('https://geocoding-api.open-meteo.com/v1/search?' + new URLSearchParams({ name, count: '10', language: 'en' }))
  const results = geo.results || []
  // Same country code first (country names differ, e.g. "Türkiye"), else the biggest place with that name
  let place = results.find((r) => want && r.country_code === want)
  if (!place && !want) place = results.slice().sort((a, b) => (b.population || 0) - (a.population || 0))[0]
  if (!place) return null

  const year = new Date().getFullYear() - 1
  const wx = await getJson('https://archive-api.open-meteo.com/v1/archive?' + new URLSearchParams({
    latitude: place.latitude, longitude: place.longitude, start_date: year + '-01-01', end_date: year + '-12-31',
    daily: 'temperature_2m_mean,precipitation_sum', timezone: 'auto'
  }))
  const sum = new Array(12).fill(0)
  const days = new Array(12).fill(0)
  const rain = new Array(12).fill(0)
  const dates = wx.daily.time
  for (let i = 0; i < dates.length; i++) {
    const m = Number(dates[i].slice(5, 7)) - 1
    if (wx.daily.temperature_2m_mean[i] != null) {
      sum[m] += wx.daily.temperature_2m_mean[i]
      days[m]++
    }
    if (wx.daily.precipitation_sum[i] >= 1) rain[m]++
  }
  const temp = []
  for (let m = 0; m < 12; m++) temp.push(days[m] ? Math.round(sum[m] / days[m]) : null)
  return { label, lat: place.latitude, lon: place.longitude, cc: place.country_code, temp, rain }
}

// GET /api/discover/cities?names=Kyoto, Japan|Rome, Italy&codes=JP|IT  (up to 20 at a time)
router.get('/cities', requireAuth, async (req, res) => {
  const names = String(req.query.names || '').split('|').map((n) => n.trim()).slice(0, 20)
  const codes = String(req.query.codes || '').split('|')
  const out = []
  // A few at a time, to be gentle with the free API
  for (let i = 0; i < names.length; i += 4) {
    const batch = await Promise.all(names.slice(i, i + 4).map((n, k) => {
      const code = /^[A-Z]{2}$/.test(codes[i + k] || '') ? codes[i + k] : ''
      return n ? climateFor(n, code).catch(() => null) : null
    }))
    for (const c of batch) if (c) out.push(c)
  }
  res.json(out)
})

// ---------- a short description + photo (Wikipedia) ----------
// Tries "Queenstown, New Zealand" first, then "Queenstown", skipping "may refer to" (disambiguation) pages
const aboutCache = sharedCache('discover-about', { keepDays: 90 }) // title -> { text, photo, page }
// A flag, map or logo isn't a photo of the place (Vietnam's article starts with its flag)
const NOT_A_PHOTO = /flag_of|\.svg|locator|_map|map_of|coat_of_arms|logo/i

// The article's photo at a sensible size. The original can be 5-20 MB (that's why cards stayed empty);
// Wikimedia makes copies in standard widths, and 960 px is plenty for a card or a banner.
function photoOf(data) {
  const original = data.originalimage
  const thumb = data.thumbnail
  if (!thumb) return original ? original.source : null
  if (original && original.width > 960 && /\/\d+px-/.test(thumb.source)) return thumb.source.replace(/\/\d+px-/, '/960px-')
  return original ? original.source : thumb.source
}

async function wikiSummary(title, priority) {
  const res = await wikiFetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_')), {
    headers: { 'User-Agent': 'ChuiseYourTrip/1.0 (student project)' },
    signal: AbortSignal.timeout(10000)
  }, priority)
  if (!res.ok) return null
  const data = await res.json()
  if (data.type === 'disambiguation' || !data.extract) return null
  const photo = photoOf(data)
  return {
    text: data.extract,
    photo: photo && !NOT_A_PHOTO.test(photo) ? photo : null,
    page: data.content_urls && data.content_urls.desktop ? data.content_urls.desktop.page : null
  }
}

// Backup when no article has exactly that name ("Hoi An" is "Hội An", "Bath" is "Bath, Somerset",
// "Jeju" is a list of meanings): Wikipedia's own search, its top result's picture and first sentences
// near = { lat, lon } of a Discover city: the answer must be an article about a place within 60 km
// (a search for "Bath United Kingdom" once came back with a runner from Bath)
const CITY_AT = {}
try {
  const cityFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'data', 'discoverCities.json')
  for (const c of JSON.parse(fs.readFileSync(cityFile, 'utf8')).cities) CITY_AT[c.cityName + ', ' + c.country] = { lat: c.lat, lon: c.lon }
} catch (err) {
  // no city list: searches aren't checked
}
function kmBetween(a, b) {
  const rad = Math.PI / 180
  const x = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lon - a.lon) * rad / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(x))
}
// A wide photo taken within 10 km of a place (Wikimedia Commons knows where many photos were taken)
async function photoTakenNear(near, priority) {
  const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', generator: 'geosearch', ggscoord: near.lat + '|' + near.lon, ggsradius: '10000',
    ggsnamespace: '6', ggslimit: '40', prop: 'imageinfo', iiprop: 'url|size|mime', iiurlwidth: '960', format: 'json'
  })
  const res = await wikiFetch(url, { headers: { 'User-Agent': 'ChuiseYourTrip/1.0 (student project)' }, signal: AbortSignal.timeout(10000) }, priority)
  if (!res.ok) return null
  const data = await res.json()
  const pages = Object.values((data.query && data.query.pages) || {}).sort((a, b) => (a.index || 0) - (b.index || 0)) // nearest first
  const skip = /map|flag|logo|sign|plan|diagram|chart|icon|seal|coat|panel|ticket|menu/i
  for (const p of pages) {
    const info = p.imageinfo && p.imageinfo[0]
    if (!info || info.mime !== 'image/jpeg' || skip.test(p.title)) continue
    if (info.width < 1200 || info.width < info.height * 1.3) continue // wide, big photos only
    return info.thumburl || info.url
  }
  return null
}

async function wikiSearch(query, priority, near) {
  const url = 'https://en.wikipedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', generator: 'search', gsrsearch: query, gsrlimit: near ? '5' : '1', redirects: '1',
    prop: 'pageimages|extracts|info|coordinates', piprop: 'thumbnail', pithumbsize: '960',
    exintro: '1', explaintext: '1', exsentences: '3', inprop: 'url', format: 'json'
  })
  const res = await wikiFetch(url, { headers: { 'User-Agent': 'ChuiseYourTrip/1.0 (student project)' }, signal: AbortSignal.timeout(10000) }, priority)
  if (!res.ok) return null
  const data = await res.json()
  const pages = Object.values((data.query && data.query.pages) || {}).sort((a, b) => (a.index || 0) - (b.index || 0)) // best match first
  for (const p of pages) {
    if (!p.extract) continue
    if (near && !(p.coordinates && p.coordinates[0] && kmBetween(near, p.coordinates[0]) < 60)) continue // not the place itself
    const photo = p.thumbnail ? p.thumbnail.source : null
    return { text: p.extract, photo: photo && !NOT_A_PHOTO.test(photo) ? photo : null, page: p.fullurl || null }
  }
  return null
}

// GET /api/discover/about?title=Queenstown, New Zealand
// Public: Discover works for guests too
// Wikipedia summary + photo for a title ("Kyoto, Japan" also tries "Kyoto"), or null.
// Waits up to `ms` for Wikipedia, then uses the saved answer (a slower answer is saved when it arrives).
async function lookupWithin(title, ms, priority) {
  const got = await cacheAndFetch(aboutCache, title, () => findAbout(title, priority), { maxAgeMs: 90 * DAY, waitMs: ms })
  return got ? got.value : null
}
async function findAbout(title, priority) {
  // "Kyoto, Japan", then "Kyoto"; a country also tries "Tourism in Vietnam" (its own article often starts with the flag)
  const tries = [title]
  if (title.includes(', ')) tries.push(title.split(', ')[0])
  else tries.push('Tourism in ' + title)
  let best = null
  for (const t of tries) {
    try {
      const found = await wikiSummary(t, priority)
      if (found && found.photo) return found
      if (found && !best) best = found
    } catch (err) {
      // try the next name
    }
  }
  try {
    const found = await wikiSearch(title.replace(/, /g, ' '), priority, CITY_AT[title])
    if (found && found.photo) return best ? { ...best, photo: found.photo } : found
    if (found && !best) best = found
  } catch (err) {
    // no answer this time
  }
  // Last try: any wide photo further down the article (e.g. Bali's first picture is a map)
  for (const t of tries) {
    try {
      const wide = await wikiGalleryPhoto(t, 960, priority)
      if (wide && wide.url) return { text: best ? best.text : '', photo: wide.url, page: best ? best.page : wide.page }
    } catch (err) {
      // try the next name
    }
  }
  // Still nothing (small places like Maafushi have no picture in their article): a wide photo
  // someone took right there, from Wikimedia Commons, found by the city's location
  if (CITY_AT[title]) {
    try {
      const nearby = await photoTakenNear(CITY_AT[title], priority)
      if (nearby) return { text: best ? best.text : '', photo: nearby, page: best ? best.page : null }
    } catch (err) {
      // no photo this time
    }
  }
  return best // no photo (or nothing at all: null)
}

router.get('/about', async (req, res) => {
  const title = String(req.query.title || '').trim().slice(0, 100)
  if (!title) return res.status(400).json({ message: 'Which city?' })
  // Never keep the page waiting more than 1.5 s: "pending" = ask again in a moment
  const found = await lookupWithin(title, 1500, 'first')
  res.json(found || { text: '', photo: null, page: null, pending: true })
})

// GET /api/discover/photos?titles=Kyoto, Japan|Osaka, Japan  -> { "Kyoto, Japan": "https://...jpg", ... }
// Many photos in one request (Discover needs ~200), looked up a few at a time to be kind to Wikipedia.
router.get('/photos', async (req, res) => {
  const titles = String(req.query.titles || '').split('|').map((t) => t.trim().slice(0, 100)).filter(Boolean).slice(0, 300)
  // Wikipedia gets 1.5 s per title, then the saved photo is used (or null); a slower answer is
  // saved when it arrives, so the page's next ask (a few seconds later) gets it
  const out = {}
  await Promise.all(titles.map(async (t) => {
    const found = await lookupWithin(t, 1500, 'first')
    out[t] = found ? found.photo || null : null
  }))
  res.json(out)
})

// ---------- warm-up ----------
// A little after the server starts: download every country's flag (the country banners) into the disk cache
setTimeout(() => {
  warmFlags().catch((err) => console.warn('Flag warm-up skipped:', err.message))
}, 4000)

export default router
