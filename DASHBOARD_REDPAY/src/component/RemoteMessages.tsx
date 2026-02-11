import { useEffect, useState, useMemo } from 'react'
import { onValue, off, get, query, orderByKey, limitToLast } from 'firebase/database'
import { getDeviceMessagesPath } from '@/lib/firebase-helpers'
import { Button } from '@/component/ui/button'
import { Skeleton } from '@/component/ui/skeleton'
import { MessageSquare, RefreshCw, AlertCircle, Search, Filter } from 'lucide-react'
import { useToast } from '@/lib/use-toast'
import { retryWithBackoff, isRetryableError } from '@/lib/retry-utils'
import { Input } from '@/component/ui/input'
import { Badge } from '@/component/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/component/ui/card'
import { formatDistanceToNow } from 'date-fns'

interface RemoteMessagesProps {
  deviceId: string | null
}

interface ParsedMessage {
  id: string
  type: 'remote' | 'sms_received' | 'sms_sent' | 'unknown'
  content: string
  phone?: string
  timestamp: number
  isSent?: boolean
}

export default function RemoteMessages({ deviceId }: RemoteMessagesProps) {
  const { toast } = useToast()
  const [messages, setMessages] = useState<ParsedMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Parse message from Firebase format
  const parseMessage = (key: string, value: string): ParsedMessage | null => {
    try {
      // Check if it's SMS format (received~phone~body or sent~phone~body)
      if (value.includes('~')) {
        const parts = value.split('~')
        if (parts.length >= 3 && (parts[0] === 'received' || parts[0] === 'sent')) {
          // This is SMS format, skip it (we only want remote messages)
          return null
        }
      }

      // Check if it's remote message format (plain text or other formats)
      // Remote messages are any messages that don't match SMS format
      if (value.startsWith('received~') || value.startsWith('sent~')) {
        return null // Skip SMS messages
      }

      // Try to parse timestamp from key
      const timestamp = parseInt(key) || Date.now()

      return {
        id: key,
        type: 'remote',
        content: value,
        timestamp,
      }
    } catch (err) {
      console.error('Error parsing message:', err)
      return null
    }
  }

  // Check if message is remote (not SMS)
  const isRemoteMessage = (value: string): boolean => {
    if (!value || typeof value !== 'string') return false
    // Remote messages don't match SMS format (received~phone~body or sent~phone~body)
    return !value.startsWith('received~') && !value.startsWith('sent~')
  }

  // Fetch messages from Firebase
  useEffect(() => {
    if (!deviceId) {
      setMessages([])
      setLoading(false)
      setError(null)
      return
    }

    let isMounted = true
    let unsubscribe: (() => void) | null = null

    const messagesRef = getDeviceMessagesPath(deviceId)
    const messagesQuery = query(messagesRef, orderByKey())

    // Fast initial load
    const loadInitialData = async () => {
      try {
        setLoading(true)
        setError(null)

        const snapshot = await retryWithBackoff(() => get(messagesQuery), {
          maxAttempts: 3,
          initialDelay: 300,
          retryable: isRetryableError,
        })

        if (!isMounted) return

        if (!snapshot.exists()) {
          setMessages([])
          setLoading(false)
          return
        }

        const messagesData = snapshot.val()
        const parsedMessages: ParsedMessage[] = []

        for (const key in messagesData) {
          const value = messagesData[key]
          if (typeof value === 'string' && isRemoteMessage(value)) {
            const parsed = parseMessage(key, value)
            if (parsed) {
              parsedMessages.push(parsed)
            }
          }
        }

        // Sort by timestamp (newest first)
        parsedMessages.sort((a, b) => b.timestamp - a.timestamp)

        setMessages(parsedMessages)
        setLoading(false)
      } catch (err) {
        if (!isMounted) return
        console.error('Error loading remote messages:', err)
        const errorMessage = err instanceof Error ? err.message : 'Failed to load remote messages'
        setError(errorMessage)
        setLoading(false)
        toast({
          title: 'Error loading remote messages',
          description: errorMessage,
          variant: 'destructive',
        })
      }
    }

    // Set up real-time listener
    const setupRealtimeListener = () => {
      unsubscribe = onValue(
        messagesQuery,
        snapshot => {
          if (!isMounted) return
          try {
            if (!snapshot.exists()) {
              setMessages([])
              return
            }

            const messagesData = snapshot.val()
            const parsedMessages: ParsedMessage[] = []

            for (const key in messagesData) {
              const value = messagesData[key]
              if (typeof value === 'string' && isRemoteMessage(value)) {
                const parsed = parseMessage(key, value)
                if (parsed) {
                  parsedMessages.push(parsed)
                }
              }
            }

            // Sort by timestamp (newest first)
            parsedMessages.sort((a, b) => b.timestamp - a.timestamp)

            setMessages(parsedMessages)
            setError(null)
          } catch (err) {
            console.error('Error processing remote messages:', err)
            const errorMessage =
              err instanceof Error ? err.message : 'Failed to process remote messages'
            setError(errorMessage)
            toast({
              title: 'Error processing remote messages',
              description: errorMessage,
              variant: 'destructive',
            })
          }
        },
        error => {
          if (!isMounted) return
          console.error('Error listening to remote messages:', error)
          const errorMessage = error.message || 'Failed to fetch remote messages'
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
        off(messagesQuery)
      }
    }
  }, [deviceId, toast])

  // Filter messages by search query
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) {
      return messages
    }

    const query = searchQuery.toLowerCase()
    return messages.filter(
      msg =>
        msg.content.toLowerCase().includes(query) ||
        (msg.phone && msg.phone.toLowerCase().includes(query)) ||
        msg.id.toLowerCase().includes(query)
    )
  }, [messages, searchQuery])

  // Handle refresh
  const handleRefresh = async () => {
    if (!deviceId) return

    try {
      setLoading(true)
      setError(null)

      const messagesRef = getDeviceMessagesPath(deviceId)
      const messagesQuery = query(messagesRef, orderByKey())

      const snapshot = await retryWithBackoff(() => get(messagesQuery), {
        maxAttempts: 3,
        initialDelay: 300,
        retryable: isRetryableError,
      })

      if (!snapshot.exists()) {
        setMessages([])
        setLoading(false)
        return
      }

      const messagesData = snapshot.val()
      const parsedMessages: ParsedMessage[] = []

      for (const key in messagesData) {
        const value = messagesData[key]
        if (typeof value === 'string' && isRemoteMessage(value)) {
          const parsed = parseMessage(key, value)
          if (parsed) {
            parsedMessages.push(parsed)
          }
        }
      }

      // Sort by timestamp (newest first)
      parsedMessages.sort((a, b) => b.timestamp - a.timestamp)

      setMessages(parsedMessages)
      setLoading(false)

      toast({
        title: 'Remote messages refreshed',
        description: 'Remote messages have been updated',
        variant: 'default',
      })
    } catch (err) {
      console.error('Error refreshing remote messages:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh remote messages'
      setError(errorMessage)
      setLoading(false)
      toast({
        title: 'Error refreshing remote messages',
        description: errorMessage,
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            Remote Messages
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            View remote messages from Firebase (distinct from SMS)
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Search */}
      {messages.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search messages..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {searchQuery && (
            <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>
              Clear
            </Button>
          )}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <div>
              <p className="font-semibold">Error loading remote messages</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} className="mt-2">
            Retry
          </Button>
        </div>
      )}

      {/* Loading State */}
      {loading && messages.length === 0 && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && messages.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">No remote messages found</p>
          <p className="text-sm mt-2">Remote messages will appear here when sent to this device</p>
          <p className="text-xs mt-1 text-muted-foreground/70">
            Note: Remote messages are different from SMS messages
          </p>
        </div>
      )}

      {/* Messages List */}
      {!loading && filteredMessages.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {filteredMessages.length} of {messages.length} messages
            </p>
          </div>
          {filteredMessages.map(message => (
            <Card key={message.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-blue-600" />
                    <div>
                      <CardTitle className="text-base">Remote Message</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">{message.type}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                {message.phone && (
                  <p className="text-xs text-muted-foreground mt-2 font-mono">
                    Phone: {message.phone}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2 font-mono">ID: {message.id}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* No Results */}
      {!loading && searchQuery && filteredMessages.length === 0 && messages.length > 0 && (
        <div className="p-8 text-center text-muted-foreground">
          <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">No messages match your search</p>
          <p className="text-sm mt-2">Try a different search term</p>
        </div>
      )}
    </div>
  )
}
