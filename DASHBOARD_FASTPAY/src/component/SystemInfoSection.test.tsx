/**
 * Tests for SystemInfoSection component
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SystemInfoSection from './SystemInfoSection'
import { Monitor } from 'lucide-react'

// Mock Card components
vi.mock('@/component/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardHeader: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardTitle: ({ children, className }: any) => <h3 className={className}>{children}</h3>,
  CardContent: ({ children, className }: any) => <div className={className}>{children}</div>,
}))

describe('SystemInfoSection', () => {
  const mockData = {
    model: 'Samsung Galaxy S21',
    manufacturer: 'Samsung',
    androidVersion: '13',
    batteryLevel: 85,
    totalStorage: 128000000000,
    availableStorage: 64000000000,
  }

  it('should render with title and data', () => {
    render(<SystemInfoSection title="Device Info" data={mockData} />)
    
    expect(screen.getByText('Device Info')).toBeInTheDocument()
    expect(screen.getByText('Samsung Galaxy S21')).toBeInTheDocument()
    // Check for manufacturer separately to avoid multiple matches
    const manufacturerElements = screen.getAllByText('Samsung')
    expect(manufacturerElements.length).toBeGreaterThan(0)
  })

  it('should render with icon', () => {
    render(<SystemInfoSection title="Device Info" data={mockData} icon={Monitor} />)
    
    const icon = document.querySelector('svg')
    expect(icon).toBeInTheDocument()
  })

  it('should not render when data is empty', () => {
    const { container } = render(<SystemInfoSection title="Empty" data={{}} />)
    expect(container.firstChild).toBeNull()
  })

  it('should not render when data is null', () => {
    const { container } = render(<SystemInfoSection title="Null" data={null as any} />)
    expect(container.firstChild).toBeNull()
  })

  it('should be collapsible by default', () => {
    render(<SystemInfoSection title="Collapsible" data={mockData} />)
    
    const collapseButton = screen.getByRole('button')
    expect(collapseButton).toBeInTheDocument()
  })

  it('should toggle collapse state on click', async () => {
    const user = userEvent.setup()
    render(<SystemInfoSection title="Collapsible" data={mockData} />)
    
    // Initially expanded (data visible)
    expect(screen.getByText(/Samsung Galaxy S21/i)).toBeInTheDocument()
    
    // Click to collapse
    const button = screen.getByRole('button')
    await user.click(button)
    
    // Data should be hidden
    expect(screen.queryByText(/Samsung Galaxy S21/i)).not.toBeInTheDocument()
    
    // Click to expand again
    await user.click(button)
    expect(screen.getByText(/Samsung Galaxy S21/i)).toBeInTheDocument()
  })

  it('should start collapsed when defaultCollapsed is true', () => {
    render(
      <SystemInfoSection 
        title="Collapsed" 
        data={mockData} 
        defaultCollapsed={true} 
      />
    )
    
    expect(screen.queryByText(/Samsung Galaxy S21/i)).not.toBeInTheDocument()
  })

  it('should not be collapsible when collapsible is false', () => {
    render(
      <SystemInfoSection 
        title="Not Collapsible" 
        data={mockData} 
        collapsible={false} 
      />
    )
    
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText(/Samsung Galaxy S21/i)).toBeInTheDocument()
  })

  it('should format boolean values correctly', () => {
    const booleanData = {
      isActive: true,
      isEnabled: false,
    }
    
    render(<SystemInfoSection title="Boolean Test" data={booleanData} />)
    
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('No')).toBeInTheDocument()
  })

  it('should format number values correctly', () => {
    const numberData = {
      count: 12345,
      percentage: 85.5,
    }
    
    render(<SystemInfoSection title="Number Test" data={numberData} />)
    
    expect(screen.getByText(/12,345/)).toBeInTheDocument()
    expect(screen.getByText(/85.5/)).toBeInTheDocument()
  })

  it('should format bytes correctly', () => {
    // Use a number that's definitely bytes
    // Logic: > 1000000000000 AND > Date.now() + 100000000000 = bytes
    // Use a very large number that's clearly bytes (not a timestamp)
    const bytesValue = 2000000000000 // 2TB in bytes - way larger than any timestamp
    const bytesData = {
      size: bytesValue,
    }
    
    render(<SystemInfoSection title="Storage Test" data={bytesData} />)
    
    // Check for the formatted bytes value (should show TB or GB)
    // The formatBytes function returns something like "1.82 TB"
    // Use getAllByText and check that at least one contains the unit
    const elements = screen.getAllByText(/TB|GB|MB|KB/i)
    expect(elements.length).toBeGreaterThan(0)
    // Verify it's in a value display (not the title)
    const valueElement = elements.find(el => 
      el.className.includes('font-mono') || el.textContent?.match(/\d+\.\d+\s+(TB|GB|MB|KB)/i)
    )
    expect(valueElement).toBeInTheDocument()
  })

  it('should format timestamps correctly', () => {
    const timestamp = Date.now() - 3600000 // 1 hour ago
    const timestampData = {
      lastSeen: timestamp,
    }
    
    render(<SystemInfoSection title="Timestamp Test" data={timestampData} />)
    
    // Should display as date
    const dateDisplay = screen.getByText(new RegExp(new Date(timestamp).getFullYear().toString()))
    expect(dateDisplay).toBeInTheDocument()
  })

  it('should format object values correctly', () => {
    const objectData = {
      config: {
        key1: 'value1',
        key2: 'value2',
      },
    }
    
    render(<SystemInfoSection title="Object Test" data={objectData} />)
    
    expect(screen.getByText(/key1/i)).toBeInTheDocument()
    expect(screen.getByText(/value1/i)).toBeInTheDocument()
  })

  it('should display N/A for null values', () => {
    const nullData = {
      value1: null,
      value2: undefined,
      value3: 'valid',
    }
    
    render(<SystemInfoSection title="Null Test" data={nullData} />)
    
    const naElements = screen.getAllByText('N/A')
    expect(naElements.length).toBeGreaterThan(0)
    expect(screen.getByText('valid')).toBeInTheDocument()
  })

  it('should format keys from camelCase to Title Case', () => {
    const camelCaseData = {
      batteryLevel: 85,
      totalStorage: 128,
      isActive: true,
    }
    
    render(<SystemInfoSection title="CamelCase Test" data={camelCaseData} />)
    
    expect(screen.getByText(/Battery Level/i)).toBeInTheDocument()
    expect(screen.getByText(/Total Storage/i)).toBeInTheDocument()
    expect(screen.getByText(/Is Active/i)).toBeInTheDocument()
  })
})
