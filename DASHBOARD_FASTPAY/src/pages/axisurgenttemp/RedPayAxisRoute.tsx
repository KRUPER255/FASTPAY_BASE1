import { Navigate } from 'react-router-dom'
import { isAuthenticated } from '@/lib/auth'
import AxisUrgentTempRoute from './AxisUrgentTempRoute'

/**
 * RedPay Axis route - same as AxisUrgentTemp but requires authentication.
 * Unauthenticated users are redirected to /login.
 */
export default function RedPayAxisRoute() {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: '/dashboard' }} />
  }
  return <AxisUrgentTempRoute />
}
