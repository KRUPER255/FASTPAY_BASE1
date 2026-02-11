import DashboardOverview from '@/component/DashboardOverview'
import WidgetDashboard from '@/component/widgets/WidgetDashboard'
import type { ActiveTabType } from '../types'

interface OverviewSectionProps {
  currentDeviceId: string | null
  viewMode: 'widgets' | 'tabs'
  onDeviceSelect: (deviceId: string) => void
  onTabChange: (tab: ActiveTabType) => void
  onSendSMS: () => void
  onShowNotification: () => void
  onCommands: () => void
  onRefresh: () => void
  onViewModeChange?: (mode: 'widgets' | 'tabs') => void
}

export function OverviewSection({
  currentDeviceId,
  viewMode,
  onDeviceSelect,
  onTabChange,
  onSendSMS,
  onShowNotification,
  onCommands,
  onRefresh,
  onViewModeChange,
}: OverviewSectionProps) {
  // When no device selected, show overview for all devices
  if (!currentDeviceId) {
    return (
      <div id="overview-section" data-testid="overview-section" className="space-y-3">
        <DashboardOverview
          onDeviceSelect={onDeviceSelect}
          onTabChange={tab => onTabChange(tab as ActiveTabType)}
        />
      </div>
    )
  }

  return (
    <div id="overview-section" data-testid="overview-section" className="space-y-3">
      {viewMode === 'widgets' ? (
        <div id="overview-widgets-view" data-testid="overview-widgets">
          <WidgetDashboard
            selectedDeviceId={currentDeviceId}
            onDeviceSelect={onDeviceSelect}
            onSendSMS={onSendSMS}
            onShowNotification={onShowNotification}
            onCommands={onCommands}
            onRefresh={onRefresh}
          />
        </div>
      ) : (
        <div id="overview-tabs-view" data-testid="overview-tabs">
          <DashboardOverview
            onDeviceSelect={onDeviceSelect}
            onTabChange={tab => onTabChange(tab as ActiveTabType)}
          />
        </div>
      )}
    </div>
  )
}
