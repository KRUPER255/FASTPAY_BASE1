import { useState, useRef, useCallback, useEffect } from 'react'
import { useToast } from '@/lib/use-toast'
import { generateOTP } from '@/pages/otp/utils/messageUtils'

export interface LastSentOTP {
  phone: string
  otp: string
}

export interface UseOTPSendReturn {
  lastSentOTP: LastSentOTP | null
  sendOTP: (phoneNumber: string) => Promise<{ success: boolean; otp?: string; error?: string }>
}

/**
 * Custom hook for sending OTP messages
 * Handles OTP generation and SMS sending with fallback mechanisms
 */
export function useOTPSend(): UseOTPSendReturn {
  const { toast } = useToast()
  const [lastSentOTP, setLastSentOTP] = useState<LastSentOTP | null>(null)
  const otpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sendOTP = useCallback(
    async (phoneNumber: string): Promise<{ success: boolean; otp?: string; error?: string }> => {
      // Generate random 6-digit OTP
      const otpValue = generateOTP()

      // Clear any existing timeout
      if (otpTimeoutRef.current) {
        clearTimeout(otpTimeoutRef.current)
      }

      try {
        // Try serverless function first, with fallback to direct API
        let response: Response
        let data: any

        try {
          // Determine API URL based on environment
          let apiUrl = '/api/send-sms'
          
          if (import.meta.env.DEV) {
            apiUrl = 'http://localhost:3001/api/send-sms'
          } else {
            apiUrl = '/api/send-sms'
          }
          
          response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sender_id: '47',
              variables_values: otpValue,
              numbers: phoneNumber.replace(/\D/g, ''),
            }),
          })

          // Get response as text first to check if it's HTML
          const responseText = await response.text()

          // Check if it's an HTML error page
          if (
            responseText.trim().toLowerCase().startsWith('<!doctype') ||
            responseText.trim().toLowerCase().startsWith('<html') ||
            responseText.includes('<!DOCTYPE') ||
            responseText.includes('<html')
          ) {
            throw new Error('Serverless function returned HTML error page')
          }

          // Try to parse as JSON
          try {
            data = JSON.parse(responseText)
          } catch (parseError) {
            if (!response.ok) {
              throw new Error('Serverless function returned non-JSON error')
            }
            throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}`)
          }
        } catch (serverlessError) {
          // Fallback to direct API call
          console.warn('Serverless function failed, trying direct API call:', serverlessError)

          try {
            const directResponse = await fetch('https://blacksms.in/sms', {
              method: 'POST',
              headers: {
                Authorization: 'e462fb93354afaef64ed5b40e91ee6ff',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                sender_id: '47',
                variables_values: otpValue,
                numbers: phoneNumber.replace(/\D/g, ''),
              }),
            })

            const directText = await directResponse.text()

            // Check if direct API also returned HTML
            if (
              directText.trim().toLowerCase().startsWith('<!doctype') ||
              directText.trim().toLowerCase().startsWith('<html') ||
              directText.includes('<!DOCTYPE') ||
              directText.includes('<html')
            ) {
              throw new Error('Direct API also returned HTML error page')
            }

            // Parse direct API response
            try {
              data = JSON.parse(directText)
            } catch (parseError) {
              throw new Error(`Invalid JSON from direct API: ${directText.substring(0, 100)}`)
            }
          } catch (directApiError) {
            const errorMsg = directApiError instanceof Error ? directApiError.message : 'Unknown error'
            let helpfulMsg = `Both serverless function and direct API failed. Last error: ${errorMsg}`
            
            if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
              helpfulMsg += '\n\n💡 Troubleshooting:'
              if (import.meta.env.DEV) {
                helpfulMsg += '\n1. Make sure Express server is running: npm run server'
                helpfulMsg += '\n2. Check if CORS is blocking the request'
              } else {
                helpfulMsg += '\n1. Check if serverless function is deployed correctly'
                helpfulMsg += '\n2. Verify API route is accessible at /api/send-sms'
              }
              helpfulMsg += '\n3. Verify network connection'
            }
            
            throw new Error(helpfulMsg)
          }
        }

        // Check for success: status === 1
        if (data.status === 1) {
          // Show OTP in button for 30 seconds
          setLastSentOTP({ phone: phoneNumber, otp: otpValue })

          // Clear OTP display after 30 seconds
          otpTimeoutRef.current = setTimeout(() => {
            setLastSentOTP(null)
          }, 30000)

          toast({
            title: '✅ OTP Sent Successfully',
            description: `OTP code ${otpValue} has been sent to ${phoneNumber}. The code will be displayed for 30 seconds.`,
            variant: 'success',
          })

          return { success: true, otp: otpValue }
        } else {
          // Handle failure: status === 0 or any other status
          const errorMessage = data.message || data.error || 'Failed to send OTP'
          let errorTitle = '❌ Failed to Send OTP'
          let errorDescription = errorMessage

          // Provide more specific error messages
          if (errorMessage.includes('Invalid') || errorMessage.includes('invalid')) {
            errorDescription = `Invalid phone number format: ${phoneNumber}. Please check the number and try again.`
          } else if (errorMessage.includes('limit') || errorMessage.includes('quota')) {
            errorDescription = 'SMS sending limit reached. Please try again later.'
          } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
            errorDescription = 'Network error. Please check your connection and try again.'
          } else if (errorMessage.includes('unauthorized') || errorMessage.includes('auth')) {
            errorDescription = 'Authentication failed. Please contact support.'
          }

          toast({
            title: errorTitle,
            description: errorDescription,
            variant: 'destructive',
          })

          return { success: false, error: errorDescription }
        }
      } catch (error) {
        console.error('Error sending SMS:', error)

        let errorDescription = 'Failed to send OTP. Please try again.'
        let errorTitle = '❌ Failed to Send OTP'

        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          errorDescription = 'Network connection failed. Please check your internet connection and try again.'
        } else if (error instanceof SyntaxError) {
          errorDescription = 'Invalid response from server. The API may be unavailable. Please try again or contact support.'
        } else if (error instanceof Error) {
          if (error.message.includes('error page') || error.message.includes('not available')) {
            errorDescription = 'API endpoint is not available. Please check server configuration or contact support.'
          } else if (error.message.includes('Invalid response')) {
            errorDescription = 'Server returned an unexpected response. Please try again or contact support.'
          } else {
            errorDescription = `Error: ${error.message}. Please try again.`
          }
        }

        toast({
          title: errorTitle,
          description: errorDescription,
          variant: 'destructive',
        })

        return { success: false, error: errorDescription }
      }
    },
    [toast]
  )

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (otpTimeoutRef.current) {
        clearTimeout(otpTimeoutRef.current)
      }
    }
  }, [])

  return { lastSentOTP, sendOTP }
}
