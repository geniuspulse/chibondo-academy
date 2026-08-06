import React from 'react';
import { Link } from 'react-router-dom';
import { LogIn, UserPlus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * GuestCTA — a call-to-action banner shown at the bottom of public pages
 * for unauthenticated visitors. Drop this component anywhere inside a public
 * page and it renders nothing for authenticated users.
 *
 * Usage:
 *   import GuestCTA from '@/components/GuestCTA';
 *   ...
 *   <GuestCTA />             // at bottom of BlogPage, SubjectDetail, etc.
 *   <GuestCTA compact />     // smaller inline version for mid-page prompts
 */
export default function GuestCTA({ compact = false, message }) {
  if (compact) {
    return (
      <div className="rounded-xl px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 mt-6"
        style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--primary))' }}>
        <p className="text-sm text-center sm:text-left" style={{ color: 'hsl(var(--primary))' }}>
          <Sparkles className="inline w-4 h-4 mr-1.5" style={{ color: 'hsl(var(--primary))' }} />
          {message || 'Create a free account to unlock this and much more.'}
        </p>
        <div className="flex gap-2 shrink-0">
          <Link to="/login">
            <Button variant="outline" size="sm" className="h-8 text-xs border-sidebar-border text-sidebar-foreground hover:text-white">
              <LogIn className="w-3.5 h-3.5 mr-1.5" />Log In
            </Button>
          </Link>
          <Link to="/register">
            <Button size="sm" className="h-8 text-xs font-semibold"
              style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }}>
              <UserPlus className="w-3.5 h-3.5 mr-1.5" />Sign Up Free
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-6 sm:p-8 mt-10 text-center"
      style={{
        background: 'linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--muted)) 100%)',
        border: '1px solid hsl(var(--primary))',
        boxShadow: '0 0 40px hsl(var(--primary))',
      }}>
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4"
        style={{ background: 'hsl(var(--primary) / 0.15)' }}>
        <Sparkles className="w-6 h-6" style={{ color: 'hsl(var(--primary))' }} />
      </div>
      <h3 className="text-lg font-semibold mb-2 text-white">
        {message || 'Ready to start learning?'}
      </h3>
      <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: 'hsl(215 20% 65%)' }}>
        Create your free account to enrol in subjects, track your progress,
        join live forums, access the library and more.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link to="/register">
          <Button size="lg" className="w-full sm:w-auto font-semibold px-8"
            style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }}>
            <UserPlus className="w-4 h-4 mr-2" />
            Create Free Account
          </Button>
        </Link>
        <Link to="/login">
          <Button variant="outline" size="lg" className="w-full sm:w-auto border-sidebar-border text-sidebar-foreground hover:text-white px-8">
            <LogIn className="w-4 h-4 mr-2" />
            Log In
          </Button>
        </Link>
      </div>
    </div>
  );
}
