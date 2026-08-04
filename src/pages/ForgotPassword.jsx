import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, CheckCircle2, Eye, EyeOff, MessageCircle } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import SEO from "@/components/SEO";
import { db } from "@/api/supabaseClient";

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  // Recovery token state (from Supabase redirect)
  const [recoveryToken, setRecoveryToken] = useState(null);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  // Check for Supabase recovery redirect (hash contains type=recovery&access_token=...)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.slice(1);
      const params = new URLSearchParams(hash);
      const type = params.get('type');
      const token = params.get('access_token');
      if (type === 'recovery' && token) {
        setRecoveryToken(token);
        window.history.replaceState(null, '', '/forgot-password');
      }
    }
  }, []);

  // ── Send recovery email ──
  const handleSendReset = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }

    setLoading(true);
    try {
      await db.auth.resetPasswordRequest(
        email.trim(),
        `${window.location.origin}/forgot-password`
      );
      setSent(true);
    } catch (err) {
      // Supabase returns success even for unknown emails (security)
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  // ── Set new password (after recovery link click) ──
  const handleSetPassword = async (e) => {
    e.preventDefault();
    setError("");

    if (newPw.length < 6) return setError("Password must be at least 6 characters");
    if (newPw !== confirmPw) return setError("Passwords do not match");

    setLoading(true);
    try {
      await db.auth.resetPassword(newPw, recoveryToken);
      setResetDone(true);
      setTimeout(() => navigate("/login", { replace: true }), 2000);
    } catch (err) {
      setError(err?.message || "Could not set password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  const pwType = showPw ? 'text' : 'password';

  // ── Recovery: set new password ──
  if (recoveryToken && !resetDone) {
    return (
      <>
        <SEO title="Set New Password" description="Set a new password for your Chibondo Academy account." />
        <AuthLayout title="Set New Password" subtitle="Enter a new password for your account">
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

            {/* Password strength hint */}
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
        <AuthLayout title="Password Updated" subtitle="You can now log in with your new password">
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-20 h-20 rounded-2xl bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              Redirecting you to login…
            </p>
          </div>
        </AuthLayout>
      </>
    );
  }

  // ── Default: request password reset email ──
  return (
    <>
      <SEO
        title="Reset Password"
        description="Reset your Chibondo Academy account password."
        canonical={`${window.location.origin}/forgot-password`}
      />
      <AuthLayout
        title="Reset your password"
        subtitle="Enter your email and we'll send a reset link"
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
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
              <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                Check your email
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                We've sent a password reset link to <span className="font-medium">{email}</span>.
                Click the link in the email to set a new password.
              </p>
            </div>
            <Button
              onClick={() => setSent(false)}
              variant="outline"
              className="w-full h-10 text-sm"
            >
              Use a different email
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSendReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoFocus
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-12"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                We'll send a password reset link to this email. Check your spam folder if you don't see it.
              </p>
            </div>

            <Button type="submit" className="w-full h-12 font-semibold" disabled={loading}>
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</>
              ) : (
                <><Mail className="w-4 h-4 mr-2" />Send Reset Link</>
              )}
            </Button>

            <div className="text-center text-xs text-muted-foreground pt-2">
              <p>Registered with WhatsApp only?</p>
              <Link
                to="/login"
                className="inline-flex items-center gap-1 text-green-600 hover:underline font-medium mt-1"
              >
                <MessageCircle className="w-3 h-3" /> Use WhatsApp login instead
              </Link>
            </div>
          </form>
        )}
      </AuthLayout>
    </>
  );
}
