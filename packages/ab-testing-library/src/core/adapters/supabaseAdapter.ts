import { SupabaseClient } from '@supabase/supabase-js'
import { IRemoteStorageAdapter } from './remoteStorageAdapter'
import { Experiment, UserVariant } from '../types'
import {
  GetUserErrorSupabase,
  SaveUserErrorSupabase,
  GetExperimentsError,
  VariantOperationError,
  RealtimeConnectionError
} from '../errors'

export function createSupabaseAdapter(client: SupabaseClient): IRemoteStorageAdapter {
  return {
    async getUser(user_id: string) {
      const { data, error } = await client.from('users').select('*').eq('id', user_id).maybeSingle()
      if (error) {
        throw new GetUserErrorSupabase(error.message, user_id)
      }
      return data as any
    },

    async saveUser(user: { id: string; email?: string }) {
      const { data, error } = await client.from('users').upsert(user, { onConflict: 'id' })
      if (error) {
        throw new SaveUserErrorSupabase(error.message, user.id)
      }
      return data as UserVariant | null
    },

    async getExperiments() {
      const { data, error } = await client.from('experiments').select('*').eq('enabled', true)
      if (error) {
        throw new GetExperimentsError(error.message)
      }
      return (data || []) as Experiment[]
    },

    async getVariants(userId: string) {
      const { data, error } = await client.from('user_variants').select('*').eq('user_id', userId)
      if (error) {
        throw new VariantOperationError('get', userId, 'all', error.message)
      }
      return (data || []) as UserVariant[]
    },

    async saveVariant(userId: string, experimentKey: string, variant: string) {
      const { error } = await client
        .from('user_variants')
        .upsert({ user_id: userId, experiment_key: experimentKey, variant }, { onConflict: 'user_id,experiment_key' })
      if (error) {
        throw new VariantOperationError('save', userId, experimentKey, error.message)
      }
    },

    async getVariant(userId: string, experimentKey: string) {
      const { data, error } = await client
        .from('user_variants')
        .select('*')
        .eq('user_id', userId)
        .eq('experiment_key', experimentKey)
        .maybeSingle()
      if (error) {
        throw new VariantOperationError('get', userId, experimentKey, error.message)
      }
      return data as UserVariant | null
    },

    subscribeExperiments(onChange) {
      let connectionError: RealtimeConnectionError | null = null
      const channel = client
        .channel('experiments_channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'experiments' }, async () => {
          try {
            const { data, error } = await client.from('experiments').select('*').eq('enabled', true)
            if (error) {
              console.error(error)
            } else {
              onChange((data || []) as Experiment[])
            }
          } catch (err) {
            console.error(err)
          }
        })
        .subscribe(status => {
          if (status === 'SUBSCRIBED') {
            connectionError = null
          } else if (status === 'CHANNEL_ERROR') {
            connectionError = new RealtimeConnectionError('error')
          } else if (status === 'TIMED_OUT') {
            connectionError = new RealtimeConnectionError('timeout')
          } else if (status === 'CLOSED') {
            connectionError = new RealtimeConnectionError('closed')
          }
        })
      return () => {
        channel.unsubscribe()
      }
    }
  }
}
