import { useState, useMemo, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/component/ui/card'
import { Input } from '@/component/ui/input'
import { Button } from '@/component/ui/button'
import { Badge } from '@/component/ui/badge'
import { Label } from '@/component/ui/label'
import { Search, Smartphone, Activity, Battery, RefreshCw, Settings2, Wifi, WifiOff, Circle, MessageSquare, Eye, Filter, ArrowUpDown, X, Menu, X as XIcon, ChevronDown, ChevronRight, CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDeviceListPath } from '@/lib/firebase-helpers'
import { get } from 'firebase/database'
import { StatusBadge } from './StatusBadge'
import { BatteryIndicator } from './BatteryIndicator'
import { EmptyState } from './EmptyState'
import { SkeletonCard } from './SkeletonLoader'
import { useKeyboardShortcuts } from '@/lib/useKeyboardShortcuts'
import { getApiUrl } from '@/lib/api-client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/component/ui/select'

interface Device {
  id: string
  name?: string
  code?: string
  phone?: string
  currentPhone?: string
  lastSeen?: number
  batteryPercentage?: number
  isActive?: boolean
  isOnline?: boolean
  time?: number
  companyCode?: string
  companyName?: string
}

interface BankInfo {
  bank_name?: string
  company_name?: string
  other_info?: string
  bank_code?: string
}

interface BankCardInfo {
  bank_code?: string
  bank_name?: string
}

interface DeviceListSidebarProps {
  devices: Device[]
  selectedDeviceId?: string | null
  onDeviceSelect?: (deviceId: string) => void
  onAttachBankCard?: (deviceId: string) => void
  onRefresh?: () => void
  onCodeClick?: () => void
}

export function DeviceListSidebar({
  devices,
  selectedDeviceId,
  onDeviceSelect,
  onAttachBankCard,
  onRefresh,
  onCodeClick,
}: DeviceListSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showOnlineOnly, setShowOnlineOnly] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'testing' | 'running'>('all')
  const [bankInfoMap, setBankInfoMap] = useState<Record<string, BankInfo>>({})
  const [bankCardMap, setBankCardMap] = useState<Record<string, BankCardInfo | null>>({})
  const [batteryFilter, setBatteryFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all')
  const [sortBy, setSortBy] = useState<'name' | 'lastSeen' | 'battery' | 'code'>('lastSeen')
  const [showFilters, setShowFilters] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Focus search input when search is opened
  useEffect(() => {
    if (searchOpen) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 0)
      return () => clearTimeout(t)
    }
  }, [searchOpen])

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'k',
      ctrlKey: true,
      callback: () => {
        setSearchOpen(true)
        setTimeout(() => searchInputRef.current?.focus(), 0)
      },
    },
  ])

  // Filter and sort devices
  const filteredDevices = useMemo(() => {
    const devicesArray = Array.isArray(devices) ? devices : []
    let filtered = devicesArray

    // Filter by online status (last seen in last 5 minutes)
    const now = Date.now()
    const fiveMinutesAgo = now - 300000 // 5 minutes in milliseconds
    if (showOnlineOnly) {
      filtered = filtered.filter(device => {
        const lastSeen = device.lastSeen || device.time
        if (!lastSeen) return false
        return lastSeen >= fiveMinutesAgo
      })
    }

    // Filter by testing/running status (based on online state)
    if (statusFilter !== 'all') {
      filtered = filtered.filter(device => {
        const lastSeen = device.lastSeen || device.time
        const isConnected = !!lastSeen && lastSeen >= fiveMinutesAgo
        return statusFilter === 'running' ? isConnected : !isConnected
      })
    }

    // Filter by battery level
    if (batteryFilter !== 'all') {
      filtered = filtered.filter(device => {
        const battery = device.batteryPercentage ?? 0
        if (batteryFilter === 'low') return battery < 20
        if (batteryFilter === 'medium') return battery >= 20 && battery < 50
        if (batteryFilter === 'high') return battery >= 50
        return true
      })
    }

    // Filter by search query (code, bank name, number)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(device => {
        const code = device.code?.toLowerCase() || ''
        const phone = (device.phone || device.currentPhone || '').toLowerCase()
        const bankInfo = bankInfoMap[device.code || '']
        const bankName = bankInfo?.bank_name?.toLowerCase() || ''

        return code.includes(query) || phone.includes(query) || bankName.includes(query)
      })
    }

    // Sort devices
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.name || a.id).localeCompare(b.name || b.id)
        case 'lastSeen':
          const aTime = a.lastSeen || a.time || 0
          const bTime = b.lastSeen || b.time || 0
          return bTime - aTime // Most recent first
        case 'battery':
          const aBattery = a.batteryPercentage ?? 0
          const bBattery = b.batteryPercentage ?? 0
          return bBattery - aBattery // Highest first
        case 'code':
          return (a.code || '').localeCompare(b.code || '')
        default:
          return 0
      }
    })

    return filtered
  }, [devices, searchQuery, showOnlineOnly, batteryFilter, sortBy, bankInfoMap, statusFilter])

  // Fetch bank information for all devices (from Firebase - for backward compatibility)
  useEffect(() => {
    const fetchBankInfoForDevices = async () => {
      const codes = devices
        .map(d => d.code)
        .filter((code): code is string => !!code && !bankInfoMap[code])

      if (codes.length === 0) return

      const bankInfoPromises = codes.map(async code => {
        try {
          const bankRef = getDeviceListPath(code, 'BANK')
          const bankSnapshot = await get(bankRef)

          if (bankSnapshot.exists()) {
            const data = bankSnapshot.val()
            return {
              code,
              bankInfo: {
                bank_name: data?.bank_name || '',
                company_name: data?.company_name || '',
                other_info: data?.other_info || '',
                bank_code: data?.bank_code || '',
              },
            }
          }
          return { code, bankInfo: {} }
        } catch (error) {
          console.error(`Error fetching bank info for code ${code}:`, error)
          return { code, bankInfo: {} }
        }
      })

      const results = await Promise.all(bankInfoPromises)
      const newBankInfoMap: Record<string, BankInfo> = {}

      results.forEach(({ code, bankInfo }) => {
        newBankInfoMap[code] = bankInfo
      })

      setBankInfoMap(prev => ({ ...prev, ...newBankInfoMap }))
    }

    fetchBankInfoForDevices()
  }, [devices, bankInfoMap])

  // Fetch bank cards from Django API in a single batch
  useEffect(() => {
    const fetchBankCardsForDevices = async () => {
      const deviceIds = devices
        .map(d => d.id)
        .filter((id): id is string => !!id && !(id in bankCardMap))

      if (deviceIds.length === 0) return

      try {
        const response = await fetch(getApiUrl('/bank-cards/batch/'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_ids: deviceIds }),
        })

        if (!response.ok) {
          console.warn(`Failed to fetch bank cards batch: ${response.status} ${response.statusText}`)
          return
        }

        const data = await response.json()
        const results = data?.results || {}
        setBankCardMap(prev => ({ ...prev, ...results }))
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
          console.warn('Network error fetching bank cards batch:', error)
        }
      }
    }

    fetchBankCardsForDevices()
  }, [devices, bankCardMap])

  const formatLastSeen = (timestamp?: number): string => {
    if (!timestamp) return 'Never'

    try {
      const now = Date.now()
      const lastSeenTime = timestamp
      const diffMs = now - lastSeenTime
      const diffSeconds = Math.floor(diffMs / 1000)

      // Handle future timestamps (clock sync issues) - treat as just connected
      if (diffSeconds < 0) {
        return 'Connected'
      }

      // If less than 20 seconds, show "Connected"
      if (diffSeconds >= 0 && diffSeconds < 20) {
        return 'Connected'
      }

      // For times 20-59 seconds old, show exact second count
      if (diffSeconds >= 20 && diffSeconds < 60) {
        return `${diffSeconds} seconds ago`
      }

      // For times 60 seconds to 120 seconds, show exact seconds
      if (diffSeconds >= 60 && diffSeconds <= 120) {
        return `${diffSeconds} seconds ago`
      }

      // For times older than 120 seconds, calculate minutes/hours manually
      const diffMinutes = Math.floor(diffSeconds / 60)
      const diffHours = Math.floor(diffMinutes / 60)
      const diffDays = Math.floor(diffHours / 24)

      if (diffDays > 0) {
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
      } else if (diffHours > 0) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
      } else if (diffMinutes > 0) {
        return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`
      }

      return `${diffSeconds} seconds ago`
    } catch {
      return 'Never'
    }
  }

  return (
    <>
      {/* Mobile Toggle Button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="bg-background/80 backdrop-blur-sm"
        >
          {isMobileOpen ? <XIcon className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <Card
        className={cn(
          'h-full flex flex-col transition-all duration-300 ease-in-out',
          'lg:relative lg:translate-x-0',
          'border-r border-border/50',
          'bg-card/95 backdrop-blur-sm',
          'shadow-lg lg:shadow-none',
          isMobileOpen
            ? 'fixed left-0 top-0 z-50 w-80 h-full translate-x-0'
            : 'fixed -translate-x-full lg:translate-x-0'
        )}
      >
      <CardHeader className="p-4 pb-3 border-b border-border/30 bg-card">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-foreground">
            Devices
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchOpen(true)
                setTimeout(() => searchInputRef.current?.focus(), 0)
              }}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/50"
              title="Search devices (Ctrl+K)"
            >
              <Search className="h-4 w-4" />
            </Button>
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                title="Refresh devices"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 flex flex-col flex-1 min-h-0">
        {/* Search Box - shown when search open or has query */}
        {(searchOpen || searchQuery) && (
          <div className="mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search devices..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10 pr-8 h-9 text-sm rounded-lg border-border/50 bg-muted/30 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                onKeyDown={e => {
                  if (e.key === 'Escape') {
                    searchInputRef.current?.blur()
                    setSearchQuery('')
                    setSearchOpen(false)
                  }
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('')
                  setSearchOpen(false)
                }}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Invisible trigger for Ctrl+K when search box is closed - focus moves to visible input when opened */}
        {!searchOpen && !searchQuery && (
          <input
            ref={searchInputRef}
            type="text"
            readOnly
            tabIndex={-1}
            className="absolute opacity-0 pointer-events-none w-0 h-0"
            onFocus={() => setSearchOpen(true)}
            aria-hidden
          />
        )}

        {/* Device List: ~15 devices visible, then scroll */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide space-y-2 max-h-[min(70vh,60rem)]">
          {filteredDevices.length === 0 ? (
            <EmptyState
              icon={Smartphone}
              title={searchQuery ? 'No devices found' : 'No devices available'}
              description={
                searchQuery
                  ? 'Try adjusting your search or filters'
                  : 'Add devices to start monitoring'
              }
              action={
                onRefresh
                  ? {
                      label: 'Refresh',
                      onClick: onRefresh,
                    }
                  : undefined
              }
            />
          ) : (
            filteredDevices.map(device => {
              const isSelected = device.id === selectedDeviceId
              const hasActiveBank = !!bankCardMap[device.id]

              // Calculate connection status
              const lastSeenTimestamp = device.lastSeen || device.time
              const now = Date.now()
              const diffMs = lastSeenTimestamp ? now - lastSeenTimestamp : Infinity
              const diffSeconds = Math.floor(diffMs / 1000)
              const isConnected = diffSeconds < 300 // 5 minutes

              return (
                <div
                  key={device.id}
                  onClick={() => {
                    onDeviceSelect?.(device.id)
                    setIsMobileOpen(false)
                  }}
                  className={cn(
                    'rounded-xl border bg-card shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md',
                    isSelected
                      ? 'border-primary/50 ring-2 ring-primary/20 shadow-md'
                      : 'border-border/50 hover:border-border',
                    hasActiveBank && 'border-l-4 border-l-primary/60'
                  )}
                >
                  {/* Card row: BANK TAG, CATEGORY, BATTERY, ONLINE/OFFLINE/TIME, message count */}
                  <div className="flex items-center justify-between gap-2 p-3">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <span className="text-[10px] text-muted-foreground font-medium uppercase">BANK TAG</span>
                      <span className="font-mono font-bold text-sm text-foreground">
                        {device.code || 'N/A'}
                      </span>
                      {device.companyCode && (
                        <Badge variant="secondary" className="text-[10px] font-medium shrink-0">
                          {device.companyCode}
                        </Badge>
                      )}
                      <span
                        className={cn(
                          'text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full shrink-0',
                          isConnected
                            ? 'bg-status-success/15 text-status-success'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {isConnected ? 'ONLINE' : 'OFFLINE'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatLastSeen(lastSeenTimestamp || undefined)}
                      </span>
                      <span className="text-[10px] text-muted-foreground" title="Messages (not yet available)">
                        MSGS: —
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1" title="Battery">
                        <Battery
                          className={cn(
                            'h-4 w-4',
                            device.batteryPercentage === undefined
                              ? 'text-muted-foreground'
                              : device.batteryPercentage > 50
                                ? 'text-status-success'
                                : device.batteryPercentage > 20
                                  ? 'text-status-pending'
                                  : 'text-status-error'
                          )}
                        />
                        <span className="text-xs text-muted-foreground">
                          {device.batteryPercentage !== undefined ? `${device.batteryPercentage}%` : '--%'}
                        </span>
                      </div>
                      {isSelected ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Expandable: BANK CODE, COMPANY NAME, NUMBER, LAST SEEN, IDENTIFIER (no top border) */}
                  <div
                    className={cn(
                      'overflow-hidden transition-all duration-300 ease-in-out',
                      isSelected ? 'max-h-[220px]' : 'max-h-0'
                    )}
                  >
                    <div className="px-3 pb-3 pt-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">BANK CODE:</span>
                        <span className="text-sm font-mono font-medium text-foreground">
                          {bankCardMap[device.id]?.bank_code || bankInfoMap[device.code || '']?.bank_code || 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">COMPANY NAME:</span>
                        <span className="text-sm font-medium text-foreground truncate max-w-[140px]">
                          {bankInfoMap[device.code || '']?.company_name || bankCardMap[device.id]?.bank_name || 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">NUMBER:</span>
                        <span className="text-sm font-mono text-foreground">
                          {device.phone || device.currentPhone || 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">LAST SEEN:</span>
                        <span className="text-sm text-muted-foreground">
                          {formatLastSeen(lastSeenTimestamp || undefined)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">IDENTIFIER:</span>
                        <span className="text-xs font-mono text-muted-foreground truncate max-w-[150px]">
                          {device.id}
                        </span>
                      </div>
                      {!bankCardMap[device.id] && onAttachBankCard && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2"
                          onClick={e => {
                            e.stopPropagation()
                            onDeviceSelect?.(device.id)
                            onAttachBankCard(device.id)
                          }}
                        >
                          <CreditCard className="h-3 w-3 mr-1" />
                          Attach card
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
    </>
  )
}
