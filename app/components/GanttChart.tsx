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
  if (s.includes('progress') || s.includes('active')) return '#5A43D6';
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

  // Dual-line layout: top half = delay line, bottom half = main line
  const lineThickness = 6;

  return (
    <svg className="gantt-bars-svg" width={totalWidth} height={totalHeight} style={{ display: 'block' }}>

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

        if (!t.startDate || !t.endDate) return null;

        // === Dual-line Y positioning ===
        const rowTop = i * rowHeight;
        const topLineY = rowTop + 20;    // Line 1: planned timeline
        const bottomLineY = rowTop + 50; // Line 2: actual + delays

        const x = dateToPx(t.startDate, startDate, pxPerDay);
        const w = durationToPx(t.startDate, t.endDate, pxPerDay);
        const color = getStatusColor(t.status, t.statusColor);
        const label = getStatusLabel(t.status);

        // Extract planned dates from custom fields
        const plannedStart = findCustomField(t.customFields, PLANNED_START_NAMES);
        const plannedDue = findCustomField(t.customFields, PLANNED_DUE_NAMES);
        const plannedStartDate = parseCustomFieldDate(plannedStart);
        const plannedDueDate = parseCustomFieldDate(plannedDue);
        const hasPlannedDates = !!(plannedStartDate && plannedDueDate);

        // Planned bar position (top line)
        let plannedX = 0;
        let plannedW = 0;
        let plannedLabel = 'Planned dates not present';
        if (hasPlannedDates && plannedStartDate && plannedDueDate) {
          plannedX = dateToPx(plannedStartDate, startDate, pxPerDay);
          plannedW = dateToPx(plannedDueDate, startDate, pxPerDay) - plannedX;
          const startStr = formatPlannedDate(plannedStart!);
          const dueStr = formatPlannedDate(plannedDue!);
          const dayCount = daysBetween(plannedStartDate, plannedDueDate);
          plannedLabel = `${startStr} - ${dueStr} (${dayCount}d)`;
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
            projDelayX = dateToPx(plannedDueDate, startDate, pxPerDay); // Start dots at planned end
            projDelayW = dateToPx(t.endDate, startDate, pxPerDay) - projDelayX;
          }
        }

        // Completion Delay: dateCompleted > endDate (by > 1 day)
        let hasCompletionDelay = false;
        let compDelayX = 0;
        let compDelayW = 0;
        let compDelayDays = 0;
        if (t.dateCompleted && t.endDate) {
          const doneDay = new Date(t.dateCompleted.getFullYear(), t.dateCompleted.getMonth(), t.dateCompleted.getDate());
          const dueDay = new Date(t.endDate.getFullYear(), t.endDate.getMonth(), t.endDate.getDate());
          const diff = doneDay.getTime() - dueDay.getTime();
          if (diff > ONE_DAY_MS) {
            hasCompletionDelay = true;
            compDelayDays = Math.round(diff / ONE_DAY_MS);
            // Start hyphens after the project delay (or planned end if no project delay)
            compDelayX = hasProjectLengthDelay ? projDelayX + projDelayW : (hasPlannedDates ? plannedX + plannedW : dateToPx(t.endDate, startDate, pxPerDay));
            compDelayW = dateToPx(doneDay, startDate, pxPerDay) - compDelayX;
          }
        }

        return (
          <g key={t.id + '-' + i}>
            {/* ====================== LINE 1 (TOP): PLANNED TIMELINE ====================== */}
            {hasPlannedDates && plannedW > 0 ? (
              <>
                {/* Planned bar: solid, slightly transparent */}
                <rect x={plannedX} y={topLineY} width={plannedW} height={lineThickness} rx={3} fill={color} opacity={0.4} />
                {/* "planned" label before bar */}
                <text
                  x={plannedX - 4}
                  y={topLineY + 5}
                  fill="#6e7681"
                  fontSize={9}
                  fontFamily="var(--font-sans)"
                  fontStyle="italic"
                  textAnchor="end"
                >
                  planned
                </text>
                {/* Planned date range label after bar */}
                <text
                  x={plannedX + plannedW + 6}
                  y={topLineY + 5}
                  fill="#8b949e"
                  fontSize={10}
                  fontFamily="var(--font-sans)"
                >
                  {plannedLabel}
                </text>
              </>
            ) : (
              /* No planned dates label */
              <text
                x={x - 4}
                y={topLineY + 5}
                fill="#6e7681"
                fontSize={9}
                fontFamily="var(--font-sans)"
                fontStyle="italic"
                textAnchor="end"
              >
                no planned dates
              </text>
            )}

            {/* ====================== LINE 2 (BOTTOM): ACTUAL + DELAYS ====================== */}
            {/* "actual" label before bar */}
            <text
              x={(hasPlannedDates ? plannedX : x) - 4}
              y={bottomLineY + 5}
              fill="#6e7681"
              fontSize={9}
              fontFamily="var(--font-sans)"
              fontStyle="italic"
              textAnchor="end"
            >
              actual
            </text>

            {/* Part 1: Solid bar — planned start to planned due (or actual if no planned dates) */}
            <rect
              x={hasPlannedDates ? plannedX : x}
              y={bottomLineY}
              width={hasPlannedDates ? plannedW : w}
              height={lineThickness}
              rx={3}
              fill={color}
              opacity={0.9}
            />

            {/* Status label ABOVE bar */}
            {(hasPlannedDates ? plannedW : w) > 60 && (
              <text x={hasPlannedDates ? plannedX : x} y={bottomLineY - 4} fill={color} fontSize={10} fontWeight={600} fontFamily="var(--font-sans)">
                {label}
              </text>
            )}

            {/* Part 2: Dotted extension — project length delay */}
            {hasProjectLengthDelay && projDelayW > 0 && (
              <>
                <line
                  x1={projDelayX}
                  y1={bottomLineY + lineThickness / 2}
                  x2={projDelayX + projDelayW}
                  y2={bottomLineY + lineThickness / 2}
                  stroke="#da3633"
                  strokeWidth={lineThickness - 2}
                  strokeDasharray="0 6"
                  strokeLinecap="round"
                  opacity={0.8}
                />
                {projDelayW > 20 && (
                  <text
                    x={projDelayX + projDelayW / 2}
                    y={bottomLineY - 4}
                    textAnchor="middle"
                    fill="#da3633"
                    fontSize={9}
                    fontWeight={600}
                    fontFamily="var(--font-sans)"
                  >
                    P +{projDelayDays}d
                  </text>
                )}
              </>
            )}

            {/* Part 3: Dashed (hyphens) extension — completion delay */}
            {hasCompletionDelay && compDelayW > 0 && (
              <>
                <line
                  x1={compDelayX}
                  y1={bottomLineY + lineThickness / 2}
                  x2={compDelayX + compDelayW}
                  y2={bottomLineY + lineThickness / 2}
                  stroke="#f0883e"
                  strokeWidth={lineThickness}
                  strokeDasharray="10 4"
                  strokeLinecap="butt"
                  opacity={0.7}
                />
                {compDelayW > 20 && (
                  <text
                    x={compDelayX + compDelayW / 2}
                    y={bottomLineY - 4}
                    textAnchor="middle"
                    fill="#f0883e"
                    fontSize={9}
                    fontWeight={600}
                    fontFamily="var(--font-sans)"
                  >
                    C +{compDelayDays}d
                  </text>
                )}
              </>
            )}

            {/* Actual date range label after all bars */}
            <text
              x={(hasPlannedDates ? plannedX + plannedW : x + w) + (hasProjectLengthDelay ? projDelayW : 0) + (hasCompletionDelay ? compDelayW : 0) + 6}
              y={bottomLineY + 5}
              fill="#8b949e"
              fontSize={10}
              fontFamily="var(--font-sans)"
            >
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
