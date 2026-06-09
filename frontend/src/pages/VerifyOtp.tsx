import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { setAccessToken } from "../auth/authClient";

export function VerifyOtp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const forceReset = searchParams.get("forceReset") || "false";

  const [otp, setOtp] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);


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

      if (json.accessToken) {
        setAccessToken(json.accessToken);
      }

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

  async function onResend(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    setResendMessage(null);
    setError(null);
    setResending(true);
    setOtp("");

    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed to resend OTP");

      setResendMessage("A new OTP has been sent.");
    } catch (err) {
      setError(String(err));
    } finally {
      setResending(false);
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
              Secure Verification
            </h1>

            <p className="mt-6 text-lg text-slate-200 leading-relaxed">
              Protect your account with secure OTP authentication.
              Fast, reliable, and designed for enterprise-grade access control.
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              {[
                "Security",
                "Authentication",
                "OTP Verification",
                "Enterprise Access",
                "Encrypted Sessions",
                "Identity Protection",
                "Secure Login",
                "Compliance",
                "Trust",
                "Data Protection",
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
                Verify OTP
              </h1>

              <p className="text-sm text-slate-900">
                Enter the 6-digit code sent to
              </p>

              <p className="text-sm font-semibold text-[#000] break-all">
                {email}
              </p>
            </div>

            <form className="mt-6 space-y-4" onSubmit={onVerify}>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  OTP Code
                </label>

                <input
                  className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-center text-lg tracking-[0.5em] font-semibold focus:outline-none focus:ring-2 focus:ring-[#deffc4]"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                />
              </div>

              {error && (
                <div className="text-sm text-rose-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#ff953d] hover:bg-[#ffcda3] text-white font-bold text-sm px-4 py-3 rounded-xl transition-colors disabled:opacity-60"
              >
                {loading ? "Verifying…" : "Verify"}
              </button>

              <div className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={onResend}
                  disabled={resending}
                  className="text-xs font-semibold text-slate-800 hover:underline disabled:opacity-60"
                >
                  {resending ? "Resending…" : "Resend OTP"}
                </button>
              </div>
            </form>

            <div className="mt-5 text-xs text-slate-800 leading-relaxed">
              OTP is sent securely via email or SMS.
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
);
}
