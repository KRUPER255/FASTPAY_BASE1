import { useState } from 'react'
import { BankcardSubTabs, type BankcardSubTab } from '@/pages/dashboard/components/BankcardSubTabs'
import { BankCardSidebar } from '@/component/BankCardSidebar'
import { UtilitySectionView } from '@/pages/dashboard/views/UtilitySectionView'

export interface DeviceSectionRightSidebarProps {
  deviceId: string | null
  sessionEmail?: string | null
  isAdmin?: boolean
}

export function DeviceSectionRightSidebar({
  deviceId,
  sessionEmail = null,
  isAdmin = false,
}: DeviceSectionRightSidebarProps) {
  const [rightSubTab, setRightSubTab] = useState<BankcardSubTab>('bankcard')

  if (!deviceId) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        Select a device to view bank cards
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 mb-3">
        <BankcardSubTabs activeTab={rightSubTab} onTabChange={setRightSubTab} />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {rightSubTab === 'bankcard' && (
          <BankCardSidebar deviceId={deviceId} className="flex-1" />
        )}
        {rightSubTab === 'utilities' && (
          <UtilitySectionView
            deviceId={deviceId}
            sessionEmail={sessionEmail}
            isAdmin={isAdmin}
          />
        )}
      </div>
    </div>
  )
}
