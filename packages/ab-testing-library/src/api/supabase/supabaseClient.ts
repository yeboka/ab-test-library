import { createClient } from '@supabase/supabase-js'

const supabaseUrl = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_URL : process.env.SUPABASE_URL

const supabaseKey =
  typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) throw new Error('supabaseUrl is required.')

export const supabase = createClient(supabaseUrl, supabaseKey)
