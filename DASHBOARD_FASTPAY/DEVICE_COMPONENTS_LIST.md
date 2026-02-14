# Dashboard Components - After Device Selection

## Overview
When a device is selected in the Device section, the following components are rendered based on the active **section** (Device / Bankcard / Users / Utility / API) and, within Device, the **device section tab** (`deviceSectionTab`).

---

## Always Rendered in Device Section (When Device Selected)

### 1. **DeviceSectionTabs**
- **File**: `src/pages/dashboard/components/DeviceSectionTabs.tsx`
- **Purpose**: Row of sub-tabs for device-specific sub-views
- **Tabs**: Message, Gmail, Data, Utility, Command, Instruction, Permission, Company (admin)

---

## Components by Device Section Tab

The main content is driven by `deviceSectionTab` (Message, Gmail, Data, Utility, etc.).

#### 1. **MessagesSection** (deviceSectionTab === 'message')
- **File**: `src/pages/dashboard/components/MessagesSection.tsx`
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

#### 2. **GmailSection** (deviceSectionTab === 'gmail')
- **File**: `src/pages/dashboard/components/GmailSection.tsx`
- **Props**:
  - `deviceId`: Current device ID
  - `isAdmin`: Admin status

#### 3. **Data** (deviceSectionTab === 'data')
- **Type**: Sub-tabs (Notifications, Contacts, Input Files, System Info, Bank Info, Export, Remote Messages) with sections such as NotificationsSection, ContactsSection, InputFilesSection, SystemInfoSection, BankInfoSection, ExportSection, Remote block, etc.

#### 4. **UtilitiesSection** (deviceSectionTab === 'utility')
- **File**: `src/pages/dashboard/components/UtilitiesSection.tsx`
- **Props**:
  - `deviceId`: Current device ID

#### 5. **CommandsSection** (deviceSectionTab === 'command')
- **File**: `src/pages/dashboard/components/CommandsSection.tsx`
- **Props**:
  - `deviceId`: Current device ID

#### 6. **InstructionsSection** (deviceSectionTab === 'instruction')
- **File**: `src/pages/dashboard/components/InstructionsSection.tsx`
- **Props**:
  - `deviceId`: Current device ID

#### 7. **PermissionsSection** (deviceSectionTab === 'permission')
- **File**: `src/pages/dashboard/components/PermissionsSection.tsx`

#### 8. **DeviceSectionCompanyCard** (deviceSectionTab === 'company', admin only)
- **File**: `src/pages/dashboard/components/DeviceSectionCompanyCard.tsx`
- **Props**:
  - `deviceId`: Current device ID

---

### Data sub-tabs (when deviceSectionTab === 'data')

#### **NotificationsSection**
- **File**: `src/pages/dashboard/components/NotificationsSection.tsx`
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

#### **ContactsSection**
- **File**: `src/pages/dashboard/components/ContactsSection.tsx`
- **Props**:
  - `deviceId`: Current device ID
  - `contacts`: Contacts array
  - `loading`: Loading state
  - `error`: Error state
  - `isConnected`: Connection status
  - `isAdmin`: Admin status
  - `syncEnabled`: Sync enabled state

---

#### **InputFilesSection**
- **File**: `src/pages/dashboard/components/InputFilesSection.tsx`
- **Props**:
  - `deviceId`: Current device ID

---

## Component Loading

All components are **lazy-loaded** using React's `lazy()` and wrapped in `<Suspense>` with a `<SectionLoader />` fallback.

---

## Right sidebar (Device section only)

When section is **Device** and a device is selected, the right column shows **DeviceSectionRightSidebar** (`src/pages/dashboard/components/DeviceSectionRightSidebar.tsx`): Bank Card | Utilities tabs, then **BankCardSidebar** or **UtilitySectionView**. When no device is selected it shows "Select a device to view bank cards".

---

## Component File Locations

Device section components live under:
- `src/pages/dashboard/components/` and `src/pages/dashboard/views/` (DASHBOARD_FASTPAY)

---

## Summary Table

| Component Name | File Path | Used When |
|---------------|-----------|-----------|
| DeviceSectionTabs | `src/pages/dashboard/components/DeviceSectionTabs.tsx` | Device section (when device selected) |
| DeviceSectionRightSidebar | `src/pages/dashboard/components/DeviceSectionRightSidebar.tsx` | Device section right column (Bank Card \| Utilities) |
| MessagesSection | `src/pages/dashboard/components/MessagesSection.tsx` | deviceSectionTab='message' |
| GmailSection | `src/pages/dashboard/components/GmailSection.tsx` | deviceSectionTab='gmail' |
| Data sub-tabs + sections | various | deviceSectionTab='data' |
| UtilitiesSection | `src/pages/dashboard/components/UtilitiesSection.tsx` | deviceSectionTab='utility' |
| CommandsSection | `src/pages/dashboard/components/CommandsSection.tsx` | deviceSectionTab='command' |
| InstructionsSection | `src/pages/dashboard/components/InstructionsSection.tsx` | deviceSectionTab='instruction' |
| PermissionsSection | `src/pages/dashboard/components/PermissionsSection.tsx` | deviceSectionTab='permission' |
| DeviceSectionCompanyCard | `src/pages/dashboard/components/DeviceSectionCompanyCard.tsx` | deviceSectionTab='company' (admin) |
| NotificationsSection | `src/pages/dashboard/components/NotificationsSection.tsx` | Data tab → Notifications |
| ContactsSection | `src/pages/dashboard/components/ContactsSection.tsx` | Data tab → Contacts |
| InputFilesSection | `src/pages/dashboard/components/InputFilesSection.tsx` | Data tab → Input Files |
