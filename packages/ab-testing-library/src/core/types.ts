import { ExperimentService } from './services/experimentService'
import { UserService } from './services/userService'
import { VariantService } from './services/variantService'

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

export interface InitializeUserProps {
  userData: { id: string; email: string }
  userService: UserService
  experimentService: ExperimentService
  variantService: VariantService
}

export interface UpdateUserProps {
  userData: { id: string; email: string }
  options?: { reassignVariant?: boolean }
  userService: UserService
  experimentService: ExperimentService
  variantService: VariantService
}

export interface GetVariantProps {
  experimentKey: string
  userService: UserService
  variantService: VariantService
}
