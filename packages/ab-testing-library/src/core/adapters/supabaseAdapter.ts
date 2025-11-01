import { SupabaseClient } from '@supabase/supabase-js'
import { IRemoteStorageAdapter } from './remoteStorageAdapter'
import { Experiment, UserVariant } from '../types'

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
      const { data, error } = await client.from('users').upsert(user, { onConflict: 'id' })
      if (error) throw error
      return data as UserVariant | null
    },

    async getExperiments() {
      const { data, error } = await client.from('experiments').select('*').eq('enabled', true)
      if (error) throw error
      return (data || []) as Experiment[]
    },

    async getVariants(userId: string) {
      const { data, error } = await client.from('user_variants').select('*').eq('user_id', userId)
      if (error) return null
      return data as UserVariant[]
    },

    async saveVariant(userId: string, experimentKey: string, variant: string) {
      await client
        .from('user_variants')
        .upsert({ user_id: userId, experiment_key: experimentKey, variant }, { onConflict: 'user_id,experiment_key' })
    },

    async getVariant(userId: string, experimentKey: string) {
      const { data, error } = await client
        .from('user_variants')
        .select('*')
        .eq('user_id', userId)
        .eq('experiment_key', experimentKey)
        .maybeSingle()
      if (error) return null
      return data as UserVariant | null
    },

    subscribeExperiments(onChange) {
      const channel = client
        .channel('experiments_channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'experiments' }, async () => {
          try {
            const { data } = await client.from('experiments').select('*')
            onChange((data || []) as Experiment[])
          } catch (err) {
            console.error('Supabase subscribeExperiments refresh failed: ', err)
          }
        })
        .subscribe(status => {
          if (status === 'SUBSCRIBED') {
            console.log('Subscribed to experiment updates')
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Channel subscription error')
          } else if (status === 'TIMED_OUT') {
            console.warn('Channel subscription timed out')
          } else if (status === 'CLOSED') {
            console.warn('Channel subscription closed')
          }
        })
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
