import { useEffect, useState } from 'react'
import { getSession, clearSession } from '@/lib/auth'
import { useNavigate } from 'react-router-dom'
import { UnifiedLayout } from '@/component/UnifiedLayout'
import { ApiSection } from '@/component/ApiSection'
import { SystemStatusWidget } from '@/component/SystemStatusWidget'

interface ApiMonitorProps {
  onLogout: () => void
}

export default function ApiMonitor({ onLogout }: ApiMonitorProps) {
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
      title="API Monitoring"
      description="Live monitoring of client and server API calls"
      userEmail={userEmail}
      onLogout={handleLogout}
      userAccessLevel={0}
      overallActiveTab="api"
    >
      {() => (
        <>
          <div className="mb-4">
            <SystemStatusWidget />
          </div>
          <ApiSection
            initialTab="monitor"
            showMonitor={true}
            title="API Monitoring"
            description="Live monitoring of client and server API calls"
          />
        </>
      )}
    </UnifiedLayout>
  )
}
