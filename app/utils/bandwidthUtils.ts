import { NormalizedTask } from '../types';

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Find gaps (free days) between tasks based on their date ranges */
function findFreeGaps(tasks: NormalizedTask[]): { from: Date; to: Date; days: number }[] {
  const dated = tasks
    .filter(t => t.startDate && t.endDate)
    .sort((a, b) => a.startDate!.getTime() - b.startDate!.getTime());

  if (dated.length < 2) return [];

  // Merge overlapping intervals
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

export interface BandwidthSummary {
  /** Whether the assignee has any active (non-completed) work within the next 14 days */
  hasWorkInNext14Days: boolean;
  /** Number of free days (gaps between tasks) within the next 14 days */
  freeDaysCount: number;
  /** Number of free days until the assignee is completely free */
  freeDaysUntilCompletelyFree: number;
  /** The specific free date ranges within the next 14 days */
  freeGaps: { from: Date; to: Date; days: number; label: string }[];
  /** Date from which the assignee is completely free (no more tasks) */
  completelyFreeFrom: Date | null;
  /** Whether the assignee is completely free right now */
  isFreeNow: boolean;
  /** Formatted "free from" string */
  freeFromLabel: string;
}

export function isActiveBandwidthTask(t: NormalizedTask): boolean {
  const s = t.status.toLowerCase();
  return !(
    s.includes('complete') || s.includes('done') ||
    s.includes('resolved') || s.includes('closed') || s.includes('archived')
  );
}

/**
 * Compute bandwidth summary for a given set of tasks (all tasks for one assignee).
 */
export function computeBandwidthSummary(
  tasks: NormalizedTask[],
  noDateTasks: NormalizedTask[]
): BandwidthSummary {
  const allTasks = [...tasks, ...noDateTasks];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const in14Days = new Date(today);
  in14Days.setDate(in14Days.getDate() + 14);

  // Active (non-completed) tasks
  const activeTasks = allTasks.filter(isActiveBandwidthTask);

  // Check if any active task overlaps the next 14 days
  const hasWorkInNext14Days = activeTasks.some(t => {
    if (!t.startDate || !t.endDate) return false;
    // Task overlaps [today, today+14d] if it starts before the end of the window AND ends after today
    return t.startDate <= in14Days && t.endDate >= today;
  });

  // Find free gaps across ALL dated tasks (not just active), then filter to next 14 days
  const datedTasks = allTasks.filter(t => t.startDate && t.endDate);
  const allGaps = findFreeGaps(datedTasks);

  // Completely free from: the day after the latest active task's end date
  let latestEndDate: Date | null = null;
  for (const t of activeTasks) {
    if (t.endDate && (!latestEndDate || t.endDate > latestEndDate)) {
      latestEndDate = t.endDate;
    }
  }

  const isFreeNow = activeTasks.length === 0 || !latestEndDate || latestEndDate < today;
  let completelyFreeFrom: Date | null = null;
  let freeFromLabel = 'Now';

  if (!isFreeNow && latestEndDate) {
    const nextDay = new Date(latestEndDate);
    nextDay.setDate(nextDay.getDate() + 1);
    completelyFreeFrom = nextDay;
    freeFromLabel = formatDateShort(nextDay);
  }

  // Calculate free days using a daily check for robustness (starting from tomorrow)
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let totalFreeDays = 0;
  let freeDaysUntilCompletelyFree = 0;

  // 1. Next 14 days (from tomorrow)
  const checkDay14 = new Date(tomorrow);
  for (let i = 1; i <= 14; i++) {
    const isWorking = datedTasks.some(t => t.startDate && t.endDate && checkDay14 >= t.startDate && checkDay14 <= t.endDate);
    if (!isWorking) {
      totalFreeDays++;
    }
    checkDay14.setDate(checkDay14.getDate() + 1);
  }

  // 2. Until completely free (from tomorrow)
  if (!isFreeNow && latestEndDate && latestEndDate >= tomorrow) {
    const checkDayEnd = new Date(tomorrow);
    while (checkDayEnd <= latestEndDate) {
      const isWorking = datedTasks.some(t => t.startDate && t.endDate && checkDayEnd >= t.startDate && checkDayEnd <= t.endDate);
      if (!isWorking) {
        freeDaysUntilCompletelyFree++;
      }
      checkDayEnd.setDate(checkDayEnd.getDate() + 1);
    }
  }

  // Calculate free gaps until completely free (from tomorrow)
  const freeGapsUntilCompletelyFree: { from: Date; to: Date; days: number; label: string }[] = [];
  
  if (!isFreeNow && latestEndDate && latestEndDate >= tomorrow) {
    let currentGapStart: Date | null = null;
    let currentGapDays = 0;
    const checkDayGap = new Date(tomorrow);
    
    while (checkDayGap <= latestEndDate) {
      const isWorking = datedTasks.some(t => t.startDate && t.endDate && checkDayGap >= t.startDate && checkDayGap <= t.endDate);
      
      if (!isWorking) {
        if (!currentGapStart) {
          currentGapStart = new Date(checkDayGap);
        }
        currentGapDays++;
      } else {
        if (currentGapStart) {
          const gapEnd = new Date(checkDayGap);
          gapEnd.setDate(gapEnd.getDate() - 1);
          freeGapsUntilCompletelyFree.push({
            from: new Date(currentGapStart),
            to: gapEnd,
            days: currentGapDays,
            label: currentGapStart.getTime() === gapEnd.getTime() 
              ? formatDateShort(currentGapStart)
              : `${formatDateShort(currentGapStart)} - ${formatDateShort(gapEnd)}`
          });
          currentGapStart = null;
          currentGapDays = 0;
        }
      }
      checkDayGap.setDate(checkDayGap.getDate() + 1);
    }
    // If gap extends to end, though latestEndDate is usually a working day
    if (currentGapStart) {
      const gapEnd = new Date(latestEndDate);
      freeGapsUntilCompletelyFree.push({
        from: new Date(currentGapStart),
        to: gapEnd,
        days: currentGapDays,
        label: currentGapStart.getTime() === gapEnd.getTime() 
          ? formatDateShort(currentGapStart)
          : `${formatDateShort(currentGapStart)} - ${formatDateShort(gapEnd)}`
      });
    }
  }

  return {
    hasWorkInNext14Days,
    freeDaysCount: totalFreeDays,
    freeDaysUntilCompletelyFree,
    freeGaps: freeGapsUntilCompletelyFree,
    completelyFreeFrom,
    isFreeNow,
    freeFromLabel,
  };
}
