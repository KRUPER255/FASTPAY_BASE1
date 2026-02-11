import { Navigate, useNavigate } from 'react-router-dom'
import { isAuthenticated } from '@/lib/auth'
import { ArrowRight, Palette, BarChart3, Sparkles, Home, LogOut } from 'lucide-react'

interface StylesIndexProps {
  onLogout?: () => void
}

export default function StylesIndex({ onLogout }: StylesIndexProps) {
  const navigate = useNavigate()

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }

  const handleLogout = () => {
    onLogout?.()
    navigate('/login')
  }

  const styles = [
    {
      id: 'shadcn',
      name: 'shadcn/ui',
      description: 'Clean, minimal design with Radix UI primitives. Perfect for professional admin panels and SaaS dashboards.',
      icon: Palette,
      path: '/styles/shadcn',
      gradient: 'from-slate-600 to-slate-800',
      features: ['Metric Cards with Trends', 'Data Tables', 'Area & Bar Charts', 'Collapsible Sidebar'],
      preview: 'bg-slate-900',
    },
    {
      id: 'tremor',
      name: 'Tremor Analytics',
      description: 'Data visualization focused with KPI cards, sparklines, and real-time analytics components.',
      icon: BarChart3,
      path: '/styles/tremor',
      gradient: 'from-emerald-600 to-cyan-600',
      features: ['KPI Sparklines', 'Combo Charts', 'Status Tracker', 'Server Metrics'],
      preview: 'bg-slate-950',
    },
    {
      id: 'glass',
      name: 'Glassmorphism',
      description: 'Modern frosted glass effects with gradient backgrounds. Visually striking and premium feel.',
      icon: Sparkles,
      path: '/styles/glass',
      gradient: 'from-violet-600 to-fuchsia-600',
      features: ['Frosted Glass Cards', 'Animated Backgrounds', 'Credit Card UI', 'Spending Charts'],
      preview: 'bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950',
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Home className="h-5 w-5" />
              <span className="text-sm font-medium">Back to Dashboard</span>
            </button>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Dashboard Styles</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Explore different dashboard design styles. Each style showcases modern UI patterns and best practices.
          </p>
        </div>

        {/* Style cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {styles.map((style) => (
            <div
              key={style.id}
              className="group rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/50 hover:shadow-xl transition-all duration-300"
            >
              {/* Preview area */}
              <div className={`h-48 ${style.preview} relative overflow-hidden`}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className={`h-20 w-20 rounded-2xl bg-gradient-to-br ${style.gradient} flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-300`}
                  >
                    <style.icon className="h-10 w-10 text-white" />
                  </div>
                </div>
                {/* Decorative elements */}
                {style.id === 'glass' && (
                  <>
                    <div className="absolute top-4 right-4 w-24 h-24 bg-purple-500/30 rounded-full blur-2xl" />
                    <div className="absolute bottom-4 left-4 w-16 h-16 bg-cyan-500/30 rounded-full blur-xl" />
                  </>
                )}
                {style.id === 'tremor' && (
                  <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-emerald-500/20 to-transparent" />
                )}
              </div>

              {/* Content */}
              <div className="p-6">
                <h3 className="text-xl font-semibold mb-2">{style.name}</h3>
                <p className="text-muted-foreground text-sm mb-4">{style.description}</p>

                {/* Features */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {style.features.map((feature) => (
                    <span
                      key={feature}
                      className="px-2 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-medium"
                    >
                      {feature}
                    </span>
                  ))}
                </div>

                {/* Action button */}
                <button
                  onClick={() => navigate(style.path)}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r ${style.gradient} text-white font-medium hover:opacity-90 transition-opacity`}
                >
                  View Demo
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Quick links */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-4">Quick Access</p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {styles.map((style) => (
              <button
                key={style.id}
                onClick={() => navigate(style.path)}
                className="px-4 py-2 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground transition-colors text-sm font-medium"
              >
                {style.name}
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
