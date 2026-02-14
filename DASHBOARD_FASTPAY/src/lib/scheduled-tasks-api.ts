/**
 * Scheduled Tasks (Celery Beat) API Client
 * For creating and managing periodic tasks, including Telegram auto messages.
 */

import { getApiUrl } from './api-client'

export interface IntervalSchedule {
  id: number
  every: number
  period: string
}

export interface CrontabSchedule {
  id: number
  minute: string
  hour: string
  day_of_week: string
  day_of_month: string
  month_of_year: string
}

export interface PeriodicTask {
  id: number
  name: string
  task: string
  enabled: boolean
  args: string
  kwargs: string
  description: string
  last_run_at: string | null
  total_run_count: number
  date_changed: string
  interval: IntervalSchedule | null
  crontab: CrontabSchedule | null
  schedule_type: 'interval' | 'crontab' | 'unknown'
  schedule_display: string
}

export interface PeriodicTaskCreate {
  name: string
  task: string
  enabled?: boolean
  args?: string
  kwargs?: string
  description?: string
  schedule_type: 'interval' | 'crontab'
  interval_every?: number
  interval_period?: 'seconds' | 'minutes' | 'hours' | 'days'
  crontab_minute?: string
  crontab_hour?: string
  crontab_day_of_week?: string
  crontab_day_of_month?: string
  crontab_month_of_year?: string
}

export interface AvailableTasksResponse {
  tasks: string[]
  grouped: Record<string, string[]>
  count: number
}

export interface TaskRunResponse {
  task_id: string
  status: string
  task_name: string
}

async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = getApiUrl(endpoint)
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || errorData.detail || `API error: ${response.status}`)
  }
  if (response.status === 204) return undefined as T
  return response.json()
}

export async function fetchAvailableTasks(): Promise<AvailableTasksResponse> {
  return apiCall<AvailableTasksResponse>('/available-tasks/')
}

export async function fetchScheduledTasks(): Promise<{ results: PeriodicTask[] }> {
  const data = await apiCall<{ results?: PeriodicTask[]; count?: number; next?: string; previous?: string }>(
    '/scheduled-tasks/'
  )
  if (Array.isArray((data as any).results)) return data as { results: PeriodicTask[] }
  if (Array.isArray(data)) return { results: data as PeriodicTask[] }
  return { results: [] }
}

export async function createScheduledTask(payload: PeriodicTaskCreate): Promise<PeriodicTask> {
  return apiCall<PeriodicTask>('/scheduled-tasks/', {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name,
      task: payload.task,
      enabled: payload.enabled ?? true,
      args: payload.args ?? '[]',
      kwargs: payload.kwargs ?? '{}',
      description: payload.description ?? '',
      schedule_type: payload.schedule_type,
      interval_every: payload.interval_every,
      interval_period: payload.interval_period ?? 'minutes',
      crontab_minute: payload.crontab_minute ?? '*',
      crontab_hour: payload.crontab_hour ?? '*',
      crontab_day_of_week: payload.crontab_day_of_week ?? '*',
      crontab_day_of_month: payload.crontab_day_of_month ?? '*',
      crontab_month_of_year: payload.crontab_month_of_year ?? '*',
    }),
  })
}

export async function updateScheduledTask(id: number, payload: Partial<PeriodicTaskCreate>): Promise<PeriodicTask> {
  return apiCall<PeriodicTask>(`/scheduled-tasks/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteScheduledTask(id: number): Promise<void> {
  await apiCall(`/scheduled-tasks/${id}/`, { method: 'DELETE' })
}

export async function runScheduledTask(id: number): Promise<TaskRunResponse> {
  return apiCall<TaskRunResponse>(`/scheduled-tasks/${id}/run/`, { method: 'POST' })
}

export async function toggleScheduledTask(id: number): Promise<PeriodicTask> {
  return apiCall<PeriodicTask>(`/scheduled-tasks/${id}/toggle/`, { method: 'POST' })
}
