import { useEffect, useState } from 'react'
import WidgetContainer from './WidgetContainer'
import { Activity, Smartphone, MessageSquare, Bell, TrendingUp } from 'lucide-react'
import { Skeleton } from '@/component/ui/skeleton'
import {
  getAllDevicesPath,
  getDeviceMessagesPath,
  getDeviceNotificationsPath,
} from '@/lib/firebase-helpers'
import { ref, onValue, off, get } from 'firebase/database'
import { database } from '@/lib/firebase'

interface StatsWidgetProps {
  deviceId?: string | null
}

export default function StatsWidget({ deviceId }: StatsWidgetProps) {
  const [stats, setStats] = useState({
    totalDevices: 0,
    onlineDevices: 0,
    totalMessages: 0,
    totalNotifications: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (deviceId) {
      loadDeviceStats(deviceId)
    } else {
      loadGlobalStats()
    }
  }, [deviceId])

  const loadGlobalStats = async () => {
    try {
      const devicesRef = getAllDevicesPath()
      const snapshot = await get(devicesRef)

      if (snapshot.exists()) {
        const devices = snapshot.val()
        const deviceIds = Object.keys(devices)
        let onlineCount = 0
        let messageCount = 0
        let notificationCount = 0

        // Count online devices and fetch messages/notifications
        await Promise.all(
          deviceIds.slice(0, 10).map(async id => {
            const lastSeenRef = ref(database, `fastpay/${id}/lastSeen`)
            const lastSeenSnap = await get(lastSeenRef)
            if (lastSeenSnap.exists()) {
              const lastSeen = lastSeenSnap.val()
              const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
              if (lastSeen > fiveMinutesAgo) onlineCount++
            }

            // Count messages
            const messagesRef = getDeviceMessagesPath(id)
            const msgSnap = await get(messagesRef)
            if (msgSnap.exists()) {
              messageCount += Object.keys(msgSnap.val()).length
            }

            // Count notifications
            const notifRef = getDeviceNotificationsPath(id)
            const notifSnap = await get(notifRef)
            if (notifSnap.exists()) {
              notificationCount += Object.keys(notifSnap.val()).length
            }
          })
        )

        setStats({
          totalDevices: deviceIds.length,
          onlineDevices: onlineCount,
          totalMessages: messageCount,
          totalNotifications: notificationCount,
        })
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadDeviceStats = async (deviceId: string) => {
    try {
      const [messagesRef, notificationsRef, lastSeenRef] = [
        getDeviceMessagesPath(deviceId),
        getDeviceNotificationsPath(deviceId),
        ref(database, `fastpay/${deviceId}/lastSeen`),
      ]

      const [msgSnap, notifSnap, lastSeenSnap] = await Promise.all([
        get(messagesRef),
        get(notificationsRef),
        get(lastSeenRef),
      ])

      const lastSeen = lastSeenSnap.exists() ? lastSeenSnap.val() : 0
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
      const isOnline = lastSeen > fiveMinutesAgo

      setStats({
        totalDevices: 1,
        onlineDevices: isOnline ? 1 : 0,
        totalMessages: msgSnap.exists() ? Object.keys(msgSnap.val()).length : 0,
        totalNotifications: notifSnap.exists() ? Object.keys(notifSnap.val()).length : 0,
      })
    } catch (error) {
      console.error('Error loading device stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const statItems = [
    {
      label: deviceId ? 'Device' : 'Total Devices',
      value: stats.totalDevices,
      icon: Smartphone,
      color: 'text-blue-500',
    },
    {
      label: deviceId ? 'Status' : 'Online',
      value: deviceId ? (stats.onlineDevices > 0 ? 'Online' : 'Offline') : stats.onlineDevices,
      icon: Activity,
      color: stats.onlineDevices > 0 ? 'text-green-500' : 'text-red-500',
    },
    {
      label: 'Messages',
      value: stats.totalMessages,
      icon: MessageSquare,
      color: 'text-purple-500',
    },
    {
      label: 'Notifications',
      value: stats.totalNotifications,
      icon: Bell,
      color: 'text-orange-500',
    },
  ]

  return (
    <WidgetContainer
      title={deviceId ? 'Device Stats' : 'Overall Stats'}
      icon={<TrendingUp className="h-4 w-4" />}
      colSpan={1}
      rowSpan={1}
    >
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {statItems.map((stat, index) => {
            const Icon = stat.icon
            return (
              <div key={index} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </div>
                <div className="text-2xl font-bold premium-gradient-text">{stat.value}</div>
              </div>
            )
          })}
        </div>
      )}
    </WidgetContainer>
  )
}
