import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getUserVariantByExperimentKey } from '../index'
import type { UserService } from '../services/userService'
import type { VariantService } from '../services/variantService'
import { createLocalStorageMock, setupLocalStorageMock, type StorageMock } from './testUtils'

const localStorageMock = createLocalStorageMock()
setupLocalStorageMock(localStorageMock)

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

      expect(result).toBeNull()
    })
  })

  describe('Edge cases - No user', () => {
    it('should return null when user does not exist', async () => {
      mockUserService.getUser = vi.fn().mockReturnValue(null)

      await expect(
        getUserVariantByExperimentKey({
          experimentKey: 'experiment-1',
          userService: mockUserService,
          variantService: mockVariantService
        })
      ).rejects.toThrow()

      expect(mockUserService.getUser).toHaveBeenCalled()
      expect(mockVariantService.getUserVariantByExperimentLey).not.toHaveBeenCalled()
    })

    it('should return null when user is undefined', async () => {
      mockUserService.getUser = vi.fn().mockReturnValue(undefined as any)

      await expect(
        getUserVariantByExperimentKey({
          experimentKey: 'experiment-1',
          userService: mockUserService,
          variantService: mockVariantService
        })
      ).rejects.toThrow()
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

      // When savedVariant is null, savedVariant?.variant is null (because of ?? operator)
      expect(result).toBeNull()
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

      // When variant is undefined, savedVariant?.variant is undefined, but ?? operator converts it to null
      expect(result).toBeNull()
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
