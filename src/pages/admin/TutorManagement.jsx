import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  GraduationCap, Plus, Search, MoreVertical, Edit, Archive,
  Eye, EyeOff, ExternalLink, Trash2, Loader2, X, CheckCircle,
  XCircle, Clock, Mail, Phone, School, BookOpen, FileText,
  Users, UserCheck, AlertCircle, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

// ── Helpers ──────────────────────────────────────────────────────────────────
const ALL_SUBJECTS = [
  'Biology', 'Chemistry', 'Physics', 'Mathematics', 'Additional Mathematics',
  'English Language', 'English Literature', 'Chichewa', 'Agriculture', 'Geography', 'History',
];

function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const EMPTY_TUTOR = {
  full_name: '', slug: '', professional_title: '', tagline: '',
  biography: '', years_teaching: '', previous_schools: '', current_position: '',
  profile_photo: '', subjects: [],
  qualifications: [], certifications: [],
  email: '', phone: '', whatsapp: '',
  facebook: '', linkedin: '', youtube: '', twitter_x: '', tiktok: '',
  is_visible: true, status: 'active',
};

// ── Tutor Profile Form ────────────────────────────────────────────────────────
function TutorForm({ initial, onSave, onClose, isSaving }) {
  const [form, setForm] = useState({ ...EMPTY_TUTOR, ...initial });
  const [qualInput, setQualInput] = useState({ name: '', institution: '', year: '' });
  const [certInput, setCertInput] = useState({ name: '', organization: '', date_issued: '' });

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const autoSlug = () => {
    if (!form.slug && form.full_name) set('slug', slugify(form.full_name));
  };

  const toggleSubject = (s) => {
    set('subjects', form.subjects.includes(s) ? form.subjects.filter(x => x !== s) : [...form.subjects, s]);
  };

  const addQual = () => {
    if (!qualInput.name) return;
    set('qualifications', [...(form.qualifications || []), { ...qualInput }]);
    setQualInput({ name: '', institution: '', year: '' });
  };

  const addCert = () => {
    if (!certInput.name) return;
    set('certifications', [...(form.certifications || []), { ...certInput }]);
    setCertInput({ name: '', organization: '', date_issued: '' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.full_name || !form.slug) { toast.error('Full name and slug are required'); return; }
    onSave({ ...form, years_teaching: form.years_teaching ? Number(form.years_teaching) : undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Basic Info</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Full Name *</Label>
            <Input value={form.full_name} onChange={e => set('full_name', e.target.value)} onBlur={autoSlug} className="mt-1" required />
          </div>
          <div className="col-span-2">
            <Label>Slug (URL) *</Label>
            <Input value={form.slug} onChange={e => set('slug', slugify(e.target.value))} className="mt-1 font-mono text-sm" placeholder="e.g. taonga-chipondo" required />
            <p className="text-xs text-muted-foreground mt-1">Profile URL: /tutors/{form.slug || '...'}</p>
          </div>
          <div className="col-span-2">
            <Label>Professional Title</Label>
            <Input value={form.professional_title} onChange={e => set('professional_title', e.target.value)} className="mt-1" placeholder="e.g. Senior Biology Tutor" />
          </div>
          <div className="col-span-2">
            <Label>Tagline</Label>
            <Input value={form.tagline} onChange={e => set('tagline', e.target.value)} className="mt-1" placeholder="e.g. Making Science Simple" />
          </div>
          <div className="col-span-2">
            <Label>Profile Photo URL</Label>
            <Input value={form.profile_photo} onChange={e => set('profile_photo', e.target.value)} className="mt-1" placeholder="https://..." />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Subjects</h3>
        <div className="flex flex-wrap gap-2">
          {ALL_SUBJECTS.map(s => (
            <button type="button" key={s} onClick={() => toggleSubject(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                form.subjects.includes(s) ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary/40'
              }`}>{s}</button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Biography</h3>
        <Textarea value={form.biography} onChange={e => set('biography', e.target.value)} rows={4} placeholder="Introduction, background, teaching philosophy..." />
        <p className="text-xs text-muted-foreground mt-1">Supports HTML formatting</p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Experience</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Years Teaching</Label><Input type="number" value={form.years_teaching} onChange={e => set('years_teaching', e.target.value)} className="mt-1" min={0} /></div>
          <div><Label>Current Position</Label><Input value={form.current_position} onChange={e => set('current_position', e.target.value)} className="mt-1" /></div>
          <div className="col-span-2"><Label>Previous Schools / Institutions</Label><Input value={form.previous_schools} onChange={e => set('previous_schools', e.target.value)} className="mt-1" /></div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Qualifications</h3>
        {(form.qualifications || []).map((q, i) => (
          <div key={i} className="flex items-center justify-between bg-muted/30 rounded-xl px-3 py-2 text-sm">
            <span>{q.name} — {q.institution} {q.year && `(${q.year})`}</span>
            <button type="button" onClick={() => set('qualifications', form.qualifications.filter((_, j) => j !== i))}>
              <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        ))}
        <div className="grid grid-cols-3 gap-2">
          <Input placeholder="Qualification" value={qualInput.name} onChange={e => setQualInput(p => ({ ...p, name: e.target.value }))} />
          <Input placeholder="Institution" value={qualInput.institution} onChange={e => setQualInput(p => ({ ...p, institution: e.target.value }))} />
          <div className="flex gap-2">
            <Input placeholder="Year" value={qualInput.year} onChange={e => setQualInput(p => ({ ...p, year: e.target.value }))} />
            <Button type="button" size="sm" variant="outline" onClick={addQual}><Plus className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Contact & Social</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="mt-1" /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={e => set('phone', e.target.value)} className="mt-1" /></div>
          <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} className="mt-1" /></div>
          <div><Label>Facebook</Label><Input value={form.facebook} onChange={e => set('facebook', e.target.value)} className="mt-1" /></div>
          <div><Label>LinkedIn</Label><Input value={form.linkedin} onChange={e => set('linkedin', e.target.value)} className="mt-1" /></div>
          <div><Label>YouTube</Label><Input value={form.youtube} onChange={e => set('youtube', e.target.value)} className="mt-1" /></div>
          <div><Label>Twitter / X</Label><Input value={form.twitter_x} onChange={e => set('twitter_x', e.target.value)} className="mt-1" /></div>
          <div><Label>TikTok</Label><Input value={form.tiktok} onChange={e => set('tiktok', e.target.value)} className="mt-1" /></div>
        </div>
      </div>

      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
        <div>
          <p className="text-sm font-semibold">Visible in Directory</p>
          <p className="text-xs text-muted-foreground">Show this tutor on the public /tutors page</p>
        </div>
        <button type="button" onClick={() => set('is_visible', !form.is_visible)}
          className={`w-11 h-6 rounded-full transition-colors relative ${form.is_visible ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-card shadow transition-transform ${form.is_visible ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1" disabled={isSaving}>Cancel</Button>
        <Button type="submit" className="flex-1" disabled={isSaving}
          style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
          {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : initial?.id ? 'Save Changes' : 'Create Profile'}
        </Button>
      </div>
    </form>
  );
}

// ── Application Review Dialog ─────────────────────────────────────────────────
function ApplicationDialog({ app, onApprove, onReject, onClose, isProcessing }) {
  const [adminNotes, setAdminNotes] = useState(app?.admin_notes || '');

  if (!app) return null;
  return (
    <Dialog open={!!app} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Teacher Application — {app.full_name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: 'Full Name', value: app.full_name },
              { label: 'Email', value: app.email },
              { label: 'Phone', value: app.phone_number },
              { label: 'Institution', value: app.school_or_institution },
              { label: 'Years Experience', value: app.years_experience },
              { label: 'Submitted', value: app.created_date ? formatDistanceToNow(new Date(app.created_date), { addSuffix: true }) : '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
                <p className="text-sm mt-0.5">{value || '—'}</p>
              </div>
            ))}
          </div>

          {app.subjects?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Subjects</p>
              <div className="flex gap-1 flex-wrap">
                {app.subjects.map((s, i) => <Badge key={i} variant="secondary">{s}</Badge>)}
              </div>
            </div>
          )}

          {app.qualifications && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Qualifications</p>
              <p className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-3">{app.qualifications}</p>
            </div>
          )}

          {app.motivation && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Motivation</p>
              <p className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-3">{app.motivation}</p>
            </div>
          )}

          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Admin Notes</Label>
            <Textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder="Internal notes (not shown to applicant)…" className="mt-1.5 resize-none h-24" />
          </div>

          {app.status !== 'pending' && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium ${
              app.status === 'approved' ? 'bg-green-500/10 border-green-500/20 text-green-700' : 'bg-destructive/10 border-destructive/20 text-destructive'
            }`}>
              {app.status === 'approved' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              This application was {app.status}
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>Cancel</Button>
          {app.status === 'pending' && (
            <>
              <Button variant="destructive" onClick={() => onReject(app.id, adminNotes)} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                Reject
              </Button>
              <Button onClick={() => onApprove(app.id, adminNotes)} disabled={isProcessing}
                style={{ background: 'hsl(160 60% 45%)', color: 'white' }}>
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Approve & Create Profile
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function TutorManagement() {
  const qc = useQueryClient();
  const [search, setSearch]           = useState('');
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [editing, setEditing]         = useState(null);
  const [reviewApp, setReviewApp]     = useState(null);

  // ── Data fetching ──
  const { data: tutors = [], isLoading: loadingTutors } = useQuery({queryKey: ['admin-tutors'],
    queryFn: async () => { try { return await db.entities.TutorProfile.list('full_name', 500); } catch(e) { console.error(e); return []; } },
    staleTime: 0,
    placeholderData: [],
  });

  const { data: applications = [], isLoading: loadingApps } = useQuery({queryKey: ['teacherApplications'],
    queryFn: async () => { try { return await db.entities.TeacherApplication.filter({}, '-created_date', 200); } catch(e) { console.error(e); return []; } },
    staleTime: 0,
    placeholderData: [],
  });

  // All platform teachers (role = teacher) — to detect unlinked ones
  const { data: allTeachers = [] } = useQuery({queryKey: ['all-teachers-mgmt'],
    queryFn: async () => { try { return await db.entities.User.filter({ role: 'teacher' }); } catch(e) { console.error(e); return []; } },
    staleTime: 60_000,
    placeholderData: [],
  });

  // Subjects with teacher_id set — for auto-profile detection
  const { data: subjects = [] } = useQuery({queryKey: ['all-subjects-mgmt'],
    queryFn: async () => { try { return await db.entities.Subject.filter({ status: 'published' }, 'name', 300); } catch(e) { console.error(e); return []; } },
    staleTime: 60_000,
    placeholderData: [],
  });

  // ── Mutations ──
  const createMut = useMutation({
    mutationFn: data => db.entities.TutorProfile.create(data),
    onSuccess: () => { toast.success('Tutor profile created'); qc.invalidateQueries({ queryKey: ['admin-tutors'] }); setDialogOpen(false); },
    onError: e => toast.error('Failed: ' + e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => db.entities.TutorProfile.update(id, data),
    onSuccess: () => { toast.success('Profile updated'); qc.invalidateQueries({ queryKey: ['admin-tutors'] }); setDialogOpen(false); },
    onError: e => toast.error('Failed: ' + e.message),
  });

  const archiveMut = useMutation({
    mutationFn: id => db.entities.TutorProfile.update(id, { status: 'archived', is_visible: false }),
    onSuccess: () => { toast.success('Tutor archived'); qc.invalidateQueries({ queryKey: ['admin-tutors'] }); },
  });

  const toggleVisibility = useMutation({
    mutationFn: ({ id, is_visible }) => db.entities.TutorProfile.update(id, { is_visible }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-tutors'] }),
  });

  const appMut = useMutation({
    mutationFn: async ({ id, status, notes }) => {
      const app = applications.find(a => a.id === id);

      await db.entities.TeacherApplication.update(id, { status, admin_notes: notes });

      if (status === 'approved' && app?.user_id) {
        // 1. Promote user to teacher role
        await db.entities.User.update(app.user_id, { role: 'teacher' });

        // 2. Auto-create a TutorProfile if one doesn't already exist for this user
        const existingProfiles = await db.entities.TutorProfile.filter({ user_id: app.user_id });
        if (existingProfiles.length === 0) {
          const slug = slugify(app.full_name);
          // Check slug uniqueness — append random suffix if taken
          const existingSlug = await db.entities.TutorProfile.filter({ slug });
          const finalSlug = existingSlug.length > 0 ? `${slug}-${Math.random().toString(36).slice(2,6)}` : slug;

          await db.entities.TutorProfile.create({
            full_name: app.full_name,
            slug: finalSlug,
            professional_title: '',
            subjects: app.subjects || [],
            email: app.email || '',
            phone: app.phone_number || '',
            biography: app.qualifications ? `Qualifications: ${app.qualifications}` : '',
            is_visible: true,
            status: 'active',
            user_id: app.user_id,
          });
        }
      }
    },
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: ['teacherApplications'] });
      qc.invalidateQueries({ queryKey: ['admin-tutors'] });
      qc.invalidateQueries({ queryKey: ['all-teachers-mgmt'] });
      setReviewApp(null);
      toast.success(status === 'approved' ? '✅ Approved — tutor profile created automatically' : 'Application rejected');
    },
    onError: e => toast.error(e.message),
  });

  const handleSave = (data) => {
    if (editing?.id) updateMut.mutate({ id: editing.id, data });
    else createMut.mutate(data);
  };

  // ── Auto-profile detection: teachers with subjects but no TutorProfile ──
  const tutorUserIds = new Set(tutors.map(t => t.user_id).filter(Boolean));
  const teachersWithSubjects = allTeachers.filter(t => {
    const hasSubject = subjects.some(s => s.teacher_id === t.id);
    const hasProfile = tutorUserIds.has(t.id);
    return hasSubject && !hasProfile;
  });

  const createProfileForTeacher = useMutation({
    mutationFn: async (teacher) => {
      const teacherSubjects = subjects.filter(s => s.teacher_id === teacher.id).map(s => s.name);
      const slug = slugify(teacher.full_name);
      const existingSlug = await db.entities.TutorProfile.filter({ slug });
      const finalSlug = existingSlug.length > 0 ? `${slug}-${Math.random().toString(36).slice(2,6)}` : slug;
      return db.entities.TutorProfile.create({
        full_name: teacher.full_name,
        slug: finalSlug,
        email: teacher.email || '',
        subjects: teacherSubjects,
        is_visible: true,
        status: 'active',
        user_id: teacher.id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-tutors'] });
      qc.invalidateQueries({ queryKey: ['all-teachers-mgmt'] });
      toast.success('Profile created and added to directory');
    },
    onError: e => toast.error(e.message),
  });

  // ── Computed ──
  const pendingApps    = applications.filter(a => a.status === 'pending');
  const processedApps  = applications.filter(a => a.status !== 'pending');
  const activeTutors   = tutors.filter(t => t.status !== 'archived');
  const archivedTutors = tutors.filter(t => t.status === 'archived');

  const filtered = activeTutors.filter(t =>
    !search ||
    t.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.subjects?.some(s => s.toLowerCase().includes(search.toLowerCase()))
  );

  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-primary" /> Tutor Management
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Applications · Directory · Profiles — {activeTutors.length} active tutors · {pendingApps.length} pending applications
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <a href="/tutors" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm hover:border-primary/40 transition-colors">
            <ExternalLink className="w-4 h-4" /> View Directory
          </a>
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Add Tutor
          </Button>
        </div>
      </div>

      {/* Alert: teachers with subjects but no profile */}
      {teachersWithSubjects.length > 0 && (
        <div className="bg-accent/10 border border-accent/30 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-sm">
                {teachersWithSubjects.length} teacher{teachersWithSubjects.length !== 1 ? 's' : ''} with assigned subjects missing a public profile
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                These tutors have courses on the platform but won't appear in the directory until a profile is created.
              </p>
              <div className="space-y-2">
                {teachersWithSubjects.map(t => {
                  const teacherSubjects = subjects.filter(s => s.teacher_id === t.id).map(s => s.name);
                  return (
                    <div key={t.id} className="flex items-center justify-between bg-card border border-border rounded-xl px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{t.full_name}</p>
                        <p className="text-xs text-muted-foreground">{teacherSubjects.slice(0, 3).join(', ')}{teacherSubjects.length > 3 ? ` +${teacherSubjects.length - 3} more` : ''}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => createProfileForTeacher.mutate(t)}
                        disabled={createProfileForTeacher.isPending}>
                        {createProfileForTeacher.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
                        Create Profile
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue={pendingApps.length > 0 ? 'applications' : 'directory'}>
        <TabsList>
          <TabsTrigger value="applications" className="flex items-center gap-1.5">
            <FileText className="w-4 h-4" /> Applications
            {pendingApps.length > 0 && (
              <span className="ml-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {pendingApps.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="directory" className="flex items-center gap-1.5">
            <Users className="w-4 h-4" /> Directory ({activeTutors.length})
          </TabsTrigger>
          {archivedTutors.length > 0 && (
            <TabsTrigger value="archived" className="flex items-center gap-1.5">
              <Archive className="w-4 h-4" /> Archived ({archivedTutors.length})
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── APPLICATIONS TAB ── */}
        <TabsContent value="applications" className="mt-5 space-y-6">
          {/* Pending */}
          <div>
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Pending ({pendingApps.length})
            </h2>
            {pendingApps.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-border rounded-2xl">
                <CheckCircle className="w-10 h-10 mx-auto text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground">No pending applications</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pendingApps.map(app => (
                  <div key={app.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{app.full_name}</p>
                        <p className="text-xs text-muted-foreground">{app.email}</p>
                      </div>
                      <Badge className="bg-yellow-500/10 text-yellow-700 border-yellow-500/20 text-[10px]">Pending</Badge>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {app.phone_number && <div className="flex items-center gap-1.5"><Phone className="w-3 h-3" />{app.phone_number}</div>}
                      {app.school_or_institution && <div className="flex items-center gap-1.5"><School className="w-3 h-3" />{app.school_or_institution}</div>}
                      {app.subjects?.length > 0 && <div className="flex items-center gap-1.5"><BookOpen className="w-3 h-3" />{app.subjects.slice(0,3).join(', ')}</div>}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {app.created_date ? formatDistanceToNow(new Date(app.created_date), { addSuffix: true }) : ''}
                    </p>
                    <Button className="w-full h-8 text-xs" onClick={() => setReviewApp(app)}>
                      Review Application
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Processed */}
          {processedApps.length > 0 && (
            <div>
              <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">
                Processed ({processedApps.length})
              </h2>
              <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
                {processedApps.map(app => (
                  <div key={app.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => setReviewApp(app)}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      app.status === 'approved' ? 'bg-green-500/10' : 'bg-destructive/10'
                    }`}>
                      {app.status === 'approved'
                        ? <CheckCircle className="w-4 h-4 text-green-600" />
                        : <XCircle className="w-4 h-4 text-destructive" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{app.full_name}</p>
                      <p className="text-xs text-muted-foreground">{app.email}</p>
                    </div>
                    <Badge variant={app.status === 'approved' ? 'default' : 'destructive'} className="text-[10px]">
                      {app.status === 'approved' ? 'Approved' : 'Rejected'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── DIRECTORY TAB ── */}
        <TabsContent value="directory" className="mt-5 space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search tutors or subjects…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {loadingTutors ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <GraduationCap className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
              <p className="font-semibold text-muted-foreground">No tutors yet</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Approve an application or click "Add Tutor" to create a profile</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tutor</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Subjects</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Visibility</th>
                    <th className="text-right px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(tutor => (
                    <tr key={tutor.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full overflow-hidden bg-primary/10 flex-shrink-0 flex items-center justify-center">
                            {tutor.profile_photo
                              ? <img src={tutor.profile_photo} alt={tutor.full_name} className="w-full h-full object-cover" />
                              : <span className="text-xs font-bold text-primary">{tutor.full_name?.[0]?.toUpperCase()}</span>
                            }
                          </div>
                          <div>
                            <p className="font-medium text-sm">{tutor.full_name}</p>
                            <p className="text-xs text-muted-foreground">{tutor.professional_title || tutor.tagline || '/tutors/' + tutor.slug}</p>
                            {tutor.user_id && (
                              <span className="text-[10px] text-green-600 flex items-center gap-0.5 mt-0.5">
                                <UserCheck className="w-3 h-3" /> Linked account
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {(tutor.subjects || []).slice(0, 3).map((s, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-full bg-primary/8 text-primary text-[10px] font-medium">{s}</span>
                          ))}
                          {(tutor.subjects || []).length > 3 && (
                            <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px]">+{tutor.subjects.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleVisibility.mutate({ id: tutor.id, is_visible: !tutor.is_visible })}
                          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                            tutor.is_visible
                              ? 'bg-green-500/10 text-green-700 border-green-500/20 hover:bg-green-500/20'
                              : 'bg-muted text-muted-foreground border-border hover:border-primary/30'
                          }`}
                        >
                          {tutor.is_visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          {tutor.is_visible ? 'Visible' : 'Hidden'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => { setEditing(tutor); setDialogOpen(true); }}>
                              <Edit className="w-4 h-4 mr-2" /> Edit Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a href={`/tutors/${tutor.slug}`} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-4 h-4 mr-2" /> View Public Page
                              </a>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => archiveMut.mutate(tutor.id)} className="text-destructive focus:text-destructive">
                              <Archive className="w-4 h-4 mr-2" /> Archive
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── ARCHIVED TAB ── */}
        {archivedTutors.length > 0 && (
          <TabsContent value="archived" className="mt-5">
            <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
              {archivedTutors.map(tutor => (
                <div key={tutor.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-muted-foreground">{tutor.full_name?.[0]?.toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-muted-foreground">{tutor.full_name}</p>
                    <p className="text-xs text-muted-foreground">{(tutor.subjects || []).join(', ')}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => updateMut.mutate({ id: tutor.id, data: { status: 'active', is_visible: true } })}>
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? `Edit — ${editing.full_name}` : 'Add New Tutor'}</DialogTitle>
          </DialogHeader>
          <TutorForm
            initial={editing || {}}
            onSave={handleSave}
            onClose={() => setDialogOpen(false)}
            isSaving={isSaving}
          />
        </DialogContent>
      </Dialog>

      {/* Application Review Dialog */}
      <ApplicationDialog
        app={reviewApp}
        onApprove={(id, notes) => appMut.mutate({ id, status: 'approved', notes })}
        onReject={(id, notes) => appMut.mutate({ id, status: 'rejected', notes })}
        onClose={() => setReviewApp(null)}
        isProcessing={appMut.isPending}
      />
    </div>
  );
}
