import { TimelineConfig, GanttScale } from '../types';

export function convertClickUpDate(timestamp: string | number | null | undefined): Date | null {
  if (timestamp === null || timestamp === undefined) return null;
  const ms = typeof timestamp === 'string' ? Number(timestamp) : timestamp;
  if (isNaN(ms) || ms === 0) return null;
  return new Date(ms);
}

export function getTimelineRange(
  tasks: { startDate: Date | null; endDate: Date | null }[],
  scale: GanttScale = 'day'
): { start: Date; end: Date } {
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

  // Generous padding based on scale so dates render well beyond task boundaries
  // This lets users scroll freely and compare tasks across a wide timeframe
  const paddingDays = (() => {
    switch (scale) {
      case 'day':     return 60;    // ~2 months each side
      case 'week':    return 140;   // 20 weeks each side
      case 'month':   return 300;   // ~10 months each side
      case 'quarter': return 1460;  // ~4 years each side
    }
  })();

  const start = new Date(minDate);
  start.setDate(start.getDate() - paddingDays);
  const end = new Date(maxDate);
  end.setDate(end.getDate() + paddingDays);

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

// ── Scale helpers ──

export function getScalePxPerDay(scale: GanttScale): number {
  // ──────────────────────────────────────────────────────────
  // To change column widths later, just edit these numbers:
  //   day     = 24px per day  (default, 1 column = 1 day)
  //   week    = 12px per day  (1 week column ≈ 84px)
  //   month   = 6px per day   (1 month column ≈ 180px)
  //   quarter = 2.8px per day (1 quarter column ≈ 252px)
  // ──────────────────────────────────────────────────────────
  switch (scale) {
    case 'day': return 38;
    case 'week': return 12;
    case 'month': return 6;
    case 'quarter': return 2.8;
  }
}

export function getTimelineConfig(
  tasks: { startDate: Date | null; endDate: Date | null }[],
  scale: GanttScale = 'day'
): TimelineConfig {
  const pxPerDay = getScalePxPerDay(scale);
  const { start, end } = getTimelineRange(tasks, scale);
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return { startDate: start, endDate: end, pxPerDay, totalDays, totalWidth: totalDays * pxPerDay, scale };
}

// ── Time bucket generation for Gantt header ──

export interface TimeBucket {
  start: Date;
  end: Date;
  label: string;
  x: number;
  width: number;
  isToday: boolean;
}

export interface HeaderGroup {
  label: string;
  x: number;
  width: number;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function generateTimeBuckets(
  scale: GanttScale,
  startDate: Date,
  endDate: Date,
  pxPerDay: number
): { buckets: TimeBucket[]; groups: HeaderGroup[] } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (scale) {
    case 'day':
      return generateDayBuckets(startDate, endDate, pxPerDay, today);
    case 'week':
      return generateWeekBuckets(startDate, endDate, pxPerDay, today);
    case 'month':
      return generateMonthBuckets(startDate, endDate, pxPerDay, today);
    case 'quarter':
      return generateQuarterBuckets(startDate, endDate, pxPerDay, today);
  }
}

function generateDayBuckets(
  startDate: Date, endDate: Date, pxPerDay: number, today: Date
): { buckets: TimeBucket[]; groups: HeaderGroup[] } {
  const buckets: TimeBucket[] = [];
  const groups: HeaderGroup[] = [];

  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000);
  let currentMonth = -1;
  let monthStartX = 0;

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);

    const x = i * pxPerDay;
    const dEnd = new Date(d);
    dEnd.setDate(dEnd.getDate() + 1);

    buckets.push({
      start: d,
      end: dEnd,
      label: getDayOfWeekLetter(d),
      x,
      width: pxPerDay,
      isToday: isSameDay(d, today),
    });

    // Track month groups
    const m = d.getMonth();
    if (m !== currentMonth) {
      if (currentMonth !== -1) {
        groups.push({
          label: `${MONTH_NAMES[currentMonth]} ${buckets[buckets.length - 2]?.start.getFullYear() ?? d.getFullYear()}`,
          x: monthStartX,
          width: x - monthStartX,
        });
      }
      currentMonth = m;
      monthStartX = x;
    }
  }

  // Close last month group
  if (currentMonth !== -1) {
    const lastBucket = buckets[buckets.length - 1];
    groups.push({
      label: `${MONTH_NAMES[currentMonth]} ${lastBucket.start.getFullYear()}`,
      x: monthStartX,
      width: lastBucket.x + lastBucket.width - monthStartX,
    });
  }

  return { buckets, groups };
}

function generateWeekBuckets(
  startDate: Date, endDate: Date, pxPerDay: number, today: Date
): { buckets: TimeBucket[]; groups: HeaderGroup[] } {
  const buckets: TimeBucket[] = [];
  const groups: HeaderGroup[] = [];

  // Snap to Monday of start week
  let current = getStartOfWeek(startDate);
  let currentMonth = -1;
  let monthStartX = 0;

  while (current < endDate) {
    const weekEnd = new Date(current);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const x = dateToPx(current, startDate, pxPerDay);
    const w = 7 * pxPerDay;
    const weekNum = getISOWeekNumber(current);
    const containsToday = today >= current && today < weekEnd;

    buckets.push({
      start: new Date(current),
      end: weekEnd,
      label: `W${weekNum}`,
      x,
      width: w,
      isToday: containsToday,
    });

    // Track month groups
    const m = current.getMonth();
    if (m !== currentMonth) {
      if (currentMonth !== -1) {
        groups.push({
          label: `${MONTH_NAMES[currentMonth]} ${current.getFullYear()}`,
          x: monthStartX,
          width: x - monthStartX,
        });
      }
      currentMonth = m;
      monthStartX = x;
    }

    current = weekEnd;
  }

  // Close last group
  if (currentMonth !== -1 && buckets.length > 0) {
    const lastBucket = buckets[buckets.length - 1];
    groups.push({
      label: `${MONTH_NAMES[currentMonth]} ${lastBucket.start.getFullYear()}`,
      x: monthStartX,
      width: lastBucket.x + lastBucket.width - monthStartX,
    });
  }

  return { buckets, groups };
}

function generateMonthBuckets(
  startDate: Date, endDate: Date, pxPerDay: number, today: Date
): { buckets: TimeBucket[]; groups: HeaderGroup[] } {
  const buckets: TimeBucket[] = [];
  const groups: HeaderGroup[] = [];

  // Start at the 1st of the start month
  let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  let currentYear = -1;
  let yearStartX = 0;

  while (current < endDate) {
    const nextMonth = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    const daysInMonth = Math.round((nextMonth.getTime() - current.getTime()) / 86400000);

    const x = dateToPx(current, startDate, pxPerDay);
    const w = daysInMonth * pxPerDay;
    const containsToday = today.getFullYear() === current.getFullYear() && today.getMonth() === current.getMonth();

    buckets.push({
      start: new Date(current),
      end: nextMonth,
      label: MONTH_NAMES[current.getMonth()],
      x,
      width: w,
      isToday: containsToday,
    });

    // Track year groups
    const y = current.getFullYear();
    if (y !== currentYear) {
      if (currentYear !== -1) {
        groups.push({
          label: String(currentYear),
          x: yearStartX,
          width: x - yearStartX,
        });
      }
      currentYear = y;
      yearStartX = x;
    }

    current = nextMonth;
  }

  // Close last year group
  if (currentYear !== -1 && buckets.length > 0) {
    const lastBucket = buckets[buckets.length - 1];
    groups.push({
      label: String(currentYear),
      x: yearStartX,
      width: lastBucket.x + lastBucket.width - yearStartX,
    });
  }

  return { buckets, groups };
}

function generateQuarterBuckets(
  startDate: Date, endDate: Date, pxPerDay: number, today: Date
): { buckets: TimeBucket[]; groups: HeaderGroup[] } {
  const buckets: TimeBucket[] = [];
  const groups: HeaderGroup[] = [];

  // Snap to start of quarter
  const startQuarter = Math.floor(startDate.getMonth() / 3);
  let current = new Date(startDate.getFullYear(), startQuarter * 3, 1);
  let currentYear = -1;
  let yearStartX = 0;

  while (current < endDate) {
    const q = Math.floor(current.getMonth() / 3) + 1;
    const nextQuarter = new Date(current.getFullYear(), current.getMonth() + 3, 1);
    const daysInQuarter = Math.round((nextQuarter.getTime() - current.getTime()) / 86400000);

    const x = dateToPx(current, startDate, pxPerDay);
    const w = daysInQuarter * pxPerDay;
    const containsToday = today >= current && today < nextQuarter;

    buckets.push({
      start: new Date(current),
      end: nextQuarter,
      label: `Q${q}`,
      x,
      width: w,
      isToday: containsToday,
    });

    // Track year groups
    const y = current.getFullYear();
    if (y !== currentYear) {
      if (currentYear !== -1) {
        groups.push({
          label: String(currentYear),
          x: yearStartX,
          width: x - yearStartX,
        });
      }
      currentYear = y;
      yearStartX = x;
    }

    current = nextQuarter;
  }

  // Close last year group
  if (currentYear !== -1 && buckets.length > 0) {
    const lastBucket = buckets[buckets.length - 1];
    groups.push({
      label: String(currentYear),
      x: yearStartX,
      width: lastBucket.x + lastBucket.width - yearStartX,
    });
  }

  return { buckets, groups };
}

