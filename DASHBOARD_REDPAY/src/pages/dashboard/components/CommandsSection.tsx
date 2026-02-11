import { Card, CardContent } from '@/component/ui/card'
import RemoteCommandPanel from '@/component/RemoteCommandPanel'

interface CommandsSectionProps {
  deviceId: string
}

export function CommandsSection({ deviceId }: CommandsSectionProps) {
  if (!deviceId) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <p>Select a device to view commands</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-6">
        <RemoteCommandPanel deviceId={deviceId} />
      </CardContent>
    </Card>
  )
}
