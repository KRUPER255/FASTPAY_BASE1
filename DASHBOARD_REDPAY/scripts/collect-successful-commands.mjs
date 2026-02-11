/**
 * Check Firebase for all devices, read commandHistory for each,
 * and collect all successfully executed commands into a list.
 *
 * Success = status is 'executed' or 'success'.
 * Output: JSON file + console summary. Optionally CSV.
 *
 * Usage: node scripts/collect-successful-commands.mjs [--json out.json] [--csv out.csv]
 */

import { initializeApp } from 'firebase/app'
import { getDatabase, ref, get } from 'firebase/database'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

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

const SUCCESS_STATUSES = ['executed', 'success']

async function getAllDeviceIds() {
  const deviceIds = new Set()

  try {
    const deviceListRef = ref(database, 'fastpay/device-list')
    const deviceListSnapshot = await get(deviceListRef)
    if (deviceListSnapshot.exists()) {
      const data = deviceListSnapshot.val()
      for (const code in data) {
        const entry = data[code]
        if (entry && entry.deviceId) deviceIds.add(entry.deviceId)
        else if (entry && typeof entry === 'string') deviceIds.add(entry)
      }
    }
  } catch (e) {
    console.warn('  ⚠️ device-list:', e.message)
  }

  try {
    const fastpayRef = ref(database, 'fastpay')
    const fastpaySnapshot = await get(fastpayRef)
    if (fastpaySnapshot.exists()) {
      const data = fastpaySnapshot.val()
      const skip = new Set(['device-list', 'app', 'device-backups', 'heartbeats'])
      for (const key in data) {
        if (skip.has(key)) continue
        const node = data[key]
        if (node && typeof node === 'object' && !Array.isArray(node)) {
          if (
            node.messages != null || node.Notification != null || node.Contact != null ||
            node.name != null || node.phone != null || node.code != null ||
            node.lastSeen != null || node.batteryPercentage != null ||
            node.systemInfo != null || node.commands != null || node.commandHistory != null
          ) {
            deviceIds.add(key)
          }
        }
      }
    }
  } catch (e) {
    console.warn('  ⚠️ fastpay/ nodes:', e.message)
  }

  return Array.from(deviceIds)
}

function parseCommandHistory(deviceId, history) {
  const entries = []
  if (!history || typeof history !== 'object') return entries

  Object.keys(history).forEach(ts => {
    const group = history[ts]
    if (group && typeof group === 'object') {
      Object.keys(group).forEach(cmdKey => {
        const e = group[cmdKey]
        if (e && typeof e === 'object') {
          const status = (e.status || '?').toLowerCase()
          if (SUCCESS_STATUSES.includes(status)) {
            entries.push({
              deviceId,
              command: e.command ?? cmdKey,
              value: e.value != null ? String(e.value) : '',
              timestamp: e.timestamp ?? parseInt(ts, 10),
              status: e.status ?? 'executed',
              receivedAt: e.receivedAt,
              executedAt: e.executedAt,
              error: e.error,
            })
          }
        }
      })
    }
  })
  return entries
}

async function getDeviceVersion(deviceId) {
  try {
    const fastpayDeviceRef = ref(database, `fastpay/${deviceId}`)
    const snap = await get(fastpayDeviceRef)
    if (snap.exists()) {
      const d = snap.val()
      if (d && typeof d === 'object' && (d.version != null || d.versionCode != null || d.versionName != null)) {
        return d.version ?? d.versionName ?? d.versionCode ?? null
      }
    }
    const deviceMetaRef = ref(database, `device/${deviceId}`)
    const metaSnap = await get(deviceMetaRef)
    if (metaSnap.exists()) {
      const d = metaSnap.val()
      if (d && typeof d === 'object') return d.version ?? d.versionName ?? d.versionCode ?? null
    }
  } catch (_) {}
  return null
}

async function run() {
  console.log('🔍 Fetching all device IDs from Firebase...')
  const deviceIds = await getAllDeviceIds()
  console.log(`   Found ${deviceIds.length} devices.\n`)

  const allSuccess = []
  let historyMissing = 0
  let historyEmpty = 0

  for (const deviceId of deviceIds) {
    const historyRef = ref(database, `fastpay/${deviceId}/commandHistory`)
    const historySnap = await get(historyRef)

    if (!historySnap.exists()) {
      historyMissing++
      continue
    }

    const history = historySnap.val()
    const entries = parseCommandHistory(deviceId, history)
    if (entries.length === 0) {
      historyEmpty++
      continue
    }

    let version = null
    try {
      version = await getDeviceVersion(deviceId)
    } catch (_) {}

    for (const e of entries) {
      allSuccess.push({
        ...e,
        version: version ?? undefined,
      })
    }
  }

  allSuccess.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))

  console.log('--- Summary ---')
  console.log(`   Devices with commandHistory: ${deviceIds.length - historyMissing}`)
  console.log(`   Devices with no commandHistory: ${historyMissing}`)
  console.log(`   Devices with history but no successful entries: ${historyEmpty}`)
  console.log(`   Total successful command runs collected: ${allSuccess.length}\n`)

  if (allSuccess.length === 0) {
    console.log('No successful command history found. APKs may not be writing to commandHistory, or no commands have been executed yet.')
    return { list: [], deviceIds, summary: { total: 0, devicesWithHistory: deviceIds.length - historyMissing, historyMissing, historyEmpty } }
  }

  console.log('--- List (successful runs, newest first) ---')
  const display = allSuccess.slice(0, 100)
  for (const e of display) {
    const time = e.timestamp ? new Date(e.timestamp).toLocaleString() : '?'
    const ver = e.version ? `  version=${e.version}` : ''
    console.log(`${time}  ${e.deviceId}  ${e.command}  value="${String(e.value).slice(0, 50)}${e.value.length > 50 ? '…' : ''}"  ${e.status}${ver}`)
  }
  if (allSuccess.length > 100) {
    console.log(`... and ${allSuccess.length - 100} more`)
  }

  const outDir = join(__dirname, '..')
  const jsonPath = join(outDir, 'successful-commands-list.json')
  writeFileSync(jsonPath, JSON.stringify({ collectedAt: new Date().toISOString(), deviceCount: deviceIds.length, totalSuccess: allSuccess.length, list: allSuccess }, null, 2), 'utf-8')
  console.log(`\n✅ Full list written to: ${jsonPath}`)

  const csvPath = join(outDir, 'successful-commands-list.csv')
  const header = 'deviceId,command,value,timestamp,status,version,receivedAt,executedAt,error\n'
  const rows = allSuccess.map(e =>
    [e.deviceId, e.command, `"${String(e.value || '').replace(/"/g, '""')}"`, e.timestamp ?? '', e.status ?? '', e.version ?? '', e.receivedAt ?? '', e.executedAt ?? '', (e.error || '').replace(/"/g, '""')].join(',')
  )
  writeFileSync(csvPath, header + rows.join('\n'), 'utf-8')
  console.log(`✅ CSV written to: ${csvPath}`)

  return { list: allSuccess, deviceIds, summary: { total: allSuccess.length, devicesWithHistory: deviceIds.length - historyMissing, historyMissing, historyEmpty } }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error:', err)
    process.exit(1)
  })
