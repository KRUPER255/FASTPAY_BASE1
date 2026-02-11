import { Card, CardContent } from '@/component/ui/card'
import RealTimeMonitor from '@/component/RealTimeMonitor'
import AnalyticsCharts from '@/component/AnalyticsCharts'

interface AnalyticsSectionProps {
  deviceId: string | null
}

export function AnalyticsSection({ deviceId }: AnalyticsSectionProps) {
  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        {deviceId ? (
          <>
            <RealTimeMonitor deviceId={deviceId} />
            <AnalyticsCharts deviceId={deviceId} />
          </>
        ) : (
          <AnalyticsCharts />
        )}
      </CardContent>
    </Card>
  )
}
