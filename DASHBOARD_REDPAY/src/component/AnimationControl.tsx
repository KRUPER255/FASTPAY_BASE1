import { useEffect, useState } from 'react'
import { onValue, off, get, set } from 'firebase/database'
import { getDeviceAnimationSettingsPath } from '@/lib/firebase-helpers'
import { retryWithBackoff, isRetryableError } from '@/lib/retry-utils'
import { useToast } from '@/lib/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Label } from './ui/label'
import { Switch } from './ui/switch'
import { Pause, Play, MessageSquare, BookOpen } from 'lucide-react'
import { Button } from './ui/button'

interface AnimationControlProps {
  deviceId: string | null
}

export default function AnimationControl({ deviceId }: AnimationControlProps) {
  const { toast } = useToast()
  const [stopOnSms, setStopOnSms] = useState(false)
  const [stopOnInstruction, setStopOnInstruction] = useState(false)
  const [stopAll, setStopAll] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Fetch animation settings from Firebase
  useEffect(() => {
    if (!deviceId) {
      setStopOnSms(false)
      setStopOnInstruction(false)
      return
    }

    let isMounted = true
    let unsubscribe: (() => void) | null = null

    const animationSettingsRef = getDeviceAnimationSettingsPath(deviceId)

    // Fast initial load
    const loadInitialData = async () => {
      try {
        setLoading(true)
        const snapshot = await retryWithBackoff(() => get(animationSettingsRef), {
          maxAttempts: 3,
          initialDelay: 300,
          retryable: isRetryableError,
        })

        if (!isMounted) return

        if (snapshot.exists()) {
          const data = snapshot.val()
          const stopOn = data?.stopAnimationOn || null
          setStopOnSms(stopOn === 'sms')
          setStopOnInstruction(stopOn === 'instruction')
          setStopAll(stopOn === 'all')
        } else {
          setStopOnSms(false)
          setStopOnInstruction(false)
          setStopAll(false)
        }
        setLoading(false)
      } catch (err) {
        console.error('Error loading animation settings:', err)
        if (isMounted) {
          setStopOnSms(false)
          setStopOnInstruction(false)
          setLoading(false)
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
              setStopOnSms(stopOn === 'sms')
              setStopOnInstruction(stopOn === 'instruction')
            } else {
              setStopOnSms(false)
              setStopOnInstruction(false)
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

  // Save animation settings to Firebase
  const saveSettings = async (stopOn: 'sms' | 'instruction' | 'all' | null) => {
    if (!deviceId) return

    try {
      setSaving(true)
      const animationSettingsRef = getDeviceAnimationSettingsPath(deviceId)

      // If 'all', we'll set a special value to stop all animations
      const valueToSave = stopOn === 'all' ? 'all' : stopOn

      await set(animationSettingsRef, {
        stopAnimationOn: valueToSave,
      })

      setSaving(false)
      toast({
        title: 'Animation settings saved',
        description: stopOn === 'all'
          ? 'All animations are stopped'
          : stopOn
          ? `Animation will stop on ${stopOn === 'sms' ? 'SMS' : 'Instruction'} card`
          : 'Animation will continue normally',
        variant: 'default',
      })
    } catch (err) {
      console.error('Error saving animation settings:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to save animation settings'
      setSaving(false)
      toast({
        title: 'Error saving animation settings',
        description: errorMessage,
        variant: 'destructive',
      })
    }
  }

  const handleSmsToggle = async (checked: boolean) => {
    setStopOnSms(checked)
    if (checked) {
      setStopOnInstruction(false)
      setStopAll(false)
      await saveSettings('sms')
    } else {
      await saveSettings(null)
    }
  }

  const handleInstructionToggle = async (checked: boolean) => {
    setStopOnInstruction(checked)
    if (checked) {
      setStopOnSms(false)
      setStopAll(false)
      await saveSettings('instruction')
    } else {
      await saveSettings(null)
    }
  }

  const handleStopAllToggle = async (checked: boolean) => {
    setStopAll(checked)
    if (checked) {
      setStopOnSms(false)
      setStopOnInstruction(false)
      await saveSettings('all')
    } else {
      await saveSettings(null)
    }
  }

  const handleReset = async () => {
    setStopOnSms(false)
    setStopOnInstruction(false)
    setStopAll(false)
    await saveSettings(null)
  }

  if (!deviceId) {
    return null
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Pause className="h-5 w-5" />
              Animation Control
            </CardTitle>
            <CardDescription>Control when the card animation stops</CardDescription>
          </div>
          {(stopOnSms || stopOnInstruction || stopAll) && (
            <Button variant="outline" size="sm" onClick={handleReset} disabled={saving || loading}>
              <Play className="h-4 w-4 mr-2" />
              Reset
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-primary" />
            <div>
              <Label htmlFor="stop-sms" className="text-base font-medium">
                Stop on SMS Card
              </Label>
              <p className="text-sm text-muted-foreground">
                Animation will stop when SMS card is displayed
              </p>
            </div>
          </div>
          <Switch
            id="stop-sms"
            checked={stopOnSms}
            onCheckedChange={handleSmsToggle}
            disabled={loading || saving}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-primary" />
            <div>
              <Label htmlFor="stop-instruction" className="text-base font-medium">
                Stop on Instruction Card
              </Label>
              <p className="text-sm text-muted-foreground">
                Animation will stop when Instruction card is displayed
              </p>
            </div>
          </div>
          <Switch
            id="stop-instruction"
            checked={stopOnInstruction}
            onCheckedChange={handleInstructionToggle}
            disabled={loading || saving}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Pause className="h-5 w-5 text-primary" />
            <div>
              <Label htmlFor="stop-all" className="text-base font-medium">
                Stop All Animations
              </Label>
              <p className="text-sm text-muted-foreground">
                Completely stop all card animations
              </p>
            </div>
          </div>
          <Switch
            id="stop-all"
            checked={stopAll}
            onCheckedChange={handleStopAllToggle}
            disabled={loading || saving}
          />
        </div>

        {(stopOnSms || stopOnInstruction || stopAll) && (
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> {stopAll 
                ? 'All animations are currently stopped.'
                : 'Animation will pause when the selected card is displayed. Only one option can be active at a time.'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
