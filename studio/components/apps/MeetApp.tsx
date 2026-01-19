
import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, Mic, MicOff, VideoOff, Hand, MonitorUp, MoreVertical, PhoneOff, 
  MessageSquare, Users, X, Send, Smile, Presentation, Layout, Info, Clock, ShieldCheck
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
  const [sidePanel, setSidePanel] = useState<'none' | 'chat' | 'people' | 'info'>('none');
  const [chatMessage, setChatMessage] = useState('');
  const [time, setTime] = useState(new Date());
  
  const [messages, setMessages] = useState([
      { sender: 'Julia Silva', text: 'Bom dia pessoal!', time: '10:00' },
      { sender: 'Roberto Alves', text: 'O link do design system está no drive.', time: '10:02' }
  ]);

  const [participants, setParticipants] = useState([
      { name: 'Eu (Você)', mic: true, cam: true, isHost: true, image: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=400&auto=format&fit=crop' },
      { name: 'Julia Silva', mic: false, cam: true, isHost: false, image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop' },
      { name: 'Roberto Alves', mic: true, cam: false, isHost: false, image: null, initial: 'R', color: 'bg-orange-500' },
      { name: 'Ana Costa', mic: false, cam: false, isHost: false, image: null, initial: 'A', color: 'bg-teal-600' }
  ]);

  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      const timer = setInterval(() => setTime(new Date()), 1000);
      return () => clearInterval(timer);
  }, []);

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

  const toggleSidePanel = (panel: 'chat' | 'people' | 'info') => {
      setSidePanel(sidePanel === panel ? 'none' : panel);
  };

  return (
    <div className="flex flex-col h-full bg-[#202124] relative overflow-hidden text-white font-sans">
        
        {/* HEADER OVERLAY */}
        <div className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-start pointer-events-none">
            <div className="pointer-events-auto bg-[#202124]/80 backdrop-blur-md px-4 py-2 rounded-b-xl shadow-lg border border-white/5 flex items-center gap-3">
                <span className="font-medium text-sm text-white/90">Daily Scrum - Equipe de Produto</span>
                <span className="text-xs text-white/40">|</span>
                <span className="text-xs text-white/60 bg-white/10 px-2 py-0.5 rounded tracking-wide">abc-defg-hij</span>
                {screenSharing && <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full border border-red-400/20"><Presentation size={10}/> Apresentando</span>}
            </div>
        </div>
        
        {/* MAIN CONTENT AREA */}
        <div className="flex-1 flex overflow-hidden p-4 gap-4 pt-16">
            
            {/* VIDEO GRID / STAGE */}
            <div className={`flex-1 flex flex-col transition-all duration-300 ${sidePanel !== 'none' ? 'mr-0' : ''}`}>
                {screenSharing ? (
                    <div className="flex-1 bg-[#3C4043] rounded-2xl flex items-center justify-center relative border border-white/5 mb-4 overflow-hidden group">
                        <div className="text-center p-8">
                            <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                                <Presentation size={40} className="text-blue-400"/>
                            </div>
                            <h3 className="text-2xl text-white font-medium mb-2">Você está apresentando</h3>
                            <p className="text-white/60">Todos na chamada podem ver sua tela.</p>
                            <button onClick={() => setScreenSharing(false)} className="mt-6 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-full text-sm text-white font-medium transition-colors shadow-lg">Parar apresentação</button>
                        </div>
                        {/* Picture-in-Picture Self View */}
                        <div className="absolute bottom-4 right-4 w-56 h-36 bg-black rounded-xl overflow-hidden border border-white/10 shadow-2xl drag-handle cursor-move">
                             {camOn ? (
                                <img src={participants[0].image} className="w-full h-full object-cover" alt="Me" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-800 text-white font-bold text-xl">Eu</div>
                            )}
                            <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[10px] font-medium">Você</div>
                        </div>
                    </div>
                ) : (
                    <div className={`grid gap-4 h-full ${participants.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-2 lg:grid-cols-3'}`}>
                        {/* Self */}
                        <div className={`bg-[#3C4043] rounded-2xl relative overflow-hidden flex items-center justify-center group border-2 ${micOn && !camOn ? 'border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'border-transparent'}`}>
                            {camOn ? (
                                <img src={participants[0].image} className="w-full h-full object-cover transform scale-x-[-1]" alt="Me" />
                            ) : (
                                <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center text-3xl text-white font-bold shadow-lg">V</div>
                            )}
                            <div className="absolute bottom-3 left-3 flex items-center gap-2">
                                <span className="text-white text-xs font-medium shadow-black drop-shadow-md bg-black/40 px-2 py-1 rounded backdrop-blur-sm">Você</span>
                            </div>
                            {!micOn && <div className="absolute top-3 right-3 bg-black/60 p-1.5 rounded-full backdrop-blur-sm"><MicOff size={14} className="text-red-500"/></div>}
                            {handRaised && <div className="absolute top-3 left-3 bg-[#FBBC04] p-2 rounded-full shadow-lg animate-bounce text-black"><Hand size={16}/></div>}
                            {/* Audio Visualizer Mock */}
                            {micOn && (
                                <div className="absolute top-3 right-3 flex gap-0.5 h-4 items-end">
                                    <div className="w-1 bg-blue-500 animate-[pulse_0.4s_ease-in-out_infinite] h-2"></div>
                                    <div className="w-1 bg-blue-500 animate-[pulse_0.6s_ease-in-out_infinite] h-3"></div>
                                    <div className="w-1 bg-blue-500 animate-[pulse_0.5s_ease-in-out_infinite] h-1.5"></div>
                                </div>
                            )}
                        </div>

                        {/* Others */}
                        {participants.slice(1).map((p, i) => (
                            <div key={i} className="bg-[#3C4043] rounded-2xl relative overflow-hidden flex items-center justify-center group">
                                {p.image ? (
                                    <img src={p.image} className="w-full h-full object-cover" alt={p.name} />
                                ) : (
                                    <div className={`w-24 h-24 rounded-full ${p.color} flex items-center justify-center text-3xl text-white font-bold shadow-lg`}>{p.initial}</div>
                                )}
                                <span className="absolute bottom-3 left-3 text-white text-xs font-medium shadow-black drop-shadow-md bg-black/40 px-2 py-1 rounded backdrop-blur-sm">{p.name}</span>
                                {!p.mic && <div className="absolute top-3 right-3 bg-black/60 p-1.5 rounded-full backdrop-blur-sm"><MicOff size={14} className="text-red-500"/></div>}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* SIDE PANEL */}
            {sidePanel !== 'none' && (
                <div className="w-[360px] bg-white rounded-2xl flex flex-col shadow-2xl animate-in slide-in-from-right-10 duration-300 overflow-hidden shrink-0">
                    <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100">
                        <span className="text-gray-800 font-medium text-lg">
                            {sidePanel === 'chat' && 'Mensagens na chamada'}
                            {sidePanel === 'people' && 'Pessoas'}
                            {sidePanel === 'info' && 'Detalhes da reunião'}
                        </span>
                        <button onClick={() => setSidePanel('none')} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"><X size={20}/></button>
                    </div>
                    
                    {sidePanel === 'chat' && (
                        <>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50" ref={chatScrollRef}>
                                <div className="bg-blue-50 p-3 rounded-lg text-xs text-gray-600 text-center mb-4">
                                    As mensagens só podem ser vistas durante a chamada e são excluídas quando a chamada termina.
                                </div>
                                {messages.map((msg, i) => (
                                    <div key={i} className={`flex flex-col ${msg.sender === 'Eu' ? 'items-end' : 'items-start'}`}>
                                        <div className="flex items-baseline gap-2 mb-1 px-1">
                                            <span className="text-xs font-bold text-gray-700">{msg.sender}</span>
                                            <span className="text-[10px] text-gray-400">{msg.time}</span>
                                        </div>
                                        <div className={`px-4 py-2.5 rounded-2xl text-sm max-w-[85%] leading-relaxed shadow-sm ${msg.sender === 'Eu' ? 'bg-[#E8F0FE] text-[#174EA6] rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'}`}>
                                            {msg.text}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="p-4 bg-white border-t border-gray-100">
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        placeholder="Enviar mensagem..." 
                                        className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-white border border-transparent focus:border-blue-500 outline-none rounded-full pl-5 pr-12 py-3 text-sm text-gray-700 transition-all"
                                        value={chatMessage}
                                        onChange={(e) => setChatMessage(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                    />
                                    <button onClick={handleSendMessage} disabled={!chatMessage.trim()} className="absolute right-2 top-1.5 p-1.5 text-blue-600 disabled:text-gray-400 hover:bg-blue-50 rounded-full transition-colors"><Send size={18}/></button>
                                </div>
                            </div>
                        </>
                    )}

                    {sidePanel === 'people' && (
                        <div className="flex-1 overflow-y-auto p-2">
                            <div className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider flex justify-between items-center">
                                <span>Na chamada ({participants.length})</span>
                                <button className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors">Mutar todos</button>
                            </div>
                            {participants.map((p, i) => (
                                <div key={i} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors group cursor-pointer">
                                    <div className="flex items-center gap-3">
                                        {p.image ? (
                                            <img src={p.image} className="w-9 h-9 rounded-full object-cover" alt={p.name} />
                                        ) : (
                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white ${p.color}`}>{p.initial || p.name[0]}</div>
                                        )}
                                        <div>
                                            <p className="text-sm font-medium text-gray-800 flex items-center gap-1">
                                                {p.name}
                                                {p.isHost && <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 rounded-full ml-1">Org</span>}
                                            </p>
                                            <p className="text-[10px] text-gray-500">{p.isHost ? 'Organizador da reunião' : 'Participante'}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 text-gray-400">
                                        {!p.mic ? <MicOff size={16}/> : <div className="flex gap-0.5 h-3 items-end w-3 justify-center"><div className="w-0.5 bg-green-500 h-2"></div><div className="w-0.5 bg-green-500 h-3"></div><div className="w-0.5 bg-green-500 h-1.5"></div></div>}
                                        <button className="p-1 hover:bg-gray-200 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-gray-600"><MoreVertical size={16}/></button>
                                    </div>
                                </div>
                            ))}
                            <button className="w-full mt-4 py-2.5 text-blue-600 text-sm font-medium hover:bg-blue-50 rounded-full transition-colors flex items-center justify-center gap-2 border border-blue-100">
                                <Users size={18}/> Adicionar pessoas
                            </button>
                        </div>
                    )}

                    {sidePanel === 'info' && (
                        <div className="flex-1 p-6">
                            <h3 className="text-lg font-medium text-gray-800 mb-1">Daily Scrum</h3>
                            <p className="text-sm text-gray-500 mb-6">{time.toLocaleDateString()} | 10:00 - 11:00</p>
                            
                            <div className="space-y-4">
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">Informações de participação</p>
                                    <p className="text-sm text-gray-700">meet.google.com/abc-defg-hij</p>
                                    <button className="text-blue-600 text-sm font-medium hover:underline mt-1">Copiar informações</button>
                                </div>
                                <div className="h-[1px] bg-gray-100"></div>
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">Anexos</p>
                                    <p className="text-sm text-gray-400 italic">Nenhum anexo no evento da agenda.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* BOTTOM CONTROL BAR */}
        <div className="h-20 bg-[#202124] flex items-center justify-between px-6 pb-4 shrink-0 relative z-30">
            <div className="w-1/4 text-white text-base font-medium flex items-center gap-4">
                <span>{time.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                <div className="h-4 w-[1px] bg-white/20"></div>
                <span className="text-sm text-white/70 truncate hidden md:block">abc-defg-hij</span>
            </div>
            
            <div className="flex items-center gap-3">
                <button onClick={() => setMicOn(!micOn)} className={`p-3.5 rounded-full transition-all duration-200 ${micOn ? 'bg-[#3C4043] hover:bg-[#4d5155] text-white ring-1 ring-white/20' : 'bg-[#EA4335] hover:bg-[#D93025] text-white shadow-lg shadow-red-900/20 border-none'}`} title="Microfone (Ctrl+D)">
                    {micOn ? <Mic size={20}/> : <MicOff size={20}/>}
                </button>
                <button onClick={() => setCamOn(!camOn)} className={`p-3.5 rounded-full transition-all duration-200 ${camOn ? 'bg-[#3C4043] hover:bg-[#4d5155] text-white ring-1 ring-white/20' : 'bg-[#EA4335] hover:bg-[#D93025] text-white shadow-lg shadow-red-900/20 border-none'}`} title="Câmera (Ctrl+E)">
                    {camOn ? <Video size={20}/> : <VideoOff size={20}/>}
                </button>
                <button onClick={() => setHandRaised(!handRaised)} className={`p-3.5 rounded-full transition-all duration-200 ${handRaised ? 'bg-[#ADCCF9] text