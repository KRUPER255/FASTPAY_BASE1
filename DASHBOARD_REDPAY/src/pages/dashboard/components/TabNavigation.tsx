import { Button } from '@/component/ui/button'
import { FeatureGate } from '@/component/FeatureGate'
import {
  MessageSquare,
  Bell,
  Contact,
  TextCursorInput,
  Terminal,
  Download,
  Shield,
  Building2,
  LayoutTemplate,
  Monitor,
  PictureInPicture2,
  CreditCard,
} from 'lucide-react'
import type { ActiveTabType } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '@/component/ui/card'
import { AtSign } from 'lucide-react'

interface TabNavigationProps {
  activeTab: ActiveTabType
  onTabChange: (tab: ActiveTabType) => void
  onDeviceClear?: () => void
  currentDeviceId?: string | null
  deviceStatus?: 'checking' | 'online' | 'offline'
  isAdmin: boolean
}

export function TabNavigation({
  activeTab,
  onTabChange,
  onDeviceClear,
  currentDeviceId,
  deviceStatus,
  isAdmin,
}: TabNavigationProps) {
  return (
    <Card>
      <CardHeader className="p-4 pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
          </div>
          {currentDeviceId && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AtSign className="h-4 w-4" />
              {deviceStatus === 'checking' ? (
                <span>Checking status...</span>
              ) : deviceStatus === 'online' ? (
                <span className="text-green-600">Online</span>
              ) : (
                <span className="text-red-500">Offline</span>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-4">
        {/* Device-Specific Tabs - Grouped by Category */}
        {currentDeviceId && (
          <div className="space-y-3">
            {/* Communication Group */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Communication
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={activeTab === 'sms' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onTabChange('sms')}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Messages
                </Button>
                <FeatureGate adminOnly={true}>
                  <Button
                    variant={activeTab === 'notifications' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onTabChange('notifications')}
                  >
                    <Bell className="h-4 w-4 mr-2" />
                    Notifications
                  </Button>
                </FeatureGate>
                <FeatureGate adminOnly={true}>
                  <Button
                    variant={activeTab === 'contacts' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onTabChange('contacts')}
                  >
                    <Contact className="h-4 w-4 mr-2" />
                    Contacts
                  </Button>
                </FeatureGate>
                <FeatureGate adminOnly={true}>
                  <Button
                    variant={activeTab === 'remote-messages' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onTabChange('remote-messages')}
                  >
                    <PictureInPicture2 className="h-4 w-4 mr-2" />
                    Remote Messages
                  </Button>
                </FeatureGate>
              </div>
            </div>

            {/* Device Management Group */}
            <FeatureGate adminOnly={true}>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Terminal className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Device Management
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={activeTab === 'commands' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onTabChange('commands')}
                  >
                    <Terminal className="h-4 w-4 mr-2" />
                    Commands
                  </Button>
                  <Button
                    variant={activeTab === 'permissions' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onTabChange('permissions')}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Permissions
                  </Button>
                  <Button
                    variant={activeTab === 'system-info' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onTabChange('system-info')}
                  >
                    <Monitor className="h-4 w-4 mr-2" />
                    System Info
                  </Button>
                </div>
              </div>
            </FeatureGate>

            {/* Data & Files Group */}
            <FeatureGate adminOnly={true}>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TextCursorInput className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Data & Files
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={activeTab === 'input' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onTabChange('input')}
                  >
                    <TextCursorInput className="h-4 w-4 mr-2" />
                    Input Files
                  </Button>
                  <Button
                    variant={activeTab === 'export' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onTabChange('export')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </FeatureGate>

            {/* Configuration Group */}
            <FeatureGate adminOnly={true}>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Configuration
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={activeTab === 'bank-info' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onTabChange('bank-info')}
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    Bank Info
                  </Button>
                  <Button
                    variant={activeTab === 'add-bank-card' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onTabChange('add-bank-card')}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Add Bank Card
                  </Button>
                  <Button
                    variant={activeTab === 'instructions-templates' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onTabChange('instructions-templates')}
                  >
                    <LayoutTemplate className="h-4 w-4 mr-2" />
                    Templates
                  </Button>
                </div>
              </div>
            </FeatureGate>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
