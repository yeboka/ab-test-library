import { remoteStorage } from './api'
import {
  StorageCorruptionError,
  StorageQuotaExceededError,
  StorageUnavailableError,
  UserNotInitializedError,
  UserIdMismatchError,
  NetworkError,
  handleStorageError
} from '../errors'

const isBrowser = typeof window !== 'undefined'

export interface UserService {
  getUser(): { id: string; email: string } | null
  saveUser(user: { id: string; email: string }): Promise<void>
  updateUser(user: { id: string; email: string }): Promise<void>
}

export const userService = {
  getUser() {
    if (!isBrowser) return null
    try {
      const data = window.localStorage.getItem('ab_user')
      if (!data) return null
      try {
        return JSON.parse(data) as { id: string; email: string }
      } catch (parseError) {
        try {
          window.localStorage.removeItem('ab_user')
        } catch {
          // Ignore removal errors
        }
        throw new StorageCorruptionError('ab_user')
      }
    } catch (err) {
      if (err instanceof StorageCorruptionError) {
        throw err
      }
      throw new StorageCorruptionError('ab_user')
    }
  },

  async saveUser(user: { id: string; email: string }) {
    if (!isBrowser) {
      throw new StorageUnavailableError('saveUser')
    }
    try {
      let remoteUser = await remoteStorage.getUser(user.id)
      if (!remoteUser) {
        await remoteStorage.saveUser(user)
      } else {
        user = remoteUser as { id: string; email: string }
      }
      try {
        window.localStorage.setItem('ab_user', JSON.stringify(user))
        window.localStorage.removeItem('ab_variants')
      } catch (storageError: any) {
        handleStorageError(storageError, 'ab_user')
      }
    } catch (err) {
      if (
        err instanceof StorageQuotaExceededError ||
        err instanceof StorageCorruptionError ||
        err instanceof StorageUnavailableError
      ) {
        throw err
      }
      const errorMessage = err instanceof Error ? err.message : String(err)
      throw new NetworkError('saveUser', errorMessage)
    }
  },

  async updateUser(user: { id: string; email: string }) {
    if (!isBrowser) {
      throw new StorageUnavailableError('updateUser')
    }
    const currentUser = this.getUser()
    if (!currentUser) {
      throw new UserNotInitializedError()
    }
    if (currentUser.id !== user.id) {
      throw new UserIdMismatchError(currentUser.id, user.id)
    }
    try {
      try {
        window.localStorage.setItem('ab_user', JSON.stringify(user))
      } catch (storageError: any) {
        handleStorageError(storageError, 'ab_user')
      }
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
      throw new NetworkError('updateUser', errorMessage)
    }
  }
}
