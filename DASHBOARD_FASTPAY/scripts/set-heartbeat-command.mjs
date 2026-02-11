/**
 * Set Firebase command: Heartbeat interval for a device.
 *
 * Writes to: fastpay/{deviceId}/commands/setHeartbeatInterval = interval in seconds.
 * The APK reads this and applies the heartbeat interval.
 *
 * Usage: node scripts/set-heartbeat-command.mjs [deviceId] [seconds]
 * Default: deviceId=71e4fa3e11e00c68, seconds=12
 *
 * Example: node scripts/set-heartbeat-command.mjs 71e4fa3e11e00c68 12
 */

import { initializeApp } from 'firebase/app'
import { getDatabase, ref, set } from 'firebase/database'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const DEFAULT_DEVICE_ID = '71e4fa3e11e00c68'
const DEFAULT_INTERVAL_SECONDS = 12

function loadFirebaseConfig() {
  const envFiles = ['.env.local', '.env.staging']
  for (const envFile of envFiles) {
    try {
      const envPath = join(__dirname, '..', envFile)
      const envContent = readFileSync(envPath, 'utf-8')
      const match = envContent.match(/VITE_FIREBASE_CONFIG=({.+})/)

      if (match && match[1]) {
        return JSON.parse(match[1])
      }
    } catch (_) {
      continue
    }
  }
  console.error('❌ VITE_FIREBASE_CONFIG not found in .env.local or .env.staging')
  console.error('   Ensure DASHBOARD/.env.local or DASHBOARD/.env.staging exists and contains VITE_FIREBASE_CONFIG')
  process.exit(1)
}

const firebaseConfig = loadFirebaseConfig()
const app = initializeApp(firebaseConfig)
const database = getDatabase(app)

async function setHeartbeatCommand(deviceId, intervalSeconds) {
  const path = `fastpay/${deviceId}/commands/setHeartbeatInterval`
  const commandRef = ref(database, path)
  const value = String(intervalSeconds)

  console.log(`📤 Writing Firebase command: ${path} = ${value}`)
  await set(commandRef, value)
  console.log(`✅ Heartbeat interval set to ${intervalSeconds} seconds for device ${deviceId}`)
}

const deviceId = process.argv[2] || DEFAULT_DEVICE_ID
const intervalSeconds = parseInt(process.argv[3], 10) || DEFAULT_INTERVAL_SECONDS

if (intervalSeconds < 10 || intervalSeconds > 300) {
  console.error('❌ Interval must be between 10 and 300 seconds')
  process.exit(1)
}

setHeartbeatCommand(deviceId, intervalSeconds)
  .then(() => {
    console.log('✨ Done\n')
    process.exit(0)
  })
  .catch((err) => {
    console.error('❌ Error:', err.message)
    process.exit(1)
  })
