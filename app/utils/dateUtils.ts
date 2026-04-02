import { TimelineConfig } from '../types';

export function convertClickUpDate(timestamp: string | number | null | undefined): Date | null {
  if (timestamp === null || timestamp === undefined) return null;
  const ms = typeof timestamp === 'string' ? Number(timestamp) : timestamp;
  if (isNaN(ms) || ms === 0) return null;
  return new Date(ms);
}

export function getTimelineRange(tasks: { startDate: Date | null; endDate: Date | null }[]): { start: Date; end: Date } {
  const now = new Date();
  let minDate = new Date(now);
  let maxDate = new Date(now);
  let hasAny = false;

  for (const task of tasks) {
    if (task.startDate) {
      if (!hasAny || task.startDate < minDate) minDate = new Date(task.startDate);
      if (!hasAny || task.startDate > maxDate) maxDate = new Date(task.startDate);
      hasAny = true;
    }
    if (task.endDate) {
      if (!hasAny || task.endDate < minDate) minDate = new Date(task.endDate);
      if (task.endDate > maxDate) maxDate = new Date(task.endDate);
      hasAny = true;
    }
  }

  const start = new Date(minDate);
  start.setDate(start.getDate() - 7);
  const end = new Date(maxDate);
  end.setDate(end.getDate() + 7);

  return { start, end };
}

export function dateToPx(date: Date, timelineStart: Date, pxPerDay: number): number {
  const diffMs = date.getTime() - timelineStart.getTime();
  return (diffMs / (1000 * 60 * 60 * 24)) * pxPerDay;
}

export function durationToPx(start: Date, end: Date, pxPerDay: number): number {
  const diffMs = end.getTime() - start.getTime();
  return Math.max((diffMs / (1000 * 60 * 60 * 24)) * pxPerDay, pxPerDay);
}

export function formatShortDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}, ${String(date.getFullYear()).slice(2)}`;
}

export function getDayOfWeekLetter(date: Date): string {
  return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][date.getDay()];
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isWeekend(date: Date): boolean {
  return date.getDay() === 0 || date.getDay() === 6;
}

export function getTimelineConfig(tasks: { startDate: Date | null; endDate: Date | null }[], pxPerDay: number = 24): TimelineConfig {
  const { start, end } = getTimelineRange(tasks);
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return { startDate: start, endDate: end, pxPerDay, totalDays, totalWidth: totalDays * pxPerDay };
}
