'use client';

import { useState } from 'react';
import { useTaskStore } from '../store/useTaskStore';

function getStatusColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('complete') || s.includes('done')) return 'var(--status-complete)';
  if (s.includes('progress')) return 'var(--status-inprogress)';
  if (s.includes('review')) return 'var(--status-review)';
  if (s.includes('closed')) return 'var(--status-closed)';
  return 'var(--status-todo)';
}

export default function NoDateTasks() {
  const { noDateTasks } = useTaskStore();
  const [expanded, setExpanded] = useState(true);

  if (noDateTasks.length === 0) return null;

  return (
    <div className="no-date-section">
      <div className="no-date-header" onClick={() => setExpanded(!expanded)}>
        <span>{expanded ? '▾' : '▸'}</span>
        📌 Tasks Without Dates ({noDateTasks.length})
      </div>
      {expanded && (
        <div className="no-date-list">
          {noDateTasks.map(t => (
            <div key={t.id} className="no-date-chip">
              <span className="status-badge" style={{ background: getStatusColor(t.status) }} />
              {t.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
