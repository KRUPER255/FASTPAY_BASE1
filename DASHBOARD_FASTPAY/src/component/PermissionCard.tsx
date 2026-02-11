import { formatPermissionStatus } from '@/lib/permission-helpers'
import type { PermissionInfo } from '@/lib/permission-helpers'
import { Badge } from '@/component/ui/badge'
import { Card, CardContent } from '@/component/ui/card'
import { Checkbox } from '@/component/ui/checkbox'

interface PermissionCardProps {
  permission: PermissionInfo
  onRequest?: () => void
  isSelected?: boolean
  onSelectionChange?: (selected: boolean) => void
  showCheckbox?: boolean
}

export default function PermissionCard({ 
  permission, 
  onRequest,
  isSelected = false,
  onSelectionChange,
  showCheckbox = false
}: PermissionCardProps) {
  const status = formatPermissionStatus(permission.isGranted)
  const Icon = permission.icon

  return (
    <Card className={`transition-all hover:shadow-md ${isSelected ? 'ring-2 ring-primary' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            {showCheckbox && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => onSelectionChange?.(checked === true)}
                className="mt-1"
                disabled={permission.isGranted}
              />
            )}
            <div
              className={`p-2 rounded-lg ${
                permission.isGranted
                  ? 'bg-green-100 dark:bg-green-900/20'
                  : 'bg-gray-100 dark:bg-gray-800'
              }`}
            >
              <Icon
                className={`h-5 w-5 ${
                  permission.isGranted ? 'text-green-600 dark:text-green-400' : 'text-gray-400'
                }`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm mb-1">{permission.name}</h3>
              <p className="text-xs text-muted-foreground mb-2">{permission.description}</p>
              <Badge
                variant={status.variant}
                className={`${status.color} ${permission.isGranted ? 'bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-700' : 'bg-red-100 dark:bg-red-900/20 border-red-300 dark:border-red-700'}`}
              >
                {status.text}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
