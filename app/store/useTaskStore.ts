'use client';

import { create } from 'zustand';
import { ClickUpMember, NormalizedTask, TimelineConfig, TreeRow } from '../types';
import { normalizeTask } from '../utils/taskNormalizer';
import { getTimelineConfig } from '../utils/dateUtils';
import { buildTaskHierarchy } from '../utils/taskGrouper';
import { getTeamByKey } from '../teamConfig';

type ActiveView = 'gantt' | 'list' | 'status';
type AppMode = 'individual' | 'team';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedTeamData {
  tasks: NormalizedTask[];
  noDateTasks: NormalizedTask[];
  treeRows: TreeRow[];
  timelineConfig: TimelineConfig | null;
  timestamp: number;
}

interface ResolvedMember {
  id: number;
  name: string;
  username: string;
  profilePicture: string | null;
}

interface TaskStore {
  // Mode
  mode: AppMode;
  activeTeamKey: string | null;
  activeUserIds: number[];

  // Member data
  members: ClickUpMember[];
  selectedUserId: string | null;
  selectedUserName: string;

  // Task data (visible — may be filtered in team mode)
  tasks: NormalizedTask[];
  noDateTasks: NormalizedTask[];
  treeRows: TreeRow[];
  timelineConfig: TimelineConfig | null;

  // Team unfiltered backup
  allTeamTasks: NormalizedTask[];
  allTeamNoDateTasks: NormalizedTask[];

  // Team member filter
  resolvedTeamMembers: ResolvedMember[];
  teamMemberFilter: Set<number>; // empty = show all
  
  // UI state
  loading: boolean;
  loadingProgress: string;
  error: string | null;
  membersLoading: boolean;
  collapsedGroups: Set<string>;
  activeView: ActiveView;
  detailTask: NormalizedTask | null;

  // Cache
  teamTasksCache: Record<string, CachedTeamData>;

  // Individual actions
  fetchMembers: () => Promise<void>;
  fetchTasks: () => Promise<void>;
  setSelectedUser: (id: string, name: string) => void;

  // Team actions
  fetchTeamTasks: (teamKey: string) => Promise<void>;
  setTeamMode: (teamKey: string) => void;
  setIndividualMode: () => void;
  toggleMemberFilter: (memberId: number) => void;
  clearMemberFilter: () => void;
  selectAllMembers: () => void;

  // Shared actions
  toggleGroup: (groupId: string) => void;
  setActiveView: (view: ActiveView) => void;
  openTaskDetail: (task: NormalizedTask) => void;
  closeTaskDetail: () => void;
  reset: () => void;
}

function processTaskData(rawTasks: any[]) {
  const normalized = rawTasks.map(normalizeTask);
  const dated = normalized.filter((t: NormalizedTask) => t.startDate && t.endDate);
  const undated = normalized.filter((t: NormalizedTask) => !t.startDate || !t.endDate);
  const treeRows = buildTaskHierarchy(dated);
  const config = dated.length > 0 ? getTimelineConfig(dated) : null;
  return { tasks: dated, noDateTasks: undated, treeRows, timelineConfig: config };
}

function processNormalizedTasks(dated: NormalizedTask[], undated: NormalizedTask[]) {
  const treeRows = buildTaskHierarchy(dated);
  const config = dated.length > 0 ? getTimelineConfig(dated) : null;
  return { tasks: dated, noDateTasks: undated, treeRows, timelineConfig: config };
}

function filterTasksByMembers(allTasks: NormalizedTask[], filterIds: Set<number>): NormalizedTask[] {
  if (filterIds.size === 0) return allTasks;
  return allTasks.filter(t =>
    t.assignees.some(a => filterIds.has(a.id))
  );
}

/**
 * Resolve team member names to ClickUp user IDs by fuzzy-matching
 * against the workspace members list.
 */
function resolveTeamMembers(
  memberNames: string[],
  allMembers: ClickUpMember[]
): { resolved: ResolvedMember[]; unresolved: string[] } {
  const resolved: ResolvedMember[] = [];
  const unresolved: string[] = [];

  for (const name of memberNames) {
    const lower = name.toLowerCase().trim();
    const match = allMembers.find(
      (m) =>
        m.username.toLowerCase() === lower ||
        m.email.toLowerCase().split('@')[0] === lower ||
        m.username.toLowerCase().includes(lower) ||
        lower.includes(m.username.toLowerCase())
    );
    if (match) {
      resolved.push({
        id: match.id,
        name,
        username: match.username,
        profilePicture: match.profilePicture,
      });
    } else {
      unresolved.push(name);
    }
  }

  return { resolved, unresolved };
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  // Mode
  mode: 'individual',
  activeTeamKey: null,
  activeUserIds: [],

  // Member data
  members: [],
  selectedUserId: null,
  selectedUserName: '',

  // Task data
  tasks: [],
  noDateTasks: [],
  treeRows: [],
  timelineConfig: null,

  // Team unfiltered backup
  allTeamTasks: [],
  allTeamNoDateTasks: [],

  // Team member filter
  resolvedTeamMembers: [],
  teamMemberFilter: new Set(),

  // UI state
  loading: false,
  loadingProgress: '',
  error: null,
  membersLoading: false,
  collapsedGroups: new Set(),
  activeView: 'gantt',
  detailTask: null,

  // Cache
  teamTasksCache: {},

  fetchMembers: async () => {
    set({ membersLoading: true, error: null });
    try {
      const res = await fetch('/api/members');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch members');
      }
      const data = await res.json();
      set({ members: data.members, membersLoading: false });
    } catch (err: any) {
      set({ error: err.message, membersLoading: false });
    }
  },

  fetchTasks: async () => {
    const { selectedUserId } = get();
    if (!selectedUserId) {
      set({ error: 'Please select an assignee first' });
      return;
    }

    set({ loading: true, loadingProgress: 'Fetching tasks from ClickUp...', error: null });

    try {
      const res = await fetch(`/api/tasks?userId=${selectedUserId}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch tasks');
      }

      set({ loadingProgress: 'Processing and organizing tasks...' });
      const data = await res.json();
      const processed = processTaskData(data.tasks || []);

      set({
        ...processed,
        loading: false,
        loadingProgress: '',
        collapsedGroups: new Set(),
      });
    } catch (err: any) {
      set({ error: err.message, loading: false, loadingProgress: '' });
    }
  },

  fetchTeamTasks: async (teamKey: string) => {
    const team = getTeamByKey(teamKey);
    if (!team) {
      set({ error: `Unknown team: ${teamKey}` });
      return;
    }

    if (team.memberNames.length === 0) {
      set({ error: `No members configured for team ${team.name}. Please update teamConfig.ts.` });
      return;
    }

    // Check cache first
    const { teamTasksCache } = get();
    const cached = teamTasksCache[teamKey];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      set({
        tasks: cached.tasks,
        noDateTasks: cached.noDateTasks,
        treeRows: cached.treeRows,
        timelineConfig: cached.timelineConfig,
        allTeamTasks: cached.tasks,
        allTeamNoDateTasks: cached.noDateTasks,
        activeTeamKey: teamKey,
        selectedUserName: team.name,
        teamMemberFilter: new Set(),
        loading: false,
        error: null,
        collapsedGroups: new Set(),
      });
      return;
    }

    // Ensure members are loaded for name → ID resolution
    let { members } = get();
    if (members.length === 0) {
      set({ loading: true, loadingProgress: 'Loading workspace members...' });
      try {
        const memRes = await fetch('/api/members');
        if (!memRes.ok) throw new Error('Failed to fetch members');
        const memData = await memRes.json();
        members = memData.members || [];
        set({ members, membersLoading: false });
      } catch (err: any) {
        set({ error: `Cannot resolve team members: ${err.message}`, loading: false, loadingProgress: '' });
        return;
      }
    }

    // Resolve names → IDs + member details
    const { resolved, unresolved } = resolveTeamMembers(team.memberNames, members);

    if (resolved.length === 0) {
      set({
        error: `Could not match any team members to ClickUp users. Unresolved: ${unresolved.join(', ')}`,
        loading: false,
        loadingProgress: '',
      });
      return;
    }

    set({
      loading: true,
      loadingProgress: `Fetching tasks for team ${team.name} (${resolved.length} members)...`,
      error: null,
      activeTeamKey: teamKey,
      activeUserIds: resolved.map(m => m.id),
      resolvedTeamMembers: resolved,
      selectedUserName: team.name,
      teamMemberFilter: new Set(),
    });

    if (unresolved.length > 0) {
      console.warn(`[Team ${team.name}] Could not resolve members:`, unresolved);
    }

    try {
      const userIds = resolved.map(m => m.id).join(',');
      const res = await fetch(`/api/team-tasks?userIds=${userIds}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch team tasks');
      }

      set({ loadingProgress: 'Processing and organizing team tasks...' });
      const data = await res.json();
      const processed = processTaskData(data.tasks || []);

      // Update cache
      const newCache = {
        ...get().teamTasksCache,
        [teamKey]: {
          ...processed,
          timestamp: Date.now(),
        },
      };

      const warningMsg = unresolved.length > 0
        ? `Note: Could not find ${unresolved.length} member(s): ${unresolved.join(', ')}`
        : null;

      set({
        ...processed,
        allTeamTasks: processed.tasks,
        allTeamNoDateTasks: processed.noDateTasks,
        teamTasksCache: newCache,
        loading: false,
        loadingProgress: '',
        error: warningMsg,
        collapsedGroups: new Set(),
      });
    } catch (err: any) {
      set({ error: err.message, loading: false, loadingProgress: '' });
    }
  },

  toggleMemberFilter: (memberId: number) => {
    const { teamMemberFilter, allTeamTasks, allTeamNoDateTasks } = get();
    const newFilter = new Set(teamMemberFilter);

    if (newFilter.has(memberId)) {
      newFilter.delete(memberId);
    } else {
      newFilter.add(memberId);
    }

    const filteredDated = filterTasksByMembers(allTeamTasks, newFilter);
    const filteredUndated = filterTasksByMembers(allTeamNoDateTasks, newFilter);
    const processed = processNormalizedTasks(filteredDated, filteredUndated);

    set({
      teamMemberFilter: newFilter,
      ...processed,
      collapsedGroups: new Set(),
    });
  },

  clearMemberFilter: () => {
    const { allTeamTasks, allTeamNoDateTasks } = get();
    const processed = processNormalizedTasks(allTeamTasks, allTeamNoDateTasks);
    set({
      teamMemberFilter: new Set(),
      ...processed,
      collapsedGroups: new Set(),
    });
  },

  selectAllMembers: () => {
    // selecting all = same as clearing filter
    const { allTeamTasks, allTeamNoDateTasks } = get();
    const processed = processNormalizedTasks(allTeamTasks, allTeamNoDateTasks);
    set({
      teamMemberFilter: new Set(),
      ...processed,
      collapsedGroups: new Set(),
    });
  },

  setTeamMode: (teamKey: string) => {
    const team = getTeamByKey(teamKey);
    if (!team) return;
    set({
      mode: 'team',
      activeTeamKey: teamKey,
      selectedUserName: team.name,
    });
  },

  setIndividualMode: () => {
    set({
      mode: 'individual',
      activeTeamKey: null,
      activeUserIds: [],
      tasks: [],
      noDateTasks: [],
      treeRows: [],
      timelineConfig: null,
      allTeamTasks: [],
      allTeamNoDateTasks: [],
      resolvedTeamMembers: [],
      teamMemberFilter: new Set(),
      selectedUserName: '',
      selectedUserId: null,
      collapsedGroups: new Set(),
      detailTask: null,
      error: null,
    });
  },

  setSelectedUser: (id: string, name: string) => {
    set({ selectedUserId: id, selectedUserName: name });
  },

  toggleGroup: (groupId: string) => {
    const { collapsedGroups } = get();
    const newSet = new Set(collapsedGroups);
    if (newSet.has(groupId)) newSet.delete(groupId);
    else newSet.add(groupId);
    set({ collapsedGroups: newSet });
  },

  setActiveView: (view: ActiveView) => {
    set({ activeView: view });
  },

  openTaskDetail: (task: NormalizedTask) => {
    set({ detailTask: task });
  },

  closeTaskDetail: () => {
    set({ detailTask: null });
  },

  reset: () => {
    set({
      tasks: [],
      noDateTasks: [],
      treeRows: [],
      timelineConfig: null,
      error: null,
      collapsedGroups: new Set(),
      detailTask: null,
    });
  },
}));
