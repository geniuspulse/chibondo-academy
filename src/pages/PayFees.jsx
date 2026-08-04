import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Smartphone, Loader2, CheckCircle2, AlertCircle, Phone,
  ShieldCheck, Zap, Crown, Award, GraduationCap, Lock, ChevronRight,
  CreditCard, Receipt, Wifi
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import SEO from '@/components/SEO';

// ── Network auto-detection ─────────────────────────────────────────────────────
// Malawi mobile prefixes (after stripping the leading 0):
//   08*  → TNM Mpamba   (088, 089, 081, etc.)
//   09*  → Airtel Money (099, 098, 097, 091, etc.)
const OPERATORS = {
  tnm:    { name: 'TNM Mpamba',   ref_id: '27494cb5-ba9e-437f-a114-4e7a7686bcca', short_code: 'tnm',    color: 'bg-blue-500',  ussd: '*150*00#' },
  airtel: { name: 'Airtel Money', ref_id: '20be6c20-adeb-4b5b-a7ba-0769820df4fb', short_code: 'airtel', color: 'bg-red-500',   ussd: '*150*01#' },
};

function detectNetwork(phoneStr) {
  let p = phoneStr.replace(/\D/g, '');
  if (p.startsWith('265')) p = p.slice(3);
  if (p.startsWith('0'))   p = p.slice(1);
  if (p.startsWith('8'))  return OPERATORS.tnm;
  if (p.startsWith('9'))  return OPERATORS.airtel;
  return null;
}

// ── Plan metadata (mirrors SubscriptionPage) ───────────────────────────────────
const PLAN_META = {
  monthly:  { name: 'Monthly',  duration: '1 Month',  period: 'per month',  icon: Zap,    months: 1  },
  annual:   { name: 'Annual',   duration: '1 Year',   period: 'per year',   icon: Crown,  months: 12 },
  biannual: { name: 'Biannual', duration: '2 Years',  period: 'for 2 years', icon: Award,  months: 24 },
};

const PLAN_FEATURES = {
  monthly: ['All lessons & videos', 'Quizzes & tests', 'Past papers', 'Assignment submissions', 'Progress tracking'],
  annual:  ['Everything in Monthly', 'Priority support', 'Exam tips & strategies', 'Revision resources'],
  biannual:['Everything in Annual', 'Certificate of completion', 'Dedicated support', 'Offline access'],
};

export default function PayFees() {
  const { planId } = useParams();
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
  const features = PLAN_FEATURES[planKey] || PLAN_FEATURES.monthly;

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
      setError('Please enter a valid phone number (e.g. 0881234567)');
      return;
    }
    const detected = detectNetwork(digits);
    if (!detected) {
      setError('Could not detect the network. Your number should start with 08 (TNM) or 09 (Airtel).');
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
    const maxAttempts = 24;

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
      <SEO title="Checkout — Pay School Fees" description="Secure mobile money checkout for Chibondo Academy." canonical={`${window.location.origin}/pay-fees/${planKey}`} />
      <div className="space-y-5 max-w-3xl mx-auto">

        {/* ── Back link ── */}
        <Link to="/subscription" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to plans
        </Link>

        {/* ── Branded Hero — matches SubscriptionPage ── */}
        <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-center text-primary-foreground">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-3 bg-primary-foreground/15">
            <GraduationCap className="w-3.5 h-3.5" /> Chibondo Academy
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold mb-1">Checkout</h1>
          <p className="text-primary-foreground/70 text-sm max-w-md mx-auto">
            Pay your school fees securely via mobile money. No redirects — everything happens right here.
          </p>
        </div>

        {/* ═════════════════════════════════════════════════════════════════════
            CHECKOUT BODY
           ═════════════════════════════════════════════════════════════════════ */}
        {step === 'input' && (
          <div className="grid gap-5 md:grid-cols-5">

            {/* ═══ LEFT: Order Summary ═══ */}
            <div className="md:col-span-2 space-y-4">
              <div className="bg-card text-card-foreground rounded-2xl border border-border overflow-hidden">
                <div className="px-4 py-3 bg-muted/50 border-b border-border flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Order Summary</h2>
                </div>
                <div className="p-4 space-y-3">
                  {/* Plan item */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <PlanIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{plan.name} Plan</p>
                      <p className="text-xs text-muted-foreground">{plan.duration} of full access</p>
                    </div>
                  </div>

                  {/* Features list */}
                  <div className="space-y-1.5 pt-1">
                    {features.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>

                  {/* Divider */}
                  <div className="border-t border-border pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">MWK {formatPrice(amount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Processing fee</span>
                      <span className="font-medium text-emerald-600">Free</span>
                    </div>
                    <div className="flex justify-between text-base font-bold pt-1 border-t border-border">
                      <span>Total</span>
                      <span className="text-primary">MWK {formatPrice(amount)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ═══ RIGHT: Payment ═══ */}
            <div className="md:col-span-3 space-y-4">
              <div className="bg-card text-card-foreground rounded-2xl border border-border overflow-hidden">
                <div className="px-4 py-3 bg-muted/50 border-b border-border flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Payment Method</h2>
                </div>
                <div className="p-4 space-y-5">

                  {/* Phone input */}
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
                        placeholder="881234567"
                        value={phone}
                        onChange={handlePhoneChange}
                        className="pl-[4.5rem] h-12 text-base"
                        onKeyDown={e => e.key === 'Enter' && handlePay()}
                      />
                    </div>

                    {/* Auto-detected network badge */}
                    {network && phone.length >= 2 && (
                      <div className="mt-2.5 flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/50 border border-border">
                        <div className={`w-3 h-3 rounded-full ${network.color}`} />
                        <span className="text-sm font-medium">{network.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">Auto-detected</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      </div>
                    )}
                    {!network && phone.length >= 2 && (
                      <p className="mt-2 text-xs text-amber-600">
                        Could not detect network. Numbers start with 08 (TNM) or 09 (Airtel).
                      </p>
                    )}
                    {!network && phone.length < 2 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Enter your number starting with 08 (TNM) or 09 (Airtel)
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

                  {/* How it works — steps */}
                  <div className="space-y-2.5 pt-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">How to pay</p>
                    <div className="space-y-2">
                      {[
                        'Enter your Airtel Money or Mpamba number',
                        'We send a payment prompt to your phone',
                        'Enter your MoMo PIN to confirm',
                        'Your lessons unlock instantly',
                      ].map((t, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                            {i + 1}
                          </div>
                          <p className="text-xs text-muted-foreground">{t}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pay button */}
                  <Button
                    onClick={handlePay}
                    className="w-full h-12 text-base font-semibold"
                    disabled={phone.replace(/\D/g, '').length < 9 || !network}
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Pay MWK {formatPrice(amount)}
                  </Button>
                </div>
              </div>

              {/* Trust badges */}
              <div className="flex items-center justify-center gap-5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Secure
                </span>
                <span className="flex items-center gap-1">
                  <Wifi className="w-3.5 h-3.5 text-emerald-500" /> No redirect
                </span>
                <span className="flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-emerald-500" /> Instant access
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ═══ Waiting for payment ═══ */}
        {step === 'waiting' && (
          <div className="bg-card text-card-foreground rounded-2xl border border-border overflow-hidden">
            <div className="px-4 py-3 bg-muted/50 border-b border-border flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Waiting for confirmation</h2>
            </div>
            <div className="p-6 space-y-5 text-center">
              <div className="relative mx-auto w-24 h-24">
                <div className="absolute inset-0 rounded-2xl bg-primary/10 animate-ping opacity-75" style={{ animationDuration: '2s' }} />
                <div className="relative w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Smartphone className="w-10 h-10 text-primary" />
                </div>
              </div>

              <div>
                <p className="text-lg font-semibold text-foreground">Check your phone</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                  A {network?.name || 'mobile money'} payment prompt has been sent to{' '}
                  <span className="font-semibold text-foreground">+265 {phone}</span>.
                </p>
                <p className="text-sm font-medium text-primary mt-2">
                  Enter your MoMo PIN to confirm the payment.
                </p>
              </div>

              {/* Progress bar */}
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
                Listening for payment confirmation...
              </div>

              <Button variant="outline" onClick={() => { clearInterval(pollRef.current); setStep('input'); }} className="w-full max-w-xs mx-auto">
                Cancel payment
              </Button>

              <div className="bg-muted/50 rounded-xl p-3 text-left space-y-1.5 max-w-sm mx-auto">
                <p className="text-xs font-semibold text-foreground">Tips:</p>
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
            <div className="p-8 text-center space-y-5">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">Payment Confirmed!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your {plan.name} subscription is now active. Redirecting to your dashboard...
                </p>
              </div>

              {/* Receipt summary */}
              <div className="bg-muted/50 rounded-xl p-4 max-w-xs mx-auto text-left space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-medium">{plan.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium">MWK {formatPrice(amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium">{plan.duration}</span>
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

        {/* ── Footer ── */}
        {step === 'input' && (
          <div className="text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Lock className="w-3 h-3" /> Powered by Paychangu • Your number is never stored
            </p>
          </div>
        )}
      </div>
    </>
  );
}
