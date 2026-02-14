import { useEffect, useState } from 'react'
import { 
  fetchDevices, 
  fetchCompanies, 
  allocateDevicesToCompany, 
  unallocateDevicesFromCompany,
  type Company 
} from '@/lib/api-client'
import { getSession } from '@/lib/auth'
import { useToast } from '@/lib/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/component/ui/card'
import { Button } from '@/component/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/component/ui/table'
import { Checkbox } from '@/component/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/component/ui/select'
import { Skeleton } from '@/component/ui/skeleton'
import { Badge } from '@/component/ui/badge'
import { Building2, RefreshCw, Loader, Smartphone, Filter } from 'lucide-react'

interface DeviceRow {
  device_id: string
  code: string
  name: string
  last_seen?: number | null
  company_code?: string
  company_name?: string
}

export function DeviceSectionAssignmentPanel() {
  const { toast } = useToast()
  const [companies, setCompanies] = useState<Company[]>([])
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCompanyCode, setSelectedCompanyCode] = useState<string>('')
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set())
  const [allocating, setAllocating] = useState(false)
  const [unallocating, setUnallocating] = useState(false)
  const [companyFilter, setCompanyFilter] = useState<string>('all')
  const session = getSession()
  const adminEmail = session?.email ?? ''

  const loadData = async () => {
    if (!adminEmail) return
    setLoading(true)
    try {
      const [companiesList, devicesList] = await Promise.all([
        fetchCompanies(),
        fetchDevices({ user_email: adminEmail }),
      ])
      setCompanies(companiesList.filter(c => c.is_active))
      setDevices(
        (devicesList || []).map((d: any) => ({
          device_id: d.device_id,
          code: d.code || d.device_id?.slice(0, 8)?.toUpperCase() || '-',
          name: d.name || d.model || d.device_id || '-',
          last_seen: d.last_seen ?? d.time,
          company_code: d.company_code || d.company?.code,
          company_name: d.company_name || d.company?.name,
        }))
      )
      if (!selectedCompanyCode && companiesList.filter(c => c.is_active).length > 0) {
        setSelectedCompanyCode(companiesList.filter(c => c.is_active)[0].code)
      }
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to load data',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [adminEmail])

  const handleAllocate = async () => {
    if (!selectedCompanyCode || selectedDeviceIds.size === 0) return
    setAllocating(true)
    try {
      const { allocated_count } = await allocateDevicesToCompany(
        adminEmail,
        selectedCompanyCode,
        Array.from(selectedDeviceIds)
      )
      toast({ 
        title: 'Success', 
        description: `Allocated ${allocated_count} device(s) to ${selectedCompanyCode}` 
      })
      setSelectedDeviceIds(new Set())
      await loadData()
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to allocate devices to company',
        variant: 'destructive',
      })
    } finally {
      setAllocating(false)
    }
  }

  const handleUnallocate = async () => {
    if (!selectedCompanyCode || selectedDeviceIds.size === 0) return
    setUnallocating(true)
    try {
      const { unallocated_count } = await unallocateDevicesFromCompany(
        adminEmail,
        selectedCompanyCode,
        Array.from(selectedDeviceIds)
      )
      toast({ 
        title: 'Success', 
        description: `Unallocated ${unallocated_count} device(s) from ${selectedCompanyCode}` 
      })
      setSelectedDeviceIds(new Set())
      await loadData()
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to unallocate devices from company',
        variant: 'destructive',
      })
    } finally {
      setUnallocating(false)
    }
  }

  const toggleDevice = (deviceId: string) => {
    setSelectedDeviceIds(prev => {
      const next = new Set(prev)
      if (next.has(deviceId)) next.delete(deviceId)
      else next.add(deviceId)
      return next
    })
  }

  const toggleAll = () => {
    const filteredDevices = getFilteredDevices()
    if (selectedDeviceIds.size === filteredDevices.length && filteredDevices.length > 0) {
      setSelectedDeviceIds(new Set())
    } else {
      setSelectedDeviceIds(new Set(filteredDevices.map(d => d.device_id)))
    }
  }

  const getFilteredDevices = () => {
    if (companyFilter === 'all') return devices
    if (companyFilter === 'unallocated') return devices.filter(d => !d.company_code)
    return devices.filter(d => d.company_code === companyFilter)
  }

  const filteredDevices = getFilteredDevices()

  if (!adminEmail) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Please log in to manage device allocations.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="p-5 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              Allocate devices to company
            </CardTitle>
            <CardDescription>
              Select a company and devices, then allocate or unallocate. All users in the company will see allocated devices.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-0 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 min-w-[200px]">
            <span className="text-sm font-medium">Company:</span>
            <Select value={selectedCompanyCode} onValueChange={setSelectedCompanyCode}>
              <SelectTrigger>
                <SelectValue placeholder="Select company" />
              </SelectTrigger>
              <SelectContent>
                {companies.map(c => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 min-w-[180px]">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filter:</span>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All devices</SelectItem>
                <SelectItem value="unallocated">Unallocated</SelectItem>
                {companies.map(c => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name} only
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedCompanyCode && (
            <>
              <Button
                size="sm"
                onClick={handleAllocate}
                disabled={selectedDeviceIds.size === 0 || allocating}
              >
                {allocating ? <Loader className="h-4 w-4 animate-spin mr-2" /> : <Building2 className="h-4 w-4 mr-2" />}
                Allocate to {selectedCompanyCode} ({selectedDeviceIds.size})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUnallocate}
                disabled={selectedDeviceIds.size === 0 || unallocating}
              >
                {unallocating ? <Loader className="h-4 w-4 animate-spin mr-2" /> : <Building2 className="h-4 w-4 mr-2" />}
                Unallocate selected
              </Button>
            </>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : filteredDevices.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center">
            {companyFilter === 'unallocated' 
              ? 'No unallocated devices found.' 
              : companyFilter !== 'all'
              ? `No devices found for ${companies.find(c => c.code === companyFilter)?.name || companyFilter}.`
              : 'No devices found.'}
          </p>
        ) : (
          <div className="border rounded-md overflow-auto max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedDeviceIds.size === filteredDevices.length && filteredDevices.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Last seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDevices.map(d => (
                  <TableRow key={d.device_id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedDeviceIds.has(d.device_id)}
                        onCheckedChange={() => toggleDevice(d.device_id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono">{d.code}</TableCell>
                    <TableCell>{d.name}</TableCell>
                    <TableCell>
                      {d.company_code ? (
                        <Badge variant="default">{d.company_name || d.company_code}</Badge>
                      ) : (
                        <Badge variant="secondary">Unallocated</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {d.last_seen
                        ? new Date(d.last_seen).toLocaleString()
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
