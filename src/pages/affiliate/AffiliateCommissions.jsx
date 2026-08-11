import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { DollarSign } from 'lucide-react';
import SEO from '@/components/SEO';

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  color: 'bg-yellow-500/10 text-yellow-600',  dot: 'bg-yellow-500' },
  approved: { label: 'Approved', color: 'bg-blue-500/10 text-blue-600',      dot: 'bg-blue-500' },
  paid:     { label: 'Paid',     color: 'bg-green-500/10 text-green-600',    dot: 'bg-green-500' },
  rejected: { label: 'Rejected', color: 'bg-red-500/10 text-red-600',        dot: 'bg-red-500' },
};

export default function AffiliateCommissions() {
  const ctx = useOutletContext() || {};
  const { user, commissionAmount = 10000 } = ctx;
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ['myReferrals', user?.id],
    queryFn: async () => {
      try { return await db.entities.Referral.filter({ referrer_id: user?.id }, '-created_date', 200); }
      catch { return []; }
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });

  // Derive commission items from paid referrals — fixed amount model
  const allItems = referrals
    .filter(r => r.status !== 'pending') // only registered+ generate commission records
    .map(r => {
      const isPaid = ['paid', 'rewarded'].includes(r.status);
      return {
        id: r.id,
        created_date: r.created_date,
        referral_name: r.referred_name || r.referred_email || 'Unknown',
        plan_name: r.plan_name || r.subscription_plan || 'Subscription',
        amount: isPaid ? (r.reward_amount || commissionAmount) : commissionAmount,
        status: r.status === 'rewarded' ? 'paid' : isPaid ? 'approved' : 'pending',
      };
    });

  const now = new Date();
  const filtered = allItems.filter(c => {
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    let matchDate = true;
    if (dateFilter === '7d')  matchDate = new Date(c.created_date) > new Date(now - 7  * 86400000);
    if (dateFilter === '30d') matchDate = new Date(c.created_date) > new Date(now - 30 * 86400000);
    if (dateFilter === '90d') matchDate = new Date(c.created_date) > new Date(now - 90 * 86400000);
    return matchStatus && matchDate;
  });

  const totals = {
    total:   allItems.filter(c => c.status !== 'pending').reduce((s, c) => s + c.amount, 0),
    pending: allItems.filter(c => c.status === 'pending').length,
    paid:    allItems.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0),
  };

  return (
    <>
    <SEO title="Commissions" description="Track your affiliate commissions and earning history." />
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-xl font-heading font-bold" style={{ color: 'hsl(var(--primary))' }}>MWK {totals.total.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Total Earned</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-xl font-heading font-bold text-yellow-500">{totals.pending} referral{totals.pending !== 1 ? 's' : ''}</p>
          <p className="text-xs text-muted-foreground">Awaiting Payment</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-xl font-heading font-bold text-green-500">MWK {totals.paid.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Paid Out</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'pending', 'approved', 'paid', 'rejected'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-all ${statusFilter === s ? 'font-bold' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
              style={statusFilter === s ? { background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' } : {}}>
              {s === 'all' ? 'All' : STATUS_CONFIG[s]?.label || s}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          {[['all', 'All Time'], ['7d', '7 Days'], ['30d', '30 Days'], ['90d', '90 Days']].map(([v, l]) => (
            <button key={v} onClick={() => setDateFilter(v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${dateFilter === v ? 'bg-muted text-foreground font-bold' : 'text-muted-foreground hover:bg-muted/50'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading commissions…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <DollarSign className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">No commissions yet. Referrals that pay fees will appear here.</p>
          </div>
        ) : (
          <>
            <div className="hidden sm:grid grid-cols-12 gap-2 px-5 py-3 border-b border-border bg-muted/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase col-span-2">Date</p>
              <p className="text-xs font-semibold text-muted-foreground uppercase col-span-4">Referral</p>
              <p className="text-xs font-semibold text-muted-foreground uppercase col-span-3">Plan</p>
              <p className="text-xs font-semibold text-muted-foreground uppercase col-span-2 text-right">Amount</p>
              <p className="text-xs font-semibold text-muted-foreground uppercase col-span-1 text-right">Status</p>
            </div>
            <div className="divide-y divide-border">
              {filtered.map(c => (
                <div key={c.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 px-5 py-4 hover:bg-muted/20 transition-colors">
                  <p className="sm:col-span-2 text-xs text-muted-foreground self-center">
                    {new Date(c.created_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                  <div className="sm:col-span-4 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_CONFIG[c.status]?.dot || 'bg-muted-foreground'}`} />
                    <p className="text-sm font-medium truncate">{c.referral_name}</p>
                  </div>
                  <p className="sm:col-span-3 text-xs text-muted-foreground self-center">{c.plan_name}</p>
                  <div className="sm:col-span-2 flex items-center justify-end">
                    <span className="text-sm font-bold" style={{ color: 'hsl(var(--primary))' }}>
                      {c.status === 'pending' ? '—' : `+MWK ${c.amount.toLocaleString()}`}
                    </span>
                  </div>
                  <div className="sm:col-span-1 flex items-center justify-end">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[c.status]?.color || 'bg-muted text-muted-foreground'}`}>
                      {STATUS_CONFIG[c.status]?.label || c.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
    </>
  );
}
