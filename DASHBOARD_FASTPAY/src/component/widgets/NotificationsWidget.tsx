import { useEffect, useState } from 'react'
import WidgetContainer from './WidgetContainer'
import { Bell, ReplyAll } from 'lucide-react'
import { Skeleton } from '@/component/ui/skeleton'
import { getDeviceNotificationsPath } from '@/lib/firebase-helpers'
import { query, orderByKey, limitToLast, onValue, off } from 'firebase/database'
import { formatDistanceToNow } from 'date-fns'

interface NotificationsWidgetProps {
  deviceId: string | null
  limit?: number
}

interface Notification {
  id: string
  app: string
  title: string
  body: string
  time: number
}

export default function NotificationsWidget({ deviceId, limit = 5 }: NotificationsWidgetProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!deviceId) {
      setNotifications([])
      setLoading(false)
      return
    }

    const notificationsRef = query(
      getDeviceNotificationsPath(deviceId),
      orderByKey(),
      limitToLast(limit)
    )

    const unsubscribe = onValue(notificationsRef, snapshot => {
      if (snapshot.exists()) {
        const notifs = snapshot.val()
        const notifList: Notification[] = []

        Object.entries(notifs).forEach(([messageId, messageData]: [string, any]) => {
          if (typeof messageData === 'object' && messageData !== null) {
            Object.entries(messageData).forEach(([timestamp, content]: [string, any]) => {
              const msgContent = typeof content === 'string' ? content : content.content || ''
              const parts = msgContent.split('#')
              const app = parts[parts.length - 1] || 'Unknown'
              const titleBody = parts.slice(0, -1).join('#')
              const [title, body] = titleBody.includes(':')
                ? titleBody.split(':').map((s: string) => s.trim())
                : [titleBody, '']

              notifList.push({
                id: `${messageId}-${timestamp}`,
                app,
                title: title || 'Notification',
                body: body || titleBody,
                time: parseInt(timestamp) || Date.now(),
              })
            })
          }
        })

        notifList.sort((a, b) => b.time - a.time)
        setNotifications(notifList.slice(0, limit))
      } else {
        setNotifications([])
      }
      setLoading(false)
    })

    return () => off(notificationsRef)
  }, [deviceId, limit])

  if (!deviceId) {
    return (
      <WidgetContainer
        title="Notifications"
        icon={<Bell className="h-4 w-4" />}
        colSpan={2}
        rowSpan={2}
      >
        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
          Select a device to view notifications
        </div>
      </WidgetContainer>
    )
  }

  return (
    <WidgetContainer
      title="Recent Notifications"
      icon={<Bell className="h-4 w-4" />}
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
      ) : notifications.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
          No notifications found
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {notifications.map(notif => (
            <div key={notif.id} className="border-b border-white/10 pb-3 last:border-0">
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-muted-foreground">
                    {notif.app}
                  </span>
                  <span className="text-sm font-medium">{notif.title}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(notif.time), { addSuffix: true })}
                </span>
              </div>
              {notif.body && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{notif.body}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </WidgetContainer>
  )
}
