import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogFooter,
} from '@/component/ui/dialog'
import { Button } from '@/component/ui/button'
import { Input } from '@/component/ui/input'
import { UserCircle, Mail, Save, X } from 'lucide-react'
import { useToast } from '@/lib/use-toast'
import { getApiUrl } from '@/lib/api-client'

interface EditProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userEmail: string | null | undefined
  currentProfile?: {
    email: string
    full_name?: string
  }
  onProfileUpdated?: () => void
}

export function EditProfileDialog({
  open,
  onOpenChange,
  userEmail,
  currentProfile,
  onProfileUpdated,
}: EditProfileDialogProps) {
  const [fullName, setFullName] = useState(currentProfile?.full_name || '')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ full_name?: string }>({})
  const { toast } = useToast()

  useEffect(() => {
    if (open && currentProfile) {
      setFullName(currentProfile.full_name || '')
      setErrors({})
    }
  }, [open, currentProfile])

  const validateForm = () => {
    const newErrors: typeof errors = {}

    if (fullName && fullName.length > 255) {
      newErrors.full_name = 'Full name must be less than 255 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    if (!userEmail) {
      toast({
        title: 'Error',
        description: 'User email is required',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)

    try {
      const response = await fetch(getApiUrl('/dashboard-update-profile/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail,
          full_name: fullName.trim() || null,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast({
          title: 'Success',
          description: 'Profile updated successfully',
        })
        onProfileUpdated?.()
        onOpenChange(false)
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to update profile',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Profile update error:', error)
      toast({
        title: 'Error',
        description: 'An error occurred while updating your profile. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFullName(currentProfile?.full_name || '')
    setErrors({})
    onOpenChange(false)
  }

  if (!userEmail) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogClose onClose={handleClose} />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCircle className="h-5 w-5" />
            Edit Profile
          </DialogTitle>
          <DialogDescription>Update your profile information</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email (Read-only) */}
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={userEmail}
                disabled
                className="pl-9 bg-muted/50 cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Email cannot be changed. Contact administrator to change your email.
            </p>
          </div>

          {/* Full Name */}
          <div className="space-y-2">
            <label htmlFor="full-name" className="text-sm font-medium">
              Full Name
            </label>
            <Input
              id="full-name"
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value)
                setErrors((prev) => ({ ...prev, full_name: undefined }))
              }}
              placeholder="Enter your full name"
              className={errors.full_name ? 'border-destructive' : ''}
              disabled={loading}
              maxLength={255}
            />
            {errors.full_name && (
              <p className="text-sm text-destructive">{errors.full_name}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
