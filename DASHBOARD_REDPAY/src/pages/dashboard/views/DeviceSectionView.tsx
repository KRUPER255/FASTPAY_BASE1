import React, { useState, useMemo, Suspense } from 'react'
import { Button } from '@/component/ui/button'
import { Card, CardContent } from '@/component/ui/card'
import { Loader } from 'lucide-react'
import { useDashboardMessages } from '@/hooks/dashboard'
import { getDefaultProcessor, getProcessorById } from '@/lib/message-processors'
import type { User } from '@/pages/dashboard/types'
import type { DeviceSubTab } from '@/pages/dashboard/components/DeviceSubTabs'
import {
  LazyDeviceSubTabs as DeviceSubTabs,
  LazyMessagesSection as MessagesSection,
  LazyGmailSection as GmailSection,
} from '@/pages/dashboard/sections/lazy'

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
    </>
  )
}
