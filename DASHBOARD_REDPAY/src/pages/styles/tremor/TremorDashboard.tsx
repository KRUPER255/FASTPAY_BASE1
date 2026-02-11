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
  ComposedChart,
  Legend,
} from 'recharts'
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  Users,
  Activity,
  Zap,
  Globe,
  Server,
  Database,
  Cpu,
  HardDrive,
  Wifi,
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  MoreVertical,
  Download,
  Filter,
  Calendar,
  RefreshCw,
  LogOut,
  Settings,
  Bell,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Analytics data
const performanceData = [
  { date: 'Jan 1', requests: 2400, errors: 40, latency: 120 },
  { date: 'Jan 8', requests: 3600, errors: 35, latency: 115 },
  { date: 'Jan 15', requests: 3200, errors: 52, latency: 125 },
  { date: 'Jan 22', requests: 4100, errors: 38, latency: 110 },
  { date: 'Jan 29', requests: 4800, errors: 45, latency: 108 },
  { date: 'Feb 5', requests: 5200, errors: 42, latency: 105 },
  { date: 'Feb 12', requests: 5800, errors: 48, latency: 102 },
  { date: 'Feb 19', requests: 6100, errors: 35, latency: 98 },
  { date: 'Feb 26', requests: 6800, errors: 40, latency: 95 },
]

const regionData = [
  { region: 'North America', users: 45000, growth: 12.5 },
  { region: 'Europe', users: 38000, growth: 8.3 },
  { region: 'Asia Pacific', users: 32000, growth: 24.1 },
  { region: 'Latin America', users: 18000, growth: 15.7 },
  { region: 'Middle East', users: 12000, growth: 18.2 },
]

const serverMetrics = [
  { time: '00:00', cpu: 45, memory: 62, network: 30 },
  { time: '04:00', cpu: 35, memory: 58, network: 25 },
  { time: '08:00', cpu: 65, memory: 72, network: 55 },
  { time: '12:00', cpu: 78, memory: 80, network: 68 },
  { time: '16:00', cpu: 82, memory: 85, network: 72 },
  { time: '20:00', cpu: 70, memory: 78, network: 60 },
  { time: '24:00', cpu: 50, memory: 65, network: 35 },
]

const statusTracker = [
  { status: 'operational', count: 45 },
  { status: 'degraded', count: 3 },
  { status: 'down', count: 2 },
]

interface TremorDashboardProps {
  onLogout?: () => void
}

export default function TremorDashboard({ onLogout }: TremorDashboardProps) {
  const navigate = useNavigate()
  const [timeRange, setTimeRange] = useState('7d')

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }

  const handleLogout = () => {
    onLogout?.()
    navigate('/login')
  }

  const kpis = [
    {
      title: 'Total Requests',
      value: '2.4M',
      change: '+12.3%',
      trend: 'up',
      sparkData: [40, 45, 52, 48, 55, 62, 58, 65, 72],
      color: 'emerald',
    },
    {
      title: 'Error Rate',
      value: '0.8%',
      change: '-0.2%',
      trend: 'down',
      sparkData: [12, 10, 8, 11, 9, 7, 8, 6, 5],
      color: 'red',
    },
    {
      title: 'Avg. Latency',
      value: '98ms',
      change: '-15ms',
      trend: 'down',
      sparkData: [120, 115, 110, 108, 105, 102, 100, 98, 95],
      color: 'blue',
    },
    {
      title: 'Active Users',
      value: '145K',
      change: '+8.1%',
      trend: 'up',
      sparkData: [100, 105, 112, 118, 125, 132, 138, 142, 145],
      color: 'violet',
    },
  ]

  const alerts = [
    { type: 'warning', message: 'High memory usage on server-03', time: '2 min ago' },
    { type: 'error', message: 'Database connection timeout', time: '15 min ago' },
    { type: 'success', message: 'Deployment completed successfully', time: '1 hour ago' },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center">
                <Zap className="h-5 w-5 text-slate-950" />
              </div>
              <span className="font-bold text-lg">Tremor Analytics</span>
            </div>
            <nav className="hidden md:flex items-center gap-1">
              {['Overview', 'Analytics', 'Reports', 'Alerts'].map((item, i) => (
                <button
                  key={item}
                  className={cn(
                    'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                    i === 0
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  )}
                >
                  {item}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-lg hover:bg-slate-800 transition-colors">
              <Bell className="h-5 w-5 text-slate-400" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-emerald-400" />
            </button>
            <button className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
              <Settings className="h-5 w-5 text-slate-400" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="p-6 space-y-6">
        {/* Title and controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Analytics Overview</h1>
            <p className="text-slate-400 mt-1">Real-time system performance and metrics</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-800 rounded-lg p-1">
              {['24h', '7d', '30d', '90d'].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                    timeRange === range
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-white'
                  )}
                >
                  {range}
                </button>
              ))}
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors">
              <Download className="h-4 w-4" />
              <span className="text-sm font-medium">Export</span>
            </button>
            <button className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <div
              key={kpi.title}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-400">{kpi.title}</p>
                  <p className="text-3xl font-bold mt-1">{kpi.value}</p>
                </div>
                <div
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                    kpi.trend === 'up' && kpi.color !== 'red'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : kpi.trend === 'down' && kpi.color === 'red'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : kpi.trend === 'down' && kpi.color !== 'red'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/20 text-red-400'
                  )}
                >
                  {kpi.trend === 'up' ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {kpi.change}
                </div>
              </div>
              <div className="mt-4 h-12">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={kpi.sparkData.map((v, i) => ({ v }))}>
                    <defs>
                      <linearGradient id={`spark-${kpi.color}`} x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor={
                            kpi.color === 'emerald'
                              ? '#10b981'
                              : kpi.color === 'red'
                              ? '#ef4444'
                              : kpi.color === 'blue'
                              ? '#3b82f6'
                              : '#8b5cf6'
                          }
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="100%"
                          stopColor={
                            kpi.color === 'emerald'
                              ? '#10b981'
                              : kpi.color === 'red'
                              ? '#ef4444'
                              : kpi.color === 'blue'
                              ? '#3b82f6'
                              : '#8b5cf6'
                          }
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="v"
                      stroke={
                        kpi.color === 'emerald'
                          ? '#10b981'
                          : kpi.color === 'red'
                          ? '#ef4444'
                          : kpi.color === 'blue'
                          ? '#3b82f6'
                          : '#8b5cf6'
                      }
                      fill={`url(#spark-${kpi.color})`}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>

        {/* Main charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Performance chart */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold">Request Performance</h3>
                <p className="text-sm text-slate-400">Requests, errors, and latency over time</p>
              </div>
              <button className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
                <MoreVertical className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis yAxisId="left" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="requests" fill="#10b981" radius={[4, 4, 0, 0]} name="Requests" />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="latency"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    name="Latency (ms)"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="errors"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                    name="Errors"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Status tracker */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold">System Status</h3>
              <span className="flex items-center gap-2 text-sm text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                All systems operational
              </span>
            </div>

            {/* Status bar */}
            <div className="flex gap-1 h-8 rounded-lg overflow-hidden mb-6">
              {Array.from({ length: 50 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex-1 transition-colors',
                    i < 45 ? 'bg-emerald-500' : i < 48 ? 'bg-yellow-500' : 'bg-red-500'
                  )}
                />
              ))}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <span className="text-sm">Operational</span>
                </div>
                <span className="text-sm font-medium">45 services</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-400" />
                  <span className="text-sm">Degraded</span>
                </div>
                <span className="text-sm font-medium">3 services</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <XCircle className="h-5 w-5 text-red-400" />
                  <span className="text-sm">Down</span>
                </div>
                <span className="text-sm font-medium">2 services</span>
              </div>
            </div>

            {/* Alerts */}
            <div className="mt-6 pt-6 border-t border-slate-800">
              <h4 className="text-sm font-medium mb-4">Recent Alerts</h4>
              <div className="space-y-3">
                {alerts.map((alert, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg">
                    {alert.type === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5" />}
                    {alert.type === 'error' && <XCircle className="h-4 w-4 text-red-400 mt-0.5" />}
                    {alert.type === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{alert.message}</p>
                      <p className="text-xs text-slate-500 mt-1">{alert.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Server metrics */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold">Server Resources</h3>
                <p className="text-sm text-slate-400">CPU, Memory, and Network usage</p>
              </div>
            </div>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={serverMetrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="cpu" stroke="#f59e0b" strokeWidth={2} dot={false} name="CPU %" />
                  <Line type="monotone" dataKey="memory" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Memory %" />
                  <Line type="monotone" dataKey="network" stroke="#06b6d4" strokeWidth={2} dot={false} name="Network %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Region breakdown */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold">Users by Region</h3>
                <p className="text-sm text-slate-400">Geographic distribution of users</p>
              </div>
            </div>
            <div className="space-y-4">
              {regionData.map((region) => (
                <div key={region.region} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{region.region}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{(region.users / 1000).toFixed(0)}K</span>
                      <span
                        className={cn(
                          'text-xs font-medium',
                          region.growth > 15 ? 'text-emerald-400' : 'text-slate-400'
                        )}
                      >
                        +{region.growth}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all"
                      style={{ width: `${(region.users / 45000) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
