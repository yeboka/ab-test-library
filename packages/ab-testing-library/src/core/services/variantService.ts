import { UserVariant } from '../types'
import { remoteStorage } from './api'
import { StorageCorruptionError, StorageUnavailableError, VariantOperationError, isQuotaExceededError } from '../errors'

const isBrowser = typeof window !== 'undefined'

export interface VariantService {
  getVariantsByUserId(userId: string): Promise<UserVariant[] | null>
  getUserVariantByExperimentLey(user_id: string, experimentKey: string): Promise<UserVariant | null>
  saveUserVariantForExperiment(userId: string, experimentKey: string, variant: string): Promise<void>
}

export const variantService: VariantService = {
  async getVariantsByUserId(userId: string) {
    if (!isBrowser) {
      try {
        return await remoteStorage.getVariants(userId)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        throw new VariantOperationError('get', userId, 'all', errorMessage)
      }
    }
    try {
      const data = window.localStorage.getItem('ab_variants')
      if (!data || data === '[]') {
        try {
          const remoteVariants = await remoteStorage.getVariants(userId)
          if (remoteVariants && remoteVariants.length > 0) {
            try {
              window.localStorage.setItem('ab_variants', JSON.stringify(remoteVariants))
            } catch (storageError: any) {
              if (!isQuotaExceededError(storageError)) {
                console.error(storageError)
              }
            }
          }
          return remoteVariants
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err)
          throw new VariantOperationError('get', userId, 'all', errorMessage)
        }
      }
      try {
        return JSON.parse(data) as UserVariant[]
      } catch (parseError) {
        try {
          window.localStorage.removeItem('ab_variants')
        } catch {
          // Ignore removal errors
        }
        try {
          const remoteVariants = await remoteStorage.getVariants(userId)
          return remoteVariants
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err)
          throw new VariantOperationError('get', userId, 'all', errorMessage)
        }
      }
    } catch (err) {
      if (err instanceof VariantOperationError) {
        throw err
      }
      throw new StorageCorruptionError('ab_variants')
    }
  },

  async getUserVariantByExperimentLey(user_id: string, experimentKey: string) {
    if (!isBrowser) {
      try {
        return await remoteStorage.getVariant(user_id, experimentKey)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        throw new VariantOperationError('get', user_id, experimentKey, errorMessage)
      }
    }
    let variants: UserVariant[]
    try {
      const data = window.localStorage.getItem('ab_variants')
      if (!data) {
        variants = []
      } else {
        try {
          variants = JSON.parse(data) as UserVariant[]
        } catch (parseError) {
          try {
            window.localStorage.removeItem('ab_variants')
          } catch {
            // Ignore removal errors
          }
          variants = []
        }
      }
    } catch (err) {
      if (err instanceof StorageCorruptionError) {
        throw err
      }
      variants = []
    }

    let variant = variants.find(v => v.experiment_key === experimentKey)
    if (variant) {
      return variant
    }

    try {
      const remoteVariant = await remoteStorage.getVariant(user_id, experimentKey)
      if (!remoteVariant) {
        return null
      }
      variants.push(remoteVariant)
      try {
        window.localStorage.setItem('ab_variants', JSON.stringify(variants))
      } catch (storageError: any) {
        if (isQuotaExceededError(storageError)) {
          console.error(storageError)
        }
      }
      return remoteVariant
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      throw new VariantOperationError('get', user_id, experimentKey, errorMessage)
    }
  },

  async saveUserVariantForExperiment(userId: string, experimentKey: string, variant: string) {
    if (!isBrowser) {
      throw new StorageUnavailableError('saveUserVariantForExperiment')
    }
    await remoteStorage.saveVariant(userId, experimentKey, variant)
    try {
      const data = window.localStorage.getItem('ab_variants')
      const variants: UserVariant[] = data ? JSON.parse(data) : []
      const existingIndex = variants.findIndex(v => v.experiment_key === experimentKey && v.user_id === userId)
      const updatedVariant: UserVariant = {
        user_id: userId,
        experiment_key: experimentKey,
        variant,
        updated_at: new Date().toISOString()
      }
      if (existingIndex >= 0) {
        variants[existingIndex] = updatedVariant
      } else {
        variants.push(updatedVariant)
      }
      try {
        window.localStorage.setItem('ab_variants', JSON.stringify(variants))
      } catch (storageError: any) {
        if (!isQuotaExceededError(storageError)) {
          console.error(storageError)
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      throw new VariantOperationError('save', userId, experimentKey, errorMessage)
    }
  }
}
