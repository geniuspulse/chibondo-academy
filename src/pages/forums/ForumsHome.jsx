// src/pages/forums/ForumsHome.jsx
// Polished WhatsApp-style community list — Dark theme

import React, { useState, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import SEO from '@/components/SEO';
import { Search, Plus, Users, Pin } from 'lucide-react';

const SUBJECT_META = {
  biology:                  { icon: '🧬', color: '#00897B' },
  chemistry:                { icon: '⚗️', color: '#7B1FA2' },
  physics:                  { icon: '⚡', color: '#1565C0' },
  mathematics:              { icon: '📐', color: '#E65100' },
  'additional mathematics': { icon: '∑',  color: '#880E4F' },
  english:                  { icon: '📖', color: '#2E7D32' },
  'english language':       { icon: '📖', color: '#2E7D32' },
  'english literature':     { icon: '📚', color: '#4527A0' },
  chichewa:                 { icon: '🗣️', color: '#00695C' },
  agriculture:              { icon: '🌱', color: '#558B2F' },
  geography:                { icon: '🌍', color: '#00838F' },
  history:                  { icon: '📜', color: '#BF360C' },
};

function getMeta(name = '') {
  return SUBJECT_META[name.toLowerCase()] || { icon: '💬' };
}

function relativeTime(iso) {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (diff < 1)    return 'now';
  if (diff < 60)   return `${diff}m`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h`;
  return `${Math.floor(diff / 1440)}d`;
}

// Avatar for subject/group chats
function ChatAvatar({ src, icon, color, size = 50 }) {
  if (src) {
    return (
      <img
        src={src}
        alt="chat"
        className="w-[50px] h-[50px] rounded-full object-cover flex-shrink-0"
      />
    );
  }
  return (
    <div
      className={`w-[50px] h-[50px] rounded-full flex-shrink-0 flex items-center justify-center text-xl shadow-sm ${
        color ? '' : 'bg-primary/10 text-primary'
      }`}
      style={color ? { backgroundColor: color } : undefined}
    >
      {icon || '💬'}
    </div>
  );
}

// Unread badge
function Badge({ count }) {
  if (!count) return null;
  return (
    <div className="min-w-[20px] h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-extrabold flex items-center justify-center px-1.5">
      {count > 99 ? '99+' : count}
    </div>
  );
}

export default function ForumsHome() {
  const navigate = useNavigate();
  const { user } = useOutletContext() ?? {};
  const [search, setSearch] = useState('');

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ['forum-subjects'],
    queryFn: async () => {
      try {
        return await db.entities.Subject.filter({ status: 'published' }, 'name', 100);
      } catch (e) {
        console.error(e);
        return [];
      }
    },
    staleTime: 120_000,
    placeholderData: [],
  });

  const { data: recentMsgs = [] } = useQuery({
    queryKey: ['forum-recent-msgs'],
    queryFn: async () => {
      try {
        return await db.entities.GroupChatMessage.filter({}, '-created_date', 200);
      } catch (e) {
        console.error(e);
        return [];
      }
    },
    staleTime: 30_000,
    placeholderData: [],
  });

  // Per-subject: last message + count
  const subjectStats = useMemo(() => {
    const stats = {};
    recentMsgs.forEach(m => {
      if (m.group_id?.startsWith('subject-')) {
        const sid = m.group_id.replace('subject-', '');
        if (!stats[sid]) stats[sid] = { count: 0, lastMsg: null, lastDate: null };
        stats[sid].count += 1;
        const d = new Date(m.created_date);
        if (!stats[sid].lastDate || d > stats[sid].lastDate) {
          stats[sid].lastDate = d;
          stats[sid].lastMsg = m.body;
          stats[sid].lastTime = m.created_date;
        }
      }
    });
    return stats;
  }, [recentMsgs]);

  const { data: myGroups = [] } = useQuery({
    queryKey: ['my-study-groups', user?.id],
    queryFn: async () => {
      try {
        return await db.entities.StudyGroup.filter({ status: 'active' }, '-created_date', 100);
      } catch (e) {
        console.error(e);
        return [];
      }
    },
    enabled: !!user?.id,
    staleTime: 30_000,
    select: groups =>
      groups.filter(
        g => g.creator_id === user?.id || (g.member_ids || []).includes(user?.id)
      ),
    placeholderData: [],
  });

  const filteredSubjects = useMemo(() => {
    const filtered = subjects.filter(
      s => !search || s.name.toLowerCase().includes(search.toLowerCase())
    );
    // Sort by latest activity — chats with recent messages float to the top
    return [...filtered].sort((a, b) => {
      const ta = subjectStats[a.id]?.lastTime
        ? new Date(subjectStats[a.id].lastTime).getTime()
        : 0;
      const tb = subjectStats[b.id]?.lastTime
        ? new Date(subjectStats[b.id].lastTime).getTime()
        : 0;
      return tb - ta;
    });
  }, [subjects, search, subjectStats]);

  const goSubject = s => {
    const slug = s.slug || s.name.toLowerCase().replace(/\s+/g, '-');
    navigate(`/forums/${slug}/chat`, { state: { subject: s } });
  };
  const goCommunity = () =>
    navigate('/forums/community/chat', {
      state: {
        isCommunity: true,
        subject: { id: 'community', name: 'Chibondo Academy', slug: 'community' },
      },
    });
  const goGroup = g => navigate(`/forums/group-${g.id}/chat`, { state: { group: g } });

  return (
    <>
      <SEO title="Chats | Chibondo Academy" description="Connect with peers and tutors." />

      {/* Full-page container — sits inside AppLayout's main content area */}
      <div className="flex flex-col bg-background min-h-full">
        {/* ── Top header bar ── */}
        <div className="bg-card border-b border-border text-foreground px-4 pt-3.5 pb-2.5 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-xl font-heading font-extrabold tracking-wide text-foreground m-0">
              Community
            </h1>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-0">
              {subjects.length} subject groups · {myGroups.length} study groups
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/forums/community/chat', { state: { createGroup: true } })}
              className="bg-primary/20 border border-primary/40 hover:bg-primary/30 text-primary transition-colors rounded-xl px-3 py-1.5 flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> New Group
            </button>
          </div>
        </div>

        {/* ── Search bar ── */}
        <div className="bg-card px-3 pb-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search chats…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full py-2 pl-9 pr-3.5 rounded-full bg-muted text-foreground placeholder:text-muted-foreground text-sm outline-none border border-transparent focus:border-primary/50 transition-colors"
            />
          </div>
        </div>

        {/* ── List ── */}
        <div className="flex-1 overflow-y-auto bg-background">
          {/* Pinned: Academy Community Chat */}
          <div
            onClick={goCommunity}
            className="flex items-center gap-3 p-3 sm:px-4 border-b border-border cursor-pointer bg-primary/10 hover:bg-primary/15 transition-colors"
          >
            {/* Gold ring on pinned avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-[50px] h-[50px] rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center text-2xl shadow-sm">
                🎓
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary border-2 border-card flex items-center justify-center">
                <Pin className="w-2 h-2 text-primary-foreground" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-foreground">Chibondo Academy</span>
                <span className="text-[11px] text-muted-foreground">Pinned</span>
              </div>
              <p className="mt-0.5 mb-0 text-xs text-muted-foreground truncate">
                Official community — all students & tutors
              </p>
            </div>
          </div>

          {/* Section: Subject Chats */}
          {filteredSubjects.length > 0 && (
            <>
              <div className="px-4 py-2 bg-muted/50 border-y border-border">
                <span className="text-[11px] font-extrabold text-muted-foreground tracking-wider uppercase">
                  Subject Groups · {filteredSubjects.length}
                </span>
              </div>

              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex gap-3 p-3 sm:px-4 border-b border-border bg-card animate-pulse"
                  >
                    <div className="w-[50px] h-[50px] rounded-full bg-muted flex-shrink-0" />
                    <div className="flex-1 pt-1">
                      <div className="h-3.5 bg-muted rounded-md w-7/12 mb-2" />
                      <div className="h-3 bg-muted/60 rounded-md w-10/12" />
                    </div>
                  </div>
                ))
              ) : (
                filteredSubjects.map(subject => {
                  const meta = getMeta(subject.name);
                  const stats = subjectStats[subject.id] || {};

                  const lastVisit = localStorage.getItem(
                    `chat_last_visit_subject-${subject.id}`
                  );
                  const hasUnread =
                    stats.lastTime &&
                    (!lastVisit || new Date(stats.lastTime) > new Date(lastVisit));

                  return (
                    <div
                      key={subject.id}
                      onClick={() => {
                        localStorage.setItem(
                          `chat_last_visit_subject-${subject.id}`,
                          new Date().toISOString()
                        );
                        goSubject(subject);
                      }}
                      className="flex items-center gap-3 p-3 sm:px-4 border-b border-border bg-card hover:bg-accent/10 transition-colors cursor-pointer"
                    >
                      <ChatAvatar icon={meta.icon} color={meta.color} size={50} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`text-sm truncate ${
                              hasUnread
                                ? 'font-extrabold text-foreground'
                                : 'font-semibold text-foreground/90'
                            }`}
                          >
                            {subject.name}
                          </span>
                          <span
                            className={`text-[11px] shrink-0 whitespace-nowrap ${
                              hasUnread
                                ? 'font-bold text-foreground'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {relativeTime(stats.lastTime)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p
                            className={`text-xs truncate flex-1 m-0 ${
                              hasUnread
                                ? 'font-semibold text-foreground/90'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {stats.lastMsg || 'Tap to join the conversation'}
                          </p>
                          {hasUnread && <Badge count={stats.count} />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* Section: My Study Groups */}
          {myGroups.length > 0 && (
            <>
              <div className="px-4 py-2 bg-muted/50 border-y border-border">
                <span className="text-[11px] font-extrabold text-muted-foreground tracking-wider uppercase">
                  My Study Groups · {myGroups.length}
                </span>
              </div>

              {myGroups.map(group => (
                <div
                  key={group.id}
                  onClick={() => goGroup(group)}
                  className="flex items-center gap-3 p-3 sm:px-4 border-b border-border bg-card hover:bg-accent/10 transition-colors cursor-pointer"
                >
                  <div className="relative flex-shrink-0">
                    <ChatAvatar
                      src={group.icon_url}
                      icon={group.icon || '💬'}
                      color="#128C7E"
                      size={50}
                    />
                    {group.is_private && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[9px]">
                        🔒
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-sm text-foreground truncate">
                        {group.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground shrink-0 whitespace-nowrap">
                        {relativeTime(group.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground truncate flex-1 m-0">
                        {group.last_message || group.description || 'Study group'}
                      </p>
                      <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
                        <Users className="w-2.5 h-2.5" />
                        <span className="text-[10px]">{group.member_count || 1}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Empty state */}
          {!isLoading && filteredSubjects.length === 0 && (
            <div className="text-center py-12 px-6 text-muted-foreground">
              <div className="text-5xl mb-3">💬</div>
              <p className="font-bold text-base text-foreground mb-1">No chats found</p>
              <p className="text-sm m-0">Try a different search term</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
