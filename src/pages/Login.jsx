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

    setLoading(true);
    try {
      const res = await fetch("/api/wa-otp?action=send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: digits, mode: "login" }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.needsRegistration) {
          const count = recordFailure();
          const remaining = 3 - count;
          setError(
            `No account found with this WhatsApp number. ` +
            `Register a new account or try email login below. ` +
            (remaining > 0 ? `(${remaining} attempt${remaining !== 1 ? "s" : ""} left before redirect)` : "Redirecting to registration…")
          );
        } else {
          setError(data.error || "Failed to send. Please try again.");
        }
        setLoading(false);
        return;
      }

      // Success — reset fail counter
      resetFailures();
      setSent(true);
      setTimeout(() => {
        navigate("/verify-otp", {
          state: {
            phone: data.phone || digits,
            refCode: refCode || null,
            mode: "login",
            deliveryMethod: data.delivery_method || null,
          },
        });
      }, 600);
    } catch (err) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
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
          <form onSubmit={handleWhatsAppSubmit} className="space-y-4">
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
              <p className="text-xs text-muted-foreground">
                We'll send a verification code to your WhatsApp. If delivery fails, we'll show it here on screen.
              </p>
            </div>

            <Button type="submit" className="w-full h-12 font-semibold" disabled={loading}>
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</>
              ) : (
                <><MessageCircle className="w-4 h-4 mr-2" />Send Verification Code</>
              )}
            </Button>

            <div className="text-center text-xs text-muted-foreground space-y-1">
              <p>Not receiving the code? Send "HI" to our WhatsApp first, then try again.</p>
              <a
                href={`https://wa.me/${import.meta.env.VITE_WA_BUSINESS_NUMBER || '265991234567'}?text=${encodeURIComponent("HI Chibondo Academy! I'd like to verify my account.")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-green-600 hover:underline font-medium"
              >
                <MessageCircle className="w-3 h-3" /> Message us on WhatsApp
              </a>
            </div>
          </form>
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
