import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoveRight, Loader, Eye, EyeOff, Lock, Mail, Wifi, WifiOff } from 'lucide-react'
import { verifyLogin, getLoginRedirectPath } from '@/lib/auth'
import { getApiUrl } from '@/lib/api-client'

const isStaging = import.meta.env.MODE === 'staging'
const DEFAULT_EMAIL = 'superadmin@fastpay.com'
const DEFAULT_PASSWORD = 'superadmin123'

export default function NeumorphismLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState(isStaging ? DEFAULT_EMAIL : '')
  const [password, setPassword] = useState(isStaging ? DEFAULT_PASSWORD : '')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null)

  // Brand based on hostname: FASTPAY on main/staging, REDPAY on owner/redpay subdomains
  const hostname = typeof window !== 'undefined' ? window.location.hostname : ''
  const isRedpayBrand =
    hostname === 'owner.fastpaygaming.com' ||
    hostname === 'redpay.fastpaygaming.com'
  const brandName = isRedpayBrand ? 'REDPAY' : 'FASTPAY'

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

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const trimmedEmail = email.trim()
      if (!trimmedEmail || !password) {
        setError('Email and password are required')
        return
      }

      const result = await verifyLogin(trimmedEmail, password)

      if (result.success && result.admin) {
        setEmail('')
        setPassword('')
        // Redirect based on user access level
        const redirectPath = getLoginRedirectPath(result.admin.access)
        navigate(redirectPath)
      } else {
        setError(result.error || 'Login failed')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="neu-login-container">
      <style>{`
        /* Neumorphic Login Container - no scroll, fits viewport */
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
          min-height: 100vh;
          max-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(145deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%);
          padding: 12px;
          box-sizing: border-box;
          overflow: hidden;
          font-family: 'Poppins', 'Segoe UI', sans-serif;
        }

        /* Outer Login Card - white/grey + cyan */
        .neu-login-card {
          background: rgba(255, 255, 255, 0.98);
          border-radius: 16px;
          padding: 16px;
          width: 100%;
          max-width: 400px;
          max-height: calc(100vh - 24px);
          overflow-y: auto;
          box-shadow:
            0 20px 40px -12px rgba(0, 0, 0, 0.12),
            0 0 0 1px rgba(148, 163, 184, 0.2);
          border: 1px solid rgba(148, 163, 184, 0.3);
        }

        /* Inner Login Card - compact */
        .neu-login-card-inner {
          background: transparent;
          border-radius: 12px;
          padding: 1.25rem 1.5rem 1rem;
        }

        /* Logo Section - compact */
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

        /* Input Container - white/grey */
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
        }

        .neu-input {
          width: 100%;
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

        .neu-input-password-toggle {
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s ease;
        }

        .neu-input-password-toggle:hover {
          color: #334155;
        }

        /* Button - uses theme primary */
        .neu-button {
          width: 100%;
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

        /* Error Message */
        .neu-error {
          background: rgba(239, 68, 68, 0.08);
          border-radius: 8px;
          padding: 0.75rem 1rem;
          margin-bottom: 1rem;
          color: #dc2626;
          font-size: 0.8rem;
          border: 1px solid rgba(239, 68, 68, 0.35);
        }

        /* Footer - compact */
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
      `}</style>

      <div className="neu-login-card">
        <div className="neu-login-card-inner">
          {/* Backend connection status - compact */}
          {backendConnected !== null && (
            <div
              className="neu-backend-status"
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
                  <Wifi style={{ width: 14, height: 14 }} />
                  <span>Backend connected</span>
                </>
              ) : (
                <>
                  <WifiOff style={{ width: 14, height: 14 }} />
                  <span>Cannot reach backend. Check API URL and that the server is running.</span>
                </>
              )}
            </div>
          )}
          {isStaging && (
            <div
              className="neu-demo-credentials"
              style={{
                marginBottom: '0.75rem',
                padding: '8px 10px',
                borderRadius: '8px',
                background: 'rgba(14, 165, 233, 0.06)',
                border: '1px solid rgba(14, 165, 233, 0.25)',
                fontSize: '12px',
                color: '#475569',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ color: '#64748b' }}>Staging: {DEFAULT_EMAIL}</span>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(DEFAULT_EMAIL)
                    setPassword(DEFAULT_PASSWORD)
                    setError('')
                  }}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#0f172a',
                    background: 'rgba(14, 165, 233, 0.15)',
                    border: '1px solid rgba(14, 165, 233, 0.4)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  Use demo login
                </button>
              </div>
            </div>
          )}
          <form onSubmit={handleSubmit}>
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
              <div className="neu-error">
                {error}
              </div>
            )}

            {/* Email Input */}
            <div className="neu-input-container">
              <div className="neu-input-wrapper">
                <Mail className="neu-input-icon" />
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder=" "
                  className="neu-input"
                  required
                  disabled={isLoading}
                />
                <label htmlFor="email" className="neu-floating-label">
                  Email Address
                </label>
              </div>
            </div>

            {/* Password Input */}
            <div className="neu-input-container">
              <div className="neu-input-wrapper">
                <Lock className="neu-input-icon" />
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
                />
                <label htmlFor="password" className="neu-floating-label">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="neu-input-password-toggle"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="neu-button"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader className="neu-spinner" size={20} />
                  Authenticating...
                </>
              ) : (
                <>
                  Sign In
                  <MoveRight size={20} />
                </>
              )}
            </button>

            {/* Footer */}
            <div className="neu-footer">
              <p className="neu-footer-text">© 2024 {brandName}. All rights reserved.</p>
            </div>
          </div>
          </form>
        </div>
      </div>
    </div>
  )
}
