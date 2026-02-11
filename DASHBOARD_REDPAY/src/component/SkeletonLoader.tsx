import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular' | 'card'
}

export function Skeleton({ className, variant = 'rectangular' }: SkeletonProps) {
  const baseStyles = 'animate-pulse bg-muted rounded'
  
  const variantStyles = {
    text: 'h-4 w-full',
    circular: 'h-12 w-12 rounded-full',
    rectangular: 'h-24 w-full',
    card: 'h-32 w-full rounded-lg',
  }

  return <div className={cn(baseStyles, variantStyles[variant], className)} />
}

interface SkeletonCardProps {
  lines?: number
  showAvatar?: boolean
  className?: string
}

export function SkeletonCard({ lines = 3, showAvatar = false, className }: SkeletonCardProps) {
  return (
    <div className={cn('p-4 space-y-3 border rounded-lg', className)}>
      {showAvatar && <Skeleton variant="circular" className="h-10 w-10" />}
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            variant="text"
            className={i === 0 ? 'w-3/4' : i === lines - 1 ? 'w-1/2' : 'w-full'}
          />
        ))}
      </div>
    </div>
  )
}

export function DeviceCardSkeleton() {
  return (
    <div className="p-4 border rounded-lg space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" className="h-10 w-10" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" className="w-1/3" />
          <Skeleton variant="text" className="w-1/2" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton variant="text" className="w-16 h-6" />
        <Skeleton variant="text" className="w-16 h-6" />
      </div>
    </div>
  )
}
