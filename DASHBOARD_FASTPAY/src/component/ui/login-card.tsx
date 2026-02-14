import { useState, useEffect, useRef } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoveRight, Loader, Eye, EyeOff, Lock, Mail, AlertCircle } from 'lucide-react'
import { verifyLogin, getLoginRedirectPath } from '@/lib/auth'
import { getAppName } from '@/lib/branding'

export default function LoginCard() {
  const navigate = useNavigate()
  const emailInputRef = useRef<HTMLInputElement>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [emailError, setEmailError] = useState('')
  const [errorFlash, setErrorFlash] = useState(false)

  const brandName = getAppName()

  // On wrong attempt: red effect for 1 second, then back to normal (error message stays)
  useEffect(() => {
    if (!error) {
      setErrorFlash(false)
      return
    }
    setErrorFlash(true)
    const t = setTimeout(() => setErrorFlash(false), 1000)
    return () => clearTimeout(t)
  }, [error])

  // Focus first input on mount for accessibility
  useEffect(() => {
    emailInputRef.current?.focus()
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
        const baseMessage = 'Invalid email or password'
        // Show rate limiting warning after 3 failed attempts
        if (newAttempts >= 3) {
          setError(`${baseMessage}. ${5 - newAttempts > 0 ? `${5 - newAttempts} attempts remaining before temporary lockout.` : 'Too many failed attempts. Please try again later.'}`)
        } else {
          setError(baseMessage)
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
    <div
      className={`login-card-container login-card-container--otp-grid${errorFlash ? ' login-card-container--error-flash' : ''}`}
      onKeyDown={handleKeyDown}
    >
      <style>{`
        /* Login Container - Responsive Design */
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

        .login-card-container {
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
          position: relative;
        }

        /* Full-screen background animations */
        .login-card-container::before,
        .login-card-container::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          z-index: 0;
        }

        /* Animation Variant 1: Bank SMS Orbit - Full Screen */
        .login-card-container--bank-sms-orbit::before {
          background: 
            radial-gradient(circle at 20% 30%, rgba(139, 92, 246, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(139, 92, 246, 0.12) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.1) 0%, transparent 60%);
          animation: bankSmsBackgroundPulse 8s ease-in-out infinite;
        }

        .login-card-container--bank-sms-orbit::after {
          background-image: 
            repeating-linear-gradient(
              45deg,
              transparent,
              transparent 100px,
              rgba(139, 92, 246, 0.08) 100px,
              rgba(139, 92, 246, 0.08) 200px
            );
          animation: bankSmsFlow 20s linear infinite;
        }

        /* Animation Variant 2: Transaction Stream - Full Screen */
        .login-card-container--transaction-stream::before {
          background: 
            linear-gradient(
              90deg,
              transparent 0%,
              rgba(139, 92, 246, 0.2) 25%,
              rgba(139, 92, 246, 0.3) 50%,
              rgba(139, 92, 246, 0.2) 75%,
              transparent 100%
            );
          background-size: 200% 100%;
          animation: transactionStreamFull 8s linear infinite;
        }

        .login-card-container--transaction-stream::after {
          background: 
            repeating-linear-gradient(
              0deg,
              transparent 0px,
              transparent 60px,
              rgba(139, 92, 246, 0.15) 60px,
              rgba(139, 92, 246, 0.15) 120px
            );
          animation: transactionFlowVertical 12s linear infinite;
        }

        /* Animation Variant 3: Floating Cards - Full Screen */
        .login-card-container--floating-cards::before {
          background-image: 
            radial-gradient(circle at 10% 20%, rgba(139, 92, 246, 0.2) 0%, transparent 30%),
            radial-gradient(circle at 90% 80%, rgba(139, 92, 246, 0.18) 0%, transparent 30%),
            radial-gradient(circle at 50% 10%, rgba(139, 92, 246, 0.15) 0%, transparent 25%);
          animation: floatingCardsBackground 10s ease-in-out infinite;
        }

        .login-card-container--floating-cards::after {
          background: 
            repeating-linear-gradient(
              135deg,
              transparent,
              transparent 80px,
              rgba(139, 92, 246, 0.1) 80px,
              rgba(139, 92, 246, 0.1) 160px
            );
          animation: floatingCardsFlow 15s linear infinite;
        }

        /* Animation Variant 4: OTP Grid - No full-screen animation, only around login card */

        /* Animation Variant 5: Coin Pulse - Full Screen */
        .login-card-container--coin-pulse::before {
          background: 
            radial-gradient(circle at 25% 25%, rgba(139, 92, 246, 0.25) 0%, transparent 40%),
            radial-gradient(circle at 75% 75%, rgba(139, 92, 246, 0.22) 0%, transparent 40%),
            radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.2) 0%, transparent 50%);
          animation: coinPulseFull 5s ease-out infinite;
        }

        .login-card-container--coin-pulse::after {
          background: 
            repeating-radial-gradient(
              circle,
              rgba(139, 92, 246, 0.15) 0px,
              rgba(139, 92, 246, 0.15) 2px,
              transparent 2px,
              transparent 60px
            );
          animation: coinRippleFlow 8s linear infinite;
        }

        /* Keyframes for full-screen animations */
        @keyframes bankSmsBackgroundPulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }

        @keyframes bankSmsFlow {
          from { transform: translateX(0) translateY(0); }
          to { transform: translateX(200px) translateY(200px); }
        }

        @keyframes transactionStreamFull {
          from { background-position: 0% 0%; }
          to { background-position: 200% 0%; }
        }

        @keyframes transactionFlowVertical {
          from { transform: translateY(0); }
          to { transform: translateY(120px); }
        }

        @keyframes floatingCardsBackground {
          0%, 100% { opacity: 0.7; transform: translate(0, 0); }
          33% { opacity: 0.9; transform: translate(30px, -30px); }
          66% { opacity: 0.8; transform: translate(-20px, 20px); }
        }

        @keyframes floatingCardsFlow {
          from { transform: translateX(0) rotate(0deg); }
          to { transform: translateX(160px) rotate(360deg); }
        }


        @keyframes coinPulseFull {
          0% { opacity: 0.6; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.2); }
          100% { opacity: 0.6; transform: scale(0.9); }
        }

        @keyframes coinRippleFlow {
          from { transform: scale(0.8) rotate(0deg); opacity: 0.5; }
          to { transform: scale(1.2) rotate(360deg); opacity: 0.8; }
        }


        /* Respect reduced motion preference */
        @media (prefers-reduced-motion: reduce) {
          .login-card-shell::before,
          .login-card-shell::after,
          .login-card-shell * {
            animation: none !important;
          }
        }

        /* Animation Variant 1: Bank SMS Orbit */
        .login-card-shell--bank-sms-orbit {
          position: relative;
        }

        .login-card-shell--bank-sms-orbit::before {
          content: '';
          display: block;
          position: absolute;
          top: -16px;
          left: -16px;
          right: -16px;
          bottom: -16px;
          border-radius: 24px;
          background: linear-gradient(45deg, 
            rgba(139, 92, 246, 0.6) 0%, 
            rgba(139, 92, 246, 0.4) 50%, 
            rgba(139, 92, 246, 0.6) 100%);
          background-size: 200% 200%;
          animation: bankSmsGradient 8s ease infinite;
          z-index: 0;
          pointer-events: none;
        }

        .login-card-shell--bank-sms-orbit::after {
          content: '';
          display: block;
          position: absolute;
          top: -12px;
          left: -12px;
          right: -12px;
          bottom: -12px;
          border-radius: 22px;
          border: 3px solid rgba(139, 92, 246, 0.7);
          background: transparent;
          animation: bankSmsRotate 12s linear infinite;
          z-index: 0;
          pointer-events: none;
          box-shadow: 0 0 20px rgba(139, 92, 246, 0.4);
        }

        @keyframes bankSmsGradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        @keyframes bankSmsRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Animation Variant 2: Transaction Stream */
        .login-card-shell--transaction-stream {
          position: relative;
          overflow: visible;
        }

        .login-card-shell--transaction-stream::before {
          content: '';
          display: block;
          position: absolute;
          top: -16px;
          left: -16px;
          right: -16px;
          bottom: -16px;
          border-radius: 24px;
          background: 
            repeating-linear-gradient(
              90deg,
              transparent 0px,
              transparent 40px,
              rgba(139, 92, 246, 0.5) 40px,
              rgba(139, 92, 246, 0.5) 80px
            );
          animation: transactionStream 6s linear infinite;
          z-index: 0;
          pointer-events: none;
        }

        .login-card-shell--transaction-stream::after {
          content: '';
          display: block;
          position: absolute;
          top: -12px;
          left: -12px;
          right: -12px;
          bottom: -12px;
          border-radius: 20px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(139, 92, 246, 0.4) 30%,
            rgba(139, 92, 246, 0.6) 50%,
            rgba(139, 92, 246, 0.4) 70%,
            transparent 100%
          );
          animation: transactionFlow 4s ease-in-out infinite;
          z-index: 0;
          pointer-events: none;
        }

        @keyframes transactionStream {
          from { background-position: 0 0; }
          to { background-position: 80px 0; }
        }

        @keyframes transactionFlow {
          0%, 100% { opacity: 0.3; transform: translateX(-20px); }
          50% { opacity: 0.6; transform: translateX(20px); }
        }

        /* Animation Variant 3: Floating Cards */
        .login-card-shell--floating-cards {
          position: relative;
        }

        .login-card-shell--floating-cards::before {
          content: '';
          display: block;
          position: absolute;
          top: -20px;
          left: -20px;
          width: 60px;
          height: 40px;
          background: rgba(139, 92, 246, 0.5);
          border-radius: 8px;
          box-shadow: 0 4px 16px rgba(139, 92, 246, 0.6);
          animation: floatCard1 6s ease-in-out infinite;
          z-index: 0;
          pointer-events: none;
        }

        .login-card-shell--floating-cards::after {
          content: '';
          display: block;
          position: absolute;
          bottom: -20px;
          right: -20px;
          width: 50px;
          height: 35px;
          background: rgba(139, 92, 246, 0.45);
          border-radius: 8px;
          box-shadow: 0 4px 16px rgba(139, 92, 246, 0.55);
          animation: floatCard2 8s ease-in-out infinite;
          z-index: 0;
          pointer-events: none;
        }

        @keyframes floatCard1 {
          0%, 100% { 
            transform: translate(0, 0) rotate(0deg);
            opacity: 0.4;
          }
          25% { 
            transform: translate(15px, -15px) rotate(5deg);
            opacity: 0.6;
          }
          50% { 
            transform: translate(0, -25px) rotate(0deg);
            opacity: 0.5;
          }
          75% { 
            transform: translate(-15px, -15px) rotate(-5deg);
            opacity: 0.6;
          }
        }

        @keyframes floatCard2 {
          0%, 100% { 
            transform: translate(0, 0) rotate(0deg);
            opacity: 0.3;
          }
          33% { 
            transform: translate(-20px, 20px) rotate(-8deg);
            opacity: 0.5;
          }
          66% { 
            transform: translate(20px, 10px) rotate(8deg);
            opacity: 0.4;
          }
        }

        /* OTP Grid: animation around login card; no tint below card (form box) */
        .login-card-shell--otp-grid {
          position: relative;
        }

        .login-card-shell--otp-grid::before {
          content: '';
          display: block;
          position: absolute;
          top: -20px;
          left: -20px;
          right: -20px;
          bottom: -20px;
          border-radius: 24px;
          background-image: 
            repeating-linear-gradient(
              0deg,
              rgba(139, 92, 246, 0.3) 0px,
              rgba(139, 92, 246, 0.3) 1px,
              transparent 1px,
              transparent 40px
            ),
            repeating-linear-gradient(
              90deg,
              rgba(139, 92, 246, 0.3) 0px,
              rgba(139, 92, 246, 0.3) 1px,
              transparent 1px,
              transparent 40px
            );
          animation: otpGridPulse 3s ease-in-out infinite;
          z-index: 0;
          pointer-events: none;
        }

        .login-card-shell--otp-grid::after {
          content: '';
          display: block;
          position: absolute;
          top: -16px;
          left: -16px;
          right: -16px;
          bottom: -16px;
          border-radius: 22px;
          border: 2px dashed rgba(139, 92, 246, 0.7);
          box-shadow: 
            0 0 15px rgba(139, 92, 246, 0.4),
            inset 0 0 25px rgba(139, 92, 246, 0.15);
          animation: otpGridBorder 3s ease-in-out infinite;
          z-index: 0;
          pointer-events: none;
        }

        @keyframes otpGridPulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }

        @keyframes otpGridBorder {
          0%, 100% {
            border-color: rgba(139, 92, 246, 0.6);
            box-shadow: 0 0 15px rgba(139, 92, 246, 0.4), inset 0 0 25px rgba(139, 92, 246, 0.15);
            transform: scale(1);
          }
          50% {
            border-color: rgba(139, 92, 246, 0.9);
            box-shadow: 0 0 25px rgba(139, 92, 246, 0.6), inset 0 0 35px rgba(139, 92, 246, 0.25);
            transform: scale(1.01);
          }
        }

        /* Below card (form box): no tint, solid background so grid/glow don't show through */
        .login-card-shell--otp-grid .login-card-bottom {
          background: rgba(255, 255, 255, 0.98);
          box-shadow: 0 4px 20px -8px rgba(0, 0, 0, 0.08);
        }

        /* Wrong attempt: red blink for ~1s then back to normal */
        .login-card-container--error-flash .login-card-shell--otp-grid::before {
          background-image: 
            repeating-linear-gradient(
              0deg,
              rgba(239, 68, 68, 0.5) 0px,
              rgba(239, 68, 68, 0.5) 1px,
              transparent 1px,
              transparent 40px
            ),
            repeating-linear-gradient(
              90deg,
              rgba(239, 68, 68, 0.5) 0px,
              rgba(239, 68, 68, 0.5) 1px,
              transparent 1px,
              transparent 40px
            ) !important;
          animation: otpGridErrorBlink 0.5s ease-in-out 2 forwards;
        }

        .login-card-container--error-flash .login-card-shell--otp-grid::after {
          border-color: rgba(239, 68, 68, 0.9) !important;
          box-shadow: 0 0 20px rgba(239, 68, 68, 0.5), inset 0 0 25px rgba(239, 68, 68, 0.2) !important;
          animation: otpGridErrorBlink 0.5s ease-in-out 2 forwards;
        }

        .login-card-container--error-flash .login-card-logo-text {
          color: #dc2626;
          animation: otpGridErrorBlink 0.5s ease-in-out 2 forwards;
        }

        @keyframes otpGridErrorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        /* Animation Variant 5: Coin Pulse */
        .login-card-shell--coin-pulse {
          position: relative;
        }

        .login-card-shell--coin-pulse::before {
          content: '';
          display: block;
          position: absolute;
          top: 50%;
          left: 50%;
          width: 120px;
          height: 120px;
          margin: -60px 0 0 -60px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(139, 92, 246, 0.5) 0%, transparent 70%);
          animation: coinPulse1 3s ease-out infinite;
          z-index: 0;
          pointer-events: none;
        }

        .login-card-shell--coin-pulse::after {
          content: '';
          display: block;
          position: absolute;
          top: 50%;
          left: 50%;
          width: 100px;
          height: 100px;
          margin: -50px 0 0 -50px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(139, 92, 246, 0.45) 0%, transparent 60%);
          animation: coinPulse2 3s ease-out infinite 0.5s;
          z-index: 0;
          pointer-events: none;
        }

        @keyframes coinPulse1 {
          0% {
            transform: scale(0.8);
            opacity: 0.6;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.3;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }

        @keyframes coinPulse2 {
          0% {
            transform: scale(0.8);
            opacity: 0.5;
          }
          50% {
            transform: scale(1.3);
            opacity: 0.2;
          }
          100% {
            transform: scale(1.6);
            opacity: 0;
          }
        }

        /* Animation Shell Container - wraps both boxes */
        .login-card-shell {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          width: 100%;
          max-width: 400px;
          position: relative;
          padding: 8px;
          border-radius: 20px;
          overflow: visible;
          z-index: 10;
        }

        /* Top Box - Logo and Tagline */
        .login-card-top {
          background: rgba(255, 255, 255, 0.98);
          border-radius: 16px;
          padding: 24px 32px;
          width: 100%;
          box-shadow:
            0 20px 40px -12px rgba(0, 0, 0, 0.12),
            0 0 0 1px rgba(148, 163, 184, 0.2);
          border: 1px solid rgba(148, 163, 184, 0.3);
          position: relative;
          z-index: 10;
          backdrop-filter: blur(10px);
        }

        .login-card-top-inner {
          background: transparent;
          border-radius: 12px;
          padding: 0;
        }

        /* Bottom Box - Form (border only) */
        .login-card-bottom {
          background: transparent;
          border-radius: 20px;
          padding: 16px;
          width: 100%;
          max-height: calc(100vh - 200px);
          max-height: calc(100dvh - 200px);
          overflow-y: auto;
          border: 1px solid rgba(148, 163, 184, 0.35);
          position: relative;
          z-index: 10;
        }

        .login-card-bottom-inner {
          background: transparent;
          border-radius: 12px;
          padding: 0;
        }

        /* OTP Grid variant - add color shade to top box only; bottom box stays neutral */
        .login-card-shell--otp-grid .login-card-top {
          background: transparent;
          border: 1px solid rgba(139, 92, 246, 0.35);
          box-shadow: 0 20px 40px -12px rgba(139, 92, 246, 0.15);
        }

        /* Mobile optimizations */
        @media (max-width: 767px) {
          .login-card-container {
            padding: 8px;
          }

          .login-card-shell {
            padding: 4px;
            gap: 16px;
            max-width: 100%;
          }

          /* Reduce animation intensity on mobile for better performance */
          .login-card-shell--bank-sms-orbit::before,
          .login-card-shell--bank-sms-orbit::after,
          .login-card-shell--transaction-stream::before,
          .login-card-shell--transaction-stream::after,
          .login-card-shell--floating-cards::before,
          .login-card-shell--floating-cards::after,
          .login-card-shell--otp-grid::before,
          .login-card-shell--otp-grid::after,
          .login-card-shell--coin-pulse::before,
          .login-card-shell--coin-pulse::after {
            opacity: 0.7;
          }

          .login-card-top {
            padding: 20px 24px;
            border-radius: 12px;
          }

          .login-card-bottom {
            padding: 12px;
            border-radius: 12px;
            max-height: calc(100vh - 180px);
            max-height: calc(100dvh - 180px);
          }

          .login-card-logo-text {
            font-size: 1.75rem !important;
          }

        .login-card-logo-tagline {
            font-size: 0.75rem !important;
          }

          .login-card-form-body {
            padding: 1rem 1rem !important;
          }
        }

        /* Tablet optimizations */
        @media (min-width: 768px) and (max-width: 1024px) {
          .login-card-shell {
            max-width: 380px;
          }

          .login-card-top {
            padding: 22px 28px;
          }

          .login-card-bottom {
            padding: 14px;
          }
        }

        /* Logo Section - in top box */
        .login-card-logo-section {
          text-align: center;
          margin-bottom: 0;
        }

        .login-card-logo-text {
          font-family: 'Poppins', 'Segoe UI', sans-serif;
          font-size: 2rem;
          font-weight: 700;
          color: #334155;
          margin: 0 0 0.25rem;
          letter-spacing: -0.5px;
        }

        .login-card-form-body {
          background: transparent;
          border-radius: 16px;
          padding: 1.25rem 1.25rem;
          border: 1px solid rgba(148, 163, 184, 0.25);
        }

        .login-card-logo-tagline {
          font-size: 0.8rem;
          margin-top: 0.5rem;
          font-weight: 500;
        }

        /* Tagline streaming effect: moving gradient */
        .login-card-tagline-stream {
          display: inline-block;
          background: linear-gradient(
            90deg,
            #64748b 0%,
            #94a3b8 15%,
            hsl(var(--primary)) 35%,
            #94a3b8 50%,
            #64748b 65%,
            hsl(var(--primary)) 85%,
            #64748b 100%
          );
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: loginTaglineStream 3s linear infinite;
        }

        @keyframes loginTaglineStream {
          from { background-position: 200% 0; }
          to { background-position: -200% 0; }
        }

        /* Input Container (border only) */
        .login-card-input-container {
          margin-bottom: 1.25rem;
          background: transparent;
          border-radius: 12px;
          padding: 0.5rem 0.75rem 0.25rem;
          border: 1px solid rgba(148, 163, 184, 0.3);
        }

        .login-card-input-wrapper {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 0;
          color: #334155;
          padding-bottom: 4px;
        }

        /* Underline lives on wrapper so it never cuts through the label */
        .login-card-input-wrapper::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 1px;
          background: rgba(148, 163, 184, 0.35);
          border-radius: 0 0 2px 2px;
          transition: background 0.2s, box-shadow 0.2s;
        }

        .login-card-input-wrapper:focus-within::after {
          background: hsl(var(--primary) / 0.7);
          box-shadow: 0 1px 0 0 hsl(var(--primary) / 0.4);
        }

        .login-card-input-wrapper:has(.login-card-input[aria-invalid="true"])::after {
          background: rgba(239, 68, 68, 0.7);
        }

        .login-card-input-icon {
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

        .login-card-input {
          width: 100%;
          min-height: 44px;
          height: 44px;
          border: none;
          outline: none;
          padding: 0 28px 0 26px;
          border-radius: 0;
          color: #334155;
          font-size: 14px;
          background-color: transparent;
          transition: color 0.2s;
          font-family: inherit;
          -webkit-text-fill-color: #334155;
        }

        .login-card-input:focus {
          color: #334155;
          -webkit-text-fill-color: #334155;
        }

        .login-card-input:not(:placeholder-shown) {
          color: #334155;
          -webkit-text-fill-color: #334155;
        }

        .login-card-input::placeholder {
          color: transparent;
        }

        .login-card-input:-webkit-autofill,
        .login-card-input:-webkit-autofill:hover,
        .login-card-input:-webkit-autofill:focus {
          -webkit-text-fill-color: #334155;
          -webkit-box-shadow: 0 0 0px 1000px rgba(255, 255, 255, 0.9) inset;
          box-shadow: 0 0 0px 1000px rgba(255, 255, 255, 0.9) inset;
        }

        .login-card-floating-label {
          font-size: 14px;
          padding-left: 26px;
          position: absolute;
          top: 14px;
          left: 0;
          right: 0;
          transition: transform 0.2s, font-size 0.2s, color 0.2s;
          pointer-events: none;
          color: #64748b;
          z-index: 1;
          background: transparent;
          letter-spacing: 0.01em;
        }

        .login-card-input:not(:placeholder-shown) ~ .login-card-floating-label,
        .login-card-input:focus ~ .login-card-floating-label {
          padding-left: 26px;
          transform: translateY(-22px);
          font-size: 12px;
          color: #475569;
          font-weight: 500;
        }

        .login-card-input:-webkit-autofill ~ .login-card-floating-label,
        .login-card-input:autofill ~ .login-card-floating-label {
          padding-left: 26px;
          transform: translateY(-22px);
          font-size: 12px;
        }

        .login-card-input-error {
          font-size: 12px;
          color: #ef4444;
          margin-top: 4px;
          padding-left: 26px;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .login-card-password-toggle {
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

        .login-card-password-toggle:hover {
          color: #334155;
        }

        .login-card-password-toggle:focus {
          outline: 2px solid hsl(var(--primary));
          outline-offset: 2px;
          border-radius: 4px;
        }

        /* Remember Me Checkbox */
        .login-card-remember-me {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 1rem;
          cursor: pointer;
          user-select: none;
        }

        .login-card-remember-me input[type="checkbox"] {
          width: 18px;
          height: 18px;
          min-width: 18px;
          min-height: 18px;
          cursor: pointer;
          accent-color: hsl(var(--primary));
        }

        .login-card-remember-me label {
          font-size: 14px;
          color: #64748b;
          cursor: pointer;
          margin: 0;
        }

        /* Forgot Password Link */
        .login-card-forgot-password {
          text-align: right;
          margin-bottom: 1rem;
        }

        .login-card-forgot-password a {
          font-size: 13px;
          color: hsl(var(--primary));
          text-decoration: none;
          transition: color 0.2s ease;
        }

        .login-card-forgot-password a:hover {
          color: hsl(var(--primary) / 0.8);
          text-decoration: underline;
        }

        .login-card-forgot-password a:focus {
          outline: 2px solid hsl(var(--primary));
          outline-offset: 2px;
          border-radius: 2px;
        }

        /* Button - uses theme primary */
        .login-card-button {
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

        .login-card-button:hover:not(:disabled) {
          background: linear-gradient(135deg, hsl(var(--primary) / 0.95) 0%, hsl(var(--primary) / 0.8) 100%);
          border-color: hsl(var(--primary) / 0.7);
          color: hsl(var(--primary-foreground));
          box-shadow: 0 4px 16px hsl(var(--primary) / 0.4);
        }

        .login-card-button:active:not(:disabled) {
          transform: scale(0.99);
        }

        .login-card-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .login-card-button:focus {
          outline: 2px solid hsl(var(--primary));
          outline-offset: 2px;
        }

        /* Error Message */
        .login-card-error {
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
        .login-card-footer {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(148, 163, 184, 0.35);
          text-align: center;
        }

        .login-card-footer-text {
          font-size: 0.7rem;
          color: #64748b;
        }

        .login-card-spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Accessibility: Skip link */
        .login-card-skip-link {
          position: absolute;
          top: -40px;
          left: 0;
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          padding: 8px 16px;
          text-decoration: none;
          z-index: 100;
        }

        .login-card-skip-link:focus {
          top: 0;
        }

      `}</style>

      <a href="#main-content" className="login-card-skip-link">Skip to main content</a>

      <div className="login-card-shell login-card-shell--otp-grid">
        {/* Top Box - Logo and Tagline */}
        <div className="login-card-top">
          <div className="login-card-top-inner">
            <div className="login-card-logo-section">
              <h1 className="login-card-logo-text">{brandName}</h1>
              <p className="login-card-logo-tagline">
                <span className="login-card-tagline-stream">Secure Payment Management</span>
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Box - Form */}
        <div className="login-card-bottom">
          <div className="login-card-bottom-inner" id="main-content">
            <form onSubmit={handleSubmit} noValidate>
              <div className="login-card-form-body">
              {/* Error Message */}
              {error && (
                <div className="login-card-error" role="alert" aria-live="assertive">
                  <AlertCircle size={16} aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              {/* Email Input */}
              <div className="login-card-input-container">
                <div className="login-card-input-wrapper">
                  <Mail className="login-card-input-icon" aria-hidden="true" />
                  <input
                    ref={emailInputRef}
                    type="email"
                    id="email"
                    name="email"
                    value={email}
                    onChange={handleEmailChange}
                    onBlur={() => validateEmail(email)}
                    placeholder=" "
                    className="login-card-input"
                    required
                    disabled={isLoading}
                    aria-label="Email address"
                    aria-describedby={emailError ? "email-error" : undefined}
                    aria-invalid={emailError ? "true" : "false"}
                    aria-required="true"
                    autoComplete="email"
                  />
                  <label htmlFor="email" className="login-card-floating-label">
                    Email Address
                  </label>
                  {emailError && (
                    <div id="email-error" className="login-card-input-error" role="alert">
                      <AlertCircle size={12} aria-hidden="true" />
                      <span>{emailError}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Password Input */}
              <div className="login-card-input-container">
                <div className="login-card-input-wrapper">
                  <Lock className="login-card-input-icon" aria-hidden="true" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder=" "
                    className="login-card-input"
                    required
                    disabled={isLoading}
                    aria-label="Password"
                    aria-describedby={error ? "password-error" : undefined}
                    aria-required="true"
                    autoComplete="current-password"
                  />
                  <label htmlFor="password" className="login-card-floating-label">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="login-card-password-toggle"
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
                <label className="login-card-remember-me">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={isLoading}
                    aria-label="Remember me for 7 days"
                  />
                  <span>Remember me</span>
                </label>
                <div className="login-card-forgot-password">
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
                className="login-card-button"
                disabled={isLoading || !!emailError}
                aria-label="Sign in"
              >
                {isLoading ? (
                  <>
                    <Loader className="login-card-spinner" size={20} aria-hidden="true" />
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
              <div className="login-card-footer">
                <p className="login-card-footer-text">© 2026 {brandName}. All rights reserved.</p>
              </div>
            </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
