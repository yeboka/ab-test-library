import { supabase } from './supabaseClient'
import { experimentRegistry } from '../../core/experiments/experimentRegistry'
import { Experiment } from '../../core/experiments/experimentTypes'
import { remoteStorage } from '../../core/storage/remoteStorage'

export function subscribeToExperimentUpdates() {
  const channel = supabase
    .channel('experiments')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'experiments' }, payload => {
      console.log('Experiment updated:', payload.new)
      experimentRegistry.register(payload.new as Experiment)
    })
    .subscribe()
  return () => {
    try {
      channel.unsubscribe()
    } catch (err) {
      console.error('Failed to unsubscribe realtime channel: ', err)
    }
  }
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
      const rows = await remoteStorage.getExperiments()
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
