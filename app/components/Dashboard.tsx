'use client';

import { useRef, useCallback, useEffect } from 'react';
import { useTaskStore } from '../store/useTaskStore';
import { getVisibleRows } from '../utils/taskGrouper';
import { dateToPx } from '../utils/dateUtils';
import TaskTree from './TaskTree';
import GanttChart from './GanttChart';
import SkeletonLoader from './SkeletonLoader';
import { GanttScale } from '../types';

const ROW_HEIGHT = 80;

const SCALE_ORDER: GanttScale[] = ['quarter', 'month', 'week', 'day'];

export default function Dashboard() {
  const { tasks, treeRows, timelineConfig, loading, loadingProgress, collapsedGroups, selectedUserName, ganttScale, setGanttScale } = useTaskStore();

  const treeRef = useRef<HTMLDivElement>(null);
  const ganttBodyRef = useRef<HTMLDivElement>(null);
  const ganttHeaderRef = useRef<HTMLDivElement>(null);

  const visibleRows = getVisibleRows(treeRows, collapsedGroups);

  const handleGanttScroll = useCallback(() => {
    if (!ganttBodyRef.current) return;
    if (treeRef.current) treeRef.current.scrollTop = ganttBodyRef.current.scrollTop;
    if (ganttHeaderRef.current) ganttHeaderRef.current.scrollLeft = ganttBodyRef.current.scrollLeft;
  }, []);

  // Auto-scroll to TODAY line when tasks load
  useEffect(() => {
    if (!timelineConfig || tasks.length === 0) return;

    // Small delay to let the SVG render first
    const timer = setTimeout(() => {
      if (!ganttBodyRef.current) return;

      const today = new Date();
      const todayPx = dateToPx(today, timelineConfig.startDate, timelineConfig.pxPerDay);
      const containerWidth = ganttBodyRef.current.clientWidth;

      // Scroll so TODAY is about 1/3 from the left edge
      const scrollTarget = Math.max(0, todayPx - containerWidth * 0.33);
      ganttBodyRef.current.scrollLeft = scrollTarget;

      // Sync the header
      if (ganttHeaderRef.current) {
        ganttHeaderRef.current.scrollLeft = scrollTarget;
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [tasks, timelineConfig]);

  const handleZoomIn = () => {
    const idx = SCALE_ORDER.indexOf(ganttScale);
    if (idx < SCALE_ORDER.length - 1) {
      setGanttScale(SCALE_ORDER[idx + 1]);
    }
  };

  const handleZoomOut = () => {
    const idx = SCALE_ORDER.indexOf(ganttScale);
    if (idx > 0) {
      setGanttScale(SCALE_ORDER[idx - 1]);
    }
  };

  const canZoomIn = SCALE_ORDER.indexOf(ganttScale) < SCALE_ORDER.length - 1;
  const canZoomOut = SCALE_ORDER.indexOf(ganttScale) > 0;

  if (loading) {
    return <SkeletonLoader progress={loadingProgress} />;
  }

  if (!selectedUserName || tasks.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">Gantt</div>
        <div className="empty-state-text">
          {selectedUserName ? 'No tasks found for this assignee' : 'Select an assignee and click Generate'}
        </div>
        <div className="empty-state-sub">Tasks will appear here as a Gantt timeline</div>
      </div>
    );
  }

  if (!timelineConfig) return null;

  const scaleLabel = ganttScale.charAt(0).toUpperCase() + ganttScale.slice(1);

  return (
    <div className="dashboard" style={{ position: 'relative' }}>
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

      {/* Zoom Controls — floating bottom-right */}
      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          right: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          background: 'rgba(22, 27, 34, 0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '10px',
          padding: '4px 6px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          zIndex: 100,
        }}
      >
        <button
          onClick={handleZoomOut}
          disabled={!canZoomOut}
          title="Zoom Out"
          style={{
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: canZoomOut ? 'rgba(255,255,255,0.06)' : 'transparent',
            border: 'none',
            borderRadius: '8px',
            color: canZoomOut ? '#e6edf3' : '#484f58',
            fontSize: '18px',
            fontWeight: 700,
            cursor: canZoomOut ? 'pointer' : 'default',
            transition: 'all 0.15s',
            lineHeight: 1,
          }}
          onMouseEnter={e => { if (canZoomOut) e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = canZoomOut ? 'rgba(255,255,255,0.06)' : 'transparent'; }}
        >
          −
        </button>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: '#8b949e',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            padding: '0 8px',
            minWidth: '52px',
            textAlign: 'center',
            userSelect: 'none',
          }}
        >
          {scaleLabel}
        </span>
        <button
          onClick={handleZoomIn}
          disabled={!canZoomIn}
          title="Zoom In"
          style={{
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: canZoomIn ? 'rgba(255,255,255,0.06)' : 'transparent',
            border: 'none',
            borderRadius: '8px',
            color: canZoomIn ? '#e6edf3' : '#484f58',
            fontSize: '18px',
            fontWeight: 700,
            cursor: canZoomIn ? 'pointer' : 'default',
            transition: 'all 0.15s',
            lineHeight: 1,
          }}
          onMouseEnter={e => { if (canZoomIn) e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = canZoomIn ? 'rgba(255,255,255,0.06)' : 'transparent'; }}
        >
          +
        </button>
      </div>
    </div>
  );
}

