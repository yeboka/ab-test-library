import { UserVariant } from '../types'
import { remoteStorage } from './api'

const isBrowser = typeof window !== 'undefined'

export const variantService = {
  async getVariants(userId: string) {
    if (!isBrowser) return await remoteStorage.getVariants(userId)
    const variants = JSON.parse(window.localStorage.getItem('ab_variants') || '[]') as UserVariant[]
    if (variants.length > 0) return variants
    else {
      const vs = await remoteStorage.getVariants(userId)
      return vs
    }
  },

  async getVariant(user_id: string, experimentKey: string) {
    let variants: UserVariant[]
    try {
      variants = JSON.parse(window.localStorage.getItem('ab_variants') || '[]') as UserVariant[]
    } catch {
      variants = []
    }
    let variant = variants.find(v => v.experiment_key === experimentKey)
    if (variant) {
      return variant
    } else {
      try {
        const remoteVariant = await remoteStorage.getVariant(user_id, experimentKey)
        if (!remoteVariant || remoteVariant === null) return null
        variants.push(remoteVariant)
        window.localStorage.setItem('ab_variants', JSON.stringify(variants))
        return remoteVariant
      } catch (err) {
        console.error('Error occured while fetching variant with error: ', err)
        return null
      }
    }
  },

  async saveVariant(userId: string, experimentKey: string, variant: string) {
    if (!isBrowser) return

    try {
      return await remoteStorage.saveVariant(userId, experimentKey, variant)
    } catch (err) {
      console.error('Error occured while saving variant with error: ', err)
      return null
    }
  }
}
