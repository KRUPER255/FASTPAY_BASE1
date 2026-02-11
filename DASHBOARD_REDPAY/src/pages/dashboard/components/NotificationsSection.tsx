import { useState, useRef, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/component/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/component/ui/table'
import { Button } from '@/component/ui/button'
import { Input } from '@/component/ui/input'
import { Skeleton } from '@/component/ui/skeleton'
import { FeatureGate } from '@/component/FeatureGate'
import { SearchInput } from '@/component/SearchInput'
import type { FilterMode } from '@/component/SearchInput'
import {
  ReplyAll,
  Wifi,
  WifiOff,
  Loader,
  X,
  ListFilter,
  ArrowUpDown,
  Check,
  Bookmark,
  RefreshCw,
} from 'lucide-react'
import type { Notification } from '../types'
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
import { Switch } from '@/component/ui/switch'
import { Label } from '@/component/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/component/ui/dialog'

interface NotificationsSectionProps {
  deviceId: string | null
  notifications: Notification[]
  loading: boolean
  error: string | null
  isConnected: boolean
  isAdmin: boolean
  syncEnabled: boolean
  onRetry?: () => void
  formatNotificationTimestamp?: (timestamp: number | string) => string
}

export function NotificationsSection({
  deviceId,
  notifications,
  loading,
  error,
  isConnected,
  isAdmin,
  syncEnabled,
  onRetry,
  formatNotificationTimestamp,
}: NotificationsSectionProps) {
  const { toast } = useToast()
  const [refreshing, setRefreshing] = useState(false)
  const [notificationLimit, setNotificationLimit] = useState<string>('20')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFilterMode, setSearchFilterMode] = useState<FilterMode>('contains')
  const [notificationFilter, setNotificationFilter] = useState<
    'all' | 'today' | 'thisMonth' | 'customDate'
  >('all')
  const [sortBy, setSortBy] = useState<'recent' | 'oldest'>('recent')
  const [customDateStart, setCustomDateStart] = useState('')
  const [customDateEnd, setCustomDateEnd] = useState('')
  const [showNotificationFilterDropdown, setShowNotificationFilterDropdown] = useState(false)
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [copiedCellId, setCopiedCellId] = useState<string | null>(null)
  const [realtimeSyncEnabled, setRealtimeSyncEnabled] = useState<boolean>(syncEnabled)
  const [showRealtimeDialog, setShowRealtimeDialog] = useState(false)
  const [realtimeMinutes, setRealtimeMinutes] = useState<number>(30)

  const notificationFilterRef = useRef<HTMLDivElement>(null)
  const sortRef = useRef<HTMLDivElement>(null)

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

  const filteredNotifications = useMemo(() => {
    const notificationsArray = Array.isArray(notifications) ? notifications : []
    let filtered = [...notificationsArray]

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        item =>
          matchesSearchFilter(item.body || '', searchQuery, searchFilterMode) ||
          matchesSearchFilter(item.title || '', searchQuery, searchFilterMode) ||
          matchesSearchFilter(item.app || '', searchQuery, searchFilterMode)
      )
    }

    // Apply date filter
    if (
      notificationFilter === 'today' ||
      notificationFilter === 'thisMonth' ||
      notificationFilter === 'customDate'
    ) {
      const { start, end } = getDateRange(notificationFilter)
      filtered = filtered.filter(item => isDateInRange(item.time, start, end))
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

      return sortBy === 'recent' ? timeB - timeA : timeA - timeB
    })

    // Apply notification limit after all filters (show up to N notifications that match filters)
    const limit = parseInt(notificationLimit, 10) || 20
    return filtered.slice(0, limit)
  }, [
    notifications,
    notificationLimit,
    searchQuery,
    searchFilterMode,
    notificationFilter,
    sortBy,
    customDateStart,
    customDateEnd,
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

  const formatTime = formatNotificationTimestamp || defaultFormatTimestamp

  // Sync realtimeSyncEnabled with syncEnabled prop
  useEffect(() => {
    setRealtimeSyncEnabled(syncEnabled)
  }, [syncEnabled])

  const handleRealtimeSyncToggle = async (enabled: boolean) => {
    if (!deviceId) return

    try {
      const commandRef = getDeviceCommandsPath(deviceId, 'syncNotification')
      
      if (enabled) {
        // Show dialog to choose between batch mode or realtime mode
        setShowRealtimeDialog(true)
      } else {
        // Disable sync
        await set(commandRef, 'off')
        setRealtimeSyncEnabled(false)
        toast({
          title: 'Notification Sync Disabled',
          description: 'Notification sync has been turned off',
          variant: 'default',
        })
      }
    } catch (err) {
      console.error('Error toggling notification sync:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle notification sync'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    }
  }

  const handleEnableRealtimeSync = async (minutes?: number) => {
    if (!deviceId) return

    try {
      const commandRef = getDeviceCommandsPath(deviceId, 'syncNotification')
      
      if (minutes && minutes > 0) {
        // Enable realtime sync for specified duration
        await set(commandRef, `realtime:${minutes}`)
        setRealtimeSyncEnabled(true)
        toast({
          title: 'Realtime Sync Enabled',
          description: `Realtime sync enabled for ${minutes} minutes. Will return to batch mode afterwards.`,
          variant: 'default',
        })
      } else {
        // Enable batch mode (default)
        await set(commandRef, 'on')
        setRealtimeSyncEnabled(true)
        toast({
          title: 'Notification Sync Enabled',
          description: 'Batch mode enabled (default)',
          variant: 'default',
        })
      }
      
      setShowRealtimeDialog(false)
      
      // Trigger refresh
      if (onRetry) {
        onRetry()
      }
    } catch (err) {
      console.error('Error enabling notification sync:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to enable notification sync'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    }
  }

  const handleRefresh = async () => {
    if (!deviceId || refreshing) return

    try {
      setRefreshing(true)
      
      // Ensure notification sync is enabled
      if (!realtimeSyncEnabled) {
        const commandRef = getDeviceCommandsPath(deviceId, 'syncNotification')
        await set(commandRef, 'on')
        setRealtimeSyncEnabled(true)
      }

      toast({
        title: 'Refreshing notifications',
        description: 'Ensuring notification sync is enabled and refreshing data...',
        variant: 'default',
      })

      // Trigger a retry to refresh data
      if (onRetry) {
        onRetry()
      }
    } catch (err) {
      console.error('Error refreshing notifications:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh notifications'
      toast({
        title: 'Error refreshing notifications',
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
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <ReplyAll className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Select a device to view notifications</p>
        </CardContent>
      </Card>
    )
  }

  // Note: We now show the notification list even when sync is disabled, 
  // but the toggle allows users to enable/disable sync

  return (
    <Card>
      <CardHeader className="p-4 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ReplyAll className="h-4 w-4" />
            Notifications ({filteredNotifications.length})
          </CardTitle>
          <div className="flex items-center gap-4">
            {/* Realtime Sync Toggle */}
            <div className="flex items-center gap-2">
              <Label htmlFor="realtime-sync" className="text-sm text-muted-foreground cursor-pointer">
                Realtime Sync
              </Label>
              <Switch
                id="realtime-sync"
                checked={realtimeSyncEnabled}
                onCheckedChange={handleRealtimeSyncToggle}
                disabled={!deviceId}
              />
            </div>
            
            <div className="h-4 w-px bg-border" />
            
            <div className="flex items-center gap-2">
            <Select
              value={notificationLimit}
              onValueChange={setNotificationLimit}
              disabled={!deviceId}
            >
              <SelectTrigger className="h-8 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="30">30</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing || !deviceId || !realtimeSyncEnabled}
              className="h-8"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {isConnected ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
            {loading && notifications.length === 0 && (
              <Loader className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 border border-red-500/50 bg-red-500/10 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-500 text-sm">
              <X className="h-4 w-4" />
              <span>{error}</span>
            </div>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                Retry
              </Button>
            )}
          </div>
        )}

        {/* Loading State */}
        {loading && notifications.length === 0 ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-3 border-b border-border">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <ReplyAll className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No notifications found</p>
            <p className="text-sm mt-2">Notifications will appear here when received</p>
          </div>
        ) : (
          <>
            {/* Admin Search and Filter Controls */}
            <FeatureGate adminOnly={true}>
              <div className="mb-4 p-4 border-b border-border flex items-center gap-2 flex-wrap">
                <div className="w-64">
                  <SearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    filterMode={searchFilterMode}
                    onFilterModeChange={setSearchFilterMode}
                  />
                </div>
                <div className="relative" ref={notificationFilterRef}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => {
                      setShowNotificationFilterDropdown(!showNotificationFilterDropdown)
                      setShowSortDropdown(false)
                    }}
                  >
                    <ListFilter className="h-4 w-4 mr-1" />
                    Filter
                  </Button>
                  {showNotificationFilterDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-50 min-w-[200px]">
                      <div className="p-1">
                        {['all', 'today', 'thisMonth', 'customDate'].map(filter => (
                          <button
                            key={filter}
                            onClick={() => {
                              setNotificationFilter(filter as any)
                              setShowNotificationFilterDropdown(false)
                            }}
                            className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-accent ${
                              notificationFilter === filter ? 'bg-accent' : ''
                            }`}
                          >
                            {filter.charAt(0).toUpperCase() +
                              filter.slice(1).replace(/([A-Z])/g, ' $1')}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {notificationFilter === 'customDate' && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={customDateStart}
                      onChange={e => setCustomDateStart(e.target.value)}
                      className="h-9 text-sm"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="date"
                      value={customDateEnd}
                      onChange={e => setCustomDateEnd(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                )}
                <div className="relative" ref={sortRef}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => {
                      setShowSortDropdown(!showSortDropdown)
                      setShowNotificationFilterDropdown(false)
                    }}
                  >
                    <ArrowUpDown className="h-4 w-4 mr-1" />
                    Sort By
                  </Button>
                  {showSortDropdown && (
                    <div className="absolute top-full right-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-50 min-w-[150px]">
                      <div className="p-1">
                        {['recent', 'oldest'].map(sort => (
                          <button
                            key={sort}
                            onClick={() => {
                              setSortBy(sort as 'recent' | 'oldest')
                              setShowSortDropdown(false)
                            }}
                            className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-accent ${
                              sortBy === sort ? 'bg-accent' : ''
                            }`}
                          >
                            {sort.charAt(0).toUpperCase() + sort.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </FeatureGate>

            {/* Notifications Table */}
            <div className="rounded-lg border overflow-hidden">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">S.No.</TableHead>
                    <TableHead className="w-32">App</TableHead>
                    <TableHead className="w-48">Title</TableHead>
                    <TableHead>Body</TableHead>
                    <TableHead className="w-32">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNotifications.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {searchQuery || notificationFilter !== 'all'
                          ? 'No notifications match your filters'
                          : 'No notifications'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredNotifications.map((item, index) => {
                      const rowId = `notif-${item.id}`
                      return (
                        <TableRow
                          key={item.id}
                          className={
                            index % 2 === 0
                              ? 'bg-slate-200/60 dark:bg-slate-700/60'
                              : 'bg-slate-50/30 dark:bg-slate-900/30'
                          }
                        >
                          <TableCell className="font-mono text-xs group relative">
                            <span>{index + 1}</span>
                            <button
                              onClick={() => handleCopy(String(index + 1), `${rowId}-sno`)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                              title="Copy"
                            >
                              {copiedCellId === `${rowId}-sno` ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Bookmark className="h-4 w-4 opacity-60" />
                              )}
                            </button>
                          </TableCell>
                          <TableCell className="group relative">
                            <span className="px-2 py-1 rounded-full text-xs bg-black/5 dark:bg-white/5">
                              {item.app || '-'}
                            </span>
                            <button
                              onClick={() => handleCopy(item.app || '', `${rowId}-app`)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                              title="Copy"
                            >
                              {copiedCellId === `${rowId}-app` ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Bookmark className="h-4 w-4 opacity-60" />
                              )}
                            </button>
                          </TableCell>
                          <TableCell className="font-medium group relative">
                            <span>{item.title || '-'}</span>
                            <button
                              onClick={() => handleCopy(item.title || '', `${rowId}-title`)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                              title="Copy"
                            >
                              {copiedCellId === `${rowId}-title` ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Bookmark className="h-4 w-4 opacity-60" />
                              )}
                            </button>
                          </TableCell>
                          <TableCell className="max-w-md truncate group relative">
                            <span className="block truncate">{item.body || '-'}</span>
                            <button
                              onClick={() => handleCopy(item.body || '', `${rowId}-body`)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                              title="Copy"
                            >
                              {copiedCellId === `${rowId}-body` ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Bookmark className="h-4 w-4 opacity-60" />
                              )}
                            </button>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground group relative">
                            <span>{formatTime(item.time)}</span>
                            <button
                              onClick={() => handleCopy(formatTime(item.time), `${rowId}-time`)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                              title="Copy"
                            >
                              {copiedCellId === `${rowId}-time` ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Bookmark className="h-4 w-4 opacity-60" />
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

      {/* Realtime Sync Dialog */}
      <Dialog open={showRealtimeDialog} onOpenChange={setShowRealtimeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enable Notification Sync</DialogTitle>
            <DialogDescription>
              Choose how you want to sync notifications from the device.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Sync Mode</Label>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleEnableRealtimeSync()}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Batch Mode (Default)</span>
                    <span className="text-xs text-muted-foreground">
                      Uploads notifications in batches of 100 or every 5 minutes
                    </span>
                  </div>
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Realtime Mode (Temporary)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  value={realtimeMinutes}
                  onChange={(e) => setRealtimeMinutes(parseInt(e.target.value) || 30)}
                  className="w-24"
                />
                <Label className="text-sm text-muted-foreground">minutes</Label>
                <Button
                  onClick={() => handleEnableRealtimeSync(realtimeMinutes)}
                  className="flex-1"
                >
                  Enable Realtime for {realtimeMinutes} min
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Realtime mode uploads notifications immediately. After the duration, it automatically returns to batch mode.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRealtimeDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
