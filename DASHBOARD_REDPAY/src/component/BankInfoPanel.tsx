import { useState } from 'react'
import { Building2, RefreshCw, AlertCircle, Edit, ExternalLink } from 'lucide-react'
import { Button } from '@/component/ui/button'
import { Skeleton } from '@/component/ui/skeleton'
import { Card } from '@/component/ui/card'
import { useToast } from '@/lib/use-toast'
import { set } from 'firebase/database'
import { getDeviceListBankPath, getDeviceListBankStatusPath, type BankStatus } from '@/lib/firebase-helpers'
import { useBankInfo, useBankFiles } from '@/hooks/bank-info'
import {
  BankInfoDisplay,
  BankInfoEditor,
  BankStatusDisplay,
  BankStatusEditor,
  FilePreviewDialog,
} from '@/features/bank-info/components'
import type { BankData, UploadedFile } from '@/hooks/bank-info'

interface BankInfoPanelProps {
  deviceId: string | null
}

export default function BankInfoPanel({ deviceId }: BankInfoPanelProps) {
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [isEditingStatus, setIsEditingStatus] = useState(false)
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Use hooks for data fetching
  const {
    deviceCode,
    bankInfo,
    bankStatus,
    loading,
    error,
    refresh,
  } = useBankInfo({ deviceId })

  const {
    uploadedFiles,
    loadingFiles,
    uploading,
    uploadFile,
    deleteFile,
    formatFileSize,
  } = useBankFiles({ deviceCode })

  // Handle save bank info
  const handleSave = async (data: BankData) => {
    if (!deviceCode) return

    try {
      setSaving(true)
      const bankRef = getDeviceListBankPath(deviceCode)
      await set(bankRef, data)
      setIsEditing(false)
      toast({
        title: 'Bank info saved',
        description: 'Bank information has been updated successfully',
        variant: 'default',
      })
    } catch (err) {
      console.error('Error saving bank info:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to save bank information'
      toast({
        title: 'Error saving bank info',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Handle organize data
  const handleOrganize = async (data: BankData) => {
    if (!deviceCode) return

    try {
      setSaving(true)
      const bankRef = getDeviceListBankPath(deviceCode)
      await set(bankRef, data)
      setIsEditing(false)
      toast({
        title: 'Data organized',
        description: 'Bank information has been organized and saved in a structured format',
      })
    } catch (error) {
      console.error('Error organizing data:', error)
      toast({
        title: 'Error',
        description: 'Failed to organize data',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Handle cancel edit
  const handleCancelEdit = () => {
    setIsEditing(false)
  }

  // Handle add status
  const handleAddStatus = async (name: string, color: string) => {
    if (!deviceCode) return

    try {
      setSaving(true)
      const statusRef = getDeviceListBankStatusPath(deviceCode)
      const currentStatus = bankStatus || {}
      const updatedStatus = {
        ...currentStatus,
        [name]: color,
      }
      await set(statusRef, updatedStatus)
      toast({
        title: 'Status added',
        description: `Bank status "${name}" has been added`,
      })
    } catch (error) {
      console.error('Error adding status:', error)
      toast({
        title: 'Error',
        description: 'Failed to add status',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Handle update status
  const handleUpdateStatus = async (statusName: string) => {
    if (!deviceCode) return

    try {
      setSaving(true)
      const statusRef = getDeviceListBankStatusPath(deviceCode)
      const currentStatus = bankStatus || {}
      
      // If status doesn't exist, create it with default color
      if (!currentStatus[statusName]) {
        const predefinedStatuses = [
          { name: 'Active', color: '#28a745' },
          { name: 'Inactive', color: '#6c757d' },
          { name: 'Pending', color: '#ffc107' },
          { name: 'Approved', color: '#17a2b8' },
          { name: 'Rejected', color: '#dc3545' },
          { name: 'Suspended', color: '#fd7e14' },
          { name: 'Verified', color: '#20c997' },
        ]
        const defaultColor = predefinedStatuses.find(s => s.name === statusName)?.color || '#667eea'
        currentStatus[statusName] = defaultColor
      }

      await set(statusRef, currentStatus)
      toast({
        title: 'Status updated',
        description: `Bank status "${statusName}" has been updated`,
      })
    } catch (error) {
      console.error('Error updating status:', error)
      toast({
        title: 'Error',
        description: 'Failed to update status',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Handle remove status
  const handleRemoveStatus = async (statusName: string) => {
    if (!deviceCode || !bankStatus) return

    try {
      setSaving(true)
      const statusRef = getDeviceListBankStatusPath(deviceCode)
      const updatedStatus = { ...bankStatus }
      delete updatedStatus[statusName]
      await set(statusRef, updatedStatus)
      toast({
        title: 'Status removed',
        description: `Bank status "${statusName}" has been removed`,
      })
    } catch (error) {
      console.error('Error removing status:', error)
      toast({
        title: 'Error',
        description: 'Failed to remove status',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Handle update status color
  const handleUpdateStatusColor = async (statusName: string, color: string) => {
    if (!deviceCode || !bankStatus) return

    try {
      const statusRef = getDeviceListBankStatusPath(deviceCode)
      const updatedStatus = {
        ...bankStatus,
        [statusName]: color,
      }
      await set(statusRef, updatedStatus)
      toast({
        title: 'Color updated',
        description: `Status color for "${statusName}" has been updated`,
      })
    } catch (error) {
      console.error('Error updating status color:', error)
      toast({
        title: 'Error',
        description: 'Failed to update color',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Bank Information
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            View and manage bank and company information
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://yonobusiness.sbi.bank.in/yonobusinesslogin"
            target="_blank"
            rel="noopener noreferrer"
            title="Opens in new tab. For incognito: right-click link → Open link in incognito window"
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Open Yono Business
          </a>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh()}
            disabled={loading || !deviceCode}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Missing Code Warning */}
      {!deviceCode && deviceId && (
        <div className="p-4 rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
          <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
            <AlertCircle className="h-5 w-5" />
            <div>
              <p className="font-semibold">Device code not found</p>
              <p className="text-sm">
                Bank information requires a device activation code. Please activate the device
                first.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && deviceCode && (
        <div className="p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <div>
              <p className="font-semibold">Error loading bank info</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refresh()} className="mt-2">
            Retry
          </Button>
        </div>
      )}

      {/* Loading State */}
      {loading && !bankInfo && deviceCode && (
        <div className="space-y-4">
          <Card>
            <div className="p-6 space-y-4">
              <Skeleton className="h-6 w-32" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && deviceCode && !bankInfo && !isEditing && (
        <div className="p-8 text-center text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">No bank information available</p>
          <p className="text-sm mt-2">
            Bank information will appear here when set for this device code
          </p>
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="mt-4">
            <Edit className="h-4 w-4 mr-2" />
            Add Bank Info
          </Button>
        </div>
      )}

      {/* Bank Info Display/Edit */}
      {!loading && !error && deviceCode && (bankInfo || isEditing) && (
        <div className="space-y-4">
          {isEditing ? (
            <BankInfoEditor
              initialData={bankInfo}
              deviceCode={deviceCode}
              uploadedFiles={uploadedFiles}
              uploading={uploading}
              saving={saving}
              onSave={handleSave}
              onOrganize={handleOrganize}
              onCancel={handleCancelEdit}
              onFileUpload={uploadFile}
              onFileDelete={deleteFile}
              onFilePreview={(file) => {
                setPreviewFile(file)
                setIsPreviewOpen(true)
              }}
              formatFileSize={formatFileSize}
            />
          ) : (
            <BankInfoDisplay
              bankInfo={bankInfo!}
              onEdit={() => setIsEditing(true)}
            />
          )}
        </div>
      )}

      {/* Bank Status */}
      {!loading && !error && deviceCode && (
        <div className="space-y-4">
          {isEditingStatus ? (
            <BankStatusEditor
              bankStatus={bankStatus}
              deviceCode={deviceCode}
              saving={saving}
              onAddStatus={handleAddStatus}
              onUpdateStatus={handleUpdateStatus}
              onRemoveStatus={handleRemoveStatus}
              onUpdateColor={handleUpdateStatusColor}
              onClose={() => setIsEditingStatus(false)}
            />
          ) : (
            <BankStatusDisplay
              bankStatus={bankStatus}
              onEdit={() => setIsEditingStatus(true)}
            />
          )}
        </div>
      )}

      {/* File Preview Dialog */}
      <FilePreviewDialog
        file={previewFile}
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        onDelete={deleteFile}
        formatFileSize={formatFileSize}
      />
    </div>
  )
}
