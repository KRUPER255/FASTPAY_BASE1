import { useEffect, useState } from 'react'
import { getSession, clearSession } from '@/lib/auth'
import { useNavigate } from 'react-router-dom'
import { UnifiedLayout } from '@/component/UnifiedLayout'
import { ApiSection } from '@/component/ApiSection'

interface ApiDocsProps {
  onLogout: () => void
}

export default function ApiDocs({ onLogout }: ApiDocsProps) {
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
      title="API Documentation"
      description="All API endpoints with request and response examples"
      userEmail={userEmail}
      onLogout={handleLogout}
      userAccessLevel={0}
      overallActiveTab="api"
    >
      {() => (
        <ApiSection
          showMonitor={false}
          title="API Documentation"
          description="All API endpoints with request and response examples"
        />
      )}
    </UnifiedLayout>
  )
}
