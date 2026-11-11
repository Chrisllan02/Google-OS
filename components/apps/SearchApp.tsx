import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Mail, FileText, Calendar, ExternalLink, HardDrive, Globe, MapPin, Loader2, Sparkles } from 'lucide-react';
import { GoogleIcons, GeminiLogo } from '../GoogleIcons';
import { bridge, SearchResults } from '../../utils/GASBridge';
import { askGemini, GeminiUnavailableError } from "../../utils/gemini";

interface SearchAppProps {
  onClose: () => void;
  data: any;
  searchQuery?: string;
  onOpenApp?: (type: string, fileData?: any) => void;
  isDarkMode?: boolean;
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

export default function SearchApp({ onClose, data, searchQuery = '', onOpenApp, isDarkMode = false }: SearchAppProps) {
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [mode, setMode] = useState<'workspace' | 'web'>('workspace');
  
  const [workspaceResults, setWorkspaceResults] = useState<SearchResults>({ emails: [], files: [], events: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [workspaceSummary, setWorkspaceSummary] = useState<string | null>(null);

  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [groundingSources, setGroundingSources] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
      setLocalQuery(searchQuery);
      if (searchQuery) {
          if (mode === 'workspace') performWorkspaceSearch(searchQuery);
          else handleWebSearch();
      }
  }, [searchQuery]);

  const generateWorkspaceSummary = async (results: SearchResults, query: string) => {
      const context = `
      Query: ${query}
      Emails found: ${results.emails.length} (Subjects: ${results.emails.map(e => e.subject).join(', ')})
      Files found: ${results.files.length} (Names: ${results.files.map(f => f.name).join(', ')})
      Events found: ${results.events.length}
      `;

      try {
          const response = await askGemini({
              task: 'generate',
              prompt: `Act as a personal assistant. Based on this search data, give a 1-sentence summary of what was found for the user. Data: ${context}`
          });
          setWorkspaceSummary(response.text || null);
      } catch(e) {
          if (!(e instanceof GeminiUnavailableError)) console.warn("Summary failed", e);
      }
  };

  const performWorkspaceSearch = async (query: string) => {
      if (!query || query.length < 2) return;
      setIsSearching(true);
      setWorkspaceSummary(null);
      try {
          const results = await bridge.searchAll(query);
          setWorkspaceResults(results);
          if (results.emails.length > 0 || results.files.length > 0) {
              generateWorkspaceSummary(results, query);
          }
      } catch (e) {
          console.error("Workspace Search Error", e);
      } finally {
          setIsSearching(false);
      }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setLocalQuery(val);
      
      if (mode === 'workspace') {
          if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
          debounceTimeout.current = setTimeout(() => {
              performWorkspaceSearch(val);
          }, 600);
      }
  };

  const handleWebSearch = async () => {
      if (!localQuery.trim()) return;
      setIsGenerating(true);
      setAiResponse(null);
      setGroundingSources([]);

      try {
          const isLocationQuery = /onde|fica|perto|restaurante|mapa|local|endereço/i.test(localQuery);
          const response = await askGemini({ task: 'search', prompt: localQuery, tool: isLocationQuery ? 'maps' : 'search' });

          setAiResponse(response.text || "Não encontrei informações sobre isso.");
          setGroundingSources(response.sources);

      } catch (error) {
          console.error("Search Error", error);
          setAiResponse(error instanceof GeminiUnavailableError
              ? "Configure a variável GEMINI_API_KEY para habilitar a busca inteligente com IA."
              : "Erro ao conectar com a Busca Google. Verifique sua API Key.");
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

  const appHeaderClass = `h-16 px-6 flex items-center justify-between shrink-0 border-b backdrop-blur-xl z-20 ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-black/10 bg-white'}`;
  const hasResults = workspaceResults.emails.length > 0 || workspaceResults.files.length > 0 || workspaceResults.events.length > 0;
  const cardClass = isDarkMode
      ? "bg-[#303134] hover:bg-[#3c4043] border-white/5 hover:border-white/10"
      : "bg-white hover:bg-gray-50 border-gray-200 hover:border-gray-300 shadow-xs";

  return (
    <div className={`flex flex-col h-full font-sans transition-colors ${isDarkMode ? 'bg-[#202124] text-white' : 'bg-[#F8FAFC] text-[#202124]'}`}>
        {/* HEADER */}
        <div className={appHeaderClass}>
            <div className="flex items-center gap-4 w-64">
                <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-full ${isDarkMode ? 'bg-white/10' : 'bg-blue-50'}`}><Search className="w-5 h-5 text-blue-500"/></div>
                    <span className={`text-lg font-light tracking-tight ${isDarkMode ? 'text-white' : 'text-[#202124]'}`}>Pesquisa</span>
                </div>
            </div>
            <div className="flex-1 max-w-2xl px-8">
                <div className={`border flex items-center px-4 py-2.5 rounded-full transition-colors focus-within:border-blue-500/50 relative ${isDarkMode ? 'bg-white/5 border-white/10 focus-within:bg-white/10' : 'bg-gray-100 border-gray-200 focus-within:bg-white focus-within:shadow-sm'}`}>
                    <Search className={isDarkMode ? "text-white/40" : "text-gray-400"} size={18} />
                    <input 
                        type="text" 
                        placeholder={mode === 'workspace' ? "Pesquisar no Workspace..." : "Perguntar ao Google..."}
                        className={`bg-transparent border-none outline-none ml-3 w-full text-sm font-light ${isDarkMode ? 'text-white placeholder:text-white/30' : 'text-gray-800 placeholder:text-gray-400'}`}
                        value={localQuery}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        autoFocus
                    />
                    {localQuery && <button onClick={() => setLocalQuery('')} className={`p-1 rounded-full mr-2 ${isDarkMode ? 'hover:bg-white/10 text-white/50' : 'hover:bg-gray-200 text-gray-500'}`}><X size={14}/></button>}
                    
                    {/* MODE SWITCHER */}
                    <div className={`flex rounded-full p-0.5 border ml-2 ${isDarkMode ? 'bg-black/40 border-white/10' : 'bg-gray-200/80 border-gray-300/60'}`}>
                        <button 
                            onClick={() => { setMode('workspace'); if(localQuery) performWorkspaceSearch(localQuery); }} 
                            className={`px-3 py-1 rounded-full text-[10px] font-medium transition-all flex items-center gap-1 ${mode === 'workspace' ? (isDarkMode ? 'bg-white/20 text-white shadow-sm' : 'bg-white text-gray-800 shadow-sm') : (isDarkMode ? 'text-white/40 hover:text-white' : 'text-gray-500 hover:text-gray-800')}`}
                        >
                            <HardDrive size={10}/> Workspace
                        </button>
                        <button 
                            onClick={() => { setMode('web'); if(localQuery) handleWebSearch(); }} 
                            className={`px-3 py-1 rounded-full text-[10px] font-medium transition-all flex items-center gap-1 ${mode === 'web' ? 'bg-blue-600 text-white shadow-sm' : (isDarkMode ? 'text-white/40 hover:text-white' : 'text-gray-500 hover:text-gray-800')}`}
                        >
                            <Globe size={10}/> Web
                        </button>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-4 w-64 justify-end">
                <div className={`p-2 rounded-full cursor-pointer transition-colors ${isDarkMode ? 'hover:bg-white/10 text-white/80' : 'hover:bg-gray-100 text-gray-600'}`} onClick={onClose}><X size={24} /></div>
            </div>
        </div>

        {/* RESULTS AREA */}
        <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
            {!localQuery ? (
                <div className="flex flex-col items-center justify-center h-full opacity-60 space-y-6">
                    <div className="w-32 h-32 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center mb-4 animate-pulse">
                        <GoogleIcons.Search className={`w-16 h-16 ${isDarkMode ? 'text-white/30' : 'text-blue-500/40'}`} stroke="currentColor"/>
                    </div>
                    <p className={`text-xl font-light text-center max-w-md ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
                        {mode === 'workspace' ? "Digite para pesquisar em e-mails, arquivos e agenda." : "Faça perguntas sobre o mundo real usando o Google Search e Maps."}
                    </p>
                </div>
            ) : mode === 'workspace' ? (
                isSearching ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 size={32} className="animate-spin text-blue-500"/>
                    </div>
                ) : (
                    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
                        {/* AI SUMMARY CARD */}
                        {workspaceSummary && (
                            <div className={`border p-4 rounded-xl flex items-start gap-3 shadow-sm ${isDarkMode ? 'bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-white/10' : 'bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200'}`}>
                                <Sparkles size={20} className="text-blue-500 mt-0.5 shrink-0"/>
                                <div>
                                    <h4 className={`text-sm font-medium mb-1 ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>Resumo Inteligente</h4>
                                    <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>{workspaceSummary}</p>
                                </div>
                            </div>
                        )}

                        {/* CALENDAR EVENTS */}
                        {workspaceResults.events && workspaceResults.events.length > 0 && (
                            <div>
                                <h3 className={`text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2 ${isDarkMode ? 'text-white/40' : 'text-gray-500'}`}><Calendar size={14}/> Agenda</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {workspaceResults.events.map((ev:any, i:number) => (
                                        <div key={i} className={`${cardClass} p-3 rounded-xl cursor-pointer transition-all border flex flex-col gap-1 group`}>
                                            <div className="flex justify-between items-start">
                                                <h4 className={`font-medium truncate text-sm ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{ev.title}</h4>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-600'}`}>Evento</span>
                                            </div>
                                            <p className={`text-xs ${isDarkMode ? 'text-white/40' : 'text-gray-500'}`}>{new Date(ev.start).toLocaleDateString()} {new Date(ev.start).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                                            {ev.location && <p className={`text-[10px] flex items-center gap-1 ${isDarkMode ? 'text-white/30' : 'text-gray-400'}`}><MapPin size={10}/> {ev.location}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* FILES */}
                        {workspaceResults.files && workspaceResults.files.length > 0 && (
                            <div>
                                <h3 className={`text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2 ${isDarkMode ? 'text-white/40' : 'text-gray-500'}`}><HardDrive size={14}/> Arquivos</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {workspaceResults.files.map((f:any) => (
                                        <div key={f.id} onClick={() => onOpenApp && onOpenApp(f.type, f)} className={`${cardClass} p-3 rounded-xl cursor-pointer transition-all border flex items-center gap-3 group relative overflow-hidden`}>
                                            <div className={`p-2 rounded-lg transition-colors shrink-0 ${isDarkMode ? 'bg-white/5 group-hover:bg-white/10' : 'bg-gray-100 group-hover:bg-gray-200'}`}>{getFileIcon(f.type)}</div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className={`font-medium truncate text-sm group-hover:text-blue-500 transition-colors ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{f.name}</h4>
                                                <p className={`text-[10px] flex items-center gap-2 mt-0.5 ${isDarkMode ? 'text-white/40' : 'text-gray-500'}`}><span>{f.owner}</span> • <span>{f.date}</span></p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* EMAILS */}
                        {workspaceResults.emails && workspaceResults.emails.length > 0 && (
                            <div>
                                <h3 className={`text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2 ${isDarkMode ? 'text-white/40' : 'text-gray-500'}`}><Mail size={14}/> E-mails</h3>
                                <div className="grid gap-2">
                                    {workspaceResults.emails.map((e:any) => (
                                        <div key={e.id} onClick={() => onOpenApp && onOpenApp('mail')} className={`${cardClass} px-4 py-3 rounded-xl cursor-pointer transition-all border flex items-center gap-4 group`}>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${e.color || 'bg-blue-600'}`}>{e.senderInit || e.sender[0]}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-baseline mb-0.5">
                                                    <h4 className={`font-medium truncate text-sm group-hover:text-blue-500 transition-colors ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{e.subject}</h4>
                                                    <span className={`text-[10px] ml-2 whitespace-nowrap ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`}>{e.time}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs font-medium ${isDarkMode ? 'text-white/70' : 'text-gray-700'}`}>{e.sender}</span>
                                                    <p className={`text-xs truncate flex-1 ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>{e.preview}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!hasResults && (
                             <div className={`text-center mt-10 ${isDarkMode ? 'text-white/40' : 'text-gray-500'}`}>
                                 <p>Nenhum resultado encontrado no Workspace para "{localQuery}".</p>
                                 <button onClick={() => { setMode('web'); handleWebSearch(); }} className="text-blue-500 hover:underline mt-2 text-sm">Tentar pesquisar na Web</button>
                             </div>
                        )}
                    </div>
                )
            ) : (
                <div className="max-w-4xl mx-auto h-full flex flex-col">
                    {isGenerating ? (
                        <div className={`flex flex-col items-center justify-center h-full ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>
                            <Loader2 size={32} className="animate-spin mb-4 text-blue-500"/>
                            <p>Pesquisando na web...</p>
                        </div>
                    ) : aiResponse ? (
                        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4">
                            
                            {/* AI ANSWER CARD */}
                            <div className={`border p-6 rounded-2xl shadow-xl ${isDarkMode ? 'bg-[#303134] border-white/10' : 'bg-white border-gray-200'}`}>
                                <div className="flex items-center gap-2 mb-4">
                                    <GeminiLogo className="w-6 h-6"/>
                                    <span className={`text-sm font-medium ${isDarkMode ? 'text-white/90' : 'text-gray-800'}`}>Resposta Gerada</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${isDarkMode ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>Gemini Grounding</span>
                                </div>
                                <div className={`leading-relaxed text-sm whitespace-pre-wrap font-light ${isDarkMode ? 'text-white/90' : 'text-gray-700'}`}>
                                    {aiResponse}
                                </div>
                            </div>

                            {/* GROUNDING SOURCES */}
                            {groundingSources.length > 0 && (
                                <div>
                                    <h3 className={`text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2 ${isDarkMode ? 'text-white/40' : 'text-gray-500'}`}><Globe size={14}/> Fontes & Referências</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {groundingSources.map((source, i) => {
                                            if (source.web) {
                                                return (
                                                    <a key={i} href={source.web.uri} target="_blank" rel="noopener noreferrer" className={`${cardClass} p-4 rounded-xl border transition-all group block`}>
                                                        <h4 className="text-blue-500 text-sm font-medium mb-1 truncate group-hover:underline">{source.web.title}</h4>
                                                        <div className={`flex items-center gap-2 text-xs ${isDarkMode ? 'text-white/40' : 'text-gray-500'}`}>
                                                            <ExternalLink size={12}/>
                                                            <span className="truncate">{source.web.uri}</span>
                                                        </div>
                                                    </a>
                                                );
                                            } else if (source.maps) {
                                                return (
                                                    <div key={i} className={`${cardClass} p-4 rounded-xl border flex items-center gap-3`}>
                                                        <MapPin size={20} className="text-red-500"/>
                                                        <div>
                                                            <h4 className={`font-medium text-sm ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{source.maps.title}</h4>
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
                        <div className={`flex flex-col items-center justify-center h-full ${isDarkMode ? 'text-white/30' : 'text-gray-400'}`}>
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
