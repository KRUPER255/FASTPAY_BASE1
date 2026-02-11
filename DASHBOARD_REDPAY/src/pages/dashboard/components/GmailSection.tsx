import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/component/ui/card'
import { Button } from '@/component/ui/button'
import { Input } from '@/component/ui/input'
import { Badge } from '@/component/ui/badge'
import { Skeleton } from '@/component/ui/skeleton'
import { useToast } from '@/lib/use-toast'
import { ToastAction } from '@/component/ui/toast'
import { Copy } from 'lucide-react'
import {
  Mail,
  Loader,
  RefreshCw,
  Search,
  LogOut,
  LogIn,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Calendar,
  User,
  FileText,
} from 'lucide-react'
import { getSession } from '@/lib/auth'
import {
  initGmailAuth,
  checkGmailStatus,
  fetchGmailMessages,
  fetchGmailMessageDetail,
  type GmailMessageDetail,
  disconnectGmail,
  type GmailStatus,
} from '@/lib/backend-gmail-api'

function extractPlainText(payload: any): string {
  if (!payload) return ''
  if (payload.body?.data) {
    return decodeEmailBody(payload.body.data)
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeEmailBody(part.body.data)
      }
      if (part.parts) {
        for (const nestedPart of part.parts) {
          if (nestedPart.mimeType === 'text/plain' && nestedPart.body?.data) {
            return decodeEmailBody(nestedPart.body.data)
          }
        }
      }
    }
  }
  return ''
}

function decodeEmailBody(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  try {
    return decodeURIComponent(
      atob(base64 + padding)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
  } catch (e) {
    return ''
  }
}
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/component/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/component/ui/select'

interface GmailSectionProps {
  deviceId: string | null
  isAdmin: boolean
}

interface EmailListItem {
  id: string
  threadId: string
  subject: string
  from: string
  snippet: string
  date: string
  labels?: string[]
}

const formatEmailDate = (value?: string) => {
  if (!value) return ''
  const numeric = Number(value)
  const date = Number.isFinite(numeric) ? new Date(numeric) : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US')
}

export function GmailSection({ deviceId, isAdmin }: GmailSectionProps) {
  const { toast } = useToast()
  const session = getSession()
  const userEmail = session?.email || null
  
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [emails, setEmails] = useState<EmailListItem[]>([])
  const [selectedEmail, setSelectedEmail] = useState<EmailListItem | null>(null)
  const [selectedEmailDetail, setSelectedEmailDetail] = useState<GmailMessageDetail | null>(null)
  const [loadingEmail, setLoadingEmail] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [maxResults, setMaxResults] = useState(25)
  const [pageToken, setPageToken] = useState<string | undefined>()
  const [nextPageToken, setNextPageToken] = useState<string | undefined>()
  const [previousPageTokens, setPreviousPageTokens] = useState<string[]>([])
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([])

  const isAuthenticated = gmailStatus?.connected ?? false

  // Check authentication status on mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      if (!userEmail) {
        setCheckingAuth(false)
        return
      }

      setCheckingAuth(true)
      try {
        const status = await checkGmailStatus(userEmail)
        setGmailStatus(status)
      } catch (error) {
        console.error('Failed to check Gmail status:', error)
        setGmailStatus({ connected: false, gmail_email: null })
      } finally {
        setCheckingAuth(false)
      }
    }

    checkAuthStatus()

    // Check for OAuth callback (if redirected back from Google)
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const state = urlParams.get('state')
    
    if (code && state && userEmail) {
      // Backend handles the callback, just refresh status after a delay
      setTimeout(() => {
        checkAuthStatus()
      }, 2000)
    }
  }, [userEmail])

  // Fetch emails when authenticated
  const loadEmails = useCallback(async (query?: string, page?: string) => {
    if (!isAuthenticated || !userEmail) return

    setLoading(true)
    try {
      const response = await fetchGmailMessages(userEmail, {
        max_results: maxResults,
        page_token: page,
        query: query || searchQuery,
        label_ids: selectedLabelIds,
      })

      const rawMessages = Array.isArray(response.messages) ? response.messages : []
      const emailList: EmailListItem[] = rawMessages.map(msg => ({
        id: msg.id,
        threadId: msg.thread_id ?? '',
        subject: msg.subject || '(No Subject)',
        from: msg.from_email || 'Unknown',
        snippet: msg.snippet || '',
        date: msg.date || msg.internal_date || '',
        labels: Array.isArray(msg.labels) ? msg.labels : [],
      }))

      setEmails(emailList)
      setNextPageToken(response.nextPageToken)
      
      if (page) {
        setPageToken(page)
      }
    } catch (error) {
      console.error('Failed to load emails:', error)
      const rawMessage = error instanceof Error ? error.message : 'Failed to load emails'

      // Try to extract a concise message from nested JSON error text
      let errorMessage = rawMessage
      const jsonStart = rawMessage.indexOf('{')
      if (jsonStart !== -1) {
        try {
          const parsed = JSON.parse(rawMessage.slice(jsonStart))
          if (typeof parsed?.error === 'string') {
            errorMessage = parsed.error
          } else if (typeof parsed?.detail === 'string') {
            errorMessage = parsed.detail
          }
        } catch {
          // ignore JSON parse errors, keep rawMessage
        }
      }

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
      
      // If authentication expired, refresh status
      if (errorMessage.includes('authentication expired')) {
        const status = await checkGmailStatus(userEmail)
        setGmailStatus(status)
      }
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, userEmail, maxResults, searchQuery, selectedLabelIds, toast])

  useEffect(() => {
    if (isAuthenticated) {
      loadEmails()
    }
  }, [isAuthenticated, maxResults])

  const handleAuth = async () => {
    if (!userEmail) {
      toast({
        title: 'Error',
        description: 'Please log in to connect Gmail',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      // REDPAY: pass origin + path so OAuth callback redirects back to this dashboard (not staging)
      const isRedpay = import.meta.env.VITE_REDPAY_ONLY === 'true'
      const options = isRedpay
        ? { dashboard_origin: window.location.origin, dashboard_path: 'dashboard' }
        : undefined
      const { auth_url } = await initGmailAuth(userEmail, 'webpage', options)
      // Redirect to Google OAuth page
      window.location.href = auth_url
    } catch (error) {
      console.error('Gmail authentication failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to start Gmail authentication'
      toast({
        title: 'Authentication Failed',
        description: errorMessage,
        variant: 'destructive',
        action: (
          <ToastAction
            altText="Copy error"
            onClick={async (e) => {
              e.preventDefault()
              e.stopPropagation()
              try {
                // Try modern clipboard API first
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  await navigator.clipboard.writeText(errorMessage)
                } else {
                  // Fallback for older browsers
                  const textArea = document.createElement('textarea')
                  textArea.value = errorMessage
                  textArea.style.position = 'fixed'
                  textArea.style.left = '-999999px'
                  textArea.style.top = '-999999px'
                  document.body.appendChild(textArea)
                  textArea.focus()
                  textArea.select()
                  document.execCommand('copy')
                  textArea.remove()
                }
                toast({
                  title: 'Copied',
                  description: 'Error message copied to clipboard',
                })
              } catch (err) {
                console.error('Failed to copy:', err)
                toast({
                  title: 'Copy Failed',
                  description: 'Could not copy to clipboard. Please copy manually.',
                  variant: 'destructive',
                })
              }
            }}
          >
            <Copy className="h-4 w-4 mr-1" />
            Copy
          </ToastAction>
        ),
      })
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    if (!userEmail) return

    setLoading(true)
    try {
      await disconnectGmail(userEmail)
      setGmailStatus({ connected: false, gmail_email: null })
      setEmails([])
      setSelectedEmail(null)
      toast({
        title: 'Logged Out',
        description: 'Disconnected from Gmail',
      })
    } catch (error) {
      console.error('Failed to disconnect Gmail:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to disconnect Gmail',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setPreviousPageTokens([])
    setPageToken(undefined)
    loadEmails(searchQuery)
  }

  const handleNextPage = () => {
    if (nextPageToken) {
      setPreviousPageTokens(prev => [...prev, pageToken || ''])
      loadEmails(searchQuery, nextPageToken)
    }
  }

  const handlePreviousPage = () => {
    if (previousPageTokens.length > 0) {
      const tokens = [...previousPageTokens]
      const prevToken = tokens.pop()
      setPreviousPageTokens(tokens)
      setPageToken(prevToken)
      loadEmails(searchQuery, prevToken)
    }
  }

  const handleEmailClick = async (emailId: string) => {
    if (!userEmail) return

    const email = emails.find(e => e.id === emailId)
    if (!email) {
      console.warn('Selected email not found for id:', emailId)
      return
    }

    setSelectedEmail(email)
    setSelectedEmailDetail(null)
    setLoadingEmail(true)

    try {
      const detail = await fetchGmailMessageDetail(userEmail, emailId)
      setSelectedEmailDetail(detail)
    } catch (error) {
      console.error('Failed to load email detail:', error)
      const message = error instanceof Error ? error.message : 'Failed to load email details'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setLoadingEmail(false)
    }
  }

  const renderEmailContent = (message: EmailListItem, detail: GmailMessageDetail | null) => {
    const bodyText =
      (detail?.plainText && detail.plainText.trim().length > 0
        ? detail.plainText
        : detail?.html && detail.html.trim().length > 0
        ? detail.html
        : message.snippet) || '(No content)'

    return (
      <div className="space-y-4">
        <div className="border-b pb-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-lg font-semibold">{(detail?.subject || message.subject) || '(No Subject)'}</h3>
            {detail?.labels?.length
              ? <Badge variant="outline">{detail.labels.join(', ')}</Badge>
              : message.labels && message.labels.length > 0 && (
                <Badge variant="outline">{message.labels.join(', ')}</Badge>
              )}
          </div>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span>
                <strong>From:</strong> {detail?.fromEmail || message.from}
              </span>
            </div>
            {detail && (
              <>
                {detail.to && (
                  <div className="flex items-center gap-2">
                    <span><strong>To:</strong> {detail.to}</span>
                  </div>
                )}
                {detail.cc && (
                  <div className="flex items-center gap-2">
                    <span><strong>Cc:</strong> {detail.cc}</span>
                  </div>
                )}
              </>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{detail?.date || message.date}</span>
            </div>
          </div>
        </div>
        <div className="bg-muted p-4 rounded-lg max-h-96 overflow-y-auto">
          <pre className="whitespace-pre-wrap text-sm font-mono">{bodyText}</pre>
        </div>
        {detail?.attachments?.length ? (
          <div className="pt-2 border-t space-y-2">
            <div className="text-sm font-semibold">Attachments</div>
            <div className="flex flex-wrap gap-2">
              {detail.attachments.map(att => (
                <Badge key={att.attachmentId || att.filename} variant="outline">
                  {att.filename || 'attachment'}{att.size ? ` (${Math.round(att.size / 1024)} KB)` : ''}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  // Show loading while checking auth status
  if (checkingAuth) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center">
              <Loader className="h-6 w-6 animate-spin mr-2" />
              <span>Checking Gmail connection...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show error if no user email
  if (!userEmail) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Gmail Integration
            </CardTitle>
            <CardDescription>
              Please log in to connect your Gmail account
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // Show connect screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Gmail Integration
            </CardTitle>
            <CardDescription>
              Connect your Gmail account to view and manage emails
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 space-y-4">
              <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                <Mail className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Connect to Gmail</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Sign in with your Google account to access your Gmail inbox
                </p>
                {gmailStatus?.gmail_email && (
                  <p className="text-xs text-muted-foreground mb-2">
                    Account: {gmailStatus.gmail_email}
                  </p>
                )}
              </div>
              <Button onClick={handleAuth} disabled={loading} size="lg">
                {loading ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    Connect Gmail
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="border-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Gmail Inbox
              </CardTitle>
              <CardDescription>
                {gmailStatus?.gmail_email && (
                  <span className="mr-2">Connected: {gmailStatus.gmail_email}</span>
                )}
                {emails.length} {emails.length === 1 ? 'email' : 'emails'} loaded
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => loadEmails()} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search and Filters - prominent full-width bar with depth */}
          <div className="gmail-search-bar flex flex-wrap gap-2 mb-4 p-3 rounded-xl bg-muted/20 border border-border/50 shadow-sm">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search emails (e.g., from:example@gmail.com, subject:meeting)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-9 h-10 text-sm"
              />
            </div>
            <Button onClick={handleSearch} disabled={loading} className="h-10">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
            <Select value={String(maxResults)} onValueChange={(v) => setMaxResults(Number(v))}>
              <SelectTrigger className="w-32 h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 emails</SelectItem>
                <SelectItem value="25">25 emails</SelectItem>
                <SelectItem value="50">50 emails</SelectItem>
                <SelectItem value="100">100 emails</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Email List */}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : emails.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No emails found</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 max-h-96 overflow-y-auto rounded-xl border border-border/50 p-2 shadow-sm bg-card/50">
                {emails.map((email, index) => {
                  const isEven = index % 2 === 0
                  return (
                  <div
                    key={email.id}
                    onClick={() => handleEmailClick(email.id)}
                    className={`p-3 rounded-xl border border-border/30 hover:bg-muted/30 cursor-pointer transition-colors shadow-sm hover:shadow-md ${isEven ? 'bg-muted/5' : 'bg-muted/15'}`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{email.from}</div>
                        <div className="text-sm font-medium truncate">{email.subject || '(No Subject)'}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {email.snippet}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
                        {formatEmailDate(email.date)}
                      </div>
                    </div>
                  </div>
                  )
                })}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <Button
                  variant="outline"
                  onClick={handlePreviousPage}
                  disabled={previousPageTokens.length === 0 || loading}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {previousPageTokens.length + 1}
                </span>
                <Button
                  variant="outline"
                  onClick={handleNextPage}
                  disabled={!nextPageToken || loading}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Email Detail View */}
      {selectedEmail && (
        <Card className="border-0">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Email Details
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSelectedEmail(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingEmail ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              renderEmailContent(selectedEmail, selectedEmailDetail)
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
