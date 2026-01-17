import React from 'react';
import { Search, Settings, X } from 'lucide-react';

interface SearchAppProps {
  onClose: () => void;
  data: any;
}

export default function SearchApp({ onClose, data }: SearchAppProps) {
  const appHeaderClass = "h-16 px-6 flex items-center justify-between shrink-0 border-b border-white/5 backdrop-blur-xl z-20 bg-black/20";

  return (
    <div className="flex flex-col h-full bg-[#202124]">
        <div className={appHeaderClass}>
            <div className="flex items-center gap-4 w-64">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-white/10 rounded-full"><Search className="w-5 h-5 text-white"/></div>
                    <span className="text-white text-lg font-light tracking-tight">Pesquisa</span>
                </div>
            </div>
            <div className="flex items-center gap-4 w-64 justify-end ml-auto">
                <div className={`p-2 hover:bg-white/10 rounded-full cursor-pointer text-white/80 transition-colors`} onClick={onClose}><X size={24} /></div>
            </div>
        </div>

        <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
            <div className="flex flex-col items-center justify-center h-full opacity-50">
                <Search size={64} className="mb-4 text-white"/>
                <p className="text-white text-xl">Resultados da pesquisa...</p>
            </div>
        </div>
    </div>
  );
}