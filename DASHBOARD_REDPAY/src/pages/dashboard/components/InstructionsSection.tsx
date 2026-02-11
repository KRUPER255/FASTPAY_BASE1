import { Card, CardContent } from '@/component/ui/card'
import InstructionTemplatePanel from '@/component/InstructionTemplatePanel'

interface InstructionsSectionProps {
  deviceId: string
}

export function InstructionsSection({ deviceId }: InstructionsSectionProps) {
  if (!deviceId) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <p>Select a device to manage instructions and templates</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <InstructionTemplatePanel deviceId={deviceId} />
      </CardContent>
    </Card>
  )
}
