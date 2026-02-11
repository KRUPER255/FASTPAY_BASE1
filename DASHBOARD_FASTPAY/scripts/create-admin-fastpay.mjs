/**
 * Script to create admin user: admin@fastpay.com
 * 
 * This script:
 * 1. Creates user admin@fastpay.com with password admin123
 * 2. Sets access level to 0 (admin)
 * 
 * Usage: node scripts/create-admin-fastpay.mjs
 */

import { initializeApp } from 'firebase/app'
import { getDatabase, ref, get, set } from 'firebase/database'
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

// User credentials
const USER_EMAIL = 'admin@fastpay.com'
const USER_PASSWORD = 'admin123'
const USER_ACCESS_LEVEL = 0 // 0 = Admin, 1 = OTP Only

// Email path (replace . with 'dot')
const USER_EMAIL_PATH = USER_EMAIL.replace(/\./g, "'dot'")
const USER_PASS_PATH = `users/${USER_EMAIL_PATH}/pass`
const USER_ACCESS_PATH = `users/${USER_EMAIL_PATH}/access`

async function createAdminUser() {
  try {
    console.log('🔐 Creating admin user...')
    console.log(`   Email: ${USER_EMAIL}`)
    console.log(`   Password: ${USER_PASSWORD}`)
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

    console.log(`\n✨ User setup completed successfully!`)
    console.log(`   Email: ${USER_EMAIL}`)
    console.log(`   Password: ${USER_PASSWORD}`)
    console.log(`   Access Level: ${USER_ACCESS_LEVEL} (Admin)`)
    console.log(`\n   You can now login at http://localhost:5173/`)

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
