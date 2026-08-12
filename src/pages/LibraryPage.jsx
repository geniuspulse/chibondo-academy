import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { db } from '@/api/supabaseClient';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Search, BookOpen, FileText, Lightbulb, GraduationCap, Library, Lock, Eye, Book } from 'lucide-react';
import { cn } from '@/lib/utils';
import SEO from '@/components/SEO';

// ── Only 3 categories ─────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  book:       { label: 'Book',       icon: Book,      color: 'bg-primary/10 text-primary border-primary/20',         iconBg: 'bg-primary/10 text-primary' },
  past_paper: { label: 'Past Paper', icon: FileText,  color: 'bg-muted text-muted-foreground border-border',         iconBg: 'bg-muted text-muted-foreground' },
  exam_tips:  { label: 'Exam Tips',  icon: Lightbulb, color: 'bg-accent/15 text-accent-foreground border-accent/20', iconBg: 'bg-accent/15 text-accent-foreground' },
};

const GOLD = 'hsl(var(--primary))';

export default function LibraryPage() {
  const ctx = useOutletContext() ?? {};
  const { user } = ctx;
  const [search, setSearch]           = useState('');
  const [typeFilter, setTypeFilter]   = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ['library-resources'],
    queryFn: async () => { try { return await db.entities.RevisionResource.filter({ status: 'published' }, '-created_date', 300); } catch(e) { console.error(e); return []; } },
  });

  const { data: subscription } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => { try { return await db.entities.Subscription.filter({ student_id: user.id, status: 'active' }, '-created_date', 1); } catch(e) { console.error(e); return []; } },
    enabled: !!user?.id,
    select: data => data[0] || null,
  });

  const hasPaidFees = !!subscription;

  // Only show the 3 allowed types
  const ALLOWED = new Set(['book', 'past_paper', 'exam_tips']);
  const validResources = resources.filter(r => ALLOWED.has(r.type));

  // Unique subjects from valid resources
  const subjects = [...new Set(validResources.map(r => r.subject_name).filter(Boolean))].sort();

  const filtered = validResources.filter(r => {
    const matchType    = typeFilter    === 'all' || r.type         === typeFilter;
    const matchSubject = subjectFilter === 'all' || r.subject_name === subjectFilter;
    const matchSearch  = !search ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      (r.description  || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.subject_name || '').toLowerCase().includes(search.toLowerCase());
    return matchType && matchSubject && matchSearch;
  });

  // Group by category label → subject
  const grouped = {};
  filtered.forEach(r => {
    const typeLabel    = TYPE_CONFIG[r.type]?.label || r.type;
    const subjectKey   = r.subject_name || 'General';
    if (!grouped[typeLabel]) grouped[typeLabel] = {};
    if (!grouped[typeLabel][subjectKey]) grouped[typeLabel][subjectKey] = [];
    grouped[typeLabel][subjectKey].push(r);
  });

  // Fixed display order
  const TYPE_ORDER = ['Book', 'Past Paper', 'Exam Tips'];
  const sortedTypes = TYPE_ORDER.filter(t => grouped[t]);

  const stats = [
    { label: 'Total',       value: validResources.length,                                  icon: Library,   bg: 'bg-primary/10',        color: 'text-primary'      },
    { label: 'Books',       value: validResources.filter(r => r.type === 'book').length,       icon: Book,      bg: 'bg-blue-500/10',       color: 'text-blue-600'     },
    { label: 'Past Papers', value: validResources.filter(r => r.type === 'past_paper').length, icon: FileText,  bg: 'bg-primary/10',        color: 'text-primary'      },
    { label: 'Exam Tips',   value: validResources.filter(r => r.type === 'exam_tips').length,  icon: Lightbulb, bg: 'bg-yellow-500/10',     color: 'text-yellow-600'   },
  ];

  return (
    <>
      <SEO
        title="MSCE Library — Books, Past Papers & Exam Tips | Chibondo Academy"
        description="Download MSCE books, past papers, and exam tips for Form 3 and Form 4. Biology, Chemistry, Maths, Physics and more."
        canonical={`${window.location.origin}/library`}
        keywords="MSCE past papers, books, exam tips, Form 3 resources, Form 4 resources, Malawi"
      />
      <div className="space-y-6">

        {/* ── Hero Header (matches site pattern) ── */}
        <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-primary-foreground">
          <h1 className="text-xl sm:text-2xl font-heading font-bold mb-1">Library</h1>
          <p className="text-primary-foreground/70 text-sm mb-4">
            {isLoading ? 'Loading resources…' : `${validResources.length} resources · Books, past papers & exam tips for MSCE`}
          </p>

          {/* Search integrated into hero */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by title, subject..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-10 bg-card text-foreground border-0 shadow-sm"
            />
          </div>

          {/* Stats inline */}
          <div className="flex gap-3 sm:gap-4 mt-4 overflow-x-auto scrollbar-hide pb-1">
            {stats.map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon className="w-4 h-4 opacity-60" />
                <span className="text-sm font-semibold whitespace-nowrap">{value}</span>
                <span className="text-xs opacity-60 whitespace-nowrap">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Filter pills ── */}
        <div className="flex flex-wrap gap-2 items-center">
          {[
            { key: 'all',        label: 'All' },
            { key: 'book',       label: 'Books' },
            { key: 'past_paper', label: 'Past Papers' },
            { key: 'exam_tips',  label: 'Exam Tips' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setTypeFilter(key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                typeFilter === key
                  ? 'border-transparent text-[hsl(222_47%_8%)]'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted'
              )}
              style={typeFilter === key ? { background: GOLD } : {}}>
              {label}
            </button>
          ))}
          <Select value={subjectFilter} onValueChange={setSubjectFilter}>
            <SelectTrigger className="h-8 text-xs w-auto min-w-[120px] max-w-[160px]">
              <SelectValue placeholder="All Subjects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* ── Content ── */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-36 bg-card rounded-xl border animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Library className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
            <p className="font-semibold text-muted-foreground">No resources found</p>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="space-y-8">
            {sortedTypes.map(typeName => (
              <div key={typeName}>
                {/* Category Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: 'hsl(var(--primary) / 0.12)' }}>
                    {typeName === 'Book'       && <Book      className="w-4 h-4 text-blue-600" />}
                    {typeName === 'Past Paper' && <FileText  className="w-4 h-4 text-primary" />}
                    {typeName === 'Exam Tips'  && <Lightbulb className="w-4 h-4 text-yellow-600" />}
                  </div>
                  <h2 className="text-base font-heading font-bold">{typeName}s</h2>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">
                    {Object.values(grouped[typeName]).flat().length} files
                  </span>
                </div>

                {/* Subject Groups */}
                <div className="space-y-4">
                  {Object.keys(grouped[typeName]).sort().map(subjectName => (
                    <div key={subjectName}>
                      {Object.keys(grouped[typeName]).length > 1 && (
                        <div className="flex items-center gap-2 mb-2 pl-1">
                          <BookOpen className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate">
                            {subjectName}
                          </h3>
                        </div>
                      )}
                      {/* Responsive card grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {grouped[typeName][subjectName].map(resource => (
                          <ResourceCard key={resource.id} resource={resource} hasPaidFees={hasPaidFees} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function ResourceCard({ resource, hasPaidFees }) {
  const navigate = useNavigate();
  const cfg    = TYPE_CONFIG[resource.type] || { label: resource.type, icon: FileText, color: 'bg-muted text-muted-foreground border-muted', iconBg: 'bg-muted text-muted-foreground' };
  const Icon   = cfg.icon;
  const locked = resource.is_premium && !hasPaidFees;

  return (
    <div className={cn(
      'group bg-card rounded-xl border transition-all duration-200 flex flex-col',
      locked
        ? 'border-border opacity-70'
        : 'border-border hover:border-primary/30 hover:shadow-md cursor-pointer'
    )}>
      <div className="p-4 flex flex-col flex-1">

        {/* Top row: icon + badge + year */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', cfg.iconBg)}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <Badge className={cn('text-[10px] px-2 py-0.5 border whitespace-nowrap', cfg.color)}>
              {cfg.label}
            </Badge>
            {resource.year && (
              <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5 whitespace-nowrap">
                {resource.year}
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h4 className="font-semibold text-sm leading-snug line-clamp-2 flex-1">{resource.title}</h4>
        {resource.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{resource.description}</p>
        )}

        {/* Subject tag */}
        {resource.subject_name && (
          <p className="text-[11px] text-muted-foreground mt-2 truncate">
            {[resource.subject_name, resource.form_name].filter(Boolean).join(' · ')}
          </p>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border gap-2">
          {locked ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="w-3 h-3 flex-shrink-0" /> Premium
            </span>
          ) : resource.file_url ? (
            <div className="flex items-center gap-3 w-full">
              <button
                onClick={() => navigate(`/library/read/${resource.id}`)}
                className="flex items-center gap-1 text-xs font-semibold hover:underline flex-shrink-0"
                style={{ color: GOLD }}
              >
                <Eye className="w-3 h-3" /> Read
              </button>
              {/* Download only for premium (paid) students */}
              {hasPaidFees ? (
                <>
                  <span className="text-muted-foreground/30">|</span>
                  <a
                    href={resource.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline flex-shrink-0"
                  >
                    <Download className="w-3 h-3" /> Download
                  </a>
                </>
              ) : (
                <span className="flex items-center gap-1 text-xs text-muted-foreground/50" title="Subscribe to download">
                  <Lock className="w-3 h-3" /> Download
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground italic">No file attached</span>
          )}
        </div>
      </div>
    </div>
  );
}
