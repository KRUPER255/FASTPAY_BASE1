import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/component/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/component/ui/table'
import { Button } from '@/component/ui/button'
import { Badge } from '@/component/ui/badge'
import { Skeleton } from '@/component/ui/skeleton'
import { RefreshCw, FileText } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { getApiUrl } from '@/lib/api-client'

interface ApiRequestLogRow {
  id: number
  method: string
  path: string
  status_code: number | null
  response_time_ms: number | null
  created_at: string
  user_identifier?: string | null
  client_ip?: string | null
}

export function ApiLogSection() {
  const [logs, setLogs] = useState<ApiRequestLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(getApiUrl('/api-request-logs/?limit=20'), {
        credentials: 'include',
      })
      if (!response.ok) {
        throw new Error('Failed to fetch API logs')
      }
      const json = await response.json()
      const list = json.data ?? json.results ?? []
      setLogs(Array.isArray(list) ? list : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch API logs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const getStatusVariant = (status: number | null) => {
    if (status == null) return 'secondary'
    if (status >= 200 && status < 300) return 'default'
    if (status >= 400) return 'destructive'
    return 'secondary'
  }

  if (loading && logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            API Log
          </CardTitle>
          <CardDescription>Latest 20 API requests. No pagination.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error && logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            API Log
          </CardTitle>
          <CardDescription>Latest 20 API requests. No pagination.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive mb-4">{error}</p>
          <Button onClick={fetchLogs} variant="outline" size="sm">
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            API Log
          </CardTitle>
          <CardDescription>Latest 20 API requests. No pagination.</CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchLogs}
          disabled={loading}
          className="shrink-0"
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No API logs.</p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Method</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead className="w-[90px]">Status</TableHead>
                  <TableHead className="w-[90px]">Time (ms)</TableHead>
                  <TableHead className="w-[140px]">Created</TableHead>
                  <TableHead className="w-[120px]">User</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">{log.method}</TableCell>
                    <TableCell className="font-mono text-xs truncate max-w-[200px]" title={log.path}>
                      {log.path}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(log.status_code)}>
                        {log.status_code ?? '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {log.response_time_ms != null ? log.response_time_ms : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {log.created_at
                        ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true })
                        : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs truncate max-w-[100px]" title={log.user_identifier ?? ''}>
                      {log.user_identifier || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
