import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/component/ui/card'
import { Button } from '@/component/ui/button'
import { Input } from '@/component/ui/input'
import { Label } from '@/component/ui/label'
import { Switch } from '@/component/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/component/ui/select'
import { useToast } from '@/lib/use-toast'
import { getDeviceCommandsPath, getDevicePath } from '@/lib/firebase-helpers'
import { set, get } from 'firebase/database'

interface AutoReplyPanelProps {
  deviceId: string
}

export function AutoReplyPanel({ deviceId }: AutoReplyPanelProps) {
  const { toast } = useToast()
  const [enabled, setEnabled] = useState(false)
  const [trigger, setTrigger] = useState<'all' | 'keyword' | 'sender' | 'time' | 'template'>('all')
  const [replyMessage, setReplyMessage] = useState('')
  const [keyword, setKeyword] = useState('')
  const [sender, setSender] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [templateId, setTemplateId] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (deviceId) {
      loadAutoReplyConfig()
    }
  }, [deviceId])

  const loadAutoReplyConfig = async () => {
    try {
      const configRef = getDevicePath(deviceId, 'autoReplyConfig')
      const snapshot = await get(configRef)
      if (snapshot.exists()) {
        const config = snapshot.val()
        setEnabled(config.enabled || false)
        setTrigger(config.trigger || 'all')
        setReplyMessage(config.replyMessage || '')
        
        // Load condition-specific values
        if (config.conditions) {
          if (config.conditions.keyword) {
            setKeyword(config.conditions.keyword)
          }
          if (config.conditions.sender) {
            setSender(config.conditions.sender)
          }
          if (config.conditions.startTime) {
            setStartTime(config.conditions.startTime)
          }
          if (config.conditions.endTime) {
            setEndTime(config.conditions.endTime)
          }
          if (config.conditions.templateId) {
            setTemplateId(config.conditions.templateId)
          }
        }
      }
    } catch (error) {
      console.error('Error loading auto-reply config:', error)
    }
  }

  const handleSave = async () => {
    if (!replyMessage.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter reply message',
        variant: 'destructive',
      })
      return
    }

    // Build conditions based on trigger
    let conditions = 'null'
    if (trigger === 'keyword') {
      if (!keyword.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Please enter keyword',
          variant: 'destructive',
        })
        return
      }
      conditions = `keyword=${keyword}`
    } else if (trigger === 'sender') {
      if (!sender.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Please enter sender number',
          variant: 'destructive',
        })
        return
      }
      const phoneRegex = /^\+?[1-9]\d{1,14}$/
      if (!phoneRegex.test(sender.trim())) {
        toast({
          title: 'Validation Error',
          description: 'Invalid sender phone number format',
          variant: 'destructive',
        })
        return
      }
      conditions = `sender=${sender}`
    } else if (trigger === 'time') {
      if (!startTime.trim() || !endTime.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Please enter start and end time',
          variant: 'destructive',
        })
        return
      }
      conditions = `startTime=${startTime}&endTime=${endTime}`
    } else if (trigger === 'template') {
      if (!templateId.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Please select template',
          variant: 'destructive',
        })
        return
      }
      conditions = `templateId=${templateId}`
    }

    setLoading(true)
    try {
      const commandValue = `${enabled}:${trigger}:${replyMessage}:${conditions}`
      const commandRef = getDeviceCommandsPath(deviceId, 'setupAutoReply')
      
      await set(commandRef, commandValue)
      
      toast({
        title: 'Success',
        description: 'Auto-reply configuration saved',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save configuration',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auto-Reply Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Enable Auto-Reply</Label>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
        
        <div className="space-y-2">
          <Label>Trigger Type</Label>
          <Select value={trigger} onValueChange={(v: any) => setTrigger(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Messages</SelectItem>
              <SelectItem value="keyword">Keyword Match</SelectItem>
              <SelectItem value="sender">Specific Sender</SelectItem>
              <SelectItem value="time">Time Range</SelectItem>
              <SelectItem value="template">Template Match</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {trigger === 'keyword' && (
          <div className="space-y-2">
            <Label>Keyword</Label>
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Enter keyword..."
            />
            <p className="text-sm text-muted-foreground">
              Auto-reply will trigger when message contains this keyword
            </p>
          </div>
        )}
        
        {trigger === 'sender' && (
          <div className="space-y-2">
            <Label>Sender Number</Label>
            <Input
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              placeholder="+1234567890"
            />
            <p className="text-sm text-muted-foreground">
              Auto-reply will trigger only for messages from this sender
            </p>
          </div>
        )}
        
        {trigger === 'time' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Time</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground col-span-2">
              Auto-reply will trigger only during this time range
            </p>
          </div>
        )}
        
        {trigger === 'template' && (
          <div className="space-y-2">
            <Label>Template ID</Label>
            <Input
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              placeholder="otp, transaction, etc."
            />
            <p className="text-sm text-muted-foreground">
              Auto-reply will trigger when message matches this template pattern
            </p>
          </div>
        )}
        
        <div className="space-y-2">
          <Label>Reply Message</Label>
          <Input
            value={replyMessage}
            onChange={(e) => setReplyMessage(e.target.value)}
            placeholder="Enter reply message..."
            maxLength={160}
          />
          <p className="text-sm text-muted-foreground">
            Variables: {'{sender}'}, {'{message}'}, {'{time}'}, {'{date}'}, {'{datetime}'}
          </p>
          <p className="text-sm text-muted-foreground">
            {replyMessage.length}/160 characters
          </p>
        </div>
        
        <Button onClick={handleSave} disabled={loading} className="w-full">
          {loading ? 'Saving...' : 'Save Configuration'}
        </Button>
      </CardContent>
    </Card>
  )
}
