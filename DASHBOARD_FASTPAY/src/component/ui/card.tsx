import { forwardRef, type HTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

export type CardVariant = 'default' | 'outline' | 'elevated' | 'filled' | 'glass' | 'soft'

const cardVariantStyles = {
  default: 'border-border/50 bg-card text-card-foreground shadow-sm hover:shadow-md backdrop-blur-sm',
  outline: 'border-border bg-transparent shadow-none hover:border-border/70',
  elevated: 'border-border/30 bg-card text-card-foreground shadow-lg hover:shadow-xl',
  filled: 'border-none bg-card text-card-foreground shadow-md hover:shadow-lg',
  glass: 'border-border/30 bg-white/5 text-card-foreground backdrop-blur-xl shadow-sm hover:shadow-md',
  soft: 'border-border/20 bg-primary/5 text-card-foreground shadow-none hover:shadow-sm',
}

const Card = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & { variant?: CardVariant }
>(({ className, variant = 'default', ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'rounded-xl border overflow-hidden isolate transition-all duration-200',
      cardVariantStyles[variant as CardVariant],
      className
    )}
    {...props}
  />
))
Card.displayName = 'Card'

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-5 sm:p-6 border-b border-border/10', className)} {...props} />
  )
)
CardHeader.displayName = 'CardHeader'

const CardTitle = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-xl sm:text-2xl font-bold leading-tight tracking-tight', className)}
      {...props}
    />
  )
)
CardTitle.displayName = 'CardTitle'

const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
))
CardDescription.displayName = 'CardDescription'

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-5 sm:p-6 pt-0', className)} {...props} />
  )
)
CardContent.displayName = 'CardContent'

const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  )
)
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
