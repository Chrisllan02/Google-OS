
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Video, Mic, MicOff, VideoOff, Hand, MonitorUp, MoreVertical, PhoneOff, 
  MessageSquare, Users, X, Send, Smile, Presentation, Layout, Info, Clock, ShieldCheck,
  Settings, Sparkles, Volume2, Keyboard, Link as LinkIcon, Calendar as CalendarIcon, Plus, ChevronLeft,
  Subtitles, Grip, Maximize, PenTool, AlertCircle, Pin, PinOff, MoreHorizontal, LayoutGrid, Check, Copy
} from 'lucide-react';
import { GoogleIcons } from '../GoogleIcons';
import { bridge } from '../../utils/GASBridge';
import Peer, { MediaConnection, DataConnection } from 'peerjs';

interface MeetAppProps {
  onClose: () => void;
  data: any;
  showToast?: (msg: string) => void;
}

// Interface para Participante Remoto
interface RemoteParticipant {
    id: string;
    stream?: MediaStream;
    name?: string;
    mic: boolean;
    cam: boolean;
    handRaised: boolean;
    isScreenSharing?: boolean;
}

interface ChatMessage {
    id: string;
    sender: string;
    text: string;
    time: string;
    isSelf: boolean;
}

// Componente de Vídeo Remoto Isolado para Performance
const RemoteVideo: React.FC<{ peer: RemoteParticipant }> = ({ peer }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    
    useEffect(() => {
        if (videoRef.current && peer.stream) {
            videoRef.current.srcObject = peer.stream;
        }
    }, [peer.stream]);
    
    return (
        <div className="bg-[#202124] rounded-xl relative overflow-hidden flex items-center justify-center group border-2 border-transparent w-full h-full">
            {peer.stream && peer.cam ? (
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            ) : (
                <div className="w-24 h-24 rounded-full bg-purple-600 flex items-center justify-center text-3xl text-white font-bold shadow-lg select-none">
                    {peer.name ? peer.name[0].toUpperCase() : 'C'}
                </div>
            )}
            
            <div className="absolute bottom-3 left-3 flex items-center gap-2">
                <span className="text-white text-xs font-medium shadow-black drop-shadow-md bg-black/40 px-2 py-1 rounded backdrop-blur-sm truncate max-w-[150px]">
                    {peer.name || 'Convidado'}
                </span>
            </div>

            {/* Indicadores de Status */}
            <div className="absolute top-3 right-3 flex flex-col gap-2">
                {!peer.mic && <div className="bg-black/60 p-1.5 rounded-full backdrop-blur-sm"><MicOff size={14} className="text-red-500"/></div>}
            </div>
            
            {peer.handRaised && (
                <div className="absolute top-3 left-3 bg-[#FBBC04] p-2 rounded-full shadow-lg animate-bounce text-black z-10">
                    <Hand size={16}/>
                </div>
            )}
        </div>
    );
};

export default function MeetApp({ onClose, data, showToast }: MeetAppProps) {
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
  const [sidePanel, setSidePanel] = useState<'none' | 'chat' | 'people' | 'info' | 'activities'>('none');
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showReactionMenu, setShowReactionMenu] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<{id: number, emoji: string, left: number}[]>([]);
  const [volumeLevel, setVolumeLevel] = useState(0); 
  
  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStream = useRef<MediaStream | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<Map<string, { call?: MediaConnection, conn?: DataConnection }>>(new Map());
  
  // Audio Refs
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const dataArray = useRef<Uint8Array | null>(null);
  const animationRef = useRef<number | null>(null);
  
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const toast = (msg: string) => showToast ? showToast(msg) : console.log(msg);

  // --- 1. PEER JS SETUP ---
  useEffect(() => {
      const peer = new Peer();
      peerRef.current = peer;

      peer.on('open', (id) => {
          console.log('My Peer ID:', id);
          setMyPeerId(id);
      });

      // Receber chamadas de mídia
      peer.on('call', (call) => {
          if (localStream.current) {
              call.answer(localStream.current);
              handleMediaCall(call);
          }
      });
      
      // Receber conexões de dados (Chat/Estado)
      peer.on('connection', (conn) => {
          handleDataConnection(conn);
      });

      peer.on('error', (err) => {
          console.error("Peer Error:", err);
          toast("Erro de conexão P2P");
      });

      return () => {
          peer.destroy();
          connectionsRef.current.clear();
      };
  }, []);

  // --- 2. HANDLERS P2P ---

  const handleMediaCall = (call: MediaConnection) => {
      // Salvar referencia
      const existing = connectionsRef.current.get(call.peer) || {};
      connectionsRef.current.set(call.peer, { ...existing, call });

      call.on('stream', (remoteStream) => {
          setRemoteParticipants(prev => {
              if (prev.find(p => p.id === call.peer)) return prev;
              return [...prev, { 
                  id: call.peer, 
                  stream: remoteStream, 
                  mic: true, 
                  cam: true, 
                  handRaised: false 
              }];
          });
      });

      call.on('close', () => {
          setRemoteParticipants(prev => prev.filter(p => p.id !== call.peer));
      });
  };

  const handleDataConnection = (conn: DataConnection) => {
      const existing = connectionsRef.current.get(conn.peer) || {};
      connectionsRef.current.set(conn.peer, { ...existing, conn });

      conn.on('open', () => {
          // Enviar nosso estado inicial
          conn.send({ type: 'status', mic: micOn, cam: camOn, handRaised, name: data.user.name });
      });

      conn.on('data', (data: any) => {
          handleIncomingData(conn.peer, data);
      });

      conn.on('close', () => {
          setRemoteParticipants(prev => prev.filter(p => p.id !== conn.peer));
      });
  };

  const handleIncomingData = (peerId: string, data: any) => {
      switch(data.type) {
          case 'chat':
              setMessages(prev => [...prev, { 
                  id: Date.now().toString() + Math.random(),
                  sender: data.senderName || 'Convidado', 
                  text: data.message, 
                  time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                  isSelf: false
              }]);
              if (sidePanel !== 'chat') toast(`Nova mensagem de ${data.senderName}`);
              break;
          case 'emoji':
              triggerReaction(data.emoji, true);
              break;
          case 'status':
              setRemoteParticipants(prev => prev.map(p => {
                  if (p.id === peerId) {
                      return { 
                          ...p, 
                          mic: data.mic !== undefined ? data.mic : p.mic,
                          cam: data.cam !== undefined ? data.cam : p.cam,
                          handRaised: data.handRaised !== undefined ? data.handRaised : p.handRaised,
                          name: data.name || p.name
                      };
                  }
                  return p;
              }));
              break;
      }
  };

  const broadcastData = (payload: any) => {
      connectionsRef.current.forEach((connObj) => {
          if (connObj.conn && connObj.conn.open) {
              connObj.conn.send(payload);
          }
      });
  };

  const connectToPeer = (remoteId: string) => {
      if (!peerRef.current || !localStream.current) return;
      
      // 1. Media Call
      const call = peerRef.current.call(remoteId, localStream.current);
      handleMediaCall(call);

      // 2. Data Connection
      const conn = peerRef.current.connect(remoteId);
      handleDataConnection(conn);
  };

  // --- 3. MEDIA & AUDIO ---
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
          toast("Erro ao acessar câmera/microfone");
          setCamOn(false);
      }
  };

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

  const toggleMic = () => {
      if (localStream.current) {
          const enabled = !micOn;
          localStream.current.getAudioTracks().forEach(track => track.enabled = enabled);
          setMicOn(enabled);
          if (!enabled) setVolumeLevel(0);
          broadcastData({ type: 'status', mic: enabled });
      }
  };

  const toggleCam = () => {
      if (localStream.current) {
          const enabled = !camOn;
          localStream.current.getVideoTracks().forEach(track => track.enabled = enabled);
          setCamOn(enabled);
          broadcastData({ type: 'status', cam: enabled });
      } else {
          startCamera();
      }
  };

  const toggleHand = () => {
      const newState = !handRaised;
      setHandRaised(newState);
      broadcastData({ type: 'status', handRaised: newState });
      if (newState) toast("Você levantou a mão");
  };

  // --- 4. MEETING LOGIC ---
  const createMeeting = async () => {
      const code = myPeerId; // Use PeerID as room code for P2P MVP
      setMeetingId(code);
      setIsHost(true);
      setView('lobby');
      setShowNewMeetingMenu(false);
      await bridge.registerMeeting(code, myPeerId); // Optional: Save to backend map
  };

  const joinMeeting = async () => {
      if (!meetingInput.trim()) return;
      // In real P2P mesh, we'd need a signaling server to get ALL peers.
      // Here we assume Star Topology (connect to Host) for MVP simplicity.
      const hostId = await bridge.getMeetingPeer(meetingInput.trim()) || meetingInput.trim();
      setMeetingId(hostId);
      setIsHost(false);
      setView('lobby');
  };

  const enterCall = () => {
      if (!isHost && meetingId) {
          connectToPeer(meetingId);
      }
      setView('call');
  };

  const leaveCall = () => {
      if (localStream.current) localStream.current.getTracks().forEach(track => track.stop());
      connectionsRef.current.forEach(c => { c.call?.close(); c.conn?.close(); });
      connectionsRef.current.clear();
      setRemoteParticipants([]);
      setView('home');
  };

  const handleSendMessage = () => {
      if (!chatMessage.trim()) return;
      const text = chatMessage.trim();
      const msg: ChatMessage = {
          id: Date.now().toString(),
          sender: 'Você',
          text: text,
          time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          isSelf: true
      };
      setMessages(prev => [...prev, msg]);
      setChatMessage('');
      broadcastData({ type: 'chat', message: text, senderName: data.user.name });
  };

  const triggerReaction = (emoji: string, isRemote = false) => {
      const id = Date.now();
      const left = isRemote ? Math.random() * 80 + 10 : 15; 
      setFloatingEmojis(prev => [...prev, { id, emoji, left }]);
      setShowReactionMenu(false);
      
      if (!isRemote) {
          broadcastData({ type: 'emoji', emoji });
      }
      
      setTimeout(() => setFloatingEmojis(prev => prev.filter(e => e.id !== id)), 2000);
  };

  const toggleSidePanel = (panel: 'chat' | 'people' | 'info' | 'activities') => {
      setSidePanel(sidePanel === panel ? 'none' : panel);
  };

  // --- EFFECTS ---
  useEffect(() => {
      if (view === 'lobby' || view === 'call') startCamera();
      const timer = setInterval(() => setCurrentTime(new Date()), 1000);
      return () => {
          clearInterval(timer);
          if (animationRef.current) cancelAnimationFrame(animationRef.current);
      };
  }, [view]);

  useEffect(() => {
      if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [messages, sidePanel]);

  // Floating Emoji Style
  const floatStyle = `
    @keyframes floatUp {
        0% { transform: translateY(0) scale(0.5); opacity: 0; }
        10% { opacity: 1; transform: translateY(-20px) scale(1); }
        100% { transform: translateY(-300px) scale(1.5); opacity: 0; }
    }
  `;

  // Grid Calculation
  const totalParticipants = remoteParticipants.length + 1; // +1 for self
  let gridClass = 'grid-cols-1';
  if (totalParticipants === 2) gridClass = 'grid-cols-2';
  if (totalParticipants >= 3) gridClass = 'grid-cols-2 md:grid-cols-3';
  if (totalParticipants >= 5) gridClass = 'grid-cols-3 md:grid-cols-4';

  // --- UI RENDER ---
  if (view === 'home') {
      return (
        <div className="flex flex-col h-full bg-[#202124] text-white font-sans relative overflow-hidden">
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
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white/70"><X size={24}/></button>
                </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row items-center justify-center p-8 gap-12 overflow-y-auto">
                <div className="flex-1 max-w-lg flex flex-col gap-8 md:pr-12">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-normal mb-6 leading-tight">Videochamadas premium. Agora grátis.</h1>
                        <p className="text-lg text-white/60 font-light leading-relaxed mb-8">
                            Conecte-se, colabore e celebre de qualquer lugar com o Google Meet.
                        </p>
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="relative" ref={menuRef}>
                                <button onClick={() => setShowNewMeetingMenu(!showNewMeetingMenu)} className="flex items-center gap-2 bg-[#8AB4F8] hover:bg-[#AECBFA] text-[#202124] px-4 py-3 rounded-[4px] font-medium transition-colors shadow-sm">
                                    <Video size={20} /> Nova reunião
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
                                <input type="text" placeholder="Digite um código ou link" className="bg-transparent border-none outline-none text-white placeholder:text-white/60 w-full" value={meetingInput} onChange={(e) => setMeetingInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && joinMeeting()} />
                            </div>
                            {meetingInput && <button onClick={joinMeeting} className="text-[#8AB4F8] font-medium text-sm hover:underline">Participar</button>}
                        </div>
                    </div>
                </div>
                <div className="flex-1 max-w-md w-full h-[300px] flex items-center justify-center">
                     {/* SVG Illustration Placeholder */}
                     <div className="w-64 h-64 bg-blue-500/5 rounded-full flex items-center justify-center border border-white/10">
                         <Video size={64} className="text-blue-400 opacity-50" />
                     </div>
                </div>
            </div>
        </div>
      );
  }

  // --- LOBBY ---
  if (view === 'lobby') {
      return (
        <div className="flex flex-col h-full bg-[#202124] text-white font-sans items-center justify-center relative overflow-hidden">
            <div className="absolute top-6 left-6 flex items-center gap-2"><GoogleIcons.MeetGlass className="w-6 h-6"/><span className="text-lg text-white/90 font-medium">Google Meet</span></div>
            <div className="flex flex-col md:flex-row gap-8 items-center max-w-6xl w-full px-8 animate-in fade-in zoom-in duration-300">
                <div className="flex-1 w-full max-w-2xl relative">
                    <div className="aspect-video bg-[#3C4043] rounded-lg overflow-hidden relative shadow-2xl border border-white/5 ring-1 ring-white/10 flex items-center justify-center">
                        <video ref={localVideoRef} autoPlay muted playsInline className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-300 ${camOn ? 'opacity-100' : 'opacity-0'}`} />
                        {!camOn && <div className="absolute inset-0 flex items-center justify-center text-white/30 text-sm font-medium">Câmera desligada</div>}
                        
                        {/* Audio Meter */}
                        <div className="absolute top-4 right-4 bg-[#202124]/60 p-2 rounded-full backdrop-blur-md">
                             <div className="flex gap-1 h-4 items-end">
                                <div className="w-1 bg-blue-400 rounded-full transition-all duration-75" style={{ height: `${Math.min(100, Math.max(20, volumeLevel * 1.5))}%` }}></div>
                                <div className="w-1 bg-blue-400 rounded-full transition-all duration-75" style={{ height: `${Math.min(100, Math.max(15, volumeLevel * 1.2))}%` }}></div>
                                <div className="w-1 bg-blue-400 rounded-full transition-all duration-75" style={{ height: `${Math.min(100, Math.max(10, volumeLevel * 0.8))}%` }}></div>
                            </div>
                        </div>

                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4">
                            <button onClick={toggleMic} className={`p-3 rounded-full transition-all border ${micOn ? 'bg-[#3C4043] hover:bg-[#4d5155] border-transparent text-white' : 'bg-[#EA4335] hover:bg-[#D93025] border-transparent text-white'}`}>{micOn ? <Mic size={20}/> : <MicOff size={20}/>}</button>
                            <button onClick={toggleCam} className={`p-3 rounded-full transition-all border ${camOn ? 'bg-[#3C4043] hover:bg-[#4d5155] border-transparent text-white' : 'bg-[#EA4335] hover:bg-[#D93025] border-transparent text-white'}`}>{camOn ? <Video size={20}/> : <VideoOff size={20}/>}</button>
                        </div>
                    </div>
                </div>
                <div className="flex-1 w-full max-w-sm flex flex-col items-center text-center space-y-6">
                    <h1 className="text-3xl font-normal text-[#E3E3E3]">Pronto para participar?</h1>
                    {isHost && <div className="bg-[#303134] p-3 rounded-lg flex items-center gap-2 border border-white/10 w-full justify-between"><span className="text-sm font-mono text-blue-300 truncate">{meetingId}</span><button onClick={() => navigator.clipboard.writeText(meetingId)} className="p-1.5 hover:bg-white/10 rounded text-white/70"><Copy size={14}/></button></div>}
                    {!isHost && <p className="text-white/60">Entrando na sala...</p>}
                    <button onClick={enterCall} className="px-8 py-3 bg-[#8AB4F8] hover:bg-[#AECBFA] text-[#202124] rounded-full font-medium text-sm transition-all shadow-lg w-full">Participar agora</button>
                </div>
            </div>
        </div>
      );
  }

  // --- CALL SCREEN ---
  return (
    <div className="flex flex-col h-full bg-[#202124] relative overflow-hidden text-white font-sans animate-in fade-in duration-500">
        <style>{floatStyle}</style>
        
        {/* Floating Emojis Overlay */}
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
            {floatingEmojis.map(e => (
                <div key={e.id} className="absolute bottom-24 text-4xl" style={{ left: `${e.left}%`, animation: 'floatUp 2s ease-out forwards' }}>{e.emoji}</div>
            ))}
        </div>

        <div className="flex-1 flex overflow-hidden p-3 gap-3 pb-20 relative">
            {/* Main Stage */}
            <div className={`flex-1 flex flex-col transition-all duration-300 relative ${sidePanel !== 'none' ? 'mr-0' : ''}`}>
                
                {/* Meeting ID Badge */}
                <div className="absolute top-0 left-0 p-2 z-20 pointer-events-none opacity-0 hover:opacity-100 transition-opacity duration-300">
                    <div className="pointer-events-auto bg-[#202124]/80 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-lg border border-white/5 flex items-center gap-2 text-xs font-mono">
                        {meetingId} <button onClick={() => navigator.clipboard.writeText(meetingId)} className="hover:text-blue-400"><Copy size={10}/></button>
                    </div>
                </div>

                <div className={`grid gap-3 h-full w-full ${gridClass} content-center`}>
                    {/* Self Video */}
                    <div className={`bg-[#3C4043] rounded-xl relative overflow-hidden flex items-center justify-center group border-2 w-full h-full ${micOn ? 'border-transparent' : 'border-red-500/30'}`}>
                        <video ref={localVideoRef} autoPlay muted playsInline className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-300 ${camOn ? 'opacity-100' : 'opacity-0'}`} />
                        {!camOn && <div className="absolute inset-0 flex items-center justify-center"><div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-2xl font-bold">V</div></div>}
                        <span className="absolute bottom-3 left-3 text-white text-xs font-medium shadow-black drop-shadow-md bg-black/40 px-2 py-1 rounded backdrop-blur-sm">Você</span>
                        {handRaised && <div className="absolute top-3 left-3 bg-[#FBBC04] p-1.5 rounded-full shadow-lg animate-bounce text-black"><Hand size={14}/></div>}
                    </div>

                    {/* Remote Videos */}
                    {remoteParticipants.map(peer => (
                        <div key={peer.id} className="w-full h-full">
                            <RemoteVideo peer={peer} />
                        </div>
                    ))}
                    
                    {remoteParticipants.length === 0 && (
                        <div className="flex flex-col items-center justify-center text-white/30 text-sm border-2 border-dashed border-white/10 rounded-xl h-full">
                            <p>Esperando outros...</p>
                            <p className="text-xs mt-1 select-all font-mono bg-black/20 px-2 py-1 rounded">{meetingId}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Side Panel */}
            {sidePanel === 'chat' && (
                <div className="w-[340px] bg-white rounded-2xl flex flex-col shadow-2xl animate-in slide-in-from-right-10 duration-300 overflow-hidden shrink-0 h-full">
                    <div className="h-14 flex items-center justify-between px-5 border-b border-gray-100 bg-white">
                        <span className="text-gray-800 font-medium">Mensagens</span>
                        <button onClick={() => setSidePanel('none')} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500"><X size={18}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50" ref={chatScrollRef}>
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex flex-col ${msg.isSelf ? 'items-end' : 'items-start'}`}>
                                <div className="flex items-baseline gap-2 mb-1 px-1">
                                    <span className="text-xs font-bold text-gray-700">{msg.sender}</span>
                                    <span className="text-[10px] text-gray-400">{msg.time}</span>
                                </div>
                                <div className={`px-3 py-2 rounded-xl text-sm max-w-[90%] shadow-sm ${msg.isSelf ? 'bg-[#E8F0FE] text-[#174EA6] rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'}`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-3 bg-white border-t border-gray-100 relative">
                        <input 
                            type="text" 
                            placeholder="Enviar mensagem..." 
                            className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-white border border-transparent focus:border-blue-500 outline-none rounded-full pl-4 pr-10 py-2.5 text-sm text-gray-700 transition-all"
                            value={chatMessage}
                            onChange={(e) => setChatMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        />
                        <button onClick={handleSendMessage} className="absolute right-5 top-4.5 text-blue-600"><Send size={16}/></button>
                    </div>
                </div>
            )}
        </div>

        {/* Bottom Controls */}
        <div className="h-20 bg-[#202124] flex items-center justify-between px-6 pb-4 shrink-0 fixed bottom-0 left-0 right-0 z-50">
            <div className="w-1/4 text-white text-base font-medium flex items-center gap-4">
                <span className="hidden md:block">{currentTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                <div className="h-4 w-[1px] bg-white/20 hidden md:block"></div>
                <span className="text-sm text-white/90 truncate font-medium max-w-[100px]">{meetingId}</span>
            </div>
            
            <div className="flex items-center gap-3">
                <button onClick={toggleMic} className={`p-3.5 rounded-full transition-all ${micOn ? 'bg-[#3C4043] hover:bg-[#4d5155] ring-1 ring-white/20' : 'bg-[#EA4335] text-white shadow-lg'}`}>{micOn ? <Mic size={20}/> : <MicOff size={20}/>}</button>
                <button onClick={toggleCam} className={`p-3.5 rounded-full transition-all ${camOn ? 'bg-[#3C4043] hover:bg-[#4d5155] ring-1 ring-white/20' : 'bg-[#EA4335] text-white shadow-lg'}`}>{camOn ? <Video size={20}/> : <VideoOff size={20}/>}</button>
                <button onClick={toggleHand} className={`p-3.5 rounded-full transition-all ${handRaised ? 'bg-[#8AB4F8] text-[#202124]' : 'bg-[#3C4043] hover:bg-[#4d5155] ring-1 ring-white/20'}`}><Hand size={20}/></button>
                
                {/* Reactions */}
                <div className="relative">
                    <button onClick={() => setShowReactionMenu(!showReactionMenu)} className="p-3.5 rounded-full bg-[#3C4043] hover:bg-[#4d5155] ring-1 ring-white/20 hidden md:flex"><Smile size={20}/></button>
                    {showReactionMenu && (
                        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-[#303134] rounded-full p-2 flex gap-2 shadow-2xl animate-in slide-in-from-bottom-2 border border-white/10 w-max">
                            {['💖', '👍', '🎉', '👏', '😂', '😮'].map(emoji => (
                                <button key={emoji} onClick={() => triggerReaction(emoji)} className="text-xl hover:scale-125 transition-transform p-1.5 hover:bg-white/10 rounded-full">{emoji}</button>
                            ))}
                        </div>
                    )}
                </div>

                <button onClick={leaveCall} className="px-6 h-12 bg-[#EA4335] hover:bg-[#D93025] text-white rounded-full flex items-center justify-center gap-2 shadow-lg ml-2 w-20">
                    <PhoneOff size={22} fill="currentColor"/> 
                </button>
            </div>

            <div className="w-1/4 flex justify-end gap-3">
                <button onClick={() => toggleSidePanel('people')} className={`p-3 rounded-full transition-all ${sidePanel === 'people' ? 'bg-[#8AB4F8] text-[#202124]' : 'text-white hover:bg-white/10'}`}>
                    <div className="relative">
                        <Users size={20}/>
                        <span className="absolute -top-1 -right-1 bg-[#5F6368] text-white text-[9px] px-1 rounded-full font-bold">{remoteParticipants.length + 1}</span>
                    </div>
                </button>
                <button onClick={() => toggleSidePanel('chat')} className={`p-3 rounded-full transition-all ${sidePanel === 'chat' ? 'bg-[#8AB4F8] text-[#202124]' : 'text-white hover:bg-white/10'}`}>
                    <MessageSquare size={20}/>
                </button>
            </div>
        </div>
    </div>
  );
}
