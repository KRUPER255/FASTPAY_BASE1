/**
 * Telegram Bot API Client
 * Handles API calls to the Django backend for Telegram bot management
 */

import { getApiUrl } from './api-client'

// Types
export interface TelegramBot {
  id: number
  name: string
  token: string
  masked_token: string
  chat_ids: string[]
  chat_type: 'personal' | 'group' | 'supergroup' | 'channel'
  chat_type_display: string
  message_thread_id: number | null
  chat_title: string | null
  chat_username: string | null
  bot_username: string | null
  description: string | null
  is_active: boolean
  last_used_at: string | null
  message_count: number
  created_at: string
  updated_at: string
}

export interface TelegramBotListItem {
  id: number
  name: string
  description: string | null
  chat_type: string
  chat_type_display: string
  chat_title: string | null
  is_active: boolean
}

export interface TelegramBotCreate {
  name: string
  token: string
  chat_ids?: string[]
  chat_type?: 'personal' | 'group' | 'supergroup' | 'channel'
  message_thread_id?: number | null
  chat_title?: string | null
  chat_username?: string | null
  description?: string | null
  is_active?: boolean
}

export interface TelegramBotUpdate extends Partial<TelegramBotCreate> {}

export interface ValidateTokenResponse {
  valid: boolean
  bot?: {
    id: number
    username: string
    first_name: string
    can_join_groups: boolean
    can_read_all_group_messages: boolean
  }
  links?: {
    start_chat: string | null
    add_to_group: string | null
  }
  error?: string
  next_steps?: string[]
}

export interface DiscoveredChat {
  chat_id: string
  type: string
  title: string
  username: string | null
}

export interface DiscoverChatsResponse {
  chats_found: number
  chats: DiscoveredChat[]
  hint: string
  error?: string
}

export interface LookupChatResponse {
  success: boolean
  chat?: {
    chat_id: string
    type: string
    title: string
    username: string | null
    description: string | null
  }
  hint?: string
  error?: string
}

export interface TestMessageResponse {
  bot_name: string
  chat_type: string
  overall_success: boolean
  partial_success: boolean
  results: Array<{
    chat_id: string
    success: boolean
    message_id?: number
    error?: string
  }>
}

export interface SyncInfoResponse {
  success: boolean
  updates: Record<string, string>
  errors: string[] | null
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// Helper function for API calls
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = getApiUrl(endpoint)
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || errorData.detail || `API error: ${response.status}`)
  }

  return response.json()
}

// API Functions

/**
 * List all Telegram bots
 */
export async function listTelegramBots(params?: {
  dropdown?: boolean
  is_active?: boolean
  chat_type?: string
  name?: string
}): Promise<PaginatedResponse<TelegramBot | TelegramBotListItem>> {
  const searchParams = new URLSearchParams()
  
  if (params?.dropdown) searchParams.set('dropdown', 'true')
  if (params?.is_active !== undefined) searchParams.set('is_active', String(params.is_active))
  if (params?.chat_type) searchParams.set('chat_type', params.chat_type)
  if (params?.name) searchParams.set('name', params.name)
  
  const query = searchParams.toString()
  const endpoint = `/telegram-bots/${query ? `?${query}` : ''}`
  
  return apiCall<PaginatedResponse<TelegramBot | TelegramBotListItem>>(endpoint)
}

/**
 * Get a single Telegram bot by ID
 */
export async function getTelegramBot(id: number): Promise<TelegramBot> {
  return apiCall<TelegramBot>(`/telegram-bots/${id}/`)
}

/**
 * Create a new Telegram bot
 */
export async function createTelegramBot(data: TelegramBotCreate): Promise<TelegramBot> {
  return apiCall<TelegramBot>('/telegram-bots/', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * Update a Telegram bot
 */
export async function updateTelegramBot(id: number, data: TelegramBotUpdate): Promise<TelegramBot> {
  return apiCall<TelegramBot>(`/telegram-bots/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

/**
 * Delete a Telegram bot
 */
export async function deleteTelegramBot(id: number): Promise<void> {
  const url = getApiUrl(`/telegram-bots/${id}/`)
  const response = await fetch(url, { method: 'DELETE' })
  
  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to delete bot: ${response.status}`)
  }
}

/**
 * Validate a bot token (standalone, before saving)
 */
export async function validateToken(token: string): Promise<ValidateTokenResponse> {
  return apiCall<ValidateTokenResponse>('/telegram/validate-token/', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

/**
 * Validate a saved bot's token
 */
export async function validateBotToken(id: number): Promise<ValidateTokenResponse & { updated?: boolean }> {
  return apiCall<ValidateTokenResponse & { updated?: boolean }>(`/telegram-bots/${id}/validate/`, {
    method: 'POST',
  })
}

/**
 * Discover chats using just a token
 */
export async function discoverChatsByToken(token: string): Promise<DiscoverChatsResponse> {
  return apiCall<DiscoverChatsResponse>('/telegram/discover-chats/', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

/**
 * Discover chats for a saved bot
 */
export async function discoverBotChats(id: number): Promise<DiscoverChatsResponse & { bot_name: string }> {
  return apiCall<DiscoverChatsResponse & { bot_name: string }>(`/telegram-bots/${id}/discover-chats/`)
}

/**
 * Lookup a chat by username using just a token
 */
export async function lookupChatByToken(token: string, username: string): Promise<LookupChatResponse> {
  return apiCall<LookupChatResponse>('/telegram/lookup-chat/', {
    method: 'POST',
    body: JSON.stringify({ token, username }),
  })
}

/**
 * Lookup a chat by username for a saved bot
 */
export async function lookupBotChat(id: number, username: string): Promise<LookupChatResponse> {
  return apiCall<LookupChatResponse>(`/telegram-bots/${id}/lookup-chat/`, {
    method: 'POST',
    body: JSON.stringify({ username }),
  })
}

/**
 * Send a test message using a bot
 */
export async function sendTestMessage(
  id: number,
  options?: {
    message?: string
    chat_id?: string
    message_thread_id?: number
  }
): Promise<TestMessageResponse> {
  return apiCall<TestMessageResponse>(`/telegram-bots/${id}/test/`, {
    method: 'POST',
    body: JSON.stringify(options || {}),
  })
}

/**
 * Sync bot and chat info from Telegram API
 */
export async function syncBotInfo(id: number): Promise<SyncInfoResponse> {
  return apiCall<SyncInfoResponse>(`/telegram-bots/${id}/sync-info/`, {
    method: 'POST',
  })
}

/**
 * Get bot info including setup links
 */
export async function getBotInfo(id: number): Promise<{
  success: boolean
  bot: {
    id: number
    username: string
    first_name: string
    can_join_groups: boolean
    can_read_all_group_messages: boolean
  }
  links: {
    start_chat: string | null
    add_to_group: string | null
    add_to_channel: string | null
  }
  instructions: {
    personal: string
    group: string
    channel: string
  }
}> {
  return apiCall(`/telegram-bots/${id}/get-me/`)
}

export interface TelegramUserLink {
  id: number
  company: number
  company_code: string
  user: number | null
  telegram_chat_id: string
  telegram_bot: number
  telegram_bot_name: string
  link_token_expires_at: string | null
  opted_in_alerts: boolean
  opted_in_reports: boolean
  opted_in_device_events: boolean
  created_at: string
  updated_at: string
}

export interface TelegramUserLinkCreateResponse {
  id: number
  link_token: string
  expires_at: string
  deep_link: string | null
  bot_username: string | null
}

export async function listTelegramLinks(userEmail: string): Promise<{ results: TelegramUserLink[] }> {
  const data = await apiCall<{ results: TelegramUserLink[] }>(
    `/telegram-links/?user_email=${encodeURIComponent(userEmail)}`
  )
  return Array.isArray((data as any).results) ? data : { results: [] }
}

export async function createTelegramLink(
  userEmail: string,
  telegramBotId: number
): Promise<TelegramUserLinkCreateResponse> {
  return apiCall<TelegramUserLinkCreateResponse>('/telegram-links/', {
    method: 'POST',
    body: JSON.stringify({ user_email: userEmail, telegram_bot_id: telegramBotId }),
  })
}

export async function updateTelegramLink(
  id: number,
  data: { opted_in_alerts?: boolean; opted_in_reports?: boolean; opted_in_device_events?: boolean }
): Promise<TelegramUserLink> {
  return apiCall<TelegramUserLink>(`/telegram-links/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteTelegramLink(id: number): Promise<void> {
  const url = getApiUrl(`/telegram-links/${id}/`)
  const response = await fetch(url, { method: 'DELETE', credentials: 'include' })
  if (!response.ok && response.status !== 204) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || err.detail || `Delete failed: ${response.status}`)
  }
}
