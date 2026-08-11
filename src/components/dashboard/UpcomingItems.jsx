import React from 'react';
import { ClipboardList, FileText, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export default function UpcomingItems({ quizzes = [], assignments = [] }) {
  const items = [
    ...quizzes.map(q => ({ ...q, itemType: 'quiz' })),
    ...assignments.map(a => ({ ...a, itemType: 'assignment' })),
  ].slice(0, 5);

  if (items.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="font-heading font-semibold text-lg mb-4">Upcoming</h3>
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground text-sm">Nothing upcoming</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-5 flex flex-col min-h-0">
      <h3 className="font-heading font-semibold text-lg mb-4">Upcoming</h3>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
            <div className={`w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center ${
              item.itemType === 'quiz' ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'
            }`}>
              {item.itemType === 'quiz' ? <ClipboardList className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{item.title}</p>
              {item.due_date && (
                <p className="text-xs text-muted-foreground">
                  Due: {format(new Date(item.due_date), 'MMM d, yyyy')}
                </p>
              )}
            </div>
            <Badge variant="secondary" className="text-[10px] flex-shrink-0">
              {item.itemType === 'quiz' ? 'Quiz' : 'Assignment'}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}