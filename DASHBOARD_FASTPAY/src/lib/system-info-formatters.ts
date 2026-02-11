/**
 * System Info Formatters
 *
 * Helper functions to format system info data for display
 */

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || isNaN(bytes)) {
    return 'N/A'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`
}

/**
 * Format percentage
 */
export function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A'
  }
  return `${value.toFixed(1)}%`
}

/**
 * Format uptime to human-readable string
 */
export function formatUptime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || isNaN(seconds)) {
    return 'N/A'
  }

  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`
  } else {
    return `${secs}s`
  }
}

/**
 * Format battery health
 */
export function formatBatteryHealth(value: number | string | null | undefined): string {
  if (value === null || value === undefined) {
    return 'Unknown'
  }

  if (typeof value === 'string') {
    return value
  }

  const healthMap: Record<number, string> = {
    1: 'Unknown',
    2: 'Good',
    3: 'Overheat',
    4: 'Dead',
    5: 'Over Voltage',
    6: 'Unspecified Failure',
    7: 'Cold',
  }

  return healthMap[value] || 'Unknown'
}

/**
 * Format network type
 */
export function formatNetworkType(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return 'Unknown'
  }

  if (typeof value === 'string') {
    return value
  }

  const typeMap: Record<number, string> = {
    0: 'Unknown',
    1: 'GPRS',
    2: 'EDGE',
    3: 'UMTS',
    4: 'CDMA',
    5: 'EVDO_0',
    6: 'EVDO_A',
    7: '1xRTT',
    8: 'HSDPA',
    9: 'HSUPA',
    10: 'HSPA',
    11: 'IDEN',
    12: 'EVDO_B',
    13: 'LTE',
    14: 'EHRPD',
    15: 'HSPAP',
    16: 'GSM',
    17: 'TD_SCDMA',
    18: 'IWLAN',
    19: 'LTE_CA',
    20: 'NR',
  }

  return typeMap[value] || `Type ${value}`
}

/**
 * Format SIM state
 */
export function formatSimState(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return 'Unknown'
  }

  const stateMap: Record<number, string> = {
    0: 'Unknown',
    1: 'Absent',
    2: 'Pin Required',
    3: 'Puk Required',
    4: 'Network Locked',
    5: 'Ready',
  }

  return stateMap[value] || 'Unknown'
}

/**
 * Format temperature
 */
export function formatTemperature(value: number | null | undefined, unit: 'C' | 'F' = 'C'): string {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A'
  }

  // Temperature is typically in tenths of degrees Celsius
  const celsius = value / 10

  if (unit === 'F') {
    const fahrenheit = (celsius * 9) / 5 + 32
    return `${fahrenheit.toFixed(1)}°F`
  }

  return `${celsius.toFixed(1)}°C`
}

/**
 * Format voltage
 */
export function formatVoltage(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A'
  }

  // Voltage is typically in millivolts
  return `${value} mV`
}

/**
 * Format timestamp
 */
export function formatTimestamp(timestamp: number | null | undefined): string {
  if (timestamp === null || timestamp === undefined || isNaN(timestamp)) {
    return 'N/A'
  }

  try {
    return new Date(timestamp).toLocaleString('en-US')
  } catch (err) {
    return 'Invalid Date'
  }
}

/**
 * Format relative time
 */
export function formatRelativeTime(timestamp: number | null | undefined): string {
  if (timestamp === null || timestamp === undefined || isNaN(timestamp)) {
    return 'N/A'
  }

  try {
    // Use formatTimestamp for now to avoid async issues
    // Can be enhanced later with dynamic import if needed
    return formatTimestamp(timestamp)
  } catch (err) {
    return formatTimestamp(timestamp)
  }
}
