import { SectionLoader } from '@/components/BrandedSpinner';
import React, { useState, useEffect } from 'react';
import { useParams, useOutletContext, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, Clock, CheckCircle2, XCircle, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import SEO from '@/components/SEO';

export default function QuizPage() {
  const { quizId } = useParams();
  const { user } = useOutletContext() ?? {};
  const queryClient = useQueryClient();
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);

  const { data: quiz } = useQuery({
    queryKey: ['quiz', quizId],
    queryFn: async () => { const r = (await db.entities.Quiz.filter({ id: quizId }).catch(()=>[])); return r[0]; },
  });

  useEffect(() => {
    if (quiz?.time_limit_minutes > 0 && !submitted) {
      setTimeLeft(quiz.time_limit_minutes * 60);
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { clearInterval(timer); handleSubmit(); return 0; }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [quiz?.id]);

  const submitMutation = useMutation({
    mutationFn: (attemptData) => db.entities.QuizAttempt.create(attemptData),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['myQuizAttempts'] });
    },
  });

  const handleSubmit = () => {
    if (!quiz?.questions) return;
    let score = 0;
    let totalPoints = 0;
    const gradedAnswers = quiz.questions.map(q => {
      const userAnswer = answers[q.id] || '';
      const isCorrect = userAnswer.toLowerCase().trim() === (q.correct_answer || '').toLowerCase().trim();
      if (isCorrect) score += (q.points || 1);
      totalPoints += (q.points || 1);
      return { question_id: q.id, answer: userAnswer, is_correct: isCorrect };
    });

    const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
    const passed = percentage >= (quiz.pass_percentage || 50);

    const attemptData = {
      quiz_id: quizId,
      student_id: user.id,
      student_name: user.full_name,
      answers: gradedAnswers,
      score,
      total_points: totalPoints,
      percentage,
      passed,
      status: 'completed',
    };

    submitMutation.mutate(attemptData);
    setResult({ score, totalPoints, percentage, passed, gradedAnswers });
    setSubmitted(true);
  };

  if (!quiz) {
    return <SectionLoader label="Loading quiz…" />;
  }

  const questions = quiz.questions || [];

  if (submitted && result) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <Card className="text-center">
          <CardContent className="p-8">
            <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${result.passed ? 'bg-success/10' : 'bg-destructive/10'}`}>
              {result.passed ? <Trophy className="w-10 h-10 text-success" /> : <XCircle className="w-10 h-10 text-destructive" />}
            </div>
            <h2 className="text-2xl font-display font-bold">{result.passed ? 'Congratulations!' : 'Keep Trying!'}</h2>
            <p className="text-muted-foreground mt-2">{result.passed ? 'You passed the quiz!' : 'You can retake this quiz.'}</p>
            <div className="text-5xl font-bold font-display mt-4 text-primary">{result.percentage}%</div>
            <p className="text-sm text-muted-foreground mt-1">{result.score}/{result.totalPoints} points</p>
          </CardContent>
        </Card>

        {/* Review answers */}
        <div className="space-y-3">
          {questions.map((q, idx) => {
            const graded = result.gradedAnswers[idx];
            return (
              <Card key={q.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-2">
                    {graded?.is_correct ? <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" /> : <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />}
                    <div>
                      <p className="text-sm font-medium">{q.question}</p>
                      <p className="text-xs text-muted-foreground mt-1">Your answer: {graded?.answer || 'No answer'}</p>
                      {!graded?.is_correct && <p className="text-xs text-success mt-1">Correct: {q.correct_answer}</p>}
                      {q.explanation && <p className="text-xs text-muted-foreground mt-1 italic">{q.explanation}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  const question = questions[currentQ];
  if (!question) return <p className="text-center py-8 text-muted-foreground">No questions in this quiz</p>;

  return (
    <>
    <SEO title="Quiz" description="Take interactive quizzes on Chibondo Academy." />
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-display font-bold">{quiz.title}</h1>
          <p className="text-xs text-muted-foreground">Question {currentQ + 1} of {questions.length}</p>
        </div>
        {timeLeft !== null && (
          <div className="flex items-center gap-1 text-sm font-mono bg-muted px-3 py-1.5 rounded-lg">
            <Clock className="w-4 h-4" />
            {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
          </div>
        )}
      </div>
      <Progress value={((currentQ + 1) / questions.length) * 100} className="h-1.5" />

      {/* Question */}
      <Card>
        <CardContent className="p-6">
          <p className="font-medium mb-4">{question.question}</p>
          {(question.type === 'multiple_choice' || question.type === 'true_false') && (
            <RadioGroup value={answers[question.id] || ''} onValueChange={v => setAnswers({ ...answers, [question.id]: v })}>
              {(question.options || []).map((opt, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value={opt} id={`q-${question.id}-${i}`} />
                  <Label htmlFor={`q-${question.id}-${i}`} className="cursor-pointer flex-1 text-sm">{opt}</Label>
                </div>
              ))}
            </RadioGroup>
          )}
          {(question.type === 'fill_blank' || question.type === 'short_answer') && (
            <input
              className="w-full border border-border rounded-lg px-4 py-2.5 text-sm bg-background"
              value={answers[question.id] || ''}
              onChange={e => setAnswers({ ...answers, [question.id]: e.target.value })}
              placeholder="Type your answer..."
            />
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" disabled={currentQ === 0} onClick={() => setCurrentQ(currentQ - 1)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Previous
        </Button>
        {currentQ < questions.length - 1 ? (
          <Button onClick={() => setCurrentQ(currentQ + 1)}>
            Next <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} className="bg-success hover:bg-success/90 text-success-foreground">
            <CheckCircle2 className="w-4 h-4 mr-1" /> Submit Quiz
          </Button>
        )}
      </div>
    </div>
    </>
  );
}