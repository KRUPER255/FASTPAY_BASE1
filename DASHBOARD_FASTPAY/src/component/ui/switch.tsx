import { forwardRef, type ButtonHTMLAttributes, type MouseEvent } from 'react'
import { cn } from '@/lib/utils'

export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  /** Show OFF/ON labels on the sliding handle */
  showLabels?: boolean
  /** Custom content inside the thumb (overrides showLabels when set) */
  thumbContent?: React.ReactNode
}

const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      className,
      checked = false,
      onCheckedChange,
      onClick,
      showLabels = true,
      thumbContent,
      ...props
    },
    ref
  ) => {
    const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation()
      onCheckedChange?.(!checked)
      onClick?.(e)
    }

    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        ref={ref}
        onClick={handleClick}
        className={cn(
          'relative inline-flex h-8 w-[4.5rem] shrink-0 cursor-pointer items-center rounded-full border border-border bg-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      >
        <span
          className={cn(
            'pointer-events-none absolute left-1 top-1 flex h-6 w-9 items-center justify-center rounded-full border border-border bg-transparent text-[10px] font-semibold uppercase tracking-wide text-foreground transition-[left] duration-200 ease-out',
            checked ? 'left-[calc(100%-2.25rem-4px)]' : 'left-1'
          )}
        >
          {thumbContent ?? (showLabels ? (checked ? 'ON' : 'OFF') : null)}
        </span>
      </button>
    )
  }
)
Switch.displayName = 'Switch'

export { Switch }
