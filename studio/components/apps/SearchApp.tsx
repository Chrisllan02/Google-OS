
import React, { useState, useEffect } from 'react';
import { Search, Settings, X, Mail, FileText, User, Calendar, ExternalLink, HardDrive } from 'lucide-react';
import { GoogleIcons } from '../GoogleIcons';

interface SearchAppProps {
  onClose: () => void;
  data: any;
  searchQuery?: string;
  onOpenApp?: (type: string, fileData?: any) => void;
}

export default function SearchApp({ onClose, data, searchQuery = '', onOpenApp }: SearchAppProps) {
  const [localQuery, setLocalQuery] = useState(searchQuery);
  
  useEffect(() => {
      setLocalQuery(searchQuery);
  }, [searchQuery]);

  const appHeaderClass = "h-16 px-6 flex items-center justify-between shrink-0 border-b border-white/5 backdrop-blur-xl z-20 bg-black/20";

  // Filter Data
  const filterEmails = data?.emails?.filter((e:any) => 
      e.subject.toLowerCase().includes(localQuery.toLowerCase()) || 
      e.sender.toLowerCase().includes(localQuery.toLowerCase())
  ) || [];

  const filterFiles = data?.files?.filter((f:any) => 
      f.name.toLowerCase().includes(localQuery.toLowerCase())
  ) || [];

  const hasResults = filterEmails.length > 0 || filterFiles.length > 0;

  return (
    <div className="flex flex-col h-full bg-[#202124] text-white">
        {/* HEADER */}
        <div className={appHeaderClass}>
            <div className="flex items-center gap-4 w-64">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-white/10 rounded-full"><Search className="w-5 h-5 text-blue-400"/></div>
                    <span className="text-white text-lg font-light tracking-tight">Pesquisa do Workspace</span>
                </div>
            </div>
            <div className="flex-1 max-w-2xl px-8">
                <div className="bg-white/5 border border-white/10 flex items-center px-4 py-2.5 rounded-full focus-within:bg-white/10 transition-colors focus-within:border-blue-500/50">
                    <Search className="text-white/40" size={18} />
                    <input 
                        type="text" 
                        placeholder="Pesquisar em e-mails, arquivos e contatos..." 
                        className="bg-transparent border-none outline-none ml-3 w-full text-white placeholder:text-white/30 text-sm font-light" 
                        value={localQuery}
                        onChange={(e) => setLocalQuery(e.target.value)}
                        autoFocus
                    />
                </div>
            </div>
            <div className="flex items-center gap-4 w-64 justify-end">
                <div className={`p-2 hover:bg-white/10 rounded-full cursor-pointer text-white/80 transition-colors`} onClick={onClose}><X size={24} /></div>
            </div>
        </div>

        {/* RESULTS AREA */}
        <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
            {!localQuery ? (
                <div className="flex flex-col items-center justify-center h-full opacity-50 space-y-4">
                    <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-4 animate-pulse">
                        <GoogleIcons.Search className="w-12 h-12 text-white/20" stroke="currentColor"/>
                    </div>
                    <p className="text-white/60 text-lg">Digite para pesquisar em todo o seu Workspace</p>
                    <div className="flex gap-4 mt-8">
                        <div className="px-4 py-2 bg-white/5 rounded-full text-xs text-white/40 border border-white/5">E-mails</div>
                        <div className="px-4 py-2 bg-white/5 rounded-full text-xs text-white/40 border border-white/5">Documentos</div>
                        <div className="px-4 py-2 bg-white/5 rounded-full text-xs text-white/40 border border-white/5">Pessoas</div>
                    </div>
                </div>
            ) : !hasResults ? (
                <div className="flex flex-col items-center justify-center h-full opacity-50">
                    <p className="text-white text-xl">Nenhum resultado encontrado para "{localQuery}"</p>
                </div>
            ) : (
                <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    
                    {/* EMAILS SECTION */}
                    {filterEmails.length > 0 && (
                        <div>
                            <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-4 flex items-center gap-2"><Mail size={16}/> E-mails</h3>
                            <div className="grid gap-3">
                                {filterEmails.map((e:any) => (
                                    <div key={e.id} onClick={() => onOpenApp && onOpenApp('mail')} className="bg-[#303134] hover:bg-[#3c4043] p-4 rounded-xl cursor-pointer transition-all border border-white/5 hover:border-white/10 flex items-center gap-4 group">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0 ${e.color || 'bg-blue-600'}`}>{e.senderInit || e.sender[0]}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between">
                                                <h4 className="text-white font-medium truncate group-hover:text-blue-300 transition-colors">{e.subject}</h4>
                                                <span className="text-xs text-white/40">{e.time}</span>
                                            </div>
                                            <p className="text-sm text-white/60 truncate">{e.preview}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* FILES SECTION */}
                    {filterFiles.length > 0 && (
                        <div>
                            <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-4 flex items-center gap-2"><HardDrive size={16}/> Arquivos</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {filterFiles.map((f:any) => (
                                    <div key={f.id} onClick={() => onOpenApp && onOpenApp(f.type, f)} className="bg-[#303134] hover:bg-[#3c4043] p-3 rounded-xl cursor-pointer transition-all border border-white/5 hover:border-white/10 flex items-center gap-3 group">
                                        <div className="p-2 bg-white/5 rounded-lg group-hover:bg-white/10 transition-colors">
                                            {f.type === 'doc' && <GoogleIcons.Docs className="w-6 h-6"/>}
                                            {f.type === 'sheet' && <GoogleIcons.Sheets className="w-6 h-6"/>}
                                            {f.type === 'slide' && <GoogleIcons.Slides className="w-6 h-6"/>}
                                            {!['doc','sheet','slide'].includes(f.type) && <FileText className="w-6 h-6 text-gray-400"/>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-white font-medium truncate group-hover:text-blue-300 transition-colors">{f.name}</h4>
                                            <p className="text-xs text-white/40 flex items-center gap-2">
                                                <span>{f.owner}</span> • <span>{f.date}</span>
                                            </p>
                                        </div>
                                        <ExternalLink size={16} className="text-white/20 group-hover:text-white/60"/>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>
            )}
        </div>
    </div>
  );
}
