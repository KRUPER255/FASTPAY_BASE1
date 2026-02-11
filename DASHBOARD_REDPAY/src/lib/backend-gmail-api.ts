/**
 * Backend Gmail API Service
 * 
 * This module provides functions to interact with Gmail through the backend API.
 * All authentication is handled server-side using stored OAuth tokens.
 */

import { getApiUrl } from './api-client'

export interface GmailStatus {
  connected: boolean
  gmail_email: string | null
  is_active?: boolean
  last_sync_at?: string | null
  scopes?: string[]
}

export interface GmailMessage {
  id: string
  threadId: string
  snippet: string
  payload: any
  internalDate: string
  labelIds: string[]
}

export interface GmailMessageList {
  messages: Array<{
    id: string
    thread_id: string
    subject: string
    from_email: string
    snippet: string
    date: string
    internal_date?: string
    labels: string[]
    is_read?: boolean
  }>
  nextPageToken?: string
  resultSizeEstimate: number
}

export interface GmailAttachment {
  filename: string
  mimeType: string
  size: number
  attachmentId: string
}

export interface GmailMessageDetail {
  id: string
  threadId: string
  subject: string
  fromEmail: string
  to: string
  cc: string
  bcc: string
  date: string
  plainText: string
  html: string
  attachments: GmailAttachment[]
  labels: string[]
}

/**
 * Initialize Gmail OAuth authentication
 * Returns auth_url that user should be redirected to.
 * dashboard_origin + dashboard_path: when set (e.g. REDPAY), OAuth callback will redirect back to this dashboard.
 */
export async function initGmailAuth(
  userEmail: string,
  method: 'webpage' | 'sms' | 'email' = 'webpage',
  options?: { device_id?: string; dashboard_origin?: string; dashboard_path?: string }
): Promise<{
  auth_url: string
  expires_in: number
  token?: string
  short_link?: string
}> {
  const body: Record<string, string> = {
    user_email: userEmail,
    method: method,
  }
  if (options?.device_id) body.device_id = options.device_id
  if (options?.dashboard_origin) body.dashboard_origin = options.dashboard_origin
  if (options?.dashboard_path) body.dashboard_path = options.dashboard_path

  const response = await fetch(getApiUrl('/gmail/init-auth/'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to initialize Gmail auth: ${error}`)
  }

  return response.json()
}

/**
 * Check Gmail connection status for a user
 */
export async function checkGmailStatus(userEmail: string): Promise<GmailStatus> {
  const response = await fetch(getApiUrl(`/gmail/status/?user_email=${encodeURIComponent(userEmail)}`))

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to check Gmail status: ${error}`)
  }

  return response.json()
}

/**
 * Fetch Gmail messages
 */
export async function fetchGmailMessages(
  userEmail: string,
  options?: {
    max_results?: number
    page_token?: string
    query?: string
    label_ids?: string[]
  }
): Promise<GmailMessageList> {
  const params = new URLSearchParams({
    user_email: userEmail,
  })

  if (options?.max_results) {
    params.set('max_results', String(options.max_results))
  }
  if (options?.page_token) {
    params.set('page_token', options.page_token)
  }
  if (options?.query) {
    params.set('query', options.query)
  }
  if (options?.label_ids && options.label_ids.length > 0) {
    params.set('label_ids', options.label_ids.join(','))
  }

  const response = await fetch(getApiUrl(`/gmail/messages/?${params.toString()}`))

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Gmail authentication expired. Please reconnect.')
    }
    const error = await response.text()
    // Try to surface a concise error message from backend JSON
    try {
      const parsed = JSON.parse(error)
      const message =
        typeof parsed?.error === 'string'
          ? parsed.error
          : typeof parsed?.detail === 'string'
          ? parsed.detail
          : error
      throw new Error(message)
    } catch {
      throw new Error(`Failed to fetch messages: ${error}`)
    }
  }

  const data = await response.json()
  return {
    messages: data.messages || [],
    nextPageToken: data.next_page_token,
    resultSizeEstimate: data.result_size_estimate ?? data.resultSizeEstimate ?? 0,
  }
}

/**
 * Fetch a specific Gmail message by ID
 */
export async function fetchGmailMessage(userEmail: string, messageId: string): Promise<GmailMessage> {
  const response = await fetch(
    getApiUrl(`/gmail/messages/${messageId}/?user_email=${encodeURIComponent(userEmail)}`)
  )

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Gmail authentication expired. Please reconnect.')
    }
    const error = await response.text()
    throw new Error(`Failed to fetch message: ${error}`)
  }

  return response.json()
}

/**
 * Fetch detailed Gmail message (headers, bodies, attachments) via backend
 */
export async function fetchGmailMessageDetail(
  userEmail: string,
  messageId: string
): Promise<GmailMessageDetail> {
  const response = await fetch(
    getApiUrl(`/gmail/messages/${messageId}/?user_email=${encodeURIComponent(userEmail)}`)
  )

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Gmail authentication expired. Please reconnect.')
    }
    const error = await response.text()
    try {
      const parsed = JSON.parse(error)
      const message =
        typeof parsed?.error === 'string'
          ? parsed.error
          : typeof parsed?.detail === 'string'
          ? parsed.detail
          : error
      throw new Error(message)
    } catch {
      throw new Error(`Failed to fetch message: ${error}`)
    }
  }

  const data = await response.json()
  const attachmentsRaw = Array.isArray(data.attachments) ? data.attachments : []

  return {
    id: data.id,
    threadId: data.thread_id ?? '',
    subject: data.subject ?? '(No Subject)',
    fromEmail: data.from_email ?? '',
    to: data.to ?? '',
    cc: data.cc ?? '',
    bcc: data.bcc ?? '',
    date: data.date ?? '',
    plainText: data.plain_text ?? '',
    html: data.html ?? '',
    attachments: attachmentsRaw.map((att: any): GmailAttachment => ({
      filename: att.filename ?? '',
      mimeType: att.mime_type ?? '',
      size: typeof att.size === 'number' ? att.size : 0,
      attachmentId: att.attachment_id ?? '',
    })),
    labels: Array.isArray(data.labels) ? data.labels : [],
  }
}

/**
 * Send Gmail message
 */
export async function sendGmailMessage(
  userEmail: string,
  to: string,
  subject: string,
  body: string,
  options?: {
    html_body?: string
    cc?: string[]
    bcc?: string[]
    attachments?: Array<{ filename: string; content: string; mime_type: string }>
  }
): Promise<{ success: boolean; message_id?: string; error?: string }> {
  const response = await fetch(getApiUrl('/gmail/send/'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_email: userEmail,
      to: to,
      subject: subject,
      body: body,
      html_body: options?.html_body,
      cc: options?.cc,
      bcc: options?.bcc,
      attachments: options?.attachments,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to send message: ${error}`)
  }

  return response.json()
}

/**
 * Get Gmail labels
 */
export async function getGmailLabels(userEmail: string): Promise<Array<{ id: string; name: string }>> {
  const response = await fetch(getApiUrl(`/gmail/labels/?user_email=${encodeURIComponent(userEmail)}`))

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to fetch labels: ${error}`)
  }

  const data = await response.json()
  return data.labels || []
}

/**
 * Disconnect Gmail account
 */
export async function disconnectGmail(userEmail: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(getApiUrl('/gmail/disconnect/'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_email: userEmail,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to disconnect: ${error}`)
  }

  return response.json()
}

/**
 * Get Gmail statistics
 */
export async function getGmailStatistics(userEmail: string): Promise<{
  total_messages: number
  unread_messages: number
  sent_messages: number
  inbox_messages: number
}> {
  const response = await fetch(getApiUrl(`/gmail/statistics/?user_email=${encodeURIComponent(userEmail)}`))

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to fetch statistics: ${error}`)
  }

  return response.json()
}
