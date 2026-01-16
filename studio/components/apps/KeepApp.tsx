import React from 'react';
import { Lightbulb, Square, Settings, X, Search } from 'lucide-react';

interface KeepAppProps {
  onClose: () => void;
  data: any;
}

export default function KeepApp({ onClose, data }: KeepAppProps) {
  const appHeaderClass = "h-16 px-6 flex items-center justify-between shrink-0 border-b border-white/5 backdrop-blur-xl z-20 bg-black/20";

  return (
    <div className="flex flex-col h-full bg-[#202124]">
        <div className={appHeaderClass}>
            <div className="flex items-center gap-4 w-64">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-white/10 rounded-full"><Lightbulb className="w-5 h-5 text-white"/></div>
                    <span className="text-white text-lg font-light tracking-tight">Google Keep</span>
                </div>
            </div>
            <div className="flex-1 max-w-2xl px-8 relative hidden md:block">
                <div className="bg-white/5 border border-white/10 flex items-center px-4 py-2.5 rounded-full focus-within:bg-white/10 transition-colors">
                    <Search className="text-white/40" size={18} />
                    <input type="text" placeholder="Pesquisar" className="bg-transparent border-none outline-none ml-3 w-full text-white placeholder:text-white/30 text-sm" />
                </div>
            </div>
            <div className="flex items-center gap-4 w-64 justify-end">
                <button className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                    <Settings size={20} className="text-white/80" />
                </button>
                <div className="h-8 w-[1px] bg-white/10"></div>
                <div className={`p-2 hover:bg-white/10 rounded-full cursor-pointer text-white/80 transition-colors`} onClick={onClose}><X size={24} /></div>
            </div>
        </div>

        <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
            <div className="columns-1 md:columns-3 gap-4 space-y-4">
                <div className="bg-[#5c2b29] border border-transparent hover:border-white/50 rounded-xl p-4 shadow-md break-inside-avoid cursor-pointer transition-all">
                    <h3 className="text-white font-medium mb-2 text-lg">Ideias Brainstorm</h3>
                    <p className="text-white/80 text-sm leading-relaxed">Implementar dark mode, revisar paleta de cores, testar novas fontes...</p>
                </div>
                <div className="bg-[#614a19] border border-transparent hover:border-white/50 rounded-xl p-4 shadow-md break-inside-avoid cursor-pointer transition-all">
                    <h3 className="text-white font-medium mb-2 text-lg">Links Úteis</h3>
                    <p className="text-white/80 text-sm leading-relaxed">Design system docs<br/>API references<br/>Competitor analysis</p>
                </div>
                <div className="bg-[#1e3a5f] border border-transparent hover:border-white/50 rounded-xl p-4 shadow-md break-inside-avoid cursor-pointer transition-all">
                    <h3 className="text-white font-medium mb-2 text-lg">Metas Q3</h3>
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-white/80 text-sm"><Square size={14}/> Aumentar MRR</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}
