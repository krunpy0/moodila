import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { login, register } from "../api/auth";
import { queryKeys, useSessionQuery } from "../api/queries";
import { useLanguage } from "../context/LanguageContext";

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    email: "",
    password: "",
    username: "",
  });
  const [error, setError] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const sessionQuery = useSessionQuery(true);

  const authMutation = useMutation({
    mutationFn: (data) => (mode === "login" ? login(data) : register(data)),
    onSuccess: () => {
      queryClient.removeQueries();
      queryClient.invalidateQueries({ queryKey: queryKeys.session });
      navigate("/home", { replace: true });
    },
    onError: (requestError) => setError(requestError.message),
  });

  if (sessionQuery.data && !sessionQuery.isError)
    return <Navigate to="/home" replace />;

  const update = ({ target }) =>
    setForm((current) => ({ ...current, [target.name]: target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    authMutation.mutate(form);
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError("");
  };

  const infoMessage = location.state?.message;

  return (
    <main className="min-h-screen bg-background text-on-background px-container-margin py-xl flex items-center justify-center">
      <section
        className="w-full max-w-md lg:max-w-4xl lg:grid lg:grid-cols-2 bg-surface-container-lowest rounded-[32px] cloud-shadow overflow-hidden"
        aria-labelledby="auth-title"
      >
        {/* Left Side Branding Card (Desktop) */}
        <div className="hidden lg:flex flex-col justify-between p-10 bg-primary-container/30 border-r border-outline-variant/15 select-none">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary-container flex items-center justify-center text-[28px] shadow-xs">
              <span>🌸</span>
            </div>
            <div>
              <h1 className="text-headline-lg font-bold text-on-surface">
                Moodila
              </h1>
              <span className="text-label-sm text-on-surface-variant font-medium">
                Mood & Social Journal
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-headline-xl font-bold text-on-surface leading-tight">
              Keep your days close.
              <br />
              Share them gently.
            </h2>
            <p className="text-body-md text-on-surface-variant/80">
              Track your emotional wellness, share memories with friends, and
              reflect on your personal journey.
            </p>
          </div>

          <div className="flex items-center gap-2 text-label-sm text-on-surface-variant/70 font-semibold"></div>
        </div>

        {/* Right Side Auth Form */}
        <div className="p-6 lg:p-10 flex flex-col justify-center">
          <div className="mb-lg text-center lg:hidden">
            <div className="mx-auto mb-md w-16 h-16 rounded-full bg-primary-container flex items-center justify-center text-[30px]">
              <span aria-hidden="true">🌸</span>
            </div>
            <h1
              id="auth-title"
              className="text-headline-xl font-headline-xl text-on-surface"
            >
              Moodila
            </h1>
            <p className="mt-xs text-body-sm font-body-sm text-on-surface-variant">
              Keep your days close. Share them gently.
            </p>
          </div>

          <div>
            {infoMessage && (
              <div className="mb-md p-sm rounded-lg bg-primary-container/40 text-on-primary-container text-body-sm font-body-sm text-center">
                {infoMessage}
              </div>
            )}

            <div className="grid grid-cols-2 gap-xs p-1 mb-lg bg-surface-container-low rounded-lg">
              {["login", "register"].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => switchMode(item)}
                  className={`h-11 rounded-md text-label-lg font-label-lg transition-colors ${
                    mode === item
                      ? "bg-white text-on-surface shadow-sm"
                      : "text-on-surface-variant"
                  }`}
                >
                  {item === "login"
                    ? t("auth.loginBtn")
                    : t("auth.registerBtn")}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="flex flex-col gap-md">
              {mode === "register" && (
                <Field
                  label={t("auth.username")}
                  name="username"
                  value={form.username}
                  onChange={update}
                  autoComplete="username"
                  minLength="3"
                  maxLength="24"
                  pattern="[a-z0-9_]+"
                  required
                />
              )}
              <Field
                label={t("auth.email")}
                name="email"
                type="text"
                value={form.email}
                onChange={update}
                autoComplete="username"
                required
              />
              <div>
                <Field
                  label={t("auth.password")}
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={update}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  minLength="8"
                  maxLength="72"
                  required
                />
                {mode === "login" && (
                  <div className="mt-xs text-right">
                    <Link
                      to="/forgot-password"
                      className="text-label-sm font-label-sm text-primary hover:underline"
                    >
                      {t("auth.forgotPassword")}
                    </Link>
                  </div>
                )}
              </div>

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
                disabled={authMutation.isPending}
                className="mt-xs h-12 rounded-lg bg-primary-container text-on-primary-container text-label-lg font-label-lg disabled:opacity-60"
              >
                {authMutation.isPending
                  ? t("common.loading")
                  : mode === "login"
                    ? t("auth.loginBtn")
                    : t("auth.createAccount")}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}

function Field({ label, ...props }) {
  return (
    <label className="flex flex-col gap-xs text-label-sm font-label-sm text-on-surface-variant">
      {label}
      <input
        {...props}
        className="h-12 w-full rounded-lg bg-surface-container-low px-md text-body-md font-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary-fixed-dim"
      />
    </label>
  );
}
