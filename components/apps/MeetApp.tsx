
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

interface RemoteParticipant {
    id: string;
    stream?: MediaStream;
    name?: string;
    mic: boolean;
    cam: boolean;
    handRaised: boolean;
    isScreenSharing: boolean;
}

interface ChatMessage {
    id: string;
    sender: string;
    text: string;
    time: string;
    isSelf: boolean;
}

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
  const [view, setView] = useState<'home' | 'lobby' | 'call'>('home');
  const [meetingInput, setMeetingInput] = useState('');
  const [showNewMeetingMenu, setShowNewMeetingMenu] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [myPeerId, setMyPeerId] = useState<string>('');
  const [meetingId, setMeetingId] = useState<string>('');
  const [isHost, setIsHost] = useState(false);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [sidePanel, setSidePanel] = useState<'none' | 'chat' | 'people' | 'info' | 'activities'>('none');
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showReactionMenu, setShowReactionMenu] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<{id: number, emoji: string, left: number}[]>([]);
  const [volumeLevel, setVolumeLevel] = useState(0); 

  // Screen Sharing State
  const [screenSharing, setScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [presenterId, setPresenterId] = useState<string | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const localStream = useRef<MediaStream | null>(null);
  const localScreenStream = useRef<MediaStream | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<Map<string, { call?: MediaConnection, conn?: DataConnection, screenCall?: MediaConnection }>>(new Map());
  
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const dataArray = useRef<Uint8Array | null>(null);
  const animationRef = useRef<number | null>(null);
  
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const toast = (msg: string) => showToast ? showToast(msg) : console.log(msg);

  // FIX: Define toggleSidePanel function
  const toggleSidePanel = (panel: 'chat' | 'people' | 'info' | 'activities') => {
    setSidePanel(sidePanel === panel ? 'none' : panel);
  };

  useEffect(() => {
      const peer = new Peer();
      peerRef.current = peer;

      peer.on('open', (id) => setMyPeerId(id));

      peer.on('call', (call) => {
          if (call.metadata?.type === 'screen') {
              call.answer(); // Answer screen share with no stream from us
              handleScreenCall(call);
          } else { // It's a camera call
              if (localStream.current) {
                  call.answer(localStream.current);
                  handleMediaCall(call);
              }
          }
      });
      
      peer.on('connection', (conn) => handleDataConnection(conn));
      peer.on('error', (err) => { console.error("Peer Error:", err); toast("Erro de conexão P2P"); });

      return () => { peer.destroy(); };
  }, []);
  
  const handleMediaCall = (call: MediaConnection) => {
      const peerId = call.peer;
      const existing = connectionsRef.current.get(peerId) || {};
      connectionsRef.current.set(peerId, { ...existing, call });

      call.on('stream', (remoteStream) => {
          setRemoteParticipants(prev => {
              if (prev.find(p => p.id === peerId)) {
                  return prev.map(p => p.id === peerId ? { ...p, stream: remoteStream } : p);
              }
              return [...prev, { id: peerId, stream: remoteStream, mic: true, cam: true, handRaised: false, isScreenSharing: false }];
          });
      });

      call.on('close', () => setRemoteParticipants(prev => prev.filter(p => p.id !== peerId)));
  };

  const handleScreenCall = (call: MediaConnection) => {
      const peerId = call.peer;
      const existing = connectionsRef.current.get(peerId) || {};
      connectionsRef.current.set(peerId, { ...existing, screenCall: call });
      
      call.on('stream', (remoteScreenStream) => {
          setPresenterId(peerId);
          setScreenStream(remoteScreenStream);
      });

      call.on('close', () => {
          setPresenterId(null);
          setScreenStream(null);
      });
  };

  const handleDataConnection = (conn: DataConnection) => {
      const peerId = conn.peer;
      const existing = connectionsRef.current.get(peerId) || {};
      connectionsRef.current.set(peerId, { ...existing, conn });

      conn.on('open', () => conn.send({ type: 'status', mic: micOn, cam: camOn, handRaised, isScreenSharing: screenSharing, name: data.user.name }));
      conn.on('data', (data: any) => handleIncomingData(conn.peer, data));
      conn.on('close', () => setRemoteParticipants(prev => prev.filter(p => p.id !== peerId)));
  };

  const handleIncomingData = (peerId: string, data: any) => {
      switch(data.type) {
          case 'chat':
              setMessages(prev => [...prev, { id: Date.now().toString(), sender: data.senderName, text: data.message, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), isSelf: false }]);
              break;
          case 'status':
              setRemoteParticipants(prev => prev.map(p => p.id === peerId ? { ...p, ...data } : p));
              if (data.isScreenSharing && presenterId !== peerId) {
                  // A remote peer started sharing, we need to handle their stream, which will come via a call.
              } else if (!data.isScreenSharing && presenterId === peerId) {
                  setPresenterId(null);
                  setScreenStream(null);
              }
              break;
      }
  };

  const broadcastData = (payload: any) => {
      connectionsRef.current.forEach(({ conn }) => {
          if (conn?.open) conn.send(payload);
      });
  };

  const connectToPeer = (remoteId: string) => {
      if (!peerRef.current || !localStream.current) return;
      handleMediaCall(peerRef.current.call(remoteId, localStream.current));
      handleDataConnection(peerRef.current.connect(remoteId));
  };

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
      }
  };

  const setupAudioAnalysis = (stream: MediaStream) => {
      if (!audioContext.current) audioContext.current = new (window.AudioContext)();
      const source = audioContext.current.createMediaStreamSource(stream);
      analyser.current = audioContext.current.createAnalyser();
      source.connect(analyser.current);
      analyser.current.fftSize = 64; 
      dataArray.current = new Uint8Array(analyser.current.frequencyBinCount);
      const updateVolume = () => {
          if (analyser.current && dataArray.current) {
              analyser.current.getByteFrequencyData(dataArray.current);
              const average = dataArray.current.reduce((a, b) => a + b, 0) / dataArray.current.length;
              setVolumeLevel(average);
          }
          animationRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
  };

  const toggleMic = () => {
      if (!localStream.current) return;
      const enabled = !micOn;
      localStream.current.getAudioTracks().forEach(track => track.enabled = enabled);
      setMicOn(enabled);
      broadcastData({ type: 'status', mic: enabled });
  };
  
  const toggleCam = () => {
      if (!localStream.current) return;
      const enabled = !camOn;
      localStream.current.getVideoTracks().forEach(track => track.enabled = enabled);
      setCamOn(enabled);
      broadcastData({ type: 'status', cam: enabled });
  };

  const toggleScreenSharing = async () => {
      if (screenSharing) {
          // Stop sharing
          localScreenStream.current?.getTracks().forEach(track => track.stop());
          localScreenStream.current = null;
          connectionsRef.current.forEach(c => c.screenCall?.close());
          setScreenSharing(false);
          setScreenStream(null);
          setPresenterId(null);
          broadcastData({ type: 'status', isScreenSharing: false });
      } else {
          // Start sharing
          try {
              const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
              localScreenStream.current = stream;
              setScreenStream(stream);
              setPresenterId(myPeerId);
              setScreenSharing(true);
              
              stream.getVideoTracks()[0].onended = () => toggleScreenSharing();

              connectionsRef.current.forEach((_, peerId) => {
                  const screenCall = peerRef.current?.call(peerId, stream, { metadata: { type: 'screen' } });
                  if (screenCall) {
                      const existing = connectionsRef.current.get(peerId) || {};
                      connectionsRef.current.set(peerId, { ...existing, screenCall });
                  }
              });
              broadcastData({ type: 'status', isScreenSharing: true });
          } catch (err) {
              console.error("Screen share failed", err);
          }
      }
  };

  const createMeeting = async () => {
      await bridge.registerMeeting(myPeerId, myPeerId);
      setMeetingId(myPeerId);
      setIsHost(true);
      setView('lobby');
  };

  const joinMeeting = async () => {
      if (!meetingInput.trim()) return;
      const hostId = await bridge.getMeetingPeer(meetingInput.trim()) || meetingInput.trim();
      setMeetingId(hostId);
      setIsHost(false);
      setView('lobby');
  };

  const enterCall = () => {
      if (!isHost && meetingId) connectToPeer(meetingId);
      setView('call');
  };

  const leaveCall = () => {
      localStream.current?.getTracks().forEach(track => track.stop());
      localScreenStream.current?.getTracks().forEach(track => track.stop());
      connectionsRef.current.forEach(c => { c.call?.close(); c.conn?.close(); c.screenCall?.close(); });
      connectionsRef.current.clear();
      setView('home');
      setRemoteParticipants([]);
      setScreenSharing(false);
      setScreenStream(null);
      setPresenterId(null);
  };
  
  useEffect(() => {
    if (screenStream && screenVideoRef.current) {
        screenVideoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);
  
  // Grid Calculation
  const participantsOnStage = remoteParticipants.filter(p => p.id !== presenterId);
  const totalOnStage = participantsOnStage.length + (presenterId !== myPeerId ? 1 : 0);
  let sideGridClass = 'grid-cols-1';
  if (totalOnStage >= 2) sideGridClass = 'grid-cols-2';
  if (totalOnStage >= 5) sideGridClass = 'grid-cols-2 lg:grid-cols-3';
  
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
                          <div className="flex items-center gap-3 bg-transparent border border-white/30 rounded-[4px] px-3 py-3 focus-within:border-[#8AB4F8] transition-all flex-1 min-w-[240px]">
                              <Keyboard size={20} className="text-white/60" />
                              <input type="text" placeholder="Digite um código ou link" className="bg-transparent border-none outline-none text-white placeholder:text-white/60 w-full" value={meetingInput} onChange={(e) => setMeetingInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && joinMeeting()} />
                          </div>
                          {meetingInput && <button onClick={joinMeeting} className="text-[#8AB4F8] font-medium text-sm hover:underline">Participar</button>}
                      </div>
                  </div>
              </div>
              <div className="flex-1 max-w-md w-full h-[300px] flex items-center justify-center">
                   <div className="w-64 h-64 bg-blue-500/5 rounded-full flex items-center justify-center border border-white/10">
                       <Video size={64} className="text-blue-400 opacity-50" />
                   </div>
              </div>
          </div>
      </div>
    );
  }

  if (view === 'lobby') {
    return (
      <div className="flex flex-col h-full bg-[#202124] text-white font-sans items-center justify-center relative overflow-hidden">
          <div className="absolute top-6 left-6 flex items-center gap-2"><GoogleIcons.MeetGlass className="w-6 h-6"/><span className="text-lg text-white/90 font-medium">Google Meet</span></div>
          <div className="flex flex-col md:flex-row gap-8 items-center max-w-6xl w-full px-8 animate-in fade-in zoom-in duration-300">
              <div className="flex-1 w-full max-w-2xl relative">
                  <div className="aspect-video bg-[#3C4043] rounded-lg overflow-hidden relative shadow-2xl border border-white/5 ring-1 ring-white/10 flex items-center justify-center">
                      <video ref={localVideoRef} autoPlay muted playsInline className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-300 ${camOn ? 'opacity-100' : 'opacity-0'}`} />
                      {!camOn && <div className="absolute inset-0 flex items-center justify-center text-white/30 text-sm font-medium">Câmera desligada</div>}
                      <div className="absolute top-4 right-4 bg-[#202124]/60 p-2 rounded-full backdrop-blur-md">
                           <div className="flex gap-1 h-4 items-end">
                              <div className="w-1 bg-blue-400 rounded-full transition-all duration-75" style={{ height: `${Math.min(100, Math.max(20, volumeLevel * 1.5))}%` }}></div>
                          </div>
                      </div>
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4">
                          <button onClick={toggleMic} className={`p-3 rounded-full transition-all border ${micOn ? 'bg-[#3C4043] text-white' : 'bg-[#EA4335] text-white'}`}>{micOn ? <Mic size={20}/> : <MicOff size={20}/>}</button>
                          <button onClick={toggleCam} className={`p-3 rounded-full transition-all border ${camOn ? 'bg-[#3C4043] text-white' : 'bg-[#EA4335] text-white'}`}>{camOn ? <Video size={20}/> : <VideoOff size={20}/>}</button>
                      </div>
                  </div>
              </div>
              <div className="flex-1 w-full max-w-sm flex flex-col items-center text-center space-y-6">
                  <h1 className="text-3xl font-normal text-[#E3E3E3]">Pronto para participar?</h1>
                  {isHost && <div className="bg-[#303134] p-3 rounded-lg flex items-center gap-2 border border-white/10 w-full justify-between"><span className="text-sm font-mono text-blue-300 truncate">{meetingId}</span><button onClick={() => {navigator.clipboard.writeText(meetingId); toast('ID copiado!')}} className="p-1.5 hover:bg-white/10 rounded text-white/70"><Copy size={14}/></button></div>}
                  <button onClick={enterCall} className="px-8 py-3 bg-[#8AB4F8] hover:bg-[#AECBFA] text-[#202124] rounded-full font-medium text-sm transition-all shadow-lg w-full">Participar agora</button>
              </div>
          </div>
      </div>
    );
  }

  // FIX: Define gridClass for the call view
  const gridClass = remoteParticipants.length === 0 
    ? 'grid-cols-1' 
    : remoteParticipants.length === 1 
        ? 'grid-cols-2' 
        : 'grid-cols-2 md:grid-cols-3';

  return (
    <div className="flex h-full bg-[#202124] relative overflow-hidden text-white font-sans animate-in fade-in duration-500">
        <div className="flex-1 flex flex-col p-3 gap-3 pb-20 relative">
            {/* Main Stage: Presentation or Grid */}
            {presenterId ? (
                <div className="flex-1 flex gap-3 overflow-hidden">
                    <div className="flex-1 flex flex-col relative bg-black rounded-xl justify-center items-center">
                        <video ref={screenVideoRef} autoPlay className="w-full h-full object-contain" />
                        <div className="absolute bottom-4 text-center bg-black/50 px-4 py-2 rounded-xl backdrop-blur-sm">
                            <p className="text-sm font-medium">{presenterId === myPeerId ? "Você está apresentando" : `${remoteParticipants.find(p => p.id === presenterId)?.name || 'Alguém'} está apresentando`}</p>
                        </div>
                    </div>
                    
                    {/* Sidebar with other participants */}
                    <div className={`w-60 flex flex-col gap-3 overflow-y-auto shrink-0 ${sideGridClass}`}>
                        {/* Presenter's video */}
                        {presenterId === myPeerId ? (
                            <div className="bg-[#3C4043] rounded-xl overflow-hidden aspect-video">
                                <video ref={localVideoRef} autoPlay muted playsInline className={`w-full h-full object-cover transform scale-x-[-1] ${camOn ? '' : 'hidden'}`} />
                            </div>
                        ) : (
                            <RemoteVideo peer={remoteParticipants.find(p => p.id === presenterId)!} />
                        )}
                        {/* Other participants */}
                        {participantsOnStage.map(p => <RemoteVideo key={p.id} peer={p} />)}
                    </div>
                </div>
            ) : (
                <div className={`grid gap-3 h-full w-full ${gridClass} content-center`}>
                    <div className="bg-[#3C4043] rounded-xl relative overflow-hidden flex items-center justify-center group border-2">
                        <video ref={localVideoRef} autoPlay muted playsInline className={`w-full h-full object-cover transform scale-x-[-1] ${camOn ? '' : 'hidden'}`} />
                        {!camOn && <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center text-3xl text-white font-bold">V</div>}
                        <span className="absolute bottom-3 left-3 text-white text-xs font-medium bg-black/40 px-2 py-1 rounded">Você</span>
                    </div>
                    {remoteParticipants.map(peer => <RemoteVideo key={peer.id} peer={peer} />)}
                </div>
            )}
        </div>

        {/* Right Side Panel */}
        {sidePanel !== 'none' && (
            <div className="w-[340px] bg-white rounded-2xl flex flex-col shadow-2xl animate-in slide-in-from-right-10 duration-300 overflow-hidden shrink-0 h-[calc(100%-24px)] m-3 mr-0">
                {/* ... Panel Content ... */}
            </div>
        )}

        {/* Bottom Controls */}
        <div className="h-20 bg-[#202124] flex items-center justify-between px-6 pb-4 shrink-0 fixed bottom-0 left-0 right-0 z-50">
            <div className="w-1/4 text-sm text-white/90 truncate">{meetingId}</div>
            <div className="flex items-center gap-3">
                <button onClick={toggleMic} className={`p-3.5 rounded-full ${micOn ? 'bg-[#3C4043]' : 'bg-[#EA4335]'}`}><Mic size={20}/></button>
                <button onClick={toggleCam} className={`p-3.5 rounded-full ${camOn ? 'bg-[#3C4043]' : 'bg-[#EA4335]'}`}><Video size={20}/></button>
                <button onClick={toggleScreenSharing} className={`p-3.5 rounded-full transition-colors ${screenSharing ? 'bg-red-500 text-white' : 'bg-[#3C4043] text-white'}`}>
                    <MonitorUp size={20}/>
                </button>
                <button onClick={leaveCall} className="px-6 h-12 bg-[#EA4335] text-white rounded-full flex items-center gap-2 ml-2"><PhoneOff size={22} fill="currentColor"/></button>
            </div>
            <div className="w-1/4 flex justify-end gap-3">
                <button onClick={() => toggleSidePanel('people')} className="p-3 rounded-full text-white hover:bg-white/10"><Users size={20}/></button>
                <button onClick={() => toggleSidePanel('chat')} className="p-3 rounded-full text-white hover:bg-white/10"><MessageSquare size={20}/></button>
            </div>
        </div>
    </div>
  );
}
