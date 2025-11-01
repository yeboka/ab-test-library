import { remoteStorage } from './api'

export const experimentService = {
  async getExperiments() {
    return await remoteStorage.getExperiments()
  }
}
