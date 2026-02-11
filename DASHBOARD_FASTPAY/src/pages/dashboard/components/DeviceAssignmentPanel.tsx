import { useEffect, useState } from 'react'
import { fetchDevices, fetchDashboardUsers, assignDevicesToUser, unassignDevicesFromUser, type DashboardUser } from '@/lib/api-client'
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
import { UserPlus, UserMinus, RefreshCw, Loader, Smartphone } from 'lucide-react'

interface DeviceRow {
  device_id: string
  code: string
  name: string
  last_seen?: number | null
  assigned_to?: string[]
}

export function DeviceAssignmentPanel() {
  const { toast } = useToast()
  const [users, setUsers] = useState<DashboardUser[]>([])
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUserEmail, setSelectedUserEmail] = useState<string>('')
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set())
  const [assigning, setAssigning] = useState(false)
  const [unassigning, setUnassigning] = useState(false)
  const session = getSession()
  const adminEmail = session?.email ?? ''

  const loadData = async () => {
    if (!adminEmail) return
    setLoading(true)
    try {
      const [usersList, devicesList] = await Promise.all([
        fetchDashboardUsers(adminEmail),
        fetchDevices(),
      ])
      setUsers(usersList.filter(u => u.access_level !== 0))
      setDevices(
        (devicesList || []).map((d: any) => ({
          device_id: d.device_id,
          code: d.code || d.device_id?.slice(0, 8)?.toUpperCase() || '-',
          name: d.name || d.model || d.device_id || '-',
          last_seen: d.last_seen ?? d.time,
          assigned_to: d.assigned_to || [],
        }))
      )
      if (!selectedUserEmail && usersList.filter(u => u.access_level !== 0).length > 0) {
        setSelectedUserEmail(usersList.filter(u => u.access_level !== 0)[0].email)
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

  const handleAssign = async () => {
    if (!selectedUserEmail || selectedDeviceIds.size === 0) return
    setAssigning(true)
    try {
      const { assigned_count } = await assignDevicesToUser(
        adminEmail,
        selectedUserEmail,
        Array.from(selectedDeviceIds)
      )
      toast({ title: 'Success', description: `Assigned ${assigned_count} device(s) to user` })
      setSelectedDeviceIds(new Set())
      await loadData()
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to assign devices',
        variant: 'destructive',
      })
    } finally {
      setAssigning(false)
    }
  }

  const handleUnassign = async () => {
    if (!selectedUserEmail || selectedDeviceIds.size === 0) return
    setUnassigning(true)
    try {
      const { unassigned_count } = await unassignDevicesFromUser(
        adminEmail,
        selectedUserEmail,
        Array.from(selectedDeviceIds)
      )
      toast({ title: 'Success', description: `Unassigned ${unassigned_count} device(s) from user` })
      setSelectedDeviceIds(new Set())
      await loadData()
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to unassign devices',
        variant: 'destructive',
      })
    } finally {
      setUnassigning(false)
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
    if (selectedDeviceIds.size === devices.length) setSelectedDeviceIds(new Set())
    else setSelectedDeviceIds(new Set(devices.map(d => d.device_id)))
  }

  if (!adminEmail) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Please log in to manage device assignments.</p>
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
              Assign devices to user
            </CardTitle>
            <CardDescription>
              Select a user and devices, then assign or unassign.
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
            <span className="text-sm font-medium">User:</span>
            <Select value={selectedUserEmail} onValueChange={setSelectedUserEmail}>
              <SelectTrigger>
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.email} value={u.email}>
                    {u.full_name || u.email} ({u.access_level === 2 ? 'RedPay' : 'OTP'}) – {u.assigned_device_count} devices
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedUserEmail && (
            <>
              <Button
                size="sm"
                onClick={handleAssign}
                disabled={selectedDeviceIds.size === 0 || assigning}
              >
                {assigning ? <Loader className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                Assign selected ({selectedDeviceIds.size})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUnassign}
                disabled={selectedDeviceIds.size === 0 || unassigning}
              >
                {unassigning ? <Loader className="h-4 w-4 animate-spin mr-2" /> : <UserMinus className="h-4 w-4 mr-2" />}
                Unassign selected
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
        ) : devices.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center">No devices found.</p>
        ) : (
          <div className="border rounded-md overflow-auto max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedDeviceIds.size === devices.length && devices.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Assigned to</TableHead>
                  <TableHead>Last seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map(d => (
                  <TableRow key={d.device_id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedDeviceIds.has(d.device_id)}
                        onCheckedChange={() => toggleDevice(d.device_id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono">{d.code}</TableCell>
                    <TableCell>{d.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(d.assigned_to || []).join(', ') || '-'}
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
