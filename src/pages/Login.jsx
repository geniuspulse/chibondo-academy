import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, Mail, Loader2, MessageCircle, Lock, Eye, EyeOff } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import SEO from "@/components/SEO";
import { getReferralCode } from "@/lib/referralCookie";
import { db } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";

export default function Login() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, authChecked } = useAuth();
  const refCode = searchParams.get("ref") || getReferralCode();

  const [loginMethod, setLoginMethod] = useState("whatsapp"); // whatsapp | email
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(
    parseInt(localStorage.getItem("login_fail_count") || "0", 10)
  );

  useEffect(() => {
    if (refCode) localStorage.setItem("pending_referral_code", refCode.toUpperCase());
  }, [refCode]);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (authChecked && isAuthenticated) window.location.replace("/dashboard");
  }, [authChecked, isAuthenticated]);

  const recordFailure = () => {
    const count = failedAttempts + 1;
    setFailedAttempts(count);
    localStorage.setItem("login_fail_count", String(count));
    if (count >= 3) {
      localStorage.removeItem("login_fail_count");
      setTimeout(() => navigate("/register", { replace: true }), 1500);
    }
    return count;
  };

  const resetFailures = () => {
    setFailedAttempts(0);
    localStorage.removeItem("login_fail_count");
  };

  // ── WhatsApp login ──
  const handleWhatsAppSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const digits = phone.replace(/\D/g, "");
    if (digits.length < 9) {
      setError("Please enter a valid phone number");
      return;
    }

    resetFailures();
    setSent(true);

    // Redirect to WhatsApp with a pre-filled message to the business number.
    // This opens the 24-hour customer service window so we can reply with a
    // magic login link as free-form text — no template approval needed.
    const bizNumber = import.meta.env.VITE_WA_BUSINESS_NUMBER || '265991234567';
    const prefilled = encodeURIComponent(`Login`);
    window.location.href = `https://wa.me/${bizNumber}?text=${prefilled}`;
  };

  // ── Email login ──
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Please enter your email");
      return;
    }
    if (!password) {
      setError("Please enter your password");
      return;
    }

    setLoading(true);
    try {
      const result = await db.auth.loginViaEmailPassword(email.trim(), password);
      if (result?.access_token || result?.user) {
        resetFailures();
        window.location.replace("/dashboard");
      } else {
        const count = recordFailure();
        setError("Invalid email or password.");
        if (count >= 3) {
          setError("Too many failed attempts. Redirecting to registration…");
        }
      }
    } catch (err) {
      const count = recordFailure();
      setError(
        err.message?.includes("Invalid") || err.message?.includes("invalid")
          ? "Invalid email or password."
          : "Login failed. Please try again."
      );
      if (count >= 3) {
        setError("Too many failed attempts. Redirecting to registration…");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEO
        title="Login"
        description="Sign in to your Chibondo Academy account with WhatsApp verification."
        canonical={`${window.location.origin}/login`}
      />
      <AuthLayout
        title="Welcome Back"
        subtitle="Sign in with your WhatsApp number or email"
        footer={
          <>
            New to the academy?{" "}
            <Link to="/register" className="text-primary font-medium hover:underline">Join us</Link>
          </>
        }
      >
        {/* Method toggle */}
        <div className="flex gap-1 p-1 bg-muted/50 rounded-xl mb-5">
          <button
            type="button"
            onClick={() => { setLoginMethod("whatsapp"); setError(""); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              loginMethod === "whatsapp"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            <MessageCircle className="w-4 h-4 inline mr-1.5" />WhatsApp
          </button>
          <button
            type="button"
            onClick={() => { setLoginMethod("email"); setError(""); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              loginMethod === "email"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            <Mail className="w-4 h-4 inline mr-1.5" />Email
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        {sent && (
          <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 text-sm text-center">
            <Loader2 className="w-4 h-4 inline mr-1 animate-spin" />
            Sending verification…
          </div>
        )}

        {/* WhatsApp login */}
        {loginMethod === "whatsapp" && (
          <div className="space-y-4">
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
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Tap below to open WhatsApp with a pre-filled message. Send it and we'll reply with a login link.
              </p>
            </div>

            {!sent ? (
              <Button onClick={handleWhatsAppSubmit} className="w-full h-12 font-semibold bg-green-600 hover:bg-green-700">
                <MessageCircle className="w-4 h-4 mr-2" />Get Login Link
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">
                    WhatsApp is opening…
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Send the pre-filled message to receive your login link, then tap it to log in.
                  </p>
                </div>
                <Button
                  onClick={() => setSent(false)}
                  variant="outline"
                  className="w-full h-10 text-sm"
                >
                  Back
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Email login */}
        {loginMethod === "email" && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full h-12 font-semibold" disabled={loading}>
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in…</>
              ) : (
                <><Mail className="w-4 h-4 mr-2" />Sign In</>
              )}
            </Button>
          </form>
        )}

        <div className="text-center mt-4">
          <Link to="/forgot-password" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            Forgot your password?
          </Link>
        </div>

        {refCode && (
          <div className="mt-4 p-3 rounded-lg bg-accent/10 border border-accent/20 text-sm">
            <p className="font-semibold text-accent">Referral Code Applied</p>
            <p className="text-xs text-muted-foreground mt-0.5">Code: <span className="font-mono">{refCode}</span></p>
          </div>
        )}
      </AuthLayout>
    </>
  );
}
