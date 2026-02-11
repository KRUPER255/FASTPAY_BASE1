import { hasFullAccess } from '@/lib/auth'

interface FeatureGateProps {
  children: React.ReactNode
  adminOnly?: boolean
  fallback?: React.ReactNode
  showPlaceholder?: boolean
  placeholderMessage?: string
}

export function FeatureGate({
  children,
  adminOnly = false,
  fallback = null,
  showPlaceholder = false,
  placeholderMessage = 'This feature is only available for administrators',
}: FeatureGateProps) {
  const isAdmin = hasFullAccess()

  if (adminOnly && !isAdmin) {
    if (showPlaceholder) {
      return (
        <div className="p-4 text-center text-muted-foreground border border-dashed rounded-lg">
          <p className="text-sm">{placeholderMessage}</p>
        </div>
      )
    }
    return <>{fallback}</>
  }

  return <>{children}</>
}
