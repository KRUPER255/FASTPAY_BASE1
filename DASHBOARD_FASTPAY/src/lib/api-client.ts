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
 * Fetch companies from Django API
 */
export async function fetchCompanies(): Promise<Company[]> {
  try {
    const url = getApiUrl('/companies/')
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch companies: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    if (Array.isArray(data)) {
      return data
    }
    if (data.success === true && Array.isArray(data.data)) {
      return data.data
    }
    if (Array.isArray(data.results)) {
      return data.results
    }
    return []
  } catch (error) {
    console.error('Error fetching companies from Django:', error)
    throw error
  }
}

/**
 * Fetch devices from Django API
 * @param filters Optional filters (code, is_active, device_id, user_email, company_code)
 * @returns Array of devices
 */
export async function fetchDevices(filters?: {
  code?: string
  is_active?: boolean
  device_id?: string
  user_email?: string
  company_code?: string
}): Promise<any[]> {
  try {
    let url = getApiUrl('/devices/')
    
    // Add query parameters if filters are provided
    const params = new URLSearchParams()
    if (filters?.user_email) params.append('user_email', filters.user_email)
    if (filters?.code) params.append('code', filters.code)
    if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active))
    if (filters?.device_id) params.append('device_id', filters.device_id)
    if (filters?.company_code) params.append('company_code', filters.company_code)
    
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
    // Handle different response formats:
    // 1. Direct array: [device1, device2, ...]
    // 2. Paginated DRF: {results: [...], count: N}
    // 3. Custom wrapper: {success: true, data: [...]}
    if (Array.isArray(data)) {
      return data
    }
    if (data.success === true && Array.isArray(data.data)) {
      return data.data
    }
    if (Array.isArray(data.results)) {
      return data.results
    }
    return []
  } catch (error) {
    console.error('Error fetching devices from Django:', error)
    throw error
  }
}

export interface Company {
  id: number
  code: string
  name: string
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface DashboardUser {
  email: string
  full_name: string | null
  access_level: number
  status: string
  company_code?: string
  company_name?: string
  assigned_device_count: number
}

/**
 * Fetch dashboard users (admin-only)
 * @param adminEmail Email of the admin user making the request
 */
export async function fetchDashboardUsers(adminEmail: string): Promise<DashboardUser[]> {
  const url = getApiUrl('/dashboard-users/') + `?admin_email=${encodeURIComponent(adminEmail)}`
  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || `Failed to fetch dashboard users: ${response.statusText}`)
  }
  const data = await response.json()
  if (!data.success || !Array.isArray(data.users)) return []
  return data.users
}

/**
 * Allocate devices to a company (admin-only)
 * Devices are allocated to companies, not individual users. All users in the company will see these devices.
 */
export async function allocateDevicesToCompany(
  adminEmail: string,
  companyCode: string,
  deviceIds: string[]
): Promise<{ allocated_count: number }> {
  const response = await fetchWithRetry(getApiUrl('/devices/assign/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      admin_email: adminEmail,
      company_code: companyCode.toUpperCase(),
      device_ids: deviceIds,
    }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to allocate devices to company')
  return { allocated_count: data.allocated_count ?? 0 }
}

/**
 * Unallocate devices from a company (admin-only)
 */
export async function unallocateDevicesFromCompany(
  adminEmail: string,
  companyCode: string,
  deviceIds: string[]
): Promise<{ unallocated_count: number }> {
  const response = await fetchWithRetry(getApiUrl('/devices/unassign/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      admin_email: adminEmail,
      company_code: companyCode.toUpperCase(),
      device_ids: deviceIds,
    }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to unallocate devices from company')
  return { unallocated_count: data.unallocated_count ?? 0 }
}

/**
 * @deprecated Use allocateDevicesToCompany instead. Devices are now allocated to companies, not users.
 */
export async function assignDevicesToUser(
  adminEmail: string,
  userEmail: string,
  deviceIds: string[]
): Promise<{ assigned_count: number }> {
  console.warn('assignDevicesToUser is deprecated. Use allocateDevicesToCompany instead.')
  // For backward compatibility, try to get user's company and allocate to that
  const users = await fetchDashboardUsers(adminEmail)
  const user = users.find(u => u.email === userEmail)
  if (user && user.company_code) {
    return allocateDevicesToCompany(adminEmail, user.company_code, deviceIds)
  }
  throw new Error('User not found or has no company assigned')
}

/**
 * @deprecated Use unallocateDevicesFromCompany instead.
 */
export async function unassignDevicesFromUser(
  adminEmail: string,
  userEmail: string,
  deviceIds: string[]
): Promise<{ unassigned_count: number }> {
  console.warn('unassignDevicesFromUser is deprecated. Use unallocateDevicesFromCompany instead.')
  const users = await fetchDashboardUsers(adminEmail)
  const user = users.find(u => u.email === userEmail)
  if (user && user.company_code) {
    return unallocateDevicesFromCompany(adminEmail, user.company_code, deviceIds)
  }
  throw new Error('User not found or has no company assigned')
}

/**
 * Create a dashboard user (admin-only)
 */
export async function createDashboardUser(
  adminEmail: string,
  params: { email: string; password: string; full_name?: string; access_level: number }
): Promise<DashboardUser> {
  const response = await fetchWithRetry(getApiUrl('/dashboard-user-create/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      admin_email: adminEmail,
      email: params.email,
      password: params.password,
      full_name: params.full_name || '',
      access_level: params.access_level,
    }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to create user')
  return { ...data.user, assigned_device_count: 0 }
}

/**
 * Update a dashboard user (admin-only)
 */
export async function updateDashboardUser(
  adminEmail: string,
  email: string,
  params: { full_name?: string; access_level?: number; status?: string }
): Promise<DashboardUser> {
  const response = await fetchWithRetry(getApiUrl('/dashboard-user-update/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      admin_email: adminEmail,
      email,
      ...params,
    }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to update user')
  return { ...data.user, assigned_device_count: 0 }
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
