import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router-dom";
import { login, register } from "../api/auth";
import { queryKeys, useSessionQuery } from "../api/queries";

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    email: "",
    password: "",
    username: "",
  });
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sessionQuery = useSessionQuery(true);

  const authMutation = useMutation({
    mutationFn: (data) => (mode === "login" ? login(data) : register(data)),
    onSuccess: () => {
      queryClient.removeQueries();
      queryClient.invalidateQueries({ queryKey: queryKeys.session });
      navigate("/", { replace: true });
    },
    onError: (requestError) => setError(requestError.message),
  });

  if (sessionQuery.data && !sessionQuery.isError) return <Navigate to="/" replace />;

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

  return (
    <main className="min-h-screen bg-background text-on-background px-container-margin py-xl flex items-center justify-center">
      <section className="w-full max-w-md" aria-labelledby="auth-title">
        <div className="mb-xl text-center">
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

        <div className="bg-white rounded-[24px] p-lg cloud-shadow">
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
                {item === "login" ? "Log in" : "Sign up"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="flex flex-col gap-md">
            {mode === "register" && (
              <Field
                label="Username"
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
              label="Email or Username"
              name="email"
              type="text"
              value={form.email}
              onChange={update}
              autoComplete="username"
              required
            />
            <Field
              label="Password"
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
                ? "Please wait..."
                : mode === "login"
                  ? "Log in"
                  : "Create account"}
            </button>
          </form>
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
