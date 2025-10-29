import { supabase } from './supabaseClient'
import { experimentRegistry } from '../../core/experiments/experimentRegistry'

export function subscribeToExperimentUpdates() {
  supabase
    .channel('experiments')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'experiments' }, payload => {
      console.log('Experiment updated:', payload.new)
      experimentRegistry.refresh(payload.new)
    })
    .subscribe()
}
