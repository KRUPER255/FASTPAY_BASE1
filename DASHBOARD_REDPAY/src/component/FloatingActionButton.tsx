import { useState } from 'react'
import { Button } from '@/component/ui/button'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/component/ui/card'

interface QuickAction {
  label: string
  icon: React.ReactNode
  onClick: () => void
  variant?: 'default' | 'destructive' | 'outline'
}

interface FloatingActionButtonProps {
  actions: QuickAction[]
  className?: string
}

export function FloatingActionButton({ actions, className }: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (actions.length === 0) return null

  // If only one action, show as single button
  if (actions.length === 1) {
    return (
      <div className={cn('fixed bottom-6 right-6 z-50', className)}>
        <Button
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg"
          onClick={actions[0].onClick}
          title={actions[0].label}
        >
          {actions[0].icon}
        </Button>
      </div>
    )
  }

  // Multiple actions - show expandable menu
  return (
    <div className={cn('fixed bottom-6 right-6 z-50', className)}>
      {/* Action Menu */}
      {isOpen && (
        <Card className="mb-2 shadow-lg animate-slide-up">
          <CardContent className="p-2">
            <div className="space-y-1">
              {actions.map((action, index) => (
                <Button
                  key={index}
                  variant={action.variant || 'ghost'}
                  size="sm"
                  onClick={() => {
                    action.onClick()
                    setIsOpen(false)
                  }}
                  className="w-full justify-start gap-2"
                >
                  {action.icon}
                  <span>{action.label}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main FAB Button */}
      <Button
        size="lg"
        className={cn(
          'h-14 w-14 rounded-full shadow-lg transition-transform',
          isOpen && 'rotate-45'
        )}
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? 'Close menu' : 'Quick actions'}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </Button>
    </div>
  )
}
