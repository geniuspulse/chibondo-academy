import React, { useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { Bell, Check, BookOpen, ClipboardList, FileText, CreditCard, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

const typeIcons = {
  lesson: BookOpen,
  quiz: ClipboardList,
  assignment: FileText,
  subscription: CreditCard,
  announcement: Megaphone,
  system: Bell,
};

export default function NotificationsPage() {
  const { user } = useOutletContext() ?? {};
  const queryClient = useQueryClient();
  const autoMarkedRef = useRef(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => { try { return await db.entities.Notification.filter({ user_id: user.id }, '-created_date', 50); } catch(e) { console.error(e); return []; } },
    enabled: !!user?.id,
    staleTime: 0,
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => db.entities.Notification.update(id, { is_read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['unreadNotifications'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter(n => !n.is_read);
      await Promise.all(unread.map(n => db.entities.Notification.update(n.id, { is_read: true })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['unreadNotifications'] });
    },
  });

  // Auto mark-all-read when page is first loaded — clears the bell badge
  useEffect(() => {
    if (!user?.id || autoMarkedRef.current) return;
    const unread = notifications.filter(n => !n.is_read);
    if (unread.length === 0) return;
    autoMarkedRef.current = true;
    // Small delay so the user sees the unread indicators briefly before clearing
    const t = setTimeout(() => markAllMutation.mutate(), 1200);
    return () => clearTimeout(t);
  }, [notifications, user?.id]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAllMutation.mutate()} disabled={markAllMutation.isPending}>
            <Check className="w-4 h-4 mr-1" /> Mark All Read
          </Button>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border divide-y divide-border">
        {notifications.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">No notifications yet</p>
          </div>
        ) : (
          notifications.map(n => {
            const Icon = typeIcons[n.type] || Bell;
            return (
              <div
                key={n.id}
                className={`flex items-start gap-3 p-4 transition-colors cursor-pointer hover:bg-muted/30 ${!n.is_read ? 'bg-primary/5' : ''}`}
                onClick={() => !n.is_read && markReadMutation.mutate(n.id)}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${!n.is_read ? 'bg-primary/20' : 'bg-primary/10'}`}>
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm ${!n.is_read ? 'font-semibold' : 'font-medium'}`}>{n.title}</p>
                    {!n.is_read && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(n.created_date), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}