import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { forgotPassword } from "../api/auth";
import { useLanguage } from "../context/LanguageContext";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const { t } = useLanguage();

  const forgotMutation = useMutation({
    mutationFn: (userEmail) => forgotPassword(userEmail),
    onSuccess: (data) => {
      setSuccessMessage(data?.message || t('auth.resetInstructionsSent'));
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
            {t('auth.resetPasswordTitle')}
          </h1>
        </div>

        <div className="bg-surface-container-lowest rounded-xl lg:rounded-xxl p-lg shadow-card border border-outline-variant/20">
          {successMessage ? (
            <div className="flex flex-col gap-md text-center">
              <div className="p-md rounded-xl bg-primary-container/40 text-on-primary-container text-body-md font-body-md border border-primary/20">
                {successMessage}
              </div>
              <Link
                to="/login"
                className="mt-xs h-12 rounded-full bg-primary text-on-primary text-label-lg font-bold shadow-sm hover:bg-primary/90 flex items-center justify-center transition-all"
              >
                {t('auth.signInLink')}
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-md">
              <label className="flex flex-col gap-xs text-label-sm font-label-sm text-on-surface-variant">
                {t('auth.email')}
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  autoComplete="email"
                  required
                  className="h-12 w-full rounded-xl bg-surface-container-low border border-outline-variant/20 px-md text-body-md font-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </label>

              {error && (
                <p
                  className="px-sm py-xs rounded-xl bg-error-container text-on-error-container text-body-sm font-body-sm border border-error/20"
                  role="alert"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={forgotMutation.isPending}
                className="mt-xs h-12 rounded-full bg-primary text-on-primary text-label-lg font-bold shadow-sm hover:bg-primary/90 disabled:opacity-60 transition-all active:scale-[0.99]"
              >
                {forgotMutation.isPending
                  ? t('common.loading')
                  : t('auth.sendResetLink')}
              </button>

              <Link
                to="/login"
                className="text-center text-label-lg font-label-lg text-primary hover:underline mt-xs block"
              >
                {t('auth.signInLink')}
              </Link>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
