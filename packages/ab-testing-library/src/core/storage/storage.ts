import { remoteStorage } from './remoteStorage'

const isBrowser = typeof window !== 'undefined'

export const storage = {
  getUser() {
    if (!isBrowser) return null
    try {
      const data = window.localStorage.getItem('ab_user')
      return data ? JSON.parse(data) : null
    } catch {
      return null
    }
  },

  async saveUser(user: any) {
    if (!isBrowser) return
    try {
      let remoteUser = await remoteStorage.getUser(user.id)
      if (!remoteUser) {
        await remoteStorage.saveUser(user)
        window.localStorage.setItem('ab_user', JSON.stringify(user))
        window.localStorage.removeItem('ab_variants')
      } else {
        window.localStorage.setItem('ab_user', JSON.stringify(remoteUser))
      }
    } catch (err) {
      console.error('Error occured while saving user with error: ', err)
    }
  },

  async getVariant(user_id: string, experimentKey: string) {
    if (!isBrowser) return null

    let variants: Record<string, string> = {}
    try {
      variants = JSON.parse(window.localStorage.getItem('ab_variants') || '{}')
    } catch {
      variants = {}
    }
    let variant = variants[experimentKey]
    if (variant) {
      return variant
    } else {
      try {
        const data = await remoteStorage.getVariant(user_id, experimentKey)
        const remoteVariant = (data && (data as any).variant) as string | undefined
        if (!remoteVariant) return null
        variants[experimentKey] = remoteVariant
        window.localStorage.setItem('ab_variants', JSON.stringify(variants))
        return remoteVariant
      } catch (err) {
        console.error('Error occured while fetching variant with error: ', err)
        return null
      }
    }
  },

  async saveVariant(experimentKey: string, variant: string) {
    if (!isBrowser) return

    try {
      const user = JSON.parse(window.localStorage.getItem('ab_user') || '{}')
      await remoteStorage.saveVariant(user.id, experimentKey, variant)
      const variants = JSON.parse(window.localStorage.getItem('ab_variants') || '{}')
      variants[experimentKey] = variant
      window.localStorage.setItem('ab_variants', JSON.stringify(variants))
    } catch (err) {
      console.error('Error occured while saving variant with error: ', err)
    }
  }
}
