import { useState, useMemo } from 'react'
import { Button } from '@/component/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/component/ui/select'
import { Download, FileText, Database } from 'lucide-react'
import { format } from 'date-fns'

interface ExportData {
  messages?: any[]
  notifications?: any[]
  contacts?: any[]
  deviceInfo?: any
}

interface DataExporterProps {
  messages: any[]
  notifications: any[]
  contacts: any[]
  deviceInfo?: any
  deviceId?: string
}

export default function DataExporter({
  messages,
  notifications,
  contacts,
  deviceInfo,
  deviceId,
}: DataExporterProps) {
  const [exportType, setExportType] = useState<'csv' | 'json'>('csv')
  const [exportScope, setExportScope] = useState<'all' | 'messages' | 'notifications' | 'contacts'>(
    'all'
  )

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      alert('No data to export')
      return
    }

    // Get headers from first object
    const headers = Object.keys(data[0])

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        headers
          .map(header => {
            const value = row[header]
            // Escape commas and quotes
            if (typeof value === 'string') {
              return `"${value.replace(/"/g, '""')}"`
            }
            return value ?? ''
          })
          .join(',')
      ),
    ].join('\n')

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
  }

  const exportToJSON = (data: any, filename: string) => {
    const jsonContent = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
  }

  const formatMessagesForExport = () => {
    return messages.map((msg, idx) => {
      if (typeof msg === 'string') {
        const parts = msg.split('~')
        return {
          id: idx,
          type: parts[0] || 'unknown',
          phone: parts[1] || '',
          content: parts[2] || msg,
          timestamp: parts[3] || new Date().toISOString(),
        }
      }
      return {
        id: idx,
        ...msg,
      }
    })
  }

  const formatNotificationsForExport = () => {
    return notifications.map((notif, idx) => {
      if (typeof notif === 'object') {
        return {
          id: idx,
          app: notif.app || '',
          title: notif.title || '',
          body: notif.body || '',
          time: notif.time ? new Date(notif.time).toISOString() : new Date().toISOString(),
        }
      }
      return {
        id: idx,
        content: notif,
      }
    })
  }

  const formatContactsForExport = () => {
    return contacts.map((contact, idx) => {
      if (typeof contact === 'object') {
        return {
          id: idx,
          name: contact.name || '',
          phone: contact.phone || '',
        }
      }
      return {
        id: idx,
        contact,
      }
    })
  }

  const handleExport = () => {
    const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss')
    const devicePrefix = deviceId ? `${deviceId.substring(0, 8)}_` : ''

    if (exportScope === 'messages') {
      const data = formatMessagesForExport()
      const filename = `${devicePrefix}messages_${timestamp}.${exportType}`
      if (exportType === 'csv') {
        exportToCSV(data, filename)
      } else {
        exportToJSON(data, filename)
      }
    } else if (exportScope === 'notifications') {
      const data = formatNotificationsForExport()
      const filename = `${devicePrefix}notifications_${timestamp}.${exportType}`
      if (exportType === 'csv') {
        exportToCSV(data, filename)
      } else {
        exportToJSON(data, filename)
      }
    } else if (exportScope === 'contacts') {
      const data = formatContactsForExport()
      const filename = `${devicePrefix}contacts_${timestamp}.${exportType}`
      if (exportType === 'csv') {
        exportToCSV(data, filename)
      } else {
        exportToJSON(data, filename)
      }
    } else {
      // Export all
      const allData = {
        deviceInfo: deviceInfo || {},
        messages: formatMessagesForExport(),
        notifications: formatNotificationsForExport(),
        contacts: formatContactsForExport(),
        exportedAt: new Date().toISOString(),
        deviceId: deviceId || 'unknown',
      }
      const filename = `${devicePrefix}all_data_${timestamp}.${exportType}`
      if (exportType === 'csv') {
        // For CSV, export each section separately or create a combined file
        exportToJSON(allData, filename.replace('.csv', '.json'))
        alert('For multiple data types, JSON format is recommended. Exported as JSON.')
      } else {
        exportToJSON(allData, filename)
      }
    }
  }

  const exportStats = useMemo(() => {
    return {
      messages: messages.length,
      notifications: notifications.length,
      contacts: contacts.length,
    }
  }, [messages, notifications, contacts])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          <h2 className="text-2xl font-bold">Data Export</h2>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-3 rounded border">
            <FileText className="h-5 w-5 text-blue-500" />
            <div>
              <div className="text-sm text-muted-foreground">Messages</div>
              <div className="font-semibold">{exportStats.messages}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded border">
            <FileText className="h-5 w-5 text-green-500" />
            <div>
              <div className="text-sm text-muted-foreground">Notifications</div>
              <div className="font-semibold">{exportStats.notifications}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded border">
            <FileText className="h-5 w-5 text-purple-500" />
            <div>
              <div className="text-sm text-muted-foreground">Contacts</div>
              <div className="font-semibold">{exportStats.contacts}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Export Type</label>
            <Select
              value={exportType}
              onValueChange={(value: 'csv' | 'json') => setExportType(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV (Spreadsheet)</SelectItem>
                <SelectItem value="json">JSON (Structured Data)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Data Scope</label>
            <Select value={exportScope} onValueChange={(value: any) => setExportScope(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Data</SelectItem>
                <SelectItem value="messages">Messages Only ({exportStats.messages})</SelectItem>
                <SelectItem value="notifications">
                  Notifications Only ({exportStats.notifications})
                </SelectItem>
                <SelectItem value="contacts">Contacts Only ({exportStats.contacts})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={handleExport}
          className="w-full"
          disabled={messages.length === 0 && notifications.length === 0 && contacts.length === 0}
        >
          <Download className="h-4 w-4 mr-2" />
          Export {exportScope === 'all' ? 'All Data' : exportScope} as {exportType.toUpperCase()}
        </Button>

        <div className="text-xs text-muted-foreground pt-2 border-t">
          <p className="font-semibold mb-1">Export Information:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>CSV format is ideal for spreadsheet applications (Excel, Google Sheets)</li>
            <li>JSON format preserves all data structure and metadata</li>
            <li>All timestamps are included in ISO 8601 format</li>
            <li>Files are automatically downloaded with timestamp in filename</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
