import { Card, CardContent } from '@/component/ui/card'
import DataExporter from '@/component/DataExporter'
import type { SMS, Notification, Contact } from '../types'

interface ExportSectionProps {
  deviceId: string
  messages: SMS[]
  notifications: Notification[]
  contacts: Contact[]
  deviceInfo: {
    name: string
    phone: string
  }
}

export function ExportSection({
  deviceId,
  messages,
  notifications,
  contacts,
  deviceInfo,
}: ExportSectionProps) {
  if (!deviceId) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <p>Select a device to export data</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-6">
        <DataExporter
          messages={messages}
          notifications={notifications}
          contacts={contacts}
          deviceId={deviceId}
          deviceInfo={{
            deviceId,
            name: deviceInfo.name,
            phone: deviceInfo.phone,
          }}
        />
      </CardContent>
    </Card>
  )
}
