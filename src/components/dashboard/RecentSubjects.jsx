import React from 'react';
import { Link } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';
import { ArrowRight, BookOpen } from 'lucide-react';

export default function RecentSubjects({ enrollments = [] }) {
  if (enrollments.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="font-heading font-semibold text-lg mb-4">My Subjects</h3>
        <div className="text-center py-8">
          <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground text-sm">No subjects enrolled yet</p>
          <Link to="/subjects" className="text-primary text-sm font-medium mt-2 inline-block hover:underline">
            Browse Subjects →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-5 flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-semibold text-lg">My Subjects</h3>
        <Link to="/subjects" className="text-sm text-primary font-medium flex items-center gap-1 hover:underline">
          View All <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="space-y-2">
        {enrollments.slice(0, 5).map((enrollment) => (
          <Link 
            key={enrollment.id} 
            to={`/subjects/${enrollment.subject_id}`}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                {enrollment.subject_name}
              </p>
              <p className="text-xs text-muted-foreground">{enrollment.form_name}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs font-semibold text-primary">{enrollment.progress_percentage || 0}%</p>
              <Progress value={enrollment.progress_percentage || 0} className="w-14 h-1.5 mt-1" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}