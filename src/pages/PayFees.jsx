import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Smartphone, Loader2, CheckCircle2, AlertCircle, Phone, ShieldCheck, Zap, Crown, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import SEO from '@/components/SEO';

// ── Network auto-detection ─────────────────────────────────────────────────────
// Malawi mobile prefixes (after stripping the leading 0):
//   88           → TNM Mpamba
//   99, 98, 91   → Airtel Money
const OPERATORS = {
  tnm:    { name: 'TNM Mpamba',   ref_id: '27494cb5-ba9e-437f-a114-4e7a7686bcca', short_code: 'tnm' },
  airtel: { name: 'Airtel Money', ref_id: '20be6c20-adeb-4b5b-a7ba-0769820df4fb', short_code: 'airtel' },
};

function detectNetwork(phoneStr) {
  let p = phoneStr.replace(/\D/g, '');
  if (p.startsWith('265')) p = p.slice(3);
  if (p.startsWith('0'))   p = p.slice(1);
  // p is now the 9-digit number without prefix, e.g. 881234567
  if (p.startsWith('88'))  return OPERATORS.tnm;
  if (p.startsWith('99') || p.startsWith('98') || p.startsWith('91')) return OPERATORS.airtel;
  return null;
}

// ── Plan metadata (mirrors SubscriptionPage) ───────────────────────────────────
const PLAN_META = {
  monthly:  { name: 'Monthly',  duration: '1 Month', period: 'per month',  icon: Zap,    months: 1  },
  annual:   { name: 'Annual',   duration: '1 Year',  period: 'per year',   icon: Crown,  months: 12 },
  biannual: { name: 'Biannual', duration: '2 Years',  period: 'for 2 years', icon: Award,  months: 24 },
};

export default function PayFees() {
  const { planId } = useParams();           // /pay-fees/:planId
  const navigate = useNavigate();
  const { user } = useAuth();

  const [phone, setPhone] = useState('');
  const [step, setStep] = useState('input'); // input | waiting | success | error
  const [error, setError] = useState('');
  const [chargeData, setChargeData] = useState(null);
  const [pollCount, setPollCount] = useState(0);
  const pollRef = useRef(null);

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
  const amount = pricing?.[planKey] || plan.price || 10000;
  const formatPrice = (n) => n.toLocaleString('en-MW');
  const network = detectNetwork(phone);

  // Pre-fill phone from user profile
  useEffect(() => {
    if (user?.phone_number) {
      let p = user.phone_number.replace(/\D/g, '');
      if (p.startsWith('265')) p = '0' + p.slice(3);
      setPhone(p);
    }
  }, [user]);

  // Cleanup polling on unmount
  useEffect(() => () => clearInterval(pollRef.current), []);

  // Redirect to login if not authenticated
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
      setError('Please enter a valid phone number (e.g. 0991234567)');
      return;
    }
    const detected = detectNetwork(digits);
    if (!detected) {
      setError('Could not detect the network. Please check your number — it should start with 088 (TNM), 099 or 091 (Airtel).');
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
          operator_ref_id: detected.ref_id, // auto-detected
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

      setChargeData(data);
      startPolling(data.paychangu_charge_id, data.charge_id);
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setStep('error');
    }
  };

  const startPolling = (paychanguId, chargeId) => {
    clearInterval(pollRef.current);
    let attempts = 0;
    const maxAttempts = 24; // 24 × 5s = 120 seconds

    pollRef.current = setInterval(async () => {
      attempts++;
      setPollCount(attempts);

      if (attempts > maxAttempts) {
        clearInterval(pollRef.current);
        setError('Payment confirmation timed out. If money was deducted, your subscription will be activated automatically. Contact support if needed.');
        setStep('error');
        return;
      }

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
      } catch (_) {}
    }, 5000);
  };

  const handleRetry = () => {
    setStep('input');
    setError('');
    setChargeData(null);
    setPollCount(0);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <SEO title="Pay School Fees" description="Pay your school fees via mobile money." canonical={`${window.location.origin}/pay-fees/${planKey}`} />
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <div className="w-full max-w-md">

          {/* ── Back link ── */}
          <Link to="/subscription" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to plans
          </Link>

          {/* ── Card ── */}
          <div className="bg-card text-card-foreground rounded-2xl shadow-xl border border-border overflow-hidden">

            {/* Header */}
            <div className="bg-gradient-to-br from-primary to-primary/80 px-6 py-5 text-primary-foreground">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-primary-foreground/15 flex items-center justify-center">
                  <span className="text-xs font-bold">CA</span>
                </div>
                <span className="text-sm font-semibold">Chibondo Academy</span>
              </div>
              <h1 className="text-xl font-display font-bold">Pay School Fees</h1>
              <p className="text-xs text-primary-foreground/70 mt-0.5">Secure mobile money payment</p>
            </div>

            {/* Plan summary */}
            <div className="px-6 py-3.5 bg-muted/50 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <PlanIcon className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{plan.name} Plan</p>
                    <p className="text-xs text-muted-foreground">{plan.duration} of access</p>
                  </div>
                </div>
                <p className="text-2xl font-bold font-display text-primary">
                  MWK {formatPrice(amount)}
                </p>
              </div>
            </div>

            {/* ── Body ── */}
            <div className="p-6">

              {/* Step: Enter phone */}
              {step === 'input' && (
                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
                      Mobile money number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <div className="absolute left-10 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium pointer-events-none">
                        +265
                      </div>
                      <Input
                        type="tel"
                        inputMode="numeric"
                        autoFocus
                        placeholder="991234567"
                        value={phone}
                        onChange={handlePhoneChange}
                        className="pl-[4.5rem] h-12 text-base"
                        onKeyDown={e => e.key === 'Enter' && handlePay()}
                      />
                    </div>

                    {/* Auto-detected network badge */}
                    {network && phone.length >= 3 && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${network.short_code === 'tnm' ? 'bg-blue-500' : 'bg-red-500'}`} />
                        <span className="text-xs font-medium text-muted-foreground">
                          {network.name} detected
                        </span>
                      </div>
                    )}
                    {!network && phone.length >= 3 && (
                      <p className="mt-2 text-xs text-amber-600">
                        Could not detect network. Numbers start with 088 (TNM), 099/091 (Airtel).
                      </p>
                    )}
                  </div>

                  {/* Error */}
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
                    Pay MWK {formatPrice(amount)}
                  </Button>

                  {/* Info */}
                  <div className="bg-muted/50 rounded-xl p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-foreground">How it works:</p>
                    <p className="text-xs text-muted-foreground">1. Enter your Airtel Money or Mpamba number</p>
                    <p className="text-xs text-muted-foreground">2. We'll send a payment prompt to your phone</p>
                    <p className="text-xs text-muted-foreground">3. Enter your MoMo PIN to confirm the payment</p>
                    <p className="text-xs text-muted-foreground">4. Your lessons unlock instantly</p>
                  </div>

                  {/* Trust badges */}
                  <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Secure
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> No redirect
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-emerald-500" /> Instant access
                    </span>
                  </div>
                </div>
              )}

              {/* Step: Waiting for payment */}
              {step === 'waiting' && (
                <div className="space-y-5 text-center py-2">
                  <div className="relative mx-auto w-24 h-24">
                    <div className="absolute inset-0 rounded-2xl bg-primary/10 animate-ping opacity-75" style={{ animationDuration: '2s' }} />
                    <div className="relative w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Smartphone className="w-10 h-10 text-primary" />
                    </div>
                  </div>

                  <div>
                    <p className="text-lg font-semibold text-foreground">Check your phone</p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                      A {network?.name || 'mobile money'} payment prompt has been sent to{' '}
                      <span className="font-semibold text-foreground">+265 {phone}</span>.
                    </p>
                    <p className="text-sm font-medium text-primary mt-2">
                      Enter your MoMo PIN to confirm the payment.
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Waiting for confirmation... ({pollCount * 5}s)
                  </div>

                  <Button variant="outline" onClick={() => { clearInterval(pollRef.current); setStep('input'); }} className="w-full">
                    Cancel payment
                  </Button>

                  <div className="bg-muted/50 rounded-xl p-3 text-left space-y-1.5">
                    <p className="text-xs font-semibold text-foreground">Tips:</p>
                    <p className="text-xs text-muted-foreground">• Make sure you have enough balance</p>
                    <p className="text-xs text-muted-foreground">• The prompt may take a few seconds to appear</p>
                    <p className="text-xs text-muted-foreground">• Dial *150*00# (TNM) or *150*01# (Airtel) if you don't see it</p>
                  </div>
                </div>
              )}

              {/* Step: Success */}
              {step === 'success' && (
                <div className="text-center py-8 space-y-4">
                  <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground">Payment Confirmed!</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your {plan.name} subscription is now active. Redirecting to your dashboard...
                    </p>
                  </div>
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                </div>
              )}

              {/* Step: Error */}
              {step === 'error' && (
                <div className="text-center py-6 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-8 h-8 text-destructive" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-foreground">Payment failed</p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">{error}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => navigate('/subscription')} className="flex-1">Back to plans</Button>
                    <Button onClick={handleRetry} className="flex-1">Try again</Button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {step === 'input' && (
              <div className="px-6 py-3 bg-muted/30 border-t border-border text-center">
                <p className="text-xs text-muted-foreground">
                  Powered by Paychangu • Your number is never stored
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
