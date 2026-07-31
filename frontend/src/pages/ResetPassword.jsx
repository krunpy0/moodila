import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { resetPassword } from "../api/auth";
import PasswordFieldsForm from "../components/PasswordFieldsForm";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const resetMutation = useMutation({
    mutationFn: () => resetPassword(token, newPassword),
    onSuccess: () => {
      navigate("/login", {
        replace: true,
        state: { message: "Password changed successfully. Please log in with your new password." },
      });
    },
    onError: (requestError) => setError(requestError.message),
  });

  const submit = (event) => {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("Password reset token is missing from link");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    resetMutation.mutate();
  };

  return (
    <main className="min-h-screen bg-background text-on-background px-container-margin py-xl flex items-center justify-center">
      <section className="w-full max-w-md" aria-labelledby="reset-title">
        <div className="mb-xl text-center">
          <div className="mx-auto mb-md w-16 h-16 rounded-full bg-primary-container flex items-center justify-center text-[30px]">
            <span aria-hidden="true">🔒</span>
          </div>
          <h1
            id="reset-title"
            className="text-headline-xl font-headline-xl text-on-surface"
          >
            Set new password
          </h1>
          <p className="mt-xs text-body-sm font-body-sm text-on-surface-variant">
            Please enter your new password below
          </p>
        </div>

        <div className="bg-white rounded-[24px] p-lg cloud-shadow">
          {!token ? (
            <div className="flex flex-col gap-md text-center">
              <p
                className="px-sm py-xs rounded-md bg-error-container text-on-error-container text-body-sm font-body-sm"
                role="alert"
              >
                Password reset link is invalid or missing token.
              </p>
              <Link
                to="/forgot-password"
                className="mt-xs h-12 rounded-lg bg-primary-container text-on-primary-container text-label-lg font-label-lg flex items-center justify-center"
              >
                Request a new link
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-md">
              <PasswordFieldsForm
                newPassword={newPassword}
                setNewPassword={setNewPassword}
                confirmPassword={confirmPassword}
                setConfirmPassword={setConfirmPassword}
              />

              {error && (
                <p
                  className="px-sm py-xs rounded-md bg-error-container text-on-error-container text-body-sm font-body-sm"
                  role="alert"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={resetMutation.isPending}
                className="mt-xs h-12 rounded-lg bg-primary-container text-on-primary-container text-label-lg font-label-lg disabled:opacity-60"
              >
                {resetMutation.isPending
                  ? "Saving..."
                  : "Save new password"}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
