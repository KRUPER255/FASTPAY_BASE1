import { ChevronRight, Home } from 'lucide-react'
import { Button } from '@/component/ui/button'
import { cn } from '@/lib/utils'

interface BreadcrumbItem {
  label: string
  onClick?: () => void
  icon?: React.ReactNode
}

interface BreadcrumbNavProps {
  items: BreadcrumbItem[]
  className?: string
}

export function BreadcrumbNav({ items, className }: BreadcrumbNavProps) {
  if (items.length === 0) return null

  return (
    <nav className={cn('flex items-center gap-2 text-sm', className)} aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        const isFirst = index === 0

        return (
          <div key={index} className="flex items-center gap-2">
            {isFirst && item.icon ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={item.onClick}
                className="h-7 px-2 text-muted-foreground hover:text-foreground"
              >
                {item.icon}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={item.onClick}
                disabled={isLast || !item.onClick}
                className={cn(
                  'h-7 px-2 text-muted-foreground hover:text-foreground',
                  isLast && 'font-semibold text-foreground cursor-default',
                  !item.onClick && 'cursor-default'
                )}
              >
                {item.label}
              </Button>
            )}
            {!isLast && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        )
      })}
    </nav>
  )
}
