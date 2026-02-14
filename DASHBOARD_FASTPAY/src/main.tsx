// CRITICAL: Import React first to ensure it's available before any other code
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import RedPayApp from './RedPayApp.tsx'
import { initTheme } from '@/lib/theme'
const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

// Initialize theme before rendering to prevent FOUC
initTheme()

const REDPAY_ONLY = import.meta.env.VITE_REDPAY_ONLY === 'true'
const AppComponent = REDPAY_ONLY ? RedPayApp : App

createRoot(rootElement).render(
  <StrictMode>
    <AppComponent />
  </StrictMode>
)
