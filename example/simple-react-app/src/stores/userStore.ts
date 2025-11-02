import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UserInfo {
  userId: string
  userEmail: string
}

interface UserStore extends UserInfo {
  setUserInfo: (userId: string, userEmail: string) => void
  clearUserInfo: () => void
}

export const useUserStore = create<UserStore>()(
  persist(
    set => ({
      userId: '',
      userEmail: '',
      setUserInfo: (userId: string, userEmail: string) => {
        set({ userId, userEmail })
      },
      clearUserInfo: () => {
        set({ userId: '', userEmail: '' })
      }
    }),
    {
      name: 'user-info-storage' // unique name for localStorage key
    }
  )
)
