'use client';

import { useEffect, useState } from 'react';
import { useTaskStore } from '../store/useTaskStore';
import { CustomField } from '../types';

function getStatusColor(status: string, color: string): string {
  const s = status.toLowerCase();
  if (s.includes('complete') || s.includes('done') || s.includes('resolved')) return '#3fb950';
  if (s.includes('progress') || s.includes('active')) return '#d29922';
  if (s.includes('review') || s.includes('test')) return '#bc8cff';
  if (s.includes('closed') || s.includes('archived')) return '#6e7681';
  if (color && color !== '#666666') return color;
  return '#58a6ff';
}

function formatFullDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getDuration(start: Date | null, end: Date | null): string {
  if (!start || !end) return '—';
  const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Same day';
  if (diff === 1) return '1 day';
  return `${diff} days`;
}

function isOverdue(task: { endDate: Date | null; status: string }): boolean {
  if (!task.endDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const s = task.status.toLowerCase();
  return task.endDate < today && !s.includes('complete') && !s.includes('done') && !s.includes('closed');
}

/* ── Custom field helpers ── */
const PLANNED_START_NAMES = ['planned start date', 'planned start'];
const PLANNED_DUE_NAMES = ['planned due date', 'planned due'];
const DELAY_NAMES = ['delay duration', 'delay'];


function formatCustomFieldValue(cf: CustomField): string {
  // Handle null / undefined / empty
  if (cf.value === null || cf.value === undefined || cf.value === '') return '—';

  // Date fields: parse ClickUp timestamps
  if (cf.type === 'date') {
    const ts = Number(cf.value);
    if (!isNaN(ts) && ts > 1000000000000) {
      return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
    }
    if (!isNaN(ts) && ts > 1000000000) {
      return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
    }
  }

  if (cf.type === 'drop_down' && typeof cf.value === 'object' && cf.value !== null) {
    return cf.value.name || cf.value.label || JSON.stringify(cf.value);
  }

  if (cf.type === 'labels' && Array.isArray(cf.value)) {
    return cf.value.map((v: any) => v.label || v.name || v).join(', ');
  }

  if (typeof cf.value === 'object' && cf.value !== null) {
    return JSON.stringify(cf.value);
  }

  return String(cf.value);
}

function findField(fields: CustomField[], names: string[]): CustomField | undefined {
  const matches = fields.filter(cf => names.includes(cf.name.toLowerCase()));
  // Prefer a match that has an actual value
  return matches.find(cf => cf.value !== null && cf.value !== undefined && cf.value !== '') || matches[0];
}

export default function TaskDetailPanel() {
  const task = useTaskStore(s => s.detailTask);
  const closeTaskDetail = useTaskStore(s => s.closeTaskDetail);
  const [fetchedFields, setFetchedFields] = useState<CustomField[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);

  useEffect(() => {
    if (!task) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeTaskDetail();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [task, closeTaskDetail]);

  // Fetch custom fields from single-task API when task changes
  useEffect(() => {
    if (!task) {
      setFetchedFields([]);
      return;
    }

    let cancelled = false;
    setLoadingFields(true);

    fetch(`/api/task-detail?taskId=${task.id}`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        const fields: CustomField[] = (data.customFields || []);
        setFetchedFields(fields);
        setLoadingFields(false);
      })
      .catch(() => {
        if (!cancelled) setLoadingFields(false);
      });

    return () => { cancelled = true; };
  }, [task?.id]);

  if (!task) return null;

  const statusColor = getStatusColor(task.status, task.statusColor);
  const overdue = isOverdue(task);

  // Use fetched custom fields (from single-task API), fallback to normalized ones
  const customFields = fetchedFields.length > 0 ? fetchedFields : task.customFields;

  // Extract highlighted custom fields
  const plannedStart = findField(customFields, PLANNED_START_NAMES);
  const plannedDue = findField(customFields, PLANNED_DUE_NAMES);
  const delayDuration = findField(customFields, DELAY_NAMES);

  // Remaining custom fields (exclude all planned/delay/delayed name matches, only show those with values)
  const allHighlightedNames = [...PLANNED_START_NAMES, ...PLANNED_DUE_NAMES, ...DELAY_NAMES, 'delayed'];
  const otherFields = customFields.filter(cf =>
    !allHighlightedNames.includes(cf.name.toLowerCase()) &&
    cf.value !== null && cf.value !== undefined && cf.value !== ''
  );

  const delayVal = delayDuration ? Number(delayDuration.value) : 0;
  const hasDelay = delayDuration && delayVal > 0;

  return (
    <>
      <div className="detail-backdrop" onClick={closeTaskDetail} />

      <div className="detail-panel">
        {/* Header */}
        <div className="detail-header">
          <div className="detail-breadcrumb">
            <span className="detail-crumb">{task.space.name}</span>
            <span className="detail-crumb-sep">›</span>
            <span className="detail-crumb">{task.folder.name}</span>
            <span className="detail-crumb-sep">›</span>
            <span className="detail-crumb">{task.list.name}</span>
          </div>
          <button className="detail-close" onClick={closeTaskDetail} title="Close (Esc)">✕</button>
        </div>

        {/* Task Type */}
        <div className="detail-type-row">
          <span className="detail-type-badge">● Task</span>
          {task.parent && <span className="detail-subtask-label">Subtask of {task.parent}</span>}
        </div>

        {/* Title */}
        <h2 className="detail-title">{task.name}</h2>

        {/* Fields Grid */}
        <div className="detail-fields">
          {/* Status */}
          <div className="detail-field">
            <div className="detail-field-icon">◉</div>
            <div className="detail-field-label">Status</div>
            <div className="detail-field-value">
              <span className="detail-status-badge" style={{ background: statusColor }}>
                {task.status.toUpperCase()}
              </span>
              {overdue && <span className="detail-overdue-badge">OVERDUE</span>}
            </div>
          </div>

          {/* Assignees */}
          <div className="detail-field">
            <div className="detail-field-icon">👤</div>
            <div className="detail-field-label">Assignees</div>
            <div className="detail-field-value">
              {task.assignees.length > 0 ? (
                <div className="detail-assignees">
                  {task.assignees.map(a => (
                    <div key={a.id} className="detail-assignee-chip">
                      <div className="detail-assignee-avatar">
                        {a.profilePicture
                          ? <img src={a.profilePicture} alt="" />
                          : a.initials}
                      </div>
                      <span>{a.username}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="detail-field-empty">Unassigned</span>
              )}
            </div>
          </div>

          {/* Dates */}
          <div className="detail-field">
            <div className="detail-field-icon">📅</div>
            <div className="detail-field-label">Dates</div>
            <div className="detail-field-value">
              <div className="detail-dates">
                <div className="detail-date-row">
                  <span className="detail-date-label">Start</span>
                  <span className="detail-date-val">{formatFullDate(task.startDate)}</span>
                </div>
                <span className="detail-date-arrow">→</span>
                <div className="detail-date-row">
                  <span className="detail-date-label">Due</span>
                  <span className={`detail-date-val ${overdue ? 'detail-date-overdue' : ''}`}>
                    {formatFullDate(task.endDate)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Planned Dates (custom fields) ── */}
          {(plannedStart || plannedDue) && (
            <div className="detail-field">
              <div className="detail-field-icon">📋</div>
              <div className="detail-field-label">Planned</div>
              <div className="detail-field-value">
                <div className="detail-dates">
                  <div className="detail-date-row">
                    <span className="detail-date-label">Plan Start</span>
                    <span className="detail-date-val detail-date-planned">
                      {plannedStart ? formatCustomFieldValue(plannedStart) : '—'}
                    </span>
                  </div>
                  <span className="detail-date-arrow">→</span>
                  <div className="detail-date-row">
                    <span className="detail-date-label">Plan Due</span>
                    <span className="detail-date-val detail-date-planned">
                      {plannedDue ? formatCustomFieldValue(plannedDue) : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Delay Duration (custom field) ── */}
          {delayDuration && (
            <div className="detail-field">
              <div className="detail-field-icon">⚠️</div>
              <div className="detail-field-label">Delay</div>
              <div className="detail-field-value">
                <span className={`detail-delay-badge ${hasDelay ? 'detail-delay-red' : 'detail-delay-green'}`}>
                  {delayVal} {delayVal === 1 ? 'day' : 'days'}
                </span>
              </div>
            </div>
          )}

          {/* Duration */}
          <div className="detail-field">
            <div className="detail-field-icon">⏱</div>
            <div className="detail-field-label">Duration</div>
            <div className="detail-field-value">{getDuration(task.startDate, task.endDate)}</div>
          </div>

          {/* Created */}
          <div className="detail-field">
            <div className="detail-field-icon">🕐</div>
            <div className="detail-field-label">Created</div>
            <div className="detail-field-value">{formatFullDate(task.dateCreated)}</div>
          </div>

          {/* Location */}
          <div className="detail-field">
            <div className="detail-field-icon">📁</div>
            <div className="detail-field-label">Location</div>
            <div className="detail-field-value">
              <span className="detail-location">
                {task.space.name} › {task.folder.name} › {task.list.name}
              </span>
            </div>
          </div>

          {/* Task ID */}
          <div className="detail-field">
            <div className="detail-field-icon">#</div>
            <div className="detail-field-label">Task ID</div>
            <div className="detail-field-value">
              <code className="detail-task-id">{task.id}</code>
            </div>
          </div>
        </div>

        {/* ── Other Custom Fields ── */}
        {loadingFields && (
          <div className="detail-custom-fields">
            <div className="detail-cf-header">Custom Fields</div>
            <div className="detail-cf-row" style={{ justifyContent: 'center', color: 'var(--text-muted)' }}>
              <span className="loading-spinner" style={{ width: 14, height: 14, marginRight: 8 }} />
              Loading fields...
            </div>
          </div>
        )}
        {!loadingFields && otherFields.length > 0 && (
          <div className="detail-custom-fields">
            <div className="detail-cf-header">Custom Fields</div>
            <div className="detail-cf-list">
              {otherFields.map(cf => (
                <div key={cf.id} className="detail-cf-row">
                  <span className="detail-cf-name">{cf.name}</span>
                  <span className="detail-cf-value">{formatCustomFieldValue(cf)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Open in ClickUp */}
        {task.url && (
          <div className="detail-actions">
            <a href={task.url} target="_blank" rel="noopener noreferrer" className="detail-open-btn">
              🔗 Open in ClickUp
            </a>
          </div>
        )}
      </div>
    </>
  );
}

