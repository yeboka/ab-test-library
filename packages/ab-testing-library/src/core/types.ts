export interface Experiment {
  key: string
  name: string
  splits: Record<string, number> // { A: 0.5, B: 0.5 }
  enabled?: boolean // If false, experiment is disabled and should always return control variant
}

export type UserVariant = {
  user_id: string
  experiment_key: string
  variant: string
  updated_at?: string | Date
}
