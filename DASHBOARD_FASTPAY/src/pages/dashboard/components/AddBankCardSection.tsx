import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/component/ui/card'
import { Button } from '@/component/ui/button'
import { Input } from '@/component/ui/input'
import { Label } from '@/component/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/component/ui/select'
import { Textarea } from '@/component/ui/textarea'
import { useToast } from '@/lib/use-toast'
import { Loader, CreditCard, Building2, CheckCircle, XCircle, LayoutTemplate } from 'lucide-react'
import { getApiUrl } from '@/lib/api-client'

interface BankCardTemplate {
  id: number
  template_code: string
  template_name: string
  bank_name: string | null
  card_type: 'credit' | 'debit' | 'prepaid'
  default_fields: Record<string, any>
  description: string | null
  is_active: boolean
}

interface AddBankCardSectionProps {
  selectedDeviceId: string | null
}

export function AddBankCardSection({
  selectedDeviceId,
}: AddBankCardSectionProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [templates, setTemplates] = useState<BankCardTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

  // Form fields
  const [formData, setFormData] = useState({
    card_number: '',
    card_holder_name: '',
    bank_name: '',
    bank_code: '',
    card_type: 'debit' as 'credit' | 'debit' | 'prepaid',
    expiry_date: '',
    cvv: '',
    account_name: '',
    account_number: '',
    ifsc_code: '',
    branch_name: '',
    balance: '',
    currency: 'USD',
    status: 'active' as 'active' | 'inactive' | 'blocked',
    mobile_number: '',
    email: '',
    email_password: '',
    kyc_name: '',
    kyc_address: '',
    kyc_dob: '',
    kyc_aadhar: '',
    kyc_pan: '',
  })

  // Fetch templates
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoadingTemplates(true)
        // Construct URL properly - ensure no double slashes
        const url = getApiUrl('/bank-card-templates/?is_active=true')
        console.log('Fetching bank card templates from:', url)
        const response = await fetch(url)
        
        if (!response.ok) {
          if (response.status === 404) {
            console.warn('Bank card templates endpoint not found (404). This might be expected if templates are not set up yet.')
            // Set empty templates array - form can still work without templates
            setTemplates([])
            return
          }
          throw new Error(`Failed to fetch templates: ${response.status} ${response.statusText}`)
        }
        
        const data = await response.json()
        setTemplates(Array.isArray(data) ? data : [])
      } catch (error) {
        console.error('Error fetching templates:', error)
        const errorMessage = error instanceof Error ? error.message : 'Failed to load bank card templates'
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        })
        // Set empty templates array to allow form to still work
        setTemplates([])
      } finally {
        setLoadingTemplates(false)
      }
    }

    fetchTemplates()
  }, [toast])


  // Load template defaults when template is selected
  useEffect(() => {
    if (selectedTemplateId) {
      const template = templates.find(t => t.id.toString() === selectedTemplateId)
      if (template) {
        setFormData(prev => ({
          ...prev,
          bank_name: template.bank_name || prev.bank_name,
          card_type: template.card_type || prev.card_type,
          ...template.default_fields,
        }))
      }
    }
  }, [selectedTemplateId, templates])

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedDeviceId) {
      toast({
        title: 'Error',
        description: 'Please select a device from the dashboard',
        variant: 'destructive',
      })
      return
    }

    if (!selectedTemplateId) {
      toast({
        title: 'Error',
        description: 'Please select a bank card template',
        variant: 'destructive',
      })
      return
    }

    if (!formData.card_number || !formData.card_holder_name || !formData.bank_name) {
      toast({
        title: 'Error',
        description: 'Please fill in required fields (Card Number, Card Holder Name, Bank Name)',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const payload = {
        device_id: selectedDeviceId,
        template_id: parseInt(selectedTemplateId),
        ...formData,
        balance: formData.balance ? parseFloat(formData.balance) : null,
      }

      const response = await fetch(getApiUrl('/bank-cards/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || errorData.error || 'Failed to create bank card')
      }

      const data = await response.json()
      toast({
        title: 'Success',
        description: 'Bank card created successfully',
        variant: 'default',
      })

      // Reset form
      setFormData({
        card_number: '',
        card_holder_name: '',
        bank_name: '',
        bank_code: '',
        card_type: 'debit',
        expiry_date: '',
        cvv: '',
        account_name: '',
        account_number: '',
        ifsc_code: '',
        branch_name: '',
        balance: '',
        currency: 'USD',
        status: 'active',
        mobile_number: '',
        email: '',
        email_password: '',
        kyc_name: '',
        kyc_address: '',
        kyc_dob: '',
        kyc_aadhar: '',
        kyc_pan: '',
      })
      setSelectedTemplateId('')
    } catch (error) {
      console.error('Error creating bank card:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create bank card',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (!selectedDeviceId) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Please select a device from the dashboard to add a bank card</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Add Bank Card
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Device Info Display */}
          <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
            <Label>Selected Device</Label>
            <p className="text-sm font-medium">{selectedDeviceId}</p>
            <p className="text-xs text-muted-foreground">
              Bank card will be created for this device
            </p>
          </div>

          {/* Template Selection - Prominent Section */}
          <div className="space-y-3 p-4 bg-primary/5 border-2 border-primary/20 rounded-lg">
            <div className="flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5 text-primary" />
              <Label htmlFor="template" className="text-base font-semibold">
                Select Bank Card Template *
              </Label>
            </div>
            {loadingTemplates ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader className="h-4 w-4 animate-spin" />
                Loading templates...
              </div>
            ) : templates.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground border border-dashed rounded">
                <p>No active templates available</p>
                <p className="text-xs mt-1">Please create templates in the admin panel</p>
              </div>
            ) : (
              <>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger id="template" className="h-auto min-h-[3rem]">
                    <SelectValue placeholder="Choose a template to pre-fill form fields..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(template => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        <div className="flex flex-col gap-1 py-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-base">
                              {template.template_code}
                            </span>
                            <span className="text-sm font-medium">
                              - {template.template_name}
                            </span>
                          </div>
                          {template.bank_name && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Building2 className="h-3 w-3" />
                              <span>{template.bank_name}</span>
                              <span>•</span>
                              <span className="capitalize">{template.card_type}</span>
                            </div>
                          )}
                          {template.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {template.description}
                            </p>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTemplateId && (
                  <div className="mt-2 p-3 bg-primary/10 border border-primary/30 rounded-md">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-primary">
                          Template selected
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Template defaults will be automatically applied to the form fields below.
                          You can modify any field as needed.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {!selectedTemplateId && (
                  <p className="text-xs text-muted-foreground">
                    <strong>Tip:</strong> Selecting a template will pre-fill bank name, card type, and other default fields.
                  </p>
                )}
              </>
            )}
          </div>

          {/* Card Information Section */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Card Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="card_number">
                  Card Number (Last 4 digits) *
                </Label>
                <Input
                  id="card_number"
                  name="card_number"
                  value={formData.card_number}
                  onChange={handleInputChange}
                  placeholder="1234"
                  maxLength={20}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="card_holder_name">Card Holder Name *</Label>
                <Input
                  id="card_holder_name"
                  name="card_holder_name"
                  value={formData.card_holder_name}
                  onChange={handleInputChange}
                  placeholder="John Doe"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bank_name">Bank Name *</Label>
                <Input
                  id="bank_name"
                  name="bank_name"
                  value={formData.bank_name}
                  onChange={handleInputChange}
                  placeholder="Bank Name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bank_code">Bank Code</Label>
                <Input
                  id="bank_code"
                  name="bank_code"
                  value={formData.bank_code}
                  onChange={handleInputChange}
                  placeholder="Bank Code"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="card_type">Card Type</Label>
                <Select
                  value={formData.card_type}
                  onValueChange={value =>
                    handleSelectChange('card_type', value as 'credit' | 'debit' | 'prepaid')
                  }
                >
                  <SelectTrigger id="card_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debit">Debit Card</SelectItem>
                    <SelectItem value="credit">Credit Card</SelectItem>
                    <SelectItem value="prepaid">Prepaid Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiry_date">Expiry Date (MM/YY)</Label>
                <Input
                  id="expiry_date"
                  name="expiry_date"
                  value={formData.expiry_date}
                  onChange={handleInputChange}
                  placeholder="12/25"
                  maxLength={5}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cvv">CVV</Label>
                <Input
                  id="cvv"
                  name="cvv"
                  type="password"
                  value={formData.cvv}
                  onChange={handleInputChange}
                  placeholder="123"
                  maxLength={10}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={value =>
                    handleSelectChange('status', value as 'active' | 'inactive' | 'blocked')
                  }
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Account Information Section */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Account Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="account_name">Account Name</Label>
                <Input
                  id="account_name"
                  name="account_name"
                  value={formData.account_name}
                  onChange={handleInputChange}
                  placeholder="Company/Account Name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="account_number">Account Number</Label>
                <Input
                  id="account_number"
                  name="account_number"
                  value={formData.account_number}
                  onChange={handleInputChange}
                  placeholder="Account Number"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ifsc_code">IFSC Code</Label>
                <Input
                  id="ifsc_code"
                  name="ifsc_code"
                  value={formData.ifsc_code}
                  onChange={handleInputChange}
                  placeholder="IFSC Code"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="branch_name">Branch Name</Label>
                <Input
                  id="branch_name"
                  name="branch_name"
                  value={formData.branch_name}
                  onChange={handleInputChange}
                  placeholder="Branch Name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="balance">Balance</Label>
                <Input
                  id="balance"
                  name="balance"
                  type="number"
                  step="0.01"
                  value={formData.balance}
                  onChange={handleInputChange}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={formData.currency}
                  onValueChange={value => handleSelectChange('currency', value)}
                >
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="INR">INR</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Contact Information Section */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold">Contact Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mobile_number">Mobile Number</Label>
                <Input
                  id="mobile_number"
                  name="mobile_number"
                  value={formData.mobile_number}
                  onChange={handleInputChange}
                  placeholder="+1234567890"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="email@example.com"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="email_password">Email Password</Label>
                <Input
                  id="email_password"
                  name="email_password"
                  type="password"
                  value={formData.email_password}
                  onChange={handleInputChange}
                  placeholder="Email Password"
                />
              </div>
            </div>
          </div>

          {/* KYC Information Section */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold">KYC Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kyc_name">KYC Name</Label>
                <Input
                  id="kyc_name"
                  name="kyc_name"
                  value={formData.kyc_name}
                  onChange={handleInputChange}
                  placeholder="KYC Name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="kyc_dob">Date of Birth</Label>
                <Input
                  id="kyc_dob"
                  name="kyc_dob"
                  type="date"
                  value={formData.kyc_dob}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="kyc_address">KYC Address</Label>
                <Textarea
                  id="kyc_address"
                  name="kyc_address"
                  value={formData.kyc_address}
                  onChange={handleInputChange}
                  placeholder="Full Address"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="kyc_aadhar">Aadhar Number</Label>
                <Input
                  id="kyc_aadhar"
                  name="kyc_aadhar"
                  value={formData.kyc_aadhar}
                  onChange={handleInputChange}
                  placeholder="Aadhar Number"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="kyc_pan">PAN Number</Label>
                <Input
                  id="kyc_pan"
                  name="kyc_pan"
                  value={formData.kyc_pan}
                  onChange={handleInputChange}
                  placeholder="PAN Number"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="submit" disabled={loading || !selectedDeviceId || !selectedTemplateId}>
              {loading ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Create Bank Card
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
