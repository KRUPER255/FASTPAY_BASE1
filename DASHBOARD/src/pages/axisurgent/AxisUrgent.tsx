import { useDashboardMessages } from '@/hooks/dashboard'
import { getDefaultProcessor } from '@/lib/message-processors'
import { MessagesSection } from '@/pages/dashboard/components/MessagesSection'
import { Card, CardContent, CardHeader, CardTitle } from '@/component/ui/card'

const AXISURGENT_DEVICE_ID = '71e4fa3e11e00c68'

export default function AxisUrgent() {
  const defaultProcessor = getDefaultProcessor()
  const {
    messages,
    rawMessages,
    loading,
    error,
    isConnected,
    refresh,
  } = useDashboardMessages({
    deviceId: AXISURGENT_DEVICE_ID,
    dataLimit: 100,
    selectedProcessor: defaultProcessor,
    activeTab: 'sms',
  })

  return (
    <div className="min-h-screen bg-background p-4">
      <Card className="max-w-full">
        <CardHeader>
          <CardTitle>AXISURGENT</CardTitle>
        </CardHeader>
        <CardContent>
          <MessagesSection
            deviceId={AXISURGENT_DEVICE_ID}
            messages={messages}
            rawMessages={rawMessages}
            loading={loading}
            error={error}
            isConnected={isConnected}
            isAdmin={false}
            selectedProcessorId={defaultProcessor.id}
            onRetry={refresh}
          />
        </CardContent>
      </Card>
    </div>
  )
}
