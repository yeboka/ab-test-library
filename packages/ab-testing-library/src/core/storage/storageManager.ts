import {
  StorageCorruptionError,
  StorageQuotaExceededError,
  StorageUnavailableError,
  isQuotaExceededError
} from '../errors'

const isBrowser = typeof window !== 'undefined'

/**
 * Metadata structure for stored items
 */
interface StorageMetadata<T> {
  data: T
  version: number
  timestamp: number
  checksum?: string
}

/**
 * Current storage format version
 * Increment this when migrating storage format in the future
 */
const CURRENT_STORAGE_VERSION = 1

/**
 * StorageManager - Unified interface for all localStorage operations
 *
 * Provides:
 * - Type-safe storage with metadata (version, timestamp, checksum)
 * - Automatic error handling and recovery
 * - Browser detection
 * - Corrupted data auto-recovery
 * - Versioning support for future migrations
 */
class StorageManager {
  /**
   * Checks if storage is available in the current environment
   */
  private isAvailable(): boolean {
    return isBrowser && typeof window.localStorage !== 'undefined'
  }

  /**
   * Validates JSON string before parsing
   * @param jsonString - The JSON string to validate
   * @returns true if valid JSON
   */
  private isValidJSON(jsonString: string): boolean {
    try {
      JSON.parse(jsonString)
      return true
    } catch {
      return false
    }
  }

  /**
   * Computes a simple checksum for data integrity
   * @param data - The data to compute checksum for
   * @returns A simple hash string
   */
  private computeChecksum(data: any): string {
    try {
      const jsonString = JSON.stringify(data)
      // Simple hash function (FNV-1a inspired)
      let hash = 2166136261
      for (let i = 0; i < jsonString.length; i++) {
        hash ^= jsonString.charCodeAt(i)
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
      }
      return hash.toString(36)
    } catch {
      return ''
    }
  }

  /**
   * Validates stored metadata structure
   * @param metadata - The metadata object to validate
   * @returns true if valid metadata structure
   */
  private isValidMetadata(metadata: any): metadata is StorageMetadata<any> {
    return (
      metadata &&
      typeof metadata === 'object' &&
      'data' in metadata &&
      typeof metadata.version === 'number' &&
      typeof metadata.timestamp === 'number'
    )
  }

  /**
   * Migrates data from old format to current format
   * @param metadata - The metadata to migrate
   * @returns Migrated metadata or null if migration fails
   */
  private migrateData(metadata: StorageMetadata<any>): StorageMetadata<any> | null {
    // Future migration logic can be added here
    // For now, if version is older, we can try to upgrade it
    if (metadata.version < CURRENT_STORAGE_VERSION) {
      return {
        ...metadata,
        version: CURRENT_STORAGE_VERSION,
        timestamp: metadata.timestamp || Date.now()
      }
    }
    return metadata
  }

  /**
   * Safely removes a corrupted item from storage
   * @param key - The key to remove
   */
  private safeRemoveItem(key: string): void {
    try {
      if (this.isAvailable()) {
        window.localStorage.removeItem(key)
      }
    } catch {
      // Ignore removal errors - best effort cleanup
    }
  }

  /**
   * Retrieves an item from localStorage with type safety and error handling
   * @param key - The localStorage key
   * @returns The stored data or null if not found/corrupted
   * @throws {StorageUnavailableError} If storage is not available
   * @throws {StorageCorruptionError} If data is corrupted and cannot be recovered
   */
  getItem<T>(key: string): T | null {
    if (!this.isAvailable()) {
      throw new StorageUnavailableError('getItem')
    }

    try {
      const rawData = window.localStorage.getItem(key)

      // Item doesn't exist
      if (rawData === null || rawData === '') {
        return null
      }

      // Validate JSON before parsing
      if (!this.isValidJSON(rawData)) {
        // Attempt to recover by removing corrupted data
        this.safeRemoveItem(key)
        throw new StorageCorruptionError(key)
      }

      // Parse JSON
      let parsed: any
      try {
        parsed = JSON.parse(rawData)
      } catch (parseError) {
        this.safeRemoveItem(key)
        throw new StorageCorruptionError(key)
      }

      if (!this.isValidMetadata(parsed)) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(`[ABTesting] Legacy storage format detected for key "${key}". Consider migrating to new format.`)
        }
        return parsed as T
      }

      const migrated = this.migrateData(parsed)
      if (!migrated) {
        this.safeRemoveItem(key)
        throw new StorageCorruptionError(key)
      }

      // Validate checksum if present
      if (migrated.checksum) {
        const computedChecksum = this.computeChecksum(migrated.data)
        if (computedChecksum !== migrated.checksum && computedChecksum !== '') {
          // Checksum mismatch - data may have been tampered with
          // Log warning but still return data (don't throw)
          if (typeof console !== 'undefined' && console.warn) {
            console.warn(`[ABTesting] Checksum mismatch for key "${key}". Data integrity may be compromised.`)
          }
        }
      }

      return migrated.data as T
    } catch (err) {
      // Re-throw known errors
      if (err instanceof StorageCorruptionError || err instanceof StorageUnavailableError) {
        throw err
      }

      // Unknown error - treat as corruption
      this.safeRemoveItem(key)
      throw new StorageCorruptionError(key)
    }
  }

  /**
   * Stores an item in localStorage with metadata
   * @param key - The localStorage key
   * @param value - The value to store
   * @throws {StorageUnavailableError} If storage is not available
   * @throws {StorageQuotaExceededError} If storage quota is exceeded
   * @throws {StorageCorruptionError} If storage operation fails
   */
  setItem<T>(key: string, value: T): void {
    if (!this.isAvailable()) {
      throw new StorageUnavailableError('setItem')
    }

    try {
      // Validate value can be serialized
      let serializedValue: string
      try {
        serializedValue = JSON.stringify(value)
      } catch (serializeError) {
        throw new StorageCorruptionError(key)
      }

      // Validate JSON before storing
      if (!this.isValidJSON(serializedValue)) {
        throw new StorageCorruptionError(key)
      }

      // Create metadata wrapper
      const metadata: StorageMetadata<T> = {
        data: value,
        version: CURRENT_STORAGE_VERSION,
        timestamp: Date.now(),
        checksum: this.computeChecksum(value)
      }

      // Serialize metadata
      let serializedMetadata: string
      try {
        serializedMetadata = JSON.stringify(metadata)
      } catch (metadataError) {
        throw new StorageCorruptionError(key)
      }

      try {
        window.localStorage.setItem(key, serializedMetadata)
      } catch (storageError: any) {
        if (isQuotaExceededError(storageError)) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn(`[ABTesting] localStorage quota exceeded for key "${key}". Data not saved.`)
          }
          throw new StorageQuotaExceededError(key)
        }

        throw new StorageCorruptionError(key)
      }
    } catch (err) {
      if (
        err instanceof StorageQuotaExceededError ||
        err instanceof StorageCorruptionError ||
        err instanceof StorageUnavailableError
      ) {
        throw err
      }

      throw new StorageCorruptionError(key)
    }
  }

  /**
   * Removes an item from localStorage
   * @param key - The localStorage key to remove
   * @throws {StorageUnavailableError} If storage is not available
   */
  removeItem(key: string): void {
    if (!this.isAvailable()) {
      throw new StorageUnavailableError('removeItem')
    }

    try {
      window.localStorage.removeItem(key)
    } catch (err) {
      // For removal, we're more lenient - log but don't throw for most errors
      // Only throw if storage is completely unavailable
      if (err instanceof Error && err.message.includes('not available')) {
        throw new StorageUnavailableError('removeItem')
      }

      // Other errors during removal are non-critical, log and continue
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(`[ABTesting] Failed to remove item "${key}" from localStorage:`, err)
      }
    }
  }

  /**
   * Checks if an item exists in storage
   * @param key - The localStorage key to check
   * @returns true if item exists, false otherwise
   */
  hasItem(key: string): boolean {
    if (!this.isAvailable()) {
      return false
    }

    try {
      const item = window.localStorage.getItem(key)
      return item !== null && item !== ''
    } catch {
      return false
    }
  }

  /**
   * Clears all localStorage items (use with caution)
   * @throws {StorageUnavailableError} If storage is not available
   */
  clear(): void {
    if (!this.isAvailable()) {
      throw new StorageUnavailableError('clear')
    }

    try {
      window.localStorage.clear()
    } catch (err) {
      throw new StorageUnavailableError('clear')
    }
  }
}

/**
 * Singleton instance of StorageManager
 * Export this for use throughout the library
 */
export const storageManager = new StorageManager()
