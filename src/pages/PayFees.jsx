import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Smartphone, Loader2, CheckCircle2, AlertCircle, Phone,
  ShieldCheck, Zap, Crown, Award, Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import SEO from '@/components/SEO';

// ── Network auto-detection ─────────────────────────────────────────────────────
const OPERATORS = {
  tnm:    { name: 'TNM Mpamba',   ref_id: '27494cb5-ba9e-437f-a114-4e7a7686bcca', short_code: 'tnm',    ussd: '*150*00#' },
  airtel: { name: 'Airtel Money', ref_id: '20be6c20-adeb-4b5b-a7ba-0769820df4fb', short_code: 'airtel', ussd: '*150*01#' },
};

function detectNetwork(phoneStr) {
  let p = phoneStr.replace(/\D/g, '');
  if (p.startsWith('265')) p = p.slice(3);
  if (p.startsWith('0'))   p = p.slice(1);
  if (p.startsWith('8'))  return OPERATORS.tnm;
  if (p.startsWith('9'))  return OPERATORS.airtel;
  return null;
}

// ── Plan metadata ──────────────────────────────────────────────────────────────
const PLAN_META = {
  monthly:  { name: 'Monthly',  duration: '1 Month',  icon: Zap,    months: 1  },
  annual:   { name: 'Annual',   duration: '1 Year',   icon: Crown,  months: 12 },
  biannual: { name: 'Biannual', duration: '2 Years',  icon: Award,  months: 24 },
};

export default function PayFees() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [phone, setPhone] = useState('');
  const [step, setStep] = useState('input');
  const [error, setError] = useState('');
  const [pollCount, setPollCount] = useState(0);
  const pollRef = useRef(null);
  const isVerifyingRef = useRef(false);

  // ── Fetch pricing ─────────────────────────────────────────────────────────
  const { data: pricing } = useQuery({
    queryKey: ['pricing'],
    queryFn: async () => {
      const rows = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/platform_settings?select=value&key=eq.pricing`, {
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      }).then(r => r.json()).catch(() => []);
      const val = Array.isArray(rows) ? rows[0]?.value : null;
      const cfg = val?.data?.pricing || val?.pricing || val;
      return {
        monthly: cfg?.monthly_price || 10000,
        annual: cfg?.annual_price || 80000,
        biannual: cfg?.biannual_price || 150000,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const planKey = planId || 'monthly';
  const plan = PLAN_META[planKey] || PLAN_META.monthly;
  const PlanIcon = plan.icon;
  const amount = pricing?.[planKey] || 10000;
  const formatPrice = (n) => n.toLocaleString('en-MW');
  const network = detectNetwork(phone);

  // Pre-fill phone from user profile (strip 265, add 0 prefix)
  useEffect(() => {
    if (user?.phone_number) {
      let p = user.phone_number.replace(/\D/g, '');
      if (p.startsWith('265')) p = '0' + p.slice(3);
      setPhone(p);
    }
  }, [user]);

  useEffect(() => () => clearInterval(pollRef.current), []);

  useEffect(() => {
    if (!user) navigate('/login?redirect=/pay-fees/' + planKey);
  }, [user, navigate, planKey]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handlePhoneChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(val);
    if (error) setError('');
  };

  const handlePay = async () => {
    setError('');
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9) {
      setError('Please enter a valid phone number (e.g. 0881234567)');
      return;
    }
    const detected = detectNetwork(digits);
    if (!detected) {
      setError('Your number should start with 08 (TNM) or 09 (Airtel).');
      return;
    }

    setStep('waiting');
    setPollCount(0);

    try {
      const res = await fetch('/api/direct-charge?action=charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planKey,
          mobile: digits,
          operator_ref_id: detected.ref_id,
          user_id: user?.id,
          email: user?.email,
          first_name: user?.full_name?.split(' ')[0] || 'Student',
          last_name: user?.full_name?.split(' ').slice(1).join(' ') || '',
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || 'Failed to start payment. Please try again.');
        setStep('error');
        return;
      }

      startPolling(data.paychangu_charge_id, data.charge_id);
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setStep('error');
    }
  };

  const startPolling = (paychanguId, chargeId) => {
    clearInterval(pollRef.current);
    let attempts = 0;
    const maxAttempts = 24;

    pollRef.current = setInterval(async () => {
      // Skip this tick if the previous verify() request hasn't resolved yet —
      // slow mobile connections can make a single request take longer than
      // the 5s interval, and firing overlapping requests can double-activate
      // (and then immediately expire) the subscription on the server.
      if (isVerifyingRef.current) return;

      attempts++;
      setPollCount(attempts);

      if (attempts > maxAttempts) {
        clearInterval(pollRef.current);
        setError('Payment confirmation timed out. If money was deducted, your subscription will be activated automatically. Contact support if needed.');
        setStep('error');
        return;
      }

      isVerifyingRef.current = true;
      try {
        const res = await fetch('/api/direct-charge?action=verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paychangu_charge_id: paychanguId,
            charge_id: chargeId,
            user_id: user?.id,
            plan: planKey,
          }),
        });
        const data = await res.json();

        if (data.success) {
          clearInterval(pollRef.current);
          setStep('success');
          toast.success('Payment confirmed! Your lessons are unlocked.');
          setTimeout(() => navigate('/dashboard'), 2500);
        } else if (data.failed) {
          clearInterval(pollRef.current);
          setError('Payment was not completed. Please try again.');
          setStep('error');
        }
      } catch (_) {
      } finally {
        isVerifyingRef.current = false;
      }
    }, 5000);
  };

  const handleRetry = () => {
    setStep('input');
    setError('');
    setPollCount(0);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <SEO title="Checkout — Pay School Fees" description="Secure mobile money checkout for Chibondo Academy." canonical={`${window.location.origin}/pay-fees/${planKey}`} />
      <div className="max-w-md mx-auto">

        {/* ── Back link ── */}
        <Link to="/subscription" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to plans
        </Link>

        {/* ═══ INPUT STEP — compact single card ═══ */}
        {step === 'input' && (
          <div className="bg-card text-card-foreground rounded-2xl border border-border overflow-hidden">
            {/* Plan + price header */}
            <div className="px-5 py-4 bg-muted/50 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <PlanIcon className="w-4.5 h-4.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{plan.name} Plan</p>
                  <p className="text-xs text-muted-foreground">{plan.duration}</p>
                </div>
              </div>
              <p className="text-lg font-bold text-primary">MWK {formatPrice(amount)}</p>
            </div>

            {/* Phone input + pay */}
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Enter your phone number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="tel"
                    inputMode="numeric"
                    autoFocus
                    placeholder="e.g. 0991234567"
                    value={phone}
                    onChange={handlePhoneChange}
                    className="pl-10 h-12 text-base"
                    onKeyDown={e => e.key === 'Enter' && handlePay()}
                  />
                </div>
                {/* Subtle network hint — no bold notice */}
                {network && (
                  <p className="mt-1.5 text-xs text-muted-foreground/70">
                    {network.name} detected
                  </p>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button
                onClick={handlePay}
                className="w-full h-12 text-base font-semibold"
                disabled={phone.replace(/\D/g, '').length < 9 || !network}
              >
                <Lock className="w-4 h-4 mr-2" />
                Pay MWK {formatPrice(amount)}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Enter the number where you have the money to pay your fees
              </p>
            </div>
          </div>
        )}

        {/* ═══ Waiting for payment ═══ */}
        {step === 'waiting' && (
          <div className="bg-card text-card-foreground rounded-2xl border border-border overflow-hidden">
            <div className="p-6 space-y-5 text-center">
              <div className="relative mx-auto w-20 h-20">
                <div className="absolute inset-0 rounded-2xl bg-primary/10 animate-ping opacity-75" style={{ animationDuration: '2s' }} />
                <div className="relative w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Smartphone className="w-9 h-9 text-primary" />
                </div>
              </div>

              <div>
                <p className="text-base font-semibold text-foreground">Check your phone</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                  A {network?.name || 'mobile money'} prompt was sent to{' '}
                  <span className="font-semibold text-foreground">{phone}</span>.
                </p>
                <p className="text-sm font-medium text-primary mt-2">
                  Enter your {network?.short_code === 'tnm' ? 'Mpamba' : 'Airtel Money'} PIN to confirm.
                </p>
              </div>

              <div className="max-w-xs mx-auto">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span>Waiting for confirmation</span>
                  <span>{pollCount * 5}s / 120s</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((pollCount / 24) * 100, 100)}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Listening for confirmation...
              </div>

              <Button variant="outline" onClick={() => { clearInterval(pollRef.current); setStep('input'); }} className="w-full max-w-xs mx-auto">
                Cancel payment
              </Button>

              <div className="bg-muted/50 rounded-xl p-3 text-left space-y-1 max-w-sm mx-auto">
                <p className="text-xs text-muted-foreground">• Make sure you have enough balance</p>
                <p className="text-xs text-muted-foreground">• The prompt may take a few seconds to appear</p>
                <p className="text-xs text-muted-foreground">• Dial {network?.ussd || '*150*00#'} if you don't see it</p>
              </div>
            </div>
          </div>
        )}

        {/* ═══ Success ═══ */}
        {step === 'success' && (
          <div className="bg-card text-card-foreground rounded-2xl border border-border overflow-hidden">
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">Payment confirmed!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your {plan.name} subscription is active. Redirecting to dashboard...
                </p>
              </div>
              <div className="bg-muted/50 rounded-xl p-4 max-w-xs mx-auto text-left space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-medium">{plan.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium">MWK {formatPrice(amount)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-border">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Active
                  </span>
                </div>
              </div>
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
            </div>
          </div>
        )}

        {/* ═══ Error ═══ */}
        {step === 'error' && (
          <div className="bg-card text-card-foreground rounded-2xl border border-border overflow-hidden">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">Payment failed</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">{error}</p>
              </div>
              <div className="flex gap-2 max-w-xs mx-auto">
                <Button variant="outline" onClick={() => navigate('/subscription')} className="flex-1">Back to plans</Button>
                <Button onClick={handleRetry} className="flex-1">Try again</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
