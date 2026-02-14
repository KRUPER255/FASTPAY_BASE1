import { useEffect, forwardRef, type ReactNode, type HTMLAttributes } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { Button } from './button'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}

interface DialogContentProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  | 'onDrag'
  | 'onDragStart'
  | 'onDragEnd'
  | 'onAnimationStart'
  | 'onAnimationEnd'
  | 'onAnimationIteration'
> {
  children: ReactNode
  /** 'center' = centered modal (default). 'end' = right side of viewport, slide-in from right. */
  position?: 'center' | 'end'
}

const Dialog = ({ open, onOpenChange, children }: DialogProps) => {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9998] bg-black/50 dark:bg-black/50 backdrop-blur-sm neon-dialog-backdrop"
            onClick={(e) => {
              // Only close if clicking directly on backdrop, not on dialog content
              if (e.target === e.currentTarget) {
                onOpenChange(false)
              }
            }}
          />
          {/* Dialog Content */}
          {children}
        </>
      )}
    </AnimatePresence>
  )
}

const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, position = 'center', ...props }, ref) => {
    const isEnd = position === 'end'
    return (
      <motion.div
        ref={ref}
        initial={
          isEnd
            ? { opacity: 0, x: 24 }
            : { opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }
        }
        animate={
          isEnd
            ? { opacity: 1, x: 0 }
            : { opacity: 1, scale: 1, x: '-50%', y: '-50%' }
        }
        exit={
          isEnd
            ? { opacity: 0, x: 24 }
            : { opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }
        }
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={cn(
          'fixed z-[9999] grid w-full max-w-lg gap-4 border border-border/50 bg-card text-card-foreground p-6 shadow-elevation-2 rounded-xl duration-200',
          isEnd
            ? 'right-6 top-1/2 -translate-y-1/2 left-auto'
            : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
          className
        )}
        {...props}
      >
        {children}
      </motion.div>
    )
  }
)
DialogContent.displayName = 'DialogContent'

interface DialogHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

const DialogHeader = ({ className, children, ...props }: DialogHeaderProps) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props}>
    {children}
  </div>
)
DialogHeader.displayName = 'DialogHeader'

interface DialogCloseProps {
  onClose: () => void
  className?: string
}

const DialogClose = ({ onClose, className }: DialogCloseProps) => (
  <Button
    variant="ghost"
    size="icon"
    className={cn(
      'absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none',
      className
    )}
    onClick={onClose}
  >
    <X className="h-4 w-4" />
    <span className="sr-only">Close</span>
  </Button>
)

interface DialogTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode
}

const DialogTitle = forwardRef<HTMLHeadingElement, DialogTitleProps>(
  ({ className, children, ...props }, ref) => (
    <h2
      ref={ref}
      className={cn('text-lg font-semibold leading-none tracking-tight', className)}
      {...props}
    >
      {children}
    </h2>
  )
)
DialogTitle.displayName = 'DialogTitle'

interface DialogDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode
}

const DialogDescription = forwardRef<HTMLParagraphElement, DialogDescriptionProps>(
  ({ className, children, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props}>
      {children}
    </p>
  )
)
DialogDescription.displayName = 'DialogDescription'

interface DialogFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

const DialogFooter = ({ className, children, ...props }: DialogFooterProps) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
    {...props}
  >
    {children}
  </div>
)
DialogFooter.displayName = 'DialogFooter'

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogClose,
  DialogTitle,
  DialogDescription,
  DialogFooter,
}
