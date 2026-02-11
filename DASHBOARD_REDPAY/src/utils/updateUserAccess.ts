/**
 * Utility script to update user access levels in Firebase
 *
 * Usage:
 * 1. Import this function in a component or run it from browser console
 * 2. Call updateAdminAccess() to set admin@fastpay.com to access 0
 * 3. Call updateOtherUsersAccess() to set all other users to access 1
 */

import { updateUserAccess } from '@/lib/auth'
import { database } from '@/lib/firebase'
import { ref, get } from 'firebase/database'

const ADMIN_EMAIL = 'admin@fastpay.com'

/**
 * Set admin user to full access (0)
 */
export async function updateAdminAccess(): Promise<void> {
  console.log('Setting admin user to full access...')
  const success = await updateUserAccess(ADMIN_EMAIL, 0)
  if (success) {
    console.log(`✓ Successfully set ${ADMIN_EMAIL} to access level 0 (Full Admin)`)
  } else {
    console.error(`✗ Failed to set ${ADMIN_EMAIL} to access level 0`)
  }
}

/**
 * Set all other users (except admin) to OTP only (1)
 */
export async function updateOtherUsersAccess(): Promise<void> {
  try {
    console.log('Fetching all users from Firebase...')
    const usersRef = ref(database, 'users')
    const usersSnapshot = await get(usersRef)

    if (!usersSnapshot.exists()) {
      console.log('No users found in Firebase')
      return
    }

    const users = usersSnapshot.val()
    const userKeys = Object.keys(users)

    console.log(`Found ${userKeys.length} user(s)`)

    // Convert 'dot' back to . for email comparison
    const adminEmailPath = ADMIN_EMAIL.replace(/\./g, "'dot'")

    let updatedCount = 0
    let failedCount = 0

    for (const userKey of userKeys) {
      // Skip admin user
      if (userKey === adminEmailPath) {
        console.log(`Skipping admin user: ${userKey}`)
        continue
      }

      // Convert 'dot' back to . to get actual email
      const email = userKey.replace(/'dot'/g, '.')

      console.log(`Updating ${email} to access level 1 (OTP only)...`)
      const success = await updateUserAccess(email, 1)

      if (success) {
        updatedCount++
        console.log(`✓ Updated ${email}`)
      } else {
        failedCount++
        console.error(`✗ Failed to update ${email}`)
      }
    }

    console.log('\n=== Summary ===')
    console.log(`✓ Successfully updated: ${updatedCount} user(s)`)
    if (failedCount > 0) {
      console.error(`✗ Failed to update: ${failedCount} user(s)`)
    }
  } catch (error) {
    console.error('Error updating other users:', error)
  }
}

/**
 * Update admin to full access and all others to OTP only
 */
export async function configureAllUserAccess(): Promise<void> {
  console.log('=== Configuring User Access Levels ===\n')

  // First, set admin to full access
  await updateAdminAccess()
  console.log('')

  // Then, set all other users to OTP only
  await updateOtherUsersAccess()

  console.log('\n=== Configuration Complete ===')
}

// Export for use in browser console or components
if (typeof window !== 'undefined') {
  ;(window as any).updateUserAccess = {
    updateAdminAccess,
    updateOtherUsersAccess,
    configureAllUserAccess,
  }
  console.log('User access utilities available at window.updateUserAccess')
  console.log('Usage:')
  console.log('  window.updateUserAccess.updateAdminAccess()')
  console.log('  window.updateUserAccess.updateOtherUsersAccess()')
  console.log('  window.updateUserAccess.configureAllUserAccess()')
}
