import { experimentRegistry } from '../../core/experiments/experimentRegistry'
import { Experiment } from '../../core/experiments/experimentTypes'
import { getRemoteStorageAdapter } from '../../core/adapters/remoteStorageAdapter'

export function subscribeToExperimentUpdates() {
  const adapter = getRemoteStorageAdapter()
  if (!adapter.subscribeExperiments) {
    // No realtime available
    return () => {}
  }
  const unsubscribe = adapter.subscribeExperiments(experiments => {
    const map: Record<string, Experiment> = {}
    for (const e of experiments) map[e.key] = e
    // Re-init registry to maintain consistency
    experimentRegistry.clear()
    for (const e of experiments) experimentRegistry.register(e)
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
