
import React, { useState, useEffect, useRef } from 'react';
import { Search, Settings, X, Mail, FileText, User, Calendar, ExternalLink, HardDrive, ArrowRight, Globe, MapPin, Loader2, Sparkles, Star } from 'lucide-react';
import { GoogleIcons, GeminiLogo } from '../GoogleIcons';
import { bridge, SearchResults } from '../../utils/GASBridge';
import { GoogleGenAI } from "@google/genai";

interface SearchAppProps {
  onClose: () => void;
  data: any;
  searchQuery?: string;
  onOpenApp?: (type: string, fileData?: any) => void;
}

const getFileIcon = (type: string) => {
  switch(type) {
    case 'sheet': return <GoogleIcons.Sheets className="w-6 h-6" />;
    case 'slide': return <GoogleIcons.Slides className="w-6 h-6" />;
    case 'doc': return <GoogleIcons.Docs className="w-6 h-6" />;
    case 'image': return <div className="p-1 bg-red-100 rounded text-red-600 font-bold text-xs">IMG</div>;
    case 'pdf': return <FileText className="w-6 h-6 text-red-500" />;
    default: return <FileText className="w-6 h-6 text-gray-400" />;
  }
};

export default function SearchApp({ onClose, data, searchQuery = '', onOpenApp }: SearchAppProps) {
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [mode, setMode] = useState<'workspace' | 'web'>('workspace');
  
  // States for Backend Results
  const [workspaceResults, setWorkspaceResults] = useState<SearchResults>({ emails: [], files: [], events: [] });
  const [isSearching, setIsSearching] = useState(false);

  // States for Gemini Web Search
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [groundingSources, setGroundingSources] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const aiClient = useRef<GoogleGenAI | null>(null);
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
      try {
          aiClient.current = new GoogleGenAI({ apiKey: process.env.API_KEY });
      } catch (e) { console.error(e); }
  }, []);

  // Sync prop searchQuery to localQuery and trigger search
  useEffect(() => {
      setLocalQuery(searchQuery);
      if (searchQuery) {
          if (mode === 'workspace') performWorkspaceSearch(searchQuery);
          else handleWebSearch();
      }
  }, [searchQuery]);

  const performWorkspaceSearch = async (query: string) => {
      if (!query || query.length < 2) return;
      setIsSearching(true);
      try {
          const results = await bridge.searchAll(query);
          setWorkspaceResults(results);
      } catch (e) {
          console.error("Workspace Search Error", e);
      } finally {
          setIsSearching(false);
      }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setLocalQuery(val);
      
      // Debounce search in workspace mode
      if (mode === 'workspace') {
          if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
          debounceTimeout.current = setTimeout(() => {
              performWorkspaceSearch(val);
          }, 600); // 600ms delay
      }
  };

  const handleWebSearch = async () => {
      if (!localQuery.trim() || !aiClient.current) return;
      setIsGenerating(true);
      setAiResponse(null);
      setGroundingSources([]);

      try {
          const isLocationQuery = /onde|fica|perto|restaurante|mapa|local|endereço/i.test(localQuery);
          const model = isLocationQuery ? 'gemini-2.5-flash' : 'gemini-3-flash-preview';
          const tools = isLocationQuery ? [{googleMaps: {}}] : [{googleSearch: {}}];

          const response = await aiClient.current.models.generateContent({
              model: model,
              contents: localQuery,
              config: { tools: tools }
          });

          setAiResponse(response.text || "Não encontrei informações sobre isso.");
          const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
          setGroundingSources(chunks);

      } catch (error) {
          console.error("Search Error", error);
          setAiResponse("Erro ao conectar com a Busca Google. Verifique sua API Key.");
      } finally {
          setIsGenerating(false);
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          if (mode === 'web') handleWebSearch();
          else performWorkspaceSearch(localQuery);
      }
  };

  const appHeaderClass = "h-16 px-6 flex items-center justify-between shrink-0 border-b border-white/5 backdrop-blur-xl z-20 bg-black/20";

  const hasResults = workspaceResults.emails.length > 0 || workspaceResults.files.length > 0 || workspaceResults.events.length > 0;

  return (
    <div className="flex flex-col h-full bg-[#202124] text-white font-sans">
        {/* HEADER */}
        <div className={appHeaderClass}>
            <div className="flex items-center gap-4 w-64">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-white/10 rounded-full"><Search className="w-5 h-5 text-blue-400"/></div>
                    <span className="text-white text-lg font-light tracking-tight">Pesquisa</span>
                </div>
            </div>
            <div className="flex-1 max-w-2xl px-8">
                <div className="bg-white/5 border border-white/10 flex items-center px-4 py-2.5 rounded-full focus-within:bg-white/10 transition-colors focus-within:border-blue-500/50 relative">
                    <Search className="text-white/40" size={18} />
                    <input 
                        type="text" 
                        placeholder={mode === 'workspace' ? "Pesquisar no Workspace..." : "Perguntar ao Google..."}
                        className="bg-transparent border-none outline-none ml-3 w-full text-white placeholder:text-white/30 text-sm font-light" 
                        value={localQuery}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        autoFocus
                    />
                    {localQuery && <button onClick={() => setLocalQuery('')} className="p-1 rounded-full hover:bg-white/10 text-white/50 mr-2"><X size={14}/></button>}
                    
                    {/* MODE SWITCHER */}
                    <div className="flex bg-black/40 rounded-full p-0.5 border border-white/10 ml-2">
                        <button 
                            onClick={() => { setMode('workspace'); if(localQuery) performWorkspaceSearch(localQuery); }} 
                            className={`px-3 py-1 rounded-full text-[10px] font-medium transition-all flex items-center gap-1 ${mode === 'workspace' ? 'bg-white/20 text-white shadow-sm' : 'text-white/40 hover:text-white'}`}
                        >
                            <HardDrive size={10}/> Workspace
                        </button>
                        <button 
                            onClick={() => { setMode('web'); if(localQuery) handleWebSearch(); }} 
                            className={`px-3 py-1 rounded-full text-[10px] font-medium transition-all flex items-center gap-1 ${mode === 'web' ? 'bg-blue-600 text-white shadow-sm' : 'text-white/40 hover:text-white'}`}
                        >
                            <Globe size={10}/> Web
                        </button>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-4 w-64 justify-end">
                <div className={`p-2 hover:bg-white/10 rounded-full cursor-pointer text-white/80 transition-colors`} onClick={onClose}><X size={24} /></div>
            </div>
        </div>

        {/* RESULTS AREA */}
        <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
            {!localQuery ? (
                <div className="flex flex-col items-center justify-center h-full opacity-50 space-y-6">
                    <div className="w-32 h-32 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center mb-4 animate-pulse">
                        <GoogleIcons.Search className="w-16 h-16 text-white/30" stroke="currentColor"/>
                    </div>
                    <p className="text-white/60 text-xl font-light text-center max-w-md">
                        {mode === 'workspace' ? "Digite para pesquisar em e-mails, arquivos e agenda." : "Faça perguntas sobre o mundo real usando o Google Search e Maps."}
                    </p>
                </div>
            ) : mode === 'workspace' ? (
                // WORKSPACE RESULTS (Backend Driven)
                isSearching ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 size={32} className="animate-spin text-blue-500"/>
                    </div>
                ) : (
                    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
                        {/* CALENDAR EVENTS */}
                        {workspaceResults.events && workspaceResults.events.length > 0 && (
                            <div>
                                <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-4 flex items-center gap-2"><Calendar size={14}/> Agenda</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {workspaceResults.events.map((ev:any, i:number) => (
                                        <div key={i} className="bg-[#303134] hover:bg-[#3c4043] p-3 rounded-xl cursor-pointer transition-all border border-white/5 hover:border-white/10 flex flex-col gap-1 group">
                                            <div className="flex justify-between items-start">
                                                <h4 className="text-white font-medium truncate text-sm">{ev.title}</h4>
                                                <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">Evento</span>
                                            </div>
                                            <p className="text-xs text-white/40">{new Date(ev.start).toLocaleDateString()} {new Date(ev.start).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                                            {ev.location && <p className="text-[10px] text-white/30 flex items-center gap-1"><MapPin size={10}/> {ev.location}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* FILES */}
                        {workspaceResults.files && workspaceResults.files.length > 0 && (
                            <div>
                                <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-4 flex items-center gap-2"><HardDrive size={14}/> Arquivos</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {workspaceResults.files.map((f:any) => (
                                        <div key={f.id} onClick={() => onOpenApp && onOpenApp(f.type, f)} className="bg-[#303134] hover:bg-[#3c4043] p-3 rounded-xl cursor-pointer transition-all border border-white/5 hover:border-white/10 flex items-center gap-3 group relative overflow-hidden">
                                            <div className="p-2 bg-white/5 rounded-lg group-hover:bg-white/10 transition-colors shrink-0">{getFileIcon(f.type)}</div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-white font-medium truncate text-sm group-hover:text-blue-300 transition-colors">{f.name}</h4>
                                                <p className="text-[10px] text-white/40 flex items-center gap-2 mt-0.5"><span>{f.owner}</span> • <span>{f.date}</span></p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* EMAILS */}
                        {workspaceResults.emails && workspaceResults.emails.length > 0 && (
                            <div>
                                <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-4 flex items-center gap-2"><Mail size={14}/> E-mails</h3>
                                <div className="grid gap-2">
                                    {workspaceResults.emails.map((e:any) => (
                                        <div key={e.id} onClick={() => onOpenApp && onOpenApp('mail')} className="bg-[#303134] hover:bg-[#3c4043] px-4 py-3 rounded-xl cursor-pointer transition-all border border-white/5 hover:border-white/10 flex items-center gap-4 group">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${e.color || 'bg-blue-600'}`}>{e.senderInit || e.sender[0]}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-baseline mb-0.5">
                                                    <h4 className="text-white font-medium truncate text-sm group-hover:text-blue-300 transition-colors">{e.subject}</h4>
                                                    <span className="text-[10px] text-white/40 ml-2 whitespace-nowrap">{e.time}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-white/70 font-medium">{e.sender}</span>
                                                    <p className="text-xs text-white/50 truncate flex-1">{e.preview}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!hasResults && (
                             <div className="text-center text-white/40 mt-10">
                                 <p>Nenhum resultado encontrado no Workspace para "{localQuery}".</p>
                                 <button onClick={() => { setMode('web'); handleWebSearch(); }} className="text-blue-400 hover:underline mt-2 text-sm">Tentar pesquisar na Web</button>
                             </div>
                        )}
                    </div>
                )
            ) : (
                // WEB SEARCH (GEMINI) - Same as previous
                <div className="max-w-4xl mx-auto h-full flex flex-col">
                    {isGenerating ? (
                        <div className="flex flex-col items-center justify-center h-full text-white/50">
                            <Loader2 size={32} className="animate-spin mb-4 text-blue-400"/>
                            <p>Pesquisando na web...</p>
                        </div>
                    ) : aiResponse ? (
                        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4">
                            
                            {/* AI ANSWER CARD */}
                            <div className="bg-[#303134] border border-white/10 p-6 rounded-2xl shadow-xl">
                                <div className="flex items-center gap-2 mb-4">
                                    <GeminiLogo className="w-6 h-6"/>
                                    <span className="text-sm font-medium text-white/90">Resposta Gerada</span>
                                    <span className="bg-blue-500/20 text-blue-300 text-[10px] px-2 py-0.5 rounded-full border border-blue-500/30">Gemini Grounding</span>
                                </div>
                                <div className="text-white/90 leading-relaxed text-sm whitespace-pre-wrap font-light">
                                    {aiResponse}
                                </div>
                            </div>

                            {/* GROUNDING SOURCES */}
                            {groundingSources.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-4 flex items-center gap-2"><Globe size={14}/> Fontes & Referências</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {groundingSources.map((source, i) => {
                                            if (source.web) {
                                                return (
                                                    <a key={i} href={source.web.uri} target="_blank" rel="noopener noreferrer" className="bg-[#202124] hover:bg-[#303134] p-4 rounded-xl border border-white/5 hover:border-white/20 transition-all group block">
                                                        <h4 className="text-blue-400 text-sm font-medium mb-1 truncate group-hover:underline">{source.web.title}</h4>
                                                        <div className="flex items-center gap-2 text-xs text-white/40">
                                                            <ExternalLink size={12}/>
                                                            <span className="truncate">{source.web.uri}</span>
                                                        </div>
                                                    </a>
                                                );
                                            } else if (source.maps) {
                                                return (
                                                    <div key={i} className="bg-[#202124] p-4 rounded-xl border border-white/5 flex items-center gap-3">
                                                        <MapPin size={20} className="text-red-400"/>
                                                        <div>
                                                            <h4 className="text-white font-medium text-sm">{source.maps.title}</h4>
                                                        </div>
                                                    </div>
                                                )
                                            }
                                            return null;
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-white/30">
                            <Sparkles size={48} className="mb-4 opacity-30"/>
                            <p>Pronto para pesquisar</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
  );
}
