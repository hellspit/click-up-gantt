import { NormalizedTask, TreeRow } from '../types';

interface GroupNode {
  type: 'space' | 'folder' | 'list';
  id: string;
  name: string;
  children: Map<string, GroupNode>;
  tasks: NormalizedTask[];
}

function countTasks(node: GroupNode): number {
  let count = node.tasks.length;
  for (const child of node.children.values()) {
    count += countTasks(child);
  }
  return count;
}

export function buildTaskHierarchy(tasks: NormalizedTask[]): TreeRow[] {
  const spaceMap = new Map<string, GroupNode>();

  for (const task of tasks) {
    const spaceKey = task.space.id;
    if (!spaceMap.has(spaceKey)) {
      spaceMap.set(spaceKey, { type: 'space', id: spaceKey, name: task.space.name, children: new Map(), tasks: [] });
    }
    const spaceNode = spaceMap.get(spaceKey)!;

    const folderKey = task.folder.id;
    if (!spaceNode.children.has(folderKey)) {
      spaceNode.children.set(folderKey, { type: 'folder', id: folderKey, name: task.folder.name, children: new Map(), tasks: [] });
    }
    const folderNode = spaceNode.children.get(folderKey)!;

    const listKey = task.list.id;
    if (!folderNode.children.has(listKey)) {
      folderNode.children.set(listKey, { type: 'list', id: listKey, name: task.list.name, children: new Map(), tasks: [] });
    }
    folderNode.children.get(listKey)!.tasks.push(task);
  }

  const rows: TreeRow[] = [];

  for (const space of spaceMap.values()) {
    rows.push({ type: 'space', name: space.name, id: space.id, depth: 0, collapsed: false, taskCount: countTasks(space) });

    for (const folder of space.children.values()) {
      rows.push({ type: 'folder', name: folder.name, id: folder.id, depth: 1, collapsed: false, taskCount: countTasks(folder) });

      for (const list of folder.children.values()) {
        rows.push({ type: 'list', name: list.name, id: list.id, depth: 2, collapsed: false, taskCount: list.tasks.length });

        const sorted = [...list.tasks].sort((a, b) => {
          const aT = a.startDate?.getTime() || a.dateCreated.getTime();
          const bT = b.startDate?.getTime() || b.dateCreated.getTime();
          return aT - bT;
        });

        const parentTasks = sorted.filter(t => !t.parent);
        const subtasks = sorted.filter(t => t.parent);
        const subtasksByParent = new Map<string, NormalizedTask[]>();
        for (const st of subtasks) {
          if (!subtasksByParent.has(st.parent!)) subtasksByParent.set(st.parent!, []);
          subtasksByParent.get(st.parent!)!.push(st);
        }

        for (const task of parentTasks) {
          rows.push({ type: 'task', task, depth: 3, isSubtask: false });
          const children = subtasksByParent.get(task.id);
          if (children) {
            for (const child of children) {
              rows.push({ type: 'task', task: child, depth: 4, isSubtask: true });
            }
          }
        }

        // Orphan subtasks whose parent is not in this list
        for (const st of subtasks) {
          if (!parentTasks.find(p => p.id === st.parent)) {
            rows.push({ type: 'task', task: st, depth: 3, isSubtask: true });
          }
        }
      }
    }
  }

  return rows;
}

export function getVisibleRows(rows: TreeRow[], collapsedGroups: Set<string>): TreeRow[] {
  const visible: TreeRow[] = [];
  let skipUntilDepth = Infinity;

  for (const row of rows) {
    const depth = row.type === 'task' ? row.depth : row.depth;
    if (depth > skipUntilDepth) continue;
    skipUntilDepth = Infinity;
    visible.push(row);
    if (row.type !== 'task' && collapsedGroups.has(row.id)) {
      skipUntilDepth = depth;
    }
  }

  return visible;
}
