import { UnifiedLayout } from '@/component/UnifiedLayout'
import type { DashboardLayoutProps } from './types'

/**
 * Default dashboard layout: thin adapter around UnifiedLayout.
 * Maps DashboardLayoutProps onto UnifiedLayout props.
 */
export function DefaultLayout({
  children,
  customNav,
  showDeviceSidebarOverride,
  onLogout,
  userEmail,
  userAccessLevel,
  devices = [],
  selectedDeviceId = null,
  onDeviceSelect,
  onRefreshDevices,
  overallActiveTab,
  onOverallTabChange,
  headerExtra,
  rightSidebar,
  leftSidebarOverride,
}: DashboardLayoutProps) {
  return (
    <UnifiedLayout
      overallActiveTab={overallActiveTab}
      onOverallTabChange={onOverallTabChange}
      customNav={customNav}
      showDeviceSidebarOverride={showDeviceSidebarOverride}
      onLogout={onLogout}
      userEmail={userEmail}
      userAccessLevel={userAccessLevel}
      devices={devices}
      selectedDeviceId={selectedDeviceId}
      onDeviceSelect={onDeviceSelect}
      onRefreshDevices={onRefreshDevices}
      headerExtra={headerExtra}
      rightSidebar={rightSidebar}
      leftSidebarOverride={leftSidebarOverride}
    >
      {children}
    </UnifiedLayout>
  )
}
