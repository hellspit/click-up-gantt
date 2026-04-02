'use client';

import { useTaskStore } from '../store/useTaskStore';

const LEGEND = [
  { label: 'done', color: 'var(--status-complete)' },
  { label: 'open/to do', color: 'var(--status-todo)' },
  { label: 'in progress', color: 'var(--status-inprogress)' },
  { label: 'review', color: 'var(--status-review)' },
  { label: 'closed', color: 'var(--status-closed)' },
  { label: 'today', color: 'var(--today-red)' },
  { label: 'planned dates', color: '#555' },
];

export default function SummaryBar() {
  const { selectedUserName, tasks } = useTaskStore();

  if (!selectedUserName) return null;

  return (
    <div className="summary-bar">
      <span className="summary-text">
        <strong>{selectedUserName.toUpperCase()}</strong> · {tasks.length} tasks on timeline
      </span>
      <div className="legend">
        {LEGEND.map(l => (
          <span key={l.label} className="legend-item">
            <span className="legend-dot" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
