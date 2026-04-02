'use client';

import { TreeRow } from '../types';
import { useTaskStore } from '../store/useTaskStore';

interface Props {
  rows: TreeRow[];
  rowHeight: number;
}

function getStatusColor(status: string, color: string): string {
  const s = status.toLowerCase();
  if (s.includes('complete') || s.includes('done') || s.includes('resolved')) return 'var(--status-complete)';
  if (s.includes('progress') || s.includes('active')) return 'var(--status-inprogress)';
  if (s.includes('review') || s.includes('test')) return 'var(--status-review)';
  if (s.includes('closed') || s.includes('archived')) return 'var(--status-closed)';
  if (color && color !== '#666666') return color;
  return 'var(--status-todo)';
}

export default function TaskTree({ rows, rowHeight }: Props) {
  const { toggleGroup } = useTaskStore();
  const collapsed = useTaskStore(s => s.collapsedGroups);

  return (
    <div>
      {rows.map((row, i) => {
        if (row.type === 'task') {
          const t = row.task;
          const indent = row.depth * 16 + 8;
          return (
            <div key={t.id + '-' + i} className="tree-row" style={{ height: rowHeight }}>
              <div className="tree-indent" style={{ width: indent }} />
              {row.isSubtask && <span className="tree-subtask-prefix">└</span>}
              <span className="tree-status-dot" style={{ background: getStatusColor(t.status, t.statusColor) }} />
              <span className="tree-task-name" title={t.name}>{t.name}</span>
              {t.assignees[0] && (
                <div className="tree-assignee-badge" title={t.assignees[0].username}>
                  {t.assignees[0].profilePicture
                    ? <img src={t.assignees[0].profilePicture} alt="" />
                    : t.assignees[0].initials}
                </div>
              )}
            </div>
          );
        }

        const indent = row.depth * 16 + 8;
        const isCollapsed = collapsed.has(row.id);
        const icon = row.type === 'space' ? '▸' : row.type === 'folder' ? '◆' : '▪';
        const nameClass = row.type === 'space' ? 'tree-space-name' : row.type === 'folder' ? 'tree-folder-name' : 'tree-list-name';

        return (
          <div
            key={row.id + '-' + i}
            className="tree-row tree-row-group"
            style={{ height: rowHeight }}
            onClick={() => toggleGroup(row.id)}
          >
            <div className="tree-indent" style={{ width: indent }} />
            <span className={`tree-toggle ${isCollapsed ? 'collapsed' : ''}`}>▾</span>
            <span className="tree-icon">{icon}</span>
            <span className={`tree-group-name ${nameClass}`}>
              {row.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
