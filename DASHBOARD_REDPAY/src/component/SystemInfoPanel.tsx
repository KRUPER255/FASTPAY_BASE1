import { useEffect, useState } from 'react'
import { onValue, off, get, query, orderByKey, limitToLast } from 'firebase/database'
import {
  getDeviceSystemInfoPath,
  getDeviceMetadataPath,
  getDeviceCommandsPath,
} from '@/lib/firebase-helpers'
import type {
  SystemInfo,
  BatteryInfo,
  NetworkInfo,
  SimInfo,
  BuildInfo,
} from '@/lib/system-info-types'
import SystemInfoSection from './SystemInfoSection'
import { Button } from '@/component/ui/button'
import { Skeleton } from '@/component/ui/skeleton'
import {
  Monitor,
  RefreshCw,
  AlertCircle,
  Search,
  Filter,
  Cpu,
  HardDrive,
  Battery,
  Wifi,
  Smartphone,
  Settings,
  Code,
  Zap,
  Power,
  Activity,
  Gauge,
  Database,
} from 'lucide-react'
import { useToast } from '@/lib/use-toast'
import { retryWithBackoff, isRetryableError } from '@/lib/retry-utils'
import { set } from 'firebase/database'
import { Input } from '@/component/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/component/ui/card'
import { Badge } from '@/component/ui/badge'

interface SystemInfoPanelProps {
  deviceId: string | null
}

type DeviceInfoFetch = {
  battery?: BatteryInfo
  network?: NetworkInfo
  sim?: SimInfo
  device?: BuildInfo
}

export default function SystemInfoPanel({ deviceId }: SystemInfoPanelProps) {
  const { toast } = useToast()
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [deviceInfoFetch, setDeviceInfoFetch] = useState<DeviceInfoFetch | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch system info from Firebase
  useEffect(() => {
    if (!deviceId) {
      setSystemInfo(null)
      setDeviceInfoFetch(null)
      setLoading(false)
      setError(null)
      return
    }

    let isMounted = true
    let unsubscribe: (() => void) | null = null

    const systemInfoRef = getDeviceSystemInfoPath(deviceId)

    // Fast initial load
    const loadInitialData = async () => {
      try {
        setLoading(true)
        setError(null)

        const snapshot = await retryWithBackoff(() => get(systemInfoRef), {
          maxAttempts: 3,
          initialDelay: 300,
          retryable: isRetryableError,
        })

        if (!isMounted) return

        if (!snapshot.exists()) {
          setSystemInfo(null)
          setLoading(false)
          return
        }

        const data = snapshot.val() as SystemInfo
        setSystemInfo(data)
        setLoading(false)
      } catch (err) {
        if (!isMounted) return
        console.error('Error loading system info:', err)
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to load system information'
        setError(errorMessage)
        setLoading(false)
        toast({
          title: 'Error loading system info',
          description: errorMessage,
          variant: 'destructive',
        })
      }
    }

    // Set up real-time listener
    const setupRealtimeListener = () => {
      unsubscribe = onValue(
        systemInfoRef,
        snapshot => {
          if (!isMounted) return
          try {
            if (snapshot.exists()) {
              const data = snapshot.val() as SystemInfo
              setSystemInfo(data)
              setError(null)
            } else {
              setSystemInfo(null)
            }
          } catch (err) {
            console.error('Error processing system info:', err)
            const errorMessage =
              err instanceof Error ? err.message : 'Failed to process system information'
            setError(errorMessage)
          }
        },
        error => {
          if (!isMounted) return
          console.error('Error listening to system info:', error)
          const errorMessage = error.message || 'Failed to fetch system information'
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
        off(systemInfoRef)
      }
    }
  }, [deviceId, toast])

  // Fetch latest deviceInfo fetch data
  useEffect(() => {
    if (!deviceId) {
      setDeviceInfoFetch(null)
      return
    }

    let isMounted = true

    const fetchLatestDeviceInfo = async () => {
      try {
        // List all deviceInfo/fetch_* entries and get the latest one
        const deviceInfoRef = getDeviceSystemInfoPath(deviceId, 'deviceInfo')

        // Note: We can't easily list all fetch_* entries without knowing their names
        // For now, we'll fetch from systemInfo directly
        // The fetchDeviceInfo command writes to deviceInfo/fetch_{timestamp}
        // We'll merge this data if available

        // This is a simplified approach - in production, you might want to:
        // 1. Keep track of the latest fetch timestamp
        // 2. Or listen to all deviceInfo/fetch_* entries
        // 3. Or fetch the latest one by querying with limitToLast
      } catch (err) {
        if (!isMounted) return
        console.error('Error fetching device info:', err)
      }
    }

    fetchLatestDeviceInfo()

    return () => {
      isMounted = false
    }
  }, [deviceId])

  // Handle fetch device info command
  const handleFetchDeviceInfo = async () => {
    if (!deviceId) return

    try {
      setFetching(true)

      // Send fetchDeviceInfo command to Firebase
      const commandRef = getDeviceCommandsPath(deviceId, 'fetchDeviceInfo')
      await set(commandRef, 'true')

      toast({
        title: 'Device info fetch requested',
        description: 'Fetching device information from device...',
        variant: 'default',
      })

      // Command will be removed by device when processed
    } catch (err) {
      console.error('Error requesting device info:', err)
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to request device information'
      setFetching(false)
      toast({
        title: 'Error requesting device info',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      // Reset fetching state after a delay (device will process command)
      setTimeout(() => setFetching(false), 2000)
    }
  }

  // Handle refresh
  const handleRefresh = async () => {
    if (!deviceId) return

    try {
      setLoading(true)
      setError(null)

      const systemInfoRef = getDeviceSystemInfoPath(deviceId)

      const snapshot = await retryWithBackoff(() => get(systemInfoRef), {
        maxAttempts: 3,
        initialDelay: 300,
        retryable: isRetryableError,
      })

      if (!snapshot.exists()) {
        setSystemInfo(null)
        setLoading(false)
        return
      }

      const data = snapshot.val() as SystemInfo
      setSystemInfo(data)
      setLoading(false)

      toast({
        title: 'System info refreshed',
        description: 'System information has been updated',
        variant: 'default',
      })
    } catch (err) {
      console.error('Error refreshing system info:', err)
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to refresh system information'
      setError(errorMessage)
      setLoading(false)
      toast({
        title: 'Error refreshing system info',
        description: errorMessage,
        variant: 'destructive',
      })
    }
  }

  // Filter sections by search query
  const filteredSystemInfo = systemInfo
    ? Object.entries(systemInfo)
        .filter(([key, value]) => {
          if (!searchQuery.trim()) return true
          const query = searchQuery.toLowerCase()
          const keyLower = key.toLowerCase()
          if (keyLower.includes(query)) return true
          if (value && typeof value === 'object') {
            return JSON.stringify(value).toLowerCase().includes(query)
          }
          return false
        })
        .reduce((acc, [key, value]) => {
          ;(acc as any)[key] = value
          return acc
        }, {} as SystemInfo)
    : null

  // Count available sections
  const sectionCount = systemInfo ? Object.keys(systemInfo).length : 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Monitor className="h-6 w-6" />
            System Information
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            View detailed device system information ({sectionCount} sections available)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleFetchDeviceInfo}
            disabled={fetching || !deviceId}
          >
            {fetching ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Fetching...
              </>
            ) : (
              <>
                <Activity className="h-4 w-4 mr-2" />
                Fetch Device Info
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

      {/* Search */}
      {systemInfo && sectionCount > 0 && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search system info..."
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
              <p className="font-semibold">Error loading system info</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} className="mt-2">
            Retry
          </Button>
        </div>
      )}

      {/* Loading State */}
      {loading && !systemInfo && (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && !systemInfo && (
        <div className="p-8 text-center text-muted-foreground">
          <Monitor className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">No system information available</p>
          <p className="text-sm mt-2">
            System information will appear here when fetched from device
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleFetchDeviceInfo}
            disabled={fetching || !deviceId}
            className="mt-4"
          >
            {fetching ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Fetching...
              </>
            ) : (
              <>
                <Activity className="h-4 w-4 mr-2" />
                Fetch Device Info
              </>
            )}
          </Button>
        </div>
      )}

      {/* System Info Sections */}
      {!loading && filteredSystemInfo && sectionCount > 0 && (
        <div className="space-y-4">
          {searchQuery && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span>
                Showing {Object.keys(filteredSystemInfo).length} of {sectionCount} sections
              </span>
            </div>
          )}

          {filteredSystemInfo.buildInfo && (
            <SystemInfoSection
              title="Build Information"
              data={filteredSystemInfo.buildInfo}
              icon={Code}
              defaultCollapsed={false}
            />
          )}

          {filteredSystemInfo.displayInfo && (
            <SystemInfoSection
              title="Display Information"
              data={filteredSystemInfo.displayInfo}
              icon={Monitor}
              defaultCollapsed={true}
            />
          )}

          {filteredSystemInfo.storageInfo && (
            <SystemInfoSection
              title="Storage Information"
              data={filteredSystemInfo.storageInfo}
              icon={HardDrive}
              defaultCollapsed={true}
            />
          )}

          {filteredSystemInfo.memoryInfo && (
            <SystemInfoSection
              title="Memory Information"
              data={filteredSystemInfo.memoryInfo}
              icon={Database}
              defaultCollapsed={true}
            />
          )}

          {filteredSystemInfo.batteryInfo && (
            <SystemInfoSection
              title="Battery Information"
              data={filteredSystemInfo.batteryInfo}
              icon={Battery}
              defaultCollapsed={false}
            />
          )}

          {filteredSystemInfo.networkInfo && (
            <SystemInfoSection
              title="Network Information"
              data={filteredSystemInfo.networkInfo}
              icon={Wifi}
              defaultCollapsed={false}
            />
          )}

          {filteredSystemInfo.phoneSimInfo && (
            <SystemInfoSection
              title="SIM/Phone Information"
              data={filteredSystemInfo.phoneSimInfo}
              icon={Smartphone}
              defaultCollapsed={true}
            />
          )}

          {filteredSystemInfo.systemSettings && (
            <SystemInfoSection
              title="System Settings"
              data={filteredSystemInfo.systemSettings}
              icon={Settings}
              defaultCollapsed={true}
            />
          )}

          {filteredSystemInfo.runtimeInfo && (
            <SystemInfoSection
              title="Runtime Information"
              data={filteredSystemInfo.runtimeInfo}
              icon={Activity}
              defaultCollapsed={true}
            />
          )}

          {filteredSystemInfo.deviceFeatures && (
            <SystemInfoSection
              title="Device Features"
              data={filteredSystemInfo.deviceFeatures}
              icon={Zap}
              defaultCollapsed={true}
            />
          )}

          {filteredSystemInfo.powerManagement && (
            <SystemInfoSection
              title="Power Management"
              data={filteredSystemInfo.powerManagement}
              icon={Power}
              defaultCollapsed={true}
            />
          )}

          {filteredSystemInfo.bootInfo && (
            <SystemInfoSection
              title="Boot Information"
              data={filteredSystemInfo.bootInfo}
              icon={Activity}
              defaultCollapsed={true}
            />
          )}

          {filteredSystemInfo.performanceMetrics && (
            <SystemInfoSection
              title="Performance Metrics"
              data={filteredSystemInfo.performanceMetrics}
              icon={Gauge}
              defaultCollapsed={true}
            />
          )}
        </div>
      )}

      {/* No Results */}
      {!loading &&
        searchQuery &&
        filteredSystemInfo &&
        Object.keys(filteredSystemInfo).length === 0 &&
        systemInfo && (
          <div className="p-8 text-center text-muted-foreground">
            <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No sections match your search</p>
            <p className="text-sm mt-2">Try a different search term</p>
          </div>
        )}
    </div>
  )
}
