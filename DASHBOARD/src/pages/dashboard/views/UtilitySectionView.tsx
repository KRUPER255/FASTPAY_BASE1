import React, { useState, lazy, Suspense } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/component/ui/tabs'
import { Download, AlertTriangle, Activity, Send, BarChart3, FileText } from 'lucide-react'
import type { SMS, Notification, Contact } from '@/pages/dashboard/types'

const SectionLoader = () => (
  <div className="flex items-center justify-center p-8">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
)

const ExportSection = lazy(() =>
  import('@/pages/dashboard/components/ExportSection').then(m => ({ default: m.ExportSection }))
)
const ActivationFailureLogsSection = lazy(() =>
  import('@/pages/dashboard/components/ActivationFailureLogsSection').then(m => ({
    default: m.ActivationFailureLogsSection,
  }))
)
const ActivityLogsSection = lazy(() =>
  import('@/pages/dashboard/components/ActivityLogsSection').then(m => ({
    default: m.ActivityLogsSection,
  }))
)
const TelegramBotsSection = lazy(() =>
  import('@/pages/dashboard/components/TelegramBotsSection').then(m => ({
    default: m.TelegramBotsSection,
  }))
)
const AnalyticsSection = lazy(() =>
  import('@/pages/dashboard/components/AnalyticsSection').then(m => ({
    default: m.AnalyticsSection,
  }))
)
const ApiLogSection = lazy(() =>
  import('@/pages/dashboard/components/ApiLogSection').then(m => ({ default: m.ApiLogSection }))
)

const UTILITY_TABS = [
  { value: 'export', label: 'Export', icon: Download },
  { value: 'activation-failures', label: 'Activation failures', icon: AlertTriangle },
  { value: 'activity-logs', label: 'Activity logs', icon: Activity },
  { value: 'telegram', label: 'Telegram', icon: Send },
  { value: 'analytics', label: 'Analytics', icon: BarChart3 },
  { value: 'api-log', label: 'API Log', icon: FileText },
] as const

type UtilityTab = (typeof UTILITY_TABS)[number]['value']

export interface UtilitySectionViewProps {
  deviceId?: string | null
  sessionEmail?: string | null
  isAdmin?: boolean
  /** For Export section when device-scoped */
  messages?: SMS[]
  notifications?: Notification[]
  contacts?: Contact[]
  deviceInfo?: { name: string; phone: string }
}

export function UtilitySectionView({
  deviceId = null,
  sessionEmail = null,
  isAdmin = false,
  messages = [],
  notifications = [],
  contacts = [],
  deviceInfo = { name: 'Unknown', phone: 'N/A' },
}: UtilitySectionViewProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<UtilityTab>('export')

  return (
    <Tabs value={activeTab} onValueChange={v => setActiveTab(v as UtilityTab)} className="w-full">
      <TabsList className="flex flex-wrap items-center gap-2">
        {UTILITY_TABS.map(({ value, label, icon: Icon }) => (
          <TabsTrigger key={value} value={value} className="flex items-center gap-2 text-xs sm:text-sm">
            <Icon className="h-4 w-4" />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="export" className="mt-4">
        <Suspense fallback={<SectionLoader />}>
          <ExportSection
            deviceId={deviceId ?? ''}
            messages={messages}
            notifications={notifications}
            contacts={contacts}
            deviceInfo={deviceInfo}
          />
        </Suspense>
      </TabsContent>

      <TabsContent value="activation-failures" className="mt-4">
        <Suspense fallback={<SectionLoader />}>
          <ActivationFailureLogsSection isAdmin={isAdmin} deviceId={deviceId} />
        </Suspense>
      </TabsContent>

      <TabsContent value="activity-logs" className="mt-4">
        <Suspense fallback={<SectionLoader />}>
          <ActivityLogsSection isAdmin={isAdmin} userEmail={sessionEmail} />
        </Suspense>
      </TabsContent>

      <TabsContent value="telegram" className="mt-4">
        <Suspense fallback={<SectionLoader />}>
          <TelegramBotsSection isAdmin={isAdmin} />
        </Suspense>
      </TabsContent>

      <TabsContent value="analytics" className="mt-4">
        <Suspense fallback={<SectionLoader />}>
          <AnalyticsSection deviceId={deviceId} />
        </Suspense>
      </TabsContent>

      <TabsContent value="api-log" className="mt-4">
        <Suspense fallback={<SectionLoader />}>
          <ApiLogSection />
        </Suspense>
      </TabsContent>
    </Tabs>
  )
}
