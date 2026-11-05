// Answers from outside services (places, travel times, weather, rates...), kept in the database.
// On Vercel every server instance starts empty and its files are wiped, so answers are kept in MongoDB
// (shared by every instance), with a copy in memory so the same instance doesn't ask the database twice.
//
// Routes use cacheAndFetch(), the one way an outside service is asked:
//   1. the saved answer and the service are asked at the same time
//   2. the service answers          -> that answer is used, and saved
//   3. the service has no answer    -> the saved answer, if it hasn't expired (maxAgeMs)
//   4. neither                      -> null: the route shows "no data" (nothing is made up)
//
//   const legs = sharedCache('travel-legs', { keepDays: 90 })
//   const got = await cacheAndFetch(legs, key, () => lookUp(from, to), { maxAgeMs: 90 * DAY })
//   if (!got) return res.status(404).json({ message: 'No data' })
//   res.json(got.value)
import mongoose from 'mongoose'
import CacheEntry from './models/CacheEntry.js'

export const DAY = 24 * 60 * 60 * 1000
const MEMORY_LIMIT = 2000 // answers kept in memory per cache

const dbReady = () => mongoose.connection.readyState === 1

export function sharedCache(name, { keepDays = 30 } = {}) {
  const memory = new Map() // key -> { value, at }

  function remember(key, entry) {
    if (!memory.has(key) && memory.size >= MEMORY_LIMIT) memory.delete(memory.keys().next().value) // drop the oldest
    memory.set(key, entry)
  }

  return {
    name,
    async get(key) {
      if (memory.has(key)) return memory.get(key)
      if (!dbReady()) return null
      try {
        const saved = await CacheEntry.findOne({ name, key }).lean()
        if (!saved) return null
        const entry = { value: saved.value, at: new Date(saved.at).getTime() }
        remember(key, entry)
        return entry
      } catch (err) {
        console.warn('Could not read the ' + name + ' cache:', err.message)
        return null
      }
    },

    async set(key, value) {
      const at = Date.now()
      remember(key, { value, at })
      if (!dbReady()) return
      try {
        await CacheEntry.updateOne(
          { name, key },
          { $set: { value, at: new Date(at), expiresAt: new Date(at + keepDays * DAY) } },
          { upsert: true }
        )
      } catch (err) {
        console.warn('Could not save the ' + name + ' cache:', err.message)
      }
    }
  }
}

// fetcher() returns the service's answer, or null/undefined when it has none (a thrown error counts as none).
// waitMs (optional): how long to wait for the service; a slower answer counts as none for this request,
// but is still saved when it arrives.
// Returns { value, from: 'api' | 'cache', at } or null.
const asking = new Map() // 'cache|key' -> the service call on its way (two requests at once share one call)
export async function cacheAndFetch(cache, key, fetcher, { maxAgeMs, waitMs }) {
  const id = cache.name + '|' + key
  let call = asking.get(id)
  if (!call) {
    call = Promise.resolve()
      .then(fetcher)
      .then(async (value) => {
        if (value == null) return null
        await cache.set(key, value)
        return value
      })
      .catch((err) => {
        console.warn('Outside service failed (' + id + '):', err.message)
        return null
      })
      .finally(() => asking.delete(id))
    asking.set(id, call)
  }
  const late = new Promise((resolve) => {
    if (waitMs != null) setTimeout(() => resolve(null), waitMs)
  })
  const [saved, fresh] = await Promise.all([cache.get(key), Promise.race([call, late])])
  if (fresh != null) return { value: fresh, from: 'api', at: Date.now() }
  if (saved && Date.now() - saved.at < maxAgeMs) return { value: saved.value, from: 'cache', at: saved.at }
  return null
}
