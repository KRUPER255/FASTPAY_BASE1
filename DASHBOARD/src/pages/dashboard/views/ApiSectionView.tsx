import React from 'react'
import { ApiSection } from '@/component/ApiSection'

export function ApiSectionView(): React.ReactElement {
  return (
    <ApiSection
      showMonitor={false}
      title="API Documentation"
      description="All API endpoints with request and response examples"
    />
  )
}
