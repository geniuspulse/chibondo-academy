import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { Wallet, AlertCircle, CheckCircle2, Clock, XCircle, ArrowUpRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import SEO from '@/components/SEO';

const PAYOUT_STATUS = {
  pending:    { label: 'Pending',    icon: Clock,        color: 'bg-yellow-500/10 text-yellow-600' },
  processing: { label: 'Processing', icon: ArrowUpRight, color: 'bg-blue-500/10 text-blue-600' },
  completed:  { label: 'Completed',  icon: CheckCircle2, color: 'bg-green-500/10 text-green-600' },
  rejected:   { label: 'Rejected',   icon: XCircle,      color: 'bg-red-500/10 text-red-600' },
};

export default function AffiliatePayouts() {
  const ctx = useOutletContext() || {};
  const { user, commissionAmount = 10000, minPayout = 5000 } = ctx;
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({ method: 'airtel_money', details: '', amount: '' });

  const { data: referrals = [] } = useQuery({
    queryKey: ['myReferrals', user?.id],
    queryFn: async () => {
      try { return await db.entities.Referral.filter({ referrer_id: user?.id }, '-created_date', 200); }
      catch { return []; }
    },
    enabled: !!user?.id,
  });

  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ['myPayouts', user?.id],
    queryFn: async () => {
      try { return await db.entities.PayoutRequest.filter({ affiliate_id: user?.id }, '-created_date', 50); }
      catch { return []; }
    },
    enabled: !!user?.id,
  });

  // Fixed-amount model: each paid referral = commissionAmount
  const paidReferrals   = referrals.filter(r => ['paid', 'rewarded'].includes(r.status));
  const totalEarned     = paidReferrals.reduce((s, r) => s + (r.reward_amount || commissionAmount), 0);
  const paidOut         = payouts.filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount || 0), 0);
  const available       = Math.max(0, totalEarned - paidOut);
  const hasPending      = payouts.some(p => ['pending', 'processing'].includes(p.status));
  const canRequest      = available >= minPayout && !hasPending;

  const requestMut = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(form.amount) || available;
      if (amt < minPayout) throw new Error(`Minimum payout is MWK ${minPayout.toLocaleString()}`);
      if (amt > available) throw new Error(`Amount exceeds available balance of MWK ${available.toLocaleString()}`);
      if (!form.details.trim()) throw new Error('Please enter your payment details');
      return db.entities.PayoutRequest.create({
        affiliate_id:     user.id,
        affiliate_name:   user.full_name || user.email,
        amount:           amt,
        payment_method:   form.method,
        payment_details:  form.details,
        status:           'pending',
        referral_count:   paidReferrals.length,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myPayouts'] });
      toast.success("Payout request submitted! We'll process it within 48–72 hours.");
      setDialog(false);
      setForm({ method: 'airtel_money', details: '', amount: '' });
    },
    onError: e => toast.error(e.message),
  });

  return (
    <>
    <SEO title="Payouts" description="Request and track your affiliate payout payments." />
    <div className="space-y-6">
      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 sm:col-span-1">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide font-semibold">Available Balance</p>
          <p className="text-3xl font-heading font-bold" style={{ color: 'hsl(var(--primary))' }}>
            MWK {available.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Min. payout: <span className="font-semibold text-foreground">MWK {minPayout.toLocaleString()}</span>
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total Earned</p>
          <p className="text-xl font-bold" style={{ color: 'hsl(var(--primary))' }}>MWK {totalEarned.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{paidReferrals.length} paid referral{paidReferrals.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total Paid Out</p>
          <p className="text-xl font-bold text-green-500">MWK {paidOut.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{payouts.filter(p => p.status === 'completed').length} payout{payouts.filter(p => p.status === 'completed').length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Status / CTA */}
      {hasPending ? (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
          <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-yellow-700">Payout Request Processing</p>
            <p className="text-xs text-yellow-600">You have a pending request. We'll notify you when it's approved (48–72 hrs).</p>
          </div>
        </div>
      ) : available < minPayout ? (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 border border-border">
          <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold">Not Yet Eligible</p>
            <p className="text-xs text-muted-foreground">
              You need <span className="font-semibold text-foreground">MWK {Math.max(0, minPayout - available).toLocaleString()}</span> more to reach the minimum payout.
              That's {Math.ceil((minPayout - available) / commissionAmount)} more paid referral{Math.ceil((minPayout - available) / commissionAmount) !== 1 ? 's' : ''}.
            </p>
          </div>
        </div>
      ) : (
        <Button onClick={() => setDialog(true)} size="lg"
          className="w-full sm:w-auto"
          style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }}>
          <Wallet className="w-4 h-4 mr-2" />
          Request Withdrawal — MWK {available.toLocaleString()}
        </Button>
      )}

      {/* Payout history */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold">Payout History</h3>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : payouts.length === 0 ? (
          <div className="py-12 text-center">
            <Wallet className="w-10 h-10 mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">No payouts yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {payouts.map(p => {
              const cfg = PAYOUT_STATUS[p.status] || PAYOUT_STATUS.pending;
              const Icon = cfg.icon;
              return (
                <div key={p.id} className="flex items-center gap-4 px-5 py-4">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">MWK {(p.amount || 0).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">
                      {(p.payment_method || '').replace(/_/g, ' ')} · {new Date(p.created_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Request dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request Payout</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="p-3 rounded-xl bg-muted/50 border border-border text-sm">
              Available: <span className="font-bold">MWK {available.toLocaleString()}</span>
              <span className="text-muted-foreground ml-2">({paidReferrals.length} paid referrals × MWK {commissionAmount.toLocaleString()})</span>
            </div>
            <div className="space-y-1.5">
              <Label>Amount (MWK)</Label>
              <Input type="number" placeholder={`Max ${available.toLocaleString()}`}
                value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <Select value={form.method} onValueChange={v => setForm(f => ({ ...f, method: v, details: '' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="airtel_money">Airtel Money</SelectItem>
                  <SelectItem value="tnm_mpamba">TNM Mpamba</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{form.method === 'bank_transfer' ? 'Bank Account Details' : 'Phone Number'}</Label>
              <Input
                placeholder={form.method === 'bank_transfer' ? 'Bank name, account number, account holder' : '09XXXXXXXX'}
                value={form.details}
                onChange={e => setForm(f => ({ ...f, details: e.target.value }))}
              />
            </div>
            <Button className="w-full" onClick={() => requestMut.mutate()} disabled={requestMut.isPending}
              style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }}>
              {requestMut.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</> : 'Submit Request'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}
