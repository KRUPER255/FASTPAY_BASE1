import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { isAuthenticated } from '@/lib/auth'
import { Toaster } from '@/component/ui/toaster'

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const RedpayDashboard = lazy(() => import('@/pages/redpay/RedpayDashboard'))

const RouteLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
)

function RedPayApp() {
  // Get base path and remove trailing slash for BrowserRouter basename
  const basePath = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '/'

  return (
    <BrowserRouter basename={basePath}>
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          {/* Unified login page */}
          <Route path="/login" element={<LoginPage />} />

          {/* REDPAY minimal dashboard: device selector + Messages + Gmail (requires auth) */}
          <Route
            path="/dashboard"
            element={isAuthenticated() ? <RedpayDashboard /> : <Navigate to="/login" replace />}
          />

          {/* Legacy /redpay/axis path - keep as alias to /dashboard */}
          <Route path="/redpay/axis" element={<Navigate to="/dashboard" replace />} />

          {/* Root path - redirects based on authentication status */}
          <Route
            path="/"
            element={
              isAuthenticated() ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
            }
          />

          {/* Catch-all - keep routing simple */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toaster />
    </BrowserRouter>
  )
}

export default RedPayApp

