export interface ClickUpMember {
  id: number;
  username: string;
  email: string;
  initials: string;
  profilePicture: string | null;
}

export interface CustomField {
  id: string;
  name: string;
  type: string;
  value: any;
  typeConfig?: any;
}

export interface NormalizedTask {
  id: string;
  name: string;
  status: string;
  statusColor: string;
  statusType: string;
  assignees: { id: number; username: string; initials: string; profilePicture: string | null }[];
  startDate: Date | null;
  endDate: Date | null;
  dateCreated: Date;
  dateCompleted: Date | null;
  parent: string | null;
  space: { id: string; name: string };
  folder: { id: string; name: string };
  list: { id: string; name: string };
  url: string;
  customFields: CustomField[];
}

export type TreeRow =
  | { type: 'space'; name: string; id: string; depth: number; collapsed: boolean; taskCount: number }
  | { type: 'folder'; name: string; id: string; depth: number; collapsed: boolean; taskCount: number }
  | { type: 'list'; name: string; id: string; depth: number; collapsed: boolean; taskCount: number }
  | { type: 'task'; task: NormalizedTask; depth: number; isSubtask: boolean };

export interface TimelineConfig {
  startDate: Date;
  endDate: Date;
  pxPerDay: number;
  totalDays: number;
  totalWidth: number;
}
