import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Video,
  Mic,
  MicOff,
  VideoOff,
  Hand,
  PhoneOff,
  MessageSquare,
  Users,
  X,
  Send,
  Smile,
  Keyboard,
  Plus,
  Copy,
  MonitorUp,
  MonitorOff,
  Info,
  Shapes,
  Settings,
  Captions,
  LayoutGrid,
  Pin,
  PinOff,
  Calendar,
  Link2,
  UserPlus,
  Check,
  Sparkles,
  Circle,
  Square,
  MoreVertical,
  ThumbsUp,
  Volume2,
  ShieldCheck,
  Search,
  CheckCircle2,
  Clock,
  FileText,
  RotateCcw,
  Trash2,
  Lock,
  Unlock,
} from 'lucide-react';
import { GoogleIcons } from '../GoogleIcons';
import { bridge, type AppOpenPayload, type CalendarEvent, type DashboardData } from '../../utils/GASBridge';
import type { EnrichedDriveItem } from '../../utils/driveLogic';
import Peer, { MediaConnection, DataConnection } from 'peerjs';
import {
  generateMeetingCode,
  formatLocalDateInput,
  normalizeMeetingCode,
  formatCallDuration,
  computeGridColumns,
  filterUpcomingMeetMeetings,
  voteInPoll,
  togglePollClosed,
  deletePoll,
  toggleQuestionUpvote,
  markQuestionAnswered,
  resolveSpotlightParticipant,
  formatMeetingSummaryHtml,
  type MeetLayoutMode,
  type MeetParticipant,
  type WaitingGuest,
  type MeetPoll,
  type MeetQuestion,
  type MeetCaption,
} from '../../utils/meetLogic';

interface SpeechRecognitionResultEventLike {
  results: ArrayLike<{ 0?: { transcript?: string } }>;
}

interface SpeechRecognitionInstanceLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstanceLike;

interface WindowWithWebMedia extends Window {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
  webkitAudioContext?: typeof AudioContext;
}

type MeetDataMessage =
  | { type: 'chat'; senderName?: string; message: string }
  | { type: 'emoji'; emoji: string }
  | { type: 'status'; mic?: boolean; cam?: boolean; handRaised?: boolean; name?: string; isScreenSharing?: boolean }
  | { type: 'poll_vote'; pollId: string; optionId: string }
  | { type: 'qa_add'; question?: MeetQuestion };

function isMeetDataMessage(value: unknown): value is MeetDataMessage {
  return typeof value === 'object' && value !== null && 'type' in value && typeof (value as { type: unknown }).type === 'string';
}

interface MeetAppProps {
  onClose: () => void;
  data: DashboardData;
  onOpenApp?: (type: string, fileData?: AppOpenPayload) => void;
  onUpdateEvents?: (events: CalendarEvent[]) => void;
  showToast?: (msg: string) => void;
  isDarkMode?: boolean;
}

interface RemoteParticipant extends MeetParticipant {
  stream?: MediaStream;
}

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
  isSelf: boolean;
}

interface MediaDeviceOption {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput' | 'videoinput';
}

const AVATAR_PALETTE = [
  'bg-blue-600',
  'bg-emerald-600',
  'bg-purple-600',
  'bg-amber-600',
  'bg-rose-600',
];

const ParticipantTile: React.FC<{
  participant: RemoteParticipant;
  localVideoRef?: React.RefObject<HTMLVideoElement | null>;
  screenVideoRef?: React.RefObject<HTMLVideoElement | null>;
  screenStream?: MediaStream | null;
  blurEnabled?: boolean;
  isPinned: boolean;
  onTogglePin: (id: string) => void;
  onMuteRemote?: (id: string) => void;
  compact?: boolean;
}> = ({
  participant,
  localVideoRef,
  screenVideoRef,
  screenStream,
  blurEnabled = false,
  isPinned,
  onTogglePin,
  onMuteRemote,
  compact = false,
}) => {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!participant.isLocal && remoteVideoRef.current && participant.stream) {
      remoteVideoRef.current.srcObject = participant.stream;
    }
  }, [participant.isLocal, participant.stream]);

  const initial = (participant.name || 'C').trim()[0]?.toUpperCase() || 'C';
  const showScreenStage = Boolean(participant.isLocal && participant.isScreenSharing);

  return (
    <div
      className={`relative w-full h-full rounded-xl overflow-hidden bg-[#2D3035] border transition-colors group flex items-center justify-center ${
        isPinned
          ? 'border-[#8AB4F8]'
          : !participant.mic
          ? 'border-white/10'
          : 'border-white/10 hover:border-white/25'
      }`}
    >
      {showScreenStage ? (
        screenStream ? (
          <video
            ref={screenVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain bg-[#111317]"
          />
        ) : (
          <div className="w-full h-full bg-[#131720] flex flex-col items-center justify-center p-6 text-center">
            <div className="w-full max-w-2xl rounded-xl border border-white/10 bg-[#1B212C] p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <div className="flex items-center gap-2 text-xs text-[#8AB4F8] font-medium">
                  <MonitorUp size={15} />
                  <span>Apresentação de Tela · Google Workspace OS</span>
                </div>
                <span className="text-[11px] text-white/50 font-mono tabular-nums">1080p · Compartilhado</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-left mb-4">
                <div className="rounded-lg bg-white/5 p-3 border border-white/5">
                  <div className="text-[11px] text-white/50">ARR Q1 2026</div>
                  <div className="text-lg font-semibold text-white tabular-nums mt-0.5">R$ 18,4M</div>
                </div>
                <div className="rounded-lg bg-white/5 p-3 border border-white/5">
                  <div className="text-[11px] text-white/50">Net Retention</div>
                  <div className="text-lg font-semibold text-emerald-400 tabular-nums mt-0.5">128%</div>
                </div>
                <div className="rounded-lg bg-white/5 p-3 border border-white/5">
                  <div className="text-[11px] text-white/50">Sprint Velocity</div>
                  <div className="text-lg font-semibold text-[#8AB4F8] tabular-nums mt-0.5">94%</div>
                </div>
              </div>
              <p className="text-xs text-white/60">
                Sua janela do Workspace está visível para os participantes desta chamada.
              </p>
            </div>
          </div>
        )
      ) : participant.isLocal ? (
        <>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className={`w-full h-full object-cover transform scale-x-[-1] transition-all duration-300 ${
              participant.cam ? 'opacity-100' : 'opacity-0'
            } ${blurEnabled ? 'blur-[2px] brightness-105' : ''}`}
          />
          {!participant.cam && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#282B30]">
              <div
                className={`${compact ? 'w-14 h-14 text-xl' : 'w-24 h-24 text-3xl'} rounded-full ${
                  participant.avatarColor || 'bg-blue-600'
                } flex items-center justify-center font-semibold text-white shadow-lg select-none`}
              >
                {initial}
              </div>
            </div>
          )}
        </>
      ) : participant.stream && participant.cam ? (
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2">
          <div
            className={`${compact ? 'w-14 h-14 text-xl' : 'w-24 h-24 text-3xl'} rounded-full ${
              participant.avatarColor || 'bg-purple-600'
            } flex items-center justify-center text-white font-semibold shadow-lg select-none`}
          >
            {initial}
          </div>
        </div>
      )}

      {/* Top Left Hand Raised */}
      {participant.handRaised && (
        <div className="absolute top-3 left-3 bg-[#FBBC04] text-[#202124] px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1.5 text-xs font-semibold z-10">
          <Hand size={13} />
          {!compact && <span>Mão levantada</span>}
        </div>
      )}

      {/* Top Right Mic & Hover Actions */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
        {!participant.mic && (
          <div
            className="bg-black/65 p-1.5 rounded-full backdrop-blur-sm text-red-400"
            title="Microfone desativado"
          >
            <MicOff size={14} />
          </div>
        )}
        <button
          type="button"
          onClick={() => onTogglePin(participant.id)}
          aria-label={isPinned ? `Desafixar ${participant.name}` : `Fixar ${participant.name} na tela`}
          title={isPinned ? 'Desafixar da tela' : 'Fixar na tela'}
          className={`p-1.5 rounded-full backdrop-blur-sm transition-opacity ${
            isPinned
              ? 'bg-[#8AB4F8] text-[#202124] opacity-100'
              : 'bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-black/80'
          }`}
        >
          {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
        </button>
        {!participant.isLocal && onMuteRemote && participant.mic && (
          <button
            type="button"
            onClick={() => onMuteRemote(participant.id)}
            aria-label={`Desativar som de ${participant.name}`}
            title="Desativar som do participante"
            className="p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-red-500/80 transition-opacity"
          >
            <MicOff size={14} />
          </button>
        )}
      </div>

      {/* Bottom Name Scrim */}
      <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between pointer-events-none">
        <span className="text-white text-xs font-medium bg-black/55 px-2.5 py-1 rounded-md backdrop-blur-sm truncate max-w-[80%]">
          {participant.isLocal ? 'Você' : participant.name}
          {participant.isScreenSharing ? ' · Apresentando' : ''}
        </span>
      </div>
    </div>
  );
};

export default function MeetApp({
  onClose,
  data,
  onOpenApp,
  onUpdateEvents,
  showToast,
  isDarkMode = false,
}: MeetAppProps) {
  const [view, setView] = useState<'home' | 'lobby' | 'call' | 'ended'>('home');
  const [meetingInput, setMeetingInput] = useState('');
  const [showNewMeetingMenu, setShowNewMeetingMenu] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [laterLinkModalCode, setLaterLinkModalCode] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Schedule Modal fields
  const [scheduleTitle, setScheduleTitle] = useState('Reunião de Alinhamento');
  const [scheduleDate, setScheduleDate] = useState(() => formatLocalDateInput(new Date()));
  const [scheduleStart, setScheduleStart] = useState('15:00');
  const [scheduleDuration, setScheduleDuration] = useState(45);
  const [scheduleGuests, setScheduleGuests] = useState('');

  // Call & Peer state
  const [myPeerId, setMyPeerId] = useState<string>('');
  const [meetingId, setMeetingId] = useState<string>('');
  const [meetingTitle, setMeetingTitle] = useState<string>('Reunião instantânea');
  const [activeCalendarEvent, setActiveCalendarEvent] = useState<CalendarEvent | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  const [callSeconds, setCallSeconds] = useState(0);
  const [lastCallDuration, setLastCallDuration] = useState(0);
  const [savedSummaryDoc, setSavedSummaryDoc] = useState<EnrichedDriveItem | null>(null);
  const [allowScreenShare, setAllowScreenShare] = useState(true);

  // Media controls
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [blurEnabled, setBlurEnabled] = useState(false);
  const [noiseReduction, setNoiseReduction] = useState(true);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [captions, setCaptions] = useState<MeetCaption[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Layout & Panels
  const [layoutMode, setLayoutMode] = useState<MeetLayoutMode>('auto');
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [sidePanel, setSidePanel] = useState<'none' | 'chat' | 'people' | 'info' | 'activities'>('none');
  const [activitiesTab, setActivitiesTab] = useState<'polls' | 'qa'>('polls');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

  // Devices
  const [devices, setDevices] = useState<MediaDeviceOption[]>([]);
  const [selectedMicId, setSelectedMicId] = useState('default');
  const [selectedSpeakerId, setSelectedSpeakerId] = useState('default');
  const [selectedCamId, setSelectedCamId] = useState('default');

  // People, Waiting Room, Chat, Polls, Q&A
  const [peopleFilter, setPeopleFilter] = useState('');
  const [waitingGuests, setWaitingGuests] = useState<WaitingGuest[]>([]);
  const [allowParticipantChat, setAllowParticipantChat] = useState(true);
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [showReactionMenu, setShowReactionMenu] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: number; emoji: string; left: number }[]>([]);
  const [volumeLevel, setVolumeLevel] = useState(0);

  const [polls, setPolls] = useState<MeetPoll[]>([]);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [newPollQuestion, setNewPollQuestion] = useState('');
  const [newPollOpt1, setNewPollOpt1] = useState('');
  const [newPollOpt2, setNewPollOpt2] = useState('');

  const [questions, setQuestions] = useState<MeetQuestion[]>([]);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [qaFilter, setQaFilter] = useState<'all' | 'unanswered'>('all');

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const localStream = useRef<MediaStream | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<Map<string, { call?: MediaConnection; conn?: DataConnection }>>(new Map());
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const dataArray = useRef<Uint8Array | null>(null);
  const animationRef = useRef<number | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const reactionMenuRef = useRef<HTMLDivElement>(null);
  const handledDeepLinkRef = useRef<string | null>(null);
  const micOnRef = useRef(micOn);
  const camOnRef = useRef(camOn);
  micOnRef.current = micOn;
  camOnRef.current = camOn;

  const toast = (msg: string) => (showToast ? showToast(msg) : console.log(msg));

  const upcomingMeetings = useMemo(
    () => filterUpcomingMeetMeetings(data?.events || [], currentTime),
    [data?.events, currentTime]
  );

  // Sync PeerJS lifecycle
  useEffect(() => {
    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', (id) => {
      setMyPeerId(id);
    });

    peer.on('call', (call) => {
      if (localStream.current) {
        call.answer(localStream.current);
        handleMediaCall(call);
      }
    });

    peer.on('connection', (conn) => {
      handleDataConnection(conn);
    });

    peer.on('error', () => {
      // Quietly handle peer network unavailability in offline/headless mode
    });

    return () => {
      peer.destroy();
      connectionsRef.current.clear();
    };
  }, []);

  // Load media devices
  const refreshDevices = async () => {
    try {
      if (navigator.mediaDevices?.enumerateDevices) {
        const list = await navigator.mediaDevices.enumerateDevices();
        const mapped: MediaDeviceOption[] = list
          .filter((d) => d.kind === 'audioinput' || d.kind === 'audiooutput' || d.kind === 'videoinput')
          .map((d, idx) => ({
            deviceId: d.deviceId || `${d.kind}_${idx}`,
            label:
              d.label ||
              (d.kind === 'audioinput'
                ? `Microfone Padrão (${idx + 1})`
                : d.kind === 'audiooutput'
                ? `Alto-falante do Sistema (${idx + 1})`
                : `Câmera Integrada HD (${idx + 1})`),
            kind: d.kind as 'audioinput' | 'audiooutput' | 'videoinput',
          }));
        if (mapped.length > 0) {
          setDevices(mapped);
          return;
        }
      }
    } catch {
      // Fallback below
    }
    setDevices([
      { deviceId: 'default', label: 'Microfone Padrão (Workspace Audio)', kind: 'audioinput' },
      { deviceId: 'default', label: 'Alto-falantes Padrão (Sistema)', kind: 'audiooutput' },
      { deviceId: 'default', label: 'Câmera Integrada HD', kind: 'videoinput' },
    ]);
  };

  useEffect(() => {
    refreshDevices();
  }, []);

  // Screen video ref attachment
  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream;
    }
  }, [screenStream, pinnedId, layoutMode]);

  // Call & Recording timers
  useEffect(() => {
    if (view !== 'call') {
      setCallSeconds(0);
      setRecordingSeconds(0);
      setIsRecording(false);
      return;
    }
    const timer = setInterval(() => {
      setCallSeconds((s) => s + 1);
      setRecordingSeconds((r) => (isRecording ? r + 1 : r));
    }, 1000);
    return () => clearInterval(timer);
  }, [view, isRecording]);

  // Clock update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Captions stream (Web Speech API + live speaker feed when captionsOn)
  useEffect(() => {
    if (!captionsOn || view !== 'call') return;
    const nowTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setCaptions((prev) =>
      prev.length > 0
        ? prev
        : [
            {
              id: `cap_${Date.now()}`,
              speaker: data?.user?.name || 'Você',
              text: 'Legendas em tempo real ativadas para esta reunião.',
              time: nowTime(),
            },
          ]
    );

    const mediaWin = window as WindowWithWebMedia;
    const SpeechRec = mediaWin.SpeechRecognition || mediaWin.webkitSpeechRecognition;
    let recognition: SpeechRecognitionInstanceLike | null = null;
    if (SpeechRec && micOn) {
      try {
        recognition = new SpeechRec();
        recognition.lang = 'pt-BR';
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.onresult = (event: SpeechRecognitionResultEventLike) => {
          const last = event.results[event.results.length - 1];
          const transcript = last?.[0]?.transcript?.trim();
          if (transcript) {
            setCaptions((prev) => [
              ...prev.slice(-3),
              { id: `cap_${Date.now()}`, speaker: data?.user?.name || 'Você', text: transcript, time: nowTime() },
            ]);
          }
        };
        recognition.start();
      } catch {
        // Ignore speech recognition permission errors in headless browser
      }
    }

    return () => {
      if (recognition) {
        try {
          recognition.stop();
        } catch {
          // ignore
        }
      }
    };
  }, [captionsOn, view, micOn]);

  const handleMediaCall = (call: MediaConnection) => {
    const existing = connectionsRef.current.get(call.peer) || {};
    connectionsRef.current.set(call.peer, { ...existing, call });

    call.on('stream', (remoteStream) => {
      setRemoteParticipants((prev) => {
        if (prev.find((p) => p.id === call.peer)) return prev;
        return [
          ...prev,
          {
            id: call.peer,
            name: 'Convidado',
            role: 'guest',
            stream: remoteStream,
            mic: true,
            cam: true,
            handRaised: false,
            avatarColor: AVATAR_PALETTE[prev.length % AVATAR_PALETTE.length],
          },
        ];
      });
    });

    call.on('close', () => {
      setRemoteParticipants((prev) => prev.filter((p) => p.id !== call.peer));
    });
  };

  const handleDataConnection = (conn: DataConnection) => {
    const existing = connectionsRef.current.get(conn.peer) || {};
    connectionsRef.current.set(conn.peer, { ...existing, conn });

    conn.on('open', () => {
      conn.send({
        type: 'status',
        mic: micOn,
        cam: camOn,
        handRaised,
        name: data?.user?.name || 'Usuário',
      });
    });

    conn.on('data', (incoming: unknown) => {
      if (isMeetDataMessage(incoming)) {
        handleIncomingData(conn.peer, incoming);
      }
    });

    conn.on('close', () => {
      setRemoteParticipants((prev) => prev.filter((p) => p.id !== conn.peer));
    });
  };

  const handleIncomingData = (peerId: string, incoming: MeetDataMessage) => {
    switch (incoming.type) {
      case 'chat':
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}_${Math.random()}`,
            sender: incoming.senderName || 'Convidado',
            text: incoming.message,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isSelf: false,
          },
        ]);
        if (sidePanel !== 'chat') {
          setUnreadChatCount((c) => c + 1);
          toast(`Nova mensagem de ${incoming.senderName || 'Convidado'}`);
        }
        break;
      case 'emoji':
        triggerReaction(incoming.emoji, true);
        break;
      case 'status':
        setRemoteParticipants((prev) =>
          prev.map((p) =>
            p.id === peerId
              ? {
                  ...p,
                  mic: incoming.mic !== undefined ? incoming.mic : p.mic,
                  cam: incoming.cam !== undefined ? incoming.cam : p.cam,
                  handRaised: incoming.handRaised !== undefined ? incoming.handRaised : p.handRaised,
                  name: incoming.name || p.name,
                }
              : p
          )
        );
        break;
      case 'poll_vote':
        setPolls((prev) => voteInPoll(prev, incoming.pollId, incoming.optionId));
        break;
      case 'qa_add':
        if (incoming.question) {
          setQuestions((prev) => [incoming.question, ...prev]);
        }
        break;
    }
  };

  const broadcastData = (payload: MeetDataMessage) => {
    connectionsRef.current.forEach((connObj) => {
      if (connObj.conn && connObj.conn.open) {
        connObj.conn.send(payload);
      }
    });
  };

  const connectToPeer = (remoteId: string) => {
    if (!peerRef.current || !localStream.current) return;
    const call = peerRef.current.call(remoteId, localStream.current);
    handleMediaCall(call);
    const conn = peerRef.current.connect(remoteId);
    handleDataConnection(conn);
  };

  const setupAudioAnalysis = (stream: MediaStream) => {
    try {
      if (!audioContext.current) {
        const AudioCtx = window.AudioContext || (window as WindowWithWebMedia).webkitAudioContext;
        if (!AudioCtx) return;
        audioContext.current = new AudioCtx();
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
          for (let i = 0; i < bufferLength; i += 1) sum += dataArray.current[i];
          setVolumeLevel(sum / bufferLength);
        }
        animationRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch {
      // Ignore AudioContext restriction if headless
    }
  };

  const stopAllMedia = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => track.stop());
      localStream.current = null;
    }
  };

  const startCamera = async (preserveToggleState = false) => {
    try {
      stopAllMedia();
      const constraints: MediaStreamConstraints = {
        video: selectedCamId && selectedCamId !== 'default' ? { deviceId: { exact: selectedCamId } } : true,
        audio:
          selectedMicId && selectedMicId !== 'default'
            ? { deviceId: { exact: selectedMicId }, noiseSuppression: noiseReduction }
            : { noiseSuppression: noiseReduction },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStream.current = stream;

      const targetMic = preserveToggleState ? micOnRef.current : true;
      const targetCam = preserveToggleState ? camOnRef.current : true;
      stream.getAudioTracks().forEach((t) => {
        t.enabled = targetMic;
      });
      stream.getVideoTracks().forEach((t) => {
        t.enabled = targetCam;
      });

      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setupAudioAnalysis(stream);
      setCamOn(targetCam);
      setMicOn(targetMic);
    } catch {
      setCamOn(false);
    }
  };

  useEffect(() => {
    if (view === 'lobby' || view === 'call') {
      const hasLiveTracks = Boolean(
        localStream.current && localStream.current.getTracks().some((track) => track.readyState === 'live')
      );
      if (hasLiveTracks && localStream.current) {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream.current;
        }
        localStream.current.getAudioTracks().forEach((t) => {
          t.enabled = micOnRef.current;
        });
        localStream.current.getVideoTracks().forEach((t) => {
          t.enabled = camOnRef.current;
        });
      } else {
        startCamera(view === 'call');
      }
    } else {
      stopAllMedia();
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [view]);

  useEffect(() => {
    return () => {
      stopAllMedia();
    };
  }, []);

  useEffect(() => {
    const rawCode = data?.roomCode || data?.event?.meetLink;
    if (!rawCode) return;
    const normalized = normalizeMeetingCode(rawCode);
    if (!normalized || handledDeepLinkRef.current === normalized) return;
    handledDeepLinkRef.current = normalized;

    const matchedEvent =
      data?.event ||
      (data?.events || []).find((ev) => ev.meetLink && normalizeMeetingCode(ev.meetLink) === normalized);
    void joinMeetingByCode(normalized, matchedEvent?.title, matchedEvent);
  }, [data?.roomCode, data?.event, data?.events]);

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (showNewMeetingMenu && menuRef.current && !menuRef.current.contains(target)) {
        setShowNewMeetingMenu(false);
      }
      if (showMoreMenu && moreMenuRef.current && !moreMenuRef.current.contains(target)) {
        setShowMoreMenu(false);
      }
      if (showReactionMenu && reactionMenuRef.current && !reactionMenuRef.current.contains(target)) {
        setShowReactionMenu(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [showNewMeetingMenu, showMoreMenu, showReactionMenu]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDeviceModal) {
          setShowDeviceModal(false);
          return;
        }
        if (laterLinkModalCode) {
          setLaterLinkModalCode(null);
          return;
        }
        if (showScheduleModal) {
          setShowScheduleModal(false);
          return;
        }
        if (showInviteModal) {
          setShowInviteModal(false);
          return;
        }
        if (showNewMeetingMenu || showMoreMenu || showReactionMenu) {
          setShowNewMeetingMenu(false);
          setShowMoreMenu(false);
          setShowReactionMenu(false);
          return;
        }
        if (sidePanel !== 'none') {
          setSidePanel('none');
        }
        return;
      }

      if (view === 'call' && (e.ctrlKey || e.metaKey)) {
        const lower = e.key.toLowerCase();
        if (lower === 'd') {
          e.preventDefault();
          toggleMic();
        } else if (lower === 'e') {
          e.preventDefault();
          toggleCam();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    view,
    showDeviceModal,
    laterLinkModalCode,
    showScheduleModal,
    showInviteModal,
    showNewMeetingMenu,
    showMoreMenu,
    showReactionMenu,
    sidePanel,
    micOn,
    camOn,
  ]);

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [messages, sidePanel]);

  const toggleMic = () => {
    const enabled = !micOn;
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
    setMicOn(enabled);
    if (!enabled) setVolumeLevel(0);
    broadcastData({ type: 'status', mic: enabled });
  };

  const toggleCam = () => {
    const enabled = !camOn;
    if (localStream.current && localStream.current.getVideoTracks().length > 0) {
      localStream.current.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
      setCamOn(enabled);
      broadcastData({ type: 'status', cam: enabled });
    } else if (enabled) {
      setCamOn(true);
      startCamera();
    } else {
      setCamOn(false);
    }
  };

  const toggleHand = () => {
    const newState = !handRaised;
    setHandRaised(newState);
    broadcastData({ type: 'status', handRaised: newState });
    toast(newState ? 'Você levantou a mão' : 'Você abaixou a mão');
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
    }
    setIsScreenSharing(false);
    broadcastData({ type: 'status', isScreenSharing: false });
    toast('Apresentação de tela encerrada');
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
      return;
    }
    if (!allowScreenShare && !isHost) {
      toast('O organizador desativou o compartilhamento de tela');
      return;
    }
    try {
      if (navigator.mediaDevices?.getDisplayMedia) {
        const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        display.getVideoTracks()[0].onended = () => stopScreenShare();
        setScreenStream(display);
        setIsScreenSharing(true);
        broadcastData({ type: 'status', isScreenSharing: true });
        toast('Você está apresentando sua tela');
        return;
      }
    } catch {
      // Fall back to Workspace simulated screen presentation when display picker is denied/headless
    }
    setScreenStream(null);
    setIsScreenSharing(true);
    broadcastData({ type: 'status', isScreenSharing: true });
    toast('Apresentação do Workspace ativada na chamada');
  };

  const createInstantMeeting = async () => {
    let code = generateMeetingCode();
    try {
      const realSpace = await bridge.createRealMeetSpace();
      if (realSpace?.meetingCode) {
        code = realSpace.meetingCode;
        toast('Sala real criada na sua conta Google Meet');
      }
    } catch {
      /* offline or unauthenticated: continue with local room code */
    }
    setMeetingId(code);
    setMeetingTitle('Reunião instantânea');
    setActiveCalendarEvent(null);
    setIsHost(true);
    setShowNewMeetingMenu(false);
    setView('lobby');
    await bridge.registerMeeting(code, myPeerId || code);
  };

  const createLaterMeeting = async () => {
    let code = generateMeetingCode();
    try {
      const realSpace = await bridge.createRealMeetSpace();
      if (realSpace?.meetingCode) {
        code = realSpace.meetingCode;
        toast('Link real gerado via Google Meet');
      }
    } catch {
      /* offline or unauthenticated: continue with local room code */
    }
    setLaterLinkModalCode(code);
    setShowNewMeetingMenu(false);
    await bridge.registerMeeting(code, myPeerId || code);
  };

  const joinMeetingByCode = async (rawInput: string, titleOverride?: string, calEvent?: CalendarEvent) => {
    const normalized = normalizeMeetingCode(rawInput);
    if (!normalized) return;
    const hostPeer = await bridge.getMeetingPeer(normalized);
    setMeetingId(hostPeer || normalized);
    setMeetingTitle(titleOverride || `Sala ${normalized}`);
    setActiveCalendarEvent(calEvent || null);
    setIsHost(Boolean(calEvent));

    if (calEvent?.guests && calEvent.guests.length > 0) {
      const seededGuests: RemoteParticipant[] = calEvent.guests
        .filter((g) => g.email !== data?.user?.email)
        .slice(0, 3)
        .map((g, i) => ({
          id: `guest_${i}_${g.email}`,
          name: g.name || g.email.split('@')[0],
          email: g.email,
          role: 'guest',
          mic: i % 2 === 0,
          cam: false,
          handRaised: false,
          avatarColor: AVATAR_PALETTE[(i + 1) % AVATAR_PALETTE.length],
        }));
      setRemoteParticipants(seededGuests);
    } else {
      setRemoteParticipants([]);
    }
    setView('lobby');
  };

  const handleSaveScheduledMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleTitle.trim()) return;
    const code = generateMeetingCode();
    const meetLink = `https://meet.google.com/${code}`;
    const startDt = new Date(`${scheduleDate}T${scheduleStart}:00`);
    const endDt = new Date(startDt.getTime() + scheduleDuration * 60000);
    const guests = scheduleGuests
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((email) => ({
        email,
        name: email.split('@')[0],
        responseStatus: 'needsAction' as const,
      }));

    const res = await bridge.createCalendarEvent({
      title: scheduleTitle.trim(),
      start: startDt.toISOString(),
      end: endDt.toISOString(),
      calendarId: 'primary',
      location: 'Google Meet',
      meetLink,
      description: `Videoconferência agendada via Google Meet (${code})`,
      guests,
    });

    if (res.success) {
      const all = await bridge.getAllEvents();
      onUpdateEvents?.(all);
      setShowScheduleModal(false);
      toast(`Reunião "${scheduleTitle.trim()}" agendada no Google Agenda`);
    }
  };

  const enterCall = () => {
    setSavedSummaryDoc(null);
    if (!isHost && meetingId && peerRef.current && localStream.current) {
      try {
        connectToPeer(meetingId);
      } catch {
        // Ignore direct peer errors if room is local
      }
    }
    setView('call');
  };

  const leaveCall = (endForAll = false) => {
    setLastCallDuration(callSeconds);
    stopAllMedia();
    if (screenStream) screenStream.getTracks().forEach((track) => track.stop());
    connectionsRef.current.forEach((c) => {
      c.call?.close();
      c.conn?.close();
    });
    connectionsRef.current.clear();
    setScreenStream(null);
    setIsScreenSharing(false);
    setPinnedId(null);
    setWaitingGuests([]);
    setSidePanel('none');
    setShowMoreMenu(false);
    setShowReactionMenu(false);
    if (endForAll) {
      setRemoteParticipants([]);
      toast('Reunião encerrada para todos os participantes');
    }
    setView('ended');
  };

  const rejoinCall = () => {
    setSavedSummaryDoc(null);
    setView('call');
  };

  const returnToHome = () => {
    setRemoteParticipants([]);
    setSavedSummaryDoc(null);
    setView('home');
  };

  const handleExportSummaryToDocs = async () => {
    const html = formatMeetingSummaryHtml({
      title: meetingTitle,
      meetingId,
      durationSeconds: view === 'call' ? callSeconds : lastCallDuration,
      participants: allParticipants.map((p) => ({ name: p.name, role: p.role })),
      messages: messages.map((m) => ({ sender: m.sender, text: m.text, time: m.time })),
      captions,
      polls,
      questions,
    });
    const docName = `Ata · ${meetingTitle} (${meetingId || 'meet'})`;
    const created = await bridge.createDriveDocument('doc', docName);
    await bridge.saveFileContent(created.id, html);
    setSavedSummaryDoc(created);
    toast(`Ata "${docName}" salva no Google Docs`);
  };

  const handleSendMessage = () => {
    if (!chatMessage.trim()) return;
    if (!allowParticipantChat && !isHost) {
      toast('O organizador restringiu o envio de mensagens');
      return;
    }
    const text = chatMessage.trim();
    const msg: ChatMessage = {
      id: `${Date.now()}`,
      sender: 'Você',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSelf: true,
    };
    setMessages((prev) => [...prev, msg]);
    setChatMessage('');
    broadcastData({ type: 'chat', message: text, senderName: data?.user?.name || 'Usuário' });
  };

  const triggerReaction = (emoji: string, isRemote = false) => {
    const id = Date.now() + Math.random();
    const left = isRemote ? Math.random() * 75 + 10 : 20 + Math.random() * 20;
    setFloatingEmojis((prev) => [...prev, { id, emoji, left }]);
    setShowReactionMenu(false);
    if (!isRemote) broadcastData({ type: 'emoji', emoji });
    setTimeout(() => setFloatingEmojis((prev) => prev.filter((e) => e.id !== id)), 2000);
  };

  const toggleSidePanel = (panel: 'chat' | 'people' | 'info' | 'activities') => {
    const next = sidePanel === panel ? 'none' : panel;
    setSidePanel(next);
    if (next === 'chat') setUnreadChatCount(0);
  };

  const handleTogglePin = (id: string) => {
    setPinnedId((prev) => (prev === id ? null : id));
  };

  const handleMuteRemote = (id: string) => {
    setRemoteParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, mic: false } : p)));
    toast('Microfone do participante desativado');
  };

  const handleMuteAll = () => {
    setRemoteParticipants((prev) => prev.map((p) => ({ ...p, mic: false })));
    toast('Todos os participantes foram silenciados');
  };

  const handleRemoveParticipant = (id: string) => {
    setRemoteParticipants((prev) => prev.filter((p) => p.id !== id));
    if (pinnedId === id) setPinnedId(null);
    toast('Participante removido da chamada');
  };

  const handleAddParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim()) return;
    const newGuest: RemoteParticipant = {
      id: `invited_${Date.now()}`,
      name: inviteName.trim(),
      email: inviteEmail.trim() || `${inviteName.trim().toLowerCase().replace(/\s+/g, '.')}@workspace.os`,
      role: 'guest',
      mic: true,
      cam: false,
      handRaised: false,
      avatarColor: AVATAR_PALETTE[(remoteParticipants.length + 1) % AVATAR_PALETTE.length],
    };
    setRemoteParticipants((prev) => [...prev, newGuest]);
    setInviteName('');
    setInviteEmail('');
    setShowInviteModal(false);
    toast(`${newGuest.name} entrou na reunião`);
  };

  const simulateWaitingKnock = () => {
    const guestNumber = waitingGuests.length + 1;
    const guest: WaitingGuest = {
      id: `wait_${Date.now()}`,
      name: `Convidado ${guestNumber}`,
      email: '',
      requestedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setWaitingGuests((prev) => [...prev, guest]);
    toast(`${guest.name} pediu para participar`);
  };

  const admitGuest = (guest: WaitingGuest) => {
    setWaitingGuests((prev) => prev.filter((w) => w.id !== guest.id));
    setRemoteParticipants((prev) => [
      ...prev,
      {
        id: guest.id,
        name: guest.name,
        email: guest.email,
        role: 'guest',
        mic: true,
        cam: false,
        handRaised: false,
        avatarColor: 'bg-teal-600',
      },
    ]);
    toast(`${guest.name} foi admitido(a) na reunião`);
  };

  const denyGuest = (guestId: string) => {
    setWaitingGuests((prev) => prev.filter((w) => w.id !== guestId));
    toast('Solicitação recusada');
  };

  const handleCreatePoll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPollQuestion.trim() || !newPollOpt1.trim() || !newPollOpt2.trim()) return;
    const created: MeetPoll = {
      id: `poll_${Date.now()}`,
      question: newPollQuestion.trim(),
      launched: true,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      votedOptionId: null,
      options: [
        { id: 'o1', text: newPollOpt1.trim(), votes: 0 },
        { id: 'o2', text: newPollOpt2.trim(), votes: 0 },
      ],
    };
    setPolls((prev) => [created, ...prev]);
    setNewPollQuestion('');
    setNewPollOpt1('');
    setNewPollOpt2('');
    setShowCreatePoll(false);
    toast('Enquete publicada na reunião');
  };

  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionText.trim()) return;
    const q: MeetQuestion = {
      id: `qa_${Date.now()}`,
      author: data?.user?.name || 'Você',
      text: newQuestionText.trim(),
      upvotes: 1,
      upvotedByMe: true,
      answered: false,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setQuestions((prev) => [q, ...prev]);
    setNewQuestionText('');
    broadcastData({ type: 'qa_add', question: q });
  };

  const copyMeetingDetails = () => {
    const url = `https://meet.google.com/${meetingId}`;
    navigator.clipboard?.writeText(`${meetingTitle}\nLink da videochamada: ${url}\nCódigo: ${meetingId}`);
    toast('Informações de participação copiadas');
  };

  const playTestSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as WindowWithWebMedia).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
      toast('Reproduzindo áudio de teste nos alto-falantes');
    } catch {
      toast('Áudio de saída configurado');
    }
  };

  // Unified participants list for stage & People panel
  const allParticipants: RemoteParticipant[] = useMemo(() => {
    const localParticipant: RemoteParticipant = {
      id: 'local',
      name: data?.user?.name || 'Você',
      email: data?.user?.email || '',
      role: isHost ? 'host' : 'guest',
      mic: micOn,
      cam: camOn,
      handRaised,
      isScreenSharing,
      isLocal: true,
      avatarColor: 'bg-blue-600',
    };
    return [localParticipant, ...remoteParticipants];
  }, [data?.user, isHost, micOn, camOn, handRaised, isScreenSharing, remoteParticipants]);

  const { spotlight, others } = useMemo(
    () => resolveSpotlightParticipant(allParticipants, pinnedId),
    [allParticipants, pinnedId]
  );

  const gridConfig = useMemo(
    () => computeGridColumns(allParticipants.length, layoutMode, Boolean(spotlight)),
    [allParticipants.length, layoutMode, spotlight]
  );

  const micDevices = devices.filter((d) => d.kind === 'audioinput');
  const speakerDevices = devices.filter((d) => d.kind === 'audiooutput');
  const camDevices = devices.filter((d) => d.kind === 'videoinput');

  const deviceModal = showDeviceModal && (
    <div
      className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => setShowDeviceModal(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg max-h-[90%] overflow-y-auto rounded-2xl border shadow-2xl ${
          isDarkMode || view === 'call'
            ? 'bg-[#282A2E] border-white/10 text-white'
            : 'bg-white border-gray-200 text-[#202124]'
        }`}
      >
        <div className="px-6 py-4 border-b border-current/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Settings size={18} className="text-[#1A73E8]" />
            <h2 className="text-base font-semibold">Configurações de Áudio e Vídeo</h2>
          </div>
          <button
            type="button"
            onClick={() => setShowDeviceModal(false)}
            aria-label="Fechar configurações"
            className="p-1.5 rounded-full hover:bg-black/10"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5 text-sm">
          <div>
            <label className="block text-xs font-semibold mb-1.5 opacity-75">Microfone</label>
            <select
              aria-label="Selecionar microfone"
              value={selectedMicId}
              onChange={(e) => setSelectedMicId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-current/15 bg-transparent outline-none"
            >
              {micDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId} className="text-black">
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between py-2 border-y border-current/10">
            <div>
              <div className="font-medium">Cancelamento de ruído</div>
              <div className="text-xs opacity-65">Filtra ruídos de teclado e ambiente</div>
            </div>
            <button
              type="button"
              onClick={() => setNoiseReduction((v) => !v)}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                noiseReduction ? 'bg-[#1A73E8] text-white' : 'bg-black/15 opacity-70'
              }`}
            >
              {noiseReduction ? 'Ativado' : 'Desativado'}
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold opacity-75">Alto-falantes</label>
              <button
                type="button"
                onClick={playTestSound}
                className="text-xs text-[#1A73E8] hover:underline flex items-center gap-1"
              >
                <Volume2 size={13} /> Testar áudio
              </button>
            </div>
            <select
              aria-label="Selecionar alto-falante"
              value={selectedSpeakerId}
              onChange={(e) => setSelectedSpeakerId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-current/15 bg-transparent outline-none"
            >
              {speakerDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId} className="text-black">
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 opacity-75">Câmera</label>
            <select
              aria-label="Selecionar câmera"
              value={selectedCamId}
              onChange={(e) => setSelectedCamId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-current/15 bg-transparent outline-none"
            >
              {camDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId} className="text-black">
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-current/10">
            <div>
              <div className="font-medium">Desfoque de plano de fundo</div>
              <div className="text-xs opacity-65">Suaviza o vídeo local</div>
            </div>
            <button
              type="button"
              onClick={() => setBlurEnabled((v) => !v)}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                blurEnabled ? 'bg-[#1A73E8] text-white' : 'bg-black/15 opacity-70'
              }`}
            >
              {blurEnabled ? 'Ativo' : 'Desativado'}
            </button>
          </div>
        </div>

        <div className="px-6 py-3.5 border-t border-current/10 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setShowDeviceModal(false);
              if (view === 'lobby' || view === 'call') startCamera(true);
              toast('Dispositivos aplicados');
            }}
            className="px-4 py-2 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-semibold"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );

  // ---------------- VIEW 1: MEET HOME ----------------
  if (view === 'home') {
    return (
      <div
        className={`flex flex-col h-full font-sans relative overflow-hidden transition-colors ${
          isDarkMode ? 'bg-[#202124] text-white' : 'bg-white text-[#202124]'
        }`}
      >
        <header
          className={`h-16 px-4 sm:px-6 flex items-center justify-between shrink-0 border-b ${
            isDarkMode ? 'border-white/10' : 'border-gray-200'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <GoogleIcons.Meet className="w-7 h-7 sm:w-8 sm:h-8 shrink-0" />
            <span className="text-lg sm:text-xl font-medium tracking-tight whitespace-nowrap shrink-0">
              Google Meet
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-5 shrink-0">
            <div className="text-right hidden md:block tabular-nums">
              <div className="text-sm font-medium">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="text-xs opacity-60">
                {currentTime.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowDeviceModal(true)}
              aria-label="Configurações de áudio e vídeo"
              className={`p-2 rounded-full ${
                isDarkMode ? 'hover:bg-white/10 text-white/80' : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              <Settings size={20} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar Google Meet"
              className={`p-2 rounded-full ${
                isDarkMode ? 'hover:bg-white/10 text-white/80' : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              <X size={22} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-12 py-6 sm:py-8 flex items-start lg:items-center">
          <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            {/* Left Action Column */}
            <div className="lg:col-span-6 space-y-5 sm:space-y-6">
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-normal leading-tight tracking-tight">
                Videochamadas e reuniões para todos
              </h1>
              <p className={`text-sm sm:text-base md:text-lg leading-relaxed ${isDarkMode ? 'text-white/65' : 'text-gray-600'}`}>
                Conecte-se, colabore e apresente documentos ou planilhas de qualquer lugar com o Google Meet integrado ao seu Agenda.
              </p>

              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-1">
                <div className="relative w-full sm:w-auto" ref={menuRef}>
                  <button
                    type="button"
                    data-testid="meet-new-btn"
                    onClick={() => setShowNewMeetingMenu((v) => !v)}
                    className={`w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-medium text-sm whitespace-nowrap shrink-0 shadow-sm ${
                      isDarkMode
                        ? 'bg-[#8AB4F8] hover:bg-[#AECBFA] text-[#202124]'
                        : 'bg-[#1A73E8] hover:bg-[#1557B0] text-white'
                    }`}
                  >
                    <Video size={18} />
                    <span>Nova reunião</span>
                  </button>

                  {showNewMeetingMenu && (
                    <div
                      className={`absolute top-14 left-0 w-72 max-w-[calc(100vw-48px)] rounded-xl shadow-2xl py-2 z-50 border ${
                        isDarkMode ? 'bg-[#303134] border-white/10' : 'bg-white border-gray-200'
                      }`}
                    >
                      <button
                        type="button"
                        data-testid="meet-later-btn"
                        onClick={createLaterMeeting}
                        className={`w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm ${
                          isDarkMode ? 'hover:bg-white/10 text-white/90' : 'hover:bg-gray-100 text-gray-800'
                        }`}
                      >
                        <Link2 size={17} /> Criar uma reunião para depois
                      </button>
                      <button
                        type="button"
                        data-testid="meet-instant-btn"
                        onClick={createInstantMeeting}
                        className={`w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm ${
                          isDarkMode ? 'hover:bg-white/10 text-white/90' : 'hover:bg-gray-100 text-gray-800'
                        }`}
                      >
                        <Plus size={17} /> Iniciar uma reunião instantânea
                      </button>
                      <button
                        type="button"
                        data-testid="meet-schedule-btn"
                        onClick={() => {
                          setShowNewMeetingMenu(false);
                          setShowScheduleModal(true);
                        }}
                        className={`w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm ${
                          isDarkMode ? 'hover:bg-white/10 text-white/90' : 'hover:bg-gray-100 text-gray-800'
                        }`}
                      >
                        <Calendar size={17} /> Agendar no Google Agenda
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-1 min-w-0 w-full sm:w-auto">
                  <div
                    className={`flex items-center gap-2.5 border rounded-lg px-3 py-2.5 focus-within:border-[#1A73E8] focus-within:ring-1 focus-within:ring-[#1A73E8] flex-1 min-w-0 ${
                      isDarkMode ? 'border-white/25 bg-white/5' : 'border-gray-300 bg-white'
                    }`}
                  >
                    <Keyboard size={18} className="opacity-55 shrink-0" />
                    <input
                      type="text"
                      data-testid="meet-code-input"
                      aria-label="Digite um código ou link da reunião"
                      placeholder="Digite um código ou link"
                      className="bg-transparent border-none outline-none w-full min-w-0 text-sm"
                      value={meetingInput}
                      onChange={(e) => setMeetingInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && joinMeetingByCode(meetingInput)}
                    />
                  </div>

                  <button
                    type="button"
                    data-testid="meet-join-btn"
                    disabled={!meetingInput.trim()}
                    onClick={() => joinMeetingByCode(meetingInput)}
                    className="px-3.5 sm:px-4 py-2.5 text-sm font-medium text-[#1A73E8] hover:bg-[#1A73E8]/10 rounded-lg disabled:opacity-40 whitespace-nowrap shrink-0"
                  >
                    Participar
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Live Upcoming Meetings from Google Agenda */}
            <div className="lg:col-span-6">
              <div
                className={`rounded-2xl border p-5 ${
                  isDarkMode ? 'bg-[#282A2E] border-white/10' : 'bg-[#F8FAFD] border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-current/10">
                  <div>
                    <h2 className="text-sm font-semibold">Reuniões agendadas no Google Agenda</h2>
                    <p className="text-xs opacity-65">Entre com 1 clique diretamente na sala da equipe</p>
                  </div>
                  {onOpenApp && (
                    <button
                      type="button"
                      onClick={() => onOpenApp('calendar')}
                      className="text-xs font-medium text-[#1A73E8] hover:underline whitespace-nowrap shrink-0"
                    >
                      Abrir Agenda
                    </button>
                  )}
                </div>

                {upcomingMeetings.length === 0 ? (
                  <div className="py-10 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-[#1A73E8]/10 text-[#1A73E8] flex items-center justify-center mx-auto">
                      <Calendar size={22} />
                    </div>
                    <p className="text-sm font-medium">Nenhuma reunião com Google Meet pendente</p>
                    <button
                      type="button"
                      onClick={() => setShowScheduleModal(true)}
                      className="px-4 py-2 rounded-lg bg-[#1A73E8] text-white text-xs font-medium"
                    >
                      Agendar primeira reunião
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                    {upcomingMeetings.slice(0, 5).map((ev) => {
                      const startDate = new Date(ev.start);
                      const timeLabel = startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                      const dayLabel = startDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
                      return (
                        <div
                          key={ev.id}
                          className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-colors ${
                            isDarkMode
                              ? 'bg-[#202124] border-white/10 hover:border-white/25'
                              : 'bg-white border-gray-200 hover:border-[#1A73E8]/40'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-xs opacity-65 tabular-nums">
                              <span>{dayLabel}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-semibold text-[#1A73E8]">{timeLabel}</span>
                              {ev.guests && ev.guests.length > 0 && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{ev.guests.length} participantes</span>
                                </>
                              )}
                            </div>
                            <div className="font-medium text-sm truncate mt-0.5">{ev.title}</div>
                            <div className="text-[11px] font-mono opacity-55 truncate">{ev.meetCode}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => joinMeetingByCode(ev.meetCode, ev.title, ev)}
                            className="px-3.5 py-2 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-semibold whitespace-nowrap shrink-0"
                          >
                            Entrar
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Shareable Link Modal */}
        {laterLinkModalCode && (
          <div
            className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setLaterLinkModalCode(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md max-h-[90%] overflow-y-auto rounded-2xl p-6 shadow-2xl border ${
                isDarkMode ? 'bg-[#282A2E] border-white/10 text-white' : 'bg-white border-gray-200 text-[#202124]'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold">Link da reunião pronta</h3>
                <button
                  type="button"
                  onClick={() => setLaterLinkModalCode(null)}
                  aria-label="Fechar link da reunião"
                  className="p-1 rounded-full hover:bg-black/10"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="text-xs opacity-75 mb-4">
                Envie este link para as pessoas com quem você quer se reunir ou salve para mais tarde.
              </p>
              <div
                className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border ${
                  isDarkMode ? 'bg-black/25 border-white/15' : 'bg-gray-100 border-gray-200'
                }`}
              >
                <span className="text-xs font-mono truncate">https://meet.google.com/{laterLinkModalCode}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(`https://meet.google.com/${laterLinkModalCode}`);
                    toast('Link copiado para a área de transferência');
                  }}
                  aria-label="Copiar link"
                  className="p-1.5 rounded-md hover:bg-black/10 text-[#1A73E8] shrink-0"
                >
                  <Copy size={16} />
                </button>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button
                  type="button"
                  onClick={() => {
                    const code = laterLinkModalCode;
                    setLaterLinkModalCode(null);
                    joinMeetingByCode(code, 'Reunião agendada');
                  }}
                  className="px-4 py-2 rounded-lg bg-[#1A73E8] text-white text-xs font-semibold"
                >
                  Entrar agora
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Schedule in Google Agenda Modal */}
        {showScheduleModal && (
          <div
            className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowScheduleModal(false)}
          >
            <form
              onSubmit={handleSaveScheduledMeeting}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md max-h-[90%] overflow-y-auto rounded-2xl p-5 sm:p-6 shadow-2xl border space-y-4 ${
                isDarkMode ? 'bg-[#282A2E] border-white/10 text-white' : 'bg-white border-gray-200 text-[#202124]'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <Calendar size={18} className="text-[#1A73E8]" /> Agendar no Google Agenda
                </h3>
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  aria-label="Fechar agendamento"
                  className="p-1 rounded-full hover:bg-black/10"
                >
                  <X size={18} />
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 opacity-75">Título da reunião</label>
                <input
                  type="text"
                  required
                  value={scheduleTitle}
                  onChange={(e) => setScheduleTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-current/15 bg-transparent text-sm outline-none focus:border-[#1A73E8]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1 opacity-75">Data</label>
                  <input
                    type="date"
                    required
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-current/15 bg-transparent text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 opacity-75">Início</label>
                  <input
                    type="time"
                    required
                    value={scheduleStart}
                    onChange={(e) => setScheduleStart(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-current/15 bg-transparent text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 opacity-75">Duração</label>
                  <select
                    value={scheduleDuration}
                    onChange={(e) => setScheduleDuration(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-lg border border-current/15 bg-transparent text-xs outline-none"
                  >
                    <option value={30} className="text-black">30 min</option>
                    <option value={45} className="text-black">45 min</option>
                    <option value={60} className="text-black">60 min</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 opacity-75">Convidados (e-mails separados por vírgula)</label>
                <input
                  type="text"
                  value={scheduleGuests}
                  onChange={(e) => setScheduleGuests(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-current/15 bg-transparent text-xs outline-none focus:border-[#1A73E8]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium hover:bg-black/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-semibold"
                >
                  Salvar com link Meet
                </button>
              </div>
            </form>
          </div>
        )}

        {deviceModal}
      </div>
    );
  }

  // ---------------- VIEW 2: LOBBY (GREEN ROOM) ----------------
  if (view === 'lobby') {
    return (
      <div
        className={`flex flex-col h-full font-sans relative overflow-hidden ${
          isDarkMode ? 'bg-[#202124] text-white' : 'bg-white text-[#202124]'
        }`}
      >
        <div className="w-full px-4 sm:px-6 h-16 flex items-center justify-between shrink-0 border-b border-current/10">
          <div className="flex items-center gap-2">
            <GoogleIcons.Meet className="w-7 h-7" />
            <span className="text-lg font-medium">Google Meet</span>
          </div>
          <button
            type="button"
            onClick={returnToHome}
            className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-black/10"
          >
            Voltar ao início
          </button>
        </div>

        <div className="flex-1 w-full overflow-y-auto px-4 sm:px-8 py-6 sm:py-8 flex items-start lg:items-center justify-center">
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 items-center justify-center max-w-6xl w-full">
            <div className="w-full max-w-2xl">
              <div className="aspect-video bg-[#282B30] rounded-2xl overflow-hidden relative shadow-xl border border-white/10 flex items-center justify-center">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className={`w-full h-full object-cover transform scale-x-[-1] ${
                    camOn ? 'opacity-100' : 'opacity-0'
                  } ${blurEnabled ? 'blur-[2px]' : ''}`}
                />
                {!camOn && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60 gap-3">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-600 text-white text-xl sm:text-2xl font-semibold flex items-center justify-center">
                      {(data?.user?.name || 'C')[0]}
                    </div>
                    <span className="text-xs sm:text-sm">Câmera desativada</span>
                  </div>
                )}

                {/* Audio level bars */}
                <div className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-black/55 px-2.5 py-2 rounded-full backdrop-blur-md">
                  <div className="flex gap-1 h-4 items-end">
                    <div
                      className="w-1 bg-[#8AB4F8] rounded-full"
                      style={{ height: `${micOn ? Math.min(100, Math.max(20, volumeLevel * 1.5)) : 15}%` }}
                    />
                    <div
                      className="w-1 bg-[#8AB4F8] rounded-full"
                      style={{ height: `${micOn ? Math.min(100, Math.max(15, volumeLevel * 1.2)) : 15}%` }}
                    />
                    <div
                      className="w-1 bg-[#8AB4F8] rounded-full"
                      style={{ height: `${micOn ? Math.min(100, Math.max(10, volumeLevel * 0.8)) : 15}%` }}
                    />
                  </div>
                </div>

                {/* Quick Lobby Controls */}
                <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
                  <button
                    type="button"
                    data-testid="meet-lobby-mic-btn"
                    onClick={toggleMic}
                    aria-label={micOn ? 'Desativar microfone' : 'Ativar microfone'}
                    className={`p-3 sm:p-3.5 rounded-full ${
                      micOn ? 'bg-[#3C4043] hover:bg-[#4D5155] text-white' : 'bg-[#EA4335] hover:bg-[#D93025] text-white'
                    }`}
                  >
                    {micOn ? <Mic size={20} /> : <MicOff size={20} />}
                  </button>
                  <button
                    type="button"
                    data-testid="meet-lobby-cam-btn"
                    onClick={toggleCam}
                    aria-label={camOn ? 'Desativar câmera' : 'Ativar câmera'}
                    className={`p-3 sm:p-3.5 rounded-full ${
                      camOn ? 'bg-[#3C4043] hover:bg-[#4D5155] text-white' : 'bg-[#EA4335] hover:bg-[#D93025] text-white'
                    }`}
                  >
                    {camOn ? <Video size={20} /> : <VideoOff size={20} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBlurEnabled((v) => !v);
                      toast(!blurEnabled ? 'Desfoque de fundo ativado' : 'Desfoque desativado');
                    }}
                    aria-label="Aplicar efeitos visuais"
                    className={`p-3 sm:p-3.5 rounded-full ${
                      blurEnabled ? 'bg-[#8AB4F8] text-[#202124]' : 'bg-[#3C4043] hover:bg-[#4D5155] text-white'
                    }`}
                  >
                    <Sparkles size={20} />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 mt-3 px-1">
                <button
                  type="button"
                  onClick={() => setShowDeviceModal(true)}
                  className="flex items-center gap-2 text-xs font-medium text-[#1A73E8] hover:underline"
                >
                  <Settings size={14} /> Verificar áudio e vídeo
                </button>
                <span className="text-xs opacity-60">
                  {noiseReduction ? 'Redução de ruído ativa' : 'Áudio padrão'}
                </span>
              </div>
            </div>

            <div className="w-full max-w-sm flex flex-col items-center text-center space-y-4 sm:space-y-5">
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-normal">{meetingTitle}</h1>
                <p className="text-sm opacity-65 mt-1">
                  {remoteParticipants.length > 0
                    ? `${remoteParticipants.length} pessoas já estão na chamada`
                    : 'Ninguém mais está aqui ainda'}
                </p>
              </div>

              <div
                className={`px-3.5 py-2 rounded-lg flex items-center gap-2 border w-full justify-between ${
                  isDarkMode ? 'bg-[#303134] border-white/10' : 'bg-gray-100 border-gray-200'
                }`}
              >
                <span className="text-xs font-mono text-[#1A73E8] truncate" data-testid="meet-lobby-code">
                  {meetingId}
                </span>
                <button
                  type="button"
                  onClick={copyMeetingDetails}
                  aria-label="Copiar código da reunião"
                  className="p-1.5 rounded hover:bg-black/10 shrink-0"
                >
                  <Copy size={14} />
                </button>
              </div>

              <button
                type="button"
                data-testid="meet-enter-call-btn"
                onClick={enterCall}
                className="px-8 py-3 bg-[#1A73E8] hover:bg-[#1557B0] text-white rounded-full font-medium text-sm shadow-lg w-full"
              >
                Participar agora
              </button>
            </div>
          </div>
        </div>

        {deviceModal}
      </div>
    );
  }

  // ---------------- VIEW 2.5: POST-CALL SCREEN ----------------
  if (view === 'ended') {
    return (
      <div
        className={`flex flex-col h-full font-sans relative overflow-hidden ${
          isDarkMode ? 'bg-[#202124] text-white' : 'bg-white text-[#202124]'
        }`}
      >
        <header className="w-full px-4 sm:px-6 h-16 flex items-center justify-between shrink-0 border-b border-current/10">
          <div className="flex items-center gap-2">
            <GoogleIcons.Meet className="w-7 h-7" />
            <span className="text-lg font-medium">Google Meet</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar Google Meet"
            className="p-2 rounded-full hover:bg-black/10"
          >
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-10 flex items-center justify-center">
          <div className="w-full max-w-md text-center space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-normal" data-testid="meet-ended-heading">
                Você saiu da reunião
              </h1>
              <p className="text-sm opacity-70">
                {meetingTitle} · <span className="font-mono">{meetingId}</span> · Duração{' '}
                <span className="font-mono tabular-nums">{formatCallDuration(lastCallDuration)}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                data-testid="meet-rejoin-btn"
                onClick={rejoinCall}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium border ${
                  isDarkMode
                    ? 'border-white/20 hover:bg-white/10 text-[#8AB4F8]'
                    : 'border-gray-300 hover:bg-gray-50 text-[#1A73E8]'
                }`}
              >
                <RotateCcw size={15} /> Voltar à chamada
              </button>
              <button
                type="button"
                data-testid="meet-back-home-btn"
                onClick={returnToHome}
                className="px-5 py-2.5 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white text-sm font-medium"
              >
                Voltar à tela inicial
              </button>
            </div>

            <div
              className={`rounded-2xl border p-4 text-left space-y-3 ${
                isDarkMode ? 'bg-[#282A2E] border-white/10' : 'bg-[#F8FAFD] border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-semibold opacity-80">
                <FileText size={15} className="text-[#1A73E8]" />
                <span>Resumo e ata da reunião</span>
              </div>
              <p className="text-xs opacity-70">
                Exporte participantes, mensagens do chat, legendas, enquetes e P&amp;R diretamente para um documento no Google Docs.
              </p>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {savedSummaryDoc && onOpenApp ? (
                  <button
                    type="button"
                    onClick={() => onOpenApp('doc', savedSummaryDoc)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                  >
                    <Check size={14} /> Abrir ata no Google Docs
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid="meet-export-summary-btn"
                    onClick={handleExportSummaryToDocs}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-semibold"
                  >
                    <FileText size={14} /> Salvar ata no Google Docs
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- VIEW 3: ACTIVE CALL STAGE ----------------
  const unansweredCount = questions.filter((q) => !q.answered).length;
  const visibleQuestions = qaFilter === 'unanswered' ? questions.filter((q) => !q.answered) : questions;
  const filteredPeople = allParticipants.filter((p) =>
    p.name.toLowerCase().includes(peopleFilter.trim().toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-[#202124] relative overflow-hidden text-white font-sans">
      <style>{`
        @keyframes meetFloatUp {
          0% { transform: translateY(0) scale(0.6); opacity: 0; }
          15% { opacity: 1; transform: translateY(-24px) scale(1); }
          100% { transform: translateY(-280px) scale(1.4); opacity: 0; }
        }
      `}</style>

      {/* Floating Reactions Layer */}
      <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
        {floatingEmojis.map((e) => (
          <div
            key={e.id}
            className="absolute bottom-24 text-4xl"
            style={{ left: `${e.left}%`, animation: 'meetFloatUp 2s ease-out forwards' }}
          >
            {e.emoji}
          </div>
        ))}
      </div>

      {/* Top Status Banners (Screen Share / Recording / Waiting Room) */}
      {(isScreenSharing || isRecording || waitingGuests.length > 0) && (
        <div className="px-4 pt-3 flex flex-wrap items-center justify-between gap-2 shrink-0 z-20">
          <div className="flex items-center gap-2">
            {isScreenSharing && (
              <div className="flex items-center gap-3 bg-[#1A73E8] text-white px-3.5 py-1.5 rounded-lg text-xs font-medium shadow">
                <MonitorUp size={15} />
                <span>Você está apresentando sua tela para todos</span>
                <button
                  type="button"
                  onClick={stopScreenShare}
                  className="bg-white/20 hover:bg-white/30 px-2.5 py-0.5 rounded font-semibold"
                >
                  Parar apresentação
                </button>
              </div>
            )}
            {isRecording && (
              <div className="flex items-center gap-2 bg-[#EA4335]/20 border border-[#EA4335]/40 text-red-300 px-3 py-1.5 rounded-lg text-xs font-mono tabular-nums">
                <Circle size={10} className="fill-red-500 text-red-500" />
                <span>REC {formatCallDuration(recordingSeconds)}</span>
              </div>
            )}
          </div>

          {waitingGuests.length > 0 && (
            <div className="flex items-center gap-3 bg-[#303134] border border-white/15 px-3.5 py-1.5 rounded-lg text-xs shadow-lg">
              <span>
                <strong>{waitingGuests[0].name}</strong> quer participar desta chamada
              </span>
              <button
                type="button"
                onClick={() => denyGuest(waitingGuests[0].id)}
                className="text-white/75 hover:text-white font-medium"
              >
                Recusar
              </button>
              <button
                type="button"
                onClick={() => admitGuest(waitingGuests[0])}
                className="px-2.5 py-1 rounded bg-[#8AB4F8] text-[#202124] font-semibold"
              >
                Permitir
              </button>
            </div>
          )}
        </div>
      )}

      {/* Stage + Right Side Drawer */}
      <div className="flex-1 min-h-0 flex p-2 sm:p-3 gap-3 overflow-hidden relative">
        {/* Video Stage */}
        <div className="flex-1 min-w-0 flex flex-col gap-2 overflow-hidden">
          {gridConfig.mode === 'spotlight' && spotlight ? (
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3">
              <div className="flex-1 min-h-0">
                <ParticipantTile
                  participant={spotlight}
                  localVideoRef={localVideoRef}
                  screenVideoRef={screenVideoRef}
                  screenStream={screenStream}
                  blurEnabled={blurEnabled}
                  isPinned={pinnedId === spotlight.id}
                  onTogglePin={handleTogglePin}
                  onMuteRemote={handleMuteRemote}
                />
              </div>
              {others.length > 0 && (
                <div className="lg:w-64 flex lg:flex-col gap-2.5 overflow-auto shrink-0">
                  {others.map((p) => (
                    <div key={p.id} className="h-36 lg:h-40 w-56 lg:w-full shrink-0">
                      <ParticipantTile
                        participant={p}
                        localVideoRef={localVideoRef}
                        screenVideoRef={screenVideoRef}
                        screenStream={screenStream}
                        blurEnabled={blurEnabled}
                        isPinned={pinnedId === p.id}
                        onTogglePin={handleTogglePin}
                        onMuteRemote={handleMuteRemote}
                        compact
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className={`flex-1 min-h-0 grid gap-3 ${gridConfig.colsClass}`}>
              {allParticipants.map((p) => (
                <div key={p.id} className="min-h-0 w-full h-full">
                  <ParticipantTile
                    participant={p}
                    localVideoRef={localVideoRef}
                    screenVideoRef={screenVideoRef}
                    screenStream={screenStream}
                    blurEnabled={blurEnabled}
                    isPinned={pinnedId === p.id}
                    onTogglePin={handleTogglePin}
                    onMuteRemote={handleMuteRemote}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Live Captions (CC) Strip */}
          {captionsOn && (
            <div className="bg-black/75 border border-white/10 rounded-xl px-4 py-2.5 shrink-0 flex items-center justify-between gap-4">
              <div className="min-w-0 space-y-0.5">
                {captions.slice(-2).map((cap) => (
                  <div key={cap.id} className="text-xs md:text-sm leading-snug truncate">
                    <span className="font-semibold text-[#8AB4F8] mr-2">{cap.speaker}:</span>
                    <span className="text-white/90">{cap.text}</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setCaptionsOn(false)}
                aria-label="Desativar legendas"
                className="text-xs text-white/60 hover:text-white shrink-0"
              >
                Ocultar
              </button>
            </div>
          )}
        </div>

        {/* Side Drawer: Info / People / Chat / Activities */}
        {sidePanel !== 'none' && (
          <aside
            data-testid="meet-side-drawer"
            className="absolute inset-2 sm:inset-y-2 sm:right-2 sm:left-auto sm:w-[340px] z-30 lg:static lg:w-[340px] bg-white text-[#202124] rounded-2xl flex flex-col shadow-2xl overflow-hidden shrink-0 lg:h-full"
          >
            <div className="h-14 flex items-center justify-between px-4 sm:px-5 border-b border-gray-200 shrink-0">
              <h2 className="font-medium text-base">
                {sidePanel === 'chat' && 'Mensagens na chamada'}
                {sidePanel === 'people' && `Pessoas (${allParticipants.length})`}
                {sidePanel === 'info' && 'Detalhes da reunião'}
                {sidePanel === 'activities' && 'Atividades'}
              </h2>
              <button
                type="button"
                onClick={() => setSidePanel('none')}
                aria-label="Fechar painel lateral"
                className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500"
              >
                <X size={18} />
              </button>
            </div>

            {/* Panel 1: Detalhes da Reunião */}
            {sidePanel === 'info' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 text-sm">
                <div>
                  <div className="text-xs font-semibold text-gray-500 mb-1">Informações de participação</div>
                  <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
                    <div className="font-semibold text-gray-900">{meetingTitle}</div>
                    <div className="text-xs font-mono text-[#1A73E8] break-all">
                      https://meet.google.com/{meetingId}
                    </div>
                    <button
                      type="button"
                      onClick={copyMeetingDetails}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1A73E8] hover:underline pt-1"
                    >
                      <Copy size={13} /> Copiar informações de participação
                    </button>
                  </div>
                </div>

                {activeCalendarEvent && (
                  <div className="space-y-2 border-t border-gray-100 pt-4">
                    <div className="text-xs font-semibold text-gray-500">Vinculada ao Google Agenda</div>
                    <div className="text-xs text-gray-700 flex items-center gap-2">
                      <Clock size={14} className="text-gray-400" />
                      <span className="tabular-nums">
                        {new Date(activeCalendarEvent.start).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        –{' '}
                        {new Date(activeCalendarEvent.end).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {activeCalendarEvent.description && (
                      <p className="text-xs text-gray-600 leading-relaxed">
                        {activeCalendarEvent.description}
                      </p>
                    )}
                  </div>
                )}

                <div className="border-t border-gray-100 pt-4 space-y-3">
                  <div className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-emerald-600" /> Controles do organizador
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs text-gray-700">
                    <span>Permitir compartilhamento de tela</span>
                    <button
                      type="button"
                      onClick={() => setAllowScreenShare((v) => !v)}
                      className={`px-2.5 py-1 rounded-full font-medium shrink-0 ${
                        allowScreenShare ? 'bg-[#1A73E8] text-white' : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {allowScreenShare ? 'Ativo' : 'Bloqueado'}
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs text-gray-700">
                    <span>Permitir mensagens no chat</span>
                    <button
                      type="button"
                      onClick={() => setAllowParticipantChat((v) => !v)}
                      className={`px-2.5 py-1 rounded-full font-medium shrink-0 ${
                        allowParticipantChat ? 'bg-[#1A73E8] text-white' : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {allowParticipantChat ? 'Ativo' : 'Bloqueado'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportSummaryToDocs}
                    className="w-full py-2 px-3 rounded-lg bg-[#E8F0FE] text-[#174EA6] hover:bg-[#D2E3FC] text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <FileText size={14} /> Salvar ata no Google Docs
                  </button>
                  {isHost && (
                    <button
                      type="button"
                      onClick={() => leaveCall(true)}
                      className="w-full py-2 px-3 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold"
                    >
                      Encerrar reunião para todos
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Panel 2: Pessoas */}
            {sidePanel === 'people' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-gray-100 space-y-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowInviteModal(true)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#E8F0FE] text-[#174EA6] hover:bg-[#D2E3FC] text-xs font-semibold"
                    >
                      <UserPlus size={14} /> Adicionar pessoas
                    </button>
                    <button
                      type="button"
                      onClick={handleMuteAll}
                      className="py-2 px-3 rounded-lg border border-gray-200 hover:bg-gray-100 text-xs font-medium text-gray-700"
                    >
                      Silenciar todos
                    </button>
                  </div>

                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50">
                    <Search size={14} className="text-gray-400" />
                    <input
                      type="text"
                      placeholder="Pesquisar pessoas..."
                      value={peopleFilter}
                      onChange={(e) => setPeopleFilter(e.target.value)}
                      className="bg-transparent outline-none text-xs w-full text-gray-800"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Waiting Room section */}
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                      <span>Sala de espera ({waitingGuests.length})</span>
                      <button
                        type="button"
                        onClick={simulateWaitingKnock}
                        className="text-[#1A73E8] hover:underline font-medium"
                      >
                        Simular pedido
                      </button>
                    </div>
                    {waitingGuests.length === 0 ? (
                      <p className="text-[11px] text-gray-500">Ninguém aguardando admissão.</p>
                    ) : (
                      waitingGuests.map((wg) => (
                        <div key={wg.id} className="flex items-center justify-between gap-2 bg-white p-2 rounded-lg border border-gray-200">
                          <div className="min-w-0">
                            <div className="text-xs font-medium truncate">{wg.name}</div>
                            <div className="text-[11px] text-gray-500 truncate">{wg.email}</div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => denyGuest(wg.id)}
                              className="px-2 py-1 rounded text-[11px] text-gray-600 hover:bg-gray-100"
                            >
                              Recusar
                            </button>
                            <button
                              type="button"
                              onClick={() => admitGuest(wg)}
                              className="px-2 py-1 rounded text-[11px] bg-[#1A73E8] text-white font-medium"
                            >
                              Permitir
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Active Participants List */}
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-gray-500 px-1">Na chamada</div>
                    {filteredPeople.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-full ${
                              p.avatarColor || 'bg-blue-600'
                            } text-white text-xs font-semibold flex items-center justify-center shrink-0`}
                          >
                            {p.name[0]?.toUpperCase() || 'C'}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-gray-900 truncate">
                              {p.isLocal ? `${p.name} (Você)` : p.name}
                            </div>
                            <div className="text-[11px] text-gray-500">
                              {p.role === 'host' ? 'Organizador da reunião' : 'Convidado'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {p.handRaised && (
                            <span title="Mão levantada" className="text-amber-500 p-1">
                              <Hand size={14} />
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              p.isLocal ? toggleMic() : handleMuteRemote(p.id)
                            }
                            aria-label={p.mic ? `Silenciar ${p.name}` : `Microfone de ${p.name} desligado`}
                            className={`p-1.5 rounded-full ${
                              p.mic ? 'text-gray-600 hover:bg-gray-100' : 'text-red-500 bg-red-50'
                            }`}
                          >
                            {p.mic ? <Mic size={14} /> : <MicOff size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTogglePin(p.id)}
                            aria-label={pinnedId === p.id ? `Desafixar ${p.name}` : `Fixar ${p.name}`}
                            className={`p-1.5 rounded-full ${
                              pinnedId === p.id ? 'bg-[#E8F0FE] text-[#1A73E8]' : 'text-gray-500 hover:bg-gray-100'
                            }`}
                          >
                            {pinnedId === p.id ? <PinOff size={14} /> : <Pin size={14} />}
                          </button>
                          {!p.isLocal && (
                            <button
                              type="button"
                              onClick={() => handleRemoveParticipant(p.id)}
                              aria-label={`Remover ${p.name}`}
                              className="p-1.5 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Panel 3: Chat */}
            {sidePanel === 'chat' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-xs text-gray-600">
                  <span>Permitir que todos enviem mensagens</span>
                  <button
                    type="button"
                    onClick={() => setAllowParticipantChat((v) => !v)}
                    className={`px-2.5 py-0.5 rounded-full font-medium ${
                      allowParticipantChat ? 'bg-[#1A73E8] text-white' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {allowParticipantChat ? 'Ativo' : 'Bloqueado'}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50" ref={chatScrollRef}>
                  {messages.length === 0 ? (
                    <div className="text-center text-xs text-gray-500 py-8">
                      As mensagens ficam visíveis apenas para quem está na chamada.
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div key={msg.id} className={`flex flex-col ${msg.isSelf ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-baseline gap-2 mb-1 px-1">
                          <span className="text-xs font-semibold text-gray-700">{msg.sender}</span>
                          <span className="text-[10px] text-gray-400 tabular-nums">{msg.time}</span>
                        </div>
                        <div
                          className={`px-3 py-2 rounded-xl text-xs md:text-sm max-w-[90%] shadow-sm ${
                            msg.isSelf
                              ? 'bg-[#E8F0FE] text-[#174EA6] rounded-tr-sm'
                              : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-3 bg-white border-t border-gray-200 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Enviar mensagem para todos..."
                    className="flex-1 bg-gray-100 focus:bg-white border border-transparent focus:border-[#1A73E8] outline-none rounded-full px-4 py-2 text-xs md:text-sm text-gray-800"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  />
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    aria-label="Enviar mensagem"
                    className="p-2 rounded-full bg-[#1A73E8] text-white hover:bg-[#1557B0] shrink-0"
                  >
                    <Send size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* Panel 4: Atividades (Enquetes & P&R) */}
            {sidePanel === 'activities' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-4 pt-3 pb-2 border-b border-gray-200 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setActivitiesTab('polls')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      activitiesTab === 'polls' ? 'bg-[#E8F0FE] text-[#174EA6]' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Enquetes ({polls.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivitiesTab('qa')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      activitiesTab === 'qa' ? 'bg-[#E8F0FE] text-[#174EA6]' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    P&R ({unansweredCount})
                  </button>
                </div>

                {activitiesTab === 'polls' ? (
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <button
                      type="button"
                      onClick={() => setShowCreatePoll((v) => !v)}
                      className="w-full py-2 px-3 rounded-lg bg-[#1A73E8] text-white text-xs font-semibold hover:bg-[#1557B0]"
                    >
                      {showCreatePoll ? 'Cancelar nova enquete' : '+ Criar enquete'}
                    </button>

                    {showCreatePoll && (
                      <form onSubmit={handleCreatePoll} className="p-3 rounded-xl bg-gray-50 border border-gray-200 space-y-2.5">
                        <input
                          type="text"
                          required
                          placeholder="Pergunta da enquete..."
                          value={newPollQuestion}
                          onChange={(e) => setNewPollQuestion(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded border border-gray-200 bg-white text-xs outline-none"
                        />
                        <input
                          type="text"
                          required
                          placeholder="Opção 1"
                          value={newPollOpt1}
                          onChange={(e) => setNewPollOpt1(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded border border-gray-200 bg-white text-xs outline-none"
                        />
                        <input
                          type="text"
                          required
                          placeholder="Opção 2"
                          value={newPollOpt2}
                          onChange={(e) => setNewPollOpt2(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded border border-gray-200 bg-white text-xs outline-none"
                        />
                        <button type="submit" className="w-full py-1.5 rounded bg-emerald-600 text-white text-xs font-semibold">
                          Lançar enquete
                        </button>
                      </form>
                    )}

                    {polls.map((poll) => {
                      const totalVotes = poll.options.reduce((acc, o) => acc + o.votes, 0);
                      return (
                        <div key={poll.id} className="p-3.5 rounded-xl border border-gray-200 bg-gray-50 space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-xs font-semibold text-gray-900">{poll.question}</div>
                            {poll.closed && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 shrink-0">
                                Encerrada
                              </span>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            {poll.options.map((opt) => {
                              const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                              const isSelected = poll.votedOptionId === opt.id;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  disabled={Boolean(poll.closed)}
                                  onClick={() => {
                                    setPolls((prev) => voteInPoll(prev, poll.id, opt.id));
                                    broadcastData({ type: 'poll_vote', pollId: poll.id, optionId: opt.id });
                                  }}
                                  className={`w-full text-left p-2 rounded-lg border text-xs disabled:opacity-75 ${
                                    isSelected
                                      ? 'border-[#1A73E8] bg-[#E8F0FE] text-[#174EA6]'
                                      : 'border-gray-200 bg-white hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="font-medium">{opt.text}</span>
                                    <span className="font-mono tabular-nums text-[11px]">{pct}%</span>
                                  </div>
                                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-[#1A73E8]"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex items-center justify-between gap-2 pt-0.5 text-[11px] text-gray-500 tabular-nums">
                            <span>
                              {totalVotes} voto{totalVotes === 1 ? '' : 's'} · {poll.createdAt}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setPolls((prev) => togglePollClosed(prev, poll.id))}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-gray-200 text-gray-700 font-medium"
                              >
                                {poll.closed ? <Unlock size={11} /> : <Lock size={11} />}
                                {poll.closed ? 'Reabrir' : 'Encerrar'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setPolls((prev) => deletePoll(prev, poll.id))}
                                aria-label={`Excluir enquete ${poll.question}`}
                                className="p-1 rounded hover:bg-red-50 text-gray-500 hover:text-red-600"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-4 py-2 flex items-center justify-between text-xs border-b border-gray-100">
                      <span className="text-gray-500">Perguntas da audiência</span>
                      <button
                        type="button"
                        onClick={() => setQaFilter((f) => (f === 'all' ? 'unanswered' : 'all'))}
                        className="text-[#1A73E8] hover:underline font-medium"
                      >
                        {qaFilter === 'all' ? 'Só pendentes' : 'Mostrar todas'}
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                      {visibleQuestions.map((q) => (
                        <div
                          key={q.id}
                          className={`p-3 rounded-xl border text-xs space-y-2 ${
                            q.answered ? 'bg-emerald-50/50 border-emerald-200' : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] text-gray-500">
                            <span className="font-semibold text-gray-700">{q.author}</span>
                            <span className="tabular-nums">{q.time}</span>
                          </div>
                          <p className="text-gray-900 leading-snug">{q.text}</p>
                          <div className="flex items-center justify-between pt-1">
                            <button
                              type="button"
                              onClick={() => setQuestions((prev) => toggleQuestionUpvote(prev, q.id))}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium tabular-nums ${
                                q.upvotedByMe
                                  ? 'bg-[#E8F0FE] border-[#1A73E8] text-[#174EA6]'
                                  : 'bg-white border-gray-200 text-gray-600'
                              }`}
                            >
                              <ThumbsUp size={11} /> {q.upvotes}
                            </button>
                            <button
                              type="button"
                              onClick={() => setQuestions((prev) => markQuestionAnswered(prev, q.id))}
                              className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                                q.answered ? 'text-emerald-700' : 'text-gray-500 hover:text-emerald-700'
                              }`}
                            >
                              <CheckCircle2 size={13} />
                              {q.answered ? 'Respondida' : 'Marcar respondida'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <form onSubmit={handleAddQuestion} className="p-3 border-t border-gray-200 flex gap-2">
                      <input
                        type="text"
                        placeholder="Fazer uma pergunta..."
                        value={newQuestionText}
                        onChange={(e) => setNewQuestionText(e.target.value)}
                        className="flex-1 bg-gray-100 rounded-full px-3.5 py-2 text-xs outline-none focus:bg-white focus:ring-1 focus:ring-[#1A73E8]"
                      />
                      <button
                        type="submit"
                        aria-label="Enviar pergunta"
                        className="px-3 py-2 rounded-full bg-[#1A73E8] text-white text-xs font-semibold shrink-0"
                      >
                        Enviar
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Bottom Call Control Bar (Responsive: fits 390px, 768px, 1440px without horizontal overflow) */}
      <footer className="min-h-[68px] sm:h-20 bg-[#202124] border-t border-white/10 flex items-center justify-between px-2 sm:px-5 gap-1 sm:gap-2 shrink-0 z-30">
        {/* Left: Timer + Code (desktop) */}
        <div className="hidden lg:flex items-center gap-3 min-w-0">
          <span className="text-sm font-mono tabular-nums text-white/85">
            {formatCallDuration(callSeconds)}
          </span>
          <span className="h-4 w-px bg-white/20" />
          <button
            type="button"
            onClick={() => toggleSidePanel('info')}
            className="text-xs md:text-sm text-white/85 hover:text-white font-mono truncate max-w-[140px]"
            title="Detalhes da reunião"
          >
            {meetingId}
          </button>
        </div>

        {/* Center Primary Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-2.5">
          <button
            type="button"
            data-testid="meet-mic-btn"
            onClick={toggleMic}
            aria-label={micOn ? 'Desativar microfone' : 'Ativar microfone'}
            title="Microfone (Ctrl+D)"
            className={`p-2.5 sm:p-3 rounded-full ${
              micOn ? 'bg-[#3C4043] hover:bg-[#4D5155] text-white' : 'bg-[#EA4335] hover:bg-[#D93025] text-white'
            }`}
          >
            {micOn ? <Mic size={18} /> : <MicOff size={18} />}
          </button>

          <button
            type="button"
            data-testid="meet-cam-btn"
            onClick={toggleCam}
            aria-label={camOn ? 'Desativar câmera' : 'Ativar câmera'}
            title="Câmera (Ctrl+E)"
            className={`p-2.5 sm:p-3 rounded-full ${
              camOn ? 'bg-[#3C4043] hover:bg-[#4D5155] text-white' : 'bg-[#EA4335] hover:bg-[#D93025] text-white'
            }`}
          >
            {camOn ? <Video size={18} /> : <VideoOff size={18} />}
          </button>

          <button
            type="button"
            data-testid="meet-captions-btn"
            onClick={() => setCaptionsOn((v) => !v)}
            aria-label={captionsOn ? 'Desativar legendas' : 'Ativar legendas'}
            title="Legendas (CC)"
            className={`hidden sm:inline-flex p-2.5 sm:p-3 rounded-full ${
              captionsOn ? 'bg-[#8AB4F8] text-[#202124]' : 'bg-[#3C4043] hover:bg-[#4D5155] text-white'
            }`}
          >
            <Captions size={18} />
          </button>

          <div className="relative hidden sm:block" ref={reactionMenuRef}>
            <button
              type="button"
              onClick={() => setShowReactionMenu((v) => !v)}
              aria-label="Enviar reação"
              title="Reações"
              className="p-2.5 sm:p-3 rounded-full bg-[#3C4043] hover:bg-[#4D5155] text-white flex"
            >
              <Smile size={18} />
            </button>
            {showReactionMenu && (
              <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-[#303134] rounded-full px-2.5 py-1.5 flex gap-1.5 shadow-2xl border border-white/10 w-max z-50">
                {['👍', '👏', '💖', '🎉', '😂', '😮'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => triggerReaction(emoji)}
                    className="text-lg hover:scale-125 transition-transform p-1 rounded-full hover:bg-white/10"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            data-testid="meet-present-btn"
            onClick={toggleScreenShare}
            aria-label={isScreenSharing ? 'Parar apresentação' : 'Apresentar agora'}
            title="Apresentar agora"
            className={`hidden sm:inline-flex p-2.5 sm:p-3 rounded-full ${
              isScreenSharing ? 'bg-[#8AB4F8] text-[#202124]' : 'bg-[#3C4043] hover:bg-[#4D5155] text-white'
            }`}
          >
            {isScreenSharing ? <MonitorOff size={18} /> : <MonitorUp size={18} />}
          </button>

          <button
            type="button"
            data-testid="meet-hand-btn"
            onClick={toggleHand}
            aria-label={handRaised ? 'Abaixar a mão' : 'Levantar a mão'}
            title="Levantar a mão"
            className={`p-2.5 sm:p-3 rounded-full ${
              handRaised ? 'bg-[#8AB4F8] text-[#202124]' : 'bg-[#3C4043] hover:bg-[#4D5155] text-white'
            }`}
          >
            <Hand size={18} />
          </button>

          <div className="relative" ref={moreMenuRef}>
            <button
              type="button"
              data-testid="meet-more-btn"
              onClick={() => setShowMoreMenu((v) => !v)}
              aria-label="Mais opções da chamada"
              title="Mais opções"
              className="p-2.5 sm:p-3 rounded-full bg-[#3C4043] hover:bg-[#4D5155] text-white"
            >
              <MoreVertical size={18} />
            </button>
            {showMoreMenu && (
              <div className="absolute bottom-14 right-0 w-64 max-w-[calc(100vw-32px)] bg-[#303134] border border-white/10 rounded-xl py-2 shadow-2xl z-50 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setCaptionsOn((v) => !v);
                    setShowMoreMenu(false);
                  }}
                  className="sm:hidden w-full px-4 py-2.5 flex items-center justify-between hover:bg-white/10 text-left"
                >
                  <span className="flex items-center gap-2.5">
                    <Captions size={15} /> Legendas (CC)
                  </span>
                  <span className="text-white/60">{captionsOn ? 'Ativo' : 'Off'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void toggleScreenShare();
                    setShowMoreMenu(false);
                  }}
                  className="sm:hidden w-full px-4 py-2.5 flex items-center justify-between hover:bg-white/10 text-left"
                >
                  <span className="flex items-center gap-2.5">
                    <MonitorUp size={15} /> {isScreenSharing ? 'Parar apresentação' : 'Apresentar tela'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    toggleSidePanel('info');
                    setShowMoreMenu(false);
                  }}
                  className="md:hidden w-full px-4 py-2.5 flex items-center gap-2.5 hover:bg-white/10 text-left"
                >
                  <Info size={15} /> Detalhes da reunião
                </button>
                <button
                  type="button"
                  onClick={() => {
                    toggleSidePanel('activities');
                    setShowMoreMenu(false);
                  }}
                  className="md:hidden w-full px-4 py-2.5 flex items-center gap-2.5 hover:bg-white/10 text-left"
                >
                  <Shapes size={15} /> Atividades (Enquetes e P&amp;R)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLayoutMode((m) => (m === 'grid' ? 'spotlight' : m === 'spotlight' ? 'auto' : 'grid'));
                    setShowMoreMenu(false);
                  }}
                  className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-white/10 text-left"
                >
                  <span className="flex items-center gap-2.5">
                    <LayoutGrid size={15} /> Alterar layout
                  </span>
                  <span className="text-white/60 capitalize">{layoutMode}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextRec = !isRecording;
                    setIsRecording(nextRec);
                    setShowMoreMenu(false);
                    toast(nextRec ? 'Gravação da reunião iniciada' : 'Gravação salva');
                  }}
                  className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-white/10 text-left"
                >
                  <span className="flex items-center gap-2.5">
                    {isRecording ? <Square size={15} className="text-red-400" /> : <Circle size={15} />}
                    {isRecording ? 'Parar gravação' : 'Gravar reunião'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBlurEnabled((v) => !v);
                    setShowMoreMenu(false);
                  }}
                  className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-white/10 text-left"
                >
                  <span className="flex items-center gap-2.5">
                    <Sparkles size={15} /> Desfoque de fundo
                  </span>
                  <span className="text-white/60">{blurEnabled ? 'Ativo' : 'Off'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    setShowDeviceModal(true);
                  }}
                  className="w-full px-4 py-2.5 flex items-center gap-2.5 hover:bg-white/10 text-left"
                >
                  <Settings size={15} /> Configurações de áudio e vídeo
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            data-testid="meet-leave-btn"
            onClick={() => leaveCall(false)}
            aria-label="Sair da chamada"
            title="Sair da chamada"
            className="px-4 sm:px-5 h-10 sm:h-11 bg-[#EA4335] hover:bg-[#D93025] text-white rounded-full flex items-center justify-center gap-2 shadow-lg ml-0.5 sm:ml-1"
          >
            <PhoneOff size={19} />
          </button>
        </div>

        {/* Right Side Panel Toggles */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            type="button"
            data-testid="meet-panel-info-btn"
            onClick={() => toggleSidePanel('info')}
            aria-label="Detalhes da reunião"
            title="Detalhes da reunião"
            className={`hidden md:inline-flex p-2.5 rounded-full ${
              sidePanel === 'info' ? 'bg-[#8AB4F8] text-[#202124]' : 'text-white/85 hover:bg-white/10'
            }`}
          >
            <Info size={19} />
          </button>

          <button
            type="button"
            data-testid="meet-panel-people-btn"
            onClick={() => toggleSidePanel('people')}
            aria-label="Mostrar todos os participantes"
            title="Pessoas"
            className={`p-2.5 rounded-full relative ${
              sidePanel === 'people' ? 'bg-[#8AB4F8] text-[#202124]' : 'text-white/85 hover:bg-white/10'
            }`}
          >
            <Users size={18} />
            <span className="absolute -top-0.5 -right-0.5 bg-[#5F6368] text-white text-[10px] px-1.5 rounded-full font-semibold tabular-nums">
              {allParticipants.length}
            </span>
          </button>

          <button
            type="button"
            data-testid="meet-panel-chat-btn"
            onClick={() => toggleSidePanel('chat')}
            aria-label="Chat com todos"
            title="Mensagens na chamada"
            className={`p-2.5 rounded-full relative ${
              sidePanel === 'chat' ? 'bg-[#8AB4F8] text-[#202124]' : 'text-white/85 hover:bg-white/10'
            }`}
          >
            <MessageSquare size={18} />
            {unreadChatCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#8AB4F8]" />
            )}
          </button>

          <button
            type="button"
            data-testid="meet-panel-activities-btn"
            onClick={() => toggleSidePanel('activities')}
            aria-label="Atividades da reunião"
            title="Atividades (Enquetes e P&R)"
            className={`hidden md:inline-flex p-2.5 rounded-full ${
              sidePanel === 'activities' ? 'bg-[#8AB4F8] text-[#202124]' : 'text-white/85 hover:bg-white/10'
            }`}
          >
            <Shapes size={19} />
          </button>
        </div>
      </footer>

      {/* Invite Modal */}
      {showInviteModal && (
        <div
          className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowInviteModal(false)}
        >
          <form
            onSubmit={handleAddParticipant}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[#282A2E] text-white border border-white/10 rounded-2xl p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Adicionar pessoas à chamada</h3>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                aria-label="Fechar convite"
                className="p-1 rounded-full hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>
            <input
              type="text"
              required
              placeholder="Nome completo (ex: Lucas Mendes)"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-xs outline-none focus:border-[#8AB4F8]"
            />
            <input
              type="email"
              placeholder="E-mail (opcional)"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-xs outline-none focus:border-[#8AB4F8]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-[#8AB4F8] text-[#202124] text-xs font-semibold flex items-center gap-1"
              >
                <Check size={14} /> Convidar agora
              </button>
            </div>
          </form>
        </div>
      )}

      {deviceModal}
    </div>
  );
}
