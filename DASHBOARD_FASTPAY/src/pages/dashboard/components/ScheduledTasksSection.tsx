import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/component/ui/card'
import { Button } from '@/component/ui/button'
import { Input } from '@/component/ui/input'
import { Label } from '@/component/ui/label'
import { Textarea } from '@/component/ui/textarea'
import { Badge } from '@/component/ui/badge'
import { Skeleton } from '@/component/ui/skeleton'
import { useToast } from '@/lib/use-toast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/component/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/component/ui/dialog'
import { Clock, Plus, Play, Trash2, Power, Loader } from 'lucide-react'
import {
  fetchAvailableTasks,
  fetchScheduledTasks,
  createScheduledTask,
  deleteScheduledTask,
  runScheduledTask,
  toggleScheduledTask,
  type PeriodicTask,
  type PeriodicTaskCreate,
} from '@/lib/scheduled-tasks-api'

const TELEGRAM_TASK = 'api.tasks.send_telegram_message_async'

interface ScheduledTasksSectionProps {
  isAdmin: boolean
}

export function ScheduledTasksSection({ isAdmin }: ScheduledTasksSectionProps) {
  const { toast } = useToast()
  const [tasks, setTasks] = useState<PeriodicTask[]>([])
  const [availableTaskNames, setAvailableTaskNames] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [runningId, setRunningId] = useState<number | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const [form, setForm] = useState<PeriodicTaskCreate>({
    name: '',
    task: TELEGRAM_TASK,
    enabled: true,
    args: '[]',
    kwargs: '{"text": "Scheduled message", "bot_name": "alerts"}',
    description: '',
    schedule_type: 'interval',
    interval_every: 60,
    interval_period: 'minutes',
    crontab_minute: '*',
    crontab_hour: '*',
    crontab_day_of_week: '*',
    crontab_day_of_month: '*',
    crontab_month_of_year: '*',
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [availableRes, scheduledRes] = await Promise.all([
        fetchAvailableTasks(),
        fetchScheduledTasks(),
      ])
      setAvailableTaskNames(availableRes.tasks || [])
      setTasks(scheduledRes.results || [])
    } catch (error) {
      console.error('Failed to load scheduled tasks:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load scheduled tasks',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Validation', description: 'Name is required', variant: 'destructive' })
      return
    }
    if (!form.task) {
      toast({ title: 'Validation', description: 'Task is required', variant: 'destructive' })
      return
    }
    if (form.schedule_type === 'interval' && !form.interval_every) {
      toast({ title: 'Validation', description: 'Interval value is required', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await createScheduledTask(form)
      toast({ title: 'Created', description: 'Scheduled task created successfully' })
      setShowCreateDialog(false)
      setForm({
        name: '',
        task: TELEGRAM_TASK,
        enabled: true,
        args: '[]',
        kwargs: '{"text": "Scheduled message", "bot_name": "alerts"}',
        description: '',
        schedule_type: 'interval',
        interval_every: 60,
        interval_period: 'minutes',
        crontab_minute: '*',
        crontab_hour: '*',
        crontab_day_of_week: '*',
        crontab_day_of_month: '*',
        crontab_month_of_year: '*',
      })
      loadData()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create task',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleRun = async (id: number) => {
    setRunningId(id)
    try {
      await runScheduledTask(id)
      toast({ title: 'Triggered', description: 'Task has been queued to run' })
      loadData()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to run task',
        variant: 'destructive',
      })
    } finally {
      setRunningId(null)
    }
  }

  const handleToggle = async (id: number) => {
    setTogglingId(id)
    try {
      await toggleScheduledTask(id)
      toast({ title: 'Updated', description: 'Task enabled/disabled' })
      loadData()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to toggle task',
        variant: 'destructive',
      })
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteScheduledTask(id)
      toast({ title: 'Deleted', description: 'Scheduled task removed' })
      loadData()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete task',
        variant: 'destructive',
      })
    }
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Scheduled tasks
          </CardTitle>
          <CardDescription>Only administrators can manage scheduled tasks and auto messages.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Scheduled tasks
            </CardTitle>
            <CardDescription>
              Create periodic tasks (e.g. Telegram auto messages). Use task &quot;send_telegram_message_async&quot; with kwargs like {`{"text", "bot_name"}`}.
            </CardDescription>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add task
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : tasks.length === 0 ? (
            <p className="text-muted-foreground text-sm">No scheduled tasks. Create one to send recurring Telegram messages.</p>
          ) : (
            <ul className="space-y-3">
              {tasks.map((task) => (
                <li
                  key={task.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{task.name}</span>
                      {!task.enabled && <Badge variant="secondary">Disabled</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{task.task}</p>
                    <p className="text-xs text-muted-foreground">{task.schedule_display}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRun(task.id)}
                      disabled={runningId === task.id}
                    >
                      {runningId === task.id ? <Loader className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggle(task.id)}
                      disabled={togglingId === task.id}
                    >
                      {togglingId === task.id ? <Loader className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(task.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create scheduled task</DialogTitle>
            <DialogDescription>
              For Telegram auto messages, choose &quot;send_telegram_message_async&quot; and set kwargs to e.g. {`{"text": "Hello", "bot_name": "alerts"}`}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input
                placeholder="e.g. Daily Telegram digest"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Task</Label>
              <Select
                value={form.task}
                onValueChange={(v) => setForm((f) => ({ ...f, task: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableTaskNames
                    .filter((t) => t.includes('telegram') || t.includes('api.tasks'))
                    .concat(availableTaskNames.filter((t) => !t.includes('telegram') && !t.includes('api.tasks')))
                    .filter((t, i, a) => a.indexOf(t) === i)
                    .slice(0, 50)
                    .map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Schedule type</Label>
              <Select
                value={form.schedule_type}
                onValueChange={(v: 'interval' | 'crontab') => setForm((f) => ({ ...f, schedule_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="interval">Interval</SelectItem>
                  <SelectItem value="crontab">Crontab</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.schedule_type === 'interval' && (
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-2">
                  <Label>Every</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.interval_every ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, interval_every: parseInt(e.target.value, 10) || undefined }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Period</Label>
                  <Select
                    value={form.interval_period ?? 'minutes'}
                    onValueChange={(v: 'seconds' | 'minutes' | 'hours' | 'days') => setForm((f) => ({ ...f, interval_period: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seconds">Seconds</SelectItem>
                      <SelectItem value="minutes">Minutes</SelectItem>
                      <SelectItem value="hours">Hours</SelectItem>
                      <SelectItem value="days">Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {form.schedule_type === 'crontab' && (
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-2">
                  <Label>Minute</Label>
                  <Input
                    placeholder="*"
                    value={form.crontab_minute ?? '*'}
                    onChange={(e) => setForm((f) => ({ ...f, crontab_minute: e.target.value || '*' }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Hour</Label>
                  <Input
                    placeholder="*"
                    value={form.crontab_hour ?? '*'}
                    onChange={(e) => setForm((f) => ({ ...f, crontab_hour: e.target.value || '*' }))}
                  />
                </div>
              </div>
            )}
            <div className="grid gap-2">
              <Label>Kwargs (JSON)</Label>
              <Textarea
                rows={3}
                className="font-mono text-sm"
                placeholder='{"text": "Message", "bot_name": "alerts"}'
                value={form.kwargs ?? '{}'}
                onChange={(e) => setForm((f) => ({ ...f, kwargs: e.target.value || '{}' }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? <Loader className="h-4 w-4 animate-spin mr-2" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
