/**
 * Vitest setup file
 * Configures testing environment and global test utilities
 */
import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock Firebase
vi.mock('@/lib/firebase', () => ({
  db: {
    ref: vi.fn(),
    child: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    set: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
  auth: {
    signInWithEmailAndPassword: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn(),
    currentUser: null,
  },
  database: {},
  storage: {},
}))

// Mock Firebase database module to avoid real SDK calls in tests
vi.mock('firebase/database', () => ({
  ref: vi.fn(),
  onValue: vi.fn(),
  off: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
  get: vi.fn(),
  query: vi.fn(),
  orderByKey: vi.fn(),
  limitToLast: vi.fn(),
  child: vi.fn(),
  remove: vi.fn(),
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return []
  }
  unobserve() {}
} as any

// Suppress console errors in tests (optional)
// Uncomment if you want to suppress console errors during tests
// global.console = {
//   ...console,
//   error: vi.fn(),
//   warn: vi.fn(),
// }
