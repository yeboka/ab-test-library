import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { initUserExperimentsAndVariants } from '../index'
import type { UserService } from '../services/userService'
import type { ExperimentService } from '../services/experimentService'
import type { VariantService } from '../services/variantService'
import { createLocalStorageMock, setupLocalStorageMock, expectWrappedStorage, type StorageMock } from './testUtils'

const localStorageMock = createLocalStorageMock()
setupLocalStorageMock(localStorageMock)

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
      const quotaError: any = new Error('localStorage quota exceeded')
      quotaError.name = 'QuotaExceededError'
      localStorageMock.setItem = vi.fn().mockImplementation(() => {
        throw quotaError
      })

      mockVariantService.getUserVariantByExperimentLey = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ user_id: mockUser.id, experiment_key: 'experiment-1', variant: 'A' })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ user_id: mockUser.id, experiment_key: 'experiment-2', variant: 'B' })

      // The implementation catches quota errors silently, so expect it to not throw
      await initUserExperimentsAndVariants({
        userData: mockUser,
        userService: mockUserService,
        experimentService: mockExperimentService,
        variantService: mockVariantService
      })

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
      expectWrappedStorage('ab_variants', [], localStorageMock)
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
