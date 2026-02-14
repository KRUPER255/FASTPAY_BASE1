# Device dashboard structure (one structure, three regions)

The device view is **one layout** made of **three regions** that are always visible together:

| Region            | Name in code   | Description |
|-------------------|----------------|-------------|
| **devicemenu**    | Device list    | Left: device list sidebar (search, refresh, device cards). Before select: list of devices. |
| **contentsection**| Main content   | Center: main content. Before select: "Select a device from the sidebar". After select: sub-tabs + content (messages, data, etc.). |
| **bankcardbar**   | Bank card bar  | Right: bank card panel. Before select: "Select a device to view bank cards". After select: Bank Card card with account/card details. |

**Design:** Device menu on the left; contentsection and bankcardbar **side by side** to its right (contentsection wider, bankcardbar narrower).

**Before select device:** devicemenu (list) | contentsection (placeholder) | bankcardbar (placeholder).  
**After select device:** devicemenu (list, one selected) | contentsection (tabs + content) | bankcardbar (Bank Card panel).

These three count as **one component structure** because they are visible and used together in the same view.

---

# Elements shown when a device is selected

When a user selects a device in the device list, the following elements are rendered (in layout order).

---

## Layout level (UnifiedLayout)

- **Center content wrapper** – `key={selectedDevice}` + `.device-content-enter` (animation on device change)
- **Tagline section** (optional) – gradient banner with device tagline when `tagline` is set for the selected device
- **Right sidebar** – only when `activeSection === 'device'` (see below)

---

## Main content (depends on active section tab)

### When section is **Device** (default)

**From DashboardShell → DeviceSectionView:**

1. **Error block** (if any) – `devicesError` message + Retry button
2. **DeviceSectionTabs** – row of sub-tabs: Message, Gmail, Data, Utility, Command, Instruction, Permission, Company (admin)
3. **Content by sub-tab:**
   - **Message** → `MessagesSection` (SMS list, search, processor, refresh)
   - **Google** → `GmailSection`
   - **Company** (admin) → `DeviceSectionCompanyCard`
   - **Data** → Tabs: Notifications, Contacts, Input Files, System Info, Bank Info, Export, Remote Messages  
     - Each tab content: `NotificationsSection`, `ContactsSection`, `InputFilesSection`, `SystemInfoSection`, `BankInfoSection`, `ExportSection`, or Remote block (`MessageSchedulerPanel`, `FakeMessagePanel`, `AutoReplyPanel`, `BulkOperationsPanel`, `MessageTemplatesPanel`, `MessageAnalyticsPanel`, `RemoteMessagesSection`)
   - **Utility** → `UtilitiesSection`
   - **Command** → `CommandsSection`
   - **Instruction** → `InstructionsSection`
   - **Permission** → `PermissionsSection`

### When section is **Bankcard**

- **BankcardSectionView** – bank card management for the selected device

### When section is **Utility**

- **UtilitySectionView** – uses selected device id. Tabs: Export, Activation failures, Activity logs, Telegram, My Telegram, Scheduled tasks, Analytics, API Log, **Sheet worker** (list processes from API, run with file or Google Sheet link; returns Excel or download).

### When section is **Users / API**

- No device-specific content; device selection does not change these views. (Profile is available from the header user menu, not as a section.)

---

## Right sidebar (when section is Device and a device is selected)

- **DeviceSectionRightSidebar** – Bank Card | Utilities tabs at top; below either **BankCardSidebar** (Bank Card tab) or **UtilitySectionView** (Utilities tab). When no device selected: "Select a device to view bank cards".

---

## File reference

| Element / area           | Source file |
|--------------------------|------------|
| Layout, tagline, animation wrapper | `src/component/UnifiedLayout.tsx` |
| Section routing (Device / Bankcard / …) | `src/pages/dashboard/DashboardShell.tsx` |
| Device section (tabs + all sub-views) | `src/pages/dashboard/views/DeviceSectionView.tsx` |
| Device section tabs row  | `src/pages/dashboard/components/DeviceSectionTabs.tsx` |
| Message tab              | `src/pages/dashboard/components/MessagesSection.tsx` |
| Right sidebar (Device section) | `src/pages/dashboard/components/DeviceSectionRightSidebar.tsx`; content: `BankCardSidebar` or `UtilitySectionView` |

---

## Summary list (flat)

- Error block (device list error)
- DeviceSectionTabs (Message, Gmail, Data, Utility, Command, Instruction, Permission, Company)
- MessagesSection
- GmailSection
- DeviceSectionCompanyCard (admin, Company tab)
- Data sub-tabs container + NotificationsSection, ContactsSection, InputFilesSection, SystemInfoSection, BankInfoSection, ExportSection
- Remote Messages block: MessageSchedulerPanel, FakeMessagePanel, AutoReplyPanel, BulkOperationsPanel, MessageTemplatesPanel, MessageAnalyticsPanel, RemoteMessagesSection
- UtilitiesSection
- CommandsSection
- InstructionsSection
- PermissionsSection
- Tagline section (optional)
- DeviceSectionRightSidebar / BankCardSidebar / UtilitySectionView (right column)
