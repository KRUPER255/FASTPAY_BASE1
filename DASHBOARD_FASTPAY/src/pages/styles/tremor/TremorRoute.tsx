import { Navigate } from 'react-router-dom'
import { isAuthenticated } from '@/lib/auth'
import TremorDashboard from './TremorDashboard'

interface TremorRouteProps {
  onLogout: () => void
}

export default function TremorRoute({ onLogout }: TremorRouteProps) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }

  return <TremorDashboard onLogout={onLogout} />
}
