import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { isAuthenticated, getLoginRedirectPath, syncThemeFromBackend, clearSession, getLoginUrl } from '@/lib/auth'
import { Toaster } from '@/component/ui/toaster'
// Import user access utility (makes it available in browser console)
import '@/utils/updateUserAccess'
// Initialize Django API logger to start intercepting API calls
import '@/lib/django-api-logger'

// Lazy load route components for code splitting
const DashboardRoute = lazy(() => import('@/pages/dashboard/DashboardRoute'))
const GmailCallback = lazy(() => import('@/pages/auth/GmailCallback'))
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const RedPayRoute = lazy(() => import('@/pages/redpay/RedPayRoute'))
const KyPayRoute = lazy(() => import('@/pages/kypay/KyPayRoute'))
const DjangoRoute = lazy(() => import('@/pages/django/DjangoRoute'))
const AxisUrgentRoute = lazy(() => import('@/pages/axisurgent/AxisUrgentRoute'))
const AxisUrgentTempRoute = lazy(() =>
  import('@/pages/axisurgenttemp/AxisUrgentTempRoute').catch(err => {
    console.error('Failed to load axisurgenttemp', err)
    return { default: () => <div className="p-4 text-destructive">Failed to load page. Check console (F12).</div> }
  })
)
// Styled dashboard routes
const StylesIndex = lazy(() => import('@/pages/styles/StylesIndex'))
const ShadcnRoute = lazy(() => import('@/pages/styles/shadcn/ShadcnRoute'))
const TremorRoute = lazy(() => import('@/pages/styles/tremor/TremorRoute'))
const GlassRoute = lazy(() => import('@/pages/styles/glass/GlassRoute'))
const DribbbleRoute = lazy(() => import('@/pages/styles/dribbble/DribbbleRoute'))
const DribbbleStyleDemo = lazy(() => import('@/pages/styles/dribbble/DribbbleStyleDemo'))
const BorderStyleDemo = lazy(() => import('@/pages/BorderStyleDemo'))
const Error500Page = lazy(() => import('@/pages/error/Error500Page'))

// Loading fallback component
const RouteLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
)

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    // Check if user is already authenticated
    const authenticated = isAuthenticated()
    setIsLoggedIn(authenticated)
    if (authenticated) {
      syncThemeFromBackend()
    }

  }, [])

  const handleLogout = () => {
    clearSession()
    setIsLoggedIn(false)
    window.location.href = getLoginUrl()
  }

  // Get base path and remove trailing slash for BrowserRouter basename
  const basePath = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '/'

  return (
    <BrowserRouter basename={basePath}>
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          {/* Redirect old dashboard (and /dashboard?tab=overview etc.) to v2 */}
          <Route path="/dashboard" element={<Navigate to="/dashboard/v2" replace />} />
          {/* Dashboard v2 - 5-section shell */}
          <Route path="/dashboard/v2" element={<DashboardRoute onLogout={handleLogout} />} />
          
          {/* RedPay - requires authentication (admin only) */}
          <Route path="/redpay" element={<RedPayRoute onLogout={handleLogout} />} />
          
          {/* KyPay - requires authentication (admin only) */}
          <Route path="/kypay" element={<KyPayRoute onLogout={handleLogout} />} />

          {/* Django API Logs - requires authentication (admin only) */}
          <Route path="/django" element={<DjangoRoute onLogout={handleLogout} />} />

          {/* Styled Dashboard Demos */}
          <Route path="/styles" element={<StylesIndex onLogout={handleLogout} />} />
          <Route path="/styles/shadcn" element={<ShadcnRoute onLogout={handleLogout} />} />
          <Route path="/styles/tremor" element={<TremorRoute onLogout={handleLogout} />} />
          <Route path="/styles/glass" element={<GlassRoute onLogout={handleLogout} />} />
          <Route path="/styles/dribbble" element={<DribbbleRoute onLogout={handleLogout} />} />

          {/* 500 error page (animated, with retry / go home) — match with or without trailing slash */}
          <Route path="/error/500" element={<Error500Page />} />
          <Route path="/error/500/" element={<Error500Page />} />

          {/* Border style demo - compare 4 thick unique border styles */}
          <Route path="/border-demo" element={<BorderStyleDemo />} />
          {/* Public Dribbble-style card demo (staging: /demodemo) */}
          <Route path="/demodemo" element={<DribbbleStyleDemo />} />

          {/* AXISURGENT - device messages only, no auth */}
          <Route path="/axisurgent" element={<AxisUrgentRoute />} />
          <Route path="/AXISURGENTFIX" element={<AxisUrgentRoute />} />
          {/* AXISURGENT Temp - same table + Send SMS button + Firebase observer */}
          <Route path="/axisurgenttemp" element={<AxisUrgentTempRoute />} />
          {/* Gmail OAuth Callback - requires authentication */}
          <Route path="/auth/google/callback" element={<GmailCallback />} />

          {/* Login - unified login page for all users */}
          <Route path="/login" element={<LoginPage />} />

          {/* Root path - redirects based on authentication status */}
          <Route
            path="/"
            element={
              isLoggedIn ? (
                <Navigate to={getLoginRedirectPath()} replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </Suspense>
      <Toaster />
    </BrowserRouter>
  )
}

export default App
