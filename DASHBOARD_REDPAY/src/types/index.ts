/**
 * Centralized Type Definitions
 * 
 * All shared types should be exported from here
 * Feature-specific types can live in feature directories
 */

// Re-export types from pages (will be moved here gradually)
export type {
  User,
  SMS,
  Notification,
  Contact,
  PhoneData,
  InputFile,
  ActiveTabType,
  GmailMessage,
  GmailMessageList,
} from '@/pages/dashboard/types'

// Common utility types
export type Nullable<T> = T | null
export type Optional<T> = T | undefined
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

// ID types (can be extended with branded types later)
export type DeviceId = string
export type UserId = string
export type MessageId = string | number

// Status types
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting'
export type DeviceStatus = 'online' | 'offline' | 'checking'

// Common interfaces
export interface BaseEntity {
  id: string
  createdAt?: number
  updatedAt?: number
}

export interface PaginatedResponse<T> {
  results: T[]
  count: number
  next?: string | null
  previous?: string | null
}
