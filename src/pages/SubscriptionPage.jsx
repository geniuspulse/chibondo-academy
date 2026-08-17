import React, { useState, useEffect } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { usePricing } from '@/hooks/usePricing';
import { Button } from '@/components/ui/button';
import { Check, Zap, Crown, Loader2, BookOpen, Calendar, Award } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useSubscription } from '@/hooks/useSubscription';
import { AlertTriangle } from 'lucide-react';
import SEO from '@/components/SEO';

export default function SubscriptionPage() {
  const { user } = useOutletContext() ?? {};
  const currentPlan = user?.subscription_plan || 'free';
  const navigate = useNavigate();

  const [verifying, setVerifying] = useState(false);

  // Shared pricing hook — DO NOT inline a separate ['pricing'] query here,
  // it will collide with the shared cache key and can serve the wrong
  // shape/price to the checkout page — see usePricing.js
  const { data: pricingData, isLoading } = usePricing();
  const pricing = pricingData || { monthly_price: 10000, annual_price: 80000, biannual_price: 150000 };

  const { data: lessonCount } = useQuery({
    queryKey: ['lessonCount'],
    queryFn: () => db.entities.Lesson.count({ status: 'published' }),
    staleTime: 5 * 60_000,
  });

  const { subscription, isExpired, hasPaidFees, daysLeft: subDaysLeft } = useSubscription(user?.id);

  // PayChangu return redirect verification
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const txRef = params.get('tx_ref');
    const paid = params.get('paid');
    const status = params.get('status');
    if (txRef || paid || status) window.history.replaceState({}, '', '/subscription');
    if (!txRef || hasPaidFees) return;

    setVerifying(true);
    let attempts = 0;
    const poll = () => {
      attempts++;
      fetch('/api/verify-payment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tx_ref: txRef, user_id: user?.id }),
      }).then(r => r.json()).catch(() => ({}))
        .then(res => {
          if (res.success) { setVerifying(false); toast.success('🎉 Payment confirmed! Full access unlocked.'); refetchSubscription(); }
          else if (res.failed) { setVerifying(false); toast.error('Payment not completed. Try again.'); }
          else if (res.pending && attempts < 10) setTimeout(poll, 3000);
          else { setVerifying(false); toast.warning('Payment still processing. Refresh in a minute.'); }
        });
    };
    poll();
  }, [user?.id]);

  const plans = [
    { id: 'monthly', name: 'Monthly', price: pricing.monthly_price, period: '/month', icon: Zap, popular: true },
    { id: 'annual', name: 'Annual', price: pricing.annual_price, period: '/year', icon: Crown },
    { id: 'biannual', name: 'Biannual', price: pricing.biannual_price, period: '/2 years', icon: Award },
  ];

  const handlePlanSelect = (planId) => {
    if (!planId || !['monthly', 'annual', 'biannual'].includes(planId)) {
      toast.error('Invalid plan selected. Please try again.');
      return;
    }
    if (!user) { toast.error('Please log in to subscribe'); navigate('/login?redirect=/pay-fees/' + planId); return; }
    navigate('/pay-fees/' + planId, { replace: false });
  };

  const fmt = (n) => n.toLocaleString('en-MW');

  return (
    <>
      <SEO title="School Fees & Pricing"
        description="Affordable online secondary education at Chibondo Academy. Access MSCE lessons, quizzes, past papers from MWK 10,000/month."
        canonical={`${window.location.origin}/subscription`} />

      <div className="space-y-6 max-w-3xl mx-auto" id="pricing-cards">

        {/* Verifying banner */}
        {verifying && (
          <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4 flex items-center gap-3">
            <Loader2 className="w-6 h-6 text-primary animate-spin flex-shrink-0" />
            <p className="font-semibold text-primary text-sm">Verifying your payment…</p>
          </div>
        )}

        {/* Hero */}
        <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-center text-primary-foreground">
          <h1 className="text-2xl sm:text-3xl font-heading font-bold mb-1">Unlock Every Lesson</h1>
          <p className="text-primary-foreground/70 text-sm max-w-md mx-auto">
            Pay your school fees to access all lessons, quizzes, past papers, and resources across every subject
          </p>
          <div className="flex flex-wrap justify-center gap-5 pt-4">
            {[{ text: 'All Subjects' }, { text: lessonCount != null ? `${lessonCount}+ Lessons` : 'Lessons' }, { text: 'Past Papers' }].map(({ text }) => (
              <span key={text} className="text-xs text-primary-foreground/80">{text}</span>
            ))}
          </div>
        </div>

        {/* Expired subscription — prominent renewal notice */}
        {isExpired && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <div>
                <p className="font-semibold text-sm text-destructive">Subscription Expired</p>
                <p className="text-xs text-muted-foreground">
                  Your access to lessons has been suspended. Renew to continue learning.
                </p>
              </div>
            </div>
            <Button size="sm" onClick={() => document.getElementById('pricing-cards')?.scrollIntoView({ behavior: 'smooth' })}>
              Renew Now
            </Button>
          </div>
        )}

        {/* Active subscription — simple status */}
        {hasPaidFees && (
          <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="font-semibold text-sm">
                  {subscription.plan === 'trial' ? 'Trial' : 'Active'} — {subscription.plan}
                </p>
                {subDaysLeft !== null && subDaysLeft > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {subDaysLeft} days remaining
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Link to="/subjects"><Button variant="outline" size="sm">Lessons</Button></Link>
              {(subDaysLeft !== null && subDaysLeft <= 7) && (
                <Button size="sm" onClick={() => document.getElementById('pricing-cards')?.scrollIntoView({ behavior: 'smooth' })}>
                  Renew
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Pricing — compact rows */}
        <div className="space-y-3">
          <h2 className="text-lg font-heading font-semibold">Choose a Fee Period</h2>
          {plans.map(plan => {
            const isCurrent = hasPaidFees && currentPlan === plan.id;
            const PlanIcon = plan.icon;
            const savings = plan.id === 'annual'
              ? pricing.monthly_price * 12 - pricing.annual_price
              : plan.id === 'biannual'
              ? pricing.monthly_price * 24 - pricing.biannual_price : 0;
            return (
              <div key={plan.id} className={cn(
                "rounded-2xl border-2 p-5 flex items-center gap-4 transition-all",
                plan.popular && !hasPaidFees ? "border-primary/50 bg-primary/5" : "border-border bg-card"
              )}>
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <PlanIcon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm">{plan.name}</p>
                    {plan.popular && !hasPaidFees && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">Popular</span>
                    )}
                    {savings > 0 && <span className="text-[10px] text-muted-foreground">Save MWK {fmt(savings)}</span>}
                  </div>
                  <p className="text-lg font-bold mt-0.5">MWK {fmt(plan.price)} <span className="text-xs font-normal text-muted-foreground">{plan.period}</span></p>
                </div>
                <Button
                  variant={isCurrent ? 'secondary' : 'default'}
                  disabled={isCurrent || isLoading || verifying}
                  onClick={() => handlePlanSelect(plan.id)}
                  className="flex-shrink-0"
                >
                  {isCurrent ? 'Current' : 'Pay'}
                </Button>
              </div>
            );
          })}
        </div>

        {/* How-to-pay link (not full embed) */}
        {!hasPaidFees && !verifying && (
          <div className="text-center">
            <a href="https://www.youtube.com/watch?v=2oaEnOO4S7g" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <BookOpen className="w-3.5 h-3.5" /> Watch: How to pay school fees
            </a>
          </div>
        )}
      </div>
    </>
  );
}
