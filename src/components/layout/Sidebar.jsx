import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, BookOpen, GraduationCap, FileText, BarChart3, TrendingUp,
  Users, Settings, Bell, CreditCard, MessageSquare,
  ChevronLeft, ChevronRight, LogOut, Library, ClipboardList,
  PenTool, LayoutDashboard, Gift, Newspaper, Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { db } from '@/api/supabaseClient';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const studentNav = [
  { label: 'Dashboard',    icon: Home,          path: '/dashboard' },
  { label: 'My Subjects',  icon: BookOpen,      path: '/subjects' },
  { label: 'Our Tutors',   icon: GraduationCap, path: '/tutors' },
  { label: 'Revision Hub', icon: Library,       path: '/revision' },
  { label: 'My Quizzes',   icon: ClipboardList, path: '/my-quizzes' },
  { label: 'Assignments',  icon: FileText,      path: '/my-assignments' },
  { label: 'Chats',       icon: MessageSquare, path: '/forums' },
  { label: 'Progress',     icon: BarChart3,     path: '/progress' },
  { label: 'Affiliate',    icon: Gift,          path: '/affiliate' },
  { label: 'School Fees',  icon: CreditCard,    path: '/fees' },
  { label: 'Blog',         icon: Newspaper,     path: '/blog' },
  { label: 'Settings',     icon: Settings,      path: '/settings' },
];

const teacherNav = [
  { label: 'Dashboard',         icon: LayoutDashboard, path: '/teacher' },
  { label: 'My Courses',        icon: BookOpen,        path: '/teacher/courses' },
  { label: 'Affiliate',           icon: Gift,            path: '/affiliate' },
  { label: 'Library',           icon: Library,         path: '/teacher/library' },
  { label: 'Quiz Builder',      icon: ClipboardList,   path: '/teacher/quizzes' },
  { label: 'Grading',           icon: PenTool,         path: '/teacher/grading' },
  { label: 'Student Progress',  icon: TrendingUp,      path: '/teacher/progress' },
  { label: 'Blog',              icon: Newspaper,       path: '/teacher/blog' },
  { label: 'Notifications',     icon: Bell,            path: '/teacher/notifications' },
  { label: 'Settings',          icon: Settings,        path: '/teacher/settings' },
];

const adminNav = [
  { label: 'Dashboard',      icon: LayoutDashboard, path: '/admin' },
  { label: 'Courses',        icon: BookOpen,        path: '/admin/courses' },
  { label: 'Curriculum',     icon: Layers,          path: '/admin/curriculum' },
  { label: 'Library',        icon: Library,         path: '/admin/library' },
  { label: 'Fees',           icon: CreditCard,      path: '/admin/subscriptions' },
  { label: 'Students',       icon: Users,           path: '/admin/users' },
  { label: 'Tutors',          icon: GraduationCap,   path: '/admin/tutors' },
  { label: 'Enrollments',      icon: TrendingUp,      path: '/admin/enrollment-analytics' },
  { label: 'Affiliates',     icon: Gift,            path: '/admin/affiliates' },
  { label: 'My Affiliate',   icon: Gift,            path: '/affiliate' },
  { label: 'Blog',           icon: Newspaper,       path: '/admin/blog' },
  { label: 'Notifications',  icon: Bell,            path: '/admin/notifications' },
  { label: 'Settings',       icon: Settings,        path: '/admin/settings' },
];

export default function Sidebar({ user, collapsed, onToggle, onNavigate, onAvatarClick }) {
  const location = useLocation();
  const role = user?.role === 'admin' ? 'admin' : user?.role === 'teacher' ? 'teacher' : 'student';
  const navItems = role === 'admin' ? adminNav : role === 'teacher' ? teacherNav : studentNav;

  return (
    <TooltipProvider delayDuration={0}>
      <aside className={cn(
        "fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground z-40 flex flex-col border-r border-sidebar-border",
        "transition-[width] duration-300 ease-in-out",
        collapsed ? "w-16" : "w-64"
      )}>
        {/* Logo */}
        <div className={cn("flex items-center border-b border-sidebar-border flex-shrink-0 h-16", collapsed ? "justify-center px-3" : "px-4")}>
          {collapsed ? (
            <img src="https://nckjjfxlmmsnmnexcgzg.supabase.co/storage/v1/object/public/assets/logo_square.jpg" alt="Chibondo Academy" className="w-9 h-9 rounded-lg object-cover" />
          ) : (
            <img src="https://nckjjfxlmmsnmnexcgzg.supabase.co/storage/v1/object/public/assets/logo_wide.jpg" alt="Chibondo Academy" className="h-10 w-full object-contain object-left" />
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto overflow-x-hidden space-y-0.5">
          {navItems.map((item, idx) => {
            const exactOnlyPaths = ['/admin', '/teacher', '/dashboard', '/'];
            const itemPath = item.path.split('?')[0]; // strip query string for matching
            const isActive = location.pathname === itemPath ||
              (!exactOnlyPaths.includes(itemPath) && itemPath.length > 1 && location.pathname.startsWith(itemPath + '/'));

            const linkEl = (
              <Link
                key={item.path}
                to={item.path}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative",
                  collapsed && "justify-center px-2",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <item.icon className={cn(
                  "flex-shrink-0 transition-colors",
                  collapsed ? "w-5 h-5" : "w-4 h-4",
                  isActive ? "text-sidebar-primary-foreground" : "text-sidebar-primary group-hover:text-sidebar-foreground"
                )} />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {isActive && !collapsed && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary-foreground opacity-70" />}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">{item.label}</TooltipContent>
                </Tooltip>
              );
            }
            return linkEl;
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-2 flex-shrink-0 space-y-1">
          {!collapsed && (
            <div
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-sidebar-accent/50 cursor-pointer hover:bg-sidebar-accent transition-colors"
              onClick={onAvatarClick}
              title="View profile photo"
            >
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user?.full_name}
                  className="w-7 h-7 rounded-full object-cover border border-sidebar-primary/40 flex-shrink-0"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-sidebar-primary flex items-center justify-center text-[11px] font-bold text-sidebar-primary-foreground flex-shrink-0">
                  {user?.full_name?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate text-sidebar-foreground">{user?.full_name || 'User'}</p>
                <p className="text-[10px] text-sidebar-foreground/50 capitalize">{role}</p>
              </div>
            </div>
          )}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={() => (() => { try { localStorage.removeItem('aca_access_token'); localStorage.removeItem('aca_refresh_token'); localStorage.removeItem('token'); } catch(_){} window.location.href = '/login'; })()} className="w-full flex items-center justify-center p-2.5 rounded-xl text-sidebar-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors">
                  <LogOut className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign Out</TooltipContent>
            </Tooltip>
          ) : (
            <button onClick={() => (() => { try { localStorage.removeItem('aca_access_token'); localStorage.removeItem('aca_refresh_token'); localStorage.removeItem('token'); } catch(_){} window.location.href = '/login'; })()} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-sidebar-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors">
              <LogOut className="w-4 h-4" /><span>Sign Out</span>
            </button>
          )}
          <button onClick={onToggle} className="hidden lg:flex w-full items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4" /><span>Collapse</span></>}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}


