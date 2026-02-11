import { useEffect, useState, useRef } from 'react'
import { onValue, off, query, orderByKey, limitToLast, get } from 'firebase/database'
import {
  getDeviceMessagesPath,
  getDeviceMetadataPath,
  getUserDevicesPath,
  getAllDevicesPath,
  getDeviceListPath,
  getHeartbeatsPath,
} from '@/lib/firebase-helpers'
import type { Device } from '../types'
import type { MessageProcessor } from '@/lib/message-processors'
import type { Message } from '../types'

interface UseOTPDevicesParams {
  sessionEmail: string | null
  messageLimit: number
  selectedProcessor: MessageProcessor
  processorInput?: string
}

interface UseOTPDevicesReturn {
  devices: Device[]
  loading: boolean
  taglineMap: Map<string, string>
}

export function useOTPDevices({
  sessionEmail,
  messageLimit,
  selectedProcessor,
  processorInput = '',
}: UseOTPDevicesParams): UseOTPDevicesReturn {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [taglineMap, setTaglineMap] = useState<Map<string, string>>(new Map())
  const fetchedTaglinesRef = useRef<Set<string>>(new Set())

  // Fetch Tagline for devices when code is available
  useEffect(() => {
    const taglinePromises: Promise<void>[] = []

    devices.forEach(device => {
      if (device.metadata.code && !fetchedTaglinesRef.current.has(device.metadata.code)) {
        fetchedTaglinesRef.current.add(device.metadata.code)
        const taglinePromise = (async () => {
          try {
            const taglineRef = getDeviceListPath(device.metadata.code!, 'Tagline')
            const taglineSnapshot = await get(taglineRef)
            if (taglineSnapshot.exists()) {
              const tagline = taglineSnapshot.val()
              if (typeof tagline === 'string') {
                setTaglineMap(prev => new Map(prev).set(device.metadata.code!, tagline))
              }
            }
          } catch (error) {
            console.error(`Error fetching tagline for code ${device.metadata.code}:`, error)
          }
        })()
        taglinePromises.push(taglinePromise)
      }
    })

    if (taglinePromises.length > 0) {
      Promise.all(taglinePromises).catch(console.error)
    }
  }, [devices])

  // Load devices assigned to user
  useEffect(() => {
    if (!sessionEmail) {
      setDevices([])
      setLoading(false)
      return
    }

    setLoading(true)
    // Replace . with 'dot' in email for Firebase key compatibility
    const emailPath = sessionEmail.replace(/\./g, "'dot'")

    // For demo user, fetch all devices from the main fastpay node
    // For regular users, fetch only their assigned devices
    const adminDevicesRef =
      sessionEmail === 'demo@fastpay.com' ? getAllDevicesPath() : getUserDevicesPath(emailPath)

    const deviceListeners: Array<() => void> = []
    const deviceDataMap = new Map<string, Device>()

    const updateDevicesList = () => {
      const deviceIds = Array.from(deviceDataMap.keys())
      const devicesList: Device[] = deviceIds.map(id => {
        const device = deviceDataMap.get(id)
        return device || { id, metadata: {}, messages: [] }
      })
      setDevices(devicesList)
      setLoading(false)
    }

    // Listen to user's device list
    const unsubscribeDevices = onValue(adminDevicesRef, snapshot => {
      if (!snapshot.exists()) {
        setDevices([])
        setLoading(false)
        return
      }

      const adminDevices = snapshot.val()
      const deviceIds = Object.keys(adminDevices)

      // Clean up old listeners
      deviceListeners.forEach(unsub => unsub())
      deviceListeners.length = 0
      deviceDataMap.clear()

      // Set up listeners for each device
      deviceIds.forEach(deviceId => {
        // Initialize device
        deviceDataMap.set(deviceId, {
          id: deviceId,
          metadata: {},
          messages: [],
        })

        // Listen to device name (real-time)
        const deviceNameRef = getDeviceMetadataPath(deviceId, 'name')
        const unsubscribeName = onValue(deviceNameRef, nameSnapshot => {
          const device = deviceDataMap.get(deviceId)
          if (device) {
            let deviceName = deviceId
            if (nameSnapshot.exists()) {
              const nameData = nameSnapshot.val()
              if (typeof nameData === 'string') {
                deviceName = nameData
              } else if (typeof nameData === 'object' && nameData !== null) {
                const keys = Object.keys(nameData)
                deviceName = keys.length > 0 ? keys[0] : deviceId
              }
            }
            device.metadata.name = deviceName
            deviceDataMap.set(deviceId, device)
            updateDevicesList()
          }
        })
        deviceListeners.push(unsubscribeName)

        // Listen to device currentPhone (primary) and phone (fallback) - real-time
        const deviceCurrentPhoneRef = getDeviceMetadataPath(deviceId, 'currentPhone')
        const devicePhoneRef = getDeviceMetadataPath(deviceId, 'phone')

        let currentPhoneValue: string | null = null
        let phoneValue: string | null = null

        const updatePhoneNumber = () => {
          const device = deviceDataMap.get(deviceId)
          if (device) {
            const phoneNumber = currentPhoneValue || phoneValue
            device.metadata.currentPhone = currentPhoneValue ?? undefined
            device.metadata.phone = phoneNumber ?? undefined
            deviceDataMap.set(deviceId, device)
            updateDevicesList()
          }
        }

        const unsubscribeCurrentPhone = onValue(deviceCurrentPhoneRef, phoneSnapshot => {
          if (phoneSnapshot.exists()) {
            const phoneData = phoneSnapshot.val()
            if (typeof phoneData === 'string') {
              currentPhoneValue = phoneData
            } else if (typeof phoneData === 'object' && phoneData !== null) {
              const keys = Object.keys(phoneData)
              currentPhoneValue = keys.length > 0 ? keys[0] : null
            }
          } else {
            currentPhoneValue = null
          }
          updatePhoneNumber()
        })
        deviceListeners.push(unsubscribeCurrentPhone)

        const unsubscribePhone = onValue(devicePhoneRef, phoneSnapshot => {
          if (phoneSnapshot.exists()) {
            const phoneData = phoneSnapshot.val()
            if (typeof phoneData === 'string') {
              phoneValue = phoneData
            } else if (typeof phoneData === 'object' && phoneData !== null) {
              const keys = Object.keys(phoneData)
              phoneValue = keys.length > 0 ? keys[0] : null
            }
          } else {
            phoneValue = null
          }
          // Only update if currentPhone is not available
          if (!currentPhoneValue) {
            updatePhoneNumber()
          }
        })
        deviceListeners.push(unsubscribePhone)

        // Listen to device code (real-time)
        const deviceCodeRef = getDeviceMetadataPath(deviceId, 'code')
        const unsubscribeCode = onValue(deviceCodeRef, codeSnapshot => {
          const device = deviceDataMap.get(deviceId)
          if (device) {
            let deviceCode: string | null = null
            if (codeSnapshot.exists()) {
              const codeData = codeSnapshot.val()
              if (typeof codeData === 'string') {
                deviceCode = codeData
              } else if (typeof codeData === 'object' && codeData !== null) {
                const keys = Object.keys(codeData)
                deviceCode = keys.length > 0 ? keys[0] : null
              }
            }
            device.metadata.code = deviceCode ?? undefined
            deviceDataMap.set(deviceId, device)
            updateDevicesList()
          }
        })
        deviceListeners.push(unsubscribeCode)

        // Listen to heartbeats (primary source - updated frequently) for real-time lastSeen
        const heartbeatRef = getHeartbeatsPath(deviceId)
        const unsubscribeHeartbeat = onValue(heartbeatRef, heartbeatSnapshot => {
          const device = deviceDataMap.get(deviceId)
          if (device) {
            if (heartbeatSnapshot.exists()) {
              const heartbeatData = heartbeatSnapshot.val()
              // Heartbeat format: {t: timestamp, b?: batteryPercentage}
              if (heartbeatData && typeof heartbeatData === 'object' && heartbeatData.t) {
                const heartbeatTimestamp = heartbeatData.t
                if (typeof heartbeatTimestamp === 'number') {
                  device.metadata.lastSeen = heartbeatTimestamp
                  // Also update battery from heartbeat if available
                  if (typeof heartbeatData.b === 'number' && heartbeatData.b >= 0) {
                    device.metadata.batteryPercentage = heartbeatData.b
                  }
                  deviceDataMap.set(deviceId, device)
                  updateDevicesList()
                }
              }
            }
          }
        })
        deviceListeners.push(unsubscribeHeartbeat)

        // Listen to device lastSeen (fallback - updated every 5 minutes for backward compatibility)
        const deviceLastSeenRef = getDeviceMetadataPath(deviceId, 'lastSeen')
        const unsubscribeLastSeen = onValue(deviceLastSeenRef, lastSeenSnapshot => {
          const device = deviceDataMap.get(deviceId)
          if (device) {
            // Only use this as fallback if heartbeat doesn't have a value
            if (!device.metadata.lastSeen) {
              let lastSeen: number | null = null
              if (lastSeenSnapshot.exists()) {
                const lastSeenData = lastSeenSnapshot.val()
                if (typeof lastSeenData === 'number') {
                  lastSeen = lastSeenData
                }
              }
              device.metadata.lastSeen = lastSeen ?? undefined
              deviceDataMap.set(deviceId, device)
              updateDevicesList()
            }
          }
        })
        deviceListeners.push(unsubscribeLastSeen)

        // Listen to device battery (real-time)
        const deviceBatteryRef = getDeviceMetadataPath(deviceId, 'batteryPercentage')
        const unsubscribeBattery = onValue(deviceBatteryRef, batterySnapshot => {
          const device = deviceDataMap.get(deviceId)
          if (device) {
            let batteryPercentage: number | null = null
            if (batterySnapshot.exists()) {
              const batteryData = batterySnapshot.val()
              if (typeof batteryData === 'number') {
                batteryPercentage = batteryData
              }
            }
            device.metadata.batteryPercentage = batteryPercentage ?? undefined
            deviceDataMap.set(deviceId, device)
            updateDevicesList()
          }
        })
        deviceListeners.push(unsubscribeBattery)

        // Listen to device isActive (real-time)
        const deviceIsActiveRef = getDeviceMetadataPath(deviceId, 'isActive')
        const unsubscribeIsActive = onValue(deviceIsActiveRef, isActiveSnapshot => {
          const device = deviceDataMap.get(deviceId)
          if (device) {
            // Convert "Opened" string to boolean, default to false
            const isActiveValue = isActiveSnapshot.exists() ? isActiveSnapshot.val() : ''
            device.metadata.isActive = isActiveValue === 'Opened'
            deviceDataMap.set(deviceId, device)
            updateDevicesList()
          }
        })
        deviceListeners.push(unsubscribeIsActive)

        // Listen to device time (real-time)
        const deviceTimeRef = getDeviceMetadataPath(deviceId, 'time')
        const unsubscribeTime = onValue(deviceTimeRef, timeSnapshot => {
          const device = deviceDataMap.get(deviceId)
          if (device) {
            let time: number | null = null
            if (timeSnapshot.exists()) {
              const timeData = timeSnapshot.val()
              if (typeof timeData === 'number') {
                time = timeData
              }
            }
            device.metadata.time = time ?? undefined
            deviceDataMap.set(deviceId, device)
            updateDevicesList()
          }
        })
        deviceListeners.push(unsubscribeTime)

        // Listen to device messages (real-time) with expanded limit for processing
        // Fetch more messages to account for merging (fetch 5x limit to ensure we have enough after processing)
        const messagesRef = getDeviceMessagesPath(deviceId)
        const fetchLimit = messageLimit * 5 // Fetch 5x the limit to account for merging
        const messagesQuery = query(messagesRef, orderByKey(), limitToLast(fetchLimit))
        const unsubscribeMessages = onValue(messagesQuery, messagesSnapshot => {
          const device = deviceDataMap.get(deviceId)
          if (device) {
            if (messagesSnapshot.exists()) {
              const msgs = messagesSnapshot.val()
              const messageArray: Message[] = []

              // Lightweight parsing and filtering during real-time sync
              Object.entries(msgs).forEach(([timestamp, value]) => {
                if (typeof value === 'string' && value.includes('~')) {
                  const parts = value.split('~')
                  if (parts.length >= 3 && (parts[0] === 'received' || parts[0] === 'sent')) {
                    const phone = parts[1] || ''
                    const body = parts.slice(2).join('~') || value

                    messageArray.push({
                      timestamp: parseInt(timestamp) || Date.now(),
                      type: parts[0] as 'sent' | 'received',
                      phone,
                      body,
                    })
                  }
                }
              })

              // Lightweight sort (already limited by query)
              messageArray.sort((a, b) => b.timestamp - a.timestamp)

              // Store raw messages BEFORE processing (store up to messageLimit for raw display)
              device.rawMessages = messageArray.slice(0, messageLimit)

              // Apply selected message processor script to all fetched messages
              const processedMessages = selectedProcessor.process(messageArray, {
                accountLastDigits: processorInput,
                input: processorInput,
              })

              // Limit processed messages to messageLimit (after processing, so we get close to the limit)
              // This ensures we show ~50 messages even if 230 were merged into fewer
              device.messages = processedMessages.slice(0, messageLimit)
            } else {
              device.messages = []
              device.rawMessages = []
            }
            deviceDataMap.set(deviceId, device)
            updateDevicesList()
          }
        })
        deviceListeners.push(unsubscribeMessages)
      })

      // Initial update
      updateDevicesList()
    })

    return () => {
      off(adminDevicesRef)
      unsubscribeDevices()
      deviceListeners.forEach(unsub => unsub())
    }
  }, [sessionEmail, messageLimit, selectedProcessor, processorInput])

  return {
    devices,
    loading,
    taglineMap,
  }
}
