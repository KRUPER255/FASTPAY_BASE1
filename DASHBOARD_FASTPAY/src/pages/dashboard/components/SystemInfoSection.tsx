import { Card, CardContent } from '@/component/ui/card'
import SystemInfoPanel from '@/component/SystemInfoPanel'

interface SystemInfoSectionProps {
  deviceId: string
}

export function SystemInfoSection({ deviceId }: SystemInfoSectionProps) {
  if (!deviceId) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <p>Select a device to view system info</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <SystemInfoPanel deviceId={deviceId} />
      </CardContent>
    </Card>
  )
}
