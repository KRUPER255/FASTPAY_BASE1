import { forwardRef, type ButtonHTMLAttributes, type MouseEvent } from 'react'
import { cn } from '@/lib/utils'

export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  /** Show OFF/ON labels on the sliding handle (neumorphic style) */
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
          'neu-switch-track relative inline-flex h-8 w-[4.5rem] shrink-0 cursor-pointer items-center rounded-full border-[1.5px] border-border bg-muted/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        style={
          {
            boxShadow:
              'inset 3px 3px 6px var(--neu-shadow-dark, rgba(0,0,0,0.15)), inset -3px -3px 6px var(--neu-shadow-light, rgba(255,255,255,0.1))',
          } as React.CSSProperties
        }
        {...props}
      >
        <span
          className={cn(
            'neu-switch-thumb pointer-events-none absolute left-1 top-1 flex h-6 w-9 items-center justify-center rounded-full border border-border/80 text-[10px] font-semibold uppercase tracking-wide transition-[left] duration-200 ease-out',
            checked ? 'left-[calc(100%-2.25rem-4px)]' : 'left-1'
          )}
          style={
            {
              boxShadow:
                '4px 4px 8px var(--neu-shadow-dark, rgba(0,0,0,0.2)), -2px -2px 6px var(--neu-shadow-light, rgba(255,255,255,0.15))',
              background: 'var(--neu-bg, hsl(var(--muted)))',
              color: 'hsl(var(--foreground))',
              borderColor: 'hsl(var(--border))',
            } as React.CSSProperties
          }
        >
          {thumbContent ?? (showLabels ? (checked ? 'ON' : 'OFF') : null)}
        </span>
      </button>
    )
  }
)
Switch.displayName = 'Switch'

export { Switch }
