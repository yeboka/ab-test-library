import { Experiment } from '../types'
import { remoteStorage } from './api'
import { GetExperimentsError } from '../errors'

export interface ExperimentService {
  getExperiments(): Promise<Experiment[]>
}

export const experimentService: ExperimentService = {
  async getExperiments() {
    try {
      return await remoteStorage.getExperiments()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      throw new GetExperimentsError(errorMessage)
    }
  }
}
