export default function PasswordFieldsForm({
  showOldPassword = false,
  oldPassword = '',
  setOldPassword = () => {},
  oldPasswordError = '',
  newPassword = '',
  setNewPassword = () => {},
  confirmPassword = '',
  setConfirmPassword = () => {},
  oldPasswordLabel = 'Current password',
  newPasswordLabel = 'New password',
  confirmPasswordLabel = 'Confirm new password',
}) {
  return (
    <>
      {showOldPassword && (
        <div>
          <label className="flex flex-col gap-xs text-label-sm font-label-sm text-on-surface-variant">
            {oldPasswordLabel}
            <input
              type="password"
              name="oldPassword"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              minLength={8}
              maxLength={72}
              required
              autoComplete="current-password"
              className="h-12 w-full rounded-lg bg-surface-container-low px-md text-body-md font-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary-fixed-dim"
            />
          </label>
          {oldPasswordError && (
            <p className="mt-xs px-sm py-xs rounded-md bg-error-container text-on-error-container text-body-sm font-body-sm" role="alert">
              {oldPasswordError}
            </p>
          )}
        </div>
      )}

      <label className="flex flex-col gap-xs text-label-sm font-label-sm text-on-surface-variant">
        {newPasswordLabel}
        <input
          type="password"
          name="newPassword"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={8}
          maxLength={72}
          required
          autoComplete="new-password"
          className="h-12 w-full rounded-lg bg-surface-container-low px-md text-body-md font-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary-fixed-dim"
        />
      </label>

      <label className="flex flex-col gap-xs text-label-sm font-label-sm text-on-surface-variant">
        {confirmPasswordLabel}
        <input
          type="password"
          name="confirmPassword"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={8}
          maxLength={72}
          required
          autoComplete="new-password"
          className="h-12 w-full rounded-lg bg-surface-container-low px-md text-body-md font-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary-fixed-dim"
        />
      </label>
    </>
  )
}
