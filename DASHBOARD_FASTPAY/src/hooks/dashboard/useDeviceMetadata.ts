import { useState, useEffect, useRef } from 'react'
import { onValue, get } from 'firebase/database'
import {
  getDeviceMetadataPath,
  getDeviceSystemInfoPath,
  getHeartbeatsPath,
  getDeviceListPath,
} from '@/lib/firebase-helpers'
import { retryWithBackoff, isRetryableError } from '@/lib/retry-utils'

export interface UseDeviceMetadataParams {
  deviceId: string | null
}

export interface UseDeviceMetadataReturn {
  battery: number | null
  lastSeen: number | null
  dataEnabled: boolean | null
  deviceCode: string | null
  loading: boolean
  error: string | null
}

/**
 * Custom hook for managing device metadata
 * Handles battery, lastSeen, dataEnabled, and device code
 */
export function useDeviceMetadata({
  deviceId,
}: UseDeviceMetadataParams): UseDeviceMetadataReturn {
  const [battery, setBattery] = useState<number | null>(null)
  const [lastSeen, setLastSeen] = useState<number | null>(null)
  const [dataEnabled, setDataEnabled] = useState<boolean | null>(null)
  const [deviceCode, setDeviceCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const unsubscribesRef = useRef<Array<() => void>>([])

  useEffect(() => {
    if (!deviceId) {
      setBattery(null)
      setLastSeen(null)
      setDataEnabled(null)
      setDeviceCode(null)
      setLoading(false)
      return
    }

    let isMounted = true
    const unsubscribes: Array<() => void> = []
    unsubscribesRef.current = unsubscribes

    setLoading(true)
    setError(null)

    // Get device code from device metadata
    const deviceCodeRef = getDeviceMetadataPath(deviceId, 'code')
    get(deviceCodeRef)
      .then(codeSnap => {
        if (!isMounted) return
        if (codeSnap.exists()) {
          const code = codeSnap.val()
          setDeviceCode(typeof code === 'string' ? code : null)
        }
      })
      .catch(() => {
        if (!isMounted) return
        setDeviceCode(null)
      })

    // Listen to heartbeat for battery and lastSeen
    const heartbeatRef = getHeartbeatsPath(deviceId)
    const unsubscribeHeartbeat = onValue(heartbeatRef, heartbeatSnapshot => {
      if (!isMounted) return

      if (heartbeatSnapshot.exists()) {
        const heartbeat = heartbeatSnapshot.val()
        // "t" = timestamp (lastSeen), "b" = battery
        if (heartbeat.t && typeof heartbeat.t === 'number') {
          setLastSeen(heartbeat.t)
        }
        if (heartbeat.b !== undefined && typeof heartbeat.b === 'number') {
          setBattery(heartbeat.b)
        }
      } else {
        // Fallback: try main path if heartbeat doesn't exist
        const batteryRef = getDeviceMetadataPath(deviceId, 'batteryPercentage')
        const lastSeenRef = getDeviceMetadataPath(deviceId, 'lastSeen')

        Promise.all([get(batteryRef), get(lastSeenRef)])
          .then(([batterySnap, lastSeenSnap]) => {
            if (!isMounted) return

            if (batterySnap.exists() && typeof batterySnap.val() === 'number') {
              setBattery(batterySnap.val())
            } else {
              setBattery(null)
            }
            if (lastSeenSnap.exists() && typeof lastSeenSnap.val() === 'number') {
              setLastSeen(lastSeenSnap.val())
            } else {
              setLastSeen(null)
            }
          })
          .catch(() => {
            if (!isMounted) return
            setBattery(null)
            setLastSeen(null)
          })
      }
      setLoading(false)
    })
    unsubscribes.push(unsubscribeHeartbeat)

    // Listen to SimInfo (for data enabled status)
    const simInfoRef = getDeviceSystemInfoPath(deviceId, 'phoneSimInfo')
    const unsubscribeSimInfo = onValue(simInfoRef, snapshot => {
      if (!isMounted) return
      if (snapshot.exists()) {
        const simData = snapshot.val()
        if (simData && typeof simData.isDataEnabled === 'boolean') {
          setDataEnabled(simData.isDataEnabled)
        } else {
          setDataEnabled(null)
        }
      } else {
        // Fallback: check networkInfo for isConnected
        const networkRef = getDeviceSystemInfoPath(deviceId, 'networkInfo')
        const unsubscribeNetwork = onValue(networkRef, networkSnapshot => {
          if (!isMounted) return
          if (networkSnapshot.exists()) {
            const networkData = networkSnapshot.val()
            if (networkData && typeof networkData.isConnected === 'boolean') {
              setDataEnabled(networkData.isConnected)
            } else {
              setDataEnabled(null)
            }
          } else {
            setDataEnabled(null)
          }
        })
        unsubscribes.push(unsubscribeNetwork)
      }
    })
    unsubscribes.push(unsubscribeSimInfo)

    return () => {
      isMounted = false
      unsubscribes.forEach(unsub => unsub())
    }
  }, [deviceId])

  return { battery, lastSeen, dataEnabled, deviceCode, loading, error }
}
