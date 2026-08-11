import React from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function FeesGateCard() {
  return (
    <div className="rounded-2xl border-2 border-accent/40 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/10 p-6 sm:p-8 text-center">
      <div className="flex justify-center mb-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <GraduationCap className="w-8 h-8 text-primary" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-accent flex items-center justify-center">
            <Lock className="w-3 h-3 text-accent-foreground" />
          </div>
        </div>
      </div>
      <h3 className="text-lg font-heading font-bold mb-2">Pay Fees to Access These Lessons</h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
        These lessons are available to students who have paid their school fees. 
        Pay now to unlock all lessons, quizzes, past papers, and more.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link to="/subscription">
          <Button className="w-full sm:w-auto px-8 font-semibold" size="lg">
            Pay Fees Now
          </Button>
        </Link>
        <Link to="/subjects">
          <Button variant="outline" className="w-full sm:w-auto" size="lg">
            Browse Other Subjects
          </Button>
        </Link>
      </div>

    </div>
  );
}