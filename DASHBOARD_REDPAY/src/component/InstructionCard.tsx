import { useEffect, useState } from 'react'
import { onValue, off, get } from 'firebase/database'
import { getDeviceInstructionCardPath } from '@/lib/firebase-helpers'

type InstructionCardType = {
  html: string
  css: string
  imageUrl?: string | null
}
import { Button } from '@/component/ui/button'
import { Skeleton } from '@/component/ui/skeleton'
import { BookOpen, RefreshCw, Eye, EyeOff, AlertCircle, Edit, Save, X } from 'lucide-react'
import { useToast } from '@/lib/use-toast'
import { retryWithBackoff, isRetryableError } from '@/lib/retry-utils'
import { set } from 'firebase/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/component/ui/card'
import { Label } from '@/component/ui/label'
import { Textarea } from '@/component/ui/textarea'
import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'
import DOMPurify from 'isomorphic-dompurify'

interface InstructionCardProps {
  deviceId: string | null
}

export default function InstructionCard({ deviceId }: InstructionCardProps) {
  const { toast } = useToast()
  const [instructionCard, setInstructionCard] = useState<InstructionCardType | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<{ html: string; css: string; imageUrl: string }>({ html: '', css: '', imageUrl: '' })
  const [saving, setSaving] = useState(false)

  // Fetch instruction card from Firebase
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

    // Fast initial load
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
        toast({
          title: 'Error loading instruction card',
          description: errorMessage,
          variant: 'destructive',
        })
      }
    }

    // Set up real-time listener
    const setupRealtimeListener = () => {
      unsubscribe = onValue(
        instructionRef,
        snapshot => {
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
            const errorMessage =
              err instanceof Error ? err.message : 'Failed to process instruction card'
            setError(errorMessage)
          }
        },
        error => {
          if (!isMounted) return
          console.error('Error listening to instruction card:', error)
          const errorMessage = error.message || 'Failed to fetch instruction card'
          setError(errorMessage)
          toast({
            title: 'Connection error',
            description: errorMessage,
            variant: 'destructive',
          })
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
        off(instructionRef)
      }
    }
  }, [deviceId, isEditing, toast])

  // Sanitize HTML
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
        ],
        ALLOWED_ATTR: ['class', 'style', 'href', 'src', 'alt', 'width', 'height'],
        ALLOW_DATA_ATTR: false,
      })
    } catch (err) {
      console.error('Error sanitizing HTML:', err)
      return html
    }
  }

  // Handle save
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
        variant: 'default',
      })
    } catch (err) {
      console.error('Error saving instruction card:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to save instruction card'
      setSaving(false)
      toast({
        title: 'Error saving instruction card',
        description: errorMessage,
        variant: 'destructive',
      })
    }
  }

  // Handle cancel edit
  const handleCancelEdit = () => {
    if (instructionCard) {
      setEditForm({ html: instructionCard.html || '', css: instructionCard.css || '', imageUrl: instructionCard.imageUrl || '' })
    } else {
      setEditForm({ html: '', css: '', imageUrl: '' })
    }
    setIsEditing(false)
  }

  // Handle refresh
  const handleRefresh = async () => {
    if (!deviceId) return

    try {
      setLoading(true)
      setError(null)

      const instructionRef = getDeviceInstructionCardPath(deviceId)
      const snapshot = await retryWithBackoff(() => get(instructionRef), {
        maxAttempts: 3,
        initialDelay: 300,
        retryable: isRetryableError,
      })

      if (!snapshot.exists()) {
        setInstructionCard(null)
        if (!isEditing) {
          setEditForm({ html: '', css: '', imageUrl: '' })
        }
        setLoading(false)
        return
      }

      const data = snapshot.val() as InstructionCardType
      setInstructionCard(data)
      if (!isEditing) {
        setEditForm({ html: data.html || '', css: data.css || '', imageUrl: data.imageUrl || '' })
      }
      setLoading(false)

      toast({
        title: 'Instruction card refreshed',
        description: 'Instruction card has been updated',
        variant: 'default',
      })
    } catch (err) {
      console.error('Error refreshing instruction card:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh instruction card'
      setError(errorMessage)
      setLoading(false)
      toast({
        title: 'Error refreshing instruction card',
        description: errorMessage,
        variant: 'destructive',
      })
    }
  }

  const sanitizedHtml = instructionCard?.html ? sanitizeHtml(instructionCard.html) : ''
  const css = instructionCard?.css || ''

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Instructions
          </h2>
          <p className="text-sm text-muted-foreground mt-1">View and manage instruction cards</p>
        </div>
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading || !deviceId}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <div>
              <p className="font-semibold">Error loading instruction card</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} className="mt-2">
            Retry
          </Button>
        </div>
      )}

      {/* Loading State */}
      {loading && !instructionCard && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && !instructionCard && (
        <div className="p-8 text-center text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">No instruction card available</p>
          <p className="text-sm mt-2">
            Instruction cards will appear here when set for this device
          </p>
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="mt-4">
            <Edit className="h-4 w-4 mr-2" />
            Create Instruction Card
          </Button>
        </div>
      )}

      {/* Edit Mode */}
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

      {/* Display Mode */}
      {!isEditing && instructionCard && sanitizedHtml && (
        <div className="border-corner-animated-wrapper relative">
          <style
            dangerouslySetInnerHTML={{
              __html: `
            .border-corner-animated-wrapper {
              position: relative;
              padding: 2px;
            }
            .border-corner-animated-wrapper::before,
            .border-corner-animated-wrapper::after {
              content: '';
              position: absolute;
              width: 20px;
              height: 20px;
              border: 2px solid hsl(var(--primary));
              z-index: 1;
              pointer-events: none;
            }
            .border-corner-animated-wrapper::before {
              top: 0;
              left: 0;
              border-right: none;
              border-bottom: none;
              animation: corner-top-left 2s ease-in-out infinite;
            }
            .border-corner-animated-wrapper::after {
              bottom: 0;
              right: 0;
              border-left: none;
              border-top: none;
              animation: corner-bottom-right 2s ease-in-out infinite;
            }
            @keyframes corner-top-left {
              0%, 100% { width: 20px; height: 20px; }
              50% { width: 40px; height: 40px; }
            }
            @keyframes corner-bottom-right {
              0%, 100% { width: 20px; height: 20px; }
              50% { width: 40px; height: 40px; }
            }
          `,
            }}
          />
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
        </div>
      )}
    </div>
  )
}
