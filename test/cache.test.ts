import { Cache } from '../src/cache'
import { sleep } from '../src/util'

describe('cache', () => {
  test('set() and get()', () => {
    const cache = new Cache<string, number>({ ttl: 60_000, capacity: 1000 })
    expect(cache.size).toBe(0)
    expect(cache.isFull()).toBeFalsy()
    expect(cache.isEmpty()).toBeTruthy()
    cache.set('a', 1)
    cache.set('b', 2)
    expect(cache.get('a')).toBe(1)
    expect(cache.get('b')).toBe(2)
    expect(cache.has('c')).toBeFalsy()
    expect(cache.size).toBe(2)
    expect(cache.isFull()).toBeFalsy()
    expect(cache.isEmpty()).toBeFalsy()
  })

  test('get() when expired', async () => {
    const cache = new Cache<string, number>({ ttl: 1, capacity: 1000 })
    cache.set('a', 1)
    cache.set('b', 2)
    expect(cache.size).toBe(2)
    expect(cache.isFull()).toBeFalsy()
    expect(cache.isEmpty()).toBeFalsy()
    await sleep(10)
    expect(cache.has('a')).toBeFalsy()
    expect(cache.has('b')).toBeFalsy()
    expect(cache.has('c')).toBeFalsy()
    expect(cache.size).toBe(0)
    expect(cache.isFull()).toBeFalsy()
    expect(cache.isEmpty()).toBeTruthy()
  })

  test('set() with full', () => {
    const cache = new Cache<string, number>({ ttl: 60_000, capacity: 3 })
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)
    expect(cache.size).toBe(3)
    expect(cache.isFull()).toBeTruthy()
    expect(cache.isEmpty()).toBeFalsy()
    cache.set('d', 4)
    cache.set('a', 5)
    expect(cache.size).toBe(3)
    expect(cache.isFull()).toBeTruthy()
    expect(cache.isEmpty()).toBeFalsy()
    expect(cache.get('a')).toBe(5)
    expect(cache.has('b')).toBeFalsy()
    expect(cache.get('c')).toBe(3)
    expect(cache.get('d')).toBe(4)
    expect(cache.has('e')).toBeFalsy()
  })

  test('delete()', () => {
    const cache = new Cache<string, number>({ ttl: 60_000, capacity: 3 })
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)
    expect(cache.size).toBe(3)
    expect(cache.isFull()).toBeTruthy()
    expect(cache.isEmpty()).toBeFalsy()
    expect(cache.get('a')).toBe(1)
    expect(cache.get('b')).toBe(2)
    expect(cache.get('c')).toBe(3)
    cache.delete('b')
    expect(cache.size).toBe(2)
    expect(cache.isFull()).toBeFalsy()
    expect(cache.isEmpty()).toBeFalsy()
    expect(cache.get('a')).toBe(1)
    expect(cache.has('b')).toBeFalsy()
    expect(cache.get('c')).toBe(3)
  })

  test('clear()', () => {
    const cache = new Cache<string, number>({ ttl: 60_000, capacity: 3 })
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)
    expect(cache.size).toBe(3)
    expect(cache.isFull()).toBeTruthy()
    expect(cache.isEmpty()).toBeFalsy()
    expect(cache.get('a')).toBe(1)
    expect(cache.get('b')).toBe(2)
    expect(cache.get('c')).toBe(3)
    cache.clear()
    expect(cache.size).toBe(0)
    expect(cache.isFull()).toBeFalsy()
    expect(cache.isEmpty()).toBeTruthy()
    expect(cache.has('a')).toBeFalsy()
    expect(cache.has('b')).toBeFalsy()
    expect(cache.has('c')).toBeFalsy()
  })

  test('set() with full and no expiration', () => {
    const cache = new Cache<string, number>({ capacity: 3 })
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)
    expect(cache.size).toBe(3)
    expect(cache.isFull()).toBeTruthy()
    expect(cache.isEmpty()).toBeFalsy()

    cache.set('d', 4)
    cache.set('a', 5)
    expect(cache.size).toBe(3)
    expect(cache.isFull()).toBeTruthy()
    expect(cache.isEmpty()).toBeFalsy()
    expect(cache.get('a')).toBe(5)
    expect(cache.has('b')).toBeFalsy()
    expect(cache.get('c')).toBe(3)
    expect(cache.get('d')).toBe(4)
    expect(cache.has('e')).toBeFalsy()
  })
})
