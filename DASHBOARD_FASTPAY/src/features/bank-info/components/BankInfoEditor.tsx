import { useState, useRef, useEffect } from 'react'
import { Save, X, Grid3x3, RefreshCw, Image as ImageIcon, Video, File } from 'lucide-react'
import { Button } from '@/component/ui/button'
import { Input } from '@/component/ui/input'
import { Label } from '@/component/ui/label'
import { Textarea } from '@/component/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/component/ui/card'
import type { BankData } from '@/hooks/bank-info'
import type { UploadedFile } from '@/hooks/bank-info'
import { FileUploadSection } from './FileUploadSection'

interface BankInfoEditorProps {
  initialData: BankData | null
  deviceCode: string | null
  uploadedFiles: UploadedFile[]
  uploading: boolean
  saving: boolean
  onSave: (data: BankData) => Promise<void>
  onOrganize: (data: BankData) => Promise<void>
  onCancel: () => void
  onFileUpload: (file: File, type: 'image' | 'video' | 'file') => Promise<void>
  onFileDelete: (file: UploadedFile) => Promise<void>
  onFilePreview: (file: UploadedFile) => void
  formatFileSize: (bytes: number) => string
}

/**
 * BankInfoEditor - Edit form for bank information
 */
export function BankInfoEditor({
  initialData,
  deviceCode,
  uploadedFiles,
  uploading,
  saving,
  onSave,
  onOrganize,
  onCancel,
  onFileUpload,
  onFileDelete,
  onFilePreview,
  formatFileSize,
}: BankInfoEditorProps) {
  const [editForm, setEditForm] = useState<BankData>({
    bank_name: '',
    company_name: '',
    company_address: '',
    company_phone: '',
    company_email: '',
    company_website: '',
    account_number: '',
    ifsc_code: '',
    branch_name: '',
    contact_person: '',
    contact_phone: '',
    contact_email: '',
    notes: '',
    other_info: '',
  })

  // Initialize form with existing data
  useEffect(() => {
    if (initialData) {
      setEditForm({
        bank_name: initialData.bank_name || '',
        company_name: initialData.company_name || '',
        company_address: initialData.company_address || '',
        company_phone: initialData.company_phone || '',
        company_email: initialData.company_email || '',
        company_website: initialData.company_website || '',
        account_number: initialData.account_number || '',
        ifsc_code: initialData.ifsc_code || '',
        branch_name: initialData.branch_name || '',
        contact_person: initialData.contact_person || '',
        contact_phone: initialData.contact_phone || '',
        contact_email: initialData.contact_email || '',
        notes: initialData.notes || '',
        other_info: initialData.other_info || '',
      })
    }
  }, [initialData])

  const handleSave = async () => {
    await onSave(editForm)
  }

  const handleOrganize = async () => {
    const organizedData: BankData = {
      bank_name: editForm.bank_name || '',
      branch_name: editForm.branch_name || '',
      account_number: editForm.account_number || '',
      ifsc_code: editForm.ifsc_code || '',
      company_name: editForm.company_name || '',
      company_address: editForm.company_address || '',
      company_phone: editForm.company_phone || '',
      company_email: editForm.company_email || '',
      company_website: editForm.company_website || '',
      contact_person: editForm.contact_person || '',
      contact_phone: editForm.contact_phone || '',
      contact_email: editForm.contact_email || '',
      notes: editForm.notes || '',
      other_info: editForm.other_info || '',
      structured_data: {
        bank: {
          name: editForm.bank_name || '',
          branch: editForm.branch_name || '',
          account: editForm.account_number || '',
          ifsc: editForm.ifsc_code || '',
        },
        company: {
          name: editForm.company_name || '',
          address: editForm.company_address || '',
          phone: editForm.company_phone || '',
          email: editForm.company_email || '',
          website: editForm.company_website || '',
        },
        contact: {
          person: editForm.contact_person || '',
          phone: editForm.contact_phone || '',
          email: editForm.contact_email || '',
        },
        files: {
          images: uploadedFiles.filter(f => f.type === 'image').length,
          videos: uploadedFiles.filter(f => f.type === 'video').length,
          documents: uploadedFiles.filter(f => f.type === 'file').length,
        },
        metadata: {
          last_updated: Date.now(),
          total_files: uploadedFiles.length,
        },
      },
    }
    await onOrganize(organizedData)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bank Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bank Information Section */}
        <div className="space-y-4 border-b pb-4">
          <h3 className="font-semibold text-lg">Bank Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bank_name">Bank Name *</Label>
              <Input
                id="bank_name"
                value={editForm.bank_name || ''}
                onChange={e => setEditForm({ ...editForm, bank_name: e.target.value })}
                placeholder="Enter bank name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch_name">Branch Name</Label>
              <Input
                id="branch_name"
                value={editForm.branch_name || ''}
                onChange={e => setEditForm({ ...editForm, branch_name: e.target.value })}
                placeholder="Enter branch name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account_number">Account Number</Label>
              <Input
                id="account_number"
                value={editForm.account_number || ''}
                onChange={e => setEditForm({ ...editForm, account_number: e.target.value })}
                placeholder="Enter account number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ifsc_code">IFSC Code</Label>
              <Input
                id="ifsc_code"
                value={editForm.ifsc_code || ''}
                onChange={e => setEditForm({ ...editForm, ifsc_code: e.target.value.toUpperCase() })}
                placeholder="Enter IFSC code"
                maxLength={11}
              />
            </div>
          </div>
        </div>

        {/* Company Information Section */}
        <div className="space-y-4 border-b pb-4">
          <h3 className="font-semibold text-lg">Company Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="company_name">Company Name *</Label>
              <Input
                id="company_name"
                value={editForm.company_name || ''}
                onChange={e => setEditForm({ ...editForm, company_name: e.target.value })}
                placeholder="Enter company name"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="company_address">Company Address</Label>
              <Textarea
                id="company_address"
                value={editForm.company_address || ''}
                onChange={e => setEditForm({ ...editForm, company_address: e.target.value })}
                placeholder="Enter company address"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_phone">Company Phone</Label>
              <Input
                id="company_phone"
                type="tel"
                value={editForm.company_phone || ''}
                onChange={e => setEditForm({ ...editForm, company_phone: e.target.value })}
                placeholder="Enter company phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_email">Company Email</Label>
              <Input
                id="company_email"
                type="email"
                value={editForm.company_email || ''}
                onChange={e => setEditForm({ ...editForm, company_email: e.target.value })}
                placeholder="Enter company email"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="company_website">Company Website</Label>
              <Input
                id="company_website"
                type="url"
                value={editForm.company_website || ''}
                onChange={e => setEditForm({ ...editForm, company_website: e.target.value })}
                placeholder="https://example.com"
              />
            </div>
          </div>
        </div>

        {/* Contact Information Section */}
        <div className="space-y-4 border-b pb-4">
          <h3 className="font-semibold text-lg">Contact Person</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact_person">Contact Person Name</Label>
              <Input
                id="contact_person"
                value={editForm.contact_person || ''}
                onChange={e => setEditForm({ ...editForm, contact_person: e.target.value })}
                placeholder="Enter contact person name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_phone">Contact Phone</Label>
              <Input
                id="contact_phone"
                type="tel"
                value={editForm.contact_phone || ''}
                onChange={e => setEditForm({ ...editForm, contact_phone: e.target.value })}
                placeholder="Enter contact phone"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="contact_email">Contact Email</Label>
              <Input
                id="contact_email"
                type="email"
                value={editForm.contact_email || ''}
                onChange={e => setEditForm({ ...editForm, contact_email: e.target.value })}
                placeholder="Enter contact email"
              />
            </div>
          </div>
        </div>

        {/* Additional Information Section */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Additional Information</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={editForm.notes || ''}
                onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Enter any additional notes"
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="other_info">Other Info</Label>
              <Textarea
                id="other_info"
                value={editForm.other_info || ''}
                onChange={e => setEditForm({ ...editForm, other_info: e.target.value })}
                placeholder="Enter other information"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* File Upload Section */}
        <FileUploadSection
          deviceCode={deviceCode}
          uploadedFiles={uploadedFiles}
          uploading={uploading}
          onFileUpload={onFileUpload}
          onFileDelete={onFileDelete}
          onFilePreview={onFilePreview}
          formatFileSize={formatFileSize}
        />

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-4 border-t">
          <Button
            onClick={handleOrganize}
            disabled={saving || uploading}
            variant="default"
          >
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Organizing...
              </>
            ) : (
              <>
                <Grid3x3 className="h-4 w-4 mr-2" />
                Organize & Save
              </>
            )}
          </Button>
          <Button onClick={handleSave} disabled={saving || uploading}>
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={saving || uploading}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
