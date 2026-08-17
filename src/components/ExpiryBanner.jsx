import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, X } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useOutletContext } from 'react-router-dom';

/**
 * ExpiryBanner — shows a renewal notice for expired or expiring-soon subscriptions.
 * Render it at the top of any page that requires an active subscription.
 *
 * Props:
 *   - forceShow: if true, always show even for expired (not just expiring soon)
 */
export default function ExpiryBanner({ forceShow = false }) {
  const { user } = useOutletContext() ?? {};
  const { isExpired, daysLeft, hasPaidFees } = useSubscription(user?.id);

  // Don't show for guests, admins, or teachers
  if (!user || user.role === 'admin' || user.role === 'teacher') return null;

  // Expired — show a strong paywall banner
  if (isExpired) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 mb-4 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-destructive">Your subscription has expired</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pay your fees to regain access to all lessons, quizzes, and assignments.
          </p>
        </div>
        <Link
          to="/subscription"
          className="flex-shrink-0 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold hover:opacity-90 transition"
        >
          Renew Now
        </Link>
      </div>
    );
  }

  // Expiring soon (within 5 days) — show a warning
  if (hasPaidFees && daysLeft !== null && daysLeft <= 5) {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 mb-4 flex items-center gap-3">
        <Clock className="w-5 h-5 text-primary flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-primary">
            Your subscription expires in {daysLeft} day{daysLeft === 1 ? '' : 's'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Renew now to avoid losing access to your lessons.
          </p>
        </div>
        <Link
          to="/subscription"
          className="flex-shrink-0 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition"
        >
          Renew
        </Link>
      </div>
    );
  }

  return null;
}
