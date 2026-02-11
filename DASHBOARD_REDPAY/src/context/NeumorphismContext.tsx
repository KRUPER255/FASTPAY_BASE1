import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

interface NeumorphismContextValue {
  isNeumorphism: boolean
  setIsNeumorphism: (value: boolean) => void
}

const NeumorphismContext = createContext<NeumorphismContextValue | undefined>(undefined)

export function NeumorphismProvider({ children }: { children: ReactNode }) {
  const [isNeumorphism, setIsNeumorphism] = useState(() => {
    if (typeof window === 'undefined') return true
    const stored = window.localStorage.getItem('fastpay-neumorphism')
    if (stored === null) return true
    return stored === 'true'
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('fastpay-neumorphism', String(isNeumorphism))
  }, [isNeumorphism])

  return (
    <NeumorphismContext.Provider value={{ isNeumorphism, setIsNeumorphism }}>
      {children}
    </NeumorphismContext.Provider>
  )
}

export function useNeumorphism() {
  const context = useContext(NeumorphismContext)
  if (!context) {
    throw new Error('useNeumorphism must be used within NeumorphismProvider')
  }
  return context
}
