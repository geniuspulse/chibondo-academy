import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import {
  BookOpen, CreditCard,
  CheckCircle2, Circle, ChevronDown, ChevronUp, X, ArrowRight, Sparkles
} from 'lucide-react';

const DISMISS_KEY  = (uid) => `aca_checklist_dismissed_${uid}`;
const SNOOZE_KEY   = (uid) => `aca_checklist_snooze_${uid}`;
const SNOOZE_HOURS = 6;

function useLocalDismiss(userId) {
  const isDismissed = () => {
    if (!userId) return false;
    if (localStorage.getItem(DISMISS_KEY(userId)) === 'done') return true;
    const snooze = localStorage.getItem(SNOOZE_KEY(userId));
    if (snooze) {
      const until = new Date(snooze);
      if (new Date() < until) return true;
      localStorage.removeItem(SNOOZE_KEY(userId));
    }
    return false;
  };
  const snooze   = () => {
    const until = new Date(Date.now() + SNOOZE_HOURS * 60 * 60 * 1000);
    localStorage.setItem(SNOOZE_KEY(userId), until.toISOString());
  };
  const markDone = () => localStorage.setItem(DISMISS_KEY(userId), 'done');
  return { isDismissed, snooze, markDone };
}

export default function SetupChecklist({ user }) {
  const navigate               = useNavigate();
  const userId                 = user?.id;
  const { isDismissed, snooze, markDone } = useLocalDismiss(userId);

  const [visible,   setVisible]   = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // ── Remote data ────────────────────────────────────────────────────────────
  const { data: enrollments = [] } = useQuery({
    queryKey: ['enrollments', userId],
    queryFn:  () => db.entities.Enrollment.filter({ student_id: userId }, '-created_date', 100),
    enabled:  !!userId,
    staleTime: 0,
  });

  const { data: subscription } = useQuery({
    queryKey: ['subscription', userId],
    queryFn:  () => db.entities.Subscription.filter({ student_id: userId, status: 'active' }, '-created_date', 1).then(r => r[0] || null),
    enabled:  !!userId,
    staleTime: 0,
  });

  // ── Derived checklist state ────────────────────────────────────────────────
  const hasEnroll = enrollments.length > 0;
  const hasFees   = !!(subscription);

  const items = [
    { id: 'enroll',  done: hasEnroll,  label: 'Choose subjects to enroll in', icon: BookOpen,      action: () => navigate('/enroll-subjects') },
    { id: 'fees',    done: hasFees,    label: 'Pay fees to start learning',   icon: CreditCard,    action: () => navigate('/subscription') },
  ];

  const doneCount = items.filter(i => i.done).length;
  const allDone   = doneCount === items.length;
  const pct       = Math.round((doneCount / items.length) * 100);

  useEffect(() => {
    if (!userId) return;
    if (allDone) { markDone(); setVisible(false); return; }
    setVisible(!isDismissed());
  }, [userId, allDone, doneCount]);

  if (!visible || !userId) return null;

  return (
    <div className="rounded-2xl border border-border bg-card text-card-foreground overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-accent" />
          </div>
          <div>
            <p className="font-heading font-bold text-sm text-foreground">Set up your account</p>
            <p className="text-[11px] text-muted-foreground">{doneCount} of {items.length} complete</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCollapsed(v => !v)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button
            onClick={() => { snooze(); setVisible(false); }}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Remind me later">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-5 pb-3">
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Items */}
      {!collapsed && (
        <div className="px-3 pb-4 space-y-0.5">
          {items.map(item => (
            <ChecklistItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChecklistItem({ item }) {
  const Icon = item.icon;
  return (
    <div
      className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
        item.done
          ? 'opacity-50 cursor-default'
          : 'hover:bg-muted cursor-pointer active:bg-muted/70'
      }`}
      onClick={item.done ? undefined : item.action}
    >
      {/* Tick / circle */}
      <div className="flex-shrink-0 w-5">
        {item.done
          ? <CheckCircle2 className="w-5 h-5 text-green-500" />
          : <Circle       className="w-5 h-5 text-muted-foreground/40" />}
      </div>

      {/* Icon badge */}
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>

      {/* Label */}
      <p className={`flex-1 text-sm font-medium truncate ${
        item.done ? 'line-through text-muted-foreground' : 'text-foreground'
      }`}>
        {item.label}
      </p>

      {/* Arrow */}
      {!item.done && <ArrowRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />}
    </div>
  );
}
