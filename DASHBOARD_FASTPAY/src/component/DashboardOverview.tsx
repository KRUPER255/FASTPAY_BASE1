import { useEffect, useState, useMemo } from 'react'
import { query, orderByKey, limitToLast, get } from 'firebase/database'
import {
  getDeviceMessagesPath,
  getDeviceNotificationsPath,
} from '@/lib/firebase-helpers'
import { fetchDevices } from '@/lib/api-client'
import { getSession } from '@/lib/auth'
import { Card } from '@/component/ui/card'
import { Badge } from '@/component/ui/badge'
import { Button } from '@/component/ui/button'
import { Skeleton } from '@/component/ui/skeleton'
import { MetricCard } from '@/component/MetricCard'
import {
  Smartphone,
  MessageSquare,
  Bell,
  Wifi,
  Battery,
  Activity,
  TrendingUp,
  AlertTriangle,
  Clock,
  ArrowRight,
  Users,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface DeviceStatus {
  deviceId: string
  name?: string
  phone?: string
  isActive?: boolean
  lastSeen?: number
  batteryPercentage?: number
  isOnline: boolean
}

interface OverviewStats {
  totalDevices: number
  onlineDevices: number
  offlineDevices: number
  inactiveDevices: number
  totalMessages: number
  totalNotifications: number
  lowBatteryDevices: number
  averageBattery: number
}

interface RecentActivity {
  deviceId: string
  type: 'sms' | 'notification' | 'status'
  message: string
  timestamp: number
}

interface DashboardOverviewProps {
  onDeviceSelect?: (deviceId: string) => void
  onTabChange?: (tab: string) => void
}

export default function DashboardOverview({ onDeviceSelect, onTabChange }: DashboardOverviewProps) {
  const [devices, setDevices] = useState<DeviceStatus[]>([])
  const [stats, setStats] = useState<OverviewStats>({
    totalDevices: 0,
    onlineDevices: 0,
    offlineDevices: 0,
    inactiveDevices: 0,
    totalMessages: 0,
    totalNotifications: 0,
    lowBatteryDevices: 0,
    averageBattery: 0,
  })
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  // Fetch activity data separately (non-blocking)
  const fetchActivityData = async (deviceIds: string[]) => {
    const activityItems: RecentActivity[] = []
    let messageCount = 0
    let notificationCount = 0

    // Fetch data for first 5 devices only (to avoid too many requests)
    const devicesToFetch = deviceIds.slice(0, 5)

    await Promise.all(
      devicesToFetch.map(async deviceId => {
        try {
          // Fetch recent messages
          const messagesRef = query(getDeviceMessagesPath(deviceId), orderByKey(), limitToLast(5))

          const msgSnapshot = await get(messagesRef)
          if (msgSnapshot.exists()) {
            const messages = msgSnapshot.val()
            messageCount += Object.keys(messages).length

            // Add most recent message to activity
            const messageKeys = Object.keys(messages).sort().reverse()
            if (messageKeys.length > 0) {
              const latestKey = messageKeys[0]
              const latestMsg = messages[latestKey]
              const msgTime =
                typeof latestMsg === 'string'
                  ? parseInt(latestKey.split('_')[1] || '0')
                  : latestMsg.time || parseInt(latestKey.split('_')[1] || '0')

              activityItems.push({
                deviceId,
                type: 'sms',
                message:
                  typeof latestMsg === 'string' ? latestMsg : latestMsg.body || 'New message',
                timestamp: msgTime,
              })
            }
          }

          // Fetch recent notifications
          const notificationsRef = query(
            getDeviceNotificationsPath(deviceId),
            orderByKey(),
            limitToLast(5)
          )

          const notifSnapshot = await get(notificationsRef)
          if (notifSnapshot.exists()) {
            const notifications = notifSnapshot.val()
            notificationCount += Object.keys(notifications).length

            // Add most recent notification to activity
            const notifKeys = Object.keys(notifications).sort().reverse()
            if (notifKeys.length > 0) {
              const latestKey = notifKeys[0]
              const latestNotif = notifications[latestKey]
              const notifTime = latestNotif.time || parseInt(latestKey.split('_')[1] || '0')
              const title = latestNotif.title || latestNotif.appName || 'New notification'

              activityItems.push({
                deviceId,
                type: 'notification',
                message: title,
                timestamp: notifTime,
              })
            }
          }
        } catch (error) {
          console.error(`Error fetching activity for ${deviceId}:`, error)
        }
      })
    )

    // Update stats and activity
    setStats(prev => ({
      ...prev,
      totalMessages: messageCount,
      totalNotifications: notificationCount,
    }))

    // Sort activity by timestamp and take most recent 10
    activityItems.sort((a, b) => b.timestamp - a.timestamp)
    setRecentActivity(activityItems.slice(0, 10))
  }

  // Fetch all devices from Django API
  useEffect(() => {
    const loadDevices = async () => {
      try {
        setLoading(true)
        // Get user email from session
        const session = getSession()
        const userEmail = session?.email || null
        // Fetch devices from Django API filtered by user
        const djangoDevices = await fetchDevices(userEmail ? { user_email: userEmail } : undefined)
        
        if (!djangoDevices || djangoDevices.length === 0) {
          setDevices([])
          setStats({
            totalDevices: 0,
            onlineDevices: 0,
            offlineDevices: 0,
            inactiveDevices: 0,
            totalMessages: 0,
            totalNotifications: 0,
            lowBatteryDevices: 0,
            averageBattery: 0,
          })
          setLoading(false)
          setLastUpdate(new Date())
          return
        }

        // Map Django devices to DeviceStatus format
        const deviceStatuses: DeviceStatus[] = []
        let batterySum = 0
        let batteryCount = 0

        djangoDevices.forEach((device: any) => {
          const lastSeen = device.last_seen || device.time || 0
          const battery = device.battery_percentage ?? 0
          const timeSinceLastSeen = Date.now() - (typeof lastSeen === 'number' ? lastSeen : parseInt(String(lastSeen)) || 0)
          const isOnline = timeSinceLastSeen < 300000 // 5 minutes

          if (battery > 0) {
            batterySum += battery
            batteryCount++
          }

          deviceStatuses.push({
            deviceId: device.device_id,
            name: device.name || device.model || device.device_id,
            phone: device.current_phone || device.phone,
            isActive: device.is_active,
            lastSeen: typeof lastSeen === 'number' ? lastSeen : parseInt(String(lastSeen)) || undefined,
            batteryPercentage: battery > 0 ? battery : undefined,
            isOnline,
          })
        })

        // Calculate stats
        const statusesArray = Array.isArray(deviceStatuses) ? deviceStatuses : []
        const onlineDevices = statusesArray.filter(d => d.isOnline).length
        const offlineDevices = statusesArray.filter(d => !d.isOnline && d.isActive).length
        const inactiveDevices = statusesArray.filter(d => !d.isActive).length
        const lowBatteryDevices = statusesArray.filter(d => (d.batteryPercentage || 0) < 20).length
        const averageBattery = batteryCount > 0 ? batterySum / batteryCount : 0

        setDevices(deviceStatuses)
        setStats({
          totalDevices: deviceStatuses.length,
          onlineDevices,
          offlineDevices,
          inactiveDevices,
          totalMessages: 0, // Will be updated by activity fetch
          totalNotifications: 0, // Will be updated by activity fetch
          lowBatteryDevices,
          averageBattery: Math.round(averageBattery),
        })
        setLoading(false)
        setLastUpdate(new Date())

        // Fetch activity data asynchronously (non-blocking)
        fetchActivityData(deviceStatuses.map(d => d.deviceId))
      } catch (error) {
        console.error('Error fetching devices from Django:', error)
        setDevices([])
        setLoading(false)
      }
    }

    loadDevices()
    
    // Refresh every 30 seconds
    const interval = setInterval(loadDevices, 30000)
    return () => clearInterval(interval)
  }, [])

  const statCards = useMemo(
    () => [
      {
        title: 'Total Devices',
        value: stats.totalDevices,
        icon: Smartphone,
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
        change: null,
      },
      {
        title: 'Online Devices',
        value: stats.onlineDevices,
        icon: Wifi,
        color: 'text-green-500',
        bgColor: 'bg-green-500/10',
        change:
          stats.totalDevices > 0
            ? `${Math.round((stats.onlineDevices / stats.totalDevices) * 100)}%`
            : '0%',
      },
      {
        title: 'Running',
        value: stats.totalDevices - stats.inactiveDevices,
        icon: Activity,
        color: 'text-purple-500',
        bgColor: 'bg-purple-500/10',
        change: null,
      },
      {
        title: 'New',
        value: recentActivity.length,
        icon: TrendingUp,
        color: 'text-orange-500',
        bgColor: 'bg-orange-500/10',
        change: null,
      },
      {
        title: 'Low Battery Devices',
        value: stats.lowBatteryDevices,
        icon: Battery,
        color: 'text-red-500',
        bgColor: 'bg-red-500/10',
        change: stats.lowBatteryDevices > 0 ? 'Needs attention' : 'All good',
      },
      {
        title: 'Average Battery',
        value: `${stats.averageBattery}%`,
        icon: Battery,
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-500/10',
        change: null,
      },
    ],
    [stats, recentActivity]
  )

  const getDeviceStatusBadge = (device: DeviceStatus) => {
    if (!device.isActive) {
      return (
        <Badge variant="secondary" className="bg-gray-500/20 text-gray-400">
          Inactive
        </Badge>
      )
    }
    if (device.isOnline) {
      return (
        <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/30">
          Online
        </Badge>
      )
    }
    return (
      <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/30">
        Offline
      </Badge>
    )
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'sms':
        return <MessageSquare className="h-4 w-4 text-purple-500" />
      case 'notification':
        return <Bell className="h-4 w-4 text-orange-500" />
      default:
        return <Activity className="h-4 w-4 text-blue-500" />
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-4">
          {/* First Row: 4 cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="p-6">
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-12 w-16" />
              </Card>
            ))}
          </div>
          {/* Second Row: 2 cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(2)].map((_, i) => (
              <Card key={i + 4} className="p-6">
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-12 w-16" />
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">

      {/* Stats Cards */}
      <div className="space-y-4">
        {/* First Row: Total, Online, Messages, Notifications */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.slice(0, 4).map((stat, index) => {
            const Icon = stat.icon
            const variant = 
              stat.title.includes('Online') ? 'success' :
              stat.title.includes('Low Battery') ? 'error' :
              stat.title.includes('Average Battery') ? 'warning' :
              'default'
            
            return (
              <MetricCard
                key={index}
                title={stat.title}
                value={stat.value}
                icon={Icon}
                description={stat.change || undefined}
                variant={variant}
              />
            )
          })}
        </div>
        {/* Second Row: Remaining cards */}
        {statCards.length > 4 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {statCards.slice(4).map((stat, index) => {
              const Icon = stat.icon
              const variant = 
                stat.title.includes('Online') ? 'success' :
                stat.title.includes('Low Battery') ? 'error' :
                stat.title.includes('Average Battery') ? 'warning' :
                'default'
              
              return (
                <MetricCard
                  key={index + 4}
                  title={stat.title}
                  value={stat.value}
                  icon={Icon}
                  description={stat.change || undefined}
                  variant={variant}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Device Status Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Device List */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" />
              Device Status
            </h3>
            {onTabChange && (
              <Button variant="ghost" size="sm" onClick={() => onTabChange('devices')}>
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {devices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Smartphone className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No devices found</p>
              </div>
            ) : (
              devices.slice(0, 10).map(device => (
                <div
                  key={device.deviceId}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => onDeviceSelect?.(device.deviceId)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      {device.isOnline ? (
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-red-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{device.name || device.deviceId}</p>
                      {device.phone && (
                        <p className="text-sm text-muted-foreground truncate">{device.phone}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {device.batteryPercentage !== undefined && (
                      <div className="flex items-center gap-1 text-sm">
                        <Battery
                          className={`h-4 w-4 ${
                            device.batteryPercentage < 20
                              ? 'text-red-500'
                              : device.batteryPercentage < 50
                                ? 'text-yellow-500'
                                : 'text-green-500'
                          }`}
                        />
                        <span className={device.batteryPercentage < 20 ? 'text-red-500' : ''}>
                          {device.batteryPercentage}%
                        </span>
                      </div>
                    )}
                    {getDeviceStatusBadge(device)}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Recent Activity */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </h3>
            {onTabChange && (
              <Button variant="ghost" size="sm" onClick={() => onTabChange('sms')}>
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {recentActivity.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No recent activity</p>
              </div>
            ) : (
              recentActivity.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-shrink-0 mt-0.5">{getActivityIcon(activity.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{activity.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-muted-foreground truncate">
                        {devices.find(d => d.deviceId === activity.deviceId)?.name ||
                          activity.deviceId}
                      </p>
                      <span className="text-xs text-muted-foreground">•</span>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {onTabChange && (
            <>
              <Button
                variant="outline"
                className="h-auto flex-col items-center justify-center p-4 gap-2"
                onClick={() => onTabChange('devices')}
              >
                <Users className="h-5 w-5" />
                <span className="text-sm">View Devices</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto flex-col items-center justify-center p-4 gap-2"
                onClick={() => onTabChange('analytics')}
              >
                <TrendingUp className="h-5 w-5" />
                <span className="text-sm">Analytics</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto flex-col items-center justify-center p-4 gap-2"
                onClick={() => onTabChange('export')}
              >
                <Activity className="h-5 w-5" />
                <span className="text-sm">Export Data</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto flex-col items-center justify-center p-4 gap-2"
                onClick={() => onTabChange('commands')}
              >
                <AlertTriangle className="h-5 w-5" />
                <span className="text-sm">Commands</span>
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
