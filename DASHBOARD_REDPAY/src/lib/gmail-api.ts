/**
 * Gmail API Integration
 * 
 * This module provides functions to interact with Gmail API:
 * - Google OAuth 2.0 authentication
 * - Fetching emails
 * - Displaying email content
 */

// Gmail API base URL
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1'

// Google OAuth 2.0 configuration
// You'll need to set these via environment variables or config
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const GOOGLE_REDIRECT_URI = import.meta.env.VITE_GOOGLE_REDIRECT_URI || window.location.origin + '/auth/google/callback'

// OAuth 2.0 scopes required for Gmail API
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify'
].join(' ')

export interface GmailAuthToken {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  scope: string
}

/**
 * Initialize Google OAuth 2.0 authentication
 * Redirects to Google OAuth consent screen
 * User will be redirected back to the callback URL after authorization
 */
export function initGmailAuth(): void {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('Google Client ID not configured. Please set VITE_GOOGLE_CLIENT_ID')
  }

  // Generate state for CSRF protection
  const state = Math.random().toString(36).substring(2, 15)
  sessionStorage.setItem('gmail_oauth_state', state)

  // Build OAuth URL
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', GMAIL_SCOPES)
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')
  authUrl.searchParams.set('state', state)

  // Redirect to Google OAuth page
  window.location.href = authUrl.toString()
}

/**
 * Exchange authorization code for access token
 * This is done via the backend for security
 */
export async function exchangeCodeForToken(code: string): Promise<GmailAuthToken> {
  const response = await fetch('/api/auth/google/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  return response.json()
}

/**
 * Store Gmail access token in localStorage
 */
export function storeGmailToken(token: GmailAuthToken): void {
  localStorage.setItem('gmail_access_token', token.access_token)
  if (token.refresh_token) {
    localStorage.setItem('gmail_refresh_token', token.refresh_token)
  }
  localStorage.setItem('gmail_token_expires', String(Date.now() + token.expires_in * 1000))
}

/**
 * Get stored Gmail access token
 */
export function getGmailToken(): string | null {
  return localStorage.getItem('gmail_access_token')
}

/**
 * Check if Gmail token is expired
 */
export function isGmailTokenExpired(): boolean {
  const expiresAt = localStorage.getItem('gmail_token_expires')
  if (!expiresAt) return true
  return Date.now() >= parseInt(expiresAt, 10)
}

/**
 * Clear stored Gmail tokens
 */
export function clearGmailToken(): void {
  localStorage.removeItem('gmail_access_token')
  localStorage.removeItem('gmail_refresh_token')
  localStorage.removeItem('gmail_token_expires')
}

/**
 * Fetch Gmail messages
 */
export async function fetchGmailMessages(
  maxResults: number = 25,
  pageToken?: string,
  query?: string
): Promise<{
  messages: Array<{ id: string; threadId: string }>
  nextPageToken?: string
  resultSizeEstimate: number
}> {
  const token = getGmailToken()
  if (!token || isGmailTokenExpired()) {
    throw new Error('Gmail authentication required. Please sign in.')
  }

  const params = new URLSearchParams({
    maxResults: String(maxResults),
  })

  if (pageToken) {
    params.set('pageToken', pageToken)
  }

  if (query) {
    params.set('q', query)
  }

  const response = await fetch(`${GMAIL_API_BASE}/users/me/messages?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    if (response.status === 401) {
      clearGmailToken()
      throw new Error('Gmail authentication expired. Please sign in again.')
    }
    const error = await response.text()
    throw new Error(`Failed to fetch messages: ${error}`)
  }

  return response.json()
}

/**
 * Fetch a specific Gmail message by ID
 */
export async function fetchGmailMessage(messageId: string): Promise<{
  id: string
  threadId: string
  snippet: string
  payload: any
  internalDate: string
  labelIds: string[]
}> {
  const token = getGmailToken()
  if (!token || isGmailTokenExpired()) {
    throw new Error('Gmail authentication required. Please sign in.')
  }

  const response = await fetch(`${GMAIL_API_BASE}/users/me/messages/${messageId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    if (response.status === 401) {
      clearGmailToken()
      throw new Error('Gmail authentication expired. Please sign in again.')
    }
    const error = await response.text()
    throw new Error(`Failed to fetch message: ${error}`)
  }

  return response.json()
}

/**
 * Decode base64url email body
 */
export function decodeEmailBody(data: string): string {
  // Gmail API uses base64url encoding
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  try {
    return decodeURIComponent(
      atob(base64 + padding)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
  } catch (e) {
    return ''
  }
}

/**
 * Extract plain text from email payload
 */
export function extractPlainText(payload: any): string {
  if (!payload) return ''

  // If body exists directly, extract it
  if (payload.body?.data) {
    return decodeEmailBody(payload.body.data)
  }

  // If parts exist, find the plain text part
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeEmailBody(part.body.data)
      }
      // Recursively check nested parts
      if (part.parts) {
        for (const nestedPart of part.parts) {
          if (nestedPart.mimeType === 'text/plain' && nestedPart.body?.data) {
            return decodeEmailBody(nestedPart.body.data)
          }
        }
      }
    }
  }

  return ''
}

/**
 * Extract HTML from email payload
 */
export function extractHTML(payload: any): string {
  if (!payload) return ''

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return decodeEmailBody(part.body.data)
      }
      // Recursively check nested parts
      if (part.parts) {
        for (const nestedPart of part.parts) {
          if (nestedPart.mimeType === 'text/html' && nestedPart.body?.data) {
            return decodeEmailBody(nestedPart.body.data)
          }
        }
      }
    }
  }

  return ''
}

/**
 * Get header value from email
 */
export function getEmailHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase())
  return header?.value || ''
}
