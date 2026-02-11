/**
 * Tests for Badge component
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from './badge'

describe('Badge', () => {
  it('should render badge with text', () => {
    render(<Badge>Badge Text</Badge>)
    expect(screen.getByText('Badge Text')).toBeInTheDocument()
  })

  it('should apply default variant classes', () => {
    const { container } = render(<Badge>Default</Badge>)
    const badge = container.querySelector('div')
    expect(badge).toHaveClass('bg-primary')
  })

  it('should apply secondary variant', () => {
    const { container } = render(<Badge variant="secondary">Secondary</Badge>)
    const badge = container.querySelector('div')
    expect(badge).toHaveClass('bg-secondary')
  })

  it('should apply destructive variant', () => {
    const { container } = render(<Badge variant="destructive">Destructive</Badge>)
    const badge = container.querySelector('div')
    expect(badge).toHaveClass('bg-destructive')
  })

  it('should apply outline variant', () => {
    const { container } = render(<Badge variant="outline">Outline</Badge>)
    const badge = container.querySelector('div')
    expect(badge).toHaveClass('text-foreground')
  })

  it('should apply custom className', () => {
    const { container } = render(<Badge className="custom-badge">Custom</Badge>)
    const badge = container.querySelector('.custom-badge')
    expect(badge).toBeInTheDocument()
  })

  it('should render with children', () => {
    render(
      <Badge>
        <span>Child Element</span>
      </Badge>
    )
    expect(screen.getByText('Child Element')).toBeInTheDocument()
  })
})
