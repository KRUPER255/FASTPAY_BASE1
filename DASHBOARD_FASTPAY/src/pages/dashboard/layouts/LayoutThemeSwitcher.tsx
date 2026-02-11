import { LayoutGrid } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/component/ui/select'
import { DASHBOARD_LAYOUT_THEMES } from './registry'

interface LayoutThemeSwitcherProps {
  value: string
  onValueChange: (id: string) => void
  className?: string
}

export function LayoutThemeSwitcher({
  value,
  onValueChange,
  className,
}: LayoutThemeSwitcherProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className={`w-[130px] h-9 gap-1.5 ${className ?? ''}`}
        aria-label="Dashboard layout theme"
      >
        <LayoutGrid className="h-4 w-4 shrink-0 opacity-70" />
        <SelectValue placeholder="Layout" />
      </SelectTrigger>
      <SelectContent>
        {DASHBOARD_LAYOUT_THEMES.map((theme) => (
          <SelectItem key={theme.id} value={theme.id}>
            {theme.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
