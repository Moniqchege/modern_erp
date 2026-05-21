import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export function VerifyOtp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const forceReset = searchParams.get("forceReset") || "false";

  const [otp, setOtp] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!email) navigate("/login");
  }, [email, navigate]);

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "OTP verification failed");

      localStorage.setItem("accessToken", json.accessToken);

      if (json.forcePasswordReset || forceReset === "true") {
        navigate(`/force-reset?email=${encodeURIComponent(email)}`);
      } else {
        navigate("/app");
      }
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
          <h1 className="text-xl font-black text-slate-900">Verify OTP</h1>
          <p className="text-xs text-slate-500">Enter the 6-digit code for {email}.</p>
        </div>

        <form className="mt-6 space-y-4" onSubmit={onVerify}>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">OTP</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 tracking-widest"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </div>

          {error && <div className="text-xs text-rose-700">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-colors disabled:opacity-60"
          >
            {loading ? "Verifying…" : "Verify"}
          </button>
        </form>

        <div className="mt-4 text-[11px] text-slate-500">
          Demo note: backend currently returns OTP for development; in production send OTP via email/SMS.
        </div>
      </div>
    </div>
  );
}

