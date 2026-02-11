// Theme management utility

export type ThemePreset =
  | 'default'
  | 'dark-premium'
  | 'blue'
  | 'green'
  | 'purple'
  | 'orange'
  | 'red'
  | 'teal'
  | 'pink'
  | 'cyberpunk'
  | 'ocean'

export interface ThemeUIConfig {
  borderRadius: string
  borderStyle: 'solid' | 'dashed' | 'dotted' | 'none'
  borderWidth: string
  shadowStyle: 'none' | 'soft' | 'medium' | 'hard' | 'glow' | 'neon'
  cardStyle: 'solid' | 'glass' | 'outlined' | 'gradient'
  spacing: 'compact' | 'normal' | 'spacious'
  backgroundPattern: 'none' | 'dots' | 'grid' | 'waves' | 'gradient'
}

export interface ThemeConfig {
  name: string
  description: string
  ui?: ThemeUIConfig
  light: {
    primary: string
    primaryForeground: string
    accent: string
    accentForeground: string
  }
  dark: {
    primary: string
    primaryForeground: string
    accent: string
    accentForeground: string
  }
}

export const themePresets: Record<ThemePreset, ThemeConfig> = {
  default: {
    name: 'Default',
    description: 'Purple/blue accent (reference dashboard)',
    light: {
      primary: '250 65% 55%',
      primaryForeground: '0 0% 98%',
      accent: '250 65% 96%',
      accentForeground: '250 65% 25%',
    },
    dark: {
      primary: '250 65% 55%',
      primaryForeground: '0 0% 98%',
      accent: '250 40% 22%',
      accentForeground: '250 65% 90%',
    },
  },
  'dark-premium': {
    name: 'Dark Premium',
    description: 'Premium dark theme',
    light: { primary: '250 65% 55%', primaryForeground: '0 0% 98%', accent: '250 65% 96%', accentForeground: '250 65% 25%' },
    dark: { primary: '250 65% 55%', primaryForeground: '0 0% 98%', accent: '250 40% 22%', accentForeground: '250 65% 90%' },
  },
  blue: {
    name: 'Blue',
    description: 'Professional blue',
    light: { primary: '221 83% 53%', primaryForeground: '0 0% 98%', accent: '221 83% 96%', accentForeground: '221 83% 20%' },
    dark: { primary: '221 83% 53%', primaryForeground: '0 0% 98%', accent: '221 83% 20%', accentForeground: '221 83% 90%' },
  },
  green: {
    name: 'Green',
    description: 'Fresh green',
    light: { primary: '142 76% 36%', primaryForeground: '0 0% 98%', accent: '142 76% 96%', accentForeground: '142 76% 20%' },
    dark: { primary: '142 76% 36%', primaryForeground: '0 0% 98%', accent: '142 76% 20%', accentForeground: '142 76% 90%' },
  },
  purple: {
    name: 'Purple',
    description: 'Elegant purple',
    light: { primary: '262 83% 58%', primaryForeground: '0 0% 98%', accent: '262 83% 96%', accentForeground: '262 83% 20%' },
    dark: { primary: '262 83% 58%', primaryForeground: '0 0% 98%', accent: '262 83% 20%', accentForeground: '262 83% 90%' },
  },
  orange: {
    name: 'Orange',
    description: 'Vibrant orange',
    light: { primary: '24 95% 53%', primaryForeground: '0 0% 98%', accent: '24 95% 96%', accentForeground: '24 95% 25%' },
    dark: { primary: '24 95% 53%', primaryForeground: '0 0% 98%', accent: '24 95% 20%', accentForeground: '24 95% 90%' },
  },
  red: {
    name: 'Red',
    description: 'Bold red',
    light: { primary: '0 84% 60%', primaryForeground: '0 0% 98%', accent: '0 84% 96%', accentForeground: '0 84% 25%' },
    dark: { primary: '0 84% 60%', primaryForeground: '0 0% 98%', accent: '0 84% 20%', accentForeground: '0 84% 90%' },
  },
  teal: {
    name: 'Teal',
    description: 'Calm teal',
    light: { primary: '173 80% 40%', primaryForeground: '0 0% 98%', accent: '173 80% 96%', accentForeground: '173 80% 25%' },
    dark: { primary: '173 80% 40%', primaryForeground: '0 0% 98%', accent: '173 80% 20%', accentForeground: '173 80% 90%' },
  },
  pink: {
    name: 'Pink',
    description: 'Soft pink',
    light: { primary: '330 81% 60%', primaryForeground: '0 0% 98%', accent: '330 81% 96%', accentForeground: '330 81% 25%' },
    dark: { primary: '330 81% 60%', primaryForeground: '0 0% 98%', accent: '330 81% 20%', accentForeground: '330 81% 90%' },
  },
  cyberpunk: {
    name: 'Cyberpunk',
    description: 'Cyberpunk style',
    light: { primary: '280 90% 50%', primaryForeground: '0 0% 98%', accent: '180 90% 96%', accentForeground: '280 90% 25%' },
    dark: { primary: '280 90% 55%', primaryForeground: '0 0% 98%', accent: '280 90% 18%', accentForeground: '280 90% 90%' },
  },
  ocean: {
    name: 'Ocean',
    description: 'Ocean blue',
    light: { primary: '199 89% 48%', primaryForeground: '0 0% 98%', accent: '199 89% 96%', accentForeground: '199 89% 25%' },
    dark: { primary: '199 89% 48%', primaryForeground: '0 0% 98%', accent: '199 89% 20%', accentForeground: '199 89% 90%' },
  },
}

function doApplyTheme(preset: ThemePreset, isDark: boolean): void {
  const theme = themePresets[preset] || themePresets.default
  const colors = isDark ? theme.dark : theme.light
  const root = typeof document !== 'undefined' && document.documentElement
  if (root) {
    root.style.setProperty('--primary', colors.primary)
    root.style.setProperty('--primary-foreground', colors.primaryForeground)
    root.style.setProperty('--accent', colors.accent)
    root.style.setProperty('--accent-foreground', colors.accentForeground)
  }
  try {
    localStorage.setItem('theme-preset', preset)
  } catch {
    // ignore
  }
}

export function getStoredTheme(): ThemePreset {
  try {
    const stored = localStorage.getItem('theme-preset') as ThemePreset
    return stored && stored in themePresets ? stored : 'default'
  } catch {
    return 'default'
  }
}

export function applyTheme(preset: ThemePreset, isDark: boolean): void {
  doApplyTheme(preset, isDark)
}

export function initTheme(): void {
  try {
    const storedDarkMode = localStorage.getItem('dark-mode')
    const modeSet = localStorage.getItem('dark-mode-set')
    const darkMode = modeSet ? storedDarkMode === 'true' : false
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    doApplyTheme(getStoredTheme(), darkMode)
  } catch {
    // ignore
  }
}

export function applyStoredTheme(isDark?: boolean): void {
  const dark = isDark ?? document.documentElement.classList.contains('dark')
  doApplyTheme(getStoredTheme(), dark)
}

export function toggleDarkMode(): boolean {
  const isDark = document.documentElement.classList.toggle('dark')
  localStorage.setItem('dark-mode', isDark.toString())
  localStorage.setItem('dark-mode-set', 'true')
  doApplyTheme(getStoredTheme(), isDark)
  return isDark
}

export function applyThemeModePreference(mode: string | undefined): boolean {
  if (!mode) return false
  const normalized = String(mode).toLowerCase().trim()
  const isDark = normalized === 'dark' || normalized === 'black'
  const isLight = normalized === 'white' || normalized === 'light'
  if (isDark || isLight) {
    if (isDark) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
    localStorage.setItem('dark-mode', isDark.toString())
    localStorage.setItem('dark-mode-set', 'true')
    doApplyTheme(getStoredTheme(), isDark)
    return true
  }
  return false
}
