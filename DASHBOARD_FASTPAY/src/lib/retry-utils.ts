/**
 * Retry Utilities
 *
 * Provides retry logic with exponential backoff for failed operations.
 */

export interface RetryOptions {
  maxAttempts?: number
  initialDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
  retryable?: (error: any) => boolean
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    retryable = () => true,
  } = options

  let lastError: any
  let delay = initialDelay

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Check if error is retryable
      if (!retryable(error)) {
        throw error
      }

      // Don't retry on last attempt
      if (attempt === maxAttempts) {
        break
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay))

      // Increase delay for next attempt (exponential backoff)
      delay = Math.min(delay * backoffMultiplier, maxDelay)
    }
  }

  throw lastError
}

/**
 * Check if error is a network/connection error (retryable)
 */
export function isRetryableError(error: any): boolean {
  if (!error) return false

  const errorMessage = error.message?.toLowerCase() || ''
  const errorCode = error.code?.toLowerCase() || ''

  // Firebase connection errors
  if (errorCode.includes('network') || errorCode.includes('unavailable')) {
    return true
  }

  // Network errors
  if (
    errorMessage.includes('network') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('fetch')
  ) {
    return true
  }

  // HTTP 5xx errors
  if (
    errorCode.startsWith('5') ||
    errorMessage.includes('500') ||
    errorMessage.includes('502') ||
    errorMessage.includes('503')
  ) {
    return true
  }

  return false
}
