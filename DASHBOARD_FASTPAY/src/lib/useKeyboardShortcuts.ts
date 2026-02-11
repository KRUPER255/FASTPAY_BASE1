import { useEffect } from 'react'

interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  callback: () => void
  description?: string
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      shortcuts.forEach(shortcut => {
        const ctrlMatch = shortcut.ctrlKey === undefined || event.ctrlKey === shortcut.ctrlKey
        const metaMatch = shortcut.metaKey === undefined || event.metaKey === shortcut.metaKey
        const shiftMatch = shortcut.shiftKey === undefined || event.shiftKey === shortcut.shiftKey
        const altMatch = shortcut.altKey === undefined || event.altKey === shortcut.altKey
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()

        if (ctrlMatch && metaMatch && shiftMatch && altMatch && keyMatch) {
          event.preventDefault()
          shortcut.callback()
        }
      })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])
}

// Common keyboard shortcuts for the dashboard
export const DASHBOARD_SHORTCUTS = {
  SEARCH: { key: 'k', ctrlKey: true, description: 'Focus search' },
  ESCAPE: { key: 'Escape', description: 'Close dialogs' },
  REFRESH: { key: 'r', ctrlKey: true, description: 'Refresh data' },
} as const
