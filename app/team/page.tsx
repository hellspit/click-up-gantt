'use client';

import { useEffect, useState, useRef } from 'react';
import { useTaskStore } from '../store/useTaskStore';
import { TEAMS, TeamDef } from '../teamConfig';
import Header from '../components/Header';
import SummaryBar from '../components/SummaryBar';
import Dashboard from '../components/Dashboard';
import NoDateTasks from '../components/NoDateTasks';
import ListView from '../components/ListView';
import StatusView from '../components/StatusView';
import TaskDetailPanel from '../components/TaskDetailPanel';

function TeamCard({
  team,
  active,
  onClick,
}: {
  team: TeamDef;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={`team-card ${active ? 'team-card-active' : ''}`}
      style={
        active
          ? { borderColor: team.color, boxShadow: `0 0 20px ${team.color}25, 0 0 0 1px ${team.color}40` }
          : undefined
      }
      onClick={onClick}
    >
      <div className="team-card-accent" style={{ background: team.color }} />
      <div className="team-card-icon">{team.icon}</div>
      <div className="team-card-body">
        <div className="team-card-name">{team.name}</div>
        <div className="team-card-desc">{team.description}</div>
        <div className="team-card-members">
          {team.memberNames.length > 0 ? (
            <>
              <div className="team-card-avatars">
                {team.memberNames.slice(0, 5).map((name, i) => (
                  <div key={i} className="team-card-avatar" title={name}>
                    {name.slice(0, 2).toUpperCase()}
                  </div>
                ))}
                {team.memberNames.length > 5 && (
                  <div className="team-card-avatar team-card-avatar-more">
                    +{team.memberNames.length - 5}
                  </div>
                )}
              </div>
              <span className="team-card-member-count">
                {team.memberNames.length} member{team.memberNames.length !== 1 ? 's' : ''}
              </span>
            </>
          ) : (
            <span className="team-card-no-members">No members configured</span>
          )}
        </div>
      </div>
      {active && <div className="team-card-check">✓</div>}
    </div>
  );
}

function MemberFilterDropdown({ onClose }: { onClose: () => void }) {
  const resolvedTeamMembers = useTaskStore(s => s.resolvedTeamMembers);
  const teamMemberFilter = useTaskStore(s => s.teamMemberFilter);
  const toggleMemberFilter = useTaskStore(s => s.toggleMemberFilter);
  const clearMemberFilter = useTaskStore(s => s.clearMemberFilter);

  const isFiltering = teamMemberFilter.size > 0;

  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        left: '0',
        marginTop: '4px',
        width: '260px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-secondary)',
        borderRadius: '10px',
        boxShadow: '0 12px 36px rgba(0,0,0,0.5)',
        zIndex: 9999,
        overflow: 'hidden',
        animation: 'fadeIn 0.15s ease',
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
          Filter by Member
        </span>
        {isFiltering && (
          <span
            onClick={clearMemberFilter}
            style={{ fontSize: '10px', color: 'var(--status-todo)', cursor: 'pointer', fontWeight: 600 }}
          >
            Clear All
          </span>
        )}
      </div>

      {/* Member list */}
      <div style={{ maxHeight: '280px', overflowY: 'auto', padding: '4px 0' }}>
        {resolvedTeamMembers.map(m => {
          const checked = teamMemberFilter.has(m.id);
          const showChecked = isFiltering ? checked : false;
          return (
            <div
              key={m.id}
              onClick={() => toggleMemberFilter(m.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 14px',
                cursor: 'pointer',
                transition: 'background 0.15s',
                background: showChecked ? 'rgba(88, 166, 255, 0.06)' : 'transparent',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = showChecked ? 'rgba(88, 166, 255, 0.1)' : 'rgba(255,255,255,0.03)')}
              onMouseLeave={e => (e.currentTarget.style.background = showChecked ? 'rgba(88, 166, 255, 0.06)' : 'transparent')}
            >
              {/* Checkbox */}
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '4px',
                  border: showChecked ? '1px solid var(--status-todo)' : '1px solid var(--border-secondary)',
                  background: showChecked ? 'var(--status-todo)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  color: '#fff',
                  flexShrink: 0,
                  transition: 'all 0.15s',
                }}
              >
                {showChecked && '✓'}
              </div>

              {/* Avatar */}
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'var(--bg-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '9px',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  flexShrink: 0,
                  border: '1px solid var(--border-primary)',
                }}
              >
                {m.profilePicture ? (
                  <img src={m.profilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  m.name.slice(0, 2).toUpperCase()
                )}
              </div>

              {/* Name */}
              <span style={{ fontSize: '12px', color: showChecked ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: showChecked ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Apply button */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-primary)' }}>
        <div
          onClick={onClose}
          style={{
            width: '100%',
            padding: '7px 0',
            background: 'var(--accent-green)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 700,
            textAlign: 'center',
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-green-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent-green)')}
        >
          Apply{isFiltering ? ` (${teamMemberFilter.size} selected)` : ''}
        </div>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const {
    activeTeamKey,
    tasks,
    noDateTasks,
    error,
    loading,
    activeView,
    fetchTeamTasks,
    setTeamMode,
    fetchMembers,
    teamMemberFilter,
    resolvedTeamMembers,
  } = useTaskStore();

  const [showSelector, setShowSelector] = useState(true);
  const [showFilter, setShowFilter] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Set team mode on mount + ensure members are loaded
  useEffect(() => {
    const store = useTaskStore.getState();
    store.mode = 'team';
    if (store.members.length === 0) {
      fetchMembers();
    }
  }, [fetchMembers]);

  // Close filter dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilter(false);
      }
    };
    if (showFilter) {
      document.addEventListener('mousedown', handler);
    }
    return () => document.removeEventListener('mousedown', handler);
  }, [showFilter]);

  const hasTasks = tasks.length > 0 || noDateTasks.length > 0;
  const isFiltering = teamMemberFilter.size > 0;

  const handleSelectTeam = (teamKey: string) => {
    setTeamMode(teamKey);
  };

  const handleGenerate = () => {
    if (activeTeamKey) {
      fetchTeamTasks(activeTeamKey);
      setShowSelector(false);
    }
  };

  const handleChangeTeam = () => {
    setShowSelector(true);
  };

  const selectedTeam = TEAMS.find((t) => t.key === activeTeamKey);

  return (
    <>
      <Header />

      {/* Compact team bar — shown when selector is hidden and tasks are loaded */}
      {!showSelector && hasTasks && selectedTeam && (
        <div className="team-active-bar">
          <div className="team-active-indicator" style={{ background: selectedTeam.color }} />
          <span className="team-active-icon">{selectedTeam.icon}</span>
          <span className="team-active-name">{selectedTeam.name}</span>
          <span className="team-active-meta">
            {selectedTeam.description} · {tasks.length + noDateTasks.length} tasks
          </span>

          {/* Filter button */}
          {resolvedTeamMembers.length > 0 && (
            <div ref={filterRef} style={{ position: 'relative', marginLeft: '12px' }}>
              <div
                onClick={() => setShowFilter(!showFilter)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  background: isFiltering ? 'rgba(88, 166, 255, 0.1)' : 'transparent',
                  border: isFiltering ? '1px solid var(--status-todo)' : '1px solid var(--border-secondary)',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: isFiltering ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                }}
              >
                👥 Filter
                {isFiltering && (
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
                    {teamMemberFilter.size}
                  </span>
                )}
              </div>
              {showFilter && <MemberFilterDropdown onClose={() => setShowFilter(false)} />}
            </div>
          )}

          <div className="team-active-spacer" />
          <div
            className="team-change-btn"
            onClick={handleChangeTeam}
            style={{
              padding: '5px 14px',
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-secondary)',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
            }}
          >
            ↻ Change Team
          </div>
        </div>
      )}

      {/* Full team selector — shown initially or when user clicks "Change Team" */}
      {showSelector && (
        <div className="team-selector">
          <div className="team-selector-header">
            <h2 className="team-selector-title">Select Team</h2>
            <span className="team-selector-subtitle">
              View combined tasks for all team members
            </span>
          </div>
          <div className="team-cards">
            {TEAMS.map((team) => (
              <TeamCard
                key={team.key}
                team={team}
                active={activeTeamKey === team.key}
                onClick={() => handleSelectTeam(team.key)}
              />
            ))}
          </div>
          <div className="team-selector-actions">
            <button
              className="btn-generate"
              onClick={handleGenerate}
              disabled={!activeTeamKey || loading}
            >
              {loading ? 'Loading...' : `Generate ${selectedTeam?.name || 'Team'} View`}
            </button>
            {selectedTeam && (
              <span className="team-selector-info">
                {selectedTeam.memberNames.length} member{selectedTeam.memberNames.length !== 1 ? 's' : ''} will be included
              </span>
            )}
          </div>
        </div>
      )}

      {/* Summary Bar */}
      {!showSelector && hasTasks && <SummaryBar />}

      {/* Error / Warning */}
      {error && (
        <div className="error-banner">
          ⚠️ {error}
          <button onClick={() => useTaskStore.getState().reset()}>Dismiss</button>
        </div>
      )}

      {/* Views — only show when selector is hidden */}
      {!showSelector && (
        <>
          {activeView === 'gantt' && (
            <>
              <Dashboard />
              <NoDateTasks />
            </>
          )}
          {activeView === 'list' && <ListView />}
          {activeView === 'status' && <StatusView />}
        </>
      )}

      <TaskDetailPanel />
    </>
  );
}
