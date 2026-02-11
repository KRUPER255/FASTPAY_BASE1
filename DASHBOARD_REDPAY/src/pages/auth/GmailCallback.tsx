import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { exchangeCodeForToken, storeGmailToken } from '@/lib/gmail-api'
import { useToast } from '@/lib/use-toast'
import { ToastAction } from '@/component/ui/toast'
import { Copy } from 'lucide-react'
import { Loader } from 'lucide-react'

/**
 * Gmail OAuth Callback Handler
 * This component handles the OAuth callback from Google after user authorizes access
 */
export default function GmailCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code')
      const error = searchParams.get('error')
      const state = searchParams.get('state')

      // Check for errors
      if (error) {
        const errorMessage = `Google OAuth error: ${error}`
        toast({
          title: 'Authentication Failed',
          description: errorMessage,
          variant: 'destructive',
          action: (
            <ToastAction
              altText="Copy error"
              onClick={async (e) => {
                e.preventDefault()
                e.stopPropagation()
                try {
                  // Try modern clipboard API first
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(errorMessage)
                  } else {
                    // Fallback for older browsers
                    const textArea = document.createElement('textarea')
                    textArea.value = errorMessage
                    textArea.style.position = 'fixed'
                    textArea.style.left = '-999999px'
                    textArea.style.top = '-999999px'
                    document.body.appendChild(textArea)
                    textArea.focus()
                    textArea.select()
                    document.execCommand('copy')
                    textArea.remove()
                  }
                  toast({
                    title: 'Copied',
                    description: 'Error message copied to clipboard',
                  })
                } catch (err) {
                  console.error('Failed to copy:', err)
                  toast({
                    title: 'Copy Failed',
                    description: 'Could not copy to clipboard. Please copy manually.',
                    variant: 'destructive',
                  })
                }
              }}
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </ToastAction>
          ),
        })
        navigate('/dashboard?tab=gmail')
        return
      }

      // Check for authorization code
      if (!code) {
        const errorMessage = 'No authorization code received'
        toast({
          title: 'Authentication Failed',
          description: errorMessage,
          variant: 'destructive',
          action: (
            <ToastAction
              altText="Copy error"
              onClick={async (e) => {
                e.preventDefault()
                e.stopPropagation()
                try {
                  // Try modern clipboard API first
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(errorMessage)
                  } else {
                    // Fallback for older browsers
                    const textArea = document.createElement('textarea')
                    textArea.value = errorMessage
                    textArea.style.position = 'fixed'
                    textArea.style.left = '-999999px'
                    textArea.style.top = '-999999px'
                    document.body.appendChild(textArea)
                    textArea.focus()
                    textArea.select()
                    document.execCommand('copy')
                    textArea.remove()
                  }
                  toast({
                    title: 'Copied',
                    description: 'Error message copied to clipboard',
                  })
                } catch (err) {
                  console.error('Failed to copy:', err)
                  toast({
                    title: 'Copy Failed',
                    description: 'Could not copy to clipboard. Please copy manually.',
                    variant: 'destructive',
                  })
                }
              }}
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </ToastAction>
          ),
        })
        navigate('/dashboard?tab=gmail')
        return
      }

      // Verify state (CSRF protection)
      const storedState = sessionStorage.getItem('gmail_oauth_state')
      if (state !== storedState) {
        const errorMessage = 'Invalid state parameter. Please try again.'
        toast({
          title: 'Security Error',
          description: errorMessage,
          variant: 'destructive',
          action: (
            <ToastAction
              altText="Copy error"
              onClick={async (e) => {
                e.preventDefault()
                e.stopPropagation()
                try {
                  // Try modern clipboard API first
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(errorMessage)
                  } else {
                    // Fallback for older browsers
                    const textArea = document.createElement('textarea')
                    textArea.value = errorMessage
                    textArea.style.position = 'fixed'
                    textArea.style.left = '-999999px'
                    textArea.style.top = '-999999px'
                    document.body.appendChild(textArea)
                    textArea.focus()
                    textArea.select()
                    document.execCommand('copy')
                    textArea.remove()
                  }
                  toast({
                    title: 'Copied',
                    description: 'Error message copied to clipboard',
                  })
                } catch (err) {
                  console.error('Failed to copy:', err)
                  toast({
                    title: 'Copy Failed',
                    description: 'Could not copy to clipboard. Please copy manually.',
                    variant: 'destructive',
                  })
                }
              }}
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </ToastAction>
          ),
        })
        navigate('/dashboard?tab=gmail')
        return
      }

      // Exchange code for token
      try {
        const token = await exchangeCodeForToken(code)
        storeGmailToken(token)
        
        // Clear stored state
        sessionStorage.removeItem('gmail_oauth_state')

        toast({
          title: 'Success',
          description: 'Successfully connected to Gmail',
          variant: 'success',
        })

        // Redirect back to dashboard Gmail tab
        navigate('/dashboard?tab=gmail')
      } catch (error) {
        console.error('Token exchange failed:', error)
        const errorMessage = error instanceof Error ? error.message : 'Failed to exchange authorization code'
        toast({
          title: 'Authentication Failed',
          description: errorMessage,
          variant: 'destructive',
          action: (
            <ToastAction
              altText="Copy error"
              onClick={async (e) => {
                e.preventDefault()
                e.stopPropagation()
                try {
                  // Try modern clipboard API first
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(errorMessage)
                  } else {
                    // Fallback for older browsers
                    const textArea = document.createElement('textarea')
                    textArea.value = errorMessage
                    textArea.style.position = 'fixed'
                    textArea.style.left = '-999999px'
                    textArea.style.top = '-999999px'
                    document.body.appendChild(textArea)
                    textArea.focus()
                    textArea.select()
                    document.execCommand('copy')
                    textArea.remove()
                  }
                  toast({
                    title: 'Copied',
                    description: 'Error message copied to clipboard',
                  })
                } catch (err) {
                  console.error('Failed to copy:', err)
                  toast({
                    title: 'Copy Failed',
                    description: 'Could not copy to clipboard. Please copy manually.',
                    variant: 'destructive',
                  })
                }
              }}
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </ToastAction>
          ),
        })
        navigate('/dashboard?tab=gmail')
      }
    }

    handleCallback()
  }, [searchParams, navigate, toast])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader className="h-8 w-8 animate-spin mx-auto text-primary" />
        <h2 className="text-xl font-semibold">Connecting to Gmail...</h2>
        <p className="text-muted-foreground">Please wait while we authenticate your account.</p>
      </div>
    </div>
  )
}
