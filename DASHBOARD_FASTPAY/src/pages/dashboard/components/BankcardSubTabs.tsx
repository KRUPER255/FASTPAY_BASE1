import { CreditCard, Wrench } from 'lucide-react'
import { Button } from '@/component/ui/button'
import { cn } from '@/lib/utils'

export type BankcardSubTab = 'bankcard' | 'utilities'

interface BankcardSubTabsProps {
  activeTab: BankcardSubTab
  onTabChange: (tab: BankcardSubTab) => void
}

const TABS: Array<{ id: BankcardSubTab; label: string; icon: React.ElementType }> = [
  { id: 'bankcard', label: 'Bank Card', icon: CreditCard },
  { id: 'utilities', label: 'Utilities', icon: Wrench },
]

export function BankcardSubTabs({ activeTab, onTabChange }: BankcardSubTabsProps) {
  return (
    <div
      id="bankcard-sub-tabs"
      className="flex items-center gap-2 px-4 py-3 border border-border rounded-xl bg-transparent"
    >
      {TABS.map(tab => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id
        return (
          <Button
            key={tab.id}
            id={`bankcard-sub-tab-${tab.id}`}
            data-testid={`bankcard-sub-tab-${tab.id}`}
            variant={isActive ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'py-2.5 px-4 text-sm whitespace-nowrap relative z-[100] transition-all rounded-xl',
              isActive
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground shadow-sm'
            )}
            type="button"
          >
            <Icon className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
            {tab.label}
          </Button>
        )
      })}
    </div>
  )
}
