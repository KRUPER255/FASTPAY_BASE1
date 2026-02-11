import { Button } from '@/component/ui/button'
import { Palette, Check, Sparkles, ChevronDown } from 'lucide-react'
import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { themePresets, type ThemePreset } from '@/lib/theme'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/component/ui/dropdown-menu'

interface ThemeSelectorProps {
  currentTheme: ThemePreset
  isDarkMode: boolean
  onThemeChange: (theme: ThemePreset) => void
  className?: string
}

export function ThemeSelector({
  currentTheme,
  isDarkMode,
  onThemeChange,
  className,
}: ThemeSelectorProps) {
  // Group themes by category
  const standardThemes: ThemePreset[] = ['default', 'blue', 'green', 'purple', 'orange', 'red', 'teal', 'pink']
  const premiumThemes: ThemePreset[] = ['dark-premium', 'cyberpunk', 'ocean']

  const currentThemeName = themePresets[currentTheme].name

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          id="theme-selector-button"
          data-testid="theme-selector-button"
          variant="outline"
          size="sm"
          className={cn('gap-2 px-2 sm:px-3 h-9 sm:h-10', className)}
        >
          <Palette className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
          <span className="hidden sm:inline font-medium text-xs sm:text-sm text-foreground">
            {currentThemeName}
          </span>
          <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent id="theme-selector-menu" data-testid="theme-selector-menu" align="end" className="w-56">
        <DropdownMenuLabel id="theme-selector-label" className="font-normal">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Select Theme</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Standard Themes */}
        <div className="px-2 py-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
            Standard
          </p>
          {standardThemes.map(themeKey => {
            const theme = themePresets[themeKey]
            const isSelected = currentTheme === themeKey
            const primaryColor = isDarkMode ? theme.dark.primary : theme.light.primary

            return (
              <DropdownMenuItem
                key={themeKey}
                id={`theme-option-${themeKey}`}
                data-testid={`theme-option-${themeKey}`}
                onClick={() => onThemeChange(themeKey)}
                className={cn(
                  'cursor-pointer flex items-center justify-between',
                  isSelected && 'bg-accent'
                )}
              >
                <div className="flex items-center gap-2 flex-1">
                  <div
                    className="w-4 h-4 rounded border border-border/50 theme-swatch"
                    style={
                      {
                        '--swatch-color': `hsl(${primaryColor})`,
                      } as CSSProperties
                    }
                  />
                  <span className="text-sm">{theme.name}</span>
                </div>
                {isSelected && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
            )
          })}
        </div>

        <DropdownMenuSeparator />

        {/* Premium Themes */}
        <div className="px-2 py-1.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="h-3 w-3 text-muted-foreground" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Premium
            </p>
          </div>
          {premiumThemes.map(themeKey => {
            const theme = themePresets[themeKey]
            const isSelected = currentTheme === themeKey
            const primaryColor = isDarkMode ? theme.dark.primary : theme.light.primary
            const accentColor = isDarkMode ? theme.dark.accent : theme.light.accent

            return (
              <DropdownMenuItem
                key={themeKey}
                id={`theme-option-${themeKey}`}
                data-testid={`theme-option-${themeKey}`}
                onClick={() => onThemeChange(themeKey)}
                className={cn(
                  'cursor-pointer flex items-center justify-between',
                  isSelected && 'bg-accent'
                )}
              >
                <div className="flex items-center gap-2 flex-1">
                  <div
                    className="w-4 h-4 rounded border border-border/50 relative overflow-hidden theme-swatch-gradient"
                    style={
                      {
                        '--swatch-start': `hsl(${primaryColor})`,
                        '--swatch-end': `hsl(${accentColor})`,
                      } as CSSProperties
                    }
                  >
                    <Sparkles className="absolute inset-0 h-2.5 w-2.5 m-auto text-white/80" />
                  </div>
                  <span className="text-sm">{theme.name}</span>
                </div>
                {isSelected && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
            )
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
