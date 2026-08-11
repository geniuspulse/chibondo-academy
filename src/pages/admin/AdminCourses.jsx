import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Plus, Edit2, Trash2, BookOpen, Layers, BookMarked,
  Loader2, Users, UserCheck, CheckCircle2, Clock, XCircle,
  Search, GraduationCap, ChevronRight, AlertTriangle, Settings
} from 'lucide-react';
import { toast } from 'sonner';

/* ─── helpers ────────────────────────────────────────────────────────────── */
const STATUS_STYLE = {
  published: 'bg-success/10 text-success border-success/20',
  draft:     'bg-muted text-muted-foreground border-border',
  pending:   'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  archived:  'bg-destructive/10 text-destructive border-destructive/20',
};

/* ─── Confirm dialog ─────────────────────────────────────────────────────── */
function ConfirmDialog({ open, title, message, onConfirm, onCancel, danger = false }) {
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {danger && <AlertTriangle className="w-5 h-5 text-destructive" />}
            {title}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button
            className={`flex-1 ${danger ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : ''}`}
            onClick={onConfirm}>
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Course card ────────────────────────────────────────────────────────── */
function CourseCard({ subject, topics, lessons, teachers, onEdit, onDelete, onApprove, onNavigate }) {
  const topicCount  = useMemo(() => topics.filter(t => t.subject_id === subject.id).length,  [topics, subject.id]);
  const lessonCount = useMemo(() => lessons.filter(l => l.subject_id === subject.id).length, [lessons, subject.id]);
  const teacher     = teachers.find(t => t.id === subject.teacher_id);

  return (
    <div className="bg-card rounded-xl border border-border p-5 flex flex-col gap-3 hover:border-primary/30 transition-all">
      {/* Status + actions */}
      <div className="flex items-start justify-between gap-2">
        <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <Badge className={`text-[10px] border ${STATUS_STYLE[subject.status] || STATUS_STYLE.draft}`}>
            {subject.status}
          </Badge>
          {subject.pending_approval && subject.status === 'draft' && (
            <Badge className="text-[10px] border bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
              Awaiting Approval
            </Badge>
          )}
        </div>
      </div>

      {/* Name + form */}
      <div className="flex-1">
        <h3 className="font-semibold text-sm leading-snug">{subject.name}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{subject.form_name}</p>
        {teacher && (
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <UserCheck className="w-3 h-3" /> {teacher.full_name}
          </p>
        )}
      </div>

      {/* Live counts */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground border-t border-border pt-3">
        <span className="flex items-center gap-1">
          <Layers className="w-3.5 h-3.5" />
          <span className="font-semibold text-foreground">{topicCount}</span> topics
        </span>
        <span className="flex items-center gap-1">
          <BookMarked className="w-3.5 h-3.5" />
          <span className="font-semibold text-foreground">{lessonCount}</span> lessons
        </span>
        {subject.enrollment_count > 0 && (
          <span className="flex items-center gap-1 ml-auto">
            <Users className="w-3.5 h-3.5" />
            <span className="font-semibold text-foreground">{subject.enrollment_count}</span>
          </span>
        )}
      </div>

      {/* Action row */}
      <div className="flex gap-2 pt-1">
        {subject.pending_approval && subject.status === 'draft' ? (
          <Button size="sm" className="flex-1 bg-success/90 hover:bg-success text-white"
            onClick={() => onApprove(subject)}>
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="flex-1"
            onClick={() => onNavigate(`/teacher/courses/${subject.id}`)}>
            <Settings className="w-3.5 h-3.5 mr-1" /> Builder
          </Button>
        )}
        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0"
          onClick={() => onEdit(subject)}>
          <Edit2 className="w-3.5 h-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
          onClick={() => onDelete(subject)}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

/* ─── MAIN PAGE ─────────────────────────────────────────────────────────────── */
export default function AdminCourses() {
  const queryClient = useQueryClient();
  const navigate    = useNavigate();
  const [tab,        setTab]        = useState('all');
  const [search,     setSearch]     = useState('');
  const [filterForm, setFilterForm] = useState('all');
  const [open,       setOpen]       = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [delTarget,  setDelTarget]  = useState(null);

  const empty = {
    name: '', description: '', form_id: '', teacher_id: '',
    is_premium: true, status: 'draft', order: 0,
    pending_approval: false,
  };
  const [formData, setFormData] = useState(empty);

  /* ── Data ── */
  const { data: subjects = [], isLoading: loadingSubjects } = useQuery({queryKey: ['adminSubjects'],
    queryFn: async () => { try { return await db.entities.Subject.list('order', 300); } catch(e) { console.error(e); return []; } },
    staleTime: 30_000,
    refetchInterval: 60_000,
    placeholderData: [],
  });

  const { data: forms = [] } = useQuery({queryKey: ['forms'],
    queryFn: async () => { try { return await db.entities.AcademicForm.list('order', 50); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });

  const { data: teachers = [] } = useQuery({queryKey: ['teachers'],
    queryFn: async () => { try { return await db.entities.User.filter({ role: 'teacher' }); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });

  /* Live topic counts for ALL subjects */
  const { data: topics = [], isLoading: loadingTopics } = useQuery({queryKey: ['allTopicsAdmin'],
    queryFn: async () => { try { return await db.entities.Topic.list('order', 1000); } catch(e) { console.error(e); return []; } },
    staleTime: 30_000,
    refetchInterval: 60_000,
    placeholderData: [],
  });

  /* Live lesson counts */
  const { data: lessons = [], isLoading: loadingLessons } = useQuery({queryKey: ['allLessonsAdmin'],
    queryFn: async () => { try { return await db.entities.Lesson.list('order', 3000); } catch(e) { console.error(e); return []; } },
    staleTime: 30_000,
    refetchInterval: 60_000,
    placeholderData: [],
  });

  /* ── Derived ── */
  const pendingSubjects = useMemo(
    () => subjects.filter(s => s.pending_approval && s.status === 'draft'),
    [subjects]
  );

  const filteredSubjects = useMemo(() => {
    let list = subjects;
    if (tab === 'published') list = list.filter(s => s.status === 'published');
    if (tab === 'draft')     list = list.filter(s => s.status === 'draft' && !s.pending_approval);
    if (tab === 'pending')   list = list.filter(s => s.pending_approval && s.status === 'draft');
    if (tab === 'archived')  list = list.filter(s => s.status === 'archived');
    if (filterForm !== 'all') list = list.filter(s => s.form_id === filterForm);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        s.form_name?.toLowerCase().includes(q) ||
        s.teacher_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [subjects, tab, filterForm, search]);

  const stats = useMemo(() => [
    { label: 'Total',     value: subjects.length,                                     color: 'text-primary bg-primary/10',   icon: BookOpen },
    { label: 'Published', value: subjects.filter(s => s.status === 'published').length, color: 'text-success bg-success/10',  icon: CheckCircle2 },
    { label: 'Pending',   value: pendingSubjects.length,                               color: 'text-yellow-600 bg-yellow-500/10', icon: Clock },
    { label: 'Topics',    value: topics.length,                                        color: 'text-accent bg-accent/10',    icon: Layers },
    { label: 'Lessons',   value: lessons.length,                                       color: 'text-primary bg-primary/10',  icon: BookMarked },
  ], [subjects, pendingSubjects, topics, lessons]);

  /* ── Mutations ── */
  const saveMutation = useMutation({
    mutationFn: () => {
      const sf = forms.find(f => f.id === formData.form_id);
      const st = teachers.find(t => t.id === formData.teacher_id);
      const data = {
        ...formData,
        form_name:    sf?.name    || '',
        teacher_name: st?.full_name || '',
      };
      return editing
        ? db.entities.Subject.update(editing.id, data)
        : db.entities.Subject.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSubjects'] });
      closeDialog();
      toast.success(editing ? 'Course updated' : 'Course created');
    },
    onError: () => toast.error('Failed to save course'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => db.entities.Subject.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSubjects'] });
      setDelTarget(null);
      toast.success('Course deleted');
    },
    onError: () => toast.error('Delete failed — course may have enrolled students'),
  });

  const approveMutation = useMutation({
    mutationFn: (s) => db.entities.Subject.update(s.id, { status: 'published', pending_approval: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSubjects'] });
      toast.success('Course approved and published');
    },
  });

  /* ── Helpers ── */
  const openEdit = (s) => {
    setEditing(s);
    setFormData({
      name:             s.name || '',
      description:      s.description || '',
      form_id:          s.form_id || '',
      teacher_id:       s.teacher_id || '',
      is_premium:       s.is_premium ?? true,
      status:           s.status || 'draft',
      order:            s.order || 0,
      pending_approval: s.pending_approval || false,
    });
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditing(null);
    setFormData(empty);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">Courses</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all platform courses — create, edit, approve, and delete
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> Add Course
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map(s => (
          <div key={s.label} className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${s.color}`}>
              <s.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xl font-bold font-heading">
                {loadingSubjects || loadingTopics || loadingLessons
                  ? <span className="inline-block w-6 h-5 rounded bg-muted animate-pulse" />
                  : s.value}
              </p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-8 h-9"
            placeholder="Search courses..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterForm} onValueChange={setFilterForm}>
          <SelectTrigger className="h-9 w-36">
            <GraduationCap className="w-4 h-4 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="All forms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Forms</SelectItem>
            {forms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="all">
            All
            <Badge className="ml-1.5 text-[10px] bg-muted text-muted-foreground border-0">
              {subjects.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="published">Published</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="pending">
            Pending
            {pendingSubjects.length > 0 && (
              <Badge className="ml-1.5 text-[10px] bg-yellow-500/10 text-yellow-600 border-0">
                {pendingSubjects.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>

        {/* ── Pending approval banner ── */}
        {tab === 'pending' && pendingSubjects.length > 0 && (
          <div className="mt-4 bg-yellow-500/8 border border-yellow-500/25 rounded-xl p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-yellow-700">
                {pendingSubjects.length} course{pendingSubjects.length !== 1 ? 's' : ''} waiting for approval
              </p>
              <p className="text-xs text-yellow-600/80 mt-0.5">
                These were proposed by teachers. Approve to publish or edit before approving.
              </p>
            </div>
          </div>
        )}

        {['all','published','draft','pending','archived'].map(t => (
          <TabsContent key={t} value={t} className="mt-4">
            {loadingSubjects ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="h-52 bg-card rounded-xl border border-border animate-pulse" />
                ))}
              </div>
            ) : filteredSubjects.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-border rounded-xl text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto opacity-20 mb-3" />
                <p className="font-medium">No courses found</p>
                {t === 'pending' && <p className="text-xs mt-1">No proposals awaiting review</p>}
                {t === 'all'     && <Button size="sm" className="mt-4" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> Add First Course</Button>}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredSubjects.map(s => (
                  <CourseCard
                    key={s.id}
                    subject={s}
                    topics={topics}
                    lessons={lessons}
                    teachers={teachers}
                    onEdit={openEdit}
                    onDelete={s => setDelTarget(s)}
                    onApprove={s => approveMutation.mutate(s)}
                    onNavigate={navigate}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* ── Add / Edit Dialog ── */}
      <Dialog open={open} onOpenChange={v => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Course' : 'Add New Course'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <Label>Course Name *</Label>
              <Input
                className="mt-1"
                value={formData.name}
                onChange={e => setFormData(d => ({ ...d, name: e.target.value }))}
                placeholder="e.g. Mathematics Book 3"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                className="mt-1" rows={2}
                value={formData.description || ''}
                onChange={e => setFormData(d => ({ ...d, description: e.target.value }))}
                placeholder="What will students learn?"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Form / Class *</Label>
                <Select value={formData.form_id} onValueChange={v => setFormData(d => ({ ...d, form_id: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select form" /></SelectTrigger>
                  <SelectContent>
                    {forms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Assign Tutor</Label>
                <Select value={formData.teacher_id || '__none__'} onValueChange={v => setFormData(d => ({ ...d, teacher_id: v === '__none__' ? '' : v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select tutor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={v => setFormData(d => ({ ...d, status: v, pending_approval: v === 'draft' ? d.pending_approval : false }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Display Order</Label>
                <Input
                  type="number" className="mt-1"
                  value={formData.order}
                  onChange={e => setFormData(d => ({ ...d, order: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Switch
                id="is_premium"
                checked={formData.is_premium}
                onCheckedChange={v => setFormData(d => ({ ...d, is_premium: v }))}
              />
              <Label htmlFor="is_premium" className="cursor-pointer">
                Premium course (requires subscription)
              </Label>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={closeDialog}>Cancel</Button>
              <Button
                className="flex-1"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !formData.name || !formData.form_id}>
                {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                {editing ? 'Save Changes' : 'Create Course'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ── */}
      <ConfirmDialog
        open={!!delTarget}
        danger
        title="Delete Course"
        message={`Delete "${delTarget?.name}"? This cannot be undone. Topics and lessons inside it will become orphaned.`}
        onConfirm={() => delTarget && deleteMutation.mutate(delTarget.id)}
        onCancel={() => setDelTarget(null)}
      />
    </div>
  );
}
