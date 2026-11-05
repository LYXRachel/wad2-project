import { describe, it, expect } from 'vitest'
import { sharedCache, cacheAndFetch } from '../../../server/sharedCache.js'

// No database in tests: the cache keeps answers in memory only
let n = 0
const fresh = () => sharedCache('test-' + n++)
const HOUR = 3600 * 1000

describe('cacheAndFetch', () => {
  it('no cache, API answers: uses the API and saves it', async () => {
    const cache = fresh()
    const got = await cacheAndFetch(cache, 'k', async () => 'api', { maxAgeMs: HOUR })
    expect(got).toMatchObject({ value: 'api', from: 'api' })
    expect((await cache.get('k')).value).toBe('api')
  })

  it('cache and API both answer: the API wins and replaces the cache', async () => {
    const cache = fresh()
    await cache.set('k', 'old')
    const got = await cacheAndFetch(cache, 'k', async () => 'new', { maxAgeMs: HOUR })
    expect(got).toMatchObject({ value: 'new', from: 'api' })
    expect((await cache.get('k')).value).toBe('new')
  })

  it('API has no data: uses the unexpired cache', async () => {
    const cache = fresh()
    await cache.set('k', 'saved')
    const got = await cacheAndFetch(cache, 'k', async () => null, { maxAgeMs: HOUR })
    expect(got).toMatchObject({ value: 'saved', from: 'cache' })
  })

  it('API fails: uses the unexpired cache', async () => {
    const cache = fresh()
    await cache.set('k', 'saved')
    const got = await cacheAndFetch(cache, 'k', async () => { throw new Error('down') }, { maxAgeMs: HOUR })
    expect(got).toMatchObject({ value: 'saved', from: 'cache' })
  })

  it('API has no data and the cache has expired: no data', async () => {
    const cache = fresh()
    await cache.set('k', 'saved')
    const got = await cacheAndFetch(cache, 'k', async () => null, { maxAgeMs: 0 })
    expect(got).toBeNull()
  })

  it('no cache and no API: no data (nothing made up)', async () => {
    const got = await cacheAndFetch(fresh(), 'k', async () => { throw new Error('down') }, { maxAgeMs: HOUR })
    expect(got).toBeNull()
  })

  it('API slower than waitMs: uses the cache now, saves the late answer', async () => {
    const cache = fresh()
    await cache.set('k', 'saved')
    let finish
    const slow = new Promise((resolve) => { finish = resolve })
    const got = await cacheAndFetch(cache, 'k', () => slow, { maxAgeMs: HOUR, waitMs: 10 })
    expect(got).toMatchObject({ value: 'saved', from: 'cache' })
    finish('late')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect((await cache.get('k')).value).toBe('late')
  })

  it('asks the API and the cache at the same time', async () => {
    const cache = fresh()
    const order = []
    const get = cache.get
    cache.get = async (key) => { order.push('cache'); return get(key) }
    await cacheAndFetch(cache, 'k', async () => { order.push('api'); return 'v' }, { maxAgeMs: HOUR })
    expect(order.sort()).toEqual(['api', 'cache'])
  })
})
