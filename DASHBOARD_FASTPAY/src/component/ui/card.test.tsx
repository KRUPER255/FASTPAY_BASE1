/**
 * Tests for Card components
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './card'

describe('Card Components', () => {
  describe('Card', () => {
    it('should render card with children', () => {
      render(
        <Card>
          <div>Card Content</div>
        </Card>
      )
      expect(screen.getByText('Card Content')).toBeInTheDocument()
    })

    it('should apply custom className', () => {
      const { container } = render(
        <Card className="custom-class">
          <div>Content</div>
        </Card>
      )
      const card = container.querySelector('.custom-class')
      expect(card).toBeInTheDocument()
    })
  })

  describe('CardHeader', () => {
    it('should render card header', () => {
      render(
        <Card>
          <CardHeader>Header Content</CardHeader>
        </Card>
      )
      expect(screen.getByText('Header Content')).toBeInTheDocument()
    })
  })

  describe('CardTitle', () => {
    it('should render card title', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
          </CardHeader>
        </Card>
      )
      expect(screen.getByText('Card Title')).toBeInTheDocument()
    })

    it('should render as h3 element', () => {
      const { container } = render(
        <Card>
          <CardHeader>
            <CardTitle>Title</CardTitle>
          </CardHeader>
        </Card>
      )
      const title = container.querySelector('h3')
      expect(title).toBeInTheDocument()
      expect(title).toHaveTextContent('Title')
    })
  })

  describe('CardDescription', () => {
    it('should render card description', () => {
      render(
        <Card>
          <CardHeader>
            <CardDescription>Description text</CardDescription>
          </CardHeader>
        </Card>
      )
      expect(screen.getByText('Description text')).toBeInTheDocument()
    })
  })

  describe('CardContent', () => {
    it('should render card content', () => {
      render(
        <Card>
          <CardContent>Content text</CardContent>
        </Card>
      )
      expect(screen.getByText('Content text')).toBeInTheDocument()
    })
  })

  describe('CardFooter', () => {
    it('should render card footer', () => {
      render(
        <Card>
          <CardFooter>Footer content</CardFooter>
        </Card>
      )
      expect(screen.getByText('Footer content')).toBeInTheDocument()
    })
  })

  describe('Complete Card Structure', () => {
    it('should render complete card with all parts', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Title</CardTitle>
            <CardDescription>Description</CardDescription>
          </CardHeader>
          <CardContent>Content</CardContent>
          <CardFooter>Footer</CardFooter>
        </Card>
      )

      expect(screen.getByText('Title')).toBeInTheDocument()
      expect(screen.getByText('Description')).toBeInTheDocument()
      expect(screen.getByText('Content')).toBeInTheDocument()
      expect(screen.getByText('Footer')).toBeInTheDocument()
    })
  })
})
