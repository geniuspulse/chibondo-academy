import React from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { ClipboardList, PlayCircle, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function MyQuizzes() {
  const { user } = useOutletContext() ?? {};

  const { data: quizzes = [] } = useQuery({
    queryKey: ['availableQuizzes'],
    queryFn: async () => { try { return await db.entities.Quiz.filter({ status: 'published' }, '-created_date', 100); } catch(e) { console.error(e); return []; } },
  });

  const { data: attempts = [] } = useQuery({
    queryKey: ['myAttempts', user?.id],
    queryFn: async () => { try { return await db.entities.QuizAttempt.filter({ student_id: user.id }, '-created_date', 200); } catch(e) { console.error(e); return []; } },
    enabled: !!user?.id,
  });

  const attemptsByQuiz = {};
  attempts.forEach(a => {
    if (!attemptsByQuiz[a.quiz_id]) attemptsByQuiz[a.quiz_id] = [];
    attemptsByQuiz[a.quiz_id].push(a);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">My Quizzes</h1>
        <p className="text-sm text-muted-foreground mt-1">Test your knowledge</p>
      </div>

      <div className="space-y-3">
        {quizzes.map(quiz => {
          const quizAttempts = attemptsByQuiz[quiz.id] || [];
          const bestAttempt = quizAttempts.sort((a, b) => (b.percentage || 0) - (a.percentage || 0))[0];
          return (
            <div key={quiz.id} className="bg-card rounded-xl border border-border p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                <ClipboardList className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm">{quiz.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {quiz.questions?.length || 0} questions 
                  {quiz.time_limit_minutes > 0 && ` · ${quiz.time_limit_minutes} min`}
                  {quizAttempts.length > 0 && ` · ${quizAttempts.length} attempts`}
                </p>
              </div>
              {bestAttempt && (
                <div className="text-right mr-2">
                  <div className={`text-lg font-bold ${bestAttempt.passed ? 'text-success' : 'text-destructive'}`}>
                    {bestAttempt.percentage}%
                  </div>
                  <p className="text-[10px] text-muted-foreground">Best score</p>
                </div>
              )}
              <Link to={`/quiz/${quiz.id}`}>
                <Button size="sm" variant={quizAttempts.length > 0 ? "outline" : "default"}>
                  <PlayCircle className="w-3.5 h-3.5 mr-1" />
                  {quizAttempts.length > 0 ? 'Retake' : 'Start'}
                </Button>
              </Link>
            </div>
          );
        })}
        {quizzes.length === 0 && (
          <div className="text-center py-16">
            <ClipboardList className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground">No quizzes available yet</p>
          </div>
        )}
      </div>
    </div>
  );
}