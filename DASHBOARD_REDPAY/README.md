# FastPay Dashboard

A comprehensive React-based dashboard for managing FastPay Android devices, monitoring SMS/notifications, executing remote commands, and managing device configurations.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Development](#development)
- [Build & Deployment](#build--deployment)
- [Configuration](#configuration)
- [Firebase Structure](#firebase-structure)
- [API Integration](#api-integration)
- [Remote Commands](#remote-commands)
- [Access Control](#access-control)
- [Troubleshooting](#troubleshooting)

---

## Overview

FastPay Dashboard is a real-time web application that provides administrators with a comprehensive interface to:

- Monitor and manage Android devices running the FastPay APK
- View SMS messages, notifications, and contacts in real-time
- Execute remote commands on devices
- Manage device configurations and permissions
- Track device status, battery levels, and online/offline states
- Handle OTP operations and device activation
- Manage bank information and device assignments

### Key Characteristics

- **Framework**: React 19.2.0 with TypeScript
- **Build Tool**: Vite 7.2.4
- **UI Library**: Radix UI + Tailwind CSS
- **Real-time Data**: Firebase Realtime Database
- **Routing**: React Router DOM 7.12.0
- **State Management**: React Hooks
- **Architecture**: Component-based with modular structure

---

## Features

### 🔐 Authentication & Access Control

- Email-based authentication with Firebase
- Role-based access control (Admin, OTP-only users)
- Session management with automatic logout
- Secure route protection

### 📱 Device Management

- **Device List**: View all registered devices with real-time status
- **Device Selection**: Switch between devices seamlessly
- **Device Info**: Display device metadata, battery, last seen, activation code
- **Dual Mode Support**: Handles both TESTING and RUNNING activation modes
- **Device Status**: Real-time online/offline tracking via heartbeat system

### 💬 SMS Management

- **SMS Viewing**: Real-time SMS message display
- **Message Filtering**: Filter by sender, content, date
- **Message Search**: Search through message history
- **Send SMS**: Send SMS messages directly from dashboard
- **Message Analytics**: View message statistics and trends

### 🔔 Notification Management

- **Notification Viewing**: Real-time notification display
- **Notification Filtering**: Filter by app, content, date
- **Notification Sync Control**: Enable/disable notification syncing

### 📇 Contact Management

- **Contact Viewing**: Display device contacts
- **Contact Sync**: View synced contacts from devices
- **Contact Search**: Search through contact list

### 🎮 Remote Commands

**31 Remote Commands** available for device control:

#### Core Operations (5)
- `sendSms` - Send SMS immediately
- `sendSmsDelayed` - Send SMS with delay
- `scheduleSms` - Schedule recurring SMS
- `editMessage` - Edit existing message
- `deleteMessage` - Delete message(s)

#### Fake Messages (2)
- `createFakeMessage` - Create fake SMS message
- `createFakeMessageTemplate` - Create fake message from template

#### Automation (2)
- `setupAutoReply` - Configure auto-reply system
- `forwardMessage` - Forward message to another number

#### Bulk Operations (2)
- `sendBulkSms` - Send to multiple recipients
- `bulkEditMessage` - Edit multiple messages

#### Templates (3)
- `sendSmsTemplate` - Send using template
- `saveTemplate` - Save custom template
- `deleteTemplate` - Delete template

#### Analytics & Backup (3)
- `getMessageStats` - Get message statistics
- `backupMessages` - Backup messages
- `exportMessages` - Export messages

#### Data Fetching (2)
- `fetchSms` - Fetch SMS from device
- `fetchDeviceInfo` - Fetch device information

#### Notifications (2)
- `showNotification` - Display notification on device
- `syncNotification` - Control notification sync

#### Permissions (6)
- `requestPermission` - Request device permissions
- `checkPermission` - Check permission status
- `removePermission` - Remove special permissions
- `requestDefaultSmsApp` - Request default SMS app
- `requestDefaultMessageApp` - Request default message app

#### Device Control (6)
- `setHeartbeatInterval` - Set heartbeat interval
- `updateDeviceCodeList` - Update device code
- `updateApk` - Trigger remote APK update ⭐
- `controlAnimation` - Control dashboard card animation ⭐
- `reset` - Reset device
- `executeWorkflow` - Execute workflow

### 🏦 Bank Information Management

- **Bank Info Display**: View bank name, company name, other info
- **Status Card Text**: Cycling text display from comma-separated values
- **Bankcode Support**: Handles `bankcode-{code}` format
- **Bank Status**: Manage bank status with color coding

### 📋 Sidebar Card Features

The right sidebar displays detailed information cards for the selected device:

#### Bank Card Information Card
- **Copy Button**: Copy all bank card information to clipboard in formatted text
- **Edit Toggle**: Enable/disable edit mode for card fields
- **Editable Fields** (when edit mode enabled):
  - Card Number, Card Holder, Bank Name, Bank Code
  - Account Name, Account Number, IFSC Code, Branch Name
  - Balance, Currency
- **Save/Cancel**: Save changes or cancel editing

#### Contact & KYC Information Card
- **Copy Button**: Copy all contact and KYC information to clipboard
- **Edit Toggle**: Enable/disable edit mode for contact/KYC fields
- **Editable Fields** (when edit mode enabled):
  - Mobile Number, Email, Email Password
  - KYC Name, KYC Address, Date of Birth
  - Aadhar Number, PAN Number
  - Template Code, Template Name
- **Save/Cancel**: Save changes or cancel editing

**Usage**:
1. Select a device from the device list
2. View card information in the right sidebar
3. Click the copy icon to copy card data to clipboard
4. Toggle the edit switch to enable edit mode
5. Modify fields as needed
6. Click "Save" to save changes or "Cancel" to discard

### 📊 Analytics & Reporting

- **Message Analytics**: Charts and statistics for SMS activity
- **Device Analytics**: Device usage and status analytics
- **Export Capabilities**: Export data in various formats

### 🔄 Real-time Updates

- **Firebase Listeners**: Real-time data synchronization
- **Heartbeat System**: Lightweight device status tracking
- **Optimized Queries**: Efficient Firebase path usage

---

## Tech Stack

### Core Dependencies

```json
{
  "react": "^19.2.0",
  "react-dom": "^19.2.0",
  "react-router-dom": "^7.12.0",
  "firebase": "^12.6.0",
  "typescript": "~5.9.3"
}
```

### UI & Styling

- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **Framer Motion**: Animation library
- **Chart.js**: Data visualization

### Development Tools

- **Vite**: Fast build tool and dev server
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **TypeScript**: Type safety
- **Vitest**: Testing framework

### Full Dependency List

See [Dependencies](#dependencies) section for complete list.

---

## Project Structure

```
DASHBOARD/
├── src/
│   ├── App.tsx                 # Main app component with routing
│   ├── main.tsx                # Application entry point
│   ├── index.css               # Global styles
│   │
│   ├── component/              # Reusable UI components
│   │   ├── ui/                # Base UI components (buttons, cards, etc.)
│   │   ├── widgets/           # Dashboard widgets
│   │   └── ...                # Feature-specific components
│   │
│   ├── pages/                 # Page components
│   │   ├── Dashboard.tsx      # Main dashboard page
│   │   ├── dashboard/         # Dashboard sub-pages
│   │   │   ├── components/   # Dashboard-specific components
│   │   │   └── DashboardRoute.tsx
│   │   └── otp/              # OTP page
│   │
│   ├── lib/                   # Core libraries and utilities
│   │   ├── firebase.ts        # Firebase initialization
│   │   ├── firebase-helpers.ts # Firebase path helpers
│   │   ├── auth.ts            # Authentication utilities
│   │   └── ...
│   │
│   ├── utils/                 # Utility functions
│   └── assets/               # Static assets
│
├── public/                    # Public static files
├── api/                       # API proxy endpoints (Vercel)
├── scripts/                  # Utility scripts
│
├── package.json              # Dependencies and scripts
├── vite.config.ts            # Vite configuration
├── tsconfig.json             # TypeScript configuration
├── tailwind.config.js        # Tailwind CSS configuration
├── eslint.config.js          # ESLint configuration
└── README.md                 # This file
```

---

## Getting Started

### Prerequisites

- **Node.js**: v18+ (recommended: v20+)
- **npm**: v9+ or **yarn**: v1.22+
- **Firebase Project**: Configured with Realtime Database
- **Environment Variables**: See [Configuration](#configuration)

### Installation

1. **Clone the repository** (if not already done):
   ```bash
   cd /opt/FASTPAY/DASHBOARD
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   # Create .env file (see Configuration section)
   cp .env.example .env
   # Edit .env with your Firebase credentials
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

5. **Open in browser**:
   ```
   http://localhost:5173
   ```

---

## Development

### Available Scripts

```bash
# Development
npm run dev              # Start Vite dev server
npm run dev:all          # Start both dev server and API proxy

# Build
npm run build            # Build for production
npm run preview          # Preview production build

# Code Quality
npm run lint             # Run ESLint
npm run format           # Format code with Prettier
npm run format:check     # Check code formatting

# Production
npm run start:production # Start production server

# Utility Scripts
npm run create-user      # Create default user
npm run assign-devices   # Assign all devices to admin
```

### Development Workflow

1. **Start Development Server**:
   ```bash
   npm run dev
   ```

2. **Make Changes**: Edit files in `src/` directory

3. **Hot Reload**: Changes are automatically reflected in browser

4. **Check Linting**: 
   ```bash
   npm run lint
   ```

5. **Format Code**:
   ```bash
   npm run format
   ```

### Code Organization

- **Components**: Place reusable components in `src/component/`
- **Pages**: Place page components in `src/pages/`
- **Utilities**: Place helper functions in `src/lib/` or `src/utils/`
- **Types**: Define TypeScript types near their usage or in `src/lib/types.ts`

### Best Practices

- Use TypeScript for type safety
- Follow React hooks best practices
- Use Firebase helpers from `src/lib/firebase-helpers.ts`
- Keep components small and focused
- Use Tailwind CSS for styling
- Follow existing code patterns

---

## Build & Deployment

### Production Build

```bash
npm run build
```

This creates an optimized production build in the `dist/` directory.

### Deployment Options

#### Vercel (Recommended)

1. Connect repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

#### Netlify

1. Connect repository to Netlify
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Configure environment variables

#### Self-Hosted (Nginx)

1. Build the project: `npm run build`
2. Copy `dist/` to web server directory
3. Configure Nginx (see `nginx.conf` for reference)
4. Set up SSL certificates
5. Configure environment variables

### Environment-Specific Builds

- **Development**: Uses `.env.development`
- **Production**: Uses `.env.production`
- **Local**: Uses `.env.local` (gitignored)

---

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id

# API Configuration
VITE_BLACKSMS_AUTH_TOKEN=your-blacksms-token
VITE_API_BASE_URL=http://localhost:8000/api

# Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_SENTRY=true
```

### Firebase Configuration

1. Get Firebase config from Firebase Console
2. Create Firebase project with Realtime Database enabled
3. Set up security rules (see Firebase documentation)
4. Add environment variables to `.env`

### Vite Configuration

See `vite.config.ts` for:
- Path aliases (`@/` → `src/`)
- API proxy configuration
- Build optimizations

---

## Firebase Structure

### Path Conventions

The dashboard uses the following Firebase Realtime Database structure:

```
device/{deviceId}                    # Device-specific data (NEW unified path)
  ├── permission                     # Device permissions
  ├── instructioncard                # Instruction card HTML/CSS
  ├── animationSettings              # Animation control settings
  ├── systemInfo                     # System information
  └── ...

fastpay/
  ├── testing/{code}                 # TESTING mode device-list
  ├── running/{code}                  # RUNNING mode device-list
  ├── device-list/{code}              # Legacy device-list (deprecated)
  │   ├── BANK                       # Bank information (legacy)
  │   ├── BANKSTATUS                 # Bank status
  │   ├── status_card_text            # Cycling status text
  │   └── bankcode-{code}             # Bankcode object (APK format)
  └── app/                           # App configuration

message/{deviceId}                    # SMS messages (flat structure)
notification/{deviceId}               # Notifications (flat structure)
contact/{deviceId}                    # Contacts (flat structure)
hertbit/{deviceId}                    # Heartbeat data (lightweight)
```

### Key Paths

- **Device Data**: `device/{deviceId}`
- **Messages**: `message/{deviceId}`
- **Notifications**: `notification/{deviceId}`
- **Contacts**: `contact/{deviceId}`
- **Heartbeat**: `hertbit/{deviceId}` (note: typo in APK, must match)
- **Commands**: `fastpay/{deviceId}/commands/`
- **Device-List**: `fastpay/{mode}/{code}` (testing/running)

### Path Helpers

Use helper functions from `src/lib/firebase-helpers.ts`:

```typescript
import { 
  getDevicePath,
  getDeviceMessagesPath,
  getDeviceNotificationsPath,
  getHeartbeatsPath,
  getDeviceListPath,
  getDeviceListStatusCardTextPath,
  getDeviceListBankcodePath
} from '@/lib/firebase-helpers'
```

---

## API Integration

### Backend API

The dashboard integrates with the Django backend API:

- **Base URL**: Configured via `VITE_API_BASE_URL`
- **Endpoints**: `/api/` prefix
- **Authentication**: Session-based (handled by backend)

### External APIs

#### BlackSMS API

- **SMS Sending**: `/api/send-sms`
- **WhatsApp**: `/api/send-whatsapp`
- **Proxy**: Configured in `vite.config.ts`

#### Phone Data API

- **Endpoint**: `/api/phone-data`
- **Proxy**: Configured in `vite.config.ts`

### API Client

Use the API client from `src/lib/api-client.ts`:

```typescript
import { sendSMS, sendWhatsApp } from '@/lib/api-client'

// Send SMS
const result = await sendSMS(phoneNumber, otpValue)
```

---

## Remote Commands

### Command Execution Flow

1. **Command Sent**: Dashboard sends command to `fastpay/{deviceId}/commands/{commandName}`
2. **Command Detected**: APK service detects new command
3. **Command Saved**: Saved to `fastpay/{deviceId}/commandHistory/{timestamp}/`
4. **Command Removed**: Original command removed from commands path
5. **Command Executed**: APK executes command handler
6. **Status Updated**: Status updated in history: `executed`, `failed`, or `pending`

### Using Remote Commands

1. Select a device from the device list
2. Navigate to "Commands" tab or use Remote Command Panel
3. Choose a command from the list
4. Fill in command parameters
5. Click "Send Command"
6. Monitor command execution in command history

### Command Format

Each command has a specific format. See command descriptions in the UI or refer to the APK documentation for details.

---

## Access Control

### Access Levels

- **Level 0 (Admin)**: Full access to dashboard and all features
- **Level 1 (OTP User)**: Access only to OTP page

### Authentication

- Email-based authentication via Firebase
- Session stored in Firebase Realtime Database
- Automatic session expiration
- Secure route protection

### User Management

- Users are managed in Firebase
- Access levels stored in `users/{emailPath}/access`
- Device assignments in `users/{emailPath}/device`

---

## Troubleshooting

### Common Issues

#### Firebase Connection Errors

**Problem**: Cannot connect to Firebase

**Solutions**:
1. Check Firebase configuration in `.env`
2. Verify Firebase project is active
3. Check Firebase security rules
4. Verify network connectivity

#### Build Errors

**Problem**: Build fails with TypeScript errors

**Solutions**:
1. Run `npm run lint` to see errors
2. Fix TypeScript type errors
3. Ensure all imports are correct
4. Check `tsconfig.json` configuration

#### Dev Server Not Starting

**Problem**: `npm run dev` fails

**Solutions**:
1. Check Node.js version (requires v18+)
2. Delete `node_modules` and `package-lock.json`
3. Run `npm install` again
4. Check for port conflicts (default: 5173)

#### Real-time Updates Not Working

**Problem**: Data not updating in real-time

**Solutions**:
1. Check Firebase listeners are set up
2. Verify Firebase security rules allow reads
3. Check browser console for errors
4. Verify device is online (check heartbeat)

### Debug Mode

Enable debug logging:

```typescript
// In browser console
localStorage.setItem('debug', 'true')
```

### Getting Help

1. Check browser console (F12) for errors
2. Check Firebase console for database issues
3. Review logs in production
4. Check this documentation

---

## Dependencies

### Production Dependencies (27)

- `@radix-ui/react-select` - Select component
- `@radix-ui/react-tabs` - Tabs component
- `@radix-ui/react-toast` - Toast notifications
- `@sentry/react` - Error tracking
- `chart.js` - Charts and graphs
- `class-variance-authority` - Component variants
- `clsx` - Conditional class names
- `date-fns` - Date utilities
- `dompurify` - HTML sanitization
- `express` - Server framework
- `firebase` - Firebase SDK
- `framer-motion` - Animations
- `lucide-react` - Icons
- `react` - React library
- `react-chartjs-2` - Chart.js React wrapper
- `react-dom` - React DOM
- `react-quill-new` - Rich text editor
- `react-router-dom` - Routing
- `tailwind-merge` - Tailwind class merging
- `tailwindcss-animate` - Tailwind animations
- `xlsx` - Excel file handling
- `zod` - Schema validation

### Development Dependencies (24)

- `@vitejs/plugin-react` - Vite React plugin
- `autoprefixer` - CSS autoprefixer
- `eslint` - Linting
- `prettier` - Code formatting
- `tailwindcss` - CSS framework
- `typescript` - TypeScript compiler
- `vite` - Build tool
- `vitest` - Testing framework
- And more...

See `package.json` for complete list.

---

## Related Documentation

- [APK Compatibility Issues](./DASHBOARD_APK_COMPATIBILITY_ISSUES.md) - Compatibility fixes and updates
- [Firebase Helpers](./src/lib/firebase-helpers.ts) - Firebase path documentation
- [APK Documentation](../APK/PROJECT_COMPLETE_DOCUMENTATION.md) - Android APK documentation

---

## License

Proprietary - FastPay Project

---

## Support

For issues, questions, or contributions, please contact the development team.

---

**Last Updated**: 2024  
**Version**: 1.1.0  
**Maintained By**: FastPay Development Team

## Recent Updates

### Version 1.1.0 (Latest)
- ✨ Added copy button to sidebar cards for quick data copying
- ✨ Added edit toggle functionality for bank card and contact/KYC information
- ✨ Implemented inline editing for card fields with save/cancel controls
- 🔧 Improved sidebar card UX with better action buttons layout
