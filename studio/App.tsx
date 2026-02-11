
import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, LayoutGrid, Loader2, CloudSun, Mail, HardDrive, FileText, 
  FileSpreadsheet, Presentation, Video, Plus, X, ArrowRight,
  Home, CheckCircle2, Lightbulb
} from 'lucide-react';
import AppViewer from './components/AppViewer';
import Aurora from './components/Aurora';
import GoogleLoader from './components/GoogleLoader';
import { GoogleIcons, GeminiLogo } from './components/GoogleIcons';
import { bridge, DashboardData } from './utils/GASBridge';
import { GoogleGenAI, Chat } from "@google/genai";

// Helper for file icons used in dashboard widgets
const getFileIcon = (type: string) => {
    switch(type) {
        case 'sheet': return <GoogleIcons.Sheets className="w-5 h-5" />;
        case 'slide': return <GoogleIcons.Slides className="w-5 h-5" />;
        case 'doc': return <GoogleIcons.Docs className="w-5 h-5" />;
        default: return <FileText className="w-5 h-5 text-gray-400" />;
    }
};

export default function App() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [aiMode, setAiMode] = useState(false); 
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false); 
  const [chatHistory, setChatHistory] = useState<Array<{role: string, text: string}>>([]);
  const [activeApp, setActiveApp] = useState<{type: string, data?: any} | null>(null); 
  
  const [activeTab, setActiveTab] = useState('');
  const [menuSearchActive, setMenuSearchActive] = useState(false);

  // Gemini State
  const chatSession = useRef<Chat | null>(null);
  const aiClient = useRef<GoogleGenAI | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuInputRef = useRef<HTMLInputElement>(null);

  // Initialize Gemini
  useEffect(() => {
    try {
        if (!aiClient.current) {
            aiClient.current = new GoogleGenAI({ apiKey: process.env.API_KEY });
            chatSession.current = aiClient.current.chats.create({
                model: 'gemini-3-flash-preview',
                config: {
                    systemInstruction: "Você é um assistente inteligente do Google Workspace OS. Você ajuda o usuário a gerenciar seus e-mails, arquivos do Drive, agenda e tarefas. Seja conciso, útil e amigável. Use formatação Markdown simples quando necessário.",
                },
            });
        }
    } catch (e) {
        console.error("Erro ao inicializar Gemini:", e);
    }
  }, []);

  // FETCH DATA VIA BRIDGE
  useEffect(() => {
    bridge.getInitialData()
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load dashboard data", err);
        setLoading(false);
      });
  }, []);

  // SYNC HANDLERS
  const updateTasks = (newTasks: any[]) => {
      setData(prev => prev ? { ...prev, tasks: newTasks } : null);
  };

  const updateNotes = (newNotes: any[]) => {
      setData(prev => prev ? { ...prev, notes: newNotes } : null);
  };

  useEffect(() => {
    if (aiMode && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 500);
      setIsInputFocused(true);
    }
  }, [aiMode]);
  
  useEffect(() => {
    if (menuSearchActive && menuInputRef.current) {
        setTimeout(() => menuInputRef.current?.focus(), 100);
    }
  }, [menuSearchActive]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chatHistory, isTyping]);

  const handleSendMessage = async () => {
    if (!searchQuery.trim()) return;
    const text = searchQuery;
    
    setChatHistory(prev => [...prev, { role: 'user', text }]);
    setSearchQuery('');
    if (menuSearchActive) setMenuSearchActive(false);
    setAiMode(true);
    setIsTyping(true);

    try {
        if (!chatSession.current) throw new Error("Chat session not initialized");

        setChatHistory(prev => [...prev, { role: 'assistant', text: '' }]);

        const result = await chatSession.current.sendMessageStream({ message: text });
        
        let fullResponse = "";
        
        for await (const chunk of result) {
            const chunkText = chunk.text || "";
            fullResponse += chunkText;
            
            setChatHistory(prev => {
                const newHistory = [...prev];
                const lastMsgIndex = newHistory.length - 1;
                if (lastMsgIndex >= 0 && newHistory[lastMsgIndex].role === 'assistant') {
                    newHistory[lastMsgIndex] = { ...newHistory[lastMsgIndex], text: fullResponse };
                }
                return newHistory;
            });
            setIsTyping(false);
        }

    } catch (error) {
        console.error("Gemini Error:", error);
        setIsTyping(false);
        setChatHistory(prev => [...prev, { role: 'assistant', text: "Desculpe, não consegui processar sua solicitação no momento." }]);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const openApp = (type: string, fileData?: any) => {
    setAiMode(false);
    setActiveApp({ type, data: fileData });
    setActiveTab(type);
  };

  const toggleSearch = () => {
    setActiveTab('search');
    setMenuSearchActive(true);
  };

  if (loading || !data) {
    return <GoogleLoader />;
  }

  const quickCreateApps = [
    { 
      id: 'search', label: "Pesquisar", 
      icon: <Search size={18} />, 
      color: '#4E79F3', activeColor: '#202124', lightColor: '#F0F4F9',
      iconColor: 'url(#gemini-gradient-search)' 
    },
    { id: 'mail', label: "Gmail", icon: <GoogleIcons.GmailGlass className="w-6 h-6" />, color: '#EA4335', lightColor: '#FCE8E6' },
    { id: 'drive', label: "Drive", icon: <GoogleIcons.DriveGlass className="w-6 h-6" />, color: '#34A853', lightColor: '#E6F4EA', isGlass: true },
    { id: 'doc', label: "Docs", icon: <GoogleIcons.DocsGlass className="w-6 h-6" />, color: '#4285F4', lightColor: '#E8F0FE', isGlass: true },
    { id: 'sheet', label: "Sheets", icon: <GoogleIcons.SheetsGlass className="w-6 h-6" />, color: '#34A853', lightColor: '#E6F4EA', isGlass: true },
    { id: 'slide', label: "Slides", icon: <GoogleIcons.SlidesGlass className="w-6 h-6" />, color: '#FBBC05', lightColor: '#FEF7E0', isGlass: true },
    { id: 'meet', label: "Meet", icon: <GoogleIcons.MeetGlass className="w-6 h-6" />, color: '#EA4335', lightColor: '#FCE8E6', isGlass: true },
  ];

  const isLightMode = !!activeApp;
  const glassCard = "bg-black/40 backdrop-blur-3xl border border-white/10 rounded-[32px] shadow-2xl hover:border-white/20 transition-all duration-300";
  const glassInner = "bg-white/5 hover:bg-white/10 border border-white/5 transition-colors";

  return (
    <div className="min-h-screen bg-[#050505] text-[#E3E3E3] font-sans selection:bg-[#4E79F3]/30 overflow-hidden relative">
      {/* Aurora Background Fixed Top */}
      <div className={`fixed top-0 left-0 right-0 h-[600px] z-0 pointer-events-none transition-opacity duration-1000 ${aiMode ? 'opacity-30' : 'opacity-100'}`}>
          <Aurora colorStops={["#4285F4", "#34A853", "#EA4335"]} speed={0.5} amplitude={1.2} />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050505]/40 to-[#050505]"></div>
      </div>

      {activeApp && (
          <AppViewer 
              type={activeApp.type} 
              onClose={() => setActiveApp(null)} 
              data={activeApp.data || data} 
              searchQuery={searchQuery} 
              onOpenApp={openApp}
              onUpdateTasks={updateTasks}
              onUpdateNotes={updateNotes}
          />
      )}

      {/* --- MENU FLUTUANTE INFERIOR --- */}
      <div className={`fixed bottom-8 left-0 right-0 z-[60] flex justify-center items-center gap-3 px-4 pointer-events-none transition-all duration-500 ${aiMode ? 'opacity-0 translate-y-20' : 'opacity-100 translate-y-0'}`}>
          
          <button 
              onClick={(e) => {
                  const btn = e.currentTarget;
                  if (btn.classList.contains('active')) {
                      btn.classList.remove('active');
                      void btn.offsetWidth;
                      btn.classList.add('active');
                  } else {
                      btn.classList.add('active');
                  }
                  setActiveApp(null); 
                  setActiveTab(''); 
                  setAiMode(false); 
                  setMenuSearchActive(false); 
              }}
              className="glass-btn group shrink-0 pointer-events-auto"
              title="Home"
          >
              <div className="glass-body"></div>
              <Home size={28} className="home-icon" />
          </button>

          <div 
              className={`relative flex items-center backdrop-blur-3xl border p-2 rounded-full shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] gap-2 pointer-events-auto transition-all duration-300 ${isLightMode ? 'bg-black/20 border-white/10' : 'bg-white/10 border-white/20'}`}
              style={{ height: '72px' }}
          >
              {menuSearchActive ? (
                  <div className="flex items-center px-4 py-2 w-[500px] animate-in fade-in zoom-in duration-300">
                      <GoogleIcons.Search className={`text-white/70 ml-2 mr-3 w-6 h-6`} stroke="white" />
                      <input 
                          ref={menuInputRef}
                          type="text" 
                          placeholder="Pesquise ou fale com o Gemini" 
                          className={`flex-1 bg-transparent outline-none text-white placeholder:text-white/40 h-full text-lg font-light`}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                          autoFocus
                      />
                      <button onClick={() => { setMenuSearchActive(false); setSearchQuery(''); }} className={`p-2 rounded-full ml-2 transition-all hover:bg-white/10 text-white/70 active:scale-90`}>
                          <X size={20} />
                      </button>
                  </div>
              ) : (
                  <>
                      {quickCreateApps.map((app) => {
                          const isActive = activeTab === app.id;
                          const iconColor = app.color; 
                          const textColor = isActive ? app.color : '#ffffff';
                          const hoverBg = isLightMode ? 'hover:bg-white/10' : 'hover:bg-white/10';

                          return (
                            <button 
                                key={app.id} 
                                onClick={() => app.id === 'search' ? toggleSearch() : openApp(app.id)}
                                className={`group relative flex items-center justify-center p-3 rounded-full transition-all duration-400 ease-[cubic-bezier(0.25,1,0.5,1)] active:scale-95 ${isActive ? '' : hoverBg}`}
                                style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.15)' : undefined }}
                            >
                                <div 
                                    className={`
                                        transition-all duration-400 ease-[cubic-bezier(0.25,1,0.5,1)]
                                        ${isActive ? 'scale-110 -translate-y-1' : 'scale-100 translate-y-0'} 
                                        ${isActive 
                                            ? 'filter-none opacity-100 drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]' 
                                            : 'grayscale brightness-[2.5] contrast-125 opacity-70 drop-shadow-[0_2px_4px_rgba(255,255,255,0.1)] group-hover:filter-none group-hover:grayscale-0 group-hover:brightness-100 group-hover:opacity-100 group-hover:drop-shadow-[0_0_20px_rgba(255,255,255,0.4)] group-hover:scale-110 group-hover:-translate-y-1'
                                        }
                                    `}
                                    style={{ color: iconColor }}
                                >
                                    {app.id === 'search' ? (
                                        <GoogleIcons.Search className="w-6 h-6" stroke={isActive || 'group-hover' ? app.color : "currentColor"} />
                                    ) : (
                                        React.cloneElement(app.icon as React.ReactElement<any>, { 
                                            size: 24, 
                                            color: iconColor, 
                                            className: `transition-colors duration-200`
                                        })
                                    )}
                                </div>
                                <span className={`max-w-0 overflow-hidden whitespace-nowrap opacity-0 group-hover:max-w-[140px] group-hover:opacity-100 group-hover:ml-3 text-sm font-medium transition-all duration-300`} style={{ color: textColor }}>
                                    {app.label}
                                </span>
                            </button>
                          );
                      })}
                  </>
              )}
          </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8 flex flex-col h-screen relative z-10 pb-28">
        
        {/* HEADER */}
        <header className={`relative mb-8 h-32 flex items-center px-4 justify-between transition-all duration-700 ${aiMode ? 'opacity-0 -translate-y-10 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
            <div className="flex items-center gap-4 animate-in fade-in duration-300 relative z-10">
                <div>
                    <h1 className="text-5xl md:text-7xl font-bold text-[#E3E3E3] drop-shadow-md tracking-tight">
                       {getGreeting()}, <span className="bg-gradient-to-r from-[#4E79F3] via-[#9c51b6] to-[#E95C67] text-transparent bg-clip-text drop-shadow-sm">{data.user.name.split(' ')[0]}</span>
                    </h1>
                </div>
            </div>
            <div className="flex items-center gap-4 animate-in fade-in duration-300 relative z-10">
                <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-full text-xs font-medium text-[#E3E3E3]">
                    <CloudSun size={14} className="text-[#FBBC05]" />
                    <span>{data.weather.temp}</span>
                </div>
                <button className="p-2 rounded-full hover:bg-white/10 border border-transparent hover:border-white/10 text-[#E3E3E3] backdrop-blur-sm"><LayoutGrid size={20} /></button>
                <img src={data.user.avatar} alt="Profile" className="w-9 h-9 rounded-full border border-white/20 hover:ring-2 hover:ring-white/20 cursor-pointer transition-all" />
            </div>
        </header>

        <div className="flex-1 relative w-full overflow-y-auto pr-2 custom-scrollbar">
            {/* Widgets Grid */}
            <div className={`grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-min transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${aiMode ? 'opacity-30 scale-[0.98] blur-sm pointer-events-none' : 'opacity-100 scale-100 blur-0'}`}>
                
                {/* 2. GMAIL */}
                <div className={`${glassCard} md:col-span-8 p-6 h-[320px] flex flex-col`}>
                    <div className="flex justify-between items-center mb-4">
                       <span className="font-bold text-[#E3E3E3] text-sm">Caixa de Entrada</span>
                       <Mail size={18} className="text-[#EA4335]" />
                    </div>
                    <div className="space-y-2 flex-1 overflow-hidden">
                      {data.emails.slice(0, 4).map((e: any) => (
                        <div key={e.id} onClick={() => openApp('mail')} className="p-2 hover:bg-white/5 rounded-2xl cursor-pointer group transition-colors border border-transparent hover:border-white/5">
                           <div className="flex justify-between items-start mb-1">
                              <span className="font-medium text-xs text-[#E3E3E3]">{e.sender}</span>
                              <span className="text-[10px] text-white/40">{e.time}</span>
                           </div>
                           <p className="text-xs text-white/60 truncate group-hover:text-[#E3E3E3] transition-colors">{e.subject}</p>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => openApp('mail')} className="w-full mt-2 py-2 text-xs text-[#EA4335] font-medium hover:bg-[#EA4335]/10 rounded-xl transition bg-[#EA4335]/5 border border-[#EA4335]/20">
                      Escrever Email
                    </button>
                </div>

                {/* 3. DRIVE */}
                <div className={`${glassCard} md:col-span-4 p-6 flex flex-col h-[320px]`}>
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-white/60 text-xs font-bold uppercase">Meu Drive</span>
                        <HardDrive size={18} className="text-[#34A853]" />
                    </div>
                    <div className="space-y-2 flex-1 overflow-hidden">
                        {data.files.slice(0, 4).map((f: any) => (
                          <div key={f.id} onClick={() => openApp(f.type, f)} className="flex items-center gap-2 p-2 rounded-xl hover:bg-white/5 cursor-pointer group transition-colors border border-transparent hover:border-white/5">
                             <div className="p-1.5 bg-white/5 rounded-lg group-hover:bg-white/10">
                               {getFileIcon(f.type)}
                             </div>
                             <div className="overflow-hidden min-w-0">
                               <p className="text-xs font-medium truncate text-[#E3E3E3] group-hover:text-blue-400 transition-colors">{f.name}</p>
                               <p className="text-[10px] text-white/40 truncate">{f.date}</p>
                             </div>
                          </div>
                        ))}
                    </div>
                    <div className="mt-auto pt-2 border-t border-white/5">
                        <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                           <div className="bg-[#34A853] h-full w-[78%] rounded-full shadow-[0_0_10px_rgba(52,168,83,0.5)]"></div>
                        </div>
                    </div>
                </div>

                {/* 4. KEEP */}
                <div className={`${glassCard} md:col-span-6 p-6 flex flex-col h-[280px]`}>
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-white/60 text-xs font-bold uppercase tracking-wider">Notas</span>
                        <Lightbulb size={18} className="text-[#FBBC05]" />
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-3 overflow-hidden">
                        <div onClick={() => openApp('keep')} className={`p-3 rounded-2xl cursor-pointer flex flex-col items-center justify-center text-center transition-colors group ${glassInner}`}>
                            <Plus size={24} className="text-[#FBBC05] mb-2 group-hover:scale-110 transition-transform" />
                            <span className="text-xs font-medium text-[#E3E3E3]">Nova Nota</span>
                        </div>
                        {data.notes && data.notes.slice(0, 3).map((note: any) => (
                            <div key={note.id} onClick={() => openApp('keep')} className={`p-3 rounded-2xl cursor-pointer flex flex-col ${glassInner}`}>
                                <h4 className="text-xs font-bold text-[#E3E3E3] mb-1 truncate">{note.title || "Sem título"}</h4>
                                <p className="text-[10px] text-white/60 line-clamp-3 leading-relaxed">{note.content}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 5. TASKS */}
                <div className={`${glassCard} md:col-span-6 p-6 flex flex-col h-[280px]`}>
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-white/60 text-xs font-bold uppercase tracking-wider">Tarefas</span>
                        <CheckCircle2 size={18} className="text-[#4E79F3]" />
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                        {data.tasks && data.tasks.slice(0, 5).map((task: any) => (
                            <div key={task.id} onClick={() => openApp('tasks')} className="group flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/5">
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${task.completed ? 'bg-[#4E79F3] border-[#4E79F3]' : 'border-white/40 group-hover:border-white'}`}>
                                    {task.completed && <CheckCircle2 size={14} className="text-white" />}
                                </div>
                                <span className={`text-sm flex-1 ${task.completed ? 'text-white/40 line-through' : 'text-[#E3E3E3]'}`}>
                                    {task.title}
                                </span>
                            </div>
                        ))}
                        <div onClick={() => openApp('tasks')} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 cursor-pointer transition-colors text-white/60 hover:text-white border border-transparent hover:border-white/5">
                            <Plus size={20} />
                            <span className="text-sm font-medium">Adicionar tarefa</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>

        {/* --- CHAT OVERLAY --- */}
        <div className={`absolute inset-0 w-full flex flex-col z-20 pointer-events-none ${aiMode ? 'pointer-events-auto' : ''}`}>
            {/* ... chat overlay code ... */}
            <div className={`flex justify-end p-2 transition-opacity duration-500 ${aiMode ? 'opacity-100' : 'opacity-0'}`}>
                <button onClick={() => setAiMode(false)} className="px-4 py-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition flex items-center gap-2 shadow-2xl">
                    <span className="text-xs font-medium">Fechar Chat</span>
                    <X size={16} />
                </button>
            </div>
            <div ref={chatContainerRef} className={`flex-1 overflow-y-auto px-4 md:px-20 py-4 scroll-smooth transition-all duration-700 ${aiMode ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                {/* Chat content... */}
                {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-6`}>
                        {msg.role === 'assistant' && (
                            <div className="w-8 h-8 mr-3 rounded-full border border-white/10 flex items-center justify-center bg-black/40 backdrop-blur-md shrink-0">
                                <GeminiLogo className="w-5 h-5" />
                            </div>
                        )}
                        <div className={`max-w-[80%] p-4 rounded-2xl text-[15px] leading-relaxed shadow-lg backdrop-blur-md border border-white/5 ${msg.role === 'user' ? 'bg-[#4E79F3]/20 text-white rounded-tr-sm' : 'text-[#E3E3E3] bg-white/5 rounded-tl-sm'}`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                {isTyping && <div className="text-white/40 pl-14 text-xs animate-pulse">Gemini está digitando...</div>}
                <div className="h-24"></div> 
            </div>
        </div>

        {/* BARRA DE ENTRADA CHAT */}
        <div className={`absolute left-0 right-0 mx-auto w-full max-w-3xl z-30 transition-all duration-[800ms] ease-[cubic-bezier(0.23,1,0.32,1)] ${aiMode ? 'bottom-8 opacity-100 translate-y-0 pointer-events-auto' : 'bottom-[-100px] opacity-0 translate-y-10 pointer-events-none'}`}>
            <div className={`relative w-full rounded-full group transition-all duration-500 shadow-[0_0_50px_rgba(78,121,243,0.3)]`}>
                <div className={`absolute -inset-[2px] rounded-[32px] overflow-hidden pointer-events-none transition-opacity duration-500 ${aiMode && isInputFocused ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="absolute top-1/2 left-1/2 w-[200%] h-[200%] -translate-x-1/2 -translate-y-1/2 animate-[spin_3s_linear_infinite]" style={{ background: 'conic-gradient(from 0deg, transparent 0 340deg, #4285F4 345deg, #EA4335 350deg, #FBBC05 355deg, #34A853 360deg)' }}></div>
                </div>
                <div className={`relative flex items-center w-full transition-all duration-300 bg-black/60 backdrop-blur-2xl rounded-full border border-white/10 h-16 px-2`}>
                    <button className={`p-3 rounded-full transition-colors bg-white/10 hover:bg-white/20 text-white ml-1`}><Plus size={24} /></button>
                    <input ref={inputRef} type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Digite uma mensagem para o Gemini..." className="flex-1 bg-transparent border-none outline-none text-[#E3E3E3] px-3 h-12 placeholder:text-white/40 text-base" onFocus={() => setIsInputFocused(true)} onBlur={() => setIsInputFocused(false)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} />
                    <div className="flex items-center gap-1 pr-1">
                        {searchQuery && <button onClick={(e) => { e.stopPropagation(); handleSendMessage(); }} className="p-2.5 bg-white text-black hover:bg-gray-200 rounded-full transition shadow-lg mr-1"><ArrowRight size={20} /></button>}
                    </div>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}