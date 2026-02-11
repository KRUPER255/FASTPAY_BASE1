import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/component/ui/dialog'
import { Button } from '@/component/ui/button'
import { Card, CardContent } from '@/component/ui/card'
import { UserCircle, Mail, Shield, Calendar, Clock, Edit } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { useToast } from '@/lib/use-toast'
import { getApiUrl } from '@/lib/api-client'
import { EditProfileDialog } from './EditProfileDialog'

interface ProfileViewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userEmail: string | null | undefined
  userAccessLevel?: number
}

interface UserProfile {
  email: string
  full_name?: string
  access_level: number
  status: string
  last_login?: string
  last_activity?: string
  created_at?: string
}

export function ProfileViewDialog({
  open,
  onOpenChange,
  userEmail,
  userAccessLevel,
}: ProfileViewDialogProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open && userEmail) {
      fetchProfile()
    }
  }, [open, userEmail])

  const fetchProfile = async () => {
    if (!userEmail) return

    setLoading(true)
    try {
      const response = await fetch(getApiUrl('/dashboard-profile/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: userEmail }),
      })

      if (response.ok) {
        const data = await response.json()
        setProfile(data.profile || {
          email: userEmail,
          access_level: userAccessLevel ?? 1,
          status: 'active',
        })
      } else {
        // Fallback to session data if API fails
        const session = getSession()
        setProfile({
          email: userEmail,
          access_level: userAccessLevel ?? session?.access ?? 1,
          status: session?.status || 'active',
        })
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
      // Fallback to session data
      const session = getSession()
      setProfile({
        email: userEmail,
        access_level: userAccessLevel ?? session?.access ?? 1,
        status: session?.status || 'active',
      })
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never'
    try {
      const date = new Date(dateString)
      return date.toLocaleString('en-US')
    } catch {
      return dateString
    }
  }

  const getAccessLevelLabel = (level?: number) => {
    switch (level) {
      case 0:
        return 'Full Admin'
      case 1:
        return 'OTP Only'
      case 2:
        return 'RedPay Only'
      default:
        return 'Unknown'
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30'
      case 'inactive':
        return 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30'
      case 'suspended':
        return 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30'
      default:
        return 'bg-muted text-muted-foreground border-border'
    }
  }

  if (!userEmail) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogClose onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <UserCircle className="h-5 w-5" />
            User Profile
          </DialogTitle>
          <DialogDescription>View your account information and details</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Profile Header */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <UserCircle className="h-8 w-8 text-primary" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {profile?.full_name || 'User'}
                      </h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                        <Mail className="h-4 w-4" />
                        {profile?.email || userEmail}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-1 rounded-md text-xs font-medium border ${getStatusBadgeColor(
                          profile?.status || 'active'
                        )}`}
                      >
                        {profile?.status?.toUpperCase() || 'ACTIVE'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Account Details */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-4">
                  Account Details
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Shield className="h-4 w-4" />
                      <span>Access Level</span>
                    </div>
                    <p className="font-medium">
                      {getAccessLevelLabel(profile?.access_level)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span>Email Address</span>
                    </div>
                    <p className="font-medium break-all">{profile?.email || userEmail}</p>
                  </div>

                  {profile?.full_name && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <UserCircle className="h-4 w-4" />
                        <span>Full Name</span>
                      </div>
                      <p className="font-medium">{profile.full_name}</p>
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Account Created</span>
                    </div>
                    <p className="font-medium">
                      {formatDate(profile?.created_at)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Last Login</span>
                    </div>
                    <p className="font-medium">
                      {formatDate(profile?.last_login)}
                    </p>
                  </div>

                  {profile?.last_activity && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>Last Activity</span>
                      </div>
                      <p className="font-medium">
                        {formatDate(profile.last_activity)}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      {/* Edit Profile Dialog */}
      <EditProfileDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        userEmail={userEmail}
        currentProfile={profile ? {
          email: profile.email,
          full_name: profile.full_name,
        } : undefined}
        onProfileUpdated={() => {
          fetchProfile() // Refresh profile after update
        }}
      />
    </Dialog>
  )
}
