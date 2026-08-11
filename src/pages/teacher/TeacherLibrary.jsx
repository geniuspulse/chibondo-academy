import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, FileText, Upload, Download } from 'lucide-react';
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

export default function TeacherLibrary() {
  const { user } = useOutletContext() ?? {};
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'past_paper',
    subject_id: '',
    form_id: '',
    year: new Date().getFullYear(),
    is_premium: true,
    status: 'draft',
    file_url: '',
  });

  const { data: resources = [] } = useQuery({
    queryKey: ['teacherLibraryResources'],
    queryFn: () => db.entities.RevisionResource.list('-created_date', 100),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => db.entities.Subject.filter({ status: 'published' }, 'order', 100),
  });

  const { data: forms = [] } = useQuery({
    queryKey: ['academicForms'],
    queryFn: () => db.entities.AcademicForm.filter({ status: 'active' }, 'order', 100),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => db.entities.RevisionResource.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacherLibraryResources'] });
      setDialogOpen(false);
      setForm({
        title: '',
        description: '',
        type: 'past_paper',
        subject_id: '',
        form_id: '',
        year: new Date().getFullYear(),
        is_premium: true,
        status: 'draft',
        file_url: '',
      });
      toast.success('Resource uploaded!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => db.entities.RevisionResource.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacherLibraryResources'] });
      toast.success('Resource deleted');
    },
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Guard: only allow safe file types
    const allowed = ['.pdf','.doc','.docx','.ppt','.pptx','.txt','.png','.jpg','.jpeg','.gif','.zip'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      toast.error(`File type "${ext}" is not supported. Allowed: PDF, Word, PPT, images, ZIP.`);
      e.target.value = '';
      return;
    }

    setUploading(true);
    setForm(prev => ({ ...prev, file_url: '' })); // clear previous
    try {
      // Release previous object URLs to free device memory
      const uploadToast = toast.loading(`Uploading ${file.name}…`);
      const response = await db.integrations.Core.UploadFile({ file });
      toast.dismiss(uploadToast);
      setForm(prev => ({ ...prev, file_url: response.file_url }));
      toast.success('File ready — fill in the details and save.');
    } catch (error) {
      toast.error('Upload failed. Try a smaller file or a stable connection.');
      console.error(error);
    } finally {
      setUploading(false);
      e.target.value = ''; // reset input so same file can be retried
    }
  };

  const handleSubmit = () => {
    if (!form.title || !form.subject_id || !form.form_id || !form.file_url) {
      toast.error('Please fill in all required fields and upload a file');
      return;
    }

    const subject = subjects.find(s => s.id === form.subject_id);
    const academicForm = forms.find(f => f.id === form.form_id);

    saveMutation.mutate({
      ...form,
      subject_name: subject?.name || '',
      form_name: academicForm?.name || '',
    });
  };

  const resourceTypeColors = {
    past_paper:     'bg-primary/10 text-primary border border-primary/20',
    model_answer:   'bg-success/10 text-success border border-success/20',
    revision_notes: 'bg-accent/10 text-accent-foreground border border-accent/20',
    exam_tips:      'bg-muted text-muted-foreground border border-border',
    mock_exam:      'bg-destructive/10 text-destructive border border-destructive/20',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Teacher Library</h1>
          <p className="text-sm text-muted-foreground mt-1">Upload and manage revision resources</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Upload Resource
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Upload Revision Resource</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Resource Title</Label>
                <Input
                  className="mt-1"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. 2024 Mathematics Past Paper"
                />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  className="mt-1"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description of the resource"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Resource Type</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => setForm({ ...form, type: v })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="past_paper">Past Paper</SelectItem>
                      <SelectItem value="book">Book / Notes</SelectItem>
                      <SelectItem value="exam_tips">Exam Tips</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Year</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
                  />
                </div>
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
                  <Label>Form/Class</Label>
                  <Select
                    value={form.form_id}
                    onValueChange={(v) => setForm({ ...form, form_id: v })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select form" />
                    </SelectTrigger>
                    <SelectContent>
                      {forms.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Upload File</Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                  PDF, Word, PPT, images or ZIP · Any size
                </p>
                {/* Custom drag-friendly file picker */}
                <label className={[
                  'flex flex-col items-center justify-center gap-2 w-full rounded-xl border-2 border-dashed p-6 cursor-pointer transition-colors',
                  uploading
                    ? 'border-border bg-muted/40 pointer-events-none'
                    : form.file_url
                    ? 'border-green-500/40 bg-green-500/5'
                    : 'border-border hover:border-primary/40 hover:bg-muted/30'
                ].join(' ')}>
                  <input
                    type="file"
                    className="sr-only"
                    onChange={handleFileUpload}
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.gif,.zip"
                    disabled={uploading}
                  />
                  {uploading ? (
                    <>
                      <Loader2 className="w-7 h-7 text-primary animate-spin" />
                      <span className="text-sm text-muted-foreground">Uploading… please wait</span>
                      <span className="text-xs text-muted-foreground">Don't close this page</span>
                    </>
                  ) : form.file_url ? (
                    <>
                      <FileText className="w-7 h-7 text-green-500" />
                      <span className="text-sm font-medium text-green-600">File uploaded ✓</span>
                      <span className="text-xs text-muted-foreground">Tap to replace</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-7 h-7 text-muted-foreground/60" />
                      <span className="text-sm font-medium">Tap to choose a file</span>
                      <span className="text-xs text-muted-foreground">PDF, Word, PPT, images, ZIP</span>
                    </>
                  )}
                </label>
              </div>

              <div>
                <Label>Premium Resource</Label>
                <Select
                  value={form.is_premium ? 'yes' : 'no'}
                  onValueChange={(v) => setForm({ ...form, is_premium: v === 'yes' })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes (Paid subscribers only)</SelectItem>
                    <SelectItem value="no">No (Free for all)</SelectItem>
                  </SelectContent>
                </Select>
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

              <Button 
                className="w-full" 
                onClick={handleSubmit} 
                disabled={!form.title || !form.subject_id || !form.form_id || !form.file_url || saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Uploading...' : 'Upload Resource'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {resources.map((resource) => (
          <div
            key={resource.id}
            className="bg-card rounded-xl border border-border p-4 flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-sm">{resource.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {resource.subject_name} · {resource.form_name} · {resource.year}
              </p>
              <div className="flex gap-2 mt-1">
                <Badge className={resourceTypeColors[resource.type] || 'bg-muted text-muted-foreground'}>
                  {resource.type.replace('_', ' ')}
                </Badge>
                {resource.is_premium && (
                  <Badge className="bg-accent/10 text-accent">Premium</Badge>
                )}
              </div>
            </div>
            <Badge className={resource.status === 'published' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
              {resource.status}
            </Badge>
            <a
              href={resource.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary"
            >
              <Download className="w-4 h-4" />
            </a>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => deleteMutation.mutate(resource.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
        {resources.length === 0 && (
          <div className="text-center py-16 bg-card rounded-xl border border-border">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-muted-foreground text-sm">No resources yet. Upload your first resource!</p>
          </div>
        )}
      </div>
    </div>
  );
}