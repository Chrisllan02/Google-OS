
import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, Settings, X, Search, Star, Plus, Trash2, Calendar, GripVertical, Loader2, AlignLeft, ChevronRight, Mail } from 'lucide-react';
import { bridge } from '../../utils/GASBridge';

interface TasksAppProps {
  onClose: () => void;
  data: any;
  onUpdate?: (tasks: any[]) => void;
  showToast?: (msg: string) => void;
}

export default function TasksApp({ onClose, data, onUpdate, showToast }: TasksAppProps) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  
  // Detail Sidebar State
  const [activeTask, setActiveTask] = useState<any | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const toast = (msg: string) => showToast && showToast(msg);

  useEffect(() => {
      if (data?.tasks) {
          setTasks(data.tasks);
      }
  }, [data]);

  useEffect(() => {
      if (isAdding && inputRef.current) {
          inputRef.current.focus();
      }
  }, [isAdding]);

  const updateParent = (newTasks: any[]) => {
      setTasks(newTasks);
      if (onUpdate) onUpdate(newTasks);
  };

  const handleAddTask = async () => {
      if (!newTaskTitle.trim()) {
          setIsAdding(false);
          return;
      }
      
      const tempId = Date.now();
      const newTask = {
          id: tempId, // Temp ID
          title: newTaskTitle,
          completed: false,
          date: new Date().toISOString()
      };

      const updatedTasks = [newTask, ...tasks];
      updateParent(updatedTasks);
      
      setNewTaskTitle('');
      inputRef.current?.focus();
      toast("Tarefa criada");
      
      try {
          const res = await bridge.createTask(newTask.title);
          if (res.success && res.task) {
              const syncedTasks = updatedTasks.map(t => t.id === tempId ? res.task : t);
              updateParent(syncedTasks);
          }
      } catch (e) {
          console.error(e);
      }
  };

  const toggleTask = async (id: number) => {
      const updatedTasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
      updateParent(updatedTasks);
      const isCompleted = updatedTasks.find(t => t.id === id)?.completed;
      if (isCompleted) toast("Tarefa concluída");

      if (activeTask && activeTask.id === id) {
          setActiveTask({ ...activeTask, completed: !activeTask.completed });
      }
      await bridge.toggleTask(id);
  };

  const deleteTask = async (id: number) => {
      const updatedTasks = tasks.filter(t => t.id !== id);
      updateParent(updatedTasks);
      if (activeTask && activeTask.id === id) setActiveTask(null);
      toast("Tarefa excluída");
      await bridge.deleteTask(id);
  };

  const handleUpdateActiveTask = (updatedFields: any) => {
      if (!activeTask) return;
      const updated = { ...activeTask, ...updatedFields };
      setActiveTask(updated);
      const updatedTasks = tasks.map(t => t.id === activeTask.id ? updated : t);
      updateParent(updatedTasks);
      // Debounced save would go here ideally
  };

  const filteredTasks = tasks.filter(t => {
      if (filter === 'active') return !t.completed;
      if (filter === 'completed') return t.completed;
      return true;
  }).sort((a, b) => {
      // Sort logic: Incomplete first, then by date
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
  });

  const appHeaderClass = "h-16 px-6 flex items-center justify-between shrink-0 border-b border-white/5 backdrop-blur-xl z-20 bg-black/20";

  return (
    <div className="flex flex-col h-full bg-[#202124] text-white overflow-hidden">
        {/* HEADER */}
        <div className={appHeaderClass}>
            <div className="flex items-center gap-4 w-64">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-white/10 rounded-full"><CheckCircle2 className="w-5 h-5 text-blue-400"/></div>
                    <span className="text-white text-lg font-light tracking-tight">Google Tarefas</span>
                </div>
            </div>
            <div className="flex items-center gap-4 w-64 justify-end ml-auto">
                <div className="flex bg-white/5 rounded-lg p-1">
                    <button onClick={() => setFilter('all')} className={`px-3 py-1 rounded text-xs transition-colors ${filter === 'all' ? 'bg-white/10 text-white' : 'text-white/50'}`}>Todas</button>
                    <button onClick={() => setFilter('active')} className={`px-3 py-1 rounded text-xs transition-colors ${filter === 'active' ? 'bg-white/10 text-white' : 'text-white/50'}`}>Pendentes</button>
                </div>
                <div className="h-8 w-[1px] bg-white/10"></div>
                <div className={`p-2 hover:bg-white/10 rounded-full cursor-pointer text-white/80 transition-colors`} onClick={onClose}><X size={24} /></div>
            </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 flex overflow-hidden">
            {/* MAIN LIST */}
            <div className={`flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar transition-all duration-300 ${activeTask ? 'mr-0' : ''}`}>
                <div className="max-w-3xl mx-auto bg-[#1E1E1E] rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex flex-col h-full md:h-auto md:min-h-[500px]">
                    
                    {/* TOOLBAR */}
                    <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5 shrink-0">
                        <div className="flex items-center gap-2">
                            <span className="text-white font-medium text-lg">Minhas Tarefas</span>
                            {tasks.length > 0 && <span className="bg-blue-600 text-xs px-2 py-0.5 rounded-full">{tasks.filter(t => !t.completed).length}</span>}
                        </div>
                        <button 
                            onClick={() => setIsAdding(true)}
                            className="text-blue-400 text-sm hover:bg-blue-400/10 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2"
                        >
                            <Plus size={16}/> Adicionar
                        </button>
                    </div>

                    {/* ADD TASK INPUT */}
                    {isAdding && (
                        <div className="p-4 border-b border-white/5 bg-blue-500/5 animate-in slide-in-from-top-2 duration-200">
                            <input 
                                ref={inputRef}
                                type="text" 
                                className="w-full bg-transparent text-white placeholder:text-white/40 outline-none text-base mb-2"
                                placeholder="Título da tarefa"
                                value={newTaskTitle}
                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                                onBlur={() => !newTaskTitle && setIsAdding(false)}
                            />
                            <div className="flex items-center justify-between">
                                <div className="flex gap-2">
                                    <button className="text-white/50 hover:text-white transition-colors p-1"><Calendar size={16}/></button>
                                    <button className="text-white/50 hover:text-white transition-colors p-1"><Star size={16}/></button>
                                </div>
                                <button onMouseDown={handleAddTask} className="text-sm font-medium text-blue-400 hover:text-blue-300">Concluir</button>
                            </div>
                        </div>
                    )}

                    {/* TASK LIST */}
                    <div className="divide-y divide-white/5 flex-1 overflow-y-auto custom-scrollbar">
                        {filteredTasks.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-white/20">
                                <CheckCircle2 size={64} className="mb-4 opacity-20"/>
                                <p>Nenhuma tarefa encontrada</p>
                            </div>
                        ) : (
                            filteredTasks.map((t:any) => (
                                <div 
                                    key={t.id} 
                                    onClick={() => setActiveTask(t)}
                                    className={`p-4 flex items-start gap-4 hover:bg-white/5 transition-all cursor-pointer group animate-in fade-in duration-300 ${t.completed ? 'opacity-50' : 'opacity-100'} ${activeTask?.id === t.id ? 'bg-blue-500/10 border-l-4 border-blue-500' : 'border-l-4 border-transparent'}`}
                                >
                                    <div className="mt-0.5 cursor-move opacity-0 group-hover:opacity-30 hover:!opacity-100 transition-opacity"><GripVertical size={16}/></div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); toggleTask(t.id); }}
                                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 shrink-0 ${t.completed ? 'bg-blue-500 border-blue-500 scale-110' : 'border-white/40 hover:border-white'}`}
                                    >
                                        {t.completed && <CheckCircle2 size={14} className="text-white"/>}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm transition-all duration-300 ${t.completed ? 'text-white/40 line-through' : 'text-white'}`}>{t.title}</p>
                                        {t.details && <p className="text-xs text-white/40 mt-1 truncate flex items-center gap-1"><Mail size={10} className="text-blue-400"/> {t.details}</p>}
                                        <div className="flex gap-2 mt-1">
                                            {t.date && <span className="text-[10px] border border-white/10 rounded-full px-2 py-0.5 text-white/50 flex items-center gap-1 w-fit"><Calendar size={10}/> {new Date(t.date).toLocaleDateString()}</span>}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* DETAILS SIDEBAR */}
            {activeTask && (
                <div className="w-80 bg-[#1E1E1E] border-l border-white/10 flex flex-col animate-in slide-in-from-right duration-300 shadow-2xl z-20">
                    <div className="h-14 flex items-center justify-between px-4 border-b border-white/5 shrink-0">
                        <span className="text-sm font-medium text-white/60">Detalhes</span>
                        <button onClick={() => setActiveTask(null)} className="p-1.5 hover:bg-white/10 rounded-full text-white/60"><X size={16}/></button>
                    </div>
                    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                        <div className="space-y-6">
                            <div className="flex items-start gap-3">
                                <button 
                                    onClick={() => toggleTask(activeTask.id)}
                                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mt-1 transition-all ${activeTask.completed ? 'bg-blue-500 border-blue-500' : 'border-white/40 hover:border-white'}`}
                                >
                                    {activeTask.completed && <CheckCircle2 size={16} className="text-white"/>}
                                </button>
                                <textarea 
                                    className={`bg-transparent text-lg font-medium text-white outline-none w-full resize-none ${activeTask.completed ? 'line-through text-white/50' : ''}`}
                                    value={activeTask.title}
                                    onChange={(e) => handleUpdateActiveTask({ title: e.target.value })}
                                    rows={2}
                                />
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-start gap-4 hover:bg-white/5 p-2 rounded-lg cursor-pointer transition-colors group">
                                    <AlignLeft size={20} className="text-white/40 mt-1"/>
                                    <textarea 
                                        className="bg-transparent text-sm text-white/80 placeholder:text-white/30 outline-none w-full resize-none min-h-[100px] cursor-pointer"
                                        placeholder="Adicionar detalhes"
                                        value={activeTask.details || ''}
                                        onChange={(e) => handleUpdateActiveTask({ details: e.target.value })}
                                    />
                                </div>

                                <div className="flex items-center gap-4 hover:bg-white/5 p-2 rounded-lg cursor-pointer transition-colors group relative">
                                    <Calendar size={20} className="text-white/40"/>
                                    {activeTask.date ? (
                                        <span className="text-sm text-blue-400 bg-blue-500/10 px-2 py-1 rounded">{new Date(activeTask.date).toLocaleDateString()}</span>
                                    ) : (
                                        <span className="text-sm text-white/40 group-hover:text-white/60">Adicionar data/hora</span>
                                    )}
                                    <input 
                                        type="date" 
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        onChange={(e) => handleUpdateActiveTask({ date: e.target.value })}
                                    />
                                </div>

                                <div className="flex items-center gap-4 hover:bg-white/5 p-2 rounded-lg cursor-pointer transition-colors">
                                    <Star size={20} className="text-white/40"/>
                                    <span className="text-sm text-white/40">Marcar como importante</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="p-4 border-t border-white/5 flex justify-end">
                        <button 
                            onClick={() => deleteTask(activeTask.id)}
                            className="p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-red-400 transition-colors" 
                            title="Excluir tarefa"
                        >
                            <Trash2 size={18}/>
                        </button>
                    </div>
                </div>
            )}
        </div>
        
        {/* FOOTER FAB FOR MOBILE/TABLET */}
        <button 
            onClick={() => setIsAdding(true)}
            className="absolute bottom-8 right-8 w-14 h-14 bg-[#C2E7FF] hover:bg-[#b3d7ef] text-[#001D35] rounded-2xl shadow-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 md:hidden"
        >
            <Plus size={28}/>
        </button>
    </div>
  );
}
