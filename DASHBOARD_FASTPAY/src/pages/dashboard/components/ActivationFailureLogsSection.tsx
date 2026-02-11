import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/component/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/component/ui/table'
import { Button } from '@/component/ui/button'
import { Input } from '@/component/ui/input'
import { Skeleton } from '@/component/ui/skeleton'
import { Badge } from '@/component/ui/badge'
import { FeatureGate } from '@/component/FeatureGate'
import {
  AlertTriangle,
  RefreshCw,
  Filter,
  Search,
  X,
  Smartphone,
  Code,
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

interface ActivationFailureLog {
  id: number
  device_id: string
  code_attempted: string | null
  mode: 'testing' | 'running'
  error_type: string | null
  error_message: string | null
  metadata: Record<string, any>
  created_at: string
}

interface ActivationFailureLogsSectionProps {
  isAdmin: boolean
  deviceId?: string | null
}

export function ActivationFailureLogsSection({
  isAdmin,
  deviceId,
}: ActivationFailureLogsSectionProps) {
  const { toast } = useToast()
  const [logs, setLogs] = useState<ActivationFailureLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<string>('all')
  const [filterErrorType, setFilterErrorType] = useState<string>('all')
  const [selectedLog, setSelectedLog] = useState<ActivationFailureLog | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  const fetchLogs = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (deviceId) {
        params.append('device_id', deviceId)
      }
      if (filterMode !== 'all') {
        params.append('mode', filterMode)
      }
      if (filterErrorType !== 'all') {
        params.append('error_type', filterErrorType)
      }

      const response = await fetch(
        getApiUrl(`/activation-failure-logs/${params.toString() ? `?${params.toString()}` : ''}`)
      )
      
      if (!response.ok) {
        throw new Error('Failed to fetch activation failure logs')
      }

      const data = await response.json()
      setLogs(Array.isArray(data) ? data : data.results || [])
    } catch (err) {
      console.error('Error fetching activation failure logs:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch logs')
      toast({
        title: 'Error',
        description: 'Failed to fetch activation failure logs',
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
  }, [isAdmin, deviceId, filterMode, filterErrorType])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchLogs()
  }

  const filteredLogs = useMemo(() => {
    if (!searchQuery) return logs

    const query = searchQuery.toLowerCase()
    return logs.filter(log =>
      log.device_id?.toLowerCase().includes(query) ||
      log.code_attempted?.toLowerCase().includes(query) ||
      log.error_type?.toLowerCase().includes(query) ||
      log.error_message?.toLowerCase().includes(query)
    )
  }, [logs, searchQuery])

  const errorTypes = useMemo(() => {
    const types = new Set<string>()
    logs.forEach(log => {
      if (log.error_type) types.add(log.error_type)
    })
    return Array.from(types).sort()
  }, [logs])

  const summary = useMemo(() => {
    const total = logs.length
    const testing = logs.filter(log => log.mode === 'testing').length
    const running = logs.filter(log => log.mode === 'running').length
    const latest = logs[0]?.created_at || null
    return { total, testing, running, latest }
  }, [logs])

  const getModeBadgeVariant = (mode: string) => {
    return mode === 'testing' ? 'secondary' : 'default'
  }

  const getErrorTypeBadgeVariant = (errorType: string | null) => {
    if (!errorType) return 'outline'
    if (errorType.includes('validation')) return 'destructive'
    if (errorType.includes('network')) return 'secondary'
    return 'outline'
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
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Admin access required to view activation failure logs</p>
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
                <AlertTriangle className="h-5 w-5 text-primary" />
                Activation Failure Logs
              </CardTitle>
              <CardDescription>
                Review failed activations across devices, with filters for mode and error types.
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
              <span className="text-muted-foreground">Testing</span>
              <div className="text-sm font-semibold">{summary.testing}</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
              <span className="text-muted-foreground">Running</span>
              <div className="text-sm font-semibold">{summary.running}</div>
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
            <Select value={filterMode} onValueChange={setFilterMode}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modes</SelectItem>
                <SelectItem value="testing">Testing</SelectItem>
                <SelectItem value="running">Running</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterErrorType} onValueChange={setFilterErrorType}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Error Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Error Types</SelectItem>
                {errorTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
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
              <p>No activation failure logs found</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device ID</TableHead>
                    <TableHead>Code/Phone</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Error Type</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm">
                        {log.device_id || <span className="text-muted-foreground">N/A</span>}
                      </TableCell>
                      <TableCell>
                        {log.code_attempted || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getModeBadgeVariant(log.mode)}>
                          {log.mode}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {log.error_type ? (
                          <Badge variant={getErrorTypeBadgeVariant(log.error_type)}>
                            {log.error_type}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
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
            <DialogTitle>Activation Failure Details</DialogTitle>
            <DialogDescription>Detailed information about the activation failure</DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Device ID</label>
                  <p className="font-mono text-sm">{selectedLog.device_id || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Code/Phone</label>
                  <p>{selectedLog.code_attempted || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Mode</label>
                  <Badge variant={getModeBadgeVariant(selectedLog.mode)}>
                    {selectedLog.mode}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Error Type</label>
                  {selectedLog.error_type ? (
                    <Badge variant={getErrorTypeBadgeVariant(selectedLog.error_type)}>
                      {selectedLog.error_type}
                    </Badge>
                  ) : (
                    <p className="text-muted-foreground">N/A</p>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Error Message</label>
                  <p className="text-sm whitespace-pre-wrap">{selectedLog.error_message || 'N/A'}</p>
                </div>
                <div className="col-span-2">
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
