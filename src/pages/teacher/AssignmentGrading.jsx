import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, CheckCircle2, Clock, Star } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function AssignmentGrading() {
  const { user } = useOutletContext() ?? {};
  const queryClient = useQueryClient();
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [marks, setMarks] = useState('');
  const [feedback, setFeedback] = useState('');

  const { data: assignments = [] } = useQuery({queryKey: ['teacherAssignments'],
    queryFn: async () => { try { return await db.entities.Assignment.list('-created_date', 100); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });

  const { data: submissions = [] } = useQuery({queryKey: ['allSubmissions'],
    queryFn: async () => { try { return await db.entities.AssignmentSubmission.list('-created_date', 200); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });

  const gradeMutation = useMutation({
    mutationFn: ({ id, data }) => db.entities.AssignmentSubmission.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allSubmissions'] });
      setSelectedSubmission(null);
      toast.success('Submission graded!');
    },
  });

  const assignmentMap = {};
  assignments.forEach(a => { assignmentMap[a.id] = a; });

  const openGrade = (sub) => {
    setSelectedSubmission(sub);
    setMarks(sub.marks || '');
    setFeedback(sub.feedback || '');
  };

  const handleGrade = () => {
    gradeMutation.mutate({
      id: selectedSubmission.id,
      data: { marks: Number(marks), feedback, graded_by: user.full_name, status: 'graded' },
    });
  };

  const pending = submissions.filter(s => s.status === 'submitted');
  const graded = submissions.filter(s => s.status === 'graded');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Assignment Grading</h1>
        <p className="text-sm text-muted-foreground mt-1">{pending.length} submissions awaiting grading</p>
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Pending Grading</h2>
          <div className="space-y-3">
            {pending.map(sub => {
              const assignment = assignmentMap[sub.assignment_id];
              return (
                <div key={sub.id} className="bg-card rounded-xl border border-border p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-sm font-bold text-accent flex-shrink-0">
                    {sub.student_name?.[0] || '?'}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-sm">{sub.student_name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {assignment?.title || 'Unknown Assignment'} · Submitted {format(new Date(sub.created_date), 'MMM d, h:mm a')}
                    </p>
                  </div>
                  <Badge className="bg-accent/10 text-accent text-[10px]">
                    <Clock className="w-2.5 h-2.5 mr-1" /> Pending
                  </Badge>
                  <Button size="sm" onClick={() => openGrade(sub)}>
                    <Star className="w-3.5 h-3.5 mr-1" /> Grade
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Graded */}
      {graded.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Graded ({graded.length})</h2>
          <div className="space-y-3">
            {graded.map(sub => {
              const assignment = assignmentMap[sub.assignment_id];
              return (
                <div key={sub.id} className="bg-card rounded-xl border border-border p-5 flex items-center gap-4 opacity-75">
                  <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center text-sm font-bold text-success flex-shrink-0">
                    {sub.student_name?.[0] || '?'}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-sm">{sub.student_name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{assignment?.title || 'Unknown Assignment'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">{sub.marks}/{assignment?.total_marks || 100}</p>
                    <p className="text-[10px] text-muted-foreground">Score</p>
                  </div>
                  <Badge className="bg-success/10 text-success text-[10px]">
                    <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> Graded
                  </Badge>
                  <Button size="sm" variant="outline" onClick={() => openGrade(sub)}>Edit</Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {submissions.length === 0 && (
        <div className="text-center py-16 bg-card rounded-xl border border-border">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
          <p className="text-muted-foreground text-sm">No submissions yet</p>
        </div>
      )}

      {/* Grading Dialog */}
      <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Grade Submission</DialogTitle>
          </DialogHeader>
          {selectedSubmission && (
            <div className="space-y-4 mt-4">
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-xs font-medium text-muted-foreground mb-1">Student's Response</p>
                <p className="text-sm leading-relaxed">{selectedSubmission.content || 'No written response'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Marks Awarded</Label>
                  <Input className="mt-1" type="number" value={marks} onChange={e => setMarks(e.target.value)} placeholder="e.g. 85" />
                </div>
              </div>
              <div>
                <Label>Feedback for Student</Label>
                <Textarea className="mt-1" rows={4} value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Provide helpful feedback..." />
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-border">
                <Button variant="outline" onClick={() => setSelectedSubmission(null)}>Cancel</Button>
                <Button onClick={handleGrade} disabled={gradeMutation.isPending || !marks}>
                  {gradeMutation.isPending ? 'Saving...' : 'Submit Grade'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}