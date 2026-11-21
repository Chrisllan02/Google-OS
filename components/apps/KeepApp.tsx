import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search, X, Plus, Check, Clock, Pin, Trash2,
  MessageSquare, Calendar, CheckSquare, MoreHorizontal, Play, Pause,
  Send, Sparkles, ExternalLink, Edit3, GitBranch, Lightbulb, Bell,
  Archive, Tag, Palette, Image as ImageIcon, UserPlus, Copy, FileText,
  PenTool, LayoutGrid, Rows, RotateCcw, Eraser, ScanText, Menu
} from 'lucide-react';
import { AppOpenPayload, bridge, ContactItem, DashboardData, NoteItem, TaskItem, CalendarEvent, ChatMessage } from '../../utils/GASBridge';
import {
  KeepFolderId,
  KeepChecklistItem,
  KEEP_COLORS,
  filterKeepNotes,
  convertTextToChecklist,
  convertChecklistToText,
  duplicateKeepNote,
  applyKeepNoteAction,
  removeLabelFromNotes,
  KeepNoteAction,
} from '../../utils/keepLogic';
import { GoogleIcons } from '../GoogleIcons';

interface KeepAppProps {
  onClose: () => void;
  data: DashboardData;
  onUpdate?: (notes: NoteItem[]) => void;
  onUpdateTasks?: (tasks: TaskItem[]) => void;
  onUpdateEvents?: (events: CalendarEvent[]) => void;
  onOpenApp?: (type: string, fileData?: AppOpenPayload) => void;
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
  const [keepLabels, setKeepLabels] = useState<string[]>([]);
  const [collaboratorContacts, setCollaboratorContacts] = useState<ContactItem[]>([]);

  useEffect(() => {
    bridge.searchContacts('').then(setCollaboratorContacts).catch(() => setCollaboratorContacts([]));
  }, [data]);
  const [newLabelInput, setNewLabelInput] = useState('');
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);

  // Navigation & View Mode
  const [activeFolder, setActiveFolder] = useState<KeepFolderId>('notes');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'canvas'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [colorFilter, setColorFilter] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );

  // Quick Capture ("Criar uma nota...") State
  const [isQuickCaptureExpanded, setIsQuickCaptureExpanded] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickContent, setQuickContent] = useState('');
  const [quickColor, setQuickColor] = useState('default');
  const [quickPinned, setQuickPinned] = useState(false);
  const [quickReminder, setQuickReminder] = useState<string | undefined>(undefined);
  const [quickLabels, setQuickLabels] = useState<string[]>([]);
  const [showQuickLabelPicker, setShowQuickLabelPicker] = useState(false);
  const [quickIsChecklist, setQuickIsChecklist] = useState(false);
  const [quickChecklist, setQuickChecklist] = useState<KeepChecklistItem[]>([]);
  const [quickChecklistDraft, setQuickChecklistDraft] = useState('');
  const [quickImages, setQuickImages] = useState<string[]>([]);

  // Card Popovers State
  const [openMenuNoteId, setOpenMenuNoteId] = useState<number | null>(null);
  const [openColorNoteId, setOpenColorNoteId] = useState<number | null>(null);
  const [openReminderNoteId, setOpenReminderNoteId] = useState<number | null>(null);
  const [openCollabNoteId, setOpenCollabNoteId] = useState<number | null>(null);
  const [openLabelNoteId, setOpenLabelNoteId] = useState<number | null>(null);
  const [inlineChecklistDraftMap, setInlineChecklistDraftMap] = useState<Record<number, string>>({});

  // Spatial Canvas & Ecosystem State
  const [connectingFromId, setConnectingFromId] = useState<number | null>(null);
  const [highlightedNoteId, setHighlightedNoteId] = useState<number | null>(null);
  const [playingNoteId, setPlayingNoteId] = useState<number | null>(null);
  const [activeChatNoteId, setActiveChatNoteId] = useState<number | null>(null);
  const [chatInput, setChatInput] = useState('');

  // Edit Note Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formColor, setFormColor] = useState('default');
  const [formAutoTask, setFormAutoTask] = useState(false);
  const [formAutoEvent, setFormAutoEvent] = useState(false);

  // Freehand Drawing Modal State
  const [drawingTargetNoteId, setDrawingTargetNoteId] = useState<number | 'quick' | null>(null);
  const [brushColor, setBrushColor] = useState('#2563EB');
  const [brushSize, setBrushSize] = useState(4);
  const isDrawingRef = useRef(false);
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Image Upload Ref
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [imageUploadTargetId, setImageUploadTargetId] = useState<number | 'quick' | null>(null);

  // Refs for SVG dashed connector calculation in Spatial Canvas mode
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [connectors, setConnectors] = useState<ConnectorLine[]>([]);

  const toast = (msg: string) => (showToast ? showToast(msg) : console.log(msg));

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const [loadedNotes, loadedLabels] = await Promise.all([bridge.getNotes(), bridge.getKeepLabels()]);
      if (!mounted) return;
      if (loadedNotes && loadedNotes.length > 0) {
        setNotes(loadedNotes);
      }
      if (loadedLabels && loadedLabels.length > 0) {
        setKeepLabels(loadedLabels);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (data?.notes) {
      setNotes(data.notes);
    }
  }, [data?.notes]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (drawingTargetNoteId !== null) setDrawingTargetNoteId(null);
      else if (isModalOpen) setIsModalOpen(false);
      else if (activeChatNoteId !== null) setActiveChatNoteId(null);
      else {
        setOpenMenuNoteId(null);
        setOpenColorNoteId(null);
        setOpenReminderNoteId(null);
        setOpenCollabNoteId(null);
        setOpenLabelNoteId(null);
        setShowQuickLabelPicker(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawingTargetNoteId, isModalOpen, activeChatNoteId]);

  const syncNotes = async (updated: NoteItem[]) => {
    setNotes(updated);
    if (onUpdate) onUpdate(updated);
    await bridge.saveAllNotes(updated);
  };

  // Filtered notes via pure keepLogic
  const filteredNotes = useMemo(() => {
    return filterKeepNotes(notes, {
      folder: activeFolder,
      searchQuery,
      colorFilter,
    });
  }, [notes, activeFolder, searchQuery, colorFilter]);

  const pinnedNotes = useMemo(
    () => (activeFolder === 'notes' ? filteredNotes.filter((n) => n.pinned) : []),
    [filteredNotes, activeFolder]
  );
  const unpinnedNotes = useMemo(
    () => (activeFolder === 'notes' ? filteredNotes.filter((n) => !n.pinned) : filteredNotes),
    [filteredNotes, activeFolder]
  );

  // Folder counts
  const folderCounts = useMemo(() => {
    return {
      notes: notes.filter((n) => !n.trashed && !n.archived).length,
      reminders: notes.filter((n) => !n.trashed && Boolean(n.reminder)).length,
      archive: notes.filter((n) => !n.trashed && Boolean(n.archived)).length,
      trash: notes.filter((n) => Boolean(n.trashed)).length,
    };
  }, [notes]);

  // Compute SVG connector coordinates between connected notes in Canvas mode
  const recomputeConnectors = useCallback(() => {
    if (viewMode !== 'canvas') return;
    const container = canvasContainerRef.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    const lines: ConnectorLine[] = [];

    filteredNotes.forEach((sourceNote) => {
      const targets = sourceNote.connectedTo || [];
      const sourceEl = cardRefs.current[sourceNote.id];
      if (!sourceEl) return;
      const sRect = sourceEl.getBoundingClientRect();

      targets.forEach((targetId) => {
        const targetEl = cardRefs.current[targetId];
        if (!targetEl) return;
        const tRect = targetEl.getBoundingClientRect();

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
  }, [filteredNotes, viewMode]);

  useEffect(() => {
    const timer = window.setTimeout(recomputeConnectors, 60);
    window.addEventListener('resize', recomputeConnectors);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', recomputeConnectors);
    };
  }, [recomputeConnectors, searchQuery, activeChatNoteId, viewMode]);

  // --- NATIVE KEEP ACTIONS ---
  const handleNoteAction = async (
    noteId: number,
    action: KeepNoteAction,
    payload?: Parameters<typeof applyKeepNoteAction>[3]
  ) => {
    const next = applyKeepNoteAction(notes, noteId, action, payload);
    await syncNotes(next);

    if (action === 'archive') toast('Nota arquivada');
    else if (action === 'unarchive') toast('Nota desarquivada');
    else if (action === 'trash') toast('Nota movida para a Lixeira');
    else if (action === 'restore') toast('Nota restaurada da Lixeira');
    else if (action === 'delete_forever') toast('Nota excluída permanentemente');
    else if (action === 'set_reminder') toast(`Lembrete definido: ${payload?.reminder}`);
    else if (action === 'clear_reminder') toast('Lembrete removido');
  };

  const handleEmptyTrash = async () => {
    const remaining = notes.filter((n) => !n.trashed);
    await syncNotes(remaining);
    toast('Lixeira do Google Keep esvaziada!');
  };

  const handleDuplicateNote = async (note: NoteItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setOpenMenuNoteId(null);
    const copy = duplicateKeepNote(note);
    const next = [copy, ...notes];
    await syncNotes(next);
    toast(`Cópia de "${note.title}" criada!`);
  };

  const handleToggleChecklistMode = async (note: NoteItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setOpenMenuNoteId(null);
    const hasChecklist = note.checklist && note.checklist.length > 0;
    const updated = notes.map((n) => {
      if (n.id !== note.id) return n;
      if (hasChecklist) {
        return {
          ...n,
          content: convertChecklistToText(n.checklist || []),
          checklist: undefined,
        };
      } else {
        return {
          ...n,
          checklist: convertTextToChecklist(n.content || n.title),
        };
      }
    });
    await syncNotes(updated);
    toast(hasChecklist ? 'Caixas de seleção ocultadas' : 'Texto convertido em lista de seleção interativa!');
  };

  const handleCopyNoteToGoogleDocs = async (note: NoteItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setOpenMenuNoteId(null);
    const res = await bridge.copyNoteToDoc(note);
    if (res.success && res.doc) {
      toast(`Copiado para o Google Docs: "${res.doc.name}"`);
      if (onOpenApp) {
        onOpenApp('doc', res.doc);
      }
    }
  };

  const handleExtractImageTextOCR = async (note: NoteItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setOpenMenuNoteId(null);
    const extracted = `\n[Texto extraído da imagem via OCR]: Especificação Técnica · Meta Q2 Validada · 99.9% SLA`;
    const updated = notes.map((n) =>
      n.id === note.id ? { ...n, content: `${n.content || ''}${extracted}`.trim() } : n
    );
    await syncNotes(updated);
    toast('Texto da imagem extraído para a nota (OCR)!');
  };

  // --- QUICK CAPTURE ("CRIAR UMA NOTA...") ---
  const handleSaveQuickCapture = async () => {
    const hasText = quickTitle.trim() || quickContent.trim();
    const hasList = quickIsChecklist && quickChecklist.length > 0;
    const hasMedia = quickImages.length > 0;

    if (!hasText && !hasList && !hasMedia) {
      setIsQuickCaptureExpanded(false);
      return;
    }

    const newNote: NoteItem = {
      id: Date.now(),
      title: quickTitle.trim() || (hasList ? 'Lista Rápida' : 'Nova Nota'),
      content: quickContent.trim(),
      color: quickColor,
      pinned: quickPinned,
      date: new Date().toISOString(),
      reminder: quickReminder,
      labels: quickLabels.length > 0 ? quickLabels : undefined,
      checklist: quickIsChecklist ? quickChecklist : undefined,
      images: quickImages.length > 0 ? quickImages : undefined,
      status: 'upcoming',
      badgeType: 'plus',
      connectedTo: notes.length > 0 ? [notes[0].id] : [],
    };

    const next = [newNote, ...notes];
    await syncNotes(next);
    setQuickTitle('');
    setQuickContent('');
    setQuickColor('default');
    setQuickPinned(false);
    setQuickReminder(undefined);
    setQuickLabels([]);
    setQuickIsChecklist(false);
    setQuickChecklist([]);
    setQuickChecklistDraft('');
    setQuickImages([]);
    setIsQuickCaptureExpanded(false);
    toast('Nota adicionada ao Google Keep!');
  };

  // --- CREATE / DELETE LABELS ---
  const handleCreateKeepLabel = async () => {
    const trimmed = newLabelInput.trim();
    if (!trimmed) return;
    if (!keepLabels.includes(trimmed)) {
      const next = [...keepLabels, trimmed];
      setKeepLabels(next);
      await bridge.saveKeepLabels(next);
    }
    setNewLabelInput('');
    setIsCreatingLabel(false);
    toast(`Marcador "${trimmed}" adicionado!`);
  };

  const handleDeleteKeepLabel = async (label: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = keepLabels.filter((l) => l !== label);
    setKeepLabels(next);
    await bridge.saveKeepLabels(next);
    const cleanedNotes = removeLabelFromNotes(notes, label);
    await syncNotes(cleanedNotes);
    if (activeFolder === `label:${label}`) setActiveFolder('notes');
    toast(`Marcador "${label}" removido`);
  };

  // --- FREEHAND DRAWING MODAL (HTML5 CANVAS) ---
  useEffect(() => {
    if (drawingTargetNoteId !== null && drawingCanvasRef.current) {
      const ctx = drawingCanvasRef.current.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, drawingCanvasRef.current.width, drawingCanvasRef.current.height);
      }
    }
  }, [drawingTargetNoteId]);

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    isDrawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const drawMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearDrawingCanvas = () => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleSaveDrawing = async () => {
    const canvas = drawingCanvasRef.current;
    if (!canvas || drawingTargetNoteId === null) return;
    const dataUrl = canvas.toDataURL('image/png');

    if (drawingTargetNoteId === 'quick') {
      setQuickImages((prev) => [...prev, dataUrl]);
      setIsQuickCaptureExpanded(true);
      setDrawingTargetNoteId(null);
      toast('Desenho anexado à nova nota!');
      return;
    }

    const updated = notes.map((n) =>
      n.id === drawingTargetNoteId
        ? { ...n, drawingDataUrl: dataUrl, images: [...(n.images || []), dataUrl] }
        : n
    );
    await syncNotes(updated);
    setDrawingTargetNoteId(null);
    toast('Desenho à mão livre salvo na nota!');
  };

  // --- IMAGE UPLOAD ---
  const handleImageFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || imageUploadTargetId === null) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      if (imageUploadTargetId === 'quick') {
        setQuickImages((prev) => [...prev, dataUrl]);
        setIsQuickCaptureExpanded(true);
        toast('Imagem adicionada à nova nota!');
      } else {
        const updated = notes.map((n) =>
          n.id === imageUploadTargetId ? { ...n, images: [...(n.images || []), dataUrl] } : n
        );
        await syncNotes(updated);
        toast('Imagem anexada à nota!');
      }
      setImageUploadTargetId(null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // --- ECOSYSTEM SYNC ACTIONS (TASKS, CALENDAR, CHAT, NODE GRAPH) ---
  const handleSetNoteCompleted = async (note: NoteItem, completed: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus: NoteItem['status'] = completed ? 'completed' : 'upcoming';
    const updatedNotes = notes.map((n) => (n.id === note.id ? { ...n, status: nextStatus } : n));
    await syncNotes(updatedNotes);

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
      title: note.title || 'Tarefa do Google Keep',
      details: note.content,
      completed: note.status === 'completed',
      date: new Date().toISOString(),
      listId: 'default',
    };

    if (onUpdateTasks) {
      onUpdateTasks([newTask, ...(data?.tasks || [])]);
    }
    await bridge.createTask(newTask.title, newTask.details, 'default', newTask.date);

    const updatedNotes = notes.map((n) => (n.id === note.id ? { ...n, linkedTaskId: newTaskId } : n));
    await syncNotes(updatedNotes);
    toast(`"${note.title}" virou uma atividade sincronizada no Tasks!`);
  };

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
        email: p.email || `${p.name.toLowerCase().replace(/\s+/g, '.')}@workspace.os`,
        avatar: p.avatar,
        responseStatus: 'accepted',
      })),
    };

    if (onUpdateEvents) {
      onUpdateEvents([...(data?.events || []), newEvent]);
    }
    await bridge.createCalendarEvent(newEvent);

    const updatedNotes = notes.map((n) => (n.id === note.id ? { ...n, linkedEventId: newEventId } : n));
    await syncNotes(updatedNotes);
    toast(`Evento "${newEvent.title}" agendado e sincronizado com a Agenda!`);
  };

  const handleNodeConnectionClick = async (targetNoteId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (connectingFromId === null) {
      setConnectingFromId(targetNoteId);
      setOpenMenuNoteId(null);
      toast('Clique em outra nota para conectar ou desconectar no fluxo.');
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

    await syncNotes(updatedNotes);
    setConnectingFromId(null);
  };

  const handleOpenChatThread = (note: NoteItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setOpenMenuNoteId(null);
    setActiveChatNoteId(note.id);
  };

  const handleSendChatMessage = async () => {
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

    await syncNotes(updatedNotes);
    setChatInput('');
  };

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
      await syncNotes(updated);
      toast('Nota atualizada!');
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
        title: formTitle.trim() || 'Nota Keep',
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
      await syncNotes(nextNotes);
      toast('Nova nota adicionada!');
    }

    setIsModalOpen(false);
    setEditingNote(null);
    setFormTitle('');
    setFormContent('');
    setFormAutoTask(false);
    setFormAutoEvent(false);
  };

  const handleToggleSidebarTask = async (task: TaskItem) => {
    const nextCompleted = !task.completed;
    if (onUpdateTasks && data?.tasks) {
      const updatedTasks = data.tasks.map((t: TaskItem) =>
        t.id === task.id ? { ...t, completed: nextCompleted } : t
      );
      onUpdateTasks(updatedTasks);
    }
    const updatedNotes = notes.map((n) =>
      n.linkedTaskId === task.id
        ? { ...n, status: (nextCompleted ? 'completed' : 'upcoming') as NoteItem['status'] }
        : n
    );
    await syncNotes(updatedNotes);
    await bridge.toggleTask(task.id);
    toast(nextCompleted ? 'Tarefa concluída e sincronizada com o Keep!' : 'Tarefa reaberta.');
  };

  const leftColumnNotes = filteredNotes.filter((_, idx) => idx % 2 === 0);
  const rightColumnNotes = filteredNotes.filter((_, idx) => idx % 2 === 1);

  const allTasks: TaskItem[] = data?.tasks || [];
  const allEvents: CalendarEvent[] = data?.events || [];
  const activeNotesList = notes.filter((n) => !n.trashed);
  const totalCount = activeNotesList.length + allTasks.length + allEvents.length;
  const completedCount =
    activeNotesList.filter((n) => n.status === 'completed').length +
    allTasks.filter((t) => t.completed).length;
  const upcomingCount = Math.max(0, totalCount - completedCount);

  const activeChatNote = notes.find((n) => n.id === activeChatNoteId) || null;

  const getKeepCardColorClasses = (colorId: string) => {
    const found = KEEP_COLORS.find((c) => c.id === (colorId || 'default')) || KEEP_COLORS[0];
    return `${isDarkMode ? found.darkBg : found.lightBg} ${found.border}`;
  };

  return (
    <div
      className={`relative flex flex-col h-full w-full overflow-hidden select-none transition-colors ${
        isDarkMode ? 'bg-[#101216] text-white' : 'bg-[#F6F6F3] text-[#18181B]'
      }`}
      onClick={() => {
        setOpenMenuNoteId(null);
        setOpenColorNoteId(null);
        setOpenReminderNoteId(null);
        setOpenCollabNoteId(null);
        setOpenLabelNoteId(null);
        setShowQuickLabelPicker(false);
      }}
    >
      {/* Hidden Image Input */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFileSelected}
      />

      {/* =====================================================================
          TOP HEADER BAR: KEEP BRANDING + SEARCH + COLOR FILTER + VIEW SWITCHER
         ===================================================================== */}
      <header
        className={`border-b shrink-0 z-30 ${
          isDarkMode ? 'border-white/[0.08] bg-[#14171D]' : 'border-black/[0.07] bg-white'
        }`}
      >
        <div className="h-14 sm:h-16 px-3 sm:px-5 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
            <button
              type="button"
              aria-label="Alternar menu lateral do Google Keep"
              onClick={() => setShowSidebar(!showSidebar)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-colors shrink-0 ${
                isDarkMode ? 'border-white/10 hover:bg-white/10' : 'border-zinc-200 hover:bg-zinc-100'
              }`}
              title="Alternar menu lateral do Google Keep"
            >
              <Menu size={16} className="md:hidden" />
              <GoogleIcons.Keep className="w-5 h-5 hidden md:block" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight leading-none truncate">
                  Google Keep
                </h1>
                <span className="hidden sm:inline-flex text-[11px] px-2 py-0.5 rounded-full font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 shrink-0">
                  {folderCounts.notes} ativas
                </span>
              </div>
              <p className={`hidden lg:block text-[11px] mt-0.5 truncate ${isDarkMode ? 'text-white/50' : 'text-zinc-500'}`}>
                Notas rápidas, listas interativas, desenho à mão livre, lembretes e Spatial Canvas
              </p>
            </div>
          </div>

          {/* Search + Color Filter Bar (Desktop/Tablet) */}
          <div className="hidden md:flex items-center gap-2 flex-1 max-w-xl min-w-0">
            <div
              className={`flex items-center px-3 py-2 rounded-2xl flex-1 min-w-0 border transition-all ${
                isDarkMode
                  ? 'bg-white/[0.06] border-white/10 focus-within:bg-white/[0.10]'
                  : 'bg-zinc-100 border-zinc-200 focus-within:bg-white focus-within:shadow-xs'
              }`}
            >
              <Search size={15} className={`shrink-0 ${isDarkMode ? 'text-white/50' : 'text-zinc-500'}`} />
              <input
                type="text"
                aria-label="Pesquisar notas"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar notas, checklists, marcadores..."
                className="bg-transparent border-none outline-none text-xs ml-2 w-full min-w-0"
              />
              {searchQuery && (
                <button type="button" aria-label="Limpar busca" onClick={() => setSearchQuery('')}>
                  <X size={13} className="opacity-50 hover:opacity-100" />
                </button>
              )}
            </div>

            {/* Color Filter Dots */}
            <div className="hidden xl:flex items-center gap-1 px-2 py-1.5 rounded-2xl border border-black/5 dark:border-white/10 shrink-0">
              {KEEP_COLORS.slice(0, 7).map((col) => (
                <button
                  type="button"
                  key={col.id}
                  aria-label={`Filtrar por cor ${col.label}`}
                  onClick={() => setColorFilter(colorFilter === col.id ? null : col.id)}
                  title={`Filtrar por cor: ${col.label}`}
                  className={`w-4 h-4 rounded-full border transition-transform ${
                    isDarkMode ? col.darkBg : col.lightBg
                  } ${colorFilter === col.id ? 'scale-125 ring-2 ring-blue-500' : 'opacity-75 hover:opacity-100'}`}
                />
              ))}
              {colorFilter && (
                <button
                  type="button"
                  onClick={() => setColorFilter(null)}
                  className="text-[10px] text-blue-500 font-bold px-1"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* Right Controls: View Mode Switcher + New Note + Close */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div
              className={`flex items-center p-0.5 sm:p-1 rounded-xl border ${
                isDarkMode ? 'bg-white/5 border-white/10' : 'bg-zinc-100 border-zinc-200'
              }`}
            >
              <button
                type="button"
                aria-label="Visualização em Grade"
                onClick={() => setViewMode('grid')}
                className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  viewMode === 'grid'
                    ? isDarkMode
                      ? 'bg-white/15 text-white shadow-xs'
                      : 'bg-white text-zinc-900 shadow-xs'
                    : 'opacity-60 hover:opacity-100'
                }`}
                title="Visualização em Grade (Mosaico Keep)"
              >
                <LayoutGrid size={13} /> <span className="hidden lg:inline">Grade</span>
              </button>
              <button
                type="button"
                aria-label="Visualização em Lista"
                onClick={() => setViewMode('list')}
                className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  viewMode === 'list'
                    ? isDarkMode
                      ? 'bg-white/15 text-white shadow-xs'
                      : 'bg-white text-zinc-900 shadow-xs'
                    : 'opacity-60 hover:opacity-100'
                }`}
                title="Visualização em Lista (1 Coluna)"
              >
                <Rows size={13} /> <span className="hidden lg:inline">Lista</span>
              </button>
              <button
                type="button"
                aria-label="Visualização Canvas"
                onClick={() => setViewMode('canvas')}
                className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  viewMode === 'canvas'
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'opacity-60 hover:opacity-100'
                }`}
                title="Visualização Spatial Canvas & Fluxos Conectados"
              >
                <GitBranch size={13} /> <span className="hidden lg:inline">Canvas</span>
              </button>
            </div>

            <button
              type="button"
              aria-label="Nova Nota"
              onClick={() => {
                setEditingNote(null);
                setFormTitle('');
                setFormContent('');
                setFormColor('default');
                setIsModalOpen(true);
              }}
              className={`px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs shrink-0 ${
                isDarkMode ? 'bg-amber-400 text-black hover:bg-amber-300' : 'bg-[#18181B] text-white hover:bg-zinc-800'
              }`}
            >
              <Plus size={14} /> <span className="hidden sm:inline">Nova Nota</span>
            </button>

            <button
              type="button"
              aria-label="Fechar Google Keep"
              onClick={onClose}
              className={`p-2 rounded-full transition-colors shrink-0 ${
                isDarkMode ? 'hover:bg-white/10 text-white/80' : 'hover:bg-black/10 text-zinc-700'
              }`}
            >
              <X size={19} />
            </button>
          </div>
        </div>

        {/* Mobile Search Bar (< md) */}
        <div className="flex md:hidden items-center gap-2 px-3 pb-2.5">
          <div
            className={`flex items-center px-3 py-1.5 rounded-xl flex-1 min-w-0 border ${
              isDarkMode
                ? 'bg-white/[0.06] border-white/10'
                : 'bg-zinc-100 border-zinc-200'
            }`}
          >
            <Search size={14} className="opacity-55 shrink-0" />
            <input
              type="text"
              aria-label="Pesquisar notas no celular"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar notas, checklists, marcadores..."
              className="bg-transparent border-none outline-none text-xs ml-2 w-full min-w-0"
            />
            {searchQuery && (
              <button type="button" aria-label="Limpar busca" onClick={() => setSearchQuery('')}>
                <X size={13} className="opacity-60" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* =====================================================================
          BODY: LEFT KEEP SIDEBAR + MAIN WORKSPACE + RIGHT ECOSYSTEM STREAM
         ===================================================================== */}
      <div className="flex-1 flex overflow-hidden relative min-h-0">
        {/* Mobile Backdrop for Sidebar Overlay */}
        {showSidebar && (
          <div
            className="md:hidden absolute inset-0 z-30 bg-black/40 backdrop-blur-[1px]"
            onClick={() => setShowSidebar(false)}
          />
        )}

        {/* 1. LEFT NATIVE GOOGLE KEEP NAVIGATION RAIL */}
        {showSidebar && (
          <aside
            aria-label="Navegação do Google Keep"
            className={`absolute inset-y-0 left-0 z-40 md:static md:z-auto w-56 shrink-0 border-r flex flex-col justify-between py-3 px-2.5 overflow-y-auto custom-scrollbar shadow-xl md:shadow-none ${
              isDarkMode ? 'border-white/[0.07] bg-[#12151B]' : 'border-black/[0.06] bg-[#FBFBFA]'
            }`}
          >
            <div className="space-y-1">
              {[
                { id: 'notes', label: 'Notas', icon: Lightbulb, count: folderCounts.notes },
                { id: 'reminders', label: 'Lembretes', icon: Bell, count: folderCounts.reminders },
              ].map((item) => {
                const Icon = item.icon;
                const active = activeFolder === item.id;
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      setActiveFolder(item.id);
                      if (typeof window !== 'undefined' && window.innerWidth < 768) setShowSidebar(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-r-full text-xs font-semibold transition-all ${
                      active
                        ? isDarkMode
                          ? 'bg-amber-400/20 text-amber-300'
                          : 'bg-[#FEEFC3] text-[#202124]'
                        : isDarkMode
                        ? 'text-white/70 hover:bg-white/5'
                        : 'text-zinc-700 hover:bg-zinc-200/60'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon size={16} />
                      <span>{item.label}</span>
                    </span>
                    {item.count > 0 && <span className="text-[10px] opacity-65">{item.count}</span>}
                  </button>
                );
              })}

              {/* Labels Section */}
              <div className="pt-3 pb-1 px-3 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-45">Marcadores</span>
                <button
                  type="button"
                  onClick={() => setIsCreatingLabel(!isCreatingLabel)}
                  className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold hover:underline"
                >
                  + Novo
                </button>
              </div>

              {isCreatingLabel && (
                <div className="px-2 py-1 flex items-center gap-1">
                  <input
                    type="text"
                    aria-label="Nome do marcador"
                    placeholder="Nome do marcador..."
                    value={newLabelInput}
                    onChange={(e) => setNewLabelInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateKeepLabel();
                      if (e.key === 'Escape') {
                        setIsCreatingLabel(false);
                        setNewLabelInput('');
                      }
                    }}
                    className={`flex-1 min-w-0 px-2.5 py-1 rounded-lg text-xs border outline-none ${
                      isDarkMode ? 'bg-black/30 border-white/15 text-white' : 'bg-white border-zinc-300 text-zinc-900'
                    }`}
                    autoFocus
                  />
                  <button
                    type="button"
                    aria-label="Salvar marcador"
                    onClick={handleCreateKeepLabel}
                    className="p-1.5 rounded bg-amber-500 text-black shrink-0"
                  >
                    <Check size={12} />
                  </button>
                </div>
              )}

              {keepLabels.map((lbl) => {
                const folderKey = `label:${lbl}`;
                const active = activeFolder === folderKey;
                return (
                  <div
                    key={lbl}
                    onClick={() => {
                      setActiveFolder(folderKey);
                      if (typeof window !== 'undefined' && window.innerWidth < 768) setShowSidebar(false);
                    }}
                    className={`group w-full flex items-center justify-between px-3.5 py-2 rounded-r-full text-xs font-medium cursor-pointer transition-all ${
                      active
                        ? isDarkMode
                          ? 'bg-amber-400/20 text-amber-300 font-semibold'
                          : 'bg-[#FEEFC3] text-[#202124] font-semibold'
                        : isDarkMode
                        ? 'text-white/65 hover:bg-white/5'
                        : 'text-zinc-700 hover:bg-zinc-200/60'
                    }`}
                  >
                    <span className="flex items-center gap-3 truncate">
                      <Tag size={14} className="shrink-0" />
                      <span className="truncate">{lbl}</span>
                    </span>
                    <button
                      type="button"
                      aria-label={`Excluir marcador ${lbl}`}
                      onClick={(e) => handleDeleteKeepLabel(lbl, e)}
                      className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-0.5"
                      title="Excluir marcador"
                    >
                      <X size={11} />
                    </button>
                  </div>
                );
              })}

              <div className={`my-2 border-t ${isDarkMode ? 'border-white/10' : 'border-zinc-200'}`} />

              {[
                { id: 'archive', label: 'Arquivo', icon: Archive, count: folderCounts.archive },
                { id: 'trash', label: 'Lixeira', icon: Trash2, count: folderCounts.trash },
              ].map((item) => {
                const Icon = item.icon;
                const active = activeFolder === item.id;
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      setActiveFolder(item.id);
                      if (typeof window !== 'undefined' && window.innerWidth < 768) setShowSidebar(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-r-full text-xs font-semibold transition-all ${
                      active
                        ? isDarkMode
                          ? 'bg-amber-400/20 text-amber-300'
                          : 'bg-[#FEEFC3] text-[#202124]'
                        : isDarkMode
                        ? 'text-white/70 hover:bg-white/5'
                        : 'text-zinc-700 hover:bg-zinc-200/60'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon size={16} />
                      <span>{item.label}</span>
                    </span>
                    {item.count > 0 && <span className="text-[10px] opacity-65">{item.count}</span>}
                  </button>
                );
              })}
            </div>

            <div
              className={`mx-2 p-3 rounded-2xl border text-[11px] space-y-1 ${
                isDarkMode ? 'bg-white/[0.03] border-white/10 text-white/60' : 'bg-amber-50/70 border-amber-200/70 text-zinc-700'
              }`}
            >
              <div className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Sparkles size={12} /> Sincronia Ativa
              </div>
              <p>Suas notas fixadas também aparecem em tempo real no Mural de Post-its da Home.</p>
            </div>
          </aside>
        )}

        {/* 2. CENTER WORKSPACE: QUICK CAPTURE BAR + CLASSIC MOSAIC / LIST OR SPATIAL CANVAS */}
        <div
          ref={canvasContainerRef}
          onScroll={recomputeConnectors}
          className="flex-1 min-w-0 overflow-y-auto custom-scrollbar px-3.5 sm:px-6 py-4 sm:py-5 relative"
        >
          {/* Trash Banner */}
          {activeFolder === 'trash' && (
            <div
              className={`mb-5 p-3.5 rounded-2xl border flex items-center justify-between text-xs ${
                isDarkMode ? 'bg-rose-500/15 border-rose-500/30 text-rose-200' : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <span>As notas na Lixeira podem ser restauradas ou excluídas permanentemente.</span>
              {filteredNotes.length > 0 && (
                <button
                  type="button"
                  onClick={handleEmptyTrash}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-500"
                >
                  Esvaziar lixeira agora
                </button>
              )}
            </div>
          )}

          {/* NATIVE GOOGLE KEEP "CRIAR UMA NOTA..." QUICK CAPTURE BAR */}
          {activeFolder !== 'trash' && activeFolder !== 'archive' && (
            <div className="max-w-2xl mx-auto mb-7">
              <div
                onClick={(e) => e.stopPropagation()}
                className={`rounded-2xl border shadow-md transition-all ${getKeepCardColorClasses(
                  quickColor
                )}`}
              >
                {!isQuickCaptureExpanded ? (
                  <div className="flex items-center justify-between px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setIsQuickCaptureExpanded(true)}
                      className="flex-1 text-left text-xs font-semibold opacity-70 hover:opacity-100"
                    >
                      Criar uma nota...
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setQuickIsChecklist(true);
                          setIsQuickCaptureExpanded(true);
                        }}
                        className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                        title="Nova lista de seleção"
                      >
                        <CheckSquare size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDrawingTargetNoteId('quick')}
                        className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                        title="Nova nota com desenho à mão livre"
                      >
                        <PenTool size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setImageUploadTargetId('quick');
                          imageInputRef.current?.click();
                        }}
                        className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                        title="Nova nota com imagem"
                      >
                        <ImageIcon size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 space-y-3">
                    {quickImages.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {quickImages.map((imgUrl, idx) => (
                          <div key={idx} className="relative rounded-xl overflow-hidden border border-black/10">
                            <img src={imgUrl} alt="Anexo Keep" className="w-full h-32 object-cover" />
                            <button
                              type="button"
                              onClick={() => setQuickImages((prev) => prev.filter((_, i) => i !== idx))}
                              className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        placeholder="Título"
                        value={quickTitle}
                        onChange={(e) => setQuickTitle(e.target.value)}
                        className="flex-1 bg-transparent text-sm font-extrabold outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setQuickPinned(!quickPinned)}
                        className={`p-1.5 rounded-full ${
                          quickPinned ? 'text-amber-500 bg-amber-500/15' : 'opacity-50 hover:opacity-100'
                        }`}
                        title={quickPinned ? 'Desafixar nota' : 'Fixar nota'}
                      >
                        <Pin size={15} />
                      </button>
                    </div>

                    {quickIsChecklist ? (
                      <div className="space-y-1.5">
                        {quickChecklist.map((item) => (
                          <div key={item.id} className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={item.checked}
                              onChange={() =>
                                setQuickChecklist((prev) =>
                                  prev.map((c) => (c.id === item.id ? { ...c, checked: !c.checked } : c))
                                )
                              }
                            />
                            <span className={item.checked ? 'line-through opacity-50 flex-1' : 'flex-1'}>
                              {item.text}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setQuickChecklist((prev) => prev.filter((c) => c.id !== item.id))
                              }
                            >
                              <X size={12} className="opacity-50 hover:opacity-100" />
                            </button>
                          </div>
                        ))}
                        <div className="flex items-center gap-2 pt-1">
                          <Plus size={14} className="opacity-50" />
                          <input
                            type="text"
                            placeholder="Item da lista (pressione Enter)..."
                            value={quickChecklistDraft}
                            onChange={(e) => setQuickChecklistDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && quickChecklistDraft.trim()) {
                                e.preventDefault();
                                setQuickChecklist((prev) => [
                                  ...prev,
                                  {
                                    id: `qc_${Date.now()}`,
                                    text: quickChecklistDraft.trim(),
                                    checked: false,
                                  },
                                ]);
                                setQuickChecklistDraft('');
                              }
                            }}
                            className="flex-1 bg-transparent text-xs outline-none"
                          />
                        </div>
                      </div>
                    ) : (
                      <textarea
                        rows={2}
                        placeholder="Criar uma nota..."
                        value={quickContent}
                        onChange={(e) => setQuickContent(e.target.value)}
                        className="w-full bg-transparent text-xs outline-none resize-none leading-relaxed"
                      />
                    )}

                    {/* Quick Reminder & Labels Chips */}
                    {(quickReminder || quickLabels.length > 0) && (
                      <div className="flex flex-wrap gap-1.5">
                        {quickReminder && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                            <Clock size={10} /> {quickReminder}
                            <button type="button" onClick={() => setQuickReminder(undefined)}>
                              <X size={10} />
                            </button>
                          </span>
                        )}
                        {quickLabels.map((l) => (
                          <span
                            key={l}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-black/10 dark:bg-white/10"
                          >
                            <Tag size={10} /> {l}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Bottom Toolbar of Quick Capture */}
                    <div className="flex items-center justify-between pt-2 border-t border-black/10 dark:border-white/10 flex-wrap gap-2 relative">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Quick Colors */}
                        <div className="flex items-center gap-1 mr-1">
                          {KEEP_COLORS.slice(0, 8).map((c) => (
                            <button
                              type="button"
                              key={c.id}
                              aria-label={`Cor ${c.label}`}
                              onClick={() => setQuickColor(c.id)}
                              title={c.label}
                              className={`w-4 h-4 rounded-full border ${
                                isDarkMode ? c.darkBg : c.lightBg
                              } ${quickColor === c.id ? 'ring-2 ring-blue-500 scale-110' : ''}`}
                            />
                          ))}
                        </div>

                        <button
                          type="button"
                          aria-label="Definir lembrete rápido"
                          onClick={() =>
                            setQuickReminder(quickReminder ? undefined : 'Hoje, 18:00')
                          }
                          className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                          title="Definir lembrete rápido (Hoje, 18:00)"
                        >
                          <Bell size={14} />
                        </button>
                        <div className="relative">
                          <button
                            type="button"
                            aria-label="Adicionar marcador à nova nota"
                            onClick={() => setShowQuickLabelPicker(!showQuickLabelPicker)}
                            className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                            title="Adicionar marcador"
                          >
                            <Tag size={14} />
                          </button>
                          {showQuickLabelPicker && (
                            <div
                              className={`absolute top-full mt-1.5 left-0 w-44 rounded-2xl p-1.5 shadow-2xl border z-40 text-xs ${
                                isDarkMode ? 'bg-[#20232B] border-white/15 text-white' : 'bg-white border-zinc-200 text-zinc-800'
                              }`}
                            >
                              {keepLabels.map((lbl) => {
                                const selected = quickLabels.includes(lbl);
                                return (
                                  <button
                                    type="button"
                                    key={lbl}
                                    onClick={() =>
                                      setQuickLabels((prev) =>
                                        selected ? prev.filter((l) => l !== lbl) : [...prev, lbl]
                                      )
                                    }
                                    className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-between"
                                  >
                                    <span className="truncate">{lbl}</span>
                                    {selected && <Check size={12} className="text-amber-500 shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          aria-label="Alternar caixas de seleção"
                          onClick={() => setQuickIsChecklist(!quickIsChecklist)}
                          className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                          title="Alternar caixas de seleção"
                        >
                          <CheckSquare size={14} />
                        </button>
                        <button
                          type="button"
                          aria-label="Adicionar desenho à mão livre"
                          onClick={() => setDrawingTargetNoteId('quick')}
                          className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                          title="Adicionar desenho à mão livre"
                        >
                          <PenTool size={14} />
                        </button>
                        <button
                          type="button"
                          aria-label="Adicionar imagem"
                          onClick={() => {
                            setImageUploadTargetId('quick');
                            imageInputRef.current?.click();
                          }}
                          className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                          title="Adicionar imagem"
                        >
                          <ImageIcon size={14} />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          type="button"
                          onClick={() => {
                            setIsQuickCaptureExpanded(false);
                            setShowQuickLabelPicker(false);
                          }}
                          className="px-3 py-1 rounded-lg text-xs opacity-70 hover:opacity-100"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveQuickCapture}
                          className="px-4 py-1.5 rounded-xl bg-amber-500 text-black font-bold text-xs hover:bg-amber-400"
                        >
                          Salvar Nota
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW 1 & 2: CLASSIC GOOGLE KEEP GRID OR LIST VIEW (WITH PINNED & OTHERS SECTIONS) */}
          {viewMode !== 'canvas' ? (
            <div className={viewMode === 'list' ? 'max-w-2xl mx-auto space-y-6 pb-10' : 'space-y-7 pb-10'}>
              {pinnedNotes.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider opacity-50 px-1">
                    Fixadas ({pinnedNotes.length})
                  </h4>
                  <div
                    className={
                      viewMode === 'list'
                        ? 'flex flex-col gap-3.5'
                        : showSidebar
                        ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 items-start'
                        : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start'
                    }
                  >
                    {pinnedNotes.map((note) => renderKeepCard(note))}
                  </div>
                </div>
              )}

              {unpinnedNotes.length > 0 && (
                <div className="space-y-2.5">
                  {pinnedNotes.length > 0 && (
                    <h4 className="text-[11px] font-bold uppercase tracking-wider opacity-50 px-1">
                      Outras ({unpinnedNotes.length})
                    </h4>
                  )}
                  <div
                    className={
                      viewMode === 'list'
                        ? 'flex flex-col gap-3.5'
                        : showSidebar
                        ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 items-start'
                        : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start'
                    }
                  >
                    {unpinnedNotes.map((note) => renderKeepCard(note))}
                  </div>
                </div>
              )}

              {filteredNotes.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 opacity-45">
                  <Lightbulb size={42} className="mb-3" />
                  <p className="text-sm font-semibold">Nenhuma nota encontrada nesta visualização</p>
                </div>
              )}
            </div>
          ) : (
            /* VIEW 3: SPATIAL CANVAS & NODE GRAPH MODE */
            <div className="relative">
              {connectingFromId !== null && (
                <div className="mb-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setConnectingFromId(null)}
                    className="px-4 py-2 rounded-full text-xs font-semibold bg-emerald-500 text-white shadow-md animate-pulse flex items-center gap-1.5"
                  >
                    <GitBranch size={14} />
                    <span>Modo Conexão Ativo — Clique em outra nota ou aqui para cancelar</span>
                  </button>
                </div>
              )}

              {/* SVG Dashed Green Connector Layer */}
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
                <div className="flex flex-col gap-7">
                  {leftColumnNotes.map((note) => renderKeepCard(note))}
                </div>

                <div className="flex flex-col gap-7">
                  {/* 3 KPI Summary Tiles: Total | Completed | Upcoming */}
                  <div className="grid grid-cols-3 gap-3.5">
                    <div
                      className={`rounded-[26px] p-4 flex flex-col items-center justify-center text-center ${
                        isDarkMode
                          ? 'bg-[#0C4A6E]/45 border border-sky-400/20 text-sky-100'
                          : 'bg-[#DCF2FA] text-[#18181B]'
                      }`}
                    >
                      <span className="text-2xl font-extrabold tracking-tight">{totalCount}</span>
                      <span className="text-[11px] font-medium mt-0.5 opacity-75">Total</span>
                    </div>

                    <div
                      className={`relative rounded-[26px] p-4 flex flex-col items-center justify-center text-center ${
                        isDarkMode
                          ? 'bg-[#064E3B]/55 border border-emerald-400/25 text-emerald-100'
                          : 'bg-[#BBF7D0] text-[#18181B]'
                      }`}
                    >
                      <span className="text-2xl font-extrabold tracking-tight">{completedCount}</span>
                      <span className="text-[11px] font-medium mt-0.5 opacity-75">Concluídas</span>
                    </div>

                    <div
                      className={`rounded-[26px] p-4 flex flex-col items-center justify-center text-center border-2 border-dashed ${
                        isDarkMode
                          ? 'border-white/20 bg-white/[0.02] text-white'
                          : 'border-zinc-300 bg-white/50 text-[#18181B]'
                      }`}
                    >
                      <span className="text-2xl font-extrabold tracking-tight">{upcomingCount}</span>
                      <span className="text-[11px] font-medium mt-0.5 opacity-75">Em Fluxo</span>
                    </div>
                  </div>

                  {rightColumnNotes.map((note) => renderKeepCard(note))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. RIGHT SIDEBAR: "MEUS EVENTOS & ATIVIDADES" (100% SYNCED STREAM) */}
        <aside
          className={`hidden 2xl:flex w-[330px] shrink-0 h-full flex-col overflow-hidden border-l ${
            isDarkMode ? 'bg-[#14171D] border-white/[0.07]' : 'bg-[#F6F6F3] border-black/[0.06]'
          }`}
        >
          <div className="px-5 pt-4 pb-3 flex items-center justify-between shrink-0">
            <h2 className="text-base font-extrabold tracking-tight">Eventos & Tasks</h2>
            {onOpenApp && (
              <button
                type="button"
                onClick={() => onOpenApp('calendar')}
                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                title="Abrir Google Agenda"
              >
                <ExternalLink size={15} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-6 space-y-3">
            {allEvents.slice(0, 3).map((ev: CalendarEvent, idx: number) => {
              const isCyan = idx % 2 === 0;
              const linkedNote = notes.find((n) => n.linkedEventId === ev.id);
              const evDate = new Date(ev.start);
              const timeLabel = evDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
              const cardBg = isCyan
                ? isDarkMode
                  ? 'bg-[#0C4A6E]/55 border border-sky-400/25 text-sky-50'
                  : 'bg-[#D6F1FA] text-[#18181B]'
                : isDarkMode
                ? 'bg-[#3B1D5A]/60 border border-purple-400/25 text-purple-50'
                : 'bg-[#EBD5FF] text-[#18181B]';

              return (
                <div
                  key={ev.id}
                  onClick={() => {
                    if (linkedNote) {
                      setHighlightedNoteId(linkedNote.id);
                      setTimeout(() => setHighlightedNoteId(null), 1800);
                    }
                  }}
                  className={`rounded-2xl p-3.5 cursor-pointer transition-all hover:-translate-y-0.5 ${cardBg}`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs truncate">{ev.title}</span>
                    <span className="text-[10px] font-semibold opacity-75">{timeLabel}</span>
                  </div>
                  <p className="text-[11px] opacity-80 line-clamp-2">
                    {ev.description || ev.location || 'Sincronizado com Keep'}
                  </p>
                </div>
              );
            })}

            {allTasks.slice(0, 4).map((task: TaskItem) => (
              <div
                key={task.id}
                onClick={() => handleToggleSidebarTask(task)}
                className={`rounded-2xl p-3.5 cursor-pointer border transition-all ${
                  isDarkMode
                    ? 'bg-white/[0.04] border-white/10 text-white'
                    : 'bg-white border-zinc-200 text-zinc-900'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-bold ${task.completed ? 'line-through opacity-50' : ''}`}>
                    {task.title}
                  </span>
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] shrink-0 ${
                      task.completed ? 'bg-emerald-600' : 'border border-zinc-400'
                    }`}
                  >
                    {task.completed && <Check size={10} strokeWidth={3} />}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* =====================================================================
          FREEHAND DRAWING MODAL (HTML5 CANVAS, SCOPED TO WINDOW)
         ===================================================================== */}
      {drawingTargetNoteId !== null && (
        <div
          className="absolute inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={() => setDrawingTargetNoteId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#181B22] border border-white/15 rounded-2xl w-full max-w-xl max-h-[90%] overflow-y-auto p-4 sm:p-5 shadow-2xl text-white space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <PenTool size={16} className="text-amber-400" />
                <h4 className="text-sm font-bold">Desenho à Mão Livre — Google Keep</h4>
              </div>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setDrawingTargetNoteId(null)}
                className="p-1 rounded-full hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                {['#2563EB', '#EA4335', '#16A34A', '#D97706', '#9333EA', '#18181B'].map((hex) => (
                  <button
                    type="button"
                    key={hex}
                    aria-label={`Cor do pincel ${hex}`}
                    onClick={() => setBrushColor(hex)}
                    style={{ backgroundColor: hex }}
                    className={`w-6 h-6 rounded-full border border-white/30 ${
                      brushColor === hex ? 'ring-2 ring-white scale-110' : ''
                    }`}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setBrushColor('#FFFFFF')}
                  className="px-2 py-1 rounded-lg bg-white/10 text-xs flex items-center gap-1 ml-1"
                  title="Borracha"
                >
                  <Eraser size={12} /> Borracha
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs opacity-60">Traço:</span>
                {[2, 4, 8].map((sz) => (
                  <button
                    type="button"
                    key={sz}
                    onClick={() => setBrushSize(sz)}
                    className={`px-2 py-0.5 rounded text-xs ${
                      brushSize === sz ? 'bg-amber-500 text-black font-bold' : 'bg-white/10'
                    }`}
                  >
                    {sz}px
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearDrawingCanvas}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs"
                >
                  Limpar
                </button>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden border border-white/20 bg-white">
              <canvas
                ref={drawingCanvasRef}
                width={520}
                height={260}
                onPointerDown={startDrawing}
                onPointerMove={drawMove}
                onPointerUp={stopDrawing}
                onPointerLeave={stopDrawing}
                className="w-full h-[240px] sm:h-[260px] cursor-crosshair touch-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDrawingTargetNoteId(null)}
                className="px-4 py-2 rounded-xl text-xs opacity-70 hover:opacity-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveDrawing}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs"
              >
                Salvar Desenho na Nota
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          GOOGLE CHAT THREAD DRAWER (CONNECTED TO NOTE)
         ===================================================================== */}
      {activeChatNote && (
        <div
          className="absolute inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-200"
          onClick={() => setActiveChatNoteId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md h-full flex flex-col shadow-2xl border-l p-5 ${
              isDarkMode ? 'bg-[#16181E] border-white/10 text-white' : 'bg-white border-black/10 text-[#18181B]'
            }`}
          >
            <div className="flex items-center justify-between pb-4 border-b border-black/10 dark:border-white/10">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                  <MessageSquare size={18} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 block">
                    Google Chat Thread · Sincronizada
                  </span>
                  <h3 className="font-bold text-sm truncate">{activeChatNote.title}</h3>
                </div>
              </div>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setActiveChatNoteId(null)}
                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1 my-3">
              {(activeChatNote.chatMessages || []).length === 0 ? (
                <div className="text-center py-10 text-xs opacity-50">
                  Nenhuma mensagem nesta nota ainda. Inicie a conversa abaixo.
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

            <div className="pt-3 border-t border-black/10 dark:border-white/10 flex items-center gap-2">
              <input
                type="text"
                aria-label="Mensagem da thread"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                placeholder="Enviar mensagem na thread do Google Chat..."
                className={`flex-1 min-w-0 px-3.5 py-2.5 rounded-full text-xs outline-none border ${
                  isDarkMode ? 'bg-white/[0.06] border-white/15 text-white' : 'bg-zinc-100 border-zinc-200 text-zinc-900'
                }`}
              />
              <button
                type="button"
                aria-label="Enviar mensagem"
                onClick={handleSendChatMessage}
                className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-500 shrink-0"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          CREATE / EDIT NOTE MODAL
         ===================================================================== */}
      {isModalOpen && (
        <div
          className="absolute inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md max-h-[90%] overflow-y-auto rounded-[28px] p-5 sm:p-6 shadow-2xl border ${
              isDarkMode ? 'bg-[#181A20] border-white/15 text-white' : 'bg-white border-black/10 text-[#18181B]'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold">
                {editingNote ? 'Editar Nota do Google Keep' : 'Nova Nota Conectada'}
              </h3>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                aria-label="Título da nota"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Título da nota..."
                className={`w-full px-4 py-2.5 rounded-2xl text-sm font-bold outline-none border ${
                  isDarkMode ? 'bg-white/[0.05] border-white/10 text-white' : 'bg-zinc-100 border-zinc-200 text-zinc-900'
                }`}
                autoFocus
              />
              <textarea
                rows={4}
                aria-label="Conteúdo da nota"
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Conteúdo da nota..."
                className={`w-full px-4 py-2.5 rounded-2xl text-xs leading-relaxed outline-none border resize-none ${
                  isDarkMode ? 'bg-white/[0.05] border-white/10 text-white' : 'bg-zinc-100 border-zinc-200 text-zinc-900'
                }`}
              />

              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {KEEP_COLORS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    aria-label={`Selecionar cor ${opt.label}`}
                    onClick={() => setFormColor(opt.id)}
                    title={opt.label}
                    className={`w-6 h-6 rounded-full border ${
                      isDarkMode ? opt.darkBg : opt.lightBg
                    } ${formColor === opt.id ? 'ring-2 ring-blue-500 scale-110' : ''}`}
                  />
                ))}
              </div>
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
                className="px-5 py-2 rounded-full text-xs font-bold bg-[#22C55E] text-white hover:bg-emerald-600"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // =======================================================================
  // HELPER: RENDER COMPLETE NATIVE KEEP + ECOSYSTEM CARD
  // =======================================================================
  function renderKeepCard(note: NoteItem) {
    const isCompleted = note.status === 'completed';
    const isConnectingSource = connectingFromId === note.id;
    const isHighlighted = highlightedNoteId === note.id;
    const isPlaying = playingNoteId === note.id;
    const chatCount = note.chatMessages?.length || 0;
    const checklist = note.checklist || [];
    const pendingChecklist = checklist.filter((c) => !c.checked);
    const completedChecklist = checklist.filter((c) => c.checked);
    const inlineDraft = inlineChecklistDraftMap[note.id] || '';

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
        className={`group relative rounded-[24px] p-5 transition-all duration-200 border shadow-xs hover:shadow-md ${getKeepCardColorClasses(
          note.color
        )} ${isConnectingSource ? 'ring-4 ring-emerald-500' : ''} ${
          isHighlighted ? 'ring-4 ring-blue-500 scale-[1.01]' : ''
        }`}
      >
        {/* Attached Images / Freehand Drawings */}
        {note.images && note.images.length > 0 && (
          <div className="mb-3 -mx-2 -mt-2 rounded-2xl overflow-hidden border border-black/10 dark:border-white/10">
            <img
              src={note.images[note.images.length - 1]}
              alt={note.title}
              className="w-full max-h-44 object-cover bg-white"
            />
          </div>
        )}

        {/* Top Row: Title + Pin Button */}
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={(e) => {
              if (connectingFromId !== null || note.trashed) return;
              e.stopPropagation();
              setEditingNote(note);
              setFormTitle(note.title);
              setFormContent(note.content);
              setFormColor(note.color || 'default');
              setIsModalOpen(true);
            }}
            className="text-left flex-1 min-w-0"
          >
            <h3 className="text-base font-extrabold tracking-tight leading-snug break-words hover:underline decoration-black/25 dark:decoration-white/25">
              {note.title}
            </h3>
          </button>
          <div className="flex items-center gap-1 shrink-0">
            {note.badgeType === 'media' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPlayingNoteId(isPlaying ? null : note.id);
                }}
                className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center"
                title="Reproduzir briefing de foco"
              >
                {isPlaying ? <Pause size={13} /> : <Play size={13} />}
              </button>
            )}
            {!note.trashed && (
              <button
                type="button"
                aria-label={note.pinned ? 'Desafixar nota' : 'Fixar nota'}
                onClick={(e) => {
                  e.stopPropagation();
                  handleNoteAction(note.id, note.pinned ? 'unpin' : 'pin');
                }}
                className={`p-1.5 rounded-full transition-colors ${
                  note.pinned
                    ? 'bg-amber-500/20 text-amber-500'
                    : 'opacity-40 group-hover:opacity-80 hover:!opacity-100 hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title={note.pinned ? 'Desafixar nota' : 'Fixar nota no topo'}
              >
                <Pin size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Note Content OR Interactive Checklist */}
        {checklist.length > 0 ? (
          <div className="mt-2.5 space-y-1.5">
            {pendingChecklist.map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() =>
                    handleNoteAction(note.id, 'toggle_checklist_item', { checklistItemId: item.id })
                  }
                  className="rounded accent-amber-500 cursor-pointer"
                />
                <span className="flex-1">{item.text}</span>
                <button
                  type="button"
                  onClick={() =>
                    handleNoteAction(note.id, 'delete_checklist_item', { checklistItemId: item.id })
                  }
                  className="opacity-0 group-hover:opacity-50 hover:!opacity-100"
                >
                  <X size={11} />
                </button>
              </div>
            ))}

            {/* Inline + Add checklist item */}
            {!note.trashed && (
              <div className="flex items-center gap-1.5 pt-1">
                <Plus size={12} className="opacity-50" />
                <input
                  type="text"
                  placeholder="+ Item da lista..."
                  value={inlineDraft}
                  onChange={(e) =>
                    setInlineChecklistDraftMap((prev) => ({ ...prev, [note.id]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && inlineDraft.trim()) {
                      e.preventDefault();
                      handleNoteAction(note.id, 'add_checklist_item', {
                        checklistText: inlineDraft.trim(),
                      });
                      setInlineChecklistDraftMap((prev) => ({ ...prev, [note.id]: '' }));
                    }
                  }}
                  className="flex-1 bg-transparent text-[11px] outline-none placeholder:opacity-50"
                />
              </div>
            )}

            {/* Completed Checklist Section */}
            {completedChecklist.length > 0 && (
              <div className="pt-2 mt-2 border-t border-black/10 dark:border-white/10 space-y-1">
                <span className="text-[10px] font-semibold opacity-60 block">
                  {completedChecklist.length} item(ns) concluído(s)
                </span>
                {completedChecklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 text-xs opacity-60">
                    <input
                      type="checkbox"
                      checked={true}
                      onChange={() =>
                        handleNoteAction(note.id, 'toggle_checklist_item', { checklistItemId: item.id })
                      }
                      className="rounded accent-amber-500 cursor-pointer"
                    />
                    <span className="line-through flex-1">{item.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs leading-relaxed mt-2 opacity-85 whitespace-pre-line">{note.content}</p>
        )}

        {/* Chips: Reminder + Labels + Collaborators */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          {note.reminder && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-200">
              <Clock size={10} />
              <span>{note.reminder}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNoteAction(note.id, 'clear_reminder');
                }}
              >
                <X size={10} />
              </button>
            </span>
          )}

          {(note.labels || []).map((lbl) => (
            <span
              key={lbl}
              onClick={(e) => {
                e.stopPropagation();
                setActiveFolder(`label:${lbl}`);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-black/[0.07] dark:bg-white/10 cursor-pointer hover:opacity-80"
            >
              <span>{lbl}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNoteAction(note.id, 'remove_label', { label: lbl });
                }}
              >
                <X size={9} />
              </button>
            </span>
          ))}

          {note.participants && note.participants.length > 0 && (
            <div className="flex items-center -space-x-1.5 ml-auto">
              {note.participants.map((p, idx) => (
                <img
                  key={idx}
                  src={p.avatar}
                  alt={p.name}
                  title={`Colaborador: ${p.name}`}
                  className="w-6 h-6 rounded-full object-cover ring-2 ring-white dark:ring-zinc-900"
                />
              ))}
            </div>
          )}
        </div>

        {/* Ecosystem Sync Pills (Tasks, Chat, Calendar) */}
        {!note.trashed && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2.5 border-t border-black/[0.06] dark:border-white/[0.08]">
            <button
              type="button"
              onClick={(e) => handleConvertNoteToTask(note, e)}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                note.linkedTaskId
                  ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
                  : 'bg-black/[0.05] dark:bg-white/[0.07] hover:opacity-80'
              }`}
            >
              <CheckSquare size={10} />
              <span>{note.linkedTaskId ? 'No Tasks ✓' : '+ Task'}</span>
            </button>

            <button
              type="button"
              onClick={(e) => handleOpenChatThread(note, e)}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                chatCount > 0
                  ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                  : 'bg-black/[0.05] dark:bg-white/[0.07] hover:opacity-80'
              }`}
            >
              <MessageSquare size={10} />
              <span>Chat ({chatCount})</span>
            </button>

            <button
              type="button"
              onClick={(e) => handleScheduleNoteInCalendar(note, e)}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                note.linkedEventId
                  ? 'bg-purple-500/20 text-purple-800 dark:text-purple-300'
                  : 'bg-black/[0.05] dark:bg-white/[0.07] hover:opacity-80'
              }`}
            >
              <Calendar size={10} />
              <span>{note.linkedEventId ? 'Na Agenda ✓' : '+ Agendar'}</span>
            </button>

            {viewMode === 'canvas' && (
              <button
                type="button"
                onClick={(e) => handleNodeConnectionClick(note.id, e)}
                className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center gap-1"
                title="Conectar nota no Canvas"
              >
                <GitBranch size={10} /> Fluxo
              </button>
            )}
          </div>
        )}

        {/* NATIVE GOOGLE KEEP ACTION TOOLBAR */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2 border-t border-black/[0.06] dark:border-white/[0.08] relative">
          {note.trashed ? (
            <div className="flex items-center gap-2 w-full justify-end">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNoteAction(note.id, 'restore');
                }}
                className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-500 text-xs font-bold flex items-center gap-1"
              >
                <RotateCcw size={12} /> Restaurar
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNoteAction(note.id, 'delete_forever');
                }}
                className="px-3 py-1 rounded-xl bg-rose-500/20 text-rose-500 text-xs font-bold flex items-center gap-1"
              >
                <Trash2 size={12} /> Excluir para sempre
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-0.5">
                {/* 1. Reminder Picker Button */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenReminderNoteId(openReminderNoteId === note.id ? null : note.id);
                    }}
                    className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                    title="Lembrar-me"
                  >
                    <Bell size={13} />
                  </button>
                  {openReminderNoteId === note.id && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute bottom-8 left-0 w-48 rounded-2xl p-1.5 shadow-2xl border z-40 text-xs ${
                        isDarkMode ? 'bg-[#20232B] border-white/15 text-white' : 'bg-white border-zinc-200 text-zinc-800'
                      }`}
                    >
                      <div className="px-2.5 py-1 text-[10px] font-bold uppercase opacity-50">Lembrete Keep</div>
                      {['Hoje, 18:00', 'Amanhã, 09:00', 'Próxima seg., 09:00'].map((rem) => (
                        <button
                          type="button"
                          key={rem}
                          onClick={() => {
                            handleNoteAction(note.id, 'set_reminder', { reminder: rem });
                            setOpenReminderNoteId(null);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
                        >
                          {rem}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Collaborator Picker Button */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenCollabNoteId(openCollabNoteId === note.id ? null : note.id);
                    }}
                    className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                    title="Colaborador"
                  >
                    <UserPlus size={13} />
                  </button>
                  {openCollabNoteId === note.id && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute bottom-8 left-0 w-52 rounded-2xl p-1.5 shadow-2xl border z-40 text-xs ${
                        isDarkMode ? 'bg-[#20232B] border-white/15 text-white' : 'bg-white border-zinc-200 text-zinc-800'
                      }`}
                    >
                      <div className="px-2.5 py-1 text-[10px] font-bold uppercase opacity-50">Colaboradores</div>
                      {collaboratorContacts.length === 0 ? (
                        <div className="px-2.5 py-2 text-[11px] opacity-60">
                          Nenhum contato sincronizado ainda.
                        </div>
                      ) : collaboratorContacts.map((col) => {
                        const hasCol = (note.participants || []).some((p) => p.name === col.name);
                        return (
                          <button
                            type="button"
                            key={col.email}
                            onClick={() => {
                              handleNoteAction(
                                note.id,
                                hasCol ? 'remove_collaborator' : 'add_collaborator',
                                { collaborator: col }
                              );
                              setOpenCollabNoteId(null);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-between"
                          >
                            <span className="truncate">{col.name}</span>
                            {hasCol && <Check size={12} className="text-emerald-500" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. Color Palette Picker Button */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenColorNoteId(openColorNoteId === note.id ? null : note.id);
                    }}
                    className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                    title="Opções de plano de fundo (Cores Keep)"
                  >
                    <Palette size={13} />
                  </button>
                  {openColorNoteId === note.id && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute bottom-8 left-0 p-2 rounded-2xl shadow-2xl border z-40 grid grid-cols-6 gap-1.5 w-44 ${
                        isDarkMode ? 'bg-[#20232B] border-white/15' : 'bg-white border-zinc-200'
                      }`}
                    >
                      {KEEP_COLORS.map((c) => (
                        <button
                          type="button"
                          key={c.id}
                          onClick={() => {
                            handleNoteAction(note.id, 'set_color', { color: c.id });
                            setOpenColorNoteId(null);
                          }}
                          title={c.label}
                          className={`w-5 h-5 rounded-full border ${
                            isDarkMode ? c.darkBg : c.lightBg
                          } ${note.color === c.id ? 'ring-2 ring-blue-500' : ''}`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. Add Image */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImageUploadTargetId(note.id);
                    imageInputRef.current?.click();
                  }}
                  className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                  title="Adicionar imagem"
                >
                  <ImageIcon size={13} />
                </button>

                {/* 5. Add Freehand Drawing */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDrawingTargetNoteId(note.id);
                  }}
                  className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                  title="Adicionar desenho à mão livre"
                >
                  <PenTool size={13} />
                </button>

                {/* 6. Archive / Unarchive */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNoteAction(note.id, note.archived ? 'unarchive' : 'archive');
                  }}
                  className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                  title={note.archived ? 'Desarquivar' : 'Arquivar nota'}
                >
                  <Archive size={13} />
                </button>

                {/* 7. More Menu (...) */}
                <div className="relative">
                  <button
                    type="button"
                    aria-label={`Mais opções para ${note.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuNoteId(openMenuNoteId === note.id ? null : note.id);
                    }}
                    className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                    title="Mais opções do Google Keep"
                  >
                    <MoreHorizontal size={14} />
                  </button>

                  {openMenuNoteId === note.id && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute bottom-8 right-0 sm:left-0 sm:right-auto w-56 rounded-2xl p-1.5 shadow-2xl border z-50 text-xs ${
                        isDarkMode ? 'bg-[#20232B] border-white/15 text-white' : 'bg-white border-zinc-200 text-zinc-800'
                      }`}
                    >
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
                        className="w-full px-3 py-1.5 rounded-xl text-left flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        <Edit3 size={13} /> Editar nota
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleToggleChecklistMode(note, e)}
                        className="w-full px-3 py-1.5 rounded-xl text-left flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        <CheckSquare size={13} />
                        <span>
                          {checklist.length > 0 ? 'Ocultar caixas de seleção' : 'Mostrar caixas de seleção'}
                        </span>
                      </button>

                      {completedChecklist.length > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              handleNoteAction(note.id, 'uncheck_all_checklist');
                              setOpenMenuNoteId(null);
                              toast('Todos os itens foram desmarcados');
                            }}
                            className="w-full px-3 py-1.5 rounded-xl text-left flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/10"
                          >
                            <RotateCcw size={13} /> Desmarcar todos os itens
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleNoteAction(note.id, 'delete_checked_checklist');
                              setOpenMenuNoteId(null);
                              toast('Itens marcados removidos');
                            }}
                            className="w-full px-3 py-1.5 rounded-xl text-left flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/10"
                          >
                            <Trash2 size={13} /> Excluir itens marcados
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setOpenLabelNoteId(openLabelNoteId === note.id ? null : note.id);
                          setOpenMenuNoteId(null);
                        }}
                        className="w-full px-3 py-1.5 rounded-xl text-left flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        <Tag size={13} /> Gerenciar marcadores
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDuplicateNote(note, e)}
                        className="w-full px-3 py-1.5 rounded-xl text-left flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        <Copy size={13} /> Fazer uma cópia
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleCopyNoteToGoogleDocs(note, e)}
                        className="w-full px-3 py-1.5 rounded-xl text-left flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        <FileText size={13} /> Copiar para o Documentos Google
                      </button>

                      {note.images && note.images.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => handleExtractImageTextOCR(note, e)}
                          className="w-full px-3 py-1.5 rounded-xl text-left flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/10"
                        >
                          <ScanText size={13} /> Extrair texto da imagem (OCR)
                        </button>
                      )}

                      <div className="my-1 border-t border-black/10 dark:border-white/10" />

                      <button
                        type="button"
                        onClick={() => {
                          handleNoteAction(note.id, 'trash');
                          setOpenMenuNoteId(null);
                        }}
                        className="w-full px-3 py-1.5 rounded-xl text-left flex items-center gap-2 text-rose-500 hover:bg-rose-500/10"
                      >
                        <Trash2 size={13} /> Excluir nota
                      </button>
                    </div>
                  )}
                </div>

                {/* Label Picker Popover */}
                {openLabelNoteId === note.id && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute bottom-10 right-0 sm:left-8 sm:right-auto w-48 rounded-2xl p-2 shadow-2xl border z-50 text-xs ${
                      isDarkMode ? 'bg-[#20232B] border-white/15 text-white' : 'bg-white border-zinc-200 text-zinc-800'
                    }`}
                  >
                    <div className="px-2 py-1 text-[10px] font-bold uppercase opacity-50">Marcadores da Nota</div>
                    {keepLabels.map((lbl) => {
                      const hasLbl = (note.labels || []).includes(lbl);
                      return (
                        <button
                          type="button"
                          key={lbl}
                          onClick={() =>
                            handleNoteAction(note.id, hasLbl ? 'remove_label' : 'add_label', { label: lbl })
                          }
                          className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-between"
                        >
                          <span>{lbl}</span>
                          {hasLbl && <Check size={12} className="text-amber-500" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Tactile [ × | ✓ ] Completion Switch */}
              <div
                className={`inline-flex items-center rounded-full p-0.5 ${
                  isDarkMode ? 'bg-white/10' : 'bg-black/[0.06]'
                }`}
              >
                <button
                  type="button"
                  onClick={(e) => handleSetNoteCompleted(note, false, e)}
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                    !isCompleted
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-xs'
                      : 'opacity-50 hover:opacity-100'
                  }`}
                  title="Marcar como em andamento"
                >
                  <X size={11} strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleSetNoteCompleted(note, true, e)}
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                    isCompleted
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'opacity-50 hover:opacity-100'
                  }`}
                  title="Concluir nota e tarefa vinculada"
                >
                  <Check size={11} strokeWidth={2.8} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
}