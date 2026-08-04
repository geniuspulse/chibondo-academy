import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Bell, Send, Users, User, Megaphone, BookOpen, CreditCard, Trash2,
  Search, Mail, Calendar, Clock, GraduationCap, CheckCheck,
  BarChart3, Eye, EyeOff, Loader2, RefreshCw, Filter, Tag,
  UserCheck, Globe, AtSign,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';

// ── Constants ────────────────────────────────────────────────────────────────
const TYPE_OPTIONS = [
  { value: 'announcement', label: 'Announcement', icon: Megaphone },
  { value: 'system',       label: 'System',        icon: Bell },
  { value: 'lesson',       label: 'Lesson',        icon: BookOpen },
  { value: 'subscription', label: 'Subscription',  icon: CreditCard },
];

const AUDIENCE_OPTIONS = [
  { value: 'all_students',  label: 'All Students',    icon: Users,         desc: 'Every registered student' },
  { value: 'all_teachers',  label: 'All Teachers',    icon: UserCheck,     desc: 'All active tutors' },
  { value: 'everyone',      label: 'Everyone',        icon: Globe,         desc: 'All users on the platform' },
  { value: 'by_form',       label: 'By Class/Form',   icon: GraduationCap, desc: 'Target a specific academic form' },
  { value: 'by_subject',    label: 'By Subject',      icon: BookOpen,      desc: 'Students enrolled in a subject' },
  { value: 'specific',      label: 'Specific User',   icon: User,          desc: 'One individual user' },
];

// ── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 text-center">
      <Icon className={`w-5 h-5 mx-auto mb-1.5 ${color}`} />
      <p className="text-xl font-bold font-display">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// ── Notification Row ─────────────────────────────────────────────────────────
function NotifRow({ n, onDelete }) {
  const typeColor = {
    announcement: 'bg-accent/10 text-accent border-accent/20',
    system: 'bg-blue-500/10 text-blue-600 border-blue-200',
    lesson: 'bg-green-500/10 text-green-600 border-green-200',
    subscription: 'bg-primary/10 text-primary border-primary/20',
  };
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-b-0 hover:bg-muted/20 transition-colors group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{n.title}</p>
          <Badge variant="outline" className={`text-[10px] shrink-0 ${typeColor[n.type] || 'bg-muted text-muted-foreground'}`}>
            {n.type}
          </Badge>
          {n.is_read
            ? <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><CheckCheck className="w-3 h-3 text-green-500" /> Read</span>
            : <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
          }
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{n.message}</p>
        <p className="text-[10px] text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(n.created_date), { addSuffix: true })}
        </p>
      </div>
      <button
        onClick={() => onDelete(n.id)}
        className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all flex-shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Email Campaign Form ───────────────────────────────────────────────────────
function EmailCampaignTab({ forms, subjects, students }) {
  const [subject_, setSubject_] = useState('');
  const [body, setBody]         = useState('');
  const [audience, setAudience] = useState('all_students');
  const [formId, setFormId]     = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [search, setSearch]     = useState('');
  const [sending, setSending]   = useState(false);
  const [history, setHistory]   = useState([]);

  const filteredStudents = students.filter(s =>
    !search || (s.full_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSend = async () => {
    if (!subject_.trim() || !body.trim()) { toast.error('Subject and body are required'); return; }
    setSending(true);
    try {
      // Build recipient list
      let recipients = [];
      if (audience === 'all_students') {
        recipients = students.map(s => ({ name: s.full_name, email: s.email })).filter(r => r.email && !r.email.endsWith('@student.chibondoacademy.com'));
      } else if (audience === 'by_form') {
        if (!formId) { toast.error('Select a form'); setSending(false); return; }
        recipients = students.filter(s => s.form_id === formId || s.form === forms.find(f=>f.id===formId)?.name)
          .map(s => ({ name: s.full_name, email: s.email })).filter(r => r.email && !r.email.endsWith('@student.chibondoacademy.com'));
      } else if (audience === 'by_subject') {
        if (!subjectId) { toast.error('Select a subject'); setSending(false); return; }
        const enrolments = await db.entities.Enrollment.filter({ subject_id: subjectId });
        const userIds = new Set(enrolments.map(e => e.student_id));
        recipients = students.filter(s => userIds.has(s.user_id))
          .map(s => ({ name: s.full_name, email: s.email })).filter(r => r.email && !r.email.endsWith('@student.chibondoacademy.com'));
      } else if (audience === 'specific') {
        const p = students.find(s => s.id === targetId);
        if (!p?.email) { toast.error('Student not found or no email'); setSending(false); return; }
        recipients = [{ name: p.full_name, email: p.email }];
      }

      if (recipients.length === 0) { toast.error('No valid recipients found'); setSending(false); return; }

      // Send via Resend through Vercel serverless API
      const emailRes = await fetch('/api/notify?channel=email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to:        recipients.map(r => r.email),
          subject:   subject_.trim(),
          html:      `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
                        <h2 style="color:#1a1a1a;margin-bottom:8px;">${subject_.trim()}</h2>
                        <div style="color:#333;line-height:1.6;white-space:pre-wrap;">${body.trim()}</div>
                        <hr style="border:none;border-top:1px solid #eee;margin:28px 0;" />
                        <p style="color:#aaa;font-size:12px;margin:0;">
                          Chibondo Academy &mdash; <a href="https://chibondoacademy.com" style="color:#aaa;">chibondoacademy.com</a>
                        </p>
                      </div>`,
          from_name: 'Chibondo Academy',
        }),
      });
      const emailData = await emailRes.json().catch(() => ({}));

      // ── Send WhatsApp notifications (replaces email as primary channel) ──
      try {
        const waRes = await fetch('/api/send-whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            users: userIds,
            message: `*Chibondo Academy*

${subject_.trim()}

${body.trim()}

Login: chibondoacademy.com`,
            type: 'template',
            template: {
              name: 'admin_notification',
              language: { code: 'en' },
              components: [{ type: 'body', parameters: [
                { type: 'text', text: subject_.trim() },
                { type: 'text', text: body.trim() },
              ]}],
            },
          }),
        });
        const waData = await waRes.json().catch(() => ({}));
        if (waData?.sent) toast.success(`WhatsApp sent to ${waData.sent} user${waData.sent !== 1 ? 's' : ''}`);
      } catch (waErr) {
        console.error('WhatsApp notification error:', waErr);
      }

      if (!emailRes.ok) {
        const errMsg = emailData.error || emailData.message || 'Failed to send notification';
        if (errMsg.toLowerCase().includes('api key')) {
          throw new Error('Email service not configured — please contact admin to update the Resend API key.');
        }
        if (errMsg.toLowerCase().includes('domain') || errMsg.toLowerCase().includes('from')) {
          throw new Error('Email domain not verified in Resend. Contact admin.');
        }
        throw new Error(errMsg);
      }

      setHistory(h => [{ subject: subject_, audience, count: recipients.length, sent_at: new Date().toISOString() }, ...h.slice(0,9)]);
      toast.success(`Email sent to ${recipients.length} recipient${recipients.length !== 1 ? 's' : ''}!`);
      setSubject_(''); setBody('');
    } catch (err) {
      toast.error('Failed to send notification: ' + (err?.message || 'Unknown error'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      {/* Compose */}
      <div className="lg:col-span-3 space-y-4">
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Compose Email Campaign</h2>
          </div>
          <div className="p-5 space-y-4">
            {/* Audience */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Audience</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'all_students', label: 'All Students',  icon: Users },
                  { value: 'by_form',      label: 'By Form',       icon: GraduationCap },
                  { value: 'by_subject',   label: 'By Subject',    icon: BookOpen },
                  { value: 'specific',     label: 'Specific',      icon: User },
                ].map(opt => (
                  <button key={opt.value} onClick={() => setAudience(opt.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all
                      ${audience === opt.value ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}>
                    <opt.icon className="w-4 h-4" /> {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Form selector */}
            {audience === 'by_form' && (
              <Select value={formId} onValueChange={setFormId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select form…" /></SelectTrigger>
                <SelectContent>{forms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
              </Select>
            )}

            {/* Subject selector */}
            {audience === 'by_subject' && (
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select subject…" /></SelectTrigger>
                <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            )}

            {/* Specific student */}
            {audience === 'specific' && (
              <div className="space-y-1.5">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input placeholder="Search student…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
                </div>
                <div className="max-h-36 overflow-y-auto border border-border rounded-xl divide-y divide-border">
                  {filteredStudents.slice(0,20).map(s => (
                    <button key={s.id} onClick={() => setTargetId(s.id)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors ${targetId === s.id ? 'bg-primary/5 text-primary font-medium' : ''}`}>
                      {s.full_name || 'Unknown'} <span className="text-xs text-muted-foreground">· {s.email}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Subject line */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Subject Line</label>
              <Input placeholder="e.g. Important: Exam Schedule Update" value={subject_} onChange={e => setSubject_(e.target.value)} className="h-10" />
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email Body</label>
              <Textarea
                placeholder="Write your email message here. You can use plain text or simple HTML."
                value={body}
                onChange={e => setBody(e.target.value)}
                className="resize-none h-48 font-mono text-sm"
              />
              <p className="text-[10px] text-muted-foreground">{body.length} characters</p>
            </div>

            <Button onClick={handleSend} disabled={sending || !subject_.trim() || !body.trim()} className="w-full h-11 font-semibold"
              style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
              {sending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</> : <><Mail className="w-4 h-4 mr-2" />Send Email Campaign</>}
            </Button>
          </div>
        </div>
      </div>

      {/* Campaign History */}
      <div className="lg:col-span-2">
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Sent This Session</h2>
          </div>
          {history.length === 0 ? (
            <div className="text-center py-10">
              <Mail className="w-10 h-10 mx-auto text-muted-foreground/20 mb-2" />
              <p className="text-sm text-muted-foreground">No campaigns sent yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {history.map((h, i) => (
                <div key={i} className="px-4 py-3">
                  <p className="text-sm font-medium truncate">{h.subject}</p>
                  <p className="text-xs text-muted-foreground">{h.count} recipients · {h.audience.replace('_', ' ')}</p>
                  <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(h.sent_at), { addSuffix: true })}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdminNotifications() {
  const queryClient = useQueryClient();

  const [title, setTitle]         = useState('');
  const [message, setMessage]     = useState('');
  const [type, setType]           = useState('announcement');
  const [audience, setAudience]   = useState('all_students');
  const [targetId, setTargetId]   = useState('');
  const [formId, setFormId]       = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState('all');

  const { data: students = [] } = useQuery({
    queryKey: ['allStudentProfiles'],
    queryFn: () => db.entities.User.filter({}, 'full_name', 300),
  });

  const { data: forms = [] } = useQuery({
    queryKey: ['academic-forms'],
    queryFn: () => (async () => [])(/* AcademicForm removed */),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['all-subjects-notif'],
    queryFn: () => db.entities.Subject.filter({ status: 'published' }, 'name', 200),
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['all-teachers-notif'],
    queryFn: () => db.entities.User.filter({ role: 'teacher' }),
  });

  const { data: allNotifications = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-all-notifications'],
    queryFn: () => db.entities.Notification.list('-created_date', 300),
    staleTime: 0,
  });

  // ── Enrollment lookup for by_subject audience ──
  const { data: subjectEnrollments = [] } = useQuery({
    queryKey: ['enrolments-for-notif', subjectId],
    queryFn: () => db.entities.Enrollment.filter({ subject_id: subjectId }, 'created_date', 500),
    enabled: !!subjectId && audience === 'by_subject',
  });

  const getRecipientCount = () => {
    if (audience === 'all_students') return `${students.length} students`;
    if (audience === 'all_teachers') return `${teachers.length} teachers`;
    if (audience === 'everyone') return `${students.length + teachers.length} users`;
    if (audience === 'by_form') {
      const f = forms.find(f => f.id === formId);
      const count = students.filter(s => s.form === f?.name || s.form_id === formId).length;
      return formId ? `~${count} students in ${f?.name || '...'}` : 'Select a form';
    }
    if (audience === 'by_subject') {
      return subjectId ? `${subjectEnrollments.length} enrolled students` : 'Select a subject';
    }
    if (audience === 'specific') return targetId ? '1 user' : 'Select a user';
    return '';
  };

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !message.trim()) throw new Error('Title and message are required');

      let userIds = [];

      if (audience === 'all_students') {
        userIds = students.map(p => p.user_id).filter(Boolean);
      } else if (audience === 'all_teachers') {
        userIds = teachers.map(t => t.id).filter(Boolean);
      } else if (audience === 'everyone') {
        const studentIds = students.map(p => p.user_id).filter(Boolean);
        const teacherIds = teachers.map(t => t.id).filter(Boolean);
        userIds = [...new Set([...studentIds, ...teacherIds])];
      } else if (audience === 'by_form') {
        if (!formId) throw new Error('Please select a form');
        const f = forms.find(f => f.id === formId);
        userIds = students.filter(s => s.form === f?.name || s.form_id === formId).map(s => s.user_id).filter(Boolean);
      } else if (audience === 'by_subject') {
        if (!subjectId) throw new Error('Please select a subject');
        userIds = subjectEnrollments.map(e => e.student_id).filter(Boolean);
      } else if (audience === 'specific') {
        if (!targetId) throw new Error('Please select a recipient');
        const profile = students.find(s => s.id === targetId) || teachers.find(t => t.id === targetId);
        const uid = profile?.user_id || profile?.id;
        if (!uid) throw new Error('User not found');
        userIds = [uid];
      }

      if (userIds.length === 0) throw new Error('No recipients found for this audience');

      // Send in batches of 50 to avoid overloading
      const batches = [];
      for (let i = 0; i < userIds.length; i += 50) batches.push(userIds.slice(i, i + 50));
      for (const batch of batches) {
        await Promise.all(batch.map(uid =>
          db.entities.Notification.create({
            user_id: uid,
            title: title.trim(),
            message: message.trim(),
            type,
            is_read: false,
          })
        ));
      }

      // ── Send Push Notifications ──────────────────────────────────────────
      try {
        const pushQuery = await Promise.all(
          userIds.map(uid => db.entities.User.filter({ id: uid }))
        );
        const usersWithPush = pushQuery
          .flat()
          .filter(u => u.push_enabled && u.push_subscription);

        const pushSubs = usersWithPush.map(u => {
          try { return JSON.parse(u.push_subscription); } catch { return null; }
        }).filter(Boolean);

        if (pushSubs.length > 0) {
          await fetch('/api/notify?channel=push', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-secret': import.meta.env.VITE_INTERNAL_API_SECRET || '',
            },
            body: JSON.stringify({
              subscriptions: pushSubs,
              notification: {
                title: title.trim(),
                body: message.trim(),
                icon: '/icon-192.png',
                url: '/notifications',
                tag: type,
              },
            }),
          });
        }
      } catch (pushErr) {
        console.warn('[Push] Push delivery failed (non-critical):', pushErr);
      }

      return userIds.length;
    },
    onSuccess: (count) => {
      toast.success(`✅ Notification sent to ${count} recipient${count !== 1 ? 's' : ''}!`);
      setTitle(''); setMessage(''); setType('announcement'); setAudience('all_students'); setTargetId(''); setFormId(''); setSubjectId('');
      queryClient.invalidateQueries({ queryKey: ['admin-all-notifications'] });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => db.entities.Notification.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-all-notifications'] }),
  });

  const filteredStudents = students.filter(s =>
    !studentSearch || (s.full_name || '').toLowerCase().includes(studentSearch.toLowerCase())
  );

  const filteredHistory = allNotifications.filter(n => {
    const matchSearch = !historySearch ||
      n.title.toLowerCase().includes(historySearch.toLowerCase()) ||
      (n.message || '').toLowerCase().includes(historySearch.toLowerCase());
    const matchType = historyFilter === 'all' || n.type === historyFilter;
    return matchSearch && matchType;
  });

  const stats = {
    total: allNotifications.length,
    unread: allNotifications.filter(n => !n.is_read).length,
    announcements: allNotifications.filter(n => n.type === 'announcement').length,
    today: allNotifications.filter(n => {
      const d = new Date(n.created_date);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" /> Notifications & Marketing
          </h1>
          <p className="text-sm text-muted-foreground mt-1">In-app notifications · Email campaigns · Audience targeting</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Sent"    value={stats.total}         icon={Bell}      color="text-primary" />
        <StatCard label="Unread"        value={stats.unread}        icon={Eye}       color="text-destructive" />
        <StatCard label="Announcements" value={stats.announcements} icon={Megaphone} color="text-accent-foreground" />
        <StatCard label="Sent Today"    value={stats.today}         icon={Send}      color="text-green-600" />
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="compose">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="compose" className="flex items-center gap-1.5"><Bell className="w-4 h-4" /> In-App</TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-1.5"><Mail className="w-4 h-4" /> Email</TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1.5"><BarChart3 className="w-4 h-4" /> History</TabsTrigger>
        </TabsList>

        {/* ── IN-APP NOTIFICATIONS ── */}
        <TabsContent value="compose" className="mt-5">
          <div className="grid lg:grid-cols-5 gap-6">
            {/* Compose */}
            <div className="lg:col-span-2">
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                  <Send className="w-4 h-4 text-primary" />
                  <h2 className="font-semibold">Compose Notification</h2>
                </div>
                <div className="p-5 space-y-4">

                  {/* Audience */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Send To</label>
                    <div className="grid grid-cols-2 gap-2">
                      {AUDIENCE_OPTIONS.map(opt => (
                        <button key={opt.value} onClick={() => { setAudience(opt.value); setTargetId(''); setFormId(''); setSubjectId(''); }}
                          className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border-2 text-left transition-all
                            ${audience === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                          <opt.icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${audience === opt.value ? 'text-primary' : 'text-muted-foreground'}`} />
                          <div>
                            <p className={`text-xs font-semibold ${audience === opt.value ? 'text-primary' : 'text-foreground'}`}>{opt.label}</p>
                            <p className="text-[10px] text-muted-foreground leading-tight">{opt.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                    {/* Recipient count preview */}
                    <p className="text-xs text-muted-foreground px-1">
                      📤 Sending to: <span className="font-semibold text-foreground">{getRecipientCount()}</span>
                    </p>
                  </div>

                  {/* Form selector */}
                  {audience === 'by_form' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Select Form</label>
                      <Select value={formId} onValueChange={setFormId}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Choose form…" /></SelectTrigger>
                        <SelectContent>{forms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Subject selector */}
                  {audience === 'by_subject' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Select Subject</label>
                      <Select value={subjectId} onValueChange={setSubjectId}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Choose subject…" /></SelectTrigger>
                        <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name} — {s.form_name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Student/teacher selector */}
                  {audience === 'specific' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Select User</label>
                      <div className="relative mb-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input placeholder="Search student…" value={studentSearch} onChange={e => setStudentSearch(e.target.value)} className="pl-8 h-9 text-sm" />
                      </div>
                      <div className="max-h-40 overflow-y-auto border border-border rounded-xl divide-y divide-border">
                        {filteredStudents.slice(0,20).map(s => (
                          <button key={s.id} onClick={() => setTargetId(s.id)}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors ${targetId === s.id ? 'bg-primary/5 text-primary font-medium' : ''}`}>
                            {s.full_name || 'Unknown'} <span className="text-xs text-muted-foreground">· {s.form}</span>
                          </button>
                        ))}
                        {filteredStudents.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No users found</p>}
                      </div>
                    </div>
                  )}

                  {/* Type */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</label>
                    <Select value={type} onValueChange={setType}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{TYPE_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>

                  {/* Title */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title</label>
                    <Input placeholder="Notification title…" value={title} onChange={e => setTitle(e.target.value)} className="h-10" />
                  </div>

                  {/* Message */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Message</label>
                    <Textarea placeholder="Write your message here…" value={message} onChange={e => setMessage(e.target.value)} className="resize-none h-28" />
                  </div>

                  <Button
                    onClick={() => sendMutation.mutate()}
                    disabled={sendMutation.isPending || !title.trim() || !message.trim()}
                    className="w-full h-11 font-semibold"
                    style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
                  >
                    {sendMutation.isPending
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</>
                      : <><Send className="w-4 h-4 mr-2" />Send Notification</>}
                  </Button>
                </div>
              </div>
            </div>

            {/* Live feed */}
            <div className="lg:col-span-3">
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-primary" />
                    <h2 className="font-semibold">Recent Notifications</h2>
                  </div>
                  <Badge variant="outline">{allNotifications.length} total</Badge>
                </div>
                {isLoading ? (
                  <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                ) : allNotifications.length === 0 ? (
                  <div className="text-center py-14"><Bell className="w-10 h-10 mx-auto text-muted-foreground/20 mb-2" /><p className="text-sm text-muted-foreground">No notifications yet</p></div>
                ) : (
                  <div className="max-h-[500px] overflow-y-auto divide-y divide-border">
                    {allNotifications.slice(0, 30).map(n => <NotifRow key={n.id} n={n} onDelete={(id) => deleteMutation.mutate(id)} />)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── EMAIL CAMPAIGNS ── */}
        <TabsContent value="email" className="mt-5">
          <EmailCampaignTab forms={forms} subjects={subjects} students={students} />
        </TabsContent>

        {/* ── HISTORY ── */}
        <TabsContent value="history" className="mt-5">
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="font-semibold flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> Notification History</h2>
                <Badge variant="outline">{filteredHistory.length} records</Badge>
              </div>
              <div className="flex gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input placeholder="Search notifications…" value={historySearch} onChange={e => setHistorySearch(e.target.value)} className="pl-8 h-9 text-sm" />
                </div>
                <Select value={historyFilter} onValueChange={setHistoryFilter}>
                  <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="max-h-[600px] overflow-y-auto divide-y divide-border">
              {filteredHistory.slice(0, 100).map(n => <NotifRow key={n.id} n={n} onDelete={(id) => deleteMutation.mutate(id)} />)}
              {filteredHistory.length === 0 && (
                <div className="text-center py-14"><Bell className="w-10 h-10 mx-auto text-muted-foreground/20 mb-2" /><p className="text-sm text-muted-foreground">No notifications found</p></div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
