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
import { Textarea } from '@/component/ui/textarea'
import { useToast } from '@/lib/use-toast'
import { getDeviceCommandsPath } from '@/lib/firebase-helpers'
import { set } from 'firebase/database'

interface BulkOperationsPanelProps {
  deviceId: string
}

export function BulkOperationsPanel({ deviceId }: BulkOperationsPanelProps) {
  const { toast } = useToast()
  const [operationType, setOperationType] = useState<'send' | 'edit'>('send')
  
  // Bulk send fields
  const [recipients, setRecipients] = useState('')
  const [message, setMessage] = useState('')
  const [personalize, setPersonalize] = useState(false)
  const [delay, setDelay] = useState('0')
  const [sim, setSim] = useState<'1' | '2'>('1')
  
  // Bulk edit fields
  const [criteria, setCriteria] = useState('')
  const [editField, setEditField] = useState<'content' | 'sender' | 'timestamp' | 'status'>('content')
  const [newValue, setNewValue] = useState('')
  
  const [loading, setLoading] = useState(false)

  const handleBulkSend = async () => {
    if (!recipients.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter recipients',
        variant: 'destructive',
      })
      return
    }
    
    if (!message.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter message',
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
    
    const delayNum = parseInt(delay)
    if (isNaN(delayNum) || delayNum < 0 || delayNum > 3600) {
      toast({
        title: 'Validation Error',
        description: 'Delay must be between 0 and 3600 seconds',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const commandValue = `${recipients}:${message}:${personalize}:${delay}:${sim}`
      const commandRef = getDeviceCommandsPath(deviceId, 'sendBulkSms')
      
      await set(commandRef, commandValue)
      
      toast({
        title: 'Success',
        description: 'Bulk SMS operation started',
      })
      
      // Reset form
      setRecipients('')
      setMessage('')
      setPersonalize(false)
      setDelay('0')
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start bulk operation',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleBulkEdit = async () => {
    if (!criteria.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter criteria',
        variant: 'destructive',
      })
      return
    }
    
    if (!newValue.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter new value',
        variant: 'destructive',
      })
      return
    }
    
    // Validate based on field
    if (editField === 'content' && newValue.length > 160) {
      toast({
        title: 'Validation Error',
        description: 'Message content cannot exceed 160 characters',
        variant: 'destructive',
      })
      return
    }
    
    if (editField === 'sender') {
      const phoneRegex = /^\+?[1-9]\d{1,14}$/
      if (!phoneRegex.test(newValue.trim())) {
        toast({
          title: 'Validation Error',
          description: 'Invalid sender phone number format',
          variant: 'destructive',
        })
        return
      }
    }
    
    if (editField === 'timestamp') {
      const timestamp = parseInt(newValue)
      if (isNaN(timestamp) || timestamp <= 0) {
        toast({
          title: 'Validation Error',
          description: 'Invalid timestamp. Must be a positive integer (milliseconds)',
          variant: 'destructive',
        })
        return
      }
    }
    
    if (editField === 'status' && newValue.toLowerCase() !== 'read' && newValue.toLowerCase() !== 'unread') {
      toast({
        title: 'Validation Error',
        description: 'Status must be "read" or "unread"',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const commandValue = `${criteria}:${editField}:${newValue}`
      const commandRef = getDeviceCommandsPath(deviceId, 'bulkEditMessage')
      
      await set(commandRef, commandValue)
      
      toast({
        title: 'Success',
        description: 'Bulk edit operation started',
      })
      
      // Reset form
      setCriteria('')
      setNewValue('')
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start bulk edit',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Operations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Operation Type</Label>
          <Select value={operationType} onValueChange={(v: any) => setOperationType(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="send">Bulk Send SMS</SelectItem>
              <SelectItem value="edit">Bulk Edit Messages</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {operationType === 'send' ? (
          <>
            <div className="space-y-2">
              <Label>Recipients</Label>
              <Textarea
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder="+1234567890,+9876543210,+1112223333"
                rows={3}
              />
              <p className="text-sm text-muted-foreground">
                Enter comma-separated phone numbers (e.g., +123,+456,+789)
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter message..."
                maxLength={160}
                rows={3}
              />
              <p className="text-sm text-muted-foreground">
                Variables: {'{name}'}, {'{number}'}, {'{random}'}, {'{date}'}, {'{time}'}, {'{datetime}'}
              </p>
              <p className="text-sm text-muted-foreground">
                {message.length}/160 characters
              </p>
            </div>
            
            <div className="flex items-center justify-between">
              <Label>Personalize Messages</Label>
              <Switch checked={personalize} onCheckedChange={setPersonalize} />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Delay (seconds)</Label>
                <Input
                  type="number"
                  value={delay}
                  onChange={(e) => setDelay(e.target.value)}
                  placeholder="0"
                  min="0"
                  max="3600"
                />
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
            </div>
            
            <Button onClick={handleBulkSend} disabled={loading} className="w-full">
              {loading ? 'Starting...' : 'Start Bulk Send'}
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Criteria</Label>
              <Input
                value={criteria}
                onChange={(e) => setCriteria(e.target.value)}
                placeholder="sender=+1234567890 or sender=+123&date=2024-01-01"
              />
              <p className="text-sm text-muted-foreground">
                Format: field=value (e.g., sender=+1234567890) or multiple: field1=value1&field2=value2
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Field to Edit</Label>
              <Select value={editField} onValueChange={(v: any) => setEditField(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="content">Content</SelectItem>
                  <SelectItem value="sender">Sender</SelectItem>
                  <SelectItem value="timestamp">Timestamp</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>New Value</Label>
              {editField === 'status' ? (
                <Select value={newValue} onValueChange={setNewValue}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read">Read</SelectItem>
                    <SelectItem value="unread">Unread</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder={
                    editField === 'content' ? 'Enter new message content...' :
                    editField === 'sender' ? '+1234567890' :
                    '1703123456789 (milliseconds)'
                  }
                  type={editField === 'timestamp' ? 'number' : 'text'}
                />
              )}
            </div>
            
            <Button onClick={handleBulkEdit} disabled={loading} className="w-full">
              {loading ? 'Starting...' : 'Start Bulk Edit'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
