/**
 * Tests for Dialog components
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from './dialog'
import { Button } from './button'

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

describe('Dialog Components', () => {
  beforeEach(() => {
    document.body.style.overflow = ''
  })

  afterEach(() => {
    document.body.style.overflow = ''
  })

  describe('Dialog', () => {
    it('should not render when open is false', () => {
      render(
        <Dialog open={false} onOpenChange={vi.fn()}>
          <DialogContent>Content</DialogContent>
        </Dialog>
      )
      expect(screen.queryByText('Content')).not.toBeInTheDocument()
    })

    it('should render when open is true', () => {
      render(
        <Dialog open={true} onOpenChange={vi.fn()}>
          <DialogContent>Content</DialogContent>
        </Dialog>
      )
      expect(screen.getByText('Content')).toBeInTheDocument()
    })

    it('should prevent body scroll when open', () => {
      render(
        <Dialog open={true} onOpenChange={vi.fn()}>
          <DialogContent>Content</DialogContent>
        </Dialog>
      )
      expect(document.body.style.overflow).toBe('hidden')
    })

    it('should restore body scroll when closed', () => {
      const { rerender } = render(
        <Dialog open={true} onOpenChange={vi.fn()}>
          <DialogContent>Content</DialogContent>
        </Dialog>
      )
      expect(document.body.style.overflow).toBe('hidden')

      rerender(
        <Dialog open={false} onOpenChange={vi.fn()}>
          <DialogContent>Content</DialogContent>
        </Dialog>
      )
      expect(document.body.style.overflow).toBe('unset')
    })
  })

  describe('DialogContent', () => {
    it('should render dialog content', () => {
      render(
        <Dialog open={true} onOpenChange={vi.fn()}>
          <DialogContent>Dialog Content</DialogContent>
        </Dialog>
      )
      expect(screen.getByText('Dialog Content')).toBeInTheDocument()
    })

    it('should apply custom className', () => {
      const { container } = render(
        <Dialog open={true} onOpenChange={vi.fn()}>
          <DialogContent className="custom-dialog">Content</DialogContent>
        </Dialog>
      )
      const content = container.querySelector('.custom-dialog')
      expect(content).toBeInTheDocument()
    })
  })

  describe('DialogHeader', () => {
    it('should render dialog header', () => {
      render(
        <Dialog open={true} onOpenChange={vi.fn()}>
          <DialogContent>
            <DialogHeader>Header Content</DialogHeader>
          </DialogContent>
        </Dialog>
      )
      expect(screen.getByText('Header Content')).toBeInTheDocument()
    })
  })

  describe('DialogTitle', () => {
    it('should render dialog title', () => {
      render(
        <Dialog open={true} onOpenChange={vi.fn()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog Title</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      )
      expect(screen.getByText('Dialog Title')).toBeInTheDocument()
    })

    it('should render as h2 element', () => {
      const { container } = render(
        <Dialog open={true} onOpenChange={vi.fn()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Title</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      )
      const title = container.querySelector('h2')
      expect(title).toBeInTheDocument()
      expect(title).toHaveTextContent('Title')
    })
  })

  describe('DialogDescription', () => {
    it('should render dialog description', () => {
      render(
        <Dialog open={true} onOpenChange={vi.fn()}>
          <DialogContent>
            <DialogDescription>Description text</DialogDescription>
          </DialogContent>
        </Dialog>
      )
      expect(screen.getByText('Description text')).toBeInTheDocument()
    })
  })

  describe('DialogFooter', () => {
    it('should render dialog footer', () => {
      render(
        <Dialog open={true} onOpenChange={vi.fn()}>
          <DialogContent>
            <DialogFooter>Footer content</DialogFooter>
          </DialogContent>
        </Dialog>
      )
      expect(screen.getByText('Footer content')).toBeInTheDocument()
    })
  })

  describe('DialogClose', () => {
    it('should render close button', () => {
      render(
        <Dialog open={true} onOpenChange={vi.fn()}>
          <DialogContent>
            <DialogClose onClose={vi.fn()} />
          </DialogContent>
        </Dialog>
      )
      const closeButton = screen.getByRole('button')
      expect(closeButton).toBeInTheDocument()
    })

    it('should call onClose when clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()

      render(
        <Dialog open={true} onOpenChange={vi.fn()}>
          <DialogContent>
            <DialogClose onClose={onClose} />
          </DialogContent>
        </Dialog>
      )

      const closeButton = screen.getByRole('button')
      await user.click(closeButton)
      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('Complete Dialog Structure', () => {
    it('should render complete dialog with all parts', () => {
      render(
        <Dialog open={true} onOpenChange={vi.fn()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Title</DialogTitle>
              <DialogDescription>Description</DialogDescription>
            </DialogHeader>
            <div>Content</div>
            <DialogFooter>
              <Button>Cancel</Button>
              <Button>Confirm</Button>
            </DialogFooter>
            <DialogClose onClose={vi.fn()} />
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByText('Title')).toBeInTheDocument()
      expect(screen.getByText('Description')).toBeInTheDocument()
      expect(screen.getByText('Content')).toBeInTheDocument()
      expect(screen.getByText('Cancel')).toBeInTheDocument()
      expect(screen.getByText('Confirm')).toBeInTheDocument()
    })
  })
})
