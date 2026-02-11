/**
 * System Info Types
 *
 * TypeScript interfaces for all system info subtasks
 * Based on Android DeviceInfoCollector (18 subtasks)
 */

// ============================================================================
// SUBTASK 1: BUILD INFORMATION
// ============================================================================

export interface BuildInfo {
  manufacturer?: string
  product?: string
  device?: string
  hardware?: string
  board?: string
  bootloader?: string
  radioVersion?: string
  serialNumber?: string
  buildId?: string
  buildType?: string
  buildTags?: string
  buildFingerprint?: string
  buildTime?: number
  buildUser?: string
  buildHost?: string
  androidVersion?: string
  sdkVersion?: number
  codename?: string
  incremental?: string
  securityPatch?: string
  previewSdk?: number
  model?: string
}

// ============================================================================
// SUBTASK 2: DISPLAY INFORMATION
// ============================================================================

export interface DisplayInfo {
  width?: number
  height?: number
  density?: number
  densityDpi?: number
  scaledDensity?: number
  xdpi?: number
  ydpi?: number
  refreshRate?: number
  pixelFormat?: number
}

// ============================================================================
// SUBTASK 3: STORAGE INFORMATION
// ============================================================================

export interface StorageInfo {
  totalInternal?: number
  freeInternal?: number
  usedInternal?: number
  totalExternal?: number
  freeExternal?: number
  usedExternal?: number
}

// ============================================================================
// SUBTASK 4: MEMORY INFORMATION
// ============================================================================

export interface MemoryInfo {
  totalRAM?: number
  availableRAM?: number
  usedRAM?: number
  ramUsagePercent?: number
  lowMemoryThreshold?: number
  isLowMemory?: boolean
  appMaxMemory?: number
  appTotalMemory?: number
  appFreeMemory?: number
  appUsedMemory?: number
  availableProcessors?: number
}

// ============================================================================
// SUBTASK 5: BATTERY INFORMATION
// ============================================================================

export interface BatteryInfo {
  batteryPercentage?: number
  isCharging?: boolean
  chargeCounter?: number
  currentAverage?: number
  currentNow?: number
  energyCounter?: number
  health?: string
  temperature?: number
  voltage?: number
  technology?: string
  status?: string
}

// ============================================================================
// SUBTASK 6: NETWORK INFORMATION
// ============================================================================

export interface NetworkInfo {
  isConnected?: boolean
  networkType?: string
  isMobile?: boolean
  isWifi?: boolean
  isRoaming?: boolean
  operatorName?: string
  operatorCode?: string
  countryIso?: string
  networkOperator?: string
  simOperator?: string
}

// ============================================================================
// SUBTASK 7: SIM/PHONE INFORMATION
// ============================================================================

export interface SimInfo {
  state?: number
  countryIso?: string
  operatorName?: string
  operatorCode?: string
  phoneNumber?: string
  networkType?: number
  dataState?: number
  isDataEnabled?: boolean
  simSerialNumber?: string
  subscriberId?: string
}

// ============================================================================
// SUBTASK 8: SYSTEM SETTINGS
// ============================================================================

export interface SystemSettings {
  locale?: string
  timezone?: string
  language?: string
  country?: string
  dateFormat?: string
  timeFormat?: string
}

// ============================================================================
// SUBTASK 9: RUNTIME INFORMATION
// ============================================================================

export interface RuntimeInfo {
  javaVersion?: string
  uptime?: number
  totalMemory?: number
  freeMemory?: number
  maxMemory?: number
  availableProcessors?: number
}

// ============================================================================
// SUBTASK 10: DEVICE FEATURES
// ============================================================================

export interface DeviceFeatures {
  hasCamera?: boolean
  hasGps?: boolean
  hasNfc?: boolean
  hasBluetooth?: boolean
  hasWifi?: boolean
  hasTelephony?: boolean
  hasSensors?: boolean
  cameraCount?: number
  [key: string]: boolean | number | undefined
}

// ============================================================================
// SUBTASK 11: POWER MANAGEMENT
// ============================================================================

export interface PowerManagement {
  batterySaverEnabled?: boolean
  dozeModeEnabled?: boolean
  appStandbyEnabled?: boolean
  isIgnoringBatteryOptimizations?: boolean
}

// ============================================================================
// SUBTASK 12: BOOT INFORMATION
// ============================================================================

export interface BootInfo {
  bootTime?: number
  uptime?: number
  lastBootTime?: string
}

// ============================================================================
// SUBTASK 13: PERFORMANCE METRICS
// ============================================================================

export interface PerformanceMetrics {
  cpuUsage?: number
  gpuUsage?: number
  memoryUsage?: number
  diskUsage?: number
}

// ============================================================================
// MAIN SYSTEM INFO INTERFACE
// ============================================================================

export interface SystemInfo {
  buildInfo?: BuildInfo
  displayInfo?: DisplayInfo
  storageInfo?: StorageInfo
  memoryInfo?: MemoryInfo
  batteryInfo?: BatteryInfo
  networkInfo?: NetworkInfo
  phoneSimInfo?: SimInfo
  systemSettings?: SystemSettings
  runtimeInfo?: RuntimeInfo
  deviceFeatures?: DeviceFeatures
  powerManagement?: PowerManagement
  bootInfo?: BootInfo
  performanceMetrics?: PerformanceMetrics
}

// ============================================================================
// DEVICE INFO FETCH INTERFACE (for fetchDeviceInfo command response)
// ============================================================================
// Note: DeviceInfoFetch is now defined locally in SystemInfoPanel.tsx
// to avoid Vite module resolution issues
