/**
 * API Client Utility
 * Handles API calls with proper error handling and fallback mechanisms
 */

// API configuration from environment variables
// SECURITY: Never hardcode production URLs or credentials
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
const BLACKSMS_API_URL = import.meta.env.VITE_BLACKSMS_API_URL || 'https://blacksms.in'
const BLACKSMS_AUTH_TOKEN = import.meta.env.VITE_BLACKSMS_AUTH_TOKEN || ''

const RETRYABLE_STATUS_CODES = new Set([502, 503, 504])

const getApiMaxRetries = () => parseInt(import.meta.env.VITE_API_MAX_RETRIES || '3', 10)
const getApiTimeoutMs = () => parseInt(import.meta.env.VITE_API_TIMEOUT_MS || '30000', 10)
const getApiInitialBackoffMs = () => parseInt(import.meta.env.VITE_API_INITIAL_BACKOFF_MS || '1000', 10)

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function exponentialBackoffMs(attempt: number, initialMs: number): number {
  return initialMs * Math.pow(2, attempt)
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries: number = getApiMaxRetries()
): Promise<Response> {
  const timeoutMs = getApiTimeoutMs()
  const initialBackoffMs = getApiInitialBackoffMs()
  let lastError: unknown = null

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    const fetchOptions: RequestInit = {
      ...options,
      cache: 'no-store',
      signal: controller.signal,
    }

    try {
      const response = await fetch(url, fetchOptions)
      clearTimeout(timeoutId)

      if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < retries) {
        await sleep(exponentialBackoffMs(attempt, initialBackoffMs))
        continue
      }

      return response
    } catch (error) {
      clearTimeout(timeoutId)
      lastError = error
      if (attempt === retries) {
        throw error
      }
      await sleep(exponentialBackoffMs(attempt, initialBackoffMs))
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Failed to fetch after retries')
}

// Validate that required environment variables are set in production
if (import.meta.env.PROD) {
  if (!API_BASE_URL) {
    console.error('❌ ERROR: VITE_API_BASE_URL is not set in production environment!')
    throw new Error('VITE_API_BASE_URL is required in production')
  }
  if (!BLACKSMS_AUTH_TOKEN) {
    console.error('❌ ERROR: VITE_BLACKSMS_AUTH_TOKEN is not set in production environment!')
    throw new Error('VITE_BLACKSMS_AUTH_TOKEN is required in production')
  }
}

/**
 * Get the API endpoint URL
 * In production, uses the full API URL
 * In development, uses Vite proxy or full URL
 */
export function getApiUrl(endpoint: string): string {
  // Ensure endpoint starts with /
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`

  const normalizeBase = (baseUrl: string): string => {
    if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
      const url = new URL(baseUrl)
      const path = url.pathname.replace(/\/$/, '')
      url.pathname = path === '' || path === '/' ? '/api' : path
      return url.toString().replace(/\/$/, '')
    }

    if (baseUrl.startsWith('/')) {
      const path = baseUrl.replace(/\/$/, '')
      return path === '' ? '/api' : path
    }

    return baseUrl
  }

  // If API_BASE_URL is a full URL (starts with http), use it directly
  if (API_BASE_URL.startsWith('http://') || API_BASE_URL.startsWith('https://')) {
    const base = normalizeBase(API_BASE_URL)
    return `${base}${normalizedEndpoint}`
  }

  // If it's a relative path (starts with /), use it as-is (for Vite proxy in dev)
  if (API_BASE_URL.startsWith('/')) {
    const base = normalizeBase(API_BASE_URL)
    return `${base}${normalizedEndpoint}`
  }

  // SECURITY: No hardcoded fallback URLs in production
  if (import.meta.env.PROD) {
    throw new Error('VITE_API_BASE_URL must be set in production environment')
  }
  
  // Development fallback: use relative path for Vite proxy
  return `/api${normalizedEndpoint}`
}

/**
 * Fetch devices from Django API
 * @param filters Optional filters (code, is_active, device_id, user_email)
 * @returns Array of devices
 */
export async function fetchDevices(filters?: {
  code?: string
  is_active?: boolean
  device_id?: string
  user_email?: string
}): Promise<any[]> {
  try {
    let url = getApiUrl('/devices/')
    
    // Add query parameters if filters are provided
    const params = new URLSearchParams()
    if (filters?.user_email) params.append('user_email', filters.user_email)
    if (filters?.code) params.append('code', filters.code)
    if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active))
    if (filters?.device_id) params.append('device_id', filters.device_id)
    
    if (params.toString()) {
      url += `?${params.toString()}`
    }

    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch devices: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    // Django REST Framework returns results in a 'results' array if paginated, otherwise it's an array
    return Array.isArray(data) ? data : (data.results || [])
  } catch (error) {
    console.error('Error fetching devices from Django:', error)
    throw error
  }
}

/**
 * Send SMS via API with fallback mechanism
 */
export async function sendSMS(
  phoneNumber: string,
  otpValue: string,
  senderId: string = '47'
): Promise<{ success: boolean; data?: any; error?: string }> {
  const cleanPhoneNumber = phoneNumber.replace(/\D/g, '')

  // Try serverless function first (for Vercel/Netlify)
  try {
    const response = await fetch('/api/send-sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender_id: senderId,
        variables_values: otpValue,
        numbers: cleanPhoneNumber,
      }),
    })

    // Check if response is JSON
    const contentType = response.headers.get('content-type')
    let data: any

    if (contentType && contentType.includes('application/json')) {
      data = await response.json()
    } else {
      const textResponse = await response.text()

      // If it's an HTML error page, try direct API call
      if (textResponse.includes('<!DOCTYPE') || textResponse.includes('<html') || !response.ok) {
        throw new Error('Serverless function unavailable, trying direct API')
      }

      try {
        data = JSON.parse(textResponse)
      } catch {
        throw new Error('Invalid response from serverless function')
      }
    }

    return { success: true, data }
  } catch (error) {
    // Fallback: Try direct API call if serverless function fails
    console.warn('Serverless function failed, trying direct API call:', error)

    try {
      const response = await fetch(`${BLACKSMS_API_URL}/sms`, {
        method: 'POST',
        headers: {
          Authorization: BLACKSMS_AUTH_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender_id: senderId,
          variables_values: otpValue,
          numbers: cleanPhoneNumber,
        }),
      })

      const contentType = response.headers.get('content-type')
      let data: any

      if (contentType && contentType.includes('application/json')) {
        data = await response.json()
      } else {
        const textResponse = await response.text()
        try {
          data = JSON.parse(textResponse)
        } catch {
          throw new Error(`Invalid response: ${textResponse.substring(0, 100)}`)
        }
      }

      return { success: true, data }
    } catch (directApiError) {
      console.error('Direct API call also failed:', directApiError)
      return {
        success: false,
        error: directApiError instanceof Error ? directApiError.message : 'Failed to send SMS',
      }
    }
  }
}
