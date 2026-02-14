import { UserManagementSection } from '@/pages/dashboard/components/UserManagementSection'

export interface UserManagementSectionViewProps {
  sessionEmail: string | null
}

export function UserManagementSectionView({
  sessionEmail,
}: UserManagementSectionViewProps): React.ReactElement {
  return (
    <div className="w-full p-4 md:p-6">
      <UserManagementSection />
    </div>
  )
}
