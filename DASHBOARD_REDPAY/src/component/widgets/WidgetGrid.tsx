import type { ReactNode } from 'react'

interface WidgetGridProps {
  children: ReactNode
  columns?: number
  gap?: number
}

export default function WidgetGrid({ children, columns = 4, gap = 4 }: WidgetGridProps) {
  return (
    <div
      className="grid w-full auto-rows-min"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: `${gap * 0.25}rem`,
      }}
    >
      {children}
    </div>
  )
}
