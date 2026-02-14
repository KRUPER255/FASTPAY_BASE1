/**
 * Dashboard branding: app name and tagline.
 * Use for login, logo, and any visible app name so RedPay builds show "RedPay" when VITE_REDPAY_ONLY=true.
 */
const REDPAY_ONLY = import.meta.env.VITE_REDPAY_ONLY === 'true'
const OVERRIDE_NAME = import.meta.env.VITE_APP_NAME

export const APP_NAME = OVERRIDE_NAME || (REDPAY_ONLY ? 'REDPAY' : 'FASTPAY')
export const DEFAULT_TAGLINE = REDPAY_ONLY ? 'The Real Gaming Platform' : 'The Real Gaming Platform'

export function getAppName(): string {
  return APP_NAME
}

export function getDefaultTagline(): string {
  return DEFAULT_TAGLINE
}
