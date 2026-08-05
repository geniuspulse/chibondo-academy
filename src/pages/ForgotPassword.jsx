import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, Lock, Loader2, CheckCircle2, Eye, EyeOff, MessageCircle } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import SEO from "@/components/SEO";
import { db } from "@/api/supabaseClient";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const isSetPwMode = searchParams.get("setpw") === "1";

  // ── Set new password ──
  const handleSetPassword = async (e) => {
    e.preventDefault();
    setError("");

    if (newPw.length < 6) return setError("Password must be at least 6 characters");
    if (newPw !== confirmPw) return setError("Passwords do not match");

    setLoading(true);
    try {
      await db.auth.changePassword(newPw);
      setResetDone(true);
      setTimeout(() => navigate("/login", { replace: true }), 2000);
    } catch (err) {
      setError(err?.message || "Could not set password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const pwType = showPw ? "text" : "password";

  // ── Set New Password screen ──
  if (isSetPwMode && !resetDone) {
    return (
      <>
        <SEO title="Set New Password" description="Set a new password for your Chibondo Academy account." />
        <AuthLayout title="Set New Password">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPw">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="newPw"
                  type={pwType}
                  autoFocus
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="pl-10 pr-10 h-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPw">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirmPw"
                  type={pwType}
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  className="pl-10 h-12"
                  required
                />
              </div>
            </div>

            {newPw.length > 0 && (
              <div className="flex gap-1.5">
                {[1,2,3,4].map(i => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                    newPw.length >= i * 3
                      ? i <= 1 ? 'bg-red-400'
                      : i <= 2 ? 'bg-amber-400'
                      : i <= 3 ? 'bg-yellow-400'
                      : 'bg-emerald-500'
                      : 'bg-muted'
                  }`} />
                ))}
              </div>
            )}

            <Button type="submit" className="w-full h-12 font-semibold" disabled={loading}>
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Setting…</>
              ) : (
                <><Lock className="w-4 h-4 mr-2" />Set New Password</>
              )}
            </Button>
          </form>
        </AuthLayout>
      </>
    );
  }

  // ── Password set successfully ──
  if (resetDone) {
    return (
      <>
        <SEO title="Password Updated" description="Your password has been updated." />
        <AuthLayout title="Password Updated">
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-20 h-20 rounded-2xl bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <p className="text-sm text-muted-foreground text-center">Redirecting you to login…</p>
          </div>
        </AuthLayout>
      </>
    );
  }

  // ── Default: request WhatsApp reset link ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const digits = phone.replace(/\D/g, "");
    if (digits.length < 9) return setError("Please enter a valid phone number");

    setSent(true);
    const bizNumber = import.meta.env.VITE_WA_BUSINESS_NUMBER || "265991234567";
    const prefilled = encodeURIComponent("Reset");
    window.location.href = `https://wa.me/${bizNumber}?text=${prefilled}`;
  };

  return (
    <>
      <SEO
        title="Reset Password"
        description="Reset your Chibondo Academy account password via WhatsApp."
        canonical={`${window.location.origin}/forgot-password`}
      />
      <AuthLayout
        title="Reset Password"
        footer={
          <>
            Remembered your login?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
          </>
        }
      >
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        {sent ? (
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
              <MessageCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-green-700 dark:text-green-400">WhatsApp is opening…</p>
              <p className="text-xs text-muted-foreground mt-1">
                Send the message and tap the link we reply with.
              </p>
            </div>
            <Button onClick={() => setSent(false)} variant="outline" className="w-full h-10 text-sm">
              Back
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">WhatsApp Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  autoFocus
                  autoComplete="tel"
                  placeholder="0991234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-10 h-12"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-12 font-semibold bg-green-600 hover:bg-green-700">
              <MessageCircle className="w-4 h-4 mr-2" />Get Reset Link
            </Button>
          </form>
        )}
      </AuthLayout>
    </>
  );
}
