import { useState } from "react";
import { requestAccountDeletion } from "../api/auth";

export default function DeleteAccountModal({ isOpen, onClose }) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isPending, setIsPending] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setPassword("");
    setError("");
    setSuccessMessage("");
    setIsPending(false);
    onClose();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!password) {
      setError("Please enter your password to proceed.");
      return;
    }

    setIsPending(true);
    try {
      const response = await requestAccountDeletion(password);
      setSuccessMessage(
        response.message ||
          "Check your email inbox for the confirmation link to complete account deletion.",
      );
    } catch (err) {
      setError(
        err.message || "Could not request account deletion. Please try again.",
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-container-margin backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
    >
      <div className="w-full max-w-md rounded-[24px] bg-surface-container-lowest p-lg cloud-shadow space-y-md">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-error-container text-error">
              <span className="material-symbols-outlined text-[22px]">
                warning
              </span>
            </div>
            <div>
              <h2
                id="delete-modal-title"
                className="text-headline-lg-mobile font-semibold text-on-surface"
              >
                Delete account
              </h2>
              <p className="text-body-sm text-on-surface-variant">
                Factor 1 of 2 confirmation
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close modal"
            className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {successMessage ? (
          <div className="space-y-md text-center py-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-container text-primary">
              <span className="material-symbols-outlined text-[28px]">
                mark_email_read
              </span>
            </div>
            <p className="text-body-md font-medium text-on-surface">
              Confirmation email sent
            </p>
            <p className="text-body-sm text-on-surface-variant">
              {successMessage}
            </p>
            <p className="text-label-sm text-outline">
              Your account will remain active until you click the confirmation
              link in the email.
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="mt-md w-full rounded-full bg-primary py-sm text-label-lg font-semibold text-on-primary shadow-sm"
            >
              Got it
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-md">
            <div className="rounded-xl bg-error-container/40 p-sm text-body-sm text-on-error-container border border-error/10">
              <p className="font-medium">This action is permanent</p>
              <p className="mt-xs text-label-sm opacity-90">
                Enter your password to confirm account deletion
              </p>
            </div>

            <div>
              <label
                htmlFor="delete-password-input"
                className="block text-label-sm font-medium text-on-surface-variant mb-xs"
              >
                Current password
              </label>
              <div className="relative">
                <input
                  id="delete-password-input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your current password"
                  required
                  disabled={isPending}
                  className="w-full rounded-xl bg-surface-container-low px-md py-sm pr-10 text-body-md outline-none transition-all focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg bg-error-container p-xs text-body-sm font-medium text-on-error-container"
              >
                {error}
              </p>
            )}

            <div className="flex items-center gap-sm pt-xs">
              <button
                type="button"
                onClick={handleClose}
                disabled={isPending}
                className="flex-1 rounded-full bg-surface-container-highest py-sm text-label-lg font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !password}
                className="flex-1 rounded-full bg-error py-sm text-label-lg font-semibold text-on-error shadow-sm transition-opacity hover:opacity-95 disabled:opacity-50"
              >
                {isPending ? "Sending link..." : "Send email link"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
