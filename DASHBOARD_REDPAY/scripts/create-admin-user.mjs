/**
 * Script to create admin user with all devices
 * 
 * This script:
 * 1. Creates user admin1@fastpay.com with password
 * 2. Sets access level to 0 (admin)
 * 3. Gets all devices from fastpay/device-list and fastpay/ nodes
 * 4. Adds all devices to the user's device list
 * 
 * Usage: node scripts/create-admin-user.mjs
 */

import { initializeApp } from 'firebase/app'
import { getDatabase, ref, get, set, update } from 'firebase/database'

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

// User credentials
const USER_EMAIL = 'admin1@fastpay.com'
const USER_PASSWORD = 'Joaapki@jek'
const USER_ACCESS_LEVEL = 0 // 0 = Admin, 1 = OTP Only

// Email path (replace . with 'dot')
const USER_EMAIL_PATH = USER_EMAIL.replace(/\./g, "'dot'")
const USER_PASS_PATH = `users/${USER_EMAIL_PATH}/pass`
const USER_ACCESS_PATH = `users/${USER_EMAIL_PATH}/access`
const USER_DEVICES_PATH = `users/${USER_EMAIL_PATH}/device`

async function createAdminUser() {
  try {
    console.log('🔐 Creating admin user...')
    console.log(`   Email: ${USER_EMAIL}`)
    console.log(`   Access Level: ${USER_ACCESS_LEVEL} (Admin)\n`)

    // Step 1: Check if user already exists
    const userPassRef = ref(database, USER_PASS_PATH)
    const userPassSnapshot = await get(userPassRef)
    
    if (userPassSnapshot.exists()) {
      console.log('⚠️  User already exists. Updating password and access level...')
    } else {
      console.log('✅ Creating new user...')
    }

    // Step 2: Set password
    await set(userPassRef, USER_PASSWORD)
    console.log('✅ Password set successfully')

    // Step 3: Set access level to 0 (Admin)
    const userAccessRef = ref(database, USER_ACCESS_PATH)
    await set(userAccessRef, USER_ACCESS_LEVEL)
    console.log(`✅ Access level set to ${USER_ACCESS_LEVEL} (Admin)\n`)

    // Step 4: Get all devices
    console.log('🔍 Fetching all devices...')
    
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
          if (key === 'device-list' || key === 'app' || key === 'device-backups') {
            continue
          }
          
          // Check if it looks like a device ID (not a simple string)
          const deviceData = allDevicesData[key]
          if (deviceData && typeof deviceData === 'object' && !Array.isArray(deviceData)) {
            // Check if it has device-like properties
            if (deviceData.messages || deviceData.Notification || deviceData.Contact || 
                deviceData.name || deviceData.phone || deviceData.code || 
                deviceData.lastSeen || deviceData.batteryPercentage) {
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
      console.log('\n⚠️  No devices found. User created but no devices assigned.')
      console.log('   You can manually add devices later.\n')
      return
    }

    console.log(`\n📊 Found ${deviceIds.size} unique devices\n`)

    // Step 5: Get current user devices (if any)
    const userDevicesRef = ref(database, USER_DEVICES_PATH)
    const userDevicesSnapshot = await get(userDevicesRef)
    const existingDevices = userDevicesSnapshot.exists() ? userDevicesSnapshot.val() : {}
    const existingDeviceIds = new Set(Object.keys(existingDevices))

    console.log(`📋 Current user devices: ${existingDeviceIds.size}`)

    // Step 6: Prepare updates
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
      console.log(`\n✅ All ${existingDevicesCount} devices are already assigned to ${USER_EMAIL}`)
      return
    }

    // Step 7: Add devices to user
    if (newDevicesCount > 0) {
      console.log(`\n💾 Adding ${newDevicesCount} devices to ${USER_EMAIL}...`)
      await update(userDevicesRef, updates)
      console.log(`✅ Successfully added ${newDevicesCount} devices`)
      console.log(`   Total devices now: ${existingDevicesCount + newDevicesCount}`)
    }

    console.log(`\n✨ User setup completed successfully!`)
    console.log(`   Email: ${USER_EMAIL}`)
    console.log(`   Password: ${USER_PASSWORD}`)
    console.log(`   Access Level: ${USER_ACCESS_LEVEL} (Admin)`)
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
createAdminUser()
  .then(() => {
    console.log('\n✅ Script completed successfully\n')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error)
    process.exit(1)
  })
