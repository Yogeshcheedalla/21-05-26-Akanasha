'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Bell, CalendarDays, Check, CheckSquare, Clock3, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

interface TaskItem {
  id: string;
  title: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;
  createdAt: string;
  reminderEnabled?: boolean;
  reminderAt?: string;
  notified?: boolean;
}

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  type: 'meeting' | 'reminder' | 'focus';
  reminderEnabled: boolean;
  reminderAt?: string;
  notified?: boolean;
}

const TASKS_STORAGE_KEY = 'akansha-planner-tasks';
const EVENTS_STORAGE_KEY = 'akansha-planner-events';

const DEFAULT_TASKS: TaskItem[] = [
  {
    id: 'task-001',
    title: 'Review pull request for auth module',
    completed: false,
    priority: 'high',
    dueDate: '2026-04-25',
    createdAt: new Date().toISOString(),
    reminderEnabled: true,
    reminderAt: new Date('2026-04-25T08:30:00').toISOString(),
  },
  {
    id: 'task-002',
    title: 'Prepare internship follow-up mail',
    completed: false,
    priority: 'medium',
    dueDate: '2026-04-26',
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_EVENTS: CalendarEvent[] = [
  {
    id: 'event-001',
    title: 'AI internship mock interview',
    date: '2026-04-25',
    startTime: '18:00',
    endTime: '19:00',
    type: 'meeting',
    reminderEnabled: true,
    reminderAt: new Date('2026-04-25T17:45:00').toISOString(),
  },
  {
    id: 'event-002',
    title: 'Deep work block',
    date: '2026-04-26',
    startTime: '09:00',
    endTime: '11:00',
    type: 'focus',
    reminderEnabled: false,
  },
];

const PRIORITY_STYLES = {
  high: 'border-rose-500/25 bg-rose-500/10 text-rose-200',
  medium: 'border-amber-500/25 bg-amber-500/10 text-amber-200',
  low: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200',
};

const EVENT_STYLES = {
  meeting: 'border-[#6C47FF]/25 bg-[#6C47FF]/10 text-[#c7b8ff]',
  reminder: 'border-sky-500/25 bg-sky-500/10 text-sky-200',
  focus: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200',
};

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function formatTime12h(time24: string) {
  const [h, m] = time24.split(':');
  const hours = parseInt(h);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function formatEventWindow(event: CalendarEvent) {
  return `${formatTime12h(event.startTime)} - ${formatTime12h(event.endTime)}`;
}

const TIME_OPTIONS = Array.from({ length: 24 * 12 }, (_, i) => {
  const h = Math.floor(i / 12);
  const m = (i % 12) * 5;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  const value = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  const label = `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  return { value, label };
});

function getEventStartDate(event: CalendarEvent) {
  return new Date(`${event.date}T${event.startTime}:00`);
}

export default function TaskCalendarPanel() {
  const [activeTab, setActiveTab] = useState<'tasks' | 'calendar'>('tasks');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskItem['priority']>('medium');
  const [taskDate, setTaskDate] = useState('');
  const [taskReminder, setTaskReminder] = useState(false);
  const [taskReminderTime, setTaskReminderTime] = useState('09:00');
  const [eventTitle, setEventTitle] = useState('');
  const [eventType, setEventType] = useState<CalendarEvent['type']>('meeting');
  const [eventDate, setEventDate] = useState('');
  const [eventStartTime, setEventStartTime] = useState('09:00');
  const [eventEndTime, setEventEndTime] = useState('10:00');
  const [eventReminder, setEventReminder] = useState(true);
  const [eventReminderTime, setEventReminderTime] = useState('08:45');

  useEffect(() => {
    setTasks(readStorage(TASKS_STORAGE_KEY, DEFAULT_TASKS));
    setEvents(readStorage(EVENTS_STORAGE_KEY, DEFAULT_EVENTS));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return;

    const maybeNotify = () => {
      const now = Date.now();
      setEvents((previous) =>
        previous.map((event) => {
          if (!event.reminderEnabled || event.notified) return event;

          const reminderTime = new Date(event.reminderAt ?? getEventStartDate(event)).getTime();
          const diff = reminderTime - now;
          if (diff <= 15 * 60 * 1000 && diff > 0 && Notification.permission === 'granted') {
            new Notification(`Upcoming: ${event.title}`, {
              body: `${event.date} · ${formatEventWindow(event)}`,
            });
            return { ...event, notified: true };
          }
          return event;
        })
      );

      setTasks((previous) =>
        previous.map((task) => {
          if (!task.reminderEnabled || task.notified || !task.dueDate) return task;

          const due = new Date(task.reminderAt ?? `${task.dueDate}T09:00:00`).getTime();
          const diff = due - now;
          if (diff <= 60 * 60 * 1000 && diff > 0 && Notification.permission === 'granted') {
            new Notification(`Task due soon: ${task.title}`, {
              body: `Due on ${task.dueDate}`,
            });
            return { ...task, notified: true };
          }
          return task;
        })
      );
    };

    const interval = window.setInterval(maybeNotify, 30000);
    return () => window.clearInterval(interval);
  }, []);

  const requestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') {
      toast.error('Notifications are not supported in this browser.');
      return false;
    }

    if (Notification.permission === 'granted') return true;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      toast.error('Notification permission was not granted.');
      return false;
    }
    toast.success('Notifications enabled for planner reminders');
    return true;
  };

  const addTask = async () => {
    if (!taskTitle.trim()) return;

    const nextTask: TaskItem = {
      id: `task-${Date.now()}`,
      title: taskTitle.trim(),
      completed: false,
      priority: taskPriority,
      dueDate: taskDate || undefined,
      createdAt: new Date().toISOString(),
      reminderEnabled: taskReminder && (typeof Notification !== 'undefined' && Notification.permission === 'granted'),
      reminderAt:
        taskReminder && taskDate
          ? new Date(`${taskDate}T${taskReminderTime}:00`).toISOString()
          : undefined,
      notified: false,
    };

    setTasks((previous) => [nextTask, ...previous]);
    setTaskTitle('');
    setTaskPriority('medium');
    setTaskDate('');
    setTaskReminder(false);
    setTaskReminderTime('09:00');
    setShowTaskForm(false);
    toast.success('Task added to your planner');
  };

  const addEvent = async () => {
    if (!eventTitle.trim()) return;
    if (!eventDate || !eventStartTime || !eventEndTime) {
      toast.error('Calendar events need a date, start time, and end time.');
      return;
    }

    if (eventEndTime <= eventStartTime) {
      toast.error('End time must be later than start time.');
      return;
    }

    const nextEvent: CalendarEvent = {
      id: `event-${Date.now()}`,
      title: eventTitle.trim(),
      date: eventDate,
      startTime: eventStartTime,
      endTime: eventEndTime,
      type: eventType,
      reminderEnabled: eventReminder && (typeof Notification !== 'undefined' && Notification.permission === 'granted'),
      reminderAt:
        eventReminder && eventDate
          ? new Date(`${eventDate}T${eventReminderTime}:00`).toISOString()
          : undefined,
      notified: false,
    };

    setEvents((previous) =>
      [...previous, nextEvent].sort(
        (a, b) => getEventStartDate(a).getTime() - getEventStartDate(b).getTime()
      )
    );
    setEventTitle('');
    setEventDate('');
    setEventStartTime('09:00');
    setEventEndTime('10:00');
    setEventType('meeting');
    setEventReminder(true);
    setEventReminderTime('08:45');
    setShowEventForm(false);
    toast.success('Calendar event scheduled');
  };

  const pendingTasks = useMemo(() => tasks.filter((task) => !task.completed).length, [tasks]);
  const doneTasks = useMemo(() => tasks.filter((task) => task.completed).length, [tasks]);
  const upcomingEvents = useMemo(
    () => events.sort((a, b) => getEventStartDate(a).getTime() - getEventStartDate(b).getTime()),
    [events]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-2 border-b border-border/80 bg-card/40">
        {[
          { key: 'tasks', label: 'To-Do', icon: CheckSquare, badge: pendingTasks },
          { key: 'calendar', label: 'Calendar', icon: CalendarDays, badge: upcomingEvents.length },
        ].map(({ key, label, icon: Icon, badge }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as 'tasks' | 'calendar')}
            className={`flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium transition-colors ${
              activeTab === key
                ? 'border-b-2 border-[#6C47FF] text-[#9B7FFF]'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon size={14} />
            {label}
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-mono tabular-nums text-muted-foreground">
              {badge}
            </span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[#6C47FF]/20 bg-gradient-to-br from-[#6C47FF]/12 to-transparent p-4">
                <p className="text-2xl font-semibold text-[#c7b8ff]">{pendingTasks}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Pending
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/12 to-transparent p-4">
                <p className="text-2xl font-semibold text-emerald-200">{doneTasks}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Completed
                </p>
              </div>
            </div>

            {showTaskForm ? (
              <div className="rounded-3xl border border-[#6C47FF]/25 bg-[#6C47FF]/8 p-4">
                <div className="space-y-3">
                  <input
                    value={taskTitle}
                    onChange={(event) => setTaskTitle(event.target.value)}
                    placeholder="What do you need to get done?"
                    className="w-full rounded-2xl border border-white/10 bg-card px-4 py-3 text-sm text-foreground outline-none focus:border-[#6C47FF]/40"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={taskPriority}
                      onChange={(event) =>
                        setTaskPriority(event.target.value as TaskItem['priority'])
                      }
                      className="rounded-2xl border border-white/10 bg-card px-3 py-3 text-sm text-foreground outline-none"
                    >
                      <option value="high">High priority</option>
                      <option value="medium">Medium priority</option>
                      <option value="low">Low priority</option>
                    </select>
                    <input
                      type="date"
                      value={taskDate}
                      onChange={(event) => setTaskDate(event.target.value)}
                      className="rounded-2xl border border-white/10 bg-card px-3 py-3 text-sm text-foreground outline-none"
                    />
                  </div>

                  <div 
                    onClick={async () => {
                      if (!taskReminder) {
                        const allowed = await requestNotificationPermission();
                        if (allowed) setTaskReminder(true);
                      } else {
                        setTaskReminder(false);
                      }
                    }}
                    className="flex cursor-pointer items-center justify-between rounded-2xl border border-white/10 bg-card px-3 py-3 text-sm text-foreground hover:bg-white/[0.02] transition-colors"
                  >
                    Reminder notification
                      <div
                        className={`relative h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                          taskReminder ? 'bg-emerald-500' : 'bg-muted'
                        }`}
                      >
                        <span
                          className={`pointer-events-none absolute left-1 top-1 h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            taskReminder ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </div>
                  </div>

                  {taskReminder && taskDate && (
                    <label className="block">
                      <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Custom reminder time
                      </span>
                      <select
                        value={taskReminderTime}
                        onChange={(event) => setTaskReminderTime(event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-card px-3 py-3 text-sm text-foreground outline-none"
                      >
                        {TIME_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={addTask}
                      className="inline-flex items-center gap-2 rounded-2xl bg-[#6C47FF] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#5A35EE]"
                    >
                      <Plus size={14} />
                      Save task
                    </button>
                    <button
                      onClick={() => setShowTaskForm(false)}
                      className="rounded-2xl border border-white/10 px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowTaskForm(true)}
                className="flex w-full items-center justify-center gap-2 rounded-3xl border border-dashed border-[#6C47FF]/30 bg-[#6C47FF]/6 px-4 py-3 text-sm font-medium text-[#b9a8ff] transition-colors hover:border-[#6C47FF]/50 hover:bg-[#6C47FF]/10"
              >
                <Plus size={14} />
                Add to-do
              </button>
            )}

            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`group rounded-3xl border p-4 transition-colors ${
                    task.completed
                      ? 'border-white/5 bg-card/40 opacity-70'
                      : 'border-border/70 bg-card/70 hover:border-[#6C47FF]/25'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() =>
                        setTasks((previous) =>
                          previous.map((item) =>
                            item.id === task.id ? { ...item, completed: !item.completed } : item
                          )
                        )
                      }
                      className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                        task.completed
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-border hover:border-[#6C47FF]'
                      }`}
                    >
                      {task.completed && <Check size={11} />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-medium leading-6 ${
                          task.completed ? 'text-muted-foreground line-through' : 'text-foreground'
                        }`}
                      >
                        {task.title}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${
                            PRIORITY_STYLES[task.priority]
                          }`}
                        >
                          {task.priority}
                        </span>
                        {task.dueDate && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                            <Clock3 size={11} />
                            {task.dueDate}
                          </span>
                        )}
                        {task.reminderEnabled && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-200">
                            <Bell size={11} />
                            {task.reminderAt
                              ? `Notify ${new Date(task.reminderAt).toLocaleTimeString([], {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}`
                              : 'Notify'}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setTasks((previous) => previous.filter((item) => item.id !== task.id));
                        toast.success('Task removed');
                      }}
                      className="opacity-0 transition-opacity group-hover:opacity-100 rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="space-y-4">
            <div className="rounded-3xl border border-sky-500/20 bg-gradient-to-br from-sky-500/10 via-[#6C47FF]/8 to-transparent p-4">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-sky-300" />
                <p className="text-sm font-medium text-foreground">Today's time windows</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Calendar events now use a proper <span className="text-foreground">start time</span>{' '}
                and <span className="text-foreground">end time</span>. Notifications trigger before
                the start time without changing your to-do section.
              </p>
            </div>

            {showEventForm ? (
              <div className="rounded-3xl border border-sky-500/20 bg-sky-500/8 p-4">
                <div className="space-y-3">
                  <input
                    value={eventTitle}
                    onChange={(event) => setEventTitle(event.target.value)}
                    placeholder="Calendar event title"
                    className="w-full rounded-2xl border border-white/10 bg-card px-4 py-3 text-sm text-foreground outline-none focus:border-sky-500/40"
                  />

                  <div className="grid grid-cols-3 gap-3">
                    <input
                      type="date"
                      value={eventDate}
                      onChange={(event) => setEventDate(event.target.value)}
                      className="rounded-2xl border border-white/10 bg-card px-3 py-3 text-sm text-foreground outline-none"
                    />
                    <select
                      value={eventStartTime}
                      onChange={(event) => setEventStartTime(event.target.value)}
                      className="rounded-2xl border border-white/10 bg-card px-3 py-3 text-sm text-foreground outline-none"
                    >
                      {TIME_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={eventEndTime}
                      onChange={(event) => setEventEndTime(event.target.value)}
                      className="rounded-2xl border border-white/10 bg-card px-3 py-3 text-sm text-foreground outline-none"
                    >
                      {TIME_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={eventType}
                      onChange={(event) =>
                        setEventType(event.target.value as CalendarEvent['type'])
                      }
                      className="rounded-2xl border border-white/10 bg-card px-3 py-3 text-sm text-foreground outline-none"
                    >
                      <option value="meeting">Meeting</option>
                      <option value="reminder">Reminder</option>
                      <option value="focus">Focus block</option>
                    </select>

                    <div 
                      onClick={async () => {
                        if (!eventReminder) {
                          const allowed = await requestNotificationPermission();
                          if (allowed) setEventReminder(true);
                        } else {
                          setEventReminder(false);
                        }
                      }}
                      className="flex cursor-pointer items-center justify-between rounded-2xl border border-white/10 bg-card px-3 py-3 text-sm text-foreground hover:bg-white/[0.02] transition-colors"
                    >
                      Notify me
                      <div
                        className={`relative h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                          eventReminder ? 'bg-emerald-500' : 'bg-muted'
                        }`}
                      >
                        <span
                          className={`pointer-events-none absolute left-1 top-1 h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            eventReminder ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  {eventReminder && (
                    <label className="block">
                      <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Custom reminder time
                      </span>
                      <select
                        value={eventReminderTime}
                        onChange={(event) => setEventReminderTime(event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-card px-3 py-3 text-sm text-foreground outline-none"
                      >
                        {TIME_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={addEvent}
                      className="inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition-colors hover:bg-sky-400"
                    >
                      <Plus size={14} />
                      Save event
                    </button>
                    <button
                      onClick={() => setShowEventForm(false)}
                      className="rounded-2xl border border-white/10 px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted"
                    >
                      <X size={14} className="inline" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowEventForm(true)}
                className="flex w-full items-center justify-center gap-2 rounded-3xl border border-dashed border-sky-500/30 bg-sky-500/6 px-4 py-3 text-sm font-medium text-sky-200 transition-colors hover:border-sky-500/50 hover:bg-sky-500/10"
              >
                <Plus size={14} />
                Add calendar slot
              </button>
            )}

            <div className="space-y-2">
              {upcomingEvents.map((event) => (
                <div
                  key={event.id}
                  className="group rounded-3xl border border-border/70 bg-card/70 p-4 transition-colors hover:border-sky-500/25"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`rounded-2xl border px-3 py-2 text-[11px] font-medium uppercase tracking-[0.2em] ${
                        EVENT_STYLES[event.type]
                      }`}
                    >
                      {event.type}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{event.title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                          <CalendarDays size={11} />
                          {event.date}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-2.5 py-1 text-[11px] text-slate-200">
                          <Clock3 size={11} />
                          {formatEventWindow(event)}
                        </span>
                        {event.reminderEnabled && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-200">
                            <Bell size={11} />
                            {event.reminderAt
                              ? `Notify ${new Date(event.reminderAt).toLocaleTimeString([], {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}`
                              : 'Notification'}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setEvents((previous) => previous.filter((item) => item.id !== event.id));
                        toast.success('Calendar event removed');
                      }}
                      className="opacity-0 transition-opacity group-hover:opacity-100 rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
