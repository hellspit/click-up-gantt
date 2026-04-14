'use client';

import { create } from 'zustand';
import { ClickUpMember, NormalizedTask, CustomField, TimelineConfig, TreeRow } from '../types';
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

type DelayType = 'starting' | 'project_length' | 'completion';

interface IndividualFilter {
  dateFrom: string | null; // ISO date string YYYY-MM-DD
  dateTo: string | null;
  statusFilter: Set<string>; // empty = show all
  delayFilter: Set<DelayType>; // empty = show all (no delay filtering)
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

  // Task data (visible — may be filtered)
  tasks: NormalizedTask[];
  noDateTasks: NormalizedTask[];
  treeRows: TreeRow[];
  timelineConfig: TimelineConfig | null;

  // Individual unfiltered backup
  allIndividualTasks: NormalizedTask[];
  allIndividualNoDateTasks: NormalizedTask[];
  individualFilter: IndividualFilter;
  availableStatuses: string[]; // unique statuses from fetched tasks

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
  applyIndividualFilter: (filter: Partial<IndividualFilter>) => void;
  clearIndividualFilter: () => void;

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

const PLANNED_START_FIELD_NAMES = ['planned start date', 'planned start'];
const PLANNED_DUE_FIELD_NAMES = ['planned due date', 'planned due'];
const ONE_DAY_MS = 86400000;

function findCfValue(fields: CustomField[], names: string[]): number | null {
  const cf = fields.find(f => names.includes(f.name.toLowerCase()) && f.value !== null && f.value !== undefined && f.value !== '');
  if (!cf) return null;
  const ts = Number(cf.value);
  if (isNaN(ts) || ts === 0) return null;
  return ts > 1000000000000 ? ts : ts > 1000000000 ? ts * 1000 : null;
}

function getTaskDelays(t: NormalizedTask): Set<DelayType> {
  const delays = new Set<DelayType>();
  const pStart = findCfValue(t.customFields, PLANNED_START_FIELD_NAMES);
  const pDue = findCfValue(t.customFields, PLANNED_DUE_FIELD_NAMES);
  const aStart = t.startDate ? t.startDate.getTime() : null;
  const aDue = t.endDate ? t.endDate.getTime() : null;

  if (pStart && pDue && aStart && aDue) {
    if (aStart > pStart) delays.add('starting');
    const plannedWindow = pDue - pStart;
    const actualWindow = aDue - aStart;
    if ((actualWindow - plannedWindow) > ONE_DAY_MS) delays.add('project_length');
    // Completion delay: dateCompleted - actual due date > 1 day
    const doneTs = t.dateCompleted ? t.dateCompleted.getTime() : null;
    if (doneTs && (doneTs - aDue) > ONE_DAY_MS) delays.add('completion');
  }
  return delays;
}

function filterTasksIndividual(
  allTasks: NormalizedTask[],
  filter: IndividualFilter
): NormalizedTask[] {
  let result = allTasks;

  // Date range filter — check if task overlaps with the filter range
  if (filter.dateFrom || filter.dateTo) {
    const from = filter.dateFrom ? new Date(filter.dateFrom) : null;
    const to = filter.dateTo ? new Date(filter.dateTo + 'T23:59:59') : null;
    result = result.filter(t => {
      const taskStart = t.startDate;
      const taskEnd = t.endDate;
      // For dated tasks, check overlap
      if (taskStart && taskEnd) {
        if (from && taskEnd < from) return false;
        if (to && taskStart > to) return false;
        return true;
      }
      // For undated tasks with dateCreated, check if created in range
      if (t.dateCreated) {
        if (from && t.dateCreated < from) return false;
        if (to && t.dateCreated > to) return false;
        return true;
      }
      return true;
    });
  }

  // Status filter
  if (filter.statusFilter.size > 0) {
    result = result.filter(t => filter.statusFilter.has(t.status.toLowerCase()));
  }

  // Delay filter
  if (filter.delayFilter.size > 0) {
    result = result.filter(t => {
      const taskDelays = getTaskDelays(t);
      // Show task if it has ANY of the selected delay types
      for (const d of filter.delayFilter) {
        if (taskDelays.has(d)) return true;
      }
      return false;
    });
  }

  return result;
}

function extractUniqueStatuses(tasks: NormalizedTask[]): string[] {
  // Always include standard statuses so the user has the full array of options
  const set = new Set<string>(['open', 'to do', 'in progress', 'review', 'done', 'closed']);
  tasks.forEach(t => set.add(t.status.toLowerCase()));
  
  // Order them logically from creation to completion
  const standardOrder = ['open', 'to do', 'open/to do', 'in progress', 'review', 'in review', 'done', 'complete', 'closed'];
  
  return Array.from(set).sort((a, b) => {
    const idxA = standardOrder.indexOf(a);
    const idxB = standardOrder.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b); // Alphabetical for any custom statuses
  });
}

/**
 * Resolve team member names to ClickUp user IDs by fuzzy-matching
 * against the workspace members list.
 *
 * Matching strategies (in priority order):
 * 1. Exact username or email-prefix match
 * 2. Username contains full name (no spaces) or vice-versa
 * 3. All words of the config name appear in the username/email
 * 4. Any single word (≥3 chars) of the config name matches as a prefix of a username word
 */
function resolveTeamMembers(
  memberNames: string[],
  allMembers: ClickUpMember[]
): { resolved: ResolvedMember[]; unresolved: string[] } {
  const resolved: ResolvedMember[] = [];
  const unresolved: string[] = [];

  for (const name of memberNames) {
    const lower = name.toLowerCase().trim();
    const nameParts = lower.split(/\s+/).filter(Boolean);
    const nameNoSpaces = nameParts.join('');

    let match: ClickUpMember | undefined;

    // Strategy 1: Exact match on username or email prefix
    match = allMembers.find(
      (m) =>
        m.username.toLowerCase() === lower ||
        m.email.toLowerCase().split('@')[0] === lower
    );

    // Strategy 2: Username/email contains the name (ignoring spaces) or vice versa
    if (!match) {
      match = allMembers.find((m) => {
        const uLower = m.username.toLowerCase().replace(/[\s_.-]/g, '');
        const eLower = m.email.toLowerCase().split('@')[0].replace(/[\s_.-]/g, '');
        return (
          uLower.includes(nameNoSpaces) ||
          nameNoSpaces.includes(uLower) ||
          eLower.includes(nameNoSpaces) ||
          nameNoSpaces.includes(eLower)
        );
      });
    }

    // Strategy 3: All words appear in username or email
    if (!match && nameParts.length > 1) {
      match = allMembers.find((m) => {
        const uLower = m.username.toLowerCase();
        const eLower = m.email.toLowerCase().split('@')[0];
        return (
          nameParts.every((w) => uLower.includes(w)) ||
          nameParts.every((w) => eLower.includes(w))
        );
      });
    }

    // Strategy 4: Any significant word matches the start of a username/email word
    if (!match) {
      const significantParts = nameParts.filter((w) => w.length >= 3);
      if (significantParts.length > 0) {
        match = allMembers.find((m) => {
          const uWords = m.username.toLowerCase().split(/[\s_.-]+/);
          const eWords = m.email.toLowerCase().split('@')[0].split(/[\s_.-]+/);
          const allWords = [...uWords, ...eWords];
          return significantParts.some((sp) =>
            allWords.some((w) => w.startsWith(sp) || sp.startsWith(w))
          );
        });
      }
    }

    if (match) {
      // Avoid duplicate resolved members
      if (!resolved.some((r) => r.id === match!.id)) {
        resolved.push({
          id: match.id,
          name,
          username: match.username,
          profilePicture: match.profilePicture,
        });
      }
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

  // Individual unfiltered backup
  allIndividualTasks: [],
  allIndividualNoDateTasks: [],
  individualFilter: { dateFrom: null, dateTo: null, statusFilter: new Set(), delayFilter: new Set() },
  availableStatuses: [],

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
      const allStatuses = extractUniqueStatuses([...processed.tasks, ...processed.noDateTasks]);

      set({
        ...processed,
        allIndividualTasks: processed.tasks,
        allIndividualNoDateTasks: processed.noDateTasks,
        availableStatuses: allStatuses,
        individualFilter: { dateFrom: null, dateTo: null, statusFilter: new Set(), delayFilter: new Set() },
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
      console.warn(`[Team ${team.name}] Available workspace members:`, members.map(m => `${m.username} (${m.email})`));
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

  applyIndividualFilter: (partial: Partial<IndividualFilter>) => {
    const { individualFilter, allIndividualTasks, allIndividualNoDateTasks } = get();
    const newFilter: IndividualFilter = {
      dateFrom: partial.dateFrom !== undefined ? partial.dateFrom : individualFilter.dateFrom,
      dateTo: partial.dateTo !== undefined ? partial.dateTo : individualFilter.dateTo,
      statusFilter: partial.statusFilter !== undefined ? partial.statusFilter : individualFilter.statusFilter,
      delayFilter: partial.delayFilter !== undefined ? partial.delayFilter : individualFilter.delayFilter,
    };

    const filteredDated = filterTasksIndividual(allIndividualTasks, newFilter);
    const filteredUndated = filterTasksIndividual(allIndividualNoDateTasks, newFilter);
    const processed = processNormalizedTasks(filteredDated, filteredUndated);

    set({
      individualFilter: newFilter,
      ...processed,
      collapsedGroups: new Set(),
    });
  },

  clearIndividualFilter: () => {
    const { allIndividualTasks, allIndividualNoDateTasks } = get();
    const processed = processNormalizedTasks(allIndividualTasks, allIndividualNoDateTasks);
    set({
      individualFilter: { dateFrom: null, dateTo: null, statusFilter: new Set(), delayFilter: new Set() },
      ...processed,
      collapsedGroups: new Set(),
    });
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
