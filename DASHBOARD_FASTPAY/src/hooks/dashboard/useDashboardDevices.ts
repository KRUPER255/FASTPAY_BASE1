import { useState, useEffect, useCallback, useRef } from 'react'
import { onValue } from 'firebase/database'
import { getHeartbeatsPath } from '@/lib/firebase-helpers'
import { fetchDevices } from '@/lib/api-client'
import type { User } from '@/pages/dashboard/types'

export interface UseDashboardDevicesParams {
  sessionEmail: string | null
  refreshTrigger?: number // Trigger to refresh devices (increment to trigger refresh)
}

export interface UseDashboardDevicesReturn {
  devices: User[]
  loading: boolean
  error: string | null
  refresh: () => void
}

interface DeviceData {
  name: string
  phone: string | null
  code: string | null
  lastSeen: number | null
  batteryPercentage: number | null
  isOnline: boolean
}

/**
 * Custom hook for managing dashboard devices
 * Handles Django API fetching and Firebase real-time heartbeat updates
 */
export function useDashboardDevices({
  sessionEmail,
  refreshTrigger = 0,
}: UseDashboardDevicesParams): UseDashboardDevicesReturn {
  const [devices, setDevices] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const deviceListenersRef = useRef<Array<() => void>>([])
  const deviceDataMapRef = useRef<Map<string, DeviceData>>(new Map())
  const deviceListNameMapRef = useRef<Set<string>>(new Set())
  const deviceListNameCheckedRef = useRef<Set<string>>(new Set())

  // Update devices list from deviceDataMap
  const updateDevicesList = useCallback((sessionEmail: string) => {
    const deviceIds = Array.from(deviceDataMapRef.current.keys())
    const usersList: User[] = deviceIds.map(id => {
      const data = deviceDataMapRef.current.get(id) || {
        name: id,
        phone: null,
        code: null,
        lastSeen: null,
        batteryPercentage: null,
        isOnline: false,
      }

      // Calculate isOnline based on lastSeen
      let isOnline = false
      if (data.lastSeen && typeof data.lastSeen === 'number') {
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
        isOnline = data.lastSeen > fiveMinutesAgo
      }

      // Format device name: if code exists and device-list/{code}/name doesn't exist, use "CODE - NAME"
      let displayName = data.name
      if (
        data.code &&
        deviceListNameCheckedRef.current.has(data.code) &&
        !deviceListNameMapRef.current.has(data.code)
      ) {
        displayName = `${data.code} - ${data.name}`
      }

      return {
        id: id,
        device: displayName,
        phone: data.phone,
        code: data.code,
        time: null,
        admin: sessionEmail,
        lastSeen: data.lastSeen,
        batteryPercentage: data.batteryPercentage,
        isOnline: isOnline,
      }
    })
    setDevices(usersList)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!sessionEmail) {
      setDevices([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    deviceListenersRef.current = []
    deviceDataMapRef.current.clear()

    // Fetch devices from Django API
    const loadDevicesFromDjango = async () => {
      try {
        // Clean up old listeners
        deviceListenersRef.current.forEach(unsub => unsub())
        deviceListenersRef.current = []
        deviceDataMapRef.current.clear()

        // Fetch devices from Django API
        const djangoDevices = await fetchDevices({ user_email: sessionEmail })

        if (!djangoDevices || djangoDevices.length === 0) {
          setDevices([])
          setLoading(false)
          return
        }

        // Initialize deviceDataMap with Django device data
        djangoDevices.forEach((device: any) => {
          const lastSeen = device.last_seen || device.time || null
          const batteryPercentage = device.battery_percentage ?? null
          const phone = device.current_phone || device.phone || null
          const name = device.name || device.model || device.device_id

          deviceDataMapRef.current.set(device.device_id, {
            name: name,
            phone: phone,
            code: device.code || null,
            lastSeen: typeof lastSeen === 'number' ? lastSeen : (lastSeen ? parseInt(String(lastSeen)) : null),
            batteryPercentage: batteryPercentage,
            isOnline: false, // Will be updated by heartbeat listener
          })
        })

        // Set up Firebase heartbeat listeners for real-time status updates
        const deviceIds = Array.from(deviceDataMapRef.current.keys())
        deviceIds.forEach(deviceId => {
          const deviceHeartbeatRef = getHeartbeatsPath(deviceId)
          const unsubscribeHeartbeat = onValue(deviceHeartbeatRef, heartbeatSnapshot => {
            let lastSeen: number | null = null
            let batteryPercentage: number | null = null

            if (heartbeatSnapshot.exists()) {
              const heartbeat = heartbeatSnapshot.val()
              // "t" = timestamp (lastSeen), "b" = battery
              if (heartbeat.t && typeof heartbeat.t === 'number') {
                lastSeen = heartbeat.t
              }
              if (heartbeat.b !== undefined && typeof heartbeat.b === 'number') {
                batteryPercentage = heartbeat.b
              }
            }

            // Update only status fields, keep metadata unchanged
            const currentData = deviceDataMapRef.current.get(deviceId) || {
              name: deviceId,
              phone: null,
              code: null,
              lastSeen: null,
              batteryPercentage: null,
              isOnline: false,
            }

            deviceDataMapRef.current.set(deviceId, {
              ...currentData,
              lastSeen: lastSeen ?? currentData.lastSeen,
              batteryPercentage: batteryPercentage ?? currentData.batteryPercentage,
            })
            updateDevicesList(sessionEmail)
          })
          deviceListenersRef.current.push(unsubscribeHeartbeat)
        })

        // Initial update after devices loaded
        updateDevicesList(sessionEmail)
      } catch (err) {
        console.error('Error loading devices from Django:', err)
        const errorMessage = err instanceof Error ? err.message : 'Failed to load devices'
        setError(errorMessage)
        setDevices([])
        setLoading(false)
      }
    }

    loadDevicesFromDjango()

    // Refresh every 30 seconds to get updated device list from Django
    const refreshInterval = setInterval(loadDevicesFromDjango, 30000)

    return () => {
      clearInterval(refreshInterval)
      deviceListenersRef.current.forEach(unsub => unsub())
    }
  }, [sessionEmail, refreshTrigger, updateDevicesList])

  const refresh = useCallback(() => {
    if (sessionEmail) {
      setLoading(true)
      // The refreshTrigger prop will trigger the useEffect to re-run
    }
  }, [sessionEmail])

  return { devices, loading, error, refresh }
}
