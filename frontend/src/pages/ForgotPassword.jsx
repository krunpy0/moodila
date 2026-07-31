import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { forgotPassword } from "../api/auth";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const forgotMutation = useMutation({
    mutationFn: (userEmail) => forgotPassword(userEmail),
    onSuccess: (data) => {
      setSuccessMessage(
        data?.message ||
          "If that email address is in our system, we have sent a password reset link."
      );
    },
    onError: (requestError) => setError(requestError.message),
  });

  const submit = (event) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
    forgotMutation.mutate(email);
  };

  return (
    <main className="min-h-screen bg-background text-on-background px-container-margin py-xl flex items-center justify-center">
      <section className="w-full max-w-md" aria-labelledby="forgot-title">
        <div className="mb-xl text-center">
          <div className="mx-auto mb-md w-16 h-16 rounded-full bg-primary-container flex items-center justify-center text-[30px]">
            <span aria-hidden="true">🔑</span>
          </div>
          <h1
            id="forgot-title"
            className="text-headline-xl font-headline-xl text-on-surface"
          >
            Reset password
          </h1>
          <p className="mt-xs text-body-sm font-body-sm text-on-surface-variant">
            Enter the email address associated with your account
          </p>
        </div>

        <div className="bg-white rounded-[24px] p-lg cloud-shadow">
          {successMessage ? (
            <div className="flex flex-col gap-md text-center">
              <div className="p-md rounded-lg bg-primary-container/40 text-on-primary-container text-body-md font-body-md">
                {successMessage}
              </div>
              <Link
                to="/login"
                className="mt-xs h-12 rounded-lg bg-primary-container text-on-primary-container text-label-lg font-label-lg flex items-center justify-center"
              >
                Return to log in
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-md">
              <label className="flex flex-col gap-xs text-label-sm font-label-sm text-on-surface-variant">
                Email
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  autoComplete="email"
                  required
                  className="h-12 w-full rounded-lg bg-surface-container-low px-md text-body-md font-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary-fixed-dim"
                />
              </label>

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
                disabled={forgotMutation.isPending}
                className="mt-xs h-12 rounded-lg bg-primary-container text-on-primary-container text-label-lg font-label-lg disabled:opacity-60"
              >
                {forgotMutation.isPending
                  ? "Sending..."
                  : "Send reset link"}
              </button>

              <Link
                to="/login"
                className="text-center text-label-lg font-label-lg text-primary hover:underline mt-xs block"
              >
                Back to log in
              </Link>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
