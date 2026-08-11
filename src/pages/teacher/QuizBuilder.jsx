import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, ClipboardList, Edit, ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

const QUESTION_TYPES = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'true_false', label: 'True / False' },
  { value: 'fill_blank', label: 'Fill in the Blank' },
  { value: 'short_answer', label: 'Short Answer' },
];

function QuestionEditor({ question, onChange, onDelete }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30" onClick={() => setExpanded(!expanded)}>
        <GripVertical className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{QUESTION_TYPES.find(t => t.value === question.type)?.label}</span>
        <p className="flex-1 text-sm font-medium truncate">{question.question || 'Untitled question'}</p>
        <button onClick={e => { e.stopPropagation(); onDelete(); }} className="text-muted-foreground hover:text-destructive">
          <Trash2 className="w-4 h-4" />
        </button>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </div>

      {expanded && (
        <div className="border-t border-border p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Question Type</Label>
              <Select value={question.type} onValueChange={v => onChange({ ...question, type: v, options: v === 'true_false' ? ['True', 'False'] : question.options })}>
                <SelectTrigger className="h-8 text-sm mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Points</Label>
              <Input className="h-8 text-sm mt-1" type="number" value={question.points || 1} onChange={e => onChange({ ...question, points: Number(e.target.value) })} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Question</Label>
            <Textarea className="text-sm mt-1" rows={2} value={question.question || ''} onChange={e => onChange({ ...question, question: e.target.value })} placeholder="Enter your question..." />
          </div>

          {(question.type === 'multiple_choice') && (
            <div>
              <Label className="text-xs">Answer Options</Label>
              {(question.options || ['', '', '', '']).map((opt, i) => (
                <div key={i} className="flex items-center gap-2 mt-1.5">
                  <Input className="h-8 text-sm flex-1" value={opt} onChange={e => {
                    const opts = [...(question.options || ['', '', '', ''])];
                    opts[i] = e.target.value;
                    onChange({ ...question, options: opts });
                  }} placeholder={`Option ${i + 1}`} />
                  <button className={`text-xs px-2 py-1 rounded ${question.correct_answer === opt ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'}`}
                    onClick={() => onChange({ ...question, correct_answer: opt })}>
                    {question.correct_answer === opt ? '✓ Correct' : 'Set Correct'}
                  </button>
                </div>
              ))}
              <button className="text-xs text-primary mt-2" onClick={() => onChange({ ...question, options: [...(question.options || []), ''] })}>+ Add option</button>
            </div>
          )}

          {question.type === 'true_false' && (
            <div>
              <Label className="text-xs">Correct Answer</Label>
              <div className="flex gap-2 mt-1">
                {['True', 'False'].map(v => (
                  <button key={v} onClick={() => onChange({ ...question, correct_answer: v })}
                    className={`flex-1 py-1.5 text-sm rounded-lg border transition-colors ${question.correct_answer === v ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(question.type === 'fill_blank' || question.type === 'short_answer') && (
            <div>
              <Label className="text-xs">Correct Answer</Label>
              <Input className="h-8 text-sm mt-1" value={question.correct_answer || ''} onChange={e => onChange({ ...question, correct_answer: e.target.value })} placeholder="Expected answer..." />
            </div>
          )}

          <div>
            <Label className="text-xs">Explanation (optional)</Label>
            <Input className="h-8 text-sm mt-1" value={question.explanation || ''} onChange={e => onChange({ ...question, explanation: e.target.value })} placeholder="Why is this the correct answer?" />
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuizBuilder() {
  const { user } = useOutletContext() ?? {};
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', time_limit_minutes: 0, pass_percentage: 50, status: 'draft' });
  const [questions, setQuestions] = useState([]);

  const { data: quizzes = [] } = useQuery({queryKey: ['teacherQuizzes'],
    queryFn: async () => { try { return await db.entities.Quiz.list('-created_date', 100); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editingQuiz ? db.entities.Quiz.update(editingQuiz.id, data) : db.entities.Quiz.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacherQuizzes'] });
      setDialogOpen(false);
      toast.success(editingQuiz ? 'Quiz updated!' : 'Quiz created!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => db.entities.Quiz.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teacherQuizzes'] }),
  });

  const openNew = () => {
    setEditingQuiz(null);
    setForm({ title: '', description: '', time_limit_minutes: 0, pass_percentage: 50, status: 'draft' });
    setQuestions([]);
    setDialogOpen(true);
  };

  const openEdit = (quiz) => {
    setEditingQuiz(quiz);
    setForm({ title: quiz.title, description: quiz.description || '', time_limit_minutes: quiz.time_limit_minutes || 0, pass_percentage: quiz.pass_percentage || 50, status: quiz.status || 'draft' });
    setQuestions(quiz.questions || []);
    setDialogOpen(true);
  };

  const addQuestion = () => {
    setQuestions([...questions, { id: Date.now().toString(), type: 'multiple_choice', question: '', options: ['', '', '', ''], correct_answer: '', points: 1 }]);
  };

  const handleSave = () => {
    saveMutation.mutate({ ...form, questions });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Quiz Builder</h1>
          <p className="text-sm text-muted-foreground mt-1">Create and manage quizzes</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> New Quiz</Button>
      </div>

      <div className="space-y-3">
        {quizzes.map(quiz => (
          <div key={quiz.id} className="bg-card rounded-xl border border-border p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-sm">{quiz.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{quiz.questions?.length || 0} questions · Pass: {quiz.pass_percentage}%</p>
            </div>
            <Badge className={quiz.status === 'published' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>{quiz.status}</Badge>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => openEdit(quiz)}><Edit className="w-3.5 h-3.5" /></Button>
              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(quiz.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          </div>
        ))}
        {quizzes.length === 0 && (
          <div className="text-center py-16 bg-card rounded-xl border border-border">
            <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-muted-foreground text-sm">No quizzes yet. Create your first quiz!</p>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingQuiz ? 'Edit Quiz' : 'New Quiz'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Quiz Title</Label>
                <Input className="mt-1" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Photosynthesis Quiz" />
              </div>
              <div>
                <Label>Time Limit (minutes, 0 = unlimited)</Label>
                <Input className="mt-1" type="number" value={form.time_limit_minutes} onChange={e => setForm({ ...form, time_limit_minutes: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Pass Percentage (%)</Label>
                <Input className="mt-1" type="number" value={form.pass_percentage} onChange={e => setForm({ ...form, pass_percentage: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm">Questions ({questions.length})</h3>
                <Button size="sm" variant="outline" onClick={addQuestion}><Plus className="w-3.5 h-3.5 mr-1" /> Add Question</Button>
              </div>
              {questions.map((q, i) => (
                <QuestionEditor
                  key={q.id}
                  question={q}
                  onChange={updated => { const qs = [...questions]; qs[i] = updated; setQuestions(qs); }}
                  onDelete={() => setQuestions(questions.filter((_, idx) => idx !== i))}
                />
              ))}
              {questions.length === 0 && (
                <div className="text-center py-8 bg-muted/30 rounded-lg text-sm text-muted-foreground">
                  No questions yet. Click "Add Question" to start.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-border">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending || !form.title}>
                {saveMutation.isPending ? 'Saving...' : 'Save Quiz'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}