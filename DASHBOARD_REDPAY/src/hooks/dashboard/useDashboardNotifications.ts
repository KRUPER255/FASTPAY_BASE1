import { useState, useEffect, useCallback } from 'react'
import { onValue, off, get, query, orderByKey, limitToLast } from 'firebase/database'
import { getDeviceNotificationsPath } from '@/lib/firebase-helpers'
import { retryWithBackoff, isRetryableError } from '@/lib/retry-utils'
import { notificationsCache } from '@/lib/data-cache'
import type { Notification as NotificationType } from '@/pages/dashboard/types'

export interface UseDashboardNotificationsParams {
  deviceId: string | null
  dataLimit: number
  activeTab?: string // Only load when 'notifications' tab is active
  syncEnabled?: boolean // Whether notifications sync is enabled
}

export interface UseDashboardNotificationsReturn {
  notifications: NotificationType[]
  loading: boolean
  error: string | null
  refresh: () => void
}

/**
 * Custom hook for managing dashboard notifications
 * Handles Firebase sync, caching, and notification processing
 */
export function useDashboardNotifications({
  deviceId,
  dataLimit,
  activeTab = 'notifications',
  syncEnabled = true,
}: UseDashboardNotificationsParams): UseDashboardNotificationsReturn {
  const [notifications, setNotifications] = useState<NotificationType[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Process notification data function - extracted from Dashboard.tsx
  const processNotificationData = useCallback(
    (notificationsData: any, deviceId: string, limit: number): NotificationType[] => {
      const notificationsList: NotificationType[] = []

      if (!notificationsData || typeof notificationsData !== 'object') {
        return notificationsList
      }

      // Iterate through all message IDs
      Object.keys(notificationsData).forEach(messageId => {
        const messageData = notificationsData[messageId]

        // Check if messageData is an object with timestamp keys
        if (typeof messageData === 'object' && messageData !== null) {
          // Iterate through all timestamps in this message
          Object.keys(messageData).forEach(timestamp => {
            const content = messageData[timestamp]

            // Content can be a string directly, or nested in a content property
            let messageContent = ''
            if (typeof content === 'string') {
              messageContent = content
            } else if (content && typeof content === 'object' && content.content) {
              messageContent = content.content
            } else {
              return
            }

            // Parse content: 'title:description#app' or just the message content
            let title = ''
            let body = ''
            let app = ''

            if (messageContent.includes('#')) {
              const parts = messageContent.split('#')
              app = parts[parts.length - 1] || '' // App is after the last #
              const titleBodyPart = parts.slice(0, -1).join('#') // Everything before last #

              if (titleBodyPart.includes(':')) {
                const titleBodyParts = titleBodyPart.split(':')
                title = titleBodyParts[0] || ''
                body = titleBodyParts.slice(1).join(':') || '' // Join in case : appears in description
              } else {
                // No colon, treat entire part as title
                title = titleBodyPart
              }
            } else if (messageContent.includes(':')) {
              // Has colon but no #, treat as title:description with no app
              const parts = messageContent.split(':')
              title = parts[0] || ''
              body = parts.slice(1).join(':') || ''
            } else {
              // No separator, treat entire content as body
              body = messageContent
            }

            // Convert timestamp to number if it's a string
            const timestampNum =
              typeof timestamp === 'string'
                ? parseInt(timestamp) || Date.parse(timestamp) || 0
                : timestamp

            notificationsList.push({
              id: timestampNum,
              app: app,
              time: timestamp,
              title: title,
              body: body,
              user: deviceId,
            })
          })
        } else if (typeof messageData === 'string') {
          // Handle flat structure: notification/{deviceId}/{timestamp}: "content"
          const content = messageData
          let title = ''
          let body = ''
          let app = ''

          if (content.includes('#')) {
            const parts = content.split('#')
            app = parts[parts.length - 1] || ''
            const titleBodyPart = parts.slice(0, -1).join('#')

            if (titleBodyPart.includes(':')) {
              const titleBodyParts = titleBodyPart.split(':')
              title = titleBodyParts[0] || ''
              body = titleBodyParts.slice(1).join(':') || ''
            } else {
              title = titleBodyPart
            }
          } else if (content.includes(':')) {
            const parts = content.split(':')
            title = parts[0] || ''
            body = parts.slice(1).join(':') || ''
          } else {
            body = content
          }

          const timestampNum = parseInt(messageId) || Date.parse(messageId) || 0

          notificationsList.push({
            id: timestampNum,
            app: app,
            time: messageId,
            title: title,
            body: body,
            user: deviceId,
          })
        }
      })

      // Sort by time descending and limit to specified value
      notificationsList.sort((a, b) => {
        // Try to parse time as number (timestamp) or date
        const timeA =
          typeof a.time === 'string' ? parseInt(a.time) || new Date(a.time).getTime() || 0 : a.time
        const timeB =
          typeof b.time === 'string' ? parseInt(b.time) || new Date(b.time).getTime() || 0 : b.time
        return timeB - timeA
      })

      return notificationsList.slice(0, limit)
    },
    []
  )

  useEffect(() => {
    // Only load notifications when notifications tab is active AND sync is enabled
    if (activeTab !== 'notifications' || !deviceId || !syncEnabled) {
      setNotifications([])
      setLoading(false)
      return
    }

    let isMounted = true
    let unsubscribe: (() => void) | null = null

    const cacheKey = `notifications-${deviceId}-${dataLimit}`

    // Step 0: Show cached data immediately (optimistic update)
    const cachedData = notificationsCache.get(cacheKey)
    if (cachedData && Array.isArray(cachedData)) {
      setNotifications(cachedData)
      setLoading(false)
    } else {
      // Ensure notifications is always an array, even if cache is invalid
      setNotifications([])
      setLoading(true)
    }

    const notificationsRef = getDeviceNotificationsPath(deviceId)
    // Fetch dataLimit + 1 to account for potential filtering during processing
    const notificationsQuery = query(notificationsRef, orderByKey(), limitToLast(dataLimit + 1))

    // Step 1: Fast initial load using get() with retry and caching
    const loadInitialData = async () => {
      try {
        const snapshot = await retryWithBackoff(() => get(notificationsQuery), {
          maxAttempts: 3,
          initialDelay: 500,
          retryable: isRetryableError,
        })

        if (!isMounted) return []

        if (!snapshot.exists()) {
          setNotifications([])
          setLoading(false)
          notificationsCache.set(cacheKey, [])
          return []
        }

        const notificationsData = snapshot.val()
        const processedNotifications = processNotificationData(
          notificationsData,
          deviceId,
          dataLimit
        )

        // Cache the processed data
        notificationsCache.set(cacheKey, processedNotifications)

        if (isMounted) {
          setNotifications(processedNotifications)
          setLoading(false)
        }

        return processedNotifications || []
      } catch (err) {
        if (!isMounted) return []
        console.error('Error loading initial notifications:', err)
        const errorMessage = err instanceof Error ? err.message : 'Failed to load notifications'
        setError(errorMessage)
        setNotifications([])
        setLoading(false)
        return []
      }
    }

    // Step 2: Set up real-time listener for updates
    const setupRealtimeListener = () => {
      unsubscribe = onValue(
        notificationsQuery,
        snapshot => {
          if (!isMounted) return

          if (!snapshot.exists()) {
            setNotifications([])
            notificationsCache.set(cacheKey, [])
            return
          }

          const notificationsData = snapshot.val()
          const processedNotifications = processNotificationData(
            notificationsData,
            deviceId,
            dataLimit
          )

          // Update cache
          notificationsCache.set(cacheKey, processedNotifications)

          setNotifications(processedNotifications)
        },
        err => {
          if (!isMounted) return
          console.error('Error listening to notifications:', err)
          const errorMessage = err instanceof Error ? err.message : 'Failed to fetch notifications'
          setError(errorMessage)
          setNotifications([])
        }
      )
    }

    // Load initial data first (fast) - use cache.fetch for deduplication
    notificationsCache.fetch(cacheKey, loadInitialData)

    // Set up real-time listener after a short delay
    const listenerTimeout = setTimeout(setupRealtimeListener, 100)

    return () => {
      isMounted = false
      clearTimeout(listenerTimeout)
      if (unsubscribe) {
        unsubscribe()
      } else {
        off(notificationsQuery)
      }
    }
  }, [deviceId, dataLimit, processNotificationData, activeTab, syncEnabled])

  const refresh = useCallback(() => {
    if (!deviceId) return
    const cacheKey = `notifications-${deviceId}-${dataLimit}`
    notificationsCache.delete(cacheKey)
    setLoading(true)
  }, [deviceId, dataLimit])

  return { notifications, loading, error, refresh }
}
