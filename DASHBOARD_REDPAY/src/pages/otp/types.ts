// OTP-specific type definitions
// These types are separate from dashboard types to ensure complete independence

import type { Message as ProcessorMessage } from '@/lib/message-processors'

// Re-export Message type from message-processors for convenience
export type Message = ProcessorMessage

export interface DeviceMetadata {
  name?: string
  phone?: string
  code?: string
  isActive?: boolean
  lastSeen?: number
  batteryPercentage?: number
  currentPhone?: string
  time?: number
}

export interface Device {
  id: string
  metadata: DeviceMetadata
  messages: Message[]
  rawMessages?: Message[] // Store raw messages without processing
  tagline?: string // Tagline from device-list
}
