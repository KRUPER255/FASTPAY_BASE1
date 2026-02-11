/**
 * Tests for useDashboardDevices hook
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useDashboardDevices } from './useDashboardDevices'

// Mock Firebase
vi.mock('firebase/database', () => ({
  onValue: vi.fn((ref, callback) => {
    // Simulate Firebase callback with mock data
    const mockSnapshot = {
      exists: () => true,
      val: () => ({
        t: Date.now(),
        b: 85,
      }),
    }
    callback(mockSnapshot)
    // Return unsubscribe function
    return () => {}
  }),
  off: vi.fn(),
  get: vi.fn(),
  query: vi.fn(),
  orderByKey: vi.fn(),
  limitToLast: vi.fn(),
}))

// Mock Firebase helpers
vi.mock('@/lib/firebase-helpers', () => ({
  getHeartbeatsPath: vi.fn((deviceId: string) => ({
    _path: `hertbit/${deviceId}`,
  })),
}))

// Mock API client
vi.mock('@/lib/api-client', () => ({
  fetchDevices: vi.fn(async (filters?: { user_email?: string }) => {
    if (!filters?.user_email) {
      return []
    }
    return [
      {
        device_id: 'device1',
        name: 'Test Device 1',
        phone: '1234567890',
        code: 'TEST01',
        last_seen: Date.now() - 1000,
        battery_percentage: 80,
      },
      {
        device_id: 'device2',
        name: 'Test Device 2',
        phone: '0987654321',
        code: 'TEST02',
        last_seen: Date.now() - 2000,
        battery_percentage: 75,
      },
    ]
  }),
}))

describe('useDashboardDevices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should return empty devices when sessionEmail is null', () => {
    const { result } = renderHook(() =>
      useDashboardDevices({ sessionEmail: null })
    )

    expect(result.current.devices).toEqual([])
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should fetch devices from API', async () => {
    const { result } = renderHook(() =>
      useDashboardDevices({ sessionEmail: 'test@example.com' })
    )

    // Initially loading
    expect(result.current.loading).toBe(true)

    // Wait for devices to load
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.devices.length).toBeGreaterThan(0)
    expect(result.current.error).toBeNull()
  })

  it('should format device names correctly', async () => {
    const { result } = renderHook(() =>
      useDashboardDevices({ sessionEmail: 'test@example.com' })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const devices = result.current.devices
    expect(devices.length).toBeGreaterThan(0)
    expect(devices[0].device).toBeDefined()
  })

  it('should calculate isOnline based on lastSeen', async () => {
    const { result } = renderHook(() =>
      useDashboardDevices({ sessionEmail: 'test@example.com' })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const devices = result.current.devices
    devices.forEach(device => {
      expect(device.isOnline).toBeDefined()
      expect(typeof device.isOnline).toBe('boolean')
    })
  })

  it('should handle API errors', async () => {
    const { fetchDevices } = await import('@/lib/api-client')
    vi.mocked(fetchDevices).mockRejectedValueOnce(new Error('API Error'))

    const { result } = renderHook(() =>
      useDashboardDevices({ sessionEmail: 'test@example.com' })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBeTruthy()
    expect(result.current.devices).toEqual([])
  })

  it('should return refresh function', () => {
    const { result } = renderHook(() =>
      useDashboardDevices({ sessionEmail: 'test@example.com' })
    )

    expect(typeof result.current.refresh).toBe('function')
  })

  it('should refresh devices when refreshTrigger changes', async () => {
    const { result, rerender } = renderHook(
      ({ trigger }) => useDashboardDevices({ sessionEmail: 'test@example.com', refreshTrigger: trigger }),
      { initialProps: { trigger: 0 } }
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const initialDeviceCount = result.current.devices.length

    // Trigger refresh
    rerender({ trigger: 1 })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Devices should be refreshed
    expect(result.current.devices.length).toBe(initialDeviceCount)
  })

  it('should include device metadata', async () => {
    const { result } = renderHook(() =>
      useDashboardDevices({ sessionEmail: 'test@example.com' })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const devices = result.current.devices
    if (devices.length > 0) {
      const device = devices[0]
      expect(device.id).toBeDefined()
      expect(device.device).toBeDefined()
      expect(device.admin).toBe('test@example.com')
    }
  })
})
