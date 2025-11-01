import { getRemoteStorageAdapter } from '../adapters/remoteStorageAdapter'
import { variantAssigner } from '../variant-assigner/variantAssigner'
import { userService } from './userService'
import { variantService } from './variantService'

export function subscribeToExperimentUpdates() {
  const adapter = getRemoteStorageAdapter()
  if (!adapter.subscribeExperiments) {
    return () => {}
  }
  const unsubscribe = adapter.subscribeExperiments(async experiments => {
    const user = userService.getUser()
    if (!user) return
    const variants = await variantService.getVariants(user.id)
    if (variants === null || experiments === null) return
    if (variants.length < experiments.length) {
      for (const exp of experiments) {
        const variant = variants.find(v => exp.key === v.experiment_key)
        if (variant) continue
        let remoteVariant = await variantService.getVariant(user.id, exp.key)
        if (remoteVariant && remoteVariant !== null) {
          variants.push(remoteVariant)
          continue
        }
        const newVariant = variantAssigner.assign(user, exp.key, exp.splits)
        await variantService.saveVariant(user.id, exp.key, newVariant)
        remoteVariant = await variantService.getVariant(user.id, exp.key)
        if (remoteVariant && remoteVariant !== null) {
          variants.push(remoteVariant)
        }
      }
    }
    window.localStorage.setItem('ab_variants', JSON.stringify(variants))
  })
  return unsubscribe
}
