import { useState, useEffect } from 'react'
import { Button } from '@/component/ui/button'
import { Label } from '@/component/ui/label'
import { Switch } from '@/component/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/component/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/component/ui/dialog'
import { Separator } from '@/component/ui/separator'
import {
  Settings2,
  Trash2,
  RefreshCw,
  Database,
  Bell,
  Monitor,
  Palette,
  Moon,
  Sun,
  Key,
  Loader,
} from 'lucide-react'
import { Input } from '@/component/ui/input'
import { useToast } from '@/lib/use-toast'
import { clearAllCaches, getCacheStats } from '@/lib/data-cache'
import { applyTheme, getStoredTheme, themePresets, type ThemePreset } from '@/lib/theme'
import { getSession, updateUserThemeMode } from '@/lib/auth'

interface SettingsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dataLimit: number
  onDataLimitChange: (limit: number) => void
  contactsSyncEnabled: boolean
  onContactsSyncChange: (enabled: boolean) => void
  notificationsSyncEnabled: boolean
  onNotificationsSyncChange: (enabled: boolean) => void
  dashboardCode?: string
  onDashboardCodeChange?: (code: string) => void
  onAddDevice?: () => void
  isAddingDevice?: boolean
  onRefresh?: () => void
}

export default function SettingsPanel({
  open,
  onOpenChange,
  dataLimit,
  onDataLimitChange,
  contactsSyncEnabled,
  onContactsSyncChange,
  notificationsSyncEnabled,
  onNotificationsSyncChange,
  dashboardCode = '',
  onDashboardCodeChange,
  onAddDevice,
  isAddingDevice = false,
  onRefresh,
}: SettingsPanelProps) {
  const { toast } = useToast()
  const [cacheStats, setCacheStats] = useState<any>(null)
  const [currentTheme, setCurrentTheme] = useState<ThemePreset>(() => {
    try {
      return getStoredTheme()
    } catch {
      return 'default'
    }
  })
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      return typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (open) {
      try {
        // Load cache stats when panel opens
        setCacheStats(getCacheStats())
        // Update theme state
        setCurrentTheme(getStoredTheme())
        if (typeof document !== 'undefined' && document.documentElement) {
          setIsDarkMode(document.documentElement.classList.contains('dark'))
        }
      } catch (error) {
        console.error('Error loading settings:', error)
      }
    }
  }, [open])

  const handleThemeChange = (theme: ThemePreset) => {
    setCurrentTheme(theme)
    applyTheme(theme, isDarkMode)
    toast({
      title: 'Theme updated',
      description: `Applied ${themePresets[theme].name} theme`,
      variant: 'default',
    })
  }

  const handleDarkModeToggle = (checked: boolean) => {
    if (checked) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('dark-mode', checked.toString())
    localStorage.setItem('dark-mode-set', 'true')
    setIsDarkMode(checked)
    // Reapply theme with new mode
    applyTheme(currentTheme, checked)
    const session = getSession()
    if (session?.email) {
      const themeMode = checked ? 'dark' : 'white'
      updateUserThemeMode(session.email, themeMode)
    }
    toast({
      title: checked ? 'Dark mode enabled' : 'Light mode enabled',
      description: 'Theme updated',
      variant: 'default',
    })
  }

  const handleClearCache = () => {
    clearAllCaches()
    setCacheStats(getCacheStats())
    toast({
      title: 'Cache cleared',
      description: 'All cached data has been cleared successfully',
      variant: 'default',
    })
    // Trigger refresh if callback provided
    onRefresh?.()
  }

  const handleResetSettings = () => {
    // Reset to defaults
    onDataLimitChange(30)
    onContactsSyncChange(true)
    onNotificationsSyncChange(true)
    toast({
      title: 'Settings reset',
      description: 'All settings have been reset to defaults',
      variant: 'default',
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Settings
          </DialogTitle>
          <DialogDescription>Manage your dashboard preferences and settings</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Theme Preferences */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">Theme</h3>
            </div>
            <div className="space-y-3 pl-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="darkMode">Dark Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Toggle between light and dark mode
                  </p>
                </div>
                <Switch id="darkMode" checked={isDarkMode} onCheckedChange={handleDarkModeToggle} />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="themePreset">Color Theme</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose a color scheme for your dashboard
                  </p>
                </div>
                <Select
                  value={currentTheme}
                  onValueChange={value => handleThemeChange(value as ThemePreset)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(themePresets).map(([key, theme]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full border border-border"
                            style={{
                              backgroundColor: `hsl(${isDarkMode ? theme.dark.primary : theme.light.primary})`,
                            }}
                          />
                          <span>{theme.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 mt-4">
                {Object.entries(themePresets).map(([key, theme]) => (
                  <button
                    key={key}
                    onClick={() => handleThemeChange(key as ThemePreset)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      currentTheme === key
                        ? 'border-primary bg-accent'
                        : 'border-border hover:border-primary/50'
                    }`}
                    title={theme.description}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-full border border-border/50"
                        style={{
                          backgroundColor: `hsl(${isDarkMode ? theme.dark.primary : theme.light.primary})`,
                        }}
                      />
                      <span className="text-xs font-medium text-center">{theme.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Separator />

          {/* Code Configuration */}
          {onDashboardCodeChange && (
            <>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">Device Code</h3>
                </div>
                <div className="space-y-3 pl-6">
                  <div className="space-y-2">
                    <Label htmlFor="dashboardCode">Device Code</Label>
                    <p className="text-sm text-muted-foreground">
                      Enter device code to add to your device list
                    </p>
                    <div className="flex gap-2">
                      <Input
                        id="dashboardCode"
                        type="text"
                        placeholder="Enter device code"
                        value={dashboardCode}
                        onChange={e => onDashboardCodeChange(e.target.value)}
                        className="w-full"
                        disabled={isAddingDevice}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && onAddDevice && !isAddingDevice) {
                            onAddDevice()
                          }
                        }}
                      />
                      {onAddDevice && (
                        <Button
                          onClick={onAddDevice}
                          disabled={isAddingDevice || !dashboardCode.trim()}
                        >
                          {isAddingDevice ? (
                            <>
                              <Loader className="h-4 w-4 mr-2 animate-spin" />
                              Adding...
                            </>
                          ) : (
                            'Add Device'
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Data Preferences */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">Data Preferences</h3>
            </div>
            <div className="space-y-3 pl-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="dataLimit">Data Limit</Label>
                  <p className="text-sm text-muted-foreground">Number of records to load per tab</p>
                </div>
                <Select
                  value={dataLimit.toString()}
                  onValueChange={value => onDataLimitChange(parseInt(value))}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="30">30</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Sync Preferences */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">Real-time Sync</h3>
            </div>
            <div className="space-y-3 pl-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="contactsSync">Contacts Sync</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable real-time sync for contacts
                  </p>
                </div>
                <Switch
                  id="contactsSync"
                  checked={contactsSyncEnabled}
                  onCheckedChange={onContactsSyncChange}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notificationsSync">Notifications Sync</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable real-time sync for notifications
                  </p>
                </div>
                <Switch
                  id="notificationsSync"
                  checked={notificationsSyncEnabled}
                  onCheckedChange={onNotificationsSyncChange}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Cache Management */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">Cache Management</h3>
            </div>
            <div className="space-y-3 pl-6">
              {cacheStats && (
                <div className="rounded-lg border p-3 bg-muted/50">
                  <p className="text-sm font-medium mb-2">Cache Statistics</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">SMS Cache: </span>
                      <span className="font-medium">
                        {cacheStats.sms.size}/{cacheStats.sms.maxSize}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Notifications: </span>
                      <span className="font-medium">
                        {cacheStats.notifications.size}/{cacheStats.notifications.maxSize}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Contacts: </span>
                      <span className="font-medium">
                        {cacheStats.contacts.size}/{cacheStats.contacts.maxSize}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Device Status: </span>
                      <span className="font-medium">
                        {cacheStats.deviceStatus.size}/{cacheStats.deviceStatus.maxSize}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <Button variant="outline" onClick={handleClearCache} className="w-full">
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All Cache
              </Button>
              <p className="text-xs text-muted-foreground">
                Clearing cache will remove all cached data. Data will be reloaded on next access.
              </p>
            </div>
          </div>

          <Separator />

          {/* Reset Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">Reset</h3>
            </div>
            <div className="pl-6">
              <Button variant="outline" onClick={handleResetSettings} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset to Defaults
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Reset all settings to their default values
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
