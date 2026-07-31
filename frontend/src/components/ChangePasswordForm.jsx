import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { changePassword } from '../api/auth'
import PasswordFieldsForm from './PasswordFieldsForm'

export default function ChangePasswordForm() {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [oldPasswordError, setOldPasswordError] = useState('')
  const [generalError, setGeneralError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const mutation = useMutation({
    mutationFn: () => changePassword(oldPassword, newPassword),
    onSuccess: (data) => {
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setOldPasswordError('')
      setGeneralError('')
      setSuccessMessage(data?.message || 'Password changed successfully')
    },
    onError: (err) => {
      setSuccessMessage('')
      const msg = err.message || ''
      if (msg.includes('Текущий пароль') || msg.toLowerCase().includes('current password')) {
        setOldPasswordError('Current password is incorrect')
        setGeneralError('')
      } else {
        setOldPasswordError('')
        setGeneralError(msg || 'Could not change password')
      }
    },
  })

  const submit = (e) => {
    e.preventDefault()
    setOldPasswordError('')
    setGeneralError('')
    setSuccessMessage('')

    if (newPassword.length < 8) {
      setGeneralError('Password must be between 8 and 72 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setGeneralError('Passwords do not match')
      return
    }

    mutation.mutate()
  }

  return (
    <form onSubmit={submit} className="mt-xs flex flex-col gap-md pt-xs">
      {successMessage && (
        <div
          className="p-sm rounded-lg bg-primary-container/40 text-on-primary-container text-body-sm font-body-sm text-center flex items-center justify-center gap-xs"
          role="status"
        >
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          {successMessage}
        </div>
      )}

      <PasswordFieldsForm
        showOldPassword={true}
        oldPassword={oldPassword}
        setOldPassword={(val) => {
          setOldPassword(val)
          if (oldPasswordError) setOldPasswordError('')
        }}
        oldPasswordError={oldPasswordError}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        oldPasswordLabel="Current password"
        newPasswordLabel="New password"
        confirmPasswordLabel="Confirm new password"
      />

      {generalError && (
        <p
          className="px-sm py-xs rounded-md bg-error-container text-on-error-container text-body-sm font-body-sm"
          role="alert"
        >
          {generalError}
        </p>
      )}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="mt-xs h-12 rounded-lg bg-primary text-on-primary text-label-lg font-label-lg disabled:opacity-60 transition-transform active:scale-[0.99]"
      >
        {mutation.isPending ? 'Saving...' : 'Save password'}
      </button>
    </form>
  )
}
