import { useEffect, useState, useMemo } from 'react'
import { ref, onValue, off, get } from 'firebase/database'
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import {
  getAllDevicesPath,
  getDeviceMessagesPath,
  getDeviceNotificationsPath,
} from '@/lib/firebase-helpers'
import { format, subDays, startOfDay, eachDayOfInterval } from 'date-fns'
import { TrendingUp, MessageSquare, Bell, Smartphone, Activity } from 'lucide-react'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface AnalyticsData {
  totalDevices: number
  activeDevices: number
  totalMessages: number
  totalNotifications: number
  messagesByDay: Record<string, number>
  notificationsByDay: Record<string, number>
  deviceActivity: Record<string, number>
  messageDistribution: { sent: number; received: number }
}

interface AnalyticsChartsProps {
  deviceId?: string | null
}

export default function AnalyticsCharts({ deviceId }: AnalyticsChartsProps) {
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalDevices: 0,
    activeDevices: 0,
    totalMessages: 0,
    totalNotifications: 0,
    messagesByDay: {},
    notificationsByDay: {},
    deviceActivity: {},
    messageDistribution: { sent: 0, received: 0 },
  })

  useEffect(() => {
    if (deviceId) {
      loadDeviceAnalytics(deviceId)
    } else {
      loadGlobalAnalytics()
    }
  }, [deviceId])

  const loadDeviceAnalytics = async (deviceId: string) => {
    setLoading(true)
    try {
      const messagesRef = getDeviceMessagesPath(deviceId)
      const notificationsRef = getDeviceNotificationsPath(deviceId)

      const [messagesSnapshot, notificationsSnapshot] = await Promise.all([
        get(messagesRef),
        get(notificationsRef),
      ])

      const messages = messagesSnapshot.exists() ? messagesSnapshot.val() : {}
      const notifications = notificationsSnapshot.exists() ? notificationsSnapshot.val() : {}

      const messagesByDay: Record<string, number> = {}
      let sentCount = 0
      let receivedCount = 0

      Object.values(messages).forEach((msg: any) => {
        if (typeof msg === 'string') {
          const parts = msg.split('~')
          const type = parts[0]
          const timestamp = parseInt(parts[1] || Object.keys(messages)[0])

          if (type === 'sent') sentCount++
          if (type === 'received') receivedCount++

          const day = format(new Date(timestamp), 'yyyy-MM-dd')
          messagesByDay[day] = (messagesByDay[day] || 0) + 1
        }
      })

      const notificationsByDay: Record<string, number> = {}
      Object.values(notifications).forEach((notif: any) => {
        const timestamp =
          typeof notif === 'object' ? notif.time : parseInt(Object.keys(notifications)[0])
        const day = format(new Date(timestamp), 'yyyy-MM-dd')
        notificationsByDay[day] = (notificationsByDay[day] || 0) + 1
      })

      setAnalytics({
        totalDevices: 1,
        activeDevices: 1,
        totalMessages: Object.keys(messages).length,
        totalNotifications: Object.keys(notifications).length,
        messagesByDay,
        notificationsByDay,
        deviceActivity: {},
        messageDistribution: { sent: sentCount, received: receivedCount },
      })
    } catch (error) {
      console.error('Error loading device analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadGlobalAnalytics = () => {
    const devicesRef = getAllDevicesPath()

    const unsubscribe = onValue(
      devicesRef,
      async snapshot => {
        if (!snapshot.exists()) {
          setLoading(false)
          return
        }

        const devices = snapshot.val()
        let totalDevices = 0
        let activeDevices = 0
        let totalMessages = 0
        let totalNotifications = 0
        const messagesByDay: Record<string, number> = {}
        const notificationsByDay: Record<string, number> = {}
        const deviceActivity: Record<string, number> = {}
        let sentCount = 0
        let receivedCount = 0

        for (const deviceId in devices) {
          if (deviceId === 'device-list' || deviceId === 'app' || deviceId === 'device-backups')
            continue

          totalDevices++
          const device = devices[deviceId]

          if (device.isActive === 'Opened' || device.isActive === true) activeDevices++

          // Count messages
          if (device.messages) {
            const messageCount = Object.keys(device.messages).length
            totalMessages += messageCount

            Object.values(device.messages).forEach((msg: any) => {
              if (typeof msg === 'string') {
                const parts = msg.split('~')
                const type = parts[0]
                const timestamp = parseInt(parts[1] || Object.keys(device.messages)[0])

                if (type === 'sent') sentCount++
                if (type === 'received') receivedCount++

                const day = format(new Date(timestamp), 'yyyy-MM-dd')
                messagesByDay[day] = (messagesByDay[day] || 0) + 1
                deviceActivity[deviceId] = (deviceActivity[deviceId] || 0) + 1
              }
            })
          }

          // Count notifications
          if (device.Notification) {
            const notifCount = Object.keys(device.Notification).length
            totalNotifications += notifCount

            Object.values(device.Notification).forEach((notif: any) => {
              const timestamp =
                typeof notif === 'object'
                  ? notif.time
                  : parseInt(Object.keys(device.Notification)[0])
              const day = format(new Date(timestamp), 'yyyy-MM-dd')
              notificationsByDay[day] = (notificationsByDay[day] || 0) + 1
            })
          }
        }

        setAnalytics({
          totalDevices,
          activeDevices,
          totalMessages,
          totalNotifications,
          messagesByDay,
          notificationsByDay,
          deviceActivity,
          messageDistribution: { sent: sentCount, received: receivedCount },
        })
        setLoading(false)
      },
      error => {
        console.error('Error loading analytics:', error)
        setLoading(false)
      }
    )

    return () => {
      off(devicesRef, 'value', unsubscribe)
    }
  }

  const last7Days = useMemo(() => {
    return eachDayOfInterval({
      start: subDays(new Date(), 6),
      end: new Date(),
    }).map(day => format(day, 'yyyy-MM-dd'))
  }, [])

  const messagesChartData = useMemo(() => {
    const data = last7Days.map(day => analytics.messagesByDay[day] || 0)
    return {
      labels: last7Days.map(day => format(new Date(day), 'MMM dd')),
      datasets: [
        {
          label: 'Messages',
          data,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4,
        },
      ],
    }
  }, [analytics.messagesByDay, last7Days])

  const notificationsChartData = useMemo(() => {
    const data = last7Days.map(day => analytics.notificationsByDay[day] || 0)
    return {
      labels: last7Days.map(day => format(new Date(day), 'MMM dd')),
      datasets: [
        {
          label: 'Notifications',
          data,
          backgroundColor: 'rgba(16, 185, 129, 0.8)',
          borderColor: 'rgb(16, 185, 129)',
          borderWidth: 1,
        },
      ],
    }
  }, [analytics.notificationsByDay, last7Days])

  const messageDistributionData = useMemo(() => {
    return {
      labels: ['Sent', 'Received'],
      datasets: [
        {
          data: [analytics.messageDistribution.sent, analytics.messageDistribution.received],
          backgroundColor: ['rgba(59, 130, 246, 0.8)', 'rgba(16, 185, 129, 0.8)'],
          borderColor: ['rgb(59, 130, 246)', 'rgb(16, 185, 129)'],
          borderWidth: 2,
        },
      ],
    }
  }, [analytics.messageDistribution])

  const topDevicesData = useMemo(() => {
    const sorted = Object.entries(analytics.deviceActivity)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)

    return {
      labels: sorted.map(([id]) => id.substring(0, 12) + '...'),
      datasets: [
        {
          label: 'Messages',
          data: sorted.map(([, count]) => count),
          backgroundColor: 'rgba(139, 92, 246, 0.8)',
          borderColor: 'rgb(139, 92, 246)',
          borderWidth: 1,
        },
      ],
    }
  }, [analytics.deviceActivity])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading analytics...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          <h2 className="text-2xl font-bold">Analytics & Insights</h2>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Devices</p>
              <p className="text-2xl font-bold">{analytics.totalDevices}</p>
            </div>
            <Smartphone className="h-8 w-8 text-blue-500" />
          </div>
          <p className="text-xs text-muted-foreground mt-2">{analytics.activeDevices} active</p>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Messages</p>
              <p className="text-2xl font-bold">{analytics.totalMessages}</p>
            </div>
            <MessageSquare className="h-8 w-8 text-green-500" />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {analytics.messageDistribution.sent} sent, {analytics.messageDistribution.received}{' '}
            received
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Notifications</p>
              <p className="text-2xl font-bold">{analytics.totalNotifications}</p>
            </div>
            <Bell className="h-8 w-8 text-purple-500" />
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Activity Rate</p>
              <p className="text-2xl font-bold">
                {analytics.totalDevices > 0
                  ? Math.round((analytics.activeDevices / analytics.totalDevices) * 100)
                  : 0}
                %
              </p>
            </div>
            <Activity className="h-8 w-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Messages Over Time */}
        <div className="rounded-lg border p-4">
          <h3 className="font-semibold mb-4">Messages Over Time (Last 7 Days)</h3>
          <Line
            data={messagesChartData}
            options={{
              responsive: true,
              maintainAspectRatio: true,
              plugins: {
                legend: { display: false },
                tooltip: { mode: 'index', intersect: false },
              },
              scales: {
                y: { beginAtZero: true },
              },
            }}
          />
        </div>

        {/* Notifications Over Time */}
        <div className="rounded-lg border p-4">
          <h3 className="font-semibold mb-4">Notifications Over Time (Last 7 Days)</h3>
          <Bar
            data={notificationsChartData}
            options={{
              responsive: true,
              maintainAspectRatio: true,
              plugins: {
                legend: { display: false },
              },
              scales: {
                y: { beginAtZero: true },
              },
            }}
          />
        </div>

        {/* Message Distribution */}
        <div className="rounded-lg border p-4">
          <h3 className="font-semibold mb-4">Message Distribution</h3>
          <Doughnut
            data={messageDistributionData}
            options={{
              responsive: true,
              maintainAspectRatio: true,
              plugins: {
                legend: { position: 'bottom' },
              },
            }}
          />
        </div>

        {/* Top Devices (only for global view) */}
        {!deviceId && Object.keys(analytics.deviceActivity).length > 0 && (
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold mb-4">Top 5 Active Devices</h3>
            <Bar
              data={topDevicesData}
              options={{
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                  legend: { display: false },
                },
                scales: {
                  y: { beginAtZero: true },
                },
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
