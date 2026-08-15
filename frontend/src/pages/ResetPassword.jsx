import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { resetPassword } from "../api/auth";
import PasswordFieldsForm from "../components/PasswordFieldsForm";
import { useLanguage } from "../context/LanguageContext";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { t } = useLanguage();

  const resetMutation = useMutation({
    mutationFn: () => resetPassword(token, newPassword),
    onSuccess: () => {
      navigate("/login", {
        replace: true,
        state: { message: t("auth.passwordResetSuccess") },
      });
    },
    onError: (requestError) => setError(requestError.message),
  });

  const submit = (event) => {
    event.preventDefault();
    setError("");

    if (!token) {
      setError(t("auth.resetTokenMissing"));
      return;
    }
    if (newPassword.length < 8) {
      setError(t("changePassword.tooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("changePassword.mismatch"));
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
            {t("auth.setNewPassword")}
          </h1>
          <p className="mt-xs text-body-sm font-body-sm text-on-surface-variant">
            {t("auth.setNewPasswordSubtitle")}
          </p>
        </div>

        <div className="bg-white rounded-[24px] p-lg cloud-shadow">
          {!token ? (
            <div className="flex flex-col gap-md text-center">
              <p
                className="px-sm py-xs rounded-md bg-error-container text-on-error-container text-body-sm font-body-sm"
                role="alert"
              >
                {t("auth.resetTokenInvalid")}
              </p>
              <Link
                to="/forgot-password"
                className="mt-xs h-12 rounded-lg bg-primary-container text-on-primary-container text-label-lg font-label-lg flex items-center justify-center"
              >
                {t("auth.requestNewLink")}
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-md">
              <PasswordFieldsForm
                newPassword={newPassword}
                setNewPassword={setNewPassword}
                confirmPassword={confirmPassword}
                setConfirmPassword={setConfirmPassword}
                newPasswordLabel={t("changePassword.newPassword")}
                confirmPasswordLabel={t("changePassword.confirmPassword")}
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
                  ? t("common.loading")
                  : t("auth.saveNewPassword")}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
