import { describe, it, expect, vi } from 'vitest'
import {
  fetchGmailMessages,
  fetchGmailMessageDetail,
  type GmailMessageList,
  type GmailMessageDetail,
} from './backend-gmail-api'

// Mock getApiUrl so we can assert on fetch URLs easily
vi.mock('./api-client', () => ({
  getApiUrl: (path: string) => `https://api.example.com${path}`,
}))

describe('backend-gmail-api', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('normalizes fetchGmailMessages response', async () => {
    const mockJson: GmailMessageList = {
      messages: [
        {
          id: 'm1',
          thread_id: 't1',
          subject: 'Subject',
          from_email: 'alice@example.com',
          snippet: 'Snippet',
          date: '2024-01-01',
          internal_date: '1704067200000',
          labels: ['INBOX'],
          is_read: true,
        },
      ],
      nextPageToken: 'next-token',
      resultSizeEstimate: 1,
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        messages: mockJson.messages,
        next_page_token: 'next-token',
        result_size_estimate: 1,
      }),
    } as unknown as Response)

    const result = await fetchGmailMessages('user@example.com', { max_results: 10 })

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/gmail/messages/?user_email=user%40example.com&max_results=10'
    )
    expect(result.messages).toHaveLength(1)
    expect(result.nextPageToken).toBe('next-token')
    expect(result.resultSizeEstimate).toBe(1)
  })

  it('maps fetchGmailMessageDetail response to GmailMessageDetail', async () => {
    const backendResponse = {
      id: 'm1',
      thread_id: 't1',
      subject: 'Detail subject',
      from_email: 'bob@example.com',
      to: 'me@example.com',
      cc: 'cc@example.com',
      bcc: '',
      date: '2024-01-02',
      plain_text: 'Plain body',
      html: '<p>HTML body</p>',
      attachments: [
        {
          filename: 'file.txt',
          mime_type: 'text/plain',
          size: 1024,
          attachment_id: 'att-1',
        },
      ],
      labels: ['INBOX'],
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => backendResponse,
    } as unknown as Response)

    const detail: GmailMessageDetail = await fetchGmailMessageDetail('user@example.com', 'm1')

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/gmail/messages/m1/?user_email=user%40example.com'
    )
    expect(detail.id).toBe('m1')
    expect(detail.threadId).toBe('t1')
    expect(detail.subject).toBe('Detail subject')
    expect(detail.fromEmail).toBe('bob@example.com')
    expect(detail.to).toBe('me@example.com')
    expect(detail.cc).toBe('cc@example.com')
    expect(detail.plainText).toBe('Plain body')
    expect(detail.html).toBe('<p>HTML body</p>')
    expect(detail.attachments).toHaveLength(1)
    expect(detail.attachments[0].filename).toBe('file.txt')
  })
})
