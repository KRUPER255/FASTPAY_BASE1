import { useState, useEffect, useMemo } from 'react'
import { CreditCard, Building2, RefreshCw } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/component/ui/select'
import { getApiUrl } from '@/lib/api-client'
import { useToast } from '@/lib/use-toast'
import { cn } from '@/lib/utils'

export interface BankCardListItem {
  id: number
  device_id: string
  template_code: string
  template_name: string
  card_number: string
  card_holder_name: string
  bank_name: string
  bank_code?: string | null
  card_type: 'credit' | 'debit' | 'prepaid'
  status: 'active' | 'inactive' | 'blocked'
  balance: string | null
  currency: string
  created_at: string
}

interface BankCardListSidebarProps {
  selectedDeviceId: string | null
  onDeviceSelect: (deviceId: string) => void
  className?: string
}

function normalizeCards(payload: unknown): BankCardListItem[] {
  if (Array.isArray(payload)) {
    return payload as BankCardListItem[]
  }
  if (payload && typeof payload === 'object') {
    const maybeResults = (payload as { results?: unknown }).results
    if (Array.isArray(maybeResults)) {
      return maybeResults as BankCardListItem[]
    }
  }
  return []
}

function maskCardNumber(cardNumber: string): string {
  if (!cardNumber) return '****'
  const digits = cardNumber.replace(/\D/g, '')
  if (digits.length <= 4) return digits || '****'
  return `****${digits.slice(-4)}`
}

export function BankCardListSidebar({
  selectedDeviceId,
  onDeviceSelect,
  className,
}: BankCardListSidebarProps) {
  const { toast } = useToast()
  const [bankCards, setBankCards] = useState<BankCardListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [bankFilter, setBankFilter] = useState<string>('all')

  const fetchBankCards = async (bankName?: string) => {
    try {
      setRefreshing(true)
      let url = getApiUrl('/bank-cards/?limit=1000')
      if (bankName && bankName !== 'all') {
        url += `&bank_name=${encodeURIComponent(bankName)}`
      }
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch bank cards')
      const data = await response.json()
      setBankCards(normalizeCards(data))
    } catch (error) {
      console.error('Error fetching bank cards:', error)
      toast({
        title: 'Error',
        description: 'Failed to load bank cards',
        variant: 'destructive',
      })
      setBankCards([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchBankCards(bankFilter === 'all' ? undefined : bankFilter)
  }, [bankFilter])

  const bankOptions = useMemo(() => {
    const names = new Set<string>()
    bankCards.forEach(c => {
      if (c.bank_name) names.add(c.bank_name)
    })
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [bankCards])

  if (loading) {
    return (
      <div className={cn('flex flex-col gap-2 p-3', className)}>
        <div className="h-10 rounded-md bg-muted/50 animate-pulse" />
        <div className="flex-1 space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-14 rounded-md bg-muted/50 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-full min-h-0', className)}>
      <div className="shrink-0 space-y-2 p-3 border-b border-border/50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Bank cards</span>
          </div>
          <button
            type="button"
            onClick={() => fetchBankCards(bankFilter === 'all' ? undefined : bankFilter)}
            disabled={refreshing}
            className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-50"
            aria-label="Refresh list"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>
        <Select value={bankFilter} onValueChange={setBankFilter}>
          <SelectTrigger className="w-full h-9">
            <SelectValue placeholder="All banks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All banks</SelectItem>
            {bankOptions.map(name => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        {bankCards.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No bank cards</p>
            <p className="text-xs mt-1">
              {bankFilter !== 'all' ? 'Try "All banks"' : 'Add a bank card above'}
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {bankCards.map(card => (
              <li key={card.id}>
                <button
                  type="button"
                  onClick={() => onDeviceSelect(card.device_id)}
                  className={cn(
                    'w-full text-left rounded-lg px-3 py-2.5 border transition-colors',
                    'hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-primary/20',
                    selectedDeviceId === card.device_id
                      ? 'bg-primary/10 border-primary/30 ring-1 ring-primary/20'
                      : 'border-transparent bg-muted/20'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CreditCard className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{card.bank_name || 'N/A'}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {maskCardNumber(card.card_number)} · {card.device_id}
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
