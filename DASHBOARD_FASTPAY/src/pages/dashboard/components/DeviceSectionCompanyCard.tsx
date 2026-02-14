import { useEffect, useState } from 'react'
import {
  fetchCompanies,
  allocateDevicesToCompany,
  unallocateDevicesFromCompany,
  type Company,
} from '@/lib/api-client'
import { getSession } from '@/lib/auth'
import { useToast } from '@/lib/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/component/ui/card'
import { Button } from '@/component/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/component/ui/select'
import { Badge } from '@/component/ui/badge'
import { Building2, Loader } from 'lucide-react'

interface DeviceSectionCompanyCardProps {
  deviceId: string
  currentCompanyCode?: string | null
  onAllocationChange?: () => void
}

export function DeviceSectionCompanyCard({
  deviceId,
  currentCompanyCode,
  onAllocationChange,
}: DeviceSectionCompanyCardProps) {
  const { toast } = useToast()
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanyCode, setSelectedCompanyCode] = useState<string>('')
  const [loadingCompanies, setLoadingCompanies] = useState(true)
  const [allocating, setAllocating] = useState(false)
  const [unallocating, setUnallocating] = useState(false)
  const session = getSession()
  const adminEmail = session?.email ?? ''

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoadingCompanies(true)
      try {
        const list = await fetchCompanies()
        if (mounted) {
          setCompanies(list.filter(c => c.is_active))
          if (!selectedCompanyCode && list.filter(c => c.is_active).length > 0) {
            setSelectedCompanyCode(list.filter(c => c.is_active)[0].code)
          }
        }
      } catch (e) {
        if (mounted) {
          toast({
            title: 'Error',
            description: e instanceof Error ? e.message : 'Failed to load companies',
            variant: 'destructive',
          })
        }
      } finally {
        if (mounted) setLoadingCompanies(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const handleAssign = async () => {
    if (!adminEmail || !selectedCompanyCode) return
    setAllocating(true)
    try {
      const { allocated_count } = await allocateDevicesToCompany(adminEmail, selectedCompanyCode, [deviceId])
      toast({
        title: 'Success',
        description: `Device allocated to ${selectedCompanyCode}`,
      })
      onAllocationChange?.()
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to allocate device to company',
        variant: 'destructive',
      })
    } finally {
      setAllocating(false)
    }
  }

  const handleUnassign = async () => {
    if (!adminEmail || !currentCompanyCode) return
    setUnallocating(true)
    try {
      const { unallocated_count } = await unallocateDevicesFromCompany(adminEmail, currentCompanyCode, [deviceId])
      toast({
        title: 'Success',
        description: 'Device unallocated from company',
      })
      onAllocationChange?.()
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to unallocate device',
        variant: 'destructive',
      })
    } finally {
      setUnallocating(false)
    }
  }

  if (!adminEmail) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-sm">Please log in to manage company allocation.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="p-5 pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Company allocation
        </CardTitle>
        <CardDescription>
          Assign this device to one of the companies. Users in that company will see this device.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5 pt-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Current:</span>
          <Badge variant={currentCompanyCode ? 'default' : 'secondary'}>
            {currentCompanyCode || 'Unallocated'}
          </Badge>
        </div>
        {loadingCompanies ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader className="h-4 w-4 animate-spin" />
            Loading companies…
          </div>
        ) : (
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
            <Button
              size="sm"
              onClick={handleAssign}
              disabled={!selectedCompanyCode || allocating || selectedCompanyCode === currentCompanyCode}
            >
              {allocating ? <Loader className="h-4 w-4 animate-spin mr-2" /> : <Building2 className="h-4 w-4 mr-2" />}
              Assign to company
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleUnassign}
              disabled={!currentCompanyCode || unallocating}
            >
              {unallocating ? <Loader className="h-4 w-4 animate-spin mr-2" /> : null}
              Unassign
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
