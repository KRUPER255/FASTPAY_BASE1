import type React from 'react'

/**
 * Props contract for dashboard layout themes.
 * Mirrors the subset of UnifiedLayout props used by DashboardShell.
 */
export interface DashboardLayoutDevice {
  id: string
  name?: string
  code?: string
  phone?: string
  currentPhone?: string
  lastSeen?: number
  batteryPercentage?: number
  isActive?: boolean
  time?: number
}

export interface DashboardLayoutProps {
  children: (deviceId: string | null) => React.ReactNode
  customNav?: React.ReactNode
  showDeviceSidebarOverride?: boolean
  onLogout?: () => void
  userEmail?: string | null
  userAccessLevel?: number
  devices?: DashboardLayoutDevice[]
  selectedDeviceId?: string | null
  onDeviceSelect?: (deviceId: string) => void
  onRefreshDevices?: () => void
  overallActiveTab?: string
  onOverallTabChange?: (tab: string) => void
  /** Optional node rendered in the header (e.g. layout theme switcher) */
  headerExtra?: React.ReactNode
  /** Right sidebar content (e.g. bank card for selected device). Receives deviceId. */
  rightSidebar?: (deviceId: string | null) => React.ReactNode
  /** When set, render this in the left column instead of the device list (e.g. bankcard section). */
  leftSidebarOverride?: React.ReactNode
}

export interface DashboardLayoutTheme {
  id: string
  name: string
  Layout: React.ComponentType<DashboardLayoutProps>
}
