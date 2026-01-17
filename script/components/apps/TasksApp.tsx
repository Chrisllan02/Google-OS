import React from 'react';
import { CheckCircle2, Settings, X, Search, Star } from 'lucide-react';

interface TasksAppProps {
  onClose: () => void;
  data: any;
}

export default function TasksApp({ onClose, data }: TasksAppProps) {
  const appHeaderClass = "h-16 px-6 flex items-center justify-between shrink-0 border-b border-white/5 backdrop-blur-xl z-20 bg-black/20";

  return (
    <div className="flex flex-col h-full bg-[#202124]">
        <div className={appHeaderClass}>
            <div className="flex items-center gap-4 w-64">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-white/10 rounded-full"><CheckCircle2 className="w-5 h-5 text-white"/></div>
                    <span className="text-white text-lg font-light tracking-tight">Google Tarefas</span>
                </div>
            </div>
            <div className="flex items-center gap-4 w-64 justify-end ml-auto">
                <button className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                    <Settings size={20} className="text-white/80" />
                </button>
                <div className="h-8 w-[1px] bg-white/10"></div>
                <div className={`p-2 hover:bg-white/10 rounded-full cursor-pointer text-white/80 transition-colors`} onClick={onClose}><X size={24} /></div>
            </div>
        </div>

        <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
            <div className="max-w-2xl mx-auto bg-[#1E1E1E] rounded-2xl overflow-hidden shadow-2xl border border-white/10">
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                    <span className="text-white font-medium">Minhas Tarefas</span>
                    <button className="text-blue-400 text-sm hover:underline">+ Adicionar</button>
                </div>
                <div className="divide-y divide-white/5">
                    {data?.tasks?.map((t:any) => (
                        <div key={t.id} className="p-4 flex items-center gap-4 hover:bg-white/5 transition-colors cursor-pointer group">
                            <button className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${t.completed ? 'bg-blue-500 border-blue-500' : 'border-white/40 group-hover:border-white'}`}>
                                {t.completed && <CheckCircle2 size={14} className="text-white"/>}
                            </button>
                            <div className="flex-1">
                                <p className={`text-sm ${t.completed ? 'text-white/40 line-through' : 'text-white'}`}>{t.title}</p>
                                <p className="text-xs text-white/30 mt-0.5">Hoje, 15:00</p>
                            </div>
                            <Star size={18} className="text-white/20 hover:text-yellow-400 transition-colors"/>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
  );
}