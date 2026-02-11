import { useState, useEffect, useRef } from 'react'
import { onValue, off } from 'firebase/database'
import { getDeviceListStatusCardTextPath } from '@/lib/firebase-helpers'

interface StatusCardTextCyclerProps {
  code: string
  mode?: 'testing' | 'running' | 'device-list'
  className?: string
  fallbackText?: string
  cycleDuration?: number // milliseconds per value
}

/**
 * StatusCardTextCycler Component
 * 
 * Cycles through comma-separated status text values from Firebase
 * Matches APK behavior: fastpay/{mode}/{code}/status_card_text
 * Format: "Value1,Value2,Value3"
 * 
 * @param code - Device activation code
 * @param mode - Activation mode (testing, running, or device-list)
 * @param className - CSS classes for styling
 * @param fallbackText - Text to show when no values available
 * @param cycleDuration - Time in milliseconds to display each value (default: 3000ms)
 */
export function StatusCardTextCycler({
  code,
  mode,
  className = '',
  fallbackText = 'PENDING',
  cycleDuration = 3000,
}: StatusCardTextCyclerProps) {
  const [statusTextList, setStatusTextList] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const cycleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!code) {
      setStatusTextList([])
      return
    }

    // Set up Firebase listener for status_card_text
    const statusTextRef = getDeviceListStatusCardTextPath(code, mode)
    
    const unsubscribe = onValue(
      statusTextRef,
      snapshot => {
        try {
          if (snapshot.exists()) {
            const statusTextValue = snapshot.val()
            
            // Parse comma-separated string into list
            const parsedList =
              typeof statusTextValue === 'string' && statusTextValue.trim()
                ? statusTextValue
                    .split(',')
                    .map(v => v.trim())
                    .filter(v => v.length > 0)
                : []

            setStatusTextList(parsedList)
            setCurrentIndex(0) // Reset to start when values change
          } else {
            setStatusTextList([])
          }
        } catch (error) {
          console.error('Error parsing status_card_text:', error)
          setStatusTextList([])
        }
      },
      error => {
        console.error('Error listening to status_card_text:', error)
        setStatusTextList([])
      }
    )

    unsubscribeRef.current = () => {
      off(statusTextRef, 'value', unsubscribe)
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
    }
  }, [code, mode])

  // Cycle through values
  useEffect(() => {
    // Clear existing interval
    if (cycleIntervalRef.current) {
      clearInterval(cycleIntervalRef.current)
      cycleIntervalRef.current = null
    }

    // If no values, don't cycle
    if (statusTextList.length === 0) {
      return
    }

    // Start cycling
    cycleIntervalRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % statusTextList.length)
    }, cycleDuration)

    return () => {
      if (cycleIntervalRef.current) {
        clearInterval(cycleIntervalRef.current)
        cycleIntervalRef.current = null
      }
    }
  }, [statusTextList, cycleDuration])

  // Determine what to display
  const displayText =
    statusTextList.length > 0
      ? statusTextList[currentIndex]
      : fallbackText

  return (
    <span className={className} key={currentIndex}>
      {displayText}
    </span>
  )
}
