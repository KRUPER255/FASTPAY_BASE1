/**
 * Shows backend health status (database, firebase, redis) from GET /api/health/?detailed=1
 */
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/component/ui/card'
import { getApiUrl } from '@/lib/api-client'
import { Activity, Database, Server, HardDrive } from 'lucide-react'

interface HealthComponent {
  status: string
  error?: string
}

interface HealthResponse {
  status?: string
  overall?: string
  database?: HealthComponent
  firebase?: HealthComponent
  redis?: HealthComponent
}

const statusColor = (status: string) => {
  if (status === 'healthy') return 'text-green-600 dark:text-green-400'
  if (status === 'unhealthy') return 'text-red-600 dark:text-red-400'
  return 'text-muted-foreground'
}

export function SystemStatusWidget() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const url = getApiUrl('/health/?detailed=1')
    fetch(url, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`${res.status}`))))
      .then((data: HealthResponse) => {
        if (!cancelled) setHealth(data)
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            System status
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Loading…
        </CardContent>
      </Card>
    )
  }

  if (error || !health) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            System status
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-red-600 dark:text-red-400">
          Unable to load ({error || 'No data'})
        </CardContent>
      </Card>
    )
  }

  const db = health.database?.status ?? '?'
  const fb = health.firebase?.status ?? '?'
  const redis = health.redis?.status ?? '?'

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4" />
          System status
          {health.overall === 'degraded' && (
            <span className="text-amber-600 dark:text-amber-400 text-xs">(degraded)</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3 text-sm">
        <span className="flex items-center gap-1.5" title="Database">
          <Database className="h-4 w-4" />
          <span className={statusColor(db)}>DB: {db}</span>
        </span>
        <span className="flex items-center gap-1.5" title="Firebase">
          <Server className="h-4 w-4" />
          <span className={statusColor(fb)}>Firebase: {fb}</span>
        </span>
        <span className="flex items-center gap-1.5" title="Redis/Cache">
          <HardDrive className="h-4 w-4" />
          <span className={statusColor(redis)}>Redis: {redis}</span>
        </span>
      </CardContent>
    </Card>
  )
}
