import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, X, Plus, Check, Lock, Clock, Pin, Trash2, Link2,
  MessageSquare, Calendar, CheckSquare, MoreHorizontal, Play, Pause,
  Send, Sparkles, Volume2, ExternalLink, Edit3, GitBranch
} from 'lucide-react';
import { bridge, NoteItem, TaskItem, CalendarEvent, ChatMessage } from '../../utils/GASBridge';
import { GoogleIcons } from '../GoogleIcons';

interface KeepAppProps {
  onClose: () => void;
  data: any;
  onUpdate?: (notes: NoteItem[]) => void;
  onUpdateTasks?: (tasks: TaskItem[]) => void;
  onUpdateEvents?: (events: CalendarEvent[]) => void;
  onOpenApp?: (type: string, fileData?: any) => void;
  showToast?: (msg: string) => void;
  isDarkMode?: boolean;
}

interface ConnectorLine {
  id: string;
  fromId: number;
  toId: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export default function KeepApp({
  onClose,
  data,
  onUpdate,
  onUpdateTasks,
  onUpdateEvents,
  onOpenApp,
  showToast,
  isDarkMode = false,
}: KeepAppProps) {
  const [notes, setNotes] = useState<NoteItem[]>(() => data?.notes || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [connectingFromId, setConnectingFromId] = useState<number | null>(null);
  const [openMenuNoteId, setOpenMenuNoteId] = useState<number | null>(null);
  const [highlightedNoteId, setHighlightedNoteId] = useState<number | null>(null);
  const [playingNoteId, setPlayingNoteId] = useState<number | null>(null);

  // Google Chat Thread Drawer state
  const [activeChatNoteId, setActiveChatNoteId] = useState<number | null>(null);
  const [chatInput, setChatInput] = useState('');

  // Create / Edit Note Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formColor, setFormColor] = useState('default');
  const [formAutoTask, setFormAutoTask] = useState(false);
  const [formAutoEvent, setFormAutoEvent] = useState(false);

  // Refs for SVG dashed connector calculation
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [connectors, setConnectors] = useState<ConnectorLine[]>([]);

  const toast = (msg: string) => showToast && showToast(msg);

  useEffect(() => {
    if (data?.notes) {
      setNotes(data.notes);
    }
  }, [data?.notes]);

  const syncNotes = (updated: NoteItem[]) => {
    setNotes(updated);
    if (onUpdate) onUpdate(updated);
  };

  // Compute SVG connector coordinates between connected notes
  const recomputeConnectors = useCallback(() => {
    const container = canvasContainerRef.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    const lines: ConnectorLine[] = [];

    notes.forEach((sourceNote) => {
      const targets = sourceNote.connectedTo || [];
      const sourceEl = cardRefs.current[sourceNote.id];
      if (!sourceEl) return;
      const sRect = sourceEl.getBoundingClientRect();

      targets.forEach((targetId) => {
        const targetEl = cardRefs.current[targetId];
        if (!targetEl) return;
        const tRect = targetEl.getBoundingClientRect();

        // Connect from right middle of source card to left middle of target card (or vice versa)
        const sCenterX = sRect.left + sRect.width / 2 - cRect.left;
        const tCenterX = tRect.left + tRect.width / 2 - cRect.left;

        let x1: number;
        let y1: number;
        let x2: number;
        let y2: number;

        if (sCenterX <= tCenterX) {
          x1 = sRect.right - cRect.left;
          y1 = sRect.top + sRect.height * 0.52 - cRect.top;
          x2 = tRect.left - cRect.left;
          y2 = tRect.top + tRect.height * 0.52 - cRect.top;
        } else {
          x1 = sRect.left - cRect.left;
          y1 = sRect.top + sRect.height * 0.52 - cRect.top;
          x2 = tRect.right - cRect.left;
          y2 = tRect.top + tRect.height * 0.52 - cRect.top;
        }

        lines.push({
          id: `${sourceNote.id}->${targetId}`,
          fromId: sourceNote.id,
          toId: targetId,
          x1,
          y1,
          x2,
          y2,
        });
      });
    });

    setConnectors(lines);
  }, [notes]);

  useEffect(() => {
    const timer = window.setTimeout(recomputeConnectors, 60);
    window.addEventListener('resize', recomputeConnectors);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', recomputeConnectors);
    };
  }, [recomputeConnectors, searchQuery, activeChatNoteId]);

  // Toggle completion status on a Note AND bi-directionally update its linked Task in Google Tasks
  const handleSetNoteCompleted = async (note: NoteItem, completed: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus: NoteItem['status'] = completed ? 'completed' : 'upcoming';
    const updatedNotes = notes.map((n) =>
      n.id === note.id ? { ...n, status: nextStatus } : n
    );
    syncNotes(updatedNotes);

    if (note.linkedTaskId && data?.tasks && onUpdateTasks) {
      const updatedTasks = data.tasks.map((t: TaskItem) =>
        t.id === note.linkedTaskId ? { ...t, completed } : t
      );
      onUpdateTasks(updatedTasks);
      await bridge.toggleTask(note.linkedTaskId);
      toast(completed ? 'Nota e atividade no Tasks concluídas!' : 'Nota e atividade reabertas no Tasks.');
    } else {
      toast(completed ? 'Nota marcada como concluída!' : 'Nota marcada como pendente.');
    }
  };

  // Convert a Note into a synchronized Google Task (or toggle existing)
  const handleConvertNoteToTask = async (note: NoteItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setOpenMenuNoteId(null);

    if (note.linkedTaskId) {
      toast('Esta nota já está sincronizada com o Google Tasks.');
      if (onOpenApp) onOpenApp('tasks');
      return;
    }

    const newTaskId = `tk_keep_${Date.now()}`;
    const newTask: TaskItem = {
      id: newTaskId,
      title: note.title || 'Tarefa do Keep Canvas',
      details: note.content,
      completed: note.status === 'completed',
      date: new Date().toISOString(),
      listId: 'default',
    };

    if (onUpdateTasks) {
      onUpdateTasks([newTask, ...(data?.tasks || [])]);
    }
    await bridge.createTask(newTask.title, newTask.details, 'default', newTask.date);

    const updatedNotes = notes.map((n) =>
      n.id === note.id ? { ...n, linkedTaskId: newTaskId } : n
    );
    syncNotes(updatedNotes);
    toast(`"${note.title}" virou uma atividade sincronizada no Tasks!`);
  };

  // Schedule a Note directly into Google Calendar (and Right Sidebar + Home Timeline)
  const handleScheduleNoteInCalendar = async (note: NoteItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setOpenMenuNoteId(null);

    if (note.linkedEventId) {
      toast('Esta nota já possui um evento vinculado na Agenda.');
      return;
    }

    const start = new Date();
    start.setHours(start.getHours() + 1, 0, 0, 0);
    const end = new Date(start.getTime() + 45 * 60000);
    const newEventId = `ev_keep_${Date.now()}`;

    const newEvent: CalendarEvent = {
      id: newEventId,
      title: note.title || 'Bloco de Foco · Keep',
      start: start.toISOString(),
      end: end.toISOString(),
      calendarId: 'primary',
      color: '#4285F4',
      description: note.content,
      location: 'Google Meet · Keep Sync',
      meetLink: 'https://meet.google.com/keep-sync-room',
      guests: note.participants?.map((p) => ({
        name: p.name,
        email: `${p.name.toLowerCase().replace(/\s+/g, '.')}@workspace.os`,
        avatar: p.avatar,
        responseStatus: 'accepted',
      })),
    };

    if (onUpdateEvents) {
      onUpdateEvents([...(data?.events || []), newEvent]);
    }
    await bridge.createCalendarEvent(newEvent);

    const updatedNotes = notes.map((n) =>
      n.id === note.id ? { ...n, linkedEventId: newEventId } : n
    );
    syncNotes(updatedNotes);
    toast(`Evento "${newEvent.title}" agendado e sincronizado com a Agenda!`);
  };

  // Connect / Disconnect two notes on the Canvas
  const handleNodeConnectionClick = (targetNoteId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (connectingFromId === null) {
      setConnectingFromId(targetNoteId);
      setOpenMenuNoteId(null);
      toast('Clique em outra nota no Canvas para conectar ou desconectar.');
      return;
    }

    if (connectingFromId === targetNoteId) {
      setConnectingFromId(null);
      return;
    }

    const updatedNotes = notes.map((n) => {
      if (n.id !== connectingFromId) return n;
      const existing = n.connectedTo || [];
      const alreadyConnected = existing.includes(targetNoteId);
      const nextConnections = alreadyConnected
        ? existing.filter((id) => id !== targetNoteId)
        : [...existing, targetNoteId];
      toast(alreadyConnected ? 'Conexão entre notas removida.' : 'Notas conectadas no fluxo!');
      return { ...n, connectedTo: nextConnections };
    });

    syncNotes(updatedNotes);
    setConnectingFromId(null);
  };

  // Open Google Chat Thread for a Note
  const handleOpenChatThread = (note: NoteItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setOpenMenuNoteId(null);
    setActiveChatNoteId(note.id);
  };

  const handleSendChatMessage = () => {
    if (!chatInput.trim() || activeChatNoteId === null) return;
    const msg: ChatMessage = {
      id: `chat_${Date.now()}`,
      sender: data?.user?.name || 'Você',
      avatar: data?.user?.avatar || 'https://ui-avatars.com/api/?name=Voce&background=2563EB&color=fff',
      text: chatInput.trim(),
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedNotes = notes.map((n) => {
      if (n.id !== activeChatNoteId) return n;
      return {
        ...n,
        chatMessages: [...(n.chatMessages || []), msg],
      };
    });

    syncNotes(updatedNotes);
    setChatInput('');
  };

  // Create or Save Edited Note
  const handleSaveNoteModal = async () => {
    if (!formTitle.trim() && !formContent.trim()) {
      setIsModalOpen(false);
      return;
    }

    if (editingNote) {
      const updated = notes.map((n) =>
        n.id === editingNote.id
          ? { ...n, title: formTitle.trim(), content: formContent.trim(), color: formColor }
          : n
      );
      syncNotes(updated);
      toast('Nota atualizada no Canvas.');
    } else {
      const newId = Date.now();
      let linkedTaskId: string | undefined;
      let linkedEventId: string | undefined;

      if (formAutoTask) {
        linkedTaskId = `tk_keep_${newId}`;
        const newTask: TaskItem = {
          id: linkedTaskId,
          title: formTitle.trim() || 'Nova Atividade Keep',
          details: formContent.trim(),
          completed: false,
          date: new Date().toISOString(),
          listId: 'default',
        };
        if (onUpdateTasks) onUpdateTasks([newTask, ...(data?.tasks || [])]);
        await bridge.createTask(newTask.title, newTask.details, 'default', newTask.date);
      }

      if (formAutoEvent) {
        linkedEventId = `ev_keep_${newId}`;
        const start = new Date();
        start.setHours(start.getHours() + 2, 0, 0, 0);
        const end = new Date(start.getTime() + 45 * 60000);
        const newEv: CalendarEvent = {
          id: linkedEventId,
          title: formTitle.trim() || 'Bloco Agendado Keep',
          start: start.toISOString(),
          end: end.toISOString(),
          calendarId: 'primary',
          color: '#34A853',
          description: formContent.trim(),
        };
        if (onUpdateEvents) onUpdateEvents([...(data?.events || []), newEv]);
        await bridge.createCalendarEvent(newEv);
      }

      const newNote: NoteItem = {
        id: newId,
        title: formTitle.trim() || 'Nota no Canvas',
        content: formContent.trim(),
        color: formColor,
        pinned: true,
        date: new Date().toISOString(),
        status: 'upcoming',
        badgeType: formColor === 'purple' ? 'media' : 'plus',
        connectedTo: notes.length > 0 ? [notes[0].id] : [],
        linkedTaskId,
        linkedEventId,
      };

      const nextNotes = [newNote, ...notes];
      syncNotes(nextNotes);
      await bridge.addNote(newNote);
      toast('Nova nota adicionada e conectada ao Canvas!');
    }

    setIsModalOpen(false);
    setEditingNote(null);
    setFormTitle('');
    setFormContent('');
    setFormAutoTask(false);
    setFormAutoEvent(false);
  };

  const handleDeleteNote = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = notes
      .filter((n) => n.id !== id)
      .map((n) => ({
        ...n,
        connectedTo: (n.connectedTo || []).filter((target) => target !== id),
      }));
    syncNotes(updated);
    await bridge.deleteNote(id);
    if (activeChatNoteId === id) setActiveChatNoteId(null);
    toast('Nota removida do Canvas.');
  };

  // Toggle task directly from Right Sidebar ("Meus Eventos & Tasks")
  const handleToggleSidebarTask = async (task: TaskItem) => {
    const nextCompleted = !task.completed;
    if (onUpdateTasks && data?.tasks) {
      const updatedTasks = data.tasks.map((t: TaskItem) =>
        t.id === task.id ? { ...t, completed: nextCompleted } : t
      );
      onUpdateTasks(updatedTasks);
    }
    // Also sync any Canvas Note linked to this task!
    const updatedNotes = notes.map((n) =>
      n.linkedTaskId === task.id
        ? { ...n, status: (nextCompleted ? 'completed' : 'upcoming') as NoteItem['status'] }
        : n
    );
    syncNotes(updatedNotes);
    await bridge.toggleTask(task.id);
    toast(nextCompleted ? 'Tarefa concluída e sincronizada com o Canvas!' : 'Tarefa reaberta.');
  };

  const filteredNotes = notes.filter((n) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      n.title?.toLowerCase().includes(q) ||
      n.content?.toLowerCase().includes(q) ||
      n.labels?.some((l) => l.toLowerCase().includes(q))
    );
  });

  // Split notes into Left Column and Right Column of the Canvas (just like the reference image!)
  const leftColumnNotes = filteredNotes.filter((_, idx) => idx % 2 === 0);
  const rightColumnNotes = filteredNotes.filter((_, idx) => idx % 2 === 1);

  // KPI metrics (matching 26 Total | 2 Completed | 23 Upcoming in reference image)
  const allTasks: TaskItem[] = data?.tasks || [];
  const allEvents: CalendarEvent[] = data?.events || [];
  const totalCount = notes.length + allTasks.length + allEvents.length;
  const completedCount =
    notes.filter((n) => n.status === 'completed').length +
    allTasks.filter((t) => t.completed).length;
  const upcomingCount = Math.max(0, totalCount - completedCount);

  const activeChatNote = notes.find((n) => n.id === activeChatNoteId) || null;

  return (
    <div
      className={`flex flex-col lg:flex-row h-full w-full overflow-hidden select-none transition-colors ${
        isDarkMode ? 'bg-[#101216] text-white' : 'bg-[#F6F6F3] text-[#18181B]'
      }`}
      onClick={() => setOpenMenuNoteId(null)}
    >
      {/* =====================================================================
          LEFT / MAIN AREA: KEEP SPATIAL CANVAS & NODE GRAPH
         ===================================================================== */}
      <div className="flex-1 flex flex-col h-full overflow-hidden border-r border-black/[0.06] dark:border-white/[0.08]">
        {/* Top Bar: Title + Search Pill + Actions */}
        <header className="px-6 pt-5 pb-3 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-amber-400/15 border border-amber-400/30 shadow-xs">
              <GoogleIcons.Keep className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight leading-none">
                  Keep Canvas & Fluxos
                </h1>
                <span className="text-lg" aria-hidden="true">🕰️</span>
              </div>
              <p className={`text-xs mt-1 ${isDarkMode ? 'text-white/55' : 'text-zinc-500'}`}>
                Conecte notas em fluxos visuais e transforme-as em atividades no Tasks, Agenda ou threads no Google Chat
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-1 max-w-xl justify-end">
            {/* Search Pill */}
            <div
              className={`flex items-center px-4 py-2.5 rounded-full flex-1 max-w-xs border transition-all ${
                isDarkMode
                  ? 'bg-white/[0.06] border-white/10 focus-within:bg-white/[0.10]'
                  : 'bg-[#EBEBE6] border-black/[0.05] focus-within:bg-white focus-within:shadow-sm'
              }`}
            >
              <Search size={16} className={isDarkMode ? 'text-white/50' : 'text-zinc-500'} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar no Canvas..."
                className="bg-transparent border-none outline-none text-xs ml-2.5 w-full"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')}>
                  <X size={13} className="opacity-50 hover:opacity-100" />
                </button>
              )}
            </div>

            {connectingFromId !== null && (
              <button
                type="button"
                onClick={() => setConnectingFromId(null)}
                className="px-3 py-2 rounded-full text-xs font-semibold bg-emerald-500 text-white shadow-md animate-pulse flex items-center gap-1.5"
              >
                <GitBranch size={14} />
                <span>Conectando... (Cancelar)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setEditingNote(null);
                setFormTitle('');
                setFormContent('');
                setFormColor('default');
                setIsModalOpen(true);
              }}
              className={`px-4 py-2.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                isDarkMode
                  ? 'bg-white text-black hover:bg-white/90'
                  : 'bg-[#18181B] text-white hover:bg-zinc-800'
              }`}
            >
              <Plus size={15} />
              <span>Nova Nota</span>
            </button>
          </div>
        </header>

        {/* Scrollable Spatial Canvas with SVG Dashed Connectors */}
        <div
          ref={canvasContainerRef}
          onScroll={recomputeConnectors}
          className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4 relative"
        >
          {/* SVG Dashed Green Connector Layer (matching reference image!) */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible"
            style={{ minHeight: '760px' }}
          >
            {connectors.map((line) => {
              const midX = (line.x1 + line.x2) / 2;
              const d = `M ${line.x1} ${line.y1} L ${midX - 12} ${line.y1} Q ${midX} ${line.y1} ${midX} ${
                line.y1 + (line.y2 >= line.y1 ? 12 : -12)
              } L ${midX} ${line.y2 - (line.y2 >= line.y1 ? 12 : -12)} Q ${midX} ${line.y2} ${
                midX + 12
              } ${line.y2} L ${line.x2} ${line.y2}`;

              return (
                <g key={line.id}>
                  <path
                    d={d}
                    fill="none"
                    stroke="#22C55E"
                    strokeWidth="2"
                    strokeDasharray="5 5"
                    className="transition-all duration-300"
                  />
                  <circle cx={line.x1} cy={line.y1} r="4.5" fill="#22C55E" />
                  <circle cx={line.x2} cy={line.y2} r="4.5" fill="#22C55E" />
                </g>
              );
            })}
          </svg>

          {/* Two-Column Staggered Node Graph Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-14 gap-y-7 relative z-20 pb-10">
            {/* CANVAS COLUMN 1 (Left Nodes) */}
            <div className="flex flex-col gap-7">
              {leftColumnNotes.map((note) => renderCanvasNodeCard(note))}
            </div>

            {/* CANVAS COLUMN 2 (Top 3 KPI Summary Tiles + Right Nodes, matching image.png!) */}
            <div className="flex flex-col gap-7">
              {/* 3 KPI Summary Tiles: Total | Completed | Upcoming */}
              <div className="grid grid-cols-3 gap-3.5">
                {/* Tile 1: Total */}
                <div
                  className={`rounded-[26px] p-4 flex flex-col items-center justify-center text-center transition-transform hover:scale-[1.02] ${
                    isDarkMode
                      ? 'bg-[#0C4A6E]/45 border border-sky-400/20 text-sky-100'
                      : 'bg-[#DCF2FA] text-[#18181B]'
                  }`}
                >
                  <span className="text-3xl font-extrabold tracking-tight">{totalCount}</span>
                  <span className={`text-xs font-medium mt-1 ${isDarkMode ? 'text-sky-200/75' : 'text-zinc-600'}`}>
                    Total
                  </span>
                </div>

                {/* Tile 2: Completed 🎉 */}
                <div
                  className={`relative rounded-[26px] p-4 flex flex-col items-center justify-center text-center transition-transform hover:scale-[1.02] ${
                    isDarkMode
                      ? 'bg-[#064E3B]/55 border border-emerald-400/25 text-emerald-100'
                      : 'bg-[#BBF7D0] text-[#18181B]'
                  }`}
                >
                  <span className="absolute -top-2.5 right-2 text-xl select-none" aria-hidden="true">
                    🎉
                  </span>
                  <span className="text-3xl font-extrabold tracking-tight">{completedCount}</span>
                  <span className={`text-xs font-medium mt-1 ${isDarkMode ? 'text-emerald-200/80' : 'text-zinc-700'}`}>
                    Concluídas
                  </span>
                </div>

                {/* Tile 3: Upcoming (Dashed Border) */}
                <div
                  className={`rounded-[26px] p-4 flex flex-col items-center justify-center text-center border-2 border-dashed transition-transform hover:scale-[1.02] ${
                    isDarkMode
                      ? 'border-white/20 bg-white/[0.02] text-white'
                      : 'border-zinc-300 bg-white/50 text-[#18181B]'
                  }`}
                >
                  <span className="text-3xl font-extrabold tracking-tight">{upcomingCount}</span>
                  <span className={`text-xs font-medium mt-1 ${isDarkMode ? 'text-white/60' : 'text-zinc-500'}`}>
                    Em Fluxo
                  </span>
                </div>
              </div>

              {/* Right Column Connected Note Cards */}
              {rightColumnNotes.map((note) => renderCanvasNodeCard(note))}
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          RIGHT SIDEBAR: "MEUS EVENTOS & ATIVIDADES" (100% SYNCED STREAM)
         ===================================================================== */}
      <aside
        className={`w-full lg:w-[370px] shrink-0 h-full flex flex-col overflow-hidden ${
          isDarkMode ? 'bg-[#14171D]' : 'bg-[#F6F6F3]'
        }`}
      >
        {/* Header: My Events 🧐 */}
        <div className="px-6 pt-5 pb-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold tracking-tight">Meus Eventos</h2>
            <span className="text-xl" aria-hidden="true">🧐</span>
          </div>
          <div className="flex items-center gap-1.5">
            {onOpenApp && (
              <button
                type="button"
                onClick={() => onOpenApp('calendar')}
                className={`p-2 rounded-full transition-colors ${
                  isDarkMode ? 'hover:bg-white/10 text-white/70' : 'hover:bg-black/5 text-zinc-600'
                }`}
                title="Abrir Google Agenda"
              >
                <ExternalLink size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className={`p-2 rounded-full transition-colors ${
                isDarkMode ? 'hover:bg-white/10 text-white/80' : 'hover:bg-black/10 text-zinc-700'
              }`}
              title="Fechar Keep Canvas"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Pastel Stacked Cards Stream (Events + Tasks synced with Canvas) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 pb-8 space-y-4">
          {/* 1. Synced Calendar Events (Soft Cyan & Soft Lilac Cards like Webinar / Lesson in image.png) */}
          {allEvents.slice(0, 3).map((ev: CalendarEvent, idx: number) => {
            const isCyan = idx % 2 === 0;
            const linkedNote = notes.find((n) => n.linkedEventId === ev.id);
            const evDate = new Date(ev.start);
            const dateLabel = evDate.toLocaleDateString('pt-BR', {
              weekday: 'short',
              day: '2-digit',
              month: '2-digit',
            });
            const timeLabel = evDate.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            });
            const leadGuest = ev.guests?.[0];

            const cardBg = isCyan
              ? isDarkMode
                ? 'bg-[#0C4A6E]/55 border border-sky-400/25 text-sky-50'
                : 'bg-[#D6F1FA] text-[#18181B]'
              : isDarkMode
              ? 'bg-[#3B1D5A]/60 border border-purple-400/25 text-purple-50'
              : 'bg-[#EBD5FF] text-[#18181B]';

            const innerBoxBg = isCyan
              ? isDarkMode
                ? 'bg-sky-950/50 text-sky-100/90'
                : 'bg-[#E5F7FD] text-zinc-700'
              : isDarkMode
              ? 'bg-purple-950/50 text-purple-100/90'
              : 'bg-[#F3E5FF] text-zinc-700';

            return (
              <div
                key={ev.id}
                onClick={() => {
                  if (linkedNote) {
                    setHighlightedNoteId(linkedNote.id);
                    setTimeout(() => setHighlightedNoteId(null), 1800);
                  } else if (onOpenApp) {
                    onOpenApp('calendar', { event: ev });
                  }
                }}
                className={`rounded-[28px] p-4 cursor-pointer transition-all duration-300 hover:-translate-y-0.5 shadow-xs ${cardBg}`}
              >
                {/* Top Row: Avatar/Icon + Category + Date */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    {leadGuest?.avatar ? (
                      <img
                        src={leadGuest.avatar}
                        alt={leadGuest.name || 'Host'}
                        className="w-8 h-8 rounded-full object-cover ring-2 ring-white/80 shadow-xs"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center font-bold text-xs">
                        {isCyan ? '🎙️' : '|•|'}
                      </div>
                    )}
                    <span className="font-bold text-xs tracking-tight">{ev.title}</span>
                  </div>
                  <span className="text-[11px] font-semibold opacity-75 capitalize">{dateLabel}</span>
                </div>

                {/* Inner Description Box */}
                <div className={`rounded-2xl p-3.5 text-xs leading-relaxed ${innerBoxBg}`}>
                  <p className="line-clamp-3">
                    {ev.description || ev.location || 'Sessão sincronizada com o Google Agenda e Keep Canvas.'}
                  </p>
                  {linkedNote && (
                    <div className="mt-2 pt-2 border-t border-black/[0.06] dark:border-white/10 flex items-center gap-1.5 text-[10px] font-semibold opacity-85">
                      <Link2 size={11} />
                      <span>Conectado à nota: {linkedNote.title}</span>
                    </div>
                  )}
                </div>

                {/* Bottom Start Time Pill Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (ev.meetLink && onOpenApp) {
                      onOpenApp('meet');
                    } else if (onOpenApp) {
                      onOpenApp('calendar', { event: ev });
                    }
                  }}
                  className={`w-full mt-3 py-2 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs ${
                    isDarkMode
                      ? 'bg-white text-slate-900 hover:bg-white/90'
                      : 'bg-white text-[#18181B] hover:bg-zinc-50'
                  }`}
                >
                  <Clock size={13} />
                  <span>Início às {timeLabel}</span>
                </button>
              </div>
            );
          })}

          {/* 2. Synced Tasks Cards (Soft Amber & Tilted Mint Green Cards like Task in image.png) */}
          {allTasks.slice(0, 4).map((task: TaskItem, idx: number) => {
            const isMintTilted = idx % 2 === 1;
            const linkedNote = notes.find((n) => n.linkedTaskId === task.id);
            const dueStr = task.date
              ? new Date(task.date).toLocaleDateString('pt-BR', {
                  weekday: 'short',
                  day: '2-digit',
                  month: '2-digit',
                })
              : 'Hoje';

            const cardStyle = isMintTilted
              ? isDarkMode
                ? 'bg-[#064E3B]/60 border border-emerald-400/30 text-emerald-50 -rotate-[1.5deg] hover:rotate-0'
                : 'bg-[#BBF7D0] text-[#18181B] -rotate-[1.5deg] hover:rotate-0'
              : isDarkMode
              ? 'bg-[#452B0D]/65 border border-amber-400/25 text-amber-50'
              : 'bg-[#FDE6AC] text-[#18181B]';

            const innerStyle = isMintTilted
              ? isDarkMode
                ? 'bg-emerald-950/50 text-emerald-100/90'
                : 'bg-[#D5FCE3] text-zinc-700'
              : isDarkMode
              ? 'bg-amber-950/50 text-amber-100/90'
              : 'bg-[#FEF1CF] text-zinc-700';

            return (
              <div
                key={task.id}
                onClick={() => handleToggleSidebarTask(task)}
                className={`rounded-[28px] p-4 cursor-pointer transition-all duration-300 shadow-xs ${cardStyle}`}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <Pin size={14} className="rotate-45" />
                    <span className="font-bold text-xs">Task</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold opacity-75 capitalize">{dueStr}</span>
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] transition-colors ${
                        task.completed ? 'bg-emerald-600' : 'bg-black/20 dark:bg-white/20'
                      }`}
                    >
                      {task.completed && <Check size={11} strokeWidth={3} />}
                    </span>
                  </div>
                </div>

                <div className={`rounded-2xl p-3.5 text-xs leading-relaxed ${innerStyle}`}>
                  <p className={`font-bold ${task.completed ? 'line-through opacity-60' : ''}`}>
                    {task.title}
                  </p>
                  {task.details && (
                    <p className="mt-1 opacity-80 line-clamp-2">{task.details}</p>
                  )}
                  {linkedNote && (
                    <div className="mt-2 pt-1.5 border-t border-black/[0.06] dark:border-white/10 flex items-center gap-1.5 text-[10px] font-semibold opacity-80">
                      <Link2 size={11} />
                      <span>Sincronizado com: {linkedNote.title}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* =====================================================================
          GOOGLE CHAT THREAD DRAWER (100% CONNECTED TO CANVAS NOTE)
         ===================================================================== */}
      {activeChatNote && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-200"
          onClick={() => setActiveChatNoteId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md h-full flex flex-col shadow-2xl border-l p-5 ${
              isDarkMode
                ? 'bg-[#16181E] border-white/10 text-white'
                : 'bg-white border-black/10 text-[#18181B]'
            }`}
          >
            <div className="flex items-center justify-between pb-4 border-b border-black/10 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 block">
                    Google Chat Thread · Sincronizada
                  </span>
                  <h3 className="font-bold text-sm truncate max-w-[240px]">
                    {activeChatNote.title}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveChatNoteId(null)}
                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            {/* Linked Note Context Banner */}
            <div
              className={`my-3 p-3 rounded-2xl text-xs border ${
                isDarkMode
                  ? 'bg-white/[0.04] border-white/10 text-white/80'
                  : 'bg-zinc-50 border-zinc-200 text-zinc-700'
              }`}
            >
              <p className="font-medium">{activeChatNote.content}</p>
              <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-black/[0.06] dark:border-white/10">
                <button
                  type="button"
                  onClick={() => handleConvertNoteToTask(activeChatNote)}
                  className="px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-500 font-semibold text-[11px] flex items-center gap-1 hover:bg-blue-500/25 transition-colors"
                >
                  <CheckSquare size={12} />
                  <span>{activeChatNote.linkedTaskId ? 'Ver no Tasks' : 'Virar Task'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleScheduleNoteInCalendar(activeChatNote)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold text-[11px] flex items-center gap-1 hover:bg-amber-500/25 transition-colors"
                >
                  <Calendar size={12} />
                  <span>{activeChatNote.linkedEventId ? 'Agendado' : 'Agendar Reunião'}</span>
                </button>
              </div>
            </div>

            {/* Thread Messages */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1 my-2">
              {(activeChatNote.chatMessages || []).length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center text-center opacity-50 text-xs">
                  <MessageSquare size={28} className="mb-2" />
                  <p>Nenhuma mensagem nesta thread ainda. Inicie a conversa com o time!</p>
                </div>
              ) : (
                (activeChatNote.chatMessages || []).map((msg) => (
                  <div key={msg.id} className="flex items-start gap-2.5">
                    <img
                      src={msg.avatar}
                      alt={msg.sender}
                      className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5"
                    />
                    <div
                      className={`flex-1 p-3 rounded-2xl rounded-tl-xs text-xs ${
                        isDarkMode ? 'bg-white/[0.07]' : 'bg-zinc-100'
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2 mb-1">
                        <span className="font-bold">{msg.sender}</span>
                        <span className="text-[10px] opacity-55">{msg.time}</span>
                      </div>
                      <p className="leading-relaxed opacity-90">{msg.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Message Composer */}
            <div className="pt-3 border-t border-black/10 dark:border-white/10 flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                placeholder="Enviar mensagem na thread do Google Chat..."
                className={`flex-1 px-3.5 py-2.5 rounded-full text-xs outline-none border ${
                  isDarkMode
                    ? 'bg-white/[0.06] border-white/15 text-white'
                    : 'bg-zinc-100 border-zinc-200 text-zinc-900'
                }`}
              />
              <button
                type="button"
                onClick={handleSendChatMessage}
                className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-500 transition-colors shrink-0"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          CREATE / EDIT NOTE MODAL WITH AUTO-SYNC TO TASKS & CALENDAR
         ===================================================================== */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-[28px] p-6 shadow-2xl border ${
              isDarkMode
                ? 'bg-[#181A20] border-white/15 text-white'
                : 'bg-white border-black/10 text-[#18181B]'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold">
                {editingNote ? 'Editar Nota do Canvas' : 'Nova Nota Conectada'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Título da nota ou módulo..."
                className={`w-full px-4 py-2.5 rounded-2xl text-sm font-bold outline-none border ${
                  isDarkMode
                    ? 'bg-white/[0.05] border-white/10 text-white'
                    : 'bg-zinc-100 border-zinc-200 text-zinc-900'
                }`}
                autoFocus
              />
              <textarea
                rows={3}
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Descreva o objetivo, passos ou links..."
                className={`w-full px-4 py-2.5 rounded-2xl text-xs leading-relaxed outline-none border resize-none ${
                  isDarkMode
                    ? 'bg-white/[0.05] border-white/10 text-white'
                    : 'bg-zinc-100 border-zinc-200 text-zinc-900'
                }`}
              />

              {/* Style selector */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-semibold opacity-75">Estilo do Card no Canvas:</span>
                <div className="flex items-center gap-2">
                  {[
                    { id: 'default', label: 'Padrão', cls: 'bg-white border-zinc-300' },
                    { id: 'purple', label: 'Destaque Lilás', cls: 'bg-[#E9D5FF] border-purple-400' },
                    { id: 'green', label: 'Mint', cls: 'bg-[#BBF7D0] border-emerald-400' },
                    { id: 'yellow', label: 'Âmbar', cls: 'bg-[#FDE6AC] border-amber-400' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFormColor(opt.id)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all text-zinc-900 ${
                        opt.cls
                      } ${formColor === opt.id ? 'ring-2 ring-blue-500 scale-105' : 'opacity-70'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Automatic Ecosystem Synchronization Checkboxes */}
              {!editingNote && (
                <div
                  className={`p-3.5 rounded-2xl border space-y-2 ${
                    isDarkMode ? 'bg-white/[0.03] border-white/10' : 'bg-zinc-50 border-zinc-200'
                  }`}
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider opacity-60 block">
                    Sincronização Automática no Ecossistema
                  </span>
                  <label className="flex items-center gap-2.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formAutoTask}
                      onChange={(e) => setFormAutoTask(e.target.checked)}
                      className="rounded accent-blue-600"
                    />
                    <span>Criar automaticamente como atividade no Google Tasks</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formAutoEvent}
                      onChange={(e) => setFormAutoEvent(e.target.checked)}
                      className="rounded accent-emerald-600"
                    />
                    <span>Alocar bloco correspondente na Google Agenda</span>
                  </label>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-full text-xs font-semibold opacity-70 hover:opacity-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveNoteModal}
                className="px-5 py-2 rounded-full text-xs font-bold bg-[#22C55E] text-white hover:bg-emerald-600 transition-colors shadow-md"
              >
                {editingNote ? 'Salvar Alterações' : 'Adicionar ao Canvas'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // =======================================================================
  // HELPER: RENDER INDIVIDUAL CANVAS NODE CARD (MATCHING REFERENCE IMAGE)
  // =======================================================================
  function renderCanvasNodeCard(note: NoteItem) {
    const isCompleted = note.status === 'completed';
    const isMediaPurple = note.color === 'purple' || note.badgeType === 'media';
    const isConnectingSource = connectingFromId === note.id;
    const isHighlighted = highlightedNoteId === note.id;
    const isPlaying = playingNoteId === note.id;
    const chatCount = note.chatMessages?.length || 0;

    //Featured Lilac / Collaborative Card (like "Pharmacology Basics" in image.png)
    if (isMediaPurple) {
      return (
        <div
          key={note.id}
          ref={(el) => {
            cardRefs.current[note.id] = el;
          }}
          onClick={(e) => {
            if (connectingFromId !== null) {
              handleNodeConnectionClick(note.id, e);
            }
          }}
          className={`relative rounded-[30px] p-6 transition-all duration-300 -rotate-[1.2deg] hover:rotate-0 shadow-md ${
            isDarkMode
              ? 'bg-gradient-to-br from-[#4C1D95]/90 via-[#3B1D5A] to-[#2E1065] text-white border border-purple-400/30'
              : 'bg-[#E9D5FF] text-[#18181B]'
          } ${isConnectingSource ? 'ring-4 ring-emerald-500' : ''} ${
            isHighlighted ? 'ring-4 ring-blue-500 scale-[1.02]' : ''
          }`}
        >
          {/* Decorative musical/wave notes in background like image.png */}
          <span
            className="absolute top-4 right-20 text-2xl opacity-35 pointer-events-none select-none"
            aria-hidden="true"
          >
            ♪
          </span>

          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-extrabold tracking-tight leading-snug">
                {note.title}
              </h3>
              <p
                className={`text-xs leading-relaxed mt-2 line-clamp-2 ${
                  isDarkMode ? 'text-purple-100/80' : 'text-zinc-700'
                }`}
              >
                {note.content}
              </p>
            </div>

            {/* Circular Play / Focus Action Button (matching image.png) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPlayingNoteId(isPlaying ? null : note.id);
                toast(
                  isPlaying
                    ? 'Modo foco pausado.'
                    : `Iniciando briefing de foco: "${note.title}"`
                );
              }}
              className="w-16 h-16 rounded-full bg-white/85 dark:bg-white text-[#18181B] shadow-lg flex items-center justify-center shrink-0 hover:scale-105 active:scale-95 transition-transform ring-8 ring-white/30"
              title="Iniciar modo foco / áudio da nota"
            >
              {isPlaying ? (
                <Pause size={22} className="fill-current" />
              ) : (
                <Play size={22} className="fill-current ml-0.5" />
              )}
            </button>
          </div>

          {/* Ecosystem Sync Pills */}
          <div className="flex flex-wrap items-center gap-1.5 mt-4">
            <button
              type="button"
              onClick={(e) => handleOpenChatThread(note, e)}
              className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/60 dark:bg-black/30 hover:bg-white transition-colors flex items-center gap-1"
            >
              <MessageSquare size={11} />
              <span>Google Chat ({chatCount})</span>
            </button>
            <button
              type="button"
              onClick={(e) => handleConvertNoteToTask(note, e)}
              className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/60 dark:bg-black/30 hover:bg-white transition-colors flex items-center gap-1"
            >
              <CheckSquare size={11} />
              <span>{note.linkedTaskId ? 'Task Sincronizada ✓' : '+ Virar Task'}</span>
            </button>
            <button
              type="button"
              onClick={(e) => handleNodeConnectionClick(note.id, e)}
              className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-500/30 transition-colors flex items-center gap-1"
              title="Conectar esta nota a outra nota no Canvas"
            >
              <GitBranch size={11} />
              <span>Conectar</span>
            </button>
          </div>

          {/* Bottom Row: Watching Pill + Participant Avatars (matching image.png) */}
          <div className="flex items-center justify-between mt-4 pt-1">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white text-[#18181B] text-xs font-bold shadow-xs">
              <Clock size={13} />
              <span>{isPlaying ? 'Em reprodução · Ativo' : note.durationLabel || 'Em foco · 14:00'}</span>
            </span>

            <div className="flex items-center -space-x-2">
              {(
                note.participants || [
                  {
                    name: 'Gabriel Silva',
                    avatar:
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
                  },
                  {
                    name: 'Ana Lima',
                    avatar:
                      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
                  },
                  {
                    name: 'Marina Costa',
                    avatar:
                      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
                  },
                ]
              ).map((p, idx) => (
                <img
                  key={idx}
                  src={p.avatar}
                  alt={p.name}
                  title={p.name}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-[#E9D5FF] dark:ring-purple-900 shadow-xs"
                />
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Standard White / Glass Node Card (matching Medical Terminology, Anatomy, Medical Ethics in image.png)
    return (
      <div
        key={note.id}
        ref={(el) => {
          cardRefs.current[note.id] = el;
        }}
        onClick={(e) => {
          if (connectingFromId !== null) {
            handleNodeConnectionClick(note.id, e);
          }
        }}
        className={`relative rounded-[28px] p-6 transition-all duration-300 shadow-xs border ${
          isDarkMode
            ? 'bg-[#181B22] border-white/[0.08] hover:border-white/20 text-white'
            : 'bg-white border-black/[0.04] hover:shadow-md text-[#18181B]'
        } ${isConnectingSource ? 'ring-4 ring-emerald-500' : ''} ${
          isHighlighted ? 'ring-4 ring-blue-500 scale-[1.02]' : ''
        }`}
      >
        {/* Top-Right Overlapping Circular Badge (matching green + / brain / lock badge in image.png) */}
        <button
          type="button"
          onClick={(e) => handleNodeConnectionClick(note.id, e)}
          title="Clique para conectar esta nota a outra nota no fluxo"
          className={`absolute -top-3 -right-3 w-11 h-11 rounded-full flex items-center justify-center shadow-sm ring-4 transition-transform hover:scale-110 ${
            isDarkMode ? 'ring-[#101216]' : 'ring-[#F6F6F3]'
          } ${
            isCompleted
              ? 'bg-[#BBF7D0] text-[#14532D]'
              : 'bg-[#EBEBE6] dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200'
          }`}
        >
          {note.badgeType === 'plus' ? (
            <Plus size={18} strokeWidth={2.5} />
          ) : note.badgeType === 'brain' ? (
            <Sparkles size={17} strokeWidth={2.2} />
          ) : (
            <Lock size={16} strokeWidth={2.2} />
          )}
        </button>

        {/* Card Title & Description */}
        <h3 className="text-xl font-extrabold tracking-tight leading-snug pr-8">
          {note.title}
        </h3>
        <p
          className={`text-xs leading-relaxed mt-2 ${
            isDarkMode ? 'text-white/65' : 'text-zinc-500'
          }`}
        >
          {note.content}
        </p>

        {/* Connected Ecosystem Sync Bar (Tasks, Google Chat, Calendar) */}
        <div className="flex flex-wrap items-center gap-1.5 mt-4">
          <button
            type="button"
            onClick={(e) => handleConvertNoteToTask(note, e)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors ${
              note.linkedTaskId
                ? 'bg-blue-500/15 text-blue-600 dark:text-blue-300'
                : isDarkMode
                ? 'bg-white/[0.06] text-white/70 hover:bg-white/10'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
            title="Sincronizar com Google Tasks"
          >
            <CheckSquare size={11} />
            <span>{note.linkedTaskId ? 'No Tasks ✓' : '+ Virar Task'}</span>
          </button>

          <button
            type="button"
            onClick={(e) => handleOpenChatThread(note, e)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors ${
              chatCount > 0
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : isDarkMode
                ? 'bg-white/[0.06] text-white/70 hover:bg-white/10'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
            title="Abrir thread desta nota no Google Chat"
          >
            <MessageSquare size={11} />
            <span>{chatCount > 0 ? `Chat (${chatCount})` : 'Criar Thread Chat'}</span>
          </button>

          <button
            type="button"
            onClick={(e) => handleScheduleNoteInCalendar(note, e)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors ${
              note.linkedEventId
                ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300'
                : isDarkMode
                ? 'bg-white/[0.06] text-white/70 hover:bg-white/10'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
            title="Sincronizar com a Google Agenda"
          >
            <Calendar size={11} />
            <span>{note.linkedEventId ? 'Na Agenda ✓' : '+ Agendar'}</span>
          </button>
        </div>

        {/* Bottom Status & Action Bar (matching Completed 🎉 | ... | [ x | ✓ ] in image.png) */}
        <div className="flex items-center justify-between mt-5 pt-1">
          {isCompleted ? (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#BBF7D0] text-[#14532D] text-xs font-bold">
              <span>Concluída</span>
              <span aria-hidden="true">🎉</span>
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold ${
                isDarkMode ? 'bg-white/10 text-white/80' : 'bg-[#EBEBE6] text-zinc-700'
              }`}
            >
              <span>Em Fluxo</span>
              <Clock size={12} />
            </span>
          )}

          <div className="flex items-center gap-2 relative">
            {/* "..." Context Action Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenuNoteId(openMenuNoteId === note.id ? null : note.id);
              }}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                isDarkMode
                  ? 'bg-white/10 hover:bg-white/20 text-white'
                  : 'bg-[#EBEBE6] hover:bg-zinc-300 text-zinc-700'
              }`}
              title="Mais ações e conexões"
            >
              <MoreHorizontal size={15} />
            </button>

            {/* Context Dropdown Menu */}
            {openMenuNoteId === note.id && (
              <div
                onClick={(e) => e.stopPropagation()}
                className={`absolute bottom-10 right-0 w-48 rounded-2xl p-1.5 shadow-xl border z-40 text-xs ${
                  isDarkMode
                    ? 'bg-[#20232B] border-white/15 text-white'
                    : 'bg-white border-black/10 text-zinc-800'
                }`}
              >
                <button
                  type="button"
                  onClick={(e) => handleNodeConnectionClick(note.id, e)}
                  className="w-full px-3 py-2 rounded-xl text-left flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <GitBranch size={13} className="text-emerald-500" />
                  <span>Conectar a outra nota</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingNote(note);
                    setFormTitle(note.title);
                    setFormContent(note.content);
                    setFormColor(note.color || 'default');
                    setOpenMenuNoteId(null);
                    setIsModalOpen(true);
                  }}
                  className="w-full px-3 py-2 rounded-xl text-left flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <Edit3 size={13} className="text-blue-500" />
                  <span>Editar nota</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDeleteNote(note.id, e)}
                  className="w-full px-3 py-2 rounded-xl text-left flex items-center gap-2 text-red-500 hover:bg-red-500/10"
                >
                  <Trash2 size={13} />
                  <span>Excluir do Canvas</span>
                </button>
              </div>
            )}

            {/* Tactile [ × | ✓ ] Toggle Switch (matching image.png!) */}
            <div
              className={`inline-flex items-center rounded-full p-0.5 ${
                isDarkMode ? 'bg-white/10' : 'bg-[#EBEBE6]'
              }`}
            >
              <button
                type="button"
                onClick={(e) => handleSetNoteCompleted(note, false, e)}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                  !isCompleted
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-xs'
                    : 'opacity-55 hover:opacity-100'
                }`}
                title="Marcar como pendente"
              >
                <X size={12} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={(e) => handleSetNoteCompleted(note, true, e)}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                  isCompleted
                    ? 'bg-[#18181B] text-white dark:bg-emerald-500 dark:text-black shadow-xs'
                    : 'opacity-55 hover:opacity-100'
                }`}
                title="Concluir nota e tarefa vinculada"
              >
                <Check size={12} strokeWidth={2.8} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}