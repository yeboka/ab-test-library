import { vi, type MockedFunction } from 'vitest'

/**
 * Helper to check if localStorage was set with wrapped format containing the data
 */
export function expectWrappedStorage(key: string, expectedData: any, localStorageMock: StorageMock) {
  expect(localStorageMock.setItem).toHaveBeenCalledWith(key, expect.stringMatching(/"version":1/))
  const calls = localStorageMock.setItem.mock.calls
  const matchingCalls = calls.filter(call => call[0] === key)
  expect(matchingCalls.length).toBeGreaterThan(0)
  const lastCall = matchingCalls[matchingCalls.length - 1]
  const storedValue = JSON.parse(lastCall![1])
  expect(storedValue).toMatchObject({
    data: expectedData,
    version: 1
  })
}

export interface StorageMock {
  getItem: MockedFunction<(key: string) => string | null>
  setItem: MockedFunction<(key: string, value: string) => void>
  removeItem: MockedFunction<(key: string) => void>
  clear: MockedFunction<() => void>
}

// Mock localStorage
export const createLocalStorageMock = (): StorageMock => {
  let store: Record<string, string> = {}

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString()
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    })
  }
}

// Setup localStorage mock for jsdom environment
export const setupLocalStorageMock = (localStorageMock: StorageMock) => {
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true
    })
  }
}
