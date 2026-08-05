import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, BookOpen, GraduationCap, FileText, BarChart3,
  Users, Settings, CreditCard, MessageSquare, Library,
  ClipboardList, PenTool, LogOut, LayoutDashboard, Bell, TrendingUp, Gift, Newspaper, Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { db } from '@/api/supabaseClient';

const studentNav = [
  { label: 'Dashboard',    icon: Home,          path: '/dashboard' },
  { label: 'My Subjects',  icon: BookOpen,      path: '/subjects' },
  { label: 'Our Tutors',   icon: GraduationCap, path: '/tutors' },
  { label: 'Revision Hub', icon: Library,       path: '/revision' },
  { label: 'My Quizzes',   icon: ClipboardList, path: '/my-quizzes' },
  { label: 'Assignments',  icon: FileText,      path: '/my-assignments' },
  { label: 'Chats',       icon: MessageSquare, path: '/forums' },
  { label: 'Progress',     icon: BarChart3,     path: '/progress' },
  { label: 'School Fees',  icon: CreditCard,    path: '/fees' },
  { label: 'Blog',         icon: Newspaper,     path: '/blog' },
  { label: 'Settings',     icon: Settings,      path: '/settings' },
];

const teacherNav = [
  { label: 'Dashboard',        icon: LayoutDashboard, path: '/teacher' },
  { label: 'My Courses',       icon: BookOpen,        path: '/teacher/courses' },
  { label: 'Library',          icon: Library,         path: '/teacher/library' },
  { label: 'Quiz Builder',     icon: ClipboardList,   path: '/teacher/quizzes' },
  { label: 'Grading',          icon: PenTool,         path: '/teacher/grading' },
  { label: 'Student Progress', icon: TrendingUp,      path: '/teacher/progress' },
  { label: 'Affiliate',     icon: Gift,            path: '/affiliate' },
  { label: 'Blog',             icon: Newspaper,       path: '/teacher/blog' },
  { label: 'Notifications',    icon: Bell,            path: '/teacher/notifications' },
  { label: 'Settings',         icon: Settings,        path: '/teacher/settings' },
];

const adminNav = [
  { label: 'Dashboard',     icon: LayoutDashboard, path: '/admin' },
  { label: 'Courses',       icon: BookOpen,        path: '/admin/courses' },
  { label: 'Curriculum',    icon: Layers,          path: '/admin/curriculum' },
  { label: 'Library',       icon: Library,         path: '/admin/library' },
  { label: 'Tutor Profiles',icon: GraduationCap,   path: '/admin/tutors' },
  { label: 'Applications',  icon: FileText,        path: '/admin/teachers' },
  { label: 'Students',      icon: Users,           path: '/admin/users' },
  { label: 'Fees',          icon: CreditCard,      path: '/admin/subscriptions' },
  { label: 'Affiliates',    icon: Gift,            path: '/admin/affiliates' },
  { label: 'Blog',          icon: Newspaper,       path: '/admin/blog' },
  { label: 'Notifications', icon: Bell,            path: '/admin/notifications' },
  { label: 'Settings',      icon: Settings,        path: '/admin/settings' },
];

export default function MobileSidebar({ user, onClose }) {
  const location = useLocation();
  const role = user?.role === 'admin' ? 'admin' : user?.role === 'teacher' ? 'teacher' : 'student';
  const navItems = role === 'admin' ? adminNav : role === 'teacher' ? teacherNav : studentNav;

  return (
    <div className="h-full bg-sidebar text-sidebar-foreground flex flex-col">
      {/* Logo */}
      <div className="h-16 px-4 flex items-center border-b border-sidebar-border flex-shrink-0">
        <img
          src="https://nckjjfxlmmsnmnexcgzg.supabase.co/storage/v1/object/public/assets/logo_wide.jpg"
          alt="Chibondo Academy"
          className="h-10 w-full object-contain object-left"
        />
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const exactOnlyPaths = ['/admin', '/teacher', '/dashboard', '/'];
          const itemPath = item.path.split('?')[0]; // strip query string for matching
          const isActive = location.pathname === itemPath ||
            (!exactOnlyPaths.includes(itemPath) && itemPath.length > 1 && location.pathname.startsWith(itemPath + '/'));
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <item.icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-sidebar-primary-foreground" : "text-sidebar-primary")} />
              <span>{item.label}</span>
              {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary-foreground opacity-70" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3 space-y-1 flex-shrink-0">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-sidebar-accent/50 mb-1">
          <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center text-[11px] font-bold text-sidebar-primary-foreground flex-shrink-0">
            {user?.full_name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate text-sidebar-foreground">{user?.full_name || 'User'}</p>
            <p className="text-[10px] text-sidebar-foreground/50 capitalize">{role}</p>
          </div>
        </div>
        <button
          onClick={() => (() => { try { localStorage.removeItem('aca_access_token'); localStorage.removeItem('aca_refresh_token'); localStorage.removeItem('token'); } catch(_){} window.location.href = '/login'; })()}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-sidebar-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-4 h-4" /><span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}

