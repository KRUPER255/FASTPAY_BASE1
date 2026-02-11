import type { LucideIcon } from 'lucide-react'
import { Smartphone, CreditCard, Wrench, Code2, User, Users } from 'lucide-react'
import type { DashboardSectionType } from '@/pages/dashboard/types'

export interface DashboardSectionConfig {
  key: DashboardSectionType
  label: string
  icon: LucideIcon
  showDeviceSidebar: boolean
  /** If set, only show for admin (access_level 0) */
  adminOnly?: boolean
}

export const DASHBOARD_SECTIONS: DashboardSectionConfig[] = [
  { key: 'device', label: 'Device', icon: Smartphone, showDeviceSidebar: true },
  { key: 'bankcard', label: 'Bankcard', icon: CreditCard, showDeviceSidebar: false },
  { key: 'users', label: 'Users', icon: Users, showDeviceSidebar: false, adminOnly: true },
  { key: 'utility', label: 'Utility', icon: Wrench, showDeviceSidebar: false },
  { key: 'api', label: 'API', icon: Code2, showDeviceSidebar: false },
  { key: 'profile', label: 'Profile', icon: User, showDeviceSidebar: false },
]

export const DASHBOARD_SECTION_STORAGE_KEY = 'dashboard-v2-section'

export function getSectionByKey(key: DashboardSectionType): DashboardSectionConfig | undefined {
  return DASHBOARD_SECTIONS.find(s => s.key === key)
}

/** Sections visible to the user; filters adminOnly when accessLevel !== 0 */
export function getVisibleSections(accessLevel: number): DashboardSectionConfig[] {
  const isAdmin = accessLevel === 0
  return DASHBOARD_SECTIONS.filter(s => !s.adminOnly || isAdmin)
}

export function getFirstSection(): DashboardSectionConfig {
  return DASHBOARD_SECTIONS[0]
}

export function showDeviceSidebarForSection(key: DashboardSectionType): boolean {
  const section = getSectionByKey(key)
  return section?.showDeviceSidebar ?? false
}
