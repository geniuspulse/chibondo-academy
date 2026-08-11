import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import {
  Users, BookOpen, TrendingUp, CreditCard, GraduationCap,
  Gift, AlertCircle, CheckCircle2, Clock, Layers,
  UserCheck, ArrowRight, ArrowUpRight, DollarSign, Loader2, Video
} from 'lucide-react';

const TIME_FILTERS = [
  { key: 'today',   label: 'Today' },
  { key: 'week',    label: 'This Week' },
  { key: 'month',   label: 'This Month' },
  { key: '6months', label: '6 Months' },
  { key: 'year',    label: '1 Year' },
  { key: 'all',     label: 'All Time' },
];

function getStartDate(key) {
  const now = new Date();
  switch (key) {
    case 'today':    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'week':   { const d = new Date(now); d.setDate(now.getDate() - 7); return d; }
    case 'month':  { const d = new Date(now); d.setMonth(now.getMonth() - 1); return d; }
    case '6months':{ const d = new Date(now); d.setMonth(now.getMonth() - 6); return d; }
    case 'year':   { const d = new Date(now); d.setFullYear(now.getFullYear() - 1); return d; }
    default: return null;
  }
}

function inRange(dateStr, startDate) {
  if (!startDate) return true;
  return new Date(dateStr) >= startDate;
}

function StatCard({ label, value, sub, icon: Icon, gradient, to, loading }) {
  const content = (
    <div className={`relative overflow-hidden rounded-2xl p-5 ${gradient} group transition-all duration-200 hover:scale-[1.01] hover:shadow-xl`}>
      <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-card/5 pointer-events-none" />
      <div className="absolute -right-2 -bottom-6 w-16 h-16 rounded-full bg-card/5 pointer-events-none" />
      <div className="relative z-10 flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl bg-card/15 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-white" />
        </div>
        {to && <ArrowUpRight className="w-4 h-4 text-white/40 group-hover:text-white/80 transition-colors" />}
      </div>
      <div className="relative z-10 mt-4">
        {loading
          ? <Loader2 className="w-6 h-6 text-white/50 animate-spin" />
          : <p className="text-3xl font-heading font-bold text-white leading-none">{value}</p>
        }
        <p className="text-sm font-semibold text-white/80 mt-1">{label}</p>
        {sub && <p className="text-xs text-white/50 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

export default function AdminDashboard() {
  const [timePeriod, setTimePeriod] = useState('month');

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => db.auth.me(),
    staleTime: 300_000,
  });

  // ── Direct entity queries — bypass backend function entirely ─────────────────
  // Use getAdminUsers (asServiceRole) with direct-entity fallback
  const { data: adminUsersData = {}, isLoading: loadingUsers } = useQuery({
    queryKey: ['dash_users'],
    queryFn: async () => {
      try {
        // db.functions.invoke removed — use direct entity queries below
      } catch (_) {}
      // Fallback: direct entity query (works now that User read RLS is open)
      const users = await db.entities.User.list('-created_date', 2000);
      return { users, total: users.length };
    },
    staleTime: 60_000,
    retry: 1,
  });
  const allUsers = adminUsersData.users || [];

  const { data: allSubscriptions = [], isLoading: loadingSubs } = useQuery({
    queryKey: ['dash_subs'],
    queryFn: () => db.entities.Subscription.list('-created_date', 2000),
    staleTime: 60_000,
  });

  const { data: allPayments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['dash_payments'],
    queryFn: () => db.entities.Payment.list('-created_date', 2000),
    staleTime: 60_000,
  });

  const { data: allEnrollments = [], isLoading: loadingEnrollments } = useQuery({
    queryKey: ['dash_enrollments'],
    queryFn: () => db.entities.Enrollment.list('-created_date', 5000),
    staleTime: 60_000,
  });

  const { data: allReferrals = [] } = useQuery({
    queryKey: ['dash_referrals'],
    queryFn: () => db.entities.Referral.list('-created_date', 2000),
    staleTime: 60_000,
  });

  const { data: allSubjects = [] } = useQuery({
    queryKey: ['dash_subjects'],
    queryFn: () => db.entities.Subject.list('order', 500),
    staleTime: 300_000,
  });

  const { data: allLessons = [] } = useQuery({
    queryKey: ['dash_lessons'],
    queryFn: () => db.entities.Lesson.list('order', 5000),
    staleTime: 300_000,
  });

  const { data: allApplications = [] } = useQuery({
    queryKey: ['dash_applications'],
    queryFn: () => db.entities.TeacherApplication.list('-created_date', 200),
    staleTime: 60_000,
  });

  const isLoading = loadingUsers || loadingSubs || loadingPayments;

  // ── Derived data ─────────────────────────────────────────────────────────────
  const allStudents = useMemo(() => allUsers.filter(u => u.role === 'user' || !u.role), [allUsers]);
  const allTeachers = useMemo(() => allUsers.filter(u => u.role === 'teacher'), [allUsers]);

  const startDate = useMemo(() => getStartDate(timePeriod), [timePeriod]);

  const filteredPayments    = useMemo(() => allPayments.filter(p => inRange(p.created_date, startDate)), [allPayments, startDate]);
  const filteredEnrollments = useMemo(() => allEnrollments.filter(e => inRange(e.created_date, startDate)), [allEnrollments, startDate]);
  const filteredNewStudents = useMemo(() => allStudents.filter(s => inRange(s.created_date, startDate)), [allStudents, startDate]);
  const filteredNewSubs     = useMemo(() => allSubscriptions.filter(s => inRange(s.created_date, startDate)), [allSubscriptions, startDate]);
  const filteredReferrals   = useMemo(() => allReferrals.filter(r => inRange(r.created_date, startDate)), [allReferrals, startDate]);

  // Revenue — completed payments in selected period
  const confirmedRevenue = filteredPayments
    .filter(p => p.status === 'completed')
    .reduce((s, p) => s + (p.amount || 0), 0);
  const pendingRevenue = filteredPayments
    .filter(p => p.status === 'pending')
    .reduce((s, p) => s + (p.amount || 0), 0);

  // Active subs = current state (not time-filtered)
  const activeSubscriptions = allSubscriptions.filter(s => s.status === 'active').length;

  const pendingApps = allApplications.filter(a => a.status === 'pending').length;

  const avgProgress = allEnrollments.length > 0
    ? Math.round(allEnrollments.reduce((s, e) => s + (e.progress_percentage || 0), 0) / allEnrollments.length)
    : 0;

  const totalAffiliates = new Set(filteredReferrals.map(r => r.referrer_id)).size;

  const recentPayments = [...filteredPayments]
    .filter(p => p.status === 'completed')
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    .slice(0, 5);

  const periodLabel = TIME_FILTERS.find(f => f.key === timePeriod)?.label || '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Welcome back, {currentUser?.full_name?.split(' ')[0] || 'Admin'} · {new Date().toLocaleDateString('en-MW', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-1 flex-wrap bg-muted/50 rounded-xl p-1">
          {TIME_FILTERS.map(f => (
            <button key={f.key} onClick={() => setTimePeriod(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                timePeriod === f.key ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pending apps alert */}
      {pendingApps > 0 && (
        <Link to="/admin/teachers">
          <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-sm hover:bg-yellow-500/15 transition-colors">
            <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
            <span className="flex-1 text-yellow-800 dark:text-yellow-400">
              <strong>{pendingApps}</strong> tutor application{pendingApps !== 1 ? 's' : ''} awaiting review
            </span>
            <ArrowRight className="w-4 h-4 text-yellow-600" />
          </div>
        </Link>
      )}

      <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
        Showing data for: {periodLabel}
      </p>

      {/* Revenue hero */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a2a4a] via-[#1e3260] to-[#243878] p-6 text-white">
          <div className="absolute -right-6 -top-6 w-36 h-36 rounded-full bg-card/5 pointer-events-none" />
          <div className="absolute right-10 bottom-0 w-20 h-20 rounded-full bg-card/5 pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-card/15 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <Link to="/admin/subscriptions" className="flex items-center gap-1 text-xs text-white/60 hover:text-white/90 transition-colors">
                View all <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            {loadingPayments
              ? <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
              : <>
                  <p className="text-4xl font-heading font-bold tracking-tight">MWK {confirmedRevenue.toLocaleString()}</p>
                  <p className="text-sm font-semibold text-white/70 mt-1">Confirmed Revenue</p>
                  <p className="text-xs text-white/40 mt-0.5">
                    From {filteredPayments.filter(p => p.status === 'completed').length} completed payments
                  </p>
                  {pendingRevenue > 0 && (
                    <div className="mt-3 inline-flex items-center gap-1.5 text-xs bg-card/10 px-2.5 py-1 rounded-full">
                      <Clock className="w-3 h-3 text-yellow-300" />
                      <span className="text-yellow-200">MWK {pendingRevenue.toLocaleString()} pending</span>
                    </div>
                  )}
                </>
            }
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Active Subs"
            value={activeSubscriptions}
            sub={`${filteredNewSubs.filter(s => s.status === 'active').length} new this period`}
            icon={CreditCard}
            gradient="bg-gradient-to-br from-emerald-600 to-emerald-800"
            to="/admin/subscriptions"
            loading={loadingSubs}
          />
          <StatCard
            label="New Students"
            value={filteredNewStudents.length}
            sub={`${allStudents.length} total`}
            icon={Users}
            gradient="bg-gradient-to-br from-sky-600 to-sky-800"
            to="/admin/users"
            loading={loadingUsers}
          />
          <StatCard
            label="Tutors"
            value={allTeachers.length}
            sub={pendingApps > 0 ? `${pendingApps} pending` : 'All approved'}
            icon={GraduationCap}
            gradient="bg-gradient-to-br from-violet-600 to-violet-800"
            to="/admin/teachers"
            loading={loadingUsers}
          />
          <StatCard
            label="Enrollments"
            value={filteredEnrollments.length}
            sub={`${avgProgress}% avg progress`}
            icon={BookOpen}
            gradient="bg-gradient-to-br from-amber-600 to-amber-800"
            loading={loadingEnrollments}
          />
          <StatCard
            label="Video Migration"
            value={`${allLessons.filter(l => l.video_provider === 'bunny').length}/${allLessons.filter(l => l.video_url).length}`}
            sub="lessons on Bunny.net"
            icon={Video}
            gradient="bg-gradient-to-br from-purple-600 to-indigo-800"
            to="/admin/bunny-migration"
          />
        </div>
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center mb-1">
            <BookOpen className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-heading font-bold">{allSubjects.length}</p>
          <p className="text-xs font-semibold text-foreground/80">Total Courses</p>
          <p className="text-[11px] text-muted-foreground">{filteredEnrollments.length} enrolments this period</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center mb-1">
            <Layers className="w-4 h-4 text-orange-500" />
          </div>
          <p className="text-2xl font-heading font-bold">{allLessons.length}</p>
          <p className="text-xs font-semibold text-foreground/80">Total Lessons</p>
          <p className="text-[11px] text-muted-foreground">Across {allSubjects.length} courses</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1">
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center mb-1">
            <TrendingUp className="w-4 h-4 text-teal-500" />
          </div>
          <p className="text-2xl font-heading font-bold">{avgProgress}%</p>
          <p className="text-xs font-semibold text-foreground/80">Avg. Progress</p>
          <p className="text-[11px] text-muted-foreground">{allEnrollments.length} total enrolments</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1">
          <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center mb-1">
            <Gift className="w-4 h-4 text-pink-500" />
          </div>
          <p className="text-2xl font-heading font-bold">{totalAffiliates}</p>
          <p className="text-xs font-semibold text-foreground/80">Affiliates</p>
          <p className="text-[11px] text-muted-foreground">{filteredReferrals.filter(r => ['paid','rewarded'].includes(r.status)).length} conversions</p>
        </div>
      </div>

      {/* Quick Tools */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" /> Admin Tools
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Video Migration', icon: Video, to: '/admin/bunny-migration', color: 'text-purple-500', bg: 'bg-purple-500/10' },
            { label: 'Curriculum', icon: BookOpen, to: '/admin/curriculum', color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { label: 'Notifications', icon: AlertCircle, to: '/admin/notifications', color: 'text-orange-500', bg: 'bg-orange-500/10' },
            { label: 'Settings', icon: UserCheck, to: '/admin/settings', color: 'text-teal-500', bg: 'bg-teal-500/10' },
          ].map(({ label, icon: Icon, to, color, bg }) => (
            <Link key={to} to={to}
              className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border hover:bg-muted/40 transition-colors group">
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <span className="text-[11px] font-medium text-center leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent payments + Applications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" /> Recent Payments
            </h2>
            <Link to="/admin/subscriptions" className="text-xs text-primary hover:underline flex items-center gap-0.5">
              View all <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {loadingPayments ? (
            <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
          ) : recentPayments.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No completed payments in this period</div>
          ) : (
            <div className="divide-y divide-border">
              {recentPayments.map(p => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center text-xs font-bold text-success flex-shrink-0">
                    {p.student_name?.[0]?.toUpperCase() || 'S'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.student_name || 'Student'}</p>
                    <p className="text-xs text-muted-foreground">{new Date(p.created_date).toLocaleDateString()}</p>
                  </div>
                  <span className="text-sm font-bold text-success flex-shrink-0">MWK {(p.amount || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-500" /> Tutor Applications
            </h2>
            <Link to="/admin/teachers" className="text-xs text-primary hover:underline flex items-center gap-0.5">
              Manage <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {allApplications.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No applications yet</div>
          ) : (
            <div className="divide-y divide-border">
              {allApplications.slice(0, 5).map(app => (
                <div key={app.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                    {app.full_name?.[0]?.toUpperCase() || 'T'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{app.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{app.subjects?.join(', ') || 'No subjects listed'}</p>
                  </div>
                  <Badge className={`text-[9px] flex-shrink-0 ${app.status === 'pending' ? 'bg-yellow-500/10 text-yellow-600' : app.status === 'approved' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                    {app.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
