import { log } from 'console'
import { remoteStorage } from './remoteStorage'

const isBrowser = typeof window !== 'undefined'

export const storage = {
  getUser() {
    if (!isBrowser) return null
    const data = window.localStorage.getItem('ab_user')
    return data ? JSON.parse(data) : null
  },

  async saveUser(user: any) {
    if (!isBrowser) return
    try {
      let remoteUser = await remoteStorage.getUser(user.id)
      if (!remoteUser) {
        await remoteStorage.saveUser(user)
        window.localStorage.setItem('ab_user', JSON.stringify(user))
      } else {
        window.localStorage.setItem('ab_user', JSON.stringify(remoteUser))
      }
    } catch (err) {
      console.error('Error occured while saving user with error: ', err)
    }
  },

  async getVariant(user_id: string, experimentKey: string) {
    if (!isBrowser) return null

    let variants = JSON.parse(window.localStorage.getItem('ab_variants') || '{}')
    let variant = variants[experimentKey]

    if (variant) {
      return variant
    } else {
      const { variant } = await remoteStorage.getVariant(user_id, experimentKey)

      if (!variant) return null
      variants[experimentKey] = variant
      console.log('VVSRSSFSA: ', variants, variant)
      window.localStorage.setItem('ab_variants', JSON.stringify(variants))
      return variant
    }
  },

  async saveVariant(experimentKey: string, variant: string) {
    if (!isBrowser) return

    try {
      const user = JSON.parse(window.localStorage.getItem('ab_user') || '{}')
      await remoteStorage.saveVariant(user.id, experimentKey, variant)
      const variants = JSON.parse(window.localStorage.getItem('ab_variants') || '{}')
      console.log('VAIRANTs: ', variants)
      variants[experimentKey] = variant
      console.log('AFTER VARS', variants)
      window.localStorage.setItem('ab_variants', JSON.stringify(variants))
    } catch (err) {
      console.error('Error occured while saving variant with error: ', err)
    }
  }
}
