import { useState, useEffect } from 'react'
import { getVariant } from 'ab-testing-library'
import { useExperimentContext } from '../contexts/ExperimentContext'

interface UseExperimentResult {
  variant: string | null
  loading: boolean
  error: Error | null
}

export const useExperiment = (experimentKey: string): UseExperimentResult => {
  const [variant, setVariant] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)
  const { error: initError } = useExperimentContext()

  useEffect(() => {
    const fetchVariant = async () => {
      try {
        setLoading(true)
        setError(null)
        console.log('fetchVariant', experimentKey)

        const v = await getVariant(experimentKey)
        if (!v || v === null) return
        setVariant(v)
        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to get variant'))
        setLoading(false)
      }
    }

    fetchVariant()
  }, [experimentKey])

  return { variant, loading: loading, error: initError || error }
}
