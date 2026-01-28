import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, Mic, MicOff, VideoOff, Hand, MonitorUp, MoreVertical, PhoneOff, 
  MessageSquare, Users, X, Send, Smile, Presentation, Layout, Info, Clock, ShieldCheck,
  Settings, Sparkles, Volume2, Keyboard, Link as LinkIcon, Calendar as CalendarIcon, Plus, ChevronLeft,
  Subtitles, Grip, Maximize, PenTool, AlertCircle, Pin, PinOff, MoreHorizontal, LayoutGrid, Check, Copy, ExternalLink,
  Mic as MicOn, Hand as HandRaisedIcon, Captions
} from 'lucide-react';
import { GoogleIcons } from '../GoogleIcons';
import Peer from 'peerjs';
import { bridge } from '../../utils/GASBridge';

interface MeetAppProps {
  onClose: () => void;
  data: any;
  showToast?: (msg: string) => void;
}

// Interface para Participante Remoto
interface RemoteParticipant {
    id: string;
    stream: MediaStream;
    name?: string;
    mic: boolean;
    cam: boolean;
    handRaised?: boolean;
}

const RemoteVideo: React.FC<{ peer: RemoteParticipant }> = ({ peer }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    useEffect(() => {
        if (videoRef.current) videoRef.current.srcObject = peer.stream;
    }, [peer.stream]);
    
    return (
        <div className="bg-[#3C4043] rounded-xl relative overflow-hidden flex items-center justify-center group border-2 border-transparent">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <span className="absolute bottom-3 left-3 text-white text-xs font-medium shadow-black drop-shadow-md bg-black/40 px-2 py-1 rounded backdrop-blur-sm truncate max-w-[120px]">{peer.name || 'Convidado'}</span>
            {peer.handRaised && <div className="absolute top-3 left-3 bg-[#FBBC04] text-black p-1.5 rounded-full animate-bounce shadow-lg"><Hand size={14}/></div>}
            {!peer.mic && <div className="absolute top-3 right-3 bg-black/60 p-1.5 rounded-full"><MicOff size={14} className="text-red-400"/></div>}
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
  const [captionsOn, setCaptionsOn] = useState(false);
  const [currentCaption, setCurrentCaption] = useState('');
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
  const screenStream = useRef<MediaStream | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const connections = useRef<any[]>([]);
  
  // Audio Refs
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const dataArray = useRef<Uint8Array | null>(null);
  const animationRef = useRef<number | null>(null);
  const speechRecognition = useRef<any>(null);
  
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Use global toast
  const toast = (msg: string) => showToast && showToast(msg);

  // Clock
  useEffect(() => {
      const timer = setInterval(() => setCurrentTime(new Date()), 1000);
      return () => clearInterval(timer);
  }, []);

  // --- PEER JS INITIALIZATION ---
  useEffect(() => {
      const peer = new Peer();
      peerRef.current = peer;

      peer.on('open', (id) => {
          setMyPeerId(id);
      });

      peer.on('call', (call) => {
          if (localStream.current) {
              call.answer(localStream.current);
              call.on('stream', (remoteStream) => {
                  handleRemoteStream(call.peer, remoteStream);
              });
          }
      });
      
      peer.on('connection', (conn) => {
          connections.current.push(conn);
          conn.on('data', (data: any) => {
              handleIncomingData(data, conn.peer);
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

  const handleIncomingData = (data: any, peerId: string) => {
      if (data.type === 'chat') {
          setMessages(prev => [...prev, { sender: data.sender || 'Convidado', text: data.message, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }]);
      } else if (data.type === 'emoji') {
          triggerReaction(data.emoji, true);
      } else if (data.type === 'hand') {
          setRemoteParticipants(prev => prev.map(p => p.id === peerId ? { ...p, handRaised: data.value } : p));
          if (data.value) toast("Alguém levantou a mão");
      } else if (data.type === 'caption') {
          setCurrentCaption(`${data.sender}: ${data.text}`);
          setTimeout(() => setCurrentCaption(''), 5000);
      }
  };

  const broadcastData = (data: any) => {
      connections.current.forEach(conn => conn.send(data));
  };

  const connectToPeer = (remoteId: string) => {
      if (!peerRef.current || !localStream.current) return;
      
      // Call
      const call = peerRef.current.call(remoteId, localStream.current);
      call.on('stream', (remoteStream) => {
          handleRemoteStream(remoteId, remoteStream);
      });

      // Data Connection
      const conn = peerRef.current.connect(remoteId);
      conn.on('open', () => {
          connections.current.push(conn);
      });
  };

  // --- AUDIO VISUALIZER & CAPTIONS ---
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

      // Captions Setup
      if ('webkitSpeechRecognition' in window) {
          const SpeechRecognition = (window as any).webkitSpeechRecognition;
          speechRecognition.current = new SpeechRecognition();
          speechRecognition.current.continuous = true;
          speechRecognition.current.interimResults = true;
          speechRecognition.current.lang = 'pt-BR';
          
          speechRecognition.current.onresult = (event: any) => {
              let interimTranscript = '';
              for (let i = event.resultIndex; i < event.results.length; ++i) {
                  if (event.results[i].isFinal) {
                      const text = event.results[i][0].transcript;
                      setCurrentCaption(text);
                      broadcastData({ type: 'caption', text, sender: data.user.name });
                      setTimeout(() => setCurrentCaption(''), 5000);
                  }
              }
          };
      }
  };

  const cleanupAudioAnalysis = () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioContext.current && audioContext.current.state !== 'closed') {
          audioContext.current.close();
          audioContext.current = null;
      }
      if (speechRecognition.current) speechRecognition.current.stop();
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
          toast("Erro ao acessar câmera/microfone");
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
          toast(enabled ? "Microfone ativado" : "Microfone desativado");
      }
  };

  const toggleScreenShare = async () => {
      if (screenSharing) {
          // Stop sharing
          screenStream.current?.getTracks().forEach(t => t.stop());
          screenStream.current = null;
          setScreenSharing(false);
          if (localVideoRef.current && localStream.current) localVideoRef.current.srcObject = localStream.current;
          // Note: In PeerJS, replacing tracks seamlessly is complex without renegotiation. 
          // For this demo, we just switch local view. In real WebRTC, you'd replaceTrack on sender.
      } else {
          try {
              const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
              screenStream.current = stream;
              setScreenSharing(true);
              if (localVideoRef.current) localVideoRef.current.srcObject = stream;
              stream.getVideoTracks()[0].onended = () => toggleScreenShare(); // Handle stop from browser UI
          } catch(e) { console.error(e); }
      }
  };

  const toggleCaptions = () => {
      const newState = !captionsOn;
      setCaptionsOn(newState);
      if (newState && speechRecognition.current) speechRecognition.current.start();
      else if (!newState && speechRecognition.current) speechRecognition.current.stop();
      toast(newState ? "Legendas ativadas" : "Legendas desativadas");
  };

  const toggleHand = () => {
      const newState = !handRaised;
      setHandRaised(newState);
      broadcastData({ type: 'hand', value: newState });
      toast(newState ? "Você levantou a mão" : "Você abaixou a mão");
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

  const createRealMeeting = async () => {
      const res = await bridge.createCalendarEvent({ 
          title: 'Nova Reunião', 
          start: new Date().toISOString(), 
          end: new Date(Date.now() + 3600000).toISOString(),
          calendarId: 'primary' 
      });
      if (res.meetLink) {
          const win = window.open(res.meetLink, '_blank');
          if (win) win.focus();
          toast("Reunião real criada!");
          setShowNewMeetingMenu(false);
      }
  };

  const joinMeeting = () => {
      if (meetingInput.trim()) {
          setMeetingId(meetingInput.trim());
          setIsHost(false);
          setView('lobby');
      }
  };

  const enterCall = () => {
      if (meetingId.includes('meet.google.com')) {
          window.open(meetingId, '_blank');
          return;
      }
      if (!isHost && meetingId) {
          connectToPeer(meetingId);
      }
      setView('call');
      toast("Você entrou na reunião");
  };

  const handleSendMessage = () => {
      if (!chatMessage.trim()) return;
      const now = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      const msg = { sender: 'Eu', text: chatMessage, time: now };
      setMessages([...messages, msg]);
      broadcastData({ type: 'chat', message: chatMessage, sender: data.user.name });
      setChatMessage('');
  };

  const triggerReaction = (emoji: string, isRemote = false) => {
      const id = Date.now();
      const left = isRemote ? 80 : 20; 
      setFloatingEmojis(prev => [...prev, { id, emoji, left }]);
      if (!isRemote) broadcastData({ type: 'emoji', emoji });
      setShowReactionMenu(false);
      setTimeout(() => setFloatingEmojis(prev => prev.filter(e => e.id !== id)), 2000);
  };

  const copyMeetingLink = () => {
      navigator.clipboard.writeText(myPeerId);
      toast("ID da reunião copiado!");
  };

  const toggleSidePanel = (panel: 'chat' | 'people' | 'info' | 'activities') => {
      setSidePanel(sidePanel === panel ? 'none' : panel);
  };
  
  const isRealMeetLink = meetingId.includes('meet.google.com');

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
                                        <button onClick={createRealMeeting} className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-white/10 text-white/90 text-sm">
                                            <LinkIcon size={20} className="text-white"/> Criar uma reunião para depois (Real)
                                        </button>
                                        <button onClick={createMeeting} className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-white/10 text-white/90 text-sm">
                                            <Plus size={20} className="text-white"/> Iniciar uma reunião instantânea (P2P)
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
                   {/* Illustrative Graphic */}
                   <div className="w-64 h-64 bg-blue-500/10 rounded-full flex items-center justify-center relative animate-pulse">
                        <Video size={64} className="text-blue-400 opacity-80"/>
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
            <div className="absolute top-6 left-6 flex items-center gap-2">
                 <GoogleIcons.MeetGlass className="w-6 h-6"/>
                 <span className="text-lg text-white/90 font-medium">Google Meet</span>
            </div>
            
            <div className="flex flex-col md:flex-row gap-8 items-center max-w-6xl w-full px-8 animate-in fade-in zoom-in duration-500">
                <div className="flex-1 w-full max-w-2xl relative group">
                    <div className="aspect-video bg-[#3C4043] rounded-lg overflow-hidden relative shadow-2xl border border-white/5 ring-1 ring-white/10 flex items-center justify-center">
                        <video 
                            ref={localVideoRef} 
                            autoPlay 
                            muted 
                            playsInline 
                            className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-300 ${camOn ? 'opacity-100' : 'opacity-0'} ${backgroundEffect === 'blur' ? 'blur-sm scale-110' : ''}`} 
                        />
                        {!camOn && <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 animate-in zoom-in"><div className="text-white/30 text-sm font-medium">Câmera desligada</div></div>}
                        
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4">
                            <button onClick={toggleMic} className={`p-3 rounded-full transition-all border ${micOn ? 'bg-[#3C4043] hover:bg-[#4d5155] border-transparent text-white' : 'bg-[#EA4335] hover:bg-[#D93025] border-transparent text-white'}`}>{micOn ? <Mic size={20}/> : <MicOff size={20}/>}</button>
                            <button onClick={camOn ? stopCamera : resumeCamera} className={`p-3 rounded-full transition-all border ${camOn ? 'bg-[#3C4043] hover:bg-[#4d5155] border-transparent text-white' : 'bg-[#EA4335] hover:bg-[#D93025] border-transparent text-white'}`}>{camOn ? <Video size={20}/> : <VideoOff size={20}/>}</button>
                        </div>
                        <div className="absolute top-4 right-4">
                            <button onClick={() => setBackgroundEffect(backgroundEffect === 'none' ? 'blur' : 'none')} className={`p-2 rounded-full ${backgroundEffect === 'blur' ? 'bg-blue-600 text-white' : 'bg-[#202124]/60 text-white/70'}`} title="Desfoque"><Sparkles size={16}/></button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 w-full max-w-sm flex flex-col items-center text-center space-y-8">
                    <div>
                        <h1 className="text-3xl font-normal mb-2 text-[#E3E3E3]">Pronto para participar?</h1>
                        <p className="text-white/60 text-sm mb-4">{isHost ? "Você criou esta reunião." : "Você está prestes a entrar."}</p>
                        {isHost && <div className="bg-[#303134] p-3 rounded-lg flex items-center gap-2 mb-4 border border-white/10 relative group"><span className="text-sm font-mono text-blue-300">{myPeerId}</span><button onClick={copyMeetingLink} className="p-1.5 hover:bg-white/10 rounded text-white/70" title="Copiar ID"><Copy size={14}/></button></div>}
                        {isRealMeetLink && <div className="text-green-400 text-xs mb-4 flex items-center justify-center gap-1"><ExternalLink size={12}/> Link externo detectado</div>}
                    </div>
                    <button onClick={enterCall} className="px-8 py-3 bg-[#8AB4F8] hover:bg-[#AECBFA] text-[#202124] rounded-full font-medium text-sm transition-all shadow-lg">
                        {isRealMeetLink ? 'Abrir no Google Meet' : 'Participar agora'}
                    </button>
                </div>
            </div>
        </div>
      );
  }

  // --- ACTIVE CALL SCREEN ---
  const gridClass = remoteParticipants.length === 0 ? 'grid-cols-1' : remoteParticipants.length === 1 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3';

  return (
    <div className="flex flex-col h-full bg-[#202124] relative overflow-hidden text-white font-sans animate-in fade-in duration-500">
        <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
            {floatingEmojis.map(emoji => (
                <div key={emoji.id} className="absolute bottom-24 text-4xl animate-[floatUp_2s_ease-out_forwards]" style={{ left: `${emoji.left}%` }}>{emoji.emoji}</div>
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
                    <div className={`bg-[#3C4043] rounded-xl relative overflow-hidden flex items-center justify-center group border-2 ${micOn ? 'border-transparent' : 'border-red-500/30'}`}>
                        <video ref={localVideoRef} autoPlay muted playsInline className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-300 ${camOn ? 'opacity-100' : 'opacity-0'} ${backgroundEffect === 'blur' ? 'blur-sm scale-110' : ''}`} />
                        {!camOn && <div className="absolute inset-0 flex items-center justify-center"><div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center text-3xl text-white font-bold shadow-lg">V</div></div>}
                        <span className="absolute bottom-3 left-3 text-white text-xs font-medium shadow-black drop-shadow-md bg-black/40 px-2 py-1 rounded backdrop-blur-sm">Você {screenSharing && '(Apresentando)'}</span>
                        {handRaised && <div className="absolute top-3 left-3 bg-[#FBBC04] text-black p-1.5 rounded-full animate-bounce shadow-lg"><Hand size={16}/></div>}
                    </div>
                    {remoteParticipants.map(peer => <RemoteVideo key={peer.id} peer={peer} />)}
                </div>
                
                {/* Captions Overlay */}
                {(captionsOn && currentCaption) && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 px-6 py-3 rounded-xl text-white text-lg font-medium backdrop-blur-md max-w-2xl text-center shadow-lg transition-all animate-in slide-in-from-bottom-2">
                        {currentCaption}
                    </div>
                )}
            </div>

            {/* SIDE PANEL (Chat/People/Info) */}
            {sidePanel !== 'none' && (
                <div className="w-[360px] bg-white rounded-2xl flex flex-col shadow-2xl animate-in slide-in-from-right-10 duration-300 overflow-hidden shrink-0 h-full">
                    <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100">
                        <span className="text-gray-800 font-medium text-lg">{sidePanel === 'chat' ? 'Mensagens' : sidePanel === 'people' ? 'Pessoas' : 'Detalhes'}</span>
                        <button onClick={() => setSidePanel('none')} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X size={20}/></button>
                    </div>
                    
                    {sidePanel === 'chat' && (
                        <>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50" ref={chatScrollRef}>
                                {messages.map((msg, i) => (
                                    <div key={i} className={`flex flex-col ${msg.sender === 'Eu' ? 'items-end' : 'items-start'}`}>
                                        <div className="flex items-baseline gap-2 mb-1 px-1"><span className="text-xs font-bold text-gray-700">{msg.sender}</span><span className="text-[10px] text-gray-400">{msg.time}</span></div>
                                        <div className={`px-4 py-2.5 rounded-2xl text-sm max-w-[85%] shadow-sm ${msg.sender === 'Eu' ? 'bg-[#E8F0FE] text-[#174EA6] rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'}`}>{msg.text}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="p-4 bg-white border-t border-gray-100 relative">
                                <input type="text" placeholder="Enviar mensagem..." className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-white border border-transparent focus:border-blue-500 outline-none rounded-full pl-5 pr-12 py-3 text-sm text-gray-700 transition-all" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} />
                                <button onClick={handleSendMessage} className="absolute right-6 top-5 p-1 text-blue-600"><Send size={18}/></button>
                            </div>
                        </>
                    )}
                    
                    {sidePanel === 'people' && (
                        <div className="flex-1 overflow-y-auto p-2">
                             <div className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider flex justify-between items-center"><span>Na chamada ({remoteParticipants.length + 1})</span></div>
                             {/* Self */}
                             <div className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl">
                                 <img src={data?.user?.avatar} className="w-8 h-8 rounded-full"/> 
                                 <span className="text-sm font-medium text-gray-800">Você</span>
                                 <div className="ml-auto flex gap-2">{micOn ? <Mic size={14} className="text-gray-500"/> : <MicOff size={14} className="text-red-500"/>}</div>
                             </div>
                             {remoteParticipants.map(p => (
                                 <div key={p.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl">
                                     <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold">C</div>
                                     <span className="text-sm font-medium text-gray-800">Convidado</span>
                                     <div className="ml-auto flex gap-2">{p.mic ? <Mic size={14} className="text-gray-500"/> : <MicOff size={14} className="text-red-500"/>}</div>
                                 </div>
                             ))}
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* BOTTOM BAR */}
        <div className="h-20 bg-[#202124] flex items-center justify-between px-6 pb-4 shrink-0 fixed bottom-0 left-0 right-0 z-50">
            <div className="w-1/4 text-white text-base font-medium flex items-center gap-4"><span className="hidden md:block">{currentTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div>
            
            <div className="flex items-center gap-3">
                <button onClick={toggleMic} className={`p-3.5 rounded-full transition-all ${micOn ? 'bg-[#3C4043] hover:bg-[#4d5155] text-white' : 'bg-[#EA4335] hover:bg-[#D93025] text-white shadow-lg'}`}>{micOn ? <MicOn size={20}/> : <MicOff size={20}/>}</button>
                <button onClick={camOn ? stopCamera : resumeCamera} className={`p-3.5 rounded-full transition-all ${camOn ? 'bg-[#3C4043] hover:bg-[#4d5155] text-white' : 'bg-[#EA4335] hover:bg-[#D93025] text-white shadow-lg'}`}>{camOn ? <Video size={20}/> : <VideoOff size={20}/>}</button>
                <button onClick={toggleHand} className={`p-3.5 rounded-full transition-all ${handRaised ? 'bg-[#8AB4F8] text-[#202124]' : 'bg-[#3C4043] hover:bg-[#4d5155] text-white'}`}><HandRaisedIcon size={20}/></button>
                <button onClick={toggleScreenShare} className={`p-3.5 rounded-full transition-all ${screenSharing ? 'bg-[#8AB4F8] text-[#202124]' : 'bg-[#3C4043] hover:bg-[#4d5155] text-white'}`}><MonitorUp size={20}/></button>
                <button onClick={toggleCaptions} className={`p-3.5 rounded-full transition-all ${captionsOn ? 'bg-[#8AB4F8] text-[#202124]' : 'bg-[#3C4043] hover:bg-[#4d5155] text-white'}`}><Captions size={20}/></button>
                
                <div className="relative"><button onClick={() => setShowReactionMenu(!showReactionMenu)} className="w-12 h-12 rounded-full bg-[#3C4043] hover:bg-[#4d5155] text-white hidden md:flex items-center justify-center"><Smile size={20}/></button></div>
                <button onClick={() => { stopCamera(); setView('home'); peerRef.current?.destroy(); }} className="px-8 h-12 bg-[#EA4335] hover:bg-[#D93025] text-white rounded-full flex items-center gap-2 ml-4 shadow-lg"><PhoneOff size={22}/></button>
            </div>
            
            <div className="w-1/4 flex justify-end gap-3">
                <button onClick={() => toggleSidePanel('people')} className={`p-3 rounded-full transition-all ${sidePanel === 'people' ? 'bg-[#8AB4F8] text-[#202124]' : 'text-white hover:bg-white/10'}`}><Users size={20}/></button>
                <button onClick={() => toggleSidePanel('chat')} className={`p-3 rounded-full transition-all ${sidePanel === 'chat' ? 'bg-[#8AB4F8] text-[#202124]' : 'text-white hover:bg-white/10'}`}><MessageSquare size={20}/></button>
            </div>
        </div>
    </div>
  );
}