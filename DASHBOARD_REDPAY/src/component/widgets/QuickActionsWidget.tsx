import WidgetContainer from './WidgetContainer'
import { Zap, MessageSquare, Bell, Settings2, RefreshCw } from 'lucide-react'
import { Button } from '@/component/ui/button'

interface QuickActionsWidgetProps {
  deviceId?: string | null
  onSendSMS?: () => void
  onShowNotification?: () => void
  onCommands?: () => void
  onRefresh?: () => void
}

export default function QuickActionsWidget({
  deviceId,
  onSendSMS,
  onShowNotification,
  onCommands,
  onRefresh,
}: QuickActionsWidgetProps) {
  const actions = [
    {
      label: 'Send SMS',
      icon: MessageSquare,
      onClick: onSendSMS,
      disabled: !deviceId,
    },
    {
      label: 'Notification',
      icon: Bell,
      onClick: onShowNotification,
      disabled: !deviceId,
    },
    {
      label: 'Commands',
      icon: Settings2,
      onClick: onCommands,
      disabled: !deviceId,
    },
    {
      label: 'Refresh',
      icon: RefreshCw,
      onClick: onRefresh,
    },
  ]

  return (
    <WidgetContainer
      title="Quick Actions"
      icon={<Zap className="h-4 w-4" />}
      colSpan={2}
      rowSpan={1}
    >
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action, index) => {
          const Icon = action.icon
          return (
            <Button
              key={index}
              variant="outline"
              size="sm"
              className="flex flex-col items-center gap-2 h-auto py-3 border-white/10 hover:border-primary/50 hover:bg-white/5"
              onClick={action.onClick}
              disabled={action.disabled}
            >
              <Icon className="h-4 w-4" />
              <span className="text-xs">{action.label}</span>
            </Button>
          )
        })}
      </div>
      {!deviceId && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Select a device to enable actions
        </p>
      )}
    </WidgetContainer>
  )
}
