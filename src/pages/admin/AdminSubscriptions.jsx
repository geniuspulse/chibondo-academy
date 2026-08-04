import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  CreditCard, Search, CheckCircle2, XCircle, Clock, TrendingUp,
  Users, Banknote, CalendarDays, MoreVertical, Plus, Loader2, RefreshCw,
  Eye, X, ArrowRight, Mail, Send, Download, MessageSquare, Smartphone,
  Phone, BookOpen, GraduationCap, StickyNote, History, Filter, School, Trash2} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { toast } from 'sonner';

const STATUS_COLORS = {
  active:    'bg-success/10 text-success border-success/20',
  expired:   'bg-destructive/10 text-destructive border-destructive/20',
  cancelled: 'bg-muted text-muted-foreground border-border',
  trial:     'bg-accent/10 text-accent border-accent/20',
  pending:   'bg-accent/10 text-accent border-accent/20',
};
const STATUS_LABELS = { active:'Active', expired:'Expired', cancelled:'Cancelled', trial:'Pending', pending:'Pending' };
const PLAN_COLORS = {
  free:      'bg-muted text-muted-foreground border-border',
  monthly:   'bg-primary/10 text-primary border-primary/20',
  quarterly: 'bg-accent/10 text-accent border-accent/20',
  annual:    'bg-success/10 text-success border-success/20',
  biannual:  'bg-purple-500/10 text-purple-600 border-purple-500/20',
};
const PAYMENT_STATUS_COLORS = {
  completed: 'bg-success/10 text-success',
  pending:   'bg-accent/10 text-accent',
  failed:    'bg-destructive/10 text-destructive',
  refunded:  'bg-muted text-muted-foreground',
  cancelled: 'bg-muted text-muted-foreground',
};

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold font-display">{value}</p>
      <p className="text-sm font-medium mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Student Payment History side panel ──────────────────────────────────────
function StudentHistoryPanel({ studentId, studentName, payments, onClose }) {
  const studentPayments = payments
    .filter(p => p.student_id === studentId)
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-md bg-card border-l border-border h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
          <div>
            <p className="font-display font-bold text-sm">{studentName}</p>
            <p className="text-xs text-muted-foreground">Payment History ({studentPayments.length})</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          {studentPayments.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No payment records</p>
          )}
          {studentPayments.map(p => (
            <div key={p.id} className="bg-muted/30 border border-border rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${PAYMENT_STATUS_COLORS[p.status] || 'bg-muted'}`}>
                  {p.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
                  {p.status === 'pending' && <Clock className="w-3 h-3" />}
                  {p.status === 'failed' && <XCircle className="w-3 h-3" />}
                  {p.status}
                </span>
                <span className={`text-sm font-bold ${p.status === 'completed' ? 'text-success' : 'text-foreground'}`}>
                  MWK {p.amount?.toLocaleString()}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
                <span>Method: <span className="text-foreground capitalize">{p.method?.replace(/_/g,' ') || '—'}</span></span>
                <span>Date: <span className="text-foreground">{p.created_date ? format(new Date(p.created_date), 'dd MMM yy') : '—'}</span></span>
                {p.reference && <span className="col-span-2 font-mono">Ref: {p.reference}</span>}
                {p.description && <span className="col-span-2">{p.description}</span>}
                {p.nudge_count > 0 && <span className="col-span-2">Nudges sent: {p.nudge_count}</span>}
                {p.notes && <span className="col-span-2 italic">Note: {p.notes}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Live "nudged X ago" badge ─────────────────────────────────────────────────
function NudgeBadge({ ts, count }) {
  const [label, setLabel] = React.useState('');
  React.useEffect(() => {
    function update() {
      const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
      if (diff < 60)        setLabel(`${diff}s ago`);
      else if (diff < 3600) setLabel(`${Math.floor(diff/60)}m ago`);
      else if (diff < 86400) setLabel(`${Math.floor(diff/3600)}h ago`);
      else                  setLabel(`${Math.floor(diff/86400)}d ago`);
    }
    update();
    const t = setInterval(update, 10000);
    return () => clearInterval(t);
  }, [ts]);
  return (
    <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full whitespace-nowrap" title={`Last nudged: ${new Date(ts).toLocaleString()}`}>
      nudged {label}{count > 1 ? ` ×${count}` : ''}
    </span>
  );
}

// ── Prefilled nudge openers ───────────────────────────────────────────────────
function buildNudgeMessage(name, amount) {
  const firstName = (name || 'Student').split(' ')[0];
  const amt = amount ? `MWK ${Number(amount).toLocaleString()}` : '';
  return `Hi ${firstName}, your Chibondo Academy MSCE school fees${amt ? ` of ${amt}` : ''} are still pending. Please complete your payment to unlock full access to your lessons and past papers: https://chibondoacademy.com/fees`;
}

export default function AdminSubscriptions() {
  const queryClient = useQueryClient();
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPlan, setFilterPlan]     = useState('all');
  const [filterClass, setFilterClass]   = useState('all');
  const [filterPayStatus, setFilterPayStatus] = useState('all');
  const [grantOpen, setGrantOpen]       = useState(false);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [sendingRecovery, setSendingRecovery] = useState(null);
  const [nudgingAll, setNudgingAll]     = useState(false);
  const [historyStudent, setHistoryStudent] = useState(null); // { id, name }
  const [grantStudentEmail, setGrantStudentEmail] = useState('');
  const [grantPlan, setGrantPlan]       = useState('monthly');
  const [grantMonths, setGrantMonths]   = useState(1);
  const [selectedSub, setSelectedSub]   = useState(null);

  // Mark as paid form
  const [mpEmail, setMpEmail]     = useState('');
  const [mpAmount, setMpAmount]   = useState('');
  const [mpPlan, setMpPlan]       = useState('monthly');
  const [mpMethod, setMpMethod]   = useState('bank_transfer');
  const [mpRef, setMpRef]         = useState('');
  const [mpDesc, setMpDesc]       = useState('');
  const [mpLoading, setMpLoading] = useState(false);

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ['allSubscriptions'],
    queryFn: () => db.entities.Subscription.list('-created_date', 2000),
    staleTime: 30_000,
  });
  const { data: payments = [] } = useQuery({
    queryKey: ['allPayments'],
    queryFn: () => db.entities.Payment.list('-created_date', 2000),
    staleTime: 30_000,
  });
  const { data: studentProfiles = [] } = useQuery({
    queryKey: ['allStudentProfiles'],
    queryFn: () => db.entities.StudentProfile.list('-created_date', 2000),
    staleTime: 60_000,
  });
  const { data: adminUsersResult = {} } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => db.entities.User.list('-created_date', 2000).then(users => ({ users })).catch(() => ({ users: [] })),
    staleTime: 60_000,
  });
  const users = adminUsersResult.users || [];

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => db.entities.Subscription.update(id, data),
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['allSubscriptions'] });
      toast.success('Subscription updated');
      if (variables.data?.status === 'active') {
        const sub = subscriptions.find(s => s.id === variables.id);
        if (sub?.student_id) {
          const pendingForStudent = payments.filter(p => p.student_id === sub.student_id && p.status === 'pending');
          await Promise.all(pendingForStudent.map(p => db.entities.Payment.update(p.id, { status: 'cancelled' }).catch(() => {})));
          if (pendingForStudent.length > 0) queryClient.invalidateQueries({ queryKey: ['allPayments'] });
        }
      }
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => db.entities.Subscription.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['allSubscriptions'] }); toast.success('Subscription removed'); },
  });
  const updatePaymentMutation = useMutation({
    mutationFn: ({ id, data }) => db.entities.Payment.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['allPayments'] }),
  });

  // Lookups
  const userMap    = useMemo(() => Object.fromEntries((users || []).map(u => [u.id, u])), [users]);
  const profileMap = useMemo(() => Object.fromEntries(studentProfiles.map(p => [p.user_id, p])), [studentProfiles]);

  // Grant access state
  const [grantMode, setGrantMode]             = useState('single');
  const [grantSearch, setGrantSearch]         = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [customDays, setCustomDays]           = useState('');
  const [grantDurationType, setGrantDurationType] = useState('preset');

  const computeGrantDays = () => {
    if (grantDurationType === 'custom') return Math.max(1, parseInt(customDays) || 30);
    return ({ monthly: 30, annual: 365, biannual: 730, quarterly: 90 }[grantPlan] || 30) * grantMonths;
  };

  const allGrantableUsers = useMemo(() => {
    const map = {};
    users.forEach(u => { map[u.id] = { id: u.id, email: u.email || '', full_name: u.full_name || '' }; });
    studentProfiles.forEach(p => {
      if (!map[p.user_id]) map[p.user_id] = { id: p.user_id, email: '', full_name: p.full_name || '' };
    });
    return Object.values(map).filter(u => u.email || u.full_name);
  }, [users, studentProfiles]);

  const filteredGrantUsers = allGrantableUsers.filter(u => {
    const q = grantSearch.toLowerCase();
    return !q || u.email.toLowerCase().includes(q) || u.full_name.toLowerCase().includes(q);
  });
  const toggleUserId = (id) => setSelectedUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const grantMutation = useMutation({
    mutationFn: async () => {
      const days = computeGrantDays();
      if (days < 1) throw new Error('Duration must be at least 1 day');
      let targets = [];
      if (grantMode === 'bulk') {
        if (selectedUserIds.length === 0) throw new Error('Select at least one student');
        targets = selectedUserIds.map(id => allGrantableUsers.find(u => u.id === id)).filter(Boolean);
      } else {
        const email = grantStudentEmail.trim().toLowerCase();
        if (!email) throw new Error('Enter a student email');
        targets = [{ email }];
      }
      const planLabel = grantDurationType === 'custom' ? 'custom' : grantPlan;
      const token = localStorage.getItem('aca_access_token');
      const resp = await fetch('/api/admin-grant-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          targets: targets.filter(t => t.id).map(t => ({ id: t.id, email: t.email })),
          email:   targets.length === 1 && !targets[0].id ? targets[0].email : undefined,
          plan:    planLabel, days,
        }),
      });
      const result = await resp.json();
      if (!resp.ok || !result.success) throw new Error(result.error || result.errors?.[0]?.error || 'Grant failed');
      return result.granted;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['allSubscriptions'] });
      toast.success('Access granted to ' + count + (count > 1 ? ' students' : ' student') + ' ✓');
      setGrantOpen(false); setGrantStudentEmail(''); setSelectedUserIds([]); setGrantSearch('');
      setGrantDurationType('preset'); setCustomDays('');
    },
    onError: (err) => toast.error(err.message || 'Failed to grant access'),
  });

  // Enriched subscription records
  const enriched = useMemo(() => subscriptions.map(s => {
    const userRec  = userMap[s.student_id];
    const profile  = profileMap[s.student_id];
    return {
      ...s,
      _user: userRec
        ? { ...userRec, full_name: userRec.full_name || profile?.full_name || '' }
        : profile
          ? { id: s.student_id, full_name: profile.full_name, email: '', avatar_url: profile.avatar_url }
          : null,
      _profile: profile,
    };
  }), [subscriptions, userMap, profileMap]);

  const filtered = useMemo(() => enriched.filter(s => {
    const matchStatus  = filterStatus === 'all' || s.status === filterStatus;
    const matchPlan    = filterPlan === 'all' || s.plan === filterPlan;
    const matchClass   = filterClass === 'all' || profileMap[s.student_id]?.form === filterClass;
    const matchSearch  = !search ||
      s._user?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      s._user?.email?.toLowerCase().includes(search.toLowerCase()) ||
      s.student_id?.includes(search);
    return matchStatus && matchPlan && matchClass && matchSearch;
  }), [enriched, filterStatus, filterPlan, filterClass, search, profileMap]);

  // Filtered payments
  const filteredPayments = useMemo(() => payments.filter(p => {
    const matchStatus = filterPayStatus === 'all' || p.status === filterPayStatus;
    const matchSearch = !search ||
      (p.student_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.student_email || userMap[p.student_id]?.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (profileMap[p.student_id]?.form || '').toLowerCase().includes(search.toLowerCase());
    const matchClass = filterClass === 'all' || profileMap[p.student_id]?.form === filterClass;
    return matchStatus && matchSearch && matchClass;
  }), [payments, filterPayStatus, search, filterClass, userMap, profileMap]);

  // Stats
  const totalRevenue  = payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + (p.amount || 0), 0);
  const activeCount   = subscriptions.filter(s => s.status === 'active').length;
  const expiredCount  = subscriptions.filter(s => s.status === 'expired').length;
  const pendingPayments = payments.filter(p => p.status === 'pending').length;

  const handleExtend = (sub, days) => {
    const newEnd = new Date((sub.expires_at ? new Date(sub.expires_at) : new Date()).getTime() + days * 86400000);
    updateMutation.mutate({ id: sub.id, data: { end_date: newEnd.toISOString(), status: 'active' } });
    toast.success(`Extended by ${days} days`);
  };

  // ── Send email nudge ──────────────────────────────────────────────────────
  const handleSendRecovery = async (payment) => {
    setSendingRecovery(payment.id);
    try {
      const email = payment.student_email || userMap[payment.student_id]?.email || '';
      if (!email) { toast.error('No email found for this student'); return; }
      const nudgeRes = await fetch('https://chibondoacademy.com/api/cart-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          force_student_id: payment.student_id,
          force_email: email,
          payment_id: payment.id,
          amount: payment.amount,
          description: payment.description,
          student_name: payment.student_name || userMap[payment.student_id]?.full_name || profileMap[payment.student_id]?.full_name || '',
        }),
      });
      const res = await nudgeRes.json();
      if (!nudgeRes.ok || res?.error) throw new Error(res?.error || 'Nudge failed');
      // Increment nudge_count
      updatePaymentMutation.mutate({ id: payment.id, data: { last_nudge_at: new Date().toISOString(), nudge_count: (payment.nudge_count || 0) + 1 } });
      toast.success(`Recovery email sent to ${email}`);
    } catch (e) { toast.error(e.message || 'Failed to send recovery email'); }
    finally { setSendingRecovery(null); }
  };

  // ── Nudge All ─────────────────────────────────────────────────────────────
  const handleNudgeAll = async () => {
    const pendingList = payments.filter(p => p.status === 'pending');
    if (pendingList.length === 0) { toast.info('No pending payments to nudge'); return; }
    setNudgingAll(true);
    let sent = 0, skipped = 0, failed = 0;
    for (const payment of pendingList) {
      const hasPaid = payments.some(p => p.student_id === payment.student_id && p.status === 'completed');
      if (hasPaid) { skipped++; continue; }
      const email = payment.student_email || userMap[payment.student_id]?.email || '';
      if (!email) { failed++; continue; }
      try {
        const res = await fetch('https://chibondoacademy.com/api/cart-recovery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            force_student_id: payment.student_id, force_email: email,
            payment_id: payment.id, amount: payment.amount, description: payment.description,
            student_name: payment.student_name || userMap[payment.student_id]?.full_name || '',
          }),
        });
        const data = await res.json();
        if (!res.ok || data?.error) throw new Error(data?.error);
        updatePaymentMutation.mutate({ id: payment.id, data: { last_nudge_at: new Date().toISOString(), nudge_count: (payment.nudge_count || 0) + 1 } });
        sent++;
      } catch { failed++; }
    }
    setNudgingAll(false);
    toast.success(`Nudged ${sent}${skipped ? `, skipped ${skipped} (already paid)` : ''}${failed ? `, ${failed} failed` : ''}`);
  };

  // ── Prefilled nudge openers ──────────────────────────────────────────────
  const openEmailNudge = (payment, { name, email, amount }) => {
    if (!email) { toast.error('No email address for this student'); return; }
    const subject = encodeURIComponent('Your Chibondo Academy MSCE Fees Are Pending');
    const body    = encodeURIComponent(buildNudgeMessage(name, amount) + '\n\nThank you,\nChibondo Academy Team');
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
    // Log the nudge
    updatePaymentMutation.mutate({ id: payment.id, data: { last_nudge_at: new Date().toISOString(), nudge_count: (payment.nudge_count || 0) + 1 } });
  };

  const openSmsNudge = (payment, { name, phone, amount }) => {
    if (!phone) { toast.error('No phone number for this student'); return; }
    const digits  = phone.replace(/\D/g,'');
    const msg     = encodeURIComponent(buildNudgeMessage(name, amount));
    // sms: URI — works on mobile; fallback opens compose on desktop apps
    window.open(`sms:+${digits}?body=${msg}`, '_blank');
    updatePaymentMutation.mutate({ id: payment.id, data: { last_nudge_at: new Date().toISOString(), nudge_count: (payment.nudge_count || 0) + 1 } });
  };

  const openWhatsAppNudge = (payment, { name, phone, amount }) => {
    if (!phone) { toast.error('No phone number for this student'); return; }
    const digits = phone.replace(/\D/g,'');
    // Ensure international format (strip leading 0 and prepend 265 for Malawi)
    const intl   = digits.startsWith('265') ? digits : digits.startsWith('0') ? '265' + digits.slice(1) : '265' + digits;
    const msg    = encodeURIComponent(buildNudgeMessage(name, amount));
    window.open(`https://wa.me/${intl}?text=${msg}`, '_blank');
    updatePaymentMutation.mutate({ id: payment.id, data: { last_nudge_at: new Date().toISOString(), nudge_count: (payment.nudge_count || 0) + 1 } });
  };

  // ── CSV Export ────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const headers = ['Name','Email','Phone','Class','Subjects','Amount (MWK)','Status','Method','Reference','Date','Nudge Count','Notes'];
    const rows = filteredPayments.map(p => {
      const profile = profileMap[p.student_id];
      const user    = userMap[p.student_id];
      return [
        p.student_name || profile?.full_name || user?.full_name || '',
        p.student_email || user?.email || '',
        p.student_phone || profile?.phone_number || '',
        p.student_class || profile?.form || '',
        (p.subjects_enrolled || profile?.subjects || []).join('; '),
        p.amount || 0,
        p.status || '',
        (p.method || '').replace(/_/g,' '),
        p.reference || '',
        p.created_date ? format(new Date(p.created_date), 'yyyy-MM-dd HH:mm') : '',
        p.nudge_count || 0,
        p.notes || '',
      ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `chibondo-payments-${format(new Date(),'yyyy-MM-dd')}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} payment records`);
  };

  // ── Mark as Paid ──────────────────────────────────────────────────────────
  const handleMarkPaid = async () => {
    if (!mpEmail || !mpAmount) { toast.error('Email and amount are required'); return; }
    setMpLoading(true);
    try {
      const token = localStorage.getItem('aca_access_token');
      const days  = { monthly: 30, quarterly: 90, annual: 365, biannual: 730 }[mpPlan] || 30;
      const resp  = await fetch('/api/admin-grant-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ email: mpEmail.trim(), plan: mpPlan, days }),
      });
      const result = await resp.json();
      if (!resp.ok || !result.success) throw new Error(result.error || 'Failed to activate');
      // Also create a Payment record for record-keeping
      const matchUser = users.find(u => u.email?.toLowerCase() === mpEmail.trim().toLowerCase());
      if (matchUser) {
        await db.entities.Payment.create({
          student_id:    matchUser.id,
          student_name:  matchUser.full_name || '',
          student_email: matchUser.email || '',
          student_phone: profileMap[matchUser.id]?.phone_number || '',
          student_class: profileMap[matchUser.id]?.form || '',
          subjects_enrolled: profileMap[matchUser.id]?.subjects || [],
          amount:  parseFloat(mpAmount),
          status:  'completed',
          method:  mpMethod,
          reference: mpRef || `MANUAL-${Date.now()}`,
          description: mpDesc || `Manual ${mpPlan} payment entered by admin`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['allSubscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['allPayments'] });
      toast.success(`✓ Access granted & payment recorded for ${mpEmail}`);
      setMarkPaidOpen(false);
      setMpEmail(''); setMpAmount(''); setMpRef(''); setMpDesc('');
    } catch (e) { toast.error(e.message || 'Failed'); }
    finally { setMpLoading(false); }
  };

  const unpaidPendingCount = payments.filter(p =>
    p.status === 'pending' && !payments.some(pp => pp.student_id === p.student_id && pp.status === 'completed')
  ).length;

  return (
    <div className="space-y-6">
      {/* History panel */}
      {historyStudent && (
        <StudentHistoryPanel
          studentId={historyStudent.id}
          studentName={historyStudent.name}
          payments={payments}
          onClose={() => setHistoryStudent(null)}
        />
      )}

      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-display font-bold leading-tight">School Fees &amp; Subscriptions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage student fee payments and access</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button size="sm" variant="outline" className="h-8 px-3 text-xs gap-1.5"
            onClick={async () => {
              const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
              const stale  = subscriptions.filter(s => ['trial','cancelled'].includes(s.status) && s.created_date < cutoff);
              if (stale.length === 0) { toast.info('No stale records to clean'); return; }
              await Promise.all(stale.map(s => db.entities.Subscription.delete(s.id)));
              queryClient.invalidateQueries({ queryKey: ['allSubscriptions'] });
              toast.success(`Cleaned ${stale.length} stale record(s)`);
            }}>
            <RefreshCw className="w-3.5 h-3.5" /> Clean Stale
          </Button>
          <Button size="sm" variant="outline" className="h-8 px-3 text-xs gap-1.5 border-success/40 text-success hover:bg-success/10"
            onClick={() => setMarkPaidOpen(true)}>
            <CheckCircle2 className="w-3.5 h-3.5" /> Mark as Paid
          </Button>
          <Button size="sm" className="h-8 px-3 text-xs gap-1.5" onClick={() => setGrantOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> Grant Access
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}       label="Active Students"   value={activeCount}                      sub={`${expiredCount} expired`}              color="bg-success/10 text-success" />
        <StatCard icon={Banknote}    label="Total Revenue"     value={`MWK ${(totalRevenue/1000).toFixed(0)}k`} sub="completed payments"            color="bg-primary/10 text-primary" />
        <StatCard icon={Clock}       label="Pending Payments"  value={pendingPayments}                  sub={`${unpaidPendingCount} not yet paid`}   color="bg-accent/10 text-accent" />
        <StatCard icon={CreditCard}  label="Total Payments"    value={payments.length}                  sub={`${payments.filter(p=>p.status==='completed').length} completed`} color="bg-muted text-muted-foreground" />
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Search name, email…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="h-9 w-32 text-xs"><SelectValue placeholder="All Classes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {['Form 1','Form 2','Form 3','Form 4'].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="subscriptions">
        <TabsList className="h-9">
          <TabsTrigger value="subscriptions" className="text-xs">Subscriptions ({subscriptions.length})</TabsTrigger>
          <TabsTrigger value="payments" className="text-xs">Payments ({payments.length})</TabsTrigger>
        </TabsList>

        {/* SUBSCRIPTIONS TAB */}
        <TabsContent value="subscriptions" className="mt-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['all','active','expired','pending','cancelled'].map(s => (
                  <SelectItem key={s} value={s} className="text-xs capitalize">{s === 'all' ? 'All Status' : STATUS_LABELS[s] || s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPlan} onValueChange={setFilterPlan}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['all','monthly','quarterly','annual','biannual'].map(p => (
                  <SelectItem key={p} value={p} className="text-xs capitalize">{p === 'all' ? 'All Plans' : p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            {isLoading && <div className="text-center py-10 text-muted-foreground text-sm"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />Loading…</div>}
            {!isLoading && filtered.length === 0 && <div className="text-center py-10 text-muted-foreground text-sm">No subscriptions found</div>}
            {filtered.map(s => {
              const profile = profileMap[s.student_id];
              const phone   = profile?.phone_number;
              const form    = profile?.form;
              const subjects = profile?.subjects || [];
              return (
                <div key={s.id} className="bg-card border border-border rounded-2xl p-4 hover:border-accent/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          className="font-semibold text-sm hover:text-accent transition-colors text-left"
                          onClick={() => setHistoryStudent({ id: s.student_id, name: s._user?.full_name || 'Unknown' })}
                        >
                          {s._user?.full_name || 'Unknown Student'}
                        </button>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[s.status] || STATUS_COLORS.cancelled}`}>
                          {STATUS_LABELS[s.status] || s.status}
                        </span>
                        {s.plan && <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium capitalize ${PLAN_COLORS[s.plan] || PLAN_COLORS.free}`}>{s.plan}</span>}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
                        {s._user?.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{s._user.email}</span>}
                        {phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{phone}</span>}
                        {form && <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3" />{form}</span>}
                        {s.end_date && <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />Expires {format(new Date(s.end_date), 'dd MMM yyyy')}</span>}
                      </div>
                      {subjects.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {subjects.slice(0,4).map(sub => <span key={sub} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{sub}</span>)}
                          {subjects.length > 4 && <span className="text-[10px] text-muted-foreground">+{subjects.length - 4} more</span>}
                        </div>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreVertical className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-xs">
                        <DropdownMenuItem onClick={() => setSelectedSub(s)}>View Details</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setHistoryStudent({ id: s.student_id, name: s._user?.full_name || 'Unknown' })}>
                          <History className="w-3.5 h-3.5 mr-2" /> Payment History
                        </DropdownMenuItem>
                        {s.status !== 'active' && <DropdownMenuItem onClick={() => updateMutation.mutate({ id: s.id, data: { status: 'active' } })}>Activate</DropdownMenuItem>}
                        {s.status === 'active'  && <DropdownMenuItem onClick={() => updateMutation.mutate({ id: s.id, data: { status: 'cancelled' } })}>Cancel</DropdownMenuItem>}
                        <DropdownMenuItem onClick={() => handleExtend(s, 30)}>+30 Days</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExtend(s, 365)}>+1 Year</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(s.id)}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* PAYMENTS TAB */}
        <TabsContent value="payments" className="mt-5">
          {/* Filter + action bar */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Select value={filterPayStatus} onValueChange={setFilterPayStatus}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['all','pending','completed','failed','refunded','cancelled'].map(s => (
                  <SelectItem key={s} value={s} className="text-xs capitalize">{s === 'all' ? 'All Status' : s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground flex-1">{filteredPayments.length} record{filteredPayments.length !== 1 ? 's' : ''}</span>
            <Button size="sm" variant="outline" className="h-8 px-3 text-xs gap-1.5" onClick={handleExportCSV}>
              <Download className="w-3 h-3" /> Export CSV
            </Button>
            <Button size="sm" variant="outline" className="h-8 px-3 text-xs gap-1.5 border-accent/40 text-accent hover:bg-accent/10"
              onClick={handleNudgeAll} disabled={nudgingAll || unpaidPendingCount === 0}>
              {nudgingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              {nudgingAll ? 'Sending…' : `Nudge All (${unpaidPendingCount})`}
            </Button>
          </div>

          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Student</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Contact</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">Class / Subjects</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">Method / Ref</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">Date</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Amount</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredPayments.map(p => {
                    const profile  = profileMap[p.student_id];
                    const user     = userMap[p.student_id];
                    const name     = p.student_name || profile?.full_name || user?.full_name || 'Unknown';
                    const email    = p.student_email || user?.email || '';
                    const phone    = p.student_phone || profile?.phone_number || '';
                    const form     = p.student_class || profile?.form || '';
                    const subjects = p.subjects_enrolled || profile?.subjects || [];
                    const hasPaid  = payments.some(pp => pp.student_id === p.student_id && pp.status === 'completed');

                    return (
                      <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                        {/* Student */}
                        <td className="px-4 py-3">
                          <button className="text-sm font-medium hover:text-accent transition-colors text-left"
                            onClick={() => setHistoryStudent({ id: p.student_id, name })}>
                            {name}
                          </button>
                          {p.nudge_count > 0 && (
                            <span className="ml-2 text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">
                              {p.nudge_count} nudge{p.nudge_count > 1 ? 's' : ''}
                            </span>
                          )}
                        </td>
                        {/* Contact */}
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div className="space-y-0.5">
                            {email && <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{email}</p>}
                            {phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{phone}</p>}
                          </div>
                        </td>
                        {/* Class / Subjects */}
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="space-y-1">
                            {form && <p className="text-xs font-medium flex items-center gap-1"><GraduationCap className="w-3 h-3" />{form}</p>}
                            {subjects.length > 0 && (
                              <div className="flex flex-wrap gap-0.5">
                                {subjects.slice(0,2).map(s => <span key={s} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{s}</span>)}
                                {subjects.length > 2 && <span className="text-[10px] text-muted-foreground">+{subjects.length-2}</span>}
                              </div>
                            )}
                          </div>
                        </td>
                        {/* Status */}
                        <td className="px-4 py-3">
                          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${PAYMENT_STATUS_COLORS[p.status] || 'bg-muted'}`}>
                            {p.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
                            {p.status === 'pending'   && <Clock className="w-3 h-3" />}
                            {p.status === 'failed'    && <XCircle className="w-3 h-3" />}
                            {p.status}
                          </div>
                        </td>
                        {/* Method/Ref */}
                        <td className="px-4 py-3 hidden md:table-cell">
                          <p className="text-xs capitalize">{p.method?.replace(/_/g,' ') || '—'}</p>
                          {p.reference && <p className="text-[10px] font-mono text-muted-foreground">{p.reference}</p>}
                        </td>
                        {/* Date */}
                        <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                          {p.created_date ? format(new Date(p.created_date), 'MMM d, yyyy HH:mm') : '—'}
                          {p.last_nudge_at && <p className="text-[10px] opacity-60">Last nudge: {format(new Date(p.last_nudge_at), 'MMM d')}</p>}
                        </td>
                        {/* Amount */}
                        <td className="px-4 py-3 text-right">
                          <span className={`text-sm font-bold ${p.status === 'completed' ? 'text-success' : 'text-foreground'}`}>
                            MWK {p.amount?.toLocaleString()}
                          </span>
                        </td>
                        {/* Actions */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            {/* Nudge timestamp badge */}
                            {p.last_nudge_at && (
                              <NudgeBadge ts={p.last_nudge_at} count={p.nudge_count} />
                            )}
                            {/* Admin notes popover */}
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className={`p-1 rounded hover:bg-muted transition-colors ${p.notes ? 'text-accent' : 'text-muted-foreground'}`} title="Notes">
                                  <StickyNote className="w-3.5 h-3.5" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 p-3" align="end">
                                <p className="text-xs font-semibold mb-2">Admin Note</p>
                                <Textarea
                                  className="text-xs h-20 resize-none"
                                  defaultValue={p.notes || ''}
                                  placeholder="Add a note…"
                                  onBlur={e => {
                                    if (e.target.value !== (p.notes || ''))
                                      updatePaymentMutation.mutate({ id: p.id, data: { notes: e.target.value } });
                                  }}
                                />
                              </PopoverContent>
                            </Popover>
                            {p.status === 'pending' && !hasPaid && (
                              <>
                                {/* Email — opens prefilled mailto */}
                                <Button size="sm" variant="outline"
                                  className="h-7 text-[11px] gap-1 border-accent/40 text-accent hover:bg-accent/10 px-2"
                                  onClick={() => openEmailNudge(p, { name, email, amount: p.amount })}
                                  title={email ? 'Open prefilled email' : 'No email on file'}>
                                  <Mail className="w-3 h-3" /> Email
                                </Button>
                                {/* SMS — opens prefilled SMS */}
                                <Button size="sm" variant="outline"
                                  className="h-7 text-[11px] gap-1 border-blue-500/40 text-blue-500 hover:bg-blue-500/10 px-2"
                                  onClick={() => openSmsNudge(p, { name, phone, amount: p.amount })}
                                  title={phone ? 'Open prefilled SMS' : 'No phone number on file'}
                                  disabled={!phone}>
                                  <Smartphone className="w-3 h-3" /> SMS
                                </Button>
                                {/* WhatsApp — opens prefilled wa.me */}
                                <Button size="sm" variant="outline"
                                  className="h-7 text-[11px] gap-1 border-green-500/40 text-green-600 hover:bg-green-500/10 px-2"
                                  onClick={() => openWhatsAppNudge(p, { name, phone, amount: p.amount })}
                                  title={phone ? 'Open WhatsApp message' : 'No phone number on file'}
                                  disabled={!phone}>
                                  <MessageSquare className="w-3 h-3" /> WA
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredPayments.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-10 text-muted-foreground text-sm">No payment records match your filters</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Subscription detail side panel — beautiful redesign ── */}
      {selectedSub && (() => {
        const s = selectedSub;
        const profile = profileMap[s.student_id];
        const daysLeft = s.expires_at
          ? Math.ceil((new Date(s.expires_at) - new Date()) / 86400000)
          : s.end_date
          ? Math.ceil((new Date(s.end_date) - new Date()) / 86400000)
          : null;
        const startDate = s.start_date;
        const endDate   = s.expires_at || s.end_date;
        const duration  = startDate && endDate
          ? Math.ceil((new Date(endDate) - new Date(startDate)) / 86400000)
          : null;
        const name     = s._user?.full_name || s.student_name || 'Unknown';
        const email    = s._user?.email || '—';
        const phone    = profile?.phone_number || '—';
        const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
        const isActive = s.status === 'active';
        const isExpired = daysLeft !== null && daysLeft <= 0;
        const isWarn    = daysLeft !== null && daysLeft > 0 && daysLeft <= 4;

        return (
          <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelectedSub(null)}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div
              className="relative bg-background w-full max-w-sm h-full overflow-y-auto shadow-2xl flex flex-col" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
              style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Sticky drawer top bar — sits above hero, prevents clip under app TopBar */}
              <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-background/95 backdrop-blur-sm border-b border-border">
                <p className="text-sm font-semibold text-foreground truncate max-w-[220px]">
                  {s._user?.full_name || 'Student'}
                </p>
                <button
                  onClick={() => setSelectedSub(null)}
                  className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Hero header */}
              <div className={`relative px-5 pt-6 pb-6 border-b ${
                isActive  ? 'bg-gradient-to-br from-emerald-500/10 via-card to-card border-emerald-400/20' :
                isExpired ? 'bg-gradient-to-br from-destructive/10 via-card to-card border-destructive/20' :
                            'bg-gradient-to-br from-amber-500/10 via-card to-card border-amber-400/20'
              }`}>
                {/* Avatar + name */}
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="w-16 h-16 rounded-2xl bg-primary/15 border-2 border-primary/25 flex items-center justify-center text-2xl font-bold text-primary shadow-lg">
                    {initials}
                  </div>
                  <div>
                    <h2 className="font-bold text-lg leading-tight tracking-tight">{name}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">{email}</p>
                  </div>

                  {/* Status badges */}
                  <div className="flex items-center gap-2 mt-1 flex-wrap justify-center">
                    <Badge className={`capitalize text-xs font-semibold px-3 py-0.5 ${STATUS_COLORS[s.status] || 'bg-muted'}`}>
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block mr-1.5 animate-pulse" />}
                      {STATUS_LABELS[s.status] || s.status}
                    </Badge>
                    <Badge className={`capitalize text-xs font-semibold px-3 py-0.5 ${PLAN_COLORS[s.plan] || 'bg-muted'}`}>
                      {s.plan}
                    </Badge>
                  </div>

                  {/* Days pill */}
                  {daysLeft !== null && (
                    <span className={`mt-1 text-xs font-semibold px-4 py-1.5 rounded-full ${
                      isExpired ? 'bg-destructive/15 text-destructive' :
                      isWarn    ? 'bg-amber-500/15 text-amber-600' :
                                  'bg-emerald-500/10 text-emerald-600'
                    }`}>
                      {isExpired
                        ? `Expired ${Math.abs(daysLeft)}d ago`
                        : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 p-4 space-y-4 pb-24">

                {/* Contact card */}
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="px-4 py-2 border-b border-border bg-muted/40">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Contact</p>
                  </div>
                  <div className="divide-y divide-border/60">
                    {[
                      { icon: Mail,   label: 'Email', value: email },
                      { icon: Phone,  label: 'Phone', value: phone },
                      { icon: School, label: 'Class', value: profile?.form ? `Form ${profile.form}` : '—' },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-center gap-3 px-4 py-3">
                        <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide leading-none mb-0.5">{label}</p>
                          <p className="text-sm font-medium truncate">{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Subscription timeline */}
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="px-4 py-2 border-b border-border bg-muted/40">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Subscription Period</p>
                  </div>
                  <div className="px-4 py-4 flex items-center gap-2">
                    {/* Start box */}
                    <div className="flex-1 text-center bg-muted/40 rounded-xl p-3">
                      <p className="text-[10px] text-muted-foreground mb-1">Started</p>
                      <p className="text-base font-bold leading-tight">
                        {startDate ? format(new Date(startDate), 'dd MMM') : '—'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {startDate ? format(new Date(startDate), 'yyyy') : ''}
                      </p>
                    </div>
                    {/* connector */}
                    <div className="flex flex-col items-center gap-1 flex-shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-border" />
                      <div className="w-px h-4 bg-border" />
                      {duration && <p className="text-[9px] text-muted-foreground">{duration}d</p>}
                      <div className="w-px h-4 bg-border" />
                      <div className={`w-1.5 h-1.5 rounded-full ${isExpired ? 'bg-destructive' : isWarn ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    </div>
                    {/* End box */}
                    <div className={`flex-1 text-center rounded-xl p-3 ${isExpired ? 'bg-destructive/10' : isWarn ? 'bg-amber-500/10' : 'bg-muted/40'}`}>
                      <p className="text-[10px] text-muted-foreground mb-1">Expires</p>
                      <p className={`text-base font-bold leading-tight ${isExpired ? 'text-destructive' : isWarn ? 'text-amber-600' : ''}`}>
                        {endDate ? format(new Date(endDate), 'dd MMM') : '—'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {endDate ? format(new Date(endDate), 'yyyy') : ''}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Enrolled subjects */}
                {profile?.subjects?.length > 0 && (
                  <div className="rounded-2xl border border-border bg-card overflow-hidden">
                    <div className="px-4 py-2 border-b border-border bg-muted/40">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Subjects</p>
                    </div>
                    <div className="px-4 py-3 flex flex-wrap gap-1.5">
                      {profile.subjects.map(sub => (
                        <span key={sub} className="text-xs bg-primary/8 text-primary border border-primary/15 px-2.5 py-1 rounded-full font-medium">{sub}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="space-y-2 pb-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-0.5">Actions</p>

                  {/* Top row: Cancel/Activate + Extend */}
                  <div className="grid grid-cols-3 gap-2">
                    {s.status !== 'active' ? (
                      <Button size="sm"
                        className="h-14 flex-col gap-1 text-[11px] font-semibold rounded-xl"
                        onClick={() => { updateMutation.mutate({ id: s.id, data: { status: 'active' } }); setSelectedSub(null); }}>
                        <CheckCircle2 className="w-4 h-4" />
                        Activate
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline"
                        className="h-14 flex-col gap-1 text-[11px] rounded-xl border-muted-foreground/20"
                        onClick={() => { updateMutation.mutate({ id: s.id, data: { status: 'cancelled' } }); setSelectedSub(null); }}>
                        <XCircle className="w-4 h-4 text-muted-foreground" />
                        Cancel
                      </Button>
                    )}
                    <Button size="sm" variant="outline"
                      className="h-14 flex-col gap-1 text-[11px] rounded-xl border-primary/20 text-primary hover:bg-primary/5"
                      onClick={() => { handleExtend(s, 30); setSelectedSub(null); }}>
                      <RefreshCw className="w-4 h-4" />
                      +30d
                    </Button>
                    <Button size="sm" variant="outline"
                      className="h-14 flex-col gap-1 text-[11px] rounded-xl border-primary/20 text-primary hover:bg-primary/5"
                      onClick={() => { handleExtend(s, 365); setSelectedSub(null); }}>
                      <RefreshCw className="w-4 h-4" />
                      +1yr
                    </Button>
                  </div>

                  {/* Bottom row: History + Delete */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant="outline"
                      className="h-12 flex-col gap-1 text-[11px] rounded-xl border-border"
                      onClick={() => { setHistoryStudent({ id: s.student_id, name: s._user?.full_name || 'Unknown' }); setSelectedSub(null); }}>
                      <History className="w-4 h-4 text-muted-foreground" />
                      History
                    </Button>
                    <Button size="sm" variant="outline"
                      className="h-12 flex-col gap-1 text-[11px] rounded-xl border-destructive/30 text-destructive hover:bg-destructive/5"
                      onClick={() => { deleteMutation.mutate(s.id); setSelectedSub(null); }}>
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </Button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        );
      })()}

      {/* Mark as Paid Dialog */}
      <Dialog open={markPaidOpen} onOpenChange={setMarkPaidOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" /> Manual Payment Entry</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Student Email *</Label>
              <Input value={mpEmail} onChange={e => setMpEmail(e.target.value)} placeholder="student@email.com" type="email" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Amount (MWK) *</Label>
                <Input value={mpAmount} onChange={e => setMpAmount(e.target.value)} placeholder="10000" type="number" /></div>
              <div className="space-y-1"><Label className="text-xs">Plan</Label>
                <Select value={mpPlan} onValueChange={setMpPlan}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['monthly','quarterly','annual','biannual'].map(p => <SelectItem key={p} value={p} className="text-xs capitalize">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Payment Method</Label>
              <Select value={mpMethod} onValueChange={setMpMethod}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[['airtel_money','Airtel Money'],['tnm_mpamba','TNM Mpamba'],['bank_transfer','Bank Transfer'],['paychangu','PayChangu']].map(([v,l]) => <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Reference</Label>
              <Input value={mpRef} onChange={e => setMpRef(e.target.value)} placeholder="Transaction reference (optional)" /></div>
            <div className="space-y-1"><Label className="text-xs">Notes</Label>
              <Input value={mpDesc} onChange={e => setMpDesc(e.target.value)} placeholder="e.g. Cash payment received at office" /></div>
            <Button className="w-full gap-2" onClick={handleMarkPaid} disabled={mpLoading}>
              {mpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {mpLoading ? 'Processing…' : 'Grant Access & Record Payment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Grant Access Dialog */}
      <Dialog open={grantOpen} onOpenChange={(v) => {
        setGrantOpen(v);
        if (!v) { setSelectedUserIds([]); setGrantSearch(''); setGrantMode('single'); setGrantDurationType('preset'); setCustomDays(''); }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col gap-4">
          <DialogHeader><DialogTitle>Grant Free Access</DialogTitle></DialogHeader>
          <div className="flex gap-1 bg-muted/50 p-1 rounded-xl">
            <button onClick={() => setGrantMode('single')} className={"flex-1 text-xs font-medium py-1.5 rounded-lg transition-all " + (grantMode === 'single' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground')}>Single Student</button>
            <button onClick={() => setGrantMode('bulk')}   className={"flex-1 text-xs font-medium py-1.5 rounded-lg transition-all " + (grantMode === 'bulk'   ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground')}>Bulk / All Students</button>
          </div>
          {grantMode === 'single' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Student Email</Label>
              <Input value={grantStudentEmail} onChange={e => setGrantStudentEmail(e.target.value)} placeholder="student@example.com" type="email" />
            </div>
          )}
          {grantMode === 'bulk' && (
            <div className="space-y-2 flex flex-col" style={{ minHeight: 0 }}>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Select Students</Label>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedUserIds(filteredGrantUsers.map(u => u.id))} className="text-xs text-primary hover:underline">All</button>
                  <button onClick={() => setSelectedUserIds([])} className="text-xs text-muted-foreground hover:underline">None</button>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Search name or email" value={grantSearch} onChange={e => setGrantSearch(e.target.value)} className="pl-8 h-8 text-xs" />
              </div>
              <div className="border border-border rounded-xl overflow-y-auto divide-y divide-border/50" style={{ maxHeight: '180px' }}>
                {filteredGrantUsers.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No students found</p>}
                {filteredGrantUsers.map(u => (
                  <label key={u.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors">
                    <input type="checkbox" checked={selectedUserIds.includes(u.id)} onChange={() => toggleUserId(u.id)} className="w-4 h-4 accent-primary rounded" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.full_name || '—'}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                    </div>
                  </label>
                ))}
              </div>
              {selectedUserIds.length > 0 && <p className="text-xs text-primary font-medium">{selectedUserIds.length} student{selectedUserIds.length > 1 ? 's' : ''} selected</p>}
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Duration</Label>
            <div className="flex gap-1 bg-muted/50 p-1 rounded-xl">
              <button onClick={() => setGrantDurationType('preset')} className={"flex-1 text-xs font-medium py-1.5 rounded-lg transition-all " + (grantDurationType === 'preset' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground')}>Preset Plan</button>
              <button onClick={() => setGrantDurationType('custom')} className={"flex-1 text-xs font-medium py-1.5 rounded-lg transition-all " + (grantDurationType === 'custom' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground')}>Custom Days</button>
            </div>
            {grantDurationType === 'preset' ? (
              <div className="grid grid-cols-2 gap-2">
                <Select value={grantPlan} onValueChange={setGrantPlan}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{['monthly','quarterly','annual','biannual'].map(p => <SelectItem key={p} value={p} className="text-xs capitalize">{p}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={String(grantMonths)} onValueChange={v => setGrantMonths(Number(v))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{[1,2,3,6,12].map(n => <SelectItem key={n} value={String(n)} className="text-xs">×{n} ({computeGrantDays()} days)</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : (
              <Input value={customDays} onChange={e => setCustomDays(e.target.value)} placeholder="e.g. 45" type="number" className="h-9 text-xs" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">Granting <strong>{computeGrantDays()} days</strong> of access{grantMode === 'bulk' && selectedUserIds.length > 0 ? ` to ${selectedUserIds.length} student${selectedUserIds.length > 1 ? 's' : ''}` : ''}</p>
          <Button onClick={() => grantMutation.mutate()} disabled={grantMutation.isPending} className="gap-2">
            {grantMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {grantMutation.isPending ? 'Granting…' : 'Grant Access'}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
