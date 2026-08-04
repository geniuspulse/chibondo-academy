import React, { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, User, Loader2, MessageCircle } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { useAuth } from "@/lib/AuthContext";
import SEO from "@/components/SEO";
import { getReferralCode } from "@/lib/referralCookie";

export default function Register() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const refCode = searchParams.get("ref") || getReferralCode();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { isAuthenticated, authChecked } = useAuth();

  useEffect(() => {
    if (refCode) localStorage.setItem("pending_referral_code", refCode.toUpperCase());
  }, [refCode]);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (authChecked && isAuthenticated) window.location.replace("/dashboard");
  }, [authChecked, isAuthenticated]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!fullName.trim()) {
      setError("Please enter your name");
      return;
    }

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
        body: JSON.stringify({ phone: digits }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send. Please try again.");
        setLoading(false);
        return;
      }

      navigate("/verify-otp", {
        replace: true,
        state: {
          phone: data.phone || digits,
          name: fullName.trim(),
          refCode: refCode || null,
          isNew: true,
          fallbackCode: data.fallback_code || null,
          deliveryMethod: data.delivery_method || null,
        },
      });
    } catch (err) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <>
      <SEO
        title="Register"
        description="Create your free Chibondo Academy account. Join today and get access to quality online secondary education with MSCE lessons, quizzes, and past papers."
        canonical={`${window.location.origin}/register`}
      />
      <AuthLayout
        title="Welcome to The Chibondo Academy"
        subtitle="Create your account with WhatsApp verification"
        footer={
          <div className="space-y-3">
            <div>
              Already have an account?{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
            </div>
            <div className="text-xs text-muted-foreground">
              You can sign in with WhatsApp or email
            </div>
            <div className="pt-2 border-t border-gray-200">
              Interested in teaching?{" "}
              <Link to="/register/teacher" className="text-primary font-medium hover:underline">Apply as Teacher</Link>
            </div>
          </div>
        }
      >
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">{error}</div>
        )}

        {refCode && (
          <div className="mb-4 p-3 rounded-lg bg-accent/10 border border-accent/20 text-sm">
            <p className="font-semibold text-accent">Referral Code Applied</p>
            <p className="text-xs text-muted-foreground mt-0.5">Code: <span className="font-mono">{refCode}</span></p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name <span className="text-red-500">*</span></Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="fullName"
                type="text"
                autoFocus
                placeholder="John Banda"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="pl-10 h-12"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">WhatsApp Number <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                placeholder="0991234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="pl-10 h-12"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              We'll send a verification code via WhatsApp. If delivery fails, we'll use SMS or show it on screen.
            </p>
          </div>

          <Button type="submit" className="w-full h-12 font-semibold" disabled={loading}>
            {loading
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</>
              : <><MessageCircle className="w-4 h-4 mr-2" />Create Account</>}
          </Button>

          <p className="text-center text-xs text-gray-500">
            By registering, you agree to our{" "}
            <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
            {" "}and{" "}
            <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
          </p>
        </form>
      </AuthLayout>
    </>
  );
}
