import { Card, CardContent } from '@/component/ui/card'
import PermissionManagerWithTabs from '@/component/PermissionManagerWithTabs'

interface PermissionsSectionProps {
  deviceId: string
}

export function PermissionsSection({ deviceId }: PermissionsSectionProps) {
  if (!deviceId) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <p>Select a device to manage permissions</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <PermissionManagerWithTabs deviceId={deviceId} />
      </CardContent>
    </Card>
  )
}
