// Shared types for Dashboard components

export interface User {
  id: string
  device: string | null
  phone: string | null
  code: string | null
  time: string | null
  admin: string | null
  lastSeen?: number | null
  batteryPercentage?: number | null
  isOnline?: boolean
  companyCode?: string | null
  companyName?: string | null
}

export interface SMS {
  id: number
  sender: string
  time: string
  is_sent: boolean
  body: string
  user: string | null
  timestamp?: number
  phone?: string
}

export interface Notification {
  id: number
  app: string
  time: string
  title: string
  body: string
  user: string | null
}

export interface Contact {
  phone: string
  name: string
}

export interface PhoneData {
  currentTime?: string
  version?: string
  battery?: string
  messages?: Array<{
    localNumber: string
    senderNumber: string
    receiveTime: string
    content: string
  }>
  htmlContent?: string
}

export interface InputFile {
  name: string
  url: string
  contentType: string
  time: string
  size: number
}

export type DashboardSectionType = 'device' | 'bankcard' | 'utility' | 'api' | 'users'

export type ActiveTabType =
  | 'overview'
  | 'sms'
  | 'notifications'
  | 'remote-messages'
  | 'contacts'
  | 'input'
  | 'devices'
  | 'analytics'
  | 'commands'
  | 'export'
  | 'permissions'
  | 'bank-info'
  | 'add-bank-card'
  | 'instructions-templates'
  | 'system-info'
  | 'gmail'
  | 'drive'
  | 'utilities'
  | 'bank-cards'
  | 'activation-failures'
  | 'activity-logs'
  | 'api'
  | 'telegram-bots'

export type DeviceSectionTab =
  | 'message'
  | 'google'
  | 'data'
  | 'utility'
  | 'command'
  | 'instruction'
  | 'permission'
  | 'company'

export interface GmailMessage {
  id: string
  threadId: string
  snippet: string
  payload: {
    headers: Array<{
      name: string
      value: string
    }>
    parts?: Array<{
      mimeType: string
      body: {
        data?: string
        size: number
      }
    }>
    body?: {
      data?: string
      size: number
    }
  }
  internalDate: string
  labelIds: string[]
}

export interface GmailMessageList {
  messages: Array<{
    id: string
    threadId: string
  }>
  nextPageToken?: string
  resultSizeEstimate: number
}