import { useExperimentContext } from '../contexts/ExperimentContext'
import { useState, useEffect } from 'react'
import { User, Mail, Dices } from 'lucide-react'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupButton } from '@/components/ui/input-group'
import { Button } from '@/components/ui/button'
import { useUserStore } from '../stores/userStore'
import { updateUser } from 'ab-testing-library'
import { Checkbox } from './ui/checkbox'
import { Label } from './ui/label'
import { CheckedState } from '@radix-ui/react-checkbox'

const UserWidget = () => {
  const { userId: storedUserId, userEmail: storedUserEmail, setUserInfo } = useUserStore()
  const [userId, setUserId] = useState<string>('')
  const [userEmail, setUserEmail] = useState<string>('')
  const [emailError, setEmailError] = useState<string>('')
  const [reassignVariant, setReassignVariant] = useState<boolean>(false)
  const { initializeUser } = useExperimentContext()
  const [isInitialized, setIsInitialized] = useState<boolean>(false)

  useEffect(() => {
    if (storedUserId && storedUserEmail) {
      setIsInitialized(true)
    }
  }, [storedUserId, storedUserEmail])

  useEffect(() => {
    if (storedUserId && storedUserEmail) {
      setUserId(storedUserId)
      setUserEmail(storedUserEmail)
    }
  }, [storedUserId, storedUserEmail])

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleUserIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserId(e.target.value)
  }

  const handleUserEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value
    setUserEmail(email)

    if (email && !validateEmail(email)) {
      setEmailError('Please enter a valid email address')
    } else {
      setEmailError('')
    }
  }

  const handleGenerateId = () => {
    const uuid = crypto.randomUUID()
    setUserId(uuid)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!userEmail || !validateEmail(userEmail)) {
      setEmailError('Please enter a valid email address')
      return
    }

    if (isInitialized) {
      console.log('update user', { storedUserId, userEmail, reassignVariant })
      await updateUser({ id: storedUserId, email: userEmail }, { reassignVariant: reassignVariant })
      setUserInfo(storedUserId, userEmail)
      return
    }
    const userIdToUse = isInitialized ? storedUserId : userId

    if (!userIdToUse) {
      return
    }

    setEmailError('')
    await initializeUser(userIdToUse, userEmail)
    setUserInfo(userIdToUse, userEmail)
  }

  const handleReassignVariantChange = (checked: CheckedState): void => {
    console.log(checked)
    if (checked === 'indeterminate') return
    setReassignVariant(checked)
  }

  function handleClearAll(): void {
    if (window !== undefined) {
      window.localStorage.removeItem('user-info-storage')
      window.localStorage.removeItem('ab_user')
      window.localStorage.removeItem('ab_user_timestamp')
      window.localStorage.removeItem('ab_sync_queue')
      window.localStorage.removeItem('ab_variants')
      window.localStorage.removeItem('ab_variants_timestamp')
      setIsInitialized(false)
      setUserInfo('', '')
      setUserId('')
      setUserEmail('')
      setReassignVariant(false)
    }
    throw new Error('Function not implemented.')
  }

  return (
    <form onSubmit={handleSubmit} className='flex flex-col gap-4 w-full max-w-[400px]'>
      {!isInitialized && (
        <div className='flex flex-col gap-2'>
          <InputGroup>
            <InputGroupAddon align='inline-start'>
              <User />
            </InputGroupAddon>
            <InputGroupInput type='text' placeholder='User ID' value={userId} onChange={handleUserIdChange} required />
            <InputGroupAddon align='inline-end'>
              <InputGroupButton type='button' onClick={handleGenerateId} size='icon-xs'>
                <Dices />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </div>
      )}

      {isInitialized && (
        <div className='flex flex-col gap-2'>
          <InputGroup>
            <InputGroupAddon align='inline-start'>
              <User />
            </InputGroupAddon>
            <InputGroupInput type='text' value={storedUserId || ''} disabled readOnly />
          </InputGroup>
        </div>
      )}

      <div className='flex flex-col gap-2'>
        <InputGroup>
          <InputGroupAddon align='inline-start'>
            <Mail />
          </InputGroupAddon>
          <InputGroupInput
            type='email'
            placeholder='User Email'
            value={userEmail}
            onChange={handleUserEmailChange}
            aria-invalid={!!emailError}
            required
          />
        </InputGroup>
        {emailError && <p className='text-sm text-destructive'>{emailError}</p>}
      </div>

      {isInitialized && (
        <div className='flex items-center gap-3'>
          <Checkbox id='terms' onCheckedChange={handleReassignVariantChange} />
          <Label htmlFor='terms'>Reassign Variant</Label>
        </div>
      )}

      <Button type='submit' className='w-full'>
        {isInitialized ? 'Update Email' : 'Initialize User'}
      </Button>

      {isInitialized && (
        <Button variant='outline' className='w-full' onClick={handleClearAll}>
          Clear all
        </Button>
      )}
    </form>
  )
}

export default UserWidget
