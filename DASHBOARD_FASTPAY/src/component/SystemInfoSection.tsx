import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/component/ui/card'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/component/ui/button'
import { cn } from '@/lib/utils'

interface SystemInfoSectionProps {
  title: string
  data: Record<string, any>
  icon?: React.ComponentType<{ className?: string }>
  collapsible?: boolean
  defaultCollapsed?: boolean
}

export default function SystemInfoSection({
  title,
  data,
  icon: Icon,
  collapsible = true,
  defaultCollapsed = false,
}: SystemInfoSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)

  if (!data || Object.keys(data).length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <div
          className={cn('flex items-center justify-between', collapsible && 'cursor-pointer')}
          onClick={() => collapsible && setIsCollapsed(!isCollapsed)}
        >
          <CardTitle className="flex items-center gap-2 text-base">
            {Icon && <Icon className="h-5 w-5" />}
            {title}
          </CardTitle>
          {collapsible && (
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              {isCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      {!isCollapsed && (
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(data).map(([key, value]) => (
              <div key={key} className="space-y-1">
                <Label className="font-medium uppercase tracking-wide">
                  {formatKey(key)}
                </Label>
                <ValueDisplay value={value} />
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('text-xs text-muted-foreground', className)}>{children}</div>
}

function ValueDisplay({ value }: { value: any }) {
  if (value === null || value === undefined) {
    return <div className="text-sm text-muted-foreground">N/A</div>
  }

  if (typeof value === 'boolean') {
    return <div className="text-sm font-medium">{value ? 'Yes' : 'No'}</div>
  }

  if (typeof value === 'number') {
    // Check if it's a large number that might be bytes or timestamp
    if (value > 1000000000000) {
      // Might be timestamp (milliseconds) or bytes
      if (value < Date.now() + 100000000000) {
        // Likely a timestamp
        try {
          return <div className="text-sm font-medium">{new Date(value).toLocaleString('en-US')}</div>
        } catch {
          return <div className="text-sm font-mono">{value.toLocaleString('en-US')}</div>
        }
      }
      // Might be bytes
      return <div className="text-sm font-mono">{formatBytes(value)}</div>
    }
    return <div className="text-sm font-mono">{value.toLocaleString()}</div>
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return (
      <div className="text-sm space-y-1">
        {Object.entries(value).map(([k, v]) => (
          <div key={k} className="text-muted-foreground">
            <span className="font-medium">{formatKey(k)}:</span> {String(v)}
          </div>
        ))}
      </div>
    )
  }

  return <div className="text-sm font-medium break-words">{String(value)}</div>
}

function formatKey(key: string): string {
  // Convert camelCase to Title Case
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim()
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`
}
