import { createClient, SupabaseClient } from '@supabase/supabase-js'

export function createSupabaseClient(config: { url: string; key: string }): SupabaseClient {
  const { url, key } = config
  if (!url || !key) throw new Error('Supabase url/key required')
  return createClient(url, key)
}
