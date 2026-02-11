import type { DashboardLayoutTheme } from './types'
import { DefaultLayout } from './DefaultLayout'
import { ShadcnLayout } from './ShadcnLayout'

export const DASHBOARD_LAYOUT_THEME_STORAGE_KEY = 'dashboard-layout-theme'

export const DASHBOARD_LAYOUT_THEMES: DashboardLayoutTheme[] = [
  { id: 'default', name: 'Default', Layout: DefaultLayout },
  { id: 'shadcn', name: 'shadcn/ui', Layout: ShadcnLayout },
]

export function getDashboardLayoutTheme(id: string): DashboardLayoutTheme {
  const theme = DASHBOARD_LAYOUT_THEMES.find(t => t.id === id)
  if (!theme) {
    return DASHBOARD_LAYOUT_THEMES[0]
  }
  return theme
}

/**
 * Returns the layout theme id to use: env VITE_DASHBOARD_LAYOUT_THEME, then
 * localStorage dashboard-layout-theme, then 'default'.
 */
export function getDefaultDashboardLayoutThemeId(): string {
  const envId = import.meta.env.VITE_DASHBOARD_LAYOUT_THEME
  if (typeof envId === 'string' && envId.trim()) {
    return envId.trim()
  }
  try {
    const stored = localStorage.getItem(DASHBOARD_LAYOUT_THEME_STORAGE_KEY)
    if (stored && DASHBOARD_LAYOUT_THEMES.some(t => t.id === stored)) {
      return stored
    }
  } catch {
    // ignore
  }
  return 'default'
}
