import { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.08,
    },
  },
}

const item = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 400, damping: 28 },
  },
}

export interface DribbbleStyleCardProps {
  /** Card content (any React node). */
  children: ReactNode
  /** Optional extra class for the card wrapper. */
  className?: string
  /** Delay before entrance animation starts (seconds). */
  delay?: number
  /** Disable hover lift effect. */
  noHover?: boolean
  /** Card variant style. */
  variant?: 'default' | 'elevated' | 'glass' | 'soft'
}

/**
 * Dribbble-style animated card: smooth entrance (fade + slide up + scale),
 * optional staggered children, and hover lift + shadow.
 */
const variantStyles = {
  default:
    'border border-border/60 bg-card text-card-foreground shadow-md shadow-black/5 dark:shadow-black/20 hover:shadow-lg hover:shadow-black/10 dark:hover:shadow-black/30',
  elevated:
    'border border-border/30 bg-card text-card-foreground shadow-lg shadow-black/8 dark:shadow-black/30 hover:shadow-xl hover:shadow-black/15 dark:hover:shadow-black/40',
  glass:
    'border border-border/30 bg-white/5 text-card-foreground backdrop-blur-xl shadow-md hover:shadow-lg transition-all duration-200',
  soft: 'border border-border/30 bg-primary/5 text-card-foreground shadow-sm hover:shadow-md',
}

export function DribbbleStyleCard({
  children,
  className,
  delay = 0,
  noHover = false,
  variant = 'default',
}: DribbbleStyleCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: 'spring',
        stiffness: 320,
        damping: 28,
        delay,
      }}
      whileHover={
        noHover
          ? undefined
          : {
              y: -6,
              scale: 1.02,
              transition: { duration: 0.2 },
            }
      }
      className={cn(
        'rounded-2xl overflow-hidden transition-shadow duration-200',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </motion.div>
  )
}

export interface DribbbleStyleCardStaggerProps {
  /** List of items to render with stagger animation. */
  items: ReactNode[]
  /** Wrapper class for the list container. */
  className?: string
  /** Item wrapper class. */
  itemClassName?: string
}

/**
 * Renders a list with staggered entrance (fade + slide up per item).
 * Use inside DribbbleStyleCard or standalone.
 */
export function DribbbleStyleCardStagger({
  items,
  className,
  itemClassName,
}: DribbbleStyleCardStaggerProps) {
  return (
    <motion.ul
      variants={container}
      initial="hidden"
      animate="visible"
      className={cn('space-y-2 list-none p-0 m-0', className)}
    >
      {items.map((child, i) => (
        <motion.li key={i} variants={item} className={cn('', itemClassName)}>
          {child}
        </motion.li>
      ))}
    </motion.ul>
  )
}
