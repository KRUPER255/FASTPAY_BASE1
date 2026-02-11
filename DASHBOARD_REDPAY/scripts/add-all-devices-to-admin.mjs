/**
 * Script to add all devices from device-list to admin@fastpay.com
 * 
 * This script:
 * 1. Reads all entries from fastpay/device-list
 * 2. Extracts all deviceId values
 * 3. Adds them to users/admin'dot'fastpay'dot'com/device
 * 
 * Usage: node scripts/add-all-devices-to-admin.mjs
 *        or: npm run add-all-devices-to-admin
 */

import { initializeApp } from 'firebase/app'
import { getDatabase, ref, get, update } from 'firebase/database'

const firebaseConfig = {
  apiKey: "AIzaSyC_h65HBhHJoJ_nxjUv4-J8CwaCfo90LCA",
  authDomain: "cb-owner-app.firebaseapp.com",
  databaseURL: "https://cb-owner-app-default-rtdb.firebaseio.com",
  projectId: "cb-owner-app",
  storageBucket: "cb-owner-app.firebasestorage.app",
  messagingSenderId: "421915239878",
  appId: "1:421915239878:web:7f8fe0ca4a952978d9fec7"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const database = getDatabase(app)

// Admin email path (replace . with 'dot')
const ADMIN_EMAIL = 'admin1@fastpay.com'
const ADMIN_EMAIL_PATH = ADMIN_EMAIL.replace(/\./g, "'dot'")
const ADMIN_DEVICES_PATH = `users/${ADMIN_EMAIL_PATH}/device`

async function addAllDevicesToAdmin() {
  try {
    console.log('🔍 Fetching all devices from device-list...')
    
    // Get all device-list entries
    const deviceListRef = ref(database, 'fastpay/device-list')
    const deviceListSnapshot = await get(deviceListRef)
    
    if (!deviceListSnapshot.exists()) {
      console.log('❌ No device-list entries found')
      return
    }
    
    const deviceListData = deviceListSnapshot.val()
    const deviceIds = new Set()
    
    // Extract all deviceIds from device-list
    for (const code in deviceListData) {
      const entry = deviceListData[code]
      if (entry && entry.deviceId) {
        deviceIds.add(entry.deviceId)
        console.log(`  ✓ Found device: ${entry.deviceId} (code: ${code})`)
      } else if (entry && typeof entry === 'string') {
        // Some entries might have deviceId as direct value
        deviceIds.add(entry)
        console.log(`  ✓ Found device: ${entry} (code: ${code})`)
      }
    }
    
    if (deviceIds.size === 0) {
      console.log('❌ No deviceIds found in device-list')
      return
    }
    
    console.log(`\n📊 Found ${deviceIds.size} unique devices`)
    
    // Get current admin devices to avoid overwriting
    const adminDevicesRef = ref(database, ADMIN_DEVICES_PATH)
    const adminDevicesSnapshot = await get(adminDevicesRef)
    const existingDevices = adminDevicesSnapshot.exists() ? adminDevicesSnapshot.val() : {}
    const existingDeviceIds = new Set(Object.keys(existingDevices))
    
    console.log(`\n📋 Current admin devices: ${existingDeviceIds.size}`)
    
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
    
    if (newDevicesCount === 0) {
      console.log('\n✅ All devices are already assigned to admin@fastpay.com')
      return
    }
    
    // Write updates
    console.log(`\n💾 Adding ${newDevicesCount} devices to admin@fastpay.com...`)
    
    // Use update to merge with existing devices
    await update(adminDevicesRef, updates)
    
    console.log(`\n✅ Successfully added ${newDevicesCount} devices to admin@fastpay.com`)
    console.log(`   Total devices now: ${existingDevicesCount + newDevicesCount}`)
    
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

// Run the script
addAllDevicesToAdmin()
  .then(() => {
    console.log('\n✨ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error)
    process.exit(1)
  })
