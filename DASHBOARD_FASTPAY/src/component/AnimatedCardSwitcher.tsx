import { useEffect, useState, useRef } from 'react'
import RemoteMessages from './RemoteMessages'
import InstructionCard from './InstructionCard'
import { Card, CardContent } from './ui/card'
import { MessageSquare, BookOpen } from 'lucide-react'
import { onValue, off, get } from 'firebase/database'
import { getDeviceAnimationSettingsPath } from '@/lib/firebase-helpers'
import { retryWithBackoff, isRetryableError } from '@/lib/retry-utils'

interface AnimatedCardSwitcherProps {
  deviceId: string | null
  initialCard?: 'sms' | 'instruction'
}

type CardType = 'sms' | 'instruction'
type AnimationState = 'expanded' | 'collapsing' | 'collapsed' | 'flipping' | 'expanding'

export default function AnimatedCardSwitcher({
  deviceId,
  initialCard = 'sms',
}: AnimatedCardSwitcherProps) {
  const [currentCard, setCurrentCard] = useState<CardType>(initialCard)
  const [animationState, setAnimationState] = useState<AnimationState>('expanded')
  const [smsFirstLine, setSmsFirstLine] = useState<string>('Remote Messages')
  const [instructionFirstLine, setInstructionFirstLine] = useState<string>('Instructions')
  const smsContentRef = useRef<HTMLDivElement>(null)
  const instructionContentRef = useRef<HTMLDivElement>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [nextCard, setNextCard] = useState<CardType>(initialCard === 'sms' ? 'instruction' : 'sms')
  const currentCardRef = useRef<CardType>(initialCard)
  const animationStateRef = useRef<AnimationState>('expanded')
  const [stopAnimationOn, setStopAnimationOn] = useState<'sms' | 'instruction' | null>(null)
  const stopAnimationOnRef = useRef<'sms' | 'instruction' | null>(null)

  // Keep refs in sync with state
  useEffect(() => {
    currentCardRef.current = currentCard
  }, [currentCard])

  useEffect(() => {
    animationStateRef.current = animationState
  }, [animationState])

  useEffect(() => {
    stopAnimationOnRef.current = stopAnimationOn
  }, [stopAnimationOn])

  // Fetch animation settings from Firebase
  useEffect(() => {
    if (!deviceId) {
      setStopAnimationOn(null)
      return
    }

    let isMounted = true
    let unsubscribe: (() => void) | null = null

    const animationSettingsRef = getDeviceAnimationSettingsPath(deviceId)

    // Fast initial load
    const loadInitialData = async () => {
      try {
        const snapshot = await retryWithBackoff(() => get(animationSettingsRef), {
          maxAttempts: 3,
          initialDelay: 300,
          retryable: isRetryableError,
        })

        if (!isMounted) return

        if (snapshot.exists()) {
          const data = snapshot.val()
          const stopOn = data?.stopAnimationOn || null
          // Handle 'all' as stopping on both cards
          if (stopOn === 'all') {
            // If 'all', stop on current card (effectively stops all)
            setStopAnimationOn(currentCardRef.current)
          } else {
            setStopAnimationOn(stopOn === 'sms' || stopOn === 'instruction' ? stopOn : null)
          }
        } else {
          setStopAnimationOn(null)
        }
      } catch (err) {
        console.error('Error loading animation settings:', err)
        if (isMounted) {
          setStopAnimationOn(null)
        }
      }
    }

    // Set up real-time listener
    const setupRealtimeListener = () => {
      unsubscribe = onValue(
        animationSettingsRef,
        snapshot => {
          if (!isMounted) return
          try {
            if (snapshot.exists()) {
              const data = snapshot.val()
              const stopOn = data?.stopAnimationOn || null
              // Handle 'all' as stopping on both cards
              if (stopOn === 'all') {
                // If 'all', stop on current card (effectively stops all)
                setStopAnimationOn(currentCardRef.current)
              } else {
                setStopAnimationOn(stopOn === 'sms' || stopOn === 'instruction' ? stopOn : null)
              }
            } else {
              setStopAnimationOn(null)
            }
          } catch (err) {
            console.error('Error processing animation settings:', err)
          }
        },
        error => {
          console.error('Error listening to animation settings:', error)
        }
      )
    }

    // Load initial data first
    loadInitialData()

    // Set up real-time listener after a short delay
    const listenerTimeout = setTimeout(setupRealtimeListener, 100)

    return () => {
      isMounted = false
      clearTimeout(listenerTimeout)
      if (unsubscribe) {
        unsubscribe()
      } else {
        off(animationSettingsRef)
      }
    }
  }, [deviceId])

  // Extract first line of text from content periodically
  useEffect(() => {
    const extractFirstLine = () => {
      if (smsContentRef.current) {
        const text = smsContentRef.current.innerText || smsContentRef.current.textContent || ''
        const firstLine =
          text.split('\n').find(line => line.trim().length > 0) || text.substring(0, 60).trim()
        if (firstLine) {
          setSmsFirstLine(firstLine.length > 60 ? firstLine.substring(0, 60) + '...' : firstLine)
        }
      }
      if (instructionContentRef.current) {
        const text =
          instructionContentRef.current.innerText || instructionContentRef.current.textContent || ''
        const firstLine =
          text.split('\n').find(line => line.trim().length > 0) || text.substring(0, 60).trim()
        if (firstLine) {
          setInstructionFirstLine(
            firstLine.length > 60 ? firstLine.substring(0, 60) + '...' : firstLine
          )
        }
      }
    }

    // Extract immediately and then periodically
    extractFirstLine()
    const extractInterval = setInterval(extractFirstLine, 2000)

    return () => clearInterval(extractInterval)
  }, [deviceId, animationState])

  // Animation cycle: expanded -> collapsing -> collapsed -> flipping -> expanding -> expanded
  const startAnimationCycle = () => {
    if (animationStateRef.current !== 'expanded') return // Don't start if already animating

    // Check if animation should be stopped on current card
    const stopOn = stopAnimationOnRef.current
    const current = currentCardRef.current

    if (stopOn === current) {
      // Animation is stopped on this card, don't animate
      // Also clear the interval to prevent future attempts
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Step 1: Collapse current card
    setAnimationState('collapsing')

    animationTimeoutRef.current = setTimeout(() => {
      setAnimationState('collapsed')

      // Step 2: Flip to other card
      animationTimeoutRef.current = setTimeout(() => {
        setAnimationState('flipping')
        const current = currentCardRef.current
        const newCard = current === 'sms' ? 'instruction' : 'sms'
        setNextCard(newCard)

        animationTimeoutRef.current = setTimeout(() => {
          setCurrentCard(newCard)
          setNextCard(current)

          // Step 3: Expand new card
          animationTimeoutRef.current = setTimeout(() => {
            setAnimationState('expanding')

            animationTimeoutRef.current = setTimeout(() => {
              setAnimationState('expanded')
            }, 500) // Expand animation duration
          }, 100) // Brief pause after flip
        }, 300) // Half of flip animation
      }, 300) // Brief pause at collapsed state
    }, 600) // Collapse animation duration
  }

  // Set up 20-second interval - only if animation is not stopped
  useEffect(() => {
    if (!deviceId) return

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    // Check if animation should be stopped on current card
    const stopOn = stopAnimationOnRef.current
    const current = currentCardRef.current

    // If animation is stopped on current card, don't start the interval
    if (stopOn === current) {
      return
    }

    // Start the cycle after initial delay of 20 seconds
    intervalRef.current = setInterval(() => {
      startAnimationCycle()
    }, 20000) // 20 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current)
        animationTimeoutRef.current = null
      }
    }
  }, [deviceId, stopAnimationOn, currentCard])

  if (!deviceId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Please select a device to view messages and instructions
      </div>
    )
  }

  const isCollapsed =
    animationState === 'collapsed' ||
    animationState === 'collapsing' ||
    animationState === 'flipping'

  const getFirstLineText = (card: CardType) => {
    if (card === 'sms') {
      return smsFirstLine || 'Remote Messages'
    } else {
      return instructionFirstLine || 'Instructions'
    }
  }

  const getFlipRotation = (card: CardType) => {
    if (animationState === 'flipping') {
      if (card === currentCard) {
        return 'rotateY(-90deg)' // Rotating out (backwards)
      } else if (card === nextCard) {
        return 'rotateY(0deg)' // Rotating in (will animate from 90deg to 0deg)
      }
    }
    // When not flipping, show current card normally
    if (card === currentCard) {
      return 'rotateY(0deg)'
    }
    // Hide other card by rotating it away (start from behind)
    return 'rotateY(90deg)'
  }

  const getCardZIndex = (card: CardType) => {
    if (animationState === 'flipping') {
      // During flip, both cards are visible, new one should be on top
      if (card === nextCard) {
        return 20
      }
      return 10
    }
    // Normal state: current card on top
    if (card === currentCard) {
      return 20
    }
    return 10
  }

  const getCardOpacity = (card: CardType) => {
    if (animationState === 'flipping') {
      // Both cards visible during flip
      if (card === currentCard || card === nextCard) {
        return 1
      }
      return 0
    }
    // Normal state: only current card visible
    if (card === currentCard) {
      return 1
    }
    return 0
  }

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ minHeight: '400px', perspective: '1000px' }}
    >
      {/* SMS Card */}
      <div
        className="absolute inset-0 transition-all duration-300 ease-in-out"
        style={{
          transform: getFlipRotation('sms'),
          transformStyle: 'preserve-3d',
          backfaceVisibility: 'hidden',
          height: isCollapsed ? '60px' : 'auto',
          zIndex: getCardZIndex('sms'),
          opacity: getCardOpacity('sms'),
          pointerEvents: getCardOpacity('sms') > 0 ? 'auto' : 'none',
          transition:
            animationState === 'flipping'
              ? 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.1s ease-in-out'
              : 'height 0.6s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-in-out, transform 0.3s ease-in-out',
        }}
      >
        {isCollapsed ? (
          <Card className="h-[60px] flex items-center px-4 shadow-md">
            <CardContent className="flex items-center gap-3 p-0 w-full">
              <MessageSquare className="h-5 w-5 text-primary flex-shrink-0" />
              <p className="text-sm font-medium truncate flex-1">{getFirstLineText('sms')}</p>
            </CardContent>
          </Card>
        ) : (
          <div
            ref={smsContentRef}
            className="h-full"
            style={{
              animation:
                animationState === 'expanding'
                  ? 'expandCard 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards'
                  : 'none',
              overflow: 'hidden',
            }}
          >
            <RemoteMessages deviceId={deviceId} />
          </div>
        )}
      </div>

      {/* Instruction Card */}
      <div
        className="absolute inset-0 transition-all duration-300 ease-in-out"
        style={{
          transform: getFlipRotation('instruction'),
          transformStyle: 'preserve-3d',
          backfaceVisibility: 'hidden',
          height: isCollapsed ? '60px' : 'auto',
          zIndex: getCardZIndex('instruction'),
          opacity: getCardOpacity('instruction'),
          pointerEvents: getCardOpacity('instruction') > 0 ? 'auto' : 'none',
          transition:
            animationState === 'flipping'
              ? 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.1s ease-in-out'
              : 'height 0.6s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-in-out, transform 0.3s ease-in-out',
        }}
      >
        {isCollapsed ? (
          <Card className="h-[60px] flex items-center px-4 shadow-md">
            <CardContent className="flex items-center gap-3 p-0 w-full">
              <BookOpen className="h-5 w-5 text-primary flex-shrink-0" />
              <p className="text-sm font-medium truncate flex-1">
                {getFirstLineText('instruction')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div
            ref={instructionContentRef}
            className="h-full"
            style={{
              animation:
                animationState === 'expanding'
                  ? 'expandCard 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards'
                  : 'none',
              overflow: 'hidden',
            }}
          >
            <InstructionCard deviceId={deviceId} />
          </div>
        )}
      </div>

      <style>{`
        @keyframes expandCard {
          from {
            max-height: 60px;
            opacity: 0.7;
            transform: scale(0.98);
          }
          to {
            max-height: 3000px;
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  )
}
