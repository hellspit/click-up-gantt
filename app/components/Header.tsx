'use client';

import { useState, useEffect, useRef } from 'react';
import { useTaskStore } from '../store/useTaskStore';

const VIEW_TABS = [
  { key: 'gantt' as const, icon: '', label: 'Gantt' },
  { key: 'list' as const, icon: '', label: 'List' },
  { key: 'status' as const, icon: '', label: 'Status' },
];

// Status color mapping for common ClickUp statuses
const STATUS_COLORS: Record<string, string> = {
  'complete': '#3fb950',
  'done': '#3fb950',
  'closed': '#8b949e',
  'in progress': '#5A43D6',
  'in review': '#bc8cff',
  'review': '#bc8cff',
  'to do': '#58a6ff',
  'open': '#58a6ff',
  'open/to do': '#58a6ff',
};

function IndividualFilterDropdown({ onClose }: { onClose: () => void }) {
  const individualFilter = useTaskStore(s => s.individualFilter);
  const availableStatuses = useTaskStore(s => s.availableStatuses);
  const applyIndividualFilter = useTaskStore(s => s.applyIndividualFilter);
  const clearIndividualFilter = useTaskStore(s => s.clearIndividualFilter);

  const [dateFrom, setDateFrom] = useState(individualFilter.dateFrom || '');
  const [dateTo, setDateTo] = useState(individualFilter.dateTo || '');
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set(individualFilter.statusFilter));
  const [delayFilter, setDelayFilter] = useState<Set<string>>(new Set(individualFilter.delayFilter));

  const isAnyFilter = dateFrom || dateTo || statusFilter.size > 0 || delayFilter.size > 0;

  const toggleStatus = (s: string) => {
    const next = new Set(statusFilter);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setStatusFilter(next);
  };

  const toggleDelay = (d: string) => {
    const next = new Set(delayFilter);
    if (next.has(d)) next.delete(d);
    else next.add(d);
    setDelayFilter(next);
  };

  const handleApply = () => {
    applyIndividualFilter({
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      statusFilter,
      delayFilter: delayFilter as any,
    });
    onClose();
  };

  const handleClear = () => {
    setDateFrom('');
    setDateTo('');
    setStatusFilter(new Set());
    setDelayFilter(new Set());
    clearIndividualFilter();
    onClose();
  };

  const getStatusColor = (s: string) => STATUS_COLORS[s] || '#58a6ff';

  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        right: '0',
        marginTop: '8px',
        width: '320px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-secondary)',
        borderRadius: '12px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05) inset',
        zIndex: 9999,
        overflow: 'hidden',
        animation: 'fadeIn 0.15s ease',
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-tertiary)' }}>
          Filters
        </span>
        {isAnyFilter && (
          <span
            onClick={handleClear}
            style={{ fontSize: '10px', color: '#f85149', cursor: 'pointer', fontWeight: 600 }}
          >
            Clear All
          </span>
        )}
      </div>

      {/* Date Range Section */}
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Date Range</span>
          <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)' }}>Date Range</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <label style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-primary)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
                colorScheme: 'dark',
                transition: 'all 0.2s',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--status-todo)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-primary)')}
            />
          </div>
          <span style={{ color: 'var(--text-tertiary)', fontSize: '12px', paddingTop: '16px' }}>to</span>
          <div style={{ flex: 1, position: 'relative' }}>
            <label style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>To</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-primary)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
                colorScheme: 'dark',
                transition: 'all 0.2s',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--status-todo)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-primary)')}
            />
          </div>
        </div>
      </div>

      {/* Status Section */}
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Status</span>
          <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)' }}>Task Status</span>
        </div>
        {availableStatuses.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
            Generate tasks first to see statuses
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {availableStatuses.map(s => {
              const active = statusFilter.has(s);
              const color = getStatusColor(s);
              return (
                <div
                  key={s}
                  onClick={() => toggleStatus(s)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: active ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    background: active ? `${color}20` : 'var(--bg-tertiary)',
                    border: active ? `1px solid ${color}` : '1px solid var(--border-primary)',
                    color: active ? color : 'var(--text-secondary)',
                    textTransform: 'capitalize',
                    boxShadow: active ? `0 0 0 1px ${color}40, 0 2px 8px ${color}20` : 'none',
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      e.currentTarget.style.borderColor = 'var(--border-secondary)';
                      e.currentTarget.style.background = 'var(--bg-hover)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      e.currentTarget.style.borderColor = 'var(--border-primary)';
                      e.currentTarget.style.background = 'var(--bg-tertiary)';
                    }
                  }}
                >
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: color,
                    flexShrink: 0,
                    boxShadow: active ? `0 0 4px ${color}` : 'none',
                  }} />
                  {s}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delay Type Section */}
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Delay</span>
          <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)' }}>Delay Type</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {[
            { key: 'starting', label: 'Starting Delay', color: '#6e7681', icon: '' },
            { key: 'project_length', label: 'Project Length Delay', color: '#da3633', icon: '' },
            { key: 'completion', label: 'Completion Delay', color: '#f0883e', icon: '' },
          ].map(d => {
            const active = delayFilter.has(d.key);
            return (
              <div
                key={d.key}
                onClick={() => toggleDelay(d.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: active ? `${d.color}20` : 'var(--bg-tertiary)',
                  border: active ? `1px solid ${d.color}` : '1px solid var(--border-primary)',
                  color: active ? d.color : 'var(--text-secondary)',
                  boxShadow: active ? `0 0 0 1px ${d.color}40, 0 2px 8px ${d.color}20` : 'none',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.borderColor = 'var(--border-secondary)';
                    e.currentTarget.style.background = 'var(--bg-hover)';
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.borderColor = 'var(--border-primary)';
                    e.currentTarget.style.background = 'var(--bg-tertiary)';
                  }
                }}
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                {d.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Apply button */}
      <div style={{ padding: '16px', borderTop: '1px solid var(--border-primary)', background: 'var(--bg-secondary)' }}>
        <div
          onClick={handleApply}
          style={{
            width: '100%',
            padding: '10px 0',
            background: 'linear-gradient(135deg, var(--status-open) 0%, var(--status-todo) 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 700,
            textAlign: 'center',
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            transition: 'all 0.2s',
            boxShadow: '0 4px 12px rgba(88, 166, 255, 0.3)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(88, 166, 255, 0.4)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(88, 166, 255, 0.3)';
          }}
        >
          Apply Filters
        </div>
      </div>
    </div>
  );
}

export default function Header() {
  const { members, membersLoading, selectedUserId, selectedUserName, loading, tasks, noDateTasks, activeView, mode, individualFilter, availableStatuses, fetchMembers, fetchTasks, setSelectedUser, setActiveView } = useTaskStore();
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close filter on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilter(false);
    };
    if (showFilter) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFilter]);

  const filtered = members.filter(m =>
    m.username.toLowerCase().includes(query.toLowerCase()) ||
    m.email.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (m: typeof members[0]) => {
    setSelectedUser(String(m.id), m.username);
    setQuery(m.username);
    setShowDropdown(false);
  };

  const handleGenerate = () => {
    if (selectedUserId) fetchTasks();
  };

  const handleExport = () => {
    const svg = document.querySelector('.gantt-bars-svg') as SVGSVGElement;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const blob = new Blob([clone.outerHTML], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gantt-${selectedUserName || 'export'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isTeamMode = mode === 'team';
  const hasIndividualFilter = individualFilter.dateFrom || individualFilter.dateTo || individualFilter.statusFilter.size > 0 || individualFilter.delayFilter.size > 0;
  const hasTasks = tasks.length > 0 || noDateTasks.length > 0;

  return (
    <>
      {/* Navigation Bar */}
      <div className="nav-bar">
        <a
          href="/"
          className={`nav-link ${!isTeamMode ? 'nav-link-active' : ''}`}
        >
          <span className="nav-link-icon" style={{ fontSize: '13px' }}>Individual</span>

        </a>
        <a
          href="/team"
          className={`nav-link ${isTeamMode ? 'nav-link-active' : ''}`}
        >
          <span className="nav-link-icon" style={{ fontSize: '13px' }}>Team</span>

        </a>
        <div className="nav-spacer" />
        <span className="nav-brand">ClickUp Dashboard</span>
      </div>

      {/* Show individual controls only in individual mode */}
      {!isTeamMode && (
        <div className="app-header">
          <div className="header-input-group">
            <label className="header-label">Assignee Name or Email</label>
            <div className="assignee-wrapper" ref={wrapperRef}>
              <input
                className="header-input"
                placeholder={membersLoading ? 'Loading members...' : 'Type to search...'}
                value={query}
                onChange={e => { setQuery(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
              />
              {showDropdown && filtered.length > 0 && (
                <div className="assignee-dropdown">
                  {filtered.map(m => (
                    <div key={m.id} className="assignee-option" onClick={() => handleSelect(m)}>
                      <div className="assignee-avatar-sm">
                        {m.profilePicture ? <img src={m.profilePicture} alt="" /> : m.initials}
                      </div>
                      <span>{m.username}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 'auto' }}>{m.email}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button className="btn-generate" onClick={handleGenerate} disabled={!selectedUserId || loading}>
            {loading ? 'Loading...' : 'Generate'}
          </button>

          {/* Filter button */}
          {hasTasks && (
            <div ref={filterRef} style={{ position: 'relative' }}>
              <div
                onClick={() => setShowFilter(!showFilter)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  background: hasIndividualFilter ? 'rgba(88, 166, 255, 0.1)' : 'transparent',
                  border: hasIndividualFilter ? '1px solid var(--status-todo)' : '1px solid var(--border-secondary)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: hasIndividualFilter ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                }}
              >
                Filter
                {hasIndividualFilter && (
                  <span
                    style={{
                      background: 'var(--status-todo)',
                      color: '#fff',
                      fontSize: '9px',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '8px',
                      minWidth: '16px',
                      textAlign: 'center',
                    }}
                  >
                    {(individualFilter.dateFrom || individualFilter.dateTo ? 1 : 0) + (individualFilter.statusFilter.size > 0 ? 1 : 0) + (individualFilter.delayFilter.size > 0 ? 1 : 0)}
                  </span>
                )}
              </div>
              {showFilter && <IndividualFilterDropdown onClose={() => setShowFilter(false)} />}
            </div>
          )}

          <div className="header-spacer" />

          <button className="btn-export" onClick={handleExport} disabled={tasks.length === 0 || activeView !== 'gantt'}>
            Export SVG
          </button>
        </div>
      )}

      {/* View Switcher — Pie replaces Gantt in team mode */}
      <div className="view-switcher">
        {(isTeamMode
          ? [
              { key: 'gantt' as const, icon: '', label: 'Pie' },
              { key: 'list' as const, icon: '', label: 'List' },
              { key: 'status' as const, icon: '', label: 'Status' },
            ]
          : VIEW_TABS
        ).map(tab => (
          <button
            key={tab.key}
            className={`view-tab ${activeView === tab.key ? 'active' : ''}`}
            onClick={() => setActiveView(tab.key)}
          >
            <span className="view-tab-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
    </>
  );
}
