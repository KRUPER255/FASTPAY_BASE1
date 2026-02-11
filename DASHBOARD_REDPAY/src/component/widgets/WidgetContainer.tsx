import type { ReactNode } from 'react'
import { Card } from '@/component/ui/card'
import { X, Maximize2, Minimize2 } from 'lucide-react'
import { Button } from '@/component/ui/button'
import { useState } from 'react'

interface WidgetContainerProps {
  title: string
  icon?: ReactNode
  children: ReactNode
  className?: string
  onClose?: () => void
  colSpan?: number
  rowSpan?: number
}

export default function WidgetContainer({
  title,
  icon,
  children,
  className = '',
  onClose,
  colSpan = 1,
  rowSpan = 1,
}: WidgetContainerProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div
      className={`premium-card rounded-xl p-4 flex flex-col ${className}`}
      style={{
        gridColumn: `span ${colSpan}`,
        gridRow: `span ${rowSpan}`,
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon && <div className="text-primary">{icon}</div>}
          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            {title}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      <div className={isExpanded ? '' : 'overflow-hidden'}>{children}</div>
    </div>
  )
}
