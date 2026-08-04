import React, { useState, useEffect, useRef } from 'react';
import { X, Smartphone, Loader2, CheckCircle2, AlertCircle, Phone, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

/**
 * InlineCheckout — branded Paychangu Direct Charge modal.
 * The student never leaves chibondoacademy.com.
 *
 * Flow:
 *   1. Select operator (TNM / Airtel)
 *   2. Enter phone number
 *   3. Paychangu sends a MoMo prompt to their phone
 *   4. We poll until confirmed → subscription activates
 */
export default function InlineCheckout({ plan, user, pricing, onClose, onSuccess }) {
  const [step, setStep] = useState('select');  // select | waiting | success | error
  const [operator, setOperator] = useState(null);  // { name, ref_id, short_code }
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [chargeData, setChargeData] = useState(null);
  const [pollCount, setPollCount] = useState(0);
  const pollRef = useRef(null);

  const operators = [
    { name: 'TNM Mpamba',   ref_id: '27494cb5-ba9e-437f-a114-4e7a7686bcca', short_code: 'tnm',    color: 'bg-blue-500',    text: 'text-blue-600' },
    { name: 'Airtel Money', ref_id: '20be6c20-adeb-4b5b-a7ba-0769820df4fb', short_code: 'airtel', color: 'bg-red-500',     text: 'text-red-600' },
  ];

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

  const formatPrice = (n) => n.toLocaleString('en-MW');
  const planAmount = pricing[plan?.id] || plan?.price || 0;

  const handlePhoneChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(val);
    if (error) setError('');
  };

  const handlePay = async () => {
    setError('');

    if (!operator) { setError('Please select a mobile money provider'); return; }

    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9) { setError('Please enter a valid phone number (e.g. 0991234567)'); return; }

    setStep('waiting');
    setPollCount(0);

    try {
      const res = await fetch('/api/direct-charge?action=charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: plan.id,
          mobile: digits,
          operator_ref_id: operator.ref_id,
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

      // Start polling for payment status
      startPolling(data.paychangu_charge_id, data.charge_id);
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setStep('error');
    }
  };

  const startPolling = (paychanguId, chargeId) => {
    clearInterval(pollRef.current);
    let attempts = 0;
    const maxAttempts = 20; // 20 × 5s = 100 seconds max

    pollRef.current = setInterval(async () => {
      attempts++;
      setPollCount(attempts);

      if (attempts > maxAttempts) {
        clearInterval(pollRef.current);
        setError('Payment confirmation timed out. If money was deducted, your subscription will activate automatically. Contact support if needed.');
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
            plan: plan.id,
          }),
        });
        const data = await res.json();

        if (data.success) {
          clearInterval(pollRef.current);
          setStep('success');
          toast.success('🎉 Payment confirmed! Your lessons are unlocked.');
          setTimeout(() => onSuccess?.(data), 2000);
        } else if (data.failed) {
          clearInterval(pollRef.current);
          setError('Payment was not completed. Please try again.');
          setStep('error');
        }
        // else: still pending, keep polling
      } catch (_) {
        // Network hiccup — keep polling
      }
    }, 5000);
  };

  const handleRetry = () => {
    setStep('select');
    setError('');
    setChargeData(null);
    setPollCount(0);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-card text-card-foreground rounded-2xl shadow-2xl border border-border overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="bg-gradient-to-br from-primary to-primary/80 px-6 py-5 text-primary-foreground relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-primary-foreground/70 hover:text-primary-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-primary-foreground/15 flex items-center justify-center">
              <span className="text-xs font-bold">CA</span>
            </div>
            <span className="text-sm font-semibold">Chibondo Academy</span>
          </div>
          <h2 className="text-xl font-display font-bold">Pay School Fees</h2>
          <p className="text-xs text-primary-foreground/70 mt-0.5">Secure mobile money payment</p>
        </div>

        {/* ── Plan summary bar ── */}
        <div className="px-6 py-3 bg-muted/50 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{plan?.name} Plan</p>
              <p className="text-xs text-muted-foreground">{plan?.duration} of access</p>
            </div>
            <p className="text-2xl font-bold font-display text-primary">
              MWK {formatPrice(planAmount)}
            </p>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="p-6">

          {/* Step: Select operator + phone */}
          {step === 'select' && (
            <div className="space-y-5">
              {/* Operator selection */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5 block">
                  Choose your mobile money
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {operators.map(op => (
                    <button
                      key={op.ref_id}
                      onClick={() => setOperator(op)}
                      className={`relative rounded-xl border-2 p-4 text-left transition-all hover:shadow-md ${
                        operator?.ref_id === op.ref_id
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border bg-card hover:border-primary/30'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg ${op.color} flex items-center justify-center mb-2`}>
                        <Smartphone className="w-4 h-4 text-white" />
                      </div>
                      <p className="text-sm font-semibold">{op.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{op.short_code}</p>
                      {operator?.ref_id === op.ref_id && (
                        <CheckCircle2 className="absolute top-3 right-3 w-4 h-4 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Phone number */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
                  Your phone number
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
                <p className="text-xs text-muted-foreground mt-1.5">
                  We'll send a payment prompt to this number
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              {/* Pay button */}
              <Button
                onClick={handlePay}
                className="w-full h-12 text-base font-semibold"
                disabled={!operator || phone.replace(/\D/g, '').length < 9}
              >
                Pay MWK {formatPrice(planAmount)}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              {/* Trust badges */}
              <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Secure
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" /> No redirect
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Instant access
                </span>
              </div>
            </div>
          )}

          {/* Step: Waiting for payment confirmation */}
          {step === 'waiting' && (
            <div className="space-y-5 text-center py-2">
              {/* Animated phone illustration */}
              <div className="relative mx-auto w-24 h-24">
                <div className="absolute inset-0 rounded-2xl bg-primary/10 animate-ping opacity-75" style={{ animationDuration: '2s' }} />
                <div className="relative w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Smartphone className="w-10 h-10 text-primary" />
                </div>
              </div>

              <div>
                <p className="text-lg font-semibold text-foreground">
                  Check your phone
                </p>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                  A {operator?.name || 'mobile money'} payment prompt has been sent to{' '}
                  <span className="font-semibold text-foreground">+265 {phone}</span>.
                </p>
                <p className="text-sm font-medium text-primary mt-2">
                  Enter your MoMo PIN to confirm the payment.
                </p>
              </div>

              {/* Polling indicator */}
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Waiting for confirmation... ({pollCount}s)
              </div>

              {/* Cancel button */}
              <Button variant="outline" onClick={onClose} className="w-full">
                Cancel payment
              </Button>

              {/* Tips */}
              <div className="bg-muted/50 rounded-xl p-3 text-left space-y-1.5">
                <p className="text-xs font-semibold text-foreground">💡 Tips:</p>
                <p className="text-xs text-muted-foreground">• Make sure you have enough balance in your mobile money account</p>
                <p className="text-xs text-muted-foreground">• The prompt may take a few seconds to appear</p>
                <p className="text-xs text-muted-foreground">• Dial *150*00# (TNM) or *150*01# (Airtel) if you don't see the prompt</p>
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
                  Your {plan?.name} subscription is now active. Redirecting to your dashboard...
                </p>
              </div>
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
                <Button variant="outline" onClick={onClose} className="flex-1">Close</Button>
                <Button onClick={handleRetry} className="flex-1">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Try again
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {step === 'select' && (
          <div className="px-6 py-3 bg-muted/30 border-t border-border text-center">
            <p className="text-xs text-muted-foreground">
              Powered by Paychangu • Your phone number is never stored
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
