# Validation Module

This module provides type-safe validation using Zod for all user inputs in the FastPay application.

## Structure

```
validation/
├── index.ts                 # Main export file
├── common-validation.ts     # Shared validation schemas
├── sms-validation.ts        # SMS/WhatsApp validation
├── auth-validation.ts       # Authentication validation
└── command-validation.ts    # Remote command validation
```

## Usage

### SMS Validation

```typescript
import { validateSmsInput, sendSmsSchema } from '@/lib/validation'

// Validate SMS input
const result = validateSmsInput({
  phoneNumber: '+1234567890',
  otpValue: '123456',
  senderId: '47',
})

if (result.success) {
  // Use result.data
} else {
  // Handle result.error
}

// Or use schema directly
const data = sendSmsSchema.parse(userInput)
```

### Authentication Validation

```typescript
import { validateLoginInput, loginSchema } from '@/lib/validation'

const result = validateLoginInput({
  email: 'user@example.com',
  password: 'password123',
})
```

### Command Validation

```typescript
import { validateRemoteCommand } from '@/lib/validation'

const result = validateRemoteCommand({
  command: 'sendSms',
  deviceId: 'device123',
  params: { phone: '+1234567890', message: 'Hello' },
})
```

## Available Schemas

### Common

- `emailSchema` - Email validation
- `phoneNumberSchema` - Phone number (international format)
- `otpSchema` - OTP code (4-8 digits)
- `deviceIdSchema` - Device identifier
- `activationCodeSchema` - Activation code

### SMS

- `sendSmsSchema` - Send SMS input
- `sendWhatsAppSchema` - Send WhatsApp input
- `bulkSmsSchema` - Bulk SMS input

### Auth

- `loginSchema` - Login credentials
- `passwordSchema` - Password with strength requirements
- `accessLevelSchema` - User access level (0 or 1)

### Commands

- `remoteCommandSchema` - Remote command input
- `bulkCommandSchema` - Bulk command input
- Command param validators for specific commands

## Error Handling

All validation functions return:

```typescript
{
  success: boolean
  data?: T        // Validated data (if success)
  error?: string  // Error message (if failed)
}
```

Zod errors are automatically formatted into readable messages.
