import React, { useState, useMemo } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import {
  BookOpen, Settings, Plus, Loader2, Clock,
  CheckCircle2, XCircle, Layers, BookMarked, ChevronRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

const STATUS_STYLE = {
  published: 'bg-success/10 text-success border-success/20',
  draft:     'bg-muted text-muted-foreground border-border',
  pending:   'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  archived:  'bg-destructive/10 text-destructive border-destructive/20',
};

/* ─── Course card — pulls live topic & lesson counts from pre-fetched arrays ─ */
function CourseCard({ subject, topics, lessons, onManage }) {
  const topicCount  = useMemo(() => topics.filter(t => t.subject_id === subject.id).length,  [topics, subject.id]);
  const lessonCount = useMemo(() => lessons.filter(l => l.subject_id === subject.id).length, [lessons, subject.id]);

  return (
    <div className="bg-card rounded-xl border border-border p-5 hover:border-primary/30 transition-all flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <Badge className={`text-[10px] border ${STATUS_STYLE[subject.status] || STATUS_STYLE.draft}`}>
          {subject.status}
        </Badge>
      </div>

      {/* Title & form */}
      <div className="flex-1">
        <h3 className="font-semibold text-sm leading-snug">{subject.name}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{subject.form_name}</p>
      </div>

      {/* Live counts */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Layers className="w-3.5 h-3.5" />
          <span className="font-medium text-foreground">{topicCount}</span> topic{topicCount !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1">
          <BookMarked className="w-3.5 h-3.5" />
          <span className="font-medium text-foreground">{lessonCount}</span> lesson{lessonCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* CTA */}
      <Link to={`/teacher/courses/${subject.id}`}>
        <Button size="sm" className="w-full mt-1">
          <Settings className="w-3.5 h-3.5 mr-1.5" /> Course Builder
          <ChevronRight className="w-3.5 h-3.5 ml-auto" />
        </Button>
      </Link>
    </div>
  );
}

/* ─── MAIN PAGE ─────────────────────────────────────────────────────────────── */
export default function TeacherCourses() {
  const { user } = useOutletContext() ?? {};
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const empty = { name: '', description: '', form_id: '', is_premium: true, order: 0 };
  const [formData, setFormData] = useState(empty);

  /* Subjects assigned to this teacher */
  const { data: subjects = [], isLoading: loadingSubjects } = useQuery({queryKey: ['teacherSubjects', user?.id],
    queryFn: async () => { try { return await db.entities.Subject.filter({ teacher_id: user.id }, 'order', 100); } catch(e) { console.error(e); return []; } },
    enabled: !!user?.id,
    staleTime: 30_000,
    placeholderData: [],
  });

  /* Live topic counts — all topics for this teacher's subjects */
  const subjectIds = subjects.map(s => s.id);
  const { data: topics = [], isLoading: loadingTopics } = useQuery({queryKey: ['teacherTopics', subjectIds.join(',')],
    queryFn: async () => { try { if (!subjectIds.length) return [];
      const all = [];
      for (const sid of subjectIds) {
        const t = await db.entities.Topic.filter({ subject_id: sid }, 'order', 200);
        all.push(...t);
      }
      return all; } catch(e) { console.error(e); return []; } },
    enabled: subjectIds.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
    placeholderData: [],
  });

  /* Live lesson counts */
  const { data: lessons = [], isLoading: loadingLessons } = useQuery({queryKey: ['teacherLessons', subjectIds.join(',')],
    queryFn: async () => { try { if (!subjectIds.length) return [];
      const all = [];
      for (const sid of subjectIds) {
        const l = await db.entities.Lesson.filter({ subject_id: sid }, 'order', 500);
        all.push(...l);
      }
      return all; } catch(e) { console.error(e); return []; } },
    enabled: subjectIds.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
    placeholderData: [],
  });

  const { data: forms = [] } = useQuery({queryKey: ['forms'],
    queryFn: async () => { try { return await db.entities.AcademicForm.list('order', 50); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });

  const pendingCourses = subjects.filter(s => s.pending_approval && s.status === 'draft');
  const activeCourses  = subjects.filter(s => !s.pending_approval || s.status === 'published');

  const totalTopics  = topics.length;
  const totalLessons = lessons.length;

  const createCourseMutation = useMutation({
    mutationFn: () => {
      const selectedForm = forms.find(f => f.id === formData.form_id);
      return db.entities.Subject.create({
        ...formData,
        teacher_id:   user.id,
        teacher_name: user.full_name,
        form_name:    selectedForm?.name || '',
        status:       'draft',
        pending_approval: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacherSubjects'] });
      setOpen(false);
      setFormData(empty);
      toast.success('Course proposal submitted — awaiting admin approval');
    },
    onError: () => toast.error('Failed to submit proposal'),
  });

  const loading = loadingSubjects || loadingTopics || loadingLessons;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">My Courses</h1>
          <p className="text-sm text-muted-foreground mt-1">Your assigned courses with live content counts</p>
        </div>
        <Button onClick={() => setOpen(true)} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Propose Course
        </Button>
      </div>

      {/* Live summary bar */}
      {!loadingSubjects && subjects.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Courses', value: subjects.length,  icon: BookOpen,   color: 'text-primary bg-primary/10' },
            { label: 'Topics',  value: totalTopics,       icon: Layers,     color: 'text-accent bg-accent/10' },
            { label: 'Lessons', value: totalLessons,      icon: BookMarked, color: 'text-success bg-success/10' },
          ].map(s => (
            <div key={s.label} className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${s.color}`}>
                <s.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xl font-bold font-heading">
                  {loading ? <span className="inline-block w-6 h-5 bg-muted rounded animate-pulse" /> : s.value}
                </p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            Active
            <Badge className="ml-1.5 text-[10px] bg-primary/10 text-primary border-0">
              {activeCourses.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending Approval
            {pendingCourses.length > 0 && (
              <Badge className="ml-1.5 text-[10px] bg-yellow-500/10 text-yellow-600 border-0">
                {pendingCourses.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── ACTIVE ── */}
        <TabsContent value="active" className="mt-4">
          {loadingSubjects ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3].map(i => (
                <div key={i} className="h-48 bg-card rounded-xl border border-border animate-pulse" />
              ))}
            </div>
          ) : activeCourses.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl">
              <BookOpen className="w-12 h-12 mx-auto opacity-20 mb-3" />
              <p className="font-medium">No courses assigned yet</p>
              <p className="text-xs mt-1">Propose a new course or wait for admin to assign one</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setOpen(true)}>
                <Plus className="w-4 h-4 mr-1" /> Propose a Course
              </Button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeCourses.map(s => (
                <CourseCard
                  key={s.id}
                  subject={s}
                  topics={topics}
                  lessons={lessons}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── PENDING ── */}
        <TabsContent value="pending" className="mt-4">
          <div className="space-y-3">
            {pendingCourses.map(s => (
              <div key={s.id} className="bg-card border border-yellow-500/20 rounded-xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.form_name} · Submitted {new Date(s.created_date).toLocaleDateString()}
                  </p>
                </div>
                <Badge className="bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 text-[10px]">
                  Awaiting Approval
                </Badge>
              </div>
            ))}
            {pendingCourses.length === 0 && (
              <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
                No pending proposals
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Propose Course Dialog */}
      <Dialog open={open} onOpenChange={v => { if (!v) { setOpen(false); setFormData(empty); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Propose a New Course</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            Your proposal will be reviewed by an admin before going live.
          </p>
          <div className="space-y-4 pt-1">
            <div>
              <Label>Course Name</Label>
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
            <div>
              <Label>Form / Class Level</Label>
              <Select value={formData.form_id} onValueChange={v => setFormData(d => ({ ...d, form_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select form" /></SelectTrigger>
                <SelectContent>
                  {forms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1"
                onClick={() => { setOpen(false); setFormData(empty); }}>
                Cancel
              </Button>
              <Button className="flex-1"
                onClick={() => createCourseMutation.mutate()}
                disabled={createCourseMutation.isPending || !formData.name || !formData.form_id}>
                {createCourseMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                Submit Proposal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
