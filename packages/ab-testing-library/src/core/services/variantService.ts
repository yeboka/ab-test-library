import { UserVariant } from '../types'
import { remoteStorage } from './api'
import {
  StorageCorruptionError,
  StorageQuotaExceededError,
  StorageUnavailableError,
  VariantOperationError
} from '../errors'
import { storageManager } from '../storage/storageManager'
import { syncQueue, registerSyncHandler } from '../storage/syncQueue'

/**
 * Staleness threshold in milliseconds (5 minutes)
 */
const STALENESS_THRESHOLD_MS = 5 * 60 * 1000

/**
 * Key for storing variant data timestamp
 */
const VARIANTS_TIMESTAMP_KEY = 'ab_variants_timestamp'

export interface VariantService {
  getVariantsByUserId(userId: string): Promise<UserVariant[] | null>
  getUserVariantByExperimentLey(user_id: string, experimentKey: string): Promise<UserVariant | null>
  saveUserVariantForExperiment(userId: string, experimentKey: string, variant: string): Promise<void>
}

/**
 * Check if variant data is stale
 */
function isStale(): boolean {
  try {
    const timestamp = storageManager.getItem<number>(VARIANTS_TIMESTAMP_KEY)
    if (!timestamp) {
      return true
    }
    return Date.now() - timestamp > STALENESS_THRESHOLD_MS
  } catch {
    return true
  }
}

/**
 * Update variant data timestamp
 */
function updateTimestamp(): void {
  try {
    storageManager.setItem(VARIANTS_TIMESTAMP_KEY, Date.now())
  } catch {
    // Non-critical, ignore
  }
}

/**
 * Sync variant operation to remote storage
 */
async function syncVariantOperation(operation: import('../storage/syncQueue').SyncOperation): Promise<void> {
  const { data } = operation

  if (operation.operation === 'create' || operation.operation === 'update') {
    const { userId, experimentKey, variant } = data
    await remoteStorage.saveVariant(userId, experimentKey, variant)
    updateTimestamp()
  }
}

/**
 * Process pending variant sync operations in background
 */
async function processPendingSyncs(): Promise<void> {
  try {
    await syncQueue.processByType('variant', syncVariantOperation)
  } catch (error) {
    // Background sync failures are non-critical
    if (typeof console !== 'undefined' && console.error) {
      console.error('[ABTesting] Background sync failed:', error)
    }
  }
}

// Register sync handler for online event processing
registerSyncHandler('variant', syncVariantOperation)

export const variantService: VariantService = {
  async getVariantsByUserId(userId: string) {
    // Step 1: Read from localStorage first
    let variants: UserVariant[] | null = null

    try {
      variants = storageManager.getItem<UserVariant[]>('ab_variants')

      // Check if data exists and is not stale
      if (variants && variants.length > 0 && !isStale()) {
        return variants
      }
    } catch (err) {
      if (err instanceof StorageCorruptionError) {
        // Corrupted data, will fetch from remote
        variants = null
      } else if (err instanceof StorageUnavailableError) {
        // Not in browser, fetch from remote
        try {
          return await remoteStorage.getVariants(userId)
        } catch (remoteErr) {
          const errorMessage = remoteErr instanceof Error ? remoteErr.message : String(remoteErr)
          throw new VariantOperationError('get', userId, 'all', errorMessage)
        }
      } else if (err instanceof StorageQuotaExceededError) {
        // Quota exceeded, will fetch from remote
        variants = null
      } else {
        // Unknown error, try to recover from remote
        variants = null
      }
    }

    // Step 2: If localStorage is empty or stale, fetch from Supabase
    try {
      const remoteVariants = await remoteStorage.getVariants(userId)

      // Step 3: Update localStorage with fetched data
      if (remoteVariants && remoteVariants.length > 0) {
        try {
          storageManager.setItem('ab_variants', remoteVariants)
          updateTimestamp()
        } catch (storageError) {
          // StorageManager handles quota exceeded errors - log if needed
          if (!(storageError instanceof StorageUnavailableError || storageError instanceof StorageQuotaExceededError)) {
            console.error(storageError)
          }
        }
      }

      return remoteVariants
    } catch (err) {
      // If remote fetch fails but we have local data, return local data
      if (variants && variants.length > 0) {
        return variants
      }

      const errorMessage = err instanceof Error ? err.message : String(err)
      throw new VariantOperationError('get', userId, 'all', errorMessage)
    }
  },

  async getUserVariantByExperimentLey(user_id: string, experimentKey: string) {
    let variants: UserVariant[] = []

    // Step 1: Read from localStorage first
    try {
      const storedVariants = storageManager.getItem<UserVariant[]>('ab_variants')
      variants = storedVariants || []

      // Check if we have the specific variant and data is not stale
      const variant = variants.find(v => v.experiment_key === experimentKey)
      if (variant && !isStale()) {
        return variant
      }
    } catch (err) {
      if (
        err instanceof StorageCorruptionError ||
        err instanceof StorageUnavailableError ||
        err instanceof StorageQuotaExceededError
      ) {
        // If corrupted, unavailable, or quota exceeded, start with empty array
        variants = []
      } else {
        variants = []
      }
    }

    // Step 2: If not found locally or stale, fetch from remote
    try {
      const remoteVariant = await remoteStorage.getVariant(user_id, experimentKey)
      if (!remoteVariant) {
        return null
      }

      // Step 3: Update localStorage with fetched data
      const existingIndex = variants.findIndex(v => v.experiment_key === experimentKey && v.user_id === user_id)

      if (existingIndex >= 0) {
        variants[existingIndex] = remoteVariant
      } else {
        variants.push(remoteVariant)
      }

      try {
        storageManager.setItem('ab_variants', variants)
        updateTimestamp()
      } catch (storageError) {
        // StorageManager handles quota exceeded - log if needed
        if (!(storageError instanceof StorageUnavailableError || storageError instanceof StorageQuotaExceededError)) {
          console.error(storageError)
        }
      }

      return remoteVariant
    } catch (err) {
      // If remote fetch fails but we have local variant, return local variant
      const localVariant = variants.find(v => v.experiment_key === experimentKey)
      if (localVariant) {
        return localVariant
      }

      const errorMessage = err instanceof Error ? err.message : String(err)
      throw new VariantOperationError('get', user_id, experimentKey, errorMessage)
    }
  },

  async saveUserVariantForExperiment(userId: string, experimentKey: string, variant: string) {
    // Step 1: Update localStorage immediately (optimistic update)
    try {
      const variants: UserVariant[] = storageManager.getItem<UserVariant[]>('ab_variants') || []
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

      storageManager.setItem('ab_variants', variants)
      updateTimestamp()
    } catch (err) {
      if (
        err instanceof StorageUnavailableError ||
        err instanceof StorageCorruptionError ||
        err instanceof StorageQuotaExceededError
      ) {
        // Storage unavailable, corrupted, or quota exceeded - will queue for sync, continue
      } else {
        const errorMessage = err instanceof Error ? err.message : String(err)
        throw new VariantOperationError('save', userId, experimentKey, errorMessage)
      }
    }

    // Step 2: Queue for sync
    syncQueue.add('variant', 'update', {
      userId,
      experimentKey,
      variant
    })

    // Step 3: Sync to Supabase in background (non-blocking)
    processPendingSyncs().catch(error => {
      // Background sync errors are non-critical, already logged in processPendingSyncs
      if (typeof console !== 'undefined' && console.error) {
        console.error('[ABTesting] Background sync error:', error)
      }
    })
  }
}
