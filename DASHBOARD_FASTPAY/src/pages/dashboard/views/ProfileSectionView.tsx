import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/component/ui/card'
import { Button } from '@/component/ui/button'
import { UserCircle, Key } from 'lucide-react'
import { ProfileViewDialog } from '@/component/ProfileViewDialog'
import { ResetPasswordDialog } from '@/component/ResetPasswordDialog'

export interface ProfileSectionViewProps {
  userEmail?: string | null
  userAccessLevel?: number
  onLogout?: () => void
}

export function ProfileSectionView({
  userEmail,
  userAccessLevel,
  onLogout,
}: ProfileSectionViewProps): React.ReactElement {
  const [showProfileDialog, setShowProfileDialog] = useState(false)
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            View your account details and manage security settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {userEmail && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <span className="font-medium text-foreground">Signed in as:</span>
              {userEmail}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setShowProfileDialog(true)}
            >
              <UserCircle className="h-4 w-4" />
              View profile
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setShowResetPasswordDialog(true)}
            >
              <Key className="h-4 w-4" />
              Reset password
            </Button>
            {onLogout && (
              <Button variant="ghost" onClick={onLogout} className="text-muted-foreground">
                Log out
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <ProfileViewDialog
        open={showProfileDialog}
        onOpenChange={setShowProfileDialog}
        userEmail={userEmail}
        userAccessLevel={userAccessLevel}
      />

      <ResetPasswordDialog
        open={showResetPasswordDialog}
        onOpenChange={setShowResetPasswordDialog}
        userEmail={userEmail}
      />
    </div>
  )
}
