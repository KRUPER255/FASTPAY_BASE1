import { Card, CardContent } from '@/component/ui/card'
import { Button } from '@/component/ui/button'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
  variant?: 'default' | 'minimal' | 'elevated'
}

const variantStyles = {
  default: 'border-dashed bg-gradient-to-b from-card/50 to-background/50',
  minimal: 'border-dashed border-border/30 bg-transparent',
  elevated: 'bg-gradient-to-br from-primary/5 to-accent/5 border-border/50',
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  variant = 'default',
}: EmptyStateProps) {
  return (
    <Card variant="outline" className={cn('scale-in', variantStyles[variant], className)}>
      <CardContent className="flex flex-col items-center justify-center p-8 sm:p-12 text-center">
        {Icon && (
          <div className={cn(
            'mb-6 rounded-2xl p-4 transition-transform duration-300 hover:scale-110',
            variant === 'elevated' ? 'bg-primary/10' : 'bg-muted/50'
          )}>
            <Icon className={cn(
              'h-10 w-10',
              variant === 'elevated' ? 'text-primary' : 'text-muted-foreground'
            )} />
          </div>
        )}
        <h3 className="text-xl sm:text-2xl font-bold mb-3 text-foreground">{title}</h3>
        {description && (
          <p className="text-sm sm:text-base text-muted-foreground mb-6 max-w-sm leading-relaxed">
            {description}
          </p>
        )}
        {action && (
          <Button
            onClick={action.onClick}
            variant={variant === 'elevated' ? 'default' : 'outline'}
            size="sm"
            className="transition-smooth"
          >
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
