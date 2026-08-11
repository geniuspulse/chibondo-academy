import React from 'react';
import { Flame, PlayCircle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function WelcomeCard({ user }) {
  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.full_name?.split(' ')[0] || 'there';

  // Returning = has any learning hours or a streak
  const isReturning = (user?.total_learning_hours || 0) > 0 || (user?.study_streak || 0) > 0;
  const ctaLabel    = isReturning ? 'Continue Learning' : 'Start Learning';

  return (
    <div className="relative overflow-hidden rounded-2xl p-6 lg:p-8 border border-border"
      style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.9) 0%, hsl(var(--chart-3) / 0.8) 100%)' }}>
      {/* Decorative blobs */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-card/5 rounded-full -translate-y-1/2 translate-x-1/4" />
      <div className="absolute bottom-0 left-1/3 w-32 h-32 bg-accent/20 rounded-full translate-y-1/2" />
      <div className="absolute inset-0 dot-grid opacity-20" />

      <div className="relative z-10">
        <p className="text-sm text-primary-foreground/70">{greeting}</p>
        <h2 className="text-2xl lg:text-3xl font-heading font-bold mt-1 text-primary-foreground">
          {firstName}! 👋
        </h2>
        <p className="text-sm text-primary-foreground/60 mt-1.5">
          {isReturning ? "Pick up where you left off." : "Let's get started on your MSCE journey."}
        </p>

        <div className="flex items-center gap-3 mt-5 flex-wrap">
          <Link to="/subjects">
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-card text-foreground transition-all hover:scale-[1.02] active:scale-95">
              <PlayCircle className="w-4 h-4" />
              {ctaLabel}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </Link>
          {(user?.study_streak || 0) > 0 && (
            <div className="flex items-center gap-2 bg-card/10 backdrop-blur-sm rounded-full px-4 py-2 border border-card/20">
              <Flame className="w-4 h-4 text-accent-foreground" />
              <span className="text-sm font-medium text-primary-foreground">
                {user.study_streak} day streak
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
