import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeviceSectionTabs } from './DeviceSectionTabs'

describe('DeviceSectionTabs', () => {
  const onTabChange = vi.fn()

  beforeEach(() => {
    onTabChange.mockClear()
  })

  it('renders Gmail tab with label "Gmail" (not Gmail / Drive)', () => {
    render(
      <DeviceSectionTabs
        activeTab="message"
        onTabChange={onTabChange}
        deviceId="device-123"
      />
    )
    expect(screen.getByText('Gmail')).toBeInTheDocument()
    expect(screen.queryByText('Gmail / Drive')).not.toBeInTheDocument()
  })

  it('renders all device section tabs when deviceId is provided', () => {
    render(
      <DeviceSectionTabs
        activeTab="google"
        onTabChange={onTabChange}
        deviceId="device-123"
      />
    )
    expect(screen.getByText('Message')).toBeInTheDocument()
    expect(screen.getByText('Gmail')).toBeInTheDocument()
    expect(screen.getByText('Command')).toBeInTheDocument()
    expect(screen.getByText('Instruction')).toBeInTheDocument()
    expect(screen.getByText('Permission')).toBeInTheDocument()
  })

  it('calls onTabChange when Gmail tab is clicked', async () => {
    const user = userEvent.setup()
    render(
      <DeviceSectionTabs
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
      <DeviceSectionTabs
        activeTab="message"
        onTabChange={onTabChange}
        deviceId={null}
      />
    )
    expect(container.firstChild).toBeNull()
  })
})
