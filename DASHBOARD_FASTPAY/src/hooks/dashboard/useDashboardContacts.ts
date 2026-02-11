import { useState, useEffect, useCallback } from 'react'
import { onValue, off, get } from 'firebase/database'
import { getDeviceContactsPath } from '@/lib/firebase-helpers'
import { retryWithBackoff, isRetryableError } from '@/lib/retry-utils'
import { contactsCache } from '@/lib/data-cache'
import type { Contact } from '@/pages/dashboard/types'

export interface UseDashboardContactsParams {
  deviceId: string | null
  activeTab?: string // Only load when 'contacts' tab is active
  syncEnabled?: boolean // Whether contacts sync is enabled
}

export interface UseDashboardContactsReturn {
  contacts: Contact[]
  loading: boolean
  error: string | null
  refresh: () => void
}

/**
 * Custom hook for managing dashboard contacts
 * Handles Firebase sync, caching, and contact processing
 */
export function useDashboardContacts({
  deviceId,
  activeTab = 'contacts',
  syncEnabled = true,
}: UseDashboardContactsParams): UseDashboardContactsReturn {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Process contacts data function
  const processContactsData = useCallback((val: any): Contact[] => {
    const contactsList: Contact[] = []
    if (val && typeof val === 'object') {
      Object.entries(val).forEach(([phone, name]) => {
        contactsList.push({
          phone,
          name: String(name),
        })
      })
    }
    return contactsList
  }, [])

  useEffect(() => {
    // Only load contacts when contacts tab is active AND sync is enabled
    if (activeTab !== 'contacts' || !deviceId || !syncEnabled) {
      setContacts([])
      setLoading(false)
      return
    }

    let isMounted = true
    let unsubscribe: (() => void) | null = null

    const cacheKey = `contacts-${deviceId}`

    // Step 0: Show cached data immediately (optimistic update)
    const cachedData = contactsCache.get(cacheKey)
    if (cachedData && Array.isArray(cachedData)) {
      setContacts(cachedData)
      setLoading(false)
    } else {
      // Ensure contacts is always an array, even if cache is invalid
      setContacts([])
      setLoading(true)
    }

    const contactsRef = getDeviceContactsPath(deviceId)

    // Step 1: Fast initial load using get() with retry and caching
    const loadInitialData = async () => {
      try {
        const snapshot = await retryWithBackoff(() => get(contactsRef), {
          maxAttempts: 3,
          initialDelay: 500,
          retryable: isRetryableError,
        })

        if (!isMounted) return []

        if (!snapshot.exists()) {
          setContacts([])
          setLoading(false)
          contactsCache.set(cacheKey, [])
          return []
        }

        const val = snapshot.val()
        const contactsList = processContactsData(val)

        // Cache the processed data
        contactsCache.set(cacheKey, contactsList)

        if (isMounted) {
          setContacts(contactsList)
          setLoading(false)
        }

        return contactsList || []
      } catch (err) {
        if (!isMounted) return []
        console.error('Error loading initial contacts:', err)
        const errorMessage = err instanceof Error ? err.message : 'Failed to load contacts'
        setError(errorMessage)
        setContacts([])
        setLoading(false)
        return []
      }
    }

    // Step 2: Set up real-time listener for updates
    const setupRealtimeListener = () => {
      unsubscribe = onValue(
        contactsRef,
        snapshot => {
          if (!isMounted) return

          if (!snapshot.exists()) {
            setContacts([])
            contactsCache.set(cacheKey, [])
            return
          }

          const val = snapshot.val()
          const contactsList = processContactsData(val)

          // Update cache
          contactsCache.set(cacheKey, contactsList)

          setContacts(contactsList)
        },
        err => {
          if (!isMounted) return
          console.error('Error listening to contacts:', err)
          const errorMessage = err instanceof Error ? err.message : 'Failed to fetch contacts'
          setError(errorMessage)
          setContacts([])
        }
      )
    }

    // Load initial data first (fast) - use cache.fetch for deduplication
    contactsCache.fetch(cacheKey, loadInitialData)

    // Set up real-time listener after a short delay
    const listenerTimeout = setTimeout(setupRealtimeListener, 100)

    return () => {
      isMounted = false
      clearTimeout(listenerTimeout)
      if (unsubscribe) {
        unsubscribe()
      } else {
        off(contactsRef)
      }
    }
  }, [deviceId, processContactsData, activeTab, syncEnabled])

  const refresh = useCallback(() => {
    if (!deviceId) return
    const cacheKey = `contacts-${deviceId}`
    contactsCache.delete(cacheKey)
    setLoading(true)
  }, [deviceId])

  return { contacts, loading, error, refresh }
}
