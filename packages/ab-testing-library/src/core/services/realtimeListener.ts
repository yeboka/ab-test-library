import { getRemoteStorageAdapter } from '../adapters/remoteStorageAdapter'
import { variantAssigner } from '../variant-assigner/variantAssigner'
import { userService } from './userService'
import { variantService } from './variantService'
import { RealtimeConnectionError, isQuotaExceededError } from '../errors'

const isBrowser = typeof window !== 'undefined'

export function subscribeToExperimentUpdates() {
  try {
    const adapter = getRemoteStorageAdapter()
    if (!adapter.subscribeExperiments) {
      return () => {}
    }
    const unsubscribe = adapter.subscribeExperiments(async experiments => {
      try {
        const user = userService.getUser()
        if (!user) return
        const variants = await variantService.getVariantsByUserId(user.id)
        if (variants === null || experiments === null) return
        if (variants.length < experiments.length) {
          for (const exp of experiments) {
            const variant = variants.find(v => exp.key === v.experiment_key)
            if (variant) continue
            let remoteVariant = await variantService.getUserVariantByExperimentLey(user.id, exp.key)
            if (remoteVariant && remoteVariant !== null) {
              variants.push(remoteVariant)
              continue
            }
            const newVariant = variantAssigner.assign(user, exp.key, exp.splits)
            await variantService.saveUserVariantForExperiment(user.id, exp.key, newVariant)
            remoteVariant = await variantService.getUserVariantByExperimentLey(user.id, exp.key)
            if (remoteVariant && remoteVariant !== null) {
              variants.push(remoteVariant)
            }
          }
        }
        if (isBrowser) {
          try {
            window.localStorage.setItem('ab_variants', JSON.stringify(variants))
          } catch (storageError: any) {
            if (!isQuotaExceededError(storageError)) {
              throw storageError
            }
          }
        }
      } catch (err) {
        console.error(err)
      }
    })
    return unsubscribe
  } catch (err) {
    if (err instanceof RealtimeConnectionError) {
      return () => {}
    }
    throw err
  }
}
