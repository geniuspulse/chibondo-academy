import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { FileText, Upload, CheckCircle2, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export default function MyAssignments() {
  const { user } = useOutletContext() ?? {};

  const { data: assignments = [] } = useQuery({
    queryKey: ['assignments'],
    queryFn: async () => { try { return await db.entities.Assignment.filter({ status: 'published' }, '-created_date', 100); } catch(e) { console.error(e); return []; } },
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ['mySubmissions', user?.id],
    queryFn: async () => { try { return await db.entities.AssignmentSubmission.filter({ student_id: user.id }, '-created_date', 100); } catch(e) { console.error(e); return []; } },
    enabled: !!user?.id,
  });

  const submissionMap = {};
  submissions.forEach(s => { submissionMap[s.assignment_id] = s; });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">My Assignments</h1>
        <p className="text-sm text-muted-foreground mt-1">View and submit your assignments</p>
      </div>

      <div className="space-y-3">
        {assignments.map(a => {
          const submission = submissionMap[a.id];
          const isOverdue = a.due_date && new Date(a.due_date) < new Date() && !submission;
          return (
            <div key={a.id} className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-start gap-4">
                <div className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  submission?.status === 'graded' ? 'bg-success/10' : isOverdue ? 'bg-destructive/10' : 'bg-primary/10'
                }`}>
                  {submission?.status === 'graded' ? <CheckCircle2 className="w-5 h-5 text-success" /> : 
                   isOverdue ? <Clock className="w-5 h-5 text-destructive" /> :
                   <FileText className="w-5 h-5 text-primary" />}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-sm">{a.title}</h3>
                  {a.description && <p className="text-xs text-muted-foreground mt-1">{a.description}</p>}
                  <div className="flex items-center gap-3 mt-2">
                    {a.due_date && (
                      <span className={`text-xs ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                        Due: {format(new Date(a.due_date), 'MMM d, yyyy')}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">Total: {a.total_marks} marks</span>
                  </div>
                </div>
                <div>
                  {submission ? (
                    <div className="text-right">
                      <Badge className={`text-[10px] ${
                        submission.status === 'graded' ? 'bg-success/10 text-success' : 'bg-accent/10 text-accent'
                      }`}>
                        {submission.status}
                      </Badge>
                      {submission.marks != null && (
                        <p className="text-sm font-bold text-primary mt-1">{submission.marks}/{a.total_marks}</p>
                      )}
                    </div>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">
                      <Upload className="w-2.5 h-2.5 mr-1" /> Pending
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {assignments.length === 0 && (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground">No assignments yet</p>
          </div>
        )}
      </div>
    </div>
  );
}