/**
 * SMS Validation Schemas
 *
 * Validation for SMS-related operations (sending SMS, OTP, etc.)
 */

import { z } from 'zod'
import { phoneNumberSchema, otpSchema, nonEmptyStringSchema } from './common-validation'

/**
 * Schema for sending SMS
 */
export const sendSmsSchema = z.object({
  phoneNumber: phoneNumberSchema,
  otpValue: otpSchema,
  senderId: z.string().optional().default('47'),
})

export type SendSmsInput = z.infer<typeof sendSmsSchema>

/**
 * Schema for sending WhatsApp messages
 */
export const sendWhatsAppSchema = z.object({
  phoneNumber: phoneNumberSchema,
  message: nonEmptyStringSchema.max(1000, 'Message is too long (max 1000 characters)'),
  senderId: z.string().optional().default('47'),
})

export type SendWhatsAppInput = z.infer<typeof sendWhatsAppSchema>

/**
 * Schema for bulk SMS sending
 */
export const bulkSmsSchema = z.object({
  phoneNumbers: z
    .array(phoneNumberSchema)
    .min(1, 'At least one phone number is required')
    .max(100, 'Maximum 100 phone numbers allowed'),
  message: nonEmptyStringSchema.max(1000, 'Message is too long'),
  senderId: z.string().optional().default('47'),
})

export type BulkSmsInput = z.infer<typeof bulkSmsSchema>

/**
 * Validate SMS input
 */
export function validateSmsInput(data: unknown): {
  success: boolean
  data?: SendSmsInput
  error?: string
} {
  try {
    const validated = sendSmsSchema.parse(data)
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
