import { useState } from 'react'
import { Card, CardContent } from '@/component/ui/card'
import { Battery, Wifi, WifiOff, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DeviceInfo {
  id: string
  name?: string
  phone?: string
  currentPhone?: string
  code?: string
  lastSeen?: number
  batteryPercentage?: number | null
  isActive?: boolean
  time?: number
}

interface DeviceInfoCardProps {
  device: DeviceInfo
  formatLastSeen?: (timestamp: number) => string
  onSendSMS?: (phone: string) => Promise<{ success: boolean; otp?: string; error?: string }>
  lastSentOTP?: { phone: string; otp: string } | null
  isAdmin?: boolean
}

export function DeviceInfoCard({
  device,
  formatLastSeen,
}: DeviceInfoCardProps) {
  const lastSeenTimestamp = device.lastSeen || 0
  const now = Date.now()
  const diffMs = lastSeenTimestamp ? now - lastSeenTimestamp : Infinity
  const diffSeconds = Math.floor(diffMs / 1000)
  // Connected = within 5 minutes, otherwise disconnected (RED)
  const isConnected = diffSeconds < 300 // 5 minutes
  const connectionStatus = isConnected ? 'connected' : 'disconnected'

  const getBatteryIcon = (percentage?: number | null) => {
    if (percentage === undefined || percentage === null) {
      return <Battery className="h-4 w-4 text-muted-foreground" />
    }
    if (percentage > 50) return <Battery className="h-4 w-4 text-green-500" />
    if (percentage > 20) return <Battery className="h-4 w-4 text-yellow-500" />
    return <Battery className="h-4 w-4 text-red-500" />
  }

  return (
    <Card 
      id="device-info-card"
      data-testid="device-info-card"
      data-device-id={device.id}
      className={cn(
        "overflow-hidden transition-all duration-300 border-2 shadow-sm",
        connectionStatus === 'connected' 
          ? "bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/40" 
          : "bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/40"
      )}
    >
      <CardContent id="device-info-content" className="p-3">
        {/* Header: Device Info Title */}
        <div id="device-info-header" className="flex items-center gap-2 mb-3 pb-2 border-b border-border/20">
          <Smartphone id="device-info-icon" className={cn(
            "h-4 w-4",
            isConnected ? "text-green-500" : "text-red-500"
          )} />
          <h3 id="device-info-title" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Device Details</h3>
        </div>

        {/* Status Row */}
        <div id="device-info-status" className="flex items-center justify-between mb-4">
          <div id="device-info-connection-status" className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-bold uppercase",
            isConnected 
              ? "bg-green-500/20 border-green-500/30 text-green-600 dark:text-green-400" 
              : "bg-red-500/20 border-red-500/30 text-red-600 dark:text-red-400"
          )}>
            {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {isConnected ? "Connected" : "Disconnected"}
          </div>
          
          <div id="device-info-battery" className="flex items-center gap-1.5">
            <span id="device-info-battery-percent" className={cn(
              "text-xs font-mono font-bold",
              (device.batteryPercentage ?? 0) < 20 ? "text-red-500" : "text-foreground"
            )}>
              {device.batteryPercentage !== undefined ? `${device.batteryPercentage}%` : '--%'}
            </span>
            <div className="text-muted-foreground">
              {getBatteryIcon(device.batteryPercentage)}
            </div>
          </div>
        </div>

        {/* Info Stack */}
        <div id="device-info-data" className="space-y-3">
          {/* CODE */}
          <div id="device-info-code">
            <label className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter mb-1 block">
              Code
            </label>
            <div id="device-info-code-value" className="font-mono font-bold text-xs bg-muted/40 p-2 rounded border border-border/10 break-all leading-tight">
              {device.code || 'N/A'}
            </div>
          </div>

          {/* Number */}
          <div id="device-info-number">
            <label className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter mb-1 block">
              Number
            </label>
            <div id="device-info-number-value" className="font-mono font-bold text-xs bg-muted/40 p-2 rounded border border-border/10 break-all leading-tight">
              {device.currentPhone || device.phone || 'N/A'}
            </div>
          </div>

          {/* Activity */}
          <div id="device-info-last-seen" className="pt-1">
            <label className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter mb-1 block">
              Last Seen
            </label>
            <p id="device-info-last-seen-value" className="text-[10px] font-medium text-foreground/80 italic pl-1">
              {lastSeenTimestamp ? formatLastSeen?.(lastSeenTimestamp) : 'No activity recorded'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
