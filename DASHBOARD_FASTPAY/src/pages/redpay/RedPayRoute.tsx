import { Navigate } from 'react-router-dom'
import { isAuthenticated, getUserAccess } from '@/lib/auth'
import RedPay from './RedPay'

interface RedPayRouteProps {
  onLogout: () => void
}

export default function RedPayRoute({ onLogout }: RedPayRouteProps) {
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

    // RedPay is accessible to access level 0 (full admin) and 2 (RedPay only)
    if (accessLevel === 0 || accessLevel === 2) {
      return <RedPay onLogout={onLogout} />
    }

    return <Navigate to="/login" replace />
  } catch (error) {
    console.error('RedPayRoute error:', error)
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-destructive mb-4">Error Loading RedPay</h1>
          <pre className="bg-muted p-4 rounded-md overflow-auto text-sm">
            {error instanceof Error ? error.message : String(error)}
          </pre>
          <p className="mt-4 text-muted-foreground">Please check the browser console (F12) for more details.</p>
        </div>
      </div>
    )
  }
}
