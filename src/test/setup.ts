// Test setup file for vitest
import { beforeEach, vi } from 'vitest'

// Mock localStorage for Node environment
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
}

// Make localStorage available globally
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// Reset any global state before each test
beforeEach(() => {
  // Clear localStorage mock
  localStorageMock.clear()
  vi.clearAllMocks()
  
  // Reset any global variables or mocks if needed
  // This ensures each test starts with a clean slate
})

// Global test utilities can be added here
export const createMockGameState = () => {
  // This will be implemented when we create the game logic
  // For now, just a placeholder
}