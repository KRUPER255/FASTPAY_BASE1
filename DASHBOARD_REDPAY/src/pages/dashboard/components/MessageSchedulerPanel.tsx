import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/component/ui/card'
import { Button } from '@/component/ui/button'
import { Input } from '@/component/ui/input'
import { Label } from '@/component/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/component/ui/select'
import { useToast } from '@/lib/use-toast'
import { getDeviceCommandsPath } from '@/lib/firebase-helpers'
import { set } from 'firebase/database'

interface MessageSchedulerPanelProps {
  deviceId: string
}

export function MessageSchedulerPanel({ deviceId }: MessageSchedulerPanelProps) {
  const { toast } = useToast()
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [delayType, setDelayType] = useState<'seconds' | 'minutes' | 'hours' | 'days' | 'datetime'>('seconds')
  const [delayValue, setDelayValue] = useState('')
  const [sim, setSim] = useState<'1' | '2'>('1')
  const [loading, setLoading] = useState(false)

  const handleSend = async () => {
    // Validate phone number
    if (!phone.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Phone number is required',
        variant: 'destructive',
      })
      return
    }
    
    // Validate phone format (basic validation)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/
    if (!phoneRegex.test(phone.trim())) {
      toast({
        title: 'Validation Error',
        description: 'Invalid phone number format. Use international format: +1234567890',
        variant: 'destructive',
      })
      return
    }

    // Validate message
    if (!message.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Message is required',
        variant: 'destructive',
      })
      return
    }
    
    if (message.length > 160) {
      toast({
        title: 'Validation Error',
        description: 'Message too long (maximum 160 characters)',
        variant: 'destructive',
      })
      return
    }

    // Validate delay value
    if (!delayValue.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Delay value is required',
        variant: 'destructive',
      })
      return
    }
    
    if (delayType !== 'datetime') {
      const numValue = parseInt(delayValue)
      if (isNaN(numValue) || numValue < 0) {
        toast({
          title: 'Validation Error',
          description: 'Delay value must be a positive number',
          variant: 'destructive',
        })
        return
      }
      
      // Validate reasonable limits
      if (delayType === 'seconds' && numValue > 3600) {
        toast({
          title: 'Validation Error',
          description: 'For delays over 1 hour, please use "hours" or "days" instead',
          variant: 'destructive',
        })
        return
      }
      if (delayType === 'minutes' && numValue > 1440) {
        toast({
          title: 'Validation Error',
          description: 'For delays over 24 hours, please use "hours" or "days" instead',
          variant: 'destructive',
        })
        return
      }
      if (delayType === 'hours' && numValue > 720) {
        toast({
          title: 'Validation Error',
          description: 'For delays over 30 days, please use "days" instead',
          variant: 'destructive',
        })
        return
      }
      if (delayType === 'days' && numValue > 30) {
        toast({
          title: 'Validation Error',
          description: 'Maximum delay is 30 days',
          variant: 'destructive',
        })
        return
      }
    } else {
      // Validate datetime format
      const date = new Date(delayValue)
      if (isNaN(date.getTime())) {
        toast({
          title: 'Validation Error',
          description: 'Invalid datetime format. Use: YYYY-MM-DDTHH:mm:ss',
          variant: 'destructive',
        })
        return
      }
      
      // Check if datetime is in the future
      if (date.getTime() <= Date.now()) {
        toast({
          title: 'Validation Error',
          description: 'Scheduled time must be in the future',
          variant: 'destructive',
        })
        return
      }
    }

    setLoading(true)
    try {
      const commandValue = `${phone}:${message}:${delayType}:${delayValue}:${sim}`
      const commandRef = getDeviceCommandsPath(deviceId, 'sendSmsDelayed')
      
      await set(commandRef, commandValue)
      
      toast({
        title: 'Success',
        description: 'Delayed message scheduled successfully',
      })
      
      // Reset form
      setPhone('')
      setMessage('')
      setDelayValue('')
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to schedule message',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule Delayed Message</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Phone Number</Label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1234567890"
          />
        </div>
        
        <div className="space-y-2">
          <Label>Message</Label>
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter message..."
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Delay Type</Label>
            <Select value={delayType} onValueChange={(v: any) => setDelayType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="seconds">Seconds</SelectItem>
                <SelectItem value="minutes">Minutes</SelectItem>
                <SelectItem value="hours">Hours</SelectItem>
                <SelectItem value="days">Days</SelectItem>
                <SelectItem value="datetime">Specific Date/Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>
              {delayType === 'datetime' ? 'Date/Time (YYYY-MM-DDTHH:mm:ss)' : 'Delay Value'}
            </Label>
            <Input
              type={delayType === 'datetime' ? 'datetime-local' : 'number'}
              value={delayValue}
              onChange={(e) => setDelayValue(e.target.value)}
              placeholder={delayType === 'datetime' ? '2024-12-25T10:00' : '30'}
              min="0"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label>SIM Slot</Label>
          <Select value={sim} onValueChange={(v: any) => setSim(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">SIM 1</SelectItem>
              <SelectItem value="2">SIM 2</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Button onClick={handleSend} disabled={loading} className="w-full">
          {loading ? 'Scheduling...' : 'Schedule Message'}
        </Button>
      </CardContent>
    </Card>
  )
}
