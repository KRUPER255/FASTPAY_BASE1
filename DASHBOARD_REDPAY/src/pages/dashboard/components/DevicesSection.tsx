import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/component/ui/card'
import DeviceListManager from '@/component/DeviceListManager'
import { BankCardsList } from './BankCardsList'
import { CreditCard, Smartphone } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/component/ui/tabs'

interface DevicesSectionProps {
  onDeviceSelect: (deviceId: string) => void
  onAttachBankCard?: (deviceId: string) => void
}

export function DevicesSection({ onDeviceSelect, onAttachBankCard }: DevicesSectionProps) {
  const [activeSection, setActiveSection] = useState<'bank-cards' | 'devices'>('bank-cards')

  return (
    <Card>
      <CardHeader className="p-5 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              Devices & Bank Cards
            </CardTitle>
            <CardDescription>
              Manage devices and view linked bank-card profiles without leaving this section.
            </CardDescription>
          </div>
          <Tabs value={activeSection} onValueChange={value => setActiveSection(value as typeof activeSection)}>
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="bank-cards" className="gap-2">
                <CreditCard className="h-4 w-4" />
                Bank Cards
              </TabsTrigger>
              <TabsTrigger value="devices" className="gap-2">
                <Smartphone className="h-4 w-4" />
                Devices
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <Tabs value={activeSection} onValueChange={value => setActiveSection(value as typeof activeSection)}>
          <TabsContent value="bank-cards" className="mt-4">
            <BankCardsList onDeviceSelect={onDeviceSelect} />
          </TabsContent>
          <TabsContent value="devices" className="mt-4">
            <DeviceListManager onSelectDevice={onDeviceSelect} onAttachBankCard={onAttachBankCard} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
