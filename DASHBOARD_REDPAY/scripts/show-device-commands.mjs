/**
 * Show which remote commands exist for a device in Firebase:
 * - fastpay/{deviceId}/commands       (pending – written by dashboard, cleared by APK after run)
 * - fastpay/{deviceId}/commandHistory  (executed – written by APK when it runs a command)
 *
 * Usage: node scripts/show-device-commands.mjs [deviceId]
 * Default deviceId: 71e4fa3e11e00c68
 */

import { initializeApp } from 'firebase/app'
import { getDatabase, ref, get } from 'firebase/database'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const DEFAULT_DEVICE_ID = '71e4fa3e11e00c68'

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
  process.exit(1)
}

const firebaseConfig = loadFirebaseConfig()
const app = initializeApp(firebaseConfig)
const database = getDatabase(app)

async function showDeviceCommands(deviceId) {
  console.log(`\n📱 Device: ${deviceId}\n`)

  const commandsRef = ref(database, `fastpay/${deviceId}/commands`)
  const historyRef = ref(database, `fastpay/${deviceId}/commandHistory`)

  const [commandsSnap, historySnap] = await Promise.all([
    get(commandsRef),
    get(historyRef),
  ])

  console.log('--- fastpay/{deviceId}/commands (pending – dashboard writes, APK clears after run) ---')
  if (!commandsSnap.exists()) {
    console.log('  (empty or missing)\n')
  } else {
    const commands = commandsSnap.val()
    if (typeof commands !== 'object') {
      console.log('  ', commands, '\n')
    } else {
      const keys = Object.keys(commands)
      if (keys.length === 0) {
        console.log('  (empty object)\n')
      } else {
        for (const key of keys) {
          console.log(`  ${key}: ${JSON.stringify(commands[key])}`)
        }
        console.log('')
      }
    }
  }

  console.log('--- fastpay/{deviceId}/commandHistory (executed – APK writes when it runs a command) ---')
  if (!historySnap.exists()) {
    console.log('  (empty or missing)\n')
    console.log('If remote commands work but this is empty, APK v29 may not be writing to commandHistory.')
    console.log('Check Dashboard → Device → Command tab for history, or APK logs.\n')
    return
  }

  const history = historySnap.val()
  if (typeof history !== 'object') {
    console.log('  ', history, '\n')
    return
  }

  const entries = []
  Object.keys(history).forEach(ts => {
    const group = history[ts]
    if (group && typeof group === 'object') {
      Object.keys(group).forEach(cmdKey => {
        const e = group[cmdKey]
        if (e && typeof e === 'object') {
          entries.push({
            command: e.command ?? cmdKey,
            value: e.value ?? '',
            timestamp: e.timestamp ?? parseInt(ts, 10),
            status: e.status ?? '?',
            error: e.error,
          })
        }
      })
    }
  })

  entries.sort((a, b) => b.timestamp - a.timestamp)
  const show = entries.slice(0, 20)

  if (show.length === 0) {
    console.log('  (no entries with expected shape)\n')
    console.log('Raw keys at commandHistory:', Object.keys(history).slice(0, 5).join(', '), '\n')
    return
  }

  for (const e of show) {
    const time = new Date(e.timestamp).toISOString()
    const err = e.error ? `  error: ${e.error}` : ''
    console.log(`  ${time}  ${e.command}  value="${String(e.value).slice(0, 40)}..."  status=${e.status}${err}`)
  }
  if (entries.length > 20) {
    console.log(`  ... and ${entries.length - 20} more`)
  }
  console.log('')
}

const deviceId = process.argv[2] || DEFAULT_DEVICE_ID

showDeviceCommands(deviceId)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error:', err.message)
    process.exit(1)
  })
