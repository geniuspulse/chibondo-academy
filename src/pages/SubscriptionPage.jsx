import React, { useState, useEffect } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, GraduationCap, Zap, Crown, Loader2, BookOpen, Calendar, Users, Award } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import SEO from '@/components/SEO';

export default function SubscriptionPage() {
  const { user } = useOutletContext() ?? {};
  const currentPlan = user?.subscription_plan || 'free';
  const navigate = useNavigate();

  const [pricing, setPricing] = useState({
    monthly_price: 10000,
    annual_price: 80000,
    biannual_price: 150000,
  });

  const [processing, setProcessing] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const { data: pricingData, isLoading } = useQuery({
    queryKey: ['pricing'],
    queryFn: async () => {
      const rows = await db.entities.PlatformSettings.filter({ key: 'pricing' }).catch(() => []);
      const val = rows?.[0]?.value;
      // val may be the pricing object itself, or nested under .data.pricing
      if (val?.monthly_price) return val;
      if (val?.data?.pricing) return val.data.pricing;
      if (val?.pricing)       return val.pricing;
      return null; // use default prices from state
    },
  });

  // Live lesson count (published lessons only) — no more hardcoded "259+ Lessons"
  const { data: lessonCount } = useQuery({
    queryKey: ['lessonCount'],
    queryFn: () => db.entities.Lesson.count({ status: 'published' }),
    staleTime: 5 * 60 * 1000,
  });

  // Check active subscription
  const { data: subscription, refetch: refetchSubscription } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const results = await db.entities.Subscription.filter({ student_id: user.id, status: 'active' });
      return results[0] || null;
    },
    enabled: !!user?.id,
  });

  const hasPaidFees = subscription && subscription.status === 'active';
  const isTrial = hasPaidFees && subscription?.plan === 'trial';

  const subDaysLeft = (() => {
    const expiry = subscription?.expires_at || subscription?.end_date;
    if (!expiry) return null;
    return Math.ceil((new Date(expiry) - new Date()) / 86400000);
  })();
  const isExpiringSoon = subDaysLeft !== null && subDaysLeft <= 7;
  const isExpiring3    = subDaysLeft !== null && subDaysLeft <= 3;

  // ── Handle PayChangu return redirect ──────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const txRef  = params.get('tx_ref');
    const paid   = params.get('paid');
    const status = params.get('status');

    // Always clean the URL immediately
    if (txRef || paid || status) {
      window.history.replaceState({}, '', '/subscription');
    }

    // No tx_ref — nothing to verify
    if (!txRef) return;

    // Already paid — nothing to do
    if (hasPaidFees) return;

    setVerifying(true);

    // Poll every 3s for up to 30s — webhook fires async and may arrive after redirect
    let attempts = 0;
    const maxAttempts = 10;

    const poll = () => {
      attempts++;
      fetch('/api/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tx_ref: txRef, user_id: user?.id }),
        }).then(r => r.json()).catch(() => ({}))
        .then((res) => {
          // API returns flat: { success, plan, ends_at } or { pending, status } or { failed }
          if (res.success) {
            setVerifying(false);
            toast.success('🎉 Payment confirmed! You now have full access.');
            refetchSubscription();
          } else if (res.failed) {
            setVerifying(false);
            toast.error('Payment was not completed. Please try again.');
          } else if (res.pending && attempts < maxAttempts) {
            // Still waiting for webhook — retry after 3s
            setTimeout(poll, 3000);
          } else {
            setVerifying(false);
            toast.warning('Payment is still being processed. Refresh in a minute — contact support if money was deducted.');
          }
        })
        .catch((err) => {
          setVerifying(false);
          console.error('Verify error:', err);
          toast.error('Verification failed. Contact support if money was deducted.');
        });
    };

    poll();
  }, [user?.id]);

  useEffect(() => {
    if (pricingData) {
      setPricing({
        monthly_price: pricingData.monthly_price || 10000,
        annual_price: pricingData.annual_price || 80000,
        biannual_price: pricingData.biannual_price || 150000,
      });
    }
  }, [pricingData]);

  const plans = [
    {
      id: 'monthly',
      name: 'Monthly',
      price: pricing.monthly_price,
      period: 'per month',
      duration: '1 Month',
      icon: Zap,
      features: ['All lessons & videos', 'All quizzes & tests', 'Past papers access', 'Assignment submissions', 'Progress tracking'],
      popular: true,
      color: 'border-accent',
      bgColor: 'bg-accent/5',
    },
    {
      id: 'annual',
      name: 'Annual',
      price: pricing.annual_price,
      period: 'per year',
      duration: '1 Year',
      icon: Crown,
      features: ['Everything in Monthly', 'Priority support', 'Exam tips & strategies', 'Revision resources', `Save MWK ${(pricing.monthly_price * 12 - pricing.annual_price).toLocaleString()}`],
      color: 'border-primary',
      bgColor: 'bg-primary/5',
    },
    {
      id: 'biannual',
      name: 'Biannual',
      price: pricing.biannual_price,
      period: 'for 2 years',
      duration: '2 Years',
      icon: Award,
      features: ['Everything in Annual', 'Certificate of completion', 'Dedicated support', 'Offline access', `Save MWK ${(pricing.monthly_price * 24 - pricing.biannual_price).toLocaleString()}`],
      color: 'border-success',
      bgColor: 'bg-success/5',
    },
  ];

  const handlePlanSelect = (planId) => {
    if (!user) {
      toast.error('Please log in to subscribe');
      navigate('/login?redirect=/pay-fees/' + planId);
      return;
    }
    navigate('/pay-fees/' + planId);
  };

  const formatPrice = (price) => price.toLocaleString('en-MW');

  return (
    <>
      <SEO 
        title="School Fees & Pricing"
        description="Affordable online secondary education at Chibondo Academy. Monthly, quarterly, and annual plans available. Access MSCE lessons, quizzes, past papers from MWK 10,000/month."
        canonical={`${window.location.origin}/subscription`}
      />
      <div className="space-y-8 max-w-4xl mx-auto" id="pricing-cards">

      {/* ── Verifying payment banner ── */}
      {verifying && (
        <div className="bg-primary/10 border border-primary/30 rounded-2xl p-6 flex items-center gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin flex-shrink-0" />
          <div>
            <p className="font-semibold text-primary">Verifying your payment…</p>
            <p className="text-sm text-muted-foreground">Please wait while we confirm your fees with Paychangu.</p>
          </div>
        </div>
      )}



      {/* ── Branded Hero — matches Subjects page style ── */}
      <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-center text-primary-foreground">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-3 bg-primary-foreground/15">
          <GraduationCap className="w-3.5 h-3.5" /> Chibondo Academy
        </div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold mb-1">School Fees</h1>
        <p className="text-primary-foreground/70 text-sm max-w-md mx-auto">
          Unlock full access to every lesson, quiz, past paper, and learning resource across all your subjects
        </p>
        <div className="flex flex-wrap justify-center gap-5 pt-4">
          {[{ icon: BookOpen, text: 'All Subjects' },{ icon: Users, text: lessonCount != null ? `${lessonCount}+ Lessons` : 'Lessons' },{ icon: Award, text: 'Past Papers' }].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-1.5 text-xs text-primary-foreground/80">
              <Icon className="w-3.5 h-3.5" />{text}
            </div>
          ))}
        </div>
      </div>

      {/* ── Active subscription status card ── */}
      {hasPaidFees && (
        <div className={`rounded-2xl border p-5 ${
          isTrial ? 'bg-primary/8 border-primary/25' :
          isExpiring3 ? 'bg-destructive/8 border-destructive/25' :
          isExpiringSoon ? 'bg-amber-500/8 border-amber-400/25' :
          'bg-emerald-500/8 border-emerald-400/25'
        }`}>
          <div className="flex items-start gap-4">
            {/* Status icon */}
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              isTrial ? 'bg-primary/15' :
              isExpiring3 ? 'bg-destructive/15' :
              isExpiringSoon ? 'bg-amber-500/15' :
              'bg-emerald-500/15'
            }`}>
              {isTrial
                ? <Zap className="w-6 h-6 text-primary" />
                : isExpiringSoon
                ? <Calendar className={`w-6 h-6 ${isExpiring3 ? 'text-destructive' : 'text-amber-600'}`} />
                : <Check className="w-6 h-6 text-emerald-600" />
              }
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className={`font-bold text-base ${
                  isTrial ? 'text-primary' :
                  isExpiring3 ? 'text-destructive' :
                  isExpiringSoon ? 'text-amber-700 dark:text-amber-400' :
                  'text-emerald-700 dark:text-emerald-400'
                }`}>
                  {isExpiring3 ? 'Expiring soon!' :
                   isExpiringSoon ? 'Renew soon' :
                   'Fees Paid ✓'}
                </p>
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${
                  isTrial ? 'bg-primary/15 text-primary' :
                  isExpiring3 ? 'bg-destructive/15 text-destructive' :
                  isExpiringSoon ? 'bg-amber-500/15 text-amber-600' :
                  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                }`}>
                  {subscription.plan}
                </span>
              </div>

              {/* Days left progress */}
              {subDaysLeft !== null && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {subDaysLeft <= 0 ? 'Expired' : `${subDaysLeft} day${subDaysLeft !== 1 ? 's' : ''} remaining`}
                    </span>
                    <span className="text-muted-foreground">
                      {subscription.expires_at
                        ? `Until ${new Date(subscription.expires_at || subscription.end_date).toLocaleDateString('en-MW', { day: 'numeric', month: 'short' })}`
                        : ''}
                    </span>
                  </div>
                  {/* Progress bar */}
                  {(() => {
                    const totalDays = { trial: 7, monthly: 30, quarterly: 90, annual: 365, biannual: 730 }[subscription.plan] || 30;
                    const pct = Math.max(0, Math.min(100, (subDaysLeft / totalDays) * 100));
                    return (
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${
                          isTrial ? 'bg-primary' :
                          isExpiring3 ? 'bg-destructive' :
                          isExpiringSoon ? 'bg-amber-500' :
                          'bg-emerald-500'
                        }`} style={{ width: `${pct}%` }} />
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            <Link to="/subjects" className="flex-1">
              <Button variant="outline" size="sm" className="w-full">
                <BookOpen className="w-3.5 h-3.5 mr-1.5" /> Go to Lessons
              </Button>
            </Link>
            {(isExpiringSoon || isTrial) && (
              <Button size="sm" className={`flex-1 font-semibold ${
                isTrial ? 'bg-primary hover:bg-primary/90' :
                isExpiring3 ? 'bg-destructive hover:bg-destructive/90' : 'bg-amber-500 hover:bg-amber-600'
              } text-white border-0`}
                onClick={() => document.getElementById('pricing-cards')?.scrollIntoView({ behavior: 'smooth' })}>
                <Zap className="w-3.5 h-3.5 mr-1.5" /> {isTrial ? 'Upgrade Now' : 'Renew Now'}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* What you get */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: BookOpen, label: 'All Lessons', sub: 'Videos & notes' },
          { icon: Award, label: 'Past Papers', sub: 'Exam revision' },
          { icon: Users, label: 'Discussions', sub: 'Ask teachers' },
          { icon: Calendar, label: 'Progress', sub: 'Track growth' },
        ].map(({ icon: Icon, label, sub }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
            <Icon className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-sm font-semibold">{label}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      {/* Fee Plans */}
      <div>
        <h2 className="text-lg font-display font-semibold mb-4">Choose a Fee Period</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {plans.map(plan => {
            const isCurrent = hasPaidFees && currentPlan === plan.id;
            return (
              <div key={plan.id} className={cn(
                "relative rounded-2xl border-2 p-6 transition-all hover:shadow-lg",
                plan.bgColor,
                isCurrent ? 'border-success' : plan.popular ? plan.color : 'border-border'
              )}>
                {plan.popular && !hasPaidFees && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-accent text-accent-foreground text-[10px] px-3">Most Popular</Badge>
                  </div>
                )}
                <div className="mb-4 pt-1">
                  <plan.icon className="w-7 h-7 text-primary mb-3" />
                  <h3 className="font-display font-bold text-lg">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground">{plan.duration} of access</p>
                  <div className="mt-3">
                    <span className="text-3xl font-bold font-display">MWK {formatPrice(plan.price)}</span>
                    <span className="text-xs text-muted-foreground ml-1">{plan.period}</span>
                  </div>
                </div>
                <ul className="space-y-2 mb-5">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <Check className="w-3.5 h-3.5 text-success flex-shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={isCurrent ? "secondary" : "default"}
                  disabled={isCurrent || isLoading || verifying}
                  onClick={() => handlePlanSelect(plan.id)}
                >
                  {isCurrent ? 'Current Plan' : `Pay MWK ${formatPrice(plan.price)}`}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 text-sm">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <GraduationCap className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="font-medium">Need help with your fees?</p>
          <p className="text-xs text-muted-foreground">
            Secure payment via Airtel Money & TNM Mpamba. Contact us at{' '}
            <a href="mailto:support@chibondoacademy.com" className="text-primary hover:underline">support@chibondoacademy.com</a>
          </p>
        </div>
      </div>

      {/* ── Payment Tutorial Video — only shown before first payment ── */}
      {!hasPaidFees && !verifying && (
        <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 overflow-hidden">
          <div className="px-5 py-4 flex items-center gap-3 border-b border-primary/10">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">How to Pay School Fees</p>
              <p className="text-xs text-muted-foreground">Watch this quick guide before you pay</p>
            </div>
          </div>
          <div className="relative w-full" style={{paddingBottom: '56.25%'}}>
            <iframe
              src="https://www.youtube.com/embed/2oaEnOO4S7g?rel=0&modestbranding=1"
              title="How to Pay School Fees — Chibondo Academy"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </div>
        </div>
      )}

      </div>
    </>
  );
}

