import { remoteStorage } from './core/storage/remoteStorage'
import { storage } from './core/storage/storage'
import { variantAssigner } from './core/variantAssigner'
import { experimentRegistry } from './core/experiments/experimentRegistry'
import { log } from 'console'

export const initializeUser = async (userData: { id: string; email: string }) => {
  await experimentRegistry.init()
  await storage.saveUser(userData)
  experimentRegistry.list().forEach(async exp => {
    const variant = variantAssigner.getVariant(userData.id, exp.key, exp.splits)
    await storage.saveVariant(exp.key, variant)
  })
}

export const updateUser = async (userData: { id: string; email: string }, options?: { reassignVariant?: boolean }) => {
  await storage.saveUser(userData)

  if (options?.reassignVariant) {
    experimentRegistry.list().forEach(async exp => {
      const variant = variantAssigner.getVariant(userData.id, exp.key, exp.splits)
      await storage.saveVariant(exp.key, variant)
    })
  }
}

export const getVariant = async (experimentKey: string) => {
  const user = storage.getUser()
  const savedVariant = await storage.getVariant(user.id, experimentKey)
  if (savedVariant) return savedVariant

  const exp = experimentRegistry.get(experimentKey)
  if (!user) return
  const newVariant = variantAssigner.getVariant(user.id, experimentKey, exp.splits)
  await storage.saveVariant(exp.key, newVariant)
  return newVariant
}
