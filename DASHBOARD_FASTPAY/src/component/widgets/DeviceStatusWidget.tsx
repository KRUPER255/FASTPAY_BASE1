import { useEffect, useState } from 'react'
import WidgetContainer from './WidgetContainer'
import { Smartphone, Battery, Wifi, WifiOff, RefreshCw, Activity } from 'lucide-react'
import { Skeleton } from '@/component/ui/skeleton'
import { getDeviceMetadataPath } from '@/lib/firebase-helpers'
import { ref, onValue, off, get } from 'firebase/database'
import { database } from '@/lib/firebase'
import { formatDistanceToNow } from 'date-fns'
import { Badge } from '@/component/ui/badge'

interface DeviceStatusWidgetProps {
  deviceId: string | null
}

interface DeviceStatus {
  name?: string
  phone?: string
  code?: string
  battery?: number
  lastSeen?: number
  isOnline: boolean
}

export default function DeviceStatusWidget({ deviceId }: DeviceStatusWidgetProps) {
  const [status, setStatus] = useState<DeviceStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!deviceId) {
      setStatus(null)
      setLoading(false)
      return
    }

    const unsubscribe = onValue(ref(database, `fastpay/${deviceId}`), async snapshot => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        const [batteryRef, lastSeenRef, nameRef, phoneRef, codeRef] = [
          getDeviceMetadataPath(deviceId, 'batteryPercentage'),
          getDeviceMetadataPath(deviceId, 'lastSeen'),
          getDeviceMetadataPath(deviceId, 'name'),
          getDeviceMetadataPath(deviceId, 'phone'),
          getDeviceMetadataPath(deviceId, 'code'),
        ]

        const [batterySnap, lastSeenSnap, nameSnap, phoneSnap, codeSnap] = await Promise.all([
          get(batteryRef),
          get(lastSeenRef),
          get(nameRef),
          get(phoneRef),
          get(codeRef),
        ])

        const lastSeen = lastSeenSnap.exists() ? lastSeenSnap.val() : 0
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
        const isOnline = lastSeen > fiveMinutesAgo

        setStatus({
          name: nameSnap.exists() ? nameSnap.val() : deviceId,
          phone: phoneSnap.exists() ? phoneSnap.val() : undefined,
          code: codeSnap.exists() ? codeSnap.val() : undefined,
          battery: batterySnap.exists() ? batterySnap.val() : undefined,
          lastSeen,
          isOnline,
        })
      } else {
        setStatus(null)
      }
      setLoading(false)
    })

    return () => off(ref(database, `fastpay/${deviceId}`))
  }, [deviceId])

  if (!deviceId) {
    return (
      <WidgetContainer
        title="Device Status"
        icon={<Smartphone className="h-4 w-4" />}
        colSpan={2}
        rowSpan={1}
      >
        <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
          Select a device to view status
        </div>
      </WidgetContainer>
    )
  }

  const getBatteryColor = (battery?: number) => {
    if (battery === undefined || battery < 0) return 'text-gray-400'
    if (battery > 50) return 'text-green-500'
    if (battery > 20) return 'text-yellow-500'
    return 'text-red-500'
  }

  return (
    <WidgetContainer
      title="Device Status"
      icon={<Smartphone className="h-4 w-4" />}
      colSpan={2}
      rowSpan={1}
    >
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : status ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-lg premium-gradient-text">{status.name}</h4>
              {status.phone && <p className="text-sm text-muted-foreground">{status.phone}</p>}
            </div>
            <Badge
              variant={status.isOnline ? 'default' : 'secondary'}
              className={status.isOnline ? 'bg-green-500' : ''}
            >
              <Activity className="h-3 w-3 mr-1" />
              {status.isOnline ? 'Online' : 'Offline'}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
            <div className="flex items-center gap-2">
              <Battery className={`h-4 w-4 ${getBatteryColor(status.battery)}`} />
              <div>
                <div className="text-xs text-muted-foreground">Battery</div>
                <div className="font-semibold">
                  {status.battery !== undefined ? `${status.battery}%` : 'N/A'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {status.isOnline ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-gray-400" />
              )}
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <div className="font-semibold">
                  {status.isOnline ? 'Connected' : 'Disconnected'}
                </div>
              </div>
            </div>
          </div>

          {status.lastSeen && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-white/10">
              <RefreshCw className="h-3 w-3" />
              <span>
                Last seen: {formatDistanceToNow(new Date(status.lastSeen), { addSuffix: true })}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
          No device data available
        </div>
      )}
    </WidgetContainer>
  )
}
