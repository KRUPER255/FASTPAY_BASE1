import { getApiUrl } from './api-client'
import { applyThemeModePreference } from './theme'

const REDPAY_ONLY = import.meta.env.VITE_REDPAY_ONLY === 'true'

export interface AdminSession {
  email: string
  status: string
  timestamp: number
  access?: number // 0 = full access, 1 = OTP only, 2 = RedPay only
  theme_mode?: string
}

const SESSION_KEY = 'fastpay_admin_session'
const SESSION_DURATION = 24 * 60 * 60 * 1000 // 24 hours

export async function verifyLogin(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; admin?: AdminSession }> {
  try {
    // Call Django login endpoint
    const response = await fetch(getApiUrl('/dashboard-login/'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        password: password,
      }),
    })

    const contentType = response.headers.get('content-type') || ''
    let data: any = null
    if (contentType.includes('application/json')) {
      data = await response.json()
    } else {
      const text = await response.text()
      return {
        success: false,
        error: response.ok
          ? 'Login endpoint returned non-JSON response.'
          : `Login failed: ${response.status} ${response.statusText}.`,
      }
    }

    if (data.success && data.admin) {
      // Save session to localStorage
      saveSession(data.admin)
      // Apply backend theme preference if provided
      applyThemeModePreference(data.admin.theme_mode)
      return { success: true, admin: data.admin }
    }

    return {
      success: false,
      error: data?.error || 'Invalid email or password',
    }
  } catch (error) {
    console.error('Login error:', error)
    return {
      success: false,
      error: 'An error occurred during login. Please check your connection.',
    }
  }
}

export function saveSession(session: AdminSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function getSession(): AdminSession | null {
  try {
    const sessionStr = localStorage.getItem(SESSION_KEY)
    if (!sessionStr) return null

    const session: AdminSession = JSON.parse(sessionStr)

    // Check if session is expired
    if (Date.now() - session.timestamp > SESSION_DURATION) {
      clearSession()
      return null
    }

    return session
  } catch {
    return null
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

export function updateSessionThemeMode(themeMode: string): void {
  const session = getSession()
  if (!session) return
  session.theme_mode = themeMode
  saveSession(session)
}

export function isAuthenticated(): boolean {
  return getSession() !== null
}

export function getUserAccess(): number {
  const session = getSession()
  // If no session or access not set, default to 1 (OTP only)
  return session?.access ?? 1
}

export function hasFullAccess(): boolean {
  return getUserAccess() === 0
}

export function hasRedPayAccess(): boolean {
  return getUserAccess() === 2
}

/**
 * Get the redirect path after successful login based on user access level
 * @param accessLevel - User access level (0 = full access, 1 = limited dashboard access, 2 = RedPay only)
 * @param destination - Optional destination: 'dashboard', 'redpay', 'kypay' (default: 'dashboard')
 * @returns Redirect path string
 */
export function getLoginRedirectPath(
  accessLevel?: number,
  destination: 'dashboard' | 'redpay' | 'kypay' = 'dashboard'
): string {
  // If access level not provided, get from current session
  const level = accessLevel !== undefined ? accessLevel : getUserAccess()

  // Access level 1 (legacy OTP-only users) -> main dashboard v2
  if (level === 1) {
    return '/dashboard/v2'
  }

  // Access level 2 (RedPay only) -> RedPay page
  if (level === 2) {
    // In REDPAY-only mode, send users directly to the REDPAY dashboard homepage
    if (REDPAY_ONLY) {
      return '/dashboard'
    }
    return '/redpay'
  }
  
  // Access level 0 (full admin) -> selected dashboard
  // Default to dashboard if invalid destination
  const validDestinations = ['dashboard', 'redpay', 'kypay']
  const finalDestination = validDestinations.includes(destination) ? destination : 'dashboard'
  // Use new 5-section dashboard at /dashboard/v2
  if (finalDestination === 'dashboard') {
    return '/dashboard/v2'
  }
  return `/${finalDestination}`
}

/**
 * Update user access level via Django API
 * @param email - User email address
 * @param accessLevel - Access level: 0 = full access, 1 = OTP only, 2 = RedPay only
 * @returns Promise that resolves to true if successful, false otherwise
 */
export async function updateUserAccess(email: string, accessLevel: number): Promise<boolean> {
  try {
    // Validate access level
    if (accessLevel !== 0 && accessLevel !== 1 && accessLevel !== 2) {
      console.error('Invalid access level. Must be 0 (full access), 1 (OTP only), or 2 (RedPay only)')
      return false
    }

    // Call Django endpoint
    const apiUrl = API_BASE_URL.endsWith('/')
      ? `${API_BASE_URL}dashboard-update-access/`
      : `${API_BASE_URL}/dashboard-update-access/`
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        access_level: accessLevel,
      }),
    })

    const data = await response.json()

    if (response.ok && data.success) {
      return true
    } else {
      console.error('Failed to update access level:', data.error || 'Unknown error')
      return false
    }
  } catch (error) {
    console.error(`Error updating access level for ${email}:`, error)
    return false
  }
}

export async function updateUserThemeMode(
  email: string,
  themeMode: 'white' | 'dark'
): Promise<boolean> {
  try {
    const response = await fetch(getApiUrl('/dashboard-update-theme-mode/'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        theme_mode: themeMode,
      }),
    })

    const data = await response.json()
    if (response.ok && data.success) {
      updateSessionThemeMode(themeMode)
      return true
    }

    console.error('Failed to update theme mode:', data.error || 'Unknown error')
    return false
  } catch (error) {
    console.error(`Error updating theme mode for ${email}:`, error)
    return false
  }
}

export async function syncThemeFromBackend(): Promise<void> {
  const session = getSession()
  if (!session?.email) return

  try {
    const response = await fetch(getApiUrl('/dashboard-profile/'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: session.email }),
    })

    if (!response.ok) return
    const data = await response.json()
    const themeMode = data?.profile?.theme_mode
    if (applyThemeModePreference(themeMode)) {
      updateSessionThemeMode(themeMode)
    }
  } catch (error) {
    console.warn('Failed to sync theme mode from backend:', error)
  }
}

/**
 * Set admin user to full access (0) and all other users to OTP only (1)
 * @param adminEmail - Admin email (default: 'admin@fastpay.com')
 * @returns Promise that resolves when complete
 */
export async function configureUserAccess(adminEmail: string = 'admin@fastpay.com'): Promise<void> {
  try {
    // Call Django endpoint
    const apiUrl = API_BASE_URL.endsWith('/')
      ? `${API_BASE_URL}dashboard-configure-access/`
      : `${API_BASE_URL}/dashboard-configure-access/`
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        admin_email: adminEmail,
      }),
    })

    const data = await response.json()

    if (response.ok && data.success) {
      console.log(`Access levels configured: ${data.admin_email} set to full access, ${data.other_users_updated} other users set to OTP only`)
    } else {
      console.error('Failed to configure access levels:', data.error || 'Unknown error')
      throw new Error(data.error || 'Failed to configure access levels')
    }
  } catch (error) {
    console.error('Error configuring user access:', error)
    throw error
  }
}
