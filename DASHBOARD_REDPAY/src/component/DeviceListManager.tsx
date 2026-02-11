import { useEffect, useState, useMemo } from 'react'
import { fetchDevices } from '@/lib/api-client'
import { getSession } from '@/lib/auth'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/component/ui/table'
import { Input } from '@/component/ui/input'
import { Button } from '@/component/ui/button'
import { Badge } from '@/component/ui/badge'
import { SearchInput } from '@/component/SearchInput'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/component/ui/select'
import { Checkbox } from '@/component/ui/checkbox'
import { Skeleton } from '@/component/ui/skeleton'
import {
  Smartphone,
  Battery,
  Activity,
  Calendar,
  Building2,
  CreditCard,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Square,
  RefreshCw,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/component/ui/dialog'
import { Label } from '@/component/ui/label'

interface DeviceInfo {
  code: string
  deviceId: string | null
  bank?: {
    bank_name?: string
    company_name?: string
    other_info?: string
  }
  bankStatus?: Record<string, string>
  metadata?: {
    name?: string
    phone?: string
    isActive?: boolean
    lastSeen?: number
    batteryPercentage?: number
    time?: number
  }
}

interface DjangoDevice {
  id: number
  device_id: string
  name?: string
  model?: string
  phone?: string
  code?: string
  is_active: boolean
  last_seen?: number | null
  battery_percentage?: number | null
  current_phone?: string
  time?: number | null
  bank_card?: {
    bank_name?: string
    account_name?: string
    card_holder_name?: string
    [key: string]: any
  }
  [key: string]: any
}

interface DeviceListManagerProps {
  onSelectDevice?: (deviceId: string) => void
  onAttachBankCard?: (deviceId: string) => void
}

type SortField = 'name' | 'status' | 'lastSeen' | 'battery' | 'code'
type SortDirection = 'asc' | 'desc'

export default function DeviceListManager({ onSelectDevice, onAttachBankCard }: DeviceListManagerProps) {
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'offline'>('all')
  const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [sortField, setSortField] = useState<SortField>('lastSeen')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set())
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Fetch devices from Django API
  const loadDevices = async () => {
    try {
      setLoading(true)
      // Get user email from session
      const session = getSession()
      const userEmail = session?.email || null
      const djangoDevices = await fetchDevices(userEmail ? { user_email: userEmail } : undefined)
      
      // Map Django devices to DeviceInfo format
      const mappedDevices: DeviceInfo[] = djangoDevices.map((device: DjangoDevice) => {
        const lastSeen = device.last_seen || device.time || null
        const batteryPercentage = device.battery_percentage ?? undefined
        const phone = device.current_phone || device.phone || undefined
        
        return {
          code: device.code || device.device_id.substring(0, 8).toUpperCase(),
          deviceId: device.device_id,
          bank: device.bank_card ? {
            bank_name: device.bank_card.bank_name,
            company_name: device.bank_card.account_name || device.bank_card.card_holder_name,
            other_info: undefined,
          } : undefined,
          bankStatus: undefined,
          metadata: {
            name: device.name || device.model || 'Unknown',
            phone: phone,
            isActive: device.is_active,
            lastSeen: lastSeen ? (typeof lastSeen === 'number' ? lastSeen : parseInt(String(lastSeen))) : undefined,
            batteryPercentage: batteryPercentage,
            time: device.time ? (typeof device.time === 'number' ? device.time : parseInt(String(device.time))) : undefined,
          },
        }
      })
      
      setDevices(mappedDevices)
    } catch (error) {
      console.error('Error fetching device list from Django:', error)
      setDevices([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDevices()
  }, [])

  const filteredAndSortedDevices = useMemo(() => {
    const devicesArray = Array.isArray(devices) ? devices : []
    let filtered = devicesArray.filter(device => {
      // Search filter
      const matchesSearch =
        !searchQuery ||
        device.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        device.deviceId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        device.bank?.bank_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        device.bank?.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        device.metadata?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        device.metadata?.phone?.includes(searchQuery)

      // Status filter
      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'active' && device.metadata?.isActive) ||
        (filterStatus === 'inactive' && !device.metadata?.isActive) ||
        (filterStatus === 'offline' &&
          device.metadata?.lastSeen &&
          Date.now() - device.metadata.lastSeen > 300000) // 5 minutes

      return matchesSearch && matchesStatus
    })

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case 'name':
          aValue = a.metadata?.name || ''
          bValue = b.metadata?.name || ''
          break
        case 'status':
          const aOnline = a.metadata?.lastSeen && Date.now() - a.metadata.lastSeen < 300000
          const bOnline = b.metadata?.lastSeen && Date.now() - b.metadata.lastSeen < 300000
          aValue = a.metadata?.isActive ? (aOnline ? 2 : 1) : 0
          bValue = b.metadata?.isActive ? (bOnline ? 2 : 1) : 0
          break
        case 'lastSeen':
          aValue = a.metadata?.lastSeen || 0
          bValue = b.metadata?.lastSeen || 0
          break
        case 'battery':
          aValue = a.metadata?.batteryPercentage ?? -1
          bValue = b.metadata?.batteryPercentage ?? -1
          break
        case 'code':
          aValue = a.code
          bValue = b.code
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [devices, searchQuery, filterStatus, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const handleSelectAll = () => {
    if (selectedDevices.size === filteredAndSortedDevices.length) {
      setSelectedDevices(new Set())
    } else {
      setSelectedDevices(new Set(filteredAndSortedDevices.map(d => d.code)))
    }
  }

  const handleSelectDevice = (code: string) => {
    const newSelected = new Set(selectedDevices)
    if (newSelected.has(code)) {
      newSelected.delete(code)
    } else {
      newSelected.add(code)
    }
    setSelectedDevices(newSelected)
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadDevices()
    setIsRefreshing(false)
  }

  const getStatusBadge = (device: DeviceInfo) => {
    if (!device.metadata?.lastSeen) {
      return <Badge variant="secondary">Unknown</Badge>
    }

    const timeSinceLastSeen = Date.now() - device.metadata.lastSeen
    const isOnline = timeSinceLastSeen < 300000 // 5 minutes

    if (!device.metadata.isActive) {
      return <Badge variant="secondary">Inactive</Badge>
    }

    if (isOnline) {
      return <Badge className="bg-green-500">Online</Badge>
    } else {
      return <Badge variant="destructive">Offline</Badge>
    }
  }

  const formatLastSeen = (timestamp?: number) => {
    if (!timestamp) return 'Never'
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  const getBatteryColor = (percentage?: number) => {
    if (percentage === undefined || percentage < 0) return 'text-gray-400'
    if (percentage > 50) return 'text-green-500'
    if (percentage > 20) return 'text-yellow-500'
    return 'text-red-500'
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3 w-3 ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 ml-1" />
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-3 border-b border-border">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          <h2 className="text-2xl font-bold">Device List</h2>
          <Badge variant="outline">{filteredAndSortedDevices.length} devices</Badge>
          {selectedDevices.size > 0 && (
            <Badge variant="secondary">{selectedDevices.size} selected</Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {selectedDevices.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">{selectedDevices.size} device(s) selected</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Bulk action: View selected devices
                const firstSelected = Array.from(selectedDevices)[0]
                const device = filteredAndSortedDevices.find(d => d.code === firstSelected)
                if (device?.deviceId) {
                  onSelectDevice?.(device.deviceId)
                }
              }}
            >
              View First
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSelectedDevices(new Set())}>
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-4">
        <div className="flex-1">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            filterMode="contains"
            onFilterModeChange={() => {}}
            placeholder="Search by code, device ID, bank, company..."
          />
        </div>
        <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortField} onValueChange={(value: any) => setSortField(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lastSeen">Last Seen</SelectItem>
            <SelectItem value="name">Device Name</SelectItem>
            <SelectItem value="status">Status</SelectItem>
            <SelectItem value="battery">Battery</SelectItem>
            <SelectItem value="code">Code</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={
                    selectedDevices.size === filteredAndSortedDevices.length &&
                    filteredAndSortedDevices.length > 0
                  }
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort('code')}
                  className="flex items-center hover:text-foreground"
                >
                  Code
                  <SortIcon field="code" />
                </button>
              </TableHead>
              <TableHead>Device ID</TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center hover:text-foreground"
                >
                  Device Name
                  <SortIcon field="name" />
                </button>
              </TableHead>
              <TableHead>Bank/Company</TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort('status')}
                  className="flex items-center hover:text-foreground"
                >
                  Status
                  <SortIcon field="status" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort('battery')}
                  className="flex items-center hover:text-foreground"
                >
                  Battery
                  <SortIcon field="battery" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort('lastSeen')}
                  className="flex items-center hover:text-foreground"
                >
                  Last Seen
                  <SortIcon field="lastSeen" />
                </button>
              </TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedDevices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Smartphone className="h-12 w-12 opacity-50" />
                    <p className="font-medium">No devices found</p>
                    <p className="text-sm">Try adjusting your search or filters</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedDevices.map(device => {
                // Check if device was last seen within 1 minute
                const isRecentlySeen =
                  device.metadata?.lastSeen && Date.now() - device.metadata.lastSeen < 60000 // 1 minute = 60000ms

                const rowClassName = [
                  selectedDevices.has(device.code) ? 'bg-muted/50' : '',
                  isRecentlySeen ? 'border-l-4 border-l-green-500' : '',
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <TableRow key={device.code} className={rowClassName}>
                    <TableCell>
                      <Checkbox
                        checked={selectedDevices.has(device.code)}
                        onCheckedChange={() => handleSelectDevice(device.code)}
                      />
                    </TableCell>
                    <TableCell className="font-mono font-medium">{device.code}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {device.deviceId ? (
                        <span
                          className="text-blue-600 cursor-pointer hover:underline"
                          onClick={() => onSelectDevice?.(device.deviceId!)}
                        >
                          {device.deviceId.substring(0, 12)}...
                        </span>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>{device.metadata?.name || 'Unknown'}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {device.bank?.bank_name && (
                          <div className="flex items-center gap-1 text-sm">
                            <Building2 className="h-3 w-3" />
                            {device.bank.bank_name}
                          </div>
                        )}
                        {device.bank?.company_name && (
                          <div className="text-xs text-muted-foreground">
                            {device.bank.company_name}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(device)}</TableCell>
                    <TableCell>
                      {device.metadata?.batteryPercentage !== undefined ? (
                        <div className="flex items-center gap-1">
                          <Battery
                            className={`h-4 w-4 ${getBatteryColor(device.metadata.batteryPercentage)}`}
                          />
                          <span className={getBatteryColor(device.metadata.batteryPercentage)}>
                            {device.metadata.batteryPercentage}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {formatLastSeen(device.metadata?.lastSeen)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedDevice(device)
                          setShowDetails(true)
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {device.deviceId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onSelectDevice?.(device.deviceId!)}
                        >
                          View
                        </Button>
                      )}
                      {device.deviceId && !device.bank && onAttachBankCard && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            onSelectDevice?.(device.deviceId!)
                            onAttachBankCard(device.deviceId!)
                          }}
                          title="Attach bank card"
                        >
                          <CreditCard className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Device Details - {selectedDevice?.code}</DialogTitle>
            <DialogDescription>Complete information about this device</DialogDescription>
          </DialogHeader>
          {selectedDevice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Activation Code</Label>
                  <div className="font-mono">{selectedDevice.code}</div>
                </div>
                <div>
                  <Label>Device ID</Label>
                  <div className="font-mono text-sm">{selectedDevice.deviceId || 'N/A'}</div>
                </div>
                <div>
                  <Label>Device Name</Label>
                  <div>{selectedDevice.metadata?.name || 'Unknown'}</div>
                </div>
                <div>
                  <Label>Phone Number</Label>
                  <div>{selectedDevice.metadata?.phone || 'N/A'}</div>
                </div>
                <div>
                  <Label>Status</Label>
                  <div>{getStatusBadge(selectedDevice)}</div>
                </div>
                <div>
                  <Label>Battery Level</Label>
                  <div>
                    {selectedDevice.metadata?.batteryPercentage !== undefined
                      ? `${selectedDevice.metadata.batteryPercentage}%`
                      : 'N/A'}
                  </div>
                </div>
                <div>
                  <Label>Last Seen</Label>
                  <div>{formatLastSeen(selectedDevice.metadata?.lastSeen)}</div>
                </div>
                <div>
                  <Label>Is Active</Label>
                  <div>{selectedDevice.metadata?.isActive ? 'Yes' : 'No'}</div>
                </div>
              </div>

              {selectedDevice.bank && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-2">Bank Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Bank Name</Label>
                      <div>{selectedDevice.bank.bank_name || 'N/A'}</div>
                    </div>
                    <div>
                      <Label>Company Name</Label>
                      <div>{selectedDevice.bank.company_name || 'N/A'}</div>
                    </div>
                    <div className="col-span-2">
                      <Label>Other Info</Label>
                      <div>{selectedDevice.bank.other_info || 'N/A'}</div>
                    </div>
                  </div>
                </div>
              )}

              {selectedDevice.bankStatus && Object.keys(selectedDevice.bankStatus).length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-2">Bank Status</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(selectedDevice.bankStatus).map(([status, color]) => (
                      <Badge key={status} style={{ backgroundColor: color }}>
                        {status}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {!selectedDevice.bank && selectedDevice.deviceId && onAttachBankCard && (
                <div className="border-t pt-4 flex justify-end">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      setShowDetails(false)
                      onSelectDevice?.(selectedDevice.deviceId!)
                      onAttachBankCard(selectedDevice.deviceId!)
                    }}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Attach bank card
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
