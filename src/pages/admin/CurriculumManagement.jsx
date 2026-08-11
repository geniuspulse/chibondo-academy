import React, { useState } from 'react';
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Plus, Edit2, Trash2, GraduationCap, BookOpen, Layers,
  BookMarked, Loader2, Users, UserCheck, CheckCircle2, Clock
} from 'lucide-react';
import { toast } from 'sonner';

// ─── FORM MANAGER ─────────────────────────────────────────────────────────────
function FormManager() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const empty = { name: '', description: '', order: 0, status: 'active' };
  const [form, setForm] = useState(empty);

  const { data: forms = [] } = useQuery({queryKey: ['forms'], queryFn: async () => { try { return await db.entities.AcademicForm.list('order', 50); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });
  const { data: subjects = [] } = useQuery({queryKey: ['allSubjects'], queryFn: async () => { try { return await db.entities.Subject.list('order', 200); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });

  const saveMutation = useMutation({
    mutationFn: () => editing ? db.entities.AcademicForm.update(editing.id, form) : db.entities.AcademicForm.create(form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['forms'] }); closeDialog(); toast.success(editing ? 'Form updated' : 'Form created'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => db.entities.AcademicForm.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['forms'] }); toast.success('Form deleted'); },
  });

  const openEdit = (f) => { setEditing(f); setForm(f); setOpen(true); };
  const closeDialog = () => { setOpen(false); setEditing(null); setForm(empty); };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-base">Academic Forms / Classes</h3>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> Add Form</Button>
      </div>
      <div className="space-y-3">
        {forms.map(f => {
          const subjectCount = subjects.filter(s => s.form_id === f.id).length;
          return (
            <div key={f.id} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">{f.name}</p>
                <p className="text-xs text-muted-foreground">{f.description || 'No description'} · {subjectCount} subject{subjectCount !== 1 ? 's' : ''}</p>
              </div>
              <Badge variant="secondary" className={`text-[10px] ${f.status === 'active' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                {f.status}
              </Badge>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(f)}><Edit2 className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(f.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          );
        })}
        {forms.length === 0 && <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border rounded-xl">No forms yet. Click "Add Form" to create one.</div>}
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Form' : 'New Academic Form'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div><Label>Form Name</Label><Input className="mt-1" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Form 3" /></div>
            <div><Label>Description</Label><Textarea className="mt-1" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief description..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Display Order</Label><Input type="number" className="mt-1" value={form.order} onChange={e => setForm({ ...form, order: parseInt(e.target.value) || 0 })} /></div>
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="coming_soon">Coming Soon</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={closeDialog}>Cancel</Button>
              <Button className="flex-1" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                {editing ? 'Save Changes' : 'Create Form'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── COURSE (SUBJECT) MANAGER ─────────────────────────────────────────────────
function CourseManager() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterForm, setFilterForm] = useState('all');
  const empty = { name: '', description: '', form_id: '', teacher_id: '', is_premium: true, status: 'draft', order: 0 };
  const [formData, setFormData] = useState(empty);

  const { data: forms = [] } = useQuery({queryKey: ['forms'], queryFn: async () => { try { return await db.entities.AcademicForm.list('order', 50); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });
  const { data: subjects = [] } = useQuery({queryKey: ['allSubjects'], queryFn: async () => { try { return await db.entities.Subject.list('order', 200); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });
  const { data: teachers = [] } = useQuery({queryKey: ['teachers'], queryFn: async () => { try { return await db.entities.User.filter({ role: 'teacher' }); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });
  const { data: enrollments = [] } = useQuery({queryKey: ['allEnrollments'], queryFn: async () => { try { return await db.entities.Enrollment.list('-created_date', 5000); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const selectedForm = forms.find(f => f.id === formData.form_id);
      const selectedTeacher = teachers.find(t => t.id === formData.teacher_id);
      const data = { ...formData, form_name: selectedForm?.name || '', teacher_name: selectedTeacher?.full_name || '' };
      return editing ? db.entities.Subject.update(editing.id, data) : db.entities.Subject.create(data);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['allSubjects'] });
      closeDialog();
      if (!editing && result?.id) {
        toast.success('Course created — opening Course Builder…');
        navigate(`/teacher/courses/${result.id}`);
      } else {
        toast.success('Course updated');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => db.entities.Subject.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['allSubjects'] }); toast.success('Course deleted'); },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }) => db.entities.Subject.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['allSubjects'] }),
  });

  const openEdit = (s) => { setEditing(s); setFormData(s); setOpen(true); };
  const closeDialog = () => { setOpen(false); setEditing(null); setFormData(empty); };
  const filteredSubjects = filterForm === 'all' ? subjects : subjects.filter(s => s.form_id === filterForm);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-base">Courses by Form</h3>
        <div className="flex gap-2">
          <Select value={filterForm} onValueChange={setFilterForm}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="All Forms" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Forms</SelectItem>
              {forms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> New Course</Button>
        </div>
      </div>

      {forms.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
          No forms found. Create forms in the Classes tab first.
        </div>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {forms.map(f => {
            const formSubjects = filteredSubjects.filter(s => s.form_id === f.id);
            if (filterForm !== 'all' && f.id !== filterForm) return null;
            return (
              <AccordionItem key={f.id} value={f.id} className="border border-border rounded-xl overflow-hidden bg-card">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="w-4 h-4 text-primary" />
                    <span className="font-semibold">{f.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{formSubjects.length} courses</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-2 mt-2">
                    {formSubjects.map(s => {
                      const enrolled = enrollments.filter(e => e.subject_id === s.id).length;
                      return (
                        <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-background">
                          <BookOpen className="w-4 h-4 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{s.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {s.teacher_name || 'No tutor assigned'} · {s.total_lessons || 0} lessons · {enrolled} students
                            </p>
                          </div>
                          <Badge className={`text-[9px] ${s.is_premium ? 'bg-accent/10 text-accent' : 'bg-success/10 text-success'}`}>
                            {s.is_premium ? 'Premium' : 'Free'}
                          </Badge>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground">{s.status}</span>
                            <Switch
                              checked={s.status === 'published'}
                              onCheckedChange={(v) => toggleStatusMutation.mutate({ id: s.id, status: v ? 'published' : 'draft' })}
                              className="scale-75"
                            />
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Open Course Builder" onClick={() => navigate(`/teacher/courses/${s.id}`)}><Edit2 className="w-3 h-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(s.id)}><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        </div>
                      );
                    })}
                    {formSubjects.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-3">No courses in {f.name}</p>
                    )}
                    <Button variant="ghost" size="sm" className="w-full mt-1 text-xs border border-dashed border-border"
                      onClick={() => { setFormData({ ...empty, form_id: f.id }); setOpen(true); }}>
                      <Plus className="w-3 h-3 mr-1" /> Add course to {f.name}
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Course' : 'Create New Course'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div><Label>Course Name</Label><Input className="mt-1" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Mathematics" /></div>
            <div><Label>Description</Label><Textarea className="mt-1" value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} placeholder="Course overview..." /></div>
            <div>
              <Label>Thumbnail URL</Label>
              {formData.cover_image && (
                <div className="mt-1 mb-2 rounded-lg overflow-hidden h-28 bg-muted">
                  <img src={formData.cover_image} alt="thumbnail" className="w-full h-full object-cover" />
                </div>
              )}
              <Input className="mt-1" value={formData.cover_image || ''} onChange={e => setFormData({ ...formData, cover_image: e.target.value })} placeholder="https://… or leave blank" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Form / Class Level</Label>
                <Select value={formData.form_id || ''} onValueChange={v => setFormData({ ...formData, form_id: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select form" /></SelectTrigger>
                  <SelectContent>{forms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Assign Tutor</Label>
                <Select value={formData.teacher_id || 'none'} onValueChange={v => setFormData({ ...formData, teacher_id: v === 'none' ? '' : v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="No tutor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No tutor assigned</SelectItem>
                    {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Status</Label>
                <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Display Order</Label><Input type="number" className="mt-1" value={formData.order || 0} onChange={e => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div>
                <p className="text-sm font-medium">Premium Course</p>
                <p className="text-xs text-muted-foreground">Requires paid fees to access</p>
              </div>
              <Switch checked={formData.is_premium !== false} onCheckedChange={v => setFormData({ ...formData, is_premium: v })} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={closeDialog}>Cancel</Button>
              <Button className="flex-1" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !formData.name || !formData.form_id}>
                {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                {editing ? 'Save Changes' : 'Create Course'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── TOPIC MANAGER ─────────────────────────────────────────────────────────────
function TopicManager() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterSubject, setFilterSubject] = useState('all');
  const empty = { title: '', description: '', subject_id: '', form_id: '', order: 0, status: 'draft' };
  const [formData, setFormData] = useState(empty);

  const { data: subjects = [] } = useQuery({queryKey: ['allSubjects'], queryFn: async () => { try { return await db.entities.Subject.list('order', 200); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });
  const { data: topics = [] } = useQuery({queryKey: ['allTopics'], queryFn: async () => { try { return await db.entities.Topic.list('order', 1000); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });
  const { data: lessons = [] } = useQuery({queryKey: ['allLessons'], queryFn: async () => { try { return await db.entities.Lesson.list('order', 1000); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const sub = subjects.find(s => s.id === formData.subject_id);
      const data = { ...formData, subject_name: sub?.name || '', form_id: sub?.form_id || '' };
      return editing ? db.entities.Topic.update(editing.id, data) : db.entities.Topic.create(data);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['allTopics'] }); closeDialog(); toast.success(editing ? 'Topic updated' : 'Topic created'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => db.entities.Topic.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['allTopics'] }); toast.success('Topic deleted'); },
  });

  const openEdit = (t) => { setEditing(t); setFormData(t); setOpen(true); };
  const closeDialog = () => { setOpen(false); setEditing(null); setFormData(empty); };
  const filteredTopics = filterSubject === 'all' ? topics : topics.filter(t => t.subject_id === filterSubject);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-base">Topics</h3>
        <div className="flex gap-2">
          <Select value={filterSubject} onValueChange={setFilterSubject}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="All Subjects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.form_name})</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> Add Topic</Button>
        </div>
      </div>
      <div className="space-y-2">
        {filteredTopics.map(t => {
          const lessonCount = lessons.filter(l => l.topic_id === t.id).length;
          return (
            <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
              <Layers className="w-4 h-4 text-accent flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{t.title}</p>
                <p className="text-xs text-muted-foreground">{t.subject_name} · {lessonCount} lesson{lessonCount !== 1 ? 's' : ''}</p>
              </div>
              <Badge className={`text-[9px] ${t.status === 'published' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{t.status}</Badge>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}><Edit2 className="w-3 h-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(t.id)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          );
        })}
        {filteredTopics.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-xl">No topics found.</div>}
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Topic' : 'New Topic'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div><Label>Topic Title</Label><Input className="mt-1" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="e.g. Algebra Basics" /></div>
            <div><Label>Description</Label><Textarea className="mt-1" value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Subject</Label>
                <Select value={formData.subject_id || ''} onValueChange={v => setFormData({ ...formData, subject_id: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.form_name})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Order</Label><Input type="number" className="mt-1" value={formData.order || 0} onChange={e => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div><Label>Status</Label>
              <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={closeDialog}>Cancel</Button>
              <Button className="flex-1" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !formData.title || !formData.subject_id}>
                {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                {editing ? 'Save Changes' : 'Create Topic'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── PENDING COURSE APPROVALS ─────────────────────────────────────────────────
function PendingApprovals() {
  const queryClient = useQueryClient();
  const { data: subjects = [] } = useQuery({queryKey: ['allSubjects'], queryFn: async () => { try { return await db.entities.Subject.filter({ pending_approval: true }); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });
  const { data: teachers = [] } = useQuery({queryKey: ['teachers'], queryFn: async () => { try { return await db.entities.User.filter({ role: 'teacher' }); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });

  const approveMutation = useMutation({
    mutationFn: (id) => db.entities.Subject.update(id, { status: 'published', pending_approval: false }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['allSubjects'] }); toast.success('Course approved and published'); },
  });

  const rejectMutation = useMutation({
    mutationFn: (id) => db.entities.Subject.update(id, { status: 'archived', pending_approval: false }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['allSubjects'] }); toast.success('Course rejected'); },
  });

  const pendingCourses = subjects.filter(s => s.pending_approval && s.status === 'draft');

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Review and approve courses proposed by tutors</p>
      {pendingCourses.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-success opacity-40" />
          No pending proposals
        </div>
      ) : (
        <div className="space-y-3">
          {pendingCourses.map(s => {
            const tutor = teachers.find(t => t.id === s.teacher_id);
            return (
              <div key={s.id} className="border border-yellow-500/20 rounded-xl bg-card p-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Proposed by <strong>{tutor?.full_name || s.teacher_name || 'Unknown Tutor'}</strong> · Form: {s.form_name || 'Not set'} · {new Date(s.created_date).toLocaleDateString()}
                    </p>
                    {s.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</p>}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10"
                      onClick={() => rejectMutation.mutate(s.id)} disabled={rejectMutation.isPending}>Reject</Button>
                    <Button size="sm" className="bg-success hover:bg-success/90 text-white"
                      onClick={() => approveMutation.mutate(s.id)} disabled={approveMutation.isPending}>
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── TUTOR ALLOCATION ─────────────────────────────────────────────────────────
function TutorAllocation() {
  const queryClient = useQueryClient();
  const { data: teachers = [] } = useQuery({queryKey: ['teachers'], queryFn: async () => { try { return await db.entities.User.filter({ role: 'teacher' }); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });
  const { data: subjects = [] } = useQuery({queryKey: ['allSubjects'], queryFn: async () => { try { return await db.entities.Subject.list('order', 200); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });
  const { data: enrollments = [] } = useQuery({queryKey: ['allEnrollments'], queryFn: async () => { try { return await db.entities.Enrollment.list('-created_date', 5000); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });

  const reassignMutation = useMutation({
    mutationFn: ({ subjectId, teacherId, teacherName }) =>
      db.entities.Subject.update(subjectId, { teacher_id: teacherId, teacher_name: teacherName }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['allSubjects'] }); toast.success('Tutor reassigned'); },
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Assign or reassign tutors to courses.</p>
      {teachers.length === 0 && (
        <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
          No tutors found. Approve teacher applications first.
        </div>
      )}
      {teachers.map(teacher => {
        const assignedCourses = subjects.filter(s => s.teacher_id === teacher.id);
        const totalStudents = assignedCourses.reduce((sum, s) => sum + enrollments.filter(e => e.subject_id === s.id).length, 0);
        return (
          <div key={teacher.id} className="border border-border rounded-xl bg-card overflow-hidden">
            <div className="flex items-center gap-4 p-4 bg-muted/20">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm flex-shrink-0">
                {teacher.full_name?.[0]?.toUpperCase() || 'T'}
              </div>
              <div className="flex-1">
                <p className="font-semibold">{teacher.full_name}</p>
                <p className="text-xs text-muted-foreground">{teacher.email} · {assignedCourses.length} courses · {totalStudents} students</p>
              </div>
              <Badge className="bg-success/10 text-success text-[10px]">Active Tutor</Badge>
            </div>
            {assignedCourses.length > 0 && (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {assignedCourses.map(s => (
                  <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg border border-border/50 text-sm">
                    <BookOpen className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <span className="flex-1 truncate">{s.name}</span>
                    <span className="text-xs text-muted-foreground">{s.form_name}</span>
                  </div>
                ))}
              </div>
            )}
            {assignedCourses.length === 0 && (
              <div className="px-4 pb-4 pt-2 text-xs text-muted-foreground">No courses assigned yet.</div>
            )}
          </div>
        );
      })}
      <div className="mt-4">
        <h4 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wide">Unassigned Courses</h4>
        <div className="space-y-2">
          {subjects.filter(s => !s.teacher_id).map(s => (
            <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
              <BookOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-sm">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.form_name}</p>
              </div>
              <Select onValueChange={v => {
                const t = teachers.find(t => t.id === v);
                reassignMutation.mutate({ subjectId: s.id, teacherId: v, teacherName: t?.full_name || '' });
              }}>
                <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Assign tutor" /></SelectTrigger>
                <SelectContent>{teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ))}
          {subjects.filter(s => !s.teacher_id).length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">All courses have tutors assigned.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── COURSE ENROLLMENTS ───────────────────────────────────────────────────────
function CourseEnrollments() {
  const [selectedSubject, setSelectedSubject] = useState('');
  const { data: subjects = [] } = useQuery({queryKey: ['allSubjects'], queryFn: async () => { try { return await db.entities.Subject.list('order', 200); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });
  const { data: enrollments = [] } = useQuery({queryKey: ['allEnrollments'], queryFn: async () => { try { return await db.entities.Enrollment.list('-created_date', 5000); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });
  const { data: students = [] } = useQuery({queryKey: ['allStudents'], queryFn: async () => { try { return await db.entities.User.filter({}); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });
  const { data: users = [] } = useQuery({queryKey: ['allUsers'], queryFn: async () => { try { return await db.entities.User.filter({ role: 'user' }); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });

  const courseEnrollments = selectedSubject ? enrollments.filter(e => e.subject_id === selectedSubject) : [];

  const getStudentName = (studentId) => {
    const sp = students.find(s => s.user_id === studentId);
    if (sp?.full_name) return sp.full_name;
    const u = users.find(u => u.id === studentId);
    return u?.full_name || 'Unknown Student';
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Select Course to View Enrollments</Label>
        <Select value={selectedSubject} onValueChange={setSelectedSubject}>
          <SelectTrigger className="mt-1 max-w-sm"><SelectValue placeholder="Choose a course..." /></SelectTrigger>
          <SelectContent>
            {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.form_name})</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {selectedSubject && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">{courseEnrollments.length} Enrolled Students</span>
          </div>
          {courseEnrollments.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
              No students enrolled in this course yet.
            </div>
          ) : (
            <div className="space-y-2">
              {courseEnrollments.map(e => (
                <div key={e.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                    {getStudentName(e.student_id)?.[0]?.toUpperCase() || 'S'}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{getStudentName(e.student_id)}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.completed_lessons?.length || 0} lessons completed · Last active {e.last_accessed ? new Date(e.last_accessed).toLocaleDateString() : 'Never'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{e.progress_percentage || 0}%</p>
                    <Badge className={`text-[9px] ${e.status === 'active' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{e.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function CurriculumManagement() {
  const { data: subjects = [] } = useQuery({queryKey: ['allSubjects'], queryFn: async () => { try { return await db.entities.Subject.list('order', 200); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });
  const { data: forms = [] } = useQuery({queryKey: ['forms'], queryFn: async () => { try { return await db.entities.AcademicForm.list('order', 50); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });
  const { data: topics = [] } = useQuery({queryKey: ['allTopics'], queryFn: async () => { try { return await db.entities.Topic.list('order', 1000); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });
  const { data: teachers = [] } = useQuery({queryKey: ['teachers'], queryFn: async () => { try { return await db.entities.User.filter({ role: 'teacher' }); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });
  const { data: enrollments = [] } = useQuery({queryKey: ['allEnrollments'], queryFn: async () => { try { return await db.entities.Enrollment.list('-created_date', 5000); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });
  const { data: lessons = [] } = useQuery({queryKey: ['allLessons'], queryFn: async () => { try { return await db.entities.Lesson.filter({}); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });

  const stats = [
    { label: 'Classes', value: forms.length, icon: GraduationCap, color: 'text-primary bg-primary/10' },
    { label: 'Courses', value: subjects.length, icon: BookOpen, color: 'text-accent bg-accent/10' },
    { label: 'Topics', value: topics.length, icon: Layers, color: 'text-success bg-success/10' },
    { label: 'Lessons', value: lessons.length, icon: BookMarked, color: 'text-destructive bg-destructive/10' },
    { label: 'Tutors', value: teachers.length, icon: UserCheck, color: 'text-primary bg-primary/10' },
    { label: 'Enrollments', value: enrollments.length, icon: Users, color: 'text-accent bg-accent/10' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Courses</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage classes, courses, topics, tutors, and student enrollments</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map(s => (
          <div key={s.label} className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${s.color}`}>
              <s.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xl font-bold font-heading">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="courses">
        <TabsList className="flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="courses"><BookOpen className="w-4 h-4 mr-1.5" /> Courses</TabsTrigger>
          <TabsTrigger value="classes"><GraduationCap className="w-4 h-4 mr-1.5" /> Classes</TabsTrigger>
          <TabsTrigger value="topics"><Layers className="w-4 h-4 mr-1.5" /> Topics</TabsTrigger>
          <TabsTrigger value="approvals"><Clock className="w-4 h-4 mr-1.5" /> Approvals</TabsTrigger>
          <TabsTrigger value="tutors"><UserCheck className="w-4 h-4 mr-1.5" /> Tutors</TabsTrigger>
          <TabsTrigger value="enrollments"><Users className="w-4 h-4 mr-1.5" /> Enrollments</TabsTrigger>
        </TabsList>
        <TabsContent value="courses" className="mt-5"><CourseManager /></TabsContent>
        <TabsContent value="classes" className="mt-5"><FormManager /></TabsContent>
        <TabsContent value="topics" className="mt-5"><TopicManager /></TabsContent>
        <TabsContent value="approvals" className="mt-5"><PendingApprovals /></TabsContent>
        <TabsContent value="tutors" className="mt-5"><TutorAllocation /></TabsContent>
        <TabsContent value="enrollments" className="mt-5"><CourseEnrollments /></TabsContent>
      </Tabs>
    </div>
  );
}