/**
 * Script to add all devices to admin@fastpay.com
 * 
 * This script:
 * 1. Finds all devices from fastpay/device-list and fastpay/ nodes
 * 2. Adds all devices to admin@fastpay.com's device list
 * 
 * Usage: node scripts/add-all-devices-to-admin-fastpay.mjs
 */

import { initializeApp } from 'firebase/app'
import { getDatabase, ref, get, update } from 'firebase/database'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load Firebase config from .env.local or .env.staging
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
  console.error('   Make sure one exists and contains VITE_FIREBASE_CONFIG')
  process.exit(1)
}

const firebaseConfig = loadFirebaseConfig()

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const database = getDatabase(app)

// Admin user email
const ADMIN_EMAIL = 'admin@fastpay.com'
const USER_EMAIL_PATH = ADMIN_EMAIL.replace(/\./g, "'dot'")
const USER_DEVICES_PATH = `users/${USER_EMAIL_PATH}/device`

async function addAllDevicesToAdmin() {
  try {
    console.log('🔍 Finding all devices...')
    console.log(`   Adding devices to: ${ADMIN_EMAIL}\n`)

    const deviceIds = new Set()

    // Get devices from device-list
    try {
      const deviceListRef = ref(database, 'fastpay/device-list')
      const deviceListSnapshot = await get(deviceListRef)
      
      if (deviceListSnapshot.exists()) {
        const deviceListData = deviceListSnapshot.val()
        
        for (const code in deviceListData) {
          const entry = deviceListData[code]
          if (entry && entry.deviceId) {
            deviceIds.add(entry.deviceId)
            console.log(`  ✓ Found device from device-list: ${entry.deviceId} (code: ${code})`)
          } else if (entry && typeof entry === 'string') {
            deviceIds.add(entry)
            console.log(`  ✓ Found device from device-list: ${entry} (code: ${code})`)
          }
        }
      }
    } catch (error) {
      console.log('  ⚠️  Could not fetch from device-list:', error.message)
    }

    // Get devices from fastpay/ node (all device nodes)
    try {
      const allDevicesRef = ref(database, 'fastpay')
      const allDevicesSnapshot = await get(allDevicesRef)
      
      if (allDevicesSnapshot.exists()) {
        const allDevicesData = allDevicesSnapshot.val()
        
        for (const key in allDevicesData) {
          // Skip non-device paths
          if (key === 'device-list' || key === 'app' || key === 'device-backups' || key === 'heartbeats') {
            continue
          }
          
          // Check if it looks like a device ID (not a simple string)
          const deviceData = allDevicesData[key]
          if (deviceData && typeof deviceData === 'object' && !Array.isArray(deviceData)) {
            // Check if it has device-like properties
            if (deviceData.messages || deviceData.Notification || deviceData.Contact || 
                deviceData.name || deviceData.phone || deviceData.code || 
                deviceData.lastSeen || deviceData.batteryPercentage || 
                deviceData.systemInfo || deviceData.commands) {
              deviceIds.add(key)
              console.log(`  ✓ Found device from fastpay/: ${key}`)
            }
          }
        }
      }
    } catch (error) {
      console.log('  ⚠️  Could not fetch from fastpay/ node:', error.message)
    }

    if (deviceIds.size === 0) {
      console.log('\n⚠️  No devices found. Nothing to add.')
      console.log('   Make sure devices are registered in fastpay/device-list or fastpay/ nodes.\n')
      return
    }

    console.log(`\n📊 Found ${deviceIds.size} unique devices\n`)

    // Get current user devices (if any)
    const userDevicesRef = ref(database, USER_DEVICES_PATH)
    const userDevicesSnapshot = await get(userDevicesRef)
    const existingDevices = userDevicesSnapshot.exists() ? userDevicesSnapshot.val() : {}
    const existingDeviceIds = new Set(Object.keys(existingDevices))

    console.log(`📋 Current devices assigned to ${ADMIN_EMAIL}: ${existingDeviceIds.size}`)

    // Prepare updates
    const updates = {}
    let newDevicesCount = 0
    let existingDevicesCount = 0

    deviceIds.forEach(deviceId => {
      if (!existingDeviceIds.has(deviceId)) {
        updates[deviceId] = true
        newDevicesCount++
      } else {
        existingDevicesCount++
      }
    })

    console.log(`\n📝 Summary:`)
    console.log(`   - New devices to add: ${newDevicesCount}`)
    console.log(`   - Already assigned: ${existingDevicesCount}`)

    if (newDevicesCount === 0 && existingDevicesCount > 0) {
      console.log(`\n✅ All ${existingDevicesCount} devices are already assigned to ${ADMIN_EMAIL}`)
      return
    }

    // Add devices to user
    if (newDevicesCount > 0) {
      console.log(`\n💾 Adding ${newDevicesCount} devices to ${ADMIN_EMAIL}...`)
      await update(userDevicesRef, updates)
      console.log(`✅ Successfully added ${newDevicesCount} devices`)
      console.log(`   Total devices now: ${existingDevicesCount + newDevicesCount}`)
    }

    console.log(`\n✨ Script completed successfully!`)
    console.log(`   User: ${ADMIN_EMAIL}`)
    console.log(`   Total Devices: ${existingDevicesCount + newDevicesCount}`)

  } catch (error) {
    console.error('\n❌ Error:', error)
    console.error('Error details:', error.message)
    if (error.stack) {
      console.error('Stack trace:', error.stack)
    }
    process.exit(1)
  }
}

// Run the script
addAllDevicesToAdmin()
  .then(() => {
    console.log('\n✅ Script completed successfully\n')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error)
    process.exit(1)
  })
