/**
 * Authentication Validation Schemas
 *
 * Validation for authentication-related operations (login, password, etc.)
 */

import { z } from 'zod'
import { emailSchema, nonEmptyStringSchema } from './common-validation'

/**
 * Password validation schema
 * Requirements: min 6 characters, at least one letter and one number
 */
export const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .max(100, 'Password is too long')
  .regex(/^(?=.*[A-Za-z])(?=.*\d)/, 'Password must contain at least one letter and one number')

/**
 * Login schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: nonEmptyStringSchema,
})

export type LoginInput = z.infer<typeof loginSchema>

/**
 * Optional password schema (for updates where password might not change)
 */
export const optionalPasswordSchema = passwordSchema.optional()

/**
 * User access level schema (0 = admin, 1 = OTP only, 2 = RedPay only)
 */
export const accessLevelSchema = z.union([
  z.literal(0), // Full access (admin)
  z.literal(1), // OTP only
  z.literal(2), // RedPay only
])

export type AccessLevel = z.infer<typeof accessLevelSchema>

/**
 * Validate login input
 */
export function validateLoginInput(data: unknown): {
  success: boolean
  data?: LoginInput
  error?: string
} {
  try {
    const validated = loginSchema.parse(data)
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
 * Validate access level
 */
export function validateAccessLevel(level: unknown): {
  success: boolean
  level?: AccessLevel
  error?: string
} {
  try {
    const validated = accessLevelSchema.parse(level)
    return { success: true, level: validated }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e: z.ZodIssue) => e.message).join(', '),
      }
    }
    return { success: false, error: 'Invalid access level' }
  }
}
