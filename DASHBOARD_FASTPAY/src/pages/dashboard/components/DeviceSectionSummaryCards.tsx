import { useState } from 'react'
import { CreditCard, ChevronDown, ChevronRight, Copy, Edit } from 'lucide-react'
import { Button } from '@/component/ui/button'
import { DribbbleStyleCard } from '@/component/DribbbleStyleCard'
import { cn } from '@/lib/utils'
import { useToast } from '@/lib/use-toast'

interface BankCardSummary {
  bank_name?: string | null
  account_name?: string | null
  account_number?: string | null
  status?: 'active' | 'inactive' | 'blocked'
  mobile_number?: string | null
  email?: string | null
  kyc_name?: string | null
  card_holder_name?: string | null
  balance?: number | string | null
}

interface DeviceSectionSummaryCardsProps {
  bankCard: BankCardSummary | null
  loadingBankCard: boolean
  deviceStatus: string
  deviceStatusLabel: string
  deviceBatteryValue: number | null
  deviceLastSeenValue: number
  currentUserCode?: string | null
  formatLastSeen: (timestamp: number) => string
  maskSensitiveData: (value: string | null, type: 'account') => string
  getStatusBadgeVariant: (status: string) => 'default' | 'secondary' | 'destructive'
  onEditBankCard?: (cardIndex: number) => void
}

const CARD_COUNT = 3

export function DeviceSectionSummaryCards({
  bankCard,
  loadingBankCard,
  maskSensitiveData,
  onEditBankCard,
}: DeviceSectionSummaryCardsProps) {
  const [expandedIndex, setExpandedIndex] = useState(0)
  const { toast } = useToast()

  const formatBalance = (balance?: number | string | null): string => {
    if (balance === undefined || balance === null) return '—'
    const num = typeof balance === 'string' ? parseFloat(balance) : balance
    if (isNaN(num)) return '—'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num)
  }

  const copyCardToClipboard = (card: BankCardSummary) => {
    const parts = [
      `Bank: ${card.bank_name || 'N/A'}`,
      `Account: ${card.account_name || 'N/A'}`,
      `Card: ${card.account_number ? maskSensitiveData(card.account_number, 'account') : '•••• •••• •••• ••••'}`,
      `Holder: ${card.card_holder_name || card.kyc_name || 'N/A'}`,
      `Balance: ${formatBalance(card.balance)}`,
      `Status: ${card.status?.toUpperCase() || 'N/A'}`,
    ]
    const text = parts.join(' | ')
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast({
          title: 'Copied',
          description: 'Bank card details copied to clipboard',
        })
      })
      .catch(() => {
        toast({
          title: 'Copy failed',
          description: 'Could not copy to clipboard',
          variant: 'destructive',
        })
      })
  }

  const getCardData = (index: number): BankCardSummary | null => {
    if (index === 0 && bankCard) return bankCard
    return null
  }

  if (loadingBankCard) {
    return (
      <div className="w-full min-w-[200px] space-y-2">
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className="rounded-xl border border-border/50 bg-card shadow-sm p-3 animate-pulse"
          >
            <div className="flex justify-between gap-2">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-4 w-16 bg-muted rounded" />
            </div>
            <div className="mt-2 space-y-2">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="flex justify-between gap-2">
                  <div className="h-3 w-20 bg-muted rounded shrink-0" />
                  <div className="h-5 flex-1 max-w-[120px] bg-muted rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="w-full min-w-[200px] space-y-2">
      {Array.from({ length: CARD_COUNT }, (_, index) => {
        const card = getCardData(index)
        const hasData = !!card
        const isExpanded = expandedIndex === index

        return (
          <DribbbleStyleCard
            key={index}
            delay={index * 0.08}
            className={cn(
              'cursor-pointer',
              isExpanded && 'ring-2 ring-primary/20 border-primary/50'
            )}
          >
            <div
              role="button"
              tabIndex={0}
              onClick={() => setExpandedIndex(index)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setExpandedIndex(index)
                }
              }}
              className="outline-none"
            >
            {/* Header Row - Always visible */}
            <div className="flex items-center justify-between gap-2 p-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-muted-foreground font-medium">
                  CARD {index + 1}
                </span>
                <span className="font-mono font-bold text-sm text-foreground truncate">
                  {hasData ? (card!.bank_name || 'Bank') : '—'}
                </span>
                <span
                  className={cn(
                    'text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full shrink-0',
                    hasData && card!.status === 'active'
                      ? 'bg-status-success/15 text-status-success'
                      : hasData
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-muted/70 text-muted-foreground'
                  )}
                >
                  {hasData ? (card!.status?.toUpperCase() || 'INACTIVE') : 'NO CARD'}
                </span>
              </div>
              <div
                className="flex items-center gap-1 flex-shrink-0"
                onClick={e => e.stopPropagation()}
              >
                {hasData && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => copyCardToClipboard(card!)}
                      title="Copy"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onEditBankCard?.(index)}
                      title="Edit"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
                {hasData && (
                  <span className="text-xs font-bold text-foreground ml-1">
                    {formatBalance(card!.balance)}
                  </span>
                )}
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>

            {/* Expandable Details */}
            <div
              className={cn(
                'overflow-hidden transition-all duration-300 ease-in-out',
                isExpanded ? 'max-h-[420px]' : 'max-h-0'
              )}
            >
              <div className="px-3 pb-3 pt-1 border-t border-border/30 space-y-2">
                {hasData ? (
                  <div className="space-y-2">
                    <DribbbleStyleCard noHover delay={0} className="overflow-hidden">
                      <div className="p-2 space-y-1">
                        <div className="text-[10px] font-medium text-muted-foreground uppercase">Account</div>
                        <div className="flex justify-between gap-2">
                          <span className="text-xs text-muted-foreground shrink-0">BANK NAME:</span>
                          <span className="text-sm font-medium text-foreground text-right truncate">
                            {card!.bank_name || 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-xs text-muted-foreground shrink-0">ACCOUNT NAME:</span>
                          <span className="text-sm font-medium text-foreground text-right truncate">
                            {card!.account_name || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </DribbbleStyleCard>
                    <DribbbleStyleCard noHover delay={0.04} className="overflow-hidden">
                      <div className="p-2 space-y-1">
                        <div className="text-[10px] font-medium text-muted-foreground uppercase">Card details</div>
                        <div className="flex justify-between gap-2">
                          <span className="text-xs text-muted-foreground shrink-0">CARD NUMBER:</span>
                          <span className="text-sm font-mono font-medium text-foreground text-right">
                            {card!.account_number
                              ? maskSensitiveData(card!.account_number, 'account')
                              : '•••• •••• •••• ••••'}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-xs text-muted-foreground shrink-0">CARD HOLDER:</span>
                          <span className="text-sm font-medium text-foreground text-right truncate">
                            {card!.card_holder_name || card!.kyc_name || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </DribbbleStyleCard>
                    <DribbbleStyleCard noHover delay={0.08} className="overflow-hidden">
                      <div className="p-2 space-y-1">
                        <div className="text-[10px] font-medium text-muted-foreground uppercase">Balance & status</div>
                        <div className="flex justify-between gap-2">
                          <span className="text-xs text-muted-foreground shrink-0">BALANCE:</span>
                          <span className="text-sm font-bold text-foreground text-right">
                            {formatBalance(card!.balance)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center gap-2 pt-1 border-t border-border/30">
                          <span className="text-xs text-muted-foreground shrink-0">STATUS:</span>
                          <span
                            className={cn(
                              'text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full',
                              card!.status === 'active'
                                ? 'bg-status-success/15 text-status-success'
                                : 'bg-muted text-muted-foreground'
                            )}
                          >
                            {card!.status?.toUpperCase() || 'INACTIVE'}
                          </span>
                        </div>
                      </div>
                    </DribbbleStyleCard>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No bank card linked</p>
                  </div>
                )}
              </div>
            </div>
            </div>
          </DribbbleStyleCard>
        )
      })}
    </div>
  )
}
