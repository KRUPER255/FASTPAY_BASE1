import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GmailSection } from './GmailSection'

const mockInitGmailAuth = vi.fn()
const mockCheckGmailStatus = vi.fn()
const mockFetchGmailMessages = vi.fn()
const mockFetchGmailMessageDetail = vi.fn()
const mockDisconnectGmail = vi.fn()
const mockToast = vi.fn()

vi.mock('@/lib/auth', () => ({
  getSession: () => ({ email: 'user@example.com' }),
}))

vi.mock('@/lib/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('@/lib/backend-gmail-api', () => ({
  initGmailAuth: (...args: unknown[]) => mockInitGmailAuth(...args),
  checkGmailStatus: (...args: unknown[]) => mockCheckGmailStatus(...args),
  fetchGmailMessages: (...args: unknown[]) => mockFetchGmailMessages(...args),
  fetchGmailMessageDetail: (...args: unknown[]) => mockFetchGmailMessageDetail(...args),
  disconnectGmail: (...args: unknown[]) => mockDisconnectGmail(...args),
}))

describe('GmailSection', () => {
  const sessionStorageMock: Record<string, string> = {}
  const setItem = vi.fn((k: string, v: string) => {
    sessionStorageMock[k] = v
  })
  const getItem = vi.fn((k: string) => sessionStorageMock[k] ?? null)
  const removeItem = vi.fn((k: string) => {
    delete sessionStorageMock[k]
  })

  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(sessionStorageMock).forEach(k => delete sessionStorageMock[k])
    mockCheckGmailStatus.mockResolvedValue({ connected: false, gmail_email: null })
    mockInitGmailAuth.mockResolvedValue({ auth_url: 'https://accounts.google.com/oauth', expires_in: 600 })
    mockFetchGmailMessages.mockResolvedValue({
      messages: [],
      nextPageToken: undefined,
      resultSizeEstimate: 0,
    })
    mockFetchGmailMessageDetail.mockResolvedValue({
      id: '1',
      threadId: 't1',
      subject: 'Subject 1',
      fromEmail: 'alice@example.com',
      to: 'me@example.com',
      cc: '',
      bcc: '',
      date: '2024-01-01',
      plainText: 'Body text',
      html: '',
      attachments: [],
      labels: [],
    })
    Object.defineProperty(window, 'sessionStorage', {
      value: { setItem, getItem, removeItem },
      writable: true,
    })
    delete (window as { location?: { href: string } }).location
    window.location = { href: '' } as Location
  })

  it('shows Connect Gmail heading and button when not authenticated', async () => {
    render(<GmailSection deviceId="dev-1" isAdmin={true} />)
    await screen.findByRole('heading', { name: /Connect Gmail/i })
    expect(screen.getByRole('heading', { name: /Connect Gmail/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Connect Gmail/i })).toBeInTheDocument()
    expect(screen.getByText(/Connect your Gmail account/)).toBeInTheDocument()
    expect(screen.getByText(/Gmail and Drive access are granted in one step/)).toBeInTheDocument()
  })

  it('stores selected deviceId in sessionStorage before redirect when Connect Gmail is clicked', async () => {
    const user = userEvent.setup()
    render(<GmailSection deviceId="my-device-123" isAdmin={true} />)
    await screen.findByRole('heading', { name: /Connect Gmail/i })
    const connectButton = screen.getByRole('button', { name: /Connect Gmail/i })
    await user.click(connectButton)
    await vi.waitFor(() => {
      expect(mockInitGmailAuth).toHaveBeenCalled()
    })
    expect(setItem).toHaveBeenCalledWith('dashboard_oauth_return_device_id', 'my-device-123')
  })

  it('does not call sessionStorage.setItem for dashboard_oauth_return_device_id when deviceId is null', async () => {
    const user = userEvent.setup()
    render(<GmailSection deviceId={null} isAdmin={true} />)
    await screen.findByRole('heading', { name: /Connect Gmail/i })
    const connectButton = screen.getByRole('button', { name: /Connect Gmail/i })
    await user.click(connectButton)
    await vi.waitFor(() => {
      expect(mockInitGmailAuth).toHaveBeenCalled()
    })
    const oauthCalls = setItem.mock.calls.filter((c: string[]) => c[0] === 'dashboard_oauth_return_device_id')
    expect(oauthCalls).toHaveLength(0)
  })

  it('loads and displays emails when authenticated', async () => {
    mockCheckGmailStatus.mockResolvedValue({
      connected: true,
      gmail_email: 'inbox@example.com',
    })
    mockFetchGmailMessages.mockResolvedValue({
      messages: [
        {
          id: 'm1',
          thread_id: 't1',
          subject: 'Test subject',
          from_email: 'alice@example.com',
          snippet: 'Hello world',
          date: '2024-01-01',
          internal_date: '1704067200000',
          labels: ['INBOX'],
          is_read: true,
        },
      ],
      nextPageToken: undefined,
      resultSizeEstimate: 1,
    })

    render(<GmailSection deviceId="dev-1" isAdmin={true} />)

    await screen.findByText(/Gmail Inbox/i)
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('Test subject')).toBeInTheDocument()
  })

  it('loads email detail when a row is clicked', async () => {
    mockCheckGmailStatus.mockResolvedValue({
      connected: true,
      gmail_email: 'inbox@example.com',
    })
    mockFetchGmailMessages.mockResolvedValue({
      messages: [
        {
          id: 'm1',
          thread_id: 't1',
          subject: 'Detail subject',
          from_email: 'bob@example.com',
          snippet: 'Snippet only',
          date: '2024-01-02',
          internal_date: '1704153600000',
          labels: ['INBOX'],
          is_read: false,
        },
      ],
      nextPageToken: undefined,
      resultSizeEstimate: 1,
    })
    mockFetchGmailMessageDetail.mockResolvedValue({
      id: 'm1',
      threadId: 't1',
      subject: 'Detail subject',
      fromEmail: 'bob@example.com',
      to: 'me@example.com',
      cc: '',
      bcc: '',
      date: '2024-01-02',
      plainText: 'Full body text',
      html: '',
      attachments: [],
      labels: ['INBOX'],
    })

    const user = userEvent.setup()
    render(<GmailSection deviceId="dev-1" isAdmin={true} />)

    await screen.findByText('Detail subject')
    const row = screen.getByText('Detail subject')
    await user.click(row)

    await waitFor(() => {
      expect(mockFetchGmailMessageDetail).toHaveBeenCalledWith('user@example.com', 'm1')
    })

    await screen.findByText(/Email Details/i)
    expect(screen.getByText('Detail subject')).toBeInTheDocument()
    expect(screen.getByText(/Full body text/)).toBeInTheDocument()
  })

  it('shows a toast when loading emails fails', async () => {
    mockCheckGmailStatus.mockResolvedValue({
      connected: true,
      gmail_email: 'inbox@example.com',
    })
    mockFetchGmailMessages.mockRejectedValue(new Error('Gmail API disabled'))

    render(<GmailSection deviceId="dev-1" isAdmin={true} />)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalled()
    })

    const [toastArg] = mockToast.mock.calls[mockToast.mock.calls.length - 1]
    expect(toastArg.title).toBe('Error')
    expect(String(toastArg.description)).toContain('Gmail API disabled')
  })
})
