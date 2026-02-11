import { useMemo, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/component/ui/tabs'
import PermissionManager from './PermissionManager'
import type { PermissionInfo } from '@/lib/permission-helpers'
import { Shield, CheckCircle2, XCircle, List } from 'lucide-react'
import { Badge } from '@/component/ui/badge'

interface PermissionManagerWithTabsProps {
  deviceId: string | null
}

export default function PermissionManagerWithTabs({ deviceId }: PermissionManagerWithTabsProps) {
  const [permissionInfo, setPermissionInfo] = useState<PermissionInfo[]>([])
  const [activeTab, setActiveTab] = useState<'all' | 'granted' | 'denied'>('all')

  // Calculate counts
  const grantedCount = permissionInfo.filter(p => p.isGranted).length
  const deniedCount = permissionInfo.filter(p => !p.isGranted).length
  const totalCount = permissionInfo.length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Permissions
          </h2>
          <p className="text-sm text-muted-foreground mt-1">View and manage device permissions</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={value => setActiveTab(value as 'all' | 'granted' | 'denied')}
        className="w-full"
      >
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="all" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            All
            <Badge variant="secondary" className="ml-1">
              {totalCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="granted" className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Granted
            <Badge variant="secondary" className="ml-1 bg-green-500/20 text-green-600">
              {grantedCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="denied" className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Denied
            <Badge variant="secondary" className="ml-1 bg-red-500/20 text-red-600">
              {deniedCount}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <PermissionManager
            deviceId={deviceId}
            onPermissionInfoChange={setPermissionInfo}
            filterMode="all"
          />
        </TabsContent>

        <TabsContent value="granted" className="mt-6">
          <PermissionManager
            deviceId={deviceId}
            onPermissionInfoChange={setPermissionInfo}
            filterMode="granted"
          />
        </TabsContent>

        <TabsContent value="denied" className="mt-6">
          <PermissionManager
            deviceId={deviceId}
            onPermissionInfoChange={setPermissionInfo}
            filterMode="denied"
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
