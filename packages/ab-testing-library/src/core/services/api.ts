import { getRemoteStorageAdapter } from '../adapters/remoteStorageAdapter'

export const remoteStorage = {
  async saveUser(user: { id: string; email: string }) {
    await getRemoteStorageAdapter().saveUser(user)
  },

  async getUser(user_id: string) {
    return await getRemoteStorageAdapter().getUser(user_id)
  },

  async getExperiments() {
    return await getRemoteStorageAdapter().getExperiments()
  },

  async getVariants(userId: string) {
    return await getRemoteStorageAdapter().getVariants(userId)
  },

  async saveVariant(userId: string, experimentKey: string, variant: string) {
    return await getRemoteStorageAdapter().saveVariant(userId, experimentKey, variant)
  },

  async getVariant(userId: string, experimentKey: string) {
    return await getRemoteStorageAdapter().getVariant(userId, experimentKey)
  }
}
