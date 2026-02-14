import { Card, CardContent, CardHeader, CardTitle } from '@/component/ui/card'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string | number
  icon?: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  description?: string
  className?: string
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
  interactive?: boolean
}

const variantStyles = {
  default: 'border-border/50 bg-card',
  success: 'border-status-success/30 bg-status-success/5',
  warning: 'border-status-warning/30 bg-status-warning/5',
  error: 'border-status-error/30 bg-status-error/5',
  info: 'border-status-info/30 bg-status-info/5',
}

const iconVariantStyles = {
  default: 'text-muted-foreground',
  success: 'text-status-success dark:text-status-success-light',
  warning: 'text-status-warning dark:text-status-warning-light',
  error: 'text-status-error dark:text-status-error-light',
  info: 'text-status-info dark:text-status-info-light',
}

const trendColorStyles = {
  positive: 'text-status-success dark:text-status-success-light',
  negative: 'text-status-error dark:text-status-error-light',
}

export function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  description,
  className,
  variant = 'default',
  interactive = false,
}: MetricCardProps) {
  return (
    <Card
      variant="soft"
      className={cn(
        'transition-smooth',
        variantStyles[variant],
        interactive && 'cursor-pointer hover:shadow-elevation-2 hover:-translate-y-1',
        className
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {Icon && <Icon className={cn('h-5 w-5', iconVariantStyles[variant])} />}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        {trend && (
          <div className={cn('flex items-center gap-1 text-xs mt-2 font-medium', trend.isPositive ? trendColorStyles.positive : trendColorStyles.negative)}>
            {trend.isPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>
              {trend.isPositive ? '+' : '-'}{Math.abs(trend.value)}% from last period
            </span>
          </div>
        )}
        {description && <p className="text-xs text-muted-foreground mt-2">{description}</p>}
      </CardContent>
    </Card>
  )
}
