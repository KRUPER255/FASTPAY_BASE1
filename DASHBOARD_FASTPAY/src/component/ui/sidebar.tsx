import { cn } from '@/lib/utils'
import { UserRound, Users, PanelLeft, PanelRight } from 'lucide-react'
import { Button } from './button'

interface User {
  id: string
  device: string | null
  phone: string | null
  code: string | null
  time: string | null
  admin: string | null
  lastSeen?: number | null
  batteryPercentage?: number | null
  isOnline?: boolean
}

interface SidebarProps {
  users: User[]
  selectedUserId: string | null
  onUserSelect: (userId: string | null) => void
  isExpanded?: boolean
  onToggle?: () => void
  className?: string
}

export function Sidebar({
  users,
  selectedUserId,
  onUserSelect,
  isExpanded = true,
  onToggle,
  className,
}: SidebarProps) {
  const getAvatarLetter = (user: User) => {
    const text = user.device || user.id
    return text ? text.charAt(0).toUpperCase() : '?'
  }

  return (
    <div
      className={cn(
        'border-r border-border bg-card h-full flex flex-col transition-all duration-300 overflow-hidden',
        isExpanded ? 'w-64' : 'w-16',
        className
      )}
    >
      <div className="p-4 border-b border-border">
        <div
          className={cn(
            'flex items-center gap-2',
            isExpanded ? 'justify-between' : 'justify-center'
          )}
        >
          {isExpanded ? (
            <>
              <div className="flex items-center gap-2">
                <UserRound className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <h2 className="font-semibold text-lg whitespace-nowrap">
                  {users.length === 1 ? 'User' : 'Users'}
                  <span className="text-sm text-muted-foreground ml-2 font-normal">
                    ({users.length})
                  </span>
                </h2>
              </div>
              {onToggle && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={onToggle}
                >
                  <PanelLeft className="h-4 w-4" />
                </Button>
              )}
            </>
          ) : (
            onToggle && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0"
                onClick={onToggle}
              >
                <PanelRight className="h-4 w-4" />
              </Button>
            )
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {users.length === 0 ? (
          <div
            className={cn('text-center py-8 text-muted-foreground text-sm', !isExpanded && 'px-0')}
          >
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            {isExpanded && <p>No users assigned</p>}
          </div>
        ) : (
          <div className="rounded-lg divide-y divide-border">
            {users.map(user => (
              <button
                key={user.id}
                onClick={() => onUserSelect(user.id)}
                className={cn(
                  'w-full rounded-md text-sm transition-colors',
                  isExpanded
                    ? 'text-left px-5 py-3 flex items-center gap-2'
                    : 'px-2 py-2 flex items-center justify-center',
                  selectedUserId === user.id
                    ? 'bg-primary/5 text-primary border border-primary/10'
                    : 'hover:bg-primary/5 text-foreground'
                )}
                title={
                  !isExpanded
                    ? `${user.code || ''} / ${user.phone || ''} / ${user.device || user.id}`
                    : undefined
                }
              >
                {isExpanded ? (
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    {/* Online/Offline Indicator */}
                    <div
                      className={cn(
                        'h-2 w-2 rounded-full flex-shrink-0',
                        user.isOnline ? 'bg-green-500' : 'bg-gray-400'
                      )}
                      title={user.isOnline ? 'Online' : 'Offline'}
                    />

                    <div className="flex-1 min-w-0">
                      {/* Name (primary) */}
                      <div className="font-medium truncate flex items-center gap-1">
                        {user.device || user.id}
                      </div>
                      {/* Code / Number (secondary) */}
                      <div className="text-xs opacity-60 truncate mt-0.5 flex items-center gap-1">
                        {user.code && <span className="truncate">{user.code}</span>}
                        {user.code && user.phone && <span className="opacity-40">/</span>}
                        {user.phone && <span className="truncate">{user.phone}</span>}
                        {!user.code && !user.phone && <span className="opacity-40">{user.id}</span>}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative flex items-center justify-center">
                    <div
                      className={cn(
                        'h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium',
                        selectedUserId === user.id ? 'bg-black text-white' : 'text-foreground'
                      )}
                    >
                      {getAvatarLetter(user)}
                    </div>
                    {/* Online/Offline Indicator - Small dot on collapsed */}
                    <div
                      className={cn(
                        'absolute bottom-0 right-0 h-2 w-2 rounded-full border-2 border-card',
                        user.isOnline ? 'bg-green-500' : 'bg-gray-400'
                      )}
                      title={user.isOnline ? 'Online' : 'Offline'}
                    />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
