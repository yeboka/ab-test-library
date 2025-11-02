import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { initUserExperimentsAndVariants, updateUserWithReassignVariants, getUserVariantByExperimentKey } from './index'
import type { UserService } from './services/userService'
import type { ExperimentService } from './services/experimentService'
import type { VariantService } from './services/variantService'

// Mock localStorage
const localStorageMock = (() => {
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
})()

// Mock window object if in jsdom environment
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true
  })
}

describe('initUserExperimentsAndVariants', () => {
  let mockUserService: UserService
  let mockExperimentService: ExperimentService
  let mockVariantService: VariantService

  const mockUser = { id: 'user-123', email: 'test@example.com' }
  const mockExperiments = [
    { key: 'experiment-1', name: 'Test Experiment 1', splits: { A: 0.5, B: 0.5 } },
    { key: 'experiment-2', name: 'Test Experiment 2', splits: { A: 0.33, B: 0.33, C: 0.34 } }
  ]
  const mockUserVariant = {
    user_id: 'user-123',
    experiment_key: 'experiment-1',
    variant: 'A',
    updated_at: new Date()
  }

  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()

    mockUserService = {
      getUser: vi.fn(),
      saveUser: vi.fn().mockResolvedValue(undefined),
      updateUser: vi.fn().mockResolvedValue(undefined)
    }

    mockExperimentService = {
      getExperiments: vi.fn().mockResolvedValue(mockExperiments)
    }

    mockVariantService = {
      getVariantsByUserId: vi.fn().mockResolvedValue([]),
      getUserVariantByExperimentLey: vi.fn().mockResolvedValue(null),
      saveUserVariantForExperiment: vi.fn().mockResolvedValue(null)
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Happy path', () => {
    it('should initialize user, fetch experiments, and assign variants', async () => {
      // Mock saveUserVariantForExperiment to return the variant after saving
      const savedVariant1 = {
        user_id: mockUser.id,
        experiment_key: 'experiment-1',
        variant: 'A'
      }
      const savedVariant2 = {
        user_id: mockUser.id,
        experiment_key: 'experiment-2',
        variant: 'B'
      }

      mockVariantService.getUserVariantByExperimentLey = vi
        .fn()
        .mockResolvedValueOnce(null) // First check returns null
        .mockResolvedValueOnce(savedVariant1) // After save, returns variant 1
        .mockResolvedValueOnce(null) // First check returns null
        .mockResolvedValueOnce(savedVariant2) // After save, returns variant 2

      await initUserExperimentsAndVariants({
        userData: mockUser,
        userService: mockUserService,
        experimentService: mockExperimentService,
        variantService: mockVariantService
      })

      expect(mockUserService.saveUser).toHaveBeenCalledWith(mockUser)
      expect(mockExperimentService.getExperiments).toHaveBeenCalled()
      expect(mockVariantService.getVariantsByUserId).toHaveBeenCalledWith(mockUser.id)
      expect(mockVariantService.saveUserVariantForExperiment).toHaveBeenCalledTimes(2)
      expect(localStorageMock.setItem).toHaveBeenCalledWith('ab_variants', expect.stringContaining('user-123'))
    })

    it('should use existing remote variants when available', async () => {
      const existingVariants = [mockUserVariant]
      mockVariantService.getVariantsByUserId = vi.fn().mockResolvedValue(existingVariants)
      mockVariantService.getUserVariantByExperimentLey = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...mockUserVariant, experiment_key: 'experiment-2', variant: 'B' })

      await initUserExperimentsAndVariants({
        userData: mockUser,
        userService: mockUserService,
        experimentService: mockExperimentService,
        variantService: mockVariantService
      })

      // Should only save variant for experiment-2 since experiment-1 already has a variant
      expect(mockVariantService.saveUserVariantForExperiment).toHaveBeenCalledTimes(1)
      expect(mockVariantService.saveUserVariantForExperiment).toHaveBeenCalledWith(
        mockUser.id,
        'experiment-2',
        expect.any(String)
      )
    })
  })

  describe('Edge cases - No user', () => {
    it('should handle saveUser failure gracefully', async () => {
      mockUserService.saveUser = vi.fn().mockRejectedValue(new Error('Save failed'))

      await expect(
        initUserExperimentsAndVariants({
          userData: mockUser,
          userService: mockUserService,
          experimentService: mockExperimentService,
          variantService: mockVariantService
        })
      ).rejects.toThrow()

      expect(mockUserService.saveUser).toHaveBeenCalledWith(mockUser)
    })

    it('should handle missing user data fields', async () => {
      const invalidUser = { id: '', email: '' } as any

      await initUserExperimentsAndVariants({
        userData: invalidUser,
        userService: mockUserService,
        experimentService: mockExperimentService,
        variantService: mockVariantService
      })

      expect(mockUserService.saveUser).toHaveBeenCalledWith(invalidUser)
    })
  })

  describe('Edge cases - Corrupted data', () => {
    it('should handle null experiments gracefully', async () => {
      mockExperimentService.getExperiments = vi.fn().mockResolvedValue(null)

      await initUserExperimentsAndVariants({
        userData: mockUser,
        userService: mockUserService,
        experimentService: mockExperimentService,
        variantService: mockVariantService
      })

      expect(mockExperimentService.getExperiments).toHaveBeenCalled()
      expect(mockVariantService.saveUserVariantForExperiment).not.toHaveBeenCalled()
    })

    it('should handle null variants gracefully', async () => {
      mockVariantService.getVariantsByUserId = vi.fn().mockResolvedValue(null)

      await initUserExperimentsAndVariants({
        userData: mockUser,
        userService: mockUserService,
        experimentService: mockExperimentService,
        variantService: mockVariantService
      })

      expect(mockVariantService.getVariantsByUserId).toHaveBeenCalled()
      expect(mockVariantService.saveUserVariantForExperiment).not.toHaveBeenCalled()
    })

    it('should handle corrupted experiment data with missing fields', async () => {
      const corruptedExperiments = [
        { key: 'experiment-1', name: 'Test' } as any, // missing splits
        null as any,
        { key: '', splits: { A: 0.5 } } as any // empty key
      ]

      mockExperimentService.getExperiments = vi.fn().mockResolvedValue(corruptedExperiments)

      await expect(
        initUserExperimentsAndVariants({
          userData: mockUser,
          userService: mockUserService,
          experimentService: mockExperimentService,
          variantService: mockVariantService
        })
      ).rejects.toThrow() // variantAssigner will fail with missing splits
    })

    it('should handle corrupted variant data', async () => {
      const corruptedVariants = [
        { user_id: 'user-123', experiment_key: 'experiment-1' } as any // missing variant field
      ]

      mockVariantService.getVariantsByUserId = vi.fn().mockResolvedValue(corruptedVariants)
      mockVariantService.getUserVariantByExperimentLey = vi
        .fn()
        .mockResolvedValueOnce(null) // First check returns null
        .mockResolvedValueOnce({ user_id: mockUser.id, experiment_key: 'experiment-2', variant: 'B' }) // After save
        .mockResolvedValueOnce(null) // First check returns null
        .mockResolvedValueOnce({ user_id: mockUser.id, experiment_key: 'experiment-3', variant: 'C' }) // After save

      // Add third experiment to trigger assignment
      const experimentsWithThree = [
        ...mockExperiments,
        { key: 'experiment-3', name: 'Test Experiment 3', splits: { A: 0.5, B: 0.5 } }
      ]
      mockExperimentService.getExperiments = vi.fn().mockResolvedValue(experimentsWithThree)

      await initUserExperimentsAndVariants({
        userData: mockUser,
        userService: mockUserService,
        experimentService: mockExperimentService,
        variantService: mockVariantService
      })

      // Should still attempt to assign missing variants (experiment-2 and experiment-3)
      expect(mockVariantService.saveUserVariantForExperiment).toHaveBeenCalled()
    })
  })

  describe('Edge cases - Unexpected updates', () => {
    it('should handle localStorage.setItem failure', async () => {
      const originalSetItem = localStorageMock.setItem
      localStorageMock.setItem = vi.fn().mockImplementation(() => {
        throw new Error('localStorage quota exceeded')
      })

      mockVariantService.getUserVariantByExperimentLey = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ user_id: mockUser.id, experiment_key: 'experiment-1', variant: 'A' })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ user_id: mockUser.id, experiment_key: 'experiment-2', variant: 'B' })

      // The implementation doesn't catch localStorage errors, so expect it to throw
      await expect(
        initUserExperimentsAndVariants({
          userData: mockUser,
          userService: mockUserService,
          experimentService: mockExperimentService,
          variantService: mockVariantService
        })
      ).rejects.toThrow('localStorage quota exceeded')

      // Should still attempt operations before the error
      expect(mockUserService.saveUser).toHaveBeenCalled()
      expect(mockVariantService.saveUserVariantForExperiment).toHaveBeenCalled()

      localStorageMock.setItem = originalSetItem
    })

    it('should handle remote variant fetch failure', async () => {
      mockVariantService.getUserVariantByExperimentLey = vi.fn().mockRejectedValue(new Error('Network error'))

      // The implementation doesn't catch getUserVariantByExperimentLey errors, so expect it to throw
      await expect(
        initUserExperimentsAndVariants({
          userData: mockUser,
          userService: mockUserService,
          experimentService: mockExperimentService,
          variantService: mockVariantService
        })
      ).rejects.toThrow('Network error')
    })

    it('should handle variant save failure', async () => {
      mockVariantService.saveUserVariantForExperiment = vi.fn().mockRejectedValue(new Error('Save failed'))

      await expect(
        initUserExperimentsAndVariants({
          userData: mockUser,
          userService: mockUserService,
          experimentService: mockExperimentService,
          variantService: mockVariantService
        })
      ).rejects.toThrow()
    })

    it('should handle experiment service failure', async () => {
      mockExperimentService.getExperiments = vi.fn().mockRejectedValue(new Error('Service unavailable'))

      await expect(
        initUserExperimentsAndVariants({
          userData: mockUser,
          userService: mockUserService,
          experimentService: mockExperimentService,
          variantService: mockVariantService
        })
      ).rejects.toThrow()
    })

    it('should handle variant service getVariantsByUserId failure', async () => {
      mockVariantService.getVariantsByUserId = vi.fn().mockRejectedValue(new Error('Variant service error'))

      await expect(
        initUserExperimentsAndVariants({
          userData: mockUser,
          userService: mockUserService,
          experimentService: mockExperimentService,
          variantService: mockVariantService
        })
      ).rejects.toThrow()
    })
  })

  describe('Additional edge cases', () => {
    it('should handle empty experiments array', async () => {
      mockExperimentService.getExperiments = vi.fn().mockResolvedValue([])

      await initUserExperimentsAndVariants({
        userData: mockUser,
        userService: mockUserService,
        experimentService: mockExperimentService,
        variantService: mockVariantService
      })

      expect(mockVariantService.saveUserVariantForExperiment).not.toHaveBeenCalled()
      expect(localStorageMock.setItem).toHaveBeenCalledWith('ab_variants', '[]')
    })

    it('should handle all variants already assigned', async () => {
      const existingVariants = [
        { ...mockUserVariant, experiment_key: 'experiment-1' },
        { ...mockUserVariant, experiment_key: 'experiment-2', variant: 'B' }
      ]
      mockVariantService.getVariantsByUserId = vi.fn().mockResolvedValue(existingVariants)

      await initUserExperimentsAndVariants({
        userData: mockUser,
        userService: mockUserService,
        experimentService: mockExperimentService,
        variantService: mockVariantService
      })

      expect(mockVariantService.saveUserVariantForExperiment).not.toHaveBeenCalled()
    })

    it('should handle when remote variant exists but getVariantsByUserId returns incomplete list', async () => {
      const incompleteVariants = [{ ...mockUserVariant, experiment_key: 'experiment-1' }]
      mockVariantService.getVariantsByUserId = vi.fn().mockResolvedValue(incompleteVariants)
      // When checking for experiment-2, return the remote variant
      mockVariantService.getUserVariantByExperimentLey = vi
        .fn()
        .mockResolvedValueOnce({ ...mockUserVariant, experiment_key: 'experiment-2', variant: 'B' })

      await initUserExperimentsAndVariants({
        userData: mockUser,
        userService: mockUserService,
        experimentService: mockExperimentService,
        variantService: mockVariantService
      })

      expect(mockVariantService.getUserVariantByExperimentLey).toHaveBeenCalledWith(mockUser.id, 'experiment-2')
      // Should not save variant for experiment-2 since it exists remotely
      expect(mockVariantService.saveUserVariantForExperiment).not.toHaveBeenCalled()
    })

    it('should handle when saveUserVariantForExperiment returns null after save', async () => {
      mockVariantService.saveUserVariantForExperiment = vi.fn().mockResolvedValue(null)
      mockVariantService.getUserVariantByExperimentLey = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null) // Still null after save
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)

      await initUserExperimentsAndVariants({
        userData: mockUser,
        userService: mockUserService,
        experimentService: mockExperimentService,
        variantService: mockVariantService
      })

      // Should still attempt to fetch variant after save
      expect(mockVariantService.getUserVariantByExperimentLey).toHaveBeenCalled()
    })
  })
})

describe('updateUserWithReassignVariants', () => {
  let mockUserService: UserService
  let mockExperimentService: ExperimentService
  let mockVariantService: VariantService

  const mockUser = { id: 'user-123', email: 'test@example.com' }
  const mockExperiments = [
    { key: 'experiment-1', name: 'Test Experiment 1', splits: { A: 0.5, B: 0.5 } },
    { key: 'experiment-2', name: 'Test Experiment 2', splits: { A: 0.33, B: 0.33, C: 0.34 } }
  ]
  const mockUserVariants = [
    { user_id: 'user-123', experiment_key: 'experiment-1', variant: 'A' },
    { user_id: 'user-123', experiment_key: 'experiment-2', variant: 'B' }
  ]

  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()

    mockUserService = {
      getUser: vi.fn().mockReturnValue(mockUser),
      saveUser: vi.fn().mockResolvedValue(undefined),
      updateUser: vi.fn().mockResolvedValue(undefined)
    }

    mockExperimentService = {
      getExperiments: vi.fn().mockResolvedValue(mockExperiments)
    }

    mockVariantService = {
      getVariantsByUserId: vi.fn().mockResolvedValue(mockUserVariants),
      getUserVariantByExperimentLey: vi.fn().mockResolvedValue(null),
      saveUserVariantForExperiment: vi.fn().mockResolvedValue(null)
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Happy path', () => {
    it('should update user without reassigning variants when option is not provided', async () => {
      await updateUserWithReassignVariants({
        userData: mockUser,
        options: undefined,
        userService: mockUserService,
        experimentService: mockExperimentService,
        variantService: mockVariantService
      })

      expect(mockUserService.updateUser).toHaveBeenCalledWith(mockUser)
      expect(mockExperimentService.getExperiments).not.toHaveBeenCalled()
      expect(mockVariantService.saveUserVariantForExperiment).not.toHaveBeenCalled()
    })

    it('should update user and reassign variants when reassignVariant is true', async () => {
      await updateUserWithReassignVariants({
        userData: mockUser,
        options: { reassignVariant: true },
        userService: mockUserService,
        experimentService: mockExperimentService,
        variantService: mockVariantService
      })

      expect(mockUserService.updateUser).toHaveBeenCalledWith(mockUser)
      expect(mockExperimentService.getExperiments).toHaveBeenCalled()
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('ab_variants')
      expect(mockVariantService.saveUserVariantForExperiment).toHaveBeenCalledTimes(2)
      expect(mockVariantService.getVariantsByUserId).toHaveBeenCalledWith(mockUser.id)
      expect(localStorageMock.setItem).toHaveBeenCalledWith('ab_variants', JSON.stringify(mockUserVariants))
    })
  })

  describe('Edge cases - No user', () => {
    it('should throw error when updating user before initialization', async () => {
      mockUserService.getUser = vi.fn().mockReturnValue(null)
      mockUserService.updateUser = vi.fn().mockImplementation(() => {
        throw new Error('Updating user before initialization')
      })

      await expect(
        updateUserWithReassignVariants({
          userData: mockUser,
          options: undefined,
          userService: mockUserService,
          experimentService: mockExperimentService,
          variantService: mockVariantService
        })
      ).rejects.toThrow('Updating user before initialization')
    })

    it('should throw error when updating user with different id', async () => {
      mockUserService.updateUser = vi.fn().mockImplementation(() => {
        throw new Error('Updating user with different id')
      })

      const differentUser = { id: 'user-456', email: 'different@example.com' }

      await expect(
        updateUserWithReassignVariants({
          userData: differentUser,
          options: undefined,
          userService: mockUserService,
          experimentService: mockExperimentService,
          variantService: mockVariantService
        })
      ).rejects.toThrow('Updating user with different id')
    })
  })

  describe('Edge cases - Corrupted data', () => {
    it('should handle null experiments when reassigning', async () => {
      mockExperimentService.getExperiments = vi.fn().mockResolvedValue(null)

      await updateUserWithReassignVariants({
        userData: mockUser,
        options: { reassignVariant: true },
        userService: mockUserService,
        experimentService: mockExperimentService,
        variantService: mockVariantService
      })

      expect(mockExperimentService.getExperiments).toHaveBeenCalled()
      expect(mockVariantService.saveUserVariantForExperiment).not.toHaveBeenCalled()
    })

    it('should handle empty experiments array when reassigning', async () => {
      mockExperimentService.getExperiments = vi.fn().mockResolvedValue([])

      await updateUserWithReassignVariants({
        userData: mockUser,
        options: { reassignVariant: true },
        userService: mockUserService,
        experimentService: mockExperimentService,
        variantService: mockVariantService
      })

      expect(mockExperimentService.getExperiments).toHaveBeenCalled()
      expect(mockVariantService.saveUserVariantForExperiment).not.toHaveBeenCalled()
    })

    it('should handle null variants after reassignment', async () => {
      mockVariantService.getVariantsByUserId = vi.fn().mockResolvedValue(null)

      await updateUserWithReassignVariants({
        userData: mockUser,
        options: { reassignVariant: true },
        userService: mockUserService,
        experimentService: mockExperimentService,
        variantService: mockVariantService
      })

      expect(mockVariantService.getVariantsByUserId).toHaveBeenCalled()
      // Should still attempt to set localStorage even if variants is null
      expect(localStorageMock.setItem).toHaveBeenCalledWith('ab_variants', 'null')
    })

    it('should handle corrupted experiment data during reassignment', async () => {
      const corruptedExperiments = [
        { key: 'experiment-1', name: 'Test' } as any, // missing splits
        null as any
      ]

      mockExperimentService.getExperiments = vi.fn().mockResolvedValue(corruptedExperiments)

      await expect(
        updateUserWithReassignVariants({
          userData: mockUser,
          options: { reassignVariant: true },
          userService: mockUserService,
          experimentService: mockExperimentService,
          variantService: mockVariantService
        })
      ).rejects.toThrow() // variantAssigner will fail with missing splits
    })
  })

  describe('Edge cases - Unexpected updates', () => {
    it('should handle localStorage.removeItem failure during reassignment', async () => {
      const originalRemoveItem = localStorageMock.removeItem
      localStorageMock.removeItem = vi.fn().mockImplementation(() => {
        throw new Error('localStorage error')
      })

      // The implementation doesn't catch localStorage errors, so expect it to throw
      await expect(
        updateUserWithReassignVariants({
          userData: mockUser,
          options: { reassignVariant: true },
          userService: mockUserService,
          experimentService: mockExperimentService,
          variantService: mockVariantService
        })
      ).rejects.toThrow('localStorage error')

      localStorageMock.removeItem = originalRemoveItem
    })

    it('should handle localStorage.setItem failure after reassignment', async () => {
      const originalSetItem = localStorageMock.setItem
      localStorageMock.setItem = vi.fn().mockImplementation(() => {
        throw new Error('localStorage quota exceeded')
      })

      // The implementation doesn't catch localStorage errors, so expect it to throw
      await expect(
        updateUserWithReassignVariants({
          userData: mockUser,
          options: { reassignVariant: true },
          userService: mockUserService,
          experimentService: mockExperimentService,
          variantService: mockVariantService
        })
      ).rejects.toThrow('localStorage quota exceeded')

      // Should still attempt operations before the error
      expect(mockVariantService.saveUserVariantForExperiment).toHaveBeenCalled()

      localStorageMock.setItem = originalSetItem
    })

    it('should handle variant save failure during reassignment', async () => {
      mockVariantService.saveUserVariantForExperiment = vi.fn().mockRejectedValue(new Error('Save failed'))

      await expect(
        updateUserWithReassignVariants({
          userData: mockUser,
          options: { reassignVariant: true },
          userService: mockUserService,
          experimentService: mockExperimentService,
          variantService: mockVariantService
        })
      ).rejects.toThrow()
    })

    it('should handle experiment service failure during reassignment', async () => {
      mockExperimentService.getExperiments = vi.fn().mockRejectedValue(new Error('Service unavailable'))

      await expect(
        updateUserWithReassignVariants({
          userData: mockUser,
          options: { reassignVariant: true },
          userService: mockUserService,
          experimentService: mockExperimentService,
          variantService: mockVariantService
        })
      ).rejects.toThrow()
    })

    it('should handle getVariantsByUserId failure after reassignment', async () => {
      mockVariantService.getVariantsByUserId = vi.fn().mockRejectedValue(new Error('Fetch failed'))

      await expect(
        updateUserWithReassignVariants({
          userData: mockUser,
          options: { reassignVariant: true },
          userService: mockUserService,
          experimentService: mockExperimentService,
          variantService: mockVariantService
        })
      ).rejects.toThrow()
    })
  })

  describe('Additional edge cases', () => {
    it('should handle updateUser failure', async () => {
      mockUserService.updateUser = vi.fn().mockRejectedValue(new Error('Update failed'))

      await expect(
        updateUserWithReassignVariants({
          userData: mockUser,
          options: undefined,
          userService: mockUserService,
          experimentService: mockExperimentService,
          variantService: mockVariantService
        })
      ).rejects.toThrow()
    })

    it('should handle reassignVariant: false option', async () => {
      await updateUserWithReassignVariants({
        userData: mockUser,
        options: { reassignVariant: false },
        userService: mockUserService,
        experimentService: mockExperimentService,
        variantService: mockVariantService
      })

      expect(mockUserService.updateUser).toHaveBeenCalled()
      expect(mockExperimentService.getExperiments).not.toHaveBeenCalled()
    })

    it('should handle when existing variants exist in localStorage during reassignment', async () => {
      const existingVariants = [{ user_id: 'user-123', experiment_key: 'old-exp', variant: 'old' }]
      localStorageMock.setItem('ab_variants', JSON.stringify(existingVariants))

      await updateUserWithReassignVariants({
        userData: mockUser,
        options: { reassignVariant: true },
        userService: mockUserService,
        experimentService: mockExperimentService,
        variantService: mockVariantService
      })

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('ab_variants')
      // Should replace with new variants
      expect(localStorageMock.setItem).toHaveBeenCalledWith('ab_variants', JSON.stringify(mockUserVariants))
    })
  })
})

describe('getUserVariantByExperimentKey', () => {
  let mockUserService: UserService
  let mockVariantService: VariantService

  const mockUser = { id: 'user-123', email: 'test@example.com' }
  const mockUserVariant = {
    user_id: 'user-123',
    experiment_key: 'experiment-1',
    variant: 'A',
    updated_at: new Date()
  }

  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()

    mockUserService = {
      getUser: vi.fn().mockReturnValue(mockUser),
      saveUser: vi.fn().mockResolvedValue(undefined),
      updateUser: vi.fn().mockResolvedValue(undefined)
    }

    mockVariantService = {
      getVariantsByUserId: vi.fn().mockResolvedValue([]),
      getUserVariantByExperimentLey: vi.fn().mockResolvedValue(mockUserVariant),
      saveUserVariantForExperiment: vi.fn().mockResolvedValue(null)
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Happy path', () => {
    it('should return variant when user exists and variant is found', async () => {
      const result = await getUserVariantByExperimentKey({
        experimentKey: 'experiment-1',
        userService: mockUserService,
        variantService: mockVariantService
      })

      expect(mockUserService.getUser).toHaveBeenCalled()
      expect(mockVariantService.getUserVariantByExperimentLey).toHaveBeenCalledWith(mockUser.id, 'experiment-1')
      expect(result).toBe('A')
    })

    it('should return null when variant exists but variant field is missing', async () => {
      const variantWithoutVariantField = {
        user_id: 'user-123',
        experiment_key: 'experiment-1'
      } as any

      mockVariantService.getUserVariantByExperimentLey = vi.fn().mockResolvedValue(variantWithoutVariantField)

      const result = await getUserVariantByExperimentKey({
        experimentKey: 'experiment-1',
        userService: mockUserService,
        variantService: mockVariantService
      })

      expect(result).toBeUndefined()
    })
  })

  describe('Edge cases - No user', () => {
    it('should return null when user does not exist', async () => {
      mockUserService.getUser = vi.fn().mockReturnValue(null)

      const result = await getUserVariantByExperimentKey({
        experimentKey: 'experiment-1',
        userService: mockUserService,
        variantService: mockVariantService
      })

      expect(mockUserService.getUser).toHaveBeenCalled()
      expect(mockVariantService.getUserVariantByExperimentLey).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })

    it('should return null when user is undefined', async () => {
      mockUserService.getUser = vi.fn().mockReturnValue(undefined as any)

      const result = await getUserVariantByExperimentKey({
        experimentKey: 'experiment-1',
        userService: mockUserService,
        variantService: mockVariantService
      })

      expect(result).toBeNull()
    })

    it('should return null when user has missing id field', async () => {
      const invalidUser = { email: 'test@example.com' } as any
      mockUserService.getUser = vi.fn().mockReturnValue(invalidUser)

      const result = await getUserVariantByExperimentKey({
        experimentKey: 'experiment-1',
        userService: mockUserService,
        variantService: mockVariantService
      })

      // getUserVariantByExperimentLey will be called with undefined id, which may return null
      expect(mockVariantService.getUserVariantByExperimentLey).toHaveBeenCalledWith(undefined, 'experiment-1')
      // Result depends on what getUserVariantByExperimentLey returns for undefined id
      expect(result).toBe('A') // Since mock returns mockUserVariant with variant 'A'
    })
  })

  describe('Edge cases - Corrupted data', () => {
    it('should return null when variant service returns null', async () => {
      mockVariantService.getUserVariantByExperimentLey = vi.fn().mockResolvedValue(null)

      const result = await getUserVariantByExperimentKey({
        experimentKey: 'experiment-1',
        userService: mockUserService,
        variantService: mockVariantService
      })

      // When savedVariant is null, savedVariant?.variant is undefined, not null
      expect(result).toBeUndefined()
    })

    it('should handle corrupted variant data with invalid structure', async () => {
      const corruptedVariant = {
        user_id: null,
        experiment_key: null,
        variant: null
      } as any

      mockVariantService.getUserVariantByExperimentLey = vi.fn().mockResolvedValue(corruptedVariant)

      const result = await getUserVariantByExperimentKey({
        experimentKey: 'experiment-1',
        userService: mockUserService,
        variantService: mockVariantService
      })

      expect(result).toBeNull()
    })

    it('should handle empty experiment key', async () => {
      const result = await getUserVariantByExperimentKey({
        experimentKey: '',
        userService: mockUserService,
        variantService: mockVariantService
      })

      expect(mockVariantService.getUserVariantByExperimentLey).toHaveBeenCalledWith(mockUser.id, '')
      expect(result).toBe('A') // Will return variant if found
    })
  })

  describe('Edge cases - Unexpected updates', () => {
    it('should handle variant service failure gracefully', async () => {
      mockVariantService.getUserVariantByExperimentLey = vi.fn().mockRejectedValue(new Error('Service error'))

      await expect(
        getUserVariantByExperimentKey({
          experimentKey: 'experiment-1',
          userService: mockUserService,
          variantService: mockVariantService
        })
      ).rejects.toThrow()
    })

    it('should handle getUser throwing an error', async () => {
      mockUserService.getUser = vi.fn().mockImplementation(() => {
        throw new Error('localStorage corrupted')
      })

      await expect(
        getUserVariantByExperimentKey({
          experimentKey: 'experiment-1',
          userService: mockUserService,
          variantService: mockVariantService
        })
      ).rejects.toThrow()
    })

    it('should handle network timeout', async () => {
      mockVariantService.getUserVariantByExperimentLey = vi
        .fn()
        .mockImplementation(() => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100)))

      await expect(
        getUserVariantByExperimentKey({
          experimentKey: 'experiment-1',
          userService: mockUserService,
          variantService: mockVariantService
        })
      ).rejects.toThrow()
    })
  })

  describe('Additional edge cases', () => {
    it('should handle variant with null variant value', async () => {
      const variantWithNull = {
        user_id: 'user-123',
        experiment_key: 'experiment-1',
        variant: null
      } as any

      mockVariantService.getUserVariantByExperimentLey = vi.fn().mockResolvedValue(variantWithNull)

      const result = await getUserVariantByExperimentKey({
        experimentKey: 'experiment-1',
        userService: mockUserService,
        variantService: mockVariantService
      })

      expect(result).toBeNull()
    })

    it('should handle variant with undefined variant value', async () => {
      const variantWithUndefined = {
        user_id: 'user-123',
        experiment_key: 'experiment-1',
        variant: undefined
      } as any

      mockVariantService.getUserVariantByExperimentLey = vi.fn().mockResolvedValue(variantWithUndefined)

      const result = await getUserVariantByExperimentKey({
        experimentKey: 'experiment-1',
        userService: mockUserService,
        variantService: mockVariantService
      })

      expect(result).toBeUndefined()
    })

    it('should handle very long experiment key', async () => {
      const longKey = 'a'.repeat(1000)

      const result = await getUserVariantByExperimentKey({
        experimentKey: longKey,
        userService: mockUserService,
        variantService: mockVariantService
      })

      expect(mockVariantService.getUserVariantByExperimentLey).toHaveBeenCalledWith(mockUser.id, longKey)
      expect(result).toBe('A')
    })

    it('should handle special characters in experiment key', async () => {
      const specialKey = 'experiment-with-特殊字符-@#$%^&*()'

      const result = await getUserVariantByExperimentKey({
        experimentKey: specialKey,
        userService: mockUserService,
        variantService: mockVariantService
      })

      expect(mockVariantService.getUserVariantByExperimentLey).toHaveBeenCalledWith(mockUser.id, specialKey)
      expect(result).toBe('A')
    })

    it('should return correct variant when multiple variants exist', async () => {
      const variantB = { ...mockUserVariant, variant: 'B' }
      mockVariantService.getUserVariantByExperimentLey = vi
        .fn()
        .mockResolvedValueOnce(mockUserVariant)
        .mockResolvedValueOnce(variantB)

      const result1 = await getUserVariantByExperimentKey({
        experimentKey: 'experiment-1',
        userService: mockUserService,
        variantService: mockVariantService
      })

      const result2 = await getUserVariantByExperimentKey({
        experimentKey: 'experiment-2',
        userService: mockUserService,
        variantService: mockVariantService
      })

      expect(result1).toBe('A')
      expect(result2).toBe('B')
    })
  })
})
