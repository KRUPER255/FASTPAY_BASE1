import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isAuthenticated } from '@/lib/auth'
import './Error500Page.css'

const PANEL_LABELS = ['DB', '¯\\_(ツ)_/¯', 'ERR'] as const
const COLORS = ['#ff6b6b', '#ffd166', '#6bcbff', '#9be7a9', '#c792ff']

function runConfetti(x: number, y: number) {
  const c = document.createElement('canvas')
  c.width = window.innerWidth
  c.height = window.innerHeight
  c.style.position = 'fixed'
  c.style.left = '0'
  c.style.top = '0'
  c.style.pointerEvents = 'none'
  c.style.zIndex = '9999'
  document.body.appendChild(c)
  const ctx = c.getContext('2d')
  if (!ctx) return
  const parts: Array<{
    x: number
    y: number
    vx: number
    vy: number
    r: number
    life: number
    color: string
  }> = []
  const cx = x || window.innerWidth / 2
  const cy = y || window.innerHeight / 2
  for (let i = 0; i < 36; i++) {
    parts.push({
      x: cx,
      y: cy,
      vx: (Math.random() - 0.5) * 8,
      vy: Math.random() * -10 - 2,
      r: Math.random() * 6 + 3,
      life: Math.random() * 60 + 40,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    })
  }
  function frame() {
    ctx.clearRect(0, 0, c.width, c.height)
    parts.forEach((p) => {
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.35
      p.life--
      ctx.beginPath()
      ctx.fillStyle = p.color
      ctx.ellipse(p.x, p.y, p.r, p.r * 0.7, 0, 0, Math.PI * 2)
      ctx.fill()
    })
    if (parts.some((p) => p.life > 0)) requestAnimationFrame(frame)
    else c.remove()
  }
  requestAnimationFrame(frame)
}

export interface Error500PageProps {
  /** Custom retry: if provided, called on "Try Again" instead of reload. Can return true to show success. */
  onRetry?: () => boolean | Promise<boolean>
  /** Where "Go Home" navigates. Default: /dashboard/v2 if logged in, else /login */
  homePath?: string
  /** Optional message override */
  message?: string
}

export function Error500Page({ onRetry, homePath, message: messageProp }: Error500PageProps) {
  const navigate = useNavigate()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const scaleWrapperRef = useRef<HTMLDivElement>(null)

  const [errorNum, setErrorNum] = useState('500')
  const [isSuccess, setIsSuccess] = useState(false)
  const [message, setMessage] = useState(
    messageProp ?? 'Our server took a coffee break ☕ — please try again soon.'
  )
  const [hint, setHint] = useState("Hint: It's probably not your fault. Error code 500")
  const [panelLabel, setPanelLabel] = useState<string>('DB')
  const [debugStatus, setDebugStatus] = useState('idle')
  const [retryLabel, setRetryLabel] = useState('Try Again')
  const [retryDisabled, setRetryDisabled] = useState(false)
  const [popupVisible, setPopupVisible] = useState(false)

  const defaultHomePath = isAuthenticated() ? '/dashboard/v2' : '/login'

  const scaleToFit = useCallback(() => {
    const wrapper = wrapperRef.current
    const scaleWrapper = scaleWrapperRef.current
    if (!wrapper || !scaleWrapper) return
    const parentWidth = window.innerWidth
    const parentHeight = window.innerHeight
    const scaleX = parentWidth / wrapper.offsetWidth
    const scaleY = parentHeight / wrapper.offsetHeight
    const scale = Math.min(scaleX, scaleY, 1)
    scaleWrapper.style.transform = `translate(-50%, -50%) scale(${scale})`
  }, [])

  useEffect(() => {
    scaleToFit()
    const onResize = () => scaleToFit()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [scaleToFit])

  useEffect(() => {
    const t = setTimeout(() => setPopupVisible(true), 2000)
    const t2 = setTimeout(() => setPopupVisible(false), 15000)
    return () => {
      clearTimeout(t)
      clearTimeout(t2)
    }
  }, [])

  const handleRetry = useCallback(
    async (e: React.MouseEvent) => {
      setRetryDisabled(true)
      setRetryLabel('Checking...')
      setDebugStatus('retrying')
      await new Promise((r) => setTimeout(r, 900))

      let success: boolean
      if (onRetry) {
        try {
          success = await Promise.resolve(onRetry())
        } catch {
          success = false
        }
      } else {
        success = Math.random() > 0.5
      }

      if (success) {
        setErrorNum('200')
        setIsSuccess(true)
        setMessage('All fixed! The server is back online.')
        setHint('Redirecting you shortly...')
        runConfetti(e.clientX, e.clientY)
        setDebugStatus('success')
        setRetryLabel('Nice!')
        if (!onRetry) {
          setTimeout(() => window.location.reload(), 1200)
        }
      } else {
        setMessage('Still broken... maybe the server spilled its coffee.')
        setHint('Try again in a moment.')
        setPanelLabel(PANEL_LABELS[Math.floor(Math.random() * PANEL_LABELS.length)])
        setDebugStatus('error persists')
        setRetryLabel('Try Again')
      }
      setRetryDisabled(false)
    },
    [onRetry]
  )

  const handleGoHome = useCallback(() => {
    navigate(homePath ?? defaultHomePath)
  }, [navigate, homePath, defaultHomePath])

  return (
    <div className="error-500-root">
      <div ref={scaleWrapperRef} className="scale-wrapper">
        <div ref={wrapperRef} className="wrapper">
          <div className="left">
            <h1>500 — Internal Server Error</h1>
            <div
              className={`error-num ${isSuccess ? 'success-num' : ''}`}
              style={isSuccess ? { color: '#9be7a9' } : undefined}
            >
              {errorNum}
            </div>
            <p className="lead">{message}</p>
            <div className="actions">
              <button
                type="button"
                className="primary"
                onClick={handleRetry}
                disabled={retryDisabled}
              >
                {retryLabel}
              </button>
              <button type="button" className="ghost" onClick={handleGoHome}>
                Go Home
              </button>
            </div>
            <div className="hint">{hint}</div>
          </div>
          <div className="server">
            <div className="drive">
              <div className="light" />
              <div className="panel">{panelLabel}</div>
            </div>
            <div className="rack">
              <div className="robot">🤖 Server Bot</div>
              <div>API</div>
              <div>CDN</div>
            </div>
            <div className="foot">Debug status: {debugStatus}</div>
          </div>
        </div>
      </div>

      <div className={`popup ${popupVisible ? 'show' : ''}`}>
        <span>💡 Try the &quot;Try Again&quot; button a few times — you might get lucky!</span>
        <button type="button" onClick={() => setPopupVisible(false)} aria-label="Close">
          ✕
        </button>
      </div>
    </div>
  )
}

export default Error500Page
