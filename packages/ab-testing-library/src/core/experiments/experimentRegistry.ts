import { getRemoteStorageAdapter } from '../adapters/remoteStorageAdapter'
import { Experiment, ExperimentMap } from './experimentTypes'

let experiments: ExperimentMap = {}

export const experimentRegistry = {
  async init() {
    const data = await getRemoteStorageAdapter().getExperiments()
    experiments = {}
    for (const exp of data) {
      experiments[exp.key] = exp
    }
  },

  register(exp: Experiment) {
    experiments[exp.key] = exp
  },

  list(): Experiment[] {
    const isBrowser = typeof window !== 'undefined'
    if (isBrowser) {
      console.log('[AB Testing] Experiments list:', Object.values(experiments), experiments)
    }
    return Object.values(experiments)
  },

  get(key: string): Experiment {
    const exp = experiments[key]
    if (!exp) throw new Error(`Experiment "${key}" not found`)
    return exp
  },

  clear() {
    experiments = {}
  }
}
