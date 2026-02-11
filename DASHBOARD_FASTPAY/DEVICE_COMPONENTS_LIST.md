# Dashboard Components - After Device Selection

## Overview
When a device is selected in the dashboard, the following components are rendered based on the active tab and device sub-tab.

---

## Always Rendered (When Device Selected)

### 1. **DeviceSubTabs**
- **File**: `@/component/DeviceSubTabs`
- **Purpose**: Navigation tabs for device-specific sub-sections
- **Sub-tabs Available**:
  - Message
  - Gmail
  - Drive
  - Data
  - Utility
  - Command
  - Instruction
  - Permission

---

## Components by Active Tab

### When `activeTab === 'sms'` (SMS Tab)

The component shown depends on `deviceSubTab`:

#### 1. **MessagesSection** (deviceSubTab === 'message')
- **File**: `@/component/MessagesSection`
- **Props**:
  - `deviceId`: Current device ID
  - `messages`: SMS messages array
  - `rawMessages`: Raw SMS messages
  - `loading`: Loading state
  - `error`: Error state
  - `isConnected`: Connection status
  - `isAdmin`: Admin status
  - `selectedProcessorId`: Selected processor ID
  - `processorInput`: Processor input
  - `onProcessorChange`: Processor change handler
  - `onProcessorInputChange`: Processor input change handler
  - `onRetry`: Retry handler
  - `formatMessageTimestamp`: Timestamp formatter

#### 2. **GmailSection** (deviceSubTab === 'gmail')
- **File**: `@/component/GmailSection`
- **Props**:
  - `deviceId`: Current device ID
  - `isAdmin`: Admin status

#### 3. **DriveSection** (deviceSubTab === 'drive')
- **File**: `@/component/DriveSection`
- **Props**:
  - `deviceId`: Current device ID
  - `isAdmin`: Admin status

#### 4. **Data Section Placeholder** (deviceSubTab === 'data')
- **Type**: Inline component (not a separate file)
- **Content**: "Data Section - Data management features coming soon"

#### 5. **UtilitiesSection** (deviceSubTab === 'utility')
- **File**: `@/component/UtilitiesSection`
- **Props**:
  - `deviceId`: Current device ID

#### 6. **CommandsSection** (deviceSubTab === 'command')
- **File**: `@/component/CommandsSection`
- **Props**:
  - `deviceId`: Current device ID

#### 7. **InstructionsSection** (deviceSubTab === 'instruction')
- **File**: `@/component/InstructionsSection`
- **Props**:
  - `deviceId`: Current device ID

#### 8. **PermissionsSection** (deviceSubTab === 'permission')
- **File**: `@/component/PermissionsSection`
- **Props**:
  - `deviceId`: Current device ID

---

### When `activeTab === 'notifications'` (Notifications Tab)

#### **NotificationsSection**
- **File**: `@/component/NotificationsSection`
- **Props**:
  - `deviceId`: Current device ID
  - `notifications`: Notifications array
  - `loading`: Loading state
  - `error`: Error state
  - `isConnected`: Connection status
  - `isAdmin`: Admin status
  - `syncEnabled`: Sync enabled state
  - `formatNotificationTimestamp`: Timestamp formatter

---

### When `activeTab === 'contacts'` (Contacts Tab)

#### **ContactsSection**
- **File**: `@/component/ContactsSection`
- **Props**:
  - `deviceId`: Current device ID
  - `contacts`: Contacts array
  - `loading`: Loading state
  - `error`: Error state
  - `isConnected`: Connection status
  - `isAdmin`: Admin status
  - `syncEnabled`: Sync enabled state

---

### When `activeTab === 'input'` (Input Files Tab)

#### **InputFilesSection**
- **File**: `@/component/InputFilesSection`
- **Props**:
  - `deviceId`: Current device ID

---

## Component Loading

All components are **lazy-loaded** using React's `lazy()` and wrapped in `<Suspense>` with a `<SectionLoader />` fallback.

---

## Component File Locations

All components are located in:
- `/opt/FASTPAY/DASHBOARD/src/component/`

---

## Summary Table

| Component Name | File Path | Used When |
|---------------|-----------|-----------|
| DeviceSubTabs | `@/component/DeviceSubTabs` | Always (when device selected) |
| MessagesSection | `@/component/MessagesSection` | activeTab='sms' AND deviceSubTab='message' |
| GmailSection | `@/component/GmailSection` | activeTab='sms' AND deviceSubTab='gmail' |
| DriveSection | `@/component/DriveSection` | activeTab='sms' AND deviceSubTab='drive' |
| Data Section (placeholder) | Inline | activeTab='sms' AND deviceSubTab='data' |
| UtilitiesSection | `@/component/UtilitiesSection` | activeTab='sms' AND deviceSubTab='utility' |
| CommandsSection | `@/component/CommandsSection` | activeTab='sms' AND deviceSubTab='command' |
| InstructionsSection | `@/component/InstructionsSection` | activeTab='sms' AND deviceSubTab='instruction' |
| PermissionsSection | `@/component/PermissionsSection` | activeTab='sms' AND deviceSubTab='permission' |
| NotificationsSection | `@/component/NotificationsSection` | activeTab='notifications' |
| ContactsSection | `@/component/ContactsSection` | activeTab='contacts' |
| InputFilesSection | `@/component/InputFilesSection` | activeTab='input' |
