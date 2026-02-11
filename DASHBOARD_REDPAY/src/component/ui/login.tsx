import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/component/ui/button'
import { Input } from '@/component/ui/input'
import { Label } from '@/component/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogClose } from '@/component/ui/dialog'
import { MoveRight, Loader, Eye, EyeOff } from 'lucide-react'
import { verifyLogin, saveSession, getLoginRedirectPath } from '@/lib/auth'

interface LoginModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLoginSuccess: () => void
}

export default function LoginModal({ open, onOpenChange, onLoginSuccess }: LoginModalProps) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
        onOpenChange(false)
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

  const handleDemoLogin = () => {
    setIsLoading(true)
    // Simulate a small delay for better UX
    setTimeout(() => {
      const demoSession = {
        email: 'demo@fastpay.com',
        status: 'active',
        timestamp: Date.now(),
        access: 1, // Demo user has OTP only access
      }
      saveSession(demoSession)
      onLoginSuccess()
      onOpenChange(false)
      // Redirect based on demo user access level
      const redirectPath = getLoginRedirectPath(1)
      navigate(redirectPath)
      setIsLoading(false)
    }, 1000)
  }

  return (
    <>
      <style>{`
                @keyframes neonPulse {
                    0%, 100% { 
                        box-shadow: 0 0 20px #00ff88, inset 0 0 20px rgba(0, 255, 136, 0.1);
                    }
                    50% { 
                        box-shadow: 0 0 40px #00ff88, 0 0 60px #00ff88, inset 0 0 20px rgba(0, 255, 136, 0.2);
                    }
                }
                @keyframes glitch {
                    0%, 100% { transform: translate(0); }
                    20% { transform: translate(-2px, 2px); }
                    40% { transform: translate(-2px, -2px); }
                    60% { transform: translate(2px, 2px); }
                    80% { transform: translate(2px, -2px); }
                }
                @keyframes gridMove {
                    0% { transform: translate(0, 0); }
                    100% { transform: translate(50px, 50px); }
                }
                @keyframes slideIn {
                    from { opacity: 0; transform: translateX(-50px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                .neon-cyberpunk-bg {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: #0a0a0a;
                    background-image: 
                        linear-gradient(rgba(0, 255, 136, 0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(0, 255, 136, 0.1) 1px, transparent 1px);
                    background-size: 50px 50px;
                    /* animation: gridMove 20s linear infinite; */
                    pointer-events: none;
                    z-index: 40;
                }
                /* Override dialog backdrop to show neon background */
                .neon-dialog-backdrop {
                    background: rgba(0, 0, 0, 0.85) !important;
                    backdrop-filter: blur(2px);
                }
                .neon-cyberpunk-dialog {
                    font-family: 'Courier New', 'Monaco', 'Consolas', monospace !important;
                    background: #000000 !important;
                    border: 2px solid #00ff88 !important;
                    border-radius: 8px !important;
                    box-shadow: 
                        0 0 10px #00ff88,
                        0 0 20px #00ff88,
                        0 0 30px rgba(0, 255, 136, 0.5),
                        inset 0 0 20px rgba(0, 255, 136, 0.1) !important;
                    /* animation: neonPulse 2s ease-in-out infinite !important; */
                    z-index: 51 !important;
                    opacity: 1 !important;
                    visibility: visible !important;
                    display: grid !important;
                }
                /* Make dialog backdrop more transparent to show neon background */
                .neon-dialog-backdrop {
                    background: rgba(0, 0, 0, 0.85) !important;
                    backdrop-filter: blur(2px) !important;
                    z-index: 9998 !important;
                }
                /* Prevent backdrop from interfering with dialog */
                [data-radix-dialog-overlay] {
                    z-index: 9998 !important;
                }
                [data-radix-dialog-content] {
                    z-index: 9999 !important;
                    pointer-events: auto !important;
                }
                .neon-logo {
                    text-align: center;
                    margin-bottom: 50px;
                    /* animation: glitch 3s infinite; */
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
                    image-rendering: pixelated;
                    image-rendering: -moz-crisp-edges;
                    image-rendering: crisp-edges;
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
                    /* animation: slideIn 0.8s ease-out; */
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
                    /* animation: slideIn 0.8s ease-out 0.2s both; */
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
                .neon-close-button {
                    color: #00ff88 !important;
                    border: 1px solid #00ff88 !important;
                    background: rgba(0, 0, 0, 0.5) !important;
                    width: 32px !important;
                    height: 32px !important;
                    border-radius: 0 !important;
                    opacity: 0.8 !important;
                    transition: all 0.3s ease !important;
                }
                .neon-close-button:hover {
                    opacity: 1 !important;
                    background: rgba(0, 255, 136, 0.1) !important;
                    box-shadow: 0 0 10px #00ff88 !important;
                    border-color: #00ff88 !important;
                }
                .neon-close-button svg {
                    filter: drop-shadow(0 0 3px #00ff88);
                }
            `}</style>
      {/* {open && <div className="neon-cyberpunk-bg" />} */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          className="neon-cyberpunk-dialog max-w-md p-0"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <DialogClose onClose={() => onOpenChange(false)} className="neon-close-button" />
          <form onSubmit={handleSubmit} className="w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-12">
              {/* Logo */}
              <DialogHeader>
                <div className="neon-logo">
                  <div className="neon-logo-text">FASTPAY</div>
                  <div className="neon-tagline">[SYSTEM_ACCESS]</div>
                </div>
              </DialogHeader>

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

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t neon-divider" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-[#0a0a0a] px-2 neon-divider-text">[OR]</span>
                  </div>
                </div>

                <Button
                  className="neon-button"
                  type="button"
                  disabled={isLoading}
                  onClick={handleDemoLogin}
                >
                  [DEMO_MODE]
                </Button>
              </div>

              {/* Footer */}
              <div className="px-8 py-6 border-t neon-divider mt-8">
                <p className="text-sm neon-status-text text-center">[SYSTEM_STATUS: ACTIVE]</p>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
