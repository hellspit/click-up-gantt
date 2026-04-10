'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { useTaskStore } from '../store/useTaskStore';
import { NormalizedTask } from '../types';

// ── Vibrant color palette for pie slices ──
const SLICE_COLORS = [
  '#4e79f6', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab',
  '#6baed6', '#fd8d3c', '#74c476', '#9e9ac8', '#fdae6b',
  '#c49c94', '#f7b6d2', '#c7c7c7', '#dbdb8d', '#17becf',
];

type DurationFilter = 'all' | 'week' | 'month' | 'quarter';

interface SliceData {
  label: string;
  value: number;
  percentage: number;
  color: string;
}

// ── Status grouping config ──
const STATUS_GROUPS = [
  { key: 'todo', label: 'TO DO', match: ['to do', 'todo', 'open', 'not started'], color: '#58a6ff', icon: '○' },
  { key: 'inprogress', label: 'IN PROGRESS', match: ['in progress', 'doing', 'working', 'active'], color: '#d29922', icon: '◐' },
  { key: 'review', label: 'REVIEW', match: ['review', 'in review', 'pending review', 'under review'], color: '#bc8cff', icon: '◑' },
  { key: 'done', label: 'COMPLETE', match: ['complete', 'done', 'closed', 'resolved'], color: '#3fb950', icon: '●' },
];

function getStatusGroup(status: string, statusType: string) {
  const s = status.toLowerCase();
  if (statusType === 'closed') return 'done';
  for (const group of STATUS_GROUPS) {
    if (group.match.some(m => s.includes(m))) return group.key;
  }
  // Default: if statusType gives a hint
  if (statusType === 'done' || statusType === 'closed') return 'done';
  if (statusType === 'active') return 'inprogress';
  return 'todo'; // default bucket
}

function groupTasksByStatus(tasks: NormalizedTask[]): Map<string, NormalizedTask[]> {
  const map = new Map<string, NormalizedTask[]>();
  for (const group of STATUS_GROUPS) {
    map.set(group.key, []);
  }
  map.set('other', []);

  for (const task of tasks) {
    const groupKey = getStatusGroup(task.status, task.statusType);
    const list = map.get(groupKey) || map.get('other')!;
    list.push(task);
  }
  return map;
}

// ── Helpers ──

function getDurationCutoff(duration: DurationFilter): Date | null {
  if (duration === 'all') return null;
  const now = new Date();
  const days = duration === 'week' ? 7 : duration === 'month' ? 30 : 120;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function isTaskDelayed(task: NormalizedTask): boolean {
  const now = new Date();
  const doneStatuses = ['complete', 'closed', 'done', 'resolved'];
  const isDone = doneStatuses.includes(task.status.toLowerCase()) ||
                 task.statusType === 'closed';

  if (!task.endDate) return false;
  if (!isDone && task.endDate < now) return true;
  if (isDone && task.dateCompleted && task.dateCompleted > task.endDate) return true;

  return false;
}

function isTaskActuallyDelayed(task: NormalizedTask): boolean {
  const customField = task.customFields.find(cf => cf.name.toLowerCase() === 'delayed');
  if (!customField) return false;
  
  if (customField.type === 'drop_down' && customField.typeConfig?.options) {
      const optionByIndex = customField.typeConfig.options.find((opt: any) => opt.orderindex === customField.value);
      if (optionByIndex && optionByIndex.name && optionByIndex.name.toLowerCase() === 'yes') {
          return true;
      }
      const optionById = customField.typeConfig.options.find((opt: any) => opt.id === customField.value);
      if (optionById && optionById.name && optionById.name.toLowerCase() === 'yes') {
           return true;
      }
  }
  
  if (typeof customField.value === 'string' && customField.value.toLowerCase() === 'yes') {
      return true;
  }
  if (Array.isArray(customField.value)) {
      return customField.value.some(v => typeof v === 'string' && v.toLowerCase() === 'yes');
  }
  if (customField.type === 'checkbox' && customField.value === true) {
      return true;
  }

  return false;
}

function groupTasksByAssignee(tasks: NormalizedTask[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const task of tasks) {
    if (task.assignees.length === 0) {
      map.set('Unassigned', (map.get('Unassigned') || 0) + 1);
    } else {
      for (const a of task.assignees) {
        const name = a.username || 'Unknown';
        map.set(name, (map.get(name) || 0) + 1);
      }
    }
  }
  return map;
}

function buildSlices(groupMap: Map<string, number>): SliceData[] {
  const total = Array.from(groupMap.values()).reduce((s, v) => s + v, 0);
  if (total === 0) return [];
  const entries = Array.from(groupMap.entries()).sort((a, b) => b[1] - a[1]);

  const MIN_PCT = 2; // slices below 2% get grouped into "Others"
  const mainSlices: SliceData[] = [];
  let othersValue = 0;

  for (const [label, value] of entries) {
    const pct = (value / total) * 100;
    if (pct >= MIN_PCT) {
      mainSlices.push({
        label,
        value,
        percentage: parseFloat(pct.toFixed(2)),
        color: SLICE_COLORS[mainSlices.length % SLICE_COLORS.length],
      });
    } else {
      othersValue += value;
    }
  }

  if (othersValue > 0) {
    mainSlices.push({
      label: 'Others',
      value: othersValue,
      percentage: parseFloat(((othersValue / total) * 100).toFixed(2)),
      color: '#6e7681',
    });
  }

  return mainSlices;
}

function formatDate(d: Date | null): string {
  if (!d) return '—';
  const now = new Date();
  const diff = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff <= 7) return `In ${diff} days`;
  if (diff < -1 && diff >= -7) return `${Math.abs(diff)} days ago`;

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Label collision avoidance ──
interface LabelPos {
  x: number;
  y: number;
  textAnchor: 'start' | 'end';
  elbowX: number;
  elbowY: number;
  edgeX: number;
  edgeY: number;
}

function resolveLabels(
  slices: { midAngle: number; percentage: number }[],
  cx: number,
  cy: number,
  pieRadius: number,
): LabelPos[] {
  const labelGap = 16;
  const edgeR = pieRadius + 12;
  const elbowR = pieRadius + 35;
  const extendLen = 30;

  const positions: LabelPos[] = slices.map((s) => {
    const angle = s.midAngle;
    const edgeX = cx + edgeR * Math.cos(angle);
    const edgeY = cy + edgeR * Math.sin(angle);
    const elbowX = cx + elbowR * Math.cos(angle);
    const elbowY = cy + elbowR * Math.sin(angle);
    const isRight = Math.cos(angle) >= 0;
    const extX = isRight ? elbowX + extendLen : elbowX - extendLen;

    return {
      x: isRight ? extX + 5 : extX - 5,
      y: elbowY,
      textAnchor: isRight ? 'start' : 'end',
      elbowX: extX,
      elbowY,
      edgeX,
      edgeY,
    };
  });

  const rightIdxs = positions.map((_, i) => i).filter(i => positions[i].textAnchor === 'start');
  const leftIdxs = positions.map((_, i) => i).filter(i => positions[i].textAnchor === 'end');

  for (const group of [rightIdxs, leftIdxs]) {
    const sorted = [...group].sort((a, b) => positions[a].y - positions[b].y);
    for (let i = 1; i < sorted.length; i++) {
      const prev = positions[sorted[i - 1]];
      const curr = positions[sorted[i]];
      if (curr.y - prev.y < labelGap) {
        const newY = prev.y + labelGap;
        curr.y = newY;
        curr.elbowY = newY;
      }
    }
  }

  return positions;
}

// ── Comparison Bar Chart (SVG) ──

interface MemberComparisonData {
  name: string;
  totalTasks: number;
  delayedTasks: number;
  actualDelayedTasks: number;
  completionRate: number; // percentage
  efficiencyRate: number; // percentage
}

function buildMemberComparison(allTasks: NormalizedTask[], teamMemberUsernames?: string[]): MemberComparisonData[] {
  const memberMap = new Map<string, { total: NormalizedTask[]; delayed: NormalizedTask[]; actualDelayed: NormalizedTask[] }>();

  // Pre-initialize team members so they appear even with 0 tasks
  if (teamMemberUsernames && teamMemberUsernames.length > 0) {
    for (const name of teamMemberUsernames) {
      memberMap.set(name, { total: [], delayed: [], actualDelayed: [] });
    }
  }

  for (const task of allTasks) {
    const names = task.assignees.length > 0
      ? task.assignees.map(a => a.username || 'Unknown')
      : ['Unassigned'];

    for (const name of names) {
      // If team filter is active, skip non-team members
      if (teamMemberUsernames && teamMemberUsernames.length > 0 && !teamMemberUsernames.includes(name)) {
        continue;
      }
      if (!memberMap.has(name)) memberMap.set(name, { total: [], delayed: [], actualDelayed: [] });
      const entry = memberMap.get(name)!;
      entry.total.push(task);
      if (isTaskDelayed(task)) entry.delayed.push(task);
      if (isTaskActuallyDelayed(task)) entry.actualDelayed.push(task);
    }
  }

  return Array.from(memberMap.entries())
    .map(([name, data]) => {
      const doneStatuses = ['complete', 'closed', 'done', 'resolved'];
      const completed = data.total.filter(t =>
        doneStatuses.includes(t.status.toLowerCase()) || t.statusType === 'closed'
      ).length;
      
      const total = data.total.length;
      const actualDel = data.actualDelayed.length;
      const efficiencyRate = total > 0 ? Math.round(((total - actualDel) / total) * 100) : 0;

      return {
        name,
        totalTasks: total,
        delayedTasks: data.delayed.length,
        actualDelayedTasks: actualDel,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        efficiencyRate,
      };
    })
    .sort((a, b) => b.totalTasks - a.totalTasks);
}

function ComparisonChart({
  data,
  highlightedMember,
  chartType,
}: {
  data: MemberComparisonData[];
  highlightedMember: string;
  chartType: 'total' | 'delayed';
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (data.length === 0) return null;

  const maxTotal = Math.max(...data.map(d => d.totalTasks), 1);
  const barHeight = 28;
  const rowGap = 6;
  const labelWidth = 140;
  const chartLeftPad = 16;
  const chartRightPad = 50;
  const topPad = 50;
  const bottomPad = 30;
  const chartAreaWidth = 340;
  const totalWidth = labelWidth + chartLeftPad + chartAreaWidth + chartRightPad;
  const totalHeight = topPad + data.length * (barHeight + rowGap) + bottomPad;

  // Grid lines
  const gridSteps = 5;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const val = Math.round((maxTotal / gridSteps) * i);
    const x = labelWidth + chartLeftPad + (val / maxTotal) * chartAreaWidth;
    return { val, x };
  });

  return (
    <div style={{ width: '100%', overflowX: 'hidden', overflowY: 'auto' }}>
      {/* Chart title */}
      <div style={{
        padding: '14px 16px 4px',
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase' as const,
        letterSpacing: '1px',
        color: 'var(--text-tertiary)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span>📊</span>
        Team Comparison
      </div>

      {/* Legend */}
      <div style={{
        padding: '4px 16px 8px',
        display: 'flex',
        gap: '16px',
        fontSize: '10px',
        color: 'var(--text-secondary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#4e79f6' }} />
          <span>Delayed Tasks</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#e15759' }} />
          <span>Total Tasks</span>
        </div>
      </div>

      <svg
        width="100%"
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        style={{ display: 'block' }}
      >
        {/* Grid lines */}
        {gridLines.map((g, i) => (
          <g key={`grid-${i}`}>
            <line
              x1={g.x} y1={topPad - 10}
              x2={g.x} y2={topPad + data.length * (barHeight + rowGap) - rowGap}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
              strokeDasharray={i === 0 ? undefined : '3 3'}
            />
            <text
              x={g.x}
              y={topPad - 16}
              textAnchor="middle"
              fill="var(--text-muted)"
              fontSize="9"
              fontFamily="var(--font-mono)"
            >
              {g.val}
            </text>
          </g>
        ))}

        {/* Bars */}
        {data.map((member, idx) => {
          const y = topPad + idx * (barHeight + rowGap);
          const isHighlighted = member.name === highlightedMember;
          const isHovered = hoveredIdx === idx;
          const totalBarW = Math.max((member.totalTasks / maxTotal) * chartAreaWidth, 2);
          const delayedBarW = Math.max((member.delayedTasks / maxTotal) * chartAreaWidth, member.delayedTasks > 0 ? 2 : 0);
          const barX = labelWidth + chartLeftPad;

          return (
            <g
              key={member.name}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: 'default' }}
            >
              {/* Highlight background for selected member */}
              {isHighlighted && (
                <rect
                  x={0}
                  y={y - 3}
                  width={totalWidth}
                  height={barHeight + 6}
                  rx={4}
                  fill="rgba(78, 121, 246, 0.08)"
                  stroke="rgba(78, 121, 246, 0.25)"
                  strokeWidth="1"
                />
              )}

              {/* Hover background */}
              {isHovered && !isHighlighted && (
                <rect
                  x={0}
                  y={y - 2}
                  width={totalWidth}
                  height={barHeight + 4}
                  rx={3}
                  fill="rgba(255,255,255,0.03)"
                />
              )}

              {/* Member name */}
              <text
                x={labelWidth - 6}
                y={y + barHeight / 2}
                textAnchor="end"
                dominantBaseline="middle"
                fill={isHighlighted ? '#4e79f6' : 'var(--text-secondary)'}
                fontSize="10.5"
                fontWeight={isHighlighted ? 700 : 500}
                fontFamily="var(--font-sans)"
              >
                {member.name.length > 20 ? member.name.slice(0, 19) + '…' : member.name}
              </text>

              {/* Total bar (background) */}
              <rect
                x={barX}
                y={y + 2}
                width={totalBarW}
                height={barHeight / 2 - 2}
                rx={3}
                fill={isHighlighted ? '#e15759' : 'rgba(225, 87, 89, 0.6)'}
                opacity={isHovered ? 1 : 0.85}
                style={{ transition: 'opacity 0.15s' }}
              />

              {/* Delayed bar */}
              {delayedBarW > 0 && (
                <rect
                  x={barX}
                  y={y + barHeight / 2 + 1}
                  width={delayedBarW}
                  height={barHeight / 2 - 3}
                  rx={3}
                  fill={isHighlighted ? '#4e79f6' : 'rgba(78, 121, 246, 0.6)'}
                  opacity={isHovered ? 1 : 0.85}
                  style={{ transition: 'opacity 0.15s' }}
                />
              )}

              {/* Total count label */}
              <text
                x={barX + totalBarW + 6}
                y={y + barHeight / 4 + 1}
                dominantBaseline="middle"
                fill={isHighlighted ? '#e15759' : 'var(--text-tertiary)'}
                fontSize="9"
                fontWeight={700}
                fontFamily="var(--font-mono)"
              >
                {member.totalTasks}
              </text>

              {/* Delayed count label */}
              {member.delayedTasks > 0 && (
                <text
                  x={barX + delayedBarW + 6}
                  y={y + barHeight * 3 / 4}
                  dominantBaseline="middle"
                  fill={isHighlighted ? '#4e79f6' : 'var(--text-muted)'}
                  fontSize="9"
                  fontWeight={600}
                  fontFamily="var(--font-mono)"
                >
                  {member.delayedTasks}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Summary stats for highlighted member */}
      {(() => {
        const m = data.find(d => d.name === highlightedMember);
        if (!m) return null;
        const rank = data.findIndex(d => d.name === highlightedMember) + 1;

        return (
          <div style={{
            margin: '8px 16px 16px',
            padding: '12px 14px',
            background: 'rgba(78, 121, 246, 0.06)',
            border: '1px solid rgba(78, 121, 246, 0.15)',
            borderRadius: '10px',
          }}>
            <div style={{
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.8px',
              color: '#4e79f6',
              marginBottom: '10px',
            }}>
              {highlightedMember}'s Stats
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[
                { label: 'Rank', value: `#${rank} of ${data.length}`, color: 'var(--text-primary)' },
                { label: 'Completion', value: `${m.completionRate}%`, color: m.completionRate >= 70 ? '#3fb950' : m.completionRate >= 40 ? '#d29922' : '#f85149' },
                { label: 'Efficiency %', value: `${m.efficiencyRate}%`, color: m.efficiencyRate >= 80 ? '#3fb950' : m.efficiencyRate >= 50 ? '#d29922' : '#f85149' },
                { label: 'Actual Delayed', value: `${m.actualDelayedTasks}`, color: m.actualDelayedTasks === 0 ? '#3fb950' : '#f85149' },
              ].map(stat => (
                <div key={stat.label} style={{
                  padding: '6px 8px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '6px',
                }}>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: '2px' }}>
                    {stat.label}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: stat.color, fontFamily: 'var(--font-mono)' }}>
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}


// ── Member Task List Panel (inline styles) ──

function MemberTaskPanel({
  memberName,
  memberColor,
  tasks,
  onClose,
  chartType,
  allFilteredTasks,
}: {
  memberName: string;
  memberColor: string;
  tasks: NormalizedTask[];
  onClose: () => void;
  chartType: 'total' | 'delayed';
  allFilteredTasks: NormalizedTask[];
}) {
  const openTaskDetail = useTaskStore(s => s.openTaskDetail);
  const resolvedTeamMembers = useTaskStore(s => s.resolvedTeamMembers);
  const grouped = useMemo(() => groupTasksByStatus(tasks), [tasks]);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Only show team members in comparison chart
  const teamUsernames = useMemo(() => resolvedTeamMembers.map(m => m.username), [resolvedTeamMembers]);
  const comparisonData = useMemo(() => buildMemberComparison(allFilteredTasks, teamUsernames), [allFilteredTasks, teamUsernames]);

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.55)',
          zIndex: 800,
          animation: 'detail-fade-in 0.2s ease',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '1100px',
          maxWidth: '96vw',
          height: '100vh',
          background: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border-primary)',
          zIndex: 850,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-12px 0 48px rgba(0, 0, 0, 0.5)',
          animation: 'detail-slide-in 0.25s ease',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 20px 14px',
            borderBottom: '1px solid var(--border-primary)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: memberColor,
                flexShrink: 0,
                boxShadow: '0 0 8px rgba(255,255,255,0.15)',
              }}
            />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {memberName}
            </h3>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                background: 'var(--bg-tertiary)',
                padding: '3px 10px',
                borderRadius: '12px',
                border: '1px solid var(--border-secondary)',
                whiteSpace: 'nowrap',
              }}
            >
              {tasks.length} {chartType === 'delayed' ? 'delayed' : ''} task{tasks.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              border: '1px solid var(--border-secondary)',
              background: 'transparent',
              color: 'var(--text-tertiary)',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Two-column body: Left = Comparison, Right = Task List */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left: Comparison Chart */}
          <div
            style={{
              width: '480px',
              minWidth: '380px',
              borderRight: '1px solid var(--border-primary)',
              overflowY: 'auto',
              background: 'rgba(0,0,0,0.1)',
            }}
          >
            <ComparisonChart
              data={comparisonData}
              highlightedMember={memberName}
              chartType={chartType}
            />
          </div>

          {/* Right: Task list grouped by status */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {STATUS_GROUPS.map(group => {
              const groupTasks = grouped.get(group.key) || [];
              if (groupTasks.length === 0) return null;
              const collapsed = collapsedSections.has(group.key);

              return (
                <div key={group.key} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                  {/* Section header */}
                  <div
                    onClick={() => toggleSection(group.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 20px',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span
                      style={{
                        fontSize: '8px',
                        color: 'var(--text-muted)',
                        transition: 'transform 0.2s',
                        transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)',
                        width: '14px',
                        textAlign: 'center',
                      }}
                    >
                      ▼
                    </span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '3px 10px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#fff',
                        letterSpacing: '0.5px',
                        background: group.color,
                      }}
                    >
                      {group.icon} {group.label}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary)', marginLeft: '4px' }}>
                      {groupTasks.length}
                    </span>
                  </div>

                  {/* Task rows */}
                  {!collapsed && (
                    <div>
                      {/* Column header */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 80px 90px 90px',
                          gap: '8px',
                          padding: '6px 20px 6px 44px',
                          fontSize: '10px',
                          fontWeight: 600,
                          textTransform: 'uppercase' as const,
                          letterSpacing: '0.8px',
                          color: 'var(--text-muted)',
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                        }}
                      >
                        <span>Name</span>
                        <span style={{ textAlign: 'center' }}>Assignee</span>
                        <span style={{ textAlign: 'center' }}>Start date</span>
                        <span style={{ textAlign: 'center' }}>Due date</span>
                      </div>

                      {groupTasks.map(task => {
                        const overdue = task.endDate && task.endDate < new Date() &&
                          !['complete', 'closed', 'done'].includes(task.status.toLowerCase()) &&
                          task.statusType !== 'closed';

                        return (
                          <div
                            key={task.id}
                            onClick={() => openTaskDetail(task)}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 80px 90px 90px',
                              gap: '8px',
                              alignItems: 'center',
                              padding: '9px 20px 9px 44px',
                              fontSize: '12px',
                              borderBottom: '1px solid rgba(255,255,255,0.04)',
                              cursor: 'pointer',
                              transition: 'background 0.15s',
                              background: overdue ? 'rgba(248, 81, 73, 0.04)' : 'transparent',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = overdue ? 'rgba(248, 81, 73, 0.08)' : 'rgba(88, 166, 255, 0.06)')}
                            onMouseLeave={e => (e.currentTarget.style.background = overdue ? 'rgba(248, 81, 73, 0.04)' : 'transparent')}
                          >
                            {/* Task Name */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                              <span
                                style={{
                                  width: '7px',
                                  height: '7px',
                                  borderRadius: '50%',
                                  flexShrink: 0,
                                  background: task.statusColor || group.color,
                                }}
                              />
                              <span
                                style={{
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '12px',
                                  color: 'var(--text-primary)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {task.name}
                              </span>
                            </div>

                            {/* Assignee avatars */}
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                              {task.assignees.slice(0, 2).map((a, ai) => (
                                <div
                                  key={ai}
                                  title={a.username}
                                  style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    background: 'var(--bg-tertiary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '8px',
                                    fontWeight: 700,
                                    color: 'var(--text-secondary)',
                                    border: '2px solid var(--bg-secondary)',
                                    overflow: 'hidden',
                                    flexShrink: 0,
                                    marginLeft: ai > 0 ? '-6px' : 0,
                                  }}
                                >
                                  {a.profilePicture ? (
                                    <img src={a.profilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    a.initials
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Start date */}
                            <span
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '11px',
                                color: 'var(--text-tertiary)',
                                textAlign: 'center',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {formatDate(task.startDate)}
                            </span>

                            {/* Due date */}
                            <span
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '11px',
                                color: overdue ? '#f85149' : 'var(--text-tertiary)',
                                fontWeight: overdue ? 600 : 400,
                                textAlign: 'center',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {formatDate(task.endDate)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* "Other" status bucket */}
            {(() => {
              const otherTasks = grouped.get('other') || [];
              if (otherTasks.length === 0) return null;
              const collapsed = collapsedSections.has('other');
              return (
                <div style={{ borderBottom: '1px solid var(--border-primary)' }}>
                  <div
                    onClick={() => toggleSection('other')}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 20px', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ fontSize: '8px', color: 'var(--text-muted)', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)', width: '14px', textAlign: 'center' }}>▼</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, color: '#fff', background: '#6e7681' }}>○ OTHER</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary)' }}>{otherTasks.length}</span>
                  </div>
                  {!collapsed && (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 90px', gap: '8px', padding: '6px 20px 6px 44px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.8px', color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <span>Name</span>
                        <span style={{ textAlign: 'center' }}>Assignee</span>
                        <span style={{ textAlign: 'center' }}>Start date</span>
                        <span style={{ textAlign: 'center' }}>Due date</span>
                      </div>
                      {otherTasks.map(task => (
                        <div
                          key={task.id}
                          onClick={() => openTaskDetail(task)}
                          style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 90px', gap: '8px', alignItems: 'center', padding: '9px 20px 9px 44px', fontSize: '12px', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88, 166, 255, 0.06)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                            <span style={{ width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0, background: task.statusColor }} />
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.name}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            {task.assignees.slice(0, 2).map((a, ai) => (
                              <div key={ai} title={a.username} style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700, color: 'var(--text-secondary)', border: '2px solid var(--bg-secondary)', overflow: 'hidden', marginLeft: ai > 0 ? '-6px' : 0 }}>
                                {a.profilePicture ? <img src={a.profilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : a.initials}
                              </div>
                            ))}
                          </div>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)', textAlign: 'center' }}>{formatDate(task.startDate)}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)', textAlign: 'center' }}>{formatDate(task.endDate)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </>
  );
}

// ── SVG Pie Chart with Leader Lines ──

function PieChart({
  slices,
  title,
  totalCount,
  filteredTasks,
  chartType,
  allFilteredTasks,
  taskFilterFn,
}: {
  slices: SliceData[];
  title: string;
  totalCount: number;
  filteredTasks: NormalizedTask[];
  chartType: 'total' | 'delayed';
  allFilteredTasks: NormalizedTask[];
  taskFilterFn?: (tasks: NormalizedTask[], sliceLabel: string) => NormalizedTask[];
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedMember, setSelectedMember] = useState<{ name: string; color: string } | null>(null);

  const svgW = 800;
  const svgH = 450;
  const cx = svgW / 2;
  const cy = svgH / 2 + 5;
  const radius = 140;

  const paths = useMemo(() => {
    if (slices.length === 0) return [];
    const result: { d: string; color: string; midAngle: number; percentage: number }[] = [];
    let currentAngle = -Math.PI / 2;

    for (let i = 0; i < slices.length; i++) {
      const slice = slices[i];
      const sliceAngle = (slice.percentage / 100) * 2 * Math.PI;

      if (slices.length === 1) {
        result.push({ d: '', color: slice.color, midAngle: -Math.PI / 2, percentage: slice.percentage });
        break;
      }

      const startAngle = currentAngle;
      const endAngle = currentAngle + sliceAngle;
      const midAngle = startAngle + sliceAngle / 2;
      const x1 = cx + radius * Math.cos(startAngle);
      const y1 = cy + radius * Math.sin(startAngle);
      const x2 = cx + radius * Math.cos(endAngle);
      const y2 = cy + radius * Math.sin(endAngle);
      const largeArc = sliceAngle > Math.PI ? 1 : 0;

      result.push({
        d: `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`,
        color: slice.color,
        midAngle,
        percentage: slice.percentage,
      });
      currentAngle = endAngle;
    }
    return result;
  }, [slices, cx, cy, radius]);

  const labelPositions = useMemo(() => {
    if (paths.length === 0) return [];
    return resolveLabels(
      paths.map(p => ({ midAngle: p.midAngle, percentage: p.percentage })),
      cx, cy, radius,
    );
  }, [paths, cx, cy, radius]);

  // Get tasks for the selected slice
  const selectedMemberTasks = useMemo(() => {
    if (!selectedMember) return [];
    if (taskFilterFn) {
      return taskFilterFn(filteredTasks, selectedMember.name);
    }
    return filteredTasks.filter(t =>
      t.assignees.some(a => a.username === selectedMember.name) ||
      (selectedMember.name === 'Unassigned' && t.assignees.length === 0)
    );
  }, [selectedMember, filteredTasks, taskFilterFn]);

  const handleSliceClick = (i: number) => {
    const slice = slices[i];
    if (slice) {
      setSelectedMember({ name: slice.label, color: slice.color });
    }
  };

  if (slices.length === 0) {
    return (
      <div className="pie-chart-card">
        <h3 className="pie-chart-title">{title}</h3>
        <div className="pie-chart-empty">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border-secondary)" strokeWidth="2" strokeDasharray="8 4" />
          </svg>
          <span>No data available</span>
        </div>
      </div>
    );
  }

  return (
    <div className="pie-chart-card">
      <h3 className="pie-chart-title">
        {title}
        <span className="pie-chart-count">{totalCount}</span>
      </h3>
      <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} className="pie-chart-svg" style={{ overflow: 'visible' }}>
        {/* Pie slices */}
        {slices.length === 1 ? (
          <circle
            cx={cx} cy={cy} r={radius}
            fill={paths[0]?.color}
            opacity={hoveredIndex === 0 ? 0.85 : 1}
            style={{ transition: 'opacity 0.2s', cursor: 'pointer' }}
            onMouseEnter={() => setHoveredIndex(0)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={() => handleSliceClick(0)}
          />
        ) : (
          paths.map((p, i) => {
            const isHovered = hoveredIndex === i;
            const offset = isHovered ? 8 : 0;
            const ox = offset * Math.cos(p.midAngle);
            const oy = offset * Math.sin(p.midAngle);

            return (
              <path
                key={i}
                d={p.d}
                fill={p.color}
                stroke="var(--bg-primary)"
                strokeWidth="2"
                transform={`translate(${ox}, ${oy})`}
                opacity={hoveredIndex !== null && !isHovered ? 0.5 : 1}
                style={{ transition: 'all 0.25s ease', cursor: 'pointer' }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => handleSliceClick(i)}
              />
            );
          })
        )}

        {/* Leader lines + labels */}
        {paths.map((p, i) => {
          if (p.percentage < 0.3) return null;
          const lp = labelPositions[i];
          if (!lp) return null;
          const isHovered = hoveredIndex === i;
          const dimmed = hoveredIndex !== null && !isHovered;

          return (
            <g
              key={`label-${i}`}
              opacity={dimmed ? 0.3 : 1}
              style={{ transition: 'opacity 0.25s', cursor: 'pointer' }}
              onClick={() => handleSliceClick(i)}
            >
              <polyline
                points={`${lp.edgeX},${lp.edgeY} ${lp.elbowX},${lp.elbowY}`}
                fill="none" stroke={p.color} strokeWidth="1.5" strokeLinecap="round"
              />
              <circle cx={lp.edgeX} cy={lp.edgeY} r="3" fill={p.color} />
              <text
                x={lp.x} y={lp.y}
                textAnchor={lp.textAnchor}
                dominantBaseline="middle"
                fill="var(--text-primary)"
                fontSize="11" fontFamily="var(--font-sans)"
                fontWeight={isHovered ? '700' : '500'}
              >
                {slices[i].label}{' '}
                <tspan fill="var(--text-secondary)" fontWeight="700">{slices[i].percentage}%</tspan>
              </text>
            </g>
          );
        })}

        {/* Center tooltip on hover */}
        {hoveredIndex !== null && slices[hoveredIndex] && (
          <g>
            <circle cx={cx} cy={cy} r="45" fill="rgba(0,0,0,0.7)" />
            <text x={cx} y={cy - 8} textAnchor="middle" dominantBaseline="middle"
              fill="#fff" fontSize="13" fontWeight="700" fontFamily="var(--font-sans)">
              {slices[hoveredIndex].value} tasks
            </text>
            <text x={cx} y={cy + 12} textAnchor="middle" dominantBaseline="middle"
              fill="var(--text-secondary)" fontSize="11" fontFamily="var(--font-sans)">
              {slices[hoveredIndex].percentage}%
            </text>
          </g>
        )}
      </svg>

      {/* Member task list panel */}
      {selectedMember && (
        <MemberTaskPanel
          memberName={selectedMember.name}
          memberColor={selectedMember.color}
          tasks={selectedMemberTasks}
          onClose={() => setSelectedMember(null)}
          chartType={chartType}
          allFilteredTasks={allFilteredTasks}
        />
      )}
    </div>
  );
}

// ── Main Component ──

export default function PieChartView() {
  const { allTeamTasks, allTeamNoDateTasks } = useTaskStore();

  const [duration, setDuration] = useState<DurationFilter>('all');
  const [folderFilter, setFolderFilter] = useState<string>('all');
  const [memberFilter, setMemberFilter] = useState<Set<string>>(new Set());
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const memberDropdownRef = useRef<HTMLDivElement>(null);

  // Close member dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (memberDropdownRef.current && !memberDropdownRef.current.contains(e.target as Node)) {
        setShowMemberDropdown(false);
      }
    };
    if (showMemberDropdown) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMemberDropdown]);

  const toggleMember = (name: string) => {
    setMemberFilter(prev => {
      const n = new Set(prev);
      n.has(name) ? n.delete(name) : n.add(name);
      return n;
    });
  };

  const allTasks = useMemo(() => [...allTeamTasks, ...allTeamNoDateTasks], [allTeamTasks, allTeamNoDateTasks]);

  const folders = useMemo(() => {
    const set = new Set<string>();
    allTasks.forEach(t => set.add(t.folder.name));
    return Array.from(set).sort();
  }, [allTasks]);

  const memberNames = useMemo(() => {
    const set = new Set<string>();
    allTasks.forEach(t => t.assignees.forEach(a => set.add(a.username)));
    return Array.from(set).sort();
  }, [allTasks]);

  const filteredTasks = useMemo(() => {
    let result = allTasks;
    const cutoff = getDurationCutoff(duration);
    if (cutoff) {
      const now = new Date();
      result = result.filter(t => t.dateCompleted && t.dateCompleted >= cutoff && t.dateCompleted <= now);
    }
    if (folderFilter !== 'all') {
      result = result.filter(t => t.folder.name === folderFilter);
    }
    if (memberFilter.size > 0) {
      result = result.filter(t => t.assignees.some(a => memberFilter.has(a.username)));
    }
    return result;
  }, [allTasks, duration, folderFilter, memberFilter]);

  const totalSlices = useMemo(() => buildSlices(groupTasksByAssignee(filteredTasks)), [filteredTasks]);
  const delayedTasks = useMemo(() => filteredTasks.filter(isTaskDelayed), [filteredTasks]);
  const delayedSlices = useMemo(() => buildSlices(groupTasksByAssignee(delayedTasks)), [delayedTasks]);

  const actualDelayedTasks = useMemo(() => filteredTasks.filter(isTaskActuallyDelayed), [filteredTasks]);
  const actualDelayedSlices = useMemo(() => buildSlices(groupTasksByAssignee(actualDelayedTasks)), [actualDelayedTasks]);

  // Separate filtered list for status chart — uses due date instead of completion date
  const statusFilteredTasks = useMemo(() => {
    let result = allTasks;
    const cutoff = getDurationCutoff(duration);
    if (cutoff) {
      result = result.filter(t => t.endDate && t.endDate >= cutoff);
    }
    if (folderFilter !== 'all') {
      result = result.filter(t => t.folder.name === folderFilter);
    }
    if (memberFilter.size > 0) {
      result = result.filter(t => t.assignees.some(a => memberFilter.has(a.username)));
    }
    return result;
  }, [allTasks, duration, folderFilter, memberFilter]);

  // Status distribution slices — 4 categories
  const statusSlices = useMemo(() => {
    const STATUS_CATEGORIES: { label: string; color: string }[] = [
      { label: 'Completed', color: '#3fb950' },
      { label: 'In Progress', color: '#d29922' },
      { label: 'To Do', color: '#58a6ff' },
      { label: 'Overdue', color: '#f85149' },
    ];

    const counts = new Map<string, number>();
    for (const cat of STATUS_CATEGORIES) counts.set(cat.label, 0);

    const now = new Date();
    for (const task of statusFilteredTasks) {
      const s = task.status.toLowerCase();
      const isDone = ['complete', 'done', 'resolved', 'closed'].some(k => s.includes(k)) || task.statusType === 'closed';
      const isInProgress = ['in progress', 'doing', 'working', 'active', 'review', 'in review'].some(k => s.includes(k));
      const isOverdue = !isDone && task.endDate && task.endDate < now;

      if (isOverdue) {
        counts.set('Overdue', (counts.get('Overdue') || 0) + 1);
      } else if (isDone) {
        counts.set('Completed', (counts.get('Completed') || 0) + 1);
      } else if (isInProgress) {
        counts.set('In Progress', (counts.get('In Progress') || 0) + 1);
      } else {
        counts.set('To Do', (counts.get('To Do') || 0) + 1);
      }
    }

    // Remove zero-count entries
    for (const [key, val] of counts) {
      if (val === 0) counts.delete(key);
    }
    const total = Array.from(counts.values()).reduce((s, v) => s + v, 0);
    if (total === 0) return [];

    const slices: SliceData[] = [];
    for (const [label, value] of counts) {
      const cat = STATUS_CATEGORIES.find(c => c.label === label);
      slices.push({
        label,
        value,
        percentage: parseFloat(((value / total) * 100).toFixed(2)),
        color: cat ? cat.color : '#6e7681',
      });
    }
    return slices.sort((a, b) => b.value - a.value);
  }, [statusFilteredTasks]);

  const DURATION_OPTIONS: { value: DurationFilter; label: string }[] = [
    { value: 'all', label: 'All Time' },
    { value: 'week', label: 'Last Week' },
    { value: 'month', label: 'Last Month' },
    { value: 'quarter', label: 'Last Quarter' },
  ];

  return (
    <div className="pie-view-container">
      {/* Filter Bar */}
      <div className="pie-filter-bar">
        <div className="pie-filter-group">
          <label className="pie-filter-label">Duration</label>
          <select className="pie-filter-select" value={duration}
            onChange={e => setDuration(e.target.value as DurationFilter)}>
            {DURATION_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="pie-filter-group">
          <label className="pie-filter-label">Project</label>
          <select className="pie-filter-select" value={folderFilter}
            onChange={e => setFolderFilter(e.target.value)}>
            <option value="all">All Projects</option>
            {folders.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        <div className="pie-filter-group" ref={memberDropdownRef} style={{ position: 'relative' }}>
          <label className="pie-filter-label">Member</label>
          <div
            onClick={() => setShowMemberDropdown(!showMemberDropdown)}
            style={{
              background: 'var(--bg-primary)',
              border: memberFilter.size > 0 ? '1px solid var(--status-todo)' : '1px solid var(--border-secondary)',
              color: memberFilter.size > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
              padding: '7px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              transition: 'border-color 0.2s',
            }}
          >
            {memberFilter.size === 0
              ? 'All Members'
              : `${memberFilter.size} selected`}
            {memberFilter.size > 0 && (
              <span style={{
                background: 'var(--status-todo)',
                color: '#fff',
                fontSize: '9px',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '8px',
                minWidth: '16px',
                textAlign: 'center',
              }}>
                {memberFilter.size}
              </span>
            )}
          </div>

          {/* Multi-select dropdown */}
          {showMemberDropdown && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '4px',
                width: '240px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-secondary)',
                borderRadius: '10px',
                boxShadow: '0 12px 36px rgba(0,0,0,0.5)',
                zIndex: 9999,
                overflow: 'hidden',
                animation: 'fadeIn 0.15s ease',
              }}
            >
              {/* Header */}
              <div style={{
                padding: '8px 12px',
                borderBottom: '1px solid var(--border-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-tertiary)' }}>
                  Filter by Member
                </span>
                {memberFilter.size > 0 && (
                  <span
                    onClick={(e) => { e.stopPropagation(); setMemberFilter(new Set()); }}
                    style={{ fontSize: '10px', color: 'var(--status-todo)', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Clear All
                  </span>
                )}
              </div>

              {/* Member list */}
              <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '4px 0' }}>
                {memberNames.map(name => {
                  const checked = memberFilter.has(name);
                  return (
                    <div
                      key={name}
                      onClick={() => toggleMember(name)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '7px 12px',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                        background: checked ? 'rgba(88, 166, 255, 0.06)' : 'transparent',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = checked ? 'rgba(88, 166, 255, 0.1)' : 'rgba(255,255,255,0.03)')}
                      onMouseLeave={e => (e.currentTarget.style.background = checked ? 'rgba(88, 166, 255, 0.06)' : 'transparent')}
                    >
                      {/* Checkbox */}
                      <div style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '4px',
                        border: checked ? '1px solid var(--status-todo)' : '1px solid var(--border-secondary)',
                        background: checked ? 'var(--status-todo)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        color: '#fff',
                        flexShrink: 0,
                        transition: 'all 0.15s',
                      }}>
                        {checked && '✓'}
                      </div>
                      <span style={{
                        fontSize: '12px',
                        color: checked ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontWeight: checked ? 600 : 400,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="pie-filter-summary">
          <span className="pie-filter-badge">{filteredTasks.length} tasks</span>
          <span className="pie-filter-badge pie-filter-badge-delayed">{delayedTasks.length} delayed</span>
          <span className="pie-filter-badge pie-filter-badge-delayed" style={{ marginLeft: '8px' }}>{actualDelayedTasks.length} actual delayed</span>
        </div>
      </div>

      {/* Pie Charts Grid (2x2) */}
      <div className="pie-charts-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <PieChart
          slices={totalSlices}
          title="Total Tasks"
          totalCount={filteredTasks.length}
          filteredTasks={filteredTasks}
          chartType="total"
          allFilteredTasks={filteredTasks}
        />
        <PieChart
          slices={delayedSlices}
          title="Delayed Tasks"
          totalCount={delayedTasks.length}
          filteredTasks={delayedTasks}
          chartType="delayed"
          allFilteredTasks={filteredTasks}
        />
        <PieChart
          slices={actualDelayedSlices}
          title="Actual Delayed"
          totalCount={actualDelayedTasks.length}
          filteredTasks={actualDelayedTasks}
          chartType="delayed"
          allFilteredTasks={filteredTasks}
        />
        <PieChart
          slices={statusSlices}
          title="Status Distribution"
          totalCount={statusFilteredTasks.length}
          filteredTasks={statusFilteredTasks}
          chartType="total"
          allFilteredTasks={statusFilteredTasks}
          taskFilterFn={(tasks, sliceLabel) => {
            const now = new Date();
            return tasks.filter(t => {
              const s = t.status.toLowerCase();
              const isDone = ['complete', 'done', 'resolved', 'closed'].some(k => s.includes(k)) || t.statusType === 'closed';
              const isInProgress = ['in progress', 'doing', 'working', 'active', 'review', 'in review'].some(k => s.includes(k));
              const isOverdue = !isDone && t.endDate && t.endDate < now;

              switch (sliceLabel) {
                case 'Overdue': return !!isOverdue;
                case 'Completed': return isDone && !isOverdue;
                case 'In Progress': return isInProgress && !isDone && !isOverdue;
                case 'To Do': return !isDone && !isInProgress && !isOverdue;
                default: return false;
              }
            });
          }}
        />
      </div>
    </div>
  );
}
