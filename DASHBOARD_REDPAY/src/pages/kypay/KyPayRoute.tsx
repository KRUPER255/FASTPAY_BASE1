import { Navigate } from 'react-router-dom'
import { isAuthenticated, getUserAccess } from '@/lib/auth'
import KyPay from './KyPay'

interface KyPayRouteProps {
  onLogout: () => void
}

export default function KyPayRoute({ onLogout }: KyPayRouteProps) {
  try {
    // Check authentication
    if (!isAuthenticated()) {
      return <Navigate to="/login" replace />
    }

    // Redirect access level 1 (limited dashboard access) users to main dashboard
    const accessLevel = getUserAccess()
    if (accessLevel === 1) {
      return <Navigate to="/dashboard/v2" replace />
    }

    // Redirect access level 2 (RedPay only) users to /redpay
    if (accessLevel === 2) {
      return <Navigate to="/redpay" replace />
    }

    // KyPay is accessible to access level 0 (full admin) users only
    return <KyPay onLogout={onLogout} />
  } catch (error) {
    console.error('KyPayRoute error:', error)
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-destructive mb-4">Error Loading KyPay</h1>
          <pre className="bg-muted p-4 rounded-md overflow-auto text-sm">
            {error instanceof Error ? error.message : String(error)}
          </pre>
          <p className="mt-4 text-muted-foreground">Please check the browser console (F12) for more details.</p>
        </div>
      </div>
    )
  }
}
