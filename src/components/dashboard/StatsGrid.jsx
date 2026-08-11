import React from 'react';
import { BookOpen, Clock, Trophy, Flame } from 'lucide-react';

const stats = [
  { label: 'Enrolled Subjects', icon: BookOpen, key: 'enrolled', color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
  { label: 'Learning Hours', icon: Clock, key: 'hours', color: 'text-chart-2', bg: 'bg-chart-2/10', border: 'border-chart-2/20' },
  { label: 'Completed', icon: Trophy, key: 'completed', color: 'text-chart-3', bg: 'bg-chart-3/10', border: 'border-chart-3/20' },
  { label: 'Study Streak', icon: Flame, key: 'streak', color: 'text-chart-4', bg: 'bg-chart-4/10', border: 'border-chart-4/20' },
];

export default function StatsGrid({ data }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
      {stats.map((stat) => (
        <div key={stat.key} className={`bg-card rounded-2xl p-5 border ${stat.border}`}>
          <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
            <stat.icon className={`w-5 h-5 ${stat.color}`} />
          </div>
          <p className="text-3xl font-bold font-heading">{data?.[stat.key] || 0}</p>
          <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
