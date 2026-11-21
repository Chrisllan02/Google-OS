import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Check, Plus, Star, Repeat, Calendar, Clock, ChevronDown,
  CornerDownRight, CornerUpLeft, MoreHorizontal, Trash2, Edit3, FolderPlus, ArrowUpDown,
  Mail, FileText, FileSpreadsheet, Presentation, ExternalLink, GripVertical,
  Printer, Copy, Download, ArrowLeft, ArrowRight, ChevronsLeft, X, CheckCircle2
} from 'lucide-react';
import { AppOpenPayload, TaskItem, TaskList, TaskRecurrence, bridge } from '../utils/GASBridge';
import {
  SortMode,
  RECURRENCE_LABELS,
  computeNextRecurrenceDate,
  sortTaskItems,
  indentTaskIntoPrevious,
  promoteSubtaskToMain,
  reorderTaskListColumns,
} from '../utils/tasksLogic';

interface TasksHomeWidgetProps {
  tasks: TaskItem[];
  taskLists: TaskList[];
  darkMode: boolean;
  textColor: string;
  subTextColor: string;
  cardHeaderBorder: string;
  isCompactHeight: boolean;
  onUpdateTasks: (tasks: TaskItem[]) => void;
  onUpdateTaskLists: (lists: TaskList[]) => void;
  onSyncTaskToCalendar: (task: TaskItem) => void;
  onOpenApp: (type: string, data?: AppOpenPayload) => void;
  playSound: (kind: 'tick' | 'select' | 'action') => void;
  addToast: (msg: string) => void;
  moduleDragControls: React.ReactNode;
}

type ViewMode = 'sprint' | 'board' | 'grouped';

const RECURRENCE_SHORT: Record<TaskRecurrence, string> = {
  none: '',
  daily: 'Todo dia',
  weekly: 'Toda sem.',
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

export default function TasksHomeWidget({
  tasks,
  taskLists,
  darkMode,
  textColor,
  subTextColor,
  cardHeaderBorder,
  onUpdateTasks,
  onUpdateTaskLists,
  onSyncTaskToCalendar,
  onOpenApp,
  playSound,
  addToast,
  moduleDragControls,
}: TasksHomeWidgetProps) {
  const [selectedListFilter, setSelectedListFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('sprint');
  const [sortMode, setSortMode] = useState<SortMode>('manual');

  // Menus & popovers
  const [showListDropdown, setShowListDropdown] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [isRenamingList, setIsRenamingList] = useState(false);
  const [renameListValue, setRenameListValue] = useState('');

  // Expanded task details/subtasks drawer inside Home widget
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [subtaskInputs, setSubtaskInputs] = useState<Record<string, string>>({});

  // Quick-add composer states
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showComposerChips, setShowComposerChips] = useState(false);
  const [quickDatePreset, setQuickDatePreset] = useState<'none' | 'today' | 'tomorrow' | 'nextweek'>('today');
  const [quickTime, setQuickTime] = useState<string>('');
  const [quickRecurrence, setQuickRecurrence] = useState<TaskRecurrence>('none');
  const [quickStarred, setQuickStarred] = useState<boolean>(false);

  // Pointer Drag-and-Drop states for tasks & list columns
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [dragOverListId, setDragOverListId] = useState<string | null>(null);
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);

  const listDropdownRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (listDropdownRef.current && !listDropdownRef.current.contains(e.target as Node)) {
        setShowListDropdown(false);
        setIsCreatingList(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const persistTasks = (updated: TaskItem[]) => {
    onUpdateTasks(updated);
    void bridge.saveAllTasks(updated);
  };

  const persistLists = (updated: TaskList[]) => {
    onUpdateTaskLists(updated);
    void bridge.saveTaskLists(updated);
  };

  // Pointer-based Drag-and-Drop listener for reordering or moving tasks across lists
  useEffect(() => {
    if (!draggedTaskId) return;

    const handlePointerMove = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const listColEl = el?.closest('[data-task-list-drop]') as HTMLElement | null;
      const taskRowEl = el?.closest('[data-home-task-id]') as HTMLElement | null;

      const hoveredListId = listColEl?.getAttribute('data-task-list-drop') || null;
      const hoveredTaskId = taskRowEl?.getAttribute('data-home-task-id') || null;

      setDragOverListId(hoveredListId);
      setDragOverTaskId(hoveredTaskId && hoveredTaskId !== draggedTaskId ? hoveredTaskId : null);
    };

    const handlePointerUp = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const listColEl = el?.closest('[data-task-list-drop]') as HTMLElement | null;
      const taskRowEl = el?.closest('[data-home-task-id]') as HTMLElement | null;

      const targetListId = listColEl?.getAttribute('data-task-list-drop') || null;
      const targetTaskId = taskRowEl?.getAttribute('data-home-task-id') || null;

      if (targetTaskId && targetTaskId !== draggedTaskId) {
        playSound('select');
        const next = [...tasks];
        const fromIdx = next.findIndex((t) => String(t.id) === String(draggedTaskId));
        const toIdx = next.findIndex((t) => String(t.id) === String(targetTaskId));
        if (fromIdx !== -1 && toIdx !== -1) {
          const [moved] = next.splice(fromIdx, 1);
          const targetTask = tasks[toIdx];
          if (targetListId) {
            moved.listId = targetListId;
          } else if (targetTask?.listId) {
            moved.listId = targetTask.listId;
          }
          next.splice(toIdx, 0, moved);
          persistTasks(next);
        }
      } else if (targetListId) {
        playSound('action');
        const next = tasks.map((t) => {
          if (String(t.id) !== String(draggedTaskId)) return t;
          if (targetListId === '__completed__') {
            return { ...t, completed: true, completedAt: new Date().toISOString() };
          }
          if (targetListId === '__pending__') {
            return { ...t, completed: false, completedAt: undefined };
          }
          return { ...t, listId: targetListId };
        });
        persistTasks(next);
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

  // Pointer-based Drag-and-Drop listener for reordering List Columns in Board Mode
  useEffect(() => {
    if (!draggedColumnId) return;

    const handlePointerMove = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const colEl = el?.closest('[data-task-list-drop]') as HTMLElement | null;
      const targetId = colEl?.getAttribute('data-task-list-drop') || null;
      setDragOverColumnId(targetId && targetId !== draggedColumnId ? targetId : null);
    };

    const handlePointerUp = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const colEl = el?.closest('[data-task-list-drop]') as HTMLElement | null;
      const targetId = colEl?.getAttribute('data-task-list-drop') || null;

      if (targetId && targetId !== draggedColumnId) {
        const next = [...taskLists];
        const fromIdx = next.findIndex((l) => l.id === draggedColumnId);
        const toIdx = next.findIndex((l) => l.id === targetId);
        if (fromIdx !== -1 && toIdx !== -1) {
          const [moved] = next.splice(fromIdx, 1);
          next.splice(toIdx, 0, moved);
          persistLists(next);
          playSound('select');
          addToast('Ordem das listas atualizada.');
        }
      }
      setDraggedColumnId(null);
      setDragOverColumnId(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggedColumnId, taskLists]);

  // Toggle task completion (with completedAt timestamp & automatic recurring task spawn!)
  const handleToggleTask = (taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    playSound('action');

    const target = tasks.find((t) => t.id === taskId);
    if (!target) return;
    const willComplete = !target.completed;
    const nowIso = new Date().toISOString();

    let nextTasks = tasks.map((t) =>
      t.id === taskId
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
      nextTasks = [spawned, ...nextTasks];
      addToast(`Próxima ocorrência (${RECURRENCE_LABELS[target.recurrence]}) agendada automaticamente.`);
    }

    persistTasks(nextTasks);
  };

  // Update task field inline (title / details)
  const handleUpdateTaskField = (taskId: string, updates: Partial<TaskItem>) => {
    const next = tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t));
    persistTasks(next);
  };

  // Insert a new task right below the current task (Enter shortcut)
  const handleInsertTaskBelow = (referenceTaskId: string) => {
    playSound('action');
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
    if (idx !== -1) {
      next.splice(idx + 1, 0, newTask);
    } else {
      next.unshift(newTask);
    }
    persistTasks(next);
    setExpandedTaskId(newTask.id);
    addToast('Nova tarefa criada abaixo.');
  };

  // INDENT: Turn a main task into a subtask of the task immediately above it (Tab / Button)
  const handleIndentTask = (taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const visibleList = sortedTasks.filter((t) => !t.completed);
    const { updatedTasks, parentTask } = indentTaskIntoPrevious(tasks, visibleList, taskId);
    if (!parentTask) {
      addToast('Posicione a tarefa abaixo de outra para torná-la subtarefa.');
      return;
    }
    playSound('action');
    persistTasks(updatedTasks);
    setExpandedTaskId(parentTask.id);
    addToast(`Recuada como subtarefa de "${parentTask.title}".`);
  };

  // UNINDENT: Promote a subtask into a main task immediately below its parent (Shift+Tab / Button)
  const handlePromoteSubtask = (parentTaskId: string, subtaskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const { updatedTasks, promotedTask } = promoteSubtaskToMain(tasks, parentTaskId, subtaskId);
    if (!promotedTask) return;
    playSound('action');
    persistTasks(updatedTasks);
    addToast(`"${promotedTask.title}" promovida para tarefa principal.`);
  };

  // Move list column order (left / right / first position)
  const handleMoveListOrder = (listId: string, direction: 'first' | 'left' | 'right') => {
    const next = reorderTaskListColumns(taskLists, listId, direction);
    playSound('select');
    persistLists(next);
    addToast('Ordem das listas atualizada.');
  };

  // Toggle Starred (★)
  const handleToggleStar = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    playSound('tick');
    const next = tasks.map((t) =>
      t.id === taskId ? { ...t, starred: !t.starred } : t
    );
    persistTasks(next);
  };

  // Cycle recurrence on an existing task
  const handleCycleRecurrence = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    playSound('tick');
    const next = tasks.map((t) => {
      if (t.id !== taskId) return t;
      const currentRec: TaskRecurrence = t.recurrence || 'none';
      const nextRec = NEXT_RECURRENCE[currentRec];
      return { ...t, recurrence: nextRec, date: t.date || new Date().toISOString() };
    });
    persistTasks(next);
  };

  // Set quick date on an existing task
  const handleSetTaskDateOffset = (taskId: string, daysOffset: number | null, e: React.MouseEvent) => {
    e.stopPropagation();
    playSound('tick');
    const next = tasks.map((t) => {
      if (t.id !== taskId) return t;
      if (daysOffset === null) return { ...t, date: undefined, time: undefined };
      const d = new Date();
      d.setDate(d.getDate() + daysOffset);
      if (t.time) {
        const [hh, mm] = t.time.split(':').map(Number);
        d.setHours(hh || 9, mm || 0, 0, 0);
      } else {
        d.setHours(18, 0, 0, 0);
      }
      return { ...t, date: d.toISOString() };
    });
    persistTasks(next);
  };

  // Set specific time on an existing task and sync to Calendar
  const handleSetTaskTime = (taskId: string, timeStr: string) => {
    let updatedTaskObj: TaskItem | null = null;
    const next = tasks.map((t) => {
      if (t.id !== taskId) return t;
      const baseDate = t.date ? new Date(t.date) : new Date();
      if (timeStr) {
        const [hh, mm] = timeStr.split(':').map(Number);
        baseDate.setHours(hh || 9, mm || 0, 0, 0);
      }
      updatedTaskObj = { ...t, time: timeStr || undefined, date: baseDate.toISOString() };
      return updatedTaskObj;
    });
    persistTasks(next);
    if (updatedTaskObj && timeStr) {
      onSyncTaskToCalendar(updatedTaskObj);
      addToast(`Bloco às ${timeStr} sincronizado na Agenda.`);
    }
  };

  // Move task to another list
  const handleMoveTaskToList = (taskId: string, newListId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    playSound('select');
    const next = tasks.map((t) =>
      t.id === taskId ? { ...t, listId: newListId } : t
    );
    persistTasks(next);
  };

  // Subtasks handlers
  const handleToggleSubtask = (parentTaskId: string, subtaskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    playSound('tick');
    const nowIso = new Date().toISOString();
    const next = tasks.map((t) => {
      if (t.id !== parentTaskId) return t;
      return {
        ...t,
        subtasks: (t.subtasks || []).map((s) =>
          s.id === subtaskId
            ? { ...s, completed: !s.completed, completedAt: !s.completed ? nowIso : undefined }
            : s
        ),
      };
    });
    persistTasks(next);
  };

  const handleAddSubtask = (parentTaskId: string) => {
    const title = (subtaskInputs[parentTaskId] || '').trim();
    if (!title) return;
    playSound('action');
    const newSub: TaskItem = {
      id: `sub_${Date.now()}`,
      title,
      completed: false,
      parent: parentTaskId,
    };
    const next = tasks.map((t) =>
      t.id === parentTaskId ? { ...t, subtasks: [...(t.subtasks || []), newSub] } : t
    );
    persistTasks(next);
    setSubtaskInputs((prev) => ({ ...prev, [parentTaskId]: '' }));
  };

  const handleDeleteSubtask = (parentTaskId: string, subtaskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    playSound('tick');
    const next = tasks.map((t) =>
      t.id === parentTaskId
        ? { ...t, subtasks: (t.subtasks || []).filter((s) => s.id !== subtaskId) }
        : t
    );
    persistTasks(next);
  };

  const handleDeleteTask = (taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    playSound('tick');
    persistTasks(tasks.filter((t) => t.id !== taskId));
    if (expandedTaskId === taskId) setExpandedTaskId(null);
  };

  // Quick Add Task with full Google Tasks metadata
  const handleQuickAddTask = () => {
    const title = newTaskTitle.trim();
    if (!title) return;
    playSound('action');

    let dueIso: string | undefined;
    const d = new Date();
    if (quickDatePreset === 'today') {
      d.setHours(18, 0, 0, 0);
      dueIso = d.toISOString();
    } else if (quickDatePreset === 'tomorrow') {
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      dueIso = d.toISOString();
    } else if (quickDatePreset === 'nextweek') {
      d.setDate(d.getDate() + 7);
      d.setHours(9, 0, 0, 0);
      dueIso = d.toISOString();
    }

    if (quickTime && dueIso) {
      const withTime = new Date(dueIso);
      const [hh, mm] = quickTime.split(':').map(Number);
      withTime.setHours(hh || 9, mm || 0, 0, 0);
      dueIso = withTime.toISOString();
    }

    const targetListId =
      selectedListFilter === 'all' || selectedListFilter === 'starred'
        ? taskLists[0]?.id || 'default'
        : selectedListFilter;

    const newTask: TaskItem = {
      id: `tk_${Date.now()}`,
      title,
      completed: false,
      starred: quickStarred || selectedListFilter === 'starred',
      date: dueIso,
      time: quickTime || undefined,
      recurrence: quickRecurrence,
      listId: targetListId,
      subtasks: [],
    };

    persistTasks([newTask, ...tasks]);
    if (quickTime && dueIso) {
      onSyncTaskToCalendar(newTask);
    }

    setNewTaskTitle('');
    setQuickTime('');
    setQuickRecurrence('none');
    setQuickStarred(false);
    addToast('Tarefa criada.');
  };

  // List management handlers
  const handleCreateList = () => {
    const name = newListName.trim();
    if (!name) return;
    playSound('action');
    const newList: TaskList = { id: `list_${Date.now()}`, title: name };
    const updated = [...taskLists, newList];
    persistLists(updated);
    setSelectedListFilter(newList.id);
    setNewListName('');
    setIsCreatingList(false);
    setShowListDropdown(false);
    addToast(`Lista "${name}" criada.`);
  };

  const handleRenameCurrentList = () => {
    const name = renameListValue.trim();
    if (!name || selectedListFilter === 'all' || selectedListFilter === 'starred') return;
    playSound('action');
    const updated = taskLists.map((l) =>
      l.id === selectedListFilter ? { ...l, title: name } : l
    );
    persistLists(updated);
    setIsRenamingList(false);
    addToast('Lista renomeada.');
  };

  const handleClearCompleted = () => {
    playSound('action');
    const remaining = tasks.filter((t) => {
      if (!t.completed) return true;
      if (selectedListFilter === 'all') return false;
      if (selectedListFilter === 'starred') return !t.starred;
      return (t.listId || 'default') !== selectedListFilter;
    });
    persistTasks(remaining);
    setShowMoreMenu(false);
    addToast('Tarefas concluídas removidas.');
  };

  // Filter & Sort tasks
  const filteredByList = tasks.filter((t) => {
    if (selectedListFilter === 'all') return true;
    if (selectedListFilter === 'starred') return Boolean(t.starred);
    return (t.listId || 'default') === selectedListFilter;
  });

  const sortTasks = (items: TaskItem[]): TaskItem[] => sortTaskItems(items, sortMode);

  const sortedTasks = sortTasks(filteredByList);
  const pendingTasks = sortedTasks.filter((t) => !t.completed);
  const completedTasks = sortedTasks.filter((t) => t.completed);
  const completedCount = completedTasks.length;
  const totalCount = sortedTasks.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const currentListLabel =
    selectedListFilter === 'all'
      ? 'Todas as Listas'
      : selectedListFilter === 'starred'
      ? '★ Com estrela'
      : taskLists.find((l) => l.id === selectedListFilter)?.title || 'Minhas Tarefas';

  const ringRadius = 14;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (progressPct / 100) * ringCircumference;

  // Format Export/Print Text
  const buildPrintableText = () => {
    const lines: string[] = [
      `GOOGLE TAREFAS — ${currentListLabel.toUpperCase()}`,
      `Exportado em: ${new Date().toLocaleString('pt-BR')}`,
      `Progresso: ${completedCount}/${totalCount} concluídas (${progressPct}%)`,
      '------------------------------------------------------------',
      '',
    ];
    if (pendingTasks.length > 0) {
      lines.push(`PENDENTES (${pendingTasks.length}):`);
      pendingTasks.forEach((t) => {
        const dueStr = t.date ? ` [Prazo: ${new Date(t.date).toLocaleDateString('pt-BR')}${t.time ? ` ${t.time}` : ''}]` : '';
        const starStr = t.starred ? ' ★' : '';
        lines.push(`  [ ] ${t.title}${starStr}${dueStr}`);
        if (t.details) lines.push(`      Nota: ${t.details}`);
        (t.subtasks || []).forEach((s) => {
          lines.push(`      ${s.completed ? '[x]' : '[ ]'} ↳ ${s.title}`);
        });
      });
      lines.push('');
    }
    if (completedTasks.length > 0) {
      lines.push(`CONCLUÍDAS (${completedTasks.length}):`);
      completedTasks.forEach((t) => {
        const compStr = t.completedAt
          ? ` (Concluída em ${new Date(t.completedAt).toLocaleDateString('pt-BR')} às ${new Date(t.completedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})`
          : '';
        lines.push(`  [x] ${t.title}${compStr}`);
      });
    }
    return lines.join('\n');
  };

  const handleCopyListText = () => {
    navigator.clipboard?.writeText(buildPrintableText());
    addToast('Lista copiada para a área de transferência.');
  };

  const handleDownloadListTxt = () => {
    const blob = new Blob([buildPrintableText()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `google-tasks-${currentListLabel.toLowerCase().replace(/\s+/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast('Arquivo .txt exportado.');
  };

  const formatDateChip = (task: TaskItem) => {
    if (!task.date) return null;
    const due = new Date(task.date);
    const now = new Date();
    const isToday = due.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const isTomorrow = due.toDateString() === tomorrow.toDateString();
    const isOverdue = !isToday && due.getTime() < now.getTime() && !task.completed;

    const dateText = isToday
      ? 'Hoje'
      : isTomorrow
      ? 'Amanhã'
      : due.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

    const label = task.time ? `${dateText}, ${task.time}` : dateText;
    const badgeClass = task.completed
      ? darkMode
        ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/25'
        : 'text-emerald-700 bg-emerald-500/15 border-emerald-600/25'
      : isOverdue
      ? darkMode
        ? 'text-red-300 bg-red-500/20 border-red-500/35'
        : 'text-red-700 bg-red-500/15 border-red-600/30'
      : isToday
      ? darkMode
        ? 'text-amber-300 bg-amber-500/15 border-amber-500/30'
        : 'text-amber-800 bg-amber-500/20 border-amber-600/30'
      : darkMode
      ? 'text-blue-300 bg-blue-500/15 border-blue-500/25'
      : 'text-blue-700 bg-blue-500/15 border-blue-600/25';

    return { label, badgeClass, isOverdue, isToday };
  };

  const renderSourceIcon = (type: string) => {
    switch (type) {
      case 'mail':
        return <Mail size={10} className="text-[#EA4335]" />;
      case 'sheet':
        return <FileSpreadsheet size={10} className="text-[#34A853]" />;
      case 'slide':
        return <Presentation size={10} className="text-[#FBBC04]" />;
      default:
        return <FileText size={10} className="text-[#4285F4]" />;
    }
  };

  const renderTaskItem = (task: TaskItem, compact = false) => {
    const dateChip = formatDateChip(task);
    const isExpanded = expandedTaskId === task.id;
    const isBeingDragged = String(draggedTaskId) === String(task.id);
    const isDragOver = String(dragOverTaskId) === String(task.id);
    const subtasks = task.subtasks || [];
    const doneSubtasks = subtasks.filter((s) => s.completed).length;
    const listObj = taskLists.find((l) => l.id === (task.listId || 'default'));
    const canIndent = !task.completed && pendingTasks.findIndex((t) => t.id === task.id) > 0;

    const leftBorderColor = task.completed
      ? 'border-l-[#34A853]'
      : task.starred
      ? 'border-l-[#FBBC04]'
      : dateChip?.isOverdue
      ? 'border-l-[#EA4335]'
      : dateChip?.isToday
      ? 'border-l-[#3B82F6]'
      : 'border-l-white/20';

    return (
      <div
        key={task.id}
        data-home-task-id={task.id}
        className={`rounded-xl glass-item border-l-[3px] ${leftBorderColor} transition-all select-none ${
          isBeingDragged ? 'opacity-40 scale-95 ring-1 ring-[#3B82F6]' : ''
        } ${isDragOver ? 'ring-2 ring-[#3B82F6] bg-[#3B82F6]/10 -translate-y-0.5' : ''}`}
      >
        {/* Main Task Row */}
        <div
          onClick={() => {
            playSound('tick');
            setExpandedTaskId(isExpanded ? null : task.id);
          }}
          className={`group flex items-start gap-2 ${compact ? 'p-2' : 'p-2.5'} cursor-pointer min-w-0`}
        >
          {/* Drag Handle */}
          <div
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              playSound('tick');
              setDraggedTaskId(String(task.id));
            }}
            style={{ touchAction: 'none' }}
            className={`mt-0.5 p-0.5 rounded cursor-grab active:cursor-grabbing ${subTextColor} opacity-40 group-hover:opacity-100 ${darkMode ? 'hover:text-white' : 'hover:text-[#202124]'} shrink-0`}
            title="Arraste para reordenar ou mover para outra lista"
          >
            <GripVertical size={12} />
          </div>

          {/* Completion Circle (28x28 hit target -> 25.2px rendered under zoom 0.9) */}
          <button
            type="button"
            onClick={(e) => handleToggleTask(task.id, e)}
            className="-mt-1 -mx-1 w-7 h-7 rounded-full flex items-center justify-center shrink-0 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title={task.completed ? 'Marcar como pendente' : 'Concluir tarefa'}
            aria-label={task.completed ? 'Marcar como pendente' : 'Concluir tarefa'}
          >
            <span
              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                task.completed
                  ? 'bg-[#34A853] border-[#34A853] text-white shadow-[0_0_8px_rgba(52,168,83,0.4)]'
                  : darkMode
                  ? 'border-white/40 group-hover:border-[#3B82F6]'
                  : 'border-black/30 group-hover:border-[#3B82F6]'
              }`}
            >
              {task.completed && <Check size={10} strokeWidth={3} />}
            </span>
          </button>

          {/* Task Content & Metadata Chips */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 min-w-0">
              <span
                className={`text-xs font-semibold truncate ${
                  task.completed ? `${subTextColor} line-through` : textColor
                }`}
              >
                {task.title}
              </span>

              <div className="flex items-center shrink-0 -mr-1">
                {/* Indent as Subtask Quick Action on Hover */}
                {canIndent && !compact && (
                  <button
                    type="button"
                    onClick={(e) => handleIndentTask(task.id, e)}
                    className={`w-7 h-7 flex items-center justify-center rounded opacity-0 group-hover:opacity-75 hover:!opacity-100 ${subTextColor} ${darkMode ? 'hover:text-white' : 'hover:text-[#202124]'}`}
                    title="Recuar para virar subtarefa da tarefa acima (Tab)"
                    aria-label="Recuar para virar subtarefa"
                  >
                    <CornerDownRight size={11} />
                  </button>
                )}

                {/* Subtask count pill */}
                {subtasks.length > 0 && (
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                      darkMode ? 'bg-white/10 text-white/80' : 'bg-black/[0.06] text-black/75'
                    }`}
                    title="Subtarefas"
                  >
                    {doneSubtasks}/{subtasks.length}
                  </span>
                )}

                {/* Star Button (★) */}
                <button
                  type="button"
                  onClick={(e) => handleToggleStar(task.id, e)}
                  className={`w-7 h-7 flex items-center justify-center rounded transition-transform hover:scale-110 ${
                    task.starred
                      ? 'text-[#FBBC04] opacity-100'
                      : `${subTextColor} opacity-0 group-hover:opacity-70 hover:!opacity-100`
                  }`}
                  title={task.starred ? 'Remover estrela' : 'Marcar com estrela'}
                  aria-label={task.starred ? 'Remover estrela' : 'Marcar com estrela'}
                >
                  <Star size={12} className={task.starred ? 'fill-[#FBBC04]' : ''} />
                </button>
              </div>
            </div>

            {task.details && !task.completed && !compact && (
              <p className={`text-[10px] ${subTextColor} truncate mt-0.5`}>{task.details}</p>
            )}

            {/* Metadata Chips Row: Date/Time, CompletedAt Timestamp, Recurrence, Linked Origin (Gmail/Drive), List badge */}
            <div className="flex flex-wrap items-center gap-1 mt-1">
              {dateChip && !task.completed && (
                <span
                  className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.2 rounded-md border ${dateChip.badgeClass}`}
                >
                  <Calendar size={9} />
                  <span>{dateChip.label}</span>
                </span>
              )}

              {task.completed && task.completedAt && (
                <span
                  className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.2 rounded-md ${
                    darkMode
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-emerald-500/15 text-emerald-700'
                  }`}
                  title="Data e hora da conclusão"
                >
                  <CheckCircle2 size={9} />
                  <span>
                    Concluída{' '}
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
                <button
                  type="button"
                  onClick={(e) => handleCycleRecurrence(task.id, e)}
                  className={`min-h-[28px] inline-flex items-center gap-0.5 text-[9px] font-semibold px-2 py-0.5 rounded-md border ${
                    darkMode
                      ? 'text-purple-300 bg-purple-500/15 border-purple-500/30'
                      : 'text-purple-700 bg-purple-500/15 border-purple-600/25'
                  }`}
                  title="Clique para alterar repetição"
                >
                  <Repeat size={9} />
                  <span>{RECURRENCE_SHORT[task.recurrence]}</span>
                </button>
              )}

              {task.linkedSource && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    playSound('select');
                    onOpenApp(task.linkedSource!.type, {
                      id: task.linkedSource!.id,
                      name: task.linkedSource!.label,
                    });
                  }}
                  className={`min-h-[28px] inline-flex items-center gap-1 text-[9px] font-medium px-2 py-0.5 rounded-md border transition-colors ${
                    darkMode
                      ? 'bg-white/[0.06] border-white/10 text-white/85 hover:bg-white/15'
                      : 'bg-black/[0.04] border-black/10 text-black/80 hover:bg-black/10'
                  }`}
                  title={`Abrir origem: ${task.linkedSource.label}`}
                >
                  {renderSourceIcon(task.linkedSource.type)}
                  <span className="truncate max-w-[115px]">{task.linkedSource.label}</span>
                </button>
              )}

              {selectedListFilter === 'all' && listObj && !compact && (
                <span className={`text-[9px] px-1.5 py-0.2 rounded ${subTextColor} bg-black/5 dark:bg-white/5`}>
                  {listObj.title}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Expanded Interactive Drawer: Inline Edit + Keyboard Shortcuts + Subtasks + Quick Date/Time + Recurrence + Indent/Move */}
        {isExpanded && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="px-3 pb-2.5 pt-1.5 border-t border-black/[0.06] dark:border-white/[0.08] space-y-2 animate-in fade-in duration-150"
          >
            {/* Inline Editable Title & Details with Native Google Tasks Keyboard Shortcuts */}
            <div className="space-y-1">
              <input
                type="text"
                value={task.title}
                onChange={(e) => handleUpdateTaskField(task.id, { title: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleInsertTaskBelow(task.id);
                  } else if (e.key === 'Backspace' && task.title === '') {
                    e.preventDefault();
                    handleDeleteTask(task.id);
                  } else if (e.key === 'Tab' && !e.shiftKey) {
                    e.preventDefault();
                    handleIndentTask(task.id);
                  }
                }}
                placeholder="Título da tarefa (Enter cria abaixo · Tab vira subtarefa)..."
                className={`w-full bg-black/[0.04] dark:bg-white/[0.05] rounded-md px-2 py-1 text-xs font-semibold outline-none focus:ring-1 focus:ring-[#3B82F6] ${textColor}`}
              />
              <input
                type="text"
                value={task.details || ''}
                onChange={(e) => handleUpdateTaskField(task.id, { details: e.target.value })}
                placeholder="Adicionar detalhes / notas..."
                className={`w-full bg-black/[0.03] dark:bg-white/[0.04] rounded-md px-2 py-1 text-[10px] outline-none ${subTextColor} ${darkMode ? 'focus:text-white' : 'focus:text-[#202124]'}`}
              />
            </div>

            {/* Quick Date + Time + Recurrence + Indent Bar */}
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={(e) => handleSetTaskDateOffset(task.id, 0, e)}
                className={`min-h-[24px] text-[10px] font-medium px-2 py-0.5 rounded-md border ${
                  darkMode ? 'border-white/15 hover:bg-white/10' : 'border-black/10 hover:bg-black/5'
                } ${textColor}`}
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={(e) => handleSetTaskDateOffset(task.id, 1, e)}
                className={`min-h-[24px] text-[10px] font-medium px-2 py-0.5 rounded-md border ${
                  darkMode ? 'border-white/15 hover:bg-white/10' : 'border-black/10 hover:bg-black/5'
                } ${textColor}`}
              >
                Amanhã
              </button>
              <button
                type="button"
                onClick={(e) => handleSetTaskDateOffset(task.id, 7, e)}
                className={`min-h-[24px] text-[10px] font-medium px-2 py-0.5 rounded-md border ${
                  darkMode ? 'border-white/15 hover:bg-white/10' : 'border-black/10 hover:bg-black/5'
                } ${textColor}`}
              >
                +7 dias
              </button>

              {/* Specific Time Picker */}
              <div
                className={`min-h-[24px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] ${
                  darkMode ? 'border-white/15 bg-black/20' : 'border-black/10 bg-white/50'
                } ${textColor}`}
                title="Definir horário e sincronizar com a Agenda"
              >
                <Clock size={10} className="text-[#3B82F6]" />
                <input
                  type="time"
                  value={task.time || ''}
                  onChange={(e) => handleSetTaskTime(task.id, e.target.value)}
                  className="bg-transparent border-none outline-none text-[10px] w-[58px]"
                />
              </div>

              {/* Cycle Recurrence Button */}
              <button
                type="button"
                onClick={(e) => handleCycleRecurrence(task.id, e)}
                className={`min-h-[24px] inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md border ${
                  task.recurrence && task.recurrence !== 'none'
                    ? 'border-purple-500/40 bg-purple-500/15 text-purple-400'
                    : `${darkMode ? 'border-white/15' : 'border-black/10'} ${subTextColor}`
                }`}
                title="Alternar repetição automática"
              >
                <Repeat size={10} />
                <span>{RECURRENCE_LABELS[task.recurrence || 'none']}</span>
              </button>

              {/* Indent into Subtask Button */}
              {canIndent && (
                <button
                  type="button"
                  onClick={(e) => handleIndentTask(task.id, e)}
                  className={`min-h-[24px] inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md border ${
                    darkMode ? 'border-white/15 hover:bg-white/10 hover:text-white' : 'border-black/10 hover:bg-black/5 hover:text-[#202124]'
                  } ${subTextColor}`}
                  title="Transformar em subtarefa da tarefa acima (Tab)"
                >
                  <CornerDownRight size={10} />
                  <span>Recuar</span>
                </button>
              )}
            </div>

            {/* Subtasks List & Inline Add Subtask (with Unindent / Promote button) */}
            <div className="space-y-1 pl-1">
              {subtasks.map((sub) => (
                <div
                  key={sub.id}
                  onClick={(e) => handleToggleSubtask(task.id, sub.id, e)}
                  className="flex items-center justify-between gap-2 py-0.5 px-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer group/sub"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CornerDownRight size={10} className={subTextColor} />
                    <div
                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                        sub.completed
                          ? 'bg-[#34A853] border-[#34A853] text-white'
                          : darkMode
                          ? 'border-white/40'
                          : 'border-black/30'
                      }`}
                    >
                      {sub.completed && <Check size={8} strokeWidth={3} />}
                    </div>
                    <span
                      className={`text-[11px] truncate ${
                        sub.completed ? `${subTextColor} line-through` : textColor
                      }`}
                    >
                      {sub.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover/sub:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => handlePromoteSubtask(task.id, sub.id, e)}
                      className={`w-6 h-6 flex items-center justify-center rounded ${subTextColor} hover:text-[#3B82F6]`}
                      title="Promover para tarefa principal (Unindent)"
                      aria-label="Promover subtarefa"
                    >
                      <CornerUpLeft size={10} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSubtask(task.id, sub.id, e)}
                      className={`w-6 h-6 flex items-center justify-center rounded ${subTextColor} hover:text-red-500`}
                      title="Excluir subtarefa"
                      aria-label="Excluir subtarefa"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              ))}

              {/* Add Subtask Input */}
              <div className="flex items-center gap-1.5 pt-0.5">
                <CornerDownRight size={11} className={subTextColor} />
                <input
                  type="text"
                  value={subtaskInputs[task.id] || ''}
                  onChange={(e) =>
                    setSubtaskInputs((prev) => ({ ...prev, [task.id]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSubtask(task.id);
                    }
                  }}
                  placeholder="Adicionar subtarefa..."
                  className={`flex-1 min-w-0 bg-black/[0.05] dark:bg-white/[0.06] rounded-md px-2 py-1 text-[10px] outline-none ${textColor} ${darkMode ? 'placeholder:text-white/50' : 'placeholder:text-[#5f6368]'}`}
                />
                {(subtaskInputs[task.id] || '').trim() && (
                  <button
                    type="button"
                    onClick={() => handleAddSubtask(task.id)}
                    className="w-6 h-6 flex items-center justify-center rounded bg-[#3B82F6] text-white text-[10px] font-bold"
                    aria-label="Adicionar subtarefa"
                  >
                    +
                  </button>
                )}
              </div>
            </div>

            {/* Footer: Move to another list + Open in Full App + Delete */}
            <div className="flex items-center justify-between pt-1 border-t border-black/5 dark:border-white/5 text-[10px]">
              <div className="flex items-center gap-1 overflow-x-auto">
                <span className={subTextColor}>Lista:</span>
                {taskLists.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={(e) => handleMoveTaskToList(task.id, l.id, e)}
                    className={`min-h-[24px] px-2 py-0.5 rounded transition-colors ${
                      (task.listId || 'default') === l.id
                        ? 'bg-[#3B82F6]/20 text-[#3B82F6] font-bold'
                        : `${subTextColor} ${darkMode ? 'hover:text-white' : 'hover:text-[#202124]'}`
                    }`}
                  >
                    {l.title}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onOpenApp('tasks')}
                  className={`w-6 h-6 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10 ${subTextColor} ${darkMode ? 'hover:text-white' : 'hover:text-[#202124]'}`}
                  title="Abrir no Google Tarefas em tela cheia"
                  aria-label="Abrir no Google Tarefas"
                >
                  <ExternalLink size={11} />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDeleteTask(task.id, e)}
                  className={`w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/15 ${subTextColor} hover:text-red-500`}
                  title="Excluir tarefa"
                  aria-label="Excluir tarefa"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col justify-between relative">
      {/* Top Header: Radial Progress + Multi-List Dropdown + View/Sort Controls + More Menu */}
      <div className={`pb-2 mb-2 border-b ${cardHeaderBorder} shrink-0`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {moduleDragControls}

            {/* Radial Progress Donut Gauge */}
            <div
              onClick={() => onOpenApp('tasks')}
              className="relative w-8 h-8 flex items-center justify-center shrink-0 cursor-pointer"
              title="Abrir Google Tarefas em tela cheia"
            >
              <svg className="w-8 h-8 -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r={ringRadius}
                  fill="none"
                  className={darkMode ? 'stroke-white/10' : 'stroke-black/10'}
                  strokeWidth="3.4"
                />
                <circle
                  cx="18"
                  cy="18"
                  r={ringRadius}
                  fill="none"
                  stroke="url(#tasksHomeGrad)"
                  strokeWidth="3.4"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  className="transition-all duration-500"
                />
                <defs>
                  <linearGradient id="tasksHomeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#34A853" />
                  </linearGradient>
                </defs>
              </svg>
              <span className={`absolute text-[8px] font-extrabold ${textColor}`}>{progressPct}%</span>
            </div>

            {/* List Selector Dropdown */}
            <div className="relative min-w-0" ref={listDropdownRef}>
              {isRenamingList ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={renameListValue}
                    onChange={(e) => setRenameListValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRenameCurrentList()}
                    className={`w-28 text-xs font-bold px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 outline-none ${textColor}`}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleRenameCurrentList}
                    className="p-1 text-[#34A853]"
                  >
                    <Check size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    playSound('tick');
                    setShowListDropdown((prev) => !prev);
                  }}
                  className="flex flex-col text-left min-w-0 group"
                >
                  <div className="flex items-center gap-1 min-w-0">
                    <span className={`font-bold text-xs @[340px]:text-sm leading-none truncate ${textColor}`}>
                      {currentListLabel}
                    </span>
                    <ChevronDown size={12} className={`${subTextColor} shrink-0`} />
                  </div>
                  <span className={`text-[10px] ${subTextColor} mt-0.5 truncate`}>
                    {pendingTasks.length} pendentes · {completedCount} feitas
                  </span>
                </button>
              )}

              {/* Dropdown Menu for Lists */}
              {showListDropdown && (
                <div
                  className={`absolute left-0 top-10 w-52 rounded-2xl p-1.5 border shadow-2xl z-50 backdrop-blur-2xl ${
                    darkMode ? 'bg-[#18191C] border-white/15' : 'bg-white border-black/10'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedListFilter('all');
                      setShowListDropdown(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium ${
                      selectedListFilter === 'all'
                        ? 'bg-[#3B82F6]/15 text-[#3B82F6] font-bold'
                        : `${textColor} hover:bg-black/5 dark:hover:bg-white/5`
                    }`}
                  >
                    <span>Todas as Listas</span>
                    <span className="text-[10px] opacity-70">{tasks.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedListFilter('starred');
                      setShowListDropdown(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium ${
                      selectedListFilter === 'starred'
                        ? 'bg-[#FBBC04]/20 text-[#FBBC04] font-bold'
                        : `${textColor} hover:bg-black/5 dark:hover:bg-white/5`
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Star size={11} className="fill-[#FBBC04] text-[#FBBC04]" />
                      <span>Com estrela</span>
                    </span>
                    <span className="text-[10px] opacity-70">
                      {tasks.filter((t) => t.starred).length}
                    </span>
                  </button>

                  <div className="my-1 border-t border-black/10 dark:border-white/10" />

                  {taskLists.map((list) => {
                    const count = tasks.filter((t) => (t.listId || 'default') === list.id && !t.completed).length;
                    return (
                      <button
                        key={list.id}
                        type="button"
                        onClick={() => {
                          setSelectedListFilter(list.id);
                          setShowListDropdown(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs ${
                          selectedListFilter === list.id
                            ? 'bg-[#3B82F6]/15 text-[#3B82F6] font-bold'
                            : `${textColor} hover:bg-black/5 dark:hover:bg-white/5`
                        }`}
                      >
                        <span className="truncate">{list.title}</span>
                        <span className="text-[10px] opacity-70">{count}</span>
                      </button>
                    );
                  })}

                  <div className="mt-1 pt-1 border-t border-black/10 dark:border-white/10">
                    {isCreatingList ? (
                      <div className="flex items-center gap-1 px-1 py-0.5">
                        <input
                          type="text"
                          value={newListName}
                          onChange={(e) => setNewListName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleCreateList()}
                          placeholder="Nome da nova lista..."
                          className={`flex-1 min-w-0 bg-black/10 dark:bg-white/10 rounded-lg px-2 py-1 text-xs outline-none ${textColor}`}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleCreateList}
                          className="p-1 rounded-lg bg-[#3B82F6] text-white"
                        >
                          <Check size={12} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsCreatingList(true)}
                        className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#3B82F6] hover:bg-[#3B82F6]/10`}
                      >
                        <FolderPlus size={12} />
                        <span>Criar nova lista</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Controls: View Switcher (Sprint | Listas | Data) + Sort + More Menu */}
          <div className="flex items-center gap-1 shrink-0">
            <div
              className={`flex items-center p-0.5 rounded-xl border text-[10px] font-semibold ${
                darkMode ? 'bg-black/35 border-white/10' : 'bg-black/[0.05] border-black/10'
              }`}
            >
              {(
                [
                  { id: 'sprint', label: 'Sprint' },
                  { id: 'board', label: 'Listas' },
                  { id: 'grouped', label: 'Data' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    playSound('tick');
                    setViewMode(tab.id);
                  }}
                  className={`min-h-[28px] px-2.5 py-0.5 rounded-lg transition-all ${
                    viewMode === tab.id
                      ? darkMode
                        ? 'bg-white/15 text-white shadow-sm'
                        : 'bg-white text-black shadow-sm'
                      : `${subTextColor} hover:opacity-85`
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Cycle Sort Button */}
            <button
              type="button"
              onClick={() => {
                playSound('tick');
                const order: SortMode[] = ['manual', 'date', 'starred', 'title', 'completedAt'];
                const next = order[(order.indexOf(sortMode) + 1) % order.length];
                setSortMode(next);
              }}
              className={`min-w-[28px] h-7 px-2 rounded-lg glass-item flex items-center justify-center gap-1 text-[10px] font-medium ${subTextColor} ${darkMode ? 'hover:text-white' : 'hover:text-[#202124]'}`}
              title={`Ordenação atual: ${
                sortMode === 'manual'
                  ? 'Minha ordem'
                  : sortMode === 'date'
                  ? 'Por Data'
                  : sortMode === 'starred'
                  ? 'Com estrela'
                  : sortMode === 'title'
                  ? 'Título (A-Z)'
                  : 'Concluídas recentemente'
              }`}
              aria-label="Alterar ordenação"
            >
              <ArrowUpDown size={11} />
              <span className="hidden @[400px]:inline">
                {sortMode === 'manual'
                  ? 'Ordem'
                  : sortMode === 'date'
                  ? 'Data'
                  : sortMode === 'starred'
                  ? '★'
                  : sortMode === 'title'
                  ? 'A-Z'
                  : 'Feitas'}
              </span>
            </button>

            {/* More Actions Menu (⋯) */}
            <div className="relative" ref={moreMenuRef}>
              <button
                type="button"
                onClick={() => setShowMoreMenu((prev) => !prev)}
                className={`w-7 h-7 rounded-lg glass-item flex items-center justify-center ${subTextColor} ${darkMode ? 'hover:text-white' : 'hover:text-[#202124]'}`}
                title="Opções da lista"
                aria-label="Opções da lista"
              >
                <MoreHorizontal size={13} />
              </button>

              {showMoreMenu && (
                <div
                  className={`absolute right-0 top-7 w-56 rounded-2xl p-1.5 border shadow-2xl z-50 backdrop-blur-2xl ${
                    darkMode ? 'bg-[#18191C] border-white/15' : 'bg-white border-black/10'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      onOpenApp('tasks');
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs ${textColor} hover:bg-black/5 dark:hover:bg-white/5`}
                  >
                    <ExternalLink size={12} className="text-[#3B82F6]" />
                    <span>Abrir Google Tarefas</span>
                  </button>

                  {selectedListFilter !== 'all' && selectedListFilter !== 'starred' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setRenameListValue(currentListLabel);
                          setIsRenamingList(true);
                          setShowMoreMenu(false);
                        }}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs ${textColor} hover:bg-black/5 dark:hover:bg-white/5`}
                      >
                        <Edit3 size={12} />
                        <span>Renomear lista</span>
                      </button>

                      {taskLists.findIndex((l) => l.id === selectedListFilter) > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            handleMoveListOrder(selectedListFilter, 'first');
                            setShowMoreMenu(false);
                          }}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs ${textColor} hover:bg-black/5 dark:hover:bg-white/5`}
                        >
                          <ChevronsLeft size={12} />
                          <span>Mover lista para o início</span>
                        </button>
                      )}
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowPrintModal(true);
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs ${textColor} hover:bg-black/5 dark:hover:bg-white/5`}
                  >
                    <Printer size={12} />
                    <span>Imprimir / Exportar lista</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearCompleted}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 size={12} />
                    <span>Limpar concluídas ({completedCount})</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'board' ? (
        /* MODO QUADRO MULTI-LISTAS (Estilo Google Tasks Desktop Web: Listas lado a lado com Reordenação de Colunas + Drag-and-Drop entre listas) */
        <div className="flex-1 min-h-0 flex gap-2 overflow-x-auto custom-scrollbar pb-1">
          {taskLists.map((list, idx) => {
            const listTasks = sortTasks(tasks.filter((t) => (t.listId || 'default') === list.id));
            const isListDropActive = dragOverListId === list.id || dragOverColumnId === list.id;
            const isColumnBeingDragged = draggedColumnId === list.id;

            return (
              <div
                key={list.id}
                data-task-list-drop={list.id}
                className={`min-w-[215px] flex-1 flex flex-col min-h-0 rounded-2xl p-2 border transition-all ${
                  isColumnBeingDragged ? 'opacity-45 scale-95' : ''
                } ${
                  isListDropActive
                    ? 'border-[#3B82F6] bg-[#3B82F6]/10 ring-1 ring-[#3B82F6]'
                    : darkMode
                    ? 'bg-black/20 border-white/[0.06]'
                    : 'bg-black/[0.03] border-black/[0.06]'
                }`}
              >
                <div className="flex items-center justify-between px-1 mb-1.5 shrink-0 gap-1">
                  <div
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      playSound('tick');
                      setDraggedColumnId(list.id);
                    }}
                    style={{ touchAction: 'none' }}
                    className="flex items-center gap-1 min-w-0 cursor-grab active:cursor-grabbing"
                    title="Arraste para reordenar esta lista"
                  >
                    <GripVertical size={11} className={`${subTextColor} opacity-60 shrink-0`} />
                    <span className={`text-[11px] font-bold truncate ${textColor}`}>{list.title}</span>
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => handleMoveListOrder(list.id, 'left')}
                        className={`w-6 h-6 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10 ${subTextColor}`}
                        title="Mover coluna para a esquerda"
                        aria-label="Mover coluna para a esquerda"
                      >
                        <ArrowLeft size={10} />
                      </button>
                    )}
                    {idx < taskLists.length - 1 && (
                      <button
                        type="button"
                        onClick={() => handleMoveListOrder(list.id, 'right')}
                        className={`w-6 h-6 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10 ${subTextColor}`}
                        title="Mover coluna para a direita"
                        aria-label="Mover coluna para a direita"
                      >
                        <ArrowRight size={10} />
                      </button>
                    )}
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-[#3B82F6]/20 text-[#3B82F6]">
                      {listTasks.filter((t) => !t.completed).length}
                    </span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-0.5 min-h-0">
                  {listTasks.map((t) => renderTaskItem(t, true))}
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === 'grouped' ? (
        /* MODO AGRUPADO POR DATA (Hoje/Atrasadas · Amanhã/Próximas · Sem data · Concluídas) */
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 min-h-0 space-y-2.5">
          {(() => {
            const now = new Date();
            const todayTasks = pendingTasks.filter((t) => {
              if (!t.date) return false;
              const d = new Date(t.date);
              return d.toDateString() === now.toDateString() || d.getTime() < now.getTime();
            });
            const upcomingTasks = pendingTasks.filter((t) => {
              if (!t.date) return false;
              const d = new Date(t.date);
              return d.toDateString() !== now.toDateString() && d.getTime() > now.getTime();
            });
            const undatedTasks = pendingTasks.filter((t) => !t.date);

            const groups = [
              { title: 'Hoje & Urgentes', items: todayTasks, accent: 'text-amber-400' },
              { title: 'Próximos Dias', items: upcomingTasks, accent: 'text-[#3B82F6]' },
              { title: 'Sem Data', items: undatedTasks, accent: subTextColor },
              { title: 'Concluídas', items: completedTasks, accent: 'text-[#34A853]' },
            ].filter((g) => g.items.length > 0);

            return groups.map((g) => (
              <div key={g.title} className="space-y-1">
                <div className="flex items-center justify-between px-1">
                  <span className={`text-[10px] font-extrabold uppercase tracking-wider ${g.accent}`}>
                    {g.title} ({g.items.length})
                  </span>
                </div>
                <div className="grid grid-cols-1 @[520px]:grid-cols-2 gap-1.5">
                  {g.items.map((t) => renderTaskItem(t, false))}
                </div>
              </div>
            ));
          })()}
        </div>
      ) : (
        /* MODO SPRINT (Spotlight #1 Prioridade + Fila Arrastável Adaptativa) */
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 min-h-0 flex flex-col gap-1.5">
          <div className="grid grid-cols-1 @[520px]:grid-cols-2 gap-1.5 content-start">
            {[...pendingTasks, ...completedTasks].map((t) => renderTaskItem(t, false))}
          </div>
        </div>
      )}

      {/* Bottom Quick-Add Bar with Inline Date/Time/Recurrence/Star Chips + "+" Button */}
      <div className="mt-2 pt-1.5 border-t border-black/5 dark:border-white/5 shrink-0 space-y-1.5">
        {showComposerChips && (
          <div className="flex flex-wrap items-center gap-1 px-0.5 animate-in fade-in duration-150">
            {(
              [
                { id: 'today', label: 'Hoje' },
                { id: 'tomorrow', label: 'Amanhã' },
                { id: 'nextweek', label: '+7 dias' },
                { id: 'none', label: 'Sem data' },
              ] as const
            ).map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setQuickDatePreset(preset.id)}
                className={`min-h-[24px] text-[10px] font-semibold px-2 py-0.5 rounded-md border transition-colors ${
                  quickDatePreset === preset.id
                    ? 'bg-[#3B82F6] text-white border-[#3B82F6]'
                    : `${darkMode ? 'border-white/15' : 'border-black/10'} ${subTextColor}`
                }`}
              >
                {preset.label}
              </button>
            ))}

            <div
              className={`min-h-[24px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] ${
                darkMode ? 'border-white/15 bg-black/20' : 'border-black/10 bg-white/60'
              } ${textColor}`}
            >
              <Clock size={10} className="text-[#3B82F6]" />
              <input
                type="time"
                value={quickTime}
                onChange={(e) => setQuickTime(e.target.value)}
                className="bg-transparent border-none outline-none text-[10px] w-[56px]"
              />
            </div>

            <button
              type="button"
              onClick={() => setQuickRecurrence(NEXT_RECURRENCE[quickRecurrence])}
              className={`min-h-[24px] inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                quickRecurrence !== 'none'
                  ? 'bg-purple-500/20 text-purple-400 border-purple-500/40'
                  : `${darkMode ? 'border-white/15' : 'border-black/10'} ${subTextColor}`
              }`}
              title="Repetição da nova tarefa"
            >
              <Repeat size={10} />
              <span>{quickRecurrence === 'none' ? 'Repetir' : RECURRENCE_LABELS[quickRecurrence]}</span>
            </button>

            <button
              type="button"
              onClick={() => setQuickStarred((s) => !s)}
              className={`w-6 h-6 flex items-center justify-center rounded-md border ${
                quickStarred
                  ? 'bg-[#FBBC04]/20 border-[#FBBC04]/50 text-[#FBBC04]'
                  : `${darkMode ? 'border-white/15' : 'border-black/10'} ${subTextColor}`
              }`}
              title="Favoritar com estrela"
              aria-label="Favoritar com estrela"
            >
              <Star size={10} className={quickStarred ? 'fill-[#FBBC04]' : ''} />
            </button>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <div className="flex-1 min-w-0 flex items-center glass-item rounded-xl px-2.5 h-8 gap-1.5">
            <input
              type="text"
              value={newTaskTitle}
              onFocus={() => setShowComposerChips(true)}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleQuickAddTask()}
              placeholder="Adicionar tarefa (data, hora, repetição, subtarefas)..."
              className={`flex-1 min-w-0 bg-transparent border-none outline-none text-xs ${textColor} ${darkMode ? 'placeholder:text-white/50' : 'placeholder:text-[#5f6368]'}`}
            />
            <button
              type="button"
              onClick={() => setShowComposerChips((prev) => !prev)}
              className={`w-7 h-7 flex items-center justify-center rounded-md shrink-0 ${
                showComposerChips ? 'text-[#3B82F6]' : subTextColor
              } ${darkMode ? 'hover:text-white' : 'hover:text-[#202124]'}`}
              title="Opções de data, hora e repetição"
              aria-label="Opções de data, hora e repetição"
            >
              <Calendar size={12} />
            </button>
          </div>

          <button
            type="button"
            onClick={handleQuickAddTask}
            title="Adicionar tarefa"
            className={`w-8 h-8 rounded-xl transition border flex items-center justify-center shrink-0 ${
              darkMode
                ? 'text-blue-400 bg-blue-400/10 border-blue-400/25 hover:bg-blue-400/20'
                : 'text-blue-600 bg-blue-600/10 border-blue-600/25 hover:bg-blue-600/20'
            }`}
          >
            <Plus size={15} />
          </button>
        </div>
      </div>

      {/* Print / Export List Modal via Portal so it isn't clipped by parent backdrop-filter */}
      {showPrintModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            onClick={() => setShowPrintModal(false)}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-lg rounded-2xl border p-5 shadow-2xl space-y-4 ${
                darkMode ? 'bg-[#18191C] border-white/15 text-white' : 'bg-white border-black/10 text-gray-900'
              }`}
            >
              <div className="flex items-center justify-between border-b pb-3 border-black/10 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <Printer size={18} className="text-[#3B82F6]" />
                  <h3 className="font-bold text-sm">Imprimir / Exportar — {currentListLabel}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="p-1 rounded-lg opacity-60 hover:opacity-100"
                >
                  <X size={16} />
                </button>
              </div>

              <pre
                className={`max-h-64 overflow-y-auto custom-scrollbar p-3 rounded-xl text-[11px] font-mono whitespace-pre-wrap border ${
                  darkMode ? 'bg-black/40 border-white/10 text-white/85' : 'bg-gray-50 border-gray-200 text-gray-800'
                }`}
              >
                {buildPrintableText()}
              </pre>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyListText}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                    darkMode ? 'border-white/15 hover:bg-white/10' : 'border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <Copy size={13} />
                  <span>Copiar texto</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadListTxt}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                    darkMode ? 'border-white/15 hover:bg-white/10' : 'border-gray-200 hover:bg-gray-100'
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
          </div>,
          document.body
        )}
    </div>
  );
}
