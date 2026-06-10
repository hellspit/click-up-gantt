'use client';

import { useMemo, useState, Fragment } from 'react';
import { useTaskStore } from '../store/useTaskStore';
import { computeBandwidthSummary, isActiveBandwidthTask } from '../utils/bandwidthUtils';
import { NormalizedTask } from '../types';

type SortKey = 'name' | 'occupied' | 'freeFrom' | 'freeDays';
type SortDir = 'asc' | 'desc';

interface ResolvedMember {
  id: number;
  name: string;
  username: string;
  profilePicture: string | null;
}

export default function BandwidthView() {
  const allTeamTasks = useTaskStore(s => s.allTeamTasks);
  const allTeamNoDateTasks = useTaskStore(s => s.allTeamNoDateTasks);
  const resolvedTeamMembers = useTaskStore(s => s.resolvedTeamMembers);
  const teamMemberFilter = useTaskStore(s => s.teamMemberFilter);
  const openTaskDetail = useTaskStore(s => s.openTaskDetail);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'occupied' | 'free_now'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expandedMemberIds, setExpandedMemberIds] = useState<Set<number>>(new Set());

  // 1. Heavy per-member bandwidth calculations memoized
  const memberBandwidths = useMemo(() => {
    return resolvedTeamMembers.map(member => {
      const memberTasks = allTeamTasks.filter(t => t.assignees.some(a => a.id === member.id));
      const memberNoDateTasks = allTeamNoDateTasks.filter(t => t.assignees.some(a => a.id === member.id));
      const summary = computeBandwidthSummary(memberTasks, memberNoDateTasks);
      return { member, summary, memberTasks, memberNoDateTasks };
    });
  }, [allTeamTasks, allTeamNoDateTasks, resolvedTeamMembers]);

  // Apply store's teamMemberFilter if any is active
  const activeMembers = useMemo(() => {
    if (teamMemberFilter.size === 0) return memberBandwidths;
    return memberBandwidths.filter(item => teamMemberFilter.has(item.member.id));
  }, [memberBandwidths, teamMemberFilter]);



  // 3. Process search, status filter, and sorting downstream
  const processedMembers = useMemo(() => {
    let filtered = activeMembers.filter(item => {
      const nameMatch =
        item.member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.member.username.toLowerCase().includes(searchQuery.toLowerCase());

      if (!nameMatch) return false;

      if (statusFilter === 'occupied') {
        return item.summary.freeDaysCount === 0;
      }
      if (statusFilter === 'free_now') {
        return item.summary.isFreeNow;
      }
      return true;
    });

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case 'name':
          comparison = a.member.name.localeCompare(b.member.name);
          break;
        case 'occupied':
          const isOccA = a.summary.freeDaysCount === 0 ? 1 : 0;
          const isOccB = b.summary.freeDaysCount === 0 ? 1 : 0;
          comparison = isOccB - isOccA;
          break;
        case 'freeFrom':
          const timeA = a.summary.completelyFreeFrom ? a.summary.completelyFreeFrom.getTime() : 0;
          const timeB = b.summary.completelyFreeFrom ? b.summary.completelyFreeFrom.getTime() : 0;
          comparison = timeA - timeB;
          break;
        case 'freeDays':
          comparison = a.summary.freeDaysUntilCompletelyFree - b.summary.freeDaysUntilCompletelyFree;
          break;
      }

      // Tie-breaker: Name ascending
      if (comparison === 0 && sortKey !== 'name') {
        comparison = a.member.name.localeCompare(b.member.name);
      }

      return sortDir === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [activeMembers, searchQuery, statusFilter, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const toggleExpanded = (id: number) => {
    const next = new Set(expandedMemberIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedMemberIds(next);
  };

  const formatDate = (d: Date | null): string => {
    if (!d) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (resolvedTeamMembers.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">👥</div>
        <div className="empty-state-text">No team members to display</div>
        <div className="empty-state-sub">Ensure the team is configured and has resolved members in ClickUp</div>
      </div>
    );
  }

  const renderSortableHeader = (key: SortKey, label: string, width?: string) => {
    const isActive = sortKey === key;
    return (
      <th
        className={`bw-view-th ${isActive ? 'bw-view-th-active' : ''}`}
        style={width ? { width } : undefined}
        onClick={() => handleSort(key)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {label}
          {isActive && (
            <span className="bw-view-sort-arrow">{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="bw-view">


      {/* Filters Bar */}
      <div className="bw-view-filters">
        <input
          type="text"
          placeholder="Search by name..."
          className="bw-view-search"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <div className="bw-view-pills">
          <button
            className={`bw-view-pill ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All
          </button>
          <button
            className={`bw-view-pill ${statusFilter === 'occupied' ? 'active' : ''}`}
            onClick={() => setStatusFilter('occupied')}
          >
            Occupied (2w)
          </button>
          <button
            className={`bw-view-pill ${statusFilter === 'free_now' ? 'active' : ''}`}
            onClick={() => setStatusFilter('free_now')}
          >
            Free Now
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="bw-view-table-wrap">
        <table className="bw-view-table">
          <thead>
            <tr>
              <th className="bw-view-th" style={{ width: '40px' }} />
              {renderSortableHeader('name', 'Member')}
              {renderSortableHeader('occupied', 'Occupied (2 weeks)', '180px')}
              {renderSortableHeader('freeFrom', 'Free From', '160px')}
              {renderSortableHeader('freeDays', 'No. of free days (till completely free)', '320px')}
            </tr>
          </thead>
          <tbody>
            {processedMembers.length === 0 ? (
              <tr>
                <td colSpan={5} className="bw-view-empty">
                  No team members matching filter criteria
                </td>
              </tr>
            ) : (
              processedMembers.map(({ member, summary, memberTasks, memberNoDateTasks }) => {
                const isExpanded = expandedMemberIds.has(member.id);
                const isOccupied = summary.freeDaysCount === 0;

                const activeTasks = memberTasks.filter(isActiveBandwidthTask);
                const activeNoDateTasks = memberNoDateTasks.filter(isActiveBandwidthTask);
                const totalActiveTasks = [...activeTasks, ...activeNoDateTasks];

                return (
                  <Fragment key={member.id}>
                    {/* Main Row */}
                    <tr
                      className={`bw-view-tr ${isExpanded ? 'bw-view-tr-expanded' : ''}`}
                      onClick={() => toggleExpanded(member.id)}
                    >
                      <td className="bw-view-td" style={{ textAlign: 'center' }}>
                        <span className={`bw-view-caret ${isExpanded ? 'open' : ''}`}>▼</span>
                      </td>
                      <td className="bw-view-td">
                        <div className="bw-view-member-cell">
                          <div className="bw-view-avatar">
                            {member.profilePicture ? (
                              <img src={member.profilePicture} alt="" />
                            ) : (
                              member.name.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="bw-view-member-name">{member.name}</div>
                            <div className="bw-view-member-email">{member.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="bw-view-td">
                        <span className={`bw-view-badge ${isOccupied ? 'occupied' : 'free'}`}>
                          {isOccupied ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="bw-view-td">
                        <span style={summary.isFreeNow ? { color: '#3fb950', fontWeight: 600 } : undefined}>
                          {summary.freeFromLabel}
                        </span>
                      </td>
                      <td className="bw-view-td">
                        <div>
                          <span className={summary.freeDaysUntilCompletelyFree > 0 || summary.isFreeNow ? 'bw-view-free-count-yes' : 'bw-view-free-count-no'}>
                            {summary.isFreeNow ? 'N/A' : `${summary.freeDaysUntilCompletelyFree} days`}
                          </span>
                          {!summary.isFreeNow && summary.freeGaps.length > 0 && (
                            <div className="bw-view-gaps">
                              {summary.freeGaps.map(g => g.label).join(', ')}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Accordion Row */}
                    {isExpanded && (
                      <tr className="bw-view-expand-row">
                        <td />
                        <td colSpan={4} className="bw-view-expand-td">
                          <div className="bw-view-expand-content">
                            <div className="bw-view-expand-title">
                              Active Task Breakdown ({totalActiveTasks.length})
                            </div>
                            {totalActiveTasks.length === 0 ? (
                              <div className="bw-view-expand-empty">
                                No active (incomplete) tasks assigned.
                              </div>
                            ) : (
                              <table className="bw-view-subtable">
                                <thead>
                                  <tr>
                                    <th>Task Name</th>
                                    <th style={{ width: '120px' }}>Status</th>
                                    <th style={{ width: '120px' }}>Start Date</th>
                                    <th style={{ width: '120px' }}>Due Date</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {totalActiveTasks.map(task => {
                                    const overdue =
                                      task.endDate &&
                                      task.endDate < new Date() &&
                                      isActiveBandwidthTask(task);

                                    return (
                                      <tr
                                        key={task.id}
                                        className="bw-view-subtr"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openTaskDetail(task);
                                        }}
                                      >
                                        <td className="bw-view-subtd bw-view-subtd-name">
                                          {task.name}
                                        </td>
                                        <td className="bw-view-subtd">
                                          <span
                                            className="list-status-badge"
                                            style={{ background: task.statusColor || '#58a6ff' }}
                                          >
                                            {task.status}
                                          </span>
                                        </td>
                                        <td className="bw-view-subtd">
                                          {formatDate(task.startDate)}
                                        </td>
                                        <td className="bw-view-subtd">
                                          <span className={overdue ? 'bw-view-overdue' : ''}>
                                            {formatDate(task.endDate)}
                                          </span>
                                          {overdue && (
                                            <span className="list-overdue-tag">overdue</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
