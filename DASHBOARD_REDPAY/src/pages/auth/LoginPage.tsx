import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { isAuthenticated, getLoginRedirectPath } from '@/lib/auth'
import NeumorphismLogin from '@/component/ui/neumorphism-login'

/**
 * Unified Login Page Component
 *
 * Uses NeumorphismLogin (soft UI).
 * - Redirects authenticated users based on access level
 * - After login: Access 0 or 1 -> /dashboard/v2, Access 2 -> /redpay
 */
export default function LoginPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Check authentication once on mount
    const authenticated = isAuthenticated()
    setIsLoggedIn(authenticated)
    setIsChecking(false)
  }, [])

  // Show nothing while checking to prevent flash
  if (isChecking) {
    return null
  }

  if (isLoggedIn) {
    return <Navigate to={getLoginRedirectPath()} replace />
  }
  return <NeumorphismLogin />
}
