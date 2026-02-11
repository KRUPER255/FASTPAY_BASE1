import { useEffect, useState } from 'react'
import { getSession, clearSession } from '@/lib/auth'
import { useNavigate } from 'react-router-dom'
import { UnifiedLayout } from '@/component/UnifiedLayout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/component/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/component/ui/table'
import { Button } from '@/component/ui/button'
import { Badge } from '@/component/ui/badge'
import { Input } from '@/component/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/component/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/component/ui/dialog'
import {
  Database,
  RefreshCw,
  Trash2,
  Filter,
  Search,
  X,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ExternalLink,
} from 'lucide-react'
import { djangoApiLogger, type DjangoApiLog } from '@/lib/django-api-logger'
import { formatDistanceToNow } from 'date-fns'

interface DjangoLogsProps {
  onLogout: () => void
}

export default function DjangoLogs({ onLogout }: DjangoLogsProps) {
  const navigate = useNavigate()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [logs, setLogs] = useState<DjangoApiLog[]>([])
  const [filteredLogs, setFilteredLogs] = useState<DjangoApiLog[]>([])
  const [selectedLog, setSelectedLog] = useState<DjangoApiLog | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [methodFilter, setMethodFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [errorFilter, setErrorFilter] = useState<string>('all')

  useEffect(() => {
    const session = getSession()
    if (session) {
      setUserEmail(session.email)
    }

    // Initialize logger and load logs
    const initialLogs = djangoApiLogger.getLogs()
    setLogs(initialLogs)
    setFilteredLogs(initialLogs)

    // Subscribe to log updates
    const unsubscribe = djangoApiLogger.subscribe((updatedLogs) => {
      setLogs(updatedLogs)
      applyFilters(updatedLogs, searchQuery, methodFilter, statusFilter, errorFilter)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    applyFilters(logs, searchQuery, methodFilter, statusFilter, errorFilter)
  }, [searchQuery, methodFilter, statusFilter, errorFilter, logs])

  const applyFilters = (
    logsToFilter: DjangoApiLog[],
    query: string,
    method: string,
    status: string,
    error: string
  ) => {
    let filtered = [...logsToFilter]

    // Search filter
    if (query) {
      const lowerQuery = query.toLowerCase()
      filtered = filtered.filter(
        (log) =>
          log.url.toLowerCase().includes(lowerQuery) ||
          log.method.toLowerCase().includes(lowerQuery) ||
          (log.statusText && log.statusText.toLowerCase().includes(lowerQuery)) ||
          (log.error && log.error.toLowerCase().includes(lowerQuery))
      )
    }

    // Method filter
    if (method !== 'all') {
      filtered = filtered.filter((log) => log.method === method)
    }

    // Status filter
    if (status !== 'all') {
      if (status === 'success') {
        filtered = filtered.filter((log) => log.status !== undefined && log.status >= 200 && log.status < 300)
      } else if (status === 'error') {
        filtered = filtered.filter((log) => log.status !== undefined && log.status >= 400)
      } else if (status === 'pending') {
        filtered = filtered.filter((log) => log.status === undefined)
      }
    }

    // Error filter
    if (error === 'errors-only') {
      filtered = filtered.filter((log) => log.error || (log.status !== undefined && log.status >= 400))
    } else if (error === 'success-only') {
      filtered = filtered.filter((log) => !log.error && log.status !== undefined && log.status < 400)
    }

    setFilteredLogs(filtered)
  }

  const handleLogout = () => {
    clearSession()
    if (onLogout) {
      onLogout()
    }
    navigate('/login')
  }

  const handleClearLogs = () => {
    if (confirm('Are you sure you want to clear all logs?')) {
      djangoApiLogger.clearLogs()
    }
  }

  const getStatusBadge = (log: DjangoApiLog) => {
    if (log.error) {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Error
        </Badge>
      )
    }
    if (log.status === undefined) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      )
    }
    if (log.status >= 200 && log.status < 300) {
      return (
        <Badge variant="default" className="gap-1 bg-green-600">
          <CheckCircle2 className="h-3 w-3" />
          {log.status}
        </Badge>
      )
    }
    if (log.status >= 400) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          {log.status}
        </Badge>
      )
    }
    return (
      <Badge variant="secondary">
        {log.status}
      </Badge>
    )
  }

  const formatTime = (timestamp: number) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
  }

  const formatResponseTime = (time?: number) => {
    if (!time) return 'N/A'
    if (time < 1000) return `${Math.round(time)}ms`
    return `${(time / 1000).toFixed(2)}s`
  }

  const truncateUrl = (url: string, maxLength: number = 60) => {
    if (url.length <= maxLength) return url
    return url.substring(0, maxLength) + '...'
  }

  return (
    <UnifiedLayout
      showAdminFeatures={true}
      selectedDeviceId={null}
      devices={[]}
      taglineMap={new Map()}
      title="Django API Logs"
      description="Monitor Django API calls and responses"
      userEmail={userEmail}
      onLogout={handleLogout}
      userAccessLevel={0}
    >
      {() => (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Django API Logs
                  </CardTitle>
                  <CardDescription className="mt-2">
                    Real-time monitoring of Django API calls and responses
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const updatedLogs = djangoApiLogger.getLogs()
                      setLogs(updatedLogs)
                      applyFilters(updatedLogs, searchQuery, methodFilter, statusFilter, errorFilter)
                    }}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleClearLogs}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-wrap gap-4 mb-4 pb-4 border-b">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search logs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <Select value={methodFilter} onValueChange={setMethodFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="success">Success (2xx)</SelectItem>
                    <SelectItem value="error">Error (4xx+)</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={errorFilter} onValueChange={setErrorFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Errors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="errors-only">Errors Only</SelectItem>
                    <SelectItem value="success-only">Success Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Logs Table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Time</TableHead>
                      <TableHead className="w-[80px]">Method</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="w-[100px]">Response Time</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          {logs.length === 0
                            ? 'No API calls logged yet. Django API calls will appear here automatically.'
                            : 'No logs match the current filters.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLogs.map((log) => (
                        <TableRow key={log.id} className="hover:bg-muted/50">
                          <TableCell className="text-xs text-muted-foreground">
                            {formatTime(log.timestamp)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.method}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {truncateUrl(log.url)}
                          </TableCell>
                          <TableCell>{getStatusBadge(log)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatResponseTime(log.responseTime)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedLog(log)}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Summary */}
              <div className="mt-4 text-sm text-muted-foreground">
                Showing {filteredLogs.length} of {logs.length} logs
              </div>
            </CardContent>
          </Card>

          {/* Log Detail Dialog */}
          <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>API Call Details</DialogTitle>
                <DialogDescription>
                  {selectedLog && formatTime(selectedLog.timestamp)}
                </DialogDescription>
              </DialogHeader>
              {selectedLog && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Request</h4>
                    <div className="space-y-2">
                      <div>
                        <span className="text-muted-foreground">Method: </span>
                        <Badge>{selectedLog.method}</Badge>
                      </div>
                      <div>
                        <span className="text-muted-foreground">URL: </span>
                        <code className="text-sm bg-muted p-1 rounded">{selectedLog.url}</code>
                      </div>
                      {selectedLog.requestHeaders && (
                        <div>
                          <span className="text-muted-foreground">Headers: </span>
                          <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                            {JSON.stringify(selectedLog.requestHeaders, null, 2)}
                          </pre>
                        </div>
                      )}
                      {selectedLog.requestBody && (
                        <div>
                          <span className="text-muted-foreground">Body: </span>
                          <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                            {JSON.stringify(selectedLog.requestBody, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Response</h4>
                    <div className="space-y-2">
                      {selectedLog.status !== undefined && (
                        <div>
                          <span className="text-muted-foreground">Status: </span>
                          {getStatusBadge(selectedLog)}
                          {selectedLog.statusText && (
                            <span className="ml-2 text-muted-foreground">
                              {selectedLog.statusText}
                            </span>
                          )}
                        </div>
                      )}
                      {selectedLog.responseTime !== undefined && (
                        <div>
                          <span className="text-muted-foreground">Response Time: </span>
                          {formatResponseTime(selectedLog.responseTime)}
                        </div>
                      )}
                      {selectedLog.error && (
                        <div>
                          <span className="text-muted-foreground">Error: </span>
                          <span className="text-destructive">{selectedLog.error}</span>
                        </div>
                      )}
                      {selectedLog.responseBody && (
                        <div>
                          <span className="text-muted-foreground">Body: </span>
                          <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto max-h-96">
                            {JSON.stringify(selectedLog.responseBody, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      )}
    </UnifiedLayout>
  )
}
