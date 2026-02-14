/**
 * Tests for authentication utilities
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  verifyLogin,
  saveSession,
  getSession,
  clearSession,
  isAuthenticated,
  getUserAccess,
  hasFullAccess,
  getLoginRedirectPath,
} from './auth'
import type { AdminSession } from './auth'

// Mock fetch
global.fetch = vi.fn()

describe('auth utilities', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('saveSession', () => {
    it('should save session to localStorage', () => {
      const session: AdminSession = {
        email: 'test@example.com',
        status: 'active',
        timestamp: Date.now(),
        access: 0,
      }

      saveSession(session)

      const saved = localStorage.getItem('fastpay_admin_session')
      expect(saved).toBeTruthy()
      expect(JSON.parse(saved!)).toEqual(session)
    })
  })

  describe('getSession', () => {
    it('should return null when no session exists', () => {
      expect(getSession()).toBeNull()
    })

    it('should return session when valid', () => {
      const session: AdminSession = {
        email: 'test@example.com',
        status: 'active',
        timestamp: Date.now(),
        access: 0,
      }

      saveSession(session)
      const retrieved = getSession()

      expect(retrieved).toEqual(session)
    })

    it('should return null when session is expired', () => {
      const expiredSession: AdminSession = {
        email: 'test@example.com',
        status: 'active',
        timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
        access: 0,
      }

      saveSession(expiredSession)
      expect(getSession()).toBeNull()
    })

    it('should return null when session is invalid JSON', () => {
      localStorage.setItem('fastpay_admin_session', 'invalid json')
      expect(getSession()).toBeNull()
    })
  })

  describe('clearSession', () => {
    it('should remove session from localStorage', () => {
      const session: AdminSession = {
        email: 'test@example.com',
        status: 'active',
        timestamp: Date.now(),
        access: 0,
      }

      saveSession(session)
      expect(getSession()).not.toBeNull()

      clearSession()
      expect(getSession()).toBeNull()
    })
  })

  describe('isAuthenticated', () => {
    it('should return false when no session', () => {
      expect(isAuthenticated()).toBe(false)
    })

    it('should return true when valid session exists', () => {
      const session: AdminSession = {
        email: 'test@example.com',
        status: 'active',
        timestamp: Date.now(),
        access: 0,
      }

      saveSession(session)
      expect(isAuthenticated()).toBe(true)
    })

    it('should return false when session is expired', () => {
      const expiredSession: AdminSession = {
        email: 'test@example.com',
        status: 'active',
        timestamp: Date.now() - (25 * 60 * 60 * 1000),
        access: 0,
      }

      saveSession(expiredSession)
      expect(isAuthenticated()).toBe(false)
    })
  })

  describe('getUserAccess', () => {
    it('should return 0 for admin user', () => {
      const session: AdminSession = {
        email: 'admin@example.com',
        status: 'active',
        timestamp: Date.now(),
        access: 0,
      }

      saveSession(session)
      expect(getUserAccess()).toBe(0)
    })

    it('should return 1 for OTP user', () => {
      const session: AdminSession = {
        email: 'otp@example.com',
        status: 'active',
        timestamp: Date.now(),
        access: 1,
      }

      saveSession(session)
      expect(getUserAccess()).toBe(1)
    })

    it('should default to 1 when access is not set', () => {
      const session: AdminSession = {
        email: 'user@example.com',
        status: 'active',
        timestamp: Date.now(),
      }

      saveSession(session)
      expect(getUserAccess()).toBe(1)
    })

    it('should default to 1 when no session', () => {
      expect(getUserAccess()).toBe(1)
    })
  })

  describe('hasFullAccess', () => {
    it('should return true for admin (access 0)', () => {
      const session: AdminSession = {
        email: 'admin@example.com',
        status: 'active',
        timestamp: Date.now(),
        access: 0,
      }

      saveSession(session)
      expect(hasFullAccess()).toBe(true)
    })

    it('should return false for OTP user (access 1)', () => {
      const session: AdminSession = {
        email: 'otp@example.com',
        status: 'active',
        timestamp: Date.now(),
        access: 1,
      }

      saveSession(session)
      expect(hasFullAccess()).toBe(false)
    })

    it('should return false when no session', () => {
      expect(hasFullAccess()).toBe(false)
    })
  })

  describe('getLoginRedirectPath', () => {
    const dashboardPath =
      import.meta.env.VITE_REDPAY_ONLY === 'true' ? '/dashboard' : '/dashboard/v2'

    it('should return dashboard path for admin user', () => {
      expect(getLoginRedirectPath(0)).toBe(dashboardPath)
    })

    it('should return dashboard path for legacy OTP-only user', () => {
      expect(getLoginRedirectPath(1)).toBe(dashboardPath)
    })

    it('should return dashboard path by default when no arguments and session is admin', () => {
      const session: AdminSession = {
        email: 'admin@example.com',
        status: 'active',
        timestamp: Date.now(),
        access: 0,
      }
      saveSession(session)
      expect(getLoginRedirectPath()).toBe(dashboardPath)
    })

    it('should return custom destination when provided', () => {
      expect(getLoginRedirectPath(0, 'redpay')).toBe('/redpay')
      expect(getLoginRedirectPath(0, 'kypay')).toBe('/kypay')
    })
  })

  function mockFetchResponse(body: object) {
    return {
      ok: true,
      headers: { get: (name: string) => (name === 'content-type' ? 'application/json' : null) },
      json: async () => body,
      text: async () => JSON.stringify(body),
    }
  }

  describe('verifyLogin', () => {
    it('should return success when login is valid', async () => {
      const mockResponse = {
        success: true,
        admin: {
          email: 'test@example.com',
          status: 'active',
          timestamp: Date.now(),
          access: 0,
        },
      }

      ;(global.fetch as any).mockResolvedValueOnce(mockFetchResponse(mockResponse))

      const result = await verifyLogin('test@example.com', 'password123')

      expect(result.success).toBe(true)
      expect(result.admin).toEqual(mockResponse.admin)
      expect(getSession()).toEqual(mockResponse.admin)
    })

    it('should return error when login fails', async () => {
      const mockResponse = {
        success: false,
        error: 'Invalid credentials',
      }

      ;(global.fetch as any).mockResolvedValueOnce(mockFetchResponse(mockResponse))

      const result = await verifyLogin('test@example.com', 'wrongpassword')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid credentials')
      expect(getSession()).toBeNull()
    })

    it('should handle network errors', async () => {
      ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

      const result = await verifyLogin('test@example.com', 'password123')

      expect(result.success).toBe(false)
      expect(result.error).toContain('error occurred')
    })

    it('should use correct API endpoint', async () => {
      const mockResponse = {
        success: true,
        admin: {
          email: 'test@example.com',
          status: 'active',
          timestamp: Date.now(),
          access: 0,
        },
      }

      ;(global.fetch as any).mockResolvedValueOnce(mockFetchResponse(mockResponse))

      await verifyLogin('test@example.com', 'password123')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/dashboard-login/'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'password123',
          }),
        })
      )
    })
  })
})
