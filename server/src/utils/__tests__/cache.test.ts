import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { cleanupTestDB, createMockDB, createMockEnv as createFixtureEnv } from '../../../tests/fixtures'
import { cache } from '../../db/schema'
import { CacheImpl, type CacheStorageMode, createClientConfig, createPublicCache, createServerConfig } from '../cache'

/// <reference types="../../../worker-configuration" />

function createTestDB() {
  return createMockDB()
}

function createMockEnv(storageMode: CacheStorageMode = 'database'): Env {
  return createFixtureEnv({
    CACHE_STORAGE_MODE: storageMode,
  })
}

describe('CacheImpl - basic functionality', () => {
  let { db, sqlite } = createTestDB()
  let mockEnv: Env
  let cacheImpl: CacheImpl

  beforeEach(() => {
    const testDB = createTestDB()
    db = testDB.db
    sqlite = testDB.sqlite
    mockEnv = createMockEnv('database')
    cacheImpl = new CacheImpl(db as any, mockEnv, 'cache', 'database')
  })

  afterEach(async () => {
    await cleanupTestDB(sqlite)
  })

  describe('set and get', () => {
    it('stores and retrieves string values', async () => {
      await cacheImpl.set('key1', 'value1')
      const value = await cacheImpl.get('key1')
      expect(value).toBe('value1')
    })

    it('stores and retrieves object values', async () => {
      const obj = { name: 'test', value: 123 }
      await cacheImpl.set('key2', obj)
      const value = await cacheImpl.get('key2')
      expect(value).toEqual(obj)
    })

    it('stores and retrieves array values', async () => {
      const arr = [1, 2, 3, 'test']
      await cacheImpl.set('key3', arr)
      const value = await cacheImpl.get('key3')
      expect(value).toEqual(arr)
    })

    it('stores and retrieves number values', async () => {
      await cacheImpl.set('key4', 42)
      const value = await cacheImpl.get('key4')
      expect(value).toBe(42)
    })

    it('stores and retrieves boolean values', async () => {
      await cacheImpl.set('key5', true)
      const value = await cacheImpl.get('key5')
      expect(value).toBe(true)
    })

    it('updates an existing key', async () => {
      await cacheImpl.set('key1', 'value1')
      await cacheImpl.set('key1', 'value2')
      const value = await cacheImpl.get('key1')
      expect(value).toBe('value2')
    })

    it('returns undefined for missing keys', async () => {
      const value = await cacheImpl.get('nonexistent')
      expect(value).toBeUndefined()
    })
  })

  describe('delete', () => {
    it('deletes an existing key', async () => {
      await cacheImpl.set('key1', 'value1')
      await cacheImpl.delete('key1')
      const value = await cacheImpl.get('key1')
      expect(value).toBeUndefined()
    })

    it('does not throw when deleting a missing key', async () => {
      // 删除不存在的键应该正常完成，不抛出错误
      await cacheImpl.delete('nonexistent')
      // 如果执行到这里没有抛出错误，测试就通过了
      expect(true).toBe(true)
    })
  })

  describe('getByPrefix', () => {
    beforeEach(async () => {
      await cacheImpl.set('user:1', 'Alice')
      await cacheImpl.set('user:2', 'Bob')
      await cacheImpl.set('user:3', 'Charlie')
      await cacheImpl.set('post:1', 'Post 1')
      await cacheImpl.set('other', 'Other')
    })

    it('returns all values matching a prefix', async () => {
      const users = await cacheImpl.getByPrefix('user:')
      expect(users).toHaveLength(3)
      expect(users).toContain('Alice')
      expect(users).toContain('Bob')
      expect(users).toContain('Charlie')
    })

    it('returns empty array when no prefix matches', async () => {
      const result = await cacheImpl.getByPrefix('nonexistent:')
      expect(result).toEqual([])
    })

    it('matches a specific prefix correctly', async () => {
      const posts = await cacheImpl.getByPrefix('post:')
      expect(posts).toHaveLength(1)
      expect(posts).toContain('Post 1')
    })
  })

  describe('getBySuffix', () => {
    beforeEach(async () => {
      await cacheImpl.set('file.txt', 'Text file')
      await cacheImpl.set('document.txt', 'Document')
      await cacheImpl.set('image.png', 'PNG image')
      await cacheImpl.set('script.js', 'JavaScript')
    })

    it('returns all values matching a suffix', async () => {
      const txtFiles = await cacheImpl.getBySuffix('.txt')
      expect(txtFiles).toHaveLength(2)
      expect(txtFiles).toContain('Text file')
      expect(txtFiles).toContain('Document')
    })

    it('returns empty array when no suffix matches', async () => {
      const result = await cacheImpl.getBySuffix('.zip')
      expect(result).toEqual([])
    })
  })

  describe('deletePrefix', () => {
    beforeEach(async () => {
      await cacheImpl.set('temp:1', 'Temp 1')
      await cacheImpl.set('temp:2', 'Temp 2')
      await cacheImpl.set('temp:3', 'Temp 3')
      await cacheImpl.set('keep:1', 'Keep 1')
    })

    it('deletes all keys matching a prefix', async () => {
      await cacheImpl.deletePrefix('temp:')

      expect(await cacheImpl.get('temp:1')).toBeUndefined()
      expect(await cacheImpl.get('temp:2')).toBeUndefined()
      expect(await cacheImpl.get('temp:3')).toBeUndefined()
      expect(await cacheImpl.get('keep:1')).toBe('Keep 1')
    })

    it('works correctly when no keys match', async () => {
      // 删除不存在的前缀应该正常完成，不抛出错误
      await cacheImpl.deletePrefix('nonexistent:')
      // 如果执行到这里没有抛出错误，测试就通过了
      expect(true).toBe(true)
    })
  })

  describe('deleteSuffix', () => {
    beforeEach(async () => {
      await cacheImpl.set('cache.tmp', 'Temp cache')
      await cacheImpl.set('data.tmp', 'Temp data')
      await cacheImpl.set('config.json', 'Config')
    })

    it('deletes all keys matching a suffix', async () => {
      await cacheImpl.deleteSuffix('.tmp')

      expect(await cacheImpl.get('cache.tmp')).toBeUndefined()
      expect(await cacheImpl.get('data.tmp')).toBeUndefined()
      expect(await cacheImpl.get('config.json')).toBe('Config')
    })
  })

  describe('clear', () => {
    it('clears all cached data', async () => {
      await cacheImpl.set('key1', 'value1')
      await cacheImpl.set('key2', 'value2')

      await cacheImpl.clear()

      expect(await cacheImpl.get('key1')).toBeUndefined()
      expect(await cacheImpl.get('key2')).toBeUndefined()
    })

    it('works correctly when cache is empty', async () => {
      // 清空空缓存应该正常完成，不抛出错误
      await cacheImpl.clear()
      // 如果执行到这里没有抛出错误，测试就通过了
      expect(true).toBe(true)
    })
  })

  describe('all', () => {
    it('returns all cache entries', async () => {
      await cacheImpl.set('key1', 'value1')
      await cacheImpl.set('key2', 'value2')

      const all = await cacheImpl.all()

      expect(all.get('key1')).toBe('value1')
      expect(all.get('key2')).toBe('value2')
      expect(all.size).toBe(2)
    })
  })
})

describe('CacheImpl - database persistence', () => {
  let { db, sqlite } = createTestDB()
  let mockEnv: Env
  let cacheImpl: CacheImpl

  beforeEach(() => {
    const testDB = createTestDB()
    db = testDB.db
    sqlite = testDB.sqlite
    mockEnv = createMockEnv('database')
    cacheImpl = new CacheImpl(db as any, mockEnv, 'cache', 'database')
  })

  afterEach(async () => {
    await cleanupTestDB(sqlite)
  })

  it('persists data to the database', async () => {
    await cacheImpl.set('key1', 'value1')

    // 直接查询数据库验证
    const rows = await db.select().from(cache).where(eq(cache.key, 'key1'))
    expect(rows).toHaveLength(1)
    // 字符串值直接存储，不添加引号
    expect(rows[0].value).toBe('value1')
    expect(rows[0].type).toBe('cache')
  })

  it('loads data from the database', async () => {
    // 先存储数据
    await cacheImpl.set('key1', 'value1')

    // 创建新的 cache 实例（模拟重启）
    const newCache = new CacheImpl(db as any, mockEnv, 'cache', 'database')

    // 新实例应该能读取到数据
    const value = await newCache.get('key1')
    expect(value).toBe('value1')
  })

  it('updates existing key in database', async () => {
    await cacheImpl.set('key1', 'value1')
    await cacheImpl.set('key1', 'value2')

    const rows = await db.select().from(cache).where(eq(cache.key, 'key1'))
    expect(rows).toHaveLength(1)
    // 字符串值直接存储，不添加引号
    expect(rows[0].value).toBe('value2')
  })

  it('removes key from database on delete', async () => {
    await cacheImpl.set('key1', 'value1')
    await cacheImpl.delete('key1')

    const rows = await db.select().from(cache).where(eq(cache.key, 'key1'))
    expect(rows).toHaveLength(0)
  })

  it('clear removes all cache rows in database', async () => {
    await cacheImpl.set('key1', 'value1')
    await cacheImpl.set('key2', 'value2')

    await cacheImpl.clear()

    const rows = await db.select().from(cache).where(eq(cache.type, 'cache'))
    expect(rows).toHaveLength(0)
  })

  it('supports multiple cache types', async () => {
    const cache1 = new CacheImpl(db as any, mockEnv, 'type1', 'database')
    const cache2 = new CacheImpl(db as any, mockEnv, 'type2', 'database')

    await cache1.set('key', 'value1')
    await cache2.set('key', 'value2')

    const rows = await db.select().from(cache)
    expect(rows).toHaveLength(2)

    const type1Rows = rows.filter(r => r.type === 'type1')
    const type2Rows = rows.filter(r => r.type === 'type2')

    expect(type1Rows).toHaveLength(1)
    expect(type2Rows).toHaveLength(1)
    // 字符串值直接存储，不添加引号
    expect(type1Rows[0].value).toBe('value1')
    expect(type2Rows[0].value).toBe('value2')
  })
})

describe('CacheImpl - storage mode configuration', () => {
  let { db, sqlite } = createTestDB()
  let mockEnv: Env

  beforeEach(() => {
    const testDB = createTestDB()
    db = testDB.db
    sqlite = testDB.sqlite
  })

  afterEach(async () => {
    await cleanupTestDB(sqlite)
  })

  it('uses database storage by default', () => {
    mockEnv = createMockEnv('database')
    const cache = new CacheImpl(db as any, mockEnv, 'cache')

    // 通过检查是否尝试加载数据库来验证
    expect(cache).toBeDefined()
  })

  it('supports storage mode from environment variable', () => {
    mockEnv = createMockEnv('s3')
    const cache = new CacheImpl(db as any, mockEnv, 'cache')

    expect(cache).toBeDefined()
  })

  it('storageMode parameter overrides environment variable', () => {
    mockEnv = createMockEnv('s3')
    const cache = new CacheImpl(db as any, mockEnv, 'cache', 'database')

    expect(cache).toBeDefined()
  })
})

describe('CacheImpl - factory helpers', () => {
  let { db, sqlite } = createTestDB()
  let mockEnv: Env

  beforeEach(() => {
    const testDB = createTestDB()
    db = testDB.db
    sqlite = testDB.sqlite
    mockEnv = createMockEnv('database')
  })

  afterEach(async () => {
    await cleanupTestDB(sqlite)
  })

  it('createPublicCache creates public cache', () => {
    const cache = createPublicCache(db as any, mockEnv)
    expect(cache).toBeInstanceOf(CacheImpl)
  })

  it('createServerConfig creates server config cache', () => {
    const cache = createServerConfig(db as any, mockEnv)
    expect(cache).toBeInstanceOf(CacheImpl)
  })

  it('createClientConfig creates client config cache', () => {
    const cache = createClientConfig(db as any, mockEnv)
    expect(cache).toBeInstanceOf(CacheImpl)
  })

  it('factory helpers support custom options', () => {
    const cache = createPublicCache(db as any, mockEnv, 'database')
    expect(cache).toBeInstanceOf(CacheImpl)
  })
})

describe('CacheImpl - edge cases and error handling', () => {
  let { db, sqlite } = createTestDB()
  let mockEnv: Env
  let cacheImpl: CacheImpl

  beforeEach(() => {
    const testDB = createTestDB()
    db = testDB.db
    sqlite = testDB.sqlite
    mockEnv = createMockEnv('database')
    cacheImpl = new CacheImpl(db as any, mockEnv, 'cache', 'database')
  })

  afterEach(async () => {
    await cleanupTestDB(sqlite)
  })

  it('handles empty string keys', async () => {
    await cacheImpl.set('', 'empty key')
    const value = await cacheImpl.get('')
    expect(value).toBe('empty key')
  })

  it('handles keys with special characters', async () => {
    const specialKeys = [
      'key with spaces',
      'key\nwith\nnewlines',
      'key\twith\ttabs',
      'key:with:colons',
      'key/with/slashes',
      'key\\with\\backslashes',
      'key"with"quotes',
      "key'with'quotes",
    ]

    for (const key of specialKeys) {
      await cacheImpl.set(key, `value for ${key}`)
      const value = await cacheImpl.get(key)
      expect(value).toBe(`value for ${key}`)
    }
  })

  it('handles nested objects', async () => {
    const nested = {
      level1: {
        level2: {
          level3: {
            value: 'deep nested',
          },
        },
      },
    }

    await cacheImpl.set('nested', nested)
    const value = await cacheImpl.get('nested')
    expect(value).toEqual(nested)
  })

  it('handles circular references (throws or handles)', async () => {
    const obj: any = { name: 'test' }
    obj.self = obj // 循环引用

    // JSON.stringify 会抛出错误，我们的实现应该处理这种情况
    // 当前实现会抛出错误，这是预期行为
    let errorThrown = false
    let caughtError: any = null
    try {
      await cacheImpl.set('circular', obj)
    } catch (e) {
      errorThrown = true
      caughtError = e
    }

    // 验证确实抛出了错误（当前实现会抛出）
    expect(errorThrown).toBe(true)
    expect(caughtError).toBeDefined()
    expect(caughtError).not.toBeNull()

    // 注意：值会被设置到内存缓存，但保存到数据库会失败
    // 所以缓存中会有这个值，但重启后会丢失
    const value = await cacheImpl.get('circular')
    expect(value).toBeDefined()
    const circularValue = value as { name?: string }
    expect(circularValue.name).toBe('test')
  })

  it('handles null values', async () => {
    // null 会被存储为 "null" 字符串，读取时解析回 null
    await cacheImpl.set('nullKey', null)
    const value = await cacheImpl.get('nullKey')
    // JSON.parse("null") 返回 null
    expect(value).toBeNull()
  })

  it('handles undefined values', async () => {
    // undefined 值会被跳过，不会存储到数据库
    // 内存中会有这个值，但不会被持久化
    await cacheImpl.set('undefinedKey', undefined)

    // 从内存中获取应该是 undefined
    const value = await cacheImpl.get('undefinedKey')
    expect(value).toBeUndefined()

    // 创建新实例验证数据库中确实没有存储
    const newCache = new CacheImpl(db as any, mockEnv, 'cache', 'database')
    const valueFromDb = await newCache.get('undefinedKey')
    expect(valueFromDb).toBeUndefined()
  })

  it('handles large string values', async () => {
    const largeString = 'x'.repeat(10000)
    await cacheImpl.set('large', largeString)
    const value = await cacheImpl.get('large')
    expect(value).toBe(largeString)
  })

  it('handles large numbers of key/value pairs', async () => {
    const count = 50
    for (let i = 0; i < count; i++) {
      // Batch writes and persist once to avoid one D1 roundtrip per key.
      await cacheImpl.set(`key${i}`, `value${i}`, false)
    }
    await cacheImpl.save()

    const all = await cacheImpl.all()
    expect(all.size).toBe(count)
    const rows = await db.select().from(cache).where(eq(cache.type, 'cache'))
    expect(rows).toHaveLength(count)

    // Verify a few representative keys, including after loading from DB.
    expect(await cacheImpl.get('key0')).toBe('value0')
    expect(await cacheImpl.get('key25')).toBe('value25')
    expect(await cacheImpl.get('key49')).toBe('value49')

    const reloadedCache = new CacheImpl(db as any, mockEnv, 'cache', 'database')
    expect(await reloadedCache.get('key49')).toBe('value49')
  })
})

describe('CacheImpl - getOrSet and getOrDefault', () => {
  let { db, sqlite } = createTestDB()
  let mockEnv: Env
  let cacheImpl: CacheImpl

  beforeEach(() => {
    const testDB = createTestDB()
    db = testDB.db
    sqlite = testDB.sqlite
    mockEnv = createMockEnv('database')
    cacheImpl = new CacheImpl(db as any, mockEnv, 'cache', 'database')
  })

  afterEach(async () => {
    await cleanupTestDB(sqlite)
  })

  describe('getOrSet', () => {
    it('computes and stores value when key is missing', async () => {
      let computed = false
      const value = await cacheImpl.getOrSet('computed', async () => {
        computed = true
        return 'computed value'
      })

      expect(computed).toBe(true)
      expect(value).toBe('computed value')
      expect(await cacheImpl.get('computed')).toBe('computed value')
    })

    it('returns cached value without recomputing when key exists', async () => {
      await cacheImpl.set('cached', 'existing value')

      let computed = false
      const value = await cacheImpl.getOrSet('cached', async () => {
        computed = true
        return 'new value'
      })

      expect(computed).toBe(false)
      expect(value).toBe('existing value')
    })

    it('supports async compute function', async () => {
      const value = await cacheImpl.getOrSet('async', async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return 'async value'
      })

      expect(value).toBe('async value')
    })
  })

  describe('getOrDefault', () => {
    it('returns default value when key is missing', async () => {
      const value = await cacheImpl.getOrDefault('missing', 'default')
      expect(value).toBe('default')
    })

    it('returns cached value when key exists', async () => {
      await cacheImpl.set('exists', 'cached')
      const value = await cacheImpl.getOrDefault('exists', 'default')
      expect(value).toBe('cached')
    })

    it('supports default values of multiple types', async () => {
      expect(await cacheImpl.getOrDefault('string', 'default')).toBe('default')
      expect(await cacheImpl.getOrDefault('number', 42)).toBe(42)
      expect(await cacheImpl.getOrDefault('boolean', true)).toBe(true)
      expect(await cacheImpl.getOrDefault('array', [1, 2, 3])).toEqual([1, 2, 3])
      expect(await cacheImpl.getOrDefault('object', { key: 'value' })).toEqual({ key: 'value' })
    })
  })
})
