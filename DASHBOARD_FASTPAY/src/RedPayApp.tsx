import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { isAuthenticated } from '@/lib/auth'
import { Toaster } from '@/component/ui/toaster'

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const RedPayAxisRoute = lazy(() => import('@/pages/axisurgenttemp/RedPayAxisRoute'))
const Error500Page = lazy(() => import('@/pages/error/Error500Page'))

const RouteLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
)

function RedPayApp() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    setIsLoggedIn(isAuthenticated())
  }, [])

  // Get base path and remove trailing slash for BrowserRouter basename
  const basePath = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '/'

  return (
    <BrowserRouter basename={basePath}>
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          {/* Unified login page */}
          <Route path="/login" element={<LoginPage />} />

          {/* REDPAY dashboard homepage - shows RedPay Axis content, requires authentication */}
          <Route path="/dashboard" element={<RedPayAxisRoute />} />

          {/* 500 error page (animated, with retry / go home) */}
          <Route path="/error/500" element={<Error500Page homePath="/dashboard" />} />

          {/* Root path - redirects based on authentication status */}
          <Route
            path="/"
            element={
              isLoggedIn ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Navigate to="/login" replace />
              )
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

