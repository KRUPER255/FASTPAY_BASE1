/**
 * Ensure fastpay/{deviceId}/commands exists in Firebase.
 * Sets the path to {} if missing so the commands node is present.
 *
 * Usage: node scripts/add-device-commands-path.mjs [deviceId]
 * Default deviceId: 71e4fa3e11e00c68
 */

import { initializeApp } from 'firebase/app'
import { getDatabase, ref, set } from 'firebase/database'
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
  console.error('   Ensure DASHBOARD/.env.local or DASHBOARD/.env.staging exists and contains VITE_FIREBASE_CONFIG')
  process.exit(1)
}

const firebaseConfig = loadFirebaseConfig()
const app = initializeApp(firebaseConfig)
const database = getDatabase(app)

async function addCommandsPath(deviceId) {
  const path = `fastpay/${deviceId}/commands`
  const commandsRef = ref(database, path)

  console.log(`📤 Adding Firebase path: ${path}`)
  await set(commandsRef, {})
  console.log(`✅ Path added: ${path}`)
}

const deviceId = process.argv[2] || DEFAULT_DEVICE_ID

addCommandsPath(deviceId)
  .then(() => {
    console.log('✨ Done\n')
    process.exit(0)
  })
  .catch((err) => {
    console.error('❌ Error:', err.message)
    process.exit(1)
  })
