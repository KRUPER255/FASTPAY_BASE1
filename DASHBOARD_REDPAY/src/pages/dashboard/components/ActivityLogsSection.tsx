import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/component/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/component/ui/table'
import { Button } from '@/component/ui/button'
import { Input } from '@/component/ui/input'
import { Skeleton } from '@/component/ui/skeleton'
import { Badge } from '@/component/ui/badge'
import { FeatureGate } from '@/component/FeatureGate'
import {
  Activity,
  RefreshCw,
  Filter,
  Search,
  User,
  Shield,
  Key,
  Edit,
  UserCircle,
  AlertCircle,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useToast } from '@/lib/use-toast'
import { getApiUrl } from '@/lib/api-client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/component/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/component/ui/dialog'

interface ActivityLog {
  id: number
  user_email: string
  activity_type: string
  activity_type_display: string
  description: string | null
  ip_address: string | null
  created_at: string
  metadata: Record<string, any>
}

interface ActivityLogsSectionProps {
  isAdmin: boolean
  userEmail?: string | null
}

export function ActivityLogsSection({
  isAdmin,
  userEmail,
}: ActivityLogsSectionProps) {
  const { toast } = useToast()
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterActivityType, setFilterActivityType] = useState<string>('all')
  const [filterUserEmail, setFilterUserEmail] = useState<string>(userEmail || 'all')
  const [limit, setLimit] = useState<number>(50)
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  const fetchLogs = async () => {
    setLoading(true)
    setError(null)
    try {
      const body: any = {
        limit: limit,
      }

      if (filterUserEmail && filterUserEmail !== 'all') {
        body.email = filterUserEmail
      }

      if (filterActivityType && filterActivityType !== 'all') {
        body.activity_type = filterActivityType
      }

      const response = await fetch(getApiUrl('/dashboard-activity-logs/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch activity logs')
      }

      const data = await response.json()
      setLogs(data.logs || [])
    } catch (err) {
      console.error('Error fetching activity logs:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch logs')
      toast({
        title: 'Error',
        description: 'Failed to fetch activity logs',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      fetchLogs()
    }
  }, [isAdmin, filterActivityType, filterUserEmail, limit])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchLogs()
  }

  const filteredLogs = useMemo(() => {
    if (!searchQuery) return logs

    const query = searchQuery.toLowerCase()
    return logs.filter(log =>
      log.user_email?.toLowerCase().includes(query) ||
      log.description?.toLowerCase().includes(query) ||
      log.activity_type_display?.toLowerCase().includes(query) ||
      log.ip_address?.toLowerCase().includes(query)
    )
  }, [logs, searchQuery])

  const activityTypes = useMemo(() => {
    const types = new Set<string>()
    logs.forEach(log => {
      types.add(log.activity_type)
    })
    return Array.from(types).sort()
  }, [logs])

  const userEmails = useMemo(() => {
    const emails = new Set<string>()
    logs.forEach(log => {
      if (log.user_email) emails.add(log.user_email)
    })
    return Array.from(emails).sort()
  }, [logs])

  const summary = useMemo(() => {
    const total = logs.length
    const logins = logs.filter(log => log.activity_type === 'login').length
    const resets = logs.filter(log => log.activity_type === 'password_reset').length
    const latest = logs[0]?.created_at || null
    return { total, logins, resets, latest }
  }, [logs])

  const getActivityIcon = (activityType: string) => {
    switch (activityType) {
      case 'login':
        return <User className="h-4 w-4" />
      case 'logout':
        return <User className="h-4 w-4" />
      case 'password_reset':
        return <Key className="h-4 w-4" />
      case 'profile_update':
        return <Edit className="h-4 w-4" />
      case 'access_level_change':
        return <Shield className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  const getActivityBadgeVariant = (activityType: string) => {
    switch (activityType) {
      case 'login':
        return 'default'
      case 'password_reset':
        return 'secondary'
      case 'access_level_change':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true })
    } catch {
      return dateString
    }
  }

  if (!isAdmin) {
    return (
      <FeatureGate adminOnly={true}>
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Admin access required to view activity logs</p>
          </CardContent>
        </Card>
      </FeatureGate>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="p-5 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-primary" />
                Activity Logs
              </CardTitle>
              <CardDescription>
                Track admin actions and security events with fast filtering and summaries.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing || loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
              <span className="text-muted-foreground">Total</span>
              <div className="text-sm font-semibold">{summary.total}</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
              <span className="text-muted-foreground">Logins</span>
              <div className="text-sm font-semibold">{summary.logins}</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
              <span className="text-muted-foreground">Resets</span>
              <div className="text-sm font-semibold">{summary.resets}</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
              <span className="text-muted-foreground">Latest</span>
              <div className="text-sm font-semibold">
                {summary.latest ? formatDate(summary.latest) : '—'}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-4 rounded-lg border border-border/50 bg-muted/20 p-3">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={filterActivityType} onValueChange={setFilterActivityType}>
              <SelectTrigger className="w-[190px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Activity Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Activities</SelectItem>
                {activityTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {logs.find(l => l.activity_type === type)?.activity_type_display || type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterUserEmail} onValueChange={setFilterUserEmail}>
              <SelectTrigger className="w-[220px]">
                <UserCircle className="h-4 w-4 mr-2" />
                <SelectValue placeholder="User" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {userEmails.map(email => (
                  <SelectItem key={email} value={email}>{email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={limit.toString()} onValueChange={(v) => setLimit(parseInt(v))}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Table */}
          {loading && !logs.length ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No activity logs found</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Activity</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getActivityIcon(log.activity_type)}
                          <Badge variant={getActivityBadgeVariant(log.activity_type)}>
                            {log.activity_type_display}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{log.user_email}</TableCell>
                      <TableCell className="max-w-md truncate">
                        {log.description || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.ip_address || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(log.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedLog(log)
                            setShowDetails(true)
                          }}
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Results count */}
          {filteredLogs.length > 0 && (
            <div className="mt-4 text-sm text-muted-foreground">
              Showing {filteredLogs.length} of {logs.length} logs
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Activity Log Details</DialogTitle>
            <DialogDescription>Detailed information about the activity</DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">User Email</label>
                  <p className="font-medium">{selectedLog.user_email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Activity Type</label>
                  <Badge variant={getActivityBadgeVariant(selectedLog.activity_type)}>
                    {selectedLog.activity_type_display}
                  </Badge>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Description</label>
                  <p className="text-sm whitespace-pre-wrap">{selectedLog.description || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">IP Address</label>
                  <p className="font-mono text-sm">{selectedLog.ip_address || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created At</label>
                  <p className="text-sm">{new Date(selectedLog.created_at).toLocaleString('en-US')}</p>
                </div>
                {Object.keys(selectedLog.metadata || {}).length > 0 && (
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">Metadata</label>
                    <pre className="mt-2 p-3 rounded-md bg-muted text-xs overflow-auto">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
