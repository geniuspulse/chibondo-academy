/**
 * useSubscription — shared hook for subscription status and expiry checking.
 *
 * Used by LessonPage, SubjectDetail, SubscriptionPage, and AppLayout.
 * Centralises the expiry logic so it's consistent everywhere:
 *   - Filters by status: 'active'
 *   - Checks end_date / expires_at against current time
 *   - Handles missing end_date (treats as expired if plan is not 'free')
 *   - Returns isExpired, daysLeft, hasPaidFees, and the subscription record
 */

import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';

export function useSubscription(userId) {
  const { data: subscription, isLoading } = useQuery({
    queryKey: ['subscription', userId],
    queryFn: async () => {
      if (!userId) return null;

      // Fetch active subscriptions for this student
      const results = await db.entities.Subscription.filter({
        student_id: userId,
        status: 'active',
      });
      if (!results || results.length === 0) return null;

      const sub = results[0];
      const expiry = sub.expires_at || sub.end_date;

      // If end_date exists and has passed, the subscription is effectively expired
      // (the backend cron may not have run yet to flip the status)
      if (expiry && new Date(expiry) < new Date()) {
        return { ...sub, _stale: true };
      }

      // If no end_date at all and the plan is a paid plan, treat as expired
      // (a real active subscription must have an end_date)
      if (!expiry && sub.plan && sub.plan !== 'free') {
        return { ...sub, _stale: true };
      }

      return sub;
    },
    enabled: !!userId,
    staleTime: 60_000, // cache for 1 minute
  });

  const isExpired = !!subscription?._stale;
  const expiry = subscription?.expires_at || subscription?.end_date;
  const daysLeft = expiry
    ? Math.ceil((new Date(expiry) - new Date()) / 86_40_000)
    : null;
  const hasPaidFees = !!subscription && !isExpired;

  return {
    subscription,
    isExpired,
    hasPaidFees,
    daysLeft: isExpired ? 0 : daysLeft,
    isLoading,
  };
}
