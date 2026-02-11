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
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <Card className={cn('border-dashed', className)}>
      <CardContent className="flex flex-col items-center justify-center p-12 text-center">
        {Icon && (
          <div className="mb-4 rounded-full bg-muted p-4">
            <Icon className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        {description && <p className="text-sm text-muted-foreground mb-4 max-w-sm">{description}</p>}
        {action && (
          <Button onClick={action.onClick} variant="outline" size="sm">
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
