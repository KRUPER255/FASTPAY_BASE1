import { useEffect, useState } from 'react'
import WidgetContainer from './WidgetContainer'
import { Smartphone, Battery, Activity } from 'lucide-react'
import { Skeleton } from '@/component/ui/skeleton'
import { fetchDevices } from '@/lib/api-client'
import { getSession } from '@/lib/auth'
import { formatDistanceToNow } from 'date-fns'

interface DeviceListWidgetProps {
  onDeviceSelect?: (deviceId: string) => void
  limit?: number
}

interface Device {
  id: string
  name: string
  phone?: string
  code?: string
  isOnline: boolean
  battery?: number
  lastSeen?: number
}

export default function DeviceListWidget({ onDeviceSelect, limit = 5 }: DeviceListWidgetProps) {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadDevices = async () => {
      try {
        setLoading(true)
        // Get user email from session
        const session = getSession()
        const userEmail = session?.email || null
        const djangoDevices = await fetchDevices(userEmail ? { user_email: userEmail } : undefined)
        
        // Map Django devices to Device format and limit results
        const deviceList: Device[] = djangoDevices.slice(0, limit).map((device: any) => {
          const lastSeen = device.last_seen || device.time || 0
          const battery = device.battery_percentage ?? undefined
          const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
          const isOnline = lastSeen > fiveMinutesAgo
          
          return {
            id: device.device_id,
            name: device.name || device.model || device.device_id,
            phone: device.current_phone || device.phone,
            code: device.code,
            isOnline,
            battery: battery,
            lastSeen: lastSeen ? (typeof lastSeen === 'number' ? lastSeen : parseInt(String(lastSeen))) : undefined,
          }
        })
        
        setDevices(deviceList)
      } catch (error) {
        console.error('Error loading devices from Django:', error)
        setDevices([])
      } finally {
        setLoading(false)
      }
    }

    loadDevices()
    
    // Refresh every 30 seconds
    const interval = setInterval(loadDevices, 30000)
    return () => clearInterval(interval)
  }, [limit])

  return (
    <WidgetContainer
      title="Devices"
      icon={<Smartphone className="h-4 w-4" />}
      colSpan={2}
      rowSpan={3}
    >
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : devices.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
          No devices found
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {devices.map(device => (
            <div
              key={device.id}
              className="premium-card p-3 rounded-lg cursor-pointer hover:bg-white/5 transition-colors"
              onClick={() => onDeviceSelect?.(device.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {device.isOnline ? (
                    <Activity className="h-3 w-3 text-green-500" />
                  ) : (
                    <Activity className="h-3 w-3 text-red-500 opacity-50" />
                  )}
                  <span className="text-sm font-medium">{device.name}</span>
                </div>
                {device.battery !== undefined && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Battery className="h-3 w-3" />
                    <span>{device.battery}%</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {device.phone && <span>{device.phone}</span>}
                {device.code && <span>• {device.code}</span>}
                {device.lastSeen && (
                  <span>
                    • {formatDistanceToNow(new Date(device.lastSeen), { addSuffix: true })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetContainer>
  )
}
