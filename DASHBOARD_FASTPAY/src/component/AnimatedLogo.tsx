import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import './AnimatedLogo.css'

interface AnimatedLogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showTagline?: boolean
  tagline?: string
  animated?: boolean
}

const sizeClasses = {
  sm: 'text-2xl',
  md: 'text-3xl md:text-4xl',
  lg: 'text-4xl md:text-5xl lg:text-6xl',
  xl: 'text-5xl md:text-6xl lg:text-7xl xl:text-8xl',
}

export default function AnimatedLogo({
  className,
  size = 'md',
  showTagline = false,
  tagline = 'The Real Gaming Platform',
  animated = true,
}: AnimatedLogoProps) {
  const [mounted, setMounted] = useState(!animated)
  const letters = 'FASTPAY'.split('')
  const taglineWords = tagline.split(' ')

  useEffect(() => {
    if (animated) {
      // Small delay to trigger animation
      const timer = setTimeout(() => setMounted(true), 50)
      return () => clearTimeout(timer)
    }
  }, [animated])

  return (
    <div className={cn('flex flex-col items-center justify-center', className)}>
      {/* Logo Container */}
      <div className="relative inline-block">
        {/* Glow effect */}
        <div
          className="absolute inset-0 blur-2xl logo-glow-bg transition-opacity duration-1000"
          style={{
            background: 'linear-gradient(135deg, #00ff88 0%, #6366f1 100%)',
            transform: 'scale(1.2)',
            opacity: mounted ? 0.3 : 0,
          }}
        />

        {/* Logo Text */}
        <div className="relative flex items-center">
          {letters.map((letter, index) => {
            // F appears first, then astpay appears quickly one by one
            const isFirst = index === 0
            // F appears at 0ms, then each letter after appears quickly (50ms intervals after 400ms delay for F)
            const delay = isFirst ? 0 : 400 + (index - 1) * 80
            const glowDelay = delay + 300
            return (
              <span
                key={index}
                className={cn(
                  'inline-block font-bold tracking-tight logo-letter',
                  sizeClasses[size],
                  'bg-gradient-to-br from-[#00ff88] via-white to-[#6366f1] bg-clip-text text-transparent',
                  animated && mounted && 'logo-letter-animate'
                )}
                style={
                  animated && mounted
                    ? {
                        animation: `logoLetterFadeIn 0.5s ease-out ${delay}ms forwards, logoGlow 2s ease-in-out ${glowDelay}ms infinite`,
                      }
                    : undefined
                }
              >
                {letter}
              </span>
            )
          })}
        </div>

        {/* Animated underline */}
        {animated && (
          <div
            className={cn(
              'absolute -bottom-2 left-0 h-0.5 logo-underline',
              mounted && 'logo-underline-animate'
            )}
            style={{
              background: 'linear-gradient(to right, #00ff88, #6366f1, #00ff88)',
              backgroundSize: '200% 100%',
            }}
          />
        )}
      </div>

      {/* Tagline */}
      {showTagline && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {taglineWords.map((word, index) => {
            // Tagline appears after logo is complete (about 900ms)
            const delay = animated ? 900 + index * 100 : 0
            return (
              <span
                key={index}
                className={cn(
                  'text-sm md:text-base text-muted-foreground/80 font-medium tagline-word',
                  animated && mounted && 'tagline-word-animate'
                )}
                style={
                  animated && mounted
                    ? {
                        animation: `taglineFadeIn 0.5s ease-out ${delay}ms forwards`,
                      }
                    : undefined
                }
              >
                {word}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
