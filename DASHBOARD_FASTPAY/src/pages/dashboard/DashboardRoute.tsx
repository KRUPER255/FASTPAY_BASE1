import { Navigate } from 'react-router-dom'
import { isAuthenticated, getUserAccess } from '@/lib/auth'
import { DashboardShell } from '@/pages/dashboard/DashboardShell'

interface DashboardRouteProps {
  onLogout: () => void
}

export default function DashboardRoute({ onLogout }: DashboardRouteProps) {
  try {
    if (!isAuthenticated()) {
      return <Navigate to="/" replace />
    }

    const accessLevel = getUserAccess()
    if (accessLevel === 2) {
      return <Navigate to="/redpay" replace />
    }

    return (
      <DashboardShell
        onLogout={onLogout}
        userEmail={undefined}
        userAccessLevel={accessLevel}
      />
    )
  } catch (error) {
    console.error('DashboardRoute error:', error)
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-destructive mb-4">
            Error Loading Dashboard
          </h1>
          <pre className="bg-muted p-4 rounded-md overflow-auto text-sm">
            {error instanceof Error ? error.message : String(error)}
          </pre>
          <p className="mt-4 text-muted-foreground">
            Please check the browser console (F12) for more details.
          </p>
        </div>
      </div>
    )
  }
}
