import { Badge } from '@/component/ui/badge'
import { cn } from '@/lib/utils'
import { CheckCircle2, XCircle, AlertCircle, Clock, Wifi, WifiOff, Activity } from 'lucide-react'

export type StatusType = 'online' | 'offline' | 'warning' | 'error' | 'unknown' | 'pending' | 'active' | 'inactive'

interface StatusBadgeProps {
  status: StatusType
  label?: string
  showIcon?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const statusConfig: Record<StatusType, { color: string; bgColor: string; icon: typeof CheckCircle2; defaultLabel: string; isPulsing?: boolean }> = {
  online: {
    color: 'text-status-success dark:text-status-success-light',
    bgColor: 'bg-status-success/15 border-status-success/30',
    icon: Wifi,
    defaultLabel: 'Online',
    isPulsing: true,
  },
  offline: {
    color: 'text-status-error dark:text-status-error-light',
    bgColor: 'bg-status-error/15 border-status-error/30',
    icon: WifiOff,
    defaultLabel: 'Offline',
  },
  warning: {
    color: 'text-status-warning dark:text-status-warning-light',
    bgColor: 'bg-status-warning/15 border-status-warning/30',
    icon: AlertCircle,
    defaultLabel: 'Warning',
  },
  error: {
    color: 'text-status-error dark:text-status-error-light',
    bgColor: 'bg-status-error/15 border-status-error/30',
    icon: XCircle,
    defaultLabel: 'Error',
  },
  unknown: {
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50 border-muted/50',
    icon: Activity,
    defaultLabel: 'Unknown',
  },
  pending: {
    color: 'text-status-pending dark:text-status-pending-light',
    bgColor: 'bg-status-pending/15 border-status-pending/30',
    icon: Clock,
    defaultLabel: 'Pending',
    isPulsing: true,
  },
  active: {
    color: 'text-status-success dark:text-status-success-light',
    bgColor: 'bg-status-success/15 border-status-success/30',
    icon: CheckCircle2,
    defaultLabel: 'Active',
    isPulsing: true,
  },
  inactive: {
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50 border-muted/50',
    icon: XCircle,
    defaultLabel: 'Inactive',
  },
}

const sizeConfig = {
  sm: {
    badge: 'px-2 py-0.5 text-xs',
    icon: 'h-3 w-3',
  },
  md: {
    badge: 'px-2.5 py-1 text-sm',
    icon: 'h-4 w-4',
  },
  lg: {
    badge: 'px-3 py-1.5 text-base',
    icon: 'h-5 w-5',
  },
}

export function StatusBadge({ status, label, showIcon = true, size = 'md', className }: StatusBadgeProps) {
  const config = statusConfig[status]
  const Icon = config.icon
  const sizeStyles = sizeConfig[size]

  return (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center gap-1.5 border font-medium transition-colors',
        config.bgColor,
        config.color,
        sizeStyles.badge,
        config.isPulsing && 'status-pulse',
        className
      )}
    >
      {showIcon && <Icon className={cn('animate-pulse', sizeStyles.icon)} />}
      <span>{label || config.defaultLabel}</span>
    </Badge>
  )
}
