import { useState, useRef, useEffect } from 'react'
import { Search, X, SlidersHorizontal, Check } from 'lucide-react'
import { Input } from '@/component/ui/input'
import { cn } from '@/lib/utils'

export type FilterMode =
  | 'contains'
  | 'equals'
  | 'startsWith'
  | 'endsWith'
  | 'containsNot'
  | 'equalsNot'
  | 'startsWithNot'
  | 'endsWithNot'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  filterMode: FilterMode
  onFilterModeChange: (mode: FilterMode) => void
  placeholder?: string
  className?: string
}

export function SearchInput({
  value,
  onChange,
  filterMode,
  onFilterModeChange,
  placeholder = 'Search...',
  className = '',
}: SearchInputProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Extract height if provided in className, otherwise default to h-9
  const heightClass = className.split(' ').find(c => c.startsWith('h-')) || 'h-9'

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getFilterLabel = (mode: FilterMode) => {
    switch (mode) {
      case 'contains':
        return 'Contains'
      case 'equals':
        return 'Equals'
      case 'startsWith':
        return 'Starts with'
      case 'endsWith':
        return 'Ends with'
      case 'containsNot':
        return 'Contains not'
      case 'equalsNot':
        return 'Equals not'
      case 'startsWithNot':
        return 'Starts with not'
      case 'endsWithNot':
        return 'Ends with not'
      default:
        return 'Contains'
    }
  }

  // Determine icon size and padding based on height
  const isSmall = heightClass.includes('h-6') || heightClass.includes('h-7')
  const iconSize = isSmall ? 'h-3.5 w-3.5' : 'h-4 w-4'
  const iconLeft = isSmall ? 'left-2.5' : 'left-3'
  const inputPadding = isSmall ? 'pl-8' : 'pl-9'

  return (
    <div className={cn("relative flex items-center overflow-visible", className)}>
      <Search className={cn("absolute text-muted-foreground pointer-events-none z-10", iconLeft, iconSize)} />
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={cn(
          "pr-20 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 transition-all overflow-hidden",
          heightClass,
          inputPadding
        )}
      />

      <div className="absolute right-2 flex items-center gap-1 z-10">
        {value && (
          <button
            onClick={() => onChange('')}
            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
            title="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className={`p-1 rounded transition-colors ${
              showDropdown || filterMode !== 'contains'
                ? 'bg-primary/10 text-primary'
                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
            }`}
            title={`Filter mode: ${getFilterLabel(filterMode)}`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </button>

          {showDropdown && (
            <div className="absolute top-full right-0 mt-2 bg-popover border border-border rounded-lg shadow-lg z-50 min-w-[180px] py-1 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Match Mode
              </div>

              {(['contains', 'equals', 'startsWith', 'endsWith'] as FilterMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => {
                    onFilterModeChange(mode)
                    setShowDropdown(false)
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center justify-between
                    ${filterMode === mode ? 'bg-accent text-accent-foreground' : ''}
                  `}
                >
                  {getFilterLabel(mode)}
                  {filterMode === mode && <Check className="h-3.5 w-3.5" />}
                </button>
              ))}

              <div className="h-px bg-border my-1 mx-2"></div>
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Negative Match
              </div>

              {(['containsNot', 'equalsNot', 'startsWithNot', 'endsWithNot'] as FilterMode[]).map(
                mode => (
                  <button
                    key={mode}
                    onClick={() => {
                      onFilterModeChange(mode)
                      setShowDropdown(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center justify-between
                    ${filterMode === mode ? 'bg-accent text-accent-foreground' : ''}
                  `}
                  >
                    {getFilterLabel(mode)}
                    {filterMode === mode && <Check className="h-3.5 w-3.5" />}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
