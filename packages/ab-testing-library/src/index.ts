import { storage } from './core/storage/storage'
import { variantAssigner } from './core/variantAssigner'
import { experimentRegistry } from './core/experiments/experimentRegistry'
import { setRemoteStorageAdapter, IRemoteStorageAdapter } from './core/adapters/remoteStorageAdapter'
import { setHashingConfig } from './core/config'
import { subscribeToExperimentUpdates } from './api/supabase/realtimeListener'

export async function initializeExperiments(userId: string) {}

export const initializeUser = async (userData: { id: string; email: string }) => {
  await storage.saveUser(userData)
  const experiments = await storage.getExperiments()
  const variants = await storage.getVariants(userData.id)
  console.log('variants', variants)
  console.log('experiments', experiments)
  if (variants === null || experiments === null) return

  if (variants.length < experiments.length) {
    console.log('assigning variants')
    for (const exp of experiments) {
      const variant = variants.find(v => exp.key === v.experiment_key)
      if (variant) continue
      console.log('not found in ls for ', exp.key)
      const remoteVariant = await storage.getVariant(userData.id, exp.key)
      if (remoteVariant && remoteVariant !== null) {
        variants.push(remoteVariant)
        continue
      }
      const newVariant = variantAssigner.getVariant(userData.id, exp.key, exp.splits)
      const savedVariant = await storage.saveVariant(userData.id, exp.key, newVariant)
      if (savedVariant && savedVariant !== null) {
        variants.push(savedVariant)
      }
    }
  }
  window.localStorage.setItem('ab_variants', JSON.stringify(variants))
}

export const updateUser = async (userData: { id: string; email: string }, options?: { reassignVariant?: boolean }) => {
  await storage.saveUser(userData)
}

export const getVariant = async (experimentKey: string) => {
  const user = storage.getUser()
  if (!user) return null

  const savedVariant = await storage.getVariant(user.id, experimentKey)
  return savedVariant?.variant
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
