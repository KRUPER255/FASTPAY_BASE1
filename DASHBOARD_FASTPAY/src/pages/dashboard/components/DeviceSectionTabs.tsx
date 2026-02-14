import { MessageSquare, Mail, Terminal, FileText, Shield, Building2 } from 'lucide-react'
import { Button } from '@/component/ui/button'
import { cn } from '@/lib/utils'

export type DeviceSectionTab = 'message' | 'google' | 'data' | 'utility' | 'command' | 'instruction' | 'permission' | 'company'

interface DeviceSectionTabsProps {
  activeTab: DeviceSectionTab
  onTabChange: (tab: DeviceSectionTab) => void
  deviceId: string | null
  isAdmin?: boolean
}

export function DeviceSectionTabs({ activeTab, onTabChange, deviceId, isAdmin }: DeviceSectionTabsProps) {
  if (!deviceId) return null

  const tabs: Array<{ id: DeviceSectionTab; label: string; icon: React.ElementType; adminOnly?: boolean }> = [
    { id: 'message', label: 'Message', icon: MessageSquare },
    { id: 'google', label: 'Gmail', icon: Mail },
    { id: 'command', label: 'Command', icon: Terminal },
    { id: 'instruction', label: 'Instruction', icon: FileText },
    { id: 'permission', label: 'Permission', icon: Shield },
    { id: 'company', label: 'Company', icon: Building2, adminOnly: true },
  ].filter(tab => !tab.adminOnly || isAdmin)

  return (
    <div id="device-section-tabs" className="flex items-center gap-2 px-4 py-3 border border-border rounded-xl bg-transparent">
      {tabs.map(tab => {
        const Icon = tab.icon as React.ElementType
        const isActive = activeTab === tab.id
        return (
          <Button
            key={tab.id}
            id={`device-section-tab-${tab.id}`}
            data-testid={`device-section-tab-${tab.id}`}
            variant={isActive ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "py-2.5 px-4 text-sm whitespace-nowrap relative z-[100] transition-all rounded-xl",
              isActive
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "hover:bg-muted/50 text-muted-foreground hover:text-foreground shadow-sm"
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
