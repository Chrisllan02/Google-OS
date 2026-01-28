
import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, Mic, MicOff, VideoOff, Hand, MonitorUp, MoreVertical, PhoneOff, 
  MessageSquare, Users, X, Send, Smile, Presentation, Layout, Info, Clock, ShieldCheck,
  Settings, Sparkles, Volume2, Keyboard, Link as LinkIcon, Calendar as CalendarIcon, Plus, ChevronLeft,
  Subtitles, Grip, Maximize, PenTool, AlertCircle, Pin, PinOff, MoreHorizontal, LayoutGrid, Check, Copy
} from 'lucide-react';
import { GoogleIcons } from '../GoogleIcons';
import Peer from 'peerjs';

interface MeetAppProps {
  onClose: () => void;
  data: any;
}

// Interface para Participante Remoto
interface RemoteParticipant {
    id: string;
    stream: MediaStream;
    name?: string;
    mic: boolean;
    cam: boolean;
}

const RemoteVideo: React.FC<{ peer: RemoteParticipant }> = ({ peer }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    useEffect(() => {
        if (videoRef.current) videoRef.current.srcObject = peer.stream;
    }, [peer.stream]);
    
    return (
        <div className="bg-[#3C4043] rounded-xl relative overflow-hidden flex items-center justify-center group border-2 border-transparent">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <span className="absolute bottom-3 left-3 text-white text-xs font-medium shadow-black drop-shadow-md bg-black/40 px-2 py-1 rounded backdrop-blur-sm">Convidado</span>
        </div>
    );
};

export default function MeetApp({ onClose, data }: MeetAppProps) {
  // Navigation State
  const [view, setView] = useState<'home' | 'lobby' | 'call'>('home');

  // Home State
  const [meetingInput, setMeetingInput] = useState('');
  const [showNewMeetingMenu, setShowNewMeetingMenu] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Connection State
  const [myPeerId, setMyPeerId] = useState<string>('');
  const [meetingId, setMeetingId] = useState<string>('');
  const [isHost, setIsHost] = useState(false);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  
  // Call State
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [sidePanel, setSidePanel] = useState<'none' | 'chat' | 'people' | 'info' | 'activities'>('none');
  const [chatMessage, setChatMessage] = useState('');
  const [showReactionMenu, setShowReactionMenu] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<{id: number, emoji: string, left: number}[]>([]);
  const [volumeLevel, setVolumeLevel] = useState(0); 
  const [backgroundEffect, setBackgroundEffect] = useState<'none' | 'blur'>('none');
  
  const [messages, setMessages] = useState<any[]>([]);

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStream = useRef<MediaStream | null>(null);
  const peerRef = useRef<Peer | null>(null);
  
  // Audio Refs
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const dataArray = useRef<Uint8Array | null>(null);
  const animationRef = useRef<number | null>(null);
  
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // --- PEER JS INITIALIZATION ---
  useEffect(() => {
      // Create Peer with random ID
      const peer = new Peer();
      peerRef.current = peer;

      peer.on('open', (id) => {
          console.log('My Peer ID:', id);
          setMyPeerId(id);
      });

      peer.on('call', (call) => {
          // Answer incoming call
          if (localStream.current) {
              call.answer(localStream.current);
              call.on('stream', (remoteStream) => {
                  handleRemoteStream(call.peer, remoteStream);
              });
          }
      });
      
      peer.on('connection', (conn) => {
          conn.on('data', (data: any) => {
              handleIncomingData(data);
          });
      });

      return () => {
          peer.destroy();
      };
  }, []);

  const handleRemoteStream = (peerId: string, stream: MediaStream) => {
      setRemoteParticipants(prev => {
          if (prev.find(p => p.id === peerId)) return prev;
          return [...prev, { id: peerId, stream, mic: true, cam: true }];
      });
  };

  const handleIncomingData = (data: any) => {
      if (data.type === 'chat') {
          setMessages(prev => [...prev, { sender: 'Convidado', text: data.message, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }]);
      } else if (data.type === 'emoji') {
          triggerReaction(data.emoji, true);
      }
  };

  const connectToPeer = (remoteId: string) => {
      if (!peerRef.current || !localStream.current) return;
      
      console.log('Connecting to:', remoteId);
      const call = peerRef.current.call(remoteId, localStream.current);
      
      call.on('stream', (remoteStream) => {
          handleRemoteStream(remoteId, remoteStream);
      });

      const conn = peerRef.current.connect(remoteId);
      conn.on('open', () => {
          // Connection established
      });
  };

  // --- AUDIO VISUALIZER ---
  const setupAudioAnalysis = (stream: MediaStream) => {
      if (!audioContext.current) {
          audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const source = audioContext.current.createMediaStreamSource(stream);
      analyser.current = audioContext.current.createAnalyser();
      analyser.current.fftSize = 64; 
      source.connect(analyser.current);
      const bufferLength = analyser.current.frequencyBinCount;
      dataArray.current = new Uint8Array(bufferLength);
      
      const updateVolume = () => {
          if (analyser.current && dataArray.current) {
              analyser.current.getByteFrequencyData(dataArray.current);
              let sum = 0;
              for(let i = 0; i < bufferLength; i++) sum += dataArray.current[i];
              const average = sum / bufferLength;
              setVolumeLevel(average); 
          }
          animationRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
  };

  const cleanupAudioAnalysis = () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioContext.current && audioContext.current.state !== 'closed') {
          audioContext.current.close();
          audioContext.current = null;
      }
  };

  // --- MEDIA HANDLERS ---
  const startCamera = async () => {
      try {
          if (localStream.current) localStream.current.getTracks().forEach(track => track.stop());
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          localStream.current = stream;
          if (localVideoRef.current) localVideoRef.current.srcObject = stream;
          setupAudioAnalysis(stream);
          setCamOn(true);
          setMicOn(true);
      } catch (err) {
          console.error("Error accessing media", err);
          setCamOn(false);
      }
  };

  const stopCamera = () => {
      if (localStream.current) {
          localStream.current.getVideoTracks().forEach(track => track.enabled = false);
          setCamOn(false);
      }
  };

  const resumeCamera = () => {
      if (localStream.current) {
          localStream.current.getVideoTracks().forEach(track => track.enabled = true);
          setCamOn(true);
      } else {
          startCamera();
      }
  };

  const toggleMic = () => {
      if (localStream.current) {
          const enabled = !micOn;
          localStream.current.getAudioTracks().forEach(track => track.enabled = enabled);
          setMicOn(enabled);
          if (!enabled) setVolumeLevel(0);
      }
  };

  // --- EFFECTS ---
  useEffect(() => {
      if (view === 'lobby' || view === 'call') {
          startCamera();
      } else {
          if (localStream.current) localStream.current.getTracks().forEach(track => track.stop());
          localStream.current = null;
          cleanupAudioAnalysis();
      }
      return () => {
          if (localStream.current) localStream.current.getTracks().forEach(track => track.stop());
          cleanupAudioAnalysis();
      };
  }, [view]);

  useEffect(() => {
      if ((view === 'lobby' || view === 'call') && localVideoRef.current && localStream.current) {
          localVideoRef.current.srcObject = localStream.current;
      }
  }, [view]);

  // --- ACTIONS ---
  const createMeeting = () => {
      setMeetingId(myPeerId);
      setIsHost(true);
      setView('lobby');
      setShowNewMeetingMenu(false);
  };

  const joinMeeting = () => {
      if (meetingInput.trim()) {
          setMeetingId(meetingInput.trim());
          setIsHost(false);
          setView('lobby');
      }
  };

  const enterCall = () => {
      if (!isHost && meetingId) {
          connectToPeer(meetingId);
      }
      setView('call');
  };

  const handleSendMessage = () => {
      if (!chatMessage.trim()) return;
      const now = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      setMessages([...messages, { sender: 'Eu', text: chatMessage, time: now }]);
      setChatMessage('');
  };

  const triggerReaction = (emoji: string, isRemote = false) => {
      const id = Date.now();
      const left = isRemote ? 80 : 20; 
      setFloatingEmojis(prev => [...prev, { id, emoji, left }]);
      setShowReactionMenu(false);
      setTimeout(() => setFloatingEmojis(prev => prev.filter(e => e.id !== id)), 2000);
  };

  const copyMeetingLink = () => {
      navigator.clipboard.writeText(myPeerId);
      alert("ID copiado! Compartilhe com quem quiser chamar.");
  };

  const toggleSidePanel = (panel: 'chat' | 'people' | 'info' | 'activities') => {
      setSidePanel(sidePanel === panel ? 'none' : panel);
  };

  // --- HOME SCREEN ---
  if (view === 'home') {
      return (
        <div className="flex flex-col h-full bg-[#202124] text-white font-sans relative overflow-hidden">
            {/* Header */}
            <div className="h-16 px-6 flex items-center justify-between z-20">
                <div className="flex items-center gap-2">
                    <div className="p-1"><GoogleIcons.MeetGlass className="w-8 h-8"/></div>
                    <span className="text-[22px] text-white/90 font-medium tracking-tight">Google Meet</span>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right hidden md:block">
                        <div className="text-lg text-white/90">{currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                        <div className="text-xs text-white/60">{currentTime.toLocaleDateString(undefined, {weekday: 'short', day: 'numeric', month: 'short'})}</div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="p-2 hover:bg-white/10 rounded-full text-white/70"><Settings size={24}/></button>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white/70"><X size={24}/></button>
                        <img src={data?.user?.avatar} className="w-8 h-8 rounded-full border border-white/20" alt="Avatar"/>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row items-center justify-center p-8 gap-12 overflow-y-auto">
                <div className="flex-1 max-w-lg flex flex-col gap-8 md:pr-12">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-normal mb-6 leading-tight">Videochamadas premium. Agora grátis para todos.</h1>
                        <p className="text-lg text-white/60 font-light leading-relaxed mb-8">
                            Nós redesenhamos o Google Meet para ser um serviço de reuniões de vídeo seguro.
                        </p>
                    
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="relative" ref={menuRef}>
                                <button 
                                    onClick={() => setShowNewMeetingMenu(!showNewMeetingMenu)}
                                    className="flex items-center gap-2 bg-[#8AB4F8] hover:bg-[#AECBFA] text-[#202124] px-4 py-3 rounded-[4px] font-medium transition-colors shadow-sm"
                                >
                                    <Video size={20} />
                                    Nova reunião
                                </button>
                                
                                {showNewMeetingMenu && (
                                    <div className="absolute top-14 left-0 w-80 bg-[#303134] rounded-[4px] shadow-2xl py-2 z-50 animate-in fade-in zoom-in duration-200">
                                        <button onClick={createMeeting} className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-white/10 text-white/90 text-sm">
                                            <Plus size={20} className="text-white"/> Iniciar uma reunião instantânea
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-3 bg-transparent border border-white/30 rounded-[4px] px-3 py-3 focus-within:border-[#8AB4F8] focus-within:ring-1 focus-within:ring-[#8AB4F8] transition-all flex-1 min-w-[240px]">
                                <Keyboard size={20} className="text-white/60" />
                                <input 
                                    type="text" 
                                    placeholder="Digite um código ou link" 
                                    className="bg-transparent border-none outline-none text-white placeholder:text-white/60 w-full"
                                    value={meetingInput}
                                    onChange={(e) => setMeetingInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && joinMeeting()}
                                />
                            </div>
                            {meetingInput && (
                                <button onClick={joinMeeting} className="text-[#8AB4F8] font-medium text-sm hover:underline">Participar</button>
                            )}
                        </div>
                    </div>
                    
                    <div className="h-[1px] bg-white/10 w-full"></div>
                    <div className="flex gap-6 text-sm text-white/40">
                       <span className="text-green-400 text-xs">P2P Real Habilitado (PeerJS)</span>
                    </div>
                </div>

                <div className="flex-1 max-w-md w-full h-[400px] flex flex-col items-center justify-center text-center">
                    <div className="w-64 h-64 relative flex items-center justify-center">
                        <div className="absolute w-48 h-48 bg-blue-500/10 rounded-full blur-3xl"></div>
                        <div className="grid grid-cols-2 gap-4 opacity-80">
                            <div className="w-20 h-20 bg-white/5 rounded-full"></div>
                            <div className="w-20 h-20 bg-white/10 rounded-2xl"></div>
                            <div className="w-20 h-20 bg-white/10 rounded-2xl"></div>
                            <div className="w-20 h-20 bg-white/5 rounded-full"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      );
  }

  // --- LOBBY SCREEN ---
  if (view === 'lobby') {
      return (
        <div className="flex flex-col h-full bg-[#202124] text-white font-sans items-center justify-center relative overflow-hidden">
            <div className="absolute top-6 left-6">
                <div className="flex items-center gap-2">
                    <GoogleIcons.MeetGlass className="w-6 h-6"/>
                    <span className="text-lg text-white/90 font-medium">Google Meet</span>
                </div>
            </div>
            
            <div className="flex flex-col md:flex-row gap-8 items-center max-w-6xl w-full px-8 animate-in fade-in zoom-in duration-500">
                <div className="flex-1 w-full max-w-2xl relative group">
                    <div className="aspect-video bg-[#3C4043] rounded-lg overflow-hidden relative shadow-2xl border border-white/5 ring-1 ring-white/10 flex items-center justify-center">
                        <video 
                            ref={localVideoRef} 
                            autoPlay 
                            muted 
                            playsInline 
                            className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-300 ${camOn ? 'opacity-100' : 'opacity-0'}`} 
                        />
                        {!camOn && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 animate-in zoom-in">
                                <div className="text-white/30 text-sm font-medium">Câmera desligada</div>
                            </div>
                        )}
                        <div className="absolute top-4 right-4 bg-[#202124]/60 p-2 rounded-full backdrop-blur-md">
                             <div className="flex gap-1 h-4 items-end">
                                <div className="w-1 bg-blue-400 rounded-full transition-all duration-75" style={{ height: `${Math.min(100, Math.max(20, volumeLevel * 1.5))}%` }}></div>
                                <div className="w-1 bg-blue-400 rounded-full transition-all duration-75" style={{ height: `${Math.min(100, Math.max(15, volumeLevel * 1.2))}%` }}></div>
                                <div className="w-1 bg-blue-400 rounded-full transition-all duration-75" style={{ height: `${Math.min(100, Math.max(10, volumeLevel * 0.8))}%` }}></div>
                            </div>
                        </div>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4">
                            <button onClick={toggleMic} className={`p-3 rounded-full transition-all border ${micOn ? 'bg-[#3C4043] hover:bg-[#4d5155] border-transparent text-white' : 'bg-[#EA4335] hover:bg-[#D93025] border-transparent text-white'}`}>{micOn ? <Mic size={20}/> : <MicOff size={20}/>}</button>
                            <button onClick={camOn ? stopCamera : resumeCamera} className={`p-3 rounded-full transition-all border ${camOn ? 'bg-[#3C4043] hover:bg-[#4d5155] border-transparent text-white' : 'bg-[#EA4335] hover:bg-[#D93025] border-transparent text-white'}`}>{camOn ? <Video size={20}/> : <VideoOff size={20}/>}</button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 w-full max-w-sm flex flex-col items-center text-center space-y-8">
                    <div>
                        <h1 className="text-3xl font-normal mb-2 text-[#E3E3E3]">Pronto para participar?</h1>
                        <p className="text-white/60 text-sm mb-4">{isHost ? "Você criou esta reunião." : "Você está prestes a entrar."}</p>
                        
                        {isHost && (
                            <div className="bg-[#303134] p-3 rounded-lg flex items-center gap-2 mb-4 border border-white/10 relative group">
                                <span className="text-sm font-mono text-blue-300">{myPeerId}</span>
                                <button onClick={copyMeetingLink} className="p-1.5 hover:bg-white/10 rounded text-white/70" title="Copiar ID"><Copy size={14}/></button>
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">Compartilhe este ID</div>
                            </div>
                        )}
                        {!isHost && (
                             <div className="text-sm text-white/60 bg-white/5 p-2 rounded mb-4">Entrando em: {meetingId}</div>
                        )}
                    </div>

                    <div className="flex flex-col gap-3 w-full items-center">
                        <button onClick={enterCall} className="px-8 py-3 bg-[#8AB4F8] hover:bg-[#AECBFA] text-[#202124] rounded-full font-medium text-sm transition-all shadow-lg">
                            Participar agora
                        </button>
                    </div>
                </div>
            </div>
        </div>
      );
  }

  // --- ACTIVE CALL SCREEN ---
  const gridClass = remoteParticipants.length === 0 
    ? 'grid-cols-1' 
    : remoteParticipants.length === 1 
        ? 'grid-cols-2' 
        : 'grid-cols-2 md:grid-cols-3';

  // Floating Emoji Style Injection
  const floatStyle = `
    @keyframes floatUp {
        0% { transform: translateY(0) scale(0.5); opacity: 0; }
        10% { opacity: 1; transform: translateY(-20px) scale(1); }
        100% { transform: translateY(-300px) scale(1.5); opacity: 0; }
    }
  `;

  return (
    <div className="flex flex-col h-full bg-[#202124] relative overflow-hidden text-white font-sans animate-in fade-in duration-500">
        <style>{floatStyle}</style>
        
        <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
            {floatingEmojis.map(emoji => (
                <div key={emoji.id} className="absolute bottom-24 text-4xl" style={{ left: `${emoji.left}%`, animation: 'floatUp 2s ease-out forwards' }}>
                    {emoji.emoji}
                </div>
            ))}
        </div>

        <div className="flex-1 flex overflow-hidden p-4 gap-4 pb-24 relative">
            <div className={`flex-1 flex flex-col transition-all duration-300 relative ${sidePanel !== 'none' ? 'mr-0' : ''}`}>
                <div className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-start pointer-events-none opacity-0 hover:opacity-100 transition-opacity duration-300">
                    <div className="pointer-events-auto bg-[#202124]/80 backdrop-blur-md px-4 py-2 rounded-lg shadow-lg border border-white/5 flex items-center gap-3">
                        <span className="font-medium text-sm text-white/90">ID: {meetingId}</span>
                        <button onClick={copyMeetingLink} className="p-1 hover:bg-white/10 rounded"><Copy size={12}/></button>
                    </div>
                </div>

                <div className={`grid gap-4 h-full ${gridClass} content-center`}>
                    {/* Self */}
                    <div className={`bg-[#3C4043] rounded-xl relative overflow-hidden flex items-center justify-center group border-2 ${micOn ? 'border-transparent' : 'border-red-500/30'}`}>
                        <video 
                            ref={localVideoRef} 
                            autoPlay 
                            muted 
                            playsInline 
                            className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-300 ${camOn ? 'opacity-100' : 'opacity-0'} ${backgroundEffect === 'blur' ? 'blur-sm scale-110' : ''}`} 
                        />
                        {!camOn && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center text-3xl text-white font-bold shadow-lg">V</div>
                            </div>
                        )}
                        <span className="absolute bottom-3 left-3 text-white text-xs font-medium shadow-black drop-shadow-md bg-black/40 px-2 py-1 rounded backdrop-blur-sm">Você</span>
                        
                        {micOn && (
                            <div className="absolute top-3 right-3 flex gap-0.5 h-4 items-end bg-[#202124]/60 p-1.5 rounded-full">
                                <div className="w-1 bg-blue-400 rounded-full transition-all duration-75" style={{ height: `${Math.min(100, Math.max(20, volumeLevel * 1.5))}%` }}></div>
                                <div className="w-1 bg-blue-400 rounded-full transition-all duration-75" style={{ height: `${Math.min(100, Math.max(15, volumeLevel * 1.2))}%` }}></div>
                                <div className="w-1 bg-blue-400 rounded-full transition-all duration-75" style={{ height: `${Math.min(100, Math.max(10, volumeLevel * 0.8))}%` }}></div>
                            </div>
                        )}
                    </div>

                    {/* Remote Peers */}
                    {remoteParticipants.map(peer => (
                        <RemoteVideo key={peer.id} peer={peer} />
                    ))}
                    
                    {remoteParticipants.length === 0 && (
                        <div className="flex items-center justify-center text-white/30 text-sm border-2 border-dashed border-white/10 rounded-xl">
                            Aguardando participantes...
                        </div>
                    )}
                </div>
            </div>

            {/* SIDE PANEL (Chat) */}
            {sidePanel === 'chat' && (
                <div className="w-[360px] bg-white rounded-2xl flex flex-col shadow-2xl animate-in slide-in-from-right-10 duration-300 overflow-hidden shrink-0 h-full">
                    <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100">
                        <span className="text-gray-800 font-medium text-lg">Mensagens</span>
                        <button onClick={() => setSidePanel('none')} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X size={20}/></button>
                    </div>
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
                                <div className={`px-4 py-2.5 rounded-2xl text-sm max-w-[85%] shadow-sm ${msg.sender === 'Eu' ? 'bg-[#E8F0FE] text-[#174EA6] rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'}`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-4 bg-white border-t border-gray-100 relative">
                        <input 
                            type="text" 
                            placeholder="Enviar mensagem..." 
                            className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-white border border-transparent focus:border-blue-500 outline-none rounded-full pl-5 pr-12 py-3 text-sm text-gray-700 transition-all"
                            value={chatMessage}
                            onChange={(e) => setChatMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        />
                        <button onClick={handleSendMessage} className="absolute right-6 top-5 p-1 text-blue-600"><Send size={18}/></button>
                    </div>
                </div>
            )}

            {sidePanel === 'people' && (
                <div className="w-[360px] bg-white rounded-2xl flex flex-col shadow-2xl animate-in slide-in-from-right-10 duration-300 overflow-hidden shrink-0 h-full">
                    <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100">
                        <span className="text-gray-800 font-medium text-lg">Pessoas</span>
                        <button onClick={() => setSidePanel('none')} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X size={20}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                        <div className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider flex justify-between items-center">
                            <span>Na chamada ({remoteParticipants.length + 1})</span>
                            <button className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors">Mutar todos</button>
                        </div>
                        {/* Self */}
                        <div className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors group cursor-pointer">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white">V</div>
                                <div>
                                    <p className="text-sm font-medium text-gray-800 flex items-center gap-1">Você {isHost && <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 rounded-full ml-1">Org</span>}</p>
                                </div>
                            </div>
                            <div className="flex gap-1 text-gray-400">
                                {!micOn ? <MicOff size={16}/> : <div className="flex gap-0.5 h-3 items-end w-3 justify-center"><div className="w-0.5 bg-green-500 h-2"></div><div className="w-0.5 bg-green-500 h-3"></div><div className="w-0.5 bg-green-500 h-1.5"></div></div>}
                            </div>
                        </div>
                        {/* Remotes */}
                        {remoteParticipants.map((p, i) => (
                            <div key={i} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors group cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center text-sm font-bold text-white">P</div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-800">Participante {i+1}</p>
                                    </div>
                                </div>
                                <div className="flex gap-1 text-gray-400">
                                    <button className="p-1 hover:bg-gray-200 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-gray-600"><MoreVertical size={16}/></button>
                                </div>
                            </div>
                        ))}
                        <button className="w-full mt-4 py-2.5 text-blue-600 text-sm font-medium hover:bg-blue-50 rounded-full transition-colors flex items-center justify-center gap-2 border border-blue-100">
                            <Users size={18}/> Adicionar pessoas
                        </button>
                    </div>
                </div>
            )}

            {sidePanel === 'info' && (
                <div className="w-[360px] bg-white rounded-2xl flex flex-col shadow-2xl animate-in slide-in-from-right-10 duration-300 overflow-hidden shrink-0 h-full">
                    <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100">
                        <span className="text-gray-800 font-medium text-lg">Detalhes</span>
                        <button onClick={() => setSidePanel('none')} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X size={20}/></button>
                    </div>
                    <div className="flex-1 p-6">
                        <h3 className="text-lg font-medium text-gray-800 mb-1">Nova Reunião</h3>
                        <p className="text-sm text-gray-500 mb-6">{currentTime.toLocaleDateString()} | {currentTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                        
                        <div className="space-y-4">
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase mb-2">Informações de participação</p>
                                <p className="text-sm text-gray-700 font-mono bg-gray-100 p-2 rounded select-all">{meetingId}</p>
                                <button onClick={copyMeetingLink} className="text-blue-600 text-sm font-medium hover:underline mt-2 flex items-center gap-1"><Copy size={14}/> Copiar informações</button>
                            </div>
                            <div className="h-[1px] bg-gray-100"></div>
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase mb-2">Anexos</p>
                                <p className="text-sm text-gray-400 italic">Nenhum anexo no evento da agenda.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* BOTTOM CONTROL BAR */}
        <div className="h-20 bg-[#202124] flex items-center justify-between px-6 pb-4 shrink-0 fixed bottom-0 left-0 right-0 z-50">
            <div className="w-1/4 text-white text-base font-medium flex items-center gap-4">
                <span className="hidden md:block">{currentTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                <div className="h-4 w-[1px] bg-white/20 hidden md:block"></div>
                <span className="text-sm text-white/90 truncate font-medium">{meetingId || 'Nova Reunião'}</span>
            </div>
            
            <div className="flex items-center gap-2 md:gap-3">
                <button onClick={toggleMic} className={`w-10 h-10 md:w-12 md:h-12 rounded-full transition-all flex items-center justify-center ${micOn ? 'bg-[#3C4043] hover:bg-[#4d5155] text-white' : 'bg-[#EA4335] hover:bg-[#D93025] text-white shadow-lg'}`}>
                    {micOn ? <Mic size={20}/> : <MicOff size={20}/>}
                </button>
                <button onClick={camOn ? stopCamera : resumeCamera} className={`w-10 h-10 md:w-12 md:h-12 rounded-full transition-all flex items-center justify-center ${camOn ? 'bg-[#3C4043] hover:bg-[#4d5155] text-white' : 'bg-[#EA4335] hover:bg-[#D93025] text-white shadow-lg'}`}>
                    {camOn ? <Video size={20}/> : <VideoOff size={20}/>}
                </button>
                
                {/* Reactions */}
                <div className="relative">
                    <button onClick={() => setShowReactionMenu(!showReactionMenu)} className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#3C4043] hover:bg-[#4d5155] text-white transition-all hidden md:flex items-center justify-center">
                        <Smile size={20}/>
                    </button>
                    {showReactionMenu && (
                        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-[#303134] rounded-full p-2 flex gap-2 shadow-2xl animate-in slide-in-from-bottom-2 fade-in border border-white/10 w-max">
                            {['💖', '👍', '🎉', '👏', '😂', '😮'].map(emoji => (
                                <button key={emoji} onClick={() => triggerReaction(emoji)} className="text-2xl hover:scale-125 transition-transform p-1 hover:bg-white/10 rounded-full">{emoji}</button>
                            ))}
                        </div>
                    )}
                </div>

                <button onClick={() => { stopCamera(); setView('home'); peerRef.current?.destroy(); }} className="px-6 h-10 md:h-12 bg-[#EA4335] hover:bg-[#D93025] text-white rounded-full flex items-center gap-2 ml-2 shadow-lg shadow-red-900/30 w-16 md:w-20 justify-center">
                    <PhoneOff size={22} fill="currentColor"/> 
                </button>
            </div>

            <div className="w-1/4 flex justify-end gap-2 md:gap-3">
                <button onClick={() => toggleSidePanel('people')} className={`p-3 rounded-full transition-all ${sidePanel === 'people' ? 'bg-[#8AB4F8] text-[#202124]' : 'text-white hover:bg-white/10'}`}>
                    <div className="relative">
                        <Users size={20}/>
                        <span className="absolute -top-1 -right-1 bg-[#3C4043] text-white text-[10px] px-1 rounded-full border border-white/20 font-bold">{remoteParticipants.length + 1}</span>
                    </div>
                </button>
                <button onClick={() => toggleSidePanel('chat')} className={`p-3 rounded-full transition-all ${sidePanel === 'chat' ? 'bg-[#8AB4F8] text-[#202124]' : 'text-white hover:bg-white/10'}`}>
                    <MessageSquare size={20}/>
                </button>
                <button onClick={() => toggleSidePanel('info')} className={`p-3 rounded-full transition-all ${sidePanel === 'info' ? 'bg-[#8AB4F8] text-[#202124]' : 'text-white hover:bg-white/10'}`}>
                    <Info size={20}/>
                </button>
            </div>
        </div>
    </div>
  );
}
