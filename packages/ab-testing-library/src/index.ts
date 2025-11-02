import { setRemoteStorageAdapter, IRemoteStorageAdapter } from './core/adapters/remoteStorageAdapter'
import { setHashingConfig } from './core/variant-assigner/config'
import { subscribeToExperimentUpdates } from './core/services/realtimeListener'
import { userService } from './core/services/userService'
import { experimentService } from './core/services/experimentService'
import { variantService } from './core/services/variantService'
import { getUserVariantByExperimentKey, initUserExperimentsAndVariants, updateUserWithReassignVariants } from './core'

export const initializeUser = async (userData: { id: string; email: string }) => {
  await initUserExperimentsAndVariants({ userData, userService, experimentService, variantService })
}

export const updateUser = async (userData: { id: string; email: string }, options?: { reassignVariant?: boolean }) => {
  await updateUserWithReassignVariants({ userData, options, userService, experimentService, variantService })
}

export const getVariant = async (experimentKey: string) => {
  return await getUserVariantByExperimentKey({ experimentKey, userService, variantService })
}

export async function initializeLibrary(options: {
  adapter: IRemoteStorageAdapter
  hashing?: { salt?: string; version?: number }
}) {
  setRemoteStorageAdapter(options.adapter)
  if (options.hashing) setHashingConfig(options.hashing)
  const unsubscribe = subscribeToExperimentUpdates()
  return () => {
    unsubscribe()
  }
}

export { createSupabaseAdapter } from './core/adapters/supabaseAdapter'

export {
  ABTestError,
  InitializationError,
  StorageCorruptionError,
  StorageQuotaExceededError,
  StorageUnavailableError,
  ExperimentNotFoundError,
  UserNotInitializedError,
  UserIdMismatchError,
  AdapterNotInitializedError,
  GetUserErrorSupabase,
  SaveUserErrorSupabase,
  GetExperimentsError,
  VariantOperationError,
  RealtimeConnectionError,
  NetworkError,
  isQuotaExceededError,
  handleStorageError
} from './core/errors'
