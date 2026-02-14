import type { LucideIcon } from 'lucide-react'
import { Smartphone, Users } from 'lucide-react'
import type { DashboardSectionType } from '@/pages/dashboard/types'

export interface DashboardSectionConfig {
  key: DashboardSectionType
  label: string
  icon: LucideIcon
  showDeviceSidebar: boolean
}

// REDPAY: Device and User Management sections
export const DASHBOARD_SECTIONS: DashboardSectionConfig[] = [
  { key: 'device', label: 'Device', icon: Smartphone, showDeviceSidebar: true },
  { key: 'users', label: 'Users', icon: Users, showDeviceSidebar: false },
]

export const DASHBOARD_SECTION_STORAGE_KEY = 'dashboard-v2-section'

export function getSectionByKey(key: DashboardSectionType): DashboardSectionConfig | undefined {
  return DASHBOARD_SECTIONS.find(s => s.key === key)
}

export function getFirstSection(): DashboardSectionConfig {
  return DASHBOARD_SECTIONS[0]
}

export function showDeviceSidebarForSection(key: DashboardSectionType): boolean {
  const section = getSectionByKey(key)
  return section?.showDeviceSidebar ?? false
}
