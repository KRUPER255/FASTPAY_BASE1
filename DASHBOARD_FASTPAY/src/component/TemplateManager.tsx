import { useEffect, useState } from 'react'
import { ref, onValue, off, get, set, remove } from 'firebase/database'
import { database } from '@/lib/firebase'
import { Button } from '@/component/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/component/ui/card'
import { Input } from '@/component/ui/input'
import { Label } from '@/component/ui/label'
import { Textarea } from '@/component/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/component/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/component/ui/select'
import { Badge } from '@/component/ui/badge'
import { Skeleton } from '@/component/ui/skeleton'
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  Copy,
  Eye,
  Search,
  Save,
  X,
  BookOpen,
  Bell,
  MessageSquare,
  Building2,
  Code,
  CheckCircle,
} from 'lucide-react'
import { useToast } from '@/lib/use-toast'
import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'
import DOMPurify from 'isomorphic-dompurify'

export type TemplateType =
  | 'instruction-card'
  | 'notification'
  | 'sms'
  | 'bank-info'
  | 'command'
  | 'system-info'

export interface Template {
  id: string
  name: string
  type: TemplateType
  description?: string
  content: {
    html?: string
    css?: string
    body?: string
    title?: string
    bankName?: string
    companyName?: string
    command?: string
    [key: string]: any
  }
  category?: string
  tags?: string[]
  createdAt: number
  updatedAt: number
}

interface TemplateManagerProps {
  deviceId?: string | null
  onApply?: (template: Template) => void
}

// Pre-built templates
const PRE_BUILT_TEMPLATES: Template[] = [
  // Instruction Card Templates
  {
    id: 'instruction-card-1',
    name: 'Welcome Card',
    type: 'instruction-card',
    description: 'Welcome message for new users',
    content: {
      html: '<div class="welcome-card"><h1>Welcome!</h1><p>Thank you for using our service. Follow these simple steps to get started.</p><ol><li>Complete your profile</li><li>Verify your account</li><li>Start using the app</li></ol></div>',
      css: '.welcome-card { padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 10px; } .welcome-card h1 { margin-bottom: 15px; } .welcome-card ol { margin-left: 20px; }',
    },
    category: 'Welcome',
    tags: ['welcome', 'new-user'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'instruction-card-2',
    name: 'Payment Instructions',
    type: 'instruction-card',
    description: 'Payment processing instructions',
    content: {
      html: '<div class="payment-card"><h2>Payment Instructions</h2><div class="steps"><div class="step"><span class="step-number">1</span><span>Enter payment amount</span></div><div class="step"><span class="step-number">2</span><span>Select payment method</span></div><div class="step"><span class="step-number">3</span><span>Confirm payment</span></div></div></div>',
      css: '.payment-card { padding: 25px; background: #f8f9fa; border: 2px solid #28a745; border-radius: 8px; } .steps { margin-top: 20px; } .step { display: flex; align-items: center; margin-bottom: 15px; } .step-number { background: #28a745; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-weight: bold; }',
    },
    category: 'Payment',
    tags: ['payment', 'instructions'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'instruction-card-3',
    name: 'Error Notification Card',
    type: 'instruction-card',
    description: 'Error message display template',
    content: {
      html: '<div class="error-card"><div class="error-icon">⚠️</div><h3>Oops! Something went wrong</h3><p>We encountered an error. Please try again or contact support if the problem persists.</p><button class="retry-btn">Retry</button></div>',
      css: '.error-card { padding: 30px; background: #fff3cd; border: 2px solid #ffc107; border-radius: 10px; text-align: center; } .error-icon { font-size: 48px; margin-bottom: 15px; } .error-card h3 { color: #856404; margin-bottom: 10px; } .retry-btn { margin-top: 15px; padding: 10px 20px; background: #ffc107; border: none; border-radius: 5px; cursor: pointer; }',
    },
    category: 'Error',
    tags: ['error', 'notification'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  // Notification Templates
  {
    id: 'notification-1',
    name: 'Payment Received',
    type: 'notification',
    description: 'Notification for successful payment',
    content: {
      title: 'Payment Received',
      body: 'Your payment of {amount} has been successfully processed. Transaction ID: {transactionId}',
    },
    category: 'Payment',
    tags: ['payment', 'success'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'notification-2',
    name: 'Account Verification',
    type: 'notification',
    description: 'Account verification notification',
    content: {
      title: 'Verify Your Account',
      body: 'Please verify your account by clicking the link in your email. Verification code: {code}',
    },
    category: 'Verification',
    tags: ['verification', 'account'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  // SMS Templates
  {
    id: 'sms-1',
    name: 'Welcome SMS',
    type: 'sms',
    description: 'Welcome message via SMS',
    content: {
      body: 'Welcome to FastPay! Your account has been created successfully. Your activation code is: {code}',
    },
    category: 'Welcome',
    tags: ['welcome', 'sms'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'sms-2',
    name: 'OTP SMS',
    type: 'sms',
    description: 'OTP verification SMS',
    content: {
      body: 'Your OTP is {otp}. Valid for 5 minutes. Do not share this code with anyone.',
    },
    category: 'Verification',
    tags: ['otp', 'verification'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  // Bank Info Templates
  {
    id: 'bank-info-1',
    name: 'Default Bank Info',
    type: 'bank-info',
    description: 'Default bank information template',
    content: {
      bankName: 'Bank Name',
      companyName: 'Company Name',
      otherInfo: 'Additional information',
    },
    category: 'Bank',
    tags: ['bank', 'default'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  // Command Templates
  {
    id: 'command-1',
    name: 'Fetch SMS Command',
    type: 'command',
    description: 'Command to fetch SMS messages',
    content: {
      command: 'fetchSms',
      value: '50',
    },
    category: 'Command',
    tags: ['sms', 'fetch'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'command-2',
    name: 'Request All Permissions',
    type: 'command',
    description: 'Command to request all permissions',
    content: {
      command: 'requestPermission',
      value: 'ALL',
    },
    category: 'Command',
    tags: ['permission', 'request'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
]

const TEMPLATES_PATH = 'fastpay/templates'

export default function TemplateManager({ deviceId, onApply }: TemplateManagerProps) {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<Template[]>([])
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<TemplateType | 'all'>('all')
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [formData, setFormData] = useState<Partial<Template>>({
    name: '',
    type: 'instruction-card',
    description: '',
    content: {},
    category: '',
    tags: [],
  })

  // Load templates from Firebase
  useEffect(() => {
    const templatesRef = ref(database, TEMPLATES_PATH)

    onValue(templatesRef, snapshot => {
      if (snapshot.exists()) {
        const templatesData = snapshot.val()
        const loadedTemplates: Template[] = Object.entries(templatesData).map(
          ([id, data]: [string, any]) => ({
            id,
            ...data,
          })
        )
        // Merge with pre-built templates
        const allTemplates = [...PRE_BUILT_TEMPLATES, ...loadedTemplates]
        setTemplates(allTemplates)
        setFilteredTemplates(allTemplates)
      } else {
        // Use only pre-built templates if no custom templates exist
        setTemplates(PRE_BUILT_TEMPLATES)
        setFilteredTemplates(PRE_BUILT_TEMPLATES)
      }
      setLoading(false)
    })

    return () => {
      off(templatesRef)
    }
  }, [])

  // Filter templates
  useEffect(() => {
    let filtered = templates

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(t => t.type === filterType)
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        t =>
          t.name.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query) ||
          t.category?.toLowerCase().includes(query) ||
          t.tags?.some(tag => tag.toLowerCase().includes(query))
      )
    }

    setFilteredTemplates(filtered)
  }, [templates, filterType, searchQuery])

  // Handle create template
  const handleCreate = async () => {
    if (!formData.name || !formData.type) {
      toast({
        title: 'Validation Error',
        description: 'Name and type are required',
        variant: 'destructive',
      })
      return
    }

    try {
      const newTemplate: Template = {
        id: `template-${Date.now()}`,
        name: formData.name!,
        type: formData.type as TemplateType,
        description: formData.description || '',
        content: formData.content || {},
        category: formData.category || '',
        tags: formData.tags || [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const templateRef = ref(database, `${TEMPLATES_PATH}/${newTemplate.id}`)
      await set(templateRef, newTemplate)

      toast({
        title: 'Template Created',
        description: `Template "${newTemplate.name}" has been created successfully`,
      })

      setIsCreateOpen(false)
      resetForm()
    } catch (error) {
      console.error('Error creating template:', error)
      toast({
        title: 'Error',
        description: 'Failed to create template',
        variant: 'destructive',
      })
    }
  }

  // Handle edit template
  const handleEdit = async () => {
    if (!editingTemplate || !formData.name || !formData.type) {
      toast({
        title: 'Validation Error',
        description: 'Name and type are required',
        variant: 'destructive',
      })
      return
    }

    try {
      const updatedTemplate: Template = {
        ...editingTemplate,
        name: formData.name!,
        type: formData.type as TemplateType,
        description: formData.description || '',
        content: formData.content || {},
        category: formData.category || '',
        tags: formData.tags || [],
        updatedAt: Date.now(),
      }

      // Only update custom templates, not pre-built ones
      if (!PRE_BUILT_TEMPLATES.find(t => t.id === editingTemplate.id)) {
        const templateRef = ref(database, `${TEMPLATES_PATH}/${editingTemplate.id}`)
        await set(templateRef, updatedTemplate)
      }

      toast({
        title: 'Template Updated',
        description: `Template "${updatedTemplate.name}" has been updated`,
      })

      setIsEditOpen(false)
      setEditingTemplate(null)
      resetForm()
    } catch (error) {
      console.error('Error updating template:', error)
      toast({
        title: 'Error',
        description: 'Failed to update template',
        variant: 'destructive',
      })
    }
  }

  // Handle delete template
  const handleDelete = async (template: Template) => {
    if (PRE_BUILT_TEMPLATES.find(t => t.id === template.id)) {
      toast({
        title: 'Cannot Delete',
        description: 'Pre-built templates cannot be deleted',
        variant: 'destructive',
      })
      return
    }

    try {
      const templateRef = ref(database, `${TEMPLATES_PATH}/${template.id}`)
      await remove(templateRef)

      toast({
        title: 'Template Deleted',
        description: `Template "${template.name}" has been deleted`,
      })
    } catch (error) {
      console.error('Error deleting template:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete template',
        variant: 'destructive',
      })
    }
  }

  // Handle apply template
  const handleApply = (template: Template) => {
    if (onApply) {
      onApply(template)
      toast({
        title: 'Template Applied',
        description: `Template "${template.name}" has been applied`,
      })
    }
  }

  // Handle duplicate template
  const handleDuplicate = (template: Template) => {
    setFormData({
      name: `${template.name} (Copy)`,
      type: template.type,
      description: template.description,
      content: { ...template.content },
      category: template.category,
      tags: [...(template.tags || [])],
    })
    setIsCreateOpen(true)
  }

  // Handle preview
  const handlePreview = (template: Template) => {
    setSelectedTemplate(template)
    setIsPreviewOpen(true)
  }

  // Handle edit click
  const handleEditClick = (template: Template) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      type: template.type,
      description: template.description,
      content: { ...template.content },
      category: template.category,
      tags: [...(template.tags || [])],
    })
    setIsEditOpen(true)
  }

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      type: 'instruction-card',
      description: '',
      content: {},
      category: '',
      tags: [],
    })
  }

  // Get template type icon
  const getTypeIcon = (type: TemplateType) => {
    switch (type) {
      case 'instruction-card':
        return <BookOpen className="h-4 w-4" />
      case 'notification':
        return <Bell className="h-4 w-4" />
      case 'sms':
        return <MessageSquare className="h-4 w-4" />
      case 'bank-info':
        return <Building2 className="h-4 w-4" />
      case 'command':
        return <Code className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  // Render template preview
  const renderPreview = (template: Template) => {
    if (template.type === 'instruction-card') {
      const sanitizedHtml = template.content.html ? DOMPurify.sanitize(template.content.html) : ''
      const css = template.content.css || ''
      return (
        <div className="space-y-4">
          <style dangerouslySetInnerHTML={{ __html: css }} />
          <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
        </div>
      )
    }

    if (template.type === 'notification') {
      return (
        <div className="p-4 border rounded-lg">
          <h3 className="font-semibold mb-2">{template.content.title}</h3>
          <p className="text-sm text-muted-foreground">{template.content.body}</p>
        </div>
      )
    }

    if (template.type === 'sms') {
      return (
        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="text-sm">{template.content.body}</p>
        </div>
      )
    }

    if (template.type === 'bank-info') {
      return (
        <div className="space-y-2">
          <div>
            <strong>Bank Name:</strong> {template.content.bankName}
          </div>
          <div>
            <strong>Company Name:</strong> {template.content.companyName}
          </div>
          <div>
            <strong>Other Info:</strong> {template.content.otherInfo}
          </div>
        </div>
      )
    }

    if (template.type === 'command') {
      return (
        <div className="p-4 bg-gray-100 rounded-lg font-mono text-sm">
          <div>
            <strong>Command:</strong> {template.content.command}
          </div>
          <div>
            <strong>Value:</strong> {template.content.value}
          </div>
        </div>
      )
    }

    return <div>Preview not available</div>
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Template Manager
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create, manage, and apply templates for easy use
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm()
            setIsCreateOpen(true)
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={filterType}
          onValueChange={value => setFilterType(value as TemplateType | 'all')}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="instruction-card">Instruction Cards</SelectItem>
            <SelectItem value="notification">Notifications</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="bank-info">Bank Info</SelectItem>
            <SelectItem value="command">Commands</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">No templates found</p>
          <p className="text-sm mt-2">Create a new template to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map(template => (
            <Card key={template.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    {getTypeIcon(template.type)}
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{template.name}</CardTitle>
                      {template.description && (
                        <CardDescription className="text-xs mt-1 line-clamp-2">
                          {template.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {template.type.replace('-', ' ')}
                  </Badge>
                  {template.category && (
                    <Badge variant="secondary" className="text-xs">
                      {template.category}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                {template.tags && template.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {template.tags.map((tag, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex items-center gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePreview(template)}
                  className="flex-1"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Preview
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleApply(template)}
                  className="flex-1"
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Apply
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDuplicate(template)}
                  title="Duplicate"
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditClick(template)}
                  title="Edit"
                >
                  <Edit className="h-3 w-3" />
                </Button>
                {!PRE_BUILT_TEMPLATES.find(t => t.id === template.id) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(template)}
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.name}</DialogTitle>
            <DialogDescription>{selectedTemplate?.description}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto p-4 border rounded-lg">
            {selectedTemplate && renderPreview(selectedTemplate)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
              Close
            </Button>
            {selectedTemplate && (
              <Button
                onClick={() => {
                  handleApply(selectedTemplate)
                  setIsPreviewOpen(false)
                }}
              >
                Apply Template
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Template Dialog */}
      {(isCreateOpen || isEditOpen) && (
        <Dialog
          open={isCreateOpen || isEditOpen}
          onOpenChange={open => {
            if (!open) {
              setIsCreateOpen(false)
              setIsEditOpen(false)
              setEditingTemplate(null)
              resetForm()
            }
          }}
        >
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isEditOpen ? 'Edit Template' : 'Create Template'}</DialogTitle>
              <DialogDescription>
                {isEditOpen ? 'Update template details' : 'Create a new template for easy reuse'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="template-name">Template Name *</Label>
                  <Input
                    id="template-name"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter template name"
                  />
                </div>
                <div>
                  <Label htmlFor="template-type">Template Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={value =>
                      setFormData({ ...formData, type: value as TemplateType })
                    }
                  >
                    <SelectTrigger id="template-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instruction-card">Instruction Card</SelectItem>
                      <SelectItem value="notification">Notification</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="bank-info">Bank Info</SelectItem>
                      <SelectItem value="command">Command</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="template-description">Description</Label>
                <Textarea
                  id="template-description"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter template description"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="template-category">Category</Label>
                  <Input
                    id="template-category"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g., Payment, Welcome"
                  />
                </div>
                <div>
                  <Label htmlFor="template-tags">Tags (comma separated)</Label>
                  <Input
                    id="template-tags"
                    value={formData.tags?.join(', ') || ''}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        tags: e.target.value
                          .split(',')
                          .map(t => t.trim())
                          .filter(t => t),
                      })
                    }
                    placeholder="e.g., welcome, payment, notification"
                  />
                </div>
              </div>

              {/* Template Type Specific Content */}
              {formData.type === 'instruction-card' && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="template-html">HTML Content</Label>
                    <ReactQuill
                      theme="snow"
                      value={formData.content?.html || ''}
                      onChange={value =>
                        setFormData({
                          ...formData,
                          content: { ...formData.content, html: value },
                        })
                      }
                      placeholder="Enter HTML content..."
                      className="min-h-[200px]"
                    />
                  </div>
                  <div>
                    <Label htmlFor="template-css">CSS Styles</Label>
                    <Textarea
                      id="template-css"
                      value={formData.content?.css || ''}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          content: { ...formData.content, css: e.target.value },
                        })
                      }
                      placeholder="Enter CSS styles..."
                      className="min-h-[150px] font-mono text-sm"
                    />
                  </div>
                </div>
              )}

              {formData.type === 'notification' && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="notification-title">Title</Label>
                    <Input
                      id="notification-title"
                      value={formData.content?.title || ''}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          content: { ...formData.content, title: e.target.value },
                        })
                      }
                      placeholder="Enter notification title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="notification-body">Body</Label>
                    <Textarea
                      id="notification-body"
                      value={formData.content?.body || ''}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          content: { ...formData.content, body: e.target.value },
                        })
                      }
                      placeholder="Enter notification body (use {variable} for placeholders)"
                      rows={4}
                    />
                  </div>
                </div>
              )}

              {formData.type === 'sms' && (
                <div>
                  <Label htmlFor="sms-body">SMS Body</Label>
                  <Textarea
                    id="sms-body"
                    value={formData.content?.body || ''}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        content: { ...formData.content, body: e.target.value },
                      })
                    }
                    placeholder="Enter SMS message (use {variable} for placeholders)"
                    rows={4}
                  />
                </div>
              )}

              {formData.type === 'bank-info' && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="bank-name">Bank Name</Label>
                    <Input
                      id="bank-name"
                      value={formData.content?.bankName || ''}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          content: { ...formData.content, bankName: e.target.value },
                        })
                      }
                      placeholder="Enter bank name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="company-name">Company Name</Label>
                    <Input
                      id="company-name"
                      value={formData.content?.companyName || ''}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          content: { ...formData.content, companyName: e.target.value },
                        })
                      }
                      placeholder="Enter company name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="other-info">Other Info</Label>
                    <Textarea
                      id="other-info"
                      value={formData.content?.otherInfo || ''}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          content: { ...formData.content, otherInfo: e.target.value },
                        })
                      }
                      placeholder="Enter additional information"
                      rows={3}
                    />
                  </div>
                </div>
              )}

              {formData.type === 'command' && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="command-name">Command</Label>
                    <Input
                      id="command-name"
                      value={formData.content?.command || ''}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          content: { ...formData.content, command: e.target.value },
                        })
                      }
                      placeholder="e.g., fetchSms, requestPermission"
                    />
                  </div>
                  <div>
                    <Label htmlFor="command-value">Value</Label>
                    <Input
                      id="command-value"
                      value={formData.content?.value || ''}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          content: { ...formData.content, value: e.target.value },
                        })
                      }
                      placeholder="Command value/parameters"
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateOpen(false)
                  setIsEditOpen(false)
                  setEditingTemplate(null)
                  resetForm()
                }}
              >
                Cancel
              </Button>
              <Button onClick={isEditOpen ? handleEdit : handleCreate}>
                <Save className="h-4 w-4 mr-2" />
                {isEditOpen ? 'Update' : 'Create'} Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
