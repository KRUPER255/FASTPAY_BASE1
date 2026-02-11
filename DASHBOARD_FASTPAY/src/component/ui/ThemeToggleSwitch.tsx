import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Switch } from '@/component/ui/switch'

type ThemeToggleSwitchProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  ariaLabel?: string
}

export function ThemeToggleSwitch({
  checked,
  onChange,
  disabled = false,
  ariaLabel = 'Toggle theme',
}: ThemeToggleSwitchProps) {
  const Icon = checked ? Moon : Sun
  return (
    <div
      className={cn(
        'inline-flex rounded-full border-[1.5px] border-border p-0.5',
        'bg-muted/30'
      )}
      aria-hidden
    >
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        aria-label={ariaLabel}
        showLabels={false}
        thumbContent={
          <span
            className={cn(
              'inline-flex transition-transform duration-300 ease-out',
              checked ? 'rotate-180' : 'rotate-0'
            )}
          >
            <Icon className="h-3.5 w-3.5 text-foreground" />
          </span>
        }
      />
    </div>
  )
}
