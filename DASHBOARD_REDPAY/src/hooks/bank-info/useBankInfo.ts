import { useState, useEffect, useRef } from 'react'
import { onValue, off, get } from 'firebase/database'
import {
  getDeviceListBankPath,
  getDeviceListBankStatusPath,
  getDeviceMetadataPath,
  type BankStatus,
} from '@/lib/firebase-helpers'
import { retryWithBackoff, isRetryableError } from '@/lib/retry-utils'

export interface BankData {
  bank_name?: string
  company_name?: string
  company_address?: string
  company_phone?: string
  company_email?: string
  company_website?: string
  account_number?: string
  ifsc_code?: string
  branch_name?: string
  contact_person?: string
  contact_phone?: string
  contact_email?: string
  notes?: string
  other_info?: string
  structured_data?: {
    [key: string]: any
  }
}

export interface UseBankInfoParams {
  deviceId: string | null
}

export interface UseBankInfoReturn {
  deviceCode: string | null
  bankInfo: BankData | null
  bankStatus: BankStatus | null
  loading: boolean
  error: string | null
  refresh: () => void
}

/**
 * Custom hook for managing bank info and status
 * Handles fetching device code, bank info, and bank status
 */
export function useBankInfo({ deviceId }: UseBankInfoParams): UseBankInfoReturn {
  const [deviceCode, setDeviceCode] = useState<string | null>(null)
  const [bankInfo, setBankInfo] = useState<BankData | null>(null)
  const [bankStatus, setBankStatus] = useState<BankStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const refreshTriggerRef = useRef(0)

  // Fetch device code from metadata
  useEffect(() => {
    if (!deviceId) {
      setDeviceCode(null)
      return
    }

    let isMounted = true
    const codeRef = getDeviceMetadataPath(deviceId, 'code')

    const unsubscribe = onValue(
      codeRef,
      snapshot => {
        if (!isMounted) return
        if (snapshot.exists()) {
          const code = snapshot.val()
          setDeviceCode(typeof code === 'string' ? code : null)
        } else {
          setDeviceCode(null)
        }
      },
      error => {
        if (!isMounted) return
        console.error('Error listening to device code:', error)
        setDeviceCode(null)
      }
    )

    return () => {
      isMounted = false
      off(codeRef, 'value', unsubscribe)
    }
  }, [deviceId])

  // Fetch bank info and status
  useEffect(() => {
    if (!deviceCode) {
      setBankInfo(null)
      setBankStatus(null)
      setLoading(false)
      setError(null)
      return
    }

    let isMounted = true
    let unsubscribeBank: (() => void) | null = null
    let unsubscribeStatus: (() => void) | null = null

    const bankRef = getDeviceListBankPath(deviceCode)
    const statusRef = getDeviceListBankStatusPath(deviceCode)

    // Fast initial load
    const loadInitialData = async () => {
      try {
        setLoading(true)
        setError(null)

        const [bankSnapshot, statusSnapshot] = await Promise.all([
          retryWithBackoff(() => get(bankRef), {
            maxAttempts: 3,
            initialDelay: 300,
            retryable: isRetryableError,
          }),
          retryWithBackoff(() => get(statusRef), {
            maxAttempts: 3,
            initialDelay: 300,
            retryable: isRetryableError,
          }),
        ])

        if (!isMounted) return

        if (bankSnapshot.exists()) {
          const data = bankSnapshot.val() as BankData
          setBankInfo(data)
        } else {
          setBankInfo(null)
        }

        if (statusSnapshot.exists()) {
          const status = statusSnapshot.val() as BankStatus
          setBankStatus(status)
        } else {
          setBankStatus(null)
        }

        setLoading(false)
      } catch (err) {
        if (!isMounted) return
        const errorMessage = err instanceof Error ? err.message : 'Failed to load bank info'
        setError(errorMessage)
        setLoading(false)
      }
    }

    // Real-time listeners
    const setupListeners = () => {
      unsubscribeBank = onValue(
        bankRef,
        snapshot => {
          if (!isMounted) return
          if (snapshot.exists()) {
            const data = snapshot.val() as BankData
            setBankInfo(data)
          } else {
            setBankInfo(null)
          }
          setLoading(false)
        },
        err => {
          if (!isMounted) return
          console.error('Error listening to bank info:', err)
          setError(err instanceof Error ? err.message : 'Connection error')
          setLoading(false)
        }
      )

      unsubscribeStatus = onValue(
        statusRef,
        snapshot => {
          if (!isMounted) return
          if (snapshot.exists()) {
            const status = snapshot.val() as BankStatus
            setBankStatus(status)
          } else {
            setBankStatus(null)
          }
        },
        err => {
          if (!isMounted) return
          console.error('Error listening to bank status:', err)
        }
      )
    }

    loadInitialData()
    const listenerTimeout = setTimeout(setupListeners, 50)

    return () => {
      isMounted = false
      clearTimeout(listenerTimeout)
      if (unsubscribeBank) {
        unsubscribeBank()
      } else {
        off(bankRef)
      }
      if (unsubscribeStatus) {
        unsubscribeStatus()
      } else {
        off(statusRef)
      }
    }
  }, [deviceCode, refreshTriggerRef.current])

  const refresh = () => {
    refreshTriggerRef.current += 1
    setLoading(true)
  }

  return { deviceCode, bankInfo, bankStatus, loading, error, refresh }
}
