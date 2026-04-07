'use client';

import { useState, useEffect, useRef } from 'react';
import { useTaskStore } from '../store/useTaskStore';

const VIEW_TABS = [
  { key: 'gantt' as const, icon: '📅', label: 'Gantt' },
  { key: 'list' as const, icon: '📋', label: 'List' },
  { key: 'status' as const, icon: '📈', label: 'Status' },
];

export default function Header() {
  const { members, membersLoading, selectedUserId, selectedUserName, loading, tasks, activeView, fetchMembers, fetchTasks, setSelectedUser, setActiveView } = useTaskStore();
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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

  return (
    <>
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

        <div className="header-spacer" />

        <button className="btn-export" onClick={handleExport} disabled={tasks.length === 0 || activeView !== 'gantt'}>
          Export SVG
        </button>
      </div>

      {/* View Switcher */}
      <div className="view-switcher">
        {VIEW_TABS.map(tab => (
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
