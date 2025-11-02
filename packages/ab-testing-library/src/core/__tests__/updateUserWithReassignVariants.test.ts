import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { updateUserWithReassignVariants } from '../index'
import type { UserService } from '../services/userService'
import type { ExperimentService } from '../services/experimentService'
import type { VariantService } from '../services/variantService'
import { createLocalStorageMock, setupLocalStorageMock, expectWrappedStorage, type StorageMock } from './testUtils'

const localStorageMock = createLocalStorageMock()
setupLocalStorageMock(localStorageMock)

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
      expectWrappedStorage('ab_variants', mockUserVariants, localStorageMock)
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
      // Should not set localStorage if variants is null
      expect(localStorageMock.setItem).not.toHaveBeenCalled()
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

      // The implementation catches localStorage errors silently, so expect it to not throw
      await updateUserWithReassignVariants({
        userData: mockUser,
        options: { reassignVariant: true },
        userService: mockUserService,
        experimentService: mockExperimentService,
        variantService: mockVariantService
      })

      // Should still attempt operations before the error
      expect(mockUserService.updateUser).toHaveBeenCalled()
      expect(mockVariantService.saveUserVariantForExperiment).toHaveBeenCalled()

      localStorageMock.removeItem = originalRemoveItem
    })

    it('should handle localStorage.setItem failure after reassignment', async () => {
      const originalSetItem = localStorageMock.setItem
      const quotaError: any = new Error('localStorage quota exceeded')
      quotaError.name = 'QuotaExceededError'
      localStorageMock.setItem = vi.fn().mockImplementation(() => {
        throw quotaError
      })

      // The implementation catches quota errors silently, so expect it to not throw
      await updateUserWithReassignVariants({
        userData: mockUser,
        options: { reassignVariant: true },
        userService: mockUserService,
        experimentService: mockExperimentService,
        variantService: mockVariantService
      })

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
      expectWrappedStorage('ab_variants', mockUserVariants, localStorageMock)
    })
  })
})
