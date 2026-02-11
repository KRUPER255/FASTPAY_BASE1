import { Navigate } from 'react-router-dom'
import { isAuthenticated, getLoginRedirectPath } from '@/lib/auth'
import NeumorphismLogin from '@/component/ui/neumorphism-login'

/**
 * Unified Login Page Component
 *
 * Uses NeumorphismLogin (soft UI).
 * - Redirects authenticated users based on access level
 * - Staging: pre-fills superadmin@fastpay.com / superadmin123
 * - After login: Access 0 or 1 -> /dashboard/v2, Access 2 -> /redpay
 */
export default function LoginPage() {
  if (isAuthenticated()) {
    return <Navigate to={getLoginRedirectPath()} replace />
  }
  return <NeumorphismLogin />
}
