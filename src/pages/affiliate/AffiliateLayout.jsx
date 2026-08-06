import { SectionLoader } from '@/components/BrandedSpinner';
import React from 'react';
import { NavLink, Outlet, useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { Gift } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { label: 'Overview',          path: '/affiliate',             exact: true  },
  { label: 'Referral Links',    path: '/affiliate/links',       exact: false },
  { label: 'Referrals',         path: '/affiliate/referrals',   exact: false },
  { label: 'Earnings',          path: '/affiliate/commissions', exact: false },
  { label: 'Payouts',           path: '/affiliate/payouts',     exact: false },
  { label: 'Marketing Kit',     path: '/affiliate/materials',   exact: false },
  { label: 'Profile & Payment', path: '/affiliate/profile',     exact: false },
];

export default function AffiliateLayout() {
  const outletCtx = useOutletContext() || {};
  const { user, notifications } = outletCtx || {};

  const { data: settingsData = [], isLoading: settingsLoading } = useQuery({
    queryKey: ['affiliateSettings'],
    queryFn: async () => {
      try { return await db.entities.PlatformSettings.filter({ key: 'affiliate_commission' }); }
      catch { return []; }
    },
    staleTime: 60_000,
  });
  const settings           = settingsData[0]?.value || {};
  const commissionAmount   = settings.commission_amount ?? settings.fixed_amount ?? 10000;
  const minPayout          = settings.min_payout ?? 5000;
  const programEnabled     = settings.enabled !== false;

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <SectionLoader label="Loading…" />
      </div>
    );
  }

  if (!programEnabled) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
          <Gift className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-display font-bold">Affiliate Program Paused</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          The affiliate program is currently disabled. Check back soon!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'hsl(var(--primary) / 0.15)' }}>
          <Gift className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold">Affiliate Program</h1>
          <p className="text-sm text-muted-foreground">
            Earn <span className="font-semibold text-foreground">MWK {commissionAmount.toLocaleString()}</span> per successful paid referral
          </p>
        </div>
      </div>

      {/* ── In-page sub-navigation — always shows labels ── */}
      <div className="bg-card border border-border rounded-2xl p-1.5 overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {NAV.map(({ label, path, exact }) => (
            <NavLink
              key={path}
              to={path}
              end={exact}
              className={({ isActive }) => cn(
                'px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all',
                isActive
                  ? 'font-bold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              )}
              style={({ isActive }) =>
                isActive
                  ? { background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }
                  : {}
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Sub-page content */}
      <div>
        <Outlet context={{
        user, notifications, settings, settingsData, settingsLoading,
        commissionAmount, minPayout,
      }} />
      </div>
    </div>
  );
}
