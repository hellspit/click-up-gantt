'use client';

import { useRef, useCallback } from 'react';
import { useTaskStore } from '../store/useTaskStore';
import { getVisibleRows } from '../utils/taskGrouper';
import TaskTree from './TaskTree';
import GanttChart from './GanttChart';
import SkeletonLoader from './SkeletonLoader';

const ROW_HEIGHT = 40;

export default function Dashboard() {
  const { tasks, treeRows, timelineConfig, loading, loadingProgress, collapsedGroups, selectedUserName } = useTaskStore();

  const treeRef = useRef<HTMLDivElement>(null);
  const ganttBodyRef = useRef<HTMLDivElement>(null);
  const ganttHeaderRef = useRef<HTMLDivElement>(null);

  const visibleRows = getVisibleRows(treeRows, collapsedGroups);

  const handleGanttScroll = useCallback(() => {
    if (!ganttBodyRef.current) return;
    if (treeRef.current) treeRef.current.scrollTop = ganttBodyRef.current.scrollTop;
    if (ganttHeaderRef.current) ganttHeaderRef.current.scrollLeft = ganttBodyRef.current.scrollLeft;
  }, []);

  if (loading) {
    return <SkeletonLoader progress={loadingProgress} />;
  }

  if (!selectedUserName || tasks.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📊</div>
        <div className="empty-state-text">
          {selectedUserName ? 'No tasks found for this assignee' : 'Select an assignee and click Generate'}
        </div>
        <div className="empty-state-sub">Tasks will appear here as a Gantt timeline</div>
      </div>
    );
  }

  if (!timelineConfig) return null;

  return (
    <div className="dashboard">
      {/* Top-left corner */}
      <div className="dashboard-corner">
        Task · {selectedUserName}
      </div>

      {/* Top-right: date header */}
      <div className="gantt-header-wrap" ref={ganttHeaderRef}>
        <GanttChart
          mode="header"
          rows={visibleRows}
          config={timelineConfig}
          rowHeight={ROW_HEIGHT}
        />
      </div>

      {/* Bottom-left: task tree */}
      <div className="task-tree-wrap" ref={treeRef}>
        <TaskTree rows={visibleRows} rowHeight={ROW_HEIGHT} />
      </div>

      {/* Bottom-right: gantt bars */}
      <div className="gantt-body-wrap" ref={ganttBodyRef} onScroll={handleGanttScroll}>
        <GanttChart
          mode="body"
          rows={visibleRows}
          config={timelineConfig}
          rowHeight={ROW_HEIGHT}
        />
      </div>
    </div>
  );
}
