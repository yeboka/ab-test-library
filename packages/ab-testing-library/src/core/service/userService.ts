import { remoteStorage } from './api'

const isBrowser = typeof window !== 'undefined'

export const userService = {
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

  async updateUser(user: any) {
    if (!isBrowser) return
    const currentUser = this.getUser()
    if (!currentUser) throw new Error('Updating user before initialization')
    if (currentUser.id !== user.id) throw new Error('Updating user with different id')
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
  }
}
