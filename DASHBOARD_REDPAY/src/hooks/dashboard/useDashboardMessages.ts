import { useState, useEffect, useCallback, useMemo } from 'react'
import { onValue, off, get, query, orderByKey, limitToLast } from 'firebase/database'
import { getDeviceMessagesPath } from '@/lib/firebase-helpers'
import { retryWithBackoff, isRetryableError } from '@/lib/retry-utils'
import { smsCache } from '@/lib/data-cache'
import { useToast } from '@/lib/use-toast'
import type { SMS } from '@/pages/dashboard/types'
import type { MessageProcessor } from '@/lib/message-processors'

export interface UseDashboardMessagesParams {
  deviceId: string | null
  dataLimit: number
  selectedProcessor: MessageProcessor
  processorInput?: string
  activeTab?: string // Only load when 'sms' tab is active
}

export interface UseDashboardMessagesReturn {
  messages: SMS[]
  rawMessages: SMS[]
  loading: boolean
  error: string | null
  isConnected: boolean
  refresh: () => void
}

/**
 * Custom hook for managing dashboard SMS/message data
 * Handles Firebase sync, caching, and message processing
 */
export function useDashboardMessages({
  deviceId,
  dataLimit,
  selectedProcessor,
  processorInput = '',
  activeTab = 'sms',
}: UseDashboardMessagesParams): UseDashboardMessagesReturn {
  const { toast } = useToast()
  const [messages, setMessages] = useState<SMS[]>([])
  const [rawMessages, setRawMessages] = useState<SMS[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  // Process SMS data function - extracted from Dashboard.tsx
  const processSMSData = useCallback(
    (
      smsData: any,
      deviceId: string,
      limit: number,
      processor: MessageProcessor
    ): { raw: SMS[]; processed: SMS[] } => {
      const smsList: SMS[] = []

      if (!smsData || typeof smsData !== 'object') {
        return { raw: [], processed: [] }
      }

      // Iterate through all timestamps (keys are timestamps)
      Object.keys(smsData).forEach(timestamp => {
        const messageContent = smsData[timestamp]

        // Handle both string and object formats
        let content = ''
        if (typeof messageContent === 'string') {
          content = messageContent
        } else if (messageContent && typeof messageContent === 'object' && messageContent.content) {
          content = messageContent.content
        } else {
          return // Skip invalid entries
        }

        // Parse Android format: "received~{phoneNumber}~{messageBody}" or "sent~{phoneNumber}~{messageBody}"
        let direction = ''
        let sender = ''
        let body = ''

        if (content.includes('~')) {
          const parts = content.split('~')
          if (parts.length >= 3) {
            // Format: "received~phone~body" or "sent~phone~body"
            direction = parts[0]?.toLowerCase() || ''
            sender = parts[1] || ''
            body = parts.slice(2).join('~') || '' // Join in case ~ appears in message body
          } else if (parts.length === 2) {
            // Fallback: "sender~body" format (legacy support)
            sender = parts[0] || ''
            body = parts[1] || ''
            direction = sender ? 'received' : 'sent'
          } else {
            // Single part, treat as body
            body = content
            direction = 'sent'
          }
        } else {
          // No separator, treat entire content as body (sent message)
          body = content
          direction = 'sent'
        }

        // Determine if sent or received based on direction
        const is_sent = direction === 'sent' || (!direction && !sender)

        // Convert timestamp to number if it's a string
        const timestampNum =
          typeof timestamp === 'string'
            ? parseInt(timestamp) || Date.parse(timestamp) || 0
            : timestamp

        // Only add if we have valid data
        if (body || sender) {
          smsList.push({
            id: timestampNum,
            sender: sender || (is_sent ? 'You' : 'Unknown'),
            time: timestamp,
            is_sent: is_sent,
            body: body,
            user: deviceId,
          })
        }
      })

      // Sort by time descending and limit to specified value
      smsList.sort((a, b) => {
        // Try to parse time as number (timestamp) or date
        const timeA =
          typeof a.time === 'string' ? parseInt(a.time) || new Date(a.time).getTime() || 0 : a.time
        const timeB =
          typeof b.time === 'string' ? parseInt(b.time) || new Date(b.time).getTime() || 0 : b.time
        return timeB - timeA
      })

      // Store raw messages (before processing)
      const rawSms = smsList.slice(0, limit * 5) // Fetch more for processing

      // Convert SMS[] to Message[] format for processor
      const messagesForProcessing = rawSms.map(sms => ({
        timestamp:
          typeof sms.time === 'string'
            ? parseInt(sms.time) || new Date(sms.time).getTime() || 0
            : sms.time || 0,
        type: sms.is_sent ? ('sent' as const) : ('received' as const),
        phone: sms.sender || '',
        body: sms.body || '',
      }))

      // Apply processor script with options
      const processedMessages = processor.process(messagesForProcessing, {
        accountLastDigits: processorInput,
        input: processorInput,
      })

      // Convert back to SMS[] format
      const processedSms: SMS[] = processedMessages.slice(0, limit).map(msg => {
        // Find original SMS to preserve other fields
        const originalSms = rawSms.find(
          s =>
            (typeof s.time === 'string'
              ? parseInt(s.time) || new Date(s.time).getTime() || 0
              : s.time || 0) === msg.timestamp
        )
        return {
          id: msg.timestamp,
          sender: msg.phone || originalSms?.sender || '',
          time: msg.timestamp.toString(),
          is_sent: msg.type === 'sent',
          body: msg.body,
          user: deviceId,
        }
      })

      return {
        raw: rawSms.slice(0, limit), // Return limited raw messages
        processed: processedSms,
      }
    },
    [processorInput]
  )

  useEffect(() => {
    // Only load SMS when SMS tab is active
    if (activeTab !== 'sms' || !deviceId) {
      // Don't clear SMS data - keep it for tab count display
      setError(null)
      setLoading(false)
      return
    }

    let isMounted = true
    let unsubscribe: (() => void) | null = null

    const cacheKey = `sms-${deviceId}-${dataLimit}`

    // Step 0: Show cached data immediately (optimistic update)
    const cachedData = smsCache.get(cacheKey)
    if (cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
      // We have cached data - show it immediately, no loading needed
      setMessages(cachedData)
      setLoading(false)
      setError(null)
      setIsConnected(true)
    } else {
      // No cache or empty cache - only show loading if we have no data at all
      if (messages.length === 0) {
        setLoading(true)
      } else {
        // We have some data, keep it visible while loading fresh data
        setLoading(false)
      }
    }

    setError(null)
    setIsConnected(true)

    const smsRef = getDeviceMessagesPath(deviceId)
    // Fetch dataLimit + 1 to account for potential filtering during processing
    const smsQuery = query(smsRef, orderByKey(), limitToLast(dataLimit + 1))

    // Step 1: Fast initial load using get() with retry and caching
    const loadInitialData = async () => {
      // Only show loading if we have no data at all
      if (messages.length === 0 && !smsCache.has(cacheKey)) {
        setLoading(true)
      }

      try {
        const snapshot = await retryWithBackoff(() => get(smsQuery), {
          maxAttempts: 3,
          initialDelay: 300,
          retryable: isRetryableError,
        })

        if (!isMounted) return []

        if (!snapshot.exists()) {
          setRawMessages([])
          setMessages([])
          setLoading(false)
          setError(null)
          smsCache.set(cacheKey, [])
          return []
        }

        const smsData = snapshot.val()
        const { raw: rawSmsData, processed: processedSms } = processSMSData(
          smsData,
          deviceId,
          dataLimit,
          selectedProcessor
        )

        // Cache the processed data
        smsCache.set(cacheKey, processedSms)

        if (isMounted) {
          setRawMessages(rawSmsData)
          setMessages(processedSms)
          setLoading(false) // Always hide loading when data arrives
          setError(null)
          setIsConnected(true)
        }

        return processedSms || []
      } catch (err) {
        if (!isMounted) return []
        console.error('Error loading initial SMS data:', err)
        const errorMessage = err instanceof Error ? err.message : 'Failed to load SMS messages'
        setError(errorMessage)
        setLoading(false)
        setIsConnected(false)
        return []
      }
    }

    // Step 2: Set up real-time listener for updates (after initial load)
    const setupRealtimeListener = () => {
      unsubscribe = onValue(
        smsQuery,
        snapshot => {
          if (!isMounted) return

          try {
            setIsConnected(true)
            // Don't show loading for real-time updates - just update silently
            setLoading(false)

            if (!snapshot.exists()) {
              setRawMessages([])
              setMessages([])
              setError(null)
              smsCache.set(cacheKey, [])
              return
            }

            const smsData = snapshot.val()
            const { raw: rawSmsData, processed: processedSms } = processSMSData(
              smsData,
              deviceId,
              dataLimit,
              selectedProcessor
            )

            // Update cache
            smsCache.set(cacheKey, processedSms)

            setRawMessages(rawSmsData)
            setMessages(processedSms)
            setError(null)
          } catch (err) {
            console.error('Error processing SMS data:', err)
            const errorMessage = err instanceof Error ? err.message : 'Failed to process SMS data'
            setError(errorMessage)
            setLoading(false) // Hide loading on error
            toast({
              title: 'Error processing SMS',
              description: errorMessage,
              variant: 'destructive',
            })
          }
        },
        error => {
          if (!isMounted) return
          console.error('Error listening to SMS:', error)
          setIsConnected(false)
          setLoading(false) // Hide loading on error
          const errorMessage = error.message || 'Failed to fetch SMS messages'
          setError(errorMessage)
          toast({
            title: 'Connection error',
            description: errorMessage,
            variant: 'destructive',
          })
        }
      )
    }

    // Load initial data first (fast) - use cache.fetch for deduplication
    // Only load if we don't have cached data
    if (!cachedData || !Array.isArray(cachedData) || cachedData.length === 0) {
      smsCache.fetch(cacheKey, loadInitialData)
    } else {
      // We already have cached data, just set up the listener
      setLoading(false)
    }

    // Set up real-time listener after a short delay (allows initial load to complete)
    const listenerTimeout = setTimeout(setupRealtimeListener, 50)

    return () => {
      isMounted = false
      clearTimeout(listenerTimeout)
      if (unsubscribe) {
        unsubscribe()
      } else {
        off(smsQuery)
      }
    }
  }, [deviceId, dataLimit, processSMSData, selectedProcessor, processorInput, activeTab, toast])

  const refresh = useCallback(() => {
    if (!deviceId) return
    const cacheKey = `sms-${deviceId}-${dataLimit}`
    smsCache.delete(cacheKey)
    // Trigger reload by updating a dependency
    setLoading(true)
  }, [deviceId, dataLimit])

  return { messages, rawMessages, loading, error, isConnected, refresh }
}
