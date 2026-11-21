import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2, X, Plus, Trash2, Calendar, Star, Repeat,
  AlignLeft, Check, ArrowUpDown, Columns, List, Edit3,
  CornerDownRight, CornerUpLeft, Mail, FileText, FileSpreadsheet, Presentation,
  Printer, Copy, Download, ArrowLeft, ArrowRight, ChevronsLeft, GripVertical,
  Search, ChevronDown, ChevronRight, ArrowUpToLine, Clock
} from 'lucide-react';
import { AppOpenPayload, bridge, DashboardData, TaskItem, TaskList, TaskRecurrence } from '../../utils/GASBridge';
import {
  SortMode,
  TaskDueFilter,
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
} from '../../utils/tasksLogic';
import { GoogleIcons } from '../GoogleIcons';

interface TasksAppProps {
  onClose: () => void;
  data: DashboardData;
  onUpdate?: (tasks: TaskItem[]) => void;
  onOpenApp?: (type: string, fileData?: AppOpenPayload) => void;
  showToast?: (msg: string) => void;
  isDarkMode?: boolean;
}

const RECURRENCE_LABELS: Record<TaskRecurrence, string> = {
  none: 'Não se repete',
  daily: 'Todos os dias',
  weekly: 'Toda semana',
  monthly: 'Todo mês',
  yearly: 'Todo ano',
};

const NEXT_RECURRENCE: Record<TaskRecurrence, TaskRecurrence> = {
  none: 'daily',
  daily: 'weekly',
  weekly: 'monthly',
  monthly: 'yearly',
  yearly: 'none',
};

export default function TasksApp({
  onClose,
  data,
  onUpdate,
  onOpenApp,
  showToast,
  isDarkMode = false,
}: TasksAppProps) {
  const [taskLists, setTaskLists] = useState<TaskList[]>(
    data?.taskLists || [
      { id: 'default', title: 'Minhas Tarefas' },
    ]
  );
  const [selectedView, setSelectedView] = useState<string>('board'); // 'board' | 'starred' | list.id
  const [sortMode, setSortMode] = useState<SortMode>('manual');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dueFilter, setDueFilter] = useState<TaskDueFilter>('all');
  const [collapsedCompleted, setCollapsedCompleted] = useState<Record<string, boolean>>({});
  const [tasks, setTasks] = useState<TaskItem[]>(data?.tasks || []);
  const [activeTask, setActiveTask] = useState<TaskItem | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // New task inputs (per list in board mode or main input)
  const [newTaskInputs, setNewTaskInputs] = useState<Record<string, string>>({});
  const [newSubtaskInput, setNewSubtaskInput] = useState('');
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState<string>('');

  // List creation & rename states
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [renamingListId, setRenamingListId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Pointer Drag-and-Drop states in full-screen TasksApp
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [dragOverListId, setDragOverListId] = useState<string | null>(null);

  const toast = (msg: string) => showToast && showToast(msg);

  useEffect(() => {
    bridge.getTaskLists().then((lists) => {
      if (lists && lists.length > 0) setTaskLists(lists);
    });
    bridge.getTasks('all').then((all) => {
      if (all && all.length > 0) setTasks(all);
    });
  }, []);

  const syncTasks = (updated: TaskItem[]) => {
    setTasks(updated);
    if (onUpdate) onUpdate(updated);
    void bridge.saveAllTasks(updated);
    if (activeTask) {
      const refreshed = updated.find((t) => t.id === activeTask.id) || null;
      setActiveTask(refreshed);
    }
  };

  const syncLists = (updated: TaskList[]) => {
    setTaskLists(updated);
    void bridge.saveTaskLists(updated);
  };

  useEffect(() => {
    if (!draggedTaskId) return;

    const handlePointerMove = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const colEl = el?.closest('[data-full-list-drop]') as HTMLElement | null;
      const rowEl = el?.closest('[data-full-task-id]') as HTMLElement | null;
      setDragOverListId(colEl?.getAttribute('data-full-list-drop') || null);
      const hoveredId = rowEl?.getAttribute('data-full-task-id') || null;
      setDragOverTaskId(hoveredId && hoveredId !== draggedTaskId ? hoveredId : null);
    };

    const handlePointerUp = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const colEl = el?.closest('[data-full-list-drop]') as HTMLElement | null;
      const rowEl = el?.closest('[data-full-task-id]') as HTMLElement | null;
      const targetListId = colEl?.getAttribute('data-full-list-drop') || null;
      const targetTaskId = rowEl?.getAttribute('data-full-task-id') || null;

      if (targetTaskId && targetTaskId !== draggedTaskId) {
        const next = [...tasks];
        const fromIdx = next.findIndex((t) => t.id === draggedTaskId);
        const toIdx = next.findIndex((t) => t.id === targetTaskId);
        if (fromIdx !== -1 && toIdx !== -1) {
          const [moved] = next.splice(fromIdx, 1);
          if (targetListId) moved.listId = targetListId;
          else if (tasks[toIdx]?.listId) moved.listId = tasks[toIdx].listId;
          next.splice(toIdx, 0, moved);
          syncTasks(next);
        }
      } else if (targetListId) {
        syncTasks(
          tasks.map((t) => (t.id === draggedTaskId ? { ...t, listId: targetListId } : t))
        );
      }

      setDraggedTaskId(null);
      setDragOverTaskId(null);
      setDragOverListId(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggedTaskId, tasks]);

  const handleToggleTask = (id: string) => {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;
    const willComplete = !target.completed;
    const nowIso = new Date().toISOString();

    let updated = tasks.map((t) =>
      t.id === id
        ? { ...t, completed: willComplete, completedAt: willComplete ? nowIso : undefined }
        : t
    );

    if (willComplete && target.recurrence && target.recurrence !== 'none') {
      const nextDateIso = computeNextRecurrenceDate(target.date, target.recurrence);
      const spawned: TaskItem = {
        ...target,
        id: `tk_rec_${Date.now()}`,
        completed: false,
        completedAt: undefined,
        date: nextDateIso,
        subtasks: (target.subtasks || []).map((s) => ({
          ...s,
          id: `${s.id}_${Date.now()}`,
          completed: false,
          completedAt: undefined,
        })),
      };
      updated = [spawned, ...updated];
      toast(`Próxima ocorrência (${RECURRENCE_LABELS[target.recurrence]}) criada.`);
    }

    syncTasks(updated);
  };

  const handleToggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = tasks.map((t) => (t.id === id ? { ...t, starred: !t.starred } : t));
    syncTasks(updated);
  };

  const handleAddTaskToList = (listId: string) => {
    const text = (newTaskInputs[listId] || '').trim();
    if (!text) return;
    const targetList = listId === 'starred' ? taskLists[0]?.id || 'default' : listId;
    const newTask: TaskItem = {
      id: `tk_${Date.now()}`,
      title: text,
      completed: false,
      starred: listId === 'starred',
      listId: targetList,
      recurrence: 'none',
      subtasks: [],
    };
    syncTasks([newTask, ...tasks]);
    setNewTaskInputs((prev) => ({ ...prev, [listId]: '' }));
    toast('Tarefa adicionada.');
  };

  const handleInsertTaskBelow = (referenceTaskId: string) => {
    const idx = tasks.findIndex((t) => t.id === referenceTaskId);
    const refTask = tasks[idx];
    const newTask: TaskItem = {
      id: `tk_${Date.now()}`,
      title: 'Nova tarefa',
      completed: false,
      listId: refTask?.listId || 'default',
      recurrence: 'none',
      subtasks: [],
    };
    const next = [...tasks];
    if (idx !== -1) next.splice(idx + 1, 0, newTask);
    else next.unshift(newTask);
    syncTasks(next);
    setActiveTask(newTask);
    toast('Nova tarefa criada abaixo.');
  };

  // INDENT: Turn task into subtask of the task above it in the same list
  const handleIndentTask = (task: TaskItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const sameListPending = tasks.filter(
      (t) => !t.completed && (t.listId || 'default') === (task.listId || 'default')
    );
    const { updatedTasks, parentTask } = indentTaskIntoPrevious(tasks, sameListPending, task.id);
    if (!parentTask) {
      toast('Posicione a tarefa abaixo de outra na mesma lista para recuá-la.');
      return;
    }
    syncTasks(updatedTasks);
    setActiveTask(parentTask);
    toast(`Transformada em subtarefa de "${parentTask.title}".`);
  };

  // UNINDENT: Promote subtask to main task below its parent
  const handlePromoteSubtask = (parentTaskId: string, subId: string) => {
    const { updatedTasks, promotedTask } = promoteSubtaskToMain(tasks, parentTaskId, subId);
    if (!promotedTask) return;
    syncTasks(updatedTasks);
    toast(`"${promotedTask.title}" promovida para tarefa principal.`);
  };

  // Reorder list columns
  const handleMoveListOrder = (listId: string, direction: 'first' | 'left' | 'right') => {
    const next = reorderTaskListColumns(taskLists, listId, direction);
    syncLists(next);
    toast('Ordem das listas atualizada.');
  };

  const handleUpdateActiveTask = (updates: Partial<TaskItem>) => {
    if (!activeTask) return;
    const updatedList = tasks.map((t) =>
      t.id === activeTask.id ? { ...t, ...updates } : t
    );
    syncTasks(updatedList);
  };

  const handleDeleteTask = (id: string) => {
    syncTasks(tasks.filter((t) => t.id !== id));
    if (activeTask?.id === id) setActiveTask(null);
    toast('Tarefa excluída.');
  };

  const handleAddSubtask = () => {
    if (!activeTask || !newSubtaskInput.trim()) return;
    const sub: TaskItem = {
      id: `sub_${Date.now()}`,
      title: newSubtaskInput.trim(),
      completed: false,
      parent: activeTask.id,
    };
    handleUpdateActiveTask({
      subtasks: [...(activeTask.subtasks || []), sub],
    });
    setNewSubtaskInput('');
  };

  const handleToggleSubtask = (subId: string) => {
    if (!activeTask) return;
    const nowIso = new Date().toISOString();
    handleUpdateActiveTask({
      subtasks: (activeTask.subtasks || []).map((s) =>
        s.id === subId
          ? { ...s, completed: !s.completed, completedAt: !s.completed ? nowIso : undefined }
          : s
      ),
    });
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showPrintModal) setShowPrintModal(false);
        else if (activeTask) setActiveTask(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showPrintModal, activeTask]);

  const handleDeleteSubtask = (parentId: string, subId: string) => {
    syncTasks(deleteSubtaskFromTask(tasks, parentId, subId));
    toast('Subtarefa removida.');
  };

  const handleCommitSubtaskEdit = (parentId: string, subId: string) => {
    if (editingSubtaskTitle.trim()) {
      syncTasks(updateSubtaskTitle(tasks, parentId, subId, editingSubtaskTitle));
    }
    setEditingSubtaskId(null);
    setEditingSubtaskTitle('');
  };

  const handleMoveTaskToTop = (taskId: string) => {
    syncTasks(moveTaskToTopOfList(tasks, taskId));
    setSortMode('manual');
    toast('Tarefa movida para o início.');
  };

  const handleDuplicateTask = (task: TaskItem) => {
    const copy: TaskItem = {
      ...task,
      id: `tk_dup_${Date.now()}`,
      title: `${task.title} (cópia)`,
      completed: false,
      completedAt: undefined,
      subtasks: (task.subtasks || []).map((s, i) => ({
        ...s,
        id: `sub_dup_${Date.now()}_${i}`,
        completed: false,
        completedAt: undefined,
      })),
    };
    syncTasks([copy, ...tasks]);
    setActiveTask(copy);
    toast('Tarefa duplicada.');
  };

  const setQuickDueDate = (daysFromToday: number | null) => {
    if (daysFromToday === null) {
      handleUpdateActiveTask({ date: undefined, time: undefined });
      return;
    }
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + daysFromToday);
    handleUpdateActiveTask({ date: d.toISOString() });
  };

  const handleCreateList = () => {
    if (!newListTitle.trim()) return;
    const created: TaskList = { id: `list_${Date.now()}`, title: newListTitle.trim() };
    syncLists([...taskLists, created]);
    setNewListTitle('');
    setIsCreatingList(false);
    toast(`Lista "${created.title}" criada.`);
  };

  const handleRenameList = (id: string) => {
    if (!renameValue.trim()) {
      setRenamingListId(null);
      return;
    }
    syncLists(taskLists.map((l) => (l.id === id ? { ...l, title: renameValue.trim() } : l)));
    setRenamingListId(null);
    toast('Lista renomeada.');
  };

  const handleDeleteList = (id: string) => {
    if (id === 'default') return;
    syncLists(taskLists.filter((l) => l.id !== id));
    syncTasks(tasks.filter((t) => t.listId !== id));
    if (selectedView === id) setSelectedView('board');
    toast('Lista excluída.');
  };

  const handleClearCompletedInList = (listId?: string) => {
    const remaining = tasks.filter((t) => {
      if (!t.completed) return true;
      if (!listId) return false;
      return (t.listId || 'default') !== listId;
    });
    syncTasks(remaining);
    toast('Tarefas concluídas removidas.');
  };

  const filteredTasks = useMemo(
    () => filterTasksByQuery(tasks, searchQuery, dueFilter),
    [tasks, searchQuery, dueFilter]
  );

  const overdueCount = useMemo(
    () => tasks.filter((t) => isTaskOverdue(t.date, t.completed)).length,
    [tasks]
  );

  const todayCount = useMemo(
    () => tasks.filter((t) => !t.completed && isTaskDueToday(t.date)).length,
    [tasks]
  );

  const sortItems = (items: TaskItem[]) => sortTaskItems(items, sortMode);

  const buildPrintableText = () => {
    const lines: string[] = [
      `GOOGLE TAREFAS — RELATÓRIO COMPLETO`,
      `Exportado em: ${new Date().toLocaleString('pt-BR')}`,
      '============================================================',
      '',
    ];
    taskLists.forEach((list) => {
      const listTasks = tasks.filter((t) => (t.listId || 'default') === list.id);
      lines.push(`LISTA: ${list.title.toUpperCase()} (${listTasks.length})`);
      listTasks.forEach((t) => {
        const status = t.completed ? '[x]' : '[ ]';
        const star = t.starred ? ' ★' : '';
        const comp =
          t.completed && t.completedAt
            ? ` (Concluída em ${new Date(t.completedAt).toLocaleDateString('pt-BR')} às ${new Date(
                t.completedAt
              ).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})`
            : '';
        lines.push(`  ${status} ${t.title}${star}${comp}`);
        (t.subtasks || []).forEach((s) => {
          lines.push(`      ${s.completed ? '[x]' : '[ ]'} ↳ ${s.title}`);
        });
      });
      lines.push('');
    });
    return lines.join('\n');
  };

  const renderSourceIcon = (type: string) => {
    switch (type) {
      case 'mail':
        return <Mail size={11} className="text-[#EA4335]" />;
      case 'sheet':
        return <FileSpreadsheet size={11} className="text-[#34A853]" />;
      case 'slide':
        return <Presentation size={11} className="text-[#FBBC04]" />;
      default:
        return <FileText size={11} className="text-[#4285F4]" />;
    }
  };

  const renderTaskRow = (task: TaskItem) => {
    const isSelected = activeTask?.id === task.id;
    const isBeingDragged = draggedTaskId === task.id;
    const isDragOver = dragOverTaskId === task.id;
    const subtasks = task.subtasks || [];
    const doneSub = subtasks.filter((s) => s.completed).length;

    return (
      <div
        key={task.id}
        data-full-task-id={task.id}
        onClick={() => setActiveTask(task)}
        className={`group flex items-start gap-2.5 p-3 rounded-xl border transition-all cursor-pointer select-none ${
          isBeingDragged ? 'opacity-40 scale-95 ring-1 ring-[#3B82F6]' : ''
        } ${isDragOver ? 'ring-2 ring-[#3B82F6] -translate-y-0.5' : ''} ${
          isSelected
            ? 'border-[#3B82F6] bg-[#3B82F6]/10'
            : isDarkMode
            ? 'border-white/5 bg-white/[0.03] hover:bg-white/[0.07]'
            : 'border-black/5 bg-white hover:bg-gray-50'
        }`}
      >
        <div
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDraggedTaskId(task.id);
          }}
          style={{ touchAction: 'none' }}
          className="mt-1 p-0.5 rounded cursor-grab active:cursor-grabbing opacity-40 group-hover:opacity-100 shrink-0"
          title="Arraste para reordenar ou mover para outra lista"
        >
          <GripVertical size={13} />
        </div>
        <button
          type="button"
          aria-label={task.completed ? `Marcar "${task.title}" como pendente` : `Concluir "${task.title}"`}
          onClick={(e) => {
            e.stopPropagation();
            handleToggleTask(task.id);
          }}
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 transition-all shrink-0 ${
            task.completed
              ? 'bg-[#34A853] border-[#34A853] text-white'
              : isDarkMode
              ? 'border-white/40 hover:border-[#3B82F6]'
              : 'border-gray-400 hover:border-[#3B82F6]'
          }`}
        >
          {task.completed && <Check size={12} strokeWidth={3} />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span
              className={`text-sm font-medium break-words ${
                task.completed
                  ? isDarkMode
                    ? 'line-through text-white/40'
                    : 'line-through text-gray-400'
                  : isDarkMode
                  ? 'text-white'
                  : 'text-gray-900'
              }`}
            >
              {task.title}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {!task.completed && (
                <button
                  type="button"
                  aria-label={`Recuar "${task.title}" como subtarefa`}
                  onClick={(e) => handleIndentTask(task, e)}
                  className="p-1 rounded opacity-0 group-hover:opacity-70 focus:opacity-100 hover:!opacity-100"
                  title="Recuar como subtarefa da tarefa acima"
                >
                  <CornerDownRight size={13} />
                </button>
              )}
              <button
                type="button"
                aria-label={task.starred ? `Remover estrela de "${task.title}"` : `Marcar "${task.title}" com estrela`}
                onClick={(e) => handleToggleStar(task.id, e)}
                className={`p-1 rounded transition-transform hover:scale-110 shrink-0 ${
                  task.starred
                    ? 'text-[#FBBC04]'
                    : isDarkMode
                    ? 'text-white/30 hover:text-white/70'
                    : 'text-gray-300 hover:text-gray-600'
                }`}
              >
                <Star size={14} className={task.starred ? 'fill-[#FBBC04]' : ''} />
              </button>
            </div>
          </div>

          {task.details && (
            <p className={`text-xs mt-0.5 line-clamp-2 ${isDarkMode ? 'text-white/55' : 'text-gray-500'}`}>
              {task.details}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {task.date && !task.completed && (() => {
              const overdue = isTaskOverdue(task.date, task.completed);
              const dueToday = isTaskDueToday(task.date);
              return (
                <span
                  className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border font-medium ${
                    overdue
                      ? isDarkMode
                        ? 'text-red-300 bg-red-500/15 border-red-500/35'
                        : 'text-red-700 bg-red-50 border-red-200'
                      : dueToday
                        ? isDarkMode
                          ? 'text-blue-300 bg-blue-500/20 border-blue-400/40'
                          : 'text-blue-700 bg-blue-50 border-blue-300'
                        : isDarkMode
                          ? 'text-white/75 bg-white/5 border-white/15'
                          : 'text-gray-700 bg-gray-50 border-gray-200'
                  }`}
                >
                  <Calendar size={10} />
                  <span>
                    {overdue ? 'Atrasada · ' : dueToday ? 'Hoje' : ''}
                    {!dueToday &&
                      new Date(task.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    {task.time ? ` · ${task.time}` : ''}
                  </span>
                </span>
              );
            })()}

            {task.completed && task.completedAt && (
              <span
                className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md ${
                  isDarkMode
                    ? 'text-emerald-300 bg-emerald-500/15'
                    : 'text-emerald-700 bg-emerald-50'
                }`}
              >
                <CheckCircle2 size={10} />
                <span>
                  Concluída em{' '}
                  {new Date(task.completedAt).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                  })}{' '}
                  às{' '}
                  {new Date(task.completedAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </span>
            )}

            {task.recurrence && task.recurrence !== 'none' && (
              <span
                className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border ${
                  isDarkMode
                    ? 'text-purple-300 bg-purple-500/15 border-purple-500/30'
                    : 'text-purple-700 bg-purple-50 border-purple-200'
                }`}
              >
                <Repeat size={10} />
                <span>{RECURRENCE_LABELS[task.recurrence]}</span>
              </span>
            )}

            {subtasks.length > 0 && (
              <span
                className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md ${
                  isDarkMode ? 'bg-white/10 text-white/80' : 'bg-gray-100 text-gray-700'
                }`}
              >
                <CornerDownRight size={10} />
                <span>
                  {doneSub}/{subtasks.length} subtarefas
                </span>
              </span>
            )}

            {task.linkedSource && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onOpenApp) {
                    onOpenApp(task.linkedSource!.type, {
                      id: task.linkedSource!.id,
                      name: task.linkedSource!.label,
                    });
                  }
                }}
                className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border ${
                  isDarkMode
                    ? 'bg-white/5 border-white/15 text-white/85 hover:bg-white/15'
                    : 'bg-gray-50 border-gray-200 text-gray-800 hover:bg-gray-100'
                }`}
              >
                {renderSourceIcon(task.linkedSource.type)}
                <span>{task.linkedSource.label}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`relative flex flex-col h-full overflow-hidden font-sans transition-colors ${
        isDarkMode ? 'bg-[#141517] text-white' : 'bg-[#F8FAFC] text-[#202124]'
      }`}
    >
      {/* Responsive 2-Row Google Tasks Header */}
      <div
        className={`px-3 sm:px-5 py-2.5 flex flex-col gap-2 shrink-0 border-b backdrop-blur-xl z-20 ${
          isDarkMode ? 'border-white/10 bg-black/30' : 'border-black/10 bg-white'
        }`}
      >
        {/* Row 1: Brand + Search + Global Controls */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <GoogleIcons.Tasks className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" />
            <span className="text-base sm:text-lg font-bold tracking-tight truncate">Google Tarefas</span>

            {/* Search Input (md+ inline) */}
            <div
              className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs w-56 lg:w-64 ${
                isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-800'
              }`}
            >
              <Search size={13} className="opacity-50 shrink-0" />
              <input
                type="text"
                aria-label="Buscar tarefas"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar tarefas..."
                className="flex-1 min-w-0 bg-transparent outline-none text-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={() => setSearchQuery('')}
                  className="opacity-60 hover:opacity-100"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Sort Selector */}
            <button
              type="button"
              aria-label="Alterar ordenação das tarefas"
              onClick={() => {
                const order: SortMode[] = ['manual', 'date', 'starred', 'title', 'completedAt'];
                setSortMode(order[(order.indexOf(sortMode) + 1) % order.length]);
              }}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 whitespace-nowrap ${
                isDarkMode ? 'border-white/15 bg-white/5 text-white/85' : 'border-gray-200 bg-white text-gray-700'
              }`}
            >
              <ArrowUpDown size={13} />
              <span className="hidden sm:inline">
                {sortMode === 'manual'
                  ? 'Minha ordem'
                  : sortMode === 'date'
                  ? 'Data'
                  : sortMode === 'starred'
                  ? 'Com estrela'
                  : sortMode === 'title'
                  ? 'Título (A-Z)'
                  : 'Conclusão'}
              </span>
            </button>

            {/* Print / Export Button */}
            <button
              type="button"
              aria-label="Imprimir ou exportar listas"
              onClick={() => setShowPrintModal(true)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 ${
                isDarkMode ? 'border-white/15 bg-white/5 text-white/85' : 'border-gray-200 bg-white text-gray-700'
              }`}
              title="Imprimir ou exportar todas as listas"
            >
              <Printer size={13} />
              <span className="hidden lg:inline">Imprimir</span>
            </button>

            {/* Create New List Button */}
            {isCreatingList ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  aria-label="Nome da nova lista"
                  value={newListTitle}
                  onChange={(e) => setNewListTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateList();
                    if (e.key === 'Escape') {
                      setIsCreatingList(false);
                      setNewListTitle('');
                    }
                  }}
                  placeholder="Nome da lista..."
                  className={`w-28 sm:w-36 px-2.5 py-1 rounded-xl border text-xs outline-none ${
                    isDarkMode ? 'bg-black/40 border-white/20 text-white' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  autoFocus
                />
                <button
                  type="button"
                  aria-label="Confirmar nova lista"
                  onClick={handleCreateList}
                  className="p-1.5 rounded-xl bg-[#3B82F6] text-white"
                >
                  <Check size={14} />
                </button>
                <button
                  type="button"
                  aria-label="Cancelar nova lista"
                  onClick={() => {
                    setIsCreatingList(false);
                    setNewListTitle('');
                  }}
                  className="p-1.5 rounded-xl opacity-60 hover:opacity-100"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                aria-label="Nova Lista"
                onClick={() => setIsCreatingList(true)}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-semibold flex items-center gap-1 shadow-sm whitespace-nowrap"
              >
                <Plus size={14} />
                <span className="hidden sm:inline">Nova Lista</span>
              </button>
            )}

            <button
              type="button"
              aria-label="Fechar Google Tarefas"
              onClick={onClose}
              className={`p-1.5 sm:p-2 rounded-full transition-colors ${
                isDarkMode ? 'hover:bg-white/10 text-white/80' : 'hover:bg-black/5 text-gray-600'
              }`}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Mobile Search Bar (< md) */}
        <div
          className={`flex md:hidden items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs ${
            isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-800'
          }`}
        >
          <Search size={13} className="opacity-50 shrink-0" />
          <input
            type="text"
            aria-label="Buscar tarefas no celular"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar tarefas, notas ou subtarefas..."
            className="flex-1 min-w-0 bg-transparent outline-none text-xs"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => setSearchQuery('')}
              className="opacity-60 hover:opacity-100"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Row 2: Scrollable View Tabs (Visible on Mobile, Tablet & Desktop) + Due Date Filters */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5">
          <div
            className={`flex items-center p-1 rounded-xl border text-xs font-semibold shrink-0 ${
              isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-100 border-gray-200'
            }`}
          >
            <button
              type="button"
              onClick={() => setSelectedView('board')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg transition-all whitespace-nowrap ${
                selectedView === 'board'
                  ? 'bg-[#3B82F6] text-white shadow'
                  : isDarkMode
                  ? 'text-white/70 hover:text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Columns size={13} />
              <span>Quadro</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedView('starred')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg transition-all whitespace-nowrap ${
                selectedView === 'starred'
                  ? 'bg-[#FBBC04] text-black shadow'
                  : isDarkMode
                  ? 'text-white/70 hover:text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Star size={13} className="fill-current" />
              <span>Com estrela ({tasks.filter((t) => t.starred).length})</span>
            </button>
            {taskLists.map((list) => (
              <button
                key={list.id}
                type="button"
                onClick={() => setSelectedView(list.id)}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg transition-all whitespace-nowrap ${
                  selectedView === list.id
                    ? isDarkMode
                      ? 'bg-white/15 text-white'
                      : 'bg-white text-gray-900 shadow-sm'
                    : isDarkMode
                    ? 'text-white/70 hover:text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <List size={13} />
                <span>{list.title}</span>
              </button>
            ))}
          </div>

          {/* Due Filter Group */}
          <div className="flex items-center gap-1 shrink-0 text-xs">
            {(
              [
                { id: 'all', label: 'Todas' },
                { id: 'today', label: `Hoje (${todayCount})` },
                { id: 'overdue', label: `Atrasadas (${overdueCount})` },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setDueFilter(f.id)}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  dueFilter === f.id
                    ? f.id === 'overdue'
                      ? 'bg-red-500/15 text-red-600 border border-red-500/30'
                      : 'bg-[#3B82F6]/15 text-[#1A73E8] border border-[#3B82F6]/30'
                    : isDarkMode
                      ? 'text-white/60 hover:bg-white/5'
                      : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content + Right Details Inspector */}
      <div className="flex-1 flex overflow-hidden relative">
        {selectedView === 'board' ? (
          /* MULTI-LIST BOARD VIEW (All Lists Side-by-Side with Column Reordering) */
          <div className="flex-1 p-3 sm:p-5 overflow-x-auto custom-scrollbar flex gap-4 sm:gap-5 items-stretch">
            {taskLists.map((list, idx) => {
              const listTasks = sortItems(
                filteredTasks.filter((t) => (t.listId || 'default') === list.id)
              );
              const pending = listTasks.filter((t) => !t.completed);
              const completed = listTasks.filter((t) => t.completed);
              const isCompletedCollapsed = Boolean(collapsedCompleted[list.id]);

              return (
                <div
                  key={list.id}
                  data-full-list-drop={list.id}
                  className={`w-[min(320px,calc(100vw-28px))] sm:w-[340px] shrink-0 rounded-2xl border p-3.5 sm:p-4 flex flex-col transition-colors ${
                    dragOverListId === list.id
                      ? 'border-[#3B82F6] bg-[#3B82F6]/10'
                      : isDarkMode
                      ? 'bg-[#1C1D21] border-white/10'
                      : 'bg-white border-gray-200 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3 gap-1">
                    {renamingListId === list.id ? (
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <input
                          type="text"
                          aria-label={`Renomear lista ${list.title}`}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameList(list.id);
                            if (e.key === 'Escape') setRenamingListId(null);
                          }}
                          className={`flex-1 min-w-0 px-2 py-1 rounded border text-sm font-bold outline-none ${
                            isDarkMode ? 'bg-black/30 border-white/20 text-white' : 'bg-gray-50 border-gray-300'
                          }`}
                          autoFocus
                        />
                        <button
                          type="button"
                          aria-label="Salvar nome da lista"
                          onClick={() => handleRenameList(list.id)}
                          className="p-1 text-[#34A853]"
                        >
                          <Check size={15} />
                        </button>
                      </div>
                    ) : (
                      <h3 className="font-bold text-sm sm:text-base truncate">
                        {list.title} <span className="text-xs font-normal opacity-50">({pending.length})</span>
                      </h3>
                    )}

                    <div className="flex items-center gap-0.5 shrink-0">
                      {idx > 0 && (
                        <>
                          <button
                            type="button"
                            aria-label={`Mover "${list.title}" para a primeira posição`}
                            onClick={() => handleMoveListOrder(list.id, 'first')}
                            className={`p-1.5 rounded-lg ${
                              isDarkMode ? 'hover:bg-white/10 text-white/60' : 'hover:bg-gray-100 text-gray-500'
                            }`}
                            title="Mover lista para a primeira posição"
                          >
                            <ChevronsLeft size={13} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Mover "${list.title}" para a esquerda`}
                            onClick={() => handleMoveListOrder(list.id, 'left')}
                            className={`p-1.5 rounded-lg ${
                              isDarkMode ? 'hover:bg-white/10 text-white/60' : 'hover:bg-gray-100 text-gray-500'
                            }`}
                            title="Mover coluna para a esquerda"
                          >
                            <ArrowLeft size={13} />
                          </button>
                        </>
                      )}
                      {idx < taskLists.length - 1 && (
                        <button
                          type="button"
                          aria-label={`Mover "${list.title}" para a direita`}
                          onClick={() => handleMoveListOrder(list.id, 'right')}
                          className={`p-1.5 rounded-lg ${
                            isDarkMode ? 'hover:bg-white/10 text-white/60' : 'hover:bg-gray-100 text-gray-500'
                          }`}
                          title="Mover coluna para a direita"
                        >
                          <ArrowRight size={13} />
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={`Renomear lista "${list.title}"`}
                        onClick={() => {
                          setRenamingListId(list.id);
                          setRenameValue(list.title);
                        }}
                        className={`p-1.5 rounded-lg ${
                          isDarkMode ? 'hover:bg-white/10 text-white/60' : 'hover:bg-gray-100 text-gray-500'
                        }`}
                        title="Renomear lista"
                      >
                        <Edit3 size={13} />
                      </button>
                      {list.id !== 'default' && (
                        <button
                          type="button"
                          aria-label={`Excluir lista "${list.title}"`}
                          onClick={() => handleDeleteList(list.id)}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10"
                          title="Excluir lista"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quick Add in Column */}
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border mb-3 ${
                      isDarkMode ? 'bg-black/25 border-white/10' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <Plus size={16} className="text-[#3B82F6] shrink-0" />
                    <input
                      type="text"
                      aria-label={`Adicionar tarefa em ${list.title}`}
                      value={newTaskInputs[list.id] || ''}
                      onChange={(e) =>
                        setNewTaskInputs((prev) => ({ ...prev, [list.id]: e.target.value }))
                      }
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTaskToList(list.id)}
                      placeholder="Adicionar uma tarefa..."
                      className="flex-1 min-w-0 bg-transparent border-none outline-none text-xs"
                    />
                    {(newTaskInputs[list.id] || '').trim() && (
                      <button
                        type="button"
                        aria-label={`Salvar tarefa em ${list.title}`}
                        onClick={() => handleAddTaskToList(list.id)}
                        className="px-2 py-0.5 rounded-md bg-[#3B82F6] text-white text-[11px] font-medium shrink-0"
                      >
                        Adicionar
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                    {pending.length === 0 && completed.length === 0 ? (
                      <div className="py-8 text-center text-xs opacity-50">
                        Nenhuma tarefa encontrada nesta lista.
                      </div>
                    ) : (
                      <>
                        {pending.map((t) => renderTaskRow(t))}
                        {completed.length > 0 && (
                          <div className="pt-3 mt-2 border-t border-black/10 dark:border-white/10 space-y-2">
                            <div className="flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() =>
                                  setCollapsedCompleted((prev) => ({
                                    ...prev,
                                    [list.id]: !prev[list.id],
                                  }))
                                }
                                className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider opacity-60 hover:opacity-100"
                              >
                                {isCompletedCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                                <span>Concluídas ({completed.length})</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleClearCompletedInList(list.id)}
                                className="text-[11px] font-medium text-red-500 hover:underline"
                              >
                                Limpar
                              </button>
                            </div>
                            {!isCompletedCollapsed && completed.map((t) => renderTaskRow(t))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* SINGLE LIST OR STARRED VIEW */
          <div className="flex-1 p-3 sm:p-6 overflow-y-auto custom-scrollbar">
            <div
              className={`max-w-3xl mx-auto rounded-2xl border p-4 sm:p-5 ${
                isDarkMode ? 'bg-[#1C1D21] border-white/10' : 'bg-white border-gray-200 shadow-sm'
              }`}
            >
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-black/10 dark:border-white/10">
                <Plus size={18} className="text-[#3B82F6] shrink-0" />
                <input
                  type="text"
                  aria-label="Adicionar nova tarefa nesta visualização"
                  value={newTaskInputs[selectedView] || ''}
                  onChange={(e) =>
                    setNewTaskInputs((prev) => ({ ...prev, [selectedView]: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTaskToList(selectedView)}
                  placeholder={
                    selectedView === 'starred'
                      ? 'Adicionar nova tarefa com estrela...'
                      : 'Adicionar uma nova tarefa...'
                  }
                  className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm"
                />
                {(newTaskInputs[selectedView] || '').trim() && (
                  <button
                    type="button"
                    onClick={() => handleAddTaskToList(selectedView)}
                    className="px-3 py-1 rounded-lg bg-[#3B82F6] text-white text-xs font-medium shrink-0"
                  >
                    Adicionar
                  </button>
                )}
              </div>

              {(() => {
                const viewTasks = sortItems(
                  filteredTasks.filter((t) =>
                    selectedView === 'starred'
                      ? Boolean(t.starred)
                      : (t.listId || 'default') === selectedView
                  )
                );
                if (viewTasks.length === 0) {
                  return (
                    <div className="py-10 text-center text-xs opacity-60">
                      {selectedView === 'starred'
                        ? 'Nenhuma tarefa marcada com estrela.'
                        : 'Nenhuma tarefa encontrada com os filtros atuais.'}
                    </div>
                  );
                }
                return <div className="space-y-2">{viewTasks.map((t) => renderTaskRow(t))}</div>;
              })()}
            </div>
          </div>
        )}

        {/* Right Task Inspector Drawer (Overlay on < lg, docked on lg+) */}
        {activeTask && (
          <aside
            aria-label="Detalhes da Tarefa"
            className={`absolute inset-y-0 right-0 z-40 w-[min(384px,100%)] lg:static lg:w-96 border-l flex flex-col shadow-2xl lg:shadow-none ${
              isDarkMode ? 'bg-[#1C1D21] border-white/10' : 'bg-white border-gray-200'
            }`}
          >
            <div
              className={`h-14 flex items-center justify-between px-4 sm:px-5 border-b shrink-0 ${
                isDarkMode ? 'border-white/10' : 'border-gray-100'
              }`}
            >
              <span className="text-xs font-bold uppercase tracking-wider opacity-60">
                Detalhes da Tarefa
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Mover tarefa para o início"
                  onClick={() => handleMoveTaskToTop(activeTask.id)}
                  className="p-1.5 rounded-lg opacity-60 hover:opacity-100"
                  title="Mover para o início da lista"
                >
                  <ArrowUpToLine size={15} />
                </button>
                <button
                  type="button"
                  aria-label="Duplicar tarefa"
                  onClick={() => handleDuplicateTask(activeTask)}
                  className="p-1.5 rounded-lg opacity-60 hover:opacity-100"
                  title="Duplicar tarefa"
                >
                  <Copy size={15} />
                </button>
                {!activeTask.completed && (
                  <button
                    type="button"
                    aria-label="Recuar como subtarefa"
                    onClick={() => handleIndentTask(activeTask)}
                    className="p-1.5 rounded-lg opacity-60 hover:opacity-100"
                    title="Recuar como subtarefa da tarefa acima (Tab)"
                  >
                    <CornerDownRight size={16} />
                  </button>
                )}
                <button
                  type="button"
                  aria-label={activeTask.starred ? 'Remover estrela da tarefa' : 'Favoritar tarefa'}
                  onClick={(e) => handleToggleStar(activeTask.id, e)}
                  className={`p-1.5 rounded-lg ${
                    activeTask.starred ? 'text-[#FBBC04]' : 'opacity-50 hover:opacity-100'
                  }`}
                >
                  <Star size={16} className={activeTask.starred ? 'fill-[#FBBC04]' : ''} />
                </button>
                <button
                  type="button"
                  aria-label="Fechar detalhes da tarefa"
                  onClick={() => setActiveTask(null)}
                  className="p-1.5 rounded-lg opacity-60 hover:opacity-100"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 p-4 sm:p-5 overflow-y-auto custom-scrollbar space-y-5">
              {/* Title with Native Keyboard Shortcuts */}
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  aria-label={activeTask.completed ? 'Reabrir tarefa' : 'Concluir tarefa'}
                  onClick={() => handleToggleTask(activeTask.id)}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mt-1 shrink-0 ${
                    activeTask.completed
                      ? 'bg-[#34A853] border-[#34A853] text-white'
                      : 'border-gray-400'
                  }`}
                >
                  {activeTask.completed && <Check size={14} strokeWidth={3} />}
                </button>
                <textarea
                  aria-label="Título da tarefa"
                  value={activeTask.title}
                  onChange={(e) => handleUpdateActiveTask({ title: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleInsertTaskBelow(activeTask.id);
                    } else if (e.key === 'Backspace' && activeTask.title === '') {
                      e.preventDefault();
                      handleDeleteTask(activeTask.id);
                    } else if (e.key === 'Tab' && !e.shiftKey) {
                      e.preventDefault();
                      handleIndentTask(activeTask);
                    }
                  }}
                  rows={2}
                  className="flex-1 bg-transparent text-base font-bold outline-none resize-none"
                />
              </div>

              {/* Details */}
              <div className="flex items-start gap-3">
                <AlignLeft size={18} className="opacity-50 mt-1 shrink-0" />
                <textarea
                  aria-label="Detalhes da tarefa"
                  value={activeTask.details || ''}
                  onChange={(e) => handleUpdateActiveTask({ details: e.target.value })}
                  placeholder="Adicionar detalhes..."
                  rows={3}
                  className="flex-1 bg-transparent text-sm outline-none resize-none"
                />
              </div>

              {/* List Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase opacity-50">Lista</label>
                <select
                  aria-label="Lista da tarefa"
                  value={activeTask.listId || 'default'}
                  onChange={(e) => handleUpdateActiveTask({ listId: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl border text-sm outline-none ${
                    isDarkMode ? 'bg-black/30 border-white/15 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                  }`}
                >
                  {taskLists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date, Time & Recurrence with Quick Presets */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase opacity-50 flex items-center gap-1.5">
                  <Clock size={12} /> Data, Hora & Repetição
                </label>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setQuickDueDate(0)}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium ${
                      isDarkMode ? 'border-white/15 hover:bg-white/10' : 'border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDueDate(1)}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium ${
                      isDarkMode ? 'border-white/15 hover:bg-white/10' : 'border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    Amanhã
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDueDate(7)}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium ${
                      isDarkMode ? 'border-white/15 hover:bg-white/10' : 'border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    Próx. semana
                  </button>
                  {activeTask.date && (
                    <button
                      type="button"
                      onClick={() => setQuickDueDate(null)}
                      className="px-2.5 py-1 rounded-lg border border-red-500/30 text-red-500 text-[11px] font-medium hover:bg-red-500/10"
                    >
                      Limpar data
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    aria-label="Data de vencimento"
                    value={activeTask.date ? new Date(activeTask.date).toISOString().slice(0, 10) : ''}
                    onChange={(e) =>
                      handleUpdateActiveTask({
                        date: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : undefined,
                      })
                    }
                    className={`px-3 py-2 rounded-xl border text-xs outline-none ${
                      isDarkMode ? 'bg-black/30 border-white/15 text-white' : 'bg-gray-50 border-gray-200'
                    }`}
                  />
                  <input
                    type="time"
                    aria-label="Horário de vencimento"
                    value={activeTask.time || ''}
                    onChange={(e) => handleUpdateActiveTask({ time: e.target.value || undefined })}
                    className={`px-3 py-2 rounded-xl border text-xs outline-none ${
                      isDarkMode ? 'bg-black/30 border-white/15 text-white' : 'bg-gray-50 border-gray-200'
                    }`}
                  />
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleUpdateActiveTask({
                      recurrence: NEXT_RECURRENCE[activeTask.recurrence || 'none'],
                    })
                  }
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold ${
                    activeTask.recurrence && activeTask.recurrence !== 'none'
                      ? 'border-purple-500/40 bg-purple-500/15 text-purple-400'
                      : isDarkMode
                      ? 'border-white/15 bg-black/20'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Repeat size={14} />
                    <span>Repetição</span>
                  </span>
                  <span>{RECURRENCE_LABELS[activeTask.recurrence || 'none']}</span>
                </button>
              </div>

              {/* Subtasks with Complete CRUD (Add, Toggle, Inline Rename, Promote, Delete) */}
              <div className="space-y-2 pt-2 border-t border-black/10 dark:border-white/10">
                <label className="text-xs font-bold uppercase opacity-50">Subtarefas</label>
                <div className="space-y-1.5">
                  {(activeTask.subtasks || []).map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between gap-2 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 group/sub"
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <button
                          type="button"
                          aria-label={sub.completed ? `Reabrir subtarefa "${sub.title}"` : `Concluir subtarefa "${sub.title}"`}
                          onClick={() => handleToggleSubtask(sub.id)}
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            sub.completed ? 'bg-[#34A853] border-[#34A853] text-white' : 'border-gray-400'
                          }`}
                        >
                          {sub.completed && <Check size={10} strokeWidth={3} />}
                        </button>
                        {editingSubtaskId === sub.id ? (
                          <input
                            type="text"
                            aria-label="Editar título da subtarefa"
                            value={editingSubtaskTitle}
                            onChange={(e) => setEditingSubtaskTitle(e.target.value)}
                            onBlur={() => handleCommitSubtaskEdit(activeTask.id, sub.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCommitSubtaskEdit(activeTask.id, sub.id);
                              if (e.key === 'Escape') {
                                setEditingSubtaskId(null);
                                setEditingSubtaskTitle('');
                              }
                            }}
                            autoFocus
                            className={`flex-1 min-w-0 text-sm bg-transparent border-b border-[#3B82F6] outline-none`}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSubtaskId(sub.id);
                              setEditingSubtaskTitle(sub.title);
                            }}
                            className={`text-sm truncate text-left flex-1 ${
                              sub.completed ? 'line-through opacity-50' : ''
                            }`}
                          >
                            {sub.title}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          aria-label={`Promover subtarefa "${sub.title}" para tarefa principal`}
                          onClick={() => handlePromoteSubtask(activeTask.id, sub.id)}
                          className="p-1 rounded opacity-60 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10"
                          title="Promover para tarefa principal"
                        >
                          <CornerUpLeft size={13} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Excluir subtarefa "${sub.title}"`}
                          onClick={() => handleDeleteSubtask(activeTask.id, sub.id)}
                          className="p-1 rounded text-red-500 opacity-70 hover:opacity-100 hover:bg-red-500/10"
                          title="Excluir subtarefa"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center gap-2 pt-1">
                    <Plus size={15} className="text-[#3B82F6] shrink-0" />
                    <input
                      type="text"
                      aria-label="Adicionar subtarefa"
                      value={newSubtaskInput}
                      onChange={(e) => setNewSubtaskInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                      placeholder="Adicionar subtarefa..."
                      className="flex-1 min-w-0 bg-transparent text-sm outline-none"
                    />
                    {newSubtaskInput.trim() && (
                      <button
                        type="button"
                        onClick={handleAddSubtask}
                        className="px-2.5 py-1 rounded-lg bg-[#3B82F6] text-white text-xs font-medium shrink-0"
                      >
                        Incluir
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div
              className={`p-4 border-t flex items-center justify-between ${
                isDarkMode ? 'border-white/10 bg-black/20' : 'border-gray-100 bg-gray-50'
              }`}
            >
              <button
                type="button"
                onClick={() => handleDeleteTask(activeTask.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-500/10"
              >
                <Trash2 size={14} />
                <span>Excluir tarefa</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTask(null)}
                className="px-4 py-1.5 rounded-xl bg-[#3B82F6] text-white text-xs font-semibold"
              >
                Concluído
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* Print / Export Modal */}
      {showPrintModal && (
        <div
          onClick={() => setShowPrintModal(false)}
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-lg max-h-[90%] overflow-y-auto rounded-2xl border p-5 shadow-2xl space-y-4 ${
              isDarkMode ? 'bg-[#18191C] border-white/15 text-white' : 'bg-white border-black/10 text-gray-900'
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-black/10 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Printer size={18} className="text-[#3B82F6]" />
                <h3 className="font-bold text-sm">Imprimir / Exportar Listas</h3>
              </div>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setShowPrintModal(false)}
                className="p-1.5 rounded-lg opacity-60 hover:opacity-100"
              >
                <X size={16} />
              </button>
            </div>

            <pre
              className={`max-h-72 overflow-y-auto custom-scrollbar p-3 rounded-xl text-xs font-mono whitespace-pre-wrap border ${
                isDarkMode ? 'bg-black/40 border-white/10 text-white/85' : 'bg-gray-50 border-gray-200 text-gray-800'
              }`}
            >
              {buildPrintableText()}
            </pre>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(buildPrintableText()).catch(() => {});
                  toast('Copiado para a área de transferência.');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                  isDarkMode ? 'border-white/15 hover:bg-white/10' : 'border-gray-200 hover:bg-gray-100'
                }`}
              >
                <Copy size={13} />
                <span>Copiar</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([buildPrintableText()], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'google-tarefas-completo.txt';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  toast('Arquivo .txt exportado.');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                  isDarkMode ? 'border-white/15 hover:bg-white/10' : 'border-gray-200 hover:bg-gray-100'
                }`}
              >
                <Download size={13} />
                <span>Baixar .txt</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold bg-[#3B82F6] hover:bg-[#2563EB] text-white"
              >
                <Printer size={13} />
                <span>Imprimir agora</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}