import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Smartphone,
  CreditCard,
  Wrench,
  AlertTriangle,
  Activity,
  Code2,
  Bot,
} from 'lucide-react'
import type { ActiveTabType } from '@/pages/dashboard/types'

export type SidebarTabConfig = {
  key: ActiveTabType
  label: string
  icon: LucideIcon
  allowedAccessLevels?: number[]
}

export const SIDEBAR_TAB_STORAGE_KEY = 'dashboard-active-tab'

export const DEFAULT_SIDEBAR_TAB: ActiveTabType = 'overview'

export const SIDEBAR_TABS: SidebarTabConfig[] = [
  { key: 'overview', label: 'Dashboard', icon: LayoutDashboard, allowedAccessLevels: [0, 1, 2] },
  { key: 'devices', label: 'Device', icon: Smartphone, allowedAccessLevels: [0, 1, 2] },
  { key: 'bank-cards', label: 'Bank Cards', icon: CreditCard, allowedAccessLevels: [0] },
  { key: 'telegram-bots', label: 'Telegram', icon: Bot, allowedAccessLevels: [0] },
  { key: 'utilities', label: 'Utilities', icon: Wrench, allowedAccessLevels: [0] },
  { key: 'activation-failures', label: 'Failures', icon: AlertTriangle, allowedAccessLevels: [0] },
  { key: 'activity-logs', label: 'Activity', icon: Activity, allowedAccessLevels: [0] },
  { key: 'api', label: 'API', icon: Code2, allowedAccessLevels: [0] },
]

export const isSidebarTabKey = (value?: string | null): value is ActiveTabType =>
  SIDEBAR_TABS.some(tab => tab.key === value)

export const isTabAllowedForAccess = (tabKey: ActiveTabType, accessLevel?: number | null): boolean => {
  const tab = SIDEBAR_TABS.find(item => item.key === tabKey)
  if (!tab?.allowedAccessLevels || tab.allowedAccessLevels.length === 0) {
    return true
  }
  if (accessLevel === undefined || accessLevel === null) {
    return true
  }
  return tab.allowedAccessLevels.includes(accessLevel)
}

export const getFirstAllowedTab = (accessLevel?: number | null): ActiveTabType => {
  const fallback = SIDEBAR_TABS.find(item => isTabAllowedForAccess(item.key, accessLevel))
  return fallback?.key || DEFAULT_SIDEBAR_TAB
}

export const getAllowedSidebarTab = (
  candidate?: string | null,
  accessLevel?: number | null
): ActiveTabType => {
  if (isSidebarTabKey(candidate) && isTabAllowedForAccess(candidate, accessLevel)) {
    return candidate
  }
  return getFirstAllowedTab(accessLevel)
}
