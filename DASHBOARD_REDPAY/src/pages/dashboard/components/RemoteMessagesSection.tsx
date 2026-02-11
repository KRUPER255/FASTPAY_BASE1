import { Card, CardContent } from '@/component/ui/card'
import AnimationControl from '@/component/AnimationControl'
import AnimatedCardSwitcher from '@/component/AnimatedCardSwitcher'

interface RemoteMessagesSectionProps {
  deviceId: string
  initialCard?: 'sms' | 'instruction'
}

export function RemoteMessagesSection({
  deviceId,
  initialCard = 'sms',
}: RemoteMessagesSectionProps) {
  if (!deviceId) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <p>Select a device to view remote messages</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <AnimationControl deviceId={deviceId} />
        <AnimatedCardSwitcher deviceId={deviceId} initialCard={initialCard} />
      </CardContent>
    </Card>
  )
}
