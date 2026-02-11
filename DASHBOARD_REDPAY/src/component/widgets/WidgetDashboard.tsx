import { useState } from 'react'
import WidgetGrid from './WidgetGrid'
import StatsWidget from './StatsWidget'
import SMSListWidget from './SMSListWidget'
import NotificationsWidget from './NotificationsWidget'
import DeviceListWidget from './DeviceListWidget'
import AnalyticsWidget from './AnalyticsWidget'
import DeviceStatusWidget from './DeviceStatusWidget'
import QuickActionsWidget from './QuickActionsWidget'
import RecentActivityWidget from './RecentActivityWidget'

interface WidgetDashboardProps {
  selectedDeviceId?: string | null
  onDeviceSelect?: (deviceId: string) => void
  onSendSMS?: () => void
  onShowNotification?: () => void
  onCommands?: () => void
  onRefresh?: () => void
}

export default function WidgetDashboard({
  selectedDeviceId,
  onDeviceSelect,
  onSendSMS,
  onShowNotification,
  onCommands,
  onRefresh,
}: WidgetDashboardProps) {
  return (
    <div className="p-6">
      <WidgetGrid columns={4} gap={4}>
        {/* Stats Widget - Overall Stats (1x1) */}
        <StatsWidget deviceId={null} />

        {/* Device List Widget - 2 columns, 3 rows */}
        <DeviceListWidget onDeviceSelect={onDeviceSelect} limit={5} />

        {/* Recent Activity Widget - 2 columns, 2 rows */}
        <RecentActivityWidget limit={10} />

        {/* SMS Widget - 2 columns, 2 rows */}
        {selectedDeviceId && <SMSListWidget deviceId={selectedDeviceId} limit={8} />}

        {/* Notifications Widget - 2 columns, 2 rows */}
        {selectedDeviceId && <NotificationsWidget deviceId={selectedDeviceId} limit={8} />}

        {/* Analytics Widget - 4 columns, 2 rows (full width) */}
        <AnalyticsWidget deviceId={selectedDeviceId} />

        {/* Device Status Widget - 2 columns */}
        {selectedDeviceId && <DeviceStatusWidget deviceId={selectedDeviceId} />}

        {/* Quick Actions Widget - 2 columns */}
        <QuickActionsWidget
          deviceId={selectedDeviceId}
          onSendSMS={onSendSMS}
          onShowNotification={onShowNotification}
          onCommands={onCommands}
          onRefresh={onRefresh}
        />
      </WidgetGrid>
    </div>
  )
}
