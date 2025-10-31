import { storage } from './core/storage/storage'
import { variantAssigner } from './core/variantAssigner'
import { experimentRegistry } from './core/experiments/experimentRegistry'
import { setRemoteStorageAdapter, IRemoteStorageAdapter } from './core/adapters/remoteStorageAdapter'
import { setHashingConfig } from './core/config'

export const initializeUser = async (userData: { id: string; email: string }) => {
  await storage.saveUser(userData)
  await Promise.all(
    experimentRegistry.list().map(async exp => {
      const existing = await storage.getVariant(userData.id, exp.key)
      if (existing) return
      const variant = variantAssigner.getVariant(userData.id, exp.key, exp.splits)
      await storage.saveVariant(exp.key, variant)
    })
  )
}

export const updateUser = async (userData: { id: string; email: string }, options?: { reassignVariant?: boolean }) => {
  await storage.saveUser(userData)

  if (options?.reassignVariant) {
    await Promise.all(
      experimentRegistry.list().map(async exp => {
        const variant = variantAssigner.getVariant(userData.id, exp.key, exp.splits)
        await storage.saveVariant(exp.key, variant)
      })
    )
  }
}

export const getVariant = async (experimentKey: string) => {
  const user = storage.getUser()
  if (!user) return null
  const savedVariant = await storage.getVariant(user.id, experimentKey)
  if (savedVariant) return savedVariant

  const exp = experimentRegistry.get(experimentKey)
  const newVariant = variantAssigner.getVariant(user.id, experimentKey, exp.splits)
  await storage.saveVariant(exp.key, newVariant)
  return newVariant
}

export const rehydrate = () => {
  const user = storage.getUser()
  if (!user) return { user: null, variants: {} as Record<string, string> }
  try {
    const variants = typeof window !== 'undefined' ? JSON.parse(window.localStorage.getItem('ab_variants') || '{}') : {}
    return { user, variants }
  } catch {
    return { user, variants: {} as Record<string, string> }
  }
}

export function initializeLibrary(options: {
  adapter: IRemoteStorageAdapter
  hashing?: { salt?: string; version?: number }
}) {
  experimentRegistry.init()
  setRemoteStorageAdapter(options.adapter)
  if (options.hashing) setHashingConfig(options.hashing)
}

export { createSupabaseAdapter } from './core/adapters/supabaseAdapter'
