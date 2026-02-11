import { useEffect, useState } from 'react'
import { onValue, off, get, set, remove, ref } from 'firebase/database'
import { database } from '@/lib/firebase'
import { getDeviceInstructionCardPath } from '@/lib/firebase-helpers'
import { Button } from '@/component/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/component/ui/card'
import { Label } from '@/component/ui/label'
import { Textarea } from '@/component/ui/textarea'
import { Input } from '@/component/ui/input'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/component/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/component/ui/tabs'
import {
  BookOpen,
  RefreshCw,
  Eye,
  EyeOff,
  AlertCircle,
  Edit,
  Save,
  X,
  FileText,
  Plus,
  Trash2,
  Copy,
  Eye as EyeIcon,
  Search,
  LayoutTemplate,
  Sparkles,
  CheckCircle,
} from 'lucide-react'
import { useToast } from '@/lib/use-toast'
import { retryWithBackoff, isRetryableError } from '@/lib/retry-utils'
import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'
import DOMPurify from 'isomorphic-dompurify'
import type { Template, TemplateType } from './TemplateManager'

type InstructionCardType = {
  html: string
  css: string
  imageUrl?: string | null
}

interface InstructionTemplatePanelProps {
  deviceId: string | null
}

// Modern HTML/CSS Templates with CSS Grid, Flexbox, Gradients, Animations
const MODERN_TEMPLATES: Template[] = [
  {
    id: 'modern-welcome-1',
    name: 'Modern Welcome Card',
    type: 'instruction-card',
    description: 'Gradient welcome card with smooth animations',
    content: {
      html: `
        <div class="modern-welcome">
          <div class="welcome-header">
            <div class="welcome-icon">✨</div>
            <h1>Welcome Aboard!</h1>
          </div>
          <p class="welcome-subtitle">Get started with these simple steps</p>
          <div class="steps-grid">
            <div class="step-card">
              <div class="step-number">1</div>
              <div class="step-content">
                <h3>Complete Profile</h3>
                <p>Fill in your details</p>
              </div>
            </div>
            <div class="step-card">
              <div class="step-number">2</div>
              <div class="step-content">
                <h3>Verify Account</h3>
                <p>Confirm your email</p>
              </div>
            </div>
            <div class="step-card">
              <div class="step-number">3</div>
              <div class="step-content">
                <h3>Start Using</h3>
                <p>You're all set!</p>
              </div>
            </div>
          </div>
        </div>
      `,
      css: `
        .modern-welcome {
          padding: 2rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 1.5rem;
          color: white;
          box-shadow: 0 20px 60px rgba(102, 126, 234, 0.4);
          animation: fadeInUp 0.6s ease-out;
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .welcome-header {
          text-align: center;
          margin-bottom: 2rem;
        }
        .welcome-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        .modern-welcome h1 {
          font-size: 2.5rem;
          font-weight: 700;
          margin: 0;
          text-shadow: 0 2px 10px rgba(0,0,0,0.2);
        }
        .welcome-subtitle {
          text-align: center;
          font-size: 1.1rem;
          opacity: 0.9;
          margin-bottom: 2rem;
        }
        .steps-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
          margin-top: 2rem;
        }
        .step-card {
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(10px);
          border-radius: 1rem;
          padding: 1.5rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .step-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .step-number {
          width: 3rem;
          height: 3rem;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          font-weight: bold;
          flex-shrink: 0;
        }
        .step-content h3 {
          margin: 0 0 0.5rem 0;
          font-size: 1.1rem;
        }
        .step-content p {
          margin: 0;
          opacity: 0.8;
          font-size: 0.9rem;
        }
      `,
    },
    category: 'Welcome',
    tags: ['welcome', 'modern', 'gradient'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'modern-payment-1',
    name: 'Modern Payment Card',
    type: 'instruction-card',
    description: 'Glassmorphism payment card with modern design',
    content: {
      html: `
        <div class="payment-modern">
          <div class="payment-header">
            <h2>💳 Payment Instructions</h2>
            <div class="payment-badge">Secure</div>
          </div>
          <div class="payment-steps">
            <div class="payment-step">
              <div class="step-indicator active"></div>
              <div class="step-details">
                <h3>Enter Amount</h3>
                <p>Specify the payment amount</p>
              </div>
            </div>
            <div class="payment-step">
              <div class="step-indicator"></div>
              <div class="step-details">
                <h3>Select Method</h3>
                <p>Choose your payment method</p>
              </div>
            </div>
            <div class="payment-step">
              <div class="step-indicator"></div>
              <div class="step-details">
                <h3>Confirm</h3>
                <p>Review and confirm payment</p>
              </div>
            </div>
          </div>
        </div>
      `,
      css: `
        .payment-modern {
          padding: 2rem;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          border-radius: 1.5rem;
          box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }
        .payment-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }
        .payment-header h2 {
          margin: 0;
          font-size: 2rem;
          color: #2d3748;
        }
        .payment-badge {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 2rem;
          font-size: 0.875rem;
          font-weight: 600;
        }
        .payment-steps {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .payment-step {
          display: flex;
          align-items: flex-start;
          gap: 1.5rem;
          background: white;
          padding: 1.5rem;
          border-radius: 1rem;
          box-shadow: 0 4px 15px rgba(0,0,0,0.08);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .payment-step:hover {
          transform: translateX(10px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.12);
        }
        .step-indicator {
          width: 1rem;
          height: 1rem;
          border-radius: 50%;
          background: #e2e8f0;
          border: 3px solid white;
          box-shadow: 0 0 0 3px #e2e8f0;
          flex-shrink: 0;
          margin-top: 0.25rem;
        }
        .step-indicator.active {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3);
          animation: pulse-ring 2s infinite;
        }
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3); }
          50% { box-shadow: 0 0 0 8px rgba(102, 126, 234, 0.1); }
          100% { box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3); }
        }
        .step-details h3 {
          margin: 0 0 0.5rem 0;
          color: #2d3748;
          font-size: 1.25rem;
        }
        .step-details p {
          margin: 0;
          color: #718096;
          font-size: 0.95rem;
        }
      `,
    },
    category: 'Payment',
    tags: ['payment', 'modern', 'glassmorphism'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'modern-success-1',
    name: 'Success Card',
    type: 'instruction-card',
    description: 'Animated success card with modern design',
    content: {
      html: `
        <div class="success-modern">
          <div class="success-icon">✓</div>
          <h2>Success!</h2>
          <p>Your action has been completed successfully.</p>
          <div class="success-actions">
            <button class="btn-primary">Continue</button>
            <button class="btn-secondary">View Details</button>
          </div>
        </div>
      `,
      css: `
        .success-modern {
          padding: 3rem 2rem;
          background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
          border-radius: 1.5rem;
          text-align: center;
          color: white;
          box-shadow: 0 20px 60px rgba(17, 153, 142, 0.3);
        }
        .success-icon {
          width: 5rem;
          height: 5rem;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 3rem;
          margin: 0 auto 1.5rem;
          animation: scaleIn 0.5s ease-out;
        }
        @keyframes scaleIn {
          from {
            transform: scale(0);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .success-modern h2 {
          font-size: 2rem;
          margin: 0 0 1rem 0;
        }
        .success-modern p {
          font-size: 1.1rem;
          opacity: 0.9;
          margin-bottom: 2rem;
        }
        .success-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
        }
        .btn-primary, .btn-secondary {
          padding: 0.75rem 2rem;
          border: none;
          border-radius: 0.5rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .btn-primary {
          background: white;
          color: #11998e;
        }
        .btn-secondary {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: 2px solid white;
        }
        .btn-primary:hover, .btn-secondary:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
      `,
    },
    category: 'Success',
    tags: ['success', 'modern', 'animated'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'modern-info-1',
    name: 'Info Card',
    type: 'instruction-card',
    description: 'Modern information card with grid layout',
    content: {
      html: `
        <div class="info-modern">
          <div class="info-header">
            <h2>📋 Important Information</h2>
          </div>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-icon">🔒</div>
              <h3>Secure</h3>
              <p>Your data is encrypted</p>
            </div>
            <div class="info-item">
              <div class="info-icon">⚡</div>
              <h3>Fast</h3>
              <p>Lightning quick processing</p>
            </div>
            <div class="info-item">
              <div class="info-icon">🌐</div>
              <h3>Global</h3>
              <p>Available worldwide</p>
            </div>
            <div class="info-item">
              <div class="info-icon">💬</div>
              <h3>Support</h3>
              <p>24/7 customer service</p>
            </div>
          </div>
        </div>
      `,
      css: `
        .info-modern {
          padding: 2rem;
          background: white;
          border-radius: 1.5rem;
          box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }
        .info-header {
          margin-bottom: 2rem;
        }
        .info-header h2 {
          margin: 0;
          font-size: 2rem;
          color: #2d3748;
        }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
        }
        .info-item {
          text-align: center;
          padding: 1.5rem;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          border-radius: 1rem;
          transition: transform 0.3s ease;
        }
        .info-item:hover {
          transform: translateY(-5px);
        }
        .info-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }
        .info-item h3 {
          margin: 0 0 0.5rem 0;
          color: #2d3748;
          font-size: 1.25rem;
        }
        .info-item p {
          margin: 0;
          color: #718096;
          font-size: 0.95rem;
        }
      `,
    },
    category: 'Info',
    tags: ['info', 'modern', 'grid'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
]

const TEMPLATES_PATH = 'fastpay/templates'

export default function InstructionTemplatePanel({ deviceId }: InstructionTemplatePanelProps) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<'instruction' | 'templates'>('instruction')

  // Instruction Card State
  const [instructionCard, setInstructionCard] = useState<InstructionCardType | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<{ html: string; css: string; imageUrl?: string }>({ html: '', css: '', imageUrl: '' })
  const [saving, setSaving] = useState(false)

  // Template State
  const [templates, setTemplates] = useState<Template[]>([])
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<TemplateType | 'all'>('all')
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  // Fetch instruction card
  useEffect(() => {
    if (!deviceId) {
      setInstructionCard(null)
      setLoading(false)
      setError(null)
      return
    }

    let isMounted = true
    let unsubscribe: (() => void) | null = null

    const instructionRef = getDeviceInstructionCardPath(deviceId)

    const loadInitialData = async () => {
      try {
        setLoading(true)
        setError(null)

        const snapshot = await retryWithBackoff(() => get(instructionRef), {
          maxAttempts: 3,
          initialDelay: 300,
          retryable: isRetryableError,
        })

        if (!isMounted) return

        if (!snapshot.exists()) {
          setInstructionCard(null)
          setEditForm({ html: '', css: '', imageUrl: '' })
          setLoading(false)
          return
        }

        const data = snapshot.val() as InstructionCardType
        setInstructionCard(data)
        setEditForm({ html: data.html || '', css: data.css || '', imageUrl: data.imageUrl || '' })
        setLoading(false)
      } catch (err) {
        if (!isMounted) return
        console.error('Error loading instruction card:', err)
        const errorMessage = err instanceof Error ? err.message : 'Failed to load instruction card'
        setError(errorMessage)
        setLoading(false)
      }
    }

    const setupRealtimeListener = () => {
      unsubscribe = onValue(instructionRef, snapshot => {
        if (!isMounted) return
        try {
          if (snapshot.exists()) {
            const data = snapshot.val() as InstructionCardType
            setInstructionCard(data)
            if (!isEditing) {
              setEditForm({ html: data.html || '', css: data.css || '', imageUrl: data.imageUrl || '' })
            }
            setError(null)
          } else {
            setInstructionCard(null)
            if (!isEditing) {
              setEditForm({ html: '', css: '', imageUrl: '' })
            }
          }
        } catch (err) {
          console.error('Error processing instruction card:', err)
        }
      })
    }

    loadInitialData()
    const listenerTimeout = setTimeout(setupRealtimeListener, 100)

    return () => {
      isMounted = false
      clearTimeout(listenerTimeout)
      if (unsubscribe) {
        unsubscribe()
      } else {
        off(instructionRef)
      }
    }
  }, [deviceId, isEditing])

  // Load templates
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
        const allTemplates = [...MODERN_TEMPLATES, ...loadedTemplates]
        setTemplates(allTemplates)
        setFilteredTemplates(allTemplates)
      } else {
        setTemplates(MODERN_TEMPLATES)
        setFilteredTemplates(MODERN_TEMPLATES)
      }
    })

    return () => {
      off(templatesRef)
    }
  }, [])

  // Filter templates
  useEffect(() => {
    let filtered = templates

    if (filterType !== 'all') {
      filtered = filtered.filter(t => t.type === filterType)
    }

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

  // Instruction Card Functions
  const sanitizeHtml = (html: string): string => {
    try {
      return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
          'p',
          'div',
          'span',
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
          'ul',
          'ol',
          'li',
          'a',
          'strong',
          'em',
          'br',
          'img',
          'table',
          'tr',
          'td',
          'th',
          'thead',
          'tbody',
          'button',
        ],
        ALLOWED_ATTR: ['class', 'style', 'href', 'src', 'alt', 'width', 'height'],
        ALLOW_DATA_ATTR: false,
      })
    } catch (err) {
      console.error('Error sanitizing HTML:', err)
      return html
    }
  }

  const handleSave = async () => {
    if (!deviceId) return

    try {
      setSaving(true)
      const instructionRef = getDeviceInstructionCardPath(deviceId)
      const cardData: InstructionCardType = {
        html: editForm.html || '',
        css: editForm.css || '',
        imageUrl: editForm.imageUrl?.trim() || null,
      }
      // Remove imageUrl if empty
      if (!cardData.imageUrl) {
        delete cardData.imageUrl
      }
      await set(instructionRef, cardData)

      setIsEditing(false)
      setSaving(false)
      toast({
        title: 'Instruction card saved',
        description: 'Instruction card has been updated successfully',
      })
    } catch (err) {
      console.error('Error saving instruction card:', err)
      setSaving(false)
      toast({
        title: 'Error saving instruction card',
        description: err instanceof Error ? err.message : 'Failed to save instruction card',
        variant: 'destructive',
      })
    }
  }

  const handleCancelEdit = () => {
    if (instructionCard) {
      setEditForm({ html: instructionCard.html || '', css: instructionCard.css || '', imageUrl: instructionCard.imageUrl || '' })
    } else {
      setEditForm({ html: '', css: '', imageUrl: '' })
    }
    setIsEditing(false)
  }

  // Template Functions
  const handleApplyTemplate = async (template: Template) => {
    if (!deviceId || template.type !== 'instruction-card') return

    try {
      const instructionRef = getDeviceInstructionCardPath(deviceId)
      const cardData: InstructionCardType = {
        html: template.content.html || '',
        css: template.content.css || '',
        // Templates don't have imageUrl, so we keep existing one or set to null
        imageUrl: instructionCard?.imageUrl || null,
      }
      // Remove imageUrl if empty
      if (!cardData.imageUrl) {
        delete cardData.imageUrl
      }
      await set(instructionRef, cardData)

      toast({
        title: 'Template Applied',
        description: `Template "${template.name}" has been applied`,
      })

      setActiveTab('instruction')
    } catch (error) {
      console.error('Error applying template:', error)
      toast({
        title: 'Error',
        description: 'Failed to apply template',
        variant: 'destructive',
      })
    }
  }

  const handlePreview = (template: Template) => {
    setSelectedTemplate(template)
    setIsPreviewOpen(true)
  }

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
    return <div>Preview not available</div>
  }

  const sanitizedHtml = instructionCard?.html ? sanitizeHtml(instructionCard.html) : ''
  const css = instructionCard?.css || ''

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <LayoutTemplate className="h-6 w-6" />
            Instructions & Templates
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage instruction cards and apply modern templates
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'instruction' | 'templates')}>
        <TabsList>
          <TabsTrigger value="instruction">
            <BookOpen className="h-4 w-4 mr-2" />
            Instruction Card
          </TabsTrigger>
          <TabsTrigger value="templates">
            <Sparkles className="h-4 w-4 mr-2" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="instruction" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsVisible(!isVisible)}
                disabled={!instructionCard || !instructionCard.html}
              >
                {isVisible ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-2" />
                    Hide
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Show
                  </>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                {instructionCard ? 'Edit' : 'Create'}
              </Button>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                <div>
                  <p className="font-semibold">Error loading instruction card</p>
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}

          {loading && !instructionCard && (
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          )}

          {!loading && !error && !instructionCard && !isEditing && (
            <div className="p-8 text-center text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No instruction card available</p>
              <p className="text-sm mt-2">Create one or apply a template</p>
            </div>
          )}

          {isEditing && (
            <Card>
              <CardHeader>
                <CardTitle>Edit Instruction Card</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="html_content">HTML Content</Label>
                  <ReactQuill
                    theme="snow"
                    value={editForm.html}
                    onChange={value => setEditForm({ ...editForm, html: value })}
                    placeholder="Enter HTML content..."
                    className="min-h-[200px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="css_content">CSS Styles</Label>
                  <Textarea
                    id="css_content"
                    value={editForm.css}
                    onChange={e => setEditForm({ ...editForm, css: e.target.value })}
                    placeholder="Enter CSS styles..."
                    className="min-h-[150px] font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="image_url">Image URL (Optional)</Label>
                  <Textarea
                    id="image_url"
                    value={editForm.imageUrl}
                    onChange={e => setEditForm({ ...editForm, imageUrl: e.target.value })}
                    placeholder="Enter image URL (e.g., https://example.com/image.jpg)..."
                    className="min-h-[60px] font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional: URL for an image to display with the instruction card
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleCancelEdit} disabled={saving}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!isEditing && instructionCard && sanitizedHtml && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Instruction Card</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isVisible ? (
                  <div className="space-y-4">
                    {instructionCard.imageUrl && (
                      <div className="mb-4">
                        <img
                          src={instructionCard.imageUrl}
                          alt="Instruction card image"
                          className="w-full h-auto rounded-lg border"
                          onError={(e) => {
                            console.error('Error loading instruction card image:', instructionCard.imageUrl)
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      </div>
                    )}
                    <style dangerouslySetInnerHTML={{ __html: css }} />
                    <div
                      className="prose max-w-none"
                      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                    />
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    <EyeOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">Instruction card is hidden</p>
                    <p className="text-sm mt-2">Click "Show" to view the instruction card</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
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
              </SelectContent>
            </Select>
          </div>

          {filteredTemplates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No templates found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map(template => (
                <Card key={template.id} className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    {template.description && (
                      <CardDescription className="text-xs mt-1 line-clamp-2">
                        {template.description}
                      </CardDescription>
                    )}
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
                  <CardContent className="flex-1" />
                  <div className="p-4 flex items-center gap-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePreview(template)}
                      className="flex-1"
                    >
                      <EyeIcon className="h-3 w-3 mr-1" />
                      Preview
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleApplyTemplate(template)}
                      className="flex-1"
                      disabled={!deviceId}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Apply
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

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
            {selectedTemplate && deviceId && (
              <Button
                onClick={() => {
                  handleApplyTemplate(selectedTemplate)
                  setIsPreviewOpen(false)
                }}
              >
                Apply Template
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
