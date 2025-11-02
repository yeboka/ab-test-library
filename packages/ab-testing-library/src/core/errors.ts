/**
 * Base error class for all AB Testing library errors.
 * Provides consistent error formatting and type checking.
 */
export class ABTestError extends Error {
  constructor(message: string) {
    super(`[ABTesting] ${message}`)
    this.name = 'ABTestError'
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ABTestError)
    }
  }
}

/**
 * Thrown when library methods are called before proper initialization.
 * Helpful message guides users to call initializeUser() first.
 */
export class InitializationError extends ABTestError {
  constructor(methodName?: string) {
    const methodContext = methodName ? ` in ${methodName}()` : ''
    super(`Library not initialized${methodContext}. Call initializeUser() before using getVariant() or other methods.`)
  }
}

/**
 * Thrown when localStorage data cannot be parsed or is corrupted.
 * Provides guidance on recovery options.
 */
export class StorageCorruptionError extends ABTestError {
  constructor(key?: string) {
    const keyContext = key ? ` for key "${key}"` : ''
    super(
      `Failed to parse localStorage data${keyContext}. Data might be corrupted. Try clearing localStorage or reinitializing the user.`
    )
  }
}

/**
 * Thrown when localStorage write operation fails (e.g., quota exceeded).
 */
export class StorageQuotaExceededError extends ABTestError {
  constructor(key?: string) {
    const keyContext = key ? ` for key "${key}"` : ''
    super(`localStorage quota exceeded${keyContext}. Cannot save data. User may need to clear browser storage.`)
  }
}

/**
 * Thrown when localStorage is not available (e.g., in SSR environment).
 */
export class StorageUnavailableError extends ABTestError {
  constructor(operation: string) {
    super(
      `localStorage is not available for ${operation}. This may occur in server-side environments. Ensure you're running in a browser context.`
    )
  }
}

/**
 * Thrown when an experiment key is not found in the available experiments.
 */
export class ExperimentNotFoundError extends ABTestError {
  constructor(key: string) {
    super(`Experiment with key "${key}" not found. Ensure the experiment exists and is enabled.`)
  }
}

/**
 * Thrown when attempting to update user before initialization.
 */
export class UserNotInitializedError extends ABTestError {
  constructor() {
    super('Cannot update user: user has not been initialized. Call initializeUser() first.')
  }
}

/**
 * Thrown when attempting to update user with a different user ID.
 */
export class UserIdMismatchError extends ABTestError {
  constructor(currentId: string, attemptedId: string) {
    super(
      `Cannot update user: user ID mismatch. Current user ID is "${currentId}", attempted to update with "${attemptedId}".`
    )
  }
}

/**
 * Thrown when remote storage adapter is not initialized.
 */
export class AdapterNotInitializedError extends ABTestError {
  constructor() {
    super(
      'RemoteStorageAdapter not initialized. Call initializeLibrary() with an adapter before using library methods.'
    )
  }
}

/**
 * Thrown when Supabase getUser operation fails.
 */
export class GetUserErrorSupabase extends ABTestError {
  constructor(message: string, userId?: string) {
    const userContext = userId ? ` for user "${userId}"` : ''
    super(`Failed to get user from Supabase${userContext}. Supabase error: ${message}`)
  }
}

/**
 * Thrown when Supabase saveUser operation fails.
 */
export class SaveUserErrorSupabase extends ABTestError {
  constructor(message: string, userId?: string) {
    const userContext = userId ? ` for user "${userId}"` : ''
    super(`Failed to save or update user in Supabase${userContext}. Supabase error: ${message}`)
  }
}

/**
 * Thrown when Supabase getExperiments operation fails.
 */
export class GetExperimentsError extends ABTestError {
  constructor(underlyingError?: string) {
    const errorContext = underlyingError ? `: ${underlyingError}` : ''
    super(`Failed to fetch experiments from remote storage${errorContext}.`)
  }
}

/**
 * Thrown when Supabase variant operations fail.
 */
export class VariantOperationError extends ABTestError {
  constructor(operation: 'get' | 'save', userId: string, experimentKey: string, underlyingError?: string) {
    const errorContext = underlyingError ? `: ${underlyingError}` : ''
    super(`Failed to ${operation} variant for user "${userId}" and experiment "${experimentKey}"${errorContext}.`)
  }
}

/**
 * Thrown when realtime connection fails or times out.
 */
export class RealtimeConnectionError extends ABTestError {
  constructor(reason?: 'timeout' | 'error' | 'closed') {
    const reasonContext = reason ? ` (${reason})` : ''
    super(`Realtime connection failed${reasonContext}. Library will continue in local-only mode.`)
  }
}

/**
 * Thrown when network requests fail or timeout.
 */
export class NetworkError extends ABTestError {
  constructor(operation: string, underlyingError?: string) {
    const errorContext = underlyingError ? `: ${underlyingError}` : ''
    super(`Network error during ${operation}${errorContext}. Please check your connection and try again.`)
  }
}

/**
 * Utility to check if an error is a localStorage quota exceeded error.
 * @param error - The error to check
 * @returns true if the error is a quota exceeded error
 */
export function isQuotaExceededError(error: any): boolean {
  return error?.name === 'QuotaExceededError' || error?.code === 22
}

/**
 * Handles localStorage errors by checking for quota exceeded and throwing appropriate errors.
 * If the error is not quota exceeded, throws StorageCorruptionError.
 * @param error - The error to handle
 * @param key - The localStorage key that caused the error
 * @throws {StorageQuotaExceededError} If quota is exceeded
 * @throws {StorageCorruptionError} If it's a different storage error
 */
export function handleStorageError(error: any, key?: string): never {
  if (isQuotaExceededError(error)) {
    throw new StorageQuotaExceededError(key)
  }
  throw new StorageCorruptionError(key)
}
