import { Eye, EyeOff } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("admin@local.test");
  const [password, setPassword] = useState<string>("Admin123!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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

      if (!json.success) {
        throw new Error(json.message || "Login failed");
      }

      navigate(
        `/verify-otp?email=${encodeURIComponent(email)}` +
          `&forceReset=${encodeURIComponent(
            String(json.forcePasswordReset)
          )}`
      );
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat relative"
      style={{
        backgroundImage: "url('/login/screen.png')",
      }}
    >
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/55" />
      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          {/* LEFT SIDE */}
          <div className="hidden lg:block text-white">
            <div className="max-w-xl">
              <h1 className="text-5xl font-black leading-tight">
                Modern ERP Platform
              </h1>

              <p className="mt-6 text-lg text-slate-200 leading-relaxed">
                Streamline operations, manage teams, track inventory,
                automate workflows, and drive business growth from one
                centralized platform.
              </p>

              <div className="mt-10 flex flex-wrap gap-3">
                {[
                  "Inventory",
                  "Finance",
                  "Analytics",
                  "Automation",
                  "Payroll",
                  "Procurement",
                  "CRM",
                  "HR Management",
                  "Operations",
                  "Productivity",
                ].map((item) => (
                  <span
                    key={item}
                    className="px-4 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm text-sm font-medium"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div className="flex justify-center lg:justify-end">
            <div className="w-full max-w-xl bg-white/35 backdrop-blur-md border border-white/20 rounded-3xl shadow-2xl p-8">
              <div className="space-y-1">
                <h1 className="text-2xl font-black text-slate-900">
                  Sign in
                </h1>

                <p className="text-sm text-slate-900">
                  Enter your credentials.
                </p>
              </div>

              <form className="mt-6 space-y-4" onSubmit={onSubmit}>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Email
                  </label>

                  <input
                    className="w-full bg-white/80 border border-slate-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#deffc4]"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    autoComplete="email"
                  />
                </div>

                <div>
                 <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Password
                 </label>

                <div className="relative">
                 <input
                  className="w-full bg-white/80 border border-slate-200 rounded-xl px-3 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-[#deffc4]"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-500 hover:text-slate-700"
                >
               {showPassword ? (
                 <EyeOff size={18} />
               ) : (
                 <Eye size={18} />
               )}
              </button>
              </div>
           </div>

                {error && (
                  <div className="text-sm text-rose-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#ff9b47] hover:bg-[#ffcda3] text-white font-bold text-sm px-4 py-3 rounded-xl transition-colors disabled:opacity-60"
                >
                  {loading ? "Signing in…" : "Continue"}
                </button>
              </form>

              <div className="mt-5 text-xs text-slate-600">
                Demo admin:
                <span className="font-bold ml-1">
                  admin@local.test
                </span>
                {" / "}
                <span className="font-bold">
                  Admin123!
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}