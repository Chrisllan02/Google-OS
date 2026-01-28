
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    CheckCircle2, Settings, X, Search, Star, Plus, Trash2, Calendar, 
    GripVertical, Loader2, AlignLeft, ChevronRight, Mail, List as ListIcon, 
    MoreVertical, ChevronDown, Check, FolderPlus, ArrowLeft
} from 'lucide-react';
import { bridge, TaskItem, TaskList } from '../../utils/GASBridge';

interface TasksAppProps {
  onClose: () => void;
  data: any;
  onUpdate?: (tasks: TaskItem[]) => void;
  showToast?: (msg: string) => void;
}

export default function TasksApp({ onClose, data, onUpdate, showToast }: TasksAppProps) {
  // State for Lists
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [currentListId, setCurrentListId] = useState<string>('@default');
  const [showListMenu, setShowListMenu] = useState(false);
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');

  // State for Tasks
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [activeTask, setActiveTask] = useState<TaskItem | null>(null);
  
  // Loading States
  const [loadingTasks, setLoadingTasks] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listMenuRef = useRef<HTMLDivElement>(null);

  const toast = (msg: string) => showToast && showToast(msg);

  // --- INIT ---
  useEffect(() => {
      // Initial Load from Data Prop
      if (data?.taskLists) setTaskLists(data.taskLists);
      if (data?.tasks) setTasks(data.tasks); // These are default list tasks
      
      // Fetch full list of lists if needed
      const loadLists = async () => {
          const lists = await bridge.getTaskLists();
          if (lists.length > 0) {
              setTaskLists(lists);
              if (currentListId === '@default' && lists[0].id) {
                   setCurrentListId(lists[0].id);
              }
          }
      };
      loadLists();
  }, [data]);

  // Load tasks when list changes
  useEffect(() => {
      if (currentListId) {
          fetchTasks(currentListId);
      }
  }, [currentListId]);

  useEffect(() => {
      const closeMenu = (e: MouseEvent) => {
          if (listMenuRef.current && !listMenuRef.current.contains(e.target as Node)) {
              setShowListMenu(false);
              setIsCreatingList(false);
          }
      };
      window.addEventListener('mousedown', closeMenu);
      return () => window.removeEventListener('mousedown', closeMenu);
  }, []);

  const fetchTasks = async (listId: string) => {
      setLoadingTasks(true);
      try {
          const res = await bridge.getTasks(listId);
          setTasks(res);
      } catch (e) {
          console.error(e);
      } finally {
          setLoadingTasks(false);
      }
  };

  // --- HIERARCHY BUILDER ---
  const buildTaskTree = (flatTasks: TaskItem[]) => {
      const taskMap: {[key: string]: TaskItem} = {};
      const roots: TaskItem[] = [];

      // Initialize map with subtasks array
      flatTasks.forEach(t => {
          taskMap[t.id] = { ...t, subtasks: [] };
      });

      // Build tree
      flatTasks.forEach(t => {
          if (t.parent && taskMap[t.parent]) {
              taskMap[t.parent].subtasks?.push(taskMap[t.id]);
          } else {
              roots.push(taskMap[t.id]);
          }
      });

      // Sort by position or completion
      const sorter = (a: TaskItem, b: TaskItem) => {
          if (a.completed !== b.completed) return a.completed ? 1 : -1;
          // Use position string if available, else date
          if (a.position && b.position) return a.position.localeCompare(b.position);
          return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
      };

      const sortRecursive = (items: TaskItem[]) => {
          items.sort(sorter);
          items.forEach(i => {
              if (i.subtasks && i.subtasks.length > 0) sortRecursive(i.subtasks);
          });
      };

      sortRecursive(roots);
      return roots;
  };

  const treeTasks = useMemo(() => buildTaskTree(tasks), [tasks]);

  // --- ACTIONS ---

  const handleSwitchList = (listId: string) => {
      setCurrentListId(listId);
      setShowListMenu(false);
      setActiveTask(null);
  };

  const handleCreateList = async () => {
      if (!newListTitle.trim()) return;
      const res = await bridge.createTaskList(newListTitle);
      if (res && res.id) {
          setTaskLists(prev => [...prev, res]);
          setCurrentListId(res.id);
          setNewListTitle('');
          setIsCreatingList(false);
          setShowListMenu(false);
          toast("Lista criada");
      }
  };

  const handleDeleteList = async (id: string) => {
      if (window.confirm("Tem certeza que deseja excluir esta lista?")) {
          await bridge.deleteTaskList(id);
          setTaskLists(prev => prev.filter(l => l.id !== id));
          if (currentListId === id && taskLists.length > 0) setCurrentListId(taskLists[0].id);
          toast("Lista excluída");
      }
  };

  const handleAddTask = async (parentId?: string) => {
      const title = newTaskTitle.trim();
      if (!title) { setIsAdding(false); return; }

      // Optimistic Update
      const tempId = "temp_" + Date.now();
      const newTask: TaskItem = {
          id: tempId,
          title: title,
          completed: false,
          date: new Date().toISOString(),
          parent: parentId
      };
      
      setTasks(prev => [...prev, newTask]);
      setNewTaskTitle('');
      if (!parentId) inputRef.current?.focus();
      
      // API Call
      const res = await bridge.createTask(title, '', currentListId, undefined, parentId);
      if (res.success && res.task) {
          // Replace temp with real
          setTasks(prev => prev.map(t => t.id === tempId ? res.task : t));
          toast("Tarefa criada");
      }
  };

  const handleToggleTask = async (id: string) => {
      // Optimistic
      setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
      if (activeTask?.id === id) setActiveTask(prev => prev ? {...prev, completed: !prev.completed} : null);
      
      await bridge.toggleTask(id, currentListId);
  };

  const handleUpdateTask = async (updates: Partial<TaskItem>) => {
      if (!activeTask) return;
      // Optimistic
      const updated = { ...activeTask, ...updates };
      setActiveTask(updated);
      setTasks(prev => prev.map(t => t.id === activeTask.id ? { ...t, ...updates } : t));
      
      await bridge.updateTask({ ...updates, id: activeTask.id, listId: currentListId });
  };

  const handleDeleteTask = async (id: string) => {
      setTasks(prev => prev.filter(t => t.id !== id));
      if (activeTask?.id === id) setActiveTask(null);
      await bridge.deleteTask(id, currentListId);
      toast("Tarefa excluída");
  };

  // Recursively render tasks
  const TaskNode = ({ task, depth = 0 }: { task: TaskItem, depth?: number }) => (
      <>
        <div 
            onClick={() => setActiveTask(task)}
            className={`group flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 transition-all cursor-pointer ${task.completed ? 'opacity-50' : ''} ${activeTask?.id === task.id ? 'bg-blue-500/10' : ''}`}
            style={{ paddingLeft: `${(depth * 20) + 12}px` }}
        >
            <button 
                onClick={(e) => { e.stopPropagation(); handleToggleTask(task.id); }}
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 transition-all shrink-0 ${task.completed ? 'bg-blue-500 border-blue-500' : 'border-white/40 hover:border-white'}`}
            >
                {task.completed && <Check size={12} className="text-white"/>}
            </button>
            <div className="flex-1 min-w-0">
                <span className={`text-sm block ${task.completed ? 'line-through text-white/40' : 'text-white'}`}>{task.title}</span>
                {task.details && <p className="text-xs text-white/40 mt-1 truncate">{task.details}</p>}
                {task.date && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded-full w-fit">
                        <Calendar size={10}/> {new Date(task.date).toLocaleDateString()}
                    </div>
                )}
            </div>
            
            {/* Context Menu Trigger (only on hover) */}
            <div className="opacity-0 group-hover:opacity-100 flex items-center">
                <button 
                    onClick={(e) => { e.stopPropagation(); setActiveTask(task); }} 
                    className="p-1 hover:bg-white/10 rounded"
                    title="Detalhes e Subtarefas"
                >
                   <ChevronRight size={16} className="text-white/60"/>
                </button>
            </div>
        </div>
        {/* Render Children */}
        {task.subtasks?.map(sub => <TaskNode key={sub.id} task={sub} depth={depth + 1} />)}
      </>
  );

  const currentListName = taskLists.find(l => l.id === currentListId)?.title || "Minhas Tarefas";

  const appHeaderClass = "h-16 px-6 flex items-center justify-between shrink-0 border-b border-white/5 backdrop-blur-xl z-20 bg-black/20";

  return (
    <div className="flex flex-col h-full bg-[#202124] text-white overflow-hidden font-sans">
        {/* HEADER */}
        <div className={appHeaderClass}>
            <div className="flex items-center gap-4 relative" ref={listMenuRef}>
                <div className="p-2 bg-white/10 rounded-full"><CheckCircle2 className="w-5 h-5 text-blue-400"/></div>
                <button 
                    onClick={() => setShowListMenu(!showListMenu)}
                    className="flex items-center gap-2 text-white text-lg font-medium hover:bg-white/5 px-2 py-1 rounded-lg transition-colors"
                >
                    {currentListName} <ChevronDown size={16} className="text-white/50"/>
                </button>

                {showListMenu && (
                    <div className="absolute top-14 left-0 w-64 bg-[#2d2e30] border border-white/10 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in duration-200 flex flex-col">
                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                            {taskLists.map(list => (
                                <div key={list.id} className="flex items-center justify-between group hover:bg-white/5 px-4 py-2 cursor-pointer" onClick={() => handleSwitchList(list.id)}>
                                    <span className={`text-sm ${currentListId === list.id ? 'text-blue-400 font-medium' : 'text-white/80'}`}>{list.title}</span>
                                    {currentListId === list.id && <Check size={14} className="text-blue-400"/>}
                                    {list.id !== '@default' && currentListId !== list.id && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDeleteList(list.id); }}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400"
                                        >
                                            <Trash2 size={14}/>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="border-t border-white/10 mt-1 pt-1 px-2">
                             {isCreatingList ? (
                                 <div className="flex items-center gap-2 p-1">
                                     <input 
                                        autoFocus
                                        className="bg-black/20 border border-white/10 rounded px-2 py-1 text-sm text-white flex-1 outline-none"
                                        placeholder="Nome da lista"
                                        value={newListTitle}
                                        onChange={(e) => setNewListTitle(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleCreateList()}
                                     />
                                     <button onClick={handleCreateList} className="text-blue-400 hover:bg-white/10 p-1 rounded"><Check size={16}/></button>
                                 </div>
                             ) : (
                                <button onClick={() => setIsCreatingList(true)} className="w-full text-left flex items-center gap-2 px-2 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                                    <Plus size={16}/> Criar nova lista
                                </button>
                             )}
                        </div>
                    </div>
                )}
            </div>
            
            <div className="p-2 hover:bg-white/10 rounded-full cursor-pointer text-white/80" onClick={onClose}><X size={24} /></div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 flex overflow-hidden">
            {/* MAIN LIST */}
            <div className={`flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar transition-all duration-300 ${activeTask ? 'mr-0' : ''}`}>
                <div className="max-w-3xl mx-auto bg-[#1E1E1E] rounded-2xl overflow-hidden shadow-xl border border-white/10 flex flex-col h-full md:h-auto md:min-h-[600px]">
                    
                    {/* ADD TASK BAR */}
                    <div className="p-4 border-b border-white/10 flex items-center gap-3 bg-white/5">
                        <Plus size={20} className="text-blue-400"/>
                        <input 
                            ref={inputRef}
                            type="text"
                            placeholder="Adicionar uma tarefa"
                            className="bg-transparent text-white placeholder:text-white/40 outline-none flex-1"
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                        />
                        {newTaskTitle && <button onClick={() => handleAddTask()} className="text-sm font-medium text-blue-400">Adicionar</button>}
                    </div>

                    {/* TASK TREE */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                        {loadingTasks ? (
                            <div className="flex justify-center p-8"><Loader2 size={24} className="animate-spin text-blue-500"/></div>
                        ) : tasks.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-white/20">
                                <CheckCircle2 size={64} className="mb-4 opacity-20"/>
                                <p>Nenhuma tarefa nesta lista</p>
                            </div>
                        ) : (
                            treeTasks.map(t => <TaskNode key={t.id} task={t} />)
                        )}
                    </div>
                </div>
            </div>

            {/* DETAILS SIDEBAR */}
            {activeTask && (
                <div className="w-96 bg-[#1E1E1E] border-l border-white/10 flex flex-col animate-in slide-in-from-right duration-300 shadow-2xl z-20">
                    <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 shrink-0">
                        <span className="text-sm font-medium text-white/60">Detalhes</span>
                        <button onClick={() => setActiveTask(null)} className="p-1.5 hover:bg-white/10 rounded-full text-white/60"><X size={18}/></button>
                    </div>
                    
                    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                        <div className="space-y-6">
                            {/* Title & Check */}
                            <div className="flex items-start gap-3">
                                <button 
                                    onClick={() => handleToggleTask(activeTask.id)}
                                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mt-1 transition-all ${activeTask.completed ? 'bg-blue-500 border-blue-500' : 'border-white/40 hover:border-white'}`}
                                >
                                    {activeTask.completed && <Check size={16} className="text-white"/>}
                                </button>
                                <textarea 
                                    className={`bg-transparent text-lg font-medium text-white outline-none w-full resize-none ${activeTask.completed ? 'line-through text-white/50' : ''}`}
                                    value={activeTask.title}
                                    onChange={(e) => handleUpdateTask({ title: e.target.value })}
                                    rows={2}
                                    placeholder="Título"
                                />
                            </div>

                            {/* Details */}
                            <div className="flex items-start gap-4 hover:bg-white/5 p-2 rounded-lg transition-colors group">
                                <AlignLeft size={20} className="text-white/40 mt-1"/>
                                <textarea 
                                    className="bg-transparent text-sm text-white/80 placeholder:text-white/30 outline-none w-full resize-none min-h-[80px] cursor-pointer"
                                    placeholder="Adicionar detalhes"
                                    value={activeTask.details || ''}
                                    onChange={(e) => handleUpdateTask({ details: e.target.value })}
                                />
                            </div>

                            {/* Date & Time */}
                            <div className="flex items-center gap-4 hover:bg-white/5 p-2 rounded-lg transition-colors group relative">
                                <Calendar size={20} className="text-white/40"/>
                                <div className="flex-1">
                                    <input 
                                        type="datetime-local" 
                                        className="bg-transparent text-sm text-white/80 outline-none w-full cursor-pointer"
                                        value={activeTask.date ? new Date(activeTask.date).toISOString().slice(0, 16) : ''}
                                        onChange={(e) => handleUpdateTask({ date: new Date(e.target.value).toISOString() })}
                                    />
                                    {!activeTask.date && <span className="text-sm text-white/30 absolute left-10 top-2 pointer-events-none">Adicionar data/hora</span>}
                                </div>
                            </div>
                            
                            {/* List Selector (Move) */}
                            <div className="flex items-center gap-4 hover:bg-white/5 p-2 rounded-lg transition-colors">
                                <ListIcon size={20} className="text-white/40"/>
                                <select 
                                    className="bg-transparent text-sm text-white/80 outline-none w-full cursor-pointer"
                                    value={currentListId}
                                    disabled
                                    // Moving lists is complex in API (requires insert/delete), so disabled for now
                                >
                                    <option>{currentListName}</option>
                                </select>
                            </div>

                            {/* Subtasks Section */}
                            <div className="border-t border-white/5 pt-4 mt-2">
                                <h4 className="text-xs font-bold text-white/40 uppercase mb-3">Subtarefas</h4>
                                <div className="space-y-2 pl-2">
                                    {activeTask.subtasks?.map(sub => (
                                        <div key={sub.id} className="flex items-center gap-2 text-sm text-white/80 p-2 bg-white/5 rounded-lg">
                                            <div className={`w-3 h-3 border rounded-full ${sub.completed ? 'bg-white/40' : 'border-white/40'}`}></div>
                                            <span className={sub.completed ? 'line-through opacity-50' : ''}>{sub.title}</span>
                                        </div>
                                    ))}
                                    <div className="flex items-center gap-2">
                                        <Plus size={16} className="text-blue-400"/>
                                        <input 
                                            className="bg-transparent text-sm outline-none flex-1 text-white placeholder:text-white/30"
                                            placeholder="Adicionar subtarefa"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleAddTask(activeTask.id);
                                                    (e.target as HTMLInputElement).value = '';
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border-t border-white/5 flex justify-end bg-[#1a1a1a]">
                        <button 
                            onClick={() => handleDeleteTask(activeTask.id)}
                            className="p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-red-400 transition-colors" 
                            title="Excluir tarefa"
                        >
                            <Trash2 size={18}/>
                        </button>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
}
