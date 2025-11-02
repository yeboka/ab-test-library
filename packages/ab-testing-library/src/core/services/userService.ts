import { remoteStorage } from './api'
import {
  StorageCorruptionError,
  StorageQuotaExceededError,
  StorageUnavailableError,
  UserNotInitializedError,
  UserIdMismatchError,
  NetworkError
} from '../errors'
import { storageManager } from '../storage/storageManager'
import { syncQueue, registerSyncHandler } from '../storage/syncQueue'

/**
 * Staleness threshold in milliseconds (5 minutes)
 */
const STALENESS_THRESHOLD_MS = 5 * 60 * 1000

/**
 * Key for storing user data timestamp
 */
const USER_TIMESTAMP_KEY = 'ab_user_timestamp'

export interface UserService {
  getUser(): { id: string; email: string } | null
  saveUser(user: { id: string; email: string }): Promise<void>
  updateUser(user: { id: string; email: string }): Promise<void>
}

/**
 * Check if user data is stale
 */
function isUserStale(): boolean {
  try {
    const timestamp = storageManager.getItem<number>(USER_TIMESTAMP_KEY)
    if (!timestamp) {
      return true
    }
    return Date.now() - timestamp > STALENESS_THRESHOLD_MS
  } catch {
    return true
  }
}

/**
 * Update user data timestamp
 */
function updateUserTimestamp(): void {
  try {
    storageManager.setItem(USER_TIMESTAMP_KEY, Date.now())
  } catch {
    // Non-critical, ignore
  }
}

/**
 * Sync user operation to remote storage
 */
async function syncUserOperation(operation: import('../storage/syncQueue').SyncOperation): Promise<void> {
  const { data } = operation

  if (operation.operation === 'create') {
    const user = data as { id: string; email: string }
    const existing = await remoteStorage.getUser(user.id)
    if (!existing) {
      await remoteStorage.saveUser(user)
    } else {
      // User already exists, update instead
      await remoteStorage.saveUser(user)
    }
    updateUserTimestamp()
  } else if (operation.operation === 'update') {
    const user = data as { id: string; email: string }
    await remoteStorage.saveUser(user)
    updateUserTimestamp()
  }
}

/**
 * Process pending user sync operations in background
 */
async function processPendingUserSyncs(): Promise<void> {
  try {
    await syncQueue.processByType('user', syncUserOperation)
  } catch (error) {
    // Background sync failures are non-critical
    if (typeof console !== 'undefined' && console.error) {
      console.error('[ABTesting] Background user sync failed:', error)
    }
  }
}

// Register sync handler for online event processing
registerSyncHandler('user', syncUserOperation)

export const userService = {
  getUser() {
    // Step 1: Read from localStorage first
    try {
      const user = storageManager.getItem<{ id: string; email: string }>('ab_user')

      // If user exists and is not stale, return it
      if (user && !isUserStale()) {
        return user
      }

      // If stale, try to fetch from remote (but return local for now)
      // The fetch will happen in background
      if (user && isUserStale()) {
        // Start background refresh (non-blocking)
        this.refreshUser(user.id).catch(() => {
          // Background refresh failures are non-critical
        })
      }

      return user
    } catch (err) {
      if (err instanceof StorageUnavailableError) {
        return null
      }
      if (err instanceof StorageCorruptionError) {
        throw err
      }
      throw new StorageCorruptionError('ab_user')
    }
  },

  /**
   * Refresh user data from remote (non-blocking)
   */
  async refreshUser(userId: string): Promise<void> {
    try {
      const remoteUser = await remoteStorage.getUser(userId)
      if (remoteUser) {
        try {
          storageManager.setItem('ab_user', remoteUser)
          updateUserTimestamp()
        } catch (storageError) {
          // Non-critical, log only
          if (typeof console !== 'undefined' && console.error) {
            console.error('[ABTesting] Failed to update user in localStorage:', storageError)
          }
        }
      }
    } catch (error) {
      // Background refresh failures are non-critical
      if (typeof console !== 'undefined' && console.error) {
        console.error('[ABTesting] Failed to refresh user from remote:', error)
      }
    }
  },

  async saveUser(user: { id: string; email: string }) {
    // Step 1: Update localStorage immediately (optimistic update)
    try {
      storageManager.setItem('ab_user', user)
      storageManager.removeItem('ab_variants')
      updateUserTimestamp()
    } catch (err) {
      if (
        err instanceof StorageQuotaExceededError ||
        err instanceof StorageCorruptionError ||
        err instanceof StorageUnavailableError
      ) {
        throw err
      }
      const errorMessage = err instanceof Error ? err.message : String(err)
      throw new StorageCorruptionError('ab_user')
    }

    // Step 2: Queue for sync
    syncQueue.add('user', 'create', user)

    // Step 3: Sync to Supabase in background (non-blocking)
    processPendingUserSyncs().catch(error => {
      // Background sync errors are non-critical, already logged in processPendingUserSyncs
      if (typeof console !== 'undefined' && console.error) {
        console.error('[ABTesting] Background user save sync error:', error)
      }
    })
  },

  async updateUser(user: { id: string; email: string }) {
    const currentUser = this.getUser()
    if (!currentUser) {
      throw new UserNotInitializedError()
    }
    if (currentUser.id !== user.id) {
      throw new UserIdMismatchError(currentUser.id, user.id)
    }

    try {
      storageManager.setItem('ab_user', user)
      updateUserTimestamp()
    } catch (err) {
      if (
        err instanceof StorageQuotaExceededError ||
        err instanceof StorageCorruptionError ||
        err instanceof StorageUnavailableError ||
        err instanceof UserNotInitializedError ||
        err instanceof UserIdMismatchError
      ) {
        throw err
      }
      const errorMessage = err instanceof Error ? err.message : String(err)
      throw new StorageCorruptionError('ab_user')
    }

    // Step 2: Queue for sync
    syncQueue.add('user', 'update', user)

    // Step 3: Sync to Supabase in background (non-blocking)
    processPendingUserSyncs().catch(error => {
      // Background sync errors are non-critical, already logged in processPendingUserSyncs
      if (typeof console !== 'undefined' && console.error) {
        console.error('[ABTesting] Background user update sync error:', error)
      }
    })
  }
}
