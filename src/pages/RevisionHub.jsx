import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { Library, FileText, Download, Filter, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SEO from '@/components/SEO';

const typeLabels = {
  past_paper: 'Past Paper',
  model_answer: 'Model Answer',
  revision_notes: 'Revision Notes',
  exam_tips: 'Exam Tips',
  mock_exam: 'Mock Exam',
};

const typeColors = {
  past_paper: 'bg-primary/10 text-primary',
  model_answer: 'bg-success/10 text-success',
  revision_notes: 'bg-accent/10 text-accent',
  exam_tips: 'bg-destructive/10 text-destructive',
  mock_exam: 'bg-muted text-muted-foreground',
};

export default function RevisionHub() {
  const [typeFilter, setTypeFilter] = useState('all');
  const [formFilter, setFormFilter] = useState('all');

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ['revisionResources'],
    queryFn: async () => { try { return await db.entities.RevisionResource.filter({ status: 'published' }, '-created_date', 200); } catch(e) { console.error(e); return []; } },
  });

  const { data: forms = [] } = useQuery({
    queryKey: ['forms'],
    queryFn: () => (async () => [])(/* AcademicForm removed */),
  });

  const filtered = resources.filter(r => {
    const matchType = typeFilter === 'all' || r.type === typeFilter;
    const matchForm = formFilter === 'all' || r.form_id === formFilter;
    return matchType && matchForm;
  });

  return (
    <>
      <SEO 
        title="MSCE Revision Hub"
        description="Free MSCE revision resources - past papers, model answers, revision notes, and exam tips for Form 3 and Form 4 students in Malawi."
        canonical={`${window.location.origin}/revision`}
      />
      <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">MSCE Revision Hub</h1>
        <p className="text-sm text-muted-foreground mt-1">Past papers, model answers, and exam preparation resources</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(typeLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={formFilter} onValueChange={setFormFilter}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Form" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Forms</SelectItem>
            {forms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-40 bg-card rounded-xl border animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Library className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
          <p className="text-muted-foreground">No resources found</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(resource => (
            <div key={resource.id} className="bg-card rounded-xl border border-border p-5 hover:border-primary/30 transition-all">
              <div className="flex items-center justify-between mb-3">
                <Badge className={`text-[10px] ${typeColors[resource.type] || 'bg-muted text-muted-foreground'}`}>
                  {typeLabels[resource.type] || resource.type}
                </Badge>
                {resource.year && <span className="text-xs text-muted-foreground">{resource.year}</span>}
              </div>
              <h3 className="font-semibold text-sm">{resource.title}</h3>
              {resource.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{resource.description}</p>}
              <div className="flex items-center justify-between mt-4">
                <div className="text-xs text-muted-foreground">
                  {resource.subject_name} · {resource.form_name}
                </div>
                {resource.file_url && (
                  <a href={resource.file_url} target="_blank" rel="noopener noreferrer" className="text-primary text-xs font-medium flex items-center gap-1 hover:underline">
                    <Download className="w-3 h-3" /> Download
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </>
  );
}