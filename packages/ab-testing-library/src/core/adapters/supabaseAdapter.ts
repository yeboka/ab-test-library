import { SupabaseClient } from '@supabase/supabase-js'
import { IRemoteStorageAdapter } from './remoteStorageAdapter'
import { Experiment } from '../experiments/experimentTypes'

export function createSupabaseAdapter(client: SupabaseClient): IRemoteStorageAdapter {
  return {
    async getUser(user_id: string) {
      const { data, error } = await client.from('users').select('*').eq('id', user_id).maybeSingle()
      if (error) {
        console.error(error)
        return null
      }
      return data as any
    },

    async saveUser(user: { id: string; email?: string }) {
      await client.from('users').upsert(user, { onConflict: 'id' })
    },

    async getExperiments() {
      const { data, error } = await client.from('experiments').select('*')
      if (error) throw error
      return (data || []) as Experiment[]
    },

    async saveVariant(userId: string, experimentKey: string, variant: string) {
      await client
        .from('user_variants')
        .upsert({ user_id: userId, experiment_key: experimentKey, variant }, { onConflict: 'user_id,experiment_key' })
    },

    async getVariant(userId: string, experimentKey: string) {
      const { data, error } = await client
        .from('user_variants')
        .select('variant')
        .eq('user_id', userId)
        .eq('experiment_key', experimentKey)
        .maybeSingle()
      if (error) return null
      return data as any
    },

    subscribeExperiments(onChange) {
      const channel = client
        .channel('experiments')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'experiments' }, async () => {
          try {
            const { data } = await client.from('experiments').select('*')
            onChange((data || []) as Experiment[])
          } catch (err) {
            console.error('Supabase subscribeExperiments refresh failed: ', err)
          }
        })
        .subscribe()
      return () => {
        try {
          channel.unsubscribe()
        } catch (err) {
          console.error('Failed to unsubscribe experiments channel: ', err)
        }
      }
    }
  }
}
