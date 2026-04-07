'use client';

import { create } from 'zustand';
import { ClickUpMember, NormalizedTask, TimelineConfig, TreeRow } from '../types';
import { normalizeTask } from '../utils/taskNormalizer';
import { getTimelineConfig } from '../utils/dateUtils';
import { buildTaskHierarchy } from '../utils/taskGrouper';

type ActiveView = 'gantt' | 'list' | 'status';

interface TaskStore {
  members: ClickUpMember[];
  selectedUserId: string | null;
  selectedUserName: string;
  tasks: NormalizedTask[];
  noDateTasks: NormalizedTask[];
  treeRows: TreeRow[];
  timelineConfig: TimelineConfig | null;
  loading: boolean;
  loadingProgress: string;
  error: string | null;
  membersLoading: boolean;
  collapsedGroups: Set<string>;
  activeView: ActiveView;
  detailTask: NormalizedTask | null;

  fetchMembers: () => Promise<void>;
  fetchTasks: () => Promise<void>;
  setSelectedUser: (id: string, name: string) => void;
  toggleGroup: (groupId: string) => void;
  setActiveView: (view: ActiveView) => void;
  openTaskDetail: (task: NormalizedTask) => void;
  closeTaskDetail: () => void;
  reset: () => void;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  members: [],
  selectedUserId: null,
  selectedUserName: '',
  tasks: [],
  noDateTasks: [],
  treeRows: [],
  timelineConfig: null,
  loading: false,
  loadingProgress: '',
  error: null,
  membersLoading: false,
  collapsedGroups: new Set(),
  activeView: 'gantt',
  detailTask: null,

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

      const normalized = (data.tasks || []).map(normalizeTask);

      const dated = normalized.filter((t: NormalizedTask) => t.startDate && t.endDate);
      const undated = normalized.filter((t: NormalizedTask) => !t.startDate || !t.endDate);
      const treeRows = buildTaskHierarchy(dated);
      const config = dated.length > 0 ? getTimelineConfig(dated) : null;

      set({
        tasks: dated,
        noDateTasks: undated,
        treeRows,
        timelineConfig: config,
        loading: false,
        loadingProgress: '',
        collapsedGroups: new Set(),
      });
    } catch (err: any) {
      set({ error: err.message, loading: false, loadingProgress: '' });
    }
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
    set({ tasks: [], noDateTasks: [], treeRows: [], timelineConfig: null, error: null, collapsedGroups: new Set(), detailTask: null });
  },
}));
