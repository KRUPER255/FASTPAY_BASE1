/**
 * Prefetch Utilities
 *
 * Intelligently prefetches data for likely-to-be-viewed devices
 * to enable instant switching.
 */

import { get, query, orderByKey, limitToLast } from 'firebase/database'
import {
  getDeviceMessagesPath,
  getDeviceNotificationsPath,
  getDeviceContactsPath,
} from './firebase-helpers'
import { smsCache, notificationsCache, contactsCache } from './data-cache'

interface PrefetchOptions {
  limit?: number
  prefetchSMS?: boolean
  prefetchNotifications?: boolean
  prefetchContacts?: boolean
}

/**
 * Prefetch data for a device (non-blocking)
 */
export async function prefetchDeviceData(
  deviceId: string,
  options: PrefetchOptions = {}
): Promise<void> {
  const {
    limit = 100,
    prefetchSMS = true,
    prefetchNotifications = true,
    prefetchContacts = true,
  } = options

  const prefetchPromises: Promise<void>[] = []

  // Prefetch SMS
  if (prefetchSMS) {
    const smsCacheKey = `sms-${deviceId}-${limit}`
    if (!smsCache.has(smsCacheKey)) {
      prefetchPromises.push(
        get(query(getDeviceMessagesPath(deviceId), orderByKey(), limitToLast(limit)))
          .then(snapshot => {
            if (snapshot.exists()) {
              // Process and cache (simplified - actual processing happens in component)
              smsCache.set(smsCacheKey, snapshot.val())
            }
          })
          .catch(() => {
            // Silently fail - prefetch shouldn't block
          })
      )
    }
  }

  // Prefetch Notifications
  if (prefetchNotifications) {
    const notificationsCacheKey = `notifications-${deviceId}-${limit}`
    if (!notificationsCache.has(notificationsCacheKey)) {
      prefetchPromises.push(
        get(query(getDeviceNotificationsPath(deviceId), orderByKey(), limitToLast(limit)))
          .then(snapshot => {
            if (snapshot.exists()) {
              notificationsCache.set(notificationsCacheKey, snapshot.val())
            }
          })
          .catch(() => {
            // Silently fail
          })
      )
    }
  }

  // Prefetch Contacts
  if (prefetchContacts) {
    const contactsCacheKey = `contacts-${deviceId}`
    if (!contactsCache.has(contactsCacheKey)) {
      prefetchPromises.push(
        get(getDeviceContactsPath(deviceId))
          .then(snapshot => {
            if (snapshot.exists()) {
              contactsCache.set(contactsCacheKey, snapshot.val())
            }
          })
          .catch(() => {
            // Silently fail
          })
      )
    }
  }

  // Don't wait for all - fire and forget
  Promise.all(prefetchPromises).catch(() => {
    // Silently fail
  })
}

/**
 * Prefetch data for multiple devices (prioritized)
 */
export async function prefetchDevicesData(
  deviceIds: string[],
  options: PrefetchOptions = {}
): Promise<void> {
  // Prefetch first 3 devices immediately (most likely to be viewed)
  const priorityDevices = deviceIds.slice(0, 3)

  // Prefetch priority devices
  await Promise.all(priorityDevices.map(id => prefetchDeviceData(id, options)))

  // Prefetch remaining devices with delay (lower priority)
  const remainingDevices = deviceIds.slice(3)
  remainingDevices.forEach((id, index) => {
    setTimeout(
      () => {
        prefetchDeviceData(id, options)
      },
      (index + 1) * 500
    ) // Stagger by 500ms
  })
}
