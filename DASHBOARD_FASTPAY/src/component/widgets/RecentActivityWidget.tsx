import { useEffect, useState } from 'react'
import WidgetContainer from './WidgetContainer'
import { Activity, MessageSquare, Bell, Smartphone, Clock } from 'lucide-react'
import { Skeleton } from '@/component/ui/skeleton'
import {
  getAllDevicesPath,
  getDeviceMessagesPath,
  getDeviceNotificationsPath,
} from '@/lib/firebase-helpers'
import { ref, onValue, off, get, query, orderByKey, limitToLast } from 'firebase/database'
import { database } from '@/lib/firebase'
import { formatDistanceToNow } from 'date-fns'

interface RecentActivityWidgetProps {
  limit?: number
}

interface ActivityItem {
  id: string
  type: 'sms' | 'notification' | 'device'
  deviceId: string
  deviceName: string
  message: string
  timestamp: number
}

export default function RecentActivityWidget({ limit = 10 }: RecentActivityWidgetProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadActivities = async () => {
      try {
        const devicesRef = getAllDevicesPath()
        const devicesSnap = await get(devicesRef)

        if (!devicesSnap.exists()) {
          setActivities([])
          setLoading(false)
          return
        }

        const deviceIds = Object.keys(devicesSnap.val()).slice(0, 5) // Limit to 5 devices for performance
        const activityList: ActivityItem[] = []

        // Fetch recent messages and notifications from each device
        await Promise.all(
          deviceIds.map(async deviceId => {
            try {
              // Get device name
              const nameRef = ref(database, `fastpay/${deviceId}/name`)
              const nameSnap = await get(nameRef)
              const deviceName = nameSnap.exists() ? nameSnap.val() : deviceId

              // Get recent messages
              const messagesRef = query(
                getDeviceMessagesPath(deviceId),
                orderByKey(),
                limitToLast(3)
              )
              const messagesSnap = await get(messagesRef)

              if (messagesSnap.exists()) {
                const messages = messagesSnap.val()
                Object.entries(messages).forEach(([timestamp, content]: [string, any]) => {
                  const msgContent = typeof content === 'string' ? content : content.content || ''
                  const parts = msgContent.split('~')
                  const body = parts.slice(2).join('~') || msgContent

                  activityList.push({
                    id: `${deviceId}-sms-${timestamp}`,
                    type: 'sms',
                    deviceId,
                    deviceName,
                    message: body.substring(0, 50),
                    timestamp: parseInt(timestamp) || Date.now(),
                  })
                })
              }

              // Get recent notifications
              const notificationsRef = query(
                getDeviceNotificationsPath(deviceId),
                orderByKey(),
                limitToLast(3)
              )
              const notificationsSnap = await get(notificationsRef)

              if (notificationsSnap.exists()) {
                const notifications = notificationsSnap.val()
                Object.entries(notifications).forEach(([messageId, messageData]: [string, any]) => {
                  if (typeof messageData === 'object' && messageData !== null) {
                    Object.entries(messageData).forEach(([timestamp, content]: [string, any]) => {
                      const msgContent =
                        typeof content === 'string' ? content : content.content || ''
                      const parts = msgContent.split('#')
                      const title = parts[0]?.split(':')[0] || 'Notification'

                      activityList.push({
                        id: `${deviceId}-notif-${messageId}-${timestamp}`,
                        type: 'notification',
                        deviceId,
                        deviceName,
                        message: title.substring(0, 50),
                        timestamp: parseInt(timestamp) || Date.now(),
                      })
                    })
                  }
                })
              }
            } catch (error) {
              console.error(`Error loading activities for ${deviceId}:`, error)
            }
          })
        )

        // Sort by timestamp and limit
        activityList.sort((a, b) => b.timestamp - a.timestamp)
        setActivities(activityList.slice(0, limit))
      } catch (error) {
        console.error('Error loading activities:', error)
      } finally {
        setLoading(false)
      }
    }

    loadActivities()

    // Refresh every 30 seconds
    const interval = setInterval(loadActivities, 30000)

    return () => clearInterval(interval)
  }, [limit])

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'sms':
        return <MessageSquare className="h-3 w-3 text-blue-500" />
      case 'notification':
        return <Bell className="h-3 w-3 text-purple-500" />
      case 'device':
        return <Smartphone className="h-3 w-3 text-green-500" />
    }
  }

  return (
    <WidgetContainer
      title="Recent Activity"
      icon={<Activity className="h-4 w-4" />}
      colSpan={2}
      rowSpan={2}
    >
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
          No recent activity
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {activities.map(activity => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <div className="mt-0.5">{getActivityIcon(activity.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-muted-foreground truncate">
                    {activity.deviceName}
                  </span>
                  <span className="text-xs text-muted-foreground/50">•</span>
                  <span className="text-xs text-muted-foreground/50">
                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-foreground/80 truncate">{activity.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetContainer>
  )
}
