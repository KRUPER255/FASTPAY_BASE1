import { Card, CardContent } from '@/component/ui/card'
import BankInfoPanel from '@/component/BankInfoPanel'

interface BankInfoSectionProps {
  deviceId: string
}

export function BankInfoSection({ deviceId }: BankInfoSectionProps) {
  if (!deviceId) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <p>Select a device to view bank info</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <BankInfoPanel deviceId={deviceId} />
      </CardContent>
    </Card>
  )
}
