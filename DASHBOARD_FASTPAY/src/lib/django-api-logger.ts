import { getApiUrl } from '@/lib/api-client'

/**
 * Django API Logger
 * Intercepts and logs Django API calls for monitoring and debugging
 */

export interface DjangoApiLog {
  id: string
  timestamp: number
  method: string
  url: string
  status?: number
  statusText?: string
  requestHeaders?: Record<string, string>
  requestBody?: any
  responseBody?: any
  responseTime?: number
  error?: string
}

class DjangoApiLogger {
  private logs: DjangoApiLog[] = []
  private maxLogs = 1000 // Maximum number of logs to keep
  private listeners: Set<(logs: DjangoApiLog[]) => void> = new Set()
  private originalFetch: typeof fetch

  constructor() {
    this.originalFetch = window.fetch
    this.interceptFetch()
  }

  /**
   * Intercept fetch calls to Django API endpoints
   */
  private interceptFetch() {
    const self = this
    const API_BASE_URL = getApiUrl('/')

    window.fetch = async function (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      
      // Check if this is a Django API call
      const isDjangoApiCall = 
        url.includes('/api/') || 
        url.includes(API_BASE_URL) ||
        url.includes('dashboard-login') ||
        url.includes('bank-cards') ||
        url.includes('gmail/') ||
        url.includes('drive/') ||
        url.includes('devices/') ||
        url.includes('autoreplylog')

      if (!isDjangoApiCall) {
        // Not a Django API call, use original fetch
        return self.originalFetch.call(window, input, init)
      }

      // Log the request
      const logId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const startTime = performance.now()
      const method = init?.method || 'GET'
      
      const log: DjangoApiLog = {
        id: logId,
        timestamp: Date.now(),
        method,
        url,
        requestHeaders: init?.headers ? self.parseHeaders(init.headers) : undefined,
        requestBody: init?.body ? self.parseBody(init.body) : undefined,
      }

      try {
        // Make the actual fetch call
        const response = await self.originalFetch.call(window, input, init)
        const endTime = performance.now()
        const responseTime = endTime - startTime

        // Clone response to read body without consuming it
        const clonedResponse = response.clone()
        
        // Try to parse response body
        let responseBody: any = null
        try {
          const contentType = response.headers.get('content-type')
          if (contentType?.includes('application/json')) {
            responseBody = await clonedResponse.json()
          } else {
            const text = await clonedResponse.text()
            if (text) {
              responseBody = text
            }
          }
        } catch (e) {
          // Failed to parse response body, that's okay
        }

        // Update log with response
        log.status = response.status
        log.statusText = response.statusText
        log.responseBody = responseBody
        log.responseTime = responseTime

        self.addLog(log)
        return response
      } catch (error) {
        const endTime = performance.now()
        const responseTime = endTime - startTime

        log.error = error instanceof Error ? error.message : String(error)
        log.responseTime = responseTime

        self.addLog(log)
        throw error
      }
    }
  }

  /**
   * Parse headers from Headers object or plain object
   */
  private parseHeaders(headers: HeadersInit): Record<string, string> {
    if (headers instanceof Headers) {
      const result: Record<string, string> = {}
      headers.forEach((value, key) => {
        result[key] = value
      })
      return result
    } else if (Array.isArray(headers)) {
      return Object.fromEntries(headers)
    } else {
      return headers as Record<string, string>
    }
  }

  /**
   * Parse request body
   */
  private parseBody(body: BodyInit | null): any {
    if (!body) return undefined
    
    if (typeof body === 'string') {
      try {
        return JSON.parse(body)
      } catch {
        return body
      }
    } else if (body instanceof FormData) {
      const result: Record<string, any> = {}
      body.forEach((value, key) => {
        result[key] = value
      })
      return result
    } else if (body instanceof URLSearchParams) {
      return Object.fromEntries(body)
    }
    
    return undefined
  }

  /**
   * Add a log entry
   */
  private addLog(log: DjangoApiLog) {
    this.logs.unshift(log) // Add to beginning
    
    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs)
    }

    // Notify listeners
    this.notifyListeners()
  }

  /**
   * Get all logs
   */
  getLogs(): DjangoApiLog[] {
    return [...this.logs]
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = []
    this.notifyListeners()
  }

  /**
   * Subscribe to log updates
   */
  subscribe(listener: (logs: DjangoApiLog[]) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Notify all listeners
   */
  private notifyListeners() {
    const logs = this.getLogs()
    this.listeners.forEach(listener => {
      try {
        listener(logs)
      } catch (error) {
        console.error('Error in Django API logger listener:', error)
      }
    })
  }

  /**
   * Get logs filtered by criteria
   */
  getFilteredLogs(filters: {
    method?: string
    status?: number
    urlContains?: string
    hasError?: boolean
  }): DjangoApiLog[] {
    return this.logs.filter(log => {
      if (filters.method && log.method !== filters.method) return false
      if (filters.status !== undefined && log.status !== filters.status) return false
      if (filters.urlContains && !log.url.includes(filters.urlContains)) return false
      if (filters.hasError !== undefined) {
        const hasError = !!log.error || (log.status !== undefined && log.status >= 400)
        if (hasError !== filters.hasError) return false
      }
      return true
    })
  }
}

// Create singleton instance
export const djangoApiLogger = new DjangoApiLogger()

// Initialize logger when module is imported
if (typeof window !== 'undefined') {
  // Logger is already initialized in constructor
}
