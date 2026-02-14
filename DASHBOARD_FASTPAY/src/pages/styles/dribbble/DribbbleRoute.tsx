import { Navigate, useNavigate } from 'react-router-dom'
import { isAuthenticated } from '@/lib/auth'
import { Home, LogOut } from 'lucide-react'
import DribbbleStyleDemo from './DribbbleStyleDemo'

interface DribbbleRouteProps {
  onLogout?: () => void
}

export default function DribbbleRoute({ onLogout }: DribbbleRouteProps) {
  const navigate = useNavigate()

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }

  const handleLogout = () => {
    onLogout?.()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-6">
          <button
            onClick={() => navigate('/styles')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
          >
            <Home className="h-4 w-4" />
            Back to styles
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors text-sm font-medium"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </header>
      <DribbbleStyleDemo />
    </div>
  )
}
