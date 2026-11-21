import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeNextRecurrenceDate,
  sortTaskItems,
  indentTaskIntoPrevious,
  promoteSubtaskToMain,
  reorderTaskListColumns,
  isTaskDueToday,
  isTaskOverdue,
  filterTasksByQuery,
  deleteSubtaskFromTask,
  updateSubtaskTitle,
  moveTaskToTopOfList,
} from './tasksLogic';
import { TaskItem, TaskList } from './GASBridge';

test('computeNextRecurrenceDate advances daily, weekly, monthly, and yearly dates accurately', () => {
  const base = '2026-04-10T12:00:00.000Z';

  const daily = new Date(computeNextRecurrenceDate(base, 'daily'));
  assert.equal(daily.toISOString(), '2026-04-11T12:00:00.000Z');

  const weekly = new Date(computeNextRecurrenceDate(base, 'weekly'));
  assert.equal(weekly.toISOString(), '2026-04-17T12:00:00.000Z');

  const monthly = new Date(computeNextRecurrenceDate(base, 'monthly'));
  assert.equal(monthly.getUTCMonth(), 4); // May (0-indexed)

  const yearly = new Date(computeNextRecurrenceDate(base, 'yearly'));
  assert.equal(yearly.getUTCFullYear(), 2027);
});

test('sortTaskItems sorts by title, starred, date, and completedAt', () => {
  const sample: TaskItem[] = [
    {
      id: '1',
      title: 'Zeta Task',
      completed: true,
      completedAt: '2026-04-10T10:00:00.000Z',
      starred: false,
      date: '2026-04-15T10:00:00.000Z',
    },
    {
      id: '2',
      title: 'Alpha Task',
      completed: true,
      completedAt: '2026-04-10T15:00:00.000Z',
      starred: true,
      date: '2026-04-11T10:00:00.000Z',
    },
  ];

  const byTitle = sortTaskItems(sample, 'title');
  assert.equal(byTitle[0].id, '2');

  const byStarred = sortTaskItems(sample, 'starred');
  assert.equal(byStarred[0].id, '2');

  const byDate = sortTaskItems(sample, 'date');
  assert.equal(byDate[0].id, '2');

  const byCompletedAt = sortTaskItems(sample, 'completedAt');
  assert.equal(byCompletedAt[0].id, '2');
});

test('indentTaskIntoPrevious converts a task into a subtask of the previous visible task and promoteSubtaskToMain restores it', () => {
  const initial: TaskItem[] = [
    { id: 't1', title: 'Tarefa Principal 1', completed: false, listId: 'default', subtasks: [] },
    { id: 't2', title: 'Tarefa Principal 2', completed: false, listId: 'default', subtasks: [] },
  ];

  const { updatedTasks, parentTask } = indentTaskIntoPrevious(initial, initial, 't2');
  assert.equal(updatedTasks.length, 1);
  assert.ok(parentTask);
  assert.equal(parentTask.subtasks?.length, 1);
  assert.equal(parentTask.subtasks?.[0].title, 'Tarefa Principal 2');

  const { updatedTasks: afterPromote, promotedTask } = promoteSubtaskToMain(
    updatedTasks,
    't1',
    't2',
    't2_promoted'
  );
  assert.equal(afterPromote.length, 2);
  assert.equal(afterPromote[0].subtasks?.length, 0);
  assert.equal(promotedTask?.title, 'Tarefa Principal 2');
});

test('reorderTaskListColumns moves columns left, right, and to the first position', () => {
  const lists: TaskList[] = [
    { id: 'default', title: 'Minhas Tarefas' },
    { id: 'work', title: 'Sprint & Produto' },
    { id: 'personal', title: 'Pessoal & Rotina' },
  ];

  const movedFirst = reorderTaskListColumns(lists, 'personal', 'first');
  assert.deepEqual(
    movedFirst.map((l) => l.id),
    ['personal', 'default', 'work']
  );

  const movedRight = reorderTaskListColumns(lists, 'default', 'right');
  assert.deepEqual(
    movedRight.map((l) => l.id),
    ['work', 'default', 'personal']
  );
});

test('isTaskDueToday, isTaskOverdue, and filterTasksByQuery classify and filter tasks accurately', () => {
  const now = new Date(2026, 10, 21, 14, 0, 0); // Nov 21, 2026 local
  const todayIso = new Date(2026, 10, 21, 18, 0, 0).toISOString();
  const yesterdayIso = new Date(2026, 10, 20, 10, 0, 0).toISOString();
  const tomorrowIso = new Date(2026, 10, 22, 10, 0, 0).toISOString();

  assert.equal(isTaskDueToday(todayIso, now), true);
  assert.equal(isTaskDueToday(yesterdayIso, now), false);
  assert.equal(isTaskOverdue(yesterdayIso, false, now), true);
  assert.equal(isTaskOverdue(yesterdayIso, true, now), false);
  assert.equal(isTaskOverdue(todayIso, false, now), false);

  const list: TaskItem[] = [
    { id: 'a', title: 'Relatório fiscal', completed: false, date: yesterdayIso, subtasks: [] },
    { id: 'b', title: 'Reunião Q4', completed: false, date: todayIso, details: 'KPIs', subtasks: [{ id: 's1', title: 'Exportar slides', completed: false }] },
    { id: 'c', title: 'Comprar café', completed: false, date: tomorrowIso, subtasks: [] },
  ];

  assert.deepEqual(filterTasksByQuery(list, '', 'overdue', now).map((t) => t.id), ['a']);
  assert.deepEqual(filterTasksByQuery(list, '', 'today', now).map((t) => t.id), ['b']);
  assert.deepEqual(filterTasksByQuery(list, 'slides', 'all', now).map((t) => t.id), ['b']);
});

test('deleteSubtaskFromTask, updateSubtaskTitle, and moveTaskToTopOfList mutate cleanly without side effects', () => {
  const tasks: TaskItem[] = [
    { id: 't1', title: 'Primeira', completed: false, subtasks: [] },
    {
      id: 't2',
      title: 'Segunda',
      completed: false,
      subtasks: [
        { id: 's1', title: 'Sub antiga', completed: false },
        { id: 's2', title: 'Sub remover', completed: true },
      ],
    },
  ];

  const renamed = updateSubtaskTitle(tasks, 't2', 's1', 'Sub atualizada');
  assert.equal(renamed[1].subtasks?.[0].title, 'Sub atualizada');

  const deleted = deleteSubtaskFromTask(renamed, 't2', 's2');
  assert.equal(deleted[1].subtasks?.length, 1);

  const moved = moveTaskToTopOfList(deleted, 't2');
  assert.deepEqual(moved.map((t) => t.id), ['t2', 't1']);
});
