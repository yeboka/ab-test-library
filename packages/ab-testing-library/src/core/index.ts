import { GetVariantProps, InitializeUserProps, UpdateUserProps } from './types'
import { variantAssigner } from './variant-assigner/variantAssigner'
import { InitializationError, StorageCorruptionError, isQuotaExceededError } from './errors'

const isBrowser = typeof window !== 'undefined'

export const initUserExperimentsAndVariants = async ({
  userData,
  userService,
  experimentService,
  variantService
}: InitializeUserProps) => {
  await userService.saveUser(userData)
  const experiments = await experimentService.getExperiments()
  const variants = await variantService.getVariantsByUserId(userData.id)
  if (variants === null || experiments === null) return
  if (variants.length < experiments.length) {
    for (const exp of experiments) {
      const variant = variants.find(v => exp.key === v.experiment_key)
      if (variant) continue
      let remoteVariant = await variantService.getUserVariantByExperimentLey(userData.id, exp.key)
      if (remoteVariant && remoteVariant !== null) {
        variants.push(remoteVariant)
        continue
      }
      const newVariant = variantAssigner.assign(userData, exp.key, exp.splits)
      await variantService.saveUserVariantForExperiment(userData.id, exp.key, newVariant)
      remoteVariant = await variantService.getUserVariantByExperimentLey(userData.id, exp.key)
      if (remoteVariant && remoteVariant !== null) {
        variants.push(remoteVariant)
      }
    }
  }
  if (isBrowser) {
    try {
      window.localStorage.setItem('ab_variants', JSON.stringify(variants))
    } catch (storageError: any) {
      if (!isQuotaExceededError(storageError)) {
        throw new StorageCorruptionError('ab_variants')
      }
    }
  }
}

export const updateUserWithReassignVariants = async ({
  userData,
  options,
  userService,
  experimentService,
  variantService
}: UpdateUserProps) => {
  await userService.updateUser(userData)

  if (options?.reassignVariant) {
    const experiments = await experimentService.getExperiments()
    if (!experiments || experiments.length === 0) return

    if (isBrowser) {
      window.localStorage.removeItem('ab_variants')
    }
    for (const exp of experiments) {
      const newVariant = variantAssigner.assign(userData, exp.key, exp.splits)
      await variantService.saveUserVariantForExperiment(userData.id, exp.key, newVariant)
    }
    const newVariants = await variantService.getVariantsByUserId(userData.id)
    if (isBrowser && newVariants) {
      try {
        window.localStorage.setItem('ab_variants', JSON.stringify(newVariants))
      } catch (storageError: any) {
        if (!isQuotaExceededError(storageError)) {
          throw new StorageCorruptionError('ab_variants')
        }
      }
    }
  }
}

export const getUserVariantByExperimentKey = async ({
  experimentKey,
  userService,
  variantService
}: GetVariantProps) => {
  const user = userService.getUser()
  if (!user) {
    throw new InitializationError('getVariant')
  }

  try {
    const savedVariant = await variantService.getUserVariantByExperimentLey(user.id, experimentKey)
    return savedVariant?.variant ?? null
  } catch (err) {
    if (err instanceof InitializationError || err instanceof StorageCorruptionError) {
      throw err
    }
    throw err
  }
}
