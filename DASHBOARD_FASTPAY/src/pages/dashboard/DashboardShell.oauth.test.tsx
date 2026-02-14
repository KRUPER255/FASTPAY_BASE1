import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useSearchParams } from 'react-router-dom'
import { DashboardShell } from './DashboardShell'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useSearchParams: vi.fn(),
  }
})

const mockSetSearchParams = vi.fn()
const mockToast = vi.fn()

vi.mock('@/lib/auth', () => ({
  getSession: () => ({ email: 'user@example.com' }),
  getUserAccess: () => 0,
}))

vi.mock('@/lib/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('@/hooks/dashboard', () => ({
  useDashboardDevices: () => ({
    devices: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}))

vi.mock('@/pages/dashboard/layouts/registry', () => {
  const React = require('react')
  return {
    getDashboardLayoutTheme: () => ({
      Layout: ({ children }: { children?: React.ReactNode }) =>
        React.createElement('div', { 'data-testid': 'layout' }, typeof children === 'function' ? children(null) : children),
    }),
    getDefaultDashboardLayoutThemeId: () => 'default',
    DASHBOARD_LAYOUT_THEME_STORAGE_KEY: 'test-layout',
  }
})

vi.mock('@/lib/dashboard-sections', () => ({
  getFirstSection: () => ({ key: 'device' }),
  getVisibleSections: () => [{ key: 'device' }, { key: 'bankcard' }, { key: 'users' }, { key: 'utility' }, { key: 'api' }],
  DASHBOARD_SECTION_STORAGE_KEY: 'test-section',
  showDeviceSidebarForSection: () => false,
}))

vi.mock('@/component/SectionNav', () => ({ SectionNav: () => <div>SectionNav</div> }))
vi.mock('@/pages/dashboard/views/DeviceSectionView', () => ({ DeviceSectionView: () => <div>DeviceSectionView</div> }))
vi.mock('@/pages/dashboard/views/BankcardSectionView', () => ({ BankcardSectionView: () => <div>BankcardSectionView</div> }))
vi.mock('@/pages/dashboard/views/UtilitySectionView', () => ({ UtilitySectionView: () => <div>UtilitySectionView</div> }))
vi.mock('@/pages/dashboard/views/ApiSectionView', () => ({ ApiSectionView: () => <div>ApiSectionView</div> }))
vi.mock('@/pages/dashboard/views/ProfileSectionView', () => ({ ProfileSectionView: () => <div>ProfileSectionView</div> }))
vi.mock('@/pages/dashboard/views/UserManagementSectionView', () => ({ UserManagementSectionView: () => <div>UserManagementSectionView</div> }))

describe('DashboardShell OAuth return', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const sessionStorageStore: Record<string, string> = {}
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((k: string) => sessionStorageStore[k] ?? null)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k: string, v: string) => {
      sessionStorageStore[k] = v
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((k: string) => {
      delete sessionStorageStore[k]
    })
  })

  it('shows Gmail connected toast and restores device from sessionStorage when google=connected', async () => {
    const searchParams = new URLSearchParams('google=connected&tab=google')
    ;(useSearchParams as ReturnType<typeof vi.fn>).mockReturnValue([searchParams, mockSetSearchParams])
    sessionStorage.setItem('dashboard_oauth_return_device_id', 'device-abc')

    render(<DashboardShell />)

    await vi.waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Gmail connected',
          description: 'You can use the Gmail tab.',
          variant: 'success',
        })
      )
    })

    expect(sessionStorage.removeItem).toHaveBeenCalledWith('dashboard_oauth_return_device_id')
  })

  it('cleans google, message, and tab from URL after handling OAuth return', async () => {
    const searchParams = new URLSearchParams('google=connected&tab=google')
    ;(useSearchParams as ReturnType<typeof vi.fn>).mockReturnValue([searchParams, mockSetSearchParams])

    render(<DashboardShell />)

    await vi.waitFor(() => {
      expect(mockSetSearchParams).toHaveBeenCalled()
    })
    const nextParams = mockSetSearchParams.mock.calls[0][0]
    expect(nextParams.get('google')).toBeNull()
    expect(nextParams.get('tab')).toBeNull()
  })
})
