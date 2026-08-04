import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle, MessageCircle } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import SEO from "@/components/SEO";
import { db } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";

export default function VerifyLink() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, authChecked } = useAuth();
  const token = searchParams.get("t");
  const isReset = searchParams.get("reset") === "true";

  const [status, setStatus] = useState("verifying"); // verifying | success | error
  const [error, setError] = useState("");

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (authChecked && isAuthenticated) window.location.replace("/dashboard");
  }, [authChecked, isAuthenticated]);

  useEffect(() => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }
    verifyToken();
  }, [token]);

  const verifyToken = async () => {
    try {
      const refCode = localStorage.getItem("pending_referral_code");
      const res = await fetch("/api/wa-otp?action=verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, referral_code: refCode || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.needsRegistration) {
          setError("No account found. Redirecting to registration…");
          setStatus("error");
          setTimeout(() => navigate("/register", { replace: true }), 1500);
          return;
        }
        setError(data.error || "Verification link is invalid or has expired.");
        setStatus("error");
        return;
      }

      // Success — save token and redirect
      if (data.access_token) {
        db.auth.setToken(data.access_token, data.refresh_token);
        if (localStorage.getItem("pending_referral_code")) {
          localStorage.removeItem("pending_referral_code");
        }
        setStatus("success");
        setTimeout(() => {
          window.location.replace(isReset ? `/forgot-password?setpw=1` : `/dashboard`);
        }, 1000);
      } else {
        setError("No token returned. Please try logging in again.");
        setStatus("error");
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
      setStatus("error");
    }
  };

  return (
    <>
      <SEO title="Verifying…" description="Verifying your WhatsApp login link." />
      <AuthLayout title="Verifying your login" subtitle="One moment…">
        <div className="flex flex-col items-center gap-6 py-8">
          {status === "verifying" && (
            <>
              <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-accent animate-spin" />
              </div>
              <p className="text-sm text-muted-foreground text-center max-w-xs">
                Verifying your WhatsApp login link…
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="w-20 h-20 rounded-2xl bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-lg font-semibold text-foreground">Verified!</p>
                <p className="text-sm text-muted-foreground">{isReset ? "Redirecting to set your new password…" : "Redirecting to your dashboard…"}</p>
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center">
                <XCircle className="w-10 h-10 text-destructive" />
              </div>
              <div className="text-center space-y-2 max-w-xs">
                <p className="text-sm font-medium text-destructive">{error}</p>
                <button
                  onClick={() => navigate("/login", { replace: true })}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> Try again
                </button>
              </div>
            </>
          )}
        </div>
      </AuthLayout>
    </>
  );
}
