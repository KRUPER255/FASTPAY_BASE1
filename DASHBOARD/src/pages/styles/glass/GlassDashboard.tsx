import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { isAuthenticated } from '@/lib/auth'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Send,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  MoreHorizontal,
  Bell,
  Search,
  Settings,
  LogOut,
  ChevronRight,
  Sparkles,
  Shield,
  Zap,
  Globe,
  Star,
  Heart,
  Eye,
  EyeOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Sample data
const balanceHistory = [
  { date: 'Mon', balance: 12400 },
  { date: 'Tue', balance: 13200 },
  { date: 'Wed', balance: 12800 },
  { date: 'Thu', balance: 14500 },
  { date: 'Fri', balance: 15200 },
  { date: 'Sat', balance: 16800 },
  { date: 'Sun', balance: 18500 },
]

const spendingData = [
  { name: 'Shopping', value: 35, color: '#f472b6' },
  { name: 'Food', value: 25, color: '#a78bfa' },
  { name: 'Transport', value: 20, color: '#60a5fa' },
  { name: 'Entertainment', value: 12, color: '#34d399' },
  { name: 'Others', value: 8, color: '#fbbf24' },
]

const transactions = [
  { id: 1, name: 'Spotify Premium', type: 'subscription', amount: -9.99, icon: '🎵', time: 'Today, 2:45 PM' },
  { id: 2, name: 'Sarah Miller', type: 'transfer', amount: 250.00, icon: '👩', time: 'Today, 11:30 AM' },
  { id: 3, name: 'Amazon', type: 'shopping', amount: -89.99, icon: '📦', time: 'Yesterday' },
  { id: 4, name: 'Netflix', type: 'subscription', amount: -15.99, icon: '🎬', time: 'Yesterday' },
  { id: 5, name: 'John Doe', type: 'received', amount: 500.00, icon: '👨', time: '2 days ago' },
]

const cards = [
  { id: 1, type: 'Visa', last4: '4532', balance: 12500, gradient: 'from-violet-600 via-purple-600 to-fuchsia-600' },
  { id: 2, type: 'Mastercard', last4: '8791', balance: 8200, gradient: 'from-cyan-500 via-blue-500 to-indigo-600' },
]

interface GlassDashboardProps {
  onLogout?: () => void
}

export default function GlassDashboard({ onLogout }: GlassDashboardProps) {
  const navigate = useNavigate()
  const [showBalance, setShowBalance] = useState(true)
  const [activeCard, setActiveCard] = useState(0)

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }

  const handleLogout = () => {
    onLogout?.()
    navigate('/login')
  }

  const quickActions = [
    { icon: Send, label: 'Send', color: 'from-pink-500 to-rose-500' },
    { icon: ArrowDownLeft, label: 'Receive', color: 'from-violet-500 to-purple-500' },
    { icon: CreditCard, label: 'Cards', color: 'from-cyan-500 to-blue-500' },
    { icon: Plus, label: 'Top Up', color: 'from-emerald-500 to-green-500' },
  ]

  return (
    <div className="min-h-screen bg-slate-950 overflow-hidden relative">
      {/* Animated background gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/30 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-cyan-500/20 rounded-full blur-[100px] animate-pulse delay-1000" />
        <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-pink-500/20 rounded-full blur-[100px] animate-pulse delay-500" />
      </div>

      {/* Main content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Good evening, Admin</h1>
              <p className="text-sm text-white/60">Welcome to your dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="glass-button p-3 rounded-xl">
              <Search className="h-5 w-5 text-white/70" />
            </button>
            <button className="glass-button p-3 rounded-xl relative">
              <Bell className="h-5 w-5 text-white/70" />
              <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-pink-500 border-2 border-slate-950" />
            </button>
            <button className="glass-button p-3 rounded-xl" onClick={handleLogout}>
              <LogOut className="h-5 w-5 text-white/70" />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left column */}
          <div className="lg:col-span-8 space-y-6">
            {/* Balance card with glassmorphism */}
            <div className="glass-card rounded-3xl p-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-white/60 text-sm mb-1">Total Balance</p>
                    <div className="flex items-center gap-3">
                      <h2 className="text-4xl font-bold text-white">
                        {showBalance ? '$18,542.00' : '••••••'}
                      </h2>
                      <button
                        onClick={() => setShowBalance(!showBalance)}
                        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        {showBalance ? (
                          <Eye className="h-5 w-5 text-white/60" />
                        ) : (
                          <EyeOff className="h-5 w-5 text-white/60" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm font-medium">+12.5%</span>
                  </div>
                </div>

                {/* Balance chart */}
                <div className="h-[200px] -mx-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={balanceHistory}>
                      <defs>
                        <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#a855f7" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                      />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(15, 23, 42, 0.9)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '12px',
                          backdropFilter: 'blur(10px)',
                        }}
                        labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
                        formatter={(value: number) => [`$${value.toLocaleString()}`, 'Balance']}
                      />
                      <Area
                        type="monotone"
                        dataKey="balance"
                        stroke="#a855f7"
                        strokeWidth={3}
                        fill="url(#balanceGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-4 gap-4">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  className="glass-card rounded-2xl p-4 flex flex-col items-center gap-3 hover:scale-105 transition-transform"
                >
                  <div
                    className={cn(
                      'h-12 w-12 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg',
                      action.color
                    )}
                    style={{
                      boxShadow: `0 8px 32px -8px ${
                        action.color.includes('pink')
                          ? 'rgba(236, 72, 153, 0.5)'
                          : action.color.includes('violet')
                          ? 'rgba(139, 92, 246, 0.5)'
                          : action.color.includes('cyan')
                          ? 'rgba(6, 182, 212, 0.5)'
                          : 'rgba(16, 185, 129, 0.5)'
                      }`,
                    }}
                  >
                    <action.icon className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-sm text-white/80 font-medium">{action.label}</span>
                </button>
              ))}
            </div>

            {/* Recent transactions */}
            <div className="glass-card rounded-3xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Recent Transactions</h3>
                <button className="text-sm text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1">
                  View All <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl">
                        {tx.icon}
                      </div>
                      <div>
                        <p className="text-white font-medium">{tx.name}</p>
                        <p className="text-sm text-white/50">{tx.time}</p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        'text-lg font-semibold',
                        tx.amount > 0 ? 'text-emerald-400' : 'text-white'
                      )}
                    >
                      {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="lg:col-span-4 space-y-6">
            {/* Card carousel */}
            <div className="glass-card rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">My Cards</h3>
                <button className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                  <Plus className="h-5 w-5 text-white/70" />
                </button>
              </div>
              <div className="space-y-4">
                {cards.map((card, index) => (
                  <button
                    key={card.id}
                    onClick={() => setActiveCard(index)}
                    className={cn(
                      'w-full aspect-[1.6/1] rounded-2xl p-5 relative overflow-hidden transition-all',
                      `bg-gradient-to-br ${card.gradient}`,
                      activeCard === index ? 'scale-100 opacity-100' : 'scale-95 opacity-60'
                    )}
                    style={{
                      boxShadow:
                        activeCard === index
                          ? '0 20px 40px -12px rgba(139, 92, 246, 0.5)'
                          : 'none',
                    }}
                  >
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdi0yMGgtNjB6IiBmaWxsLW9wYWNpdHk9Ii4xIiBmaWxsPSIjZmZmIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2EpIi8+PC9zdmc+')] opacity-50" />
                    <div className="relative z-10 h-full flex flex-col justify-between text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-white/80 text-sm font-medium">{card.type}</span>
                        <div className="flex -space-x-2">
                          <div className="h-6 w-6 rounded-full bg-white/30" />
                          <div className="h-6 w-6 rounded-full bg-white/20" />
                        </div>
                      </div>
                      <div>
                        <p className="text-white/60 text-xs mb-1">Card Balance</p>
                        <p className="text-white text-xl font-bold">
                          ${card.balance.toLocaleString()}
                        </p>
                      </div>
                      <p className="text-white/80 font-mono tracking-widest">
                        •••• •••• •••• {card.last4}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Spending breakdown */}
            <div className="glass-card rounded-3xl p-6">
              <h3 className="text-lg font-semibold text-white mb-6">Spending Breakdown</h3>
              <div className="h-[180px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={spendingData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {spendingData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-white/60 text-xs">Total</p>
                    <p className="text-white text-lg font-bold">$2,450</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {spendingData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm text-white/70">{item.name}</span>
                    </div>
                    <span className="text-sm text-white font-medium">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Premium upgrade card */}
            <div className="relative rounded-3xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600" />
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjEiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
              <div className="relative z-10 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <Star className="h-5 w-5 text-yellow-300" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold">Upgrade to Pro</h4>
                    <p className="text-white/70 text-sm">Unlock all features</p>
                  </div>
                </div>
                <ul className="space-y-2 mb-4">
                  {['Unlimited transfers', 'Priority support', 'Advanced analytics'].map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-white/80 text-sm">
                      <Zap className="h-4 w-4 text-yellow-300" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button className="w-full py-3 rounded-xl bg-white text-purple-600 font-semibold hover:bg-white/90 transition-colors">
                  Upgrade Now
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom styles */}
      <style>{`
        .glass-card {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .glass-button {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: all 0.2s;
        }
        .glass-button:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  )
}
