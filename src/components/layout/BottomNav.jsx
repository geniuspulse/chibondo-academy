import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Gift, Library, CreditCard, MessageSquare, Home, Newspaper } from 'lucide-react';
import { cn } from '@/lib/utils';

// Nav items shown to authenticated students
const authNavItems = [
  { label: 'Classes',   icon: BookOpen,      path: '/subjects' },
  { label: 'Referrals', icon: Gift,          path: '/affiliate' },
  { label: 'Library',   icon: Library,       path: '/library' },
  { label: 'Chats',    icon: MessageSquare, path: '/forums' },
  { label: 'Fees',      icon: CreditCard,    path: '/fees' },
];

// Nav items shown to guests (public pages only)
const guestNavItems = [
  { label: 'Blog',     icon: Newspaper,     path: '/blog' },
  { label: 'Subjects', icon: BookOpen,      path: '/subjects' },
  { label: 'Subjects',   icon: BookOpen,    path: '/subjects' },
  { label: 'Library',  icon: Library,       path: '/library' },
  { label: 'Chats',   icon: MessageSquare, path: '/forums' },
];

export default function BottomNav({ user, notifications = [] }) {
  const location = useLocation();
  const navItems = user ? authNavItems : guestNavItems;

  // Map notification paths to badge counts
  const forumUnread    = notifications.filter(n => n.type === 'forum').length;
  const generalUnread  = notifications.filter(n => !['forum'].includes(n.type)).length;

  const badgeFor = (path) => {
    if (path === '/forums')  return forumUnread;
    if (path === '/subjects') return generalUnread;
    return 0;
  };

  return (
    <nav
      className={cn(
        // bottom-nav class is targeted by CSS for safe-area padding
        "bottom-nav lg:hidden fixed bottom-0 left-0 right-0 z-50",
        "bg-sidebar border-t border-sidebar-border",
        // Prevent any text/image selection on the nav itself
        "select-none"
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-stretch h-16">
        {navItems.map(({ label, icon: Icon, path }) => {
          const isActive = location.pathname === path ||
            (path !== '/' && location.pathname.startsWith(path));
          const badge = badgeFor(path);

          return (
            <Link
              key={path}
              to={path}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5',
                'text-[10px] font-medium relative',
                // Smooth colour transition on tab switch
                'transition-colors duration-150',
                isActive
                  ? 'text-accent'
                  : 'text-sidebar-foreground/50 active:text-sidebar-foreground'
              )}
              // Prevent tap highlight flash (native feel)
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {/* Icon + optional badge */}
              <div className="relative">
                <Icon className={cn('w-5 h-5 transition-transform duration-150', isActive && 'scale-110 text-accent')} />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center leading-none">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
              <span>{label}</span>
              {/* Active indicator bar */}
              {isActive && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-accent rounded-t-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
