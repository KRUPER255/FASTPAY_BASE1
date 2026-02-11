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

const statusConfig: Record<StatusType, { color: string; bgColor: string; icon: typeof CheckCircle2; defaultLabel: string }> = {
  online: {
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-500/10 border-green-500/50',
    icon: Wifi,
    defaultLabel: 'Online',
  },
  offline: {
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500/10 border-red-500/50',
    icon: WifiOff,
    defaultLabel: 'Offline',
  },
  warning: {
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-500/10 border-yellow-500/50',
    icon: AlertCircle,
    defaultLabel: 'Warning',
  },
  error: {
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500/10 border-red-500/50',
    icon: XCircle,
    defaultLabel: 'Error',
  },
  unknown: {
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-500/10 border-gray-500/50',
    icon: Activity,
    defaultLabel: 'Unknown',
  },
  pending: {
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-500/10 border-orange-500/50',
    icon: Clock,
    defaultLabel: 'Pending',
  },
  active: {
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-500/10 border-green-500/50',
    icon: CheckCircle2,
    defaultLabel: 'Active',
  },
  inactive: {
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-500/10 border-gray-500/50',
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
        className
      )}
    >
      {showIcon && <Icon className={sizeStyles.icon} />}
      <span>{label || config.defaultLabel}</span>
    </Badge>
  )
}
