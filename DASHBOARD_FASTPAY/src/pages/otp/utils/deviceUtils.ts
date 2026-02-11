// OTP-specific device utility functions

/**
 * Calculate time since last heartbeat
 */
export function getTimeSinceLastHeartbeat(
  lastSeen: number | undefined | null,
  currentTime: number
): number | null {
  if (!lastSeen) return null
  return currentTime - lastSeen
}

/**
 * Check if device missed heartbeats
 */
export function hasMissedHeartbeats(
  lastSeen: number | undefined | null,
  currentTime: number,
  heartbeatIntervalMs: number,
  missedHeartbeatThreshold: number
): boolean {
  if (!lastSeen) return true
  const timeSince = currentTime - lastSeen
  return timeSince >= heartbeatIntervalMs * missedHeartbeatThreshold
}

/**
 * Format elapsed time in a human-readable format
 */
export function formatElapsedTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

/**
 * Format timestamp for Last Seen: show "Connected" for < 20s, exact seconds for 20-59s, then minutes/hours
 */
export function formatLastSeen(timestamp: number, currentTime: number): string {
  try {
    // Validate timestamp
    if (!timestamp || typeof timestamp !== 'number' || isNaN(timestamp) || timestamp <= 0) {
      return 'Never'
    }

    const messageTime = timestamp
    const diffMs = currentTime - messageTime
    const diffSeconds = Math.floor(diffMs / 1000)

    // Handle future timestamps (clock sync issues) - treat as just happened
    if (diffSeconds < 0) {
      return 'Connected'
    }

    // If less than 20 seconds, show "Connected"
    if (diffSeconds < 20) {
      return 'Connected'
    }

    // For times 20-59 seconds old, show exact second count
    if (diffSeconds < 60) {
      return `${diffSeconds} seconds ago`
    }

    // For times 60 seconds to 120 seconds, show exact seconds
    if (diffSeconds <= 120) {
      return `${diffSeconds} seconds ago`
    }

    // For times older than 120 seconds, calculate minutes/hours manually to avoid "less than a minute"
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    } else if (diffMinutes >= 2) {
      // Minimum 2 minutes since we already handled < 120 seconds
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`
    }

    // This should never be reached, but if it is, show exact seconds as fallback
    return `${diffSeconds} seconds ago`
  } catch (error) {
    console.error('Error formatting lastSeen:', error, timestamp)
    return 'Never'
  }
}

/**
 * Format timestamp for messages: show exact seconds, no "Connected" status
 */
export function formatMessageTimestamp(timestamp: number, currentTime: number): string {
  try {
    const messageTime = timestamp
    const diffMs = currentTime - messageTime
    const diffSeconds = Math.floor(diffMs / 1000)

    // For times 0-59 seconds old, show exact second count
    if (diffSeconds >= 0 && diffSeconds < 60) {
      if (diffSeconds === 0) {
        return 'just now'
      } else if (diffSeconds === 1) {
        return '1 second ago'
      } else {
        return `${diffSeconds} seconds ago`
      }
    }

    // For times 60 seconds to 120 seconds, show exact seconds
    if (diffSeconds >= 60 && diffSeconds <= 120) {
      return `${diffSeconds} seconds ago`
    }

    // For times older than 120 seconds, calculate minutes/hours manually to avoid "less than a minute"
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    } else if (diffMinutes > 0) {
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`
    }

    // Fallback - should not reach here
    return 'Unknown'
  } catch {
    return 'Unknown'
  }
}
