import { Navigate } from 'react-router-dom'
import { isAuthenticated } from '@/lib/auth'
import GlassDashboard from './GlassDashboard'

interface GlassRouteProps {
  onLogout: () => void
}

export default function GlassRoute({ onLogout }: GlassRouteProps) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }

  return <GlassDashboard onLogout={onLogout} />
}
