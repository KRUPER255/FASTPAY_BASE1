import React from 'react'
import { getVisibleSections } from '@/lib/dashboard-sections'
import type { DashboardSectionType } from '@/pages/dashboard/types'
import { cn } from '@/lib/utils'

interface SectionNavProps {
  activeSection: DashboardSectionType
  onSectionChange: (key: DashboardSectionType) => void
  userAccessLevel?: number
}

export const SectionNav: React.FC<SectionNavProps> = ({
  activeSection,
  onSectionChange,
  userAccessLevel = 0,
}) => {
  const sections = getVisibleSections(userAccessLevel)
  return (
    <div className="flex rounded-2xl overflow-hidden border border-border bg-card shadow-sm">
      <div className="flex flex-1 min-w-0">
        {sections.map((section, index) => {
          const Icon = section.icon
          const isFirst = index === 0
          const isLast = index === sections.length - 1
          const isActive = activeSection === section.key

          return (
            <label
              key={section.key}
              htmlFor={`nav-${section.key}`}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 cursor-pointer transition-all duration-200 font-semibold text-sm border-r border-border last:border-r-0',
                'hover:bg-accent hover:text-accent-foreground',
                isActive && 'bg-primary text-primary-foreground shadow-inner border-primary/30',
                !isActive && 'bg-card text-foreground',
                isFirst && 'rounded-l-2xl',
                isLast && 'rounded-r-2xl'
              )}
              data-tab={section.key}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden min-[1200px]:inline whitespace-nowrap nav-label">
                {section.label}
              </span>
              <input
                type="radio"
                id={`nav-${section.key}`}
                name="nav-radio"
                value={section.key}
                checked={isActive}
                onChange={() => onSectionChange(section.key)}
                className="sr-only"
              />
            </label>
          )
        })}
      </div>
    </div>
  )
}

export default SectionNav
