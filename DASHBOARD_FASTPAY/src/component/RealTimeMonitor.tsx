import { useEffect, useState, useMemo } from 'react'
import { ref, onValue, off, get } from 'firebase/database'
import {
  getDeviceMetadataPath,
  getHeartbeatsPath,
  getDeviceMessagesPath,
} from '@/lib/firebase-helpers'
import { Badge } from '@/component/ui/badge'
import { Button } from '@/component/ui/button'
import { Input } from '@/component/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/component/ui/select'
import { Skeleton } from '@/component/ui/skeleton'
import {
  Battery,
  Activity,
  Wifi,
  WifiOff,
  Smartphone,
  Clock,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  MessageSquare,
  Bell,
  Search,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface DeviceStatus {
  deviceId: string
  name?: string
  isActive?: boolean
  lastSeen?: number
  batteryPercentage?: number
  phone?: string
  isOnline: boolean
}

interface RealTimeMonitorProps {
  deviceId?: string | null
  refreshInterval?: number // in milliseconds
}

interface ActivityEvent {
  deviceId: string
  type: 'sms' | 'notification' | 'status_change'
  message: string
  timestamp: number
}

export default function RealTimeMonitor({
  deviceId,
  refreshInterval = 10000,
}: RealTimeMonitorProps) {
  const [devices, setDevices] = useState<DeviceStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'offline' | 'inactive'>('all')
  const [showHealthAlerts, setShowHealthAlerts] = useState(true)

  useEffect(() => {
    if (deviceId) {
      // Monitor single device
      monitorSingleDevice(deviceId)
    } else {
      // Monitor all devices
      monitorAllDevices()
    }

    return () => {
      // Cleanup will be handled by off() calls in monitoring functions
    }
  }, [deviceId])

  const monitorSingleDevice = (targetDeviceId: string) => {
    // OPTIMIZED: Use heartbeat path for status, load metadata separately
    const heartbeatRef = getHeartbeatsPath(targetDeviceId)
    let metadataLoaded = false

    const loadMetadata = async () => {
      if (metadataLoaded) return
      try {
        const [nameRef, phoneRef, isActiveRef, lastSeenRef] = [
          getDeviceMetadataPath(targetDeviceId, 'name'),
          getDeviceMetadataPath(targetDeviceId, 'phone'),
          getDeviceMetadataPath(targetDeviceId, 'isActive'),
          getDeviceMetadataPath(targetDeviceId, 'lastSeen'),
        ]

        const [nameSnap, phoneSnap, isActiveSnap, lastSeenSnap] = await Promise.all([
          get(nameRef).catch(() => null),
          get(phoneRef).catch(() => null),
          get(isActiveRef).catch(() => null),
          get(lastSeenRef).catch(() => null),
        ])

        const heartbeatSnap = await get(heartbeatRef).catch(() => null)
        const heartbeat = heartbeatSnap?.exists() ? heartbeatSnap.val() : null
        const lastSeen = heartbeat?.t || (lastSeenSnap?.exists() ? lastSeenSnap.val() : Date.now())
        const timeSinceLastSeen = Date.now() - lastSeen
        const isOnline = timeSinceLastSeen < 300000 // 5 minutes

        setDevices([
          {
            deviceId: targetDeviceId,
            name: nameSnap?.exists() ? nameSnap.val() : targetDeviceId,
            isActive: isActiveSnap?.exists()
              ? isActiveSnap.val() === 'Opened' || isActiveSnap.val() === true
              : undefined,
            lastSeen,
            batteryPercentage: heartbeat?.b,
            phone: phoneSnap?.exists() ? phoneSnap.val() : undefined,
            isOnline,
          },
        ])
        metadataLoaded = true
        setLoading(false)
        setLastUpdate(new Date())
      } catch (error) {
        console.error('Error loading device metadata:', error)
        setLoading(false)
      }
    }

    // Load metadata once on mount
    loadMetadata()

    // Listen to heartbeat for real-time updates
    const unsubscribe = onValue(
      heartbeatRef,
      snapshot => {
        if (snapshot.exists()) {
          const heartbeat = snapshot.val()
          const lastSeen = heartbeat.t || Date.now()
          const timeSinceLastSeen = Date.now() - lastSeen
          const isOnline = timeSinceLastSeen < 300000 // 5 minutes

          setDevices(prev =>
            prev.map(device =>
              device.deviceId === targetDeviceId
                ? {
                    ...device,
                    lastSeen,
                    batteryPercentage: heartbeat.b,
                    isOnline,
                  }
                : device
            )
          )
          setLastUpdate(new Date())
        } else if (!metadataLoaded) {
          // Fallback to metadata path if heartbeat doesn't exist yet
          const deviceRef = getDeviceMetadataPath(targetDeviceId)
          get(deviceRef).then(snapshot => {
            if (snapshot.exists()) {
              const data = snapshot.val()
              const lastSeen = data.lastSeen || data.time || Date.now()
              const timeSinceLastSeen = Date.now() - lastSeen
              const isOnline = timeSinceLastSeen < 300000

              setDevices([
                {
                  deviceId: targetDeviceId,
                  name: data.name,
                  isActive: data.isActive === 'Opened' || data.isActive === true,
                  lastSeen,
                  batteryPercentage: data.batteryPercentage,
                  phone: data.phone,
                  isOnline,
                },
              ])
            }
            setLoading(false)
            setLastUpdate(new Date())
          })
        }
      },
      error => {
        console.error('Error monitoring heartbeat:', error)
        setLoading(false)
      }
    )

    return () => {
      off(heartbeatRef, 'value', unsubscribe)
    }
  }

  const monitorAllDevices = () => {
    // OPTIMIZED: Listen to lightweight heartbeat path instead of entire fastpay/ tree
    const heartbeatsRef = getHeartbeatsPath()

    // Cache for device metadata (name, phone, isActive) - doesn't change often
    const deviceMetadataCache = new Map<
      string,
      { name?: string; phone?: string; isActive?: boolean }
    >()

    // Load device metadata once (this is cached, doesn't change frequently)
    const loadDeviceMetadata = async (deviceId: string) => {
      if (deviceMetadataCache.has(deviceId)) {
        return deviceMetadataCache.get(deviceId)!
      }

      try {
        const [nameRef, phoneRef, isActiveRef] = [
          getDeviceMetadataPath(deviceId, 'name'),
          getDeviceMetadataPath(deviceId, 'phone'),
          getDeviceMetadataPath(deviceId, 'isActive'),
        ]

        const [nameSnap, phoneSnap, isActiveSnap] = await Promise.all([
          get(nameRef).catch(() => null),
          get(phoneRef).catch(() => null),
          get(isActiveRef).catch(() => null),
        ])

        const metadata = {
          name: nameSnap?.exists() ? nameSnap.val() : deviceId,
          phone: phoneSnap?.exists() ? phoneSnap.val() : undefined,
          isActive: isActiveSnap?.exists()
            ? isActiveSnap.val() === 'Opened' || isActiveSnap.val() === true
            : undefined,
        }

        deviceMetadataCache.set(deviceId, metadata)
        return metadata
      } catch (error) {
        console.error(`Error loading metadata for device ${deviceId}:`, error)
        return { name: deviceId, phone: undefined, isActive: undefined }
      }
    }

    const unsubscribe = onValue(
      heartbeatsRef,
      async snapshot => {
        if (!snapshot.exists()) {
          setDevices([])
          setLoading(false)
          return
        }

        const heartbeats = snapshot.val()
        const deviceStatuses: DeviceStatus[] = []

        // Process each heartbeat
        const devicePromises = Object.keys(heartbeats).map(async deviceId => {
          const heartbeat = heartbeats[deviceId]
          const lastSeen = heartbeat.t || Date.now() // "t" = timestamp
          const timeSinceLastSeen = Date.now() - lastSeen
          const isOnline = timeSinceLastSeen < 300000 // 5 minutes

          // Load metadata (cached, so subsequent calls are fast)
          const metadata = await loadDeviceMetadata(deviceId)

          return {
            deviceId,
            name: metadata.name || deviceId,
            isActive: metadata.isActive,
            lastSeen,
            batteryPercentage: heartbeat.b, // "b" = battery
            phone: metadata.phone,
            isOnline,
          }
        })

        const resolvedDevices = await Promise.all(devicePromises)

        // Sort by last seen (most recent first)
        resolvedDevices.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))
        setDevices(resolvedDevices)
        setLoading(false)
        setLastUpdate(new Date())
      },
      error => {
        console.error('Error monitoring heartbeats:', error)
        setLoading(false)
      }
    )

    return () => {
      off(heartbeatsRef, 'value', unsubscribe)
    }
  }

  const getBatteryColor = (percentage?: number) => {
    if (percentage === undefined || percentage < 0) return 'text-gray-400'
    if (percentage > 50) return 'text-green-500'
    if (percentage > 20) return 'text-yellow-500'
    return 'text-red-500'
  }

  const getBatteryVariant = (percentage?: number): 'default' | 'secondary' | 'destructive' => {
    if (percentage === undefined || percentage < 0) return 'secondary'
    if (percentage > 20) return 'default'
    return 'destructive'
  }

  const formatLastSeen = (timestamp?: number) => {
    if (!timestamp) return 'Never'
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
    } catch {
      return 'Unknown'
    }
  }

  if (loading && devices.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    )
  }

  // Health alerts
  const healthAlerts = useMemo(() => {
    const alerts: Array<{ deviceId: string; type: 'battery' | 'offline'; message: string }> = []
    const devicesArray = Array.isArray(devices) ? devices : []

    devicesArray.forEach(device => {
      // Battery low alert
      if (
        device.batteryPercentage !== undefined &&
        device.batteryPercentage < 20 &&
        device.isActive
      ) {
        alerts.push({
          deviceId: device.deviceId,
          type: 'battery',
          message: `Battery low: ${device.batteryPercentage}%`,
        })
      }

      // Offline too long alert
      if (device.lastSeen && device.isActive && !device.isOnline) {
        const hoursOffline = (Date.now() - device.lastSeen) / (1000 * 60 * 60)
        if (hoursOffline > 24) {
          alerts.push({
            deviceId: device.deviceId,
            type: 'offline',
            message: `Offline for ${Math.floor(hoursOffline)} hours`,
          })
        }
      }
    })

    return alerts
  }, [devices])

  // Filtered devices
  const filteredDevices = useMemo(() => {
    const devicesArray = Array.isArray(devices) ? devices : []
    let filtered = devicesArray

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        device =>
          device.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          device.deviceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
          device.phone?.includes(searchQuery)
      )
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(device => {
        if (filterStatus === 'online') return device.isOnline && device.isActive
        if (filterStatus === 'offline') return !device.isOnline && device.isActive
        if (filterStatus === 'inactive') return !device.isActive
        return true
      })
    }

    return filtered
  }, [devices, searchQuery, filterStatus])

  // Metrics
  const metrics = useMemo(() => {
    const devicesArray = Array.isArray(devices) ? devices : []
    const totalDevices = devicesArray.length
    const activeDevices = devicesArray.filter(d => d.isActive).length
    const batteryDevices = devicesArray.filter(d => d.batteryPercentage !== undefined)
    const avgBattery =
      batteryDevices.length > 0
        ? batteryDevices.reduce((sum, d) => sum + (d.batteryPercentage || 0), 0) / batteryDevices.length
        : 0

    return {
      totalDevices,
      activeDevices,
      avgBattery: Math.round(avgBattery),
    }
  }, [devices])

  const handleRefresh = () => {
    setLoading(true)
    // Force re-render by updating lastUpdate
    setLastUpdate(new Date())
    setTimeout(() => setLoading(false), 500)
  }

  const devicesArray = Array.isArray(devices) ? devices : []
  const onlineCount = devicesArray.filter(d => d.isOnline && d.isActive).length
  const offlineCount = devicesArray.filter(d => !d.isOnline && d.isActive).length
  const inactiveCount = devicesArray.filter(d => !d.isActive).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          <h2 className="text-2xl font-bold">Real-Time Monitoring</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Last update: {lastUpdate.toLocaleTimeString()}
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      {!deviceId && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Devices</p>
                <p className="text-2xl font-bold">{metrics.totalDevices}</p>
              </div>
              <Smartphone className="h-8 w-8 text-blue-500" />
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Devices</p>
                <p className="text-2xl font-bold text-green-600">{metrics.activeDevices}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Battery</p>
                <p className="text-2xl font-bold">{metrics.avgBattery}%</p>
              </div>
              <Battery className="h-8 w-8 text-yellow-500" />
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Health Alerts</p>
                <p className="text-2xl font-bold text-red-600">{healthAlerts.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </div>
        </div>
      )}

      {/* Health Alerts */}
      {showHealthAlerts && healthAlerts.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/10 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <h3 className="font-semibold text-red-700 dark:text-red-400">Health Alerts</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowHealthAlerts(false)}>
              Dismiss
            </Button>
          </div>
          <div className="space-y-2">
            {healthAlerts.slice(0, 5).map((alert, index) => {
              const device = devices.find(d => d.deviceId === alert.deviceId)
              return (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {device?.name || alert.deviceId.substring(0, 12)}
                  </span>
                  <Badge variant={alert.type === 'battery' ? 'destructive' : 'secondary'}>
                    {alert.message}
                  </Badge>
                </div>
              )
            })}
            {healthAlerts.length > 5 && (
              <p className="text-xs text-muted-foreground mt-2">
                +{healthAlerts.length - 5} more alerts
              </p>
            )}
          </div>
        </div>
      )}

      {/* Search and Filters */}
      {!deviceId && (
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search devices..."
              className="pl-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {!deviceId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Online</p>
                <p className="text-2xl font-bold text-green-600">{onlineCount}</p>
              </div>
              <Wifi className="h-8 w-8 text-green-500" />
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Offline</p>
                <p className="text-2xl font-bold text-orange-600">{offlineCount}</p>
              </div>
              <WifiOff className="h-8 w-8 text-orange-500" />
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Inactive</p>
                <p className="text-2xl font-bold text-gray-600">{inactiveCount}</p>
              </div>
              <Smartphone className="h-8 w-8 text-gray-500" />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDevices.length === 0 ? (
          <div className="col-span-full text-center text-muted-foreground py-8">
            <div className="flex flex-col items-center gap-2">
              <Smartphone className="h-12 w-12 opacity-50" />
              <p className="font-medium">No devices found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          </div>
        ) : (
          filteredDevices.map(device => {
            const hasAlert = healthAlerts.some(a => a.deviceId === device.deviceId)
            return (
              <div
                key={device.deviceId}
                className={`rounded-lg border p-4 transition-all ${
                  hasAlert
                    ? 'border-red-500/50 bg-red-50/50 dark:bg-red-900/10'
                    : device.isOnline && device.isActive
                      ? 'border-green-500/50 bg-green-50/50 dark:bg-green-900/10'
                      : device.isActive
                        ? 'border-orange-500/50 bg-orange-50/50 dark:bg-orange-900/10'
                        : 'border-gray-300/50 bg-gray-50/50 dark:bg-gray-900/10'
                }`}
              >
                {hasAlert && (
                  <div className="mb-2 flex items-center gap-1 text-xs text-red-600">
                    <AlertTriangle className="h-3 w-3" />
                    <span>{healthAlerts.find(a => a.deviceId === device.deviceId)?.message}</span>
                  </div>
                )}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Smartphone className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-semibold truncate">{device.name || 'Unknown Device'}</h3>
                    </div>
                    <p className="text-xs font-mono text-muted-foreground truncate">
                      {device.deviceId.substring(0, 16)}...
                    </p>
                  </div>
                  <div>
                    {device.isOnline && device.isActive ? (
                      <Badge className="bg-green-500">Online</Badge>
                    ) : device.isActive ? (
                      <Badge variant="destructive">Offline</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {device.phone && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Phone:</span>
                      <span className="font-mono">{device.phone}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Battery:</span>
                    <div className="flex items-center gap-1">
                      <Battery className={`h-4 w-4 ${getBatteryColor(device.batteryPercentage)}`} />
                      <span className={getBatteryColor(device.batteryPercentage)}>
                        {device.batteryPercentage !== undefined
                          ? `${device.batteryPercentage}%`
                          : 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Last Seen:</span>
                    <span className="text-xs">{formatLastSeen(device.lastSeen)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant={device.isActive ? 'default' : 'secondary'}>
                      {device.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>

                {/* Real-time indicator */}
                {device.isOnline && device.isActive && (
                  <div className="mt-3 pt-3 border-t flex items-center gap-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs text-green-600">Live</span>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
