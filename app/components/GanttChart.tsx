'use client';

import { TreeRow, TimelineConfig } from '../types';
import { dateToPx, durationToPx, formatShortDate, getDayOfWeekLetter, isSameDay, isWeekend } from '../utils/dateUtils';

interface Props {
  mode: 'header' | 'body';
  rows: TreeRow[];
  config: TimelineConfig;
  rowHeight: number;
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
          label: `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][currentMonth]} ${days[i-1].getDate()}`,
          x: monthStart * pxPerDay,
          width: (i - monthStart) * pxPerDay,
        });
      }
      currentMonth = m;
      monthStart = i;
    }
  }
  if (currentMonth !== -1) {
    const mNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    months.push({
      label: `${mNames[currentMonth]} ${days[days.length-1].getDate()}`,
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

function renderBody(rows: TreeRow[], startDate: Date, pxPerDay: number, totalWidth: number, today: Date, rowHeight: number) {
  const totalHeight = rows.length * rowHeight;
  const todayX = dateToPx(today, startDate, pxPerDay);

  // Build day grid for background
  const totalDays = Math.ceil(totalWidth / pxPerDay);

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

        const x = dateToPx(t.startDate, startDate, pxPerDay);
        const w = durationToPx(t.startDate, t.endDate, pxPerDay);
        const y = i * rowHeight + 8;
        const h = rowHeight - 16;
        const color = getStatusColor(t.status, t.statusColor);
        const label = getStatusLabel(t.status);
        const dateLabel = formatShortDate(t.endDate);

        return (
          <g key={t.id + '-' + i}>
            {/* Bar shadow */}
            <rect x={x + 1} y={y + 1} width={w} height={h} rx={4} fill="rgba(0,0,0,0.3)" />
            {/* Bar */}
            <rect x={x} y={y} width={w} height={h} rx={4} fill={color} opacity={0.9} />
            {/* Status label on bar */}
            {w > 60 && (
              <text x={x + 8} y={y + h / 2 + 4} fill="#fff" fontSize={10} fontWeight={600} fontFamily="var(--font-sans)">
                {label}
              </text>
            )}
            {/* Date label after bar */}
            <text x={x + w + 6} y={y + h / 2 + 4} fill="#8b949e" fontSize={10} fontFamily="var(--font-sans)">
              {dateLabel}
            </text>
          </g>
        );
      })}

      {/* TODAY line */}
      <line x1={todayX} y1={0} x2={todayX} y2={totalHeight} stroke="#da3633" strokeWidth={2} opacity={0.8} />
    </svg>
  );
}
