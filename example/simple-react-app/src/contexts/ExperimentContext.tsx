import { createContext, useContext, useState, ReactNode, useCallback, useRef, useEffect } from 'react'
import { createSupabaseAdapter, initializeLibrary, initializeUser } from 'ab-testing-library'
import { createSupabaseClient } from '../api/supabaseApi'

interface ExperimentContextValue {
  error: Error | null
  initializeUser: (userId: string, userEmail: string) => Promise<void>
}

const ExperimentContext = createContext<ExperimentContextValue | undefined>(undefined)

interface ExperimentProviderProps {
  children: ReactNode
}

const supabase = createSupabaseClient()

export const ExperimentProvider = ({ children }: ExperimentProviderProps) => {
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cleanup: () => void
    const init = async () => {
      cleanup = await initializeLibrary({
        adapter: createSupabaseAdapter(supabase),
        hashing: { salt: import.meta.env.VITE_AB_SALT || 'my-app', version: 1 }
      })
    }

    init()

    return () => {
      cleanup()
    }
  }, [])

  const handleInitializeUser = useCallback(async (userId: string, userEmail: string) => {
    try {
      await initializeUser({ id: userId, email: userEmail })
      setError(null)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to initialize experiment library')
      setError(error)
    }
  }, [])

  const value: ExperimentContextValue = {
    error,
    initializeUser: handleInitializeUser
  }

  return <ExperimentContext.Provider value={value}>{children}</ExperimentContext.Provider>
}

export const useExperimentContext = () => {
  const context = useContext(ExperimentContext)
  if (context === undefined) {
    throw new Error('useExperimentContext must be used within an ExperimentProvider')
  }
  return context
}
