/**
 * Data Cache Manager
 *
 * Provides intelligent caching for device data to enable instant device switching.
 * Uses in-memory cache with LRU (Least Recently Used) eviction policy.
 *
 * Features:
 * - Fast in-memory cache
 * - LRU eviction (keeps most recently used)
 * - TTL (Time To Live) support
 * - Cache invalidation
 * - Request deduplication
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  accessCount: number
  lastAccessed: number
}

interface CacheOptions {
  maxSize?: number // Maximum number of entries
  ttl?: number // Time to live in milliseconds
}

class DataCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map()
  private maxSize: number
  private ttl: number | null
  private pendingRequests: Map<string, Promise<T>> = new Map()

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize || 10 // Default: cache 10 devices
    this.ttl = options.ttl || null // Default: no expiration
  }

  /**
   * Get data from cache or return null if not found/expired
   */
  get(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // Check TTL
    if (this.ttl && Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return null
    }

    // Update access info
    entry.lastAccessed = Date.now()
    entry.accessCount++

    return entry.data
  }

  /**
   * Set data in cache with LRU eviction
   */
  set(key: string, data: T): void {
    // If cache is full, remove least recently used
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU()
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now(),
    })
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let lruKey: string | null = null
    let lruTime = Infinity

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed
        lruKey = key
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey)
    }
  }

  /**
   * Check if key exists in cache and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    // Check TTL
    if (this.ttl && Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  /**
   * Remove entry from cache
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
    this.pendingRequests.clear()
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: Array.from(this.cache.keys()),
    }
  }

  /**
   * Request deduplication - prevents multiple simultaneous requests for same data
   */
  async fetch(key: string, fetcher: () => Promise<T>): Promise<T> {
    // Check cache first
    const cached = this.get(key)
    if (cached !== null) {
      return cached
    }

    // Check if request is already pending
    const pending = this.pendingRequests.get(key)
    if (pending) {
      return pending
    }

    // Create new request
    const request = fetcher()
      .then(data => {
        this.set(key, data)
        this.pendingRequests.delete(key)
        return data
      })
      .catch(error => {
        this.pendingRequests.delete(key)
        throw error
      })

    this.pendingRequests.set(key, request)
    return request
  }
}

/**
 * Cache instances for different data types
 */
export const smsCache = new DataCache<any[]>({
  maxSize: 10, // Cache 10 devices' SMS
  ttl: 5 * 60 * 1000, // 5 minutes
})

export const notificationsCache = new DataCache<any[]>({
  maxSize: 10,
  ttl: 5 * 60 * 1000,
})

export const contactsCache = new DataCache<any[]>({
  maxSize: 10,
  ttl: 10 * 60 * 1000, // 10 minutes (contacts change less frequently)
})

export const deviceStatusCache = new DataCache<'online' | 'offline' | 'checking'>({
  maxSize: 20,
  ttl: 1 * 60 * 1000, // 1 minute
})

/**
 * Clear all caches
 */
export function clearAllCaches() {
  smsCache.clear()
  notificationsCache.clear()
  contactsCache.clear()
  deviceStatusCache.clear()
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats() {
  return {
    sms: smsCache.getStats(),
    notifications: notificationsCache.getStats(),
    contacts: contactsCache.getStats(),
    deviceStatus: deviceStatusCache.getStats(),
  }
}
