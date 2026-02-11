import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/component/ui/card'
import { Button } from '@/component/ui/button'
import { Badge } from '@/component/ui/badge'
import { Input } from '@/component/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/component/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/component/ui/select'
import {
  Code2,
  Activity,
  Search,
  RefreshCw,
  Copy,
  Check,
  Play,
  Clock,
  Globe,
  Server,
  Monitor,
  AlertCircle,
} from 'lucide-react'
import { useToast } from '@/lib/use-toast'
import { djangoApiLogger, type DjangoApiLog } from '@/lib/django-api-logger'
import { getApiUrl } from '@/lib/api-client'

interface ApiEndpoint {
  method: string
  path: string
  description: string
  category: string
  requestExample?: any
  responseExample?: any
  queryParams?: Array<{ name: string; type: string; description: string; required: boolean }>
}

interface ApiRequestLog {
  id: number
  method: string
  path: string
  status_code: number | null
  user_identifier: string | null
  client_ip: string | null
  response_time_ms: number | null
  created_at: string
}

interface ApiSectionProps {
  initialTab?: 'documentation' | 'monitor'
  showMonitor?: boolean
  title?: string
  description?: string
}

// API Endpoints Documentation
const API_ENDPOINTS: ApiEndpoint[] = [
  // Devices
  {
    method: 'GET',
    path: '/api/devices/',
    description: 'List all devices',
    category: 'Devices',
    queryParams: [
      { name: 'user_email', type: 'string', description: 'Filter by user email', required: false },
      { name: 'code', type: 'string', description: 'Filter by activation code', required: false },
      { name: 'is_active', type: 'boolean', description: 'Filter by active status', required: false },
      { name: 'device_id', type: 'string', description: 'Filter by device ID', required: false },
    ],
    responseExample: [
      {
        id: 1,
        device_id: 'abc123',
        name: 'Device 1',
        code: 'CODE123',
        is_active: true,
        phone: '+1234567890',
        last_seen: '2024-01-01T00:00:00Z',
        battery_percentage: 85,
      },
    ],
  },
  {
    method: 'POST',
    path: '/api/devices/',
    description: 'Create a new device',
    category: 'Devices',
    requestExample: {
      device_id: 'abc123',
      name: 'Device 1',
      code: 'CODE123',
      bankcard_template_id: 1,
      gmail_account_id: 1,
    },
    responseExample: {
      id: 1,
      device_id: 'abc123',
      name: 'Device 1',
      code: 'CODE123',
      is_active: true,
    },
  },
  {
    method: 'GET',
    path: '/api/devices/{device_id}/',
    description: 'Get device by ID',
    category: 'Devices',
    responseExample: {
      id: 1,
      device_id: 'abc123',
      name: 'Device 1',
      code: 'CODE123',
      is_active: true,
    },
  },
  {
    method: 'PATCH',
    path: '/api/devices/{device_id}/activate/',
    description: 'Activate a device',
    category: 'Devices',
    responseExample: {
      success: true,
      message: 'Device activated',
    },
  },
  {
    method: 'PATCH',
    path: '/api/devices/{device_id}/update-battery/',
    description: 'Update device battery level',
    category: 'Devices',
    requestExample: {
      battery_percentage: 85,
    },
    responseExample: {
      success: true,
      battery_percentage: 85,
    },
  },
  // Messages
  {
    method: 'GET',
    path: '/api/messages/',
    description: 'List all messages',
    category: 'Messages',
    queryParams: [
      { name: 'device_id', type: 'string', description: 'Filter by device ID', required: false },
      { name: 'skip', type: 'number', description: 'Skip records', required: false },
      { name: 'limit', type: 'number', description: 'Limit records', required: false },
    ],
    responseExample: [
      {
        id: 1,
        device_id: 'abc123',
        phone: '+1234567890',
        body: 'Hello World',
        timestamp: '2024-01-01T00:00:00Z',
        is_sent: false,
      },
    ],
  },
  {
    method: 'POST',
    path: '/api/messages/',
    description: 'Create message(s)',
    category: 'Messages',
    requestExample: {
      device: 1,
      message_type: 'received',
      phone: '+1234567890',
      body: 'Hello World',
      timestamp: '2024-01-01T00:00:00Z',
    },
    responseExample: {
      id: 1,
      device_id: 'abc123',
      phone: '+1234567890',
      body: 'Hello World',
    },
  },
  // Notifications
  {
    method: 'GET',
    path: '/api/notifications/',
    description: 'List all notifications',
    category: 'Notifications',
    queryParams: [
      { name: 'device_id', type: 'string', description: 'Filter by device ID', required: false },
    ],
    responseExample: [
      {
        id: 1,
        device_id: 'abc123',
        app: 'com.example.app',
        title: 'Notification Title',
        body: 'Notification Body',
        timestamp: '2024-01-01T00:00:00Z',
      },
    ],
  },
  {
    method: 'POST',
    path: '/api/notifications/',
    description: 'Create notification(s)',
    category: 'Notifications',
    requestExample: {
      device: 1,
      package_name: 'com.example.app',
      title: 'Notification Title',
      text: 'Notification Body',
      timestamp: '2024-01-01T00:00:00Z',
    },
    responseExample: {
      id: 1,
      device_id: 'abc123',
      app: 'com.example.app',
      title: 'Notification Title',
      body: 'Notification Body',
    },
  },
  // Contacts
  {
    method: 'GET',
    path: '/api/contacts/',
    description: 'List all contacts',
    category: 'Contacts',
    queryParams: [
      { name: 'device_id', type: 'string', description: 'Filter by device ID', required: false },
      { name: 'phone_number', type: 'string', description: 'Filter by phone number', required: false },
      { name: 'name', type: 'string', description: 'Search by name', required: false },
      { name: 'simple', type: 'boolean', description: 'Return simplified format', required: false },
    ],
    responseExample: [
      {
        id: 1,
        device_id: 'abc123',
        name: 'John Doe',
        phone_number: '+1234567890',
      },
    ],
  },
  {
    method: 'POST',
    path: '/api/contacts/',
    description: 'Create/update contact(s)',
    category: 'Contacts',
    requestExample: {
      device: 1,
      name: 'John Doe',
      phone_number: '+1234567890',
    },
    responseExample: {
      id: 1,
      device_id: 'abc123',
      name: 'John Doe',
      phone_number: '+1234567890',
    },
  },
  // File System
  {
    method: 'GET',
    path: '/api/fs/list/',
    description: 'List directory contents',
    category: 'File System',
    queryParams: [
      { name: 'path', type: 'string', description: 'Directory path', required: true },
    ],
    responseExample: {
      files: ['file1.txt', 'file2.txt'],
      directories: ['dir1', 'dir2'],
    },
  },
  {
    method: 'POST',
    path: '/api/fs/upload/',
    description: 'Upload a file',
    category: 'File System',
    requestExample: {
      file: 'File object',
      path: '/path/to/upload',
    },
    responseExample: {
      success: true,
      path: '/path/to/upload/file.txt',
    },
  },
  {
    method: 'GET',
    path: '/api/fs/download/',
    description: 'Download a file',
    category: 'File System',
    queryParams: [
      { name: 'path', type: 'string', description: 'File path', required: true },
    ],
  },
  {
    method: 'DELETE',
    path: '/api/fs/delete/',
    description: 'Delete a file',
    category: 'File System',
    queryParams: [
      { name: 'path', type: 'string', description: 'File path', required: true },
    ],
    responseExample: {
      success: true,
      message: 'File deleted',
    },
  },
  // Bank Cards
  {
    method: 'GET',
    path: '/api/bank-cards/',
    description: 'List all bank cards',
    category: 'Bank Cards',
    responseExample: [
      {
        id: 1,
        device_id: 'abc123',
        card_number: '****1234',
        bank_name: 'Bank Name',
        status: 'active',
      },
    ],
  },
  {
    method: 'POST',
    path: '/api/bank-cards/batch/',
    description: 'Batch lookup bank-card summaries by device IDs',
    category: 'Bank Cards',
    requestExample: {
      device_ids: ['device_1', 'device_2'],
    },
    responseExample: {
      results: {
        device_1: { id: 10, device_id: 'device_1', bank_code: 'HDFC', bank_name: 'HDFC Bank' },
        device_2: null,
      },
    },
  },
  {
    method: 'POST',
    path: '/api/bank-cards/',
    description: 'Create a bank card',
    category: 'Bank Cards',
    requestExample: {
      device: 1,
      template: 1,
      card_number: '1234567890123456',
      bank_name: 'Bank Name',
    },
    responseExample: {
      id: 1,
      device_id: 'abc123',
      card_number: '****1234',
      bank_name: 'Bank Name',
    },
  },
  // Gmail
  {
    method: 'GET',
    path: '/api/gmail/status/',
    description: 'Get Gmail account status',
    category: 'Gmail',
    queryParams: [
      { name: 'user_email', type: 'string', description: 'User email', required: true },
    ],
    responseExample: {
      connected: true,
      gmail_email: 'user@gmail.com',
      last_sync: '2024-01-01T00:00:00Z',
    },
  },
  {
    method: 'GET',
    path: '/api/gmail/messages/',
    description: 'List Gmail messages',
    category: 'Gmail',
    queryParams: [
      { name: 'user_email', type: 'string', description: 'User email', required: true },
      { name: 'max_results', type: 'number', description: 'Max results', required: false },
    ],
    responseExample: {
      messages: [
        {
          id: 'msg123',
          snippet: 'Message snippet',
          subject: 'Subject',
        },
      ],
    },
  },
  {
    method: 'POST',
    path: '/api/gmail/send/',
    description: 'Send Gmail message',
    category: 'Gmail',
    requestExample: {
      user_email: 'user@example.com',
      to: 'recipient@example.com',
      subject: 'Subject',
      body: 'Message body',
    },
    responseExample: {
      success: true,
      message_id: 'msg123',
    },
  },
  // Drive
  {
    method: 'GET',
    path: '/api/drive/files/',
    description: 'List Drive files',
    category: 'Google Drive',
    queryParams: [
      { name: 'user_email', type: 'string', description: 'User email', required: true },
    ],
    responseExample: {
      files: [
        {
          id: 'file123',
          name: 'file.pdf',
          mimeType: 'application/pdf',
        },
      ],
    },
  },
  {
    method: 'POST',
    path: '/api/drive/upload/',
    description: 'Upload file to Drive',
    category: 'Google Drive',
    requestExample: {
      user_email: 'user@example.com',
      file: 'File object',
      name: 'file.pdf',
    },
    responseExample: {
      success: true,
      file_id: 'file123',
    },
  },
  // Authentication
  {
    method: 'POST',
    path: '/api/validate-login/',
    description: 'Validate APK login',
    category: 'Authentication',
    requestExample: {
      code: 'ACTIVATION_CODE',
    },
    responseExample: {
      approved: true,
      message: 'Login approved',
      device_id: 'abc123',
      bank_card: {
        id: 1,
        bank_name: 'Bank Name',
      },
    },
  },
  {
    method: 'POST',
    path: '/api/dashboard-login/',
    description: 'Dashboard login',
    category: 'Authentication',
    requestExample: {
      email: 'user@example.com',
      password: 'password',
    },
    responseExample: {
      success: true,
      token: 'session_token',
      user: {
        email: 'user@example.com',
        access_level: 1,
      },
    },
  },
  // Logs
  {
    method: 'GET',
    path: '/api/api-request-logs/',
    description: 'List API request logs',
    category: 'Logs',
    queryParams: [
      { name: 'method', type: 'string', description: 'Filter by HTTP method', required: false },
      { name: 'status_code', type: 'number', description: 'Filter by status code', required: false },
      { name: 'path_contains', type: 'string', description: 'Filter by path', required: false },
    ],
    responseExample: [
      {
        id: 1,
        method: 'GET',
        path: '/api/devices/',
        status_code: 200,
        response_time_ms: 150,
        created_at: '2024-01-01T00:00:00Z',
      },
    ],
  },
  {
    method: 'GET',
    path: '/api/command-logs/',
    description: 'List command logs',
    category: 'Logs',
    responseExample: [
      {
        id: 1,
        device_id: 'abc123',
        command: 'SEND_SMS',
        status: 'success',
        created_at: '2024-01-01T00:00:00Z',
      },
    ],
  },
]

export function ApiSection({
  initialTab = 'documentation',
  showMonitor = true,
  title,
  description,
}: ApiSectionProps) {
  const { toast } = useToast()
  const sanitizedInitialTab = showMonitor ? initialTab : 'documentation'
  const [activeTab, setActiveTab] = useState<'documentation' | 'monitor'>(sanitizedInitialTab)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedMethod, setSelectedMethod] = useState<string>('all')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const resolvedTitle =
    title ?? (showMonitor ? 'API Documentation & Monitoring' : 'API Documentation')
  const resolvedDescription =
    description ??
    (showMonitor
      ? 'View all API endpoints and monitor live API calls'
      : 'View all API endpoints with request and response examples')
  
  // Live monitoring state
  const [clientLogs, setClientLogs] = useState<DjangoApiLog[]>([])
  const [serverLogs, setServerLogs] = useState<ApiRequestLog[]>([])
  const [isMonitoring, setIsMonitoring] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPath, setFilterPath] = useState('')

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(API_ENDPOINTS.map(api => api.category))
    return Array.from(cats).sort()
  }, [])

  const summary = useMemo(() => {
    const total = API_ENDPOINTS.length
    const categoryCount = categories.length
    const methods = new Set(API_ENDPOINTS.map(api => api.method)).size
    return { total, categoryCount, methods }
  }, [categories])

  // Filter APIs
  const filteredApis = useMemo(() => {
    return API_ENDPOINTS.filter(api => {
      const matchesSearch = 
        api.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
        api.description.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = selectedCategory === 'all' || api.category === selectedCategory
      const matchesMethod = selectedMethod === 'all' || api.method === selectedMethod
      return matchesSearch && matchesCategory && matchesMethod
    })
  }, [searchQuery, selectedCategory, selectedMethod])

  // Subscribe to client-side logs
  useEffect(() => {
    if (!isMonitoring) return

    const updateLogs = () => {
      const logs = djangoApiLogger.getLogs()
      setClientLogs(logs.slice(0, 100)) // Keep last 100
    }

    updateLogs()
    const unsubscribe = djangoApiLogger.subscribe(updateLogs)

    return () => {
      unsubscribe()
    }
  }, [isMonitoring])

  // Fetch server logs
  const fetchServerLogs = async () => {
    try {
      const params = new URLSearchParams()
      if (filterStatus !== 'all') {
        if (filterStatus === 'success') params.append('status_code', '200')
        else if (filterStatus === 'error') params.append('status_code__gte', '400')
      }
      if (filterPath) params.append('path_contains', filterPath)

      const response = await fetch(getApiUrl(`/api-request-logs/?${params.toString()}`))
      if (response.ok) {
        const data = await response.json()
        const logs = Array.isArray(data) ? data : data.results || []
        setServerLogs(logs.slice(0, 100)) // Keep last 100
      }
    } catch (error) {
      console.error('Error fetching server logs:', error)
    }
  }

  useEffect(() => {
    if (isMonitoring && autoRefresh) {
      fetchServerLogs()
      const interval = setInterval(fetchServerLogs, 5000) // Refresh every 5 seconds
      return () => clearInterval(interval)
    }
  }, [isMonitoring, autoRefresh, filterStatus, filterPath])

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
    toast({
      title: 'Copied',
      description: 'Copied to clipboard',
    })
  }

  const getStatusColor = (status?: number) => {
    if (!status) return 'bg-gray-500'
    if (status >= 200 && status < 300) return 'bg-green-500'
    if (status >= 300 && status < 400) return 'bg-blue-500'
    if (status >= 400 && status < 500) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const formatJson = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2)
    } catch {
      return String(obj)
    }
  }

  // Early return if component fails to load
  if (!API_ENDPOINTS || API_ENDPOINTS.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Loading API documentation...</p>
      </div>
    )
  }

  const documentationContent = (
    <>
      {/* Filters */}
      <div className="flex gap-2 flex-wrap rounded-lg border border-border/50 bg-muted/20 p-3">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search APIs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedMethod} onValueChange={setSelectedMethod}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            <SelectItem value="GET">GET</SelectItem>
            <SelectItem value="POST">POST</SelectItem>
            <SelectItem value="PUT">PUT</SelectItem>
            <SelectItem value="PATCH">PATCH</SelectItem>
            <SelectItem value="DELETE">DELETE</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* API List */}
      <div className="space-y-4">
        {filteredApis.map((api, idx) => (
          <Card key={idx}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={api.method === 'GET' ? 'default' : api.method === 'POST' ? 'secondary' : 'outline'}>
                      {api.method}
                    </Badge>
                    <code className="text-sm font-mono">{api.path}</code>
                    <Badge variant="outline">{api.category}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{api.description}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {api.queryParams && api.queryParams.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Query Parameters</h4>
                  <div className="space-y-1">
                    {api.queryParams.map((param, pIdx) => (
                      <div key={pIdx} className="text-sm">
                        <code className="text-primary">{param.name}</code>
                        <span className="text-muted-foreground"> ({param.type})</span>
                        {param.required && <Badge variant="destructive" className="ml-2 text-xs">Required</Badge>}
                        <span className="text-muted-foreground"> - {param.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {api.requestExample && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">Request Example</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(formatJson(api.requestExample), `req-${idx}`)}
                    >
                      {copiedId === `req-${idx}` ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
                    <code>{formatJson(api.requestExample)}</code>
                  </pre>
                </div>
              )}

              {api.responseExample && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">Response Example</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(formatJson(api.responseExample), `res-${idx}`)}
                    >
                      {copiedId === `res-${idx}` ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
                    <code>{formatJson(api.responseExample)}</code>
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )

  const monitorContent = (
    <>
      {/* Monitor Controls */}
      <div className="flex items-center gap-4 flex-wrap rounded-lg border border-border/50 bg-muted/20 p-3">
        <div className="flex items-center gap-2">
          <Button
            variant={isMonitoring ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsMonitoring(!isMonitoring)}
          >
            {isMonitoring ? (
              <>
                <Activity className="h-4 w-4 mr-2" />
                Monitoring
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Monitor
              </>
            )}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm">Auto Refresh</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchServerLogs}
          disabled={!isMonitoring}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="success">Success (2xx)</SelectItem>
            <SelectItem value="error">Error (4xx+)</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Filter by path..."
          value={filterPath}
          onChange={(e) => setFilterPath(e.target.value)}
          className="w-[200px]"
        />
      </div>

      {/* Client-side Logs */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Monitor className="h-4 w-4" />
          <h3 className="font-semibold">Client-Side Logs (Dashboard → Backend)</h3>
          <Badge variant="outline">{clientLogs.length}</Badge>
        </div>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {clientLogs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No client-side API calls yet
              </CardContent>
            </Card>
          ) : (
            clientLogs.map((log) => (
              <Card key={log.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={log.method === 'GET' ? 'default' : 'secondary'}>
                          {log.method}
                        </Badge>
                        <code className="text-sm truncate">{log.url}</code>
                        {log.status && (
                          <Badge
                            className={getStatusColor(log.status)}
                            variant="outline"
                          >
                            {log.status}
                          </Badge>
                        )}
                        {log.responseTime && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {log.responseTime.toFixed(0)}ms
                          </span>
                        )}
                      </div>
                      {log.error && (
                        <div className="text-sm text-red-500 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {log.error}
                        </div>
                      )}
                      {log.requestBody && (
                        <details className="mt-2">
                          <summary className="text-xs text-muted-foreground cursor-pointer">
                            Request Body
                          </summary>
                          <pre className="bg-muted p-2 rounded mt-1 text-xs overflow-x-auto">
                            {formatJson(log.requestBody)}
                          </pre>
                        </details>
                      )}
                      {log.responseBody && (
                        <details className="mt-2">
                          <summary className="text-xs text-muted-foreground cursor-pointer">
                            Response Body
                          </summary>
                          <pre className="bg-muted p-2 rounded mt-1 text-xs overflow-x-auto">
                            {formatJson(log.responseBody)}
                          </pre>
                        </details>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Server-side Logs */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Server className="h-4 w-4" />
          <h3 className="font-semibold">Server-Side Logs (All API Requests)</h3>
          <Badge variant="outline">{serverLogs.length}</Badge>
        </div>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {serverLogs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No server-side API logs yet
              </CardContent>
            </Card>
          ) : (
            serverLogs.map((log) => (
              <Card key={log.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge variant={log.method === 'GET' ? 'default' : 'secondary'}>
                          {log.method}
                        </Badge>
                        <code className="text-sm truncate">{log.path}</code>
                        {log.status_code && (
                          <Badge
                            className={getStatusColor(log.status_code)}
                            variant="outline"
                          >
                            {log.status_code}
                          </Badge>
                        )}
                        {log.response_time_ms && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {log.response_time_ms}ms
                          </span>
                        )}
                        {log.user_identifier && (
                          <Badge variant="outline" className="text-xs">
                            {log.user_identifier}
                          </Badge>
                        )}
                        {log.client_ip && (
                          <Badge variant="outline" className="text-xs">
                            <Globe className="h-3 w-3 mr-1" />
                            {log.client_ip}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </>
  )

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader className="p-5 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Code2 className="h-5 w-5 text-primary" />
                {resolvedTitle}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{resolvedDescription}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">Endpoints: {summary.total}</Badge>
              <Badge variant="outline">Categories: {summary.categoryCount}</Badge>
              <Badge variant="outline">Methods: {summary.methods}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {showMonitor ? (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="documentation">
                  <Code2 className="h-4 w-4 mr-2" />
                  Documentation
                </TabsTrigger>
                <TabsTrigger value="monitor">
                  <Activity className="h-4 w-4 mr-2" />
                  Live Monitor
                </TabsTrigger>
              </TabsList>

              <TabsContent value="documentation" className="space-y-4 mt-4">
                {documentationContent}
              </TabsContent>

              <TabsContent value="monitor" className="space-y-4 mt-4">
                {monitorContent}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="space-y-4 mt-4">{documentationContent}</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
