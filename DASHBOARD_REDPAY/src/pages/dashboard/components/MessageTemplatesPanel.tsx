import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/component/ui/card'
import { Button } from '@/component/ui/button'
import { Input } from '@/component/ui/input'
import { Label } from '@/component/ui/label'
import { Textarea } from '@/component/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/component/ui/select'
import { useToast } from '@/lib/use-toast'
import { getDeviceCommandsPath, getDevicePath } from '@/lib/firebase-helpers'
import { set, get, ref, onValue, off } from 'firebase/database'
import { database } from '@/lib/firebase'

interface MessageTemplatesPanelProps {
  deviceId: string
}

interface Template {
  id: string
  content: string
  category: string
  isPreBuilt: boolean
}

export function MessageTemplatesPanel({ deviceId }: MessageTemplatesPanelProps) {
  const { toast } = useToast()
  const [mode, setMode] = useState<'send' | 'manage'>('send')
  
  // Send template fields
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [phone, setPhone] = useState('')
  const [variables, setVariables] = useState('')
  const [templatePreview, setTemplatePreview] = useState('')
  
  // Manage template fields
  const [templateId, setTemplateId] = useState('')
  const [templateContent, setTemplateContent] = useState('')
  const [templateCategory, setTemplateCategory] = useState('custom')
  const [customTemplates, setCustomTemplates] = useState<Template[]>([])
  
  const [loading, setLoading] = useState(false)

  // Pre-built templates
  const preBuiltTemplates: Template[] = [
    { id: 'otp_bank', content: 'Your OTP is {code}. Valid for 5 minutes.', category: 'OTP', isPreBuilt: true },
    { id: 'otp_app', content: 'Your verification code is {code}.', category: 'OTP', isPreBuilt: true },
    { id: 'otp_login', content: 'Your login OTP is {code}. Valid for 10 minutes.', category: 'OTP', isPreBuilt: true },
    { id: 'transaction_debit', content: 'Debit of Rs. {amount} from A/c {account} on {date}.', category: 'Banking', isPreBuilt: true },
    { id: 'transaction_credit', content: 'Credit of Rs. {amount} to A/c {account} on {date}.', category: 'Banking', isPreBuilt: true },
    { id: 'balance_update', content: 'Your account balance is Rs. {balance} as on {date}.', category: 'Banking', isPreBuilt: true },
    { id: 'delivery_notification', content: 'Your order {tracking} is out for delivery. Expected: {date}.', category: 'Service', isPreBuilt: true },
    { id: 'appointment_reminder', content: 'Reminder: Appointment on {date} at {time}.', category: 'Service', isPreBuilt: true },
    { id: 'greeting_basic', content: 'Hello {name}, welcome!', category: 'Greeting', isPreBuilt: true },
  ]

  useEffect(() => {
    if (deviceId && mode === 'manage') {
      loadCustomTemplates()
    }
  }, [deviceId, mode])

  useEffect(() => {
    if (selectedTemplateId && phone) {
      updatePreview()
    }
  }, [selectedTemplateId, phone, variables])

  const loadCustomTemplates = () => {
    if (!deviceId) return
    
    const templatesPath = `fastpay/${deviceId}/templates`
    const templatesRef = ref(database, templatesPath)
    
    onValue(templatesRef, (snapshot) => {
      if (snapshot.exists()) {
        const templates: Template[] = []
        snapshot.forEach((child) => {
          const data = child.val()
          templates.push({
            id: child.key || '',
            content: data.content || '',
            category: data.category || 'custom',
            isPreBuilt: false
          })
        })
        setCustomTemplates(templates)
      } else {
        setCustomTemplates([])
      }
    })
    
    return () => {
      off(templatesRef)
    }
  }

  const updatePreview = () => {
    const template = [...preBuiltTemplates, ...customTemplates].find(t => t.id === selectedTemplateId)
    if (!template) {
      setTemplatePreview('')
      return
    }
    
    // Simple preview - replace variables with sample values
    let preview = template.content
    const vars = parseVariables(variables)
    vars.forEach((value, key) => {
      preview = preview.replace(new RegExp(`\\{${key}\\}`, 'gi'), value)
    })
    
    // Replace system variables
    const now = new Date()
    preview = preview.replace(/{date}/gi, now.toLocaleDateString('en-GB'))
    preview = preview.replace(/{time}/gi, now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
    preview = preview.replace(/{datetime}/gi, now.toLocaleString('en-GB'))
    preview = preview.replace(/{timestamp}/gi, now.getTime().toString())
    preview = preview.replace(/{code}/gi, '123456')
    preview = preview.replace(/{amount}/gi, '1000')
    preview = preview.replace(/{account}/gi, '1234567890')
    preview = preview.replace(/{balance}/gi, '50000')
    preview = preview.replace(/{tracking}/gi, 'ABC123XYZ')
    preview = preview.replace(/{name}/gi, phone)
    
    setTemplatePreview(preview)
  }

  const parseVariables = (variableString: string): Map<string, string> => {
    const vars = new Map<string, string>()
    if (!variableString.trim()) return vars
    
    variableString.split('&').forEach(pair => {
      const parts = pair.split('=', 2)
      if (parts.length === 2) {
        vars.set(parts[0].trim(), parts[1].trim())
      }
    })
    return vars
  }

  const handleSendTemplate = async () => {
    if (!selectedTemplateId) {
      toast({
        title: 'Validation Error',
        description: 'Please select a template',
        variant: 'destructive',
      })
      return
    }
    
    if (!phone.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter phone number',
        variant: 'destructive',
      })
      return
    }
    
    const phoneRegex = /^\+?[1-9]\d{1,14}$/
    if (!phoneRegex.test(phone.trim())) {
      toast({
        title: 'Validation Error',
        description: 'Invalid phone number format',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const commandValue = `${selectedTemplateId}:${phone}:${variables || 'null'}`
      const commandRef = getDeviceCommandsPath(deviceId, 'sendSmsTemplate')
      
      await set(commandRef, commandValue)
      
      toast({
        title: 'Success',
        description: 'Template SMS sent',
      })
      
      // Reset form
      setPhone('')
      setVariables('')
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send template SMS',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveTemplate = async () => {
    if (!templateId.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter template ID',
        variant: 'destructive',
      })
      return
    }
    
    if (!templateContent.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter template content',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      // Use pipe (|) as delimiter to avoid conflicts with colons
      const commandValue = `${templateId}|${templateContent}|${templateCategory}`
      const commandRef = getDeviceCommandsPath(deviceId, 'saveTemplate')
      
      await set(commandRef, commandValue)
      
      toast({
        title: 'Success',
        description: 'Template saved',
      })
      
      // Reset form
      setTemplateId('')
      setTemplateContent('')
      setTemplateCategory('custom')
      loadCustomTemplates()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save template',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTemplate = async (templateIdToDelete: string) => {
    if (!confirm(`Are you sure you want to delete template "${templateIdToDelete}"?`)) {
      return
    }

    setLoading(true)
    try {
      const commandRef = getDeviceCommandsPath(deviceId, 'deleteTemplate')
      
      await set(commandRef, templateIdToDelete)
      
      toast({
        title: 'Success',
        description: 'Template deleted',
      })
      
      loadCustomTemplates()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete template',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const allTemplates = [...preBuiltTemplates, ...customTemplates]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Message Templates</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Mode</Label>
          <Select value={mode} onValueChange={(v: any) => setMode(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="send">Send Template SMS</SelectItem>
              <SelectItem value="manage">Manage Templates</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {mode === 'send' ? (
          <>
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select template..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">OTP</div>
                  {allTemplates.filter(t => t.category === 'OTP').map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.id}</SelectItem>
                  ))}
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Banking</div>
                  {allTemplates.filter(t => t.category === 'Banking').map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.id}</SelectItem>
                  ))}
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Service</div>
                  {allTemplates.filter(t => t.category === 'Service').map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.id}</SelectItem>
                  ))}
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Greeting</div>
                  {allTemplates.filter(t => t.category === 'Greeting').map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.id}</SelectItem>
                  ))}
                  {customTemplates.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Custom</div>
                      {customTemplates.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.id}</SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              {selectedTemplateId && (
                <p className="text-sm text-muted-foreground">
                  {allTemplates.find(t => t.id === selectedTemplateId)?.content}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1234567890"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Variables (Optional)</Label>
              <Input
                value={variables}
                onChange={(e) => setVariables(e.target.value)}
                placeholder="name=John&code=123456"
              />
              <p className="text-sm text-muted-foreground">
                Format: key1=value1&key2=value2
              </p>
            </div>
            
            {templatePreview && (
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm">{templatePreview}</p>
                </div>
              </div>
            )}
            
            <Button onClick={handleSendTemplate} disabled={loading} className="w-full">
              {loading ? 'Sending...' : 'Send Template SMS'}
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Template ID</Label>
              <Input
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                placeholder="my_custom_template"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Template Content</Label>
              <Textarea
                value={templateContent}
                onChange={(e) => setTemplateContent(e.target.value)}
                placeholder="Hello {name}, your code is {code}."
                rows={4}
              />
              <p className="text-sm text-muted-foreground">
                Use {'{variable}'} for placeholders. System variables: {'{date}'}, {'{time}'}, {'{datetime}'}, {'{timestamp}'}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={templateCategory} onValueChange={setTemplateCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom</SelectItem>
                  <SelectItem value="OTP">OTP</SelectItem>
                  <SelectItem value="Banking">Banking</SelectItem>
                  <SelectItem value="Service">Service</SelectItem>
                  <SelectItem value="Greeting">Greeting</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button onClick={handleSaveTemplate} disabled={loading} className="w-full">
              {loading ? 'Saving...' : 'Save Template'}
            </Button>
            
            {customTemplates.length > 0 && (
              <div className="space-y-2 mt-4">
                <Label>Custom Templates</Label>
                <div className="space-y-2">
                  {customTemplates.map(template => (
                    <div key={template.id} className="p-3 border rounded-md flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold">{template.id}</p>
                        <p className="text-sm text-muted-foreground">{template.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">Category: {template.category}</p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteTemplate(template.id)}
                        disabled={loading}
                      >
                        Delete
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
