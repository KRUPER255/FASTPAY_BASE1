import { useState, useEffect } from 'react'
import { onValue, off, get } from 'firebase/database'
import { getDeviceMetadataPath } from '@/lib/firebase-helpers'
import { retryWithBackoff, isRetryableError } from '@/lib/retry-utils'
import { deviceStatusCache } from '@/lib/data-cache'

export type DeviceStatus = 'online' | 'offline' | 'checking'

export interface UseDeviceStatusParams {
  deviceId: string | null
  refreshTrigger?: number
}

export interface UseDeviceStatusReturn {
  status: DeviceStatus
  refresh: () => void
}

/**
 * Custom hook for managing device status
 * Checks if device is online based on lastSeen timestamp
 */
export function useDeviceStatus({
  deviceId,
  refreshTrigger = 0,
}: UseDeviceStatusParams): UseDeviceStatusReturn {
  const [status, setStatus] = useState<DeviceStatus>('checking')

  useEffect(() => {
    if (!deviceId) {
      setStatus('checking')
      return
    }

    let isMounted = true
    let unsubscribe: (() => void) | null = null

    const cacheKey = `status-${deviceId}`

    // Show cached status immediately
    const cachedStatus = deviceStatusCache.get(cacheKey)
    if (cachedStatus && cachedStatus !== 'checking') {
      setStatus(cachedStatus)
    } else {
      setStatus('checking')
    }

    // Check device status by checking lastSeen timestamp
    const deviceRef = getDeviceMetadataPath(deviceId, 'lastSeen')

    const checkStatus = (lastSeen: number | null) => {
      if (!isMounted) return

      let newStatus: DeviceStatus = 'offline'

      if (!lastSeen || typeof lastSeen !== 'number') {
        newStatus = 'offline'
      } else {
        const now = Date.now()
        const fiveMinutesAgo = now - 5 * 60 * 1000 // 5 minutes

        if (lastSeen > fiveMinutesAgo) {
          newStatus = 'online'
        } else {
          newStatus = 'offline'
        }
      }

      deviceStatusCache.set(cacheKey, newStatus)
      setStatus(newStatus)
    }

    // Fast initial load
    const loadInitialStatus = async () => {
      try {
        const snapshot = await retryWithBackoff(() => get(deviceRef), {
          maxAttempts: 2,
          initialDelay: 300,
          retryable: isRetryableError,
        })
        if (isMounted) {
          checkStatus(snapshot.exists() ? snapshot.val() : null)
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error loading device status:', err)
          setStatus('offline')
          deviceStatusCache.set(cacheKey, 'offline')
        }
      }
    }

    // Real-time listener
    const setupRealtimeListener = () => {
      unsubscribe = onValue(
        deviceRef,
        snapshot => {
          if (!isMounted) return
          checkStatus(snapshot.exists() ? snapshot.val() : null)
        },
        err => {
          if (!isMounted) return
          console.error('Error listening to device status:', err)
          setStatus('offline')
          deviceStatusCache.set(cacheKey, 'offline')
        }
      )
    }

    loadInitialStatus()
    const listenerTimeout = setTimeout(setupRealtimeListener, 50)

    return () => {
      isMounted = false
      clearTimeout(listenerTimeout)
      if (unsubscribe) {
        unsubscribe()
      } else {
        off(deviceRef)
      }
    }
  }, [deviceId, refreshTrigger])

  const refresh = () => {
    // Trigger refresh by updating dependency
    if (deviceId) {
      const cacheKey = `status-${deviceId}`
      deviceStatusCache.delete(cacheKey)
    }
  }

  return { status, refresh }
}
