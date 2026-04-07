'use client';

import { useMemo, useState } from 'react';
import { useTaskStore } from '../store/useTaskStore';
import { NormalizedTask } from '../types';

type SortKey = 'name' | 'status' | 'assignee' | 'startDate' | 'endDate' | 'space';
type SortDir = 'asc' | 'desc';

function getStatusColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('complete') || s.includes('done') || s.includes('resolved')) return '#3fb950';
  if (s.includes('progress') || s.includes('active')) return '#d29922';
  if (s.includes('review') || s.includes('test')) return '#bc8cff';
  if (s.includes('closed') || s.includes('archived')) return '#6e7681';
  return '#58a6ff';
}

function formatDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getSortValue(task: NormalizedTask, key: SortKey): string | number {
  switch (key) {
    case 'name': return task.name.toLowerCase();
    case 'status': return task.status.toLowerCase();
    case 'assignee': return (task.assignees[0]?.username || '').toLowerCase();
    case 'startDate': return task.startDate?.getTime() ?? Infinity;
    case 'endDate': return task.endDate?.getTime() ?? Infinity;
    case 'space': return `${task.space.name} ${task.list.name}`.toLowerCase();
  }
}

const COLUMNS: { key: SortKey; label: string; width?: string }[] = [
  { key: 'name', label: 'Task Name' },
  { key: 'status', label: 'Status', width: '120px' },
  { key: 'assignee', label: 'Assignee', width: '140px' },
  { key: 'startDate', label: 'Start Date', width: '120px' },
  { key: 'endDate', label: 'Due Date', width: '120px' },
  { key: 'space', label: 'Space / List', width: '180px' },
];

export default function ListView() {
  const tasks = useTaskStore(s => s.tasks);
  const noDateTasks = useTaskStore(s => s.noDateTasks);
  const selectedUserName = useTaskStore(s => s.selectedUserName);
  const openTaskDetail = useTaskStore(s => s.openTaskDetail);

  const [sortKey, setSortKey] = useState<SortKey>('endDate');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const allTasks = useMemo(() => [...tasks, ...noDateTasks], [tasks, noDateTasks]);

  const sorted = useMemo(() => {
    const copy = [...allTasks];
    copy.sort((a, b) => {
      const va = getSortValue(a, sortKey);
      const vb = getSortValue(b, sortKey);
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [allTasks, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  if (!selectedUserName || allTasks.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📋</div>
        <div className="empty-state-text">No tasks to display</div>
        <div className="empty-state-sub">Select an assignee and click Generate first</div>
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="list-view">
      <div className="list-view-summary">
        Showing <strong>{allTasks.length}</strong> tasks for <strong>{selectedUserName}</strong>
      </div>
      <div className="list-table-wrap">
        <table className="list-table">
          <thead>
            <tr>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  className={`list-th ${sortKey === col.key ? 'list-th-active' : ''}`}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="list-sort-arrow">{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => {
              const isOverdue =
                t.endDate &&
                t.endDate < today &&
                !t.status.toLowerCase().includes('complete') &&
                !t.status.toLowerCase().includes('done') &&
                !t.status.toLowerCase().includes('closed');

              return (
                <tr key={t.id} className={`list-tr ${isOverdue ? 'list-tr-overdue' : ''}`} onClick={() => openTaskDetail(t)}>
                  <td className="list-td list-td-name">
                    <span className="list-td-name-text">{t.name}</span>
                  </td>
                  <td className="list-td">
                    <span className="list-status-badge" style={{ background: getStatusColor(t.status) }}>
                      {t.status}
                    </span>
                  </td>
                  <td className="list-td">
                    {t.assignees[0] ? (
                      <span className="list-assignee">
                        <span className="list-assignee-avatar">
                          {t.assignees[0].profilePicture
                            ? <img src={t.assignees[0].profilePicture} alt="" />
                            : t.assignees[0].initials}
                        </span>
                        {t.assignees[0].username}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="list-td list-td-date">{formatDate(t.startDate)}</td>
                  <td className="list-td list-td-date">
                    {formatDate(t.endDate)}
                    {isOverdue && <span className="list-overdue-tag">overdue</span>}
                  </td>
                  <td className="list-td list-td-meta">
                    {t.space.name} › {t.list.name}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
