import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { DevicesSection } from '@/pages/dashboard/components/DevicesSection'
import { UtilitiesSection } from '@/pages/dashboard/components/UtilitiesSection'

vi.mock('@/pages/dashboard/components/BankCardsList', () => ({
  BankCardsList: () => <div>BankCardsList</div>,
}))

vi.mock('@/component/DeviceListManager', () => ({
  default: () => <div>DeviceListManager</div>,
}))

vi.mock('@/component/TemplateManager', () => ({
  default: () => <div>TemplateManager</div>,
}))

const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => [],
})

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  localStorage.setItem(
    'fastpay_admin_session',
    JSON.stringify({ email: 'admin@example.com', timestamp: Date.now(), access: 0 })
  )
})

afterEach(() => {
  mockFetch.mockClear()
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('Dashboard sections', () => {
  it('renders DevicesSection header and tabs', () => {
    render(<DevicesSection onDeviceSelect={vi.fn()} />)
    expect(screen.getByText('Devices & Bank Cards')).toBeInTheDocument()
    expect(screen.getByText('Bank Cards')).toBeInTheDocument()
    expect(screen.getByText('Devices')).toBeInTheDocument()
  })

  it('renders UtilitiesSection header and template manager', () => {
    render(<UtilitiesSection />)
    expect(screen.getByText('Utilities')).toBeInTheDocument()
    expect(screen.getByText('Template Manager')).toBeInTheDocument()
  })
})
