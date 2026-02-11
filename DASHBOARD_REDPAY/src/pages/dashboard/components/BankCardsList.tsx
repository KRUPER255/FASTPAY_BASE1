import { useState, useEffect } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/component/ui/table'
import { Input } from '@/component/ui/input'
import { Badge } from '@/component/ui/badge'
import { Button } from '@/component/ui/button'
import { Skeleton } from '@/component/ui/skeleton'
import {
  CreditCard,
  Building2,
  User,
  Calendar,
  Loader,
  Search,
  RefreshCw,
  Plus,
} from 'lucide-react'
import { useToast } from '@/lib/use-toast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/component/ui/select'
import { getApiUrl } from '@/lib/api-client'

interface BankCard {
  id: number
  device_id: string
  template_code: string
  template_name: string
  card_number: string
  card_holder_name: string
  bank_name: string
  card_type: 'credit' | 'debit' | 'prepaid'
  status: 'active' | 'inactive' | 'blocked'
  balance: string | null
  currency: string
  created_at: string
}

interface BankCardsListProps {
  onDeviceSelect?: (deviceId: string) => void
  onAddBankCard?: () => void
}

export function BankCardsList({ onDeviceSelect, onAddBankCard }: BankCardsListProps) {
  const { toast } = useToast()
  const [bankCards, setBankCards] = useState<BankCard[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'blocked'>('all')
  const [cardTypeFilter, setCardTypeFilter] = useState<'all' | 'credit' | 'debit' | 'prepaid'>('all')

  const normalizeCards = (payload: unknown): BankCard[] => {
    if (Array.isArray(payload)) {
      return payload as BankCard[]
    }
    if (payload && typeof payload === 'object') {
      const maybeResults = (payload as { results?: unknown }).results
      if (Array.isArray(maybeResults)) {
        return maybeResults as BankCard[]
      }
    }
    return []
  }

  const fetchBankCards = async () => {
    try {
      setRefreshing(true)
      // Fetch all bank cards - use a high limit to get all results
      const response = await fetch(getApiUrl('/bank-cards/?limit=1000'))
      if (!response.ok) {
        throw new Error('Failed to fetch bank cards')
      }
      const data = await response.json()

      // Handle paginated response (Django REST Framework pagination)
      // Response can be either:
      // 1. Paginated: { count, next, previous, results: [...] }
      // 2. Direct array: [...]
      const cards = normalizeCards(data)
      setBankCards(cards)
    } catch (error) {
      console.error('Error fetching bank cards:', error)
      toast({
        title: 'Error',
        description: 'Failed to load bank cards',
        variant: 'destructive',
      })
      setBankCards([]) // Set empty array on error
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchBankCards()
  }, [])

  const safeCards = Array.isArray(bankCards) ? bankCards : []

  const filteredCards = safeCards.filter(card => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesSearch =
        card.device_id.toLowerCase().includes(query) ||
        card.card_holder_name.toLowerCase().includes(query) ||
        card.bank_name.toLowerCase().includes(query) ||
        card.card_number.includes(query) ||
        card.template_code.toLowerCase().includes(query)
      if (!matchesSearch) return false
    }

    // Status filter
    if (statusFilter !== 'all' && card.status !== statusFilter) {
      return false
    }

    // Card type filter
    if (cardTypeFilter !== 'all' && card.card_type !== cardTypeFilter) {
      return false
    }

    return true
  })

  const totalCount = safeCards.length
  const activeCount = safeCards.filter(card => card.status === 'active').length
  const blockedCount = safeCards.filter(card => card.status === 'blocked').length

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return dateString
    }
  }

  const formatBalance = (balance: string | null, currency: string) => {
    if (!balance) return 'N/A'
    const num = parseFloat(balance)
    if (isNaN(num)) return balance
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(num)
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default'
      case 'inactive':
        return 'secondary'
      case 'blocked':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const getCardTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'credit':
        return 'default'
      case 'debit':
        return 'secondary'
      case 'prepaid':
        return 'outline'
      default:
        return 'outline'
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header and Filters */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Bank Cards</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Total: {totalCount}</span>
            <span>•</span>
            <span>Active: {activeCount}</span>
            <span>•</span>
            <span>Blocked: {blockedCount}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onAddBankCard && (
            <Button
              variant="default"
              size="sm"
              onClick={onAddBankCard}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Bank Card
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchBankCards}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border/50 bg-muted/20 p-3">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by device, name, bank, card number..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={value => setStatusFilter(value as any)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
          </SelectContent>
        </Select>
        <Select value={cardTypeFilter} onValueChange={value => setCardTypeFilter(value as any)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="credit">Credit</SelectItem>
            <SelectItem value="debit">Debit</SelectItem>
            <SelectItem value="prepaid">Prepaid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bank Cards Table */}
      {filteredCards.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">No bank cards found</p>
          <p className="text-sm mt-2">
            {searchQuery || statusFilter !== 'all' || cardTypeFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Create a bank card using the "Add Bank Card" tab'}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device ID</TableHead>
                <TableHead>Card Holder</TableHead>
                <TableHead>Bank Name</TableHead>
                <TableHead>Card Number</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCards.map(card => (
                <TableRow
                  key={card.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onDeviceSelect?.(card.device_id)}
                >
                  <TableCell className="font-mono text-sm">{card.device_id}</TableCell>
                  <TableCell className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {card.card_holder_name}
                  </TableCell>
                  <TableCell className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    {card.bank_name}
                  </TableCell>
                  <TableCell className="font-mono">{card.card_number}</TableCell>
                  <TableCell>
                    <Badge variant={getCardTypeBadgeVariant(card.card_type)}>
                      {card.card_type.charAt(0).toUpperCase() + card.card_type.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(card.status)}>
                      {card.status.charAt(0).toUpperCase() + card.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatBalance(card.balance, card.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{card.template_code}</Badge>
                  </TableCell>
                  <TableCell className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {formatDate(card.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
