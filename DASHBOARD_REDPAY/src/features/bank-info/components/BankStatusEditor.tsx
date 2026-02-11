import { useState } from 'react'
import { Save, X, Plus, Trash2, Tag, Edit } from 'lucide-react'
import { Button } from '@/component/ui/button'
import { Input } from '@/component/ui/input'
import { Label } from '@/component/ui/label'
import { Badge } from '@/component/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/component/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/component/ui/select'
import type { BankStatus } from '@/lib/firebase-helpers'

interface BankStatusEditorProps {
  bankStatus: BankStatus | null
  deviceCode: string | null
  saving: boolean
  onAddStatus: (name: string, color: string) => Promise<void>
  onUpdateStatus: (statusName: string) => Promise<void>
  onRemoveStatus: (statusName: string) => Promise<void>
  onUpdateColor: (statusName: string, color: string) => Promise<void>
  onClose: () => void
}

const predefinedStatuses = [
  { name: 'Active', color: '#28a745' },
  { name: 'Inactive', color: '#6c757d' },
  { name: 'Pending', color: '#ffc107' },
  { name: 'Approved', color: '#17a2b8' },
  { name: 'Rejected', color: '#dc3545' },
  { name: 'Suspended', color: '#fd7e14' },
  { name: 'Verified', color: '#20c997' },
]

/**
 * BankStatusEditor - Status management UI
 */
export function BankStatusEditor({
  bankStatus,
  deviceCode,
  saving,
  onAddStatus,
  onUpdateStatus,
  onRemoveStatus,
  onUpdateColor,
  onClose,
}: BankStatusEditorProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [newStatusName, setNewStatusName] = useState('')
  const [newStatusColor, setNewStatusColor] = useState('#667eea')
  const [isAddingStatus, setIsAddingStatus] = useState(false)

  const handleAddStatus = async () => {
    if (!newStatusName.trim()) return
    await onAddStatus(newStatusName.trim(), newStatusColor)
    setNewStatusName('')
    setNewStatusColor('#667eea')
    setIsAddingStatus(false)
  }

  const handleUpdateStatus = async () => {
    if (!selectedStatus) return
    await onUpdateStatus(selectedStatus)
    setSelectedStatus('')
  }

  const handleClose = () => {
    setSelectedStatus('')
    setIsAddingStatus(false)
    setNewStatusName('')
    setNewStatusColor('#667eea')
    onClose()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Bank Status
          </CardTitle>
          <Button variant="outline" size="sm" onClick={handleClose} disabled={saving}>
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Dropdown - Set Current Status */}
        <div className="space-y-2 border-b pb-4">
          <Label htmlFor="status-select">Set Bank Status</Label>
          <div className="flex items-center gap-2">
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger id="status-select" className="flex-1">
                <SelectValue placeholder="Select or create a status" />
              </SelectTrigger>
              <SelectContent>
                {/* Existing statuses */}
                {bankStatus && Object.keys(bankStatus).length > 0 && (
                  <>
                    {Object.keys(bankStatus).map(statusName => (
                      <SelectItem key={statusName} value={statusName}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: bankStatus[statusName] }}
                          />
                          {statusName}
                        </div>
                      </SelectItem>
                    ))}
                    <div className="border-t my-1" />
                  </>
                )}
                {/* Predefined statuses */}
                {predefinedStatuses.map(status => (
                  <SelectItem key={status.name} value={status.name}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: status.color }}
                      />
                      {status.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleUpdateStatus}
              disabled={!selectedStatus || saving}
              size="sm"
            >
              <Save className="h-4 w-4 mr-2" />
              Set Status
            </Button>
          </div>
        </div>

        {/* Add New Status */}
        <div className="space-y-4 border-b pb-4">
          <div className="flex items-center justify-between">
            <Label>Add New Status</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAddingStatus(!isAddingStatus)}
            >
              {isAddingStatus ? (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Status
                </>
              )}
            </Button>
          </div>
          {isAddingStatus && (
            <div className="space-y-3 p-4 bg-muted rounded-lg">
              <div className="space-y-2">
                <Label htmlFor="new-status-name">Status Name</Label>
                <Input
                  id="new-status-name"
                  value={newStatusName}
                  onChange={e => setNewStatusName(e.target.value)}
                  placeholder="Enter status name (e.g., Verified, Active)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-status-color">Status Color</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    id="new-status-color"
                    value={newStatusColor}
                    onChange={e => setNewStatusColor(e.target.value)}
                    className="h-10 w-20 rounded border cursor-pointer"
                  />
                  <Input
                    value={newStatusColor}
                    onChange={e => setNewStatusColor(e.target.value)}
                    placeholder="#667eea"
                    className="flex-1 font-mono"
                  />
                </div>
              </div>
              <Button
                onClick={handleAddStatus}
                disabled={!newStatusName.trim() || saving}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Status
              </Button>
            </div>
          )}
        </div>

        {/* Manage Existing Statuses */}
        {bankStatus && Object.keys(bankStatus).length > 0 && (
          <div className="space-y-3">
            <Label>Manage Statuses</Label>
            <div className="space-y-2">
              {Object.entries(bankStatus).map(([statusName, color]) => (
                <div
                  key={statusName}
                  className="flex items-center gap-3 p-3 border rounded-lg"
                >
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <Input value={statusName} disabled className="flex-1 font-medium" />
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={color}
                      onChange={e => onUpdateColor(statusName, e.target.value)}
                      className="h-9 w-16 rounded border cursor-pointer"
                      title="Change color"
                    />
                    <Input
                      value={color}
                      onChange={e => onUpdateColor(statusName, e.target.value)}
                      className="w-24 font-mono text-sm"
                      placeholder="#667eea"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveStatus(statusName)}
                    disabled={saving}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * BankStatusDisplay - Display bank status in read-only mode
 */
export function BankStatusDisplay({
  bankStatus,
  onEdit,
}: {
  bankStatus: BankStatus | null
  onEdit: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Bank Status
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Status
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {bankStatus && Object.keys(bankStatus).length > 0 ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {Object.entries(bankStatus).map(([statusName, color]) => (
                <Badge
                  key={statusName}
                  style={{ backgroundColor: color, color: '#fff', borderColor: color }}
                  className="px-3 py-1 text-sm font-medium"
                >
                  {statusName}
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <Tag className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No bank status available</p>
            <p className="text-sm mt-1">
              Click "Edit Status" to add and manage bank statuses
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
