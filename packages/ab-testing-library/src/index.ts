import { storage } from './core/storage/storage'
import { variantAssigner } from './core/variantAssigner'
import { experimentRegistry } from './core/experiments/experimentRegistry'
import { subscribeToExperimentUpdates, startExperimentPolling } from './api/supabase/realtimeListener'

type UnsubscribeFunc = () => void

export const initializeUser = async (userData: { id: string; email: string }): Promise<UnsubscribeFunc> => {
  await experimentRegistry.init()
  await storage.saveUser(userData)
  await Promise.all(
    experimentRegistry.list().map(async exp => {
      const existing = await storage.getVariant(userData.id, exp.key)
      if (existing) return
      const variant = variantAssigner.getVariant(userData.id, exp.key, exp.splits)
      await storage.saveVariant(exp.key, variant)
    })
  )

  // Start realtime updates and polling fallback
  let stopRealtime: (() => void) | null = null
  try {
    stopRealtime = subscribeToExperimentUpdates()
  } catch (err) {
    console.error('Failed to start realtime updates: ', err)
  }
  // let stopPolling: (() => void) | null = null
  // try {
  //   stopPolling = startExperimentPolling(60000)
  // } catch (err) {
  //   console.error('Failed to start polling updates: ', err)
  // }

  return () => {
    try {
      stopRealtime && stopRealtime()
    } catch {}
    // try {
    //   stopPolling && stopPolling()
    // } catch {}
  }
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
