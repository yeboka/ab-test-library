import { variantAssigner } from './core/variant-assigner/variantAssigner'
import { setRemoteStorageAdapter, IRemoteStorageAdapter } from './core/adapters/remoteStorageAdapter'
import { setHashingConfig } from './core/variant-assigner/config'
import { subscribeToExperimentUpdates } from './core/service/realtimeListener'
import { userService } from './core/service/userService'
import { experimentService } from './core/service/experimentService'
import { variantService } from './core/service/variantService'

const isBrowser = typeof window !== 'undefined'

export async function initializeExperiments(userId: string) {}

export const initializeUser = async (userData: { id: string; email: string }) => {
  await userService.saveUser(userData)
  const experiments = await experimentService.getExperiments()
  const variants = await variantService.getVariants(userData.id)
  if (variants === null || experiments === null) return
  if (variants.length < experiments.length) {
    for (const exp of experiments) {
      const variant = variants.find(v => exp.key === v.experiment_key)
      if (variant) continue
      let remoteVariant = await variantService.getVariant(userData.id, exp.key)
      if (remoteVariant && remoteVariant !== null) {
        variants.push(remoteVariant)
        continue
      }
      const newVariant = variantAssigner.assign(userData, exp.key, exp.splits)
      await variantService.saveVariant(userData.id, exp.key, newVariant)
      remoteVariant = await variantService.getVariant(userData.id, exp.key)
      if (remoteVariant && remoteVariant !== null) {
        variants.push(remoteVariant)
      }
    }
  }
  if (isBrowser) {
    window.localStorage.setItem('ab_variants', JSON.stringify(variants))
  }
}

export const updateUser = async (userData: { id: string; email: string }, options?: { reassignVariant?: boolean }) => {
  await userService.updateUser(userData)

  if (options?.reassignVariant) {
    console.log('reassigning variants')
    const experiments = await experimentService.getExperiments()
    if (!experiments || experiments.length === 0) return

    if (isBrowser) {
      console.log('existing variants', window.localStorage.getItem('ab_variants'))
      window.localStorage.removeItem('ab_variants')
    }
    for (const exp of experiments) {
      const newVariant = variantAssigner.assign(userData, exp.key, exp.splits)
      await variantService.saveVariant(userData.id, exp.key, newVariant)
    }
    const newVariants = await variantService.getVariants(userData.id)
    console.log('new variants', newVariants)
    if (isBrowser) {
      window.localStorage.setItem('ab_variants', JSON.stringify(newVariants))
    }
  }
}

export const getVariant = async (experimentKey: string) => {
  const user = userService.getUser()
  if (!user) return null

  const savedVariant = await variantService.getVariant(user.id, experimentKey)
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
