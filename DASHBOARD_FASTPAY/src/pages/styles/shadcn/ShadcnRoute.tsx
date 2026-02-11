import { Navigate } from 'react-router-dom'
import { isAuthenticated } from '@/lib/auth'
import ShadcnDashboard from './ShadcnDashboard'

interface ShadcnRouteProps {
  onLogout: () => void
}

export default function ShadcnRoute({ onLogout }: ShadcnRouteProps) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }

  return <ShadcnDashboard onLogout={onLogout} />
}
