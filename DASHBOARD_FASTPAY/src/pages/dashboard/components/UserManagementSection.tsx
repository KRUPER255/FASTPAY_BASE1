import { useEffect, useState } from 'react'
import {
  fetchDashboardUsers,
  createDashboardUser,
  updateDashboardUser,
  type DashboardUser,
} from '@/lib/api-client'
import { getSession } from '@/lib/auth'
import { useToast } from '@/lib/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/component/ui/card'
import { Button } from '@/component/ui/button'
import { Input } from '@/component/ui/input'
import { Label } from '@/component/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/component/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/component/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/component/ui/select'
import { Badge } from '@/component/ui/badge'
import { Skeleton } from '@/component/ui/skeleton'
import { UserPlus, Pencil, RefreshCw, Loader } from 'lucide-react'

const ACCESS_LEVEL_LABELS: Record<number, string> = {
  0: 'Admin',
  1: 'Manager',
  2: 'Viewer',
}

function CreateUserDialog({
  open,
  onOpenChange,
  adminEmail,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  adminEmail: string
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [accessLevel, setAccessLevel] = useState<number>(2)
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setEmail('')
    setPassword('')
    setFullName('')
    setAccessLevel(2)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      toast({ title: 'Validation', description: 'Email and password are required', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      await createDashboardUser(adminEmail, {
        email: email.trim(),
        password,
        full_name: fullName.trim() || undefined,
        access_level: accessLevel,
      })
      toast({ title: 'Success', description: 'User created successfully' })
      reset()
      onOpenChange(false)
      onSuccess()
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to create user',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogClose onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>Add a new dashboard user. They can log in with email and password.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="create-email">Email</Label>
            <Input
              id="create-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
            />
          </div>
          <div>
            <Label htmlFor="create-password">Password</Label>
            <Input
              id="create-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <div>
            <Label htmlFor="create-full-name">Full name (optional)</Label>
            <Input
              id="create-full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
            />
          </div>
          <div>
            <Label>Access level</Label>
            <Select value={String(accessLevel)} onValueChange={(v) => setAccessLevel(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Manager</SelectItem>
                <SelectItem value="2">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader className="h-4 w-4 animate-spin" /> : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditUserDialog({
  open,
  onOpenChange,
  adminEmail,
  user,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  adminEmail: string
  user: DashboardUser | null
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const [fullName, setFullName] = useState('')
  const [accessLevel, setAccessLevel] = useState<number>(2)
  const [statusVal, setStatusVal] = useState<string>('active')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (user) {
      setFullName(user.full_name ?? '')
      setAccessLevel(user.access_level)
      setStatusVal(user.status ?? 'active')
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSubmitting(true)
    try {
      await updateDashboardUser(adminEmail, user.email, {
        full_name: fullName.trim() || undefined,
        access_level: accessLevel,
        status: statusVal,
      })
      toast({ title: 'Success', description: 'User updated successfully' })
      onOpenChange(false)
      onSuccess()
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to update user',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogClose onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>
            {user ? `Editing: ${user.email}` : ''}
          </DialogDescription>
        </DialogHeader>
        {user && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input value={user.email} disabled className="opacity-70" />
            </div>
            <div>
              <Label htmlFor="edit-full-name">Full name (optional)</Label>
              <Input
                id="edit-full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label>Access level</Label>
              <Select value={String(accessLevel)} onValueChange={(v) => setAccessLevel(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Admin</SelectItem>
                  <SelectItem value="1">Manager</SelectItem>
                  <SelectItem value="2">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={statusVal} onValueChange={setStatusVal}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader className="h-4 w-4 animate-spin" /> : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function UserManagementSection() {
  const { toast } = useToast()
  const [users, setUsers] = useState<DashboardUser[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editUser, setEditUser] = useState<DashboardUser | null>(null)
  const session = getSession()
  const adminEmail = session?.email ?? ''

  const loadUsers = async () => {
    if (!adminEmail) return
    setLoading(true)
    try {
      const list = await fetchDashboardUsers(adminEmail)
      setUsers(list)
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to load users',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [adminEmail])

  const openEdit = (user: DashboardUser) => {
    setEditUser(user)
    setEditOpen(true)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Dashboard users</CardTitle>
            <CardDescription>Create and manage dashboard users and their access levels.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadUsers} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <UserPlus className="h-4 w-4 mr-1" />
              Create user
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Full name</TableHead>
                <TableHead>Access level</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Devices</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.email}>
                  <TableCell className="font-medium">{u.email}</TableCell>
                  <TableCell>{u.full_name ?? '-'}</TableCell>
                  <TableCell>{ACCESS_LEVEL_LABELS[u.access_level] ?? u.access_level}</TableCell>
                  <TableCell>
                    <Badge variant={u.status === 'active' ? 'default' : 'secondary'}>{u.status}</Badge>
                  </TableCell>
                  <TableCell>{u.assigned_device_count}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title="Edit user">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!loading && users.length === 0 && (
          <p className="text-muted-foreground text-center py-8">No users yet. Create one to get started.</p>
        )}
      </CardContent>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        adminEmail={adminEmail}
        onSuccess={loadUsers}
      />
      <EditUserDialog
        open={editOpen}
        onOpenChange={(v) => {
          setEditOpen(v)
          if (!v) setEditUser(null)
        }}
        adminEmail={adminEmail}
        user={editUser}
        onSuccess={loadUsers}
      />
    </Card>
  )
}
