import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getSession, getUserAccess } from '@/lib/auth'
import { useDashboardDevices } from '@/hooks/dashboard'
import { useToast } from '@/lib/use-toast'
import {
  getDashboardLayoutTheme,
  getDefaultDashboardLayoutThemeId,
  DASHBOARD_LAYOUT_THEME_STORAGE_KEY,
} from '@/pages/dashboard/layouts/registry'
import { SectionNav } from '@/component/SectionNav'
import {
  getFirstSection,
  getVisibleSections,
  DASHBOARD_SECTION_STORAGE_KEY,
  showDeviceSidebarForSection,
} from '@/lib/dashboard-sections'
import type { DashboardSectionType } from '@/pages/dashboard/types'
import { DeviceSectionView } from '@/pages/dashboard/views/DeviceSectionView'
import { BankcardSectionView } from '@/pages/dashboard/views/BankcardSectionView'
import { BankCardListSidebar } from '@/pages/dashboard/components/BankCardListSidebar'
import { UtilitySectionView } from '@/pages/dashboard/views/UtilitySectionView'
import { ApiSectionView } from '@/pages/dashboard/views/ApiSectionView'
import { UserManagementSectionView } from '@/pages/dashboard/views/UserManagementSectionView'
import { BankCardSidebar } from '@/component/BankCardSidebar'

function readStoredSection(accessLevel: number): DashboardSectionType {
  const validKeys = getVisibleSections(accessLevel).map(s => s.key)
  try {
    const stored = localStorage.getItem(DASHBOARD_SECTION_STORAGE_KEY) as DashboardSectionType | null
    if (stored && validKeys.includes(stored)) return stored
  } catch {
    // ignore
  }
  const first = getVisibleSections(accessLevel)[0]
  return first?.key ?? getFirstSection().key
}

interface DashboardShellProps {
  onLogout?: () => void
  userEmail?: string | null
  userAccessLevel?: number
}

export function DashboardShell({
  onLogout,
  userEmail: userEmailProp,
  userAccessLevel: userAccessLevelProp,
}: DashboardShellProps) {
  const session = useMemo(() => getSession(), [])
  const userEmail = userEmailProp ?? session?.email ?? null
  const userAccessLevel = userAccessLevelProp ?? getUserAccess()

  const [activeSection, setActiveSection] = useState<DashboardSectionType>(() =>
    readStoredSection(userAccessLevelProp ?? getUserAccess())
  )
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [layoutThemeId, setLayoutThemeId] = useState(getDefaultDashboardLayoutThemeId)

  const handleLayoutThemeChange = useCallback((id: string) => {
    try {
      localStorage.setItem(DASHBOARD_LAYOUT_THEME_STORAGE_KEY, id)
    } catch {
      // ignore
    }
    setLayoutThemeId(id)
  }, [])

  const {
    devices: users,
    loading: devicesLoading,
    error: devicesError,
    refresh: refreshDevices,
  } = useDashboardDevices({
    sessionEmail: userEmail,
    refreshTrigger: 0,
  })

  const devices = useMemo(
    () =>
      users.map(user => ({
        id: user.id,
        name: user.device || user.id,
        code: user.code || undefined,
        phone: user.phone || undefined,
        currentPhone: user.phone || undefined,
        lastSeen: user.lastSeen ?? undefined,
        batteryPercentage: user.batteryPercentage ?? undefined,
        isActive: user.isOnline ?? false,
        time: user.time ? parseInt(user.time) : undefined,
        companyCode: user.companyCode ?? undefined,
        companyName: user.companyName ?? undefined,
      })),
    [users]
  )

  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  // Handle Gmail OAuth redirect from backend (domain deployment)
  useEffect(() => {
    const google = searchParams.get('google')
    if (!google) return
    const message = searchParams.get('message')
    if (google === 'connected') {
      toast({
        title: 'Gmail connected',
        description: 'You can use the Gmail tab.',
        variant: 'success',
      })
      const storedDeviceId = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('dashboard_oauth_return_device_id')
      if (storedDeviceId) {
        setSelectedDeviceId(storedDeviceId)
        sessionStorage.removeItem('dashboard_oauth_return_device_id')
      }
    } else if (google === 'error') {
      toast({
        title: 'Google sign-in failed',
        description: message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      })
    }
    const next = new URLSearchParams(searchParams)
    next.delete('google')
    next.delete('message')
    next.delete('tab')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, toast])

  const initialDeviceSectionTab = searchParams.get('tab') === 'google' ? 'google' : undefined

  const handleRefreshDevices = useCallback(() => {
    refreshDevices()
    toast({
      title: 'Refreshing',
      description: 'Updating device list...',
      variant: 'default',
    })
  }, [refreshDevices, toast])

  const handleSectionChange = useCallback((key: DashboardSectionType) => {
    setActiveSection(key)
    try {
      localStorage.setItem(DASHBOARD_SECTION_STORAGE_KEY, key)
    } catch {
      // ignore
    }
  }, [])

  const handleDeviceSelect = useCallback((deviceId: string) => {
    setSelectedDeviceId(deviceId)
  }, [])

  const renderContent = useCallback(
    (layoutDeviceId: string | null) => {
      const currentDeviceId = layoutDeviceId || selectedDeviceId
      switch (activeSection) {
        case 'device':
          return (
            <DeviceSectionView
              deviceId={currentDeviceId}
              devices={users}
              devicesError={devicesError}
              onRefreshDevices={handleRefreshDevices}
              sessionEmail={userEmail}
              isAdmin={userAccessLevel === 0}
              initialDeviceSectionTab={initialDeviceSectionTab}
            />
          )
        case 'bankcard':
          return (
            <BankcardSectionView
              deviceId={layoutDeviceId || selectedDeviceId}
              devices={users}
              onDeviceSelect={handleDeviceSelect}
              sessionEmail={userEmail}
              isAdmin={userAccessLevel === 0}
            />
          )
        case 'users':
          return (
            <UserManagementSectionView sessionEmail={userEmail} />
          )
        case 'utility':
          return (
            <UtilitySectionView
              deviceId={layoutDeviceId || selectedDeviceId}
              sessionEmail={userEmail}
              isAdmin={userAccessLevel === 0}
            />
          )
        case 'api':
          return <ApiSectionView />
        default:
          return (
            <DeviceSectionView
              deviceId={currentDeviceId}
              devices={users}
              devicesError={devicesError}
              onRefreshDevices={handleRefreshDevices}
              sessionEmail={userEmail}
              isAdmin={userAccessLevel === 0}
              initialDeviceSectionTab={initialDeviceSectionTab}
            />
          )
      }
    },
    [
      activeSection,
      selectedDeviceId,
      users,
      devicesError,
      handleRefreshDevices,
      userEmail,
      userAccessLevel,
      onLogout,
    ]
  )

  const { Layout } = getDashboardLayoutTheme(layoutThemeId)

  const rightSidebarContent = useMemo(() => {
    if (activeSection === 'device' || activeSection === 'bankcard') {
      return (deviceId: string | null) => <BankCardSidebar deviceId={deviceId} />
    }
    return undefined
  }, [activeSection])

  const leftSidebarOverride = useMemo(() => {
    if (activeSection === 'bankcard') {
      return (
        <BankCardListSidebar
          selectedDeviceId={selectedDeviceId}
          onDeviceSelect={handleDeviceSelect}
        />
      )
    }
    return undefined
  }, [activeSection, selectedDeviceId, handleDeviceSelect])

  return (
    <Layout
      overallActiveTab={activeSection}
      onOverallTabChange={(key) => handleSectionChange(key as DashboardSectionType)}
      customNav={
        <SectionNav
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          userAccessLevel={userAccessLevel}
        />
      }
      showDeviceSidebarOverride={showDeviceSidebarForSection(activeSection)}
      rightSidebar={rightSidebarContent}
      leftSidebarOverride={leftSidebarOverride}
      onLogout={onLogout}
      userEmail={userEmail}
      userAccessLevel={userAccessLevel}
      devices={devices}
      selectedDeviceId={selectedDeviceId}
      onDeviceSelect={handleDeviceSelect}
      onRefreshDevices={handleRefreshDevices}
    >
      {renderContent}
    </Layout>
  )
}
