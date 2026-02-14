import { useState, useEffect, useRef } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoveRight, Loader, Eye, EyeOff, Lock, Mail, Wifi, WifiOff, AlertCircle } from 'lucide-react'
import { verifyLogin, getLoginRedirectPath } from '@/lib/auth'
import { getApiUrl } from '@/lib/api-client'
import { getAppName } from '@/lib/branding'

export default function NeumorphismLogin() {
  const navigate = useNavigate()
  const emailInputRef = useRef<HTMLInputElement>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [emailError, setEmailError] = useState('')

  // Single source of truth: build-time VITE_REDPAY_ONLY (see src/lib/branding.ts)
  const brandName = getAppName()

  // Focus first input on mount for accessibility
  useEffect(() => {
    emailInputRef.current?.focus()
  }, [])

  // Check backend connectivity on mount
  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const url = getApiUrl('')
        const res = await fetch(url, { method: 'GET', cache: 'no-store' })
        if (!cancelled) setBackendConnected(res.ok)
      } catch {
        if (!cancelled) setBackendConnected(false)
      }
    }
    check()
    return () => { cancelled = true }
  }, [])

  // Email validation
  const validateEmail = (emailValue: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailValue.trim()) {
      setEmailError('')
      return false
    }
    if (!emailRegex.test(emailValue.trim())) {
      setEmailError('Please enter a valid email address')
      return false
    }
    setEmailError('')
    return true
  }

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setEmail(value)
    if (value) {
      validateEmail(value)
    } else {
      setEmailError('')
    }
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setEmailError('')
    setIsLoading(true)

    try {
      const trimmedEmail = email.trim()
      if (!trimmedEmail || !password) {
        setError('Email and password are required')
        setIsLoading(false)
        return
      }

      // Validate email format
      if (!validateEmail(trimmedEmail)) {
        setError('Please enter a valid email address')
        setIsLoading(false)
        return
      }

      const result = await verifyLogin(trimmedEmail, password, rememberMe)

      if (result.success && result.admin) {
        setFailedAttempts(0)
        setEmail('')
        setPassword('')
        // Redirect based on user access level
        const redirectPath = getLoginRedirectPath(result.admin.access)
        navigate(redirectPath)
      } else {
        const newAttempts = failedAttempts + 1
        setFailedAttempts(newAttempts)
        setError(result.error || 'Login failed')
        
        // Show rate limiting warning after 3 failed attempts
        if (newAttempts >= 3) {
          setError(`${result.error || 'Login failed'}. ${5 - newAttempts > 0 ? `${5 - newAttempts} attempts remaining before temporary lockout.` : 'Too many failed attempts. Please try again later.'}`)
        }
      }
    } catch (err) {
      setError('An error occurred during login. Please check your connection.')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEmail('')
      setPassword('')
      setError('')
      setEmailError('')
      emailInputRef.current?.focus()
    }
  }

  return (
    <div className="neu-login-container" onKeyDown={handleKeyDown}>
      <style>{`
        /* Neumorphic Login Container - Responsive Design */
        @import url('https://fonts.googleapis.com/css?family=Poppins&display=swap');
        
        html, body, #root {
          height: 100%;
          margin: 0;
        }

        body {
          margin: 0;
          overflow: hidden;
          overscroll-behavior: none;
        }

        .neu-login-container {
          height: 100vh;
          height: 100dvh; /* Dynamic viewport height for mobile keyboards */
          min-height: 100vh;
          min-height: 100dvh;
          max-height: 100vh;
          max-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(145deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%);
          padding: 12px;
          box-sizing: border-box;
          overflow: hidden;
          font-family: 'Poppins', 'Segoe UI', sans-serif;
        }

        /* Outer Login Card - Responsive */
        .neu-login-card {
          background: rgba(255, 255, 255, 0.98);
          border-radius: 16px;
          padding: 16px;
          width: 100%;
          max-width: 400px;
          max-height: calc(100vh - 24px);
          max-height: calc(100dvh - 24px);
          overflow-y: auto;
          box-shadow:
            0 20px 40px -12px rgba(0, 0, 0, 0.12),
            0 0 0 1px rgba(148, 163, 184, 0.2);
          border: 1px solid rgba(148, 163, 184, 0.3);
        }

        /* Mobile optimizations */
        @media (max-width: 767px) {
          .neu-login-container {
            padding: 8px;
          }

          .neu-login-card {
            padding: 12px;
            border-radius: 12px;
            max-width: 100%;
          }

          .neu-login-card-inner {
            padding: 1rem 1.25rem 0.875rem !important;
          }

          .neu-logo-title {
            font-size: 1.75rem !important;
          }

          .neu-logo-subtitle {
            font-size: 0.8rem !important;
          }

          .neu-logo-tagline {
            font-size: 0.75rem !important;
          }

          .neu-form-body {
            padding: 1rem 1rem !important;
          }

          .neu-backend-status {
            font-size: 11px !important;
            padding: 5px 8px !important;
          }

          .neu-backend-status span {
            display: none;
          }

          .neu-backend-status span:first-of-type {
            display: inline;
          }
        }

        /* Tablet optimizations */
        @media (min-width: 768px) and (max-width: 1024px) {
          .neu-login-card {
            padding: 14px;
            max-width: 380px;
          }

          .neu-login-card-inner {
            padding: 1.125rem 1.375rem 0.9375rem !important;
          }
        }

        /* Inner Login Card */
        .neu-login-card-inner {
          background: transparent;
          border-radius: 12px;
          padding: 1.25rem 1.5rem 1rem;
        }

        /* Logo Section */
        .neu-logo-section {
          text-align: center;
          margin-bottom: 1rem;
        }

        .neu-logo-container {
          background: transparent;
          border-radius: 10px;
          padding: 0.5rem 1rem;
          margin-bottom: 0.75rem;
        }

        .neu-form-body {
          background: rgba(248, 250, 252, 0.9);
          border-radius: 12px;
          padding: 1.25rem 1.25rem;
          border: 1px solid rgba(148, 163, 184, 0.35);
        }

        .neu-logo-title {
          font-size: 2rem;
          font-weight: 700;
          color: #334155;
          margin-bottom: 0.2rem;
          letter-spacing: -0.5px;
        }

        .neu-logo-subtitle {
          font-size: 0.9rem;
          color: #475569;
          font-weight: 500;
        }

        .neu-logo-tagline {
          font-size: 0.8rem;
          color: #64748b;
          margin-top: 0.25rem;
          font-weight: 400;
        }

        /* Input Container */
        .neu-input-container {
          margin-bottom: 1.25rem;
          background: rgba(255, 255, 255, 0.9);
          border-radius: 8px;
          padding: 0.3rem 0.5rem;
          border: 1px solid rgba(148, 163, 184, 0.4);
        }

        .neu-input-wrapper {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 0;
          color: #334155;
        }

        .neu-input-icon {
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
          width: 18px;
          height: 18px;
          pointer-events: none;
          z-index: 1;
        }

        .neu-input {
          width: 100%;
          min-height: 44px; /* Minimum touch target size */
          height: 44px;
          border: none;
          outline: none;
          padding: 0 28px 0 26px;
          border-radius: 0;
          color: #334155;
          font-size: 14px;
          background-color: transparent;
          border-bottom: 1px solid rgba(148, 163, 184, 0.5);
          transition: all 0.2s;
          font-family: inherit;
          -webkit-text-fill-color: #334155;
        }

        .neu-input:focus {
          border-color: transparent;
          border-bottom: 1px solid hsl(var(--primary));
          color: #334155;
          -webkit-text-fill-color: #334155;
        }

        .neu-input:not(:placeholder-shown) {
          color: #334155;
          -webkit-text-fill-color: #334155;
          border-bottom: 1px solid hsl(var(--primary) / 0.6);
        }

        .neu-input::placeholder {
          color: #94a3b8;
        }

        .neu-input:-webkit-autofill,
        .neu-input:-webkit-autofill:hover,
        .neu-input:-webkit-autofill:focus {
          -webkit-text-fill-color: #334155;
          -webkit-box-shadow: 0 0 0px 1000px rgba(255, 255, 255, 0.95) inset;
          box-shadow: 0 0 0px 1000px rgba(255, 255, 255, 0.95) inset;
        }

        .neu-input[aria-invalid="true"] {
          border-bottom-color: #ef4444;
        }

        .neu-floating-label {
          font-size: 14px;
          padding-left: 26px;
          position: absolute;
          top: 8px;
          transition: 0.2s;
          pointer-events: none;
          color: #64748b;
        }

        .neu-input:not(:placeholder-shown) ~ .neu-floating-label,
        .neu-input:focus ~ .neu-floating-label {
          padding-left: 26px;
          transform: translateY(-20px);
          font-size: 12px;
          color: #64748b;
        }

        .neu-input:-webkit-autofill ~ .neu-floating-label,
        .neu-input:autofill ~ .neu-floating-label {
          padding-left: 26px;
          transform: translateY(-20px);
          font-size: 12px;
        }

        .neu-input-error {
          font-size: 12px;
          color: #ef4444;
          margin-top: 4px;
          padding-left: 26px;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .neu-input-password-toggle {
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 8px; /* Larger touch target */
          min-width: 44px;
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s ease;
          z-index: 1;
        }

        .neu-input-password-toggle:hover {
          color: #334155;
        }

        .neu-input-password-toggle:focus {
          outline: 2px solid hsl(var(--primary));
          outline-offset: 2px;
          border-radius: 4px;
        }

        /* Remember Me Checkbox */
        .neu-remember-me {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 1rem;
          cursor: pointer;
          user-select: none;
        }

        .neu-remember-me input[type="checkbox"] {
          width: 18px;
          height: 18px;
          min-width: 18px;
          min-height: 18px;
          cursor: pointer;
          accent-color: hsl(var(--primary));
        }

        .neu-remember-me label {
          font-size: 14px;
          color: #64748b;
          cursor: pointer;
          margin: 0;
        }

        /* Forgot Password Link */
        .neu-forgot-password {
          text-align: right;
          margin-bottom: 1rem;
        }

        .neu-forgot-password a {
          font-size: 13px;
          color: hsl(var(--primary));
          text-decoration: none;
          transition: color 0.2s ease;
        }

        .neu-forgot-password a:hover {
          color: hsl(var(--primary) / 0.8);
          text-decoration: underline;
        }

        .neu-forgot-password a:focus {
          outline: 2px solid hsl(var(--primary));
          outline-offset: 2px;
          border-radius: 2px;
        }

        /* Button - uses theme primary */
        .neu-button {
          width: 100%;
          min-height: 48px; /* Minimum touch target */
          height: 48px;
          background: linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.9) 100%);
          border-radius: 10px;
          border: 1px solid hsl(var(--primary) / 0.5);
          font-size: 14px;
          font-weight: 600;
          color: hsl(var(--primary-foreground));
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 12px hsl(var(--primary) / 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-family: inherit;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .neu-button:hover:not(:disabled) {
          background: linear-gradient(135deg, hsl(var(--primary) / 0.95) 0%, hsl(var(--primary) / 0.8) 100%);
          border-color: hsl(var(--primary) / 0.7);
          color: hsl(var(--primary-foreground));
          box-shadow: 0 4px 16px hsl(var(--primary) / 0.4);
        }

        .neu-button:active:not(:disabled) {
          transform: scale(0.99);
        }

        .neu-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .neu-button:focus {
          outline: 2px solid hsl(var(--primary));
          outline-offset: 2px;
        }

        /* Error Message */
        .neu-error {
          background: rgba(239, 68, 68, 0.08);
          border-radius: 8px;
          padding: 0.75rem 1rem;
          margin-bottom: 1rem;
          color: #dc2626;
          font-size: 0.8rem;
          border: 1px solid rgba(239, 68, 68, 0.35);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* Footer */
        .neu-footer {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(148, 163, 184, 0.35);
          text-align: center;
        }

        .neu-footer-text {
          font-size: 0.7rem;
          color: #64748b;
        }

        .neu-spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Accessibility: Skip link */
        .neu-skip-link {
          position: absolute;
          top: -40px;
          left: 0;
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          padding: 8px 16px;
          text-decoration: none;
          z-index: 100;
        }

        .neu-skip-link:focus {
          top: 0;
        }
      `}</style>

      <a href="#main-content" className="neu-skip-link">Skip to main content</a>

      <div className="neu-login-card">
        <div className="neu-login-card-inner" id="main-content">
          {/* Backend connection status */}
          {backendConnected !== null && (
            <div
              className="neu-backend-status"
              role="status"
              aria-live="polite"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                marginBottom: '0.75rem',
                padding: '6px 10px',
                borderRadius: '8px',
                fontSize: '12px',
                background: backendConnected ? 'rgba(14, 165, 233, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: backendConnected ? '#0ea5e9' : '#ef4444',
                border: backendConnected ? '1px solid rgba(14, 165, 233, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              {backendConnected ? (
                <>
                  <Wifi style={{ width: 14, height: 14 }} aria-hidden="true" />
                  <span>Backend connected</span>
                </>
              ) : (
                <>
                  <WifiOff style={{ width: 14, height: 14 }} aria-hidden="true" />
                  <span>Cannot reach backend. Check API URL and that the server is running.</span>
                </>
              )}
            </div>
          )}
          <form onSubmit={handleSubmit} noValidate>
            {/* Logo Section */}
            <div className="neu-logo-container">
              <div className="neu-logo-section">
                <h1 className="neu-logo-title">{brandName}</h1>
                <p className="neu-logo-subtitle">Configure yourself</p>
                <p className="neu-logo-tagline">Secure Payment Management</p>
              </div>
            </div>

            <div className="neu-form-body">
              {/* Error Message */}
              {error && (
                <div className="neu-error" role="alert" aria-live="assertive">
                  <AlertCircle size={16} aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              {/* Email Input */}
              <div className="neu-input-container">
                <div className="neu-input-wrapper">
                  <Mail className="neu-input-icon" aria-hidden="true" />
                  <input
                    ref={emailInputRef}
                    type="email"
                    id="email"
                    name="email"
                    value={email}
                    onChange={handleEmailChange}
                    onBlur={() => validateEmail(email)}
                    placeholder=" "
                    className="neu-input"
                    required
                    disabled={isLoading}
                    aria-label="Email address"
                    aria-describedby={emailError ? "email-error" : undefined}
                    aria-invalid={emailError ? "true" : "false"}
                    aria-required="true"
                    autoComplete="email"
                  />
                  <label htmlFor="email" className="neu-floating-label">
                    Email Address
                  </label>
                  {emailError && (
                    <div id="email-error" className="neu-input-error" role="alert">
                      <AlertCircle size={12} aria-hidden="true" />
                      <span>{emailError}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Password Input */}
              <div className="neu-input-container">
                <div className="neu-input-wrapper">
                  <Lock className="neu-input-icon" aria-hidden="true" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder=" "
                    className="neu-input"
                    required
                    disabled={isLoading}
                    aria-label="Password"
                    aria-describedby={error ? "password-error" : undefined}
                    aria-required="true"
                    autoComplete="current-password"
                  />
                  <label htmlFor="password" className="neu-floating-label">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="neu-input-password-toggle"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              {/* Remember Me and Forgot Password */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <label className="neu-remember-me">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={isLoading}
                    aria-label="Remember me for 7 days"
                  />
                  <span>Remember me</span>
                </label>
                <div className="neu-forgot-password">
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      // TODO: Implement forgot password flow
                      alert('Forgot password functionality coming soon')
                    }}
                    aria-label="Forgot password"
                  >
                    Forgot password?
                  </a>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="neu-button"
                disabled={isLoading || !!emailError}
                aria-label="Sign in"
              >
                {isLoading ? (
                  <>
                    <Loader className="neu-spinner" size={20} aria-hidden="true" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    Sign In
                    <MoveRight size={20} aria-hidden="true" />
                  </>
                )}
              </button>

              {/* Footer */}
              <div className="neu-footer">
                <p className="neu-footer-text">© 2026 {brandName}. All rights reserved.</p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
