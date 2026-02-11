import { useState, useEffect, useRef } from 'react'
import { onValue, off, get, query, orderByKey, limitToLast } from 'firebase/database'
import type { DatabaseReference } from 'firebase/database'
import { retryWithBackoff, isRetryableError } from '@/lib/retry-utils'

export interface UseFirebaseSyncParams<T> {
  ref: DatabaseReference
  enabled?: boolean
  limit?: number
  processData?: (data: any) => T
  onError?: (error: Error) => void
}

export interface UseFirebaseSyncReturn<T> {
  data: T | null
  loading: boolean
  error: string | null
  isConnected: boolean
  refresh: () => void
}

/**
 * Generic Firebase sync hook
 * Handles initial load + real-time updates pattern
 */
export function useFirebaseSync<T = any>({
  ref,
  enabled = true,
  limit,
  processData,
  onError,
}: UseFirebaseSyncParams<T>): UseFirebaseSyncReturn<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const isMountedRef = useRef(true)

  useEffect(() => {
    if (!enabled) {
      setData(null)
      setLoading(false)
      return
    }

    isMountedRef.current = true
    let unsubscribe: (() => void) | null = null

    const queryRef = limit ? query(ref, orderByKey(), limitToLast(limit)) : ref

    // Fast initial load
    const loadInitial = async () => {
      setLoading(true)
      try {
        const snapshot = await retryWithBackoff(() => get(queryRef), {
          maxAttempts: 3,
          initialDelay: 300,
          retryable: isRetryableError,
        })

        if (!isMountedRef.current) return

        if (!snapshot.exists()) {
          setData(null)
          setLoading(false)
          return
        }

        const rawData = snapshot.val()
        const processed = processData ? processData(rawData) : rawData

        if (isMountedRef.current) {
          setData(processed as T)
          setLoading(false)
          setError(null)
          setIsConnected(true)
        }
      } catch (err) {
        if (!isMountedRef.current) return
        const errorMessage = err instanceof Error ? err.message : 'Failed to load data'
        setError(errorMessage)
        setLoading(false)
        setIsConnected(false)
        onError?.(err instanceof Error ? err : new Error(errorMessage))
      }
    }

    // Real-time listener
    const setupListener = () => {
      unsubscribe = onValue(
        queryRef,
        snapshot => {
          if (!isMountedRef.current) return

          try {
            setIsConnected(true)
            setLoading(false)

            if (!snapshot.exists()) {
              setData(null)
              return
            }

            const rawData = snapshot.val()
            const processed = processData ? processData(rawData) : rawData

            setData(processed as T)
            setError(null)
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to process data'
            setError(errorMessage)
            setLoading(false)
            onError?.(err instanceof Error ? err : new Error(errorMessage))
          }
        },
        err => {
          if (!isMountedRef.current) return
          const errorMessage = err instanceof Error ? err.message : 'Connection error'
          setError(errorMessage)
          setIsConnected(false)
          setLoading(false)
          onError?.(err instanceof Error ? err : new Error(errorMessage))
        }
      )
    }

    loadInitial()
    const listenerTimeout = setTimeout(setupListener, 50)

    return () => {
      isMountedRef.current = false
      clearTimeout(listenerTimeout)
      if (unsubscribe) {
        unsubscribe()
      } else {
        off(queryRef)
      }
    }
  }, [ref, enabled, limit, processData, onError])

  const refresh = () => {
    setLoading(true)
    // Trigger reload by toggling enabled or ref
  }

  return { data, loading, error, isConnected, refresh }
}
