import { getRemoteStorageAdapter } from '../adapters/remoteStorageAdapter'
import { variantAssigner } from '../variant-assigner/variantAssigner'
import { userService } from './userService'
import { variantService } from './variantService'
import { RealtimeConnectionError, StorageUnavailableError } from '../errors'
import { storageManager } from '../storage/storageManager'

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
        try {
          storageManager.setItem('ab_variants', variants)
        } catch (storageError) {
          // StorageManager handles quota exceeded - only log non-quota errors
          if (!(storageError instanceof StorageUnavailableError)) {
            throw storageError
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
