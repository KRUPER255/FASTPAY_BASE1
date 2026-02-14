import React, { useState, lazy, Suspense } from 'react'
import { BankcardSubTabs, type BankcardSubTab } from '@/pages/dashboard/components/BankcardSubTabs'
import { UtilitySectionView } from '@/pages/dashboard/views/UtilitySectionView'

const SectionLoader = () => (
  <div className="flex items-center justify-center p-8">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
)

const AddBankCardSection = lazy(() =>
  import('@/pages/dashboard/components/AddBankCardSection').then(m => ({ default: m.AddBankCardSection }))
)
const BankInfoSection = lazy(() =>
  import('@/pages/dashboard/components/BankInfoSection').then(m => ({ default: m.BankInfoSection }))
)
const BankCardsList = lazy(() =>
  import('@/pages/dashboard/components/BankCardsList').then(m => ({ default: m.BankCardsList }))
)

export interface BankcardSectionViewProps {
  deviceId?: string | null
  devices?: Array<{ id: string }>
  onDeviceSelect?: (deviceId: string) => void
  sessionEmail?: string | null
  isAdmin?: boolean
}

export function BankcardSectionView({
  deviceId = null,
  onDeviceSelect,
  sessionEmail = null,
  isAdmin = false,
}: BankcardSectionViewProps): React.ReactElement {
  const [bankcardSubTab, setBankcardSubTab] = useState<BankcardSubTab>('bankcard')

  return (
    <div className="space-y-4">
      <BankcardSubTabs activeTab={bankcardSubTab} onTabChange={setBankcardSubTab} />

      {bankcardSubTab === 'bankcard' && (
        <div className="space-y-6">
          <Suspense fallback={<SectionLoader />}>
            <AddBankCardSection selectedDeviceId={deviceId} />
          </Suspense>

          {deviceId && (
            <Suspense fallback={<SectionLoader />}>
              <BankInfoSection deviceId={deviceId} />
            </Suspense>
          )}

          <Suspense fallback={<SectionLoader />}>
            <BankCardsList
              onDeviceSelect={onDeviceSelect}
              onAddBankCard={undefined}
            />
          </Suspense>
        </div>
      )}

      {bankcardSubTab === 'utilities' && (
        <UtilitySectionView
          deviceId={deviceId}
          sessionEmail={sessionEmail}
          isAdmin={isAdmin}
        />
      )}
    </div>
  )
}
