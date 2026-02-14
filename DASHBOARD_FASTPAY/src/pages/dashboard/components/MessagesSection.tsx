import { useState, useRef, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/component/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/component/ui/table'
import { Button } from '@/component/ui/button'
import { Input } from '@/component/ui/input'
import { Skeleton } from '@/component/ui/skeleton'
import { Badge } from '@/component/ui/badge'
import { FeatureGate } from '@/component/FeatureGate'
import { SearchInput } from '@/component/SearchInput'
import type { FilterMode } from '@/component/SearchInput'
import {
  MessageSquare,
  Wifi,
  WifiOff,
  Loader,
  X,
  TextSearch,
  ListFilter,
  Check,
  Bookmark,
  FileCode,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SMS } from '../types'
import { formatDistanceToNow } from 'date-fns'
import { getDeviceCommandsPath } from '@/lib/firebase-helpers'
import { set } from 'firebase/database'
import { useToast } from '@/lib/use-toast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/component/ui/select'
import { Label } from '@/component/ui/label'
import {
  messageProcessors,
  getProcessorById,
  type MessageProcessor,
} from '@/lib/message-processors'

interface MessagesSectionProps {
  deviceId: string | null
  messages: SMS[]
  rawMessages?: SMS[] // Raw messages without processing
  loading: boolean
  error: string | null
  isConnected: boolean
  isAdmin: boolean
  selectedProcessorId?: string
  processorInput?: string
  onProcessorChange?: (processorId: string) => void
  onProcessorInputChange?: (input: string) => void
  onRetry?: () => void
  formatMessageTimestamp?: (timestamp: number | string) => string
  /** When set, rows whose body contains this string get a highlight style */
  highlightBodyContains?: string
  /** In rows matching highlightBodyContains, highlight the first N digits as OTP (e.g. 6). */
  highlightOtpDigits?: number
  /** Initial "show N messages" limit (default 10). Use e.g. 25 to show 25 on load. */
  defaultMessageLimit?: number
  /** Optional section title shown in toolbar row (e.g. "Messages") */
  title?: string
}

export function MessagesSection({
  deviceId,
  messages,
  rawMessages,
  loading,
  error,
  isConnected,
  isAdmin,
  selectedProcessorId = 'neft-inr-merge',
  processorInput = '',
  onProcessorChange,
  onProcessorInputChange,
  onRetry,
  formatMessageTimestamp,
  highlightBodyContains,
  highlightOtpDigits,
  defaultMessageLimit,
  title,
}: MessagesSectionProps) {
  const { toast } = useToast()
  const [refreshing, setRefreshing] = useState(false)
  const [messageLimit, setMessageLimit] = useState<string>(
    defaultMessageLimit != null ? String(defaultMessageLimit) : '10'
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFilterMode, setSearchFilterMode] = useState<FilterMode>('contains')
  const [smsFilter, setSmsFilter] = useState<
    'all' | 'sent' | 'received' | 'today' | 'thisMonth' | 'customDate'
  >('all')
  const [scriptFilter, setScriptFilter] = useState<string>('all')
  const [customDateStart, setCustomDateStart] = useState('')
  const [customDateEnd, setCustomDateEnd] = useState('')
  const [showSmsFilterDropdown, setShowSmsFilterDropdown] = useState(false)
  const [showScriptFilterDropdown, setShowScriptFilterDropdown] = useState(false)
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [copiedCellId, setCopiedCellId] = useState<string | null>(null)

  const smsFilterRef = useRef<HTMLDivElement>(null)
  const scriptFilterRef = useRef<HTMLDivElement>(null)
  const sortRef = useRef<HTMLDivElement>(null)

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (smsFilterRef.current && !smsFilterRef.current.contains(event.target as Node)) {
        setShowSmsFilterDropdown(false)
      }
      if (scriptFilterRef.current && !scriptFilterRef.current.contains(event.target as Node)) {
        setShowScriptFilterDropdown(false)
      }
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setShowSortDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Helper functions
  const matchesSearchFilter = (text: string, query: string, mode: FilterMode) => {
    const lowerText = text.toLowerCase()
    const lowerQuery = query.toLowerCase()
    switch (mode) {
      case 'equals':
        return lowerText === lowerQuery
      case 'contains':
        return lowerText.includes(lowerQuery)
      case 'startsWith':
        return lowerText.startsWith(lowerQuery)
      case 'endsWith':
        return lowerText.endsWith(lowerQuery)
      case 'equalsNot':
        return lowerText !== lowerQuery
      case 'containsNot':
        return !lowerText.includes(lowerQuery)
      case 'startsWithNot':
        return !lowerText.startsWith(lowerQuery)
      case 'endsWithNot':
        return !lowerText.endsWith(lowerQuery)
      default:
        return lowerText.includes(lowerQuery)
    }
  }

  const isDateInRange = (dateString: string | number, startDate?: string, endDate?: string) => {
    if (!startDate && !endDate) return true

    let timestamp: number
    if (typeof dateString === 'string') {
      timestamp = parseInt(dateString)
      if (isNaN(timestamp)) {
        timestamp = new Date(dateString).getTime()
      }
    } else {
      timestamp = dateString
    }

    if (isNaN(timestamp) || timestamp <= 0) return false

    const date = new Date(timestamp)
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())

    if (startDate) {
      const start = new Date(startDate)
      const startOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate())
      if (dateOnly < startOnly) return false
    }

    if (endDate) {
      const end = new Date(endDate)
      const endOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate())
      if (dateOnly > endOnly) return false
    }

    return true
  }

  const getDateRange = (filter: string) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    switch (filter) {
      case 'today':
        return { start: today.toISOString().split('T')[0], end: now.toISOString().split('T')[0] }
      case 'thisMonth':
        return {
          start: startOfMonth.toISOString().split('T')[0],
          end: now.toISOString().split('T')[0],
        }
      case 'customDate':
        return { start: customDateStart, end: customDateEnd }
      default:
        return { start: undefined, end: undefined }
    }
  }

  // Determine which messages to use (processed or raw)
  const messagesToDisplay = useMemo(() => {
    if (selectedProcessorId === 'no-processing' && rawMessages && rawMessages.length > 0) {
      return rawMessages
    }
    return messages
  }, [messages, rawMessages, selectedProcessorId])

  const filteredSms = useMemo(() => {
    const smsArray = Array.isArray(messagesToDisplay) ? messagesToDisplay : []
    let filtered = [...smsArray]

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(item =>
        matchesSearchFilter(item.body, searchQuery, searchFilterMode)
      )
    }

    // Apply direction filter
    if (smsFilter === 'sent') {
      filtered = filtered.filter(item => item.is_sent === true)
    } else if (smsFilter === 'received') {
      filtered = filtered.filter(item => item.is_sent === false)
    }

    // Apply date filter
    if (smsFilter === 'today' || smsFilter === 'thisMonth' || smsFilter === 'customDate') {
      const { start, end } = getDateRange(smsFilter)
      filtered = filtered.filter(item => isDateInRange(item.time, start, end))
    }

    // Apply script filter
    if (scriptFilter !== 'all') {
      const bodyLower = scriptFilter.toLowerCase()
      filtered = filtered.filter(item => {
        const itemBody = (item.body || '').toLowerCase()
        return itemBody.includes(bodyLower)
      })
    }

    // Apply sort
    filtered.sort((a, b) => {
      let timeA: number =
        typeof a.time === 'string'
          ? parseInt(a.time) || new Date(a.time).getTime() || 0
          : a.time || 0

      let timeB: number =
        typeof b.time === 'string'
          ? parseInt(b.time) || new Date(b.time).getTime() || 0
          : b.time || 0

      return timeB - timeA // Always sort by recent (newest first)
    })

    // Apply message limit after all filters (show up to N messages that match filters)
    const limit = parseInt(messageLimit, 10) || 20
    return filtered.slice(0, limit)
  }, [
    messages,
    messageLimit,
    searchQuery,
    searchFilterMode,
    smsFilter,
    scriptFilter,
    customDateStart,
    customDateEnd,
    messagesToDisplay,
  ])

  const handleCopy = async (text: string, cellId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedCellId(cellId)
      setTimeout(() => setCopiedCellId(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const defaultFormatTimestamp = (timestamp: number | string): string => {
    const ts = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp
    if (isNaN(ts) || ts <= 0) return 'Invalid date'

    const now = Date.now()
    const diffSeconds = Math.floor((now - ts) / 1000)

    if (diffSeconds < 0) return 'just now'
    if (diffSeconds < 20) return 'just now'
    if (diffSeconds < 60) return `${diffSeconds} seconds ago`
    if (diffSeconds < 120) return `${Math.floor(diffSeconds / 60)} minute ago`

    return formatDistanceToNow(new Date(ts), { addSuffix: true })
  }

  const formatTime = formatMessageTimestamp || defaultFormatTimestamp

  const handleRefresh = async () => {
    if (!deviceId || refreshing) return

    try {
      setRefreshing(true)
      
      // Send fetchSms command to Firebase with selected limit
      const commandRef = getDeviceCommandsPath(deviceId, 'fetchSms')
      await set(commandRef, messageLimit) // Fetch messages based on selected limit

      toast({
        title: 'Refresh requested',
        description: `Fetching ${messageLimit} latest messages from device...`,
        variant: 'default',
      })
    } catch (err) {
      console.error('Error requesting message refresh:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to request message refresh'
      toast({
        title: 'Error refreshing messages',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      // Reset refreshing state after a delay
      setTimeout(() => setRefreshing(false), 2000)
    }
  }

  if (!deviceId) {
    return (
      <Card variant="outline">
        <CardContent className="p-8 text-center text-muted-foreground">
          <TextSearch className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Select a device to view messages</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card variant="outline" id="message-section-card" data-testid="message-section" className="overflow-hidden">
      <CardContent id="message-section-content" className="p-2">
        {/* Error Display */}
        {error && (
          <div id="message-section-error" data-testid="message-error" className="mb-2 p-2 border border-destructive/50 bg-destructive/10 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-destructive text-xs">
              <X className="h-3 w-3" />
              <span>{error}</span>
            </div>
            {onRetry && (
              <Button id="message-error-retry" variant="outline" size="sm" onClick={onRetry} className="h-6 py-0 text-[10px]">
                Retry
              </Button>
            )}
          </div>
        )}

        {/* Loading State */}
        {loading && messages.length === 0 ? (
          <div id="message-section-loading" data-testid="message-loading" className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-3 border-b border-border">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div id="message-section-empty" data-testid="message-empty" className="p-8 text-center text-muted-foreground">
            <TextSearch className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No SMS messages found</p>
            <p className="text-sm mt-2">Messages will appear here when received or sent</p>
          </div>
        ) : (
          <>
            {/* Title | Search | Refresh then table */}
            <div id="message-section-table-container" className="rounded-xl border border-border overflow-hidden shadow-sm bg-card">
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-muted/50">
                {title && (
                  <span className="text-sm font-semibold text-foreground shrink-0">{title}</span>
                )}
                <SearchInput
                  data-testid="message-search-input"
                  value={searchQuery}
                  onChange={setSearchQuery}
                  filterMode={searchFilterMode}
                  onFilterModeChange={setSearchFilterMode}
                placeholder="Search by sender or message content"
                className="h-8 text-xs bg-background border-border focus-within:ring-1 focus-within:ring-ring transition-all min-w-[160px] flex-1"
                />
                {onProcessorChange && (
                  <Select data-testid="message-processor-select" value={selectedProcessorId} onValueChange={onProcessorChange}>
                    <SelectTrigger id="processor-select" className="h-8 text-xs px-2.5 bg-background/50 border-border/50 hover:bg-background/80 transition-all truncate min-w-[100px]">
                      <SelectValue placeholder="Script" />
                    </SelectTrigger>
                    <SelectContent>
                      {messageProcessors.map(processor => (
                        <SelectItem key={processor.id} value={processor.id} className="text-sm">
                          {processor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  id="message-refresh-btn"
                  data-testid="message-refresh-button"
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshing || !deviceId}
                  className="h-8 px-2.5 border-border text-primary hover:bg-primary/10 hover:border-primary/50 transition-all active:scale-95 flex-shrink-0 text-xs"
                  title="Refresh messages"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
                </Button>
              </div>
              <Table id="message-section-table" data-testid="message-table" className="table-fixed w-full border-collapse">
                <TableHeader id="message-table-header" className="bg-muted/50">
                  <TableRow id="message-table-header-labels" className="hover:bg-transparent border-b border-border">
                    <TableHead id="message-header-number" className="w-[70px] px-2 py-2 font-bold text-foreground border-r border-border text-[10px] uppercase tracking-wider">#</TableHead>
                    <TableHead id="message-header-sender" className="w-[200px] px-3 py-2 font-bold text-foreground border-r border-border text-[10px] uppercase tracking-wider text-center">Sender & Time</TableHead>
                    <TableHead id="message-header-message" className="px-3 py-2 font-bold text-foreground text-[10px] uppercase tracking-wider">Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody id="message-table-body" data-testid="message-table-body">
                  {filteredSms.length === 0 ? (
                    <TableRow id="message-table-empty-row">
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        {searchQuery || scriptFilter !== 'all'
                          ? 'No messages match your filters'
                          : 'No messages'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSms.map((item, index) => {
                      const rowId = `sms-${item.id}`
                      const isEven = index % 2 === 0
                      const isHighlight = highlightBodyContains != null && (item.body || '').includes(highlightBodyContains)
                      return (
                        <TableRow
                          key={item.id}
                          id={`message-row-${item.id}`}
                          data-testid={`message-row-${item.id}`}
                          data-message-id={item.id}
                          data-message-index={index}
                          className={cn(
                            "border-b border-border/5 hover:bg-muted/25",
                            isEven ? "bg-muted/5" : "bg-muted/20",
                            isHighlight && "bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-400"
                          )}
                        >
                          {/* NUMBER Column */}
                          <TableCell id={`message-row-${item.id}-number`} className="w-[70px] px-3 py-3 font-mono text-[10px] group relative border-r border-border/10 align-top">
                            <div className="flex items-center gap-1 justify-between">
                              <span className="font-bold text-muted-foreground">#{index + 1}</span>
                              <button
                                id={`message-row-${item.id}-copy-number`}
                                onClick={() => handleCopy(String(index + 1), `${rowId}-sno`)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-muted rounded flex-shrink-0"
                                title="Copy Number"
                              >
                                {copiedCellId === `${rowId}-sno` ? (
                                  <Check className="h-3 w-3 text-green-600" />
                                ) : (
                                  <Bookmark className="h-3 w-3 opacity-60" />
                                )}
                              </button>
                            </div>
                          </TableCell>

                          {/* SENDER & TIME Column */}
                          <TableCell id={`message-row-${item.id}-sender`} className="w-[200px] px-4 py-3 border-r border-border/10 align-top">
                            <div className="flex flex-col gap-0.5">
                              <div className="group/sender relative font-mono text-xs font-bold text-foreground">
                                <span id={`message-row-${item.id}-sender-value`} className="block truncate pr-5 uppercase tracking-tight">{item.sender}</span>
                                <button
                                  id={`message-row-${item.id}-copy-sender`}
                                  onClick={() => handleCopy(item.sender, `${rowId}-sender`)}
                                  className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover/sender:opacity-100 transition-opacity p-0.5 hover:bg-muted rounded"
                                  title="Copy Sender"
                                >
                                  {copiedCellId === `${rowId}-sender` ? (
                                    <Check className="h-3 w-3 text-green-600" />
                                  ) : (
                                    <Bookmark className="h-3 w-3 opacity-60" />
                                  )}
                                </button>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span id={`message-row-${item.id}-time`} className="text-[10px] text-muted-foreground font-mono opacity-80">
                                  {formatTime(item.time)}
                                </span>
                                {(() => {
                                  const mergeMatch = item.body?.match(/\[Merged:\s*(\d+)\s*messages?\]/i)
                                  if (mergeMatch && mergeMatch[1]) {
                                    return (
                                      <span id={`message-row-${item.id}-merge-badge`} className="text-[9px] px-1 bg-primary/10 text-primary border border-primary/20 rounded font-bold">
                                        {mergeMatch[1]}M
                                      </span>
                                    )
                                  }
                                  return null
                                })()}
                              </div>
                            </div>
                          </TableCell>

                          {/* MESSAGE Column */}
                          <TableCell id={`message-row-${item.id}-body`} className="px-4 py-3 group relative pr-10 align-top">
                            <div id={`message-row-${item.id}-body-text`} className="text-sm leading-relaxed whitespace-pre-wrap break-words tracking-tight">
                              {(() => {
                                const body = item.body ?? ''
                                const highlightClass =
                                  'font-semibold bg-amber-200/90 text-amber-900 dark:bg-amber-400/80 dark:text-amber-950 px-1.5 py-0.5 rounded'
                                const shouldHighlightOtp = isHighlight && highlightOtpDigits != null && highlightOtpDigits > 0
                                if (!shouldHighlightOtp) return body
                                const match = body.match(/(\d{6})/)
                                if (!match) return body
                                const idx = body.indexOf(match[1])
                                const before = body.slice(0, idx)
                                const otp = match[1]
                                const after = body.slice(idx + 6)
                                return (
                                  <>
                                    {before}
                                    <span className={highlightClass}>{otp}</span>
                                    {after}
                                  </>
                                )
                              })()}
                            </div>
                            <button
                              id={`message-row-${item.id}-copy-body`}
                              onClick={() => handleCopy(item.body, `${rowId}-body`)}
                              className="absolute right-2 top-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                              title="Copy Message"
                            >
                              {copiedCellId === `${rowId}-body` ? (
                                <Check className="h-3.5 w-3.5 text-green-600" />
                              ) : (
                                <Bookmark className="h-3.5 w-3.5 opacity-60" />
                              )}
                            </button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
