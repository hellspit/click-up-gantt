'use client';

import { useMemo, useState } from 'react';
import { useTaskStore } from '../store/useTaskStore';
import { NormalizedTask } from '../types';

interface StatusCategory {
  key: string;
  label: string;
  color: string;
  tasks: NormalizedTask[];
}

function categorizeStatus(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('complete') || s.includes('done') || s.includes('resolved')) return 'complete';
  if (s.includes('progress') || s.includes('active')) return 'in_progress';
  if (s.includes('review') || s.includes('test')) return 'review';
  if (s.includes('closed') || s.includes('archived')) return 'closed';
  return 'todo';
}

const STATUS_META: Record<string, { label: string; color: string; order: number }> = {
  complete:    { label: 'Completed',   color: '#3fb950', order: 0 },
  in_progress: { label: 'In Progress', color: '#5A43D6', order: 1 },
  review:      { label: 'In Review',   color: '#bc8cff', order: 2 },
  todo:        { label: 'To Do',       color: '#58a6ff', order: 3 },
  closed:      { label: 'Closed',      color: '#6e7681', order: 4 },
  overdue:     { label: 'Overdue',     color: '#f85149', order: 5 },
};

function useStatusData() {
  const tasks = useTaskStore(s => s.tasks);
  const noDateTasks = useTaskStore(s => s.noDateTasks);

  return useMemo(() => {
    const allTasks = [...tasks, ...noDateTasks];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const buckets: Record<string, NormalizedTask[]> = {
      complete: [],
      in_progress: [],
      review: [],
      todo: [],
      closed: [],
      overdue: [],
    };

    for (const t of allTasks) {
      const cat = categorizeStatus(t.status);
      // Check overdue: has end date in the past and not complete/closed
      if (
        t.endDate &&
        t.endDate < today &&
        cat !== 'complete' &&
        cat !== 'closed'
      ) {
        buckets.overdue.push(t);
      } else {
        buckets[cat].push(t);
      }
    }

    const categories: StatusCategory[] = Object.entries(buckets)
      .map(([key, tasks]) => ({
        key,
        label: STATUS_META[key].label,
        color: STATUS_META[key].color,
        tasks,
      }))
      .sort((a, b) => STATUS_META[a.key].order - STATUS_META[b.key].order);

    return { categories, total: allTasks.length };
  }, [tasks, noDateTasks]);
}

/* ── Donut Chart (pure SVG) ── */
function DonutChart({ categories, total }: { categories: StatusCategory[]; total: number }) {
  const radius = 80;
  const stroke = 24;
  const circumference = 2 * Math.PI * radius;
  const size = (radius + stroke) * 2;

  let accumulated = 0;
  const nonEmpty = categories.filter(c => c.tasks.length > 0);

  return (
    <div className="donut-container">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* background ring */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke}
        />
        {nonEmpty.map(cat => {
          const fraction = cat.tasks.length / total;
          const dashLen = fraction * circumference;
          const offset = -(accumulated * circumference);
          accumulated += fraction;

          return (
            <circle
              key={cat.key}
              cx={size / 2} cy={size / 2} r={radius}
              fill="none"
              stroke={cat.color}
              strokeWidth={stroke}
              strokeDasharray={`${dashLen} ${circumference - dashLen}`}
              strokeDashoffset={offset}
              strokeLinecap="butt"
              style={{
                transform: 'rotate(-90deg)',
                transformOrigin: '50% 50%',
                transition: 'stroke-dasharray 0.6s ease, stroke-dashoffset 0.6s ease',
              }}
            />
          );
        })}
        {/* center text */}
        <text x="50%" y="46%" textAnchor="middle" fill="#e6edf3" fontSize="28" fontWeight="700" fontFamily="var(--font-sans)">
          {total}
        </text>
        <text x="50%" y="60%" textAnchor="middle" fill="#8b949e" fontSize="11" fontFamily="var(--font-sans)">
          total tasks
        </text>
      </svg>

      {/* legend beside donut */}
      <div className="donut-legend">
        {categories.map(cat => (
          <div key={cat.key} className="donut-legend-row">
            <span className="donut-legend-dot" style={{ background: cat.color }} />
            <span className="donut-legend-label">{cat.label}</span>
            <span className="donut-legend-count">{cat.tasks.length}</span>
            <span className="donut-legend-pct">
              {total > 0 ? Math.round((cat.tasks.length / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Stat Card ── */
function StatCard({ label, count, color, total, active, onClick }: { label: string; count: number; color: string; total: number; active: boolean; onClick: () => void }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div
      className={`stat-card ${active ? 'stat-card-active' : ''}`}
      style={active ? { borderColor: color, boxShadow: `0 0 0 1px ${color}40` } : undefined}
      onClick={onClick}
    >
      <div className="stat-card-bar" style={{ background: color, width: `${Math.max(pct, 4)}%` }} />
      <div className="stat-card-count" style={{ color }}>{count}</div>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-pct">{pct}%</div>
    </div>
  );
}

/* ── Collapsible status section ── */
function StatusSection({ category }: { category: StatusCategory }) {
  const [open, setOpen] = useState(true);
  const openTaskDetail = useTaskStore(s => s.openTaskDetail);

  return (
    <div className="status-section">
      <div className="status-section-header" onClick={() => setOpen(!open)}>
        <span className={`status-section-toggle ${open ? '' : 'collapsed'}`}>▾</span>
        <span className="status-section-dot" style={{ background: category.color }} />
        <span className="status-section-title">{category.label}</span>
        <span className="status-section-count">{category.tasks.length}</span>
      </div>
      {open && (
        <div className="status-section-body">
          {category.tasks.length === 0 ? (
            <div className="status-section-empty">No tasks</div>
          ) : (
            category.tasks.map(t => (
              <div key={t.id} className="status-task-row status-task-row-clickable" onClick={() => openTaskDetail(t)}>
                <span className="status-task-name">{t.name}</span>
                <span className="status-task-meta">
                  {t.assignees[0]?.username || '—'}
                </span>
                <span className="status-task-meta">
                  {t.endDate ? t.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date'}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main StatusView ── */
export default function StatusView() {
  const { categories, total } = useStatusData();
  const selectedUserName = useTaskStore(s => s.selectedUserName);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const handleCardClick = (key: string) => {
    setActiveFilter(prev => (prev === key ? null : key));
  };

  const filteredCategories = activeFilter
    ? categories.filter(c => c.key === activeFilter)
    : categories.filter(c => c.tasks.length > 0);

  if (!selectedUserName || total === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">Status</div>
        <div className="empty-state-text">No tasks to analyze</div>
        <div className="empty-state-sub">Select an assignee and click Generate first</div>
      </div>
    );
  }

  return (
    <div className="status-view">
      {/* Stat cards */}
      <div className="stats-cards">
        {categories.map(cat => (
          <StatCard
            key={cat.key}
            label={cat.label}
            count={cat.tasks.length}
            color={cat.color}
            total={total}
            active={activeFilter === cat.key}
            onClick={() => handleCardClick(cat.key)}
          />
        ))}
      </div>

      {/* Active filter indicator */}
      {activeFilter && (
        <div className="status-filter-bar">
          Showing only: <strong>{STATUS_META[activeFilter].label}</strong> ({filteredCategories[0]?.tasks.length ?? 0} tasks)
          <button className="status-filter-clear" onClick={() => setActiveFilter(null)}>✕ Clear filter</button>
        </div>
      )}

      {/* Donut + breakdown */}
      <div className="status-body">
        <DonutChart categories={categories} total={total} />
      </div>

      {/* Per-status task lists */}
      <div className="status-lists">
        {filteredCategories.map(cat => (
          <StatusSection key={cat.key} category={cat} />
        ))}
      </div>
    </div>
  );
}
