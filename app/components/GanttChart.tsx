'use client';

import { useState } from 'react';
import { NormalizedTask } from '../types';

import { TreeRow, TimelineConfig, CustomField, GanttScale } from '../types';
import { dateToPx, durationToPx, formatShortDate, getDayOfWeekLetter, isSameDay, isWeekend, generateTimeBuckets, TimeBucket, HeaderGroup } from '../utils/dateUtils';

interface Props {
  mode: 'header' | 'body';
  rows: TreeRow[];
  config: TimelineConfig;
  rowHeight: number;
  onTaskClick?: (task: NormalizedTask) => void;
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

export default function GanttChart({ mode, rows, config, rowHeight, onTaskClick }: Props) {
  const { startDate, pxPerDay, totalDays, totalWidth, scale } = config;
  const today = new Date();
  const headerHeight = 50;
  const [highlightedRow, setHighlightedRow] = useState<number | null>(null);

  // Generate time buckets based on scale
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + totalDays);
  const { buckets, groups } = generateTimeBuckets(scale, startDate, endDate, pxPerDay);

  if (mode === 'header') {
    return renderHeader(buckets, groups, startDate, pxPerDay, totalWidth, today, headerHeight, scale);
  }

  return renderBody(rows, buckets, startDate, pxPerDay, totalWidth, today, rowHeight, scale, highlightedRow, setHighlightedRow, onTaskClick);
}

function renderHeader(
  buckets: TimeBucket[],
  groups: HeaderGroup[],
  startDate: Date,
  pxPerDay: number,
  totalWidth: number,
  today: Date,
  headerHeight: number,
  scale: GanttScale
) {
  const todayX = dateToPx(today, startDate, pxPerDay);

  return (
    <svg width={totalWidth} height={headerHeight} style={{ display: 'block' }}>
      {/* Group labels (top row) — months for day/week, years for month/quarter */}
      {groups.map((g, i) => (
        <g key={`grp-${i}`}>
          <text x={g.x + 6} y={16} className="gantt-month-label" fill="#e6edf3">{g.label}</text>
          <line x1={g.x} y1={0} x2={g.x} y2={headerHeight} stroke="#21262d" strokeWidth={1} />
        </g>
      ))}

      {/* Bucket columns (bottom row) */}
      {buckets.map((b, i) => {
        return (
          <g key={`bkt-${i}`}>
            <line x1={b.x} y1={24} x2={b.x} y2={headerHeight} stroke="#21262d" strokeWidth={0.5} />
            {b.width >= 12 && (
              <text
                x={b.x + b.width / 2}
                y={38}
                textAnchor="middle"
                className="gantt-day-label"
                fill={b.isToday ? '#da3633' : '#e6edf3'}
              >
                {b.label}
              </text>
            )}
            {/* For day scale, show date number on weekends */}
            {scale === 'day' && isWeekend(b.start) && (
              <text x={b.x + b.width / 2} y={48} textAnchor="middle" style={{ fontSize: 7, fill: '#484f58' }}>
                {b.start.getDate()}
              </text>
            )}
            {/* For week scale, show date range below */}
            {scale === 'week' && b.width >= 30 && (
              <text x={b.x + b.width / 2} y={48} textAnchor="middle" style={{ fontSize: 7, fill: '#484f58' }}>
                {`${b.start.getDate()}-${new Date(b.end.getTime() - 86400000).getDate()}`}
              </text>
            )}
          </g>
        );
      })}

      {/* TODAY marker */}
      {(() => {
        const todayBucket = buckets.find(b => b.isToday);
        if (!todayBucket) return null;

        if (scale === 'day') {
          return (
            <g>
              <rect x={todayBucket.x - 1} y={0} width={todayBucket.width + 2} height={20} rx={3} fill="#da3633" />
              <text x={todayBucket.x + todayBucket.width / 2} y={14} textAnchor="middle" className="gantt-today-label">TODAY</text>
            </g>
          );
        } else {
          // For larger scales, show a thin line with a small marker
          return (
            <g>
              <rect x={todayX - 8} y={0} width={40} height={16} rx={3} fill="#da3633" />
              <text x={todayX + 12} y={12} textAnchor="middle" style={{ fontSize: 8, fill: '#fff', fontWeight: 700 }}>TODAY</text>
            </g>
          );
        }
      })()}
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

function renderBody(
  rows: TreeRow[],
  buckets: TimeBucket[],
  startDate: Date,
  pxPerDay: number,
  totalWidth: number,
  today: Date,
  rowHeight: number,
  scale: GanttScale,
  highlightedRow: number | null,
  setHighlightedRow: (idx: number | null) => void,
  onTaskClick?: (task: NormalizedTask) => void
) {
  const totalHeight = rows.length * rowHeight;
  const todayX = dateToPx(today, startDate, pxPerDay);

  // Dual-line layout: top half = delay line, bottom half = main line
  const lineThickness = 6;

  return (
    <svg className="gantt-bars-svg" width={totalWidth} height={totalHeight} style={{ display: 'block' }}>

      {/* Weekend shading — only for day and week scales */}
      {(scale === 'day') && buckets.map((b, i) => {
        if (!isWeekend(b.start)) return null;
        return <rect key={`w${i}`} x={b.x} y={0} width={b.width} height={totalHeight} fill="rgba(255,255,255,0.015)" />;
      })}

      {/* Vertical grid lines at bucket boundaries */}
      {buckets.map((b, i) => (
        <line key={`g${i}`} x1={b.x} y1={0} x2={b.x} y2={totalHeight} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
      ))}

      {/* Highlighted row background */}
      {highlightedRow !== null && (
        <rect
          x={0}
          y={highlightedRow * rowHeight}
          width={totalWidth}
          height={rowHeight}
          fill="rgba(255,255,255,0.06)"
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Clickable row hit areas + horizontal row lines */}
      {rows.map((row, i) => (
        <g key={`h${i}`}>
          <rect
            x={0}
            y={i * rowHeight}
            width={totalWidth}
            height={rowHeight}
            fill="transparent"
            style={{ cursor: row.type === 'task' ? 'pointer' : 'default' }}
            onMouseEnter={() => setHighlightedRow(i)}
            onMouseLeave={() => setHighlightedRow(null)}
            onClick={() => {
              if (row.type === 'task' && onTaskClick) onTaskClick(row.task);
            }}
          />
          <line x1={0} y1={(i + 1) * rowHeight} x2={totalWidth} y2={(i + 1) * rowHeight} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
        </g>
      ))}

      {/* Task bars */}
      {rows.map((row, i) => {
        if (row.type !== 'task') return null;
        const t = row.task;

        if (!t.startDate || !t.endDate) return null;

        // === Dual-line Y positioning ===
        const rowTop = i * rowHeight;
        const topLineY = rowTop + 12;    // Line 1: planned timeline
        const bottomLineY = rowTop + 30; // Line 2: actual + delays

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
                {/* Planned start date on the LEFT of the bar */}
                <text
                  x={plannedX - 4}
                  y={topLineY + 5}
                  fill="#8b949e"
                  fontSize={9}
                  fontFamily="var(--font-sans)"
                  textAnchor="end"
                >
                  {plannedStartDate ? formatDateCompact(plannedStartDate) : ''}
                </text>
                {/* Planned due date on the RIGHT of the bar */}
                <text
                  x={plannedX + plannedW + 6}
                  y={topLineY + 5}
                  fill="#8b949e"
                  fontSize={9}
                  fontFamily="var(--font-sans)"
                >
                  {plannedDueDate ? formatDateCompact(plannedDueDate) : ''}
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
            {/* Actual start date on the LEFT of the bar */}
            <text
              x={(hasPlannedDates ? plannedX : x) - 4}
              y={bottomLineY + 5}
              fill="#8b949e"
              fontSize={9}
              fontFamily="var(--font-sans)"
              textAnchor="end"
            >
              {t.startDate ? formatDateCompact(t.startDate) : ''}
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

            {/* Status label BELOW bar */}
            {(hasPlannedDates ? plannedW : w) > 60 && (
              <text x={hasPlannedDates ? plannedX : x} y={bottomLineY + lineThickness + 10} fill={color} fontSize={9} fontWeight={600} fontFamily="var(--font-sans)">
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
                    y={bottomLineY + lineThickness + 10}
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
                  strokeWidth={lineThickness - 2}
                  strokeDasharray="10 4"
                  strokeLinecap="butt"
                  opacity={0.7}
                />
                {compDelayW > 20 && (
                  <text
                    x={compDelayX + compDelayW / 2}
                    y={bottomLineY + lineThickness + 10}
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

            {/* Actual end date on the RIGHT after all bars */}
            <text
              x={(hasPlannedDates ? plannedX + plannedW : x + w) + (hasProjectLengthDelay ? projDelayW : 0) + (hasCompletionDelay ? compDelayW : 0) + 6}
              y={bottomLineY + 5}
              fill="#8b949e"
              fontSize={9}
              fontFamily="var(--font-sans)"
            >
              {t.dateCompleted
                ? formatDateCompact(t.dateCompleted)
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
