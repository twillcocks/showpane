"use client";

import { useState, FormEvent } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";

export type PortalLoginProps = {
  companyName: string;
  companyLogoSrc?: string | null;
  companyLogoAlt?: string;
  companyUrl: string;
  portalLabel?: string;
  description?: string;
  supportEmail: string;
  authEndpoint?: string;
  redirectBasePath?: string;
};

export function PortalLogin({
  companyName,
  companyLogoSrc,
  companyLogoAlt,
  companyUrl,
  portalLabel,
  description,
  supportEmail,
  authEndpoint,
  redirectBasePath,
}: PortalLoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  const resolvedPortalLabel = portalLabel ?? "Client Portal";
  const resolvedDescription = description ?? `Private portal for ${companyName} clients. Sign in with the credentials we sent you.`;
  const resolvedAuthEndpoint = authEndpoint ?? "/api/client-auth";
  const resolvedRedirectBasePath = redirectBasePath ?? "/client";
  const resolvedCompanyLogoAlt = companyLogoAlt ?? companyName;

  let displayDomain: string;
  try {
    displayDomain = new URL(companyUrl).hostname;
  } catch {
    displayDomain = companyUrl;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(resolvedAuthEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      if (res.ok) {
        const { slug } = await res.json();
        window.location.href = `${resolvedRedirectBasePath}/${slug}`;
        return;
      }

      if (res.status === 429) {
        setError({ message: "Too many attempts", hint: "Please wait a minute before trying again." });
      } else if (res.status === 503) {
        setError({ message: "Portal auth is not configured", hint: "Restart the dev server after updating environment variables." });
      } else if (res.status >= 500) {
        setError({ message: "Unable to sign in", hint: "The server returned an error. Try again in a moment." });
      } else {
        setError({ message: "Invalid username or password", hint: "Credentials are case-sensitive. Check for typos." });
      }
    } catch {
      setError({ message: "Unable to connect", hint: "Check your internet connection and try again." });
    }

    setLoading(false);
  }

  const canSubmit = username.trim().length > 0 && password.length > 0 && !loading;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gray-100 px-4">
      <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-[140px]" />
      <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary/5 blur-[120px]" />

      <div className="relative z-10 w-full max-w-sm">
        <a href={companyUrl} className="mx-auto mb-8 flex w-fit items-center gap-2 transition-opacity hover:opacity-70">
          {companyLogoSrc && !logoFailed ? (
            <img
              src={companyLogoSrc}
              alt={resolvedCompanyLogoAlt}
              className="h-7 w-7 rounded-lg object-cover"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-900">
              <span className="text-xs font-bold text-white">
                {companyName[0]?.toUpperCase() || "S"}
              </span>
            </div>
          )}
          <span className="text-base font-bold tracking-tight text-gray-900">{companyName}</span>
        </a>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h1 className="text-xl font-bold tracking-tight text-gray-900">{resolvedPortalLabel}</h1>
            <p className="mt-1 text-sm leading-relaxed text-gray-500">
              {resolvedDescription}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">Company Name</label>
              <input
                id="username"
                type="text"
                autoFocus
                autoComplete="username"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(null); }}
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
              <div className="relative mt-1">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-10 text-sm text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-gray-400 transition-colors hover:text-gray-600"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && (
              <div className="rounded-lg bg-red-50 px-3 py-2">
                <p className="text-sm text-red-600">{error.message}</p>
                {error.hint && <p className="mt-0.5 text-xs text-red-500/70">{error.hint}</p>}
              </div>
            )}
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-gray-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "Signing in..." : "Sign In"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>
        </div>

        <div className="mt-5 space-y-2 text-center text-xs">
          <p className="text-gray-400">
            Not a client? <a href={companyUrl} className="text-gray-500 underline underline-offset-2 transition-colors hover:text-gray-700">Visit {displayDomain}</a>
          </p>
          <p className="text-gray-400">
            Lost your credentials? Email <span className="font-medium text-gray-500">{supportEmail}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
