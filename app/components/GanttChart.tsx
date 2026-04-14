'use client';

import { TreeRow, TimelineConfig, CustomField } from '../types';
import { dateToPx, durationToPx, formatShortDate, getDayOfWeekLetter, isSameDay, isWeekend } from '../utils/dateUtils';

interface Props {
  mode: 'header' | 'body';
  rows: TreeRow[];
  config: TimelineConfig;
  rowHeight: number;
}

const PLANNED_START_NAMES = ['planned start date', 'planned start'];
const PLANNED_DUE_NAMES = ['planned due date', 'planned due'];

function findCustomField(fields: CustomField[], names: string[]): CustomField | undefined {
  return fields.find(cf => names.includes(cf.name.toLowerCase()) && cf.value !== null && cf.value !== undefined && cf.value !== '');
}

function formatDateCompact(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(1, Math.round(Math.abs(b.getTime() - a.getTime()) / 86400000));
}

function formatPlannedDate(cf: CustomField): string {
  const ts = Number(cf.value);
  if (!isNaN(ts) && ts > 1000000000000) {
    return formatDateCompact(new Date(ts));
  }
  if (!isNaN(ts) && ts > 1000000000) {
    return formatDateCompact(new Date(ts * 1000));
  }
  return String(cf.value);
}

function getStatusColor(status: string, color: string): string {
  const s = status.toLowerCase();
  if (s.includes('complete') || s.includes('done') || s.includes('resolved')) return '#3fb950';
  if (s.includes('progress') || s.includes('active')) return '#d29922';
  if (s.includes('review') || s.includes('test')) return '#bc8cff';
  if (s.includes('closed') || s.includes('archived')) return '#6e7681';
  if (color && color !== '#666666') return color;
  return '#58a6ff';
}

function getStatusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('complete') || s.includes('done')) return 'complete';
  if (s.includes('progress')) return 'in progress';
  if (s.includes('review')) return 'review';
  if (s.includes('closed')) return 'closed';
  if (s.includes('todo') || s.includes('to do') || s.includes('open')) return 'to do';
  return status;
}

export default function GanttChart({ mode, rows, config, rowHeight }: Props) {
  const { startDate, pxPerDay, totalDays, totalWidth } = config;
  const today = new Date();
  const headerHeight = 50;

  if (mode === 'header') {
    return renderHeader(startDate, totalDays, pxPerDay, totalWidth, today, headerHeight);
  }

  return renderBody(rows, startDate, pxPerDay, totalWidth, today, rowHeight);
}

function renderHeader(startDate: Date, totalDays: number, pxPerDay: number, totalWidth: number, today: Date, headerHeight: number) {
  const days: Date[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  // Find month boundaries
  const months: { label: string; x: number; width: number }[] = [];
  let currentMonth = -1;
  let monthStart = 0;
  for (let i = 0; i < days.length; i++) {
    const m = days[i].getMonth();
    if (m !== currentMonth) {
      if (currentMonth !== -1) {
        months.push({
          label: `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][currentMonth]} ${days[i - 1].getDate()}`,
          x: monthStart * pxPerDay,
          width: (i - monthStart) * pxPerDay,
        });
      }
      currentMonth = m;
      monthStart = i;
    }
  }
  if (currentMonth !== -1) {
    const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    months.push({
      label: `${mNames[currentMonth]} ${days[days.length - 1].getDate()}`,
      x: monthStart * pxPerDay,
      width: (days.length - monthStart) * pxPerDay,
    });
  }

  const todayIdx = days.findIndex(d => isSameDay(d, today));

  return (
    <svg width={totalWidth} height={headerHeight} style={{ display: 'block' }}>
      {/* Month labels */}
      {months.map((m, i) => (
        <g key={i}>
          <text x={m.x + 6} y={16} className="gantt-month-label">{m.label}</text>
          <line x1={m.x} y1={0} x2={m.x} y2={headerHeight} stroke="#21262d" strokeWidth={1} />
        </g>
      ))}

      {/* Day columns */}
      {days.map((d, i) => {
        const x = i * pxPerDay;
        const isToday = isSameDay(d, today);
        return (
          <g key={i}>
            <line x1={x} y1={24} x2={x} y2={headerHeight} stroke="#21262d" strokeWidth={0.5} />
            <text x={x + pxPerDay / 2} y={38} textAnchor="middle" className="gantt-day-label" fill={isToday ? '#da3633' : '#e6edf3'}>
              {getDayOfWeekLetter(d)}
            </text>
            {isWeekend(d) && (
              <text x={x + pxPerDay / 2} y={48} textAnchor="middle" style={{ fontSize: 7, fill: '#484f58' }}>
                {d.getDate()}
              </text>
            )}
          </g>
        );
      })}

      {/* TODAY marker */}
      {todayIdx >= 0 && (
        <g>
          <rect x={todayIdx * pxPerDay - 1} y={0} width={pxPerDay + 2} height={20} rx={3} fill="#da3633" />
          <text x={todayIdx * pxPerDay + pxPerDay / 2} y={14} textAnchor="middle" className="gantt-today-label">TODAY</text>
        </g>
      )}
    </svg>
  );
}

function parseCustomFieldDate(cf: CustomField | undefined): Date | null {
  if (!cf) return null;
  const ts = Number(cf.value);
  if (isNaN(ts) || ts === 0) return null;
  // Handle both milliseconds and seconds timestamps
  if (ts > 1000000000000) return new Date(ts);
  if (ts > 1000000000) return new Date(ts * 1000);
  return null;
}

function renderBody(rows: TreeRow[], startDate: Date, pxPerDay: number, totalWidth: number, today: Date, rowHeight: number) {
  const totalHeight = rows.length * rowHeight;
  const todayX = dateToPx(today, startDate, pxPerDay);

  // Build day grid for background
  const totalDays = Math.ceil(totalWidth / pxPerDay);

  // Collect delay bar info for generating unique gradient defs
  const delayBars: { id: string; delayX: number; delayW: number; y: number; h: number }[] = [];
  const projDelayBars: { id: string }[] = [];
  const compDelayBars: { id: string }[] = [];
  rows.forEach((row, i) => {
    if (row.type !== 'task') return;
    const t = row.task;
    if (!t.startDate || !t.endDate) return;
    const plannedStartCf = findCustomField(t.customFields, PLANNED_START_NAMES);
    const plannedStartDate = parseCustomFieldDate(plannedStartCf);
    // Starting delay gradient
    if (plannedStartDate && t.startDate.getTime() > plannedStartDate.getTime()) {
      const delayX = dateToPx(plannedStartDate, startDate, pxPerDay);
      const taskX = dateToPx(t.startDate, startDate, pxPerDay);
      const delayW = taskX - delayX;
      if (delayW > 0) {
        delayBars.push({ id: `delay-grad-${t.id}-${i}`, delayX, delayW, y: i * rowHeight + 8, h: rowHeight - 16 });
      }
    }
    // Project length delay gradient
    const plannedDueCf = findCustomField(t.customFields, PLANNED_DUE_NAMES);
    const plannedDueDate = parseCustomFieldDate(plannedDueCf);
    const ONE_DAY = 86400000;
    if (plannedStartDate && plannedDueDate) {
      const plannedDuration = plannedDueDate.getTime() - plannedStartDate.getTime();
      const actualDuration = t.endDate.getTime() - t.startDate.getTime();
      if ((actualDuration - plannedDuration) > ONE_DAY) {
        projDelayBars.push({ id: `proj-delay-grad-${t.id}-${i}` });
      }
    }
    // Completion delay gradient
    if (t.dateCompleted && t.endDate) {
      const doneDay = new Date(t.dateCompleted.getFullYear(), t.dateCompleted.getMonth(), t.dateCompleted.getDate());
      const dueDay = new Date(t.endDate.getFullYear(), t.endDate.getMonth(), t.endDate.getDate());
      if (doneDay.getTime() > dueDay.getTime() + ONE_DAY) {
        compDelayBars.push({ id: `comp-delay-grad-${t.id}-${i}` });
      }
    }
  });

  return (
    <svg className="gantt-bars-svg" width={totalWidth} height={totalHeight} style={{ display: 'block' }}>
      {/* Gradient definitions for delay bars */}
      <defs>
        {/* Starting delay: grey gradient */}
        {delayBars.map(db => (
          <linearGradient key={db.id} id={db.id} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6e7681" stopOpacity={0.15} />
            <stop offset="40%" stopColor="#6e7681" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#6e7681" stopOpacity={0.6} />
          </linearGradient>
        ))}
        {/* Project length delay: red gradient */}
        {projDelayBars.map(db => (
          <linearGradient key={db.id} id={db.id} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#da3633" stopOpacity={0.4} />
            <stop offset="50%" stopColor="#da3633" stopOpacity={0.7} />
            <stop offset="100%" stopColor="#da3633" stopOpacity={0.9} />
          </linearGradient>
        ))}
        {/* Completion delay: amber/orange gradient */}
        {compDelayBars.map(db => (
          <linearGradient key={db.id} id={db.id} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f0883e" stopOpacity={0.4} />
            <stop offset="50%" stopColor="#f0883e" stopOpacity={0.7} />
            <stop offset="100%" stopColor="#f0883e" stopOpacity={0.9} />
          </linearGradient>
        ))}
      </defs>

      {/* Weekend shading */}
      {Array.from({ length: totalDays }).map((_, i) => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        if (!isWeekend(d)) return null;
        return <rect key={`w${i}`} x={i * pxPerDay} y={0} width={pxPerDay} height={totalHeight} fill="rgba(255,255,255,0.015)" />;
      })}

      {/* Vertical grid lines */}
      {Array.from({ length: totalDays }).map((_, i) => (
        <line key={`g${i}`} x1={i * pxPerDay} y1={0} x2={i * pxPerDay} y2={totalHeight} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
      ))}

      {/* Horizontal row lines */}
      {rows.map((_, i) => (
        <line key={`h${i}`} x1={0} y1={(i + 1) * rowHeight} x2={totalWidth} y2={(i + 1) * rowHeight} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
      ))}

      {/* Task bars */}
      {rows.map((row, i) => {
        if (row.type !== 'task') return null;
        const t = row.task;
        const y = i * rowHeight + 8;
        const h = rowHeight - 16;

        if (!t.startDate || !t.endDate) return null;

        const x = dateToPx(t.startDate, startDate, pxPerDay);
        const w = durationToPx(t.startDate, t.endDate, pxPerDay);
        const color = getStatusColor(t.status, t.statusColor);
        const label = getStatusLabel(t.status);

        // Extract planned dates from custom fields
        const plannedStart = findCustomField(t.customFields, PLANNED_START_NAMES);
        const plannedDue = findCustomField(t.customFields, PLANNED_DUE_NAMES);
        const hasPlannedDates = plannedStart || plannedDue;

        let plannedLabel = 'Planned dates not present';
        const plannedStartDate = parseCustomFieldDate(plannedStart);
        const plannedDueDate = parseCustomFieldDate(plannedDue);
        if (hasPlannedDates) {
          const startStr = plannedStart ? formatPlannedDate(plannedStart) : '—';
          const dueStr = plannedDue ? formatPlannedDate(plannedDue) : '—';
          const dayCount = plannedStartDate && plannedDueDate ? daysBetween(plannedStartDate, plannedDueDate) : null;
          plannedLabel = dayCount !== null ? `${startStr} - ${dueStr} (${dayCount}d)` : `${startStr} - ${dueStr}`;
        }
        const labelWidth = plannedLabel.length * 6;

        // Starting Delay: actual start > planned start
        // Grey bar spans only the planned window (planned start to planned due)
        const hasStartingDelay = plannedStartDate && t.startDate.getTime() > plannedStartDate.getTime();
        let delayBarX = 0;
        let delayBarW = 0;
        if (hasStartingDelay && plannedStartDate) {
          delayBarX = dateToPx(plannedStartDate, startDate, pxPerDay);
          // Only span the planned date range (planned start to planned due), not all the way to actual start
          const delayEndDate = plannedDueDate && plannedDueDate.getTime() < t.startDate.getTime()
            ? plannedDueDate
            : t.startDate;
          delayBarW = dateToPx(delayEndDate, startDate, pxPerDay) - delayBarX;
        }

        // Project Length Delay: actual duration > planned duration (by > 1 day)
        const ONE_DAY_MS = 86400000;
        let hasProjectLengthDelay = false;
        let projDelayX = 0;
        let projDelayW = 0;
        let projDelayDays = 0;
        if (plannedStartDate && plannedDueDate && t.startDate && t.endDate) {
          const plannedDuration = plannedDueDate.getTime() - plannedStartDate.getTime();
          const actualDuration = t.endDate.getTime() - t.startDate.getTime();
          if ((actualDuration - plannedDuration) > ONE_DAY_MS) {
            hasProjectLengthDelay = true;
            projDelayDays = Math.round((actualDuration - plannedDuration) / ONE_DAY_MS);
            // The "on-time" portion ends at actualStart + plannedDuration
            const onTimeEnd = new Date(t.startDate.getTime() + plannedDuration);
            projDelayX = dateToPx(onTimeEnd, startDate, pxPerDay);
            projDelayW = dateToPx(t.endDate, startDate, pxPerDay) - projDelayX;
          }
        }

        // Completion Delay: dateCompleted > endDate (by > 1 day)
        const ONE_DAY_CD = 86400000;
        let hasCompletionDelay = false;
        let compDelayX = 0;
        let compDelayW = 0;
        let compDelayDays = 0;
        if (t.dateCompleted && t.endDate) {
          const doneDay = new Date(t.dateCompleted.getFullYear(), t.dateCompleted.getMonth(), t.dateCompleted.getDate());
          const dueDay = new Date(t.endDate.getFullYear(), t.endDate.getMonth(), t.endDate.getDate());
          const diff = doneDay.getTime() - dueDay.getTime();
          if (diff > ONE_DAY_CD) {
            hasCompletionDelay = true;
            compDelayDays = Math.round(diff / ONE_DAY_CD);
            compDelayX = dateToPx(t.endDate, startDate, pxPerDay) + durationToPx(t.startDate, t.endDate, pxPerDay) - dateToPx(t.startDate, startDate, pxPerDay) + dateToPx(t.startDate, startDate, pxPerDay);
            // Position: starts at endDate, extends to dateCompleted
            compDelayX = dateToPx(t.endDate, startDate, pxPerDay);
            compDelayW = dateToPx(doneDay, startDate, pxPerDay) - compDelayX;
          }
        }

        return (
          <g key={t.id + '-' + i}>
            {/* Starting Delay gradient bar (planned start to actual start) */}
            {hasStartingDelay && delayBarW > 0 && (
              <>
                {/* Delay bar with gradient */}
                <rect
                  x={delayBarX}
                  y={y}
                  width={delayBarW}
                  height={h}
                  rx={4}
                  fill={`url(#delay-grad-${t.id}-${i})`}
                />
                {/* Dashed border on delay bar */}
                <rect
                  x={delayBarX}
                  y={y}
                  width={delayBarW}
                  height={h}
                  rx={4}
                  fill="none"
                  stroke="#6e7681"
                  strokeWidth={1}
                  strokeDasharray="4 2"
                  opacity={0.5}
                />
                {/* Small "delay" label inside if wide enough */}
                {delayBarW > 40 && (
                  <text
                    x={delayBarX + delayBarW / 2}
                    y={y + h / 2 + 3}
                    textAnchor="middle"
                    fill="#8b949e"
                    fontSize={8}
                    fontWeight={500}
                    fontFamily="var(--font-sans)"
                    fontStyle="italic"
                  >
                    delay
                  </text>
                )}
              </>
            )}
            {/* Planned date range label BEFORE bar */}
            <text
              x={(hasStartingDelay && delayBarW > 0 ? delayBarX : x) - 4}
              y={y + h / 2 + 4}
              fill={hasPlannedDates ? '#8b949e' : '#6e7681'}
              fontSize={10}
              fontStyle={hasPlannedDates ? 'normal' : 'italic'}
              fontFamily="var(--font-sans)"
              textAnchor="end"
            >
              {plannedLabel}
            </text>
            {/* Bar shadow */}
            <rect x={x + 1} y={y + 1} width={w} height={h} rx={4} fill="rgba(0,0,0,0.3)" />
            {/* Bar */}
            <rect x={x} y={y} width={w} height={h} rx={4} fill={color} opacity={0.9} />
            {/* Project Length Delay: red overlay on the excess portion */}
            {hasProjectLengthDelay && projDelayW > 0 && (
              <>
                {/* Red gradient overlay on the excess duration */}
                <rect
                  x={projDelayX}
                  y={y}
                  width={projDelayW}
                  height={h}
                  rx={4}
                  fill={`url(#proj-delay-grad-${t.id}-${i})`}
                />
                {/* Dashed red border on the delay portion */}
                <rect
                  x={projDelayX}
                  y={y}
                  width={projDelayW}
                  height={h}
                  rx={4}
                  fill="none"
                  stroke="#da3633"
                  strokeWidth={1}
                  strokeDasharray="4 2"
                  opacity={0.7}
                />
                {/* "+Xd" delay label */}
                {projDelayW > 20 && (
                  <text
                    x={projDelayX + projDelayW / 2}
                    y={y + h / 2 + 3}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={9}
                    fontWeight={700}
                    fontFamily="var(--font-sans)"
                  >
                    +{projDelayDays}d
                  </text>
                )}
              </>
            )}
            {/* Completion Delay: amber/orange bar extending past due date */}
            {hasCompletionDelay && compDelayW > 0 && (
              <>
                {/* Amber gradient bar for completion delay */}
                <rect
                  x={compDelayX}
                  y={y}
                  width={compDelayW}
                  height={h}
                  rx={4}
                  fill={`url(#comp-delay-grad-${t.id}-${i})`}
                />
                {/* Dashed amber border on the completion delay portion */}
                <rect
                  x={compDelayX}
                  y={y}
                  width={compDelayW}
                  height={h}
                  rx={4}
                  fill="none"
                  stroke="#f0883e"
                  strokeWidth={1}
                  strokeDasharray="4 2"
                  opacity={0.7}
                />
                {/* "+Xd" completion delay label */}
                {compDelayW > 20 && (
                  <text
                    x={compDelayX + compDelayW / 2}
                    y={y + h / 2 + 3}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={9}
                    fontWeight={700}
                    fontFamily="var(--font-sans)"
                  >
                    +{compDelayDays}d
                  </text>
                )}
              </>
            )}
            {/* Status label on bar */}
            {w > 60 && (
              <text x={x + 8} y={y + h / 2 + 4} fill="#fff" fontSize={10} fontWeight={600} fontFamily="var(--font-sans)">
                {label}
              </text>
            )}
            {/* Actual start date - due date label after bar */}
            <text x={Math.max(x + w, hasProjectLengthDelay && projDelayW > 0 ? projDelayX + projDelayW : 0, hasCompletionDelay && compDelayW > 0 ? compDelayX + compDelayW : 0) + 6} y={y + h / 2 + 4} fill="#8b949e" fontSize={10} fontFamily="var(--font-sans)">
              {t.startDate && t.endDate
                ? `${formatDateCompact(t.startDate)} - ${formatDateCompact(t.endDate)} (${daysBetween(t.startDate, t.endDate)}d)`
                : t.startDate
                ? formatDateCompact(t.startDate)
                : t.endDate
                ? formatDateCompact(t.endDate)
                : ''}
            </text>
          </g>
        );
      })}

      {/* TODAY line */}
      <line x1={todayX} y1={0} x2={todayX} y2={totalHeight} stroke="#da3633" strokeWidth={2} opacity={0.8} />
    </svg>
  );
}
