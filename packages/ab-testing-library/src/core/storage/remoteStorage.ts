import { log } from 'console'
import { supabase } from '../../api/supabase/supabaseClient'

export const remoteStorage = {
  async saveUser(user: { id: string; email: string }) {
    await supabase.from('users').upsert(user, { onConflict: 'id' })
  },

  async getUser(user_id: string) {
    const { data, error } = await supabase.from('users').select('*').eq('id', user_id).maybeSingle()
    if (error) {
      // console.error(error)
      return null
    }
    return data
  },

  async getExperiments() {
    const { data, error } = await supabase.from('experiments').select('*')
    if (error) throw error
    return data
  },

  async saveVariant(userId: string, experimentKey: string, variant: string) {
    await supabase
      .from('user_variants')
      .upsert({ user_id: userId, experiment_key: experimentKey, variant }, { onConflict: 'user_id,experiment_key' })
  },

  async getVariant(userId: string, experimentKey: string) {
    const { data, error } = await supabase
      .from('user_variants')
      .select('variant')
      .eq('user_id', userId)
      .eq('experiment_key', experimentKey)
      .maybeSingle()

    if (error) throw error
    console.log('DATA', data)
    return data
  }
}
