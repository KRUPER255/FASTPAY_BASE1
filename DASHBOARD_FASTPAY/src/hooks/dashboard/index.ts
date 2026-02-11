/**
 * Dashboard Hooks
 * 
 * Custom React hooks for dashboard functionality
 * Extracted from Dashboard.tsx for better organization and reusability
 */

export { useDashboardMessages } from './useDashboardMessages'
export type {
  UseDashboardMessagesParams,
  UseDashboardMessagesReturn,
} from './useDashboardMessages'

export { useDashboardNotifications } from './useDashboardNotifications'
export type {
  UseDashboardNotificationsParams,
  UseDashboardNotificationsReturn,
} from './useDashboardNotifications'

export { useDashboardContacts } from './useDashboardContacts'
export type {
  UseDashboardContactsParams,
  UseDashboardContactsReturn,
} from './useDashboardContacts'

export { useDashboardDevices } from './useDashboardDevices'
export type {
  UseDashboardDevicesParams,
  UseDashboardDevicesReturn,
} from './useDashboardDevices'

export { useDeviceMetadata } from './useDeviceMetadata'
export type {
  UseDeviceMetadataParams,
  UseDeviceMetadataReturn,
} from './useDeviceMetadata'

export { useDeviceStatus } from './useDeviceStatus'
export type {
  UseDeviceStatusParams,
  UseDeviceStatusReturn,
} from './useDeviceStatus'
export type { DeviceStatus } from './useDeviceStatus'
