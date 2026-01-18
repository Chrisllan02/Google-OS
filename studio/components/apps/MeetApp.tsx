
import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, Mic, MicOff, VideoOff, Hand, MonitorUp, MoreVertical, PhoneOff, 
  MessageSquare, Users, X, Send, Smile, Presentation, Layout
} from 'lucide-react';

interface MeetAppProps {
  onClose: () => void;
  data: any;
}

export default function MeetApp({ onClose, data }: MeetAppProps) {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [sidePanel, setSidePanel] = useState<'none' | 'chat' | 'people'>('none');
  const [chatMessage, setChatMessage] = useState('');
  
  const [messages, setMessages] = useState([
      { sender: 'Julia Silva', text: 'Bom dia pessoal!', time: '10:00' },
      { sender: 'Roberto Alves', text: 'O link do design system está no drive.', time: '10:02' }
  ]);

  const [participants, setParticipants] = useState([
      { name: 'Eu (Você)', mic: true, cam: true, isHost: true },
      { name: 'Julia Silva', mic: false, cam: true, isHost: false },
      { name: 'Roberto Alves', mic: true, cam: false, isHost: false },
      { name: 'Ana Costa', mic: false, cam: false, isHost: false }
  ]);

  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
  }, [messages, sidePanel]);

  const handleSendMessage = () => {
      if (!chatMessage.trim()) return;
      const now = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      setMessages([...messages, { sender: 'Eu', text: chatMessage, time: now }]);
      setChatMessage('');
  };

  const toggleSidePanel = (panel: 'chat' | 'people') => {
      setSidePanel(sidePanel === panel ? 'none' : panel);
  };

  return (
    <div className="flex flex-col h-full bg-[#202124] relative overflow-hidden">
        
        {/* HEADER OVERLAY */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-3 bg-[#202124]/80 backdrop-blur px-4 py-2 rounded-lg text-white shadow-lg border border-white/5">
            <span className="font-medium text-sm">Daily Scrum</span>
            <span className="text-xs text-white/60">|</span>
            <span className="text-xs text-white/60 bg-white/10 px-1.5 py-0.5 rounded">abc-defg-hij</span>
            {screenSharing && <span className="flex items-center gap-1 text-[10px] text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full"><Presentation size={10}/> Apresentando</span>}
        </div>
        
        {/* MAIN CONTENT AREA */}
        <div className="flex-1 flex overflow-hidden p-4 gap-4">
            
            {/* VIDEO GRID / STAGE */}
            <div className={`flex-1 flex flex-col transition-all duration-300 ${sidePanel !== 'none' ? 'mr-0' : ''}`}>
                {screenSharing ? (
                    <div className="flex-1 bg-[#3C4043] rounded-2xl flex items-center justify-center relative border border-white/5 mb-4">
                        <div className="text-center p-8">
                            <Presentation size={64} className="text-blue-400 mx-auto mb-4 animate-pulse"/>
                            <h3 className="text-xl text-white font-medium">Você está apresentando para todos</h3>
                            <button onClick={() => setScreenSharing(false)} className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm text-white font-medium transition-colors">Parar apresentação</button>
                        </div>
                        {/* Miniature of presenter */}
                        <div className="absolute bottom-4 right-4 w-48 h-32 bg-black/50 rounded-xl overflow-hidden border border-white/10 shadow-xl">
                             {camOn ? (
                                <img src="https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=400&auto=format&fit=crop" className="w-full h-full object-cover" alt="Me" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-700 text-white font-bold">Eu</div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className={`grid gap-4 h-full ${participants.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3'}`}>
                        {/* Self */}
                        <div className={`bg-[#3C4043] rounded-2xl relative overflow-hidden flex items-center justify-center group border ${micOn ? 'border-blue-500/50' : 'border-transparent'}`}>
                            {camOn ? (
                                <img src="https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=800&auto=format&fit=crop" className="w-full h-full object-cover transform scale-x-[-1]" alt="Me" />
                            ) : (
                                <div className="w-32 h-32 rounded-full bg-blue-600 flex items-center justify-center text-4xl text-white font-bold shadow-lg">V</div>
                            )}
                            <div className="absolute bottom-4 left-4 flex items-center gap-2">
                                <span className="text-white text-sm font-medium shadow-black drop-shadow-md bg-black/40 px-2 py-1 rounded">Você</span>
                            </div>
                            {!micOn && <div className="absolute top-4 right-4 bg-black/60 p-2 rounded-full backdrop-blur-sm"><MicOff size={16} className="text-red-500"/></div>}
                            {handRaised && <div className="absolute top-4 left-4 bg-yellow-500/90 p-2 rounded-full shadow-lg animate-bounce"><Hand size={20} className="text-black"/></div>}
                        </div>

                        {/* Others */}
                        <div className="bg-[#3C4043] rounded-2xl relative overflow-hidden flex items-center justify-center group">
                            <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&auto=format&fit=crop" className="w-full h-full object-cover" alt="Participant" />
                            <span className="absolute bottom-4 left-4 text-white text-sm font-medium shadow-black drop-shadow-md bg-black/40 px-2 py-1 rounded">Julia Silva</span>
                            {/* Visualizer Mock */}
                            <div className="absolute bottom-4 right-4 flex gap-1 h-4 items-end">
                                <div className="w-1 bg-green-400 animate-[pulse_0.5s_ease-in-out_infinite] h-2"></div>
                                <div className="w-1 bg-green-400 animate-[pulse_0.7s_ease-in-out_infinite] h-4"></div>
                                <div className="w-1 bg-green-400 animate-[pulse_0.6s_ease-in-out_infinite] h-3"></div>
                            </div>
                        </div>
                        <div className="bg-[#3C4043] rounded-2xl relative overflow-hidden flex items-center justify-center">
                            <div className="w-32 h-32 rounded-full bg-orange-500 flex items-center justify-center text-4xl text-white font-bold shadow-lg">R</div>
                            <span className="absolute bottom-4 left-4 text-white text-sm font-medium shadow-black drop-shadow-md bg-black/40 px-2 py-1 rounded">Roberto Alves</span>
                            <div className="absolute top-4 right-4 bg-black/60 p-2 rounded-full"><MicOff size={16} className="text-red-500"/></div>
                        </div>
                        <div className="bg-[#3C4043] rounded-2xl relative overflow-hidden flex items-center justify-center">
                            <div className="w-32 h-32 rounded-full bg-teal-600 flex items-center justify-center text-4xl text-white font-bold shadow-lg">A</div>
                            <span className="absolute bottom-4 left-4 text-white text-sm font-medium shadow-black drop-shadow-md bg-black/40 px-2 py-1 rounded">Ana Costa</span>
                            <div className="absolute top-4 right-4 bg-black/60 p-2 rounded-full"><VideoOff size={16} className="text-white/70"/></div>
                        </div>
                    </div>
                )}
            </div>

            {/* SIDE PANEL */}
            {sidePanel !== 'none' && (
                <div className="w-80 bg-white rounded-2xl flex flex-col shadow-2xl animate-in slide-in-from-right-10 duration-300 overflow-hidden">
                    <div className="h-14 flex items-center justify-between px-4 border-b border-gray-100">
                        <span className="text-gray-800 font-medium text-lg">{sidePanel === 'chat' ? 'Mensagens' : 'Pessoas'}</span>
                        <button onClick={() => setSidePanel('none')} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X size={20}/></button>
                    </div>
                    
                    {sidePanel === 'chat' ? (
                        <>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50" ref={chatScrollRef}>
                                <p className="text-center text-xs text-gray-400 my-2">As mensagens só podem ser vistas durante a chamada.</p>
                                {messages.map((msg, i) => (
                                    <div key={i} className={`flex flex-col ${msg.sender === 'Eu' ? 'items-end' : 'items-start'}`}>
                                        <div className="flex items-baseline gap-2 mb-1">
                                            <span className="text-xs font-bold text-gray-700">{msg.sender}</span>
                                            <span className="text-[10px] text-gray-400">{msg.time}</span>
                                        </div>
                                        <div className={`px-4 py-2 rounded-2xl text-sm max-w-[85%] ${msg.sender === 'Eu' ? 'bg-blue-100 text-blue-900 rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'}`}>
                                            {msg.text}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="p-3 bg-white border-t border-gray-100">
                                <div className="flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2">
                                    <input 
                                        type="text" 
                                        placeholder="Enviar mensagem..." 
                                        className="bg-transparent outline-none flex-1 text-sm text-gray-700"
                                        value={chatMessage}
                                        onChange={(e) => setChatMessage(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                    />
                                    <button onClick={handleSendMessage} disabled={!chatMessage.trim()} className="text-blue-600 disabled:text-gray-400 hover:scale-110 transition-transform"><Send size={18}/></button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-2">
                            <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">Na chamada ({participants.length})</div>
                            {participants.map((p, i) => (
                                <div key={i} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${['bg-blue-600','bg-purple-600','bg-orange-500','bg-teal-600'][i%4]}`}>
                                            {p.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">{p.name}</p>
                                            {p.isHost && <p className="text-[10px] text-gray-500">Organizador</p>}
                                        </div>
                                    </div>
                                    <div className="flex gap-1 text-gray-400">
                                        {!p.mic && <MicOff size={14}/>}
                                        {!p.cam && <VideoOff size={14}/>}
                                        <button className="p-1 hover:bg-gray-200 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><MoreVertical size={14}/></button>
                                    </div>
                                </div>
                            ))}
                            <button className="w-full mt-2 py-2 text-blue-600 text-sm font-medium hover:bg-blue-50 rounded-lg transition-colors flex items-center justify-center gap-2">
                                <Users size={16}/> Adicionar pessoas
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* BOTTOM CONTROL BAR */}
        <div className="h-20 bg-[#202124] flex items-center justify-between px-6 pb-4 shrink-0 relative z-20">
            <div className="flex-1 text-white/80 text-sm hidden md:block font-medium truncate">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} | daily-scrum</div>
            
            <div className="flex items-center gap-3">
                <button onClick={() => setMicOn(!micOn)} className={`p-4 rounded-full transition-all duration-200 ${micOn ? 'bg-[#3C4043] hover:bg-[#4d5155] text-white ring-1 ring-white/10' : 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20'}`} title="Microfone (Ctrl+D)">
                    {micOn ? <Mic size={20}/> : <MicOff size={20}/>}
                </button>
                <button onClick={() => setCamOn(!camOn)} className={`p-4 rounded-full transition-all duration-200 ${camOn ? 'bg-[#3C4043] hover:bg-[#4d5155] text-white ring-1 ring-white/10' : 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20'}`} title="Câmera (Ctrl+E)">
                    {camOn ? <Video size={20}/> : <VideoOff size={20}/>}
                </button>
                <button onClick={() => setHandRaised(!handRaised)} className={`p-4 rounded-full transition-all duration-200 ${handRaised ? 'bg-blue-200 text-blue-900' : 'bg-[#3C4043] hover:bg-[#4d5155] text-white ring-1 ring-white/10'}`} title="Levantar a mão">
                    <Hand size={20}/>
                </button>
                <button onClick={() => setScreenSharing(!screenSharing)} className={`p-4 rounded-full transition-all duration-200 ${screenSharing ? 'bg-green-200 text-green-900' : 'bg-[#3C4043] hover:bg-[#4d5155] text-white ring-1 ring-white/10'}`} title="Apresentar agora">
                    <MonitorUp size={20}/>
                </button>
                <button className="p-4 rounded-full bg-[#3C4043] hover:bg-[#4d5155] text-white ring-1 ring-white/10 hidden md:block">
                    <MoreVertical size={20}/>
                </button>
                <button onClick={onClose} className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center gap-2 ml-2 shadow-lg shadow-red-900/30 transition-all hover:scale-105 active:scale-95">
                    <PhoneOff size={20}/> 
                </button>
            </div>

            <div className="flex-1 flex justify-end gap-3">
                <button onClick={() => toggleSidePanel('people')} className={`p-3 rounded-full transition-all ${sidePanel === 'people' ? 'bg-blue-300 text-blue-900' : 'text-white hover:bg-white/10'}`} title="Mostrar todos">
                    <div className="relative">
                        <Users size={20}/>
                        <span className="absolute -top-2 -right-2 bg-gray-600 text-[10px] px-1 rounded-full">{participants.length}</span>
                    </div>
                </button>
                <button onClick={() => toggleSidePanel('chat')} className={`p-3 rounded-full transition-all ${sidePanel === 'chat' ? 'bg-blue-300 text-blue-900' : 'text-white hover:bg-white/10'}`} title="Chat com todos">
                    <MessageSquare size={20}/>
                </button>
            </div>
        </div>
    </div>
  );
}
