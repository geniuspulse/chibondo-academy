import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { Users, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import SEO from '@/components/SEO';

const STATUS_CONFIG = {
  pending:    { label: 'Pending',     color: 'bg-muted text-muted-foreground',       payStatus: 'Pending',          commStatus: '—' },
  registered: { label: 'Registered',  color: 'bg-blue-500/10 text-blue-600',          payStatus: 'Not Paid',         commStatus: 'Pending' },
  paid:       { label: 'Fees Paid',   color: 'bg-yellow-500/10 text-yellow-600',      payStatus: 'Active (Paid)',    commStatus: 'Approved' },
  rewarded:   { label: 'Rewarded',    color: 'bg-green-500/10 text-green-600',        payStatus: 'Active (Paid)',    commStatus: 'Paid Out' },
};

export default function AffiliateReferrals() {
  const ctx = useOutletContext() || {};
  const { user, commissionAmount = 10000 } = ctx;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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

  const filtered = referrals.filter(r => {
    const matchSearch = !search ||
      (r.referred_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.referred_email || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const paidCount = referrals.filter(r => ['paid', 'rewarded'].includes(r.status)).length;
  const convRate  = referrals.length > 0 ? Math.round((paidCount / referrals.length) * 100) : 0;

  return (
    <>
    <SEO title="My Referrals" description="View all your referrals and their subscription status." />
    <div className="space-y-5">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Referred',   value: referrals.length,                                                    color: 'text-foreground' },
          { label: 'Registered',       value: referrals.filter(r => r.status !== 'pending').length,               color: 'text-blue-500' },
          { label: 'Active (Paid)',    value: paidCount,                                                           color: 'text-green-500' },
          { label: 'Conversion Rate',  value: `${convRate}%`,                                                      color: 'hsl(var(--primary))' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-heading font-bold" style={typeof color === 'string' && color.startsWith('hsl') ? { color } : {}}
              {...(typeof color === 'string' && !color.startsWith('hsl') ? { className: `text-2xl font-heading font-bold ${color}` } : {})}>
              {value}
            </p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'pending', 'registered', 'paid', 'rewarded'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-medium capitalize transition-all ${statusFilter === s ? 'font-bold' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
              style={statusFilter === s ? { background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' } : {}}>
              {s === 'all' ? 'All' : STATUS_CONFIG[s]?.label || s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading referrals…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">
              {referrals.length === 0 ? 'No referrals yet. Share your link to start earning!' : 'No results match your search.'}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden sm:grid grid-cols-12 gap-2 px-5 py-3 border-b border-border bg-muted/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase col-span-3">Student</p>
              <p className="text-xs font-semibold text-muted-foreground uppercase col-span-2">Registered</p>
              <p className="text-xs font-semibold text-muted-foreground uppercase col-span-2">Plan</p>
              <p className="text-xs font-semibold text-muted-foreground uppercase col-span-2">Payment</p>
              <p className="text-xs font-semibold text-muted-foreground uppercase col-span-2">Commission</p>
              <p className="text-xs font-semibold text-muted-foreground uppercase col-span-1 text-right">Amount</p>
            </div>
            <div className="divide-y divide-border">
              {filtered.map(r => {
                const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
                const isPaid = ['paid', 'rewarded'].includes(r.status);
                return (
                  <div key={r.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 px-5 py-4 hover:bg-muted/20 transition-colors">
                    <div className="sm:col-span-3 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
                        {(r.referred_name || r.referred_email || '?')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.referred_name || 'Pending'}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{r.referred_email || '—'}</p>
                      </div>
                    </div>
                    <div className="sm:col-span-2 flex items-center">
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.created_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="sm:col-span-2 flex items-center">
                      <span className="text-xs text-muted-foreground">{r.plan_name || r.subscription_plan || '—'}</span>
                    </div>
                    <div className="sm:col-span-2 flex items-center">
                      <Badge className={`text-[10px] ${cfg.color}`}>{cfg.payStatus}</Badge>
                    </div>
                    <div className="sm:col-span-2 flex items-center">
                      <span className={`text-xs font-medium ${
                        cfg.commStatus === 'Paid Out'  ? 'text-green-500' :
                        cfg.commStatus === 'Approved'  ? 'text-yellow-500' :
                        cfg.commStatus === 'Pending'   ? 'text-blue-500' : 'text-muted-foreground'
                      }`}>{cfg.commStatus}</span>
                    </div>
                    <div className="sm:col-span-1 flex items-center justify-end">
                      {isPaid ? (
                        <span className="text-sm font-bold" style={{ color: 'hsl(var(--primary))' }}>
                          +MWK {(r.reward_amount || commissionAmount).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
    </>
  );
}
