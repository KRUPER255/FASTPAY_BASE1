import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular' | 'card' | 'button'
}

const baseStyles = 'bg-gradient-to-r from-muted via-muted/60 to-muted animate-pulse rounded'

const variantStyles = {
  text: 'h-4 w-full rounded-md',
  circular: 'h-12 w-12 rounded-full',
  rectangular: 'h-24 w-full rounded-lg',
  card: 'h-32 w-full rounded-xl',
  button: 'h-10 w-24 rounded-lg',
}

export function Skeleton({ className, variant = 'rectangular' }: SkeletonProps) {
  return <div className={cn(baseStyles, variantStyles[variant], className)} />
}

interface SkeletonCardProps {
  lines?: number
  showAvatar?: boolean
  className?: string
}

export function SkeletonCard({ lines = 3, showAvatar = false, className }: SkeletonCardProps) {
  return (
    <div className={cn('p-5 sm:p-6 space-y-4 border border-border/50 rounded-xl bg-card', className)}>
      {showAvatar && (
        <div className="flex items-center gap-3">
          <Skeleton variant="circular" className="h-12 w-12" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" className="w-2/3 h-4" />
            <Skeleton variant="text" className="w-1/2 h-3" />
          </div>
        </div>
      )}
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            variant="text"
            className={cn('h-4', i === lines - 1 && 'w-1/2')}
          />
        ))}
      </div>
    </div>
  )
}

export function DeviceCardSkeleton() {
  return (
    <div className="p-5 sm:p-6 border border-border/50 rounded-xl bg-card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <Skeleton variant="circular" className="h-10 w-10" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" className="w-2/3 h-4" />
            <Skeleton variant="text" className="w-1/2 h-3" />
          </div>
        </div>
        <Skeleton variant="circular" className="h-8 w-8" />
      </div>
      <div className="flex gap-2">
        <Skeleton variant="button" className="h-6 w-20" />
        <Skeleton variant="button" className="h-6 w-20" />
      </div>
    </div>
  )
}

export function MetricCardSkeleton() {
  return (
    <div className="p-5 sm:p-6 border border-border/50 rounded-xl bg-card space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton variant="text" className="w-2/3 h-4" />
        <Skeleton variant="circular" className="h-5 w-5" />
      </div>
      <Skeleton variant="text" className="w-1/3 h-8 mt-4" />
      <Skeleton variant="text" className="w-2/5 h-3" />
    </div>
  )
}

export function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-border/50">
      <Skeleton variant="text" className="w-12 h-4" />
      <Skeleton variant="text" className="flex-1 h-4" />
      <Skeleton variant="text" className="w-20 h-4" />
      <Skeleton variant="text" className="w-24 h-4" />
    </div>
  )
}
