import { useState, useEffect, useRef } from 'react'
import { onValue, off, get, set } from 'firebase/database'
import { getDeviceInstructionCardPath } from '@/lib/firebase-helpers'
import { retryWithBackoff, isRetryableError } from '@/lib/retry-utils'
import { useToast } from '@/lib/use-toast'

export interface InstructionCard {
  html: string
  css: string
  imageUrl?: string | null
}

export interface UseInstructionCardParams {
  deviceId: string | null
}

export interface UseInstructionCardReturn {
  card: InstructionCard | null
  loading: boolean
  error: string | null
  saving: boolean
  saveCard: (card: InstructionCard) => Promise<void>
  refresh: () => void
}

/**
 * Custom hook for managing instruction cards
 * Handles loading, saving, and real-time updates
 */
export function useInstructionCard({ deviceId }: UseInstructionCardParams): UseInstructionCardReturn {
  const { toast } = useToast()
  const [card, setCard] = useState<InstructionCard | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const refreshTriggerRef = useRef(0)

  useEffect(() => {
    if (!deviceId) {
      setCard(null)
      setLoading(false)
      setError(null)
      return
    }

    let isMounted = true
    let unsubscribe: (() => void) | null = null

    const cardRef = getDeviceInstructionCardPath(deviceId)

    // Fast initial load
    const loadInitialData = async () => {
      try {
        setLoading(true)
        setError(null)

        const snapshot = await retryWithBackoff(() => get(cardRef), {
          maxAttempts: 3,
          initialDelay: 300,
          retryable: isRetryableError,
        })

        if (!isMounted) return

        if (snapshot.exists()) {
          const data = snapshot.val()
          setCard({
            html: data.html || '',
            css: data.css || '',
            imageUrl: data.imageUrl || null,
          })
        } else {
          setCard(null)
        }

        setLoading(false)
      } catch (err) {
        if (!isMounted) return
        const errorMessage = err instanceof Error ? err.message : 'Failed to load instruction card'
        setError(errorMessage)
        setLoading(false)
      }
    }

    // Real-time listener
    const setupListener = () => {
      unsubscribe = onValue(
        cardRef,
        snapshot => {
          if (!isMounted) return

          try {
            setLoading(false)

            if (snapshot.exists()) {
              const data = snapshot.val()
              setCard({
                html: data.html || '',
                css: data.css || '',
                imageUrl: data.imageUrl || null,
              })
            } else {
              setCard(null)
            }

            setError(null)
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to process card data'
            setError(errorMessage)
            setLoading(false)
          }
        },
        err => {
          if (!isMounted) return
          const errorMessage = err instanceof Error ? err.message : 'Connection error'
          setError(errorMessage)
          setLoading(false)
        }
      )
    }

    loadInitialData()
    const listenerTimeout = setTimeout(setupListener, 50)

    return () => {
      isMounted = false
      clearTimeout(listenerTimeout)
      if (unsubscribe) {
        unsubscribe()
      } else {
        off(cardRef)
      }
    }
  }, [deviceId, refreshTriggerRef.current])

  const saveCard = async (cardData: InstructionCard) => {
    if (!deviceId) {
      toast({
        title: 'Error',
        description: 'Device ID is required',
        variant: 'destructive',
      })
      return
    }

    try {
      setSaving(true)
      const cardRef = getDeviceInstructionCardPath(deviceId)
      await set(cardRef, cardData)
      toast({
        title: 'Saved',
        description: 'Instruction card has been saved successfully',
      })
    } catch (err) {
      console.error('Error saving instruction card:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to save instruction card'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
      throw err
    } finally {
      setSaving(false)
    }
  }

  const refresh = () => {
    refreshTriggerRef.current += 1
    setLoading(true)
  }

  return { card, loading, error, saving, saveCard, refresh }
}
