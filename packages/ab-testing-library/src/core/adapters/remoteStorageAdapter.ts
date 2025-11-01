import { User } from '@supabase/supabase-js'
import { Experiment, UserVariant } from '../types'

export interface IRemoteStorageAdapter {
  getUser(userId: string): Promise<{ id: string; email?: string } | null>
  saveUser(user: { id: string; email?: string }): Promise<UserVariant | null>

  getExperiments(): Promise<Experiment[]>

  getVariants(userId: string): Promise<UserVariant[] | null>
  saveVariant(userId: string, experimentKey: string, variant: string): Promise<void>
  getVariant(userId: string, experimentKey: string): Promise<UserVariant | null>

  subscribeExperiments?: (onChange: (experiments: Experiment[]) => void) => () => void
}

let currentAdapter: IRemoteStorageAdapter | null = null

export function setRemoteStorageAdapter(adapter: IRemoteStorageAdapter) {
  currentAdapter = adapter
}

export function getRemoteStorageAdapter(): IRemoteStorageAdapter {
  if (!currentAdapter) {
    throw new Error('RemoteStorageAdapter not initialized. Call initializeLibrary with an adapter.')
  }
  return currentAdapter
}
