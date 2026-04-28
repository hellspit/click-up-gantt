'use client';

import { useEffect, useMemo } from 'react';
import { NormalizedTask } from '../types';
import { useTaskStore } from '../store/useTaskStore';

function formatDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** Find gaps (free days) between tasks based on their date ranges */
function findFreeGaps(tasks: NormalizedTask[]): { from: Date; to: Date; days: number }[] {
  // Only tasks with both dates
  const dated = tasks
    .filter(t => t.startDate && t.endDate)
    .sort((a, b) => a.startDate!.getTime() - b.startDate!.getTime());

  if (dated.length < 2) return [];

  // Merge overlapping intervals first
  const intervals: { start: number; end: number }[] = [];
  for (const t of dated) {
    const s = t.startDate!.getTime();
    const e = t.endDate!.getTime();
    if (intervals.length === 0 || s > intervals[intervals.length - 1].end) {
      intervals.push({ start: s, end: e });
    } else {
      intervals[intervals.length - 1].end = Math.max(intervals[intervals.length - 1].end, e);
    }
  }

  const gaps: { from: Date; to: Date; days: number }[] = [];
  for (let i = 0; i < intervals.length - 1; i++) {
    const gapStart = new Date(intervals[i].end);
    gapStart.setDate(gapStart.getDate() + 1);
    const gapEnd = new Date(intervals[i + 1].start);
    gapEnd.setDate(gapEnd.getDate() - 1);
    const gapDays = daysBetween(gapStart, gapEnd) + 1;
    if (gapDays > 0) {
      gaps.push({ from: gapStart, to: gapEnd, days: gapDays });
    }
  }

  return gaps;
}

interface BandwidthInfo {
  userName: string;
  lastCompletedTask: NormalizedTask | null;
  inProgressTasks: NormalizedTask[];
  todoTasksAfterProgress: NormalizedTask[];
  freeGaps: { from: Date; to: Date; days: number }[];
  completelyFreeFrom: Date | null;
  isFreeNow: boolean;
  totalActiveTasks: number;
}

function computeBandwidthInfo(tasks: NormalizedTask[], noDateTasks: NormalizedTask[], userName: string): BandwidthInfo {
  const allTasks = [...tasks, ...noDateTasks];

  // Last completed task (by dateCompleted)
  const completedTasks = allTasks
    .filter(t => {
      const s = t.status.toLowerCase();
      return s.includes('complete') || s.includes('done') || s.includes('resolved');
    })
    .sort((a, b) => {
      const da = a.dateCompleted || a.endDate;
      const db = b.dateCompleted || b.endDate;
      if (!da) return 1;
      if (!db) return -1;
      return db.getTime() - da.getTime();
    });
  const lastCompletedTask = completedTasks.length > 0 ? completedTasks[0] : null;

  // In-progress tasks
  const inProgressTasks = allTasks.filter(t => {
    const s = t.status.toLowerCase();
    return s.includes('progress') || s.includes('active');
  });

  // Active (non-completed/closed) tasks
  const activeTasks = allTasks.filter(t => {
    const s = t.status.toLowerCase();
    return !(s.includes('complete') || s.includes('done') || s.includes('resolved') || s.includes('closed') || s.includes('archived'));
  });

  // To-do tasks that come AFTER in-progress tasks (by start date)
  const latestInProgressEnd = inProgressTasks.reduce((max, t) => {
    if (t.endDate && (!max || t.endDate > max)) return t.endDate;
    return max;
  }, null as Date | null);

  const todoTasks = activeTasks.filter(t => {
    const s = t.status.toLowerCase();
    return (s.includes('todo') || s.includes('to do') || s.includes('open')) &&
      (!latestInProgressEnd || (t.startDate && t.startDate >= latestInProgressEnd));
  });

  // Free gaps between work (only future gaps)
  const datedTasks = allTasks.filter(t => t.startDate && t.endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const freeGaps = findFreeGaps(datedTasks).filter(gap => gap.to >= today);

  // Completely free from date
  let latestEndDate: Date | null = null;
  for (const t of activeTasks) {
    if (t.endDate && (!latestEndDate || t.endDate > latestEndDate)) {
      latestEndDate = t.endDate;
    }
  }

  let completelyFreeFrom: Date | null = null;
  const isFreeNow = !latestEndDate;
  if (latestEndDate) {
    const nextDay = new Date(latestEndDate);
    nextDay.setDate(nextDay.getDate() + 1);
    completelyFreeFrom = nextDay;
  }

  return {
    userName,
    lastCompletedTask,
    inProgressTasks,
    todoTasksAfterProgress: todoTasks,
    freeGaps,
    completelyFreeFrom,
    isFreeNow,
    totalActiveTasks: activeTasks.length,
  };
}

interface Props {
  onClose: () => void;
}

export default function BandwidthPanel({ onClose }: Props) {
  const tasks = useTaskStore(s => s.tasks);
  const noDateTasks = useTaskStore(s => s.noDateTasks);
  const selectedUserName = useTaskStore(s => s.selectedUserName);
  const openTaskDetail = useTaskStore(s => s.openTaskDetail);

  const info = useMemo(
    () => computeBandwidthInfo(tasks, noDateTasks, selectedUserName || 'Unknown'),
    [tasks, noDateTasks, selectedUserName]
  );

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleTaskClick = (task: NormalizedTask) => {
    onClose();
    setTimeout(() => openTaskDetail(task), 150);
  };

  return (
    <>
      <div className="detail-backdrop" onClick={onClose} />
      <div className="bandwidth-panel">
        {/* Header */}
        <div className="bandwidth-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #5A43D6, #7c3aed)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
            }}>
              {info.userName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {info.userName}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                Bandwidth Overview
              </div>
            </div>
          </div>
          <button className="detail-close" onClick={onClose} title="Close (Esc)">✕</button>
        </div>

        {/* Free Status Banner */}
        <div style={{
          margin: '16px 20px 0',
          padding: '14px 16px',
          borderRadius: '12px',
          background: info.isFreeNow
            ? 'linear-gradient(135deg, rgba(63, 185, 80, 0.1), rgba(63, 185, 80, 0.05))'
            : 'linear-gradient(135deg, rgba(90, 67, 214, 0.1), rgba(90, 67, 214, 0.05))',
          border: info.isFreeNow
            ? '1px solid rgba(63, 185, 80, 0.2)'
            : '1px solid rgba(90, 67, 214, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: info.isFreeNow ? '#3fb950' : '#5A43D6',
              boxShadow: info.isFreeNow ? '0 0 8px rgba(63,185,80,0.5)' : '0 0 8px rgba(90,67,214,0.5)',
              animation: 'pulse 2s infinite',
            }} />
            <span style={{
              fontSize: '13px',
              fontWeight: 700,
              color: info.isFreeNow ? '#3fb950' : '#5A43D6',
            }}>
              {info.isFreeNow ? 'Currently Free' : `${info.totalActiveTasks} Active Task${info.totalActiveTasks !== 1 ? 's' : ''}`}
            </span>
          </div>
          {!info.isFreeNow && info.completelyFreeFrom && (
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              Free from {formatDate(info.completelyFreeFrom)}
            </span>
          )}
        </div>

        {/* Completely Free From */}
        <div style={{ margin: '16px 20px 0' }}>
          <div className="bandwidth-panel-section">
            <div className="bandwidth-panel-section-header">
              <span>Completely Free From</span>
            </div>
            <div style={{
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{
                fontSize: '20px',
                fontWeight: 700,
                color: info.isFreeNow ? '#3fb950' : 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
              }}>
                {info.isFreeNow ? 'Now' : info.completelyFreeFrom ? formatDate(info.completelyFreeFrom) : '—'}
              </span>
              {!info.isFreeNow && info.completelyFreeFrom && (
                <span style={{
                  fontSize: '11px',
                  color: 'var(--text-tertiary)',
                  background: 'var(--bg-tertiary)',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontWeight: 600,
                }}>
                  {daysBetween(new Date(), info.completelyFreeFrom)} days away
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Last Completed Task */}
        <div style={{ margin: '12px 20px 0' }}>
          <div className="bandwidth-panel-section">
            <div className="bandwidth-panel-section-header">
              <span>Last Completed Task</span>
            </div>
            {info.lastCompletedTask ? (
              <div
                className="bandwidth-panel-task-row bandwidth-panel-task-clickable"
                onClick={() => handleTaskClick(info.lastCompletedTask!)}
              >
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#3fb950',
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {info.lastCompletedTask.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '3px' }}>
                    Completed {formatDate(info.lastCompletedTask.dateCompleted || info.lastCompletedTask.endDate)}
                  </div>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>→</span>
              </div>
            ) : (
              <div style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No completed tasks
              </div>
            )}
          </div>
        </div>

        {/* Current In-Progress Tasks */}
        <div style={{ margin: '12px 20px 0' }}>
          <div className="bandwidth-panel-section">
            <div className="bandwidth-panel-section-header">
              <span>In Progress</span>
              <span style={{
                marginLeft: 'auto',
                fontSize: '10px',
                fontWeight: 700,
                background: info.inProgressTasks.length > 0 ? 'rgba(90, 67, 214, 0.15)' : 'var(--bg-tertiary)',
                color: info.inProgressTasks.length > 0 ? '#5A43D6' : 'var(--text-muted)',
                padding: '2px 8px',
                borderRadius: '10px',
              }}>
                {info.inProgressTasks.length}
              </span>
            </div>
            {info.inProgressTasks.length > 0 ? (
              info.inProgressTasks.map(t => (
                <div
                  key={t.id}
                  className="bandwidth-panel-task-row bandwidth-panel-task-clickable"
                  onClick={() => handleTaskClick(t)}
                >
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#5A43D6',
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '3px' }}>
                      {t.startDate && t.endDate
                        ? `${formatDate(t.startDate)} → ${formatDate(t.endDate)}`
                        : t.endDate
                          ? `Due ${formatDate(t.endDate)}`
                          : 'No dates'}
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>→</span>
                </div>
              ))
            ) : (
              <div style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No tasks in progress
              </div>
            )}
          </div>
        </div>

        {/* To-Do Tasks After In-Progress */}
        <div style={{ margin: '12px 20px 0' }}>
          <div className="bandwidth-panel-section">
            <div className="bandwidth-panel-section-header">
              <span>Upcoming To-Do</span>
              <span style={{
                marginLeft: 'auto',
                fontSize: '10px',
                fontWeight: 700,
                background: info.todoTasksAfterProgress.length > 0 ? 'rgba(88, 166, 255, 0.15)' : 'var(--bg-tertiary)',
                color: info.todoTasksAfterProgress.length > 0 ? '#58a6ff' : 'var(--text-muted)',
                padding: '2px 8px',
                borderRadius: '10px',
              }}>
                {info.todoTasksAfterProgress.length}
              </span>
            </div>
            {info.todoTasksAfterProgress.length > 0 ? (
              info.todoTasksAfterProgress.slice(0, 5).map(t => (
                <div
                  key={t.id}
                  className="bandwidth-panel-task-row bandwidth-panel-task-clickable"
                  onClick={() => handleTaskClick(t)}
                >
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#58a6ff',
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '3px' }}>
                      {t.startDate ? `Starts ${formatDate(t.startDate)}` : 'No start date'}
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>→</span>
                </div>
              ))
            ) : (
              <div style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No upcoming to-do tasks
              </div>
            )}
            {info.todoTasksAfterProgress.length > 5 && (
              <div style={{ padding: '8px 16px', fontSize: '11px', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                +{info.todoTasksAfterProgress.length - 5} more
              </div>
            )}
          </div>
        </div>

        {/* Free Days Between Work */}
        <div style={{ margin: '12px 20px 20px' }}>
          <div className="bandwidth-panel-section">
            <div className="bandwidth-panel-section-header">
              <span>Free Days Between Work</span>
            </div>
            {info.freeGaps.length > 0 ? (
              info.freeGaps.map((gap, i) => (
                <div key={i} style={{
                  padding: '10px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: i < info.freeGaps.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#3fb950',
                      flexShrink: 0,
                    }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {formatDate(gap.from)} — {formatDate(gap.to)}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#3fb950',
                    background: 'rgba(63, 185, 80, 0.1)',
                    padding: '2px 8px',
                    borderRadius: '8px',
                  }}>
                    {gap.days} day{gap.days !== 1 ? 's' : ''}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No free gaps between tasks
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
