import React, { useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { Input } from '@/components/ui/input';
import {
  DollarSign, Clock, CheckCircle2, Wallet,
  Users, TrendingUp, ArrowRight, Gift, Copy, Check, Edit2, X, Save, Info, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import SEO from '@/components/SEO';

function StatCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-heading font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      {sub && <p className="text-[11px] mt-1 font-medium text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function AffiliateDashboard() {
  const ctx = useOutletContext() || {};
  const {
    user, commissionAmount = 10000, minPayout = 5000,
  } = ctx;
  const qc = useQueryClient();

  const referralCode = user?.referral_code || (user?.id ? `CHIB-${user.id.slice(-6).toUpperCase()}` : '');

  // Custom code editing
  const [editingCode, setEditingCode] = useState(false);
  const [draftCode, setDraftCode]     = useState('');
  const [copied, setCopied]           = useState(false);
  const [codeStatus, setCodeStatus]   = useState(null); // null | 'checking' | 'available' | 'taken' | 'yours'
  const debounceRef = React.useRef(null);

  // Real-time availability check — debounced
  const handleDraftChange = (val) => {
    const clean = val.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    setDraftCode(clean);
    setCodeStatus(null);
    clearTimeout(debounceRef.current);
    if (clean.length < 4) return;
    if (clean === referralCode) { setCodeStatus('yours'); return; }
    setCodeStatus('checking');
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/wa-otp?action=check-uniqueness&referralCode=${encodeURIComponent(clean)}&excludeUserId=${user?.id || ''}`);
        if (res.ok) {
          const data = await res.json();
          setCodeStatus(data.referralCodeAvailable ? 'available' : 'taken');
        } else { setCodeStatus(null); }
      } catch { setCodeStatus(null); }
    }, 500);
  };

  const saveCodeMut = useMutation({
    mutationFn: async (code) => {
      const clean = code.trim().toUpperCase();
      if (clean.length < 4) throw new Error('Code must be at least 4 characters');
      if (codeStatus === 'taken') throw new Error('This code is already taken');
      return db.auth.updateMe({ referral_code: clean });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['currentUser'] });
      setEditingCode(false);
      toast.success('Referral code updated!');
    },
    onError: () => toast.error('Could not save code. Try again.'),
  });

  const copyLink = () => {
    navigator.clipboard.writeText(`https://chibondoacademy.com/register?ref=${referralCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const { data: referrals = [] } = useQuery({
    queryKey: ['myReferrals', user?.id],
    queryFn: async () => {
      try { return await db.entities.Referral.filter({ referrer_id: user?.id }, '-created_date', 200); }
      catch { return []; }
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000, // refresh every 30s for live tracking
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ['myPayouts', user?.id],
    queryFn: async () => {
      try { return await db.entities.PayoutRequest.filter({ affiliate_id: user?.id }, '-created_date', 50); }
      catch { return []; }
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Commission stats — fixed-amount model
  // Only referrals with status 'paid' or 'rewarded' generate commission
  const paidReferrals    = referrals.filter(r => ['paid', 'rewarded'].includes(r.status));
  const pendingReferrals = referrals.filter(r => r.status === 'registered'); // registered but not paid yet
  const totalReferrals   = referrals.length;

  const totalEarnings    = paidReferrals.reduce((s, r) => s + (r.reward_amount || commissionAmount), 0);
  const pendingComm      = pendingReferrals.reduce((s, r) => s + (r.reward_amount || 0), 0);
  const paidOut          = payouts.filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount || 0), 0);
  const availableBalance = Math.max(0, totalEarnings - paidOut);
  const convRate         = totalReferrals > 0 ? Math.round((paidReferrals.length / totalReferrals) * 100) : 0;

  return (
    <>
    <SEO title="Affiliate Dashboard" description="Track your referrals, commissions, and payouts as a Chibondo Academy affiliate partner." />
    <div className="space-y-6">
      {/* ── Hero banner — on-brand, consistent with site ── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {/* Gold accent bar */}
        <div className="h-1 w-full" style={{ background: 'hsl(var(--primary))' }} />

        <div className="p-6 flex flex-col sm:flex-row sm:items-center gap-6">
          {/* Left: earning + referral code */}
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Your commission</p>
              <p className="text-4xl font-heading font-bold text-foreground">
                MWK <span style={{ color: 'hsl(var(--primary))' }}>{commissionAmount.toLocaleString()}</span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">per successful paid subscription referral</p>
            </div>

            {/* Referral code — editable */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your referral code</p>
              {editingCode ? (
                <div className="space-y-1.5 max-w-xs">
                  <div className="flex items-center gap-2">
                    <Input
                      className={`h-9 font-mono text-sm uppercase pr-9 transition-colors ${
                        codeStatus === 'available' ? 'border-green-500 focus-visible:ring-green-500' :
                        codeStatus === 'taken' ? 'border-red-500 focus-visible:ring-red-500' : ''
                      }`}
                      value={draftCode}
                      onChange={e => handleDraftChange(e.target.value)}
                      placeholder={referralCode}
                      maxLength={20}
                      autoFocus
                    />
                    {codeStatus === 'checking' && (
                      <Loader2 className="absolute right-3 w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                    {codeStatus === 'available' && (
                      <Check className="absolute right-3 w-4 h-4 text-green-600" />
                    )}
                    <button
                      onClick={() => saveCodeMut.mutate(draftCode)}
                      disabled={!draftCode.trim() || draftCode.length < 4 || codeStatus === 'taken' || codeStatus === 'checking' || saveCodeMut.isPending}
                      className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40"
                      style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }}>
                      {saveCodeMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => { setEditingCode(false); setCodeStatus(null); }}
                      className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-muted hover:bg-muted/80 transition-colors text-muted-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {codeStatus === 'checking' && <p className="text-xs text-muted-foreground">⏳ Checking availability…</p>}
                  {codeStatus === 'available' && <p className="text-xs text-green-600 font-medium">✓ Available! This code is yours.</p>}
                  {codeStatus === 'taken' && <p className="text-xs text-red-500 font-medium">✕ Already taken — try another.</p>}
                  {codeStatus === 'yours' && <p className="text-xs text-blue-500 font-medium">✓ This is your current code.</p>}
                  {!codeStatus && draftCode.length > 0 && draftCode.length < 4 && <p className="text-xs text-muted-foreground">Min. 4 characters</p>}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-muted/40">
                    <span className="font-mono font-bold text-sm tracking-widest">{referralCode}</span>
                  </div>
                  <button
                    onClick={() => { setDraftCode(referralCode); setEditingCode(true); }}
                    className="w-8 h-8 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    title="Edit code">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={copyLink}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    title="Copy referral link">
                    {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy link'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right: payout info + CTA */}
          <div className="flex flex-col items-start sm:items-end gap-3 flex-shrink-0">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-muted/30 text-sm">
              <Wallet className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Min payout:</span>
              <span className="font-bold">MWK {minPayout.toLocaleString()}</span>
            </div>
            <Link to="/affiliate/links"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
              style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }}>
              Share Your Link <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Earnings Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total Referrals"      value={totalReferrals}                                             icon={Users}        color="text-blue-500 bg-blue-500/10" />
        <StatCard label="Active (Paid)"        value={paidReferrals.length}                                       icon={CheckCircle2} color="text-green-500 bg-green-500/10"
          sub={`${convRate}% conversion rate`} />
        <StatCard label="Pending Commissions"  value={`MWK ${pendingComm.toLocaleString()}`}                      icon={Clock}        color="text-yellow-500 bg-yellow-500/10"
          sub="Awaiting payment confirmation" />
        <StatCard label="Total Earnings"       value={`MWK ${totalEarnings.toLocaleString()}`}                    icon={DollarSign}   color="text-accent bg-accent/10" />
        <StatCard label="Available Balance"    value={`MWK ${availableBalance.toLocaleString()}`}                 icon={Wallet}       color="text-primary bg-primary/10"
          sub={availableBalance >= minPayout ? '✓ Eligible for payout' : `Need MWK ${Math.max(0, minPayout - availableBalance).toLocaleString()} more`} />
        <StatCard label="Paid Out"             value={`MWK ${paidOut.toLocaleString()}`}                          icon={TrendingUp}   color="text-purple-500 bg-purple-500/10" />
      </div>

      {/* Commission Rules Box */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <h3 className="font-semibold text-sm">Commission Rules</h3>
        </div>
        <ul className="space-y-2">
          {[
            `You earn MWK ${commissionAmount.toLocaleString()} per successful paid subscription`,
            'Commission is only credited after payment is confirmed',
            'Free trials and pending payments do NOT qualify',
            'Commission applies only to the first subscription per referred user',
            'Cancellations or failed payments void the commission',
            'Payouts are processed within 48–72 hours of approval',
          ].map((rule, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold mt-0.5"
                style={{ background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' }}>
                {i + 1}
              </span>
              {rule}
            </li>
          ))}
        </ul>
      </div>

      {/* Quick links */}
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { label: 'Get Referral Link',   to: '/affiliate/links',     icon: '🔗' },
          { label: 'Request Payout',       to: '/affiliate/payouts',   icon: '💰' },
          { label: 'Marketing Materials',  to: '/affiliate/materials', icon: '📣' },
        ].map(({ label, to, icon }) => (
          <Link key={to} to={to}
            className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-muted/40 transition-all group">
            <span className="text-2xl">{icon}</span>
            <span className="text-sm font-medium flex-1">{label}</span>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </Link>
        ))}
      </div>

      {/* Recent referrals */}
      {referrals.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" /> Recent Referrals
            </h3>
            <Link to="/affiliate/referrals" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          <div className="divide-y divide-border">
            {referrals.slice(0, 5).map(r => {
              const isPaid = ['paid', 'rewarded'].includes(r.status);
              return (
                <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
                    {(r.referred_name || r.referred_email || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.referred_name || r.referred_email || 'Pending registration'}</p>
                    <p className="text-xs text-muted-foreground">{new Date(r.created_date).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    {isPaid && (
                      <p className="text-xs font-semibold" style={{ color: 'hsl(var(--primary))' }}>
                        +MWK {(r.reward_amount || commissionAmount).toLocaleString()}
                      </p>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      r.status === 'rewarded'   ? 'bg-green-500/10 text-green-600' :
                      r.status === 'paid'       ? 'bg-yellow-500/10 text-yellow-600' :
                      r.status === 'registered' ? 'bg-blue-500/10 text-blue-600' :
                      'bg-muted text-muted-foreground'
                    } capitalize`}>{r.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
    </>
  );
}
