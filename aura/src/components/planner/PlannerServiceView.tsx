'use client';

import React from 'react';
import { Bell, CalendarDays, CheckSquare } from 'lucide-react';
import TaskCalendarPanel from '@/app/chat-interface/components/TaskCalendarPanel';

export function PlannerServiceView() {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/85 shadow-[0_30px_90px_rgba(15,23,42,0.45)]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Scheduling service</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">To-do and calendar workspace</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Keep planning separate from live voice. Tasks stay simple, and calendar entries keep the
            exact start and end times so the schedule stays structured.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs text-sky-100">
            <Bell size={12} className="mr-1 inline" />
            Notifications
          </div>
          <div className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-xs text-slate-300">
            <CalendarDays size={12} className="mr-1 inline" />
            Calendar timing
          </div>
          <div className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-xs text-slate-300">
            <CheckSquare size={12} className="mr-1 inline" />
            To-do tracking
          </div>
        </div>
      </div>

      <div className="min-h-[720px] bg-slate-950/40">
        <TaskCalendarPanel />
      </div>
    </section>
  );
}
