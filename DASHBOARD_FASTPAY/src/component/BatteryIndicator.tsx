import { Battery, BatteryLow, BatteryMedium, BatteryFull } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BatteryIndicatorProps {
  percentage: number
  isCharging?: boolean
  size?: 'sm' | 'md' | 'lg'
  showPercentage?: boolean
  showProgressBar?: boolean
  className?: string
}

const sizeConfig = {
  sm: { icon: 'h-4 w-4', text: 'text-xs', bar: 'h-1' },
  md: { icon: 'h-5 w-5', text: 'text-sm', bar: 'h-1.5' },
  lg: { icon: 'h-6 w-6', text: 'text-base', bar: 'h-2' },
}

export function BatteryIndicator({
  percentage,
  isCharging = false,
  size = 'md',
  showPercentage = true,
  showProgressBar = false,
  className,
}: BatteryIndicatorProps) {
  const clampedPercentage = Math.max(0, Math.min(100, percentage))
  const config = sizeConfig[size]

  // Determine battery icon and color based on percentage
  let BatteryIcon = BatteryLow
  let colorClass = 'text-red-500'

  if (clampedPercentage > 75) {
    BatteryIcon = BatteryFull
    colorClass = 'text-green-500'
  } else if (clampedPercentage > 50) {
    BatteryIcon = BatteryMedium
    colorClass = 'text-green-500'
  } else if (clampedPercentage > 20) {
    BatteryIcon = BatteryMedium
    colorClass = 'text-yellow-500'
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative">
        <BatteryIcon className={cn(colorClass, config.icon, isCharging && 'animate-pulse')} />
        {isCharging && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn('text-[8px] font-bold', colorClass)}>⚡</span>
          </div>
        )}
      </div>
      {showProgressBar && (
        <div className="flex-1 max-w-[60px] bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              'transition-all duration-300',
              clampedPercentage > 50 ? 'bg-green-500' : clampedPercentage > 20 ? 'bg-yellow-500' : 'bg-red-500',
              config.bar
            )}
            style={{ width: `${clampedPercentage}%` }}
          />
        </div>
      )}
      {showPercentage && (
        <span className={cn('font-semibold', config.text, colorClass)}>{clampedPercentage}%</span>
      )}
    </div>
  )
}
