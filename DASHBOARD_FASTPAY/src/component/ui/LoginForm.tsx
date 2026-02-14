import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/component/ui/button'
import { Input } from '@/component/ui/input'
import { Label } from '@/component/ui/label'
import { MoveRight, Loader, Eye, EyeOff } from 'lucide-react'
import { verifyLogin, saveSession, getLoginRedirectPath } from '@/lib/auth'
import { getApiUrl } from '@/lib/api-client'
import { getAppName } from '@/lib/branding'

interface LoginFormProps {
  onLoginSuccess: () => void
}

export default function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const res = await fetch(getApiUrl(''), { method: 'GET', cache: 'no-store' })
        if (!cancelled) setBackendConnected(res.ok)
      } catch {
        if (!cancelled) setBackendConnected(false)
      }
    }
    check()
    return () => { cancelled = true }
  }, [])
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

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
        onLoginSuccess()
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
    <>
      <style>{`
                .neon-static-container {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #0a0a0a;
                    padding: 20px;
                }
                .neon-static-form {
                    font-family: 'Courier New', 'Monaco', 'Consolas', monospace !important;
                    background: #000000 !important;
                    border: 2px solid #00ff88 !important;
                    border-radius: 8px !important;
                    box-shadow: 
                        0 0 10px #00ff88,
                        0 0 20px #00ff88,
                        0 0 30px rgba(0, 255, 136, 0.5),
                        inset 0 0 20px rgba(0, 255, 136, 0.1) !important;
                    width: 100%;
                    max-width: 450px;
                    padding: 0;
                }
                .neon-logo {
                    text-align: center;
                    margin-bottom: 50px;
                }
                .neon-logo-text {
                    font-size: 48px;
                    font-weight: bold;
                    color: #00ff88 !important;
                    text-shadow: 
                        0 0 5px #00ff88,
                        0 0 10px #00ff88,
                        0 0 15px #00ff88,
                        0 0 20px #00ff88,
                        0 0 35px #00ff88,
                        0 0 40px #00ff88;
                    letter-spacing: 6px;
                    margin-bottom: 10px;
                    text-transform: uppercase;
                    font-family: 'Courier New', 'Monaco', 'Consolas', monospace;
                    filter: drop-shadow(0 0 8px #00ff88);
                    display: block !important;
                    visibility: visible !important;
                }
                .neon-tagline {
                    font-size: 12px;
                    color: #00ff88 !important;
                    letter-spacing: 4px;
                    opacity: 1 !important;
                    font-family: 'Courier New', 'Monaco', 'Consolas', monospace;
                    text-shadow: 0 0 5px #00ff88, 0 0 10px #00ff88;
                    font-weight: 600;
                    display: block !important;
                    visibility: visible !important;
                }
                .neon-input {
                    width: 100%;
                    height: 60px;
                    background: #000000 !important;
                    border: 2px solid #00ff88 !important;
                    border-radius: 0 !important;
                    padding: 0 20px;
                    font-size: 15px;
                    color: #00ff88 !important;
                    font-family: 'Courier New', 'Monaco', 'Consolas', monospace !important;
                    transition: all 0.3s ease;
                    margin-bottom: 30px;
                    text-shadow: 0 0 5px rgba(0, 255, 136, 0.8);
                    letter-spacing: 1px;
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    -webkit-text-fill-color: #00ff88 !important;
                    caret-color: #00ff88 !important;
                }
                .neon-input:not(:placeholder-shown) {
                    color: #00ff88 !important;
                    -webkit-text-fill-color: #00ff88 !important;
                }
                .neon-input::placeholder {
                    color: rgba(0, 255, 136, 0.6) !important;
                    letter-spacing: 2px;
                    font-weight: 500;
                    opacity: 1 !important;
                    -webkit-text-fill-color: rgba(0, 255, 136, 0.6) !important;
                }
                .neon-input:focus {
                    outline: none !important;
                    box-shadow: 
                        0 0 10px #00ff88,
                        0 0 20px #00ff88,
                        inset 0 0 15px rgba(0, 255, 136, 0.2) !important;
                    background: #000000 !important;
                    border-color: #00ff88 !important;
                    text-shadow: 0 0 8px #00ff88;
                    color: #00ff88 !important;
                    -webkit-text-fill-color: #00ff88 !important;
                    opacity: 1 !important;
                }
                .neon-input:-webkit-autofill,
                .neon-input:-webkit-autofill:hover,
                .neon-input:-webkit-autofill:focus {
                    -webkit-text-fill-color: #00ff88 !important;
                    -webkit-box-shadow: 0 0 0px 1000px #000000 inset !important;
                    box-shadow: 0 0 0px 1000px #000000 inset !important;
                    transition: background-color 5000s ease-in-out 0s;
                }
                .neon-label {
                    color: #00ff88 !important;
                    font-family: 'Courier New', 'Monaco', 'Consolas', monospace !important;
                    letter-spacing: 3px;
                    font-size: 13px;
                    text-transform: uppercase;
                    margin-bottom: 12px;
                    font-weight: 600;
                    text-shadow: 0 0 5px #00ff88, 0 0 8px rgba(0, 255, 136, 0.8);
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                }
                .neon-button {
                    width: 100%;
                    height: 60px;
                    background: transparent !important;
                    border: 2px solid #00ff88 !important;
                    color: #00ff88 !important;
                    font-size: 15px;
                    font-weight: bold;
                    letter-spacing: 4px;
                    text-transform: uppercase;
                    font-family: 'Courier New', 'Monaco', 'Consolas', monospace !important;
                    position: relative;
                    overflow: hidden;
                    border-radius: 0 !important;
                    text-shadow: 0 0 5px #00ff88, 0 0 10px rgba(0, 255, 136, 0.8);
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                }
                .neon-button::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: #00ff88;
                    transition: left 0.3s ease;
                    z-index: -1;
                }
                .neon-button:hover::before {
                    left: 0;
                }
                .neon-button:hover {
                    color: #0a0a0a !important;
                    box-shadow: 0 0 30px #00ff88 !important;
                }
                .neon-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .neon-error {
                    background: rgba(255, 0, 0, 0.1) !important;
                    border: 2px solid #ff0088 !important;
                    color: #ff0088 !important;
                    font-family: 'Courier New', monospace !important;
                    padding: 15px;
                    margin-bottom: 20px;
                    box-shadow: 0 0 10px rgba(255, 0, 136, 0.5);
                }
                .neon-divider {
                    border-color: rgba(0, 255, 136, 0.3) !important;
                }
                .neon-divider-text {
                    color: rgba(0, 255, 136, 1) !important;
                    font-family: 'Courier New', 'Monaco', 'Consolas', monospace !important;
                    letter-spacing: 3px;
                    font-weight: 600;
                    text-shadow: 0 0 5px rgba(0, 255, 136, 0.8);
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                }
                .neon-status-text {
                    color: #00ff88 !important;
                    font-family: 'Courier New', 'Monaco', 'Consolas', monospace !important;
                    letter-spacing: 2px;
                    font-size: 12px;
                    text-shadow: 0 0 5px #00ff88, 0 0 10px rgba(0, 255, 136, 0.8);
                    font-weight: 600;
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                }
            `}</style>
      <div className="neon-static-container">
        <div className="neon-static-form">
          <form onSubmit={handleSubmit} className="w-full">
            <div className="p-12">
              {/* Logo */}
              <div>
                <div className="neon-logo">
                  <div className="neon-logo-text">{getAppName()}</div>
                  <div className="neon-tagline">[SYSTEM_ACCESS]</div>
                </div>
              </div>

              {/* Divider */}
              <div className="my-8 flex items-center">
                <div className="h-px flex-1 neon-divider" />
                <span className="px-3 text-sm neon-divider-text">[CREDENTIALS]</span>
                <div className="h-px flex-1 neon-divider" />
              </div>

              {/* Error Message */}
              {error && <div className="neon-error">[ERROR] {error}</div>}

              {/* Email Login */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="neon-label">
                    [ID]
                  </Label>
                  <Input
                    required
                    name="email"
                    id="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="ENTER EMAIL ADDRESS"
                    className="neon-input"
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="neon-label">
                    [PASSWORD]
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      required
                      name="password"
                      id="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="ENTER PASSWORD"
                      className="neon-input"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#00ff88] hover:text-[#00ff88] outline-none focus:text-[#00ff88]"
                      style={{ filter: 'drop-shadow(0 0 5px #00ff88)' }}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button className="neon-button" type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      [AUTHENTICATING...]
                    </>
                  ) : (
                    <>
                      [ACCESS GRANTED]
                      <MoveRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>

              {/* Footer */}
              <div className="px-8 py-6 border-t neon-divider mt-8">
                <p className="text-sm neon-status-text text-center">
                  [SYSTEM_STATUS: {backendConnected === null ? 'CHECKING...' : backendConnected ? 'ACTIVE' : 'BACKEND OFFLINE'}]
                </p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
