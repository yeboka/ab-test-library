import { Experiment } from '../experiments/experimentTypes'

export interface IRemoteStorageAdapter {
  getUser(userId: string): Promise<{ id: string; email?: string } | null>
  saveUser(user: { id: string; email?: string }): Promise<void>

  getExperiments(): Promise<Experiment[]>

  saveVariant(userId: string, experimentKey: string, variant: string): Promise<void>
  getVariant(userId: string, experimentKey: string): Promise<{ variant?: string } | null>

  subscribeExperiments?: (onChange: (experiments: Experiment[]) => void) => () => void
}

let currentAdapter: IRemoteStorageAdapter | null = null

export function setRemoteStorageAdapter(adapter: IRemoteStorageAdapter) {
  currentAdapter = adapter
}

export function getRemoteStorageAdapter(): IRemoteStorageAdapter {
  console.log('REMOTE ADAPTER')
  if (!currentAdapter) {
    throw new Error('RemoteStorageAdapter not initialized. Call initializeLibrary with an adapter.')
  }
  return currentAdapter
}
