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

      {/* Task bars — connected double-bar style */}
      {rows.map((row, i) => {
        if (row.type !== 'task') return null;
        const t = row.task;

        if (!t.startDate || !t.endDate) return null;

        // === Connected double-bar Y positioning ===
        const barH = 10;           // thickness of each bar
        const gap = 1;             // 1px divider between the two bars
        const totalBarH = barH * 2 + gap; // total height of the double bar
        const rowTop = i * rowHeight;
        const barGroupY = rowTop + Math.round((rowHeight - totalBarH) / 2) - 4; // vertically center the pair (nudge up for labels)
        const topBarY = barGroupY;             // planned bar
        const bottomBarY = barGroupY + barH + gap; // actual bar

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

        // Planned bar position
        let plannedX = 0;
        let plannedW = 0;
        if (hasPlannedDates && plannedStartDate && plannedDueDate) {
          plannedX = dateToPx(plannedStartDate, startDate, pxPerDay);
          plannedW = dateToPx(plannedDueDate, startDate, pxPerDay) - plannedX;
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
            projDelayX = dateToPx(plannedDueDate, startDate, pxPerDay);
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
            compDelayX = hasProjectLengthDelay ? projDelayX + projDelayW : (hasPlannedDates ? plannedX + plannedW : dateToPx(t.endDate, startDate, pxPerDay));
            compDelayW = dateToPx(doneDay, startDate, pxPerDay) - compDelayX;
          }
        }

        // Compute the full extent of the double bar group (for the connecting bracket)
        const groupLeftX = hasPlannedDates ? Math.min(plannedX, x) : x;
        const baseRightX = hasPlannedDates ? Math.max(plannedX + plannedW, x + w) : x + w;
        const delayRightX = baseRightX + (hasProjectLengthDelay ? projDelayW : 0) + (hasCompletionDelay ? compDelayW : 0);

        return (
          <g key={t.id + '-' + i}>

            {/* ========== CONNECTING BRACKET (background behind both bars) ========== */}
            {hasPlannedDates && plannedW > 0 && (
              <rect
                x={groupLeftX - 1}
                y={barGroupY - 1}
                width={Math.max(plannedW, w) + 2}
                height={totalBarH + 2}
                rx={4}
                fill="rgba(255,255,255,0.03)"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={0.5}
              />
            )}

            {/* ========== LEFT DATE LABELS ========== */}
            {hasPlannedDates ? (
              <>
                <text x={groupLeftX - 4} y={topBarY + barH - 2} fill="#8b949e" fontSize={8} fontFamily="var(--font-sans)" textAnchor="end">
                  {plannedStartDate ? formatDateCompact(plannedStartDate) : ''}
                </text>
                <text x={groupLeftX - 4} y={bottomBarY + barH - 2} fill="#8b949e" fontSize={8} fontFamily="var(--font-sans)" textAnchor="end">
                  {t.startDate ? formatDateCompact(t.startDate) : ''}
                </text>
              </>
            ) : (
              <text x={x - 4} y={topBarY + barH - 2} fill="#6e7681" fontSize={8} fontFamily="var(--font-sans)" fontStyle="italic" textAnchor="end">
                no planned dates
              </text>
            )}

            {/* ========== TOP BAR: PLANNED TIMELINE ========== */}
            {hasPlannedDates && plannedW > 0 ? (
              <rect x={plannedX} y={topBarY} width={plannedW} height={barH} rx={2} ry={2} fill={color} opacity={0.35} />
            ) : (
              /* When no planned dates, show a single full-height bar for actual */
              null
            )}

            {/* Small "P" label inside top bar */}
            {hasPlannedDates && plannedW > 24 && (
              <text x={plannedX + 5} y={topBarY + barH - 2.5} fill="rgba(255,255,255,0.6)" fontSize={7} fontWeight={700} fontFamily="var(--font-sans)">P</text>
            )}

            {/* ========== BOTTOM BAR: ACTUAL TIMELINE ========== */}
            <rect
              x={hasPlannedDates ? plannedX : x}
              y={hasPlannedDates ? bottomBarY : topBarY}
              width={hasPlannedDates ? plannedW : w}
              height={hasPlannedDates ? barH : totalBarH}
              rx={2}
              ry={2}
              fill={color}
              opacity={0.9}
            />

            {/* Small "A" label inside bottom bar */}
            {hasPlannedDates && plannedW > 24 && (
              <text x={plannedX + 5} y={bottomBarY + barH - 2.5} fill="rgba(255,255,255,0.85)" fontSize={7} fontWeight={700} fontFamily="var(--font-sans)">A</text>
            )}

            {/* ========== RIGHT DATE LABELS ========== */}
            {hasPlannedDates && (
              <text
                x={plannedX + plannedW + 6}
                y={topBarY + barH - 2}
                fill="#8b949e"
                fontSize={8}
                fontFamily="var(--font-sans)"
              >
                {plannedDueDate ? formatDateCompact(plannedDueDate) : ''}
              </text>
            )}

            {/* ========== DELAY EXTENSIONS (on bottom bar line) ========== */}
            {/* Project Length Delay — solid rectangle */}
            {hasProjectLengthDelay && projDelayW > 0 && (
              <>
                <rect
                  x={projDelayX}
                  y={bottomBarY}
                  width={projDelayW}
                  height={barH}
                  rx={2}
                  ry={2}
                  fill="#da3633"
                  opacity={0.8}
                />
                {projDelayW > 20 && (
                  <text x={projDelayX + projDelayW / 2} y={barGroupY + totalBarH + 10} textAnchor="middle" fill="#da3633" fontSize={8} fontWeight={600} fontFamily="var(--font-sans)">
                    P +{projDelayDays}d
                  </text>
                )}
              </>
            )}

            {/* Completion Delay — solid rectangle */}
            {hasCompletionDelay && compDelayW > 0 && (
              <>
                <rect
                  x={compDelayX}
                  y={bottomBarY}
                  width={compDelayW}
                  height={barH}
                  rx={2}
                  ry={2}
                  fill="#f0883e"
                  opacity={0.7}
                />
                {compDelayW > 20 && (
                  <text x={compDelayX + compDelayW / 2} y={barGroupY + totalBarH + 10} textAnchor="middle" fill="#f0883e" fontSize={8} fontWeight={600} fontFamily="var(--font-sans)">
                    C +{compDelayDays}d
                  </text>
                )}
              </>
            )}

            {/* Status label below the double bar */}
            {(hasPlannedDates ? plannedW : w) > 60 && (
              <text x={hasPlannedDates ? plannedX : x} y={barGroupY + totalBarH + 10} fill={color} fontSize={8} fontWeight={600} fontFamily="var(--font-sans)">
                {label}
              </text>
            )}

            {/* Actual end/completion date on the RIGHT after all extensions */}
            <text
              x={delayRightX + 6}
              y={bottomBarY + barH - 2}
              fill="#8b949e"
              fontSize={8}
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
