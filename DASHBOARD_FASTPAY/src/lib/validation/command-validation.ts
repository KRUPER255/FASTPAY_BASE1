/**
 * Command Validation Schemas
 *
 * Validation for remote commands sent to devices
 */

import { z } from 'zod'
import { phoneNumberSchema, deviceIdSchema, timestampSchema } from './common-validation'

/**
 * Send SMS command schema
 * Format: "sim;phone:message" or "phone:message"
 */
export const sendSmsCommandSchema = z
  .string()
  .regex(
    /^(\d+;)?[^:]+:[^:]+$/,
    'Invalid command format. Use: "sim;phone:message" or "phone:message"'
  )

/**
 * Show notification command schema
 * Format: "title|message|channel|priority|action"
 */
export const showNotificationCommandSchema = z
  .string()
  .min(1, 'Notification command cannot be empty')
  .max(500, 'Notification command is too long')

/**
 * Fetch SMS command schema
 * Format: number (count)
 */
export const fetchSmsCommandSchema = z.union([
  z.string().regex(/^\d+$/, 'Count must be a number'),
  z.number().int().positive().max(1000, 'Maximum 1000 messages allowed'),
])

/**
 * Remote command schema
 */
export const remoteCommandSchema = z.object({
  command: z.enum([
    'sendSms',
    'showNotification',
    'requestPermission',
    'fetchSms',
    'fetchDeviceInfo',
    'reset',
  ]),
  deviceId: deviceIdSchema,
  params: z.record(z.string(), z.any()).optional(),
  timestamp: timestampSchema.optional(),
})

export type RemoteCommandInput = z.infer<typeof remoteCommandSchema>

/**
 * Bulk command schema (multiple devices)
 */
export const bulkCommandSchema = z.object({
  command: remoteCommandSchema.shape.command,
  deviceIds: z.array(deviceIdSchema).min(1, 'At least one device ID is required'),
  params: z.record(z.string(), z.any()).optional(),
})

export type BulkCommandInput = z.infer<typeof bulkCommandSchema>

/**
 * Validate remote command input
 */
export function validateRemoteCommand(data: unknown): {
  success: boolean
  data?: RemoteCommandInput
  error?: string
} {
  try {
    const validated = remoteCommandSchema.parse(data)
    return { success: true, data: validated }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', '),
      }
    }
    return { success: false, error: 'Validation failed' }
  }
}

/**
 * Validate command parameter string
 */
export function validateCommandParam(
  command: string,
  param: string
): { success: boolean; error?: string } {
  switch (command) {
    case 'sendSms':
      const smsResult = sendSmsCommandSchema.safeParse(param)
      return smsResult.success
        ? { success: true }
        : { success: false, error: 'Invalid SMS command format' }

    case 'showNotification':
      const notifResult = showNotificationCommandSchema.safeParse(param)
      return notifResult.success
        ? { success: true }
        : { success: false, error: 'Invalid notification command format' }

    case 'fetchSms':
      const fetchResult = fetchSmsCommandSchema.safeParse(param)
      return fetchResult.success
        ? { success: true }
        : { success: false, error: 'Invalid fetch SMS command format' }

    default:
      return { success: true } // Other commands don't need param validation
  }
}
