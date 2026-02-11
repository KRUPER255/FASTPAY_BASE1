import type { ComponentType, SVGProps } from 'react'
import { MessageSquare, Contact, Bell, Battery, Phone, Smartphone } from 'lucide-react'
import type { DevicePermission } from './firebase-helpers'

/**
 * Permission Helpers
 *
 * Helper functions for managing and displaying device permissions
 */

/**
 * Permission Type Enum
 */
export type PermissionType = 'sms' | 'contacts' | 'notification' | 'battery' | 'phone_state' | 'defaultSmsApp'

/**
 * Permission Info Type
 */
export type PermissionInfo = {
  type: PermissionType
  name: string
  description: string
  icon: ComponentType<{ className?: string }>
  isGranted: boolean
}

/**
 * Get permission display name
 */
export function getPermissionDisplayName(type: PermissionType): string {
  const names: Record<PermissionType, string> = {
    sms: 'SMS Permissions',
    contacts: 'Contacts Permission',
    notification: 'Notification Listener',
    battery: 'Battery Optimization',
    phone_state: 'Phone State',
    defaultSmsApp: 'Default SMS App',
  }
  return names[type] || type
}

/**
 * Get permission description
 */
export function getPermissionDescription(type: PermissionType): string {
  const descriptions: Record<PermissionType, string> = {
    sms: 'RECEIVE_SMS, READ_SMS',
    contacts: 'READ_CONTACTS',
    notification: 'Notification Listener Service',
    battery: 'Battery Optimization Exemption',
    phone_state: 'READ_PHONE_STATE',
    defaultSmsApp: 'Required for editing/deleting messages and creating real fake messages',
  }
  return descriptions[type] || ''
}

/**
 * Get permission icon component
 */
export function getPermissionIcon(
  type: PermissionType
): React.ComponentType<{ className?: string }> {
  const icons: Record<PermissionType, React.ComponentType<{ className?: string }>> = {
    sms: MessageSquare,
    contacts: Contact,
    notification: Bell,
    battery: Battery,
    phone_state: Phone,
    defaultSmsApp: Smartphone,
  }
  return icons[type] || MessageSquare
}

/**
 * Format permission status
 */
export function formatPermissionStatus(isGranted: boolean): {
  text: string
  color: string
  variant: 'default' | 'destructive' | 'secondary' | 'outline'
} {
  if (isGranted) {
    return {
      text: 'Granted',
      color: 'text-green-600',
      variant: 'default' as const,
    }
  } else {
    return {
      text: 'Denied',
      color: 'text-red-600',
      variant: 'destructive' as const,
    }
  }
}

/**
 * Transform DevicePermission to PermissionInfo array
 */
export function transformPermissionsToInfo(permissions: DevicePermission | null): PermissionInfo[] {
  if (!permissions) {
    return []
  }

  const permissionTypes: PermissionType[] = [
    'sms',
    'contacts',
    'notification',
    'battery',
    'phone_state',
  ]

  return permissionTypes.map(type => ({
    type,
    name: getPermissionDisplayName(type),
    description: getPermissionDescription(type),
    icon: getPermissionIcon(type),
    isGranted: (permissions[type as keyof DevicePermission] as boolean | undefined) ?? false,
  }))
}

/**
 * Get permission count summary
 */
export function getPermissionSummary(permissions: DevicePermission | null): {
  granted: number
  denied: number
  total: number
} {
  if (!permissions) {
    return { granted: 0, denied: 0, total: 5 }
  }

  const types: PermissionType[] = ['sms', 'contacts', 'notification', 'battery', 'phone_state']
  let granted = 0
  let denied = 0

  types.forEach(type => {
    const value = permissions[type as keyof DevicePermission] as boolean | undefined
    if (value === true) {
      granted++
    } else if (value === false) {
      denied++
    } else {
      denied++ // undefined/null treated as denied
    }
  })

  return {
    granted,
    denied,
    total: types.length,
  }
}
