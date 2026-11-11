import React, { useState, useEffect, useRef } from 'react';
import {
  Search, LayoutGrid, Loader2, Mail, HardDrive, FileText,
  FileSpreadsheet, Presentation, Video, Plus, X, ArrowRight,
  Home, CheckCircle2, Lightbulb, Calendar, LogOut, User, Settings, Info, Bell, Trash2,
  ExternalLink, Globe, ShieldCheck, Users, Sun, Moon, Clock, Pin, Sparkles, Check, AlertCircle,
  Volume2, VolumeX, GripVertical, Columns, RotateCcw, ChevronLeft, ChevronRight, Maximize2
} from 'lucide-react';
import WeatherWidget from './components/WeatherWidget';
import AppViewer from './components/AppViewer';
import Aurora from './components/Aurora';
import GoogleLoader from './components/GoogleLoader';
import PostItBoard from './components/PostItBoard';
import { GoogleIcons, GeminiLogo } from './components/GoogleIcons';
import { bridge, DashboardData } from './utils/GASBridge';
import { askGemini, GeminiUnavailableError } from "./utils/gemini";

type HomeModuleId = 'agenda' | 'tasks' | 'inbox' | 'postits';
type ModuleSpan = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 12;
interface HomeModuleConfig {
  id: HomeModuleId;
  span: ModuleSpan;
  height: number;
  dockRight?: boolean;
}

const DEFAULT_HOME_MODULES: HomeModuleConfig[] = [
  { id: 'tasks', span: 6, height: 390 },
  { id: 'inbox', span: 6, height: 390 },
  { id: 'postits', span: 12, height: 340 },
  { id: 'agenda', span: 4, height: 760, dockRight: true },
];
const HOME_MODULES_STORAGE_KEY = 'workspace_home_modules_v3';

const postItColorsDark: {[key:string]: { card: string, tape: string, accent: string }} = {
    default:  { card: 'bg-[#3A3214] border-[#EAB308]/55 shadow-[0_14px_30px_-6px_rgba(0,0,0,0.75)]', tape: 'bg-[#FDE047]/55', accent: 'text-[#FDE047]' },
    yellow:   { card: 'bg-[#423813] border-[#FACC15]/60 shadow-[0_14px_30px_-6px_rgba(0,0,0,0.75)]', tape: 'bg-[#FDE047]/60', accent: 'text-[#FDE047]' },
    green:    { card: 'bg-[#1B3B26] border-[#4ADE80]/55 shadow-[0_14px_30px_-6px_rgba(0,0,0,0.75)]', tape: 'bg-[#86EFAC]/55', accent: 'text-[#86EFAC]' },
    teal:     { card: 'bg-[#15393D] border-[#2DD4BF]/55 shadow-[0_14px_30px_-6px_rgba(0,0,0,0.75)]', tape: 'bg-[#5EEAD4]/55', accent: 'text-[#5EEAD4]' },
    blue:     { card: 'bg-[#19334D] border-[#60A5FA]/55 shadow-[0_14px_30px_-6px_rgba(0,0,0,0.75)]', tape: 'bg-[#93C5FD]/55', accent: 'text-[#93C5FD]' },
    darkblue: { card: 'bg-[#1D2849] border-[#818CF8]/55 shadow-[0_14px_30px_-6px_rgba(0,0,0,0.75)]', tape: 'bg-[#A5B4FC]/55', accent: 'text-[#A5B4FC]' },
    purple:   { card: 'bg-[#331F47] border-[#C084FC]/55 shadow-[0_14px_30px_-6px_rgba(0,0,0,0.75)]', tape: 'bg-[#D8B4FE]/55', accent: 'text-[#D8B4FE]' },
    pink:     { card: 'bg-[#451E35] border-[#F472B6]/55 shadow-[0_14px_30px_-6px_rgba(0,0,0,0.75)]', tape: 'bg-[#F9A8D4]/55', accent: 'text-[#F9A8D4]' },
    red:      { card: 'bg-[#452120] border-[#F87171]/55 shadow-[0_14px_30px_-6px_rgba(0,0,0,0.75)]', tape: 'bg-[#FCA5A5]/55', accent: 'text-[#FCA5A5]' },
    orange:   { card: 'bg-[#442D18] border-[#FB923C]/55 shadow-[0_14px_30px_-6px_rgba(0,0,0,0.75)]', tape: 'bg-[#FDBA74]/55', accent: 'text-[#FDBA74]' },
    brown:    { card: 'bg-[#38291D] border-[#D6B38C]/50 shadow-[0_14px_30px_-6px_rgba(0,0,0,0.75)]', tape: 'bg-[#E7D0B8]/50', accent: 'text-[#E7D0B8]' },
    gray:     { card: 'bg-[#2C2F36] border-white/30 shadow-[0_14px_30px_-6px_rgba(0,0,0,0.75)]',     tape: 'bg-white/45',      accent: 'text-white/90' }
};

const postItColorsLight: {[key:string]: { card: string, tape: string, accent: string }} = {
    default:  { card: 'bg-[#FFF59D] border-[#FBC02D]/70 shadow-[0_12px_26px_-6px_rgba(140,100,0,0.28)]',  tape: 'bg-[#FBC02D]/65', accent: 'text-[#7A5900]' },
    yellow:   { card: 'bg-[#FFEE58] border-[#F9A825]/70 shadow-[0_12px_26px_-6px_rgba(140,100,0,0.30)]',  tape: 'bg-[#F9A825]/65', accent: 'text-[#6D4C00]' },
    green:    { card: 'bg-[#C5E1A5] border-[#7CB342]/65 shadow-[0_12px_26px_-6px_rgba(50,110,20,0.24)]',  tape: 'bg-[#7CB342]/60', accent: 'text-[#25580E]' },
    teal:     { card: 'bg-[#80CBC4] border-[#26A69A]/65 shadow-[0_12px_26px_-6px_rgba(15,100,90,0.24)]',  tape: 'bg-[#00897B]/55', accent: 'text-[#004D40]' },
    blue:     { card: 'bg-[#90CAF9] border-[#42A5F5]/65 shadow-[0_12px_26px_-6px_rgba(20,90,170,0.24)]',  tape: 'bg-[#1E88E5]/55', accent: 'text-[#0D47A1]' },
    darkblue: { card: 'bg-[#9FA8DA] border-[#5C6BC0]/65 shadow-[0_12px_26px_-6px_rgba(35,50,140,0.24)]',  tape: 'bg-[#3949AB]/55', accent: 'text-[#1A237E]' },
    purple:   { card: 'bg-[#CE93D8] border-[#AB47BC]/65 shadow-[0_12px_26px_-6px_rgba(100,30,120,0.24)]', tape: 'bg-[#8E24AA]/55', accent: 'text-[#4A148C]' },
    pink:     { card: 'bg-[#F48FB1] border-[#EC407A]/65 shadow-[0_12px_26px_-6px_rgba(160,30,80,0.24)]',  tape: 'bg-[#D81B60]/55', accent: 'text-[#880E4F]' },
    red:      { card: 'bg-[#EF9A9A] border-[#EF5350]/65 shadow-[0_12px_26px_-6px_rgba(160,30,30,0.24)]',  tape: 'bg-[#E53935]/55', accent: 'text-[#B71C1C]' },
    orange:   { card: 'bg-[#FFCC80] border-[#FFA726]/70 shadow-[0_12px_26px_-6px_rgba(170,85,10,0.26)]',  tape: 'bg-[#FB8C00]/60', accent: 'text-[#BF360C]' },
    brown:    { card: 'bg-[#BCAAA4] border-[#8D6E63]/65 shadow-[0_12px_26px_-6px_rgba(80,50,35,0.24)]',   tape: 'bg-[#6D4C41]/55', accent: 'text-[#3E2723]' },
    gray:     { card: 'bg-[#E5E7EB] border-black/25 shadow-[0_12px_26px_-6px_rgba(15,23,42,0.20)]',       tape: 'bg-black/35',     accent: 'text-[#1F2937]' }
};

const createNoiseTexture = (): string => {
  if (typeof document === 'undefined') return '';
  const size = 160;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.random() < 0.5 ? 0 : 255;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = Math.floor(140 + Math.random() * 115);
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
};

const NOISE_DATA_URI = createNoiseTexture();

export default function App() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [aiMode, setAiMode] = useState(false); 
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false); 
  const [chatHistory, setChatHistory] = useState<Array<{role: 'user' | 'assistant', text: string, sources?: any[]}>>([]);
  const [activeApp, setActiveApp] = useState<{type: string, data?: any} | null>(null); 
  
  const [activeTab, setActiveTab] = useState('');
  const [menuSearchActive, setMenuSearchActive] = useState(false);

  // Home Executive Briefing interactive states
  const [taskFilter, setTaskFilter] = useState<'focus' | 'pending' | 'completed'>('focus');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [inboxFilter, setInboxFilter] = useState<'all' | 'priority'>('all');

  // Modular Home Layout Engine state (with width span + height in px)
  const [homeModules, setHomeModules] = useState<HomeModuleConfig[]>(() => {
    try {
      const saved = localStorage.getItem(HOME_MODULES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 4 && parsed.every((m: any) => typeof m.height === 'number')) {
          return parsed;
        }
      }
    } catch {
      // Fallback to default layout
    }
    return DEFAULT_HOME_MODULES;
  });
  const [draggedModuleId, setDraggedModuleId] = useState<HomeModuleId | null>(null);
  const [dragOverModuleId, setDragOverModuleId] = useState<HomeModuleId | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [dragOverTaskZone, setDragOverTaskZone] = useState<'focus' | 'pending' | 'completed' | null>(null);
  const [resizingState, setResizingState] = useState<{
    id: HomeModuleId;
    mode: 'height' | 'width' | 'both';
    startX: number;
    startY: number;
    startHeight: number;
    startSpan: ModuleSpan;
    invertX?: boolean;
  } | null>(null);
  const homeGridRef = useRef<HTMLDivElement>(null);

  // Interactive Timeline & Extended Calendar states & Web Audio synthesis
  const [selectedAgendaDate, setSelectedAgendaDate] = useState<Date>(() => new Date());
  const [calendarViewMonth, setCalendarViewMonth] = useState<Date>(() => new Date());
  const [showMonthGrid, setShowMonthGrid] = useState<boolean>(true);
  const [newQuickEventTitle, setNewQuickEventTitle] = useState<string>('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>('e1');
  const [selectedAgendaHour, setSelectedAgendaHour] = useState<number | null>(null);
  const [agendaSoundEnabled, setAgendaSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('workspace_agenda_sound');
    return saved !== null ? saved === 'true' : true;
  });
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playAgendaSound = (kind: 'tick' | 'select' | 'action', forcePlay = false) => {
    if (!agendaSoundEnabled && !forcePlay) return;
    if (typeof window === 'undefined') return;
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      const now = ctx.currentTime;

      if (kind === 'tick') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.045);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (kind === 'select') {
        const freqs = [587.33, 880]; // D5 + A5 warm interval
        freqs.forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = idx === 0 ? 'sine' : 'triangle';
          osc.frequency.setValueAtTime(f, now + idx * 0.025);
          gain.gain.setValueAtTime(0.001, now + idx * 0.025);
          gain.gain.linearRampToValueAtTime(idx === 0 ? 0.07 : 0.045, now + idx * 0.025 + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + idx * 0.025 + 0.22);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.025);
          osc.stop(now + idx * 0.025 + 0.24);
        });
      } else if (kind === 'action') {
        const notes = [523.25, 659.25, 1046.5]; // C5 -> E5 -> C6 chime
        notes.forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          const startAt = now + idx * 0.055;
          osc.frequency.setValueAtTime(f, startAt);
          gain.gain.setValueAtTime(0.001, startAt);
          gain.gain.linearRampToValueAtTime(0.075, startAt + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0008, startAt + 0.32);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(startAt);
          osc.stop(startAt + 0.34);
        });
      }
    } catch {
      // Ignore audio autoplay errors if blocked by browser policy
    }
  };

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('workspace_theme');
    return saved === 'dark';
  });
  const [isThemeTransitioning, setIsThemeTransitioning] = useState(false);
  const themeTransitionTimeoutRef = useRef<number | null>(null);
  const [auroraSettings, setAuroraSettings] = useState({ colorStops: ["#4285F4", "#34A853", "#EA4335"], speed: 0.5 });
  const [showAurora, setShowAurora] = useState<boolean>(() => {
    const saved = localStorage.getItem('workspace_show_aurora');
    return saved !== null ? saved === 'true' : true;
  });
  const [nickname, setNickname] = useState<string>(() => {
    const saved = localStorage.getItem('workspace_nickname');
    return saved && saved !== 'Dev' ? saved : '';
  });
  const [toasts, setToasts] = useState<{id: number, message: string}[]>([]);
  
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<{id: number, title: string, text: string, time: string, read: boolean}[]>([
      { id: 1, title: 'Bem-vindo', text: 'Bem-vindo ao Workspace OS.', time: 'Agora', read: false },
      { id: 2, title: 'Dica do Gemini', text: 'Tente digitar "Criar documento" na barra de busca.', time: '1 min', read: false }
  ]);

  const [showAppLauncher, setShowAppLauncher] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const launcherRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  const notifiedEventsRef = useRef<Set<string>>(new Set());

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuInputRef = useRef<HTMLInputElement>(null);

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

  // Alerta de eventos que começam em até 15 minutos (herdado do Workspace Hub)
  useEffect(() => {
    if (!data?.events?.length) return;
    const checkUpcomingEvents = () => {
        const now = Date.now();
        data.events.forEach((ev: any) => {
            if (notifiedEventsRef.current.has(ev.id)) return;
            const start = new Date(ev.start).getTime();
            const diffMins = Math.floor((start - now) / 60000);
            if (diffMins >= 0 && diffMins <= 15) {
                notifiedEventsRef.current.add(ev.id);
                addToast(`O evento "${ev.title}" começa em ${diffMins <= 0 ? 'instantes' : `${diffMins} min`}.`);
            }
        });
    };
    checkUpcomingEvents();
    const intervalId = setInterval(checkUpcomingEvents, 60000);
    return () => clearInterval(intervalId);
  }, [data?.events]);

  const addToast = (message: string) => {
      const id = Date.now();
      setToasts(prev => [...prev, { id, message }]);
      setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
      }, 4000);
      setNotifications(prev => [{ id, title: 'Sistema', text: message, time: 'Agora', read: false }, ...prev]);
  };

  const updateTasks = (newTasks: any[]) => {
      setData(prev => prev ? { ...prev, tasks: newTasks } : null);
  };

  const updateNotes = (newNotes: any[]) => {
      setData(prev => prev ? { ...prev, notes: newNotes } : null);
  };

  const updateEvents = (newEvents: any[]) => {
      setData(prev => prev ? { ...prev, events: newEvents } : null);
  };

  const handleToggleTaskOnHome = async (taskId: string) => {
      if (!data?.tasks) return;
      const targetTask = data.tasks.find((t: any) => t.id === taskId);
      const nextCompleted = targetTask ? !targetTask.completed : true;
      const updated = data.tasks.map((t: any) =>
          t.id === taskId ? { ...t, completed: nextCompleted } : t
      );
      updateTasks(updated);
      if (data.notes) {
          const syncedNotes = data.notes.map((n: any) =>
              n.linkedTaskId === taskId
                  ? { ...n, status: nextCompleted ? 'completed' : 'in_progress' }
                  : n
          );
          updateNotes(syncedNotes);
      }
      await bridge.toggleTask(taskId);
  };

  const handleQuickAddTask = async () => {
      const title = newTaskTitle.trim();
      if (!title || !data) return;
      const newTask = {
          id: `tk_${Date.now()}`,
          title,
          completed: false,
          date: new Date().toISOString(),
          listId: 'default'
      };
      updateTasks([newTask, ...(data.tasks || [])]);
      setNewTaskTitle('');
      await bridge.createTask(title, '', 'default', newTask.date);
      addToast('Tarefa adicionada ao sprint de foco.');
  };

  const handleCycleTaskPriority = (taskId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!data?.tasks) return;
      playAgendaSound('tick');
      const now = new Date();
      const updated = data.tasks.map((t: any) => {
          if (t.id !== taskId) return t;
          if (!t.date) {
              // Backlog -> Urgent Today
              return { ...t, date: now.toISOString() };
          }
          const dueDate = new Date(t.date);
          const isToday = dueDate.toDateString() === now.toDateString() || dueDate.getTime() < now.getTime();
          if (isToday) {
              // Urgent Today -> Scheduled (3 days out)
              const future = new Date(now.getTime() + 3 * 86400000);
              return { ...t, date: future.toISOString() };
          }
          // Scheduled -> Backlog
          return { ...t, date: undefined };
      });
      updateTasks(updated);
  };

  const handleAddPostItNote = async (title: string, content: string, color: string) => {
      if ((!title.trim() && !content.trim()) || !data) return;
      const newNote = {
          id: Date.now(),
          title: title.trim() || 'Lembrete Rápido',
          content: content.trim(),
          color,
          pinned: true,
          date: new Date().toISOString()
      };
      updateNotes([newNote, ...(data.notes || [])]);
      await bridge.addNote(newNote);
      addToast('Post-it colado no mural.');
  };

  const ALLOWED_SPANS: ModuleSpan[] = [3, 4, 5, 6, 7, 8, 9, 12];

  const snapToAllowedSpan = (rawCols: number, minCol = 3, maxCol = 12): ModuleSpan => {
      const clamped = Math.max(minCol, Math.min(maxCol, rawCols));
      return ALLOWED_SPANS.reduce((prev, curr) =>
          Math.abs(curr - clamped) < Math.abs(prev - clamped) ? curr : prev
      );
  };

  useEffect(() => {
      if (!resizingState) return;
      const handlePointerMove = (e: PointerEvent) => {
          const dx = (e.clientX - resizingState.startX) * (resizingState.invertX ? -1 : 1);
          const dy = e.clientY - resizingState.startY;
          const containerWidth = homeGridRef.current?.clientWidth || 1100;

          setHomeModules((prev) => {
              const agendaMod = prev.find((m) => m.id === 'agenda');
              const isAgendaDocked = Boolean(agendaMod?.dockRight);
              const leftAreaRatio = isAgendaDocked && resizingState.id !== 'agenda'
                  ? (12 - (agendaMod?.span || 4)) / 12
                  : 1;
              const effectiveGridWidth = containerWidth * leftAreaRatio;
              const colWidthPx = Math.max(50, effectiveGridWidth / 12);

              let computedSpanForTarget: ModuleSpan | null = null;

              const updated = prev.map((m) => {
                  if (m.id !== resizingState.id) return m;
                  let nextHeight = m.height;
                  let nextSpan = m.span;

                  if (resizingState.mode === 'height' || resizingState.mode === 'both') {
                      const minH = m.id === 'agenda' ? 360 : 250;
                      const maxH = m.id === 'agenda' ? 920 : 820;
                      nextHeight = Math.round(Math.max(minH, Math.min(maxH, resizingState.startHeight + dy)));
                  }

                  if (resizingState.mode === 'width' || resizingState.mode === 'both') {
                      const deltaCols = dx / colWidthPx;
                      if (m.id === 'agenda' && m.dockRight) {
                          // Right-docked calendar can be resized between 3 and 8 columns (out of 12)
                          nextSpan = snapToAllowedSpan(resizingState.startSpan + deltaCols, 3, 8);
                      } else {
                          nextSpan = snapToAllowedSpan(resizingState.startSpan + deltaCols, 3, 12);
                      }
                      computedSpanForTarget = nextSpan;
                  }

                  return { ...m, height: nextHeight, span: nextSpan };
              });

              // Adapt sibling card (tasks <-> inbox) so the row always fills 100% (12 cols) without orphan gaps
              if (
                  computedSpanForTarget !== null &&
                  (resizingState.id === 'tasks' || resizingState.id === 'inbox')
              ) {
                  const siblingId: HomeModuleId = resizingState.id === 'tasks' ? 'inbox' : 'tasks';
                  const targetSpan: ModuleSpan = computedSpanForTarget;
                  return updated.map((m) => {
                      if (m.id !== siblingId) return m;
                      if (targetSpan === 12) {
                          return { ...m, span: 12 as ModuleSpan };
                      }
                      const complement = Math.max(3, Math.min(9, 12 - targetSpan)) as ModuleSpan;
                      return { ...m, span: complement };
                  });
              }

              return updated;
          });
      };

      const handlePointerUp = () => {
          setHomeModules((curr) => {
              localStorage.setItem(HOME_MODULES_STORAGE_KEY, JSON.stringify(curr));
              return curr;
          });
          setResizingState(null);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      return () => {
          window.removeEventListener('pointermove', handlePointerMove);
          window.removeEventListener('pointerup', handlePointerUp);
      };
  }, [resizingState]);

  const handleStartResize = (
      e: React.PointerEvent,
      mod: HomeModuleConfig,
      mode: 'height' | 'width' | 'both',
      invertX = false
  ) => {
      e.preventDefault();
      e.stopPropagation();
      playAgendaSound('tick');
      setResizingState({
          id: mod.id,
          mode,
          startX: e.clientX,
          startY: e.clientY,
          startHeight: mod.height,
          startSpan: mod.span,
          invertX
      });
  };

  const handleCycleModuleSpan = (moduleId: HomeModuleId) => {
      playAgendaSound('tick');
      setHomeModules((prev) => {
          const next = prev.map((m) => {
              if (m.id !== moduleId) return m;
              if (m.id === 'agenda' && m.dockRight) {
                  const nextAgendaSpan: ModuleSpan = m.span === 3 ? 4 : m.span === 4 ? 5 : m.span === 5 ? 6 : 3;
                  return { ...m, span: nextAgendaSpan };
              }
              const nextSpan: ModuleSpan = m.span === 4 ? 6 : m.span === 6 ? 8 : m.span === 8 ? 12 : 4;
              return { ...m, span: nextSpan };
          });
          localStorage.setItem(HOME_MODULES_STORAGE_KEY, JSON.stringify(next));
          return next;
      });
  };

  const handleToggleAgendaDockRight = () => {
      playAgendaSound('select');
      setHomeModules((prev) => {
          const next = prev.map((m) => {
              if (m.id !== 'agenda') return m;
              const nextDock = !m.dockRight;
              return {
                  ...m,
                  dockRight: nextDock,
                  span: (nextDock ? 4 : 6) as ModuleSpan,
                  height: nextDock ? 680 : 440
              };
          });
          localStorage.setItem(HOME_MODULES_STORAGE_KEY, JSON.stringify(next));
          return next;
      });
  };

  const handleQuickAddAgendaEvent = () => {
      const title = newQuickEventTitle.trim();
      if (!title || !data) return;
      playAgendaSound('action');
      const start = new Date(selectedAgendaDate);
      const targetHour = selectedAgendaHour !== null ? selectedAgendaHour : 15;
      start.setHours(targetHour, 0, 0, 0);
      const end = new Date(start.getTime() + 45 * 60000);
      const newEv = {
          id: `ev_${Date.now()}`,
          title,
          start: start.toISOString(),
          end: end.toISOString(),
          location: 'Google Meet · Sincronizado',
          description: 'Compromisso adicionado pelo Calendário estendido da Home.',
          meetLink: 'https://meet.google.com/new',
          color: '#3B82F6'
      };
      updateEvents([...(data.events || []), newEv]);
      setSelectedEventId(newEv.id);
      setNewQuickEventTitle('');
      addToast(`Compromisso agendado às ${String(targetHour).padStart(2, '0')}:00.`);
  };

  const handleResetHomeModules = () => {
      playAgendaSound('action');
      setHomeModules(DEFAULT_HOME_MODULES);
      localStorage.setItem(HOME_MODULES_STORAGE_KEY, JSON.stringify(DEFAULT_HOME_MODULES));
      addToast('Layout modular da Home restaurado.');
  };

  const handleModuleDrop = (sourceId: HomeModuleId, targetId: HomeModuleId) => {
      if (!sourceId || !targetId || sourceId === targetId) {
          setDraggedModuleId(null);
          setDragOverModuleId(null);
          return;
      }
      playAgendaSound('select');
      setHomeModules((prev) => {
          const next = prev.map((m) => ({ ...m }));
          const fromIdx = next.findIndex((m) => m.id === sourceId);
          const toIdx = next.findIndex((m) => m.id === targetId);
          if (fromIdx === -1 || toIdx === -1) return prev;

          const fromMod = next[fromIdx];
          const toMod = next[toIdx];

          // If one of the modules is docked on the right, swap their dockRight, span, and height so they cleanly trade places
          if (Boolean(fromMod.dockRight) !== Boolean(toMod.dockRight)) {
              const tempDock = fromMod.dockRight;
              const tempSpan = fromMod.span;
              const tempHeight = fromMod.height;
              fromMod.dockRight = toMod.dockRight;
              fromMod.span = toMod.span;
              fromMod.height = toMod.height;
              toMod.dockRight = tempDock;
              toMod.span = tempSpan;
              toMod.height = tempHeight;
          }

          next[fromIdx] = toMod;
          next[toIdx] = fromMod;
          localStorage.setItem(HOME_MODULES_STORAGE_KEY, JSON.stringify(next));
          return next;
      });
      setDraggedModuleId(null);
      setDragOverModuleId(null);
  };

  // Pointer-based Module Drag & Swap listener (works 100% reliably with CSS zoom)
  useEffect(() => {
      if (!draggedModuleId) return;

      const handlePointerMove = (e: PointerEvent) => {
          const el = document.elementFromPoint(e.clientX, e.clientY);
          const moduleWrapper = el?.closest('[data-home-module-id]') as HTMLElement | null;
          const hoveredId = (moduleWrapper?.getAttribute('data-home-module-id') as HomeModuleId | null) || null;
          setDragOverModuleId(hoveredId && hoveredId !== draggedModuleId ? hoveredId : null);
      };

      const handlePointerUp = (e: PointerEvent) => {
          const el = document.elementFromPoint(e.clientX, e.clientY);
          const moduleWrapper = el?.closest('[data-home-module-id]') as HTMLElement | null;
          const targetId = (moduleWrapper?.getAttribute('data-home-module-id') as HomeModuleId | null) || null;
          if (targetId && targetId !== draggedModuleId) {
              handleModuleDrop(draggedModuleId, targetId);
          } else {
              setDraggedModuleId(null);
              setDragOverModuleId(null);
          }
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      return () => {
          window.removeEventListener('pointermove', handlePointerMove);
          window.removeEventListener('pointerup', handlePointerUp);
      };
  }, [draggedModuleId]);

  // Pointer-based Task Drag-and-Drop listener (reorder tasks or drop onto status zones)
  useEffect(() => {
      if (!draggedTaskId) return;

      const handlePointerMove = (e: PointerEvent) => {
          const el = document.elementFromPoint(e.clientX, e.clientY);
          const zoneEl = el?.closest('[data-task-drop-zone]') as HTMLElement | null;
          const taskEl = el?.closest('[data-task-id]') as HTMLElement | null;

          const zone = (zoneEl?.getAttribute('data-task-drop-zone') as 'focus' | 'pending' | 'completed' | null) || null;
          const overTask = taskEl?.getAttribute('data-task-id') || null;

          setDragOverTaskZone(zone);
          setDragOverTaskId(overTask && overTask !== draggedTaskId ? overTask : null);
      };

      const handlePointerUp = (e: PointerEvent) => {
          const el = document.elementFromPoint(e.clientX, e.clientY);
          const zoneEl = el?.closest('[data-task-drop-zone]') as HTMLElement | null;
          const taskEl = el?.closest('[data-task-id]') as HTMLElement | null;

          const zone = (zoneEl?.getAttribute('data-task-drop-zone') as 'focus' | 'pending' | 'completed' | null) || null;
          const targetTaskId = taskEl?.getAttribute('data-task-id') || null;

          if (targetTaskId && targetTaskId !== draggedTaskId && data?.tasks) {
              playAgendaSound('select');
              const list = [...data.tasks];
              const fromIdx = list.findIndex((t: any) => String(t.id) === String(draggedTaskId));
              const toIdx = list.findIndex((t: any) => String(t.id) === String(targetTaskId));
              if (fromIdx !== -1 && toIdx !== -1) {
                  const [moved] = list.splice(fromIdx, 1);
                  // Adopt target task's completion status if dragged across columns
                  const targetTask = data.tasks[toIdx];
                  if (targetTask && moved.completed !== targetTask.completed) {
                      moved.completed = targetTask.completed;
                  }
                  list.splice(toIdx, 0, moved);
                  updateTasks(list);
              }
          } else if (zone && data?.tasks) {
              playAgendaSound('action');
              const updated = data.tasks.map((t: any) => {
                  if (String(t.id) !== String(draggedTaskId)) return t;
                  if (zone === 'completed') return { ...t, completed: true };
                  if (zone === 'pending') return { ...t, completed: false };
                  if (zone === 'focus') return { ...t, completed: false, date: new Date().toISOString() };
                  return t;
              });
              updateTasks(updated);
          }

          setDraggedTaskId(null);
          setDragOverTaskId(null);
          setDragOverTaskZone(null);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      return () => {
          window.removeEventListener('pointermove', handlePointerMove);
          window.removeEventListener('pointerup', handlePointerUp);
      };
  }, [draggedTaskId, data]);

  const handleDeletePostIt = async (noteId: number | string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!data?.notes) return;
      updateNotes(data.notes.filter((n: any) => n.id !== noteId));
      await bridge.deleteNote(noteId);
  };

  const handleTogglePinPostIt = (noteId: number | string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!data?.notes) return;
      const updated = data.notes.map((n: any) =>
          n.id === noteId ? { ...n, pinned: !n.pinned } : n
      );
      updateNotes(updated);
  };

  const handleUpdatePostItNote = async (noteId: number | string, updates: { title?: string; content?: string; color?: string }) => {
      if (!data?.notes) return;
      let updatedItem: any = null;
      const updated = data.notes.map((n: any) => {
          if (n.id === noteId) {
              updatedItem = { ...n, ...updates };
              return updatedItem;
          }
          return n;
      });
      updateNotes(updated);
      if (updatedItem) {
          await bridge.updateNote(updatedItem);
      }
  };

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (launcherRef.current && !launcherRef.current.contains(event.target as Node)) {
              setShowAppLauncher(false);
          }
          if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
              setShowProfileMenu(false);
          }
          if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
              setShowNotifications(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleCommandIntent = (text: string): boolean => {
      const lower = text.toLowerCase();
      if (lower.includes('abrir drive') || lower.includes('ir para o drive')) { openApp('drive'); setChatHistory(prev => [...prev, { role: 'assistant', text: 'Abrindo o Google Drive...' }]); return true; }
      if (lower.includes('criar documento') || lower.includes('novo doc')) { openApp('doc'); setChatHistory(prev => [...prev, { role: 'assistant', text: 'Criando um novo Documento Google...' }]); return true; }
      if (lower.includes('criar planilha') || lower.includes('nova planilha')) { openApp('sheet'); setChatHistory(prev => [...prev, { role: 'assistant', text: 'Criando uma nova Planilha...' }]); return true; }
      if (lower.includes('criar slide') || lower.includes('nova apresentação')) { openApp('slide'); setChatHistory(prev => [...prev, { role: 'assistant', text: 'Criando nova Apresentação...' }]); return true; }
      if (lower.includes('ver email') || lower.includes('abrir gmail')) { openApp('mail'); setChatHistory(prev => [...prev, { role: 'assistant', text: 'Abrindo sua Caixa de Entrada...' }]); return true; }
      if (lower.includes('minha agenda') || lower.includes('calendário')) { openApp('calendar'); setChatHistory(prev => [...prev, { role: 'assistant', text: 'Abrindo Google Agenda...' }]); return true; }
      if (lower.includes('nova tarefa') || lower.includes('criar tarefa')) { openApp('tasks'); setChatHistory(prev => [...prev, { role: 'assistant', text: 'Abrindo Tarefas...' }]); return true; }
      return false;
  };

  const handleSendMessage = async () => {
    if (!searchQuery.trim()) return;
    const text = searchQuery;
    
    setChatHistory(prev => [...prev, { role: 'user', text }]);
    setSearchQuery('');
    if (menuSearchActive) setMenuSearchActive(false);
    setAiMode(true);

    if (handleCommandIntent(text)) {
        return;
    }

    setIsTyping(true);
    try {
        const history = chatHistory.filter(m => m.text).slice(-20).map(({ role, text }) => ({ role, text }));
        setChatHistory(prev => [...prev, { role: 'assistant', text: '' }]);
        const { text: responseText, sources } = await askGemini({ task: 'chat', prompt: text, history });
        setChatHistory(prev => {
            const newHistory = [...prev];
            const lastMsgIndex = newHistory.length - 1;
            if (lastMsgIndex >= 0 && newHistory[lastMsgIndex].role === 'assistant') {
                newHistory[lastMsgIndex] = { ...newHistory[lastMsgIndex], text: responseText, sources: sources };
            }
            return newHistory;
        });
    } catch (error) {
        const text = error instanceof GeminiUnavailableError
            ? "Para interagir com a inteligência artificial Gemini, configure a variável GEMINI_API_KEY nas configurações do ambiente."
            : "Desculpe, não consegui processar sua solicitação no momento.";
        setChatHistory(prev => [...prev.filter(m => m.text), { role: 'assistant', text }]);
    } finally {
        setIsTyping(false);
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
    setShowAppLauncher(false);
  };

  const toggleSearch = () => {
    setActiveTab('search');
    setMenuSearchActive(true);
  };

  const handleToggleTheme = () => {
    if (themeTransitionTimeoutRef.current) {
      window.clearTimeout(themeTransitionTimeoutRef.current);
    }
    setIsThemeTransitioning(true);
    setDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('workspace_theme', next ? 'dark' : 'light');
      return next;
    });
    themeTransitionTimeoutRef.current = window.setTimeout(() => {
      setIsThemeTransitioning(false);
    }, 520);
  };

  if (loading || !data) {
    return <GoogleLoader darkMode={darkMode} />;
  }

  const quickCreateApps = [
    { id: 'search', label: "Pesquisar", icon: <GeminiLogo className="w-6 h-6 glass-icon-svg" />, color: '#4285F4' },
    { id: 'mail', label: "Gmail", icon: <GoogleIcons.Gmail className="w-6 h-6 glass-icon-svg" />, color: '#EA4335' },
    { id: 'drive', label: "Drive", icon: <GoogleIcons.Drive className="w-6 h-6 glass-icon-svg" />, color: '#0F9D58' },
    { id: 'calendar', label: "Agenda", icon: <GoogleIcons.Calendar className="w-6 h-6 glass-icon-svg" />, color: '#1A73E8' },
    { id: 'doc', label: "Docs", icon: <GoogleIcons.Docs className="w-6 h-6 glass-icon-svg" />, color: '#4285F4' },
    { id: 'sheet', label: "Sheets", icon: <GoogleIcons.Sheets className="w-6 h-6 glass-icon-svg" />, color: '#0F9D58' },
    { id: 'slide', label: "Slides", icon: <GoogleIcons.Slides className="w-6 h-6 glass-icon-svg" />, color: '#FBBC04' },
    { id: 'tasks', label: "Tarefas", icon: <GoogleIcons.Tasks className="w-6 h-6 glass-icon-svg" />, color: '#1A73E8' },
    { id: 'keep', label: "Keep", icon: <GoogleIcons.Keep className="w-6 h-6 glass-icon-svg" />, color: '#FBBC04' },
    { id: 'meet', label: "Meet", icon: <GoogleIcons.Meet className="w-6 h-6 glass-icon-svg" />, color: '#00832D' },
  ];

  const launcherApps = [
      { id: 'mail', label: 'Gmail', icon: <GoogleIcons.Gmail className="w-8 h-8 glass-icon-svg"/> },
      { id: 'drive', label: 'Drive', icon: <GoogleIcons.Drive className="w-8 h-8 glass-icon-svg"/> },
      { id: 'calendar', label: 'Agenda', icon: <GoogleIcons.Calendar className="w-8 h-8 glass-icon-svg"/> },
      { id: 'meet', label: 'Meet', icon: <GoogleIcons.Meet className="w-8 h-8 glass-icon-svg"/> },
      { id: 'doc', label: 'Docs', icon: <GoogleIcons.Docs className="w-8 h-8 glass-icon-svg"/> },
      { id: 'sheet', label: 'Sheets', icon: <GoogleIcons.Sheets className="w-8 h-8 glass-icon-svg"/> },
      { id: 'slide', label: 'Slides', icon: <GoogleIcons.Slides className="w-8 h-8 glass-icon-svg"/> },
      { id: 'tasks', label: 'Tarefas', icon: <GoogleIcons.Tasks className="w-8 h-8 glass-icon-svg"/> },
      { id: 'keep', label: 'Keep', icon: <GoogleIcons.Keep className="w-8 h-8 glass-icon-svg"/> },
      { id: 'search', label: 'Busca', icon: <GoogleIcons.Search className="w-8 h-8 glass-icon-svg"/> },
      { id: 'security', label: 'Segurança', icon: <GoogleIcons.Security className="w-8 h-8 glass-icon-svg"/> },
      { id: 'permissions', label: 'Permissões', icon: <GoogleIcons.Contacts className="w-8 h-8 glass-icon-svg"/> },
      { id: 'settings', label: 'Ajustes', icon: <GoogleIcons.Settings className="w-8 h-8 glass-icon-svg"/> },
  ];

  const isAppOpen = !!activeApp;
  const glassCard = "glass-surface rounded-3xl transition-all duration-300 flex flex-col justify-between";
  const glassInner = "glass-item transition-all duration-200";
  const textColor = darkMode ? "text-[#E3E3E3]" : "text-[#202124]";
  const subTextColor = darkMode ? "text-white/70" : "text-[#5f6368]";
  const cardHeaderBorder = darkMode ? "border-white/[0.08]" : "border-black/[0.06]";
  const cardIconBadge = "glass-item";
  const cardPillBadge = `glass-item ${darkMode ? "text-white/60" : "text-gray-600"}`;

  const getFileIcon = (type: string) => {
    switch(type) {
        case 'sheet': return <GoogleIcons.Sheets className="w-5 h-5" />;
        case 'slide': return <GoogleIcons.Slides className="w-5 h-5" />;
        case 'doc': return <GoogleIcons.Docs className="w-5 h-5" />;
        default: return <FileText className="w-5 h-5 text-gray-400" />;
    }
  };
  
  const todayEvents = data.events?.filter(e => new Date(e.start).toDateString() === new Date().toDateString())
      .sort((a,b) => new Date(a.start).getTime() - new Date(b.start).getTime()) || [];

  return (
    <div className={`min-h-screen font-sans overflow-hidden relative transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${isThemeTransitioning ? 'theme-transitioning' : ''} ${darkMode ? 'dark-theme bg-[#050505] text-[#E3E3E3] selection:bg-[#4E79F3]/30' : 'light-theme bg-[#F0F2F5] text-[#202124] selection:bg-[#4E79F3]/20'}`}>
      {showAurora && (
        <div className={`fixed top-0 left-0 right-0 h-[600px] z-0 pointer-events-none mask-aurora-bottom transition-opacity duration-1000 ${aiMode ? 'opacity-35' : 'opacity-100'}`}>
            <Aurora colorStops={auroraSettings.colorStops} speed={auroraSettings.speed} amplitude={1.2} blend={0.55} darkMode={darkMode} />
        </div>
      )}
      <div
        className={`fixed inset-0 z-[1] pointer-events-none ${darkMode ? 'opacity-[0.032]' : 'opacity-[0.025]'}`}
        style={{
          backgroundImage: NOISE_DATA_URI ? `url(${NOISE_DATA_URI})` : undefined,
          backgroundRepeat: 'repeat',
          backgroundSize: '128px 128px'
        }}
      />

      <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">
          {toasts.map(toast => (
              <div key={toast.id} className={`glass-popover ${textColor} px-6 py-3 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto`}>
                  <Info size={18} className="text-blue-500"/>
                  <span className="text-sm font-medium">{toast.message}</span>
              </div>
          ))}
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
              onUpdateEvents={updateEvents}
              showToast={addToast}
              toggleTheme={handleToggleTheme}
              isDarkMode={darkMode}
              showAurora={showAurora}
              onToggleAurora={() => {
                  const next = !showAurora;
                  setShowAurora(next);
                  localStorage.setItem('workspace_show_aurora', String(next));
              }}
              onUpdateTheme={(settings: any) => setAuroraSettings(settings)}
              onUpdateNickname={(nick: string) => {
                  setNickname(nick);
                  localStorage.setItem('workspace_nickname', nick);
              }}
          />
      )}

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
              <Home size={22} className="home-icon" />
          </button>

          <div 
              className={`relative flex items-center glass-surface px-2.5 rounded-full gap-1.5 pointer-events-auto transition-all duration-300 ${isAppOpen ? 'opacity-95' : 'opacity-100'}`}
              style={{ height: '54px' }}
          >
              {menuSearchActive ? (
                  <div className="flex items-center px-4 py-2 w-[500px] animate-in fade-in zoom-in duration-300">
                      <GeminiLogo className="ml-2 mr-3 w-6 h-6 shrink-0" />
                      <input 
                          ref={menuInputRef}
                          type="text" 
                          placeholder="Pesquise ou fale com o Gemini" 
                          className={`flex-1 bg-transparent outline-none ${darkMode ? 'text-white placeholder:text-white/40' : 'text-black placeholder:text-black/40'} h-full text-base font-light`}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                          autoFocus
                      />
                      <button onClick={() => { setMenuSearchActive(false); setSearchQuery(''); }} className={`p-2 rounded-full ml-2 transition-all ${darkMode ? 'hover:bg-white/10 text-white/70' : 'hover:bg-black/10 text-black/70'} active:scale-90`}>
                          <X size={18} />
                      </button>
                  </div>
              ) : (
                  <>
                      {quickCreateApps.map((app) => {
                          const isActive = activeTab === app.id;

                          return (
                            <button 
                                key={app.id} 
                                onClick={() => app.id === 'search' ? toggleSearch() : openApp(app.id)}
                                className={`group relative flex items-center justify-center w-11 h-11 rounded-full transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-90 ${
                                    isActive 
                                        ? (darkMode ? 'bg-white/[0.18] shadow-[0_0_16px_rgba(255,255,255,0.22)]' : 'bg-blue-500/15 shadow-[0_0_16px_rgba(66,133,244,0.20)]')
                                        : (darkMode ? 'hover:bg-white/[0.10]' : 'hover:bg-black/[0.06]')
                                }`}
                                title={app.label}
                            >
                                <div className={`w-6 h-6 flex items-center justify-center shrink-0 origin-center transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                                    isActive ? 'scale-110' : 'scale-100 group-hover:scale-110'
                                }`}>
                                    {React.cloneElement(app.icon as React.ReactElement<any>, {
                                        className: `w-6 h-6 shrink-0 block glass-icon-svg ${isActive ? 'active' : ''}`,
                                        glass: false
                                    })}
                                </div>
                                {isActive && (
                                    <div className={`w-1 h-1 rounded-full absolute bottom-1 left-1/2 -translate-x-1/2 ${darkMode ? 'bg-white shadow-[0_0_6px_#fff]' : 'bg-blue-600 shadow-[0_0_6px_#2563eb]'}`}></div>
                                )}
                                <span className={`absolute -top-9 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none px-2.5 py-1 rounded-lg text-[11px] font-medium tracking-wide transition-all duration-200 backdrop-blur-md border shadow-lg whitespace-nowrap z-50 ${darkMode ? 'bg-black/85 text-white border-white/10' : 'bg-gray-900/90 text-white border-black/10'}`}>
                                    {app.label}
                                </span>
                            </button>
                          );
                      })}
                  </>
              )}
          </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:px-8 md:pt-6 md:pb-8 flex flex-col h-screen relative z-10 pb-24">
        <header className={`relative z-40 mb-4 h-16 shrink-0 flex items-center px-2 justify-between transition-all duration-700 ${aiMode ? 'opacity-0 -translate-y-10 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
            <div className="flex flex-col justify-center animate-in fade-in duration-300 relative z-10">
                <h1 className="text-3xl md:text-4xl font-semibold text-white drop-shadow-md tracking-tight">
                   {getGreeting()}, <span>{nickname || data.user.name.split(' ')[0]}</span>
                </h1>
            </div>
            <div className="flex items-center gap-3 animate-in fade-in duration-300 relative z-10">
                <WeatherWidget darkMode={darkMode} textColor={textColor} fallbackTemp={data.weather.temp} />

                <button
                    onClick={handleToggleTheme}
                    className={`relative w-10 h-10 rounded-full flex items-center justify-center glass-control overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-90 ${
                        darkMode ? 'text-white/80 hover:text-white' : 'text-gray-700 hover:text-black'
                    }`}
                    title={darkMode ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
                >
                    <Sun
                        size={18}
                        className={`absolute transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                            darkMode ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-0 opacity-0'
                        }`}
                    />
                    <Moon
                        size={18}
                        className={`absolute transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                            darkMode ? '-rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
                        }`}
                    />
                </button>
                
                <div className="relative" ref={notificationRef}>
                     <button 
                         onClick={() => setShowNotifications(!showNotifications)} 
                         className={`w-10 h-10 rounded-full flex items-center justify-center glass-control transition-all relative ${
                             darkMode ? 'text-white/80 hover:text-white' : 'text-gray-700 hover:text-black'
                         }`}
                         title="Notificações"
                     >
                         <Bell size={18} />
                         {notifications.some(n => !n.read) && <span className={`absolute top-2 right-2 w-2 h-2 bg-[#EA4335] rounded-full ring-2 ${darkMode ? 'ring-[#050505]' : 'ring-white'}`}></span>}
                     </button>
                     {showNotifications && (
                         <div className="absolute top-14 right-0 w-[360px] glass-popover rounded-3xl p-0 z-50 animate-in fade-in zoom-in duration-200 overflow-hidden flex flex-col">
                            <div className={`p-4 border-b ${cardHeaderBorder} flex justify-between items-center`}>
                                <span className={`text-sm font-medium ${textColor}`}>Notificações</span>
                                <button className={`text-xs ${subTextColor} hover:text-blue-500`} onClick={() => setNotifications([])}>Limpar tudo</button>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-2 space-y-1.5">
                                {notifications.length === 0 ? <div className={`p-6 text-center text-xs ${subTextColor}`}>Nenhuma notificação nova</div> : notifications.map(n => (
                                    <div key={n.id} className="p-3 rounded-xl flex items-start gap-3 glass-item transition-all relative group">
                                        <div className="p-2 bg-[#4E79F3]/15 rounded-full text-[#4E79F3]"><Info size={16}/></div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-baseline"><h4 className={`text-sm font-medium ${textColor}`}>{n.title}</h4><span className={`text-[10px] ${subTextColor}`}>{n.time}</span></div>
                                            <p className={`text-xs ${subTextColor} mt-0.5 leading-relaxed`}>{n.text}</p>
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); setNotifications(prev => prev.filter(item => item.id !== n.id)); }} className={`absolute top-2 right-2 p-1 ${darkMode ? 'text-white/20 hover:text-white' : 'text-black/30 hover:text-black'} opacity-0 group-hover:opacity-100 transition-all`}><X size={12}/></button>
                                    </div>
                                ))}
                            </div>
                         </div>
                     )}
                </div>

                <div className="relative" ref={launcherRef}>
                    <button 
                        onClick={() => setShowAppLauncher(!showAppLauncher)} 
                        className={`w-10 h-10 rounded-full flex items-center justify-center glass-control transition-all ${
                            darkMode ? 'text-white/80 hover:text-white' : 'text-gray-700 hover:text-black'
                        }`}
                        title="Google Apps"
                    >
                        <GoogleIcons.AppsGrid className="w-5 h-5" glass={darkMode} />
                    </button>
                    {showAppLauncher && (
                        <div className="absolute top-14 right-0 w-[340px] glass-popover rounded-3xl p-4 z-50 animate-in fade-in zoom-in duration-200 grid grid-cols-3 gap-2.5 max-h-[440px] overflow-y-auto custom-scrollbar">
                            {launcherApps.map((app) => (
                                <button key={app.id} onClick={() => openApp(app.id)} className={`flex flex-col items-center justify-center p-3 rounded-2xl ${darkMode ? 'hover:bg-white/[0.08]' : 'hover:bg-white/60'} transition-all gap-2 group`}>
                                    <div className="w-8 h-8 flex items-center justify-center group-hover:scale-115 group-hover:-translate-y-1 transition-all duration-200">
                                        {React.cloneElement(app.icon as React.ReactElement<any>, { glass: false, className: 'w-8 h-8 glass-icon-svg' })}
                                    </div>
                                    <span className={`text-xs font-medium ${darkMode ? 'text-white/70 group-hover:text-white' : 'text-black/70 group-hover:text-black'} transition-colors`}>{app.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="relative" ref={profileRef}>
                    <img src={data.user.avatar} alt="Profile" onClick={() => setShowProfileMenu(!showProfileMenu)} className={`w-10 h-10 rounded-full border ${darkMode ? 'border-white/20 hover:ring-white/20' : 'border-white/80 hover:ring-black/10'} hover:ring-2 cursor-pointer transition-all shadow-sm object-cover`} />
                    {showProfileMenu && (
                        <div className="absolute top-12 right-0 w-80 glass-popover rounded-3xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
                            <div className={`p-4 border-b ${cardHeaderBorder} flex flex-col items-center text-center`}>
                                <img src={data.user.avatar} alt="Profile" className={`w-16 h-16 rounded-full mb-3 border-2 ${darkMode ? 'border-white/15' : 'border-white/80'} shadow-lg`} />
                                <h3 className={`font-medium text-base ${textColor}`}>{data.user.name}</h3>
                                <p className={`${subTextColor} text-sm mb-4`}>{data.user.email}</p>
                                <button className={`px-4 py-2 rounded-full glass-item ${textColor} text-sm transition-all`}>Gerenciar sua Conta do Google</button>
                            </div>
                            <div className="flex flex-col gap-1 p-1">
                                <button className={`flex items-center gap-4 px-4 py-3 rounded-xl ${darkMode ? 'hover:bg-white/8 text-white/80' : 'hover:bg-white/60 text-black/80'} text-sm transition-colors text-left`}>
                                    <div className="w-8 flex justify-center"><GoogleIcons.Contacts className="w-5 h-5"/></div>
                                    Adicionar outra conta
                                </button>
                                <button onClick={() => openApp('settings')} className={`flex items-center gap-4 px-4 py-3 rounded-xl ${darkMode ? 'hover:bg-white/8 text-white/80' : 'hover:bg-white/60 text-black/80'} text-sm transition-colors text-left`}>
                                    <div className="w-8 flex justify-center"><GoogleIcons.Settings className="w-5 h-5"/></div>
                                    Configurações
                                </button>
                                <button className={`flex items-center gap-4 px-4 py-3 rounded-xl ${darkMode ? 'hover:bg-white/8 text-white/80 border-t border-white/5' : 'hover:bg-white/60 text-black/80 border-t border-black/5'} text-sm transition-colors text-left`}>
                                    <div className="w-8 flex justify-center"><LogOut size={20}/></div>
                                    Sair de todas as contas
                                </button>
                                <div className={`flex justify-center gap-4 py-2 text-[10px] ${darkMode ? 'text-white/30' : 'text-black/40'}`}>
                                    <span className="hover:opacity-80 cursor-pointer">Privacidade</span>
                                    <span className={`w-1 h-1 ${darkMode ? 'bg-white/20' : 'bg-black/20'} rounded-full self-center`}></span>
                                    <span className="hover:opacity-80 cursor-pointer">Termos</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>

        <div className="flex-1 min-h-0 relative w-full h-full overflow-y-auto overflow-x-hidden pr-1 custom-scrollbar flex flex-col">
            {(() => {
                const nowMs = Date.now();
                const allTasks = data.tasks || [];
                const completedCount = allTasks.filter((t: any) => t.completed).length;
                const totalTasksCount = allTasks.length;
                const progressPct = totalTasksCount > 0 ? Math.round((completedCount / totalTasksCount) * 100) : 0;

                const classifyTask = (t: any) => {
                    if (t.completed) return { tag: 'Concluída', priority: 3, badgeClass: darkMode ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/25' : 'text-emerald-700 bg-emerald-500/15 border-emerald-600/25' };
                    if (!t.date) return { tag: 'Backlog', priority: 2, badgeClass: darkMode ? 'text-white/60 bg-white/10 border-white/15' : 'text-slate-600 bg-black/[0.06] border-black/10' };
                    const dueDate = new Date(t.date);
                    const isSameDay = dueDate.toDateString() === new Date().toDateString();
                    if (isSameDay || dueDate.getTime() < nowMs) {
                        return { tag: 'Urgente · Hoje', priority: 0, badgeClass: darkMode ? 'text-amber-300 bg-amber-500/15 border-amber-500/30' : 'text-amber-800 bg-amber-500/20 border-amber-600/30' };
                    }
                    return {
                        tag: dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
                        priority: 1,
                        badgeClass: darkMode ? 'text-blue-300 bg-blue-500/15 border-blue-500/25' : 'text-blue-700 bg-blue-500/15 border-blue-600/25'
                    };
                };

                const filteredTasks = [...allTasks].filter((t: any) => {
                    if (taskFilter === 'completed') return t.completed;
                    if (taskFilter === 'pending') return !t.completed;
                    return true;
                });

                const sortedEvents = [...(data.events || [])]
                    .sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime());

                const todayDate = new Date();
                const eventsForSelectedDay = sortedEvents.filter(
                    (ev: any) => new Date(ev.start).toDateString() === selectedAgendaDate.toDateString()
                );
                const timelineEvents = eventsForSelectedDay.length > 0 ? eventsForSelectedDay : sortedEvents.slice(0, 4);
                const activeEventId = timelineEvents.some((ev: any) => ev.id === selectedEventId)
                    ? selectedEventId
                    : (timelineEvents.find((ev: any) => new Date(ev.end).getTime() >= nowMs)?.id || timelineEvents[0]?.id || null);

                const activeEventObj = timelineEvents.find((ev: any) => ev.id === activeEventId);
                const activeEventHour = activeEventObj ? new Date(activeEventObj.start).getHours() : todayDate.getHours();
                const highlightedHour = selectedAgendaHour !== null ? selectedAgendaHour : activeEventHour;

                // Build 24-hour slots in 24h format (starting at 07:00..23:00 then 00:00..06:00 so active hours are immediately visible)
                const hours24Slots = Array.from({ length: 24 }, (_, idx) => {
                    const hour = (idx + 7) % 24;
                    const label24 = `${String(hour).padStart(2, '0')}:00`;
                    const matchingEvent = timelineEvents.find((ev: any) => new Date(ev.start).getHours() === hour);
                    return {
                        hour,
                        label24,
                        isSelected: hour === highlightedHour,
                        hasEvents: Boolean(matchingEvent),
                        matchingEventId: matchingEvent?.id || null
                    };
                });

                const isSelectedToday = selectedAgendaDate.toDateString() === todayDate.toDateString();
                const agendaHeading = isSelectedToday
                    ? 'Hoje'
                    : new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(selectedAgendaDate).replace(/^\w/, c => c.toUpperCase());
                const agendaDateSubtitle = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }).format(selectedAgendaDate);

                const allEmails = data.emails || [];
                const filteredEmails = inboxFilter === 'priority'
                    ? allEmails.filter((e: any, idx: number) => idx < 2 || e.subject?.toLowerCase().includes('urgente') || e.subject?.toLowerCase().includes('revisão'))
                    : allEmails;

                const sortedNotes = [...(data.notes || [])].sort((a: any, b: any) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
                const postItPalette = darkMode ? postItColorsDark : postItColorsLight;

                const isLayoutCustomized = JSON.stringify(homeModules) !== JSON.stringify(DEFAULT_HOME_MODULES);

                const SPAN_CLASS_MAP: Record<ModuleSpan, string> = {
                    3: 'md:col-span-3',
                    4: 'md:col-span-4',
                    5: 'md:col-span-5',
                    6: 'md:col-span-6',
                    7: 'md:col-span-7',
                    8: 'md:col-span-8',
                    9: 'md:col-span-9',
                    12: 'md:col-span-12'
                };

                const getSpanClass = (span: ModuleSpan) => SPAN_CLASS_MAP[span] || 'md:col-span-6';

                const getSpanLabel = (mod: HomeModuleConfig) => {
                    if (mod.id === 'agenda' && mod.dockRight) {
                        return `${Math.round((mod.span / 12) * 100)}%`;
                    }
                    if (mod.span === 12) return '100%';
                    if (mod.span === 6) return '50%';
                    if (mod.span === 4) return '33%';
                    if (mod.span === 8) return '66%';
                    return `${mod.span}/12`;
                };

                // Build Mini-Month Calendar grid days for extended right-side Agenda
                const year = calendarViewMonth.getFullYear();
                const month = calendarViewMonth.getMonth();
                const firstDayOfMonth = new Date(year, month, 1);
                const startDayOffset = (firstDayOfMonth.getDay() + 6) % 7; // Monday = 0
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const monthTitle = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
                    .format(calendarViewMonth)
                    .replace(/^\w/, (c) => c.toUpperCase());

                const miniMonthCells = Array.from({ length: 42 }, (_, idx) => {
                    const dayOffset = idx - startDayOffset + 1;
                    const cellDate = new Date(year, month, dayOffset);
                    const isCurrentMonth = cellDate.getMonth() === month;
                    const isSelected = cellDate.toDateString() === selectedAgendaDate.toDateString();
                    const isTodayCell = cellDate.toDateString() === todayDate.toDateString();
                    const hasEvent = sortedEvents.some(
                        (ev: any) => new Date(ev.start).toDateString() === cellDate.toDateString()
                    );
                    return {
                        date: cellDate,
                        dayNum: cellDate.getDate(),
                        isCurrentMonth,
                        isSelected,
                        isToday: isTodayCell,
                        hasEvent
                    };
                });
                // Trim trailing row if completely next month
                const visibleMonthCells = miniMonthCells.slice(35).every((c) => !c.isCurrentMonth)
                    ? miniMonthCells.slice(0, 35)
                    : miniMonthCells;

                const renderModuleDragControls = (mod: HomeModuleConfig) => (
                    <div className="flex items-center gap-1 mr-1">
                        <div
                            onPointerDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                playAgendaSound('tick');
                                setDraggedModuleId(mod.id);
                            }}
                            style={{ touchAction: 'none' }}
                            className={`p-1.5 rounded-lg cursor-grab active:cursor-grabbing transition-all select-none ${
                                draggedModuleId === mod.id
                                    ? 'bg-[#3B82F6] text-white scale-110 shadow-md'
                                    : `${subTextColor} hover:${textColor} hover:bg-black/10 dark:hover:bg-white/10`
                            }`}
                            title="Arraste para trocar este card de posição na Home"
                        >
                            <GripVertical size={14} />
                        </div>
                    </div>
                );

                const renderResizeHandles = (mod: HomeModuleConfig) => {
                    if (mod.id === 'postits') return null;
                    const isResizingThis = resizingState?.id === mod.id;
                    const isRightDockedAgenda = mod.id === 'agenda' && Boolean(mod.dockRight);

                    return (
                        <>
                            {/* Live dimension pill while user is dragging to resize */}
                            {isResizingThis && (
                                <div className="absolute top-3 right-3 z-40 px-2.5 py-1 rounded-full bg-[#3B82F6] text-white text-[10px] font-bold tracking-wide shadow-lg pointer-events-none flex items-center gap-1.5 animate-in fade-in duration-150">
                                    <Maximize2 size={10} />
                                    <span>{getSpanLabel(mod)} · {mod.height}px</span>
                                </div>
                            )}

                            {/* Bottom Edge Handle (Vertical Height Resize) */}
                            <div
                                onPointerDown={(e) => handleStartResize(e, mod, 'height')}
                                className="absolute bottom-0 left-6 right-6 h-3 cursor-ns-resize z-30 flex items-center justify-center group/resize-y"
                                title="Arraste para redimensionar a altura"
                            >
                                <div className={`w-10 h-1 rounded-full transition-all duration-200 ${
                                    isResizingThis
                                        ? 'bg-[#3B82F6] w-16 shadow-[0_0_8px_#3B82F6]'
                                        : 'bg-transparent group-hover/resize-y:bg-[#3B82F6]/70'
                                }`} />
                            </div>

                            {/* Side Edge Handle (Horizontal Width Resize: Left edge if docked right, Right edge otherwise) */}
                            {isRightDockedAgenda ? (
                                <div
                                    onPointerDown={(e) => handleStartResize(e, mod, 'width', true)}
                                    className="hidden md:flex absolute top-8 bottom-8 left-0 w-3 cursor-ew-resize z-30 items-center justify-center group/resize-x"
                                    title="Arraste para redimensionar a largura do Calendário"
                                >
                                    <div className={`h-12 w-1 rounded-full transition-all duration-200 ${
                                        isResizingThis
                                            ? 'bg-[#3B82F6] h-20 shadow-[0_0_8px_#3B82F6]'
                                            : 'bg-transparent group-hover/resize-x:bg-[#3B82F6]/70'
                                    }`} />
                                </div>
                            ) : (
                                <div
                                    onPointerDown={(e) => handleStartResize(e, mod, 'width', false)}
                                    className="hidden md:flex absolute top-8 bottom-8 right-0 w-3 cursor-ew-resize z-30 items-center justify-center group/resize-x"
                                    title="Arraste para redimensionar a largura do card"
                                >
                                    <div className={`h-12 w-1 rounded-full transition-all duration-200 ${
                                        isResizingThis
                                            ? 'bg-[#3B82F6] h-20 shadow-[0_0_8px_#3B82F6]'
                                            : 'bg-transparent group-hover/resize-x:bg-[#3B82F6]/70'
                                    }`} />
                                </div>
                            )}

                            {/* Corner Handle (Simultaneous 2D Width + Height Resize) */}
                            <div
                                onPointerDown={(e) => handleStartResize(e, mod, 'both', isRightDockedAgenda)}
                                className={`hidden md:flex absolute bottom-1.5 ${
                                    isRightDockedAgenda ? 'left-1.5 cursor-nesw-resize' : 'right-1.5 cursor-nwse-resize'
                                } w-5 h-5 z-30 items-center justify-center rounded-md opacity-40 hover:opacity-100 transition-opacity`}
                                title="Arraste para redimensionar largura e altura livremente"
                            >
                                <svg
                                    viewBox="0 0 12 12"
                                    className={`w-3 h-3 ${isResizingThis ? 'text-[#3B82F6]' : subTextColor} ${isRightDockedAgenda ? '-scale-x-100' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.6"
                                    strokeLinecap="round"
                                >
                                    <line x1="10" y1="4" x2="4" y2="10" />
                                    <line x1="10" y1="8" x2="8" y2="10" />
                                </svg>
                            </div>
                        </>
                    );
                };

                const renderModuleById = (mod: HomeModuleConfig, forceFullColWidth = false) => {
                    const spanClass = forceFullColWidth ? 'col-span-12 md:col-span-12' : `col-span-12 ${getSpanClass(mod.span)}`;
                    const isDragged = draggedModuleId === mod.id;
                    const isDragOver = dragOverModuleId === mod.id && draggedModuleId !== mod.id;
                    const isResizingThis = resizingState?.id === mod.id;
                    const isCompactHeight = mod.height < 320;
                    const isCompactAgendaHeight = mod.height < 560;
                    const overflowClass = mod.id === 'postits' ? 'overflow-visible' : 'overflow-hidden [container-type:inline-size]';
                    const dragWrapperClasses = `${spanClass} w-full min-w-0 ${overflowClass} relative transition-all ${
                        isResizingThis ? 'duration-75 ring-2 ring-[#3B82F6]/80 select-none z-20' : 'duration-300'
                    } ${
                        isDragged ? 'opacity-50 scale-[0.98]' : ''
                    } ${isDragOver ? 'ring-2 ring-[#3B82F6] ring-offset-2 ring-offset-transparent scale-[1.01] rounded-3xl' : ''}`;

                    const commonDragProps = {
                        'data-home-module-id': mod.id,
                    };

                    if (mod.id === 'agenda') {
                        const isDefaultDockedHeight = Boolean(mod.dockRight) && mod.height === 760;
                        return (
                            <div
                                key={mod.id}
                                {...commonDragProps}
                                style={isDefaultDockedHeight ? undefined : { height: `${mod.height}px` }}
                                className={`${glassCard} ${dragWrapperClasses} ${isCompactAgendaHeight ? 'p-3.5 sm:p-4' : 'p-4 sm:p-5'} ${isDefaultDockedHeight ? 'h-full flex-1 min-h-[540px]' : 'max-h-[calc(100vh-105px)]'} flex flex-col`}
                            >
                                {renderResizeHandles(mod)}

                                {/* Top Header: Adaptive Date Subtitle + Bold "Hoje" + Month Toggle */}
                                <div className="flex flex-wrap items-start justify-between gap-2 shrink-0">
                                    <div className="flex items-start gap-1.5 min-w-0">
                                        {renderModuleDragControls(mod)}
                                        <div className="min-w-0">
                                            <span className={`text-[11px] font-medium capitalize tracking-wide block truncate ${subTextColor}`}>
                                                {agendaDateSubtitle}
                                            </span>
                                            <h3 className={`${isCompactAgendaHeight ? 'text-xl' : 'text-xl @[300px]:text-2xl'} font-extrabold tracking-tight leading-tight mt-0.5 truncate ${textColor}`}>
                                                {agendaHeading}
                                            </h3>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                playAgendaSound('tick');
                                                setShowMonthGrid((prev) => !prev);
                                            }}
                                            className={`px-2.5 h-8 rounded-full text-[11px] font-medium transition-all glass-item flex items-center gap-1 ${
                                                showMonthGrid ? 'text-[#3B82F6]' : subTextColor
                                            }`}
                                            title={showMonthGrid ? 'Recolher calendário mensal' : 'Expandir calendário mensal'}
                                        >
                                            <Calendar size={13} />
                                            <span>Mês</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Adaptive Body: Stacked when narrow, Side-by-Side 2-Col when widened (@[520px]) */}
                                <div className="flex-1 min-h-0 flex flex-col @[520px]:grid @[520px]:grid-cols-12 @[520px]:gap-4 mt-2 overflow-hidden">
                                    {/* Left/Top Column: Mini-Month Calendar Grid + 7-Day Week Strip */}
                                    <div className={`flex flex-col shrink-0 ${showMonthGrid ? '@[520px]:col-span-5' : '@[520px]:col-span-12'}`}>
                                        {showMonthGrid && (
                                            <div className={`pt-2 pb-1.5 px-2.5 rounded-2xl border ${
                                                darkMode ? 'bg-black/25 border-white/10' : 'bg-white/55 border-black/10'
                                            } shrink-0 transition-all duration-300`}>
                                                <div className="flex items-center justify-between mb-1.5 px-1 gap-1">
                                                    <span className={`text-xs font-bold tracking-tight truncate ${textColor}`}>
                                                        {monthTitle}
                                                    </span>
                                                    <div className="flex items-center gap-0.5 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                playAgendaSound('tick');
                                                                setCalendarViewMonth(new Date(year, month - 1, 1));
                                                            }}
                                                            className={`w-6 h-6 rounded-lg flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 ${subTextColor} hover:${textColor}`}
                                                            title="Mês anterior"
                                                        >
                                                            <ChevronLeft size={13} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                playAgendaSound('tick');
                                                                const now = new Date();
                                                                setCalendarViewMonth(now);
                                                                setSelectedAgendaDate(now);
                                                            }}
                                                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                                                                isSelectedToday ? 'text-[#3B82F6] bg-[#3B82F6]/10' : `${subTextColor} hover:${textColor}`
                                                            }`}
                                                        >
                                                            Hoje
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                playAgendaSound('tick');
                                                                setCalendarViewMonth(new Date(year, month + 1, 1));
                                                            }}
                                                            className={`w-6 h-6 rounded-lg flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 ${subTextColor} hover:${textColor}`}
                                                            title="Próximo mês"
                                                        >
                                                            <ChevronRight size={13} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-7 gap-0.5 text-center mb-0.5">
                                                    {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => (
                                                        <span key={i} className={`text-[9px] font-bold uppercase ${subTextColor}`}>
                                                            {d}
                                                        </span>
                                                    ))}
                                                </div>

                                                <div className="grid grid-cols-7 gap-0.5">
                                                    {visibleMonthCells.map((cell) => (
                                                        <button
                                                            key={cell.date.toISOString()}
                                                            type="button"
                                                            onClick={() => {
                                                                playAgendaSound('tick');
                                                                setSelectedAgendaDate(cell.date);
                                                                if (!cell.isCurrentMonth) {
                                                                    setCalendarViewMonth(new Date(cell.date.getFullYear(), cell.date.getMonth(), 1));
                                                                }
                                                            }}
                                                            className={`${isCompactAgendaHeight ? 'h-5 text-[10px]' : 'h-6 text-[11px]'} rounded-lg flex flex-col items-center justify-center relative font-semibold transition-all ${
                                                                cell.isSelected
                                                                    ? 'bg-[#3B82F6] text-white shadow-sm font-bold'
                                                                    : cell.isToday
                                                                        ? 'border border-[#3B82F6]/60 text-[#3B82F6] font-bold'
                                                                        : cell.isCurrentMonth
                                                                            ? `${textColor} hover:bg-black/5 dark:hover:bg-white/10`
                                                                            : `${subTextColor} opacity-35 hover:opacity-70`
                                                            }`}
                                                        >
                                                            <span className="leading-none">{cell.dayNum}</span>
                                                            {cell.hasEvent && (
                                                                <span className={`w-1 h-1 rounded-full mt-0.5 ${
                                                                    cell.isSelected ? 'bg-white' : 'bg-[#3B82F6]'
                                                                }`} />
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Interactive 24h Format Hours Strip (00:00 .. 23:00) */}
                                        <div className={`flex items-center gap-1 py-1.5 my-1.5 border-b ${cardHeaderBorder} shrink-0 overflow-x-auto custom-scrollbar`}>
                                            {hours24Slots.map((hs) => (
                                                <button
                                                    key={hs.hour}
                                                    type="button"
                                                    onClick={() => {
                                                        playAgendaSound('tick');
                                                        setSelectedAgendaHour(hs.hour);
                                                        if (hs.matchingEventId) {
                                                            setSelectedEventId(hs.matchingEventId);
                                                        }
                                                    }}
                                                    className={`group flex flex-col items-center justify-center px-2 py-1 rounded-xl shrink-0 transition-all duration-200 ${
                                                        hs.isSelected
                                                            ? (darkMode ? 'bg-blue-500/15' : 'bg-blue-500/10')
                                                            : (darkMode ? 'hover:bg-white/[0.05]' : 'hover:bg-black/[0.04]')
                                                    }`}
                                                >
                                                    <span className={`text-[11px] font-bold tracking-tight tabular-nums transition-colors ${
                                                        hs.isSelected ? 'text-[#3B82F6]' : hs.hasEvents ? textColor : subTextColor
                                                    }`}>
                                                        {hs.label24}
                                                    </span>
                                                    <span className={`w-1 h-1 rounded-full mt-1 transition-all duration-300 ${
                                                        hs.isSelected
                                                            ? 'bg-[#3B82F6] scale-125 shadow-[0_0_6px_#3B82F6]'
                                                            : hs.hasEvents
                                                                ? 'bg-[#3B82F6]/70'
                                                                : 'bg-transparent'
                                                    }`} />
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Right/Bottom Column: Animated Vertical Timeline */}
                                    <div className={`flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-2 pt-0.5 min-h-0 ${showMonthGrid ? '@[520px]:col-span-7' : '@[520px]:col-span-12'}`}>
                                        {timelineEvents.map((ev: any, idx: number) => {
                                            const isSelected = ev.id === activeEventId;
                                            const isLast = idx === timelineEvents.length - 1;
                                            const startTimeStr = new Date(ev.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
                                            const guests = ev.guests && ev.guests.length > 0
                                                ? ev.guests
                                                : [
                                                    { name: 'Gabriel Silva', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80' },
                                                    { name: 'Ana Lima', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80' },
                                                    { name: 'Pedro Moreira', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80' }
                                                ];

                                            return (
                                                <div
                                                    key={ev.id}
                                                    onClick={() => {
                                                        if (!isSelected) {
                                                            playAgendaSound('select');
                                                            setSelectedEventId(ev.id);
                                                        } else {
                                                            playAgendaSound('tick');
                                                            openApp('calendar', { event: ev });
                                                        }
                                                    }}
                                                    className="flex items-stretch gap-2.5 @[320px]:gap-3 cursor-pointer group select-none min-w-0"
                                                >
                                                    <div className="flex flex-col items-center w-4 @[320px]:w-5 shrink-0 pt-2.5">
                                                        {isSelected ? (
                                                            <div className="relative flex items-center justify-center w-4 h-4 @[320px]:w-5 @[320px]:h-5 rounded-full border-2 border-[#3B82F6] bg-transparent shadow-[0_0_12px_rgba(59,130,246,0.45)] transition-all duration-300">
                                                                <span className="w-2 h-2 @[320px]:w-2.5 @[320px]:h-2.5 rounded-full bg-[#3B82F6] animate-pulse" />
                                                            </div>
                                                        ) : (
                                                            <div className="w-2.5 h-2.5 @[320px]:w-3 @[320px]:h-3 rounded-full border-2 border-[#3B82F6]/70 group-hover:border-[#3B82F6] group-hover:scale-110 transition-all duration-200" />
                                                        )}
                                                        {!isLast && (
                                                            <div className="w-[2px] flex-1 bg-gradient-to-b from-[#3B82F6]/70 to-[#3B82F6]/20 my-1.5 rounded-full" />
                                                        )}
                                                    </div>

                                                    {isSelected ? (
                                                        <div className="flex-1 min-w-0 rounded-[20px] p-3 @[340px]:p-3.5 bg-gradient-to-br from-[#3B82F6] via-[#2563EB] to-[#1D4ED8] text-white shadow-[0_14px_28px_-6px_rgba(37,99,235,0.55)] border border-white/25 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
                                                            <div className="flex items-baseline justify-between gap-2 min-w-0">
                                                                <h4 className="font-bold text-xs @[320px]:text-sm text-white truncate">
                                                                    {ev.title}
                                                                </h4>
                                                                <span className="text-[10px] @[320px]:text-[11px] font-medium text-white/85 shrink-0">
                                                                    {startTimeStr}
                                                                </span>
                                                            </div>
                                                            <p className="text-[11px] text-white/85 leading-relaxed mt-1 line-clamp-2">
                                                                {ev.description || ev.location || 'Reunião sincronizada com a equipe'}
                                                            </p>
                                                            <div className="flex items-center justify-between mt-2.5 gap-2">
                                                                <div className="flex items-center -space-x-2 overflow-hidden">
                                                                    {guests.slice(0, 4).map((g: any, gIdx: number) => (
                                                                        <img
                                                                            key={gIdx}
                                                                            src={g.avatar}
                                                                            alt={g.name || 'Participante'}
                                                                            title={g.name || g.email}
                                                                            className="w-6 h-6 @[320px]:w-7 @[320px]:h-7 rounded-full object-cover ring-2 ring-[#2563EB] shadow-sm transition-transform duration-200 hover:scale-115 hover:z-10"
                                                                        />
                                                                    ))}
                                                                    {guests.length > 4 && (
                                                                        <span className="w-6 h-6 @[320px]:w-7 @[320px]:h-7 rounded-full bg-white/20 backdrop-blur-md ring-2 ring-[#2563EB] text-[10px] font-bold flex items-center justify-center text-white">
                                                                            +{guests.length - 4}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        playAgendaSound('action');
                                                                        if (ev.meetLink) {
                                                                            openApp('meet');
                                                                        } else {
                                                                            openApp('calendar', { event: ev });
                                                                        }
                                                                    }}
                                                                    title={ev.meetLink ? 'Entrar na chamada Google Meet' : 'Ver detalhes do compromisso'}
                                                                    className="w-7 h-7 @[320px]:w-8 @[320px]:h-8 rounded-xl bg-white text-[#2563EB] shadow-md hover:scale-105 active:scale-95 transition-all flex items-center justify-center group/btn shrink-0"
                                                                >
                                                                    <svg
                                                                        viewBox="0 0 24 24"
                                                                        className="w-4 h-4 text-[#2563EB] transition-transform duration-500 group-hover/btn:rotate-90"
                                                                        fill="none"
                                                                        stroke="currentColor"
                                                                        strokeWidth="2.2"
                                                                        strokeLinecap="round"
                                                                    >
                                                                        <line x1="12" y1="3" x2="12" y2="6" />
                                                                        <line x1="12" y1="18" x2="12" y2="21" />
                                                                        <line x1="3" y1="12" x2="6" y2="12" />
                                                                        <line x1="18" y1="12" x2="21" y2="12" />
                                                                        <line x1="5.6" y1="5.6" x2="7.8" y2="7.8" />
                                                                        <line x1="16.2" y1="16.2" x2="18.4" y2="18.4" />
                                                                        <line x1="18.4" y1="5.6" x2="16.2" y2="7.8" />
                                                                        <line x1="7.8" y1="16.2" x2="5.6" y2="18.4" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex-1 min-w-0 rounded-2xl px-3 py-2 glass-item transition-all duration-200 group-hover:translate-x-0.5 flex flex-col justify-center">
                                                            <div className="flex items-baseline justify-between gap-2 min-w-0">
                                                                <h4 className={`font-bold text-xs ${textColor} truncate`}>
                                                                    {ev.title}
                                                                </h4>
                                                                <span className={`text-[10px] @[320px]:text-[11px] font-medium ${subTextColor} shrink-0`}>
                                                                    {startTimeStr}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between gap-2 mt-0.5 min-w-0">
                                                                <p className={`text-[11px] ${subTextColor} truncate`}>
                                                                    {ev.description || ev.location || 'Calendário Principal'}
                                                                </p>
                                                                {guests.length > 0 && (
                                                                    <div className="flex items-center -space-x-1.5 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                                                                        {guests.slice(0, 3).map((g: any, gIdx: number) => (
                                                                            <img
                                                                                key={gIdx}
                                                                                src={g.avatar}
                                                                                alt={g.name || ''}
                                                                                className="w-4 h-4 rounded-full object-cover ring-1 ring-black/10 dark:ring-white/20"
                                                                            />
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Quick Event Creation Bar at bottom of Extended Calendar */}
                                <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/5 flex items-center gap-1.5 shrink-0">
                                    <div className="flex-1 min-w-0 flex items-center glass-item rounded-xl px-2.5 h-8">
                                        <Plus
                                            size={14}
                                            onClick={() => newQuickEventTitle.trim() && handleQuickAddAgendaEvent()}
                                            className={`${subTextColor} shrink-0 cursor-pointer hover:opacity-80`}
                                        />
                                        <input
                                            type="text"
                                            value={newQuickEventTitle}
                                            onChange={(e) => setNewQuickEventTitle(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleQuickAddAgendaEvent()}
                                            placeholder="Agendar compromisso..."
                                            className={`flex-1 min-w-0 bg-transparent border-none outline-none text-xs px-2 ${textColor} placeholder:${subTextColor}`}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    if (mod.id === 'tasks') {
                        const pendingTasksList = allTasks.filter((t: any) => !t.completed);
                        const completedTasksList = allTasks.filter((t: any) => t.completed);
                        const spotlightTask = pendingTasksList[0] || null;
                        const queueTasks = taskFilter === 'focus'
                            ? [
                                ...pendingTasksList.slice(1),
                                ...completedTasksList
                              ]
                            : filteredTasks;

                        const ringRadius = 14;
                        const ringCircumference = 2 * Math.PI * ringRadius;
                        const ringOffset = ringCircumference - (progressPct / 100) * ringCircumference;

                        const renderDraggableTaskCard = (task: any, compact = false) => {
                            const meta = classifyTask(task);
                            const isTaskDragged = String(draggedTaskId) === String(task.id);
                            const isTaskDragOver = String(dragOverTaskId) === String(task.id);
                            const leftAccentColor = task.completed
                                ? 'border-l-[#34A853]'
                                : meta.priority === 0
                                ? 'border-l-[#F59E0B]'
                                : meta.priority === 1
                                ? 'border-l-[#3B82F6]'
                                : 'border-l-white/25';

                            return (
                                <div
                                    key={task.id}
                                    data-task-id={task.id}
                                    onClick={() => openApp('tasks')}
                                    className={`group relative flex items-center gap-2 ${
                                        compact ? 'p-2' : 'p-2.5'
                                    } rounded-xl glass-item border-l-[3px] ${leftAccentColor} cursor-pointer transition-all min-w-0 select-none ${
                                        isTaskDragged ? 'opacity-40 scale-95 ring-1 ring-[#3B82F6]' : ''
                                    } ${isTaskDragOver ? 'ring-2 ring-[#3B82F6] bg-[#3B82F6]/10 -translate-y-0.5' : ''}`}
                                >
                                    {/* Drag Handle for Reordering or Dropping into Columns */}
                                    <div
                                        onPointerDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            playAgendaSound('tick');
                                            setDraggedTaskId(String(task.id));
                                        }}
                                        style={{ touchAction: 'none' }}
                                        className={`p-0.5 rounded cursor-grab active:cursor-grabbing ${subTextColor} opacity-45 group-hover:opacity-100 hover:${textColor} shrink-0`}
                                        title="Arraste para reordenar ou mover de coluna"
                                    >
                                        <GripVertical size={12} />
                                    </div>

                                    {/* Interactive Completion Check Button */}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            playAgendaSound('action');
                                            handleToggleTaskOnHome(task.id);
                                        }}
                                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                                            task.completed
                                                ? 'bg-[#34A853] border-[#34A853] text-white shadow-[0_0_8px_rgba(52,168,83,0.4)]'
                                                : darkMode
                                                ? 'border-white/40 group-hover:border-[#3B82F6]'
                                                : 'border-black/30 group-hover:border-[#3B82F6]'
                                        }`}
                                        title={task.completed ? 'Reabrir tarefa' : 'Concluir tarefa'}
                                    >
                                        {task.completed && <Check size={10} strokeWidth={3} />}
                                    </button>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-1.5 min-w-0">
                                            <span
                                                className={`text-xs font-medium truncate ${
                                                    task.completed ? `${subTextColor} line-through` : textColor
                                                }`}
                                            >
                                                {task.title}
                                            </span>
                                            {!compact && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleCycleTaskPriority(task.id, e)}
                                                    title="Clique para alternar prioridade (Urgente / Agendada / Backlog)"
                                                    className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md border shrink-0 transition-transform hover:scale-105 ${meta.badgeClass}`}
                                                >
                                                    {meta.tag}
                                                </button>
                                            )}
                                        </div>
                                        {task.details && !task.completed && !compact && (
                                            <p className={`text-[10px] ${subTextColor} truncate mt-0.5`}>{task.details}</p>
                                        )}
                                    </div>
                                </div>
                            );
                        };

                        return (
                            <div
                                key={mod.id}
                                {...commonDragProps}
                                style={{ height: `${mod.height}px` }}
                                className={`${glassCard} ${dragWrapperClasses} ${isCompactHeight ? 'p-3.5 sm:p-4' : 'p-4 sm:p-5'} flex flex-col`}
                            >
                                {renderResizeHandles(mod)}

                                {/* Reimagined Header: Radial Progress Ring + Sprint Stats + Drop-Zone View Switcher */}
                                <div className={`pb-2.5 mb-2.5 border-b ${cardHeaderBorder} shrink-0 flex flex-wrap items-center justify-between gap-2`}>
                                    <div className="flex items-center gap-2 min-w-0">
                                        {renderModuleDragControls(mod)}

                                        {/* Radial Progress Donut Gauge */}
                                        <div
                                            onClick={() => openApp('tasks')}
                                            className="relative w-9 h-9 flex items-center justify-center shrink-0 cursor-pointer group/ring"
                                            title="Abrir Google Tarefas"
                                        >
                                            <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                                                <circle
                                                    cx="18"
                                                    cy="18"
                                                    r={ringRadius}
                                                    fill="none"
                                                    className={darkMode ? 'stroke-white/10' : 'stroke-black/10'}
                                                    strokeWidth="3.2"
                                                />
                                                <circle
                                                    cx="18"
                                                    cy="18"
                                                    r={ringRadius}
                                                    fill="none"
                                                    stroke="url(#tasksRingGrad)"
                                                    strokeWidth="3.2"
                                                    strokeLinecap="round"
                                                    strokeDasharray={ringCircumference}
                                                    strokeDashoffset={ringOffset}
                                                    className="transition-all duration-500"
                                                />
                                                <defs>
                                                    <linearGradient id="tasksRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                                        <stop offset="0%" stopColor="#3B82F6" />
                                                        <stop offset="100%" stopColor="#34A853" />
                                                    </linearGradient>
                                                </defs>
                                            </svg>
                                            <span className={`absolute text-[9px] font-bold ${textColor}`}>
                                                {progressPct}%
                                            </span>
                                        </div>

                                        <div
                                            onClick={() => openApp('tasks')}
                                            className="min-w-0 cursor-pointer hover:opacity-85 transition-opacity"
                                            title="Clique para abrir o Google Tarefas"
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span className={`font-bold ${textColor} text-sm leading-none truncate`}>
                                                    Sprint & Tarefas
                                                </span>
                                            </div>
                                            <span className={`text-[10px] ${subTextColor} mt-1 block truncate`}>
                                                {pendingTasksList.length} em aberto · {completedCount} concluídas
                                            </span>
                                        </div>
                                    </div>

                                    {/* Interactive Mode Tabs (also act as Drop Zones when dragging a task!) */}
                                    <div className={`flex items-center p-0.5 rounded-xl border text-[10px] font-semibold shrink-0 ${darkMode ? 'bg-black/35 border-white/10' : 'bg-black/[0.05] border-black/10'}`}>
                                        {([
                                            { id: 'focus', label: 'Sprint' },
                                            { id: 'pending', label: 'Quadro' },
                                            { id: 'completed', label: 'Feitas' }
                                        ] as const).map((tab) => {
                                            const isDropActive = dragOverTaskZone === tab.id;
                                            return (
                                                <button
                                                    key={tab.id}
                                                    type="button"
                                                    data-task-drop-zone={tab.id}
                                                    onClick={() => {
                                                        playAgendaSound('tick');
                                                        setTaskFilter(tab.id);
                                                    }}
                                                    className={`px-2.5 py-1 rounded-lg transition-all ${
                                                        isDropActive
                                                            ? 'bg-[#3B82F6] text-white scale-105 shadow-md'
                                                            : taskFilter === tab.id
                                                            ? darkMode
                                                                ? 'bg-white/15 text-white shadow-sm'
                                                                : 'bg-white text-black shadow-sm'
                                                            : `${subTextColor} hover:opacity-85`
                                                    }`}
                                                >
                                                    {tab.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Dynamic Tasks Body based on Selected Mode */}
                                {taskFilter === 'pending' ? (
                                    /* MODO QUADRO: 2-Column Interactive Drag-and-Drop Mini-Kanban */
                                    <div className="flex-1 min-h-0 grid grid-cols-2 gap-2 overflow-hidden">
                                        {/* Column 1: A Fazer */}
                                        <div
                                            data-task-drop-zone="pending"
                                            className={`flex flex-col min-h-0 rounded-2xl p-2 border transition-colors ${
                                                dragOverTaskZone === 'pending'
                                                    ? 'border-[#3B82F6] bg-[#3B82F6]/10'
                                                    : darkMode
                                                    ? 'bg-black/20 border-white/[0.06]'
                                                    : 'bg-black/[0.03] border-black/[0.06]'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between px-1 mb-1.5 shrink-0">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider ${subTextColor}`}>
                                                    A Fazer
                                                </span>
                                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-[#3B82F6]/20 text-[#3B82F6]">
                                                    {pendingTasksList.length}
                                                </span>
                                            </div>
                                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-0.5 min-h-0">
                                                {pendingTasksList.map((t: any) => renderDraggableTaskCard(t, true))}
                                            </div>
                                        </div>

                                        {/* Column 2: Concluídas */}
                                        <div
                                            data-task-drop-zone="completed"
                                            className={`flex flex-col min-h-0 rounded-2xl p-2 border transition-colors ${
                                                dragOverTaskZone === 'completed'
                                                    ? 'border-[#34A853] bg-[#34A853]/10'
                                                    : darkMode
                                                    ? 'bg-black/20 border-white/[0.06]'
                                                    : 'bg-black/[0.03] border-black/[0.06]'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between px-1 mb-1.5 shrink-0">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider ${subTextColor}`}>
                                                    Concluídas
                                                </span>
                                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-[#34A853]/20 text-[#34A853]">
                                                    {completedTasksList.length}
                                                </span>
                                            </div>
                                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-0.5 min-h-0">
                                                {completedTasksList.map((t: any) => renderDraggableTaskCard(t, true))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    /* MODO SPRINT (Spotlight + Fila Arrastável) ou FEITAS */
                                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 min-h-0 flex flex-col gap-2">
                                        {/* Spotlight Hero Card for #1 Active Task in Sprint Mode */}
                                        {taskFilter === 'focus' && spotlightTask && !isCompactHeight && (
                                            <div
                                                data-task-id={spotlightTask.id}
                                                onClick={() => openApp('tasks')}
                                                className={`relative p-3 rounded-2xl border cursor-pointer transition-all shrink-0 ${
                                                    darkMode
                                                        ? 'bg-gradient-to-r from-[#3B82F6]/20 via-[#2563EB]/10 to-transparent border-[#3B82F6]/40 hover:border-[#3B82F6]/70'
                                                        : 'bg-gradient-to-r from-[#3B82F6]/15 via-[#3B82F6]/5 to-white/60 border-[#3B82F6]/35 hover:border-[#3B82F6]/60'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-2 mb-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <div
                                                            onPointerDown={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                playAgendaSound('tick');
                                                                setDraggedTaskId(String(spotlightTask.id));
                                                            }}
                                                            style={{ touchAction: 'none' }}
                                                            className={`p-0.5 rounded cursor-grab active:cursor-grabbing ${subTextColor} hover:${textColor}`}
                                                            title="Arraste para reordenar"
                                                        >
                                                            <GripVertical size={12} />
                                                        </div>
                                                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#3B82F6]">
                                                            Foco Principal Agora
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleCycleTaskPriority(spotlightTask.id, e)}
                                                        className={`text-[9px] font-semibold px-2 py-0.5 rounded-md border ${classifyTask(spotlightTask).badgeClass}`}
                                                        title="Clique para alternar prioridade"
                                                    >
                                                        {classifyTask(spotlightTask).tag}
                                                    </button>
                                                </div>

                                                <div className="flex items-center justify-between gap-2.5">
                                                    <div className="min-w-0 flex-1">
                                                        <h4 className={`text-xs @[360px]:text-[13px] font-bold ${textColor} truncate`}>
                                                            {spotlightTask.title}
                                                        </h4>
                                                        {spotlightTask.details && (
                                                            <p className={`text-[10px] ${subTextColor} truncate mt-0.5`}>
                                                                {spotlightTask.details}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            playAgendaSound('action');
                                                            handleToggleTaskOnHome(spotlightTask.id);
                                                        }}
                                                        className="px-2.5 py-1.5 rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] text-white text-[10px] font-bold shadow-sm flex items-center gap-1 shrink-0 transition-transform active:scale-95"
                                                        title="Concluir foco principal"
                                                    >
                                                        <Check size={11} strokeWidth={3} />
                                                        <span>Concluir</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Draggable Task Queue Grid (1 col when narrow, 2 cols when widened @[520px]) */}
                                        <div className="grid grid-cols-1 @[520px]:grid-cols-2 gap-1.5 content-start">
                                            {(taskFilter === 'focus' && !isCompactHeight ? queueTasks : filteredTasks).map((task: any) =>
                                                renderDraggableTaskCard(task, false)
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Bottom Quick-Add Task Bar with + Button */}
                                <div className="mt-2.5 flex items-center gap-1.5 shrink-0">
                                    <div className="flex-1 min-w-0 flex items-center glass-item rounded-xl px-3 h-8">
                                        <input
                                            type="text"
                                            value={newTaskTitle}
                                            onChange={(e) => setNewTaskTitle(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleQuickAddTask()}
                                            placeholder="Adicionar tarefa ao sprint..."
                                            className={`flex-1 min-w-0 bg-transparent border-none outline-none text-xs ${textColor} placeholder:${subTextColor}`}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleQuickAddTask}
                                        title="Adicionar tarefa"
                                        className={`w-8 h-8 rounded-xl transition border flex items-center justify-center shrink-0 ${
                                            darkMode
                                                ? 'text-blue-400 bg-blue-400/10 border-blue-400/25 hover:bg-blue-400/20'
                                                : 'text-blue-600 bg-blue-600/10 border-blue-600/25 hover:bg-blue-600/20'
                                        }`}
                                    >
                                        <Plus size={15} />
                                    </button>
                                </div>
                            </div>
                        );
                    }

                    if (mod.id === 'inbox') {
                        return (
                            <div
                                key={mod.id}
                                {...commonDragProps}
                                style={{ height: `${mod.height}px` }}
                                className={`${glassCard} ${dragWrapperClasses} ${isCompactHeight ? 'p-3.5 sm:p-4' : 'p-4 sm:p-5'} flex flex-col`}
                            >
                                {renderResizeHandles(mod)}
                                <div className={`flex flex-wrap justify-between items-center pb-2.5 mb-2.5 border-b ${cardHeaderBorder} shrink-0 gap-2`}>
                                    <div className="flex items-center gap-2 min-w-0">
                                        {renderModuleDragControls(mod)}
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${cardIconBadge}`}>
                                            <GoogleIcons.Gmail className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <span className={`font-semibold ${textColor} text-sm block leading-none truncate`}>Caixa de Entrada</span>
                                            <span className={`text-[10px] ${subTextColor} mt-0.5 block truncate`}>
                                                {allEmails.length} mensagens recentes
                                            </span>
                                        </div>
                                    </div>
                                    <div className={`flex items-center p-0.5 rounded-lg border text-[10px] font-medium shrink-0 ${darkMode ? 'bg-black/30 border-white/10' : 'bg-black/[0.04] border-black/10'}`}>
                                        <button
                                            onClick={() => setInboxFilter('all')}
                                            className={`px-2 py-0.5 rounded-md transition-all ${
                                                inboxFilter === 'all'
                                                    ? (darkMode ? 'bg-white/15 text-white shadow-sm' : 'bg-white text-black shadow-sm')
                                                    : `${subTextColor} hover:opacity-80`
                                            }`}
                                        >
                                            Todas
                                        </button>
                                        <button
                                            onClick={() => setInboxFilter('priority')}
                                            className={`px-2 py-0.5 rounded-md transition-all ${
                                                inboxFilter === 'priority'
                                                    ? (darkMode ? 'bg-white/15 text-white shadow-sm' : 'bg-white text-black shadow-sm')
                                                    : `${subTextColor} hover:opacity-80`
                                            }`}
                                        >
                                            Prioritárias
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 min-h-0 grid grid-cols-1 @[520px]:grid-cols-2 gap-1.5 content-start">
                                    {filteredEmails.map((e: any, idx: number) => {
                                        const isPriority = idx === 0 || e.subject?.toLowerCase().includes('urgente');
                                        return (
                                            <div
                                                key={e.id}
                                                onClick={() => openApp('mail')}
                                                className="p-2.5 glass-item rounded-xl cursor-pointer group transition-all flex items-start gap-2.5 min-w-0"
                                            >
                                                <div className={`w-7 h-7 rounded-full ${e.color || 'bg-blue-600'} text-white text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5 shadow-sm`}>
                                                    {e.senderInit || e.sender?.[0] || 'G'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-center gap-1 min-w-0">
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                            {isPriority && <span className="w-1.5 h-1.5 rounded-full bg-[#EA4335] shrink-0" title="Prioridade Alta" />}
                                                            <span className={`font-semibold text-xs ${textColor} truncate`}>{e.sender}</span>
                                                        </div>
                                                        <span className={`text-[10px] ${subTextColor} shrink-0`}>{e.time}</span>
                                                    </div>
                                                    <p className={`text-xs font-medium ${textColor} truncate mt-0.5`}>{e.subject}</p>
                                                    {e.preview && (
                                                        <p className={`text-[10px] ${subTextColor} truncate mt-0.5`}>{e.preview}</p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <button
                                    onClick={() => openApp('mail')}
                                    className="w-full mt-2.5 h-8 rounded-xl text-xs text-[#EA4335] font-medium hover:bg-[#EA4335]/15 transition bg-[#EA4335]/10 border border-[#EA4335]/25 flex items-center justify-center shrink-0"
                                >
                                    Escrever novo e-mail
                                </button>
                            </div>
                        );
                    }

                    return (
                        <div key={mod.id} {...commonDragProps} className={`${dragWrapperClasses} h-full flex-1 flex flex-col`}>
                            <PostItBoard
                                notes={sortedNotes}
                                darkMode={darkMode}
                                textColor={textColor}
                                subTextColor={subTextColor}
                                postItPalette={postItPalette}
                                onAddNote={handleAddPostItNote}
                                onUpdateNote={handleUpdatePostItNote}
                                onDeleteNote={handleDeletePostIt}
                                onTogglePin={handleTogglePinPostIt}
                                onOpenKeep={() => openApp('keep')}
                                playSound={playAgendaSound}
                                moduleDragHandle={renderModuleDragControls(mod)}
                            />
                        </div>
                    );
                };

                const dockedRightModule = homeModules.find((m) => m.dockRight);
                const isAnyDockedRight = Boolean(dockedRightModule);
                const rightColSpan: ModuleSpan = isAnyDockedRight ? (dockedRightModule?.span || 4) : 4;
                const leftColSpan = (12 - rightColSpan) as ModuleSpan;
                const leftModules = homeModules.filter((m) => !m.dockRight);
                const leftCardModules = leftModules.filter((m) => m.id !== 'postits');
                const postItModule = leftModules.find((m) => m.id === 'postits');

                return (
                    <div ref={homeGridRef} className="w-full flex-1 min-h-0 flex flex-col pb-2">
                        {isAnyDockedRight && dockedRightModule ? (
                            <div className={`w-full flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-5 items-stretch transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${aiMode ? 'opacity-30 scale-[0.98] blur-sm pointer-events-none' : 'opacity-100 scale-100 blur-0'}`}>
                                {/* Left / Center Workspace Area (Tasks, Inbox & Floating Post-its filling 100% of left space) */}
                                <div className={`col-span-12 ${getSpanClass(leftColSpan)} w-full min-h-0 flex flex-col gap-4 lg:gap-5`}>
                                    <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-5 auto-rows-min shrink-0">
                                        {leftCardModules.map((mod) => renderModuleById(mod, false))}
                                    </div>
                                    {postItModule && (
                                        <div className="w-full flex-1 min-h-[240px] flex flex-col">
                                            {renderModuleById(postItModule, true)}
                                        </div>
                                    )}
                                </div>

                                {/* Right Extended Column: Docked Module filling 100% height */}
                                <div className={`col-span-12 ${getSpanClass(rightColSpan)} w-full min-h-0 flex flex-col`}>
                                    {renderModuleById(dockedRightModule, true)}
                                </div>
                            </div>
                        ) : (
                            <div className={`w-full flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-5 auto-rows-min transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${aiMode ? 'opacity-30 scale-[0.98] blur-sm pointer-events-none' : 'opacity-100 scale-100 blur-0'}`}>
                                {homeModules.map((mod) => renderModuleById(mod, false))}
                            </div>
                        )}
                    </div>
                );
            })()}
        </div>

        {/* --- CHAT OVERLAY --- */}
        <div className={`absolute inset-0 w-full flex flex-col z-20 pointer-events-none ${aiMode ? 'pointer-events-auto' : ''}`}>
            <div className={`flex justify-end p-2 transition-opacity duration-500 ${aiMode ? 'opacity-100' : 'opacity-0'}`}>
                <button onClick={() => setAiMode(false)} className={`px-4 py-2 glass-control ${textColor} rounded-full transition flex items-center gap-2`}>
                    <span className="text-xs font-medium">Fechar Chat</span>
                    <X size={16} />
                </button>
            </div>
            <div ref={chatContainerRef} className={`flex-1 overflow-y-auto px-4 md:px-20 py-4 scroll-smooth transition-all duration-700 ${aiMode ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-6`}>
                        {msg.role === 'assistant' && (
                            <div className="w-8 h-8 mr-3 rounded-full glass-control flex items-center justify-center shrink-0">
                                <GeminiLogo className="w-5 h-5" />
                            </div>
                        )}
                        <div className={`max-w-[80%] p-4 rounded-2xl text-[15px] leading-relaxed ${msg.role === 'user' ? (darkMode ? 'bg-[#4E79F3]/25 text-white rounded-tr-sm border border-white/15 backdrop-blur-xl' : 'bg-[#4E79F3] text-white rounded-tr-sm shadow-md') : `glass-surface ${textColor}`} rounded-tl-sm`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                {isTyping && <div className={`${subTextColor} pl-14 text-xs animate-pulse`}>Gemini está digitando...</div>}
                <div className="h-24"></div> 
            </div>
        </div>

        {/* BARRA DE ENTRADA CHAT */}
        <div className={`absolute left-0 right-0 mx-auto w-full max-w-3xl z-30 transition-all duration-[800ms] ease-[cubic-bezier(0.23,1,0.32,1)] ${aiMode ? 'bottom-8 opacity-100 translate-y-0 pointer-events-auto' : 'bottom-[-100px] opacity-0 translate-y-10 pointer-events-none'}`}>
            <div className={`relative w-full rounded-full group transition-all duration-500 shadow-[0_0_50px_rgba(78,121,243,0.25)]`}>
                <div className={`absolute -inset-[2px] rounded-[32px] overflow-hidden pointer-events-none transition-opacity duration-500 ${aiMode && isInputFocused ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="absolute top-1/2 left-1/2 w-[200%] h-[200%] -translate-x-1/2 -translate-y-1/2 animate-[spin_3s_linear_infinite]" style={{ background: 'conic-gradient(from 0deg, transparent 0 340deg, #4285F4 345deg, #EA4335 350deg, #FBBC05 355deg, #34A853 360deg)' }}></div>
                </div>
                <div className="relative flex items-center w-full transition-all duration-300 glass-surface rounded-full h-16 px-2">
                    <button className={`p-3 rounded-full transition-colors glass-item ${textColor} ml-1`}><Plus size={24} /></button>
                    <input ref={inputRef} type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Digite uma mensagem ou comando (ex: criar documento)..." className={`flex-1 bg-transparent border-none outline-none ${darkMode ? 'text-[#E3E3E3] placeholder:text-white/40' : 'text-[#202124] placeholder:text-black/40'} px-3 h-12 text-base`} onFocus={() => setIsInputFocused(true)} onBlur={() => setIsInputFocused(false)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} />
                    <div className="flex items-center gap-1 pr-1">
                        {searchQuery && <button onClick={(e) => { e.stopPropagation(); handleSendMessage(); }} className="p-2.5 bg-[#4E79F3] text-white hover:bg-blue-600 rounded-full transition shadow-lg mr-1"><ArrowRight size={20} /></button>}
                    </div>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}