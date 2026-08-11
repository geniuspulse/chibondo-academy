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
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
      {status === 'saving' || status === 'pending' ? (
        <><Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> <span className="text-muted-foreground">Saving…</span></>
      ) : status === 'saved' ? (
        <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> <span className="text-emerald-400 font-semibold">Saved</span></>
      ) : status === 'error' ? (
        <><AlertCircle className="w-3.5 h-3.5 text-destructive" /> <span className="text-destructive font-semibold">Save failed</span></>
      ) : lastSaved ? (
        <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/70" /> <span className="text-muted-foreground">Saved {formatDistanceToNow(lastSaved, { addSuffix: true })}</span></>
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
  if (idMatch) return input; // raw video ID
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
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-semibold mb-2 block text-muted-foreground">Video Source</Label>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { val: 'none',     label: 'No Video',             icon: X },
            { val: 'youtube',  label: 'YouTube Link',         icon: Youtube },
            { val: 'upload',   label: 'Upload Video Lesson',  icon: Upload },
            { val: 'bunny',    label: 'Paste Video URL',      icon: Video },
          ].map(({ val, label, icon: Icon }) => (
            <button key={val} onClick={() => handleProviderChange(val)}
              className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium border transition-all w-full ${
                provider === val
                  ? 'border-primary bg-primary/10 text-primary shadow-sm font-semibold'
                  : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground bg-card'
              }`}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {provider === 'upload' && (
        <div className="space-y-2">
          <label className="block">
            <input type="file" accept="video/*" className="sr-only" onChange={handleFileUpload} />
            <div className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-2xl p-6 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors bg-card">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-foreground">Click to select video</p>
              <p className="text-xs text-muted-foreground">MP4, WebM, MOV · Upload continues in background</p>
            </div>
          </label>
          {urlInput && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" /> Video uploaded — processing in 1-2 min
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
              className="flex-1 text-sm bg-background border-border rounded-xl"
            />
            {fetching && <Loader2 className="w-4 h-4 animate-spin self-center text-primary" />}
          </div>

          {/* YouTube preview */}
          {provider === 'youtube' && meta && (
            <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-2xl">
              <img src={meta.thumbnail} alt="" className="w-20 h-12 object-cover rounded-xl flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{meta.title || 'YouTube Video'}</p>
                <p className="text-xs text-muted-foreground">YouTube · Linked</p>
              </div>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            </div>
          )}

          {/* Video link preview */}
          {provider === 'bunny' && urlInput && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400 font-medium">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-amber-400" /> Embedded Video Linked
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
    if (type.startsWith('image/')) return '🖼️';
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('doc')) return '📝';
    if (type.includes('spreadsheet') || type.includes('excel')) return '📊';
    if (type.startsWith('video/')) return '🎬';
    return '📎';
  };

  return (
    <div className="space-y-3">
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map(att => (
            <div key={att.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-2xl group">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-base flex-shrink-0">
                {fileIcon(att.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{att.name}</p>
                {att.size && <p className="text-[10px] text-muted-foreground">{formatSize(att.size)}</p>}
              </div>
              <a href={att.url} target="_blank" rel="noreferrer"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0">
                <Globe className="w-4 h-4" />
              </a>
              <button onClick={() => removeAttachment(att.id)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="block">
        <input type="file" className="sr-only" onChange={handleUpload} disabled={uploading} />
        <div className={`flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-2xl p-4 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors text-xs font-medium text-muted-foreground bg-card ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          {uploading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Upload className="w-4 h-4 text-primary" />}
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
    <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-sm">
      <div className="flex items-center gap-2.5 px-3.5 py-3 cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded(v => !v)}>
        <span className="w-6 h-6 rounded-xl bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
          {idx + 1}
        </span>
        <p className="flex-1 text-xs font-semibold truncate text-foreground">{q.question || 'Untitled question'}</p>
        <Badge className="text-[9px] h-5 rounded-full bg-muted text-muted-foreground border border-border px-2">{QTYPES.find(t => t.value === q.type)?.label || q.type}</Badge>
        <span className="text-[10px] font-medium text-muted-foreground">{q.points || 1}pt</span>
        <button onClick={e => { e.stopPropagation(); onDelete(); }}
          className="p-1 rounded-lg hover:bg-destructive/10 text-destructive flex-shrink-0 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
      </div>

      {expanded && (
        <div className="border-t border-border p-4 space-y-3.5 bg-card">
          <div>
            <Label className="text-[10px] font-semibold text-muted-foreground">Question</Label>
            <Textarea value={q.question} onChange={e => onChange({ ...q, question: e.target.value })}
              placeholder="Enter your question…" className="mt-1 text-xs min-h-[60px] resize-none bg-background border-border rounded-xl" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label className="text-[10px] font-semibold text-muted-foreground">Type</Label>
              <Select value={q.type} onValueChange={v => {
                const base = { ...q, type: v, options: ['', '', '', ''], correct_answer: '' };
                if (v === 'true_false') base.options = ['True', 'False'];
                onChange(base);
              }}>
                <SelectTrigger className="h-8 text-xs mt-1 bg-background border-border rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QTYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-24">
              <Label className="text-[10px] font-semibold text-muted-foreground">Points</Label>
              <Input type="number" value={q.points || 1} min={1}
                onChange={e => onChange({ ...q, points: Number(e.target.value) })}
                className="h-8 text-xs mt-1 bg-background border-border rounded-xl" />
            </div>
          </div>

          {(q.type === 'multiple_choice' || q.type === 'true_false') && (
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold text-muted-foreground">Options (click circle to mark correct)</Label>
              {(q.options || []).map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <button onClick={() => onChange({ ...q, correct_answer: opt })}
                    className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors ${
                      q.correct_answer === opt ? 'border-primary bg-primary' : 'border-border hover:border-primary/50'
                    }`} />
                  <Input value={opt} onChange={e => {
                    const opts = [...(q.options || [])];
                    opts[oi] = e.target.value;
                    onChange({ ...q, options: opts });
                  }} className="h-8 text-xs flex-1 bg-background border-border rounded-xl" placeholder={`Option ${oi + 1}`}
                  disabled={q.type === 'true_false'} />
                </div>
              ))}
              {q.type === 'multiple_choice' && (q.options || []).length < 6 && (
                <button onClick={() => onChange({ ...q, options: [...(q.options || []), ''] })}
                  className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 pt-1">
                  <Plus className="w-3.5 h-3.5" /> Add option
                </button>
              )}
            </div>
          )}

          {(q.type === 'fill_blank' || q.type === 'short_answer') && (
            <div>
              <Label className="text-[10px] font-semibold text-muted-foreground">Correct Answer</Label>
              <Input value={q.correct_answer || ''} onChange={e => onChange({ ...q, correct_answer: e.target.value })}
                placeholder={q.type === 'fill_blank' ? 'Expected answer (exact match)' : 'Model answer (for manual grading)'}
                className="mt-1 text-xs h-8 bg-background border-border rounded-xl" />
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
          setQuizId(created.id);
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

  const addQuestion = () => {
    const newQ = { id: Date.now().toString(), question: '', type: 'multiple_choice', options: ['', '', '', ''], correct_answer: '', points: 1 };
    setQs([...questions, newQ]);
  };

  const moveQuestion = (idx, direction) => {
    const swap = idx + direction;
    if (swap < 0 || swap >= questions.length) return;
    const copy = [...questions];
    const temp = copy[idx];
    copy[idx] = copy[swap];
    copy[swap] = temp;
    setQs(copy);
  };

  const duplicateQuestion = (idx) => {
    const target = questions[idx];
    const dup = { ...target, id: Date.now().toString(), question: target.question ? `${target.question} (Copy)` : '' };
    const copy = [...questions];
    copy.splice(idx + 1, 0, dup);
    setQs(copy);
  };

  if (isLoading) return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-semibold text-muted-foreground">Quiz Title</Label>
          <Input value={quizMeta.title} onChange={e => setMeta('title', e.target.value)}
            placeholder={lesson.title + ' Quiz'} className="mt-1 text-sm bg-background border-border rounded-xl" />
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground">Status</Label>
          <Select value={quizMeta.status} onValueChange={v => setMeta('status', v)}>
            <SelectTrigger className="mt-1 text-xs h-9 bg-background border-border rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground">Time Limit (min, 0 = unlimited)</Label>
          <Input type="number" min={0} value={quizMeta.time_limit_minutes}
            onChange={e => setMeta('time_limit_minutes', Number(e.target.value))}
            className="mt-1 text-sm bg-background border-border rounded-xl" />
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground">Pass Percentage (%)</Label>
          <Input type="number" min={0} max={100} value={quizMeta.pass_percentage}
            onChange={e => setMeta('pass_percentage', Number(e.target.value))}
            className="mt-1 text-sm bg-background border-border rounded-xl" />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs font-heading font-bold text-foreground">Questions ({questions.length})</p>
        <div className="flex items-center gap-2">
          <SaveStatus status={saveStatus} lastSaved={null} />
          <Button size="sm" onClick={addQuestion} className="h-8 text-xs font-bold gap-1.5 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 px-4">
            <Plus className="w-3.5 h-3.5" /> Add Question
          </Button>
        </div>
      </div>

      {questions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-border rounded-2xl gap-2 bg-card">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <ClipboardList className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-muted-foreground">No questions yet</p>
          <button onClick={addQuestion} className="text-xs font-bold text-primary hover:underline">Add first question</button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {questions.map((q, i) => (
            <div key={q.id} className="relative group/qwrap">
              <QuestionCard q={q} idx={i}
                onChange={updated => { const qs = [...questions]; qs[i] = updated; setQs(qs); }}
                onDelete={() => setQs(questions.filter((_, idx) => idx !== i))}
              />
              <div className="absolute top-2 right-10 flex items-center gap-0.5 opacity-0 group-hover/qwrap:opacity-100 transition-opacity z-10">
                <button onClick={() => moveQuestion(i, -1)} disabled={i === 0} title="Move up"
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground disabled:opacity-25">
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => moveQuestion(i, 1)} disabled={i === questions.length - 1} title="Move down"
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground disabled:opacity-25">
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => duplicateQuestion(i)} title="Duplicate"
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground font-medium">
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
    } font-medium;
  };

  if (isLoading) return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{assignmentId ? 'Editing — auto-saving' : 'No assignment yet for this lesson'}</p>
        <SaveStatus status={saveStatus} lastSaved={null} />
      </div>

      <div>
        <Label className="text-xs font-semibold text-muted-foreground">Title *</Label>
        <Input value={form.title} onChange={e => set('title', e.target.value)}
          placeholder={lesson.title + ' Assignment'} className="mt-1 bg-background border-border rounded-xl text-sm" />
      </div>

      <div>
        <Label className="text-xs font-semibold text-muted-foreground">Description</Label>
        <Textarea value={form.description} onChange={e => set('description', e.target.value)}
          placeholder="Brief description shown on student dashboard" className="mt-1 text-sm resize-none bg-background border-border rounded-xl" rows={2} />
      </div>

      <div>
        <Label className="text-xs font-semibold text-muted-foreground">Instructions</Label>
        <Textarea value={form.instructions} onChange={e => set('instructions', e.target.value)}
          placeholder="Detailed step-by-step instructions…" className="mt-1 text-sm bg-background border-border rounded-xl" rows={4} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-semibold text-muted-foreground">Due Date</Label>
          <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className="mt-1 bg-background border-border rounded-xl" />
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground">Total Marks</Label>
          <Input type="number" value={form.total_marks} min={1}
            onChange={e => set('total_marks', Number(e.target.value))} className="mt-1 bg-background border-border rounded-xl" />
        </div>
      </div>

      <div>
        <Label className="text-xs font-semibold text-muted-foreground">Status</Label>
        <Select value={form.status} onValueChange={v => set('status', v)}>
          <SelectTrigger className="mt-1 text-xs h-9 bg-background border-border rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs font-semibold mb-2 block text-muted-foreground">Attached Resources (for students)</Label>
        {(form.attachments || []).map(att => (
          <div key={att.id} className="flex items-center gap-2 p-2.5 bg-card border border-border rounded-xl mb-1.5 group">
            <FileText className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="text-xs font-medium flex-1 truncate text-foreground">{att.name}</span>
            <a href={att.url} target="_blank" rel="noreferrer" className="text-primary text-xs hover:underline flex-shrink-0 font-medium">Open</a>
            <button onClick={() => set('attachments', form.attachments.filter(a => a.id !== att.id))}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-destructive transition-opacity flex-shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <label className="block mt-2">
          <input type="file" className="sr-only" onChange={handleAttachmentUpload} disabled={uploading} />
          <div className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-2xl p-3 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors text-xs text-muted-foreground bg-card">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> : <Upload className="w-3.5 h-3.5 text-primary" />}
            {uploading ? 'Uploading resource…' : 'Attach student resource file'}
          </div>
        </label>
      </div>
    </div>
  );
}

// ─── LESSON EXTRAS PANEL ──────────────────────────────────────────────────────
function LessonExtrasPanel({ lesson, subjectId, onChange }) {
  return (
    <Tabs defaultValue="attachments" className="w-full">
      <TabsList className="grid grid-cols-3 bg-muted p-1 rounded-full border border-border">
        <TabsTrigger value="attachments" className="text-xs rounded-full font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground shadow-none">
          Attachments
        </TabsTrigger>
        <TabsTrigger value="quiz" className="text-xs rounded-full font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground shadow-none">
          Quiz
        </TabsTrigger>
        <TabsTrigger value="assignment" className="text-xs rounded-full font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground shadow-none">
          Assignment
        </TabsTrigger>
      </TabsList>

      <TabsContent value="attachments" className="pt-4">
        <AttachmentsPanel
          attachments={lesson.attachments || []}
          onChange={atts => onChange({ attachments: atts })}
        />
      </TabsContent>

      <TabsContent value="quiz" className="pt-4">
        <QuizPanel lesson={lesson} subjectId={subjectId} />
      </TabsContent>

      <TabsContent value="assignment" className="pt-4">
        <AssignmentPanel lesson={lesson} subjectId={subjectId} />
      </TabsContent>
    </Tabs>
  );
}

// ─── DUAL CONTENT EDITOR (VISUAL / CODE) ──────────────────────────────────────
function DualContentEditor({ value, onChange }) {
  const [mode, setMode] = useState('visual'); // visual | code
  const textRef = useRef(null);

  const wrap = (tag) => {
    const el = textRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const sel = value.slice(start, end);
    const replacement = `${tag}${sel || 'text'}${tag}`;
    const newVal = value.slice(0, start) + replacement + value.slice(end);
    onChange(newVal);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + tag.length, end + tag.length);
    }, 0);
  };

  const insertAtLineStart = (prefix) => {
    const el = textRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const v = value;
    const lineStart = v.lastIndexOf('\n', start - 1) + 1;
    const currentLine = v.slice(lineStart);
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
    { label: '`code`',  title: 'Inline code',    action: () => wrap('`'),                  mono: true  },
  ];

  return (
    <div className="space-y-3">
      {/* Header + mode toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <FileText className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-heading font-bold text-foreground">Lesson Notes</h3>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-full p-1 border border-border">
          <button
            onClick={() => setMode('visual')}
            className={[
              'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all',
              mode === 'visual'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            ].join(' ')}
          >
            <Type className="w-3.5 h-3.5" />
            Visual
          </button>
          <button
            onClick={() => setMode('code')}
            className={[
              'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all',
              mode === 'code'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            ].join(' ')}
          >
            <Code2 className="w-3.5 h-3.5" />
            Code
          </button>
        </div>
      </div>

      {mode === 'visual' ? (
        <div className="rounded-2xl border border-border overflow-hidden bg-card shadow-sm">
          {/* Formatting toolbar */}
          <div className="flex flex-wrap gap-1 p-2 bg-muted/40 border-b border-border">
            {TOOLBAR.map(({ label, title, action, mono, italic: ital }) => (
              <button
                key={title}
                title={title}
                onClick={action}
                className="px-2.5 py-1 rounded-lg text-xs hover:bg-card hover:shadow-sm transition-all text-foreground/80 hover:text-foreground min-w-[28px] text-center font-medium"
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
            className="min-h-[220px] resize-y text-sm leading-relaxed border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-card text-foreground"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="Write lesson notes here…&#10;&#10;Tip: use the toolbar above to format text, or switch to Code mode for HTML."
          />
          <div className="px-3.5 py-2 bg-muted/20 border-t border-border">
            <p className="text-[10px] text-muted-foreground">Supports Markdown — **bold**, _italic_, ## heading, - list</p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border overflow-hidden bg-card shadow-sm">
          <div className="flex items-center gap-2 px-3.5 py-2.5 bg-muted/40 border-b border-border">
            <Code2 className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">HTML / Code editor</span>
            <span className="ml-auto text-[10px] text-muted-foreground">Raw content — wrap text in HTML tags</span>
          </div>
          <Textarea
            className="min-h-[260px] resize-y font-mono text-xs leading-relaxed border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-slate-950 text-emerald-400 p-4"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={`<h2>Lesson Title</h2>
<p>Your content here…</p>

<!-- Example code block: -->
<pre><code>
print('Hello, World!')
</code></pre>`}
            spellCheck={false}
          />
          <div className="px-3.5 py-2 bg-muted/20 border-t border-border">
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

  useEffect(() => {
    setData(lesson);
    pendingRef.current = null;
  }, [lesson.id]);

  const saveFn = useCallback(async (payload) => {
    const { id, created_date, updated_date, created_by, created_by_id, ...clean } = payload;
    await db.entities.Lesson.update(lesson.id, clean);
    qc.invalidateQueries({ queryKey: ['lessons', subjectId] });
    onSaved?.();
    const wasPublished = lesson.status !== 'published' && clean.status === 'published';
    const contentChanged = lesson.status === 'published' && clean.status === 'published' &&
      (lesson.title !== clean.title || lesson.content !== clean.content || lesson.video_url !== clean.video_url);
    if (wasPublished || contentChanged) {
      try {
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
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <PlayCircle className="w-4 h-4" />
          </div>
          <span className="font-heading font-bold text-base text-foreground truncate max-w-[220px] sm:max-w-xs">{data.title || 'Untitled Lesson'}</span>
        </div>
        <div className="flex items-center gap-3">
          <SaveStatus status={saveStatus} lastSaved={lastSaved} />
          <Select value={data.status || 'draft'} onValueChange={v => set('status', v)}>
            <SelectTrigger className="h-8 text-xs w-28 bg-background border-border rounded-xl font-semibold"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Scrollable editor body */}
      <div className="flex-1 md:overflow-y-auto p-5 space-y-5">

        {/* Basic info card */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm">
          <h3 className="font-heading font-bold text-sm text-foreground flex items-center gap-2">
            <Edit2 className="w-4 h-4 text-primary" /> Basic Information
          </h3>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Lesson Title</Label>
              <Input
                value={data.title}
                onChange={e => set('title', e.target.value)}
                placeholder="e.g. Introduction to Photosynthesis"
                className="mt-1 text-sm bg-background border-border rounded-xl"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Description</Label>
              <Input
                value={data.description || ''}
                onChange={e => set('description', e.target.value)}
                placeholder="Brief summary shown in course outline"
                className="mt-1 text-sm bg-background border-border rounded-xl"
              />
            </div>
            <div className="w-40">
              <Label className="text-xs font-semibold text-muted-foreground">Est. Duration (mins)</Label>
              <Input
                type="number"
                min={1}
                value={data.estimated_minutes || 15}
                onChange={e => set('estimated_minutes', Number(e.target.value))}
                className="mt-1 text-sm bg-background border-border rounded-xl"
              />
            </div>
            {/* Free Preview Toggle */}
            <div className="flex items-center justify-between gap-3 pt-1 pb-1 px-3 rounded-xl bg-primary/5 border border-primary/15">
              <div className="flex-1">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-primary" /> Free Preview Lesson
                </Label>
                <p className="text-[10px] text-muted-foreground mt-0.5">Students can view this lesson without logging in. Recommended for the first 3 lessons.</p>
              </div>
              <Switch
                checked={!!data.is_free}
                onCheckedChange={v => set('is_free', v)}
              />
            </div>
          </div>
        </div>

        {/* Video Card */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm">
          <h3 className="font-heading font-bold text-sm text-foreground flex items-center gap-2">
            <Video className="w-4 h-4 text-primary" /> Video Lesson
          </h3>
          <VideoInput lesson={data} onChange={setVideo} />
        </div>

        {/* Notes Card */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm">
          <DualContentEditor value={data.content || ''} onChange={setContent} />
        </div>

        {/* Extras Card */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm">
          <h3 className="font-heading font-bold text-sm text-foreground flex items-center gap-2 mb-2">
            <Layers className="w-4 h-4 text-primary" /> Additional Resources & Activities
          </h3>
          <LessonExtrasPanel lesson={data} subjectId={subjectId} onChange={triggerSave} />
        </div>

      </div>
    </div>
  );
}

// ─── ACTION MENU ──────────────────────────────────────────────────────────────
function ActionMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
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
        className="p-1.5 min-w-[28px] min-h-[28px] rounded-xl hover:bg-muted text-muted-foreground transition-colors touch-manipulation"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 w-44 rounded-2xl border border-border bg-card shadow-2xl p-1 overflow-hidden"
        >
          {items.map((item, i) =>
            item === 'divider'
              ? <div key={i} className="border-t border-border my-1" />
              : (
                <button key={i}
                  onClick={() => { item.onClick(); setOpen(false); }}
                  disabled={!!item.disabled}
                  className={[
                    'flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left touch-manipulation',
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
    <div className="md:h-full flex flex-col bg-card border-r border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
          <span className="text-sm font-heading font-bold text-foreground">Curriculum</span>
        </div>
        <Button size="sm" onClick={onAddTopic}
          className="h-7 text-xs font-bold gap-1 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-3">
          <Plus className="w-3.5 h-3.5" /> Topic
        </Button>
      </div>

      {/* Tree */}
      <div className="flex-1 md:overflow-y-auto py-2 px-1">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed border-border rounded-2xl m-2 bg-card/50">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
              <Layers className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-foreground">No topics yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">Start by creating your first topic</p>
            <button onClick={onAddTopic} className="text-xs font-bold text-primary mt-2 hover:underline">
              + Add first topic
            </button>
          </div>
        ) : (
          <div className="space-y-1 mx-1">
          {sorted.map((topic, tIdx) => {
            const topicLessons = lessonsByTopic[topic.id] || [];
            const expanded = expandedTopics[topic.id] !== false;
            const topicMinutes = topicLessons.reduce((acc, l) => acc + (l.estimated_minutes || 0), 0);

            return (
              <div key={topic.id} className="py-0.5">
                {/* Topic row */}
                <div className="flex items-center gap-1.5 px-2.5 py-2.5 group rounded-xl hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                  <button
                    className="text-muted-foreground/50 flex-shrink-0 p-0.5 hover:text-foreground transition-colors"
                    onClick={() => toggleTopic(topic.id)}
                  >
                    {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                  <div
                    className="w-6 h-6 rounded-xl bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0 cursor-pointer select-none"
                    onClick={() => toggleTopic(topic.id)}
                  >
                    {tIdx + 1}
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer select-none" onClick={() => toggleTopic(topic.id)}>
                    <p className="text-xs font-heading font-semibold text-foreground truncate">{topic.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
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
                  <div className="ml-6 border-l-2 border-primary/20 pl-2 space-y-1 py-1">
                    {topicLessons.map((lesson, lIdx) => (
                      <div key={lesson.id}
                        className={[
                          'flex items-center gap-2 px-2.5 py-2 rounded-xl group/lesson cursor-pointer transition-all',
                          selectedLessonId === lesson.id
                            ? 'bg-primary/15 text-primary font-medium border-l-2 border-primary shadow-sm'
                            : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground',
                        ].join(' ')}
                        onClick={() => onSelectLesson(lesson)}
                      >
                        <PlayCircle className="w-3.5 h-3.5 flex-shrink-0 text-primary" />
                        <span className="flex-1 text-xs truncate">{lesson.title || 'Untitled'}</span>
                        {lesson.is_free && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-primary/15 text-primary flex-shrink-0">PREVIEW</span>
                        )}
                        {lesson.status === 'published'
                          ? <Eye className="w-3 h-3 flex-shrink-0 opacity-60 text-emerald-400" />
                          : <EyeOff className="w-3 h-3 flex-shrink-0 opacity-40 text-muted-foreground" />
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
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold text-primary hover:bg-primary/10 transition-colors w-full mt-1">
                      <Plus className="w-3.5 h-3.5" /> Add lesson
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
    seo_title: subject.seo_title || '',
    seo_description: subject.seo_description || '',
    seo_keywords: subject.seo_keywords || '',
    og_title: subject.og_title || '',
    og_description: subject.og_description || '',
    og_image: subject.og_image || '',
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
      seo_title: subject.seo_title || '',
      seo_description: subject.seo_description || '',
      seo_keywords: subject.seo_keywords || '',
      og_title: subject.og_title || '',
      og_description: subject.og_description || '',
      og_image: subject.og_image || '',
    });
  }, [subject]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      set('cover_image', file_url);
      toast.success('Cover image uploaded');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const saveMut = useMutation({
    mutationFn: () => db.entities.Subject.update(subject.id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subject', subject.id] });
      toast.success('Course details saved');
      onSaved?.();
    },
    onError: () => toast.error('Failed to save course details'),
  });

  const isAdmin = user?.role === 'admin';

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto overflow-y-auto max-h-full">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-heading font-bold text-foreground">Course Settings</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Manage course information, tutor assignments, and SEO metadata</p>
        </div>
        <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
          className="bg-primary text-primary-foreground rounded-full px-6 py-2.5 font-bold shadow-md hover:scale-[1.02] transition-all gap-2">
          {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Course Details
        </Button>
      </div>

      {/* ── Basic Info Card ── */}
      <section className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
        <h3 className="text-sm font-heading font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" /> Basic Course Details
        </h3>

        <div>
          <Label className="text-xs font-semibold text-muted-foreground">Course Name *</Label>
          <Input value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="e.g. Biology — Form 3" className="mt-1 bg-background border-border rounded-xl text-sm" />
        </div>

        <div>
          <Label className="text-xs font-semibold text-muted-foreground">Description</Label>
          <Textarea value={form.description} onChange={e => set('description', e.target.value)}
            placeholder="Full overview of what students will learn in this subject…" className="mt-1 text-sm bg-background border-border rounded-xl" rows={4} />
        </div>

        <div>
          <Label className="text-xs font-semibold mb-1.5 block text-muted-foreground">Cover Image</Label>
          <div className="flex items-start gap-4">
            {form.cover_image ? (
              <div className="relative w-36 h-24 rounded-2xl overflow-hidden border border-border flex-shrink-0 group bg-card">
                <img src={form.cover_image} alt="Cover" className="w-full h-full object-cover" />
                <button onClick={() => set('cover_image', '')}
                  className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white hover:bg-destructive transition-colors opacity-0 group-hover:opacity-100">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="w-36 h-24 rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors flex-shrink-0 bg-card">
                <input type="file" accept="image/*" className="sr-only" onChange={handleCoverUpload} disabled={uploading} />
                {uploading ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : <ImageIcon className="w-5 h-5 text-muted-foreground" />}
                <span className="text-[10px] text-muted-foreground font-medium">Upload cover</span>
              </label>
            )}
            <div className="space-y-2 flex-1">
              <Input value={form.cover_image} onChange={e => set('cover_image', e.target.value)}
                placeholder="Or paste image URL (https://…)" className="text-xs bg-background border-border rounded-xl" />
              <p className="text-[10px] text-muted-foreground">Recommended size: 1200×630px. Used in course cards and social shares.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Access & Visibility ── */}
      <section className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
        <h3 className="text-sm font-heading font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
          <Eye className="w-4 h-4 text-primary" /> Access & Visibility
        </h3>

        {/* Tutor assignment */}
        <div>
          <Label className="text-xs font-semibold text-muted-foreground">Assigned Tutor</Label>
          {isAdmin ? (
            <Select value={form.teacher_id} onValueChange={v => {
              const t = tutors.find(t => t.id === v);
              set('teacher_id', v);
              set('teacher_name', t?.full_name || '');
            }}>
              <SelectTrigger className="mt-1 bg-background border-border rounded-xl">
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
            <div className="mt-1 flex items-center gap-2 px-3.5 py-2.5 bg-muted/40 border border-border rounded-xl">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                {user?.full_name?.[0]?.toUpperCase()}
              </div>
              <span className="text-sm font-semibold text-foreground">{user?.full_name}</span>
              <Badge className="ml-auto text-[9px] rounded-full bg-primary/10 text-primary border-0">You</Badge>
            </div>
          )}
        </div>

        {/* Premium toggle */}
        <div className="flex items-center justify-between p-4 bg-muted/40 border border-border rounded-xl">
          <div>
            <p className="text-sm font-semibold text-foreground">Premium Course</p>
            <p className="text-xs text-muted-foreground">Requires active subscription to access content</p>
          </div>
          <Switch checked={!!form.is_premium} onCheckedChange={v => set('is_premium', v)} />
        </div>

        {/* Status */}
        <div>
          <Label className="text-xs font-semibold text-muted-foreground">Course Status</Label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger className="mt-1 bg-background border-border rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">
                <div className="flex items-center gap-2"><EyeOff className="w-3.5 h-3.5" /> Draft</div>
              </SelectItem>
              <SelectItem value="published">
                <div className="flex items-center gap-2"><Eye className="w-3.5 h-3.5 text-emerald-400" /> Published</div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* ── SEO & Social Sharing ── */}
      <section className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
        <div>
          <h3 className="text-sm font-heading font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
            <Search className="w-4 h-4 text-primary" /> SEO & Social Sharing
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Controls how this course appears in search engines and social media platforms.
          </p>
        </div>
        {/* Google preview */}
        <div className="bg-muted/40 border border-border rounded-2xl p-4 text-xs space-y-1">
          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1 tracking-wider">Google Preview</p>
          <p className="text-primary truncate font-mono text-[11px]">{window.location.origin}/subjects/{subject?.id || ''}</p>
          <p className="font-bold text-foreground text-sm">{form.seo_title || form.name || 'Course Name'} | Chibondo Academy</p>
          <p className="text-muted-foreground line-clamp-2 text-xs">{form.seo_description || (form.description || '').replace(/<[^>]+>/g, '').slice(0, 160) || 'Course description…'}</p>
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground">SEO Title <span className="font-normal text-muted-foreground/70">(50–60 chars)</span></Label>
          <Input value={form.seo_title || ''} onChange={e => set('seo_title', e.target.value)} maxLength={70}
            placeholder={`${form.name || 'Course Name'} | MSCE | Chibondo Academy`} className="mt-1 text-sm bg-background border-border rounded-xl" />
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground">SEO Description <span className="font-normal text-muted-foreground/70">(max 160 chars)</span></Label>
          <Textarea value={form.seo_description || ''} onChange={e => set('seo_description', e.target.value)} maxLength={180}
            placeholder="Defaults to course description" className="mt-1 text-sm resize-none bg-background border-border rounded-xl" rows={2} />
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground">SEO Keywords</Label>
          <Input value={form.seo_keywords || ''} onChange={e => set('seo_keywords', e.target.value)}
            placeholder="MSCE biology, photosynthesis, Malawi secondary" className="mt-1 text-sm bg-background border-border rounded-xl" />
        </div>
        {/* OG */}
        <div className="border-t border-border pt-4 space-y-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Open Graph (Facebook · WhatsApp · LinkedIn)</p>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground">OG Title</Label>
            <Input value={form.og_title || ''} onChange={e => set('og_title', e.target.value)}
              placeholder="Defaults to SEO Title" className="mt-1 text-sm bg-background border-border rounded-xl" />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground">OG Description</Label>
            <Textarea value={form.og_description || ''} onChange={e => set('og_description', e.target.value)}
              placeholder="Defaults to SEO Description" className="mt-1 text-sm resize-none bg-background border-border rounded-xl" rows={2} />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground">OG Image URL <span className="font-normal text-muted-foreground/70">(1200×630px)</span></Label>
            <Input value={form.og_image || ''} onChange={e => set('og_image', e.target.value)}
              placeholder="Defaults to course thumbnail" className="mt-1 text-sm bg-background border-border rounded-xl" />
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
    <div className="flex items-center gap-3 text-xs font-medium text-primary-foreground/90 flex-wrap">
      <span className="flex items-center gap-1.5 px-3 py-1 bg-card/20 backdrop-blur-sm border border-card/20 rounded-full">
        <Layers className="w-3.5 h-3.5" /> {topics.length} topics
      </span>
      <span className="flex items-center gap-1.5 px-3 py-1 bg-card/20 backdrop-blur-sm border border-card/20 rounded-full">
        <PlayCircle className="w-3.5 h-3.5" /> {lessons.length} lessons
      </span>
      {totalMinutes > 0 && (
        <span className="flex items-center gap-1.5 px-3 py-1 bg-card/20 backdrop-blur-sm border border-card/20 rounded-full">
          <Clock className="w-3.5 h-3.5" /> {durationStr} total
        </span>
      )}
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
      <DialogContent className="max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading font-bold text-lg text-foreground">
            {topic ? 'Edit Topic' : 'Add Topic'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground">Topic Name *</Label>
            <Input value={data.title} onChange={e => setData(d => ({ ...d, title: e.target.value }))}
              placeholder="e.g. Photosynthesis" className="mt-1 bg-background border-border rounded-xl text-sm" />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground">Description</Label>
            <Input value={data.description} onChange={e => setData(d => ({ ...d, description: e.target.value }))}
              placeholder="Optional description" className="mt-1 bg-background border-border rounded-xl text-sm" />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground">Order</Label>
            <Input type="number" value={data.order} onChange={e => setData(d => ({ ...d, order: parseInt(e.target.value) || 0 }))}
              className="mt-1 bg-background border-border rounded-xl text-sm" min={0} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 rounded-full">Cancel</Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !data.title} className="flex-1 bg-primary text-primary-foreground font-bold rounded-full hover:bg-primary/90">
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
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col md:h-[calc(100vh-4rem)] space-y-4">

      {/* ── BBA-style Gradient Hero Header ── */}
      <div className="relative overflow-hidden rounded-2xl p-5 border border-border flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.9) 0%, hsl(var(--chart-3) / 0.8) 100%)' }}>
        <div className="absolute inset-0 dot-grid opacity-20" />
        <div className="absolute top-0 right-0 w-48 h-48 bg-card/5 rounded-full -translate-y-1/2 translate-x-1/4" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <Link to={user?.role === 'admin' ? '/admin/courses' : '/teacher/courses'} className="flex-shrink-0">
              <button className="w-10 h-10 rounded-full bg-card/20 hover:bg-card/30 backdrop-blur-sm flex items-center justify-center text-primary-foreground transition-all">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-card/20 text-primary-foreground border border-primary-foreground/20 backdrop-blur-sm">
                  {subject.form_name || 'Course Builder'}
                </span>
                <Badge className={`gap-1 text-xs rounded-full border ${subject.status === 'published' ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30' : 'bg-card/20 text-primary-foreground/80 border-primary-foreground/20'}`}>
                  {subject.status === 'published' ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  <span className="capitalize">{subject.status}</span>
                </Badge>
              </div>
              <h1 className="text-xl sm:text-2xl font-heading font-bold text-primary-foreground truncate">
                {subject.name}
              </h1>
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-card/20 backdrop-blur-sm border border-card/20 rounded-full p-1 gap-1 flex-shrink-0 self-start sm:self-auto">
            <button
              onClick={() => setActiveView('curriculum')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeView === 'curriculum'
                  ? 'bg-card text-foreground shadow-md'
                  : 'text-primary-foreground/80 hover:text-primary-foreground'
              }`}
            >
              <Layers className="w-3.5 h-3.5 inline mr-1.5" /> Curriculum
            </button>
            <button
              onClick={() => setActiveView('details')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeView === 'details'
                  ? 'bg-card text-foreground shadow-md'
                  : 'text-primary-foreground/80 hover:text-primary-foreground'
              }`}
            >
              <Settings className="w-3.5 h-3.5 inline mr-1.5" /> Details
            </button>
          </div>
        </div>

        {/* Hero Stats inline */}
        <div className="relative z-10 flex gap-4 mt-4 pt-3 border-t border-primary-foreground/10 flex-wrap">
          <CourseStats topics={topics} lessons={lessons} />
        </div>
      </div>

      {/* ── Main Content Area ── */}
      {activeView === 'details' ? (
        /* ── DETAILS VIEW (full width) ── */
        <div className="flex-1 md:overflow-hidden bg-card border border-border rounded-2xl">
          <CourseDetailsPanel
            subject={subject}
            tutors={tutors}
            user={user}
            onSaved={() => qc.invalidateQueries({ queryKey: ['subject', subjectId] })}
          />
        </div>
      ) : (
        /* ── CURRICULUM VIEW — split pane on desktop ── */
        <div className="flex-1 flex flex-col md:flex-row border border-border rounded-2xl overflow-hidden bg-card shadow-sm">

          {/* Curriculum Tree Sidebar */}
          <div className={`
            md:w-72 md:flex-shrink-0 md:border-r md:border-border bg-card md:overflow-hidden flex flex-col
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

          {/* Lesson Editor */}
          <div className={`flex-1 md:overflow-hidden bg-background flex flex-col ${selectedLesson ? 'flex' : 'hidden md:flex'}`}>
            {selectedLesson ? (
              <>
                {/* Mobile-only back button */}
                <button
                  className="md:hidden flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-muted-foreground border-b border-border bg-card flex-shrink-0"
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
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8 py-16">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <PlayCircle className="w-8 h-8" />
                </div>
                <div>
                  <p className="font-heading font-bold text-base text-foreground">Select a lesson to edit</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">Click any lesson in the curriculum tree on the left, or add a new lesson to get started</p>
                </div>
                {topics.length > 0 && (
                  <Button size="sm" variant="outline"
                    className="rounded-full border-border hover:bg-muted font-semibold px-5"
                    onClick={() => addLessonMut.mutate({ topicId: topics[0].id, topicTitle: topics[0].title })}>
                    <Plus className="w-3.5 h-3.5 mr-1.5 text-primary" /> Add First Lesson
                  </Button>
                )}
                {topics.length === 0 && (
                  <Button size="sm" onClick={() => setTopicDialog({ open: true, topic: null })}
                    className="bg-primary text-primary-foreground font-bold rounded-full px-5 hover:bg-primary/90">
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
        <DialogContent className="max-w-sm bg-card border border-border rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-heading font-bold text-base text-foreground">
              <Trash2 className="w-5 h-5 text-destructive" /> Delete Lesson
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground leading-relaxed mt-1">
            Are you sure you want to delete this lesson? This action cannot be undone. Any quiz or assignment attached to it will also be permanently removed.
          </p>
          <div className="flex gap-3 pt-3">
            <Button variant="outline" className="flex-1 rounded-full text-xs font-semibold" onClick={() => setDeleteLessonId(null)}>Cancel</Button>
            <Button
              className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold rounded-full text-xs"
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
