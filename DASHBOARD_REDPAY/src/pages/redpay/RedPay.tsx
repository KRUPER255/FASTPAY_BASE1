import { useEffect, useState } from 'react'
import { getSession, clearSession } from '@/lib/auth'
import { useNavigate } from 'react-router-dom'
import { UnifiedLayout } from '@/component/UnifiedLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/component/ui/card'
import { MessageSquare } from 'lucide-react'

interface RedPayProps {
  onLogout: () => void
}

export default function RedPay({ onLogout }: RedPayProps) {
  const navigate = useNavigate()
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const session = getSession()
    if (session) {
      setUserEmail(session.email)
    }
  }, [])

  const handleLogout = () => {
    clearSession()
    if (onLogout) {
      onLogout()
    }
    navigate('/login')
  }

  return (
    <UnifiedLayout
      showAdminFeatures={true}
      selectedDeviceId={null}
      devices={[]}
      taglineMap={new Map()}
      title="RedPay Dashboard"
      description="RedPay payment management and monitoring"
      userEmail={userEmail}
      onLogout={handleLogout}
      userAccessLevel={0}
    >
      {() => (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              RedPay Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Welcome to RedPay Dashboard. This is the RedPay management interface.
              </p>
              <p className="text-sm text-muted-foreground">
                RedPay features and functionality will be implemented here.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </UnifiedLayout>
  )
}
