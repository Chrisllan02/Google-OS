import { TaskItem, TaskList, TaskRecurrence } from './GASBridge';

export type SortMode = 'manual' | 'date' | 'starred' | 'title' | 'completedAt';

export const RECURRENCE_LABELS: Record<TaskRecurrence, string> = {
  none: 'Sem repetição',
  daily: 'Diária',
  weekly: 'Semanal',
  monthly: 'Mensal',
  yearly: 'Anual',
};

export function computeNextRecurrenceDate(
  currentIso: string | undefined,
  recurrence: TaskRecurrence
): string {
  const base = currentIso ? new Date(currentIso) : new Date();
  const next = new Date(base);
  if (recurrence === 'daily') next.setDate(next.getDate() + 1);
  else if (recurrence === 'weekly') next.setDate(next.getDate() + 7);
  else if (recurrence === 'monthly') next.setMonth(next.getMonth() + 1);
  else if (recurrence === 'yearly') next.setFullYear(next.getFullYear() + 1);
  return next.toISOString();
}

export function sortTaskItems(items: TaskItem[], sortMode: SortMode): TaskItem[] {
  const copy = [...items];
  if (sortMode === 'title') {
    return copy.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
  }
  if (sortMode === 'starred') {
    return copy.sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0));
  }
  if (sortMode === 'completedAt') {
    return copy.sort((a, b) => {
      const ca = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const cb = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return cb - ca;
    });
  }
  if (sortMode === 'date') {
    return copy.sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : Number.MAX_SAFE_INTEGER;
      const db = b.date ? new Date(b.date).getTime() : Number.MAX_SAFE_INTEGER;
      return da - db;
    });
  }
  return copy;
}

export function indentTaskIntoPrevious(
  allTasks: TaskItem[],
  visiblePendingTasks: TaskItem[],
  taskId: string
): { updatedTasks: TaskItem[]; parentTask: TaskItem | null } {
  const currentVisibleIdx = visiblePendingTasks.findIndex((t) => t.id === taskId);
  if (currentVisibleIdx <= 0) {
    return { updatedTasks: allTasks, parentTask: null };
  }
  const parentCandidate = visiblePendingTasks[currentVisibleIdx - 1];
  const targetTask = allTasks.find((t) => t.id === taskId);
  if (!parentCandidate || !targetTask) {
    return { updatedTasks: allTasks, parentTask: null };
  }

  const asSubtask: TaskItem = {
    id: targetTask.id,
    title: targetTask.title,
    completed: targetTask.completed,
    completedAt: targetTask.completedAt,
    parent: parentCandidate.id,
    listId: parentCandidate.listId || 'default',
  };

  const promotedExistingSubs = (targetTask.subtasks || []).map((s) => ({
    ...s,
    parent: parentCandidate.id,
  }));

  const updatedTasks = allTasks
    .filter((t) => t.id !== taskId)
    .map((t) =>
      t.id === parentCandidate.id
        ? {
            ...t,
            subtasks: [...(t.subtasks || []), asSubtask, ...promotedExistingSubs],
          }
        : t
    );

  const updatedParent = updatedTasks.find((t) => t.id === parentCandidate.id) || null;
  return { updatedTasks, parentTask: updatedParent };
}

export function promoteSubtaskToMain(
  allTasks: TaskItem[],
  parentTaskId: string,
  subtaskId: string,
  newId = `tk_prom_${Date.now()}`
): { updatedTasks: TaskItem[]; promotedTask: TaskItem | null } {
  const parentIdx = allTasks.findIndex((t) => t.id === parentTaskId);
  if (parentIdx === -1) return { updatedTasks: allTasks, promotedTask: null };
  const parentTask = allTasks[parentIdx];
  const sub = (parentTask.subtasks || []).find((s) => s.id === subtaskId);
  if (!sub) return { updatedTasks: allTasks, promotedTask: null };

  const promotedTask: TaskItem = {
    id: newId,
    title: sub.title,
    completed: sub.completed,
    completedAt: sub.completedAt,
    listId: parentTask.listId || 'default',
    recurrence: 'none',
    subtasks: [],
  };

  const updatedTasks = [...allTasks];
  updatedTasks[parentIdx] = {
    ...parentTask,
    subtasks: (parentTask.subtasks || []).filter((s) => s.id !== subtaskId),
  };
  updatedTasks.splice(parentIdx + 1, 0, promotedTask);
  return { updatedTasks, promotedTask };
}

export function reorderTaskListColumns(
  lists: TaskList[],
  listId: string,
  direction: 'first' | 'left' | 'right'
): TaskList[] {
  const idx = lists.findIndex((l) => l.id === listId);
  if (idx === -1) return lists;
  const next = [...lists];
  const [item] = next.splice(idx, 1);
  if (direction === 'first') {
    next.unshift(item);
  } else if (direction === 'left') {
    next.splice(Math.max(0, idx - 1), 0, item);
  } else {
    next.splice(Math.min(next.length, idx + 1), 0, item);
  }
  return next;
}

export type TaskDueFilter = 'all' | 'today' | 'overdue';

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function isTaskDueToday(dateIso: string | undefined, now = new Date()): boolean {
  if (!dateIso) return false;
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) return false;
  return startOfLocalDay(parsed) === startOfLocalDay(now);
}

export function isTaskOverdue(
  dateIso: string | undefined,
  completed = false,
  now = new Date()
): boolean {
  if (!dateIso || completed) return false;
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) return false;
  return startOfLocalDay(parsed) < startOfLocalDay(now);
}

export function filterTasksByQuery(
  tasks: TaskItem[],
  query: string,
  dueFilter: TaskDueFilter = 'all',
  now = new Date()
): TaskItem[] {
  const q = query.trim().toLowerCase();
  return tasks.filter((t) => {
    if (dueFilter === 'today' && !isTaskDueToday(t.date, now)) return false;
    if (dueFilter === 'overdue' && !isTaskOverdue(t.date, t.completed, now)) return false;
    if (!q) return true;
    const inTitle = t.title.toLowerCase().includes(q);
    const inDetails = (t.details || '').toLowerCase().includes(q);
    const inSubtasks = (t.subtasks || []).some((s) => s.title.toLowerCase().includes(q));
    return inTitle || inDetails || inSubtasks;
  });
}

export function deleteSubtaskFromTask(
  tasks: TaskItem[],
  parentTaskId: string,
  subtaskId: string
): TaskItem[] {
  return tasks.map((t) =>
    t.id === parentTaskId
      ? { ...t, subtasks: (t.subtasks || []).filter((s) => s.id !== subtaskId) }
      : t
  );
}

export function updateSubtaskTitle(
  tasks: TaskItem[],
  parentTaskId: string,
  subtaskId: string,
  newTitle: string
): TaskItem[] {
  const clean = newTitle.trim();
  if (!clean) return tasks;
  return tasks.map((t) =>
    t.id === parentTaskId
      ? {
          ...t,
          subtasks: (t.subtasks || []).map((s) =>
            s.id === subtaskId ? { ...s, title: clean } : s
          ),
        }
      : t
  );
}

export function moveTaskToTopOfList(tasks: TaskItem[], taskId: string): TaskItem[] {
  const idx = tasks.findIndex((t) => t.id === taskId);
  if (idx <= 0) return tasks;
  const next = [...tasks];
  const [target] = next.splice(idx, 1);
  next.unshift(target);
  return next;
}
