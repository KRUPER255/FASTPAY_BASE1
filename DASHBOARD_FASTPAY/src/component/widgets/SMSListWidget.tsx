import { useEffect, useState } from 'react'
import WidgetContainer from './WidgetContainer'
import { MessageSquare, TextSearch } from 'lucide-react'
import { Skeleton } from '@/component/ui/skeleton'
import { getDeviceMessagesPath } from '@/lib/firebase-helpers'
import { query, orderByKey, limitToLast, get, onValue, off } from 'firebase/database'
import { database } from '@/lib/firebase'
import { formatDistanceToNow } from 'date-fns'

interface SMSListWidgetProps {
  deviceId: string | null
  limit?: number
}

interface SMS {
  id: string
  sender: string
  body: string
  time: number
  isSent: boolean
}

export default function SMSListWidget({ deviceId, limit = 5 }: SMSListWidgetProps) {
  const [sms, setSms] = useState<SMS[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!deviceId) {
      setSms([])
      setLoading(false)
      return
    }

    const messagesRef = query(getDeviceMessagesPath(deviceId), orderByKey(), limitToLast(limit))

    const unsubscribe = onValue(messagesRef, snapshot => {
      if (snapshot.exists()) {
        const messages = snapshot.val()
        const smsList: SMS[] = []

        Object.entries(messages).forEach(([timestamp, content]) => {
          const msgContent = typeof content === 'string' ? content : (content as any).content || ''
          const parts = msgContent.split('~')
          const isSent = parts[0] === 'sent'
          const sender = parts[1] || (isSent ? 'You' : 'Unknown')
          const body = parts.slice(2).join('~') || msgContent

          smsList.push({
            id: timestamp,
            sender,
            body,
            time: parseInt(timestamp) || Date.now(),
            isSent,
          })
        })

        smsList.sort((a, b) => b.time - a.time)
        setSms(smsList.slice(0, limit))
      } else {
        setSms([])
      }
      setLoading(false)
    })

    return () => off(messagesRef)
  }, [deviceId, limit])

  if (!deviceId) {
    return (
      <WidgetContainer
        title="SMS Messages"
        icon={<MessageSquare className="h-4 w-4" />}
        colSpan={2}
        rowSpan={2}
      >
        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
          Select a device to view messages
        </div>
      </WidgetContainer>
    )
  }

  return (
    <WidgetContainer
      title="Recent SMS"
      icon={<MessageSquare className="h-4 w-4" />}
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
      ) : sms.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
          No messages found
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {sms.map(msg => (
            <div key={msg.id} className="border-b border-white/10 pb-3 last:border-0">
              <div className="flex items-start justify-between mb-1">
                <span
                  className={`text-sm font-medium ${msg.isSent ? 'text-primary' : 'text-foreground'}`}
                >
                  {msg.isSent ? 'You' : msg.sender}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(msg.time), { addSuffix: true })}
                </span>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{msg.body}</p>
            </div>
          ))}
        </div>
      )}
    </WidgetContainer>
  )
}
