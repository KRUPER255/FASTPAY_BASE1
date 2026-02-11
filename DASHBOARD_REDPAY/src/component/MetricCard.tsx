import { Card, CardContent, CardHeader, CardTitle } from '@/component/ui/card'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

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
}

const variantStyles = {
  default: 'border-border',
  success: 'border-green-500/50 bg-green-500/5',
  warning: 'border-yellow-500/50 bg-yellow-500/5',
  error: 'border-red-500/50 bg-red-500/5',
  info: 'border-blue-500/50 bg-blue-500/5',
}

export function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  description,
  className,
  variant = 'default',
}: MetricCardProps) {
  return (
    <Card className={cn('transition-all hover:shadow-md', variantStyles[variant], className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend && (
          <p
            className={cn(
              'text-xs mt-1',
              trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            )}
          >
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% from last period
          </p>
        )}
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  )
}
