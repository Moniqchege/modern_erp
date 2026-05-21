import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("admin@local.test");
  const [password, setPassword] = useState<string>("Admin123!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await fetch("/api/auth/seed", { method: "POST" });
      } catch {
        // ignore
      }
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Login failed");

      navigate(
        `/verify-otp?email=${encodeURIComponent(email)}` +
          `&forceReset=${encodeURIComponent(String(json.forcePasswordReset))}`
      );
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <div className="space-y-1">
          <h1 className="text-xl font-black text-slate-900">Sign in</h1>
          <p className="text-xs text-slate-500">Enter your credentials. We’ll verify via OTP.</p>
        </div>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Email</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Password</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
            />
          </div>

          {error && <div className="text-xs text-rose-700">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-colors disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Continue"}
          </button>
        </form>

        <div className="mt-4 text-[11px] text-slate-500">
          Demo admin: <span className="font-bold">admin@local.test</span> / <span className="font-bold">Admin123!</span>
        </div>
      </div>
    </div>
  );
}

