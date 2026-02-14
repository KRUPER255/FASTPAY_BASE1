import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/component/ui/card'
import { MessageSquare, User, LogOut, Moon, Sun, UserCircle, Key, Bell, ChevronDown } from 'lucide-react'

import { Badge } from '@/component/ui/badge'
import { Button } from '@/component/ui/button'
import { DeviceListSidebar } from './DeviceListSidebar'
import { ProfileViewDialog } from './ProfileViewDialog'
import { ResetPasswordDialog } from './ResetPasswordDialog'
import { clearSession, getLoginUrl } from '@/lib/auth'
import { toggleDarkMode, getStoredTheme, applyTheme, type ThemePreset } from '@/lib/theme'
import { ThemeToggleSwitch } from '@/component/ui/ThemeToggleSwitch'
import { SIDEBAR_TABS, isTabAllowedForAccess } from '@/lib/sidebar-tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/component/ui/dropdown-menu'

/** Logo "F" + "ast Dashboard" = "Fast Dashboard" in unified dashboard header */
function DashboardLogoTitle({ title, description }: { title?: string; description?: string }) {
  const isDefaultTitle = title === 'FastPay Dashboard' || !title
  const displayTitle = isDefaultTitle ? 'ast Dashboard' : title
  return (
    <div className="flex items-center gap-3 shrink-0 min-w-0">
      <div
        className="dashboard-logo-entrance h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 ring-1 ring-primary/10"
        aria-hidden
      >
        <span className="text-2xl font-black text-primary tracking-tighter select-none" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
          F
        </span>
      </div>
      <div className="min-w-0 hidden sm:block">
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground truncate">
          <span className="sr-only">F</span>
          {displayTitle}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground truncate">{description}</p>
        )}
      </div>
    </div>
  )
}

interface Device {
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

interface UnifiedLayoutProps {
  children: (deviceId: string | null) => React.ReactNode
  rightSidebar?: (deviceId: string | null) => React.ReactNode
  showAdminFeatures?: boolean
  selectedDeviceId?: string | null
  devices?: Device[]
  onDeviceSelect?: (deviceId: string) => void
  onAttachBankCard?: (deviceId: string) => void
  onRefreshDevices?: () => void
  onCodeClick?: () => void
  taglineMap?: Map<string, string>
  title?: string
  description?: string
  userEmail?: string | null
  onLogout?: () => void
  userAccessLevel?: number
  // Overall Dashboard tabs
  overallActiveTab?: string
  onOverallTabChange?: (tab: string) => void
  onDeviceClear?: () => void
  /** When provided, render this instead of SIDEBAR_TABS nav (v2 DefaultLayout) */
  customNav?: React.ReactNode
  /** When provided, overrides device/right sidebar visibility (v2 DefaultLayout) */
  showDeviceSidebarOverride?: boolean
  /** Optional node rendered in the header (e.g. layout theme switcher) */
  headerExtra?: React.ReactNode
  /** When set, render this in the left column instead of the device list (e.g. bankcard section). */
  leftSidebarOverride?: React.ReactNode
}

export function UnifiedLayout({
  children,
  rightSidebar,
  showAdminFeatures = false,
  selectedDeviceId = null,
  devices = [],
  onDeviceSelect,
  onAttachBankCard,
  onRefreshDevices,
  onCodeClick,
  taglineMap = new Map(),
  title = 'FastPay Dashboard',
  description,
  userEmail,
  onLogout,
  userAccessLevel,
  overallActiveTab,
  onOverallTabChange,
  onDeviceClear,
  customNav,
  showDeviceSidebarOverride,
  headerExtra,
  leftSidebarOverride,
}: UnifiedLayoutProps) {
  const [selectedDevice, setSelectedDevice] = useState<string | null>(
    selectedDeviceId || devices[0]?.id || null
  )

  const handleLogoutClick = () => {
    clearSession()
    onLogout?.()
    window.location.href = getLoginUrl()
  }
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark')
    }
    return true
  })
  const [currentTheme, setCurrentTheme] = useState<ThemePreset>(() => {
    try {
      return getStoredTheme()
    } catch {
      return 'dark-premium'
    }
  })
  const [showProfileDialog, setShowProfileDialog] = useState(false)
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false)

  useEffect(() => {
    if (selectedDeviceId !== selectedDevice) {
      setSelectedDevice(selectedDeviceId || devices[0]?.id || null)
    }
  }, [selectedDeviceId, devices])

  // Sync with theme changes from other components (like SettingsPanel)
  useEffect(() => {
    const checkTheme = () => {
      if (typeof document !== 'undefined') {
        setIsDarkMode(document.documentElement.classList.contains('dark'))
        // Also sync current theme
        try {
          setCurrentTheme(getStoredTheme())
        } catch {
          // Ignore errors
        }
      }
    }

    // Check on mount
    checkTheme()

    // Listen for theme changes
    const observer = new MutationObserver(checkTheme)
    if (typeof document !== 'undefined' && document.documentElement) {
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      })
    }

    // Listen for storage changes (theme preset changes)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'theme-preset') {
        try {
          setCurrentTheme(getStoredTheme())
        } catch {
          // Ignore errors
        }
      }
    }
    window.addEventListener('storage', handleStorageChange)

    return () => {
      observer.disconnect()
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  const handleThemeToggle = (checked: boolean) => {
    const newDarkMode = toggleDarkMode()
    setIsDarkMode(newDarkMode)
    // Reapply current theme with new mode
    applyTheme(currentTheme, newDarkMode)
  }

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDevice(deviceId)
    onDeviceSelect?.(deviceId)
  }

  const userDisplayName = userEmail ? userEmail.split('@')[0] || userEmail : ''

  const currentDevice = devices.find(d => d.id === selectedDevice)
  const tagline = currentDevice?.code ? taglineMap.get(currentDevice.code) : null
  const isOverviewOnly = overallActiveTab === 'overview'
  const showDeviceSidebar =
    showDeviceSidebarOverride !== undefined ? showDeviceSidebarOverride : !isOverviewOnly
  const showRightSidebar =
    showDeviceSidebarOverride !== undefined ? showDeviceSidebarOverride : !isOverviewOnly
  const showLeftSidebar = showDeviceSidebar || !!leftSidebarOverride
  if (devices.length === 0 && !leftSidebarOverride) {
    return (
      <div className="min-h-screen w-full max-w-full min-w-0 bg-background p-2 sm:p-3 border border-border rounded-none sm:rounded-md lg:rounded-lg box-border overflow-hidden">
        <div className="dashboard-outer-border rounded-none">
        <div className="dashboard-shell flex min-h-screen rounded-none overflow-hidden">
            <div className="flex-1 min-w-0 space-y-4 px-4 sm:px-6 py-4">
            <header className="border-b border-border/40 pb-3">
              <div className="flex flex-nowrap items-center gap-4 min-w-0">
                <DashboardLogoTitle title={title} description={description} />
                <div className="flex-1 min-w-0 flex items-center justify-center">
                  {customNav ? (
                    <nav className="flex items-center gap-2">{customNav}</nav>
                  ) : onOverallTabChange ? (
                    <nav className="flex flex-wrap items-center gap-2 justify-center">
                      {SIDEBAR_TABS.map(item => {
                        const Icon = item.icon
                        const isActive = overallActiveTab === item.key
                        const isAllowed = isTabAllowedForAccess(item.key, userAccessLevel)
                        return (
                          <Button
                            key={item.key}
                            variant={isActive ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => onOverallTabChange?.(item.key)}
                            disabled={!isAllowed}
                            className={`gap-2 h-9 shrink-0 ${!isAllowed ? 'opacity-50 cursor-not-allowed' : ''}`}
                            type="button"
                          >
                            <Icon className="h-4 w-4" />
                            <span className="text-sm">{item.label}</span>
                          </Button>
                        )
                      })}
                    </nav>
                  ) : null}
                  {headerExtra}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
                    <Bell className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-full bg-muted/50 border border-border shrink-0">
                    <Sun className={`h-4 w-4 transition-colors ${isDarkMode ? 'text-muted-foreground' : 'text-primary'}`} />
                    <ThemeToggleSwitch checked={isDarkMode} onChange={handleThemeToggle} />
                    <Moon className={`h-4 w-4 transition-colors ${isDarkMode ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {userEmail && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border">
                      <User className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm text-foreground truncate max-w-[120px]">{userDisplayName}</span>
                    </div>
                  )}
                  <Button variant="outline" size="sm" onClick={handleLogoutClick} className="gap-2 h-9 shrink-0">
                    <LogOut className="h-4 w-4" />
                    Logout
                  </Button>
                </div>
              </div>
            </header>
            <Card variant="outline">
              <CardContent className="p-6">
                <div className="text-center py-10 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No devices available</p>
                </div>
              </CardContent>
            </Card>
            </div>
        </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full max-w-full min-w-0 bg-background p-2 sm:p-3 border border-border rounded-none sm:rounded-md lg:rounded-lg box-border overflow-hidden">
          <div className="dashboard-outer-border rounded-none">
          <div className="dashboard-shell flex min-h-screen rounded-none overflow-hidden">
          <div className="flex-1 min-w-0 space-y-4 px-4 sm:px-6 py-4">
            <header className="border-b border-border/40 pb-3">
            <div className="flex flex-nowrap items-center gap-4 min-w-0">
              <DashboardLogoTitle title={title} description={description} />
              <div className="flex-1 min-w-0 flex items-center justify-center">
                {customNav ? (
                  <nav className="flex items-center gap-2">{customNav}</nav>
                ) : onOverallTabChange ? (
                  <nav className="flex flex-wrap items-center gap-2 justify-center">
                    {SIDEBAR_TABS.map(item => {
                      const Icon = item.icon
                      const isActive = overallActiveTab === item.key
                      const isAllowed = isTabAllowedForAccess(item.key, userAccessLevel)
                      return (
                        <Button
                          key={item.key}
                          variant={isActive ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => onOverallTabChange?.(item.key)}
                          disabled={!isAllowed}
                          className={`gap-2 h-9 shrink-0 ${!isAllowed ? 'opacity-50 cursor-not-allowed' : ''}`}
                          type="button"
                        >
                          <Icon className="h-4 w-4" />
                          <span className="text-sm">{item.label}</span>
                        </Button>
                      )
                    })}
                  </nav>
                ) : null}
                {headerExtra}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
                  <Bell className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-full bg-muted/50 border border-border shrink-0">
                  <Sun className={`h-4 w-4 transition-colors ${isDarkMode ? 'text-muted-foreground' : 'text-primary'}`} />
                  <ThemeToggleSwitch checked={isDarkMode} onChange={handleThemeToggle} />
                  <Moon className={`h-4 w-4 transition-colors ${isDarkMode ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {userEmail && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2 h-9 rounded-full shrink-0">
                        <User className="h-4 w-4 text-primary" />
                        <span className="hidden md:inline font-medium text-sm text-foreground truncate max-w-[120px]">
                          {userDisplayName}
                        </span>
                        {showAdminFeatures && (
                          <span className="hidden sm:inline text-xs text-muted-foreground ml-1">
                            Admin
                          </span>
                        )}
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 z-[100]">
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none">{userDisplayName}</p>
                          {showAdminFeatures && (
                            <p className="text-xs leading-none text-muted-foreground">Administrator</p>
                          )}
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          setShowProfileDialog(true)
                        }}
                        className="cursor-pointer"
                      >
                        <UserCircle className="mr-2 h-4 w-4" />
                        <span>Profile View</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setShowResetPasswordDialog(true)
                        }}
                        className="cursor-pointer"
                      >
                        <Key className="mr-2 h-4 w-4" />
                        <span>Reset Password</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => setTimeout(() => handleLogoutClick(), 0)}
                        onClick={handleLogoutClick}
                        className="cursor-pointer text-destructive focus:text-destructive"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Exit</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </header>

          {/* One structure: devicemenu | contentsection & bankcardbar side by side */}
          <div
            className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:pl-0"
            data-structure="device-dashboard"
            aria-label="Device dashboard: device list, content, bank card"
          >
            {/* devicemenu - Left: device list */}
            {showLeftSidebar && (
              <div className="lg:col-span-3 order-2 lg:order-1" data-region="devicemenu">
                {leftSidebarOverride ?? (
                  <DeviceListSidebar
                    devices={devices}
                    selectedDeviceId={selectedDevice}
                    onDeviceSelect={handleDeviceChange}
                    onAttachBankCard={onAttachBankCard}
                    onRefresh={onRefreshDevices}
                    onCodeClick={onCodeClick}
                  />
                )}
              </div>
            )}

            {/* contentsection - Center: main content */}
            <div
              className={`${
                showLeftSidebar && showRightSidebar ? 'lg:col-span-6' : showLeftSidebar || showRightSidebar ? 'lg:col-span-9' : 'lg:col-span-12'
              } space-y-3 sm:space-y-4 order-1 lg:order-2`}
              data-region="contentsection"
            >
              {/* Tagline Section */}
              {tagline && selectedDevice && (
                <div className="px-4 sm:px-5 py-3 sm:py-4 border border-border/50 bg-gradient-to-r from-primary/5 via-muted/30 to-primary/5 rounded-xl shadow-tailadmin backdrop-blur-sm">
                  <div className="w-full grid place-items-center">
                    <p className="text-sm sm:text-base text-foreground text-center font-bold m-0 px-2">
                      {tagline}
                    </p>
                  </div>
                </div>
              )}

              {/* Children render content here - animate when device changes */}
              <div key={selectedDevice ?? 'no-device'} className="device-content-enter">
                {children(selectedDevice)}
              </div>
            </div>

            {/* bankcardbar - Right: bank card panel */}
            {showRightSidebar && rightSidebar && (
              <div className="lg:col-span-3 order-3 lg:order-3 min-w-0 overflow-y-auto mt-3 lg:mt-12 flex flex-col min-h-0" data-region="bankcardbar">
                {selectedDevice ? (
                  <div key={selectedDevice} className="flex-1 min-h-0 flex flex-col bank-card-slide-in">
                    {rightSidebar(selectedDevice)}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground p-4">Select a device to view bank cards</div>
                )}
              </div>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* Profile View Dialog */}
      <ProfileViewDialog
        open={showProfileDialog}
        onOpenChange={setShowProfileDialog}
        userEmail={userEmail}
        userAccessLevel={userAccessLevel}
      />

      {/* Reset Password Dialog */}
      <ResetPasswordDialog
        open={showResetPasswordDialog}
        onOpenChange={setShowResetPasswordDialog}
        userEmail={userEmail}
      />
    </div>
  )
}
