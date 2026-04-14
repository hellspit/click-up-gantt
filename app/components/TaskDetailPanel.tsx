'use client';

import { useEffect, useState } from 'react';
import { useTaskStore } from '../store/useTaskStore';
import { CustomField, NormalizedTask } from '../types';

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

function parseCfTimestamp(cf: CustomField | undefined): Date | null {
  if (!cf || cf.value === null || cf.value === undefined || cf.value === '') return null;
  const ts = Number(cf.value);
  if (isNaN(ts) || ts === 0) return null;
  if (ts > 1000000000000) return new Date(ts);
  if (ts > 1000000000) return new Date(ts * 1000);
  return null;
}

type DelayType = 'Starting Delay' | 'Project Length Delay' | 'Completion Delay';

function computeDelays(task: NormalizedTask, customFields: CustomField[]): {
  delays: DelayType[];
  plannedDays: number | null;
  executionDays: number | null;
} {
  const pStartCf = findField(customFields, PLANNED_START_NAMES);
  const pDueCf = findField(customFields, PLANNED_DUE_NAMES);
  const pStart = parseCfTimestamp(pStartCf);
  const pDue = parseCfTimestamp(pDueCf);
  const aStart = task.startDate ? task.startDate.getTime() : null;
  const aDue = task.endDate ? task.endDate.getTime() : null;

  const ONE_DAY = 86400000;
  const plannedDays = pStart && pDue ? Math.round((pDue.getTime() - pStart.getTime()) / ONE_DAY) : null;
  const executionDays = aStart && aDue ? Math.round((aDue - aStart) / ONE_DAY) : null;

  const delays: DelayType[] = [];
  if (pStart && pDue && aStart && aDue) {
    if (aStart > pStart.getTime()) delays.push('Starting Delay');
    const plannedWindow = pDue.getTime() - pStart.getTime();
    const actualWindow = aDue - aStart;
    if ((actualWindow - plannedWindow) > ONE_DAY) delays.push('Project Length Delay');
    // Completion delay: dateCompleted - actual due date > 1 day
    const doneTs = task.dateCompleted ? task.dateCompleted.getTime() : null;
    if (doneTs && (doneTs - aDue) > ONE_DAY) delays.push('Completion Delay');
  }

  return { delays, plannedDays, executionDays };
}

export default function TaskDetailPanel() {
  const task = useTaskStore(s => s.detailTask);
  const closeTaskDetail = useTaskStore(s => s.closeTaskDetail);
  const activeView = useTaskStore(s => s.activeView);
  const [fetchedFields, setFetchedFields] = useState<CustomField[]>([]);
  const [taskDescription, setTaskDescription] = useState<string>('');
  const [taskComments, setTaskComments] = useState<any[]>([]);
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
      setTaskDescription('');
      setTaskComments([]);
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
        setTaskDescription(data.text_content || data.description || '');
        setTaskComments(data.comments || []);
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

          {/* Execution Dates */}
          <div className="detail-field">
            <div className="detail-field-icon">📅</div>
            <div className="detail-field-label">Execution Dates</div>
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
              {/* Execution days summary */}
              {task.startDate && task.endDate && (() => {
                const execDays = Math.round((task.endDate.getTime() - task.startDate.getTime()) / 86400000);
                // Compute delay = execution days - planned days
                const pStartDate = parseCfTimestamp(plannedStart);
                const pDueDate = parseCfTimestamp(plannedDue);
                const plannedDayCount = pStartDate && pDueDate ? Math.round((pDueDate.getTime() - pStartDate.getTime()) / 86400000) : null;
                const delayDays = plannedDayCount !== null ? execDays - plannedDayCount : null;
                return (
                  <div style={{ marginTop: '6px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    {plannedDayCount !== null && delayDays !== null ? (
                      <span>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>({plannedDayCount}d</span>
                        {delayDays > 0 && (
                          <span style={{ color: '#f85149', fontWeight: 700 }}> +{delayDays}d</span>
                        )}
                        {delayDays < 0 && (
                          <span style={{ color: '#3fb950', fontWeight: 700 }}> {delayDays}d</span>
                        )}
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>)</span>
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>({execDays}d)</span>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ── Planned Dates (custom fields) ── */}
          {(plannedStart || plannedDue) && (
            <div className="detail-field">
              <div className="detail-field-icon">📋</div>
              <div className="detail-field-label">Planned Dates</div>
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
                {/* Planned days summary */}
                {(() => {
                  const pStartDate = parseCfTimestamp(plannedStart);
                  const pDueDate = parseCfTimestamp(plannedDue);
                  if (!pStartDate || !pDueDate) return null;
                  const days = Math.round((pDueDate.getTime() - pStartDate.getTime()) / 86400000);
                  return (
                    <div style={{ marginTop: '6px', fontSize: '11px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>({days}d)</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ── Date Done ── */}
          {task.dateCompleted && (
            <div className="detail-field">
              <div className="detail-field-icon">✅</div>
              <div className="detail-field-label">Date Done</div>
              <div className="detail-field-value">
                <span style={{ color: '#3fb950', fontWeight: 600 }}>
                  {formatFullDate(task.dateCompleted)}
                </span>
              </div>
            </div>
          )}

          {/* ── Delay Duration (computed: date done - actual due date) ── */}
          {task.dateCompleted && task.endDate && (() => {
            // Normalize to midnight to avoid time-of-day rounding issues
            const doneDay = new Date(task.dateCompleted.getFullYear(), task.dateCompleted.getMonth(), task.dateCompleted.getDate());
            const dueDay = new Date(task.endDate.getFullYear(), task.endDate.getMonth(), task.endDate.getDate());
            const delayDays = Math.round((doneDay.getTime() - dueDay.getTime()) / 86400000);
            const isDelayed = delayDays > 0;
            const isEarly = delayDays < 0;
            return (
              <div className="detail-field">
                <div className="detail-field-icon">⏱</div>
                <div className="detail-field-label">Delay Duration</div>
                <div className="detail-field-value">
                  <span style={{
                    fontWeight: 700,
                    color: isDelayed ? '#f85149' : isEarly ? '#3fb950' : '#8b949e',
                  }}>
                    {isDelayed ? `+${delayDays} day${delayDays !== 1 ? 's' : ''}` : isEarly ? `${delayDays} day${Math.abs(delayDays) !== 1 ? 's' : ''} (early)` : `${delayDays} days`}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* ── Delay Analysis (Gantt view only) ── */}
          {activeView === 'gantt' && (() => {
            const { delays, plannedDays, executionDays } = computeDelays(task, customFields);
            const hasAnyData = delays.length > 0 || plannedDays !== null || executionDays !== null;
            if (!hasAnyData) return null;

            const DELAY_COLORS: Record<string, string> = {
              'Starting Delay': '#6e7681',
              'Project Length Delay': '#da3633',
              'Completion Delay': '#f85149',
            };
            const DELAY_ICONS: Record<string, string> = {
              'Starting Delay': '⏳',
              'Project Length Delay': '📏',
              'Completion Delay': '🏁',
            };

            return (
              <div className="detail-field" style={{ gridColumn: '1 / -1' }}>
                <div className="detail-field-icon">📊</div>
                <div className="detail-field-label">Delay Analysis</div>
                <div className="detail-field-value">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                    {/* Delay types */}
                    {delays.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {delays.map(d => (
                          <span
                            key={d}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: `${DELAY_COLORS[d]}20`,
                              border: `1px solid ${DELAY_COLORS[d]}`,
                              color: DELAY_COLORS[d],
                            }}
                          >
                            {DELAY_ICONS[d]} {d}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: 'rgba(63, 185, 80, 0.15)',
                        border: '1px solid #3fb950',
                        color: '#3fb950',
                        width: 'fit-content',
                      }}>
                        ✅ No Delays
                      </span>
                    )}

                    {/* Planned vs Execution days comparison */}
                    {(plannedDays !== null || executionDays !== null) && (
                      <div style={{
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'center',
                        padding: '8px 12px',
                        background: 'var(--bg-tertiary)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-primary)',
                      }}>
                        {plannedDays !== null && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                            <span style={{ fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>Planned</span>
                            <span style={{ fontSize: '16px', fontWeight: 700, color: '#8b949e' }}>{plannedDays}d</span>
                          </div>
                        )}
                        {plannedDays !== null && executionDays !== null && (
                          <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>→</span>
                        )}
                        {executionDays !== null && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                            <span style={{ fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>Execution</span>
                            <span style={{
                              fontSize: '16px',
                              fontWeight: 700,
                              color: plannedDays !== null && executionDays > plannedDays ? '#f85149' : '#3fb950',
                            }}>{executionDays}d</span>
                          </div>
                        )}
                        {plannedDays !== null && executionDays !== null && (
                          <div style={{
                            marginLeft: 'auto',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: executionDays > plannedDays
                              ? 'rgba(248, 81, 73, 0.15)'
                              : executionDays < plannedDays
                              ? 'rgba(63, 185, 80, 0.15)'
                              : 'rgba(139, 148, 158, 0.15)',
                            color: executionDays > plannedDays
                              ? '#f85149'
                              : executionDays < plannedDays
                              ? '#3fb950'
                              : '#8b949e',
                          }}>
                            {executionDays > plannedDays
                              ? `+${executionDays - plannedDays}d over`
                              : executionDays < plannedDays
                              ? `${plannedDays - executionDays}d early`
                              : 'On time'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

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
        {/* Description */}
        {taskDescription && (
          <div className="detail-section">
            <h3 className="detail-section-title">Description</h3>
            <div className="detail-description">
              {taskDescription}
            </div>
          </div>
        )}

        {/* Comments */}
        {taskComments.length > 0 && (
          <div className="detail-section">
            <h3 className="detail-section-title">Comments ({taskComments.length})</h3>
            <div className="detail-comments-list">
              {taskComments.map((c: any) => (
                <div key={c.id} className="detail-comment">
                  <div className="detail-comment-header">
                    <div className="detail-comment-avatar">
                      {c.user?.profilePicture ? (
                        <img src={c.user.profilePicture} alt="" />
                      ) : (
                        c.user?.initials || 'U'
                      )}
                    </div>
                    <span className="detail-comment-user">{c.user?.username || 'User'}</span>
                    <span className="detail-comment-date">{formatFullDate(new Date(parseInt(c.date)))}</span>
                  </div>
                  <div className="detail-comment-text">{c.comment_text}</div>
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

