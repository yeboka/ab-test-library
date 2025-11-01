import { experimentRegistry } from '../../core/experiments/experimentRegistry'
import { Experiment } from '../../core/experiments/experimentTypes'
import { getRemoteStorageAdapter } from '../../core/adapters/remoteStorageAdapter'
import { clearNormalizedSplitsCache } from '../../core/experiments/splitUtils'
import { initializeExperiments } from '../..'
import { storage } from '../../core/storage/storage'
import { variantAssigner } from '../../core/variantAssigner'

export function subscribeToExperimentUpdates() {
  const adapter = getRemoteStorageAdapter()
  if (!adapter.subscribeExperiments) {
    // No realtime available
    return () => {}
  }
  const unsubscribe = adapter.subscribeExperiments(async experiments => {
    const user = storage.getUser()
    console.log('user', user)
    if (!user) return
    const variants = await storage.getVariants(user.id)
    if (variants === null || experiments === null) return
    if (variants.length < experiments.length) {
      for (const exp of experiments) {
        const variant = variants.find(v => exp.key === v.experiment_key)
        if (variant) continue
        console.log('not found in ls for ', exp.key)
        let remoteVariant = await storage.getVariant(user.id, exp.key)
        console.log('remoteVariant', remoteVariant)
        if (remoteVariant && remoteVariant !== null) {
          variants.push(remoteVariant)
          continue
        }
        const newVariant = variantAssigner.getVariant(user.id, exp.key, exp.splits)
        await storage.saveVariant(user.id, exp.key, newVariant)
        remoteVariant = await storage.getVariant(user.id, exp.key)
        console.log('savedVariant', remoteVariant)
        if (remoteVariant && remoteVariant !== null) {
          variants.push(remoteVariant)
        }
      }
    }
    window.localStorage.setItem('ab_variants', JSON.stringify(variants))
  })
  return unsubscribe
}

// Long-polling fallback for environments where realtime is unavailable
export function startExperimentPolling(intervalMs = 60000) {
  let stopped = false
  let lastSignature = ''

  const computeSignature = (rows: any[]) => {
    try {
      return JSON.stringify(
        rows.map(r => ({ key: r.key, name: r.name, splits: r.splits })).sort((a, b) => a.key.localeCompare(b.key))
      )
    } catch {
      return ''
    }
  }

  const tick = async () => {
    if (stopped) return
    try {
      const rows = await getRemoteStorageAdapter().getExperiments()
      const sig = computeSignature(rows)
      if (sig !== lastSignature) {
        clearNormalizedSplitsCache() // Clear cache when experiments update
        await experimentRegistry.init()
        lastSignature = sig
      }
    } catch (err) {
      console.error('Polling experiments failed: ', err)
    } finally {
      if (!stopped) setTimeout(tick, intervalMs)
    }
  }

  tick()
  return () => {
    stopped = true
  }
}
