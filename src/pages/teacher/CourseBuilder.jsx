import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useOutletContext, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft, Plus, Edit2, Trash2, PlayCircle, FileText, ImageIcon,
  Loader2, ChevronDown, ChevronRight, GripVertical, Copy,
  Save, Clock, Wifi, WifiOff, Youtube, Globe, Upload,
  BookOpen, Layers, BarChart3, CheckCircle2, AlertCircle,
  X, Video, Link2, Settings, Eye, EyeOff, RefreshCw, ClipboardList,
  MoreVertical, ArrowUp, ArrowDown, Search, Code2, Type, AlignLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { useUpload } from '@/lib/UploadContext';
import { formatDistanceToNow } from 'date-fns';


// ─── AUTO-SAVE HOOK ────────────────────────────────────────────────────────────
function useAutoSave(saveFn, delay = 1500) {
  const [status, setStatus] = useState('idle'); // idle | saving | saved | error
  const timerRef = useRef(null);
  const lastSavedRef = useRef(null);

  const trigger = useCallback((data) => {
    setStatus('pending');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setStatus('saving');
      try {
        await saveFn(data);
        lastSavedRef.current = new Date();
        setStatus('saved');
        setTimeout(() => setStatus('idle'), 3000);
      } catch {
        setStatus('error');
      }
    }, delay);
  }, [saveFn, delay]);

  return { status, lastSaved: lastSavedRef.current, trigger };
}

// ─── SAVE STATUS INDICATOR ─────────────────────────────────────────────────────
function SaveStatus({ status, lastSaved }) {
  if (status === 'idle' && !lastSaved) return null;
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {status === 'saving' || status === 'pending' ? (
        <><Loader2 className="w-3 h-3 animate-spin" /> Saving…</>
      ) : status === 'saved' ? (
        <><CheckCircle2 className="w-3 h-3 text-green-500" /> Saved</>
      ) : status === 'error' ? (
        <><AlertCircle className="w-3 h-3 text-destructive" /> Save failed</>
      ) : lastSaved ? (
        <><CheckCircle2 className="w-3 h-3 text-green-500/60" /> Saved {formatDistanceToNow(lastSaved, { addSuffix: true })}</>
      ) : null}
    </span>
  );
}

// ─── YOUTUBE METADATA FETCHER ─────────────────────────────────────────────────
async function fetchYouTubeMeta(url) {
  const match = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (!match) return null;
  const videoId = match[1];
  try {
    const r = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (!r.ok) return { videoId, embedUrl: `https://www.youtube.com/embed/${videoId}` };
    const data = await r.json();
    return {
      videoId,
      title: data.title,
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
    };
  } catch {
    return { videoId, embedUrl: `https://www.youtube.com/embed/${videoId}` };
  }
}

// ─── BUNNY.NET EMBED HELPER ───────────────────────────────────────────────────
function getBunnyEmbed(input) {
  // Accept full embed URL or just video ID
  const embedMatch = input.match(/iframe\.mediadelivery\.net\/embed\/(\d+)\/([a-f0-9-]+)/);
  if (embedMatch) return `https://iframe.mediadelivery.net/embed/${embedMatch[1]}/${embedMatch[2]}`;
  const idMatch = input.match(/^[a-f0-9-]{36}$/);
  if (idMatch) return input; // raw video ID — user needs to provide library too
  return input;
}

// ─── VIDEO INPUT SECTION ──────────────────────────────────────────────────────
function VideoInput({ lesson, onChange }) {
  const [provider, setProvider] = useState(lesson.video_provider || 'none');
  const [urlInput, setUrlInput] = useState(lesson.video_url || '');
  const [fetching, setFetching] = useState(false);
  const [meta, setMeta] = useState(null);
  const { startUpload } = useUpload();

  useEffect(() => {
    setProvider(lesson.video_provider || 'none');
    setUrlInput(lesson.video_url || '');
  }, [lesson.id]);

  const handleProviderChange = (val) => {
    setProvider(val);
    setMeta(null);
    onChange({ video_provider: val, video_url: '' });
    setUrlInput('');
  };

  const handleUrlBlur = async () => {
    if (!urlInput) return;
    if (provider === 'youtube') {
      setFetching(true);
      const m = await fetchYouTubeMeta(urlInput);
      setFetching(false);
      if (m) {
        setMeta(m);
        onChange({ video_url: urlInput, video_provider: 'youtube' });
        toast.success('YouTube video linked');
      } else {
        toast.error('Could not parse YouTube URL');
      }
    } else if (provider === 'bunny') {
      const embed = getBunnyEmbed(urlInput);
      onChange({ video_url: urlInput, video_provider: 'bunny' });
      toast.success('Video linked successfully');
    } else {
      onChange({ video_url: urlInput, video_provider: provider });
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected if needed
    e.target.value = '';

    const title = lesson?.title || file.name.replace(/\.[^.]+$/, '');
    toast({ title: 'Upload started', description: 'You can leave this page — the upload continues in the background.' });

    startUpload(file, title, lesson?.id, ({ embedUrl }) => {
      onChange({ video_url: embedUrl, video_provider: 'bunny' });
      setUrlInput(embedUrl);
      toast.success('Video ready — processing in 1-2 minutes');
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs mb-1.5 block">Video Source</Label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { val: 'none',     label: 'No Video',             icon: X },
            { val: 'youtube',  label: 'YouTube Link',         icon: Youtube },
            { val: 'upload',   label: 'Upload Video Lesson',  icon: Upload },
            { val: 'bunny',    label: 'Paste Video URL',      icon: Video },
          ].map(({ val, label, icon: Icon }) => (
            <button key={val} onClick={() => handleProviderChange(val)}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all w-full ${
                provider === val
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40'
              }`}>
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {provider === 'upload' && (
        <div className="space-y-2">
          <label className="block">
            <input type="file" accept="video/*" className="sr-only" onChange={handleFileUpload} />
            <div className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl p-6 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
              <Upload className="w-6 h-6 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Click to select video</p>
              <p className="text-xs text-muted-foreground/60">MP4, WebM, MOV · Upload continues in background</p>
            </div>
          </label>
          {urlInput && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-xl text-xs text-green-700">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> Video uploaded — processing in 1-2 min
            </div>
          )}
        </div>
      )}

      {(provider === 'youtube' || provider === 'bunny' || provider === 'external') && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onBlur={handleUrlBlur}
              placeholder={
                provider === 'youtube' ? 'https://www.youtube.com/watch?v=...'
                : provider === 'bunny' ? 'Paste video embed URL'
                : 'https://...'
              }
              className="flex-1 text-sm"
            />
            {fetching && <Loader2 className="w-4 h-4 animate-spin self-center text-muted-foreground" />}
          </div>

          {/* YouTube preview */}
          {provider === 'youtube' && meta && (
            <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl">
              <img src={meta.thumbnail} alt="" className="w-20 h-12 object-cover rounded-lg flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{meta.title || 'YouTube Video'}</p>
                <p className="text-xs text-muted-foreground">YouTube · Linked</p>
              </div>
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
            </div>
          )}

          {/* Video link preview */}
          {provider === 'bunny' && urlInput && (
            <div className="flex items-center gap-2 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-xl text-xs text-orange-700">
              <Video className="w-3.5 h-3.5 flex-shrink-0" /> Video linked successfully
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ─── LESSON ATTACHMENTS ───────────────────────────────────────────────────────
function AttachmentsPanel({ attachments = [], onChange }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      const newAttachment = {
        id: Date.now().toString(),
        name: file.name,
        url: file_url,
        type: file.type,
        size: file.size,
      };
      onChange([...attachments, newAttachment]);
      toast.success('File attached');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (id) => onChange(attachments.filter(a => a.id !== id));

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1048576) return Math.round(bytes/1024) + 'KB';
    return (bytes/1048576).toFixed(1) + 'MB';
  };

  const fileIcon = (type = '') => {
    if (type.startsWith('image/')) return '\u{1F5BC}\uFE0F';
    if (type.includes('pdf')) return '\u{1F4C4}';
    if (type.includes('word') || type.includes('doc')) return '\u{1F4DD}';
    if (type.includes('spreadsheet') || type.includes('excel')) return '\u{1F4CA}';
    if (type.startsWith('video/')) return '\u{1F3AC}';
    return '\u{1F4CE}';
  };

  return (
    <div className="space-y-3">
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map(att => (
            <div key={att.id} className="flex items-center gap-3 p-2.5 bg-muted/40 border border-border rounded-xl group">
              <span className="text-lg flex-shrink-0">{fileIcon(att.type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{att.name}</p>
                {att.size && <p className="text-[10px] text-muted-foreground">{formatSize(att.size)}</p>}
              </div>
              <a href={att.url} target="_blank" rel="noreferrer"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0">
                <Globe className="w-3.5 h-3.5" />
              </a>
              <button onClick={() => removeAttachment(att.id)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="block">
        <input type="file" className="sr-only" onChange={handleUpload} disabled={uploading} />
        <div className={`flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl p-4 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors text-sm text-muted-foreground ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? 'Uploading…' : 'Click to attach a file'}
        </div>
      </label>
      <p className="text-[10px] text-muted-foreground">PDFs, images, Word docs, spreadsheets, and more. Students will see these below the lesson.</p>
    </div>
  );
}

// ─── LESSON QUIZ BUILDER ──────────────────────────────────────────────────────
const QTYPES = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'true_false', label: 'True / False' },
  { value: 'fill_blank', label: 'Fill in the Blank' },
  { value: 'short_answer', label: 'Short Answer' },
];

function QuestionCard({ q, idx, onChange, onDelete }) {
  const [expanded, setExpanded] = useState(idx === 0);

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(v => !v)}>
        <span className="w-5 h-5 rounded-md bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">
          {idx + 1}
        </span>
        <p className="flex-1 text-xs truncate text-muted-foreground">{q.question || 'Untitled question'}</p>
        <Badge className="text-[9px] h-4">{QTYPES.find(t => t.value === q.type)?.label || q.type}</Badge>
        <span className="text-[10px] text-muted-foreground">{q.points || 1}pt</span>
        <button onClick={e => { e.stopPropagation(); onDelete(); }}
          className="p-1 rounded hover:bg-destructive/10 text-destructive flex-shrink-0">
          <Trash2 className="w-3 h-3" />
        </button>
        {expanded ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
      </div>

      {expanded && (
        <div className="border-t border-border p-3 space-y-3">
          <div>
            <Label className="text-[10px]">Question</Label>
            <Textarea value={q.question} onChange={e => onChange({ ...q, question: e.target.value })}
              placeholder="Enter your question…" className="mt-1 text-xs min-h-[60px] resize-none" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-[10px]">Type</Label>
              <Select value={q.type} onValueChange={v => {
                const base = { ...q, type: v, options: ['', '', '', ''], correct_answer: '' };
                if (v === 'true_false') base.options = ['True', 'False'];
                onChange(base);
              }}>
                <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QTYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-20">
              <Label className="text-[10px]">Points</Label>
              <Input type="number" value={q.points || 1} min={1}
                onChange={e => onChange({ ...q, points: Number(e.target.value) })}
                className="h-7 text-xs mt-1" />
            </div>
          </div>

          {(q.type === 'multiple_choice' || q.type === 'true_false') && (
            <div className="space-y-2">
              <Label className="text-[10px]">Options (click circle to mark correct)</Label>
              {(q.options || []).map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <button onClick={() => onChange({ ...q, correct_answer: opt })}
                    className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors ${
                      q.correct_answer === opt ? 'border-green-500 bg-green-500' : 'border-border'
                    }`} />
                  <Input value={opt} onChange={e => {
                    const opts = [...(q.options || [])];
                    opts[oi] = e.target.value;
                    onChange({ ...q, options: opts });
                  }} className="h-7 text-xs flex-1" placeholder={`Option ${oi + 1}`}
                  disabled={q.type === 'true_false'} />
                </div>
              ))}
              {q.type === 'multiple_choice' && (q.options || []).length < 6 && (
                <button onClick={() => onChange({ ...q, options: [...(q.options || []), ''] })}
                  className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add option
                </button>
              )}
            </div>
          )}

          {(q.type === 'fill_blank' || q.type === 'short_answer') && (
            <div>
              <Label className="text-[10px]">Correct Answer</Label>
              <Input value={q.correct_answer || ''} onChange={e => onChange({ ...q, correct_answer: e.target.value })}
                placeholder={q.type === 'fill_blank' ? 'Expected answer (exact match)' : 'Model answer (for manual grading)'}
                className="mt-1 text-xs h-7" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QuizPanel({ lesson, subjectId }) {
  const qc = useQueryClient();
  const [questions, setQuestions] = useState([]);
  const [quizMeta, setQuizMeta] = useState({ title: '', time_limit_minutes: 0, pass_percentage: 60, status: 'draft' });
  const [quizId, setQuizId] = useState(null);
  const saveTimer = useRef(null);
  const [saveStatus, setSaveStatus] = useState('idle');

  const { data: existingQuizzes = [], isLoading } = useQuery({
    queryKey: ['lessonQuiz', lesson.id],
    queryFn: () => db.entities.Quiz.filter({ lesson_id: lesson.id }, '-created_date', 1),
  });

  useEffect(() => {
    if (existingQuizzes.length > 0) {
      const q = existingQuizzes[0];
      setQuizId(q.id);
      setQuizMeta({ title: q.title || '', time_limit_minutes: q.time_limit_minutes || 0, pass_percentage: q.pass_percentage || 60, status: q.status || 'draft' });
      setQuestions(q.questions || []);
    } else {
      setQuizId(null);
      setQuizMeta({ title: '', time_limit_minutes: 0, pass_percentage: 60, status: 'draft' });
      setQuestions([]);
    }
  }, [existingQuizzes.length, lesson.id]);

  const autoSave = (meta, qs) => {
    clearTimeout(saveTimer.current);
    setSaveStatus('pending');
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const payload = { ...meta, questions: qs, lesson_id: lesson.id, subject_id: subjectId, lesson_title: lesson.title };
        let id = quizId;
        if (id) {
          await db.entities.Quiz.update(id, payload);
        } else {
          const created = await db.entities.Quiz.create(payload);
          id = created.id;
          setQuizId(id);
        }
        qc.invalidateQueries({ queryKey: ['lessonQuiz', lesson.id] });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2500);
      } catch {
        setSaveStatus('error');
      }
    }, 1000);
  };

  const setMeta = (k, v) => {
    const updated = { ...quizMeta, [k]: v };
    setQuizMeta(updated);
    autoSave(updated, questions);
  };

  const setQs = (qs) => {
    setQuestions(qs);
    autoSave(quizMeta, qs);
  };

  const addQuestion = () => setQs([...questions, {
    id: Date.now().toString(), type: 'multiple_choice',
    question: '', options: ['', '', '', ''], correct_answer: '', points: 1,
  }]);

  const moveQuestion = (idx, dir) => {
    const qs = [...questions];
    const swap = idx + dir;
    if (swap < 0 || swap >= qs.length) return;
    [qs[idx], qs[swap]] = [qs[swap], qs[idx]];
    setQs(qs);
  };

  const duplicateQuestion = (idx) => {
    const qs = [...questions];
    qs.splice(idx + 1, 0, { ...qs[idx], id: Date.now().toString() });
    setQs(qs);
  };

  if (isLoading) return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Quiz Title</Label>
          <Input value={quizMeta.title} onChange={e => setMeta('title', e.target.value)}
            placeholder={lesson.title + ' Quiz'} className="mt-1 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={quizMeta.status} onValueChange={v => setMeta('status', v)}>
            <SelectTrigger className="mt-1 text-xs h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Time Limit (min, 0 = unlimited)</Label>
          <Input type="number" min={0} value={quizMeta.time_limit_minutes}
            onChange={e => setMeta('time_limit_minutes', Number(e.target.value))}
            className="mt-1 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Pass Percentage (%)</Label>
          <Input type="number" min={0} max={100} value={quizMeta.pass_percentage}
            onChange={e => setMeta('pass_percentage', Number(e.target.value))}
            className="mt-1 text-sm" />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold">Questions ({questions.length})</p>
        <div className="flex items-center gap-2">
          <SaveStatus status={saveStatus} lastSaved={null} />
          <Button size="sm" onClick={addQuestion} className="h-7 text-xs gap-1"
            style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }}>
            <Plus className="w-3 h-3" /> Add Question
          </Button>
        </div>
      </div>

      {questions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-border rounded-xl gap-2">
          <ClipboardList className="w-8 h-8 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground">No questions yet</p>
          <button onClick={addQuestion} className="text-xs text-primary hover:underline">Add first question</button>
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map((q, i) => (
            <div key={q.id} className="relative group/qwrap">
              <QuestionCard q={q} idx={i}
                onChange={updated => { const qs = [...questions]; qs[i] = updated; setQs(qs); }}
                onDelete={() => setQs(questions.filter((_, idx) => idx !== i))}
              />
              {/* Question action buttons — visible on hover */}
              <div className="absolute top-1.5 right-9 flex items-center gap-0.5 opacity-0 group-hover/qwrap:opacity-100 transition-opacity z-10">
                <button onClick={() => moveQuestion(i, -1)} disabled={i === 0} title="Move up"
                  className="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-25">
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button onClick={() => moveQuestion(i, 1)} disabled={i === questions.length - 1} title="Move down"
                  className="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-25">
                  <ArrowDown className="w-3 h-3" />
                </button>
                <button onClick={() => duplicateQuestion(i)} title="Duplicate"
                  className="p-1 rounded hover:bg-muted text-muted-foreground">
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
            <span>Total: {questions.reduce((s,q) => s + (q.points||1), 0)} points</span>
            <span>{questions.filter(q => q.question && q.correct_answer).length}/{questions.length} complete</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LESSON ASSIGNMENT BUILDER ────────────────────────────────────────────────
function AssignmentPanel({ lesson, subjectId }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: '', description: '', instructions: '', due_date: '',
    total_marks: 100, status: 'draft', attachments: [],
  });
  const [assignmentId, setAssignmentId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const saveTimer = useRef(null);
  const [saveStatus, setSaveStatus] = useState('idle');

  const { data: existing = [], isLoading } = useQuery({
    queryKey: ['lessonAssignment', lesson.id],
    queryFn: () => db.entities.Assignment.filter({ lesson_id: lesson.id }, '-created_date', 1),
  });

  useEffect(() => {
    if (existing.length > 0) {
      const a = existing[0];
      setAssignmentId(a.id);
      setForm({
        title: a.title || '',
        description: a.description || '',
        instructions: a.instructions || '',
        due_date: a.due_date ? a.due_date.split('T')[0] : '',
        total_marks: a.total_marks || 100,
        status: a.status || 'draft',
        attachments: a.attachments || [],
      });
    } else {
      setAssignmentId(null);
      setForm({ title: '', description: '', instructions: '', due_date: '', total_marks: 100, status: 'draft', attachments: [] });
    }
  }, [existing.length, lesson.id]);

  const autoSave = (updated) => {
    clearTimeout(saveTimer.current);
    setSaveStatus('pending');
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const payload = { ...updated, lesson_id: lesson.id, subject_id: subjectId, lesson_title: lesson.title };
        if (assignmentId) {
          await db.entities.Assignment.update(assignmentId, payload);
        } else {
          const created = await db.entities.Assignment.create(payload);
          setAssignmentId(created.id);
        }
        qc.invalidateQueries({ queryKey: ['lessonAssignment', lesson.id] });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2500);
      } catch {
        setSaveStatus('error');
      }
    }, 1000);
  };

  const set = (k, v) => {
    const updated = { ...form, [k]: v };
    setForm(updated);
    autoSave(updated);
  };

  const handleAttachmentUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      const att = { id: Date.now().toString(), name: file.name, url: file_url, type: file.type, size: file.size };
      const updated = { ...form, attachments: [...(form.attachments || []), att] };
      setForm(updated);
      autoSave(updated);
      toast.success('File attached');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{assignmentId ? 'Editing — auto-saving' : 'No assignment yet for this lesson'}</p>
        <SaveStatus status={saveStatus} lastSaved={null} />
      </div>

      <div>
        <Label className="text-xs">Title *</Label>
        <Input value={form.title} onChange={e => set('title', e.target.value)}
          placeholder={lesson.title + ' Assignment'} className="mt-1" />
      </div>

      <div>
        <Label className="text-xs">Description</Label>
        <Textarea value={form.description} onChange={e => set('description', e.target.value)}
          placeholder="Brief description shown on student dashboard" className="mt-1 text-sm resize-none" rows={2} />
      </div>

      <div>
        <Label className="text-xs">Instructions</Label>
        <Textarea value={form.instructions} onChange={e => set('instructions', e.target.value)}
          placeholder="Detailed step-by-step instructions…" className="mt-1 text-sm" rows={4} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Due Date</Label>
          <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Total Marks</Label>
          <Input type="number" value={form.total_marks} min={1}
            onChange={e => set('total_marks', Number(e.target.value))} className="mt-1" />
        </div>
      </div>

      <div>
        <Label className="text-xs">Status</Label>
        <Select value={form.status} onValueChange={v => set('status', v)}>
          <SelectTrigger className="mt-1 text-xs h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs mb-2 block">Attached Resources (for students)</Label>
        {(form.attachments || []).map(att => (
          <div key={att.id} className="flex items-center gap-2 p-2 bg-muted/40 border border-border rounded-lg mb-1.5 group">
            <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-xs flex-1 truncate">{att.name}</span>
            <a href={att.url} target="_blank" rel="noreferrer" className="text-primary text-xs hover:underline flex-shrink-0">Open</a>
            <button onClick={() => set('attachments', form.attachments.filter(a => a.id !== att.id))}
              className="opacity-0 group-hover:opacity-100 p-0.5 text-destructive flex-shrink-0">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        <label className="block mt-1">
          <input type="file" className="sr-only" onChange={handleAttachmentUpload} disabled={uploading} />
          <div className={`flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl p-3 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors text-xs text-muted-foreground ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? 'Uploading…' : 'Attach a resource file'}
          </div>
        </label>
      </div>
    </div>
  );
}

// ─── LESSON EXTRAS PANEL (tabs: Attachments / Quiz / Assignment) ──────────────
function LessonExtrasPanel({ lesson, subjectId, onChange }) {
  return (
    <Tabs defaultValue="attachments" className="w-full">
      <TabsList className="w-full h-8 mb-3">
        <TabsTrigger value="attachments" className="flex-1 text-xs gap-1.5">
          <Upload className="w-3 h-3" /> Attachments
        </TabsTrigger>
        <TabsTrigger value="quiz" className="flex-1 text-xs gap-1.5">
          <ClipboardList className="w-3 h-3" /> Quiz
        </TabsTrigger>
        <TabsTrigger value="assignment" className="flex-1 text-xs gap-1.5">
          <FileText className="w-3 h-3" /> Assignment
        </TabsTrigger>
      </TabsList>

      <TabsContent value="attachments">
        <AttachmentsPanel
          attachments={lesson.attachments || []}
          onChange={(atts) => onChange('attachments', atts)}
        />
      </TabsContent>

      <TabsContent value="quiz">
        <QuizPanel lesson={lesson} subjectId={subjectId} />
      </TabsContent>

      <TabsContent value="assignment">
        <AssignmentPanel lesson={lesson} subjectId={subjectId} />
      </TabsContent>
    </Tabs>
  );
}

// ─── DUAL CONTENT EDITOR ─────────────────────────────────────────────────────
// Visual mode: rich textarea with formatting toolbar (bold, italic, headings, lists)
// Code mode: raw HTML/Markdown code editor with monospace font
function DualContentEditor({ value, onChange }) {
  const [mode, setMode] = useState('visual'); // 'visual' | 'code'
  const textRef = useRef(null);

  // ── Formatting helpers for visual mode ──
  const wrap = (before, after = before) => {
    const el = textRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value: v } = el;
    const sel = v.slice(s, e);
    const newVal = v.slice(0, s) + before + sel + after + v.slice(e);
    onChange(newVal);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(s + before.length, e + before.length);
    }, 0);
  };

  const insertAtLineStart = (prefix) => {
    const el = textRef.current;
    if (!el) return;
    const { selectionStart: s, value: v } = el;
    const lineStart = v.lastIndexOf('\n', s - 1) + 1;
    const currentLine = v.slice(lineStart);
    // Toggle: if already prefixed, remove; else add
    if (currentLine.startsWith(prefix)) {
      const newVal = v.slice(0, lineStart) + currentLine.slice(prefix.length);
      onChange(newVal);
    } else {
      const newVal = v.slice(0, lineStart) + prefix + v.slice(lineStart);
      onChange(newVal);
    }
    setTimeout(() => el.focus(), 0);
  };

  const TOOLBAR = [
    { label: 'B',       title: 'Bold',          action: () => wrap('**'),                  mono: true  },
    { label: 'I',       title: 'Italic',         action: () => wrap('_'),                   italic: true },
    { label: 'H2',      title: 'Heading',        action: () => insertAtLineStart('## '),    mono: true  },
    { label: 'H3',      title: 'Sub-heading',    action: () => insertAtLineStart('### '),   mono: true  },
    { label: '• List',  title: 'Bullet list',    action: () => insertAtLineStart('- ')                  },
    { label: '1. List', title: 'Numbered list',  action: () => insertAtLineStart('1. ')                 },
    { label: '> Quote', title: 'Blockquote',     action: () => insertAtLineStart('> ')                  },
    { label: '`code`',  title: 'Inline code',    action: () => wrap('\`'),                  mono: true  },
  ];

  return (
    <div className="space-y-2">
      {/* Header + mode toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Lesson Notes</h3>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setMode('visual')}
            className={[
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
              mode === 'visual'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            ].join(' ')}
          >
            <Type className="w-3 h-3" />
            Visual
          </button>
          <button
            onClick={() => setMode('code')}
            className={[
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
              mode === 'code'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            ].join(' ')}
          >
            <Code2 className="w-3 h-3" />
            Code
          </button>
        </div>
      </div>

      {mode === 'visual' ? (
        <div className="rounded-xl border border-border overflow-hidden">
          {/* Formatting toolbar */}
          <div className="flex flex-wrap gap-0.5 p-2 bg-muted/40 border-b border-border">
            {TOOLBAR.map(({ label, title, action, mono, italic: ital }) => (
              <button
                key={title}
                title={title}
                onClick={action}
                className="px-2 py-1 rounded text-xs hover:bg-background hover:shadow-sm transition-all text-foreground/70 hover:text-foreground min-w-[28px] text-center"
                style={{
                  fontFamily: mono ? 'monospace' : undefined,
                  fontStyle: ital ? 'italic' : undefined,
                  fontWeight: label === 'B' ? 700 : undefined,
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Editor area */}
          <Textarea
            ref={textRef}
            className="min-h-[220px] resize-y text-sm leading-relaxed border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="Write lesson notes here…&#10;&#10;Tip: use the toolbar above to format text, or switch to Code mode for HTML."
          />
          <div className="px-3 py-1.5 bg-muted/20 border-t border-border">
            <p className="text-[10px] text-muted-foreground">Supports Markdown — **bold**, _italic_, ## heading, - list</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border">
            <Code2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">HTML / Code editor</span>
            <span className="ml-auto text-[10px] text-muted-foreground">Raw content — wrap text in HTML tags</span>
          </div>
          <Textarea
            className="min-h-[260px] resize-y font-mono text-xs leading-relaxed border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-[hsl(222_47%_8%)] text-green-300"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={"<h2>Lesson Title</h2>\n<p>Your content here…</p>\n\n<!-- Example code block: -->\n<pre><code>\nprint('Hello, World!')\n</code></pre>"}
            spellCheck={false}
          />
          <div className="px-3 py-1.5 bg-muted/20 border-t border-border">
            <p className="text-[10px] text-muted-foreground">Write valid HTML · &lt;h2&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;pre&gt;&lt;code&gt; all work in the lesson viewer</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LESSON EDITOR (RIGHT PANEL) ──────────────────────────────────────────────
function LessonEditor({ lesson, subjectId, subjectName, onSaved }) {
  const qc = useQueryClient();
  const [data, setData] = useState(lesson);
  const pendingRef = useRef(null);

  // Sync when selected lesson changes
  useEffect(() => {
    setData(lesson);
    pendingRef.current = null;
  }, [lesson.id]);

  const saveFn = useCallback(async (payload) => {
    // Strip read-only system fields before sending to the update API
    const { id, created_date, updated_date, created_by, created_by_id, ...clean } = payload;
    await db.entities.Lesson.update(lesson.id, clean);
    qc.invalidateQueries({ queryKey: ['lessons', subjectId] });
    onSaved?.();
    // Notify enrolled students when a lesson is published (fire-and-forget)
    const wasPublished = lesson.status !== 'published' && clean.status === 'published';
    const contentChanged = lesson.status === 'published' && clean.status === 'published' &&
      (lesson.title !== clean.title || lesson.content !== clean.content || lesson.video_url !== clean.video_url);
    if (wasPublished || contentChanged) {
      // Notify enrolled students via WhatsApp (fire-and-forget)
      try {
        // Fetch enrolled student IDs for this subject
        const enrollments = await db.entities.Enrollment.filter({ subject_id: subjectId });
        const studentIds = enrollments.map(e => e.student_id || e.user_id).filter(Boolean);
        if (studentIds.length > 0) {
          fetch('/api/send-whatsapp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              users: studentIds,
              message: `*Chibondo Academy*

📚 New Lesson: ${clean.title}

A new lesson has been published. Log in to view it:
chibondoacademy.com`,
              type: 'template',
              template: {
                name: 'new_lesson_published',
                language: { code: 'en' },
                components: [{ type: 'body', parameters: [
                  { type: 'text', text: clean.title },
                ]}],
              },
            }),
          }).catch(() => {});
        }
      } catch (_) {}
    }
  }, [lesson.id, lesson.status, lesson.title, lesson.content, lesson.video_url, subjectId]);

  const { status: saveStatus, lastSaved, trigger: triggerSave } = useAutoSave(saveFn, 1200);

  const set = (key, val) => {
    const updated = { ...data, [key]: val };
    setData(updated);
    triggerSave(updated);
  };

  const setVideo = (videoFields) => {
    const updated = { ...data, ...videoFields };
    setData(updated);
    triggerSave(updated);
  };

  const setContent = (val) => {
    const updated = { ...data, content: val };
    setData(updated);
    triggerSave(updated);
  };

  return (
    <div className="md:h-full flex flex-col">
      {/* Editor header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <PlayCircle className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold truncate max-w-[200px]">{data.title || 'Untitled Lesson'}</span>
        </div>
        <div className="flex items-center gap-3">
          <SaveStatus status={saveStatus} lastSaved={lastSaved} />
          <Select value={data.status || 'draft'} onValueChange={v => set('status', v)}>
            <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Scrollable editor body (mobile: natural page scroll; desktop: internal scroll pane) */}
      <div className="flex-1 md:overflow-y-auto p-5 space-y-5">

        {/* Basic info */}
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Lesson Title</Label>
            <Input
              value={data.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. Introduction to Photosynthesis"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Input
              value={data.description || ''}
              onChange={e => set('description', e.target.value)}
              placeholder="Brief description of this lesson"
              className="mt-1"
            />
          </div>
        </div>

        {/* Video */}
        <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Video Content</h3>
          </div>
          <VideoInput lesson={data} onChange={setVideo} />
          {/* Manual duration fallback */}
          <div className="flex items-center gap-3 pt-1">
            <div className="flex-1">
              <Label className="text-xs">Duration (minutes)</Label>
              <Input
                type="number"
                value={data.estimated_minutes || ''}
                onChange={e => set('estimated_minutes', parseInt(e.target.value) || 0)}
                placeholder="e.g. 15"
                className="mt-1 h-8 text-sm"
                min={0}
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs">Order</Label>
              <Input
                type="number"
                value={data.order || 0}
                onChange={e => set('order', parseInt(e.target.value) || 0)}
                className="mt-1 h-8 text-sm"
                min={0}
              />
            </div>
          </div>
        </div>

        {/* Lesson Notes — dual mode editor */}
        <DualContentEditor
          value={data.content || ''}
          onChange={setContent}
        />

        {/* Access */}
        <div className="flex items-center justify-between p-3 bg-card border border-border rounded-xl">
          <div>
            <p className="text-sm font-medium">Free Lesson</p>
            <p className="text-xs text-muted-foreground">Visible to all users, not just subscribers</p>
          </div>
          <Switch checked={!!data.is_free} onCheckedChange={v => set('is_free', v)} />
        </div>

        {/* ── Attachments / Quiz / Assignment tabs ── */}
        <LessonExtrasPanel lesson={data} subjectId={subjectId} onChange={set} />
      </div>
    </div>
  );
}

// ─── CURRICULUM TREE (LEFT PANEL) ─────────────────────────────────────────────
// ─── ACTION DROPDOWN MENU ────────────────────────────────────────────────────
function ActionMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    // Support both mouse and touch dismiss
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative flex-shrink-0" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        className="p-1.5 min-w-[28px] min-h-[28px] rounded-lg hover:bg-muted text-muted-foreground transition-colors touch-manipulation"
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-border bg-card overflow-hidden"
          style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}
        >
          {items.map((item, i) =>
            item === 'divider'
              ? <div key={i} className="border-t border-border my-0.5" />
              : (
                <button key={i}
                  onClick={() => { item.onClick(); setOpen(false); }}
                  disabled={!!item.disabled}
                  className={[
                    'flex items-center gap-2.5 w-full px-3 py-2.5 text-xs font-medium transition-colors text-left touch-manipulation',
                    item.danger ? 'text-destructive hover:bg-destructive/10' : 'text-foreground hover:bg-muted',
                    item.disabled ? 'opacity-30 pointer-events-none' : '',
                  ].join(' ')}>
                  <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
                  {item.label}
                </button>
              )
          )}
        </div>
      )}
    </div>
  );
}

// ─── CURRICULUM TREE ──────────────────────────────────────────────────────────
function CurriculumTree({
  topics, lessons, selectedLessonId, onSelectLesson,
  onAddTopic, onEditTopic, onDeleteTopic, onMoveTopic, onDuplicateTopic,
  onAddLesson, onDeleteLesson, onDuplicateLesson, onMoveLesson,
  subjectId,
}) {
  const [expandedTopics, setExpandedTopics] = useState({});
  const toggleTopic = (id) => setExpandedTopics(p => ({ ...p, [id]: !p[id] }));

  const sorted = [...topics].sort((a, b) => (a.order || 0) - (b.order || 0));

  const lessonsByTopic = {};
  lessons.forEach(l => {
    if (!lessonsByTopic[l.topic_id]) lessonsByTopic[l.topic_id] = [];
    lessonsByTopic[l.topic_id].push(l);
  });
  Object.values(lessonsByTopic).forEach(arr => arr.sort((a, b) => (a.order || 0) - (b.order || 0)));

  return (
    <div className="md:h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Curriculum</span>
        </div>
        <Button size="sm" onClick={onAddTopic}
          className="h-7 text-xs gap-1"
          style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }}>
          <Plus className="w-3 h-3" /> Topic
        </Button>
      </div>

      {/* Tree */}
      <div className="flex-1 md:overflow-y-auto py-2">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Layers className="w-10 h-10 text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">No topics yet</p>
            <button onClick={onAddTopic} className="text-xs text-primary mt-1 hover:underline">
              Add your first topic
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border/50 mx-1">
          {sorted.map((topic, tIdx) => {
            const topicLessons = lessonsByTopic[topic.id] || [];
            const expanded = expandedTopics[topic.id] !== false;
            const topicMinutes = topicLessons.reduce((acc, l) => acc + (l.estimated_minutes || 0), 0);

            return (
              <div key={topic.id} className="py-0.5">
                {/* Topic row */}
                <div className="flex items-center gap-1.5 px-2 py-2.5 group rounded-lg hover:bg-muted/40 transition-colors">
                  <button
                    className="text-muted-foreground/50 flex-shrink-0 p-0.5 hover:text-foreground"
                    onClick={() => toggleTopic(topic.id)}
                  >
                    {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                  <div
                    className="w-5 h-5 rounded-md bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center flex-shrink-0 cursor-pointer select-none"
                    onClick={() => toggleTopic(topic.id)}
                  >
                    {tIdx + 1}
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer select-none" onClick={() => toggleTopic(topic.id)}>
                    <p className="text-xs font-semibold truncate">{topic.title}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                      {topicLessons.length} {topicLessons.length === 1 ? 'lesson' : 'lessons'}
                      {topicMinutes > 0 && ` · ${topicMinutes >= 60 ? `${Math.floor(topicMinutes / 60)}h ${topicMinutes % 60}m` : `${topicMinutes}m`}`}
                    </p>
                  </div>
                  <div className="opacity-60 group-hover:opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                    <ActionMenu items={[
                      { icon: Plus,      label: 'Add Lesson',  onClick: () => onAddLesson(topic) },
                      { icon: Edit2,     label: 'Edit Topic',  onClick: () => onEditTopic(topic) },
                      { icon: Copy,      label: 'Duplicate',   onClick: () => onDuplicateTopic(topic) },
                      'divider',
                      { icon: ArrowUp,   label: 'Move Up',     onClick: () => onMoveTopic(topic, -1), disabled: tIdx === 0 },
                      { icon: ArrowDown, label: 'Move Down',   onClick: () => onMoveTopic(topic, 1),  disabled: tIdx === sorted.length - 1 },
                      'divider',
                      { icon: Trash2,    label: 'Delete Topic',onClick: () => onDeleteTopic(topic.id), danger: true },
                    ]} />
                  </div>
                </div>

                {/* Lessons under topic */}
                {expanded && (
                  <div className="ml-6 border-l border-border/50 pl-2 space-y-0.5 pb-1">
                    {topicLessons.map((lesson, lIdx) => (
                      <div key={lesson.id}
                        className={[
                          'flex items-center gap-1.5 px-2 py-1.5 rounded-lg group/lesson cursor-pointer transition-colors',
                          selectedLessonId === lesson.id
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-muted/60 text-muted-foreground',
                        ].join(' ')}
                        onClick={() => onSelectLesson(lesson)}
                      >
                        <PlayCircle className="w-3 h-3 flex-shrink-0" />
                        <span className="flex-1 text-xs truncate">{lesson.title || 'Untitled'}</span>
                        {lesson.status === 'published'
                          ? <Eye className="w-2.5 h-2.5 flex-shrink-0 opacity-40" />
                          : <EyeOff className="w-2.5 h-2.5 flex-shrink-0 opacity-20" />
                        }
                        <div className="opacity-60 group-hover/lesson:opacity-100 transition-opacity sm:opacity-0 sm:group-hover/lesson:opacity-100" onClick={e => e.stopPropagation()}>
                          <ActionMenu items={[
                            { icon: Edit2,     label: 'Edit',       onClick: () => onSelectLesson(lesson) },
                            { icon: Copy,      label: 'Duplicate',  onClick: () => onDuplicateLesson(lesson) },
                            'divider',
                            { icon: ArrowUp,   label: 'Move Up',    onClick: () => onMoveLesson(lesson, topicLessons, -1), disabled: lIdx === 0 },
                            { icon: ArrowDown, label: 'Move Down',  onClick: () => onMoveLesson(lesson, topicLessons, 1),  disabled: lIdx === topicLessons.length - 1 },
                            'divider',
                            { icon: Trash2,    label: 'Delete',     onClick: () => onDeleteLesson(lesson.id), danger: true },
                          ]} />
                        </div>
                      </div>
                    ))}
                    <button onClick={() => onAddLesson(topic)}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-muted-foreground/40 hover:text-primary hover:bg-primary/5 transition-colors w-full">
                      <Plus className="w-3 h-3" /> Add lesson
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── COURSE DETAILS PANEL ─────────────────────────────────────────────────────
function CourseDetailsPanel({ subject, tutors, user, onSaved }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: subject.name || '',
    description: subject.description || '',
    cover_image: subject.cover_image || '',
    status: subject.status || 'draft',
    is_premium: subject.is_premium ?? true,
    teacher_id: subject.teacher_id || '',
    teacher_name: subject.teacher_name || '',
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setForm({
      name: subject.name || '',
      description: subject.description || '',
      cover_image: subject.cover_image || '',
      status: subject.status || 'draft',
      is_premium: subject.is_premium ?? true,
      teacher_id: subject.teacher_id || '',
      teacher_name: subject.teacher_name || '',
    });
  }, [subject.id]);

  const saveFn = useCallback(async (payload) => {
    const { id, created_date, updated_date, created_by, created_by_id, ...clean } = payload;
    await db.entities.Subject.update(subject.id, clean);
    qc.invalidateQueries({ queryKey: ['subject', subject.id] });
    onSaved?.();
  }, [subject.id]);

  const { status: saveStatus, lastSaved, trigger: triggerSave } = useAutoSave(saveFn, 1000);

  const set = (key, val) => {
    const updated = { ...form, [key]: val };
    setForm(updated);
    triggerSave(updated);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      set('cover_image', file_url);
      toast.success('Thumbnail uploaded');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="md:h-full md:overflow-y-auto p-5 space-y-4 max-w-2xl">

      {/* Header */}
      <div className="flex items-center justify-between pb-1">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Settings className="w-4 h-4 text-primary" /> Course Details
        </h2>
        <SaveStatus status={saveStatus} lastSaved={lastSaved} />
      </div>

      {/* ── Basic Information ── */}
      <section className="bg-card border border-border rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5" /> Basic Information
        </p>
        <div>
          <Label className="text-xs">Course Name</Label>
          <Input value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="e.g. MSCE Biology Book 4" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Description</Label>
          <Textarea
            className="mt-1 min-h-[100px] resize-y"
            value={form.description || ''}
            onChange={e => set('description', e.target.value)}
            placeholder="Course overview — what students will learn…"
          />
        </div>
      </section>

      {/* ── Thumbnail ── */}
      <section className="bg-card border border-border rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5" /> Thumbnail
        </p>
        {form.cover_image && (
          <div className="relative rounded-xl overflow-hidden h-36 bg-muted border border-border">
            <img src={form.cover_image} alt="thumbnail" className="w-full h-full object-cover" />
            <button onClick={() => set('cover_image', '')}
              className="absolute top-2 right-2 p-1 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <div className="space-y-2">
          <Input value={form.cover_image} onChange={e => set('cover_image', e.target.value)}
            placeholder="Paste image URL…" className="text-sm" />
          <label className="block">
            <input type="file" accept="image/*,video/*" className="sr-only" onChange={handleFileUpload} disabled={uploading} />
            <div className={`flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl p-3 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors text-sm text-muted-foreground ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
              {uploading ? 'Uploading…' : 'Upload image or intro video'}
            </div>
          </label>
          <p className="text-[10px] text-muted-foreground">JPG, PNG, WEBP, MP4 supported</p>
        </div>
      </section>

      {/* ── Access & Visibility ── */}
      <section className="bg-card border border-border rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5" /> Access &amp; Visibility
        </p>

        {/* Tutor assignment */}
        <div>
          <Label className="text-xs">Assigned Tutor</Label>
          {isAdmin ? (
            <Select value={form.teacher_id} onValueChange={v => {
              const t = tutors.find(t => t.id === v);
              set('teacher_id', v);
              set('teacher_name', t?.full_name || '');
            }}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a tutor" />
              </SelectTrigger>
              <SelectContent>
                {tutors.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary flex-shrink-0">
                        {t.full_name?.[0]?.toUpperCase()}
                      </div>
                      {t.full_name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="mt-1 flex items-center gap-2 px-3 py-2 bg-muted/50 border border-border rounded-xl">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                {user?.full_name?.[0]?.toUpperCase()}
              </div>
              <span className="text-sm">{user?.full_name}</span>
              <Badge className="ml-auto text-[9px]">You</Badge>
            </div>
          )}
        </div>

        {/* Premium toggle */}
        <div className="flex items-center justify-between p-3 bg-muted/30 border border-border rounded-xl">
          <div>
            <p className="text-sm font-medium">Premium Course</p>
            <p className="text-xs text-muted-foreground">Requires active subscription</p>
          </div>
          <Switch checked={!!form.is_premium} onCheckedChange={v => set('is_premium', v)} />
        </div>

        {/* Status */}
        <div>
          <Label className="text-xs">Course Status</Label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">
                <div className="flex items-center gap-2"><EyeOff className="w-3.5 h-3.5" /> Draft</div>
              </SelectItem>
              <SelectItem value="published">
                <div className="flex items-center gap-2"><Eye className="w-3.5 h-3.5 text-green-500" /> Published</div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* ── SEO & Social Sharing ── */}
      <section className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5" /> SEO & Social Sharing
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Controls how this course appears in Google and when shared on social media. All fields fall back to the course name/description if left empty.
          </p>
        </div>
        {/* Google preview */}
        <div className="bg-muted/50 border border-border rounded-xl p-3 text-xs space-y-0.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Google Preview</p>
          <p className="text-blue-500 truncate">{window.location.origin}/subjects/{subject?.id || ''}</p>
          <p className="font-semibold text-foreground">{form.seo_title || form.name || 'Course Name'} | Chibondo Academy</p>
          <p className="text-muted-foreground line-clamp-2">{form.seo_description || (form.description || '').replace(/<[^>]+>/g, '').slice(0, 160) || 'Course description…'}</p>
        </div>
        <div>
          <Label className="text-xs">SEO Title <span className="text-muted-foreground">(50–60 chars)</span></Label>
          <Input value={form.seo_title || ''} onChange={e => set('seo_title', e.target.value)} maxLength={70}
            placeholder={`${form.name || 'Course Name'} | MSCE | Chibondo Academy`} className="mt-1 text-sm" />
        </div>
        <div>
          <Label className="text-xs">SEO Description <span className="text-muted-foreground">(max 160 chars)</span></Label>
          <Textarea value={form.seo_description || ''} onChange={e => set('seo_description', e.target.value)} maxLength={180}
            placeholder="Defaults to course description" className="mt-1 text-sm resize-none" rows={2} />
        </div>
        <div>
          <Label className="text-xs">SEO Keywords</Label>
          <Input value={form.seo_keywords || ''} onChange={e => set('seo_keywords', e.target.value)}
            placeholder="MSCE biology, photosynthesis, Malawi secondary" className="mt-1 text-sm" />
        </div>
        {/* OG */}
        <div className="border-t border-border/50 pt-3 space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Open Graph (Facebook · WhatsApp · LinkedIn)</p>
          <div>
            <Label className="text-xs">OG Title</Label>
            <Input value={form.og_title || ''} onChange={e => set('og_title', e.target.value)}
              placeholder="Defaults to SEO Title" className="mt-1 text-sm" />
          </div>
          <div>
            <Label className="text-xs">OG Description</Label>
            <Textarea value={form.og_description || ''} onChange={e => set('og_description', e.target.value)}
              placeholder="Defaults to SEO Description" className="mt-1 text-sm resize-none" rows={2} />
          </div>
          <div>
            <Label className="text-xs">OG Image URL <span className="text-muted-foreground">(1200×630px)</span></Label>
            <Input value={form.og_image || ''} onChange={e => set('og_image', e.target.value)}
              placeholder="Defaults to course thumbnail" className="mt-1 text-sm" />
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── COURSE STATS BAR ─────────────────────────────────────────────────────────
function CourseStats({ topics, lessons }) {
  const totalMinutes = lessons.reduce((acc, l) => acc + (l.estimated_minutes || 0), 0);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
      <span className="flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> {topics.length} topics</span>
      <span className="flex items-center gap-1"><PlayCircle className="w-3.5 h-3.5" /> {lessons.length} lessons</span>
      {totalMinutes > 0 && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {durationStr} total</span>}
    </div>
  );
}

// ─── TOPIC DIALOG ─────────────────────────────────────────────────────────────
function TopicDialog({ open, onOpenChange, topic, subjectId, formId, nextOrder }) {
  const qc = useQueryClient();
  const [data, setData] = useState({ title: '', description: '', order: 0 });

  useEffect(() => {
    if (topic) setData({ title: topic.title, description: topic.description || '', order: topic.order || 0 });
    else setData({ title: '', description: '', order: nextOrder ?? 0 });
  }, [topic, open, nextOrder]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (topic) return db.entities.Topic.update(topic.id, data);
      return db.entities.Topic.create({ ...data, subject_id: subjectId, form_id: formId, status: 'published' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['topics', subjectId] });
      toast.success(topic ? 'Topic updated' : 'Topic added');
      onOpenChange(false);
    },
    onError: () => toast.error('Failed to save topic'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{topic ? 'Edit Topic' : 'Add Topic'}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Topic Name *</Label>
            <Input value={data.title} onChange={e => setData(d => ({ ...d, title: e.target.value }))}
              placeholder="e.g. Photosynthesis" className="mt-1" />
          </div>
          <div>
            <Label>Description</Label>
            <Input value={data.description} onChange={e => setData(d => ({ ...d, description: e.target.value }))}
              placeholder="Optional description" className="mt-1" />
          </div>
          <div>
            <Label>Order</Label>
            <Input type="number" value={data.order} onChange={e => setData(d => ({ ...d, order: parseInt(e.target.value) || 0 }))}
              className="mt-1" min={0} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !data.title} className="flex-1">
              {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {topic ? 'Update' : 'Add Topic'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── MAIN COURSE BUILDER ──────────────────────────────────────────────────────
export default function CourseBuilder() {
  const { subjectId } = useParams();
  const { user } = useOutletContext() ?? {};
  const qc = useQueryClient();

  const [activeView, setActiveView] = useState('curriculum'); // curriculum | details
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [topicDialog, setTopicDialog] = useState({ open: false, topic: null });
  const [deleteLessonId, setDeleteLessonId] = useState(null); // id awaiting delete confirm

  // ── Data fetching ──
  const { data: subject } = useQuery({
    queryKey: ['subject', subjectId],
    queryFn: async () => { const r = await db.entities.Subject.filter({ id: subjectId }); return r[0]; },
  });

  const { data: topics = [] } = useQuery({
    queryKey: ['topics', subjectId],
    queryFn: () => db.entities.Topic.filter({ subject_id: subjectId }, 'order', 100),
  });

  const { data: lessons = [] } = useQuery({
    queryKey: ['lessons', subjectId],
    queryFn: () => db.entities.Lesson.filter({ subject_id: subjectId }, 'order', 500),
    refetchInterval: selectedLesson ? false : 10000,
  });

  const { data: tutors = [] } = useQuery({
    queryKey: ['teacherUsers'],
    queryFn: () => db.entities.User.filter({ role: 'teacher' }, 'full_name', 200),
    enabled: user?.role === 'admin',
  });

  // ── Add lesson mutation ──
  const addLessonMut = useMutation({
    mutationFn: async ({ topicId, topicTitle }) => {
      const topicLessons = lessons.filter(l => l.topic_id === topicId);
      return db.entities.Lesson.create({
        title: 'New Lesson',
        topic_id: topicId,
        topic_title: topicTitle,
        subject_id: subjectId,
        subject_name: subject?.name || '',
        form_id: subject?.form_id || '',
        order: topicLessons.length,
        status: 'draft',
        video_provider: 'none',
        estimated_minutes: 15,
      });
    },
    onSuccess: (newLesson) => {
      qc.invalidateQueries({ queryKey: ['lessons', subjectId] });
      setSelectedLesson(newLesson);
      toast.success('Lesson added');
    },
    onError: (err) => toast.error(err?.message || 'Failed to add lesson'),
  });

  const deleteLessonMut = useMutation({
    mutationFn: (id) => db.entities.Lesson.delete(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['lessons', subjectId] });
      if (selectedLesson?.id === id) setSelectedLesson(null);
      toast.success('Lesson deleted');
    },
  });

  const duplicateLessonMut = useMutation({
    mutationFn: async (lesson) => {
      const { id, created_date, updated_date, created_by_id, created_by, ...rest } = lesson;
      return db.entities.Lesson.create({ ...rest, title: `${rest.title} (Copy)`, status: 'draft' });
    },
    onSuccess: (newLesson) => {
      qc.invalidateQueries({ queryKey: ['lessons', subjectId] });
      setSelectedLesson(newLesson);
      toast.success('Lesson duplicated');
    },
  });

  // move lesson: swap order with sibling
  const moveLessonMut = useMutation({
    mutationFn: async ({ lesson, siblings, direction }) => {
      const idx = siblings.findIndex(l => l.id === lesson.id);
      const swapIdx = idx + direction;
      if (swapIdx < 0 || swapIdx >= siblings.length) return;
      const target = siblings[swapIdx];
      await db.entities.Lesson.update(lesson.id, { order: target.order ?? swapIdx });
      await db.entities.Lesson.update(target.id, { order: lesson.order ?? idx });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lessons', subjectId] }),
    onError: () => toast.error('Could not move lesson'),
  });

  // move topic: swap order with sibling
  const moveTopicMut = useMutation({
    mutationFn: async ({ topic, direction }) => {
      const sorted = [...topics].sort((a, b) => (a.order || 0) - (b.order || 0));
      const idx = sorted.findIndex(t => t.id === topic.id);
      const swapIdx = idx + direction;
      if (swapIdx < 0 || swapIdx >= sorted.length) return;
      const target = sorted[swapIdx];
      await db.entities.Topic.update(topic.id, { order: target.order ?? swapIdx });
      await db.entities.Topic.update(target.id, { order: topic.order ?? idx });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['topics', subjectId] }),
    onError: () => toast.error('Could not move topic'),
  });

  // duplicate topic (copies all its lessons too)
  const duplicateTopicMut = useMutation({
    mutationFn: async (topic) => {
      const { id, created_date, updated_date, created_by, created_by_id, ...rest } = topic;
      const newTopic = await db.entities.Topic.create({
        ...rest, title: rest.title + ' (Copy)', order: (rest.order || 0) + 0.5,
      });
      const topicLessons = lessons.filter(l => l.topic_id === topic.id);
      await Promise.all(topicLessons.map(l => {
        const { id: lid, created_date: lcd, updated_date: lud, created_by: lcb, created_by_id: lcbi, ...lr } = l;
        return db.entities.Lesson.create({ ...lr, topic_id: newTopic.id, topic_title: newTopic.title, status: 'draft' });
      }));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['topics', subjectId] });
      qc.invalidateQueries({ queryKey: ['lessons', subjectId] });
      toast.success('Topic duplicated');
    },
    onError: () => toast.error('Duplicate failed'),
  });

  const deleteTopicMut = useMutation({
    mutationFn: (id) => db.entities.Topic.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['topics', subjectId] });
      toast.success('Topic deleted');
    },
  });

  if (!subject) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col md:h-[calc(100vh-4rem)] -mx-4 -mb-4">

      {/* ── Top bar (redesigned: stacked rows, no overlap on mobile) ── */}
      <div className="border-b border-border bg-background flex-shrink-0">
        {/* Row 1: back, title, status */}
        <div className="flex items-center gap-3 px-4 py-3">
          <Link to={user?.role === 'admin' ? '/admin/courses' : '/teacher/courses'} className="flex-shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-sm truncate">{subject.name}</h1>
            <p className="text-xs text-muted-foreground truncate">{subject.form_name}</p>
          </div>
          <Badge className={`flex-shrink-0 gap-1 ${subject.status === 'published' ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-muted text-muted-foreground'}`}>
            {subject.status === 'published' ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span className="hidden sm:inline">{subject.status}</span>
          </Badge>
        </div>

        {/* Row 2: view toggle + stats — own row so nothing overlaps the title */}
        <div className="flex items-center justify-between gap-3 px-4 pb-3">
          <div className="flex items-center bg-muted rounded-xl p-0.5 gap-0.5 flex-shrink-0">
            <button onClick={() => setActiveView('curriculum')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeView === 'curriculum' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              <Layers className="w-3.5 h-3.5 inline mr-1" />Curriculum
            </button>
            <button onClick={() => setActiveView('details')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeView === 'details' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              <Settings className="w-3.5 h-3.5 inline mr-1" />Details
            </button>
          </div>
          <CourseStats topics={topics} lessons={lessons} />
        </div>
      </div>

      {/* ── Main content ── */}
      {activeView === 'details' ? (
        /* ── DETAILS VIEW (full width) ── */
        <div className="flex-1 md:overflow-hidden">
          <CourseDetailsPanel
            subject={subject}
            tutors={tutors}
            user={user}
            onSaved={() => qc.invalidateQueries({ queryKey: ['subject', subjectId] })}
          />
        </div>
      ) : (
        /* ── CURRICULUM VIEW — stacked on mobile, split on desktop ── */
        <div className="flex-1 flex flex-col md:flex-row md:overflow-hidden">

          {/* Curriculum Tree — full width on mobile (hidden when lesson selected), sidebar on desktop */}
          <div className={`
            md:w-64 md:flex-shrink-0 md:border-r md:border-border bg-background md:overflow-hidden flex flex-col
            ${selectedLesson ? 'hidden md:flex' : 'flex flex-1 md:flex-none'}
          `}>
            <CurriculumTree
              topics={topics}
              lessons={lessons}
              selectedLessonId={selectedLesson?.id}
              onSelectLesson={setSelectedLesson}
              onAddTopic={() => setTopicDialog({ open: true, topic: null })}
              onEditTopic={(t) => setTopicDialog({ open: true, topic: t })}
              onDeleteTopic={(id) => deleteTopicMut.mutate(id)}
              onDuplicateTopic={(t) => duplicateTopicMut.mutate(t)}
              onMoveTopic={(t, dir) => moveTopicMut.mutate({ topic: t, direction: dir })}
              onAddLesson={(topic) => addLessonMut.mutate({ topicId: topic.id, topicTitle: topic.title })}
              onDeleteLesson={(id) => setDeleteLessonId(id)}
              onDuplicateLesson={(l) => duplicateLessonMut.mutate(l)}
              onMoveLesson={(l, siblings, dir) => moveLessonMut.mutate({ lesson: l, siblings, direction: dir })}
              subjectId={subjectId}
            />
          </div>

          {/* Lesson Editor — full screen on mobile, flex-1 on desktop */}
          <div className={`flex-1 md:overflow-hidden bg-background flex flex-col ${selectedLesson ? 'flex' : 'hidden md:flex'}`}>
            {selectedLesson ? (
              <>
                {/* Mobile-only back button */}
                <button
                  className="md:hidden flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground border-b border-border bg-background flex-shrink-0"
                  onClick={() => setSelectedLesson(null)}
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to curriculum
                </button>
                <LessonEditor
                  key={selectedLesson.id}
                  lesson={selectedLesson}
                  subjectId={subjectId}
                  subjectName={subject.name}
                  onSaved={() => qc.invalidateQueries({ queryKey: ['lessons', subjectId] })}
                />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                  <PlayCircle className="w-8 h-8 text-muted-foreground/30" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Select a lesson to edit</p>
                  <p className="text-xs text-muted-foreground mt-1">Click any lesson in the curriculum tree, or add a new one</p>
                </div>
                {topics.length > 0 && (
                  <Button size="sm" variant="outline"
                    onClick={() => addLessonMut.mutate({ topicId: topics[0].id, topicTitle: topics[0].title })}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Add First Lesson
                  </Button>
                )}
                {topics.length === 0 && (
                  <Button size="sm" onClick={() => setTopicDialog({ open: true, topic: null })}
                    style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Add First Topic
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete lesson confirm dialog */}
      <Dialog open={!!deleteLessonId} onOpenChange={v => { if (!v) setDeleteLessonId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" /> Delete Lesson
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this lesson? This cannot be undone. Any quiz or assignment attached to it will also be removed.
          </p>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteLessonId(null)}>Cancel</Button>
            <Button
              className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => { deleteLessonMut.mutate(deleteLessonId); setDeleteLessonId(null); }}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Topic dialog */}
      <TopicDialog
        open={topicDialog.open}
        onOpenChange={(v) => setTopicDialog(d => ({ ...d, open: v }))}
        topic={topicDialog.topic}
        subjectId={subjectId}
        formId={subject?.form_id}
        nextOrder={topics.length}
      />
    </div>
  );
}

