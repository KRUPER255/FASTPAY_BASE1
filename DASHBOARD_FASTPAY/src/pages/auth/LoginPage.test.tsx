/**
 * Tests for LoginPage component
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import LoginPage from './LoginPage'
import * as auth from '@/lib/auth'

// Mock auth module
vi.mock('@/lib/auth', () => ({
  isAuthenticated: vi.fn(),
  getLoginRedirectPath: vi.fn(),
}))

// Mock LoginCard component
vi.mock('@/component/ui/login-card', () => ({
  default: () => <div>Login Form</div>,
}))

// Mock react-router-dom Navigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate">Navigate to: {to}</div>,
  }
})

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should redirect authenticated users to dashboard v2', () => {
    vi.mocked(auth.isAuthenticated).mockReturnValue(true)
    vi.mocked(auth.getLoginRedirectPath).mockReturnValue('/dashboard/v2')

    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    )

    expect(screen.getByTestId('navigate')).toBeInTheDocument()
    expect(screen.getByText(/Navigate to: \/dashboard\/v2/)).toBeInTheDocument()
  })

  it('should redirect authenticated OTP users to OTP page', () => {
    vi.mocked(auth.isAuthenticated).mockReturnValue(true)
    vi.mocked(auth.getLoginRedirectPath).mockReturnValue('/otp')

    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    )

    expect(screen.getByTestId('navigate')).toBeInTheDocument()
    expect(screen.getByText(/Navigate to: \/otp/)).toBeInTheDocument()
  })

  it('should show login form for unauthenticated users', () => {
    vi.mocked(auth.isAuthenticated).mockReturnValue(false)

    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    )

    expect(screen.getByText('Login Form')).toBeInTheDocument()
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument()
  })

  it('should use getLoginRedirectPath for redirect', () => {
    vi.mocked(auth.isAuthenticated).mockReturnValue(true)
    vi.mocked(auth.getLoginRedirectPath).mockReturnValue('/custom-path')

    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    )

    expect(auth.getLoginRedirectPath).toHaveBeenCalled()
    expect(screen.getByText(/Navigate to: \/custom-path/)).toBeInTheDocument()
  })
})
