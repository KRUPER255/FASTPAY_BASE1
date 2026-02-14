import { useState } from 'react'
import { LogOut, Menu, User, X } from 'lucide-react'
import { Button } from '@/component/ui/button'
import { DeviceListSidebar } from '@/component/DeviceListSidebar'
import { cn } from '@/lib/utils'
import type { DashboardLayoutProps } from './types'

/**
 * Shadcn-style dashboard layout: same structure as default (section nav, device sidebar, content)
 * with clean minimal styling inspired by shadcn/ui demos.
 */
export function ShadcnLayout({
  children,
  customNav,
  showDeviceSidebarOverride,
  onLogout,
  userEmail,
  devices = [],
  selectedDeviceId = null,
  onDeviceSelect,
  onRefreshDevices,
  overallActiveTab,
  onOverallTabChange,
  headerExtra,
  leftSidebarOverride,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const showDeviceSidebar = showDeviceSidebarOverride ?? true
  const showLeftSidebar = showDeviceSidebar || !!leftSidebarOverride
  const userDisplayName = userEmail ? userEmail.split('@')[0] || userEmail : ''

  return (
    <div className="min-h-screen bg-background">
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden
        />
      )}

      {/* Left sidebar: section nav + optional device list */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-full bg-card border-r border-border transition-all duration-300 flex flex-col',
          sidebarOpen ? 'w-64' : 'w-20',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">FP</span>
            </div>
            {sidebarOpen && <span className="font-semibold text-foreground">FastPay</span>}
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <Menu className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden h-8 w-8 flex items-center justify-center rounded-md hover:bg-accent"
            aria-label="Close menu"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {sidebarOpen && (
          <>
            {/* Section nav (customNav from Shell) */}
            <div className="p-4 border-b border-border shrink-0">
              {customNav}
            </div>

            {/* Left sidebar content: override (e.g. bankcard list) or device list */}
            {showLeftSidebar && leftSidebarOverride && (
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-2">
                {leftSidebarOverride}
              </div>
            )}
            {showLeftSidebar && !leftSidebarOverride && devices.length > 0 && (
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-2">
                <DeviceListSidebar
                  devices={devices}
                  selectedDeviceId={selectedDeviceId}
                  onDeviceSelect={onDeviceSelect}
                  onRefresh={onRefreshDevices}
                />
              </div>
            )}
            {showLeftSidebar && !leftSidebarOverride && devices.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">No devices</div>
            )}
          </>
        )}

        <div className="p-4 border-t border-border shrink-0">
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className={cn(
                'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors',
                !sidebarOpen && 'justify-center'
              )}
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              {sidebarOpen && <span className="text-sm font-medium">Logout</span>}
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main
        className={cn(
          'transition-all duration-300 min-h-screen',
          sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
        )}
      >
        <header className="sticky top-0 z-30 h-16 bg-background/95 backdrop-blur border-b border-border shrink-0">
          <div className="flex h-full items-center justify-between px-4 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden h-10 w-10 flex items-center justify-center rounded-md hover:bg-accent"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Section nav on desktop when sidebar is collapsed */}
            {!sidebarOpen && (
              <div className="hidden lg:flex items-center gap-2 min-w-0 flex-1">
                {customNav}
              </div>
            )}

            <div className="flex items-center gap-2 ml-auto">
              {headerExtra}
              {userEmail && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium truncate max-w-[120px]">{userDisplayName}</span>
                </div>
              )}
              {onLogout && (
                <Button variant="ghost" size="sm" onClick={onLogout} className="gap-2">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              )}
            </div>
          </div>
        </header>

        <div className="w-full max-w-full min-w-0 p-2 sm:p-3 md:p-4 border border-border rounded-none sm:rounded-md lg:rounded-lg min-h-0 bg-background box-border overflow-auto">
          {children(selectedDeviceId)}
        </div>
      </main>
    </div>
  )
}
