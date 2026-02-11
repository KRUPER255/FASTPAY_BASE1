import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { isAuthenticated } from '@/lib/auth'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  ArrowUpRight,
  ArrowDownRight,
  Users,
  CreditCard,
  Activity,
  DollarSign,
  MoreHorizontal,
  Search,
  Bell,
  Settings,
  LogOut,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Menu,
  X,
  Home,
  BarChart3,
  FileText,
  MessageSquare,
  Calendar,
  HelpCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Sample data
const revenueData = [
  { month: 'Jan', revenue: 4000, profit: 2400 },
  { month: 'Feb', revenue: 3000, profit: 1398 },
  { month: 'Mar', revenue: 5000, profit: 3800 },
  { month: 'Apr', revenue: 4780, profit: 3908 },
  { month: 'May', revenue: 5890, profit: 4800 },
  { month: 'Jun', revenue: 6390, profit: 5300 },
  { month: 'Jul', revenue: 7490, profit: 6100 },
]

const activityData = [
  { day: 'Mon', value: 120 },
  { day: 'Tue', value: 180 },
  { day: 'Wed', value: 150 },
  { day: 'Thu', value: 210 },
  { day: 'Fri', value: 290 },
  { day: 'Sat', value: 180 },
  { day: 'Sun', value: 140 },
]

const pieData = [
  { name: 'Desktop', value: 45, color: 'hsl(var(--primary))' },
  { name: 'Mobile', value: 35, color: 'hsl(var(--secondary))' },
  { name: 'Tablet', value: 20, color: 'hsl(var(--accent))' },
]

const recentTransactions = [
  { id: 1, name: 'Payment from Alex', email: 'alex@email.com', amount: '+$1,999.00', status: 'completed' },
  { id: 2, name: 'Payment to Sarah', email: 'sarah@email.com', amount: '-$39.00', status: 'pending' },
  { id: 3, name: 'Payment from Mike', email: 'mike@email.com', amount: '+$299.00', status: 'completed' },
  { id: 4, name: 'Payment to Store', email: 'store@email.com', amount: '-$99.00', status: 'completed' },
  { id: 5, name: 'Payment from John', email: 'john@email.com', amount: '+$3,999.00', status: 'processing' },
]

interface ShadcnDashboardProps {
  onLogout?: () => void
}

export default function ShadcnDashboard({ onLogout }: ShadcnDashboardProps) {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }

  const handleLogout = () => {
    onLogout?.()
    navigate('/login')
  }

  const stats = [
    {
      title: 'Total Revenue',
      value: '$45,231.89',
      change: '+20.1%',
      trend: 'up',
      icon: DollarSign,
      description: 'from last month',
    },
    {
      title: 'Subscriptions',
      value: '+2,350',
      change: '+180.1%',
      trend: 'up',
      icon: Users,
      description: 'from last month',
    },
    {
      title: 'Sales',
      value: '+12,234',
      change: '+19%',
      trend: 'up',
      icon: CreditCard,
      description: 'from last month',
    },
    {
      title: 'Active Now',
      value: '+573',
      change: '-2%',
      trend: 'down',
      icon: Activity,
      description: 'since last hour',
    },
  ]

  const navItems = [
    { icon: Home, label: 'Dashboard', active: true },
    { icon: BarChart3, label: 'Analytics' },
    { icon: FileText, label: 'Reports' },
    { icon: MessageSquare, label: 'Messages' },
    { icon: Calendar, label: 'Calendar' },
    { icon: Settings, label: 'Settings' },
    { icon: HelpCircle, label: 'Help' },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-full bg-card border-r border-border transition-all duration-300',
          sidebarOpen ? 'w-64' : 'w-20',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">FP</span>
            </div>
            {sidebarOpen && <span className="font-semibold text-foreground">FastPay</span>}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
          >
            <Menu className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <nav className="p-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={cn(
                'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-colors',
                item.active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-4 left-4 right-4">
          <button
            onClick={handleLogout}
            className={cn(
              'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors',
              !sidebarOpen && 'justify-center'
            )}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {sidebarOpen && <span className="text-sm font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main
        className={cn(
          'transition-all duration-300',
          sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
        )}
      >
        {/* Header */}
        <header className="sticky top-0 z-30 h-16 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
          <div className="flex h-full items-center justify-between px-4 lg:px-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden h-10 w-10 flex items-center justify-center rounded-md hover:bg-accent"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="h-10 w-64 rounded-lg border border-input bg-background pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button className="relative h-10 w-10 flex items-center justify-center rounded-lg hover:bg-accent">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive" />
              </button>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent cursor-pointer">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">AD</span>
                </div>
                <span className="hidden md:block text-sm font-medium">Admin</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard content */}
        <div className="p-4 lg:p-8 space-y-8">
          {/* Page title */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Welcome back! Here's an overview of your business.
            </p>
          </div>

          {/* Stats cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.title}
                className="rounded-xl border border-border bg-card p-6 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">{stat.title}</span>
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-bold">{stat.value}</span>
                </div>
                <div className="mt-1 flex items-center gap-1">
                  {stat.trend === 'up' ? (
                    <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-destructive" />
                  )}
                  <span
                    className={cn(
                      'text-sm font-medium',
                      stat.trend === 'up' ? 'text-emerald-500' : 'text-destructive'
                    )}
                  >
                    {stat.change}
                  </span>
                  <span className="text-sm text-muted-foreground">{stat.description}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid gap-6 lg:grid-cols-7">
            {/* Revenue chart */}
            <div className="lg:col-span-4 rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold">Revenue Overview</h3>
                  <p className="text-sm text-muted-foreground">Monthly revenue and profit</p>
                </div>
                <button className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-accent">
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(var(--primary))"
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="profit"
                      stroke="hsl(var(--secondary))"
                      fillOpacity={1}
                      fill="url(#colorProfit)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Activity chart */}
            <div className="lg:col-span-3 rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold">Weekly Activity</h3>
                  <p className="text-sm text-muted-foreground">User interactions this week</p>
                </div>
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activityData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="day" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Bottom row */}
          <div className="grid gap-6 lg:grid-cols-7">
            {/* Recent transactions */}
            <div className="lg:col-span-4 rounded-xl border border-border bg-card shadow-sm">
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold">Recent Transactions</h3>
                <p className="text-sm text-muted-foreground">Latest payment activities</p>
              </div>
              <div className="divide-y divide-border">
                {recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {tx.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{tx.name}</p>
                        <p className="text-xs text-muted-foreground">{tx.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        'text-sm font-medium',
                        tx.amount.startsWith('+') ? 'text-emerald-500' : 'text-foreground'
                      )}>
                        {tx.amount}
                      </p>
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                        tx.status === 'completed' && 'bg-emerald-500/10 text-emerald-500',
                        tx.status === 'pending' && 'bg-yellow-500/10 text-yellow-500',
                        tx.status === 'processing' && 'bg-blue-500/10 text-blue-500'
                      )}>
                        {tx.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Traffic sources */}
            <div className="lg:col-span-3 rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-6">
                <h3 className="text-lg font-semibold">Traffic Sources</h3>
                <p className="text-sm text-muted-foreground">Device breakdown</p>
              </div>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2">
                {pieData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="text-sm font-medium">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
