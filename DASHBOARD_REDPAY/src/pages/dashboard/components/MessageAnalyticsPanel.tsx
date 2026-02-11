import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/component/ui/card'
import { Button } from '@/component/ui/button'
import { Label } from '@/component/ui/label'
import { Switch } from '@/component/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/component/ui/select'
import { useToast } from '@/lib/use-toast'
import { getDeviceCommandsPath, getDevicePath } from '@/lib/firebase-helpers'
import { set, get, ref, onValue, off } from 'firebase/database'
import { database } from '@/lib/firebase'

interface MessageAnalyticsPanelProps {
  deviceId: string
}

interface MessageStats {
  total: number
  sent: number
  received: number
  read: number
  unread: number
  topSenders: Array<{ number: string; count: number }>
  topRecipients: Array<{ number: string; count: number }>
  dailyBreakdown: Record<string, number>
  calculatedAt: number
}

export function MessageAnalyticsPanel({ deviceId }: MessageAnalyticsPanelProps) {
  const { toast } = useToast()
  const [mode, setMode] = useState<'stats' | 'backup' | 'export'>('stats')
  
  // Stats fields
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('today')
  const [stats, setStats] = useState<MessageStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  
  // Backup fields
  const [backupType, setBackupType] = useState<'firebase' | 'local'>('firebase')
  const [backupEncrypt, setBackupEncrypt] = useState(false)
  const [backupFormat, setBackupFormat] = useState<'json' | 'csv'>('json')
  const [loadingBackup, setLoadingBackup] = useState(false)
  
  // Export fields
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json')
  const [loadingExport, setLoadingExport] = useState(false)

  useEffect(() => {
    if (deviceId && mode === 'stats') {
      loadLatestStats()
    }
  }, [deviceId, mode])

  const loadLatestStats = () => {
    if (!deviceId) return
    
    const statsPath = `fastpay/${deviceId}/messageStats`
    const statsRef = ref(database, statsPath)
    
    onValue(statsRef, (snapshot) => {
      if (snapshot.exists()) {
        // Get the latest stats entry
        const entries: any[] = []
        snapshot.forEach((child) => {
          entries.push({ key: child.key, ...child.val() })
        })
        
        if (entries.length > 0) {
          // Sort by calculatedAt and get the latest
          const latest = entries.sort((a, b) => (b.calculatedAt || 0) - (a.calculatedAt || 0))[0]
          setStats(latest as MessageStats)
        }
      }
    })
    
    return () => {
      off(statsRef)
    }
  }

  const handleGetStats = async () => {
    setLoadingStats(true)
    try {
      const commandValue = `${period}:json`
      const commandRef = getDeviceCommandsPath(deviceId, 'getMessageStats')
      
      await set(commandRef, commandValue)
      
      toast({
        title: 'Success',
        description: 'Statistics calculation started',
      })
      
      // Reload stats after a delay
      setTimeout(() => {
        loadLatestStats()
      }, 2000)
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to get statistics',
        variant: 'destructive',
      })
    } finally {
      setLoadingStats(false)
    }
  }

  const handleBackup = async () => {
    setLoadingBackup(true)
    try {
      const commandValue = `${backupType}:${backupEncrypt}:${backupFormat}`
      const commandRef = getDeviceCommandsPath(deviceId, 'backupMessages')
      
      await set(commandRef, commandValue)
      
      toast({
        title: 'Success',
        description: 'Backup started',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start backup',
        variant: 'destructive',
      })
    } finally {
      setLoadingBackup(false)
    }
  }

  const handleExport = async () => {
    setLoadingExport(true)
    try {
      const commandValue = `${exportFormat}:null`
      const commandRef = getDeviceCommandsPath(deviceId, 'exportMessages')
      
      await set(commandRef, commandValue)
      
      toast({
        title: 'Success',
        description: 'Export started',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start export',
        variant: 'destructive',
      })
    } finally {
      setLoadingExport(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analytics & Backup</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Mode</Label>
          <Select value={mode} onValueChange={(v: any) => setMode(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stats">Message Statistics</SelectItem>
              <SelectItem value="backup">Backup Messages</SelectItem>
              <SelectItem value="export">Export Messages</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {mode === 'stats' ? (
          <>
            <div className="space-y-2">
              <Label>Period</Label>
              <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last Week</SelectItem>
                  <SelectItem value="month">Last Month</SelectItem>
                  <SelectItem value="year">Last Year</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button onClick={handleGetStats} disabled={loadingStats} className="w-full">
              {loadingStats ? 'Calculating...' : 'Get Statistics'}
            </Button>
            
            {stats && (
              <div className="space-y-4 mt-4 p-4 bg-muted rounded-md">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-semibold">Total Messages</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Sent</p>
                    <p className="text-2xl font-bold">{stats.sent}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Received</p>
                    <p className="text-2xl font-bold">{stats.received}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Read</p>
                    <p className="text-2xl font-bold">{stats.read}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Unread</p>
                    <p className="text-2xl font-bold">{stats.unread}</p>
                  </div>
                </div>
                
                {stats.topSenders && stats.topSenders.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-semibold mb-2">Top Senders</p>
                    <div className="space-y-1">
                      {stats.topSenders.slice(0, 5).map((sender, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span>{sender.number}</span>
                          <span className="font-semibold">{sender.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {stats.topRecipients && stats.topRecipients.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-semibold mb-2">Top Recipients</p>
                    <div className="space-y-1">
                      {stats.topRecipients.slice(0, 5).map((recipient, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span>{recipient.number}</span>
                          <span className="font-semibold">{recipient.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : mode === 'backup' ? (
          <>
            <div className="space-y-2">
              <Label>Backup Type</Label>
              <Select value={backupType} onValueChange={(v: any) => setBackupType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="firebase">Firebase</SelectItem>
                  <SelectItem value="local">Local Storage</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={backupFormat} onValueChange={(v: any) => setBackupFormat(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center justify-between">
              <Label>Encrypt Backup</Label>
              <Switch checked={backupEncrypt} onCheckedChange={setBackupEncrypt} />
            </div>
            
            <Button onClick={handleBackup} disabled={loadingBackup} className="w-full">
              {loadingBackup ? 'Backing up...' : 'Start Backup'}
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Export Format</Label>
              <Select value={exportFormat} onValueChange={(v: any) => setExportFormat(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button onClick={handleExport} disabled={loadingExport} className="w-full">
              {loadingExport ? 'Exporting...' : 'Export Messages'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
