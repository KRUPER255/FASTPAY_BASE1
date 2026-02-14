import { type HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground border-border',
        success: 'border-transparent bg-status-success/15 text-status-success dark:text-status-success-light',
        error: 'border-transparent bg-status-error/15 text-status-error dark:text-status-error-light',
        warning: 'border-transparent bg-status-warning/15 text-status-warning dark:text-status-warning-light',
        info: 'border-transparent bg-status-info/15 text-status-info dark:text-status-info-light',
        pending: 'border-transparent bg-status-pending/15 text-status-pending dark:text-status-pending-light',
        soft: 'border-border/50 bg-card text-foreground hover:bg-card/80',
        gradient: 'border-transparent bg-gradient-to-r from-primary to-accent text-primary-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
