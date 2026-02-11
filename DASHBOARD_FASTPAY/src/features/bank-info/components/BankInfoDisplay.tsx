import { Edit } from 'lucide-react'
import { Button } from '@/component/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/component/ui/card'
import type { BankData } from '@/hooks/bank-info'

interface BankInfoDisplayProps {
  bankInfo: BankData
  onEdit: () => void
}

/**
 * BankInfoDisplay - Display bank information in read-only mode
 */
export function BankInfoDisplay({ bankInfo, onEdit }: BankInfoDisplayProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Bank Details</CardTitle>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Bank Information */}
        {(bankInfo.bank_name || bankInfo.branch_name || bankInfo.account_number || bankInfo.ifsc_code) && (
          <div className="space-y-3">
            <h3 className="font-semibold text-lg border-b pb-2">Bank Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bankInfo.bank_name && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Bank Name</p>
                  <p className="font-medium">{bankInfo.bank_name}</p>
                </div>
              )}
              {bankInfo.branch_name && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Branch Name</p>
                  <p className="font-medium">{bankInfo.branch_name}</p>
                </div>
              )}
              {bankInfo.account_number && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Account Number</p>
                  <p className="font-medium font-mono">{bankInfo.account_number}</p>
                </div>
              )}
              {bankInfo.ifsc_code && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">IFSC Code</p>
                  <p className="font-medium font-mono">{bankInfo.ifsc_code}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Company Information */}
        {(bankInfo.company_name || bankInfo.company_address || bankInfo.company_phone || bankInfo.company_email || bankInfo.company_website) && (
          <div className="space-y-3">
            <h3 className="font-semibold text-lg border-b pb-2">Company Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bankInfo.company_name && (
                <div className="md:col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">Company Name</p>
                  <p className="font-medium">{bankInfo.company_name}</p>
                </div>
              )}
              {bankInfo.company_address && (
                <div className="md:col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">Company Address</p>
                  <p className="font-medium whitespace-pre-wrap">{bankInfo.company_address}</p>
                </div>
              )}
              {bankInfo.company_phone && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Company Phone</p>
                  <p className="font-medium">{bankInfo.company_phone}</p>
                </div>
              )}
              {bankInfo.company_email && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Company Email</p>
                  <p className="font-medium">{bankInfo.company_email}</p>
                </div>
              )}
              {bankInfo.company_website && (
                <div className="md:col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">Company Website</p>
                  <a
                    href={bankInfo.company_website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    {bankInfo.company_website}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contact Information */}
        {(bankInfo.contact_person || bankInfo.contact_phone || bankInfo.contact_email) && (
          <div className="space-y-3">
            <h3 className="font-semibold text-lg border-b pb-2">Contact Person</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bankInfo.contact_person && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Contact Person Name</p>
                  <p className="font-medium">{bankInfo.contact_person}</p>
                </div>
              )}
              {bankInfo.contact_phone && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Contact Phone</p>
                  <p className="font-medium">{bankInfo.contact_phone}</p>
                </div>
              )}
              {bankInfo.contact_email && (
                <div className="md:col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">Contact Email</p>
                  <p className="font-medium">{bankInfo.contact_email}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Additional Information */}
        {(bankInfo.notes || bankInfo.other_info) && (
          <div className="space-y-3">
            <h3 className="font-semibold text-lg border-b pb-2">Additional Information</h3>
            {bankInfo.notes && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Notes</p>
                <p className="font-medium whitespace-pre-wrap">{bankInfo.notes}</p>
              </div>
            )}
            {bankInfo.other_info && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Other Info</p>
                <p className="font-medium whitespace-pre-wrap">{bankInfo.other_info}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
