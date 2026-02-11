/**
 * Firebase Real-time Sync Utilities
 *
 * Best practices for Firebase Realtime Database synchronization:
 * 1. Use once() for initial load, onValue() for updates
 * 2. Proper listener cleanup
 * 3. Connection state management
 * 4. Optimized queries with limits
 * 5. Debouncing/throttling for rapid changes
 * 6. Error handling and retry logic
 */

import { ref, onValue, off, get, query, orderByKey, limitToLast } from 'firebase/database'
import type { DatabaseReference } from 'firebase/database'
import { database } from './firebase'

export interface SyncOptions {
  limit?: number
  debounceMs?: number
  retryAttempts?: number
  retryDelayMs?: number
}

export interface SyncResult<T> {
  data: T | null
  error: Error | null
  loading: boolean
  unsubscribe: () => void
}

/**
 * Optimized real-time sync with initial load + updates pattern
 *
 * Pattern:
 * 1. Use get() for initial fast load
 * 2. Use onValue() for real-time updates
 * 3. Proper cleanup
 */
export function createOptimizedSync<T>(
  pathRef: DatabaseReference,
  onData: (data: T | null) => void,
  onError?: (error: Error) => void,
  options: SyncOptions = {}
): () => void {
  const { limit } = options
  let isMounted = true
  let unsubscribe: (() => void) | null = null

  // Step 1: Fast initial load using get()
  const initialLoad = async () => {
    try {
      const queryRef = limit ? query(pathRef, orderByKey(), limitToLast(limit)) : pathRef
      const snapshot = await get(queryRef)

      if (!isMounted) return

      const data = snapshot.exists() ? (snapshot.val() as T) : null
      onData(data)
    } catch (error) {
      if (!isMounted) return
      const err = error instanceof Error ? error : new Error('Failed to load data')
      onError?.(err)
    }
  }

  // Step 2: Set up real-time listener for updates
  const setupListener = () => {
    const queryRef = limit ? query(pathRef, orderByKey(), limitToLast(limit)) : pathRef

    unsubscribe = onValue(
      queryRef,
      snapshot => {
        if (!isMounted) return

        try {
          const data = snapshot.exists() ? (snapshot.val() as T) : null
          onData(data)
        } catch (error) {
          const err = error instanceof Error ? error : new Error('Failed to process data')
          onError?.(err)
        }
      },
      error => {
        if (!isMounted) return
        const err = error instanceof Error ? error : new Error('Connection error')
        onError?.(err)
      }
    )
  }

  // Start initial load
  initialLoad()

  // Set up listener after initial load
  // Small delay to allow initial load to complete
  setTimeout(setupListener, 50)

  // Cleanup function
  return () => {
    isMounted = false
    if (unsubscribe) {
      unsubscribe()
    } else {
      off(pathRef)
    }
  }
}

/**
 * Debounced sync - prevents rapid updates
 */
export function createDebouncedSync<T>(
  pathRef: DatabaseReference,
  onData: (data: T | null) => void,
  onError?: (error: Error) => void,
  options: SyncOptions = {}
): () => void {
  const { debounceMs = 300 } = options
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let lastData: T | null = null

  const debouncedOnData = (data: T | null) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    debounceTimer = setTimeout(() => {
      if (JSON.stringify(data) !== JSON.stringify(lastData)) {
        lastData = data
        onData(data)
      }
    }, debounceMs)
  }

  return createOptimizedSync(pathRef, debouncedOnData, onError, options)
}

/**
 * Connection state manager
 */
export class FirebaseConnectionManager {
  private static instance: FirebaseConnectionManager
  private connectionState: 'connected' | 'disconnected' | 'unknown' = 'unknown'
  private listeners: Set<(state: 'connected' | 'disconnected') => void> = new Set()

  static getInstance(): FirebaseConnectionManager {
    if (!FirebaseConnectionManager.instance) {
      FirebaseConnectionManager.instance = new FirebaseConnectionManager()
    }
    return FirebaseConnectionManager.instance
  }

  private constructor() {
    // Monitor connection state
    const connectedRef = ref(database, '.info/connected')
    onValue(connectedRef, snapshot => {
      const connected = snapshot.val() === true
      this.connectionState = connected ? 'connected' : 'disconnected'
      this.notifyListeners()
    })
  }

  subscribe(callback: (state: 'connected' | 'disconnected') => void): () => void {
    this.listeners.add(callback)
    if (this.connectionState !== 'unknown') {
      callback(this.connectionState) // Immediate callback with current state
    }

    return () => {
      this.listeners.delete(callback)
    }
  }

  private notifyListeners() {
    if (this.connectionState !== 'unknown') {
      this.listeners.forEach(callback =>
        callback(this.connectionState as 'connected' | 'disconnected')
      )
    }
  }

  getState(): 'connected' | 'disconnected' | 'unknown' {
    return this.connectionState
  }
}

/**
 * Retry logic for failed syncs
 */
export async function syncWithRetry<T>(
  pathRef: DatabaseReference,
  onData: (data: T | null) => void,
  onError?: (error: Error) => void,
  options: SyncOptions = {}
): Promise<() => void> {
  const { retryAttempts = 3, retryDelayMs = 1000 } = options
  let attempts = 0
  let unsubscribe: (() => void) | null = null

  const attemptSync = (): (() => void) => {
    try {
      return createOptimizedSync(
        pathRef,
        onData,
        error => {
          attempts++
          if (attempts < retryAttempts) {
            setTimeout(() => {
              if (unsubscribe) unsubscribe()
              unsubscribe = attemptSync()
            }, retryDelayMs * attempts)
          } else {
            onError?.(error)
          }
        },
        options
      )
    } catch (error) {
      attempts++
      if (attempts < retryAttempts) {
        setTimeout(() => {
          unsubscribe = attemptSync()
        }, retryDelayMs * attempts)
      } else {
        onError?.(error instanceof Error ? error : new Error('Sync failed'))
      }
      return () => {}
    }
  }

  unsubscribe = attemptSync()
  return () => {
    if (unsubscribe) unsubscribe()
  }
}

/**
 * Batch sync - sync multiple paths efficiently
 */
export function createBatchSync<T extends Record<string, any>>(
  paths: Record<keyof T, DatabaseReference>,
  onData: (data: Partial<T>) => void,
  onError?: (error: Error, key: keyof T) => void,
  options: SyncOptions = {}
): () => void {
  const unsubscribes: Array<() => void> = []
  const dataCache: Partial<T> = {}
  let isComplete = false

  Object.entries(paths).forEach(([key, pathRef]) => {
    const unsubscribe = createOptimizedSync(
      pathRef,
      data => {
        dataCache[key as keyof T] = data as T[keyof T]
        if (isComplete || Object.keys(dataCache).length === Object.keys(paths).length) {
          isComplete = true
          onData({ ...dataCache })
        }
      },
      error => {
        onError?.(error, key as keyof T)
      },
      options
    )
    unsubscribes.push(unsubscribe)
  })

  return () => {
    unsubscribes.forEach(unsub => unsub())
  }
}
