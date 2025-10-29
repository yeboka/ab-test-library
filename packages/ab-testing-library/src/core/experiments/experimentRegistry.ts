import { remoteStorage } from '../storage/remoteStorage'
import { Experiment, ExperimentMap } from './experimentTypes'

let experiments: ExperimentMap = {}

export const experimentRegistry = {
  async init() {
    const data = await remoteStorage.getExperiments()
    experiments = {}
    for (const exp of data) {
      experiments[exp.key] = exp
    }
  },

  register(exp: Experiment) {
    experiments[exp.key] = exp
  },

  list(): Experiment[] {
    return Object.values(experiments)
  },

  get(key: string): Experiment {
    const exp = experiments[key]
    if (!exp) throw new Error(`Experiment "${key}" not found`)
    return exp
  },

  refresh(payload: ExperimentMap) {
    experiments = payload
  },

  clear() {
    experiments = {}
  }
}
