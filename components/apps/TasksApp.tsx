import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    CheckCircle2, X, Plus, Trash2, Calendar, 
    Loader2, AlignLeft, ChevronRight, 
    ChevronDown, Check
} from 'lucide-react';
import { bridge, TaskItem, TaskList } from '../../utils/GASBridge';
import { GoogleIcons } from '../GoogleIcons';

interface TasksAppProps {
  onClose: () => void;
  data: any;
  onUpdate?: (tasks: TaskItem[]) => void;
  showToast?: (msg: string) => void;
  isDarkMode?: boolean;
}

interface TaskNodeProps {
    task: TaskItem;
    depth?: number;
    activeTask: TaskItem | null;
    setActiveTask: (task: TaskItem | null) => void;
    onToggle: (id: string) => void;
    isDarkMode?: boolean;
}

const TaskNode: React.FC<TaskNodeProps> = ({ task, depth = 0, activeTask, setActiveTask, onToggle, isDarkMode = false }) => (
    <>
      <div 
          onClick={() => setActiveTask(task)}
          className={`group flex items-start gap-3 p-3 rounded-lg transition-all cursor-pointer ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-100'} ${task.completed ? 'opacity-50' : ''} ${activeTask?.id === task.id ? 'bg-blue-500/10' : ''}`}
          style={{ paddingLeft: `${(depth * 20) + 12}px` }}
      >
          <button 
              onClick={(e) => { e.stopPropagation(); onToggle(task.id); }}
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 transition-all shrink-0 ${task.completed ? 'bg-blue-500 border-blue-500' : isDarkMode ? 'border-white/40 hover:border-white' : 'border-gray-400 hover:border-blue-600'}`}
          >
              {task.completed && <Check size={12} className="text-white"/>}
          </button>
          <div className="flex-1 min-w-0">
              <span className={`text-sm block ${task.completed ? (isDarkMode ? 'line-through text-white/40' : 'line-through text-gray-400') : (isDarkMode ? 'text-white' : 'text-gray-800')}`}>{task.title}</span>
              {task.details && <p className={`text-xs mt-1 truncate ${isDarkMode ? 'text-white/40' : 'text-gray-500'}`}>{task.details}</p>}
              {task.date && (
                  <div className={`flex items-center gap-1 mt-1 text-[10px] px-2 py-0.5 rounded-full w-fit ${isDarkMode ? 'text-blue-300 bg-blue-500/10' : 'text-blue-700 bg-blue-50 border border-blue-200'}`}>
                      <Calendar size={10}/> {new Date(task.date).toLocaleDateString()}
                  </div>
              )}
          </div>
          
          <div className="opacity-0 group-hover:opacity-100 flex items-center">
              <button 
                  onClick={(e) => { e.stopPropagation(); setActiveTask(task); }} 
                  className={`p-1 rounded ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-200'}`}
                  title="Detalhes e Subtarefas"
              >
                 <ChevronRight size={16} className={isDarkMode ? "text-white/60" : "text-gray-500"}/>
              </button>
          </div>
      </div>
      {task.subtasks?.map(sub => <TaskNode key={sub.id} task={sub} depth={depth + 1} activeTask={activeTask} setActiveTask={setActiveTask} onToggle={onToggle} isDarkMode={isDarkMode} />)}
    </>
);

export default function TasksApp({ onClose, data, onUpdate, showToast, isDarkMode = false }: TasksAppProps) {
  const [taskLists, setTaskLists] = useState<TaskList[]>(data?.taskLists || []);
  const [currentListId, setCurrentListId] = useState<string>(data?.taskLists?.[0]?.id || '@default');
  const [showListMenu, setShowListMenu] = useState(false);
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [tasks, setTasks] = useState<TaskItem[]>(data?.tasks || []);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [, setIsAdding] = useState(false);
  const [activeTask, setActiveTask] = useState<TaskItem | null>(null);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingLists, setLoadingLists] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listMenuRef = useRef<HTMLDivElement>(null);
  const updateTimeout = useRef<any>(null);

  const toast = (msg: string) => showToast && showToast(msg);

  useEffect(() => {
    const loadLists = async () => {
      setLoadingLists(true);
      const lists = await bridge.getTaskLists();
      if (lists.length > 0) {
        setTaskLists(lists);
        if (!lists.find(l => l.id === currentListId)) {
            setCurrentListId(lists[0].id);
        }
      }
      setLoadingLists(false);
    };
    loadLists();

    const closeMenu = (e: MouseEvent) => {
        if (listMenuRef.current && !listMenuRef.current.contains(e.target as Node)) {
            setShowListMenu(false);
            setIsCreatingList(false);
        }
    };
    window.addEventListener('mousedown', closeMenu);
    return () => window.removeEventListener('mousedown', closeMenu);
  }, []);

  useEffect(() => {
    fetchTasks(currentListId);
  }, [currentListId]);

  const fetchTasks = async (listId: string) => {
    setLoadingTasks(true);
    setActiveTask(null);
    try {
      const res = await bridge.getTasks(listId);
      setTasks(res);
      if (onUpdate) onUpdate(res);
    } catch (e) {
      console.error(e);
      toast("Erro ao carregar tarefas.");
    } finally {
      setLoadingTasks(false);
    }
  };
  
  const buildTaskTree = (flatTasks: TaskItem[]) => {
      const taskMap: {[key: string]: TaskItem} = {};
      const roots: TaskItem[] = [];
      flatTasks.forEach(t => { taskMap[t.id] = { ...t, subtasks: [] }; });
      flatTasks.forEach(t => {
          if (t.parent && taskMap[t.parent]) {
              taskMap[t.parent].subtasks?.push(taskMap[t.id]);
          } else {
              roots.push(taskMap[t.id]);
          }
      });
      const sorter = (a: TaskItem, b: TaskItem) => (a.position || "").localeCompare(b.position || "");
      const sortRecursive = (items: TaskItem[]) => { items.sort(sorter); items.forEach(i => i.subtasks && sortRecursive(i.subtasks)); };
      sortRecursive(roots);
      return roots;
  };

  const treeTasks = useMemo(() => buildTaskTree(tasks), [tasks]);

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
    await bridge.deleteTaskList(id);
    const newLists = taskLists.filter(l => l.id !== id);
    setTaskLists(newLists);
    if (currentListId === id && newLists.length > 0) setCurrentListId(newLists[0].id);
    else if (newLists.length === 0) setCurrentListId('@default');
    toast("Lista excluída");
  };

  const handleAddTask = async (parentId?: string) => {
    const title = newTaskTitle.trim();
    if (!title) { setIsAdding(false); return; }
    const tempId = "temp_" + Date.now();
    const newTask: TaskItem = { id: tempId, title, completed: false, parent: parentId };
    setTasks(prev => [...prev, newTask]);
    setNewTaskTitle('');
    if (!parentId) inputRef.current?.focus();
    else setNewTaskTitle('');
    
    const res = await bridge.createTask(title, '', currentListId, undefined, parentId);
    if (res.success && res.task) {
      setTasks(prev => prev.map(t => t.id === tempId ? res.task : t));
    } else {
      setTasks(prev => prev.filter(t => t.id !== tempId));
      toast("Erro ao criar tarefa.");
    }
  };

  const handleToggleTask = async (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    if (activeTask?.id === id) setActiveTask(prev => prev ? {...prev, completed: !prev.completed} : null);
    await bridge.toggleTask(id, currentListId);
  };

  const handleUpdateTask = (updates: Partial<TaskItem>) => {
    if (!activeTask) return;
    const updated = { ...activeTask, ...updates };
    setActiveTask(updated);
    setTasks(prev => prev.map(t => t.id === activeTask.id ? updated : t));

    if (updateTimeout.current) clearTimeout(updateTimeout.current);
    updateTimeout.current = setTimeout(async () => {
      await bridge.updateTask({ ...updates, id: activeTask.id, listId: currentListId });
    }, 1000);
  };

  const handleDeleteTask = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    if (activeTask?.id === id) setActiveTask(null);
    await bridge.deleteTask(id, currentListId);
    toast("Tarefa excluída");
  };

  const currentListName = taskLists.find(l => l.id === currentListId)?.title || "Minhas Tarefas";
  const appHeaderClass = `h-16 px-6 flex items-center justify-between shrink-0 border-b backdrop-blur-xl z-20 ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-black/10 bg-white'}`;

  return (
    <div className={`flex flex-col h-full overflow-hidden font-sans transition-colors ${isDarkMode ? 'bg-[#202124] text-white' : 'bg-[#F8FAFC] text-[#202124]'}`}>
        <div className={appHeaderClass}>
            <div className="flex items-center gap-4 relative" ref={listMenuRef}>
                <div className="flex items-center"><GoogleIcons.Tasks className="w-7 h-7"/></div>
                <button onClick={() => setShowListMenu(!showListMenu)} className={`flex items-center gap-2 text-lg font-medium px-2 py-1 rounded-lg transition-colors ${isDarkMode ? 'text-white hover:bg-white/5' : 'text-gray-800 hover:bg-black/5'}`}>
                    {loadingLists ? <Loader2 size={16} className="animate-spin"/> : currentListName} <ChevronDown size={16} className={isDarkMode ? "text-white/50" : "text-gray-500"}/>
                </button>
                {showListMenu && (
                    <div className={`absolute top-14 left-0 w-64 border rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in duration-200 flex flex-col ${isDarkMode ? 'bg-[#2d2e30] border-white/10' : 'bg-white border-gray-200'}`}>
                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                            {taskLists.map(list => (
                                <div key={list.id} className={`flex items-center justify-between group px-4 py-2 cursor-pointer ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-100'}`} onClick={() => setCurrentListId(list.id)}>
                                    <span className={`text-sm ${currentListId === list.id ? 'text-blue-500 font-medium' : isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>{list.title}</span>
                                    {currentListId === list.id && <Check size={14} className="text-blue-500"/>}
                                    {currentListId !== list.id && (<button onClick={(e) => { e.stopPropagation(); handleDeleteList(list.id); }} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500"><Trash2 size={14}/></button>)}
                                </div>
                            ))}
                        </div>
                        <div className={`border-t mt-1 pt-1 px-2 ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
                             {isCreatingList ? (
                                 <div className="flex items-center gap-2 p-1"><input autoFocus className={`border rounded px-2 py-1 text-sm flex-1 outline-none ${isDarkMode ? 'bg-black/20 border-white/10 text-white' : 'bg-gray-50 border-gray-300 text-gray-800'}`} placeholder="Nome da lista" value={newListTitle} onChange={(e) => setNewListTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateList()}/><button onClick={handleCreateList} className="text-blue-500 hover:bg-blue-500/10 p-1 rounded"><Check size={16}/></button></div>
                             ) : (
                                <button onClick={() => setIsCreatingList(true)} className={`w-full text-left flex items-center gap-2 px-2 py-2 text-sm rounded-lg transition-colors ${isDarkMode ? 'text-white/60 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}><Plus size={16}/> Criar nova lista</button>
                             )}
                        </div>
                    </div>
                )}
            </div>
            <div className={`p-2 rounded-full cursor-pointer transition-colors ${isDarkMode ? 'hover:bg-white/10 text-white/80' : 'hover:bg-black/5 text-gray-600'}`} onClick={onClose}><X size={24} /></div>
        </div>

        <div className="flex-1 flex overflow-hidden">
            <div className={`flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar transition-all duration-300 ${activeTask ? 'mr-0' : ''}`}>
                <div className={`max-w-3xl mx-auto rounded-2xl overflow-hidden shadow-xl border flex flex-col h-full md:h-auto md:min-h-[600px] ${isDarkMode ? 'bg-[#1E1E1E] border-white/10' : 'bg-white border-gray-200'}`}>
                    <div className={`p-4 border-b flex items-center gap-3 ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-gray-100 bg-gray-50/70'}`}>
                        <Plus size={20} className="text-blue-500"/>
                        <input ref={inputRef} type="text" placeholder="Adicionar uma tarefa" className={`bg-transparent outline-none flex-1 ${isDarkMode ? 'text-white placeholder:text-white/40' : 'text-gray-800 placeholder:text-gray-400'}`} value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}/>
                        {newTaskTitle && <button onClick={() => handleAddTask()} className="text-sm font-medium text-blue-500">Adicionar</button>}
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                        {loadingTasks ? (<div className="flex justify-center p-8"><Loader2 size={24} className="animate-spin text-blue-500"/></div>) : tasks.length === 0 ? (<div className={`flex flex-col items-center justify-center h-64 ${isDarkMode ? 'text-white/20' : 'text-gray-400'}`}><CheckCircle2 size={64} className="mb-4 opacity-20"/><p>Nenhuma tarefa nesta lista</p></div>) : (treeTasks.map(t => <TaskNode key={t.id} task={t} activeTask={activeTask} setActiveTask={setActiveTask} onToggle={handleToggleTask} isDarkMode={isDarkMode} />))}
                    </div>
                </div>
            </div>

            {activeTask && (
                <div className={`w-96 border-l flex flex-col animate-in slide-in-from-right duration-300 shadow-2xl z-20 ${isDarkMode ? 'bg-[#1E1E1E] border-white/10' : 'bg-white border-gray-200'}`}>
                    <div className={`h-16 flex items-center justify-between px-6 border-b shrink-0 ${isDarkMode ? 'border-white/5' : 'border-gray-100'}`}>
                        <span className={`text-sm font-medium ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>Detalhes</span>
                        <button onClick={() => setActiveTask(null)} className={`p-1.5 rounded-full ${isDarkMode ? 'hover:bg-white/10 text-white/60' : 'hover:bg-gray-100 text-gray-500'}`}><X size={18}/></button>
                    </div>
                    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                        <div className="space-y-6">
                            <div className="flex items-start gap-3">
                                <button onClick={() => handleToggleTask(activeTask.id)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mt-1 transition-all ${activeTask.completed ? 'bg-blue-500 border-blue-500' : isDarkMode ? 'border-white/40 hover:border-white' : 'border-gray-400 hover:border-blue-600'}`}>{activeTask.completed && <Check size={16} className="text-white"/>}</button>
                                <textarea className={`bg-transparent text-lg font-medium outline-none w-full resize-none ${isDarkMode ? 'text-white' : 'text-gray-800'} ${activeTask.completed ? 'line-through opacity-50' : ''}`} value={activeTask.title} onChange={(e) => handleUpdateTask({ title: e.target.value })} rows={2} placeholder="Título"/>
                            </div>
                            <div className={`flex items-start gap-4 p-2 rounded-lg transition-colors group ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}>
                                <AlignLeft size={20} className={`${isDarkMode ? 'text-white/40' : 'text-gray-400'} mt-1`}/>
                                <textarea className={`bg-transparent text-sm outline-none w-full resize-none min-h-[80px] cursor-pointer ${isDarkMode ? 'text-white/80 placeholder:text-white/30' : 'text-gray-700 placeholder:text-gray-400'}`} placeholder="Adicionar detalhes" value={activeTask.details || ''} onChange={(e) => handleUpdateTask({ details: e.target.value })}/>
                            </div>
                            <div className={`flex items-center gap-4 p-2 rounded-lg transition-colors group relative ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}>
                                <Calendar size={20} className={isDarkMode ? "text-white/40" : "text-gray-400"}/>
                                <div className="flex-1">
                                    <input type="datetime-local" className={`bg-transparent text-sm outline-none w-full cursor-pointer ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`} value={activeTask.date ? new Date(activeTask.date).toISOString().slice(0, 16) : ''} onChange={(e) => handleUpdateTask({ date: new Date(e.target.value).toISOString() })}/>
                                    {!activeTask.date && <span className={`text-sm absolute left-10 top-2 pointer-events-none ${isDarkMode ? 'text-white/30' : 'text-gray-400'}`}>Adicionar data/hora</span>}
                                </div>
                            </div>
                            <div className={`border-t pt-4 mt-2 ${isDarkMode ? 'border-white/5' : 'border-gray-100'}`}>
                                <h4 className={`text-xs font-bold uppercase mb-3 ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`}>Subtarefas</h4>
                                <div className="space-y-2 pl-2">
                                    {activeTask.subtasks?.map(sub => (
                                        <div key={sub.id} className={`flex items-center gap-2 text-sm p-2 rounded-lg ${isDarkMode ? 'text-white/80 bg-white/5' : 'text-gray-700 bg-gray-50'}`}>
                                            <div className={`w-3 h-3 border rounded-full ${sub.completed ? (isDarkMode ? 'bg-white/40' : 'bg-blue-500 border-blue-500') : (isDarkMode ? 'border-white/40' : 'border-gray-400')}`}></div>
                                            <span className={sub.completed ? 'line-through opacity-50' : ''}>{sub.title}</span>
                                        </div>
                                    ))}
                                    <div className="flex items-center gap-2">
                                        <Plus size={16} className="text-blue-500"/>
                                        <input className={`bg-transparent text-sm outline-none flex-1 ${isDarkMode ? 'text-white placeholder:text-white/30' : 'text-gray-800 placeholder:text-gray-400'}`} placeholder="Adicionar subtarefa" onKeyDown={(e) => { if (e.key === 'Enter') { handleAddTask(activeTask.id); (e.target as HTMLInputElement).value = ''; } }}/>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className={`p-4 border-t flex justify-end ${isDarkMode ? 'border-white/5 bg-[#1a1a1a]' : 'border-gray-100 bg-gray-50'}`}>
                        <button onClick={() => handleDeleteTask(activeTask.id)} className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10 text-white/40 hover:text-red-400' : 'hover:bg-red-50 text-gray-400 hover:text-red-600'}`} title="Excluir tarefa"><Trash2 size={18}/></button>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
}