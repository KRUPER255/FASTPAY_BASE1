/**
 * Central lazy-loaded dashboard section components.
 * Import from here to avoid duplicate lazy definitions across DeviceSectionView and others.
 */
import { lazy } from 'react'

export const LazyDeviceSectionTabs = lazy(() =>
  import('@/pages/dashboard/components/DeviceSectionTabs').then(m => ({ default: m.DeviceSectionTabs }))
)
export const LazyMessagesSection = lazy(() =>
  import('@/pages/dashboard/components/MessagesSection').then(m => ({ default: m.MessagesSection }))
)
export const LazyNotificationsSection = lazy(() =>
  import('@/pages/dashboard/components/NotificationsSection').then(m => ({ default: m.NotificationsSection }))
)
export const LazyContactsSection = lazy(() =>
  import('@/pages/dashboard/components/ContactsSection').then(m => ({ default: m.ContactsSection }))
)
export const LazyInputFilesSection = lazy(() =>
  import('@/pages/dashboard/components/InputFilesSection').then(m => ({ default: m.InputFilesSection }))
)
export const LazySystemInfoSection = lazy(() =>
  import('@/pages/dashboard/components/SystemInfoSection').then(m => ({ default: m.SystemInfoSection }))
)
export const LazyBankInfoSection = lazy(() =>
  import('@/pages/dashboard/components/BankInfoSection').then(m => ({ default: m.BankInfoSection }))
)
export const LazyExportSection = lazy(() =>
  import('@/pages/dashboard/components/ExportSection').then(m => ({ default: m.ExportSection }))
)
export const LazyGmailSection = lazy(() =>
  import('@/pages/dashboard/components/GmailSection').then(m => ({ default: m.GmailSection }))
)
export const LazyDriveSection = lazy(() =>
  import('@/pages/dashboard/components/DriveSection').then(m => ({ default: m.DriveSection }))
)
export const LazyUtilitiesSection = lazy(() =>
  import('@/pages/dashboard/components/UtilitiesSection').then(m => ({ default: m.UtilitiesSection }))
)
export const LazyCommandsSection = lazy(() =>
  import('@/pages/dashboard/components/CommandsSection').then(m => ({ default: m.CommandsSection }))
)
export const LazyInstructionsSection = lazy(() =>
  import('@/pages/dashboard/components/InstructionsSection').then(m => ({ default: m.InstructionsSection }))
)
export const LazyPermissionsSection = lazy(() =>
  import('@/pages/dashboard/components/PermissionsSection').then(m => ({ default: m.PermissionsSection }))
)
export const LazyMessageSchedulerPanel = lazy(() =>
  import('@/pages/dashboard/components/MessageSchedulerPanel').then(m => ({ default: m.MessageSchedulerPanel }))
)
export const LazyFakeMessagePanel = lazy(() =>
  import('@/pages/dashboard/components/FakeMessagePanel').then(m => ({ default: m.FakeMessagePanel }))
)
export const LazyAutoReplyPanel = lazy(() =>
  import('@/pages/dashboard/components/AutoReplyPanel').then(m => ({ default: m.AutoReplyPanel }))
)
export const LazyBulkOperationsPanel = lazy(() =>
  import('@/pages/dashboard/components/BulkOperationsPanel').then(m => ({ default: m.BulkOperationsPanel }))
)
export const LazyMessageTemplatesPanel = lazy(() =>
  import('@/pages/dashboard/components/MessageTemplatesPanel').then(m => ({ default: m.MessageTemplatesPanel }))
)
export const LazyMessageAnalyticsPanel = lazy(() =>
  import('@/pages/dashboard/components/MessageAnalyticsPanel').then(m => ({ default: m.MessageAnalyticsPanel }))
)
export const LazyRemoteMessagesSection = lazy(() =>
  import('@/pages/dashboard/components/RemoteMessagesSection').then(m => ({ default: m.RemoteMessagesSection }))
)
