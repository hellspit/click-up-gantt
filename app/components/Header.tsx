'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useTaskStore } from '../store/useTaskStore';
import { computeBandwidthSummary } from '../utils/bandwidthUtils';
import BandwidthPanel from './BandwidthPanel';
import IndividualFilterDropdown from './IndividualFilterDropdown';

const VIEW_TABS = [
  { key: 'gantt' as const, icon: '', label: 'Gantt' },
  { key: 'gantt-us' as const, icon: '', label: 'Gantt-US' },
  { key: 'list' as const, icon: '', label: 'List' },
  { key: 'status' as const, icon: '', label: 'Status' },
];

type GanttScaleOption = 'day' | 'week' | 'month' | 'quarter';

const SCALE_OPTIONS: { value: GanttScaleOption; label: string }[] = [
  { value: 'day', label: 'Days' },
  { value: 'week', label: 'Weeks' },
  { value: 'month', label: 'Months' },
  { value: 'quarter', label: 'Quarters' },
];



export default function Header() {
  const { members, membersLoading, selectedUserId, selectedUserName, loading, tasks, noDateTasks, activeView, mode, individualFilter, availableStatuses, ganttScale, allIndividualTasks, allIndividualNoDateTasks, fetchMembers, fetchTasks, setSelectedUser, setActiveView, applyIndividualFilter, clearIndividualFilter, setGanttScale } = useTaskStore();
  const [showBandwidthPanel, setShowBandwidthPanel] = useState(false);

  const bandwidth = useMemo(
    () => computeBandwidthSummary(allIndividualTasks, allIndividualNoDateTasks),
    [allIndividualTasks, allIndividualNoDateTasks]
  );
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

  const isTeamMode = mode === 'team';
  const hasIndividualFilter = individualFilter.dateFrom || individualFilter.dateTo || individualFilter.statusFilter.size > 0 || individualFilter.delayFilter.size > 0 || individualFilter.actualDelayedFilter.size > 0;
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
                  {(individualFilter.dateFrom || individualFilter.dateTo ? 1 : 0) + (individualFilter.statusFilter.size > 0 ? 1 : 0) + (individualFilter.delayFilter.size > 0 ? 1 : 0) + (individualFilter.actualDelayedFilter.size > 0 ? 1 : 0)}
                </span>
              )}
            </div>
            {showFilter && <IndividualFilterDropdown onClose={() => setShowFilter(false)} />}
          </div>

          {/* Duration Dropdown */}
          {hasTasks && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>Scale</label>
              <select
                className="pie-filter-select"
                value={ganttScale}
                onChange={e => {
                  setGanttScale(e.target.value as GanttScaleOption);
                }}
              >
                {SCALE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="header-spacer" />

          {/* Bandwidth Button */}
          {hasTasks && (
            <div
              className="bw-header-btn"
              onClick={() => setShowBandwidthPanel(true)}
              title="View bandwidth details"
            >
              <span className="bw-header-btn-icon">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="8" width="3" height="5" rx="0.5" fill="currentColor" opacity="0.5"/>
                  <rect x="5.5" y="4" width="3" height="9" rx="0.5" fill="currentColor" opacity="0.7"/>
                  <rect x="10" y="1" width="3" height="12" rx="0.5" fill="currentColor"/>
                </svg>
              </span>
              <span className="bw-header-btn-text">Bandwidth</span>
              <span className={`bw-header-btn-dot ${!bandwidth.hasWorkInNext14Days ? 'bw-dot-yes' : 'bw-dot-no'}`} />
            </div>
          )}
        </div>
      )}

      {/* View Switcher — Pie replaces Gantt in team mode */}
      <div className="view-switcher">
        {(isTeamMode
          ? [
              { key: 'gantt' as const, icon: '', label: 'Pie' },
              { key: 'list' as const, icon: '', label: 'List' },
              { key: 'status' as const, icon: '', label: 'Status' },
              { key: 'bandwidth' as const, icon: '', label: 'Bandwidth' },
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

      {/* Bandwidth Panel */}
      {showBandwidthPanel && (
        <BandwidthPanel onClose={() => setShowBandwidthPanel(false)} />
      )}
    </>
  );
}
