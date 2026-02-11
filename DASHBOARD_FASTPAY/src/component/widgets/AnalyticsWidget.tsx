import WidgetContainer from './WidgetContainer'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { TrendingUp } from 'lucide-react'
import AnalyticsCharts from '@/component/AnalyticsCharts'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface AnalyticsWidgetProps {
  deviceId?: string | null
}

export default function AnalyticsWidget({ deviceId }: AnalyticsWidgetProps) {
  return (
    <WidgetContainer
      title="Analytics"
      icon={<TrendingUp className="h-4 w-4" />}
      colSpan={4}
      rowSpan={2}
    >
      <div className="h-full">
        <AnalyticsCharts deviceId={deviceId || undefined} />
      </div>
    </WidgetContainer>
  )
}
