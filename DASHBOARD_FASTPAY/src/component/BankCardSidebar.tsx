import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/component/ui/card'
import { CreditCard, XCircle, KeyRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getApiUrl } from '@/lib/api-client'

interface BankCardData {
  id?: number
  bank_name?: string
  account_name?: string
  card_number?: string
  card_holder_name?: string
  balance?: number
  status?: 'active' | 'inactive' | string
  account_number?: string
  bank_code?: string
  /** Key-value custom fields from template (additional_info.bank_specific_fields) */
  bank_specific_fields?: Record<string, unknown>
}

interface BankCardSidebarProps {
  deviceId: string | null
  className?: string
}

export function BankCardSidebar({ deviceId, className }: BankCardSidebarProps) {
  const [bankCard, setBankCard] = useState<BankCardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!deviceId) {
      setBankCard(null)
      return
    }

    const fetchBankCard = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(getApiUrl(`/bank-cards/by-device/${deviceId}`))
        if (response.ok) {
          const data = await response.json()
          setBankCard(data)
        } else if (response.status === 404) {
          setBankCard(null)
        } else {
          throw new Error('Failed to fetch bank card')
        }
      } catch (err) {
        console.error('Error fetching bank card:', err)
        setError('Failed to load bank card')
        setBankCard(null)
      } finally {
        setLoading(false)
      }
    }

    fetchBankCard()
  }, [deviceId])

  // Mask card number for display
  const maskCardNumber = (cardNumber?: string): string => {
    if (!cardNumber) return '•••• •••• •••• ••••'
    const cleaned = cardNumber.replace(/\s/g, '')
    if (cleaned.length <= 4) return cardNumber
    const lastFour = cleaned.slice(-4)
    return `•••• •••• •••• ${lastFour}`
  }

  // Format balance
  const formatBalance = (balance?: number): string => {
    if (balance === undefined || balance === null) return '—'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(balance)
  }

  if (!deviceId) {
    return null
  }

  return (
    <Card
      variant="outline"
      className={cn(
        'min-h-full flex flex-col overflow-hidden',
        className
      )}
    >
      <CardHeader className="flex flex-row items-center gap-2 px-4 py-2.5 border-b border-border/50 space-y-0 shrink-0">
        <CreditCard className="h-5 w-5 text-primary shrink-0" />
        <span className="text-base font-semibold text-foreground">Bank Card</span>
      </CardHeader>
      <CardContent className="p-2 flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex justify-between gap-2">
                <div className="h-3 w-20 bg-muted rounded animate-pulse shrink-0" />
                <div className="h-5 flex-1 max-w-[140px] bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8 text-muted-foreground">
            <XCircle className="h-8 w-8 mx-auto mb-2 text-status-error" />
            <p className="text-sm">{error}</p>
          </div>
        ) : !bankCard ? (
          <div className="text-center py-8 text-muted-foreground">
            <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No bank card linked</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-border/50 bg-transparent p-3 space-y-2">
              <div className="text-xs font-medium text-muted-foreground mb-1">Account</div>
              <div className="flex justify-between gap-2">
                <span className="text-xs text-muted-foreground shrink-0">BANK NAME:</span>
                <span className="text-sm font-medium text-foreground text-right truncate">
                  {bankCard.bank_name || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-xs text-muted-foreground shrink-0">ACCOUNT NAME:</span>
                <span className="text-sm font-medium text-foreground text-right truncate">
                  {bankCard.account_name || 'N/A'}
                </span>
              </div>
            </div>
            <div className="rounded-lg border border-border/50 bg-transparent p-3 space-y-2">
              <div className="text-xs font-medium text-muted-foreground mb-1">Card details</div>
              <div className="flex justify-between gap-2">
                <span className="text-xs text-muted-foreground shrink-0">CARD NUMBER:</span>
                <span className="text-sm font-mono font-medium text-foreground text-right">
                  {maskCardNumber(bankCard.card_number || bankCard.account_number)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-xs text-muted-foreground shrink-0">CARD HOLDER:</span>
                <span className="text-sm font-medium text-foreground text-right truncate">
                  {bankCard.card_holder_name || 'N/A'}
                </span>
              </div>
            </div>
            <div className="rounded-lg border border-border/50 bg-transparent p-3 space-y-2">
              <div className="text-xs font-medium text-muted-foreground mb-1">Balance & status</div>
              <div className="flex justify-between gap-2">
                <span className="text-xs text-muted-foreground shrink-0">BALANCE:</span>
                <span className="text-sm font-bold text-foreground text-right">
                  {formatBalance(bankCard.balance)}
                </span>
              </div>
              <div className="flex justify-between items-center gap-2 pt-1 border-t border-border/30">
                <span className="text-xs text-muted-foreground shrink-0">STATUS:</span>
                <span
                  className={cn(
                    'text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full',
                    bankCard.status === 'active'
                      ? 'bg-status-success/15 text-status-success'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {bankCard.status === 'active' ? 'Active' : (bankCard.status?.toUpperCase() || 'INACTIVE')}
                </span>
              </div>
            </div>
            {bankCard.bank_specific_fields && Object.keys(bankCard.bank_specific_fields).length > 0 && (
              <div className="rounded-lg border border-border/50 bg-transparent p-3 space-y-2">
                <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <KeyRound className="h-3 w-3" />
                  Custom fields
                </div>
                {Object.entries(bankCard.bank_specific_fields).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-2">
                    <span className="text-xs text-muted-foreground shrink-0 truncate max-w-[40%]">
                      {key}:
                    </span>
                    <span className="text-sm font-medium text-foreground text-right truncate max-w-[55%]">
                      {value === null || value === undefined ? '—' : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
