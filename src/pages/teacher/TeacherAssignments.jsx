import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, FileText, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function TeacherAssignments() {
  const { user } = useOutletContext() ?? {};
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    instructions: '',
    subject_id: '',
    topic_id: '',
    lesson_id: '',
    due_date: '',
    total_marks: 100,
    status: 'draft',
    attachments: [],
  });

  const { data: assignments = [] } = useQuery({queryKey: ['teacherAssignments'],
    queryFn: async () => { try { return await db.entities.Assignment.list('-created_date', 100); } catch(e) { console.error(e); return []; } },
    placeholderData: [],});

  const { data: subjects = [] } = useQuery({queryKey: ['subjects'],
    queryFn: async () => { try { return await db.entities.Subject.filter({ status: 'published' }, 'order', 100); } catch(e) { console.error(e); return []; } },
    placeholderData: [],});

  const saveMutation = useMutation({
    mutationFn: (data) => db.entities.Assignment.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacherAssignments'] });
      setDialogOpen(false);
      setForm({
        title: '',
        description: '',
        instructions: '',
        subject_id: '',
        topic_id: '',
        lesson_id: '',
        due_date: '',
        total_marks: 100,
        status: 'draft',
        attachments: [],
      });
      toast.success('Assignment created!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => db.entities.Assignment.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacherAssignments'] });
      toast.success('Assignment deleted');
    },
  });

  const handleSubmit = () => {
    if (!form.title || !form.subject_id) {
      toast.error('Please fill in title and select a subject');
      return;
    }
    saveMutation.mutate(form);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Assignments</h1>
          <p className="text-sm text-muted-foreground mt-1">Create and manage assignments</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Assignment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Assignment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Assignment Title</Label>
                <Input
                  className="mt-1"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Chapter 5 Essay Questions"
                />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  className="mt-1"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description of the assignment"
                  rows={2}
                />
              </div>

              <div>
                <Label>Instructions for Students</Label>
                <Textarea
                  className="mt-1"
                  value={form.instructions}
                  onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                  placeholder="Detailed instructions..."
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Subject</Label>
                  <Select
                    value={form.subject_id}
                    onValueChange={(v) => setForm({ ...form, subject_id: v })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Total Marks</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    value={form.total_marks}
                    onChange={(e) => setForm({ ...form, total_marks: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <Label>Due Date (optional)</Label>
                <Input
                  type="datetime-local"
                  className="mt-1"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                />
              </div>

              <div>
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button className="w-full" onClick={handleSubmit} disabled={!form.title || !form.subject_id || saveMutation.isPending}>
                {saveMutation.isPending ? 'Creating...' : 'Create Assignment'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {assignments.map((assignment) => (
          <div
            key={assignment.id}
            className="bg-card rounded-xl border border-border p-4 flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-sm">{assignment.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {assignment.subject_name} · {assignment.total_marks} marks
                {assignment.due_date && ` · Due: ${new Date(assignment.due_date).toLocaleDateString()}`}
              </p>
            </div>
            <Badge className={assignment.status === 'published' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
              {assignment.status}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => deleteMutation.mutate(assignment.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
        {assignments.length === 0 && (
          <div className="text-center py-16 bg-card rounded-xl border border-border">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-muted-foreground text-sm">No assignments yet. Create your first assignment!</p>
          </div>
        )}
      </div>
    </div>
  );
}