/**
 * Common Validation Schemas
 *
 * Shared validation utilities used across multiple modules
 */

import { z } from 'zod'

/**
 * Email validation schema
 */
export const emailSchema = z
  .string()
  .email('Invalid email address')
  .min(1, 'Email is required')
  .max(255, 'Email is too long')

/**
 * Phone number validation schema
 * Supports international format: +1234567890 or 1234567890
 */
export const phoneNumberSchema = z
  .string()
  .min(10, 'Phone number must be at least 10 digits')
  .max(15, 'Phone number must be at most 15 digits')
  .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format. Use international format: +1234567890')

/**
 * OTP validation schema
 * Supports 4-8 digit OTP codes
 */
export const otpSchema = z
  .string()
  .regex(/^\d{4,8}$/, 'OTP must be 4-8 digits')
  .min(4, 'OTP must be at least 4 digits')
  .max(8, 'OTP must be at most 8 digits')

/**
 * Timestamp validation schema
 */
export const timestampSchema = z
  .number()
  .int('Timestamp must be an integer')
  .positive('Timestamp must be positive')
  .max(Date.now() + 86400000, 'Timestamp cannot be more than 24 hours in the future')

/**
 * Non-empty string schema
 */
export const nonEmptyStringSchema = z.string().min(1, 'This field is required').trim()

/**
 * Optional non-empty string schema
 */
export const optionalNonEmptyStringSchema = z.string().trim().optional()

/**
 * Device ID validation schema
 */
export const deviceIdSchema = z
  .string()
  .min(1, 'Device ID is required')
  .max(100, 'Device ID is too long')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Device ID contains invalid characters')

/**
 * Activation code validation schema
 */
export const activationCodeSchema = z
  .string()
  .min(1, 'Activation code is required')
  .max(50, 'Activation code is too long')
  .regex(/^[A-Z0-9_-]+$/i, 'Activation code contains invalid characters')
