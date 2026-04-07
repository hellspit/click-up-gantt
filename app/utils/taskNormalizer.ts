import { NormalizedTask, CustomField } from '../types';
import { convertClickUpDate } from './dateUtils';

export function normalizeTask(raw: any): NormalizedTask {
  const startDate = convertClickUpDate(raw.start_date);
  const endDate = convertClickUpDate(raw.due_date);
  const dateCreated = convertClickUpDate(raw.date_created) || new Date();

  let effectiveStart = startDate;
  let effectiveEnd = endDate;

  if (!effectiveStart && effectiveEnd) {
    effectiveStart = dateCreated;
  }
  if (effectiveStart && !effectiveEnd) {
    effectiveEnd = new Date(effectiveStart.getTime() + 3 * 24 * 60 * 60 * 1000);
  }

  // Extract custom fields
  const customFields: CustomField[] = (raw.custom_fields || [])
    .filter((cf: any) => cf.value !== null && cf.value !== undefined && cf.value !== '')
    .map((cf: any) => ({
      id: cf.id,
      name: cf.name,
      type: cf.type,
      value: cf.value,
    }));

  return {
    id: raw.id,
    name: raw.name || 'Untitled Task',
    status: raw.status?.status || 'unknown',
    statusColor: raw.status?.color || '#666666',
    statusType: raw.status?.type || 'open',
    assignees: (raw.assignees || []).map((a: any) => ({
      id: a.id,
      username: a.username || a.email || 'Unknown',
      initials: a.initials || (a.username ? a.username.slice(0, 2).toUpperCase() : 'UN'),
      profilePicture: a.profilePicture || null,
    })),
    startDate: effectiveStart,
    endDate: effectiveEnd,
    dateCreated,
    parent: raw.parent || null,
    space: { id: raw.space?.id || 'no-space', name: raw.space?.name || 'No Space' },
    folder: {
      id: raw.folder?.id || 'no-folder',
      name: raw.folder?.name && !raw.folder?.hidden ? raw.folder.name : 'No Folder',
    },
    list: { id: raw.list?.id || 'no-list', name: raw.list?.name || 'No List' },
    url: raw.url || '',
    customFields,
  };
}

