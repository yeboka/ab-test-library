export interface Experiment {
  key: string
  name: string
  splits: Record<string, number> // { A: 0.5, B: 0.5 }
}

export type ExperimentMap = Record<string, Experiment>
