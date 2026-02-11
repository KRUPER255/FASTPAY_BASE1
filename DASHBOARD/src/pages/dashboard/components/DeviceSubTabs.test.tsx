import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeviceSubTabs } from './DeviceSubTabs'

describe('DeviceSubTabs', () => {
  const onTabChange = vi.fn()

  beforeEach(() => {
    onTabChange.mockClear()
  })

  it('renders Gmail tab with label "Gmail" (not Gmail / Drive)', () => {
    render(
      <DeviceSubTabs
        activeTab="message"
        onTabChange={onTabChange}
        deviceId="device-123"
      />
    )
    expect(screen.getByText('Gmail')).toBeInTheDocument()
    expect(screen.queryByText('Gmail / Drive')).not.toBeInTheDocument()
  })

  it('renders all device sub-tabs when deviceId is provided', () => {
    render(
      <DeviceSubTabs
        activeTab="google"
        onTabChange={onTabChange}
        deviceId="device-123"
      />
    )
    expect(screen.getByText('Message')).toBeInTheDocument()
    expect(screen.getByText('Gmail')).toBeInTheDocument()
    expect(screen.getByText('Data')).toBeInTheDocument()
    expect(screen.getByText('Utility')).toBeInTheDocument()
  })

  it('calls onTabChange when Gmail tab is clicked', async () => {
    const user = userEvent.setup()
    render(
      <DeviceSubTabs
        activeTab="message"
        onTabChange={onTabChange}
        deviceId="device-123"
      />
    )
    await user.click(screen.getByText('Gmail'))
    expect(onTabChange).toHaveBeenCalledWith('google')
  })

  it('returns null when deviceId is null', () => {
    const { container } = render(
      <DeviceSubTabs
        activeTab="message"
        onTabChange={onTabChange}
        deviceId={null}
      />
    )
    expect(container.firstChild).toBeNull()
  })
})
