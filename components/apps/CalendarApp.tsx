import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Video,
  MapPin,
  AlignLeft,
  Clock,
  Check,
  X,
  Trash2,
  Edit2,
  Calendar as CalendarIcon,
  Users,
  Globe,
  Download,
  Printer,
  HelpCircle,
  Sparkles,
  FileText,
  Mail,
  Copy,
  CheckCircle2,
  Repeat,
  Bell,
  Headphones,
  Plane,
  CheckSquare,
  ChevronDown,
  ExternalLink,
  Upload,
  Menu,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import {
  AppOpenPayload,
  bridge,
  CalendarEvent,
  CalendarListEntry,
  ContactItem,
  DashboardData,
  EventGuest,
  TaskItem,
  TaskRecurrence,
} from '../../utils/GASBridge';
import { GoogleIcons } from '../GoogleIcons';
import {
  CalendarViewMode,
  CalendarEntryType,
  CalendarRecurrenceRule,
  EnrichedCalendarEvent,
  CALENDAR_EVENT_COLORS,
  isSameDay,
  formatLocalGmtOffset,
  expandEventsForDay,
  arrangeEventsForDay,
  filterCalendarEvents,
  findConflictingEvents,
  suggestAvailableSlots,
  exportEventsToICS,
  parseICSContent,
} from '../../utils/calendarLogic';

interface CalendarAppProps {
  onClose: () => void;
  data: DashboardData;
  onOpenApp?: (type: string, fileData?: AppOpenPayload) => void;
  onUpdateEvents?: (events: CalendarEvent[]) => void;
  onUpdateTasks?: (tasks: TaskItem[]) => void;
  showToast?: (msg: string) => void;
  isDarkMode?: boolean;
}

const WEEKDAY_SHORT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const WORLD_CLOCKS = [
  { city: 'São Paulo', tz: 'America/Sao_Paulo', code: 'BRT (GMT-3)' },
  { city: 'Nova York', tz: 'America/New_York', code: 'EDT (GMT-4)' },
  { city: 'Londres', tz: 'Europe/London', code: 'BST (GMT+1)' },
  { city: 'Tóquio', tz: 'Asia/Tokyo', code: 'JST (GMT+9)' },
];

const ENTRY_TYPE_META: Record<
  CalendarEntryType,
  { label: string; badge: string; defaultColor: string; icon: React.ReactNode }
> = {
  event: {
    label: 'Evento',
    badge: 'Reunião / Evento',
    defaultColor: '#039BE5',
    icon: <CalendarIcon size={14} />,
  },
  focusTime: {
    label: 'Horário de foco',
    badge: 'Deep Work · Silenciar notificações',
    defaultColor: '#8E24AA',
    icon: <Headphones size={14} />,
  },
  outOfOffice: {
    label: 'Ausente do escritório',
    badge: 'Recusa automática de convites',
    defaultColor: '#F4511E',
    icon: <Plane size={14} />,
  },
  task: {
    label: 'Tarefa',
    badge: 'Sincronizada com Google Tarefas',
    defaultColor: '#1A73E8',
    icon: <CheckSquare size={14} />,
  },
};

const RECURRENCE_LABELS: Record<CalendarRecurrenceRule, string> = {
  none: 'Não se repete',
  daily: 'Todos os dias',
  weekdays: 'Dias úteis (Seg–Sex)',
  weekly: 'Semanalmente',
  monthly: 'Mensalmente',
  yearly: 'Anualmente',
};

const VIEW_MODE_OPTIONS: Array<{ id: CalendarViewMode; label: string; shortcut: string }> = [
  { id: 'day', label: 'Dia', shortcut: 'D' },
  { id: 'fourDays', label: '4 dias', shortcut: 'X' },
  { id: 'week', label: 'Semana', shortcut: 'W' },
  { id: 'month', label: 'Mês', shortcut: 'M' },
  { id: 'year', label: 'Ano', shortcut: 'Y' },
  { id: 'schedule', label: 'Programação', shortcut: 'A' },
];

function getBaseEventId(id: string): string {
  if (id.includes('_occ_')) return id.split('_occ_')[0];
  if (id.includes('_span_')) return id.split('_span_')[0];
  return id;
}

export default function CalendarApp({
  onClose,
  data,
  onOpenApp,
  onUpdateEvents,
  onUpdateTasks,
  showToast,
  isDarkMode = true,
}: CalendarAppProps) {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [miniCalMonth, setMiniCalMonth] = useState<Date>(() => new Date());
  const [events, setEvents] = useState<EnrichedCalendarEvent[]>(() => data?.events || []);
  const [tasks, setTasks] = useState<TaskItem[]>(() => data?.tasks || []);
  const [calendars, setCalendars] = useState<CalendarListEntry[]>(
    () =>
      data?.calendars || [
        { id: 'primary', name: data?.user?.name || 'Minha Agenda', color: '#039BE5', checked: true, accessRole: 'owner' },
      ]
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [meetWithQuery, setMeetWithQuery] = useState('');
  const [contactSuggestions, setContactSuggestions] = useState<ContactItem[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EnrichedCalendarEvent | null>(null);
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [showNewCalendarInput, setShowNewCalendarInput] = useState(false);
  const [newCalendarName, setNewCalendarName] = useState('');
  const [newCalendarColor, setNewCalendarColor] = useState('#33B679');
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [undoDeletedEvent, setUndoDeletedEvent] = useState<EnrichedCalendarEvent | null>(null);
  const [nowTick, setNowTick] = useState<Date>(() => new Date());

  // Create / Edit Modal state
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [entryType, setEntryType] = useState<CalendarEntryType>('event');
  const [modalTab, setModalTab] = useState<'details' | 'findTime'>('details');
  const [evTitle, setEvTitle] = useState('');
  const [evDate, setEvDate] = useState('');
  const [evStartTime, setEvStartTime] = useState('09:00');
  const [evEndTime, setEvEndTime] = useState('10:00');
  const [evIsAllDay, setEvIsAllDay] = useState(false);
  const [evRecurrence, setEvRecurrence] = useState<CalendarRecurrenceRule>('none');
  const [evCalendarId, setEvCalendarId] = useState('primary');
  const [evColor, setEvColor] = useState('#039BE5');
  const [evLocation, setEvLocation] = useState('');
  const [evDesc, setEvDesc] = useState('');
  const [evMeetLink, setEvMeetLink] = useState('');
  const [evGuests, setEvGuests] = useState<EventGuest[]>([]);
  const [guestSearch, setGuestSearch] = useState('');
  const [guestResults, setGuestResults] = useState<ContactItem[]>([]);
  const [evAutoDecline, setEvAutoDecline] = useState(true);
  const [evNotificationMins, setEvNotificationMins] = useState(15);
  const [evVisibility, setEvVisibility] = useState<'default' | 'public' | 'private'>('default');
  const [evBusyStatus, setEvBusyStatus] = useState<'busy' | 'free'>('busy');
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null);
  const [workingLocations, setWorkingLocations] = useState<Record<string, 'Escritório' | 'Casa' | 'Remoto'>>(() => {
    try {
      const raw = localStorage.getItem('workspace_working_locations_v1');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const gridScrollRef = useRef<HTMLDivElement>(null);
  const icsFileInputRef = useRef<HTMLInputElement>(null);
  const undoTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (data?.events) setEvents(data.events);
  }, [data?.events]);

  useEffect(() => {
    if (data?.event && data.event.start) {
      const targetDate = new Date(data.event.start);
      setCurrentDate(targetDate);
      setMiniCalMonth(targetDate);
      setSelectedEvent(data.event);
    }
  }, [data?.event]);

  useEffect(() => {
    if (data?.tasks) setTasks(data.tasks);
  }, [data?.tasks]);

  useEffect(() => {
    bridge.getCalendars().then((cals) => {
      if (cals && cals.length > 0) setCalendars(cals);
    });
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowTick(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  // Scroll time grid to 07:30 on mount
  useEffect(() => {
    if (gridScrollRef.current && (viewMode === 'day' || viewMode === 'fourDays' || viewMode === 'week')) {
      gridScrollRef.current.scrollTop = 7.5 * 56;
    }
  }, [viewMode]);

  // Keyboard shortcuts (Google Calendar native keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedEvent(null);
        setShowEventModal(false);
        setShowShortcutsModal(false);
        setShowCreateDropdown(false);
        setShowMobileSidebar(false);
        return;
      }
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setShowShortcutsModal((v) => !v);
      } else if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleToday();
      } else if (e.key.toLowerCase() === 'd' || e.key === '1') {
        e.preventDefault();
        setViewMode('day');
      } else if (e.key.toLowerCase() === 'x' || e.key === '2') {
        e.preventDefault();
        setViewMode('fourDays');
      } else if (e.key.toLowerCase() === 'w' || e.key === '3') {
        e.preventDefault();
        setViewMode('week');
      } else if (e.key.toLowerCase() === 'm' || e.key === '4') {
        e.preventDefault();
        setViewMode('month');
      } else if (e.key.toLowerCase() === 'y' || e.key === '5') {
        e.preventDefault();
        setViewMode('year');
      } else if (e.key.toLowerCase() === 'a' || e.key === '6') {
        e.preventDefault();
        setViewMode('schedule');
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        openCreateModal('event');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentDate]);

  // Contact search for "Reunir-se com..." sidebar
  useEffect(() => {
    if (meetWithQuery.trim().length < 2) {
      setContactSuggestions([]);
      return;
    }
    bridge.searchContacts(meetWithQuery).then(setContactSuggestions);
  }, [meetWithQuery]);

  // Contact search inside modal
  useEffect(() => {
    if (guestSearch.trim().length < 2) {
      setGuestResults([]);
      return;
    }
    bridge.searchContacts(guestSearch).then(setGuestResults);
  }, [guestSearch]);

  const syncEventsEverywhere = async (nextEvents: EnrichedCalendarEvent[]) => {
    setEvents(nextEvents);
    onUpdateEvents?.(nextEvents);
    await bridge.saveAllEvents(nextEvents);
  };

  const visibleCalendarIds = useMemo(() => {
    const set = new Set<string>();
    calendars.forEach((c) => {
      if (c.checked) set.add(c.id);
    });
    return set;
  }, [calendars]);

  const includeTasksInCalendar = visibleCalendarIds.has('tasks');

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setMiniCalMonth(now);
  };

  const handleNavigate = (dir: -1 | 1) => {
    const next = new Date(currentDate);
    if (viewMode === 'day') next.setDate(next.getDate() + dir);
    else if (viewMode === 'fourDays') next.setDate(next.getDate() + dir * 4);
    else if (viewMode === 'week' || viewMode === 'schedule') next.setDate(next.getDate() + dir * 7);
    else if (viewMode === 'month') next.setMonth(next.getMonth() + dir);
    else if (viewMode === 'year') next.setFullYear(next.getFullYear() + dir);
    setCurrentDate(next);
    setMiniCalMonth(next);
  };

  const toggleCalendarCheck = async (calId: string) => {
    const next = calendars.map((c) => (c.id === calId ? { ...c, checked: !c.checked } : c));
    setCalendars(next);
    await bridge.saveCalendars(next);
  };

  const handleCreateNewCalendar = async () => {
    const name = newCalendarName.trim();
    if (!name) return;
    const newCal: CalendarListEntry = {
      id: `cal_${Date.now()}`,
      name,
      color: newCalendarColor,
      checked: true,
      accessRole: 'owner',
    };
    const next = [...calendars, newCal];
    setCalendars(next);
    await bridge.saveCalendars(next);
    setNewCalendarName('');
    setShowNewCalendarInput(false);
    showToast?.(`Agenda "${name}" criada.`);
  };

  const handleDeleteCalendar = async (calId: string) => {
    const target = calendars.find((c) => c.id === calId);
    if (!target || target.accessRole !== 'owner' || calId === 'primary' || calId === 'tasks') return;
    const nextCals = calendars.filter((c) => c.id !== calId);
    setCalendars(nextCals);
    await bridge.saveCalendars(nextCals);
    if (events.some((ev) => ev.calendarId === calId)) {
      const reassigned = events.map((ev) => (ev.calendarId === calId ? { ...ev, calendarId: 'primary' } : ev));
      await syncEventsEverywhere(reassigned);
    }
    showToast?.(`Agenda "${target.name}" removida.`);
  };

  // Columns for Day / 4-Day / Week views
  const activeColumns = useMemo(() => {
    const cols: Date[] = [];
    if (viewMode === 'day') {
      const d = new Date(currentDate);
      d.setHours(0, 0, 0, 0);
      cols.push(d);
    } else if (viewMode === 'fourDays') {
      for (let i = 0; i < 4; i++) {
        const d = new Date(currentDate);
        d.setDate(currentDate.getDate() + i);
        d.setHours(0, 0, 0, 0);
        cols.push(d);
      }
    } else {
      const start = new Date(currentDate);
      start.setDate(currentDate.getDate() - currentDate.getDay());
      start.setHours(0, 0, 0, 0);
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        cols.push(d);
      }
    }
    return cols;
  }, [currentDate, viewMode]);

  const formatToInputDate = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const openCreateModal = (
    type: CalendarEntryType = 'event',
    dateObj?: Date,
    hour?: number,
    prefillGuest?: ContactItem
  ) => {
    const baseDate = dateObj ? new Date(dateObj) : new Date(currentDate);
    const startH = typeof hour === 'number' ? hour : 9;
    const endH = Math.min(23, startH + 1);

    setEditingId(null);
    setEntryType(type);
    setModalTab('details');
    setEvTitle(
      type === 'focusTime'
        ? 'Bloco de Foco (Deep Work)'
        : type === 'outOfOffice'
        ? 'Ausente do escritório'
        : ''
    );
    setEvDate(formatToInputDate(baseDate));
    setEvStartTime(`${String(startH).padStart(2, '0')}:00`);
    setEvEndTime(`${String(endH).padStart(2, '0')}:00`);
    setEvIsAllDay(type === 'outOfOffice');
    setEvRecurrence('none');
    setEvCalendarId(type === 'focusTime' ? 'focus' : type === 'task' ? 'tasks' : 'primary');
    setEvColor(ENTRY_TYPE_META[type].defaultColor);
    setEvLocation('');
    setEvDesc(
      type === 'focusTime'
        ? 'Horário reservado para concentração profunda. Notificações silenciadas.'
        : type === 'outOfOffice'
        ? 'Estarei ausente do escritório neste período. Convites serão recusados automaticamente.'
        : ''
    );
    setEvMeetLink('');
    setEvGuests(
      prefillGuest
        ? [{ name: prefillGuest.name, email: prefillGuest.email, avatar: prefillGuest.avatar, responseStatus: 'needsAction' }]
        : []
    );
    setEvAutoDecline(true);
    setEvNotificationMins(15);
    setEvVisibility('default');
    setEvBusyStatus('busy');
    setShowCreateDropdown(false);
    setShowEventModal(true);
  };

  const openEditModal = (ev: EnrichedCalendarEvent) => {
    const baseId = getBaseEventId(ev.id);
    const sourceEv = events.find((e) => e.id === baseId) || ev;
    const s = new Date(sourceEv.start);
    const e = new Date(sourceEv.end);

    setEditingId(sourceEv.id);
    setEntryType(sourceEv.entryType || 'event');
    setModalTab('details');
    setEvTitle(sourceEv.title);
    setEvDate(formatToInputDate(s));
    setEvStartTime(
      `${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`
    );
    setEvEndTime(
      `${String(e.getHours()).padStart(2, '0')}:${String(e.getMinutes()).padStart(2, '0')}`
    );
    setEvIsAllDay(Boolean(sourceEv.isAllDay));
    setEvRecurrence(sourceEv.recurrenceRule || 'none');
    setEvCalendarId(sourceEv.calendarId || 'primary');
    setEvColor(sourceEv.color || '#039BE5');
    setEvLocation(sourceEv.location || '');
    setEvDesc(sourceEv.description || '');
    setEvMeetLink(sourceEv.meetLink || '');
    setEvGuests(sourceEv.guests || []);
    setEvAutoDecline(sourceEv.autoDeclineMeetings ?? true);
    setEvNotificationMins(sourceEv.notificationMinutes ?? 15);
    setEvVisibility(sourceEv.visibility || 'default');
    setEvBusyStatus(sourceEv.busyStatus || 'busy');
    setSelectedEvent(null);
    setShowEventModal(true);
  };

  const handleSaveEvent = async () => {
    const title = evTitle.trim() || ENTRY_TYPE_META[entryType].label;
    const [yyyy, mm, dd] = evDate.split('-').map(Number);
    const [sh, sm] = evStartTime.split(':').map(Number);
    const [eh, em] = evEndTime.split(':').map(Number);

    const startDate = new Date(yyyy, (mm || 1) - 1, dd || 1, evIsAllDay ? 0 : sh || 9, evIsAllDay ? 0 : sm || 0);
    const endDate = new Date(yyyy, (mm || 1) - 1, dd || 1, evIsAllDay ? 23 : eh || 10, evIsAllDay ? 59 : em || 0);
    if (endDate <= startDate) {
      endDate.setTime(startDate.getTime() + 45 * 60000);
    }

    // If user chose entryType === 'task' and is creating a new task, sync real ID via GASBridge!
    if (entryType === 'task' && !editingId) {
      await bridge.createTask(title, evDesc, 'default', startDate.toISOString(), undefined, {
        time: evIsAllDay ? undefined : evStartTime,
        recurrence: evRecurrence === 'weekdays' ? 'daily' : (evRecurrence as TaskRecurrence),
      });
      const freshTasks = await bridge.getTasks('all');
      setTasks(freshTasks);
      onUpdateTasks?.(freshTasks);
      setShowEventModal(false);
      showToast?.('Tarefa criada e sincronizada com o Google Tarefas.');
      return;
    }

    const payload: EnrichedCalendarEvent = {
      id: editingId || `ev_${Date.now()}`,
      title,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      isAllDay: evIsAllDay,
      calendarId: evCalendarId,
      color: evColor,
      location: evLocation,
      description: evDesc,
      meetLink: evMeetLink || undefined,
      guests: evGuests,
      entryType,
      recurrenceRule: evRecurrence,
      autoDeclineMeetings: entryType === 'focusTime' || entryType === 'outOfOffice' ? evAutoDecline : undefined,
      notificationMinutes: evNotificationMins,
      visibility: evVisibility,
      busyStatus: evBusyStatus,
    };

    let nextEvents: EnrichedCalendarEvent[];
    if (editingId) {
      nextEvents = events.map((e) => (e.id === editingId ? payload : e));
      await bridge.updateCalendarEvent(payload);
      showToast?.('Evento atualizado na agenda.');
    } else {
      nextEvents = [payload, ...events];
      await bridge.createCalendarEvent(payload);
      showToast?.('Evento criado e sincronizado com a Home.');
    }

    await syncEventsEverywhere(nextEvents);
    setShowEventModal(false);
  };

  const handleDeleteEvent = async (ev: EnrichedCalendarEvent) => {
    if (ev.entryType === 'task' && ev.linkedTaskId) {
      const nextTasks = tasks.filter((t) => t.id !== ev.linkedTaskId);
      setTasks(nextTasks);
      onUpdateTasks?.(nextTasks);
      await bridge.deleteTask(ev.linkedTaskId);
      setSelectedEvent(null);
      showToast?.('Tarefa removida da agenda e do Google Tarefas.');
      return;
    }

    const baseId = getBaseEventId(ev.id);
    const sourceEv = events.find((e) => e.id === baseId) || ev;
    const nextEvents = events.filter((e) => e.id !== ev.id && e.id !== baseId);
    await bridge.deleteCalendarEvent(baseId, ev.calendarId);
    await syncEventsEverywhere(nextEvents);
    setSelectedEvent(null);

    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    setUndoDeletedEvent(sourceEv);
    undoTimerRef.current = window.setTimeout(() => {
      setUndoDeletedEvent(null);
    }, 6000);
    showToast?.('Evento excluído.');
  };

  const handleUndoDeleteEvent = async () => {
    if (!undoDeletedEvent) return;
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    const toRestore = undoDeletedEvent;
    setUndoDeletedEvent(null);
    await bridge.createCalendarEvent(toRestore);
    await syncEventsEverywhere([toRestore, ...events.filter((e) => e.id !== toRestore.id)]);
    showToast?.('Evento restaurado na agenda.');
  };

  const handleToggleCalendarTaskComplete = async (ev: EnrichedCalendarEvent) => {
    if (!ev.linkedTaskId) return;
    const nextTasks = tasks.map((t) =>
      t.id === ev.linkedTaskId ? { ...t, completed: !t.completed } : t
    );
    setTasks(nextTasks);
    onUpdateTasks?.(nextTasks);
    await bridge.toggleTask(ev.linkedTaskId);
    setSelectedEvent(null);
    showToast?.('Status da tarefa atualizado.');
  };

  const handleDuplicateEvent = async (ev: EnrichedCalendarEvent) => {
    const baseId = getBaseEventId(ev.id);
    const sourceEv = events.find((e) => e.id === baseId) || ev;
    const copy: EnrichedCalendarEvent = {
      ...sourceEv,
      id: `ev_${Date.now()}`,
      title: `${sourceEv.title} (Cópia)`,
    };
    const nextEvents = [copy, ...events];
    await bridge.createCalendarEvent(copy);
    await syncEventsEverywhere(nextEvents);
    setSelectedEvent(copy);
    showToast?.('Evento duplicado.');
  };

  const handleQuickReschedule = async (ev: EnrichedCalendarEvent, mode: 'plus30m' | 'tomorrow') => {
    const baseId = getBaseEventId(ev.id);
    const s = new Date(ev.start);
    const e = new Date(ev.end);
    const delta = mode === 'plus30m' ? 30 * 60000 : 86400000;
    const updatedStart = new Date(s.getTime() + delta).toISOString();
    const updatedEnd = new Date(e.getTime() + delta).toISOString();

    const nextEvents = events.map((item) =>
      item.id === baseId ? { ...item, start: updatedStart, end: updatedEnd } : item
    );
    await bridge.updateCalendarEvent({ id: baseId, start: updatedStart, end: updatedEnd });
    await syncEventsEverywhere(nextEvents);
    setSelectedEvent((prev) => (prev ? { ...prev, start: updatedStart, end: updatedEnd } : null));
    showToast?.(mode === 'plus30m' ? 'Adiado em +30 min.' : 'Reagendado para amanhã.');
  };

  const handleRSVP = async (ev: EnrichedCalendarEvent, status: 'accepted' | 'declined' | 'tentative') => {
    const baseId = getBaseEventId(ev.id);
    const selfEmail = data?.user?.email || '';
    const selfName = data?.user?.name || 'Você';
    await bridge.rsvpEvent(baseId, status);
    const updatedEvents = events.map((item) => {
      if (item.id !== baseId) return item;
      const existingGuests = item.guests || [];
      const hasSelf = selfEmail
        ? existingGuests.some((g) => g.email === selfEmail)
        : existingGuests.some((g) => g.name === selfName);
      const guests = hasSelf
        ? existingGuests.map((g) =>
            (selfEmail ? g.email === selfEmail : g.name === selfName) ? { ...g, responseStatus: status } : g
          )
        : [{ name: selfName, email: selfEmail, responseStatus: status }, ...existingGuests];
      return { ...item, guests };
    });
    await syncEventsEverywhere(updatedEvents);
    const updatedTarget = updatedEvents.find((item) => item.id === baseId);
    if (updatedTarget) setSelectedEvent(updatedTarget);
    const statusLabel = status === 'accepted' ? 'Sim' : status === 'declined' ? 'Não' : 'Talvez';
    showToast?.(`Confirmação de presença atualizada: ${statusLabel}`);
  };

  const handleCreateMeetingNotesDoc = async (ev: EnrichedCalendarEvent) => {
    const dateStr = new Date(ev.start).toLocaleDateString('pt-BR');
    const selfName = data?.user?.name || 'Você';
    const attendees = (ev.guests || []).map((g) => `<li>${g.name || g.email} (${g.email})</li>`).join('');
    const htmlContent = `<h1>Ata de Reunião: ${ev.title}</h1><p><strong>Data:</strong> ${dateStr}</p><p><strong>Local / Meet:</strong> ${ev.meetLink || ev.location || 'Google Meet'}</p><h2>Participantes</h2><ul>${attendees || `<li>${selfName}</li>`}</ul><h2>Pauta & Discussão</h2><p>${ev.description || 'Pontos discutidos na reunião...'}</p><h2>Próximos Passos (Action Items)</h2><ul><li>[ ] Definir próximos passos</li></ul>`;
    const created = await bridge.createDriveDocument('doc', `Ata - ${ev.title}`);
    await bridge.saveFileContent(created.id, htmlContent);
    showToast?.('Ata de reunião criada no Google Docs e salva no Drive!');
    onOpenApp?.('doc', {
      id: created.id,
      name: created.name,
      content: htmlContent,
    });
  };

  const handleExportICS = () => {
    const icsContent = exportEventsToICS(events);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'google-calendar-workspace-os.ics';
    a.click();
    URL.revokeObjectURL(url);
    showToast?.('Arquivo .ics exportado com sucesso.');
  };

  const handleImportICSFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const text = String(reader.result || '');
      const imported = parseICSContent(text);
      if (imported.length === 0) {
        showToast?.('Nenhum evento válido encontrado no arquivo .ics.');
        return;
      }
      const next = [...imported, ...events];
      await syncEventsEverywhere(next);
      showToast?.(`${imported.length} evento(s) importado(s) do arquivo .ics!`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDropEventOnSlot = async (targetDate: Date, targetHour?: number) => {
    if (!draggedEventId) return;
    const baseId = getBaseEventId(draggedEventId);
    const sourceEv = events.find((ev) => ev.id === baseId);
    setDraggedEventId(null);
    if (!sourceEv) return;

    const oldStart = new Date(sourceEv.start);
    const oldEnd = new Date(sourceEv.end);
    const durationMs = Math.max(30 * 60000, oldEnd.getTime() - oldStart.getTime());

    const newStart = new Date(targetDate);
    newStart.setHours(
      typeof targetHour === 'number' ? targetHour : oldStart.getHours(),
      typeof targetHour === 'number' ? 0 : oldStart.getMinutes(),
      0,
      0
    );
    const newEnd = new Date(newStart.getTime() + durationMs);

    const updatedStart = newStart.toISOString();
    const updatedEnd = newEnd.toISOString();
    const nextEvents = events.map((ev) =>
      ev.id === baseId ? { ...ev, start: updatedStart, end: updatedEnd } : ev
    );
    await bridge.updateCalendarEvent({ id: baseId, start: updatedStart, end: updatedEnd });
    await syncEventsEverywhere(nextEvents);
    showToast?.(`"${sourceEv.title}" reagendado para ${newStart.toLocaleDateString('pt-BR')} às ${String(newStart.getHours()).padStart(2, '0')}:${String(newStart.getMinutes()).padStart(2, '0')}.`);
  };

  const cycleWorkingLocation = (dateObj: Date) => {
    const key = formatToInputDate(dateObj);
    const order: Array<'Escritório' | 'Casa' | 'Remoto'> = ['Escritório', 'Casa', 'Remoto'];
    const curr = workingLocations[key] || 'Escritório';
    const nextLoc = order[(order.indexOf(curr) + 1) % order.length];
    const updated = { ...workingLocations, [key]: nextLoc };
    setWorkingLocations(updated);
    try {
      localStorage.setItem('workspace_working_locations_v1', JSON.stringify(updated));
    } catch {
      /* ignore */
    }
    showToast?.(`Local de trabalho (${dateObj.toLocaleDateString('pt-BR')}): ${nextLoc}`);
  };

  const modalDurationMins = useMemo(() => {
    if (evIsAllDay) return 60;
    const [sh, sm] = evStartTime.split(':').map(Number);
    const [eh, em] = evEndTime.split(':').map(Number);
    const diff = (eh || 10) * 60 + (em || 0) - ((sh || 9) * 60 + (sm || 0));
    return diff >= 15 ? diff : 45;
  }, [evStartTime, evEndTime, evIsAllDay]);

  const modalConflicts = useMemo(() => {
    if (!showEventModal || entryType === 'task' || !evDate) return [];
    const [yyyy, mm, dd] = evDate.split('-').map(Number);
    if (!yyyy || !mm || !dd) return [];
    const [sh, sm] = evStartTime.split(':').map(Number);
    const [eh, em] = evEndTime.split(':').map(Number);
    const startDate = new Date(yyyy, mm - 1, dd, evIsAllDay ? 0 : sh || 9, evIsAllDay ? 0 : sm || 0);
    const endDate = new Date(yyyy, mm - 1, dd, evIsAllDay ? 23 : eh || 10, evIsAllDay ? 59 : em || 0);
    if (endDate <= startDate) endDate.setTime(startDate.getTime() + 45 * 60000);
    return findConflictingEvents(events, startDate, endDate, editingId);
  }, [showEventModal, entryType, evDate, evStartTime, evEndTime, evIsAllDay, events, editingId]);

  // Suggested slots for "Encontrar um horário" tab
  const availableSlotsForModalDate = useMemo(() => {
    if (!evDate) return [];
    const [yyyy, mm, dd] = evDate.split('-').map(Number);
    const targetDay = new Date(yyyy || 2026, (mm || 1) - 1, dd || 1);
    return suggestAvailableSlots(events, targetDay, modalDurationMins);
  }, [events, evDate, modalDurationMins]);

  const localGmtLabel = useMemo(() => formatLocalGmtOffset(), []);

  // Precompute active event days for Year view honoring filters, recurrence & multi-day spans
  const yearEventDayKeys = useMemo(() => {
    const keys = new Set<string>();
    if (viewMode !== 'year') return keys;
    const year = currentDate.getFullYear();
    for (let m = 0; m < 12; m++) {
      const daysInM = new Date(year, m + 1, 0).getDate();
      for (let d = 1; d <= daysInM; d++) {
        const dObj = new Date(year, m, d);
        const matched = filterCalendarEvents(
          expandEventsForDay(events, dObj, tasks, includeTasksInCalendar),
          { visibleCalendarIds, searchQuery }
        );
        if (matched.length > 0) {
          keys.add(`${m}-${d}`);
        }
      }
    }
    return keys;
  }, [viewMode, currentDate, events, tasks, includeTasksInCalendar, visibleCalendarIds, searchQuery]);

  // Mini Calendar days
  const miniCalendarDays = useMemo(() => {
    const year = miniCalMonth.getFullYear();
    const month = miniCalMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ date: Date; inMonth: boolean }> = [];

    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push({ date: new Date(year, month - 1, prevMonthDays - i), inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(year, month, d), inMonth: true });
    }
    while (cells.length < 42) {
      const nextDay = cells.length - (firstDay + daysInMonth) + 1;
      cells.push({ date: new Date(year, month + 1, nextDay), inMonth: false });
    }
    return cells;
  }, [miniCalMonth]);

  // Month View 42-day grid
  const monthGridDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ date: Date; inMonth: boolean }> = [];

    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push({ date: new Date(year, month - 1, prevMonthDays - i), inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(year, month, d), inMonth: true });
    }
    while (cells.length < 42) {
      const nextDay = cells.length - (firstDay + daysInMonth) + 1;
      cells.push({ date: new Date(year, month + 1, nextDay), inMonth: false });
    }
    return cells;
  }, [currentDate]);

  // Schedule / Agenda View upcoming 21 days
  const scheduleDays = useMemo(() => {
    const list: Array<{ date: Date; items: EnrichedCalendarEvent[] }> = [];
    const base = new Date(currentDate);
    base.setHours(0, 0, 0, 0);

    for (let i = -1; i < 21; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const dayItems = filterCalendarEvents(
        expandEventsForDay(events, d, tasks, includeTasksInCalendar),
        { visibleCalendarIds, searchQuery }
      ).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

      if (dayItems.length > 0 || isSameDay(d, new Date())) {
        list.push({ date: d, items: dayItems });
      }
    }
    return list;
  }, [currentDate, events, tasks, includeTasksInCalendar, visibleCalendarIds, searchQuery]);

  // Theme tokens
  const bgMain = isDarkMode ? 'bg-[#14161A]/95 text-[#E8EAED]' : 'bg-white/95 text-[#202124]';
  const bgSidebar = isDarkMode ? 'bg-[#1A1D24]/90 border-white/10' : 'bg-[#F8FAFD] border-black/10';
  const borderSubtle = isDarkMode ? 'border-white/10' : 'border-black/10';
  const textMuted = isDarkMode ? 'text-[#9AA0A6]' : 'text-[#5F6368]';
  const hoverItem = isDarkMode ? 'hover:bg-white/5' : 'hover:bg-black/5';
  const cardSurface = isDarkMode ? 'bg-[#20232B] border-white/15' : 'bg-white border-black/15';

  const headerTitle = useMemo(() => {
    if (viewMode === 'year') return `${currentDate.getFullYear()}`;
    return `${MONTH_NAMES[currentDate.getMonth()]} de ${currentDate.getFullYear()}`;
  }, [currentDate, viewMode]);

  const renderSidebarContent = (isMobileDrawer = false) => (
    <>
      <div className="space-y-5">
        {/* + Criar button with dropdown for Event / Focus Time / Out of Office / Task */}
        <div className="relative">
          <div className="flex items-center">
            <button
              data-testid={isMobileDrawer ? 'calendar-mobile-drawer-create-btn' : 'calendar-create-btn'}
              onClick={() => {
                if (isMobileDrawer) setShowMobileSidebar(false);
                openCreateModal('event');
              }}
              className="flex-1 flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-l-2xl bg-[#1A73E8] hover:bg-[#1557B0] text-white font-medium text-sm shadow-md transition-all"
            >
              <Plus size={18} />
              <span>Criar</span>
            </button>
            <button
              data-testid={isMobileDrawer ? 'calendar-mobile-drawer-create-menu-btn' : 'calendar-create-menu-btn'}
              onClick={() => setShowCreateDropdown((v) => !v)}
              className="py-2.5 px-2.5 rounded-r-2xl bg-[#1765CC] hover:bg-[#1557B0] text-white border-l border-white/20 shadow-md transition-all"
              title="Escolher tipo de registro"
            >
              <ChevronDown size={18} />
            </button>
          </div>

          {showCreateDropdown && (
            <div
              className={`absolute left-0 right-0 mt-2 rounded-2xl border ${cardSurface} shadow-2xl p-1.5 z-40 space-y-1`}
            >
              {(Object.keys(ENTRY_TYPE_META) as CalendarEntryType[]).map((tKey) => {
                const meta = ENTRY_TYPE_META[tKey];
                return (
                  <button
                    key={tKey}
                    data-testid={isMobileDrawer ? `mobile-create-option-${tKey}` : `create-option-${tKey}`}
                    onClick={() => {
                      if (isMobileDrawer) setShowMobileSidebar(false);
                      openCreateModal(tKey);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs ${hoverItem} transition-colors`}
                  >
                    <span
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: meta.defaultColor }}
                    >
                      {meta.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{meta.label}</div>
                      <div className={`text-[10px] ${textMuted} truncate`}>{meta.badge}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Interactive Mini Calendar */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-semibold">
              {MONTH_NAMES[miniCalMonth.getMonth()]} {miniCalMonth.getFullYear()}
            </span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() =>
                  setMiniCalMonth(new Date(miniCalMonth.getFullYear(), miniCalMonth.getMonth() - 1, 1))
                }
                className={`p-1.5 rounded ${hoverItem}`}
                aria-label="Mês anterior"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() =>
                  setMiniCalMonth(new Date(miniCalMonth.getFullYear(), miniCalMonth.getMonth() + 1, 1))
                }
                className={`p-1.5 rounded ${hoverItem}`}
                aria-label="Próximo mês"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 text-center text-[10px] font-semibold opacity-60 mb-1">
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {miniCalendarDays.map((cell, idx) => {
              const isToday = isSameDay(cell.date, new Date());
              const isSelected = isSameDay(cell.date, currentDate);
              return (
                <button
                  key={idx}
                  onClick={() => {
                    setCurrentDate(new Date(cell.date));
                    if (isMobileDrawer) setShowMobileSidebar(false);
                  }}
                  className={`h-7 w-7 mx-auto rounded-full text-[11px] flex items-center justify-center transition-colors ${
                    isToday
                      ? 'bg-[#1A73E8] text-white font-bold'
                      : isSelected
                      ? 'bg-blue-500/25 text-blue-400 font-semibold'
                      : cell.inMonth
                      ? hoverItem
                      : 'opacity-30'
                  }`}
                >
                  {cell.date.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Reunir-se com... (Meet with people) */}
        <div className="space-y-1.5">
          <label className={`text-[11px] font-semibold uppercase tracking-wider ${textMuted}`}>
            Reunir-se com...
          </label>
          <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border ${borderSubtle}`}>
            <Users size={13} className={textMuted} />
            <input
              type="text"
              value={meetWithQuery}
              onChange={(e) => setMeetWithQuery(e.target.value)}
              placeholder="Pesquisar pessoas..."
              className="bg-transparent text-xs outline-none w-full"
            />
          </div>
          {contactSuggestions.length > 0 && (
            <div className={`rounded-xl border ${cardSurface} p-1 space-y-0.5 shadow-lg`}>
              {contactSuggestions.map((c) => (
                <button
                  key={c.email}
                  onClick={() => {
                    setMeetWithQuery('');
                    setContactSuggestions([]);
                    if (isMobileDrawer) setShowMobileSidebar(false);
                    openCreateModal('event', currentDate, 10, c);
                  }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs ${hoverItem}`}
                >
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {c.name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className={`text-[10px] ${textMuted} truncate`}>{c.email}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Minhas Agendas */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${textMuted}`}>
              Minhas agendas
            </span>
            <button
              data-testid={isMobileDrawer ? 'mobile-add-calendar-btn' : 'add-calendar-btn'}
              onClick={() => setShowNewCalendarInput((v) => !v)}
              className={`p-1.5 rounded ${hoverItem}`}
              title="Adicionar nova agenda"
            >
              <Plus size={13} />
            </button>
          </div>

          {showNewCalendarInput && (
            <div className={`p-2 rounded-xl border ${borderSubtle} space-y-2`}>
              <input
                data-testid={isMobileDrawer ? 'mobile-new-calendar-name-input' : 'new-calendar-name-input'}
                type="text"
                value={newCalendarName}
                onChange={(e) => setNewCalendarName(e.target.value)}
                placeholder="Nome da agenda..."
                className={`w-full px-2 py-1.5 rounded text-xs border ${borderSubtle} bg-transparent outline-none`}
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {['#039BE5', '#33B679', '#8E24AA', '#F4511E', '#F6BF26'].map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setNewCalendarColor(hex)}
                      className={`w-5 h-5 rounded-full ${
                        newCalendarColor === hex ? 'ring-2 ring-white scale-110' : ''
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
                <button
                  data-testid={isMobileDrawer ? 'mobile-save-new-calendar-btn' : 'save-new-calendar-btn'}
                  onClick={handleCreateNewCalendar}
                  className="px-2.5 py-1 rounded-lg bg-[#1A73E8] text-white text-[11px] font-medium"
                >
                  Criar
                </button>
              </div>
            </div>
          )}

          <div className="space-y-1">
            {calendars.map((cal) => {
              const canDelete = cal.accessRole === 'owner' && !['primary', 'tasks'].includes(cal.id);
              return (
                <div
                  key={cal.id}
                  className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs ${hoverItem}`}
                >
                  <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cal.checked}
                      onChange={() => toggleCalendarCheck(cal.id)}
                      className="sr-only"
                    />
                    <span
                      className="w-4 h-4 rounded flex items-center justify-center border transition-all shrink-0"
                      style={{
                        backgroundColor: cal.checked ? cal.color : 'transparent',
                        borderColor: cal.color,
                      }}
                    >
                      {cal.checked && <Check size={11} className="text-white stroke-[3]" />}
                    </span>
                    <span className="truncate flex-1">{cal.name}</span>
                  </label>
                  {canDelete && (
                    <button
                      type="button"
                      data-testid={`delete-calendar-${cal.id}`}
                      onClick={() => handleDeleteCalendar(cal.id)}
                      title={`Remover agenda ${cal.name}`}
                      className="p-1 rounded opacity-70 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 hover:bg-red-500/20 hover:text-red-400 transition-all shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* World Clock Widget + Mobile ICS actions */}
      <div className={`mt-6 pt-4 border-t ${borderSubtle} space-y-3`}>
        {isMobileDrawer && (
          <div className="flex items-center gap-2 pb-2 border-b border-white/10">
            <button
              type="button"
              onClick={() => {
                setShowMobileSidebar(false);
                icsFileInputRef.current?.click();
              }}
              className={`flex-1 py-1.5 px-2 rounded-lg border ${borderSubtle} ${hoverItem} text-xs flex items-center justify-center gap-1.5`}
            >
              <Upload size={13} /> Importar .ics
            </button>
            <button
              type="button"
              onClick={() => {
                setShowMobileSidebar(false);
                handleExportICS();
              }}
              className={`flex-1 py-1.5 px-2 rounded-lg border ${borderSubtle} ${hoverItem} text-xs flex items-center justify-center gap-1.5`}
            >
              <Download size={13} /> Exportar .ics
            </button>
          </div>
        )}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Globe size={13} className={textMuted} />
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${textMuted}`}>
              Relógio mundial
            </span>
          </div>
          <div className="space-y-1.5">
            {WORLD_CLOCKS.map((wc) => {
              let formatted = '';
              try {
                formatted = new Intl.DateTimeFormat('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: wc.tz,
                }).format(nowTick);
              } catch {
                formatted = nowTick.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
              }
              return (
                <div key={wc.city} className="flex items-center justify-between text-xs">
                  <span className={textMuted}>{wc.city}</span>
                  <span className="font-mono font-medium">{formatted}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden select-none relative ${bgMain}`}>
      {/* TOP HEADER BAR */}
      <header className={`min-h-14 px-3 sm:px-5 py-2 border-b ${borderSubtle} flex flex-wrap items-center justify-between gap-2 sm:gap-3 shrink-0`}>
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <button
            type="button"
            data-testid="calendar-mobile-menu-btn"
            onClick={() => setShowMobileSidebar((v) => !v)}
            className={`md:hidden p-2 rounded-lg border ${borderSubtle} ${hoverItem} min-w-[32px] min-h-[32px] flex items-center justify-center shrink-0`}
            title="Abrir menu de agendas"
            aria-label="Abrir menu de agendas"
          >
            <Menu size={16} />
          </button>

          <div className="flex items-center gap-2 pr-1 shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
              <GoogleIcons.Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm sm:text-base font-semibold tracking-tight leading-none">Google Agenda</h1>
              <span className={`hidden xl:inline text-[11px] ${textMuted}`}>Sincronizado em tempo real</span>
            </div>
          </div>

          <button
            data-testid="calendar-today-btn"
            onClick={handleToday}
            className={`px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-medium border ${borderSubtle} ${hoverItem} transition-colors min-h-[32px] shrink-0`}
            title="Ir para hoje (Atalho: T)"
          >
            Hoje
          </button>

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              data-testid="calendar-prev-btn"
              onClick={() => handleNavigate(-1)}
              className={`p-1.5 rounded-full ${hoverItem} transition-colors min-w-[30px] min-h-[30px] flex items-center justify-center`}
              title="Período anterior"
            >
              <ChevronLeft size={17} />
            </button>
            <button
              data-testid="calendar-next-btn"
              onClick={() => handleNavigate(1)}
              className={`p-1.5 rounded-full ${hoverItem} transition-colors min-w-[30px] min-h-[30px] flex items-center justify-center`}
              title="Próximo período"
            >
              <ChevronRight size={17} />
            </button>
          </div>

          <h2
            data-testid="calendar-header-title"
            className="text-sm sm:text-base lg:text-lg font-semibold tracking-tight truncate"
          >
            {headerTitle}
          </h2>
        </div>

        {/* Search + View Switcher + Utilities */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
          <div
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border ${borderSubtle} ${
              isDarkMode ? 'bg-white/5' : 'bg-black/[0.03]'
            } flex-1 sm:flex-none sm:w-44 lg:w-56 xl:w-64 min-w-0`}
          >
            <Search size={14} className={`${textMuted} shrink-0`} />
            <input
              data-testid="calendar-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar eventos..."
              className="bg-transparent text-xs outline-none w-full min-w-0 placeholder:text-gray-400"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="opacity-60 hover:opacity-100 shrink-0">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Compact View Selector on Tablet / Mobile */}
          <select
            data-testid="calendar-view-select"
            aria-label="Modo de visualização"
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as CalendarViewMode)}
            className={`lg:hidden px-2 py-1.5 rounded-xl border text-xs font-medium outline-none min-h-[32px] shrink-0 ${borderSubtle} ${
              isDarkMode ? 'bg-[#20232B] text-[#E8EAED]' : 'bg-white text-[#202124]'
            }`}
          >
            {VIEW_MODE_OPTIONS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>

          {/* 6 Native View Modes Switcher on Desktop */}
          <div className={`hidden lg:flex items-center p-1 rounded-xl border ${borderSubtle} ${isDarkMode ? 'bg-black/25' : 'bg-gray-100'} shrink-0`}>
            {VIEW_MODE_OPTIONS.map((v) => (
              <button
                key={v.id}
                data-testid={`calendar-view-${v.id}`}
                onClick={() => setViewMode(v.id)}
                title={`${v.label} (Atalho: ${v.shortcut})`}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                  viewMode === v.id
                    ? 'bg-[#1A73E8] text-white shadow-sm'
                    : `${textMuted} hover:text-current`
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Mobile Quick Create Button */}
          <button
            type="button"
            data-testid="calendar-mobile-create-btn"
            onClick={() => openCreateModal('event')}
            className="md:hidden px-2.5 py-1.5 rounded-xl bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-semibold flex items-center gap-1 min-h-[32px] shrink-0"
            title="Criar evento"
          >
            <Plus size={14} />
            <span className="hidden xs:inline">Criar</span>
          </button>

          <input
            ref={icsFileInputRef}
            type="file"
            accept=".ics,text/calendar"
            onChange={handleImportICSFile}
            className="hidden"
          />

          <button
            data-testid="calendar-import-ics-btn"
            onClick={() => icsFileInputRef.current?.click()}
            className={`hidden sm:flex p-2 rounded-lg border ${borderSubtle} ${hoverItem} transition-colors items-center justify-center shrink-0`}
            title="Importar agenda (.ics)"
          >
            <Upload size={15} />
          </button>

          <button
            data-testid="calendar-export-ics-btn"
            onClick={handleExportICS}
            className={`hidden sm:flex p-2 rounded-lg border ${borderSubtle} ${hoverItem} transition-colors items-center justify-center shrink-0`}
            title="Exportar agenda (.ics)"
          >
            <Download size={15} />
          </button>

          <button
            onClick={() => window.print()}
            className={`hidden md:flex p-2 rounded-lg border ${borderSubtle} ${hoverItem} transition-colors items-center justify-center shrink-0`}
            title="Imprimir agenda"
          >
            <Printer size={15} />
          </button>

          <button
            data-testid="calendar-shortcuts-btn"
            onClick={() => setShowShortcutsModal(true)}
            className={`hidden md:flex p-2 rounded-lg border ${borderSubtle} ${hoverItem} transition-colors items-center justify-center shrink-0`}
            title="Atalhos de teclado (?)"
          >
            <HelpCircle size={15} />
          </button>

          <button
            onClick={onClose}
            className={`p-2 rounded-lg border ${borderSubtle} hover:bg-red-500/20 hover:text-red-400 transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center shrink-0`}
            title="Fechar Agenda"
          >
            <X size={15} />
          </button>
        </div>
      </header>

      {/* BODY: LEFT SIDEBAR + MAIN VIEWPORT */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* DESKTOP LEFT SIDEBAR */}
        <aside className={`hidden md:flex w-60 lg:w-64 border-r ${bgSidebar} flex-col justify-between overflow-y-auto custom-scrollbar p-4 shrink-0`}>
          {renderSidebarContent(false)}
        </aside>

        {/* MOBILE SLIDE-OVER SIDEBAR DRAWER */}
        {showMobileSidebar && (
          <div className="md:hidden absolute inset-0 z-40 flex">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
              onClick={() => setShowMobileSidebar(false)}
            />
            <aside
              data-testid="calendar-mobile-sidebar"
              className={`relative z-10 w-72 max-w-[85%] h-full border-r ${bgSidebar} flex flex-col justify-between overflow-y-auto custom-scrollbar p-4 shadow-2xl`}
            >
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
                <span className="text-xs font-semibold uppercase tracking-wider opacity-80">Agendas & Navegação</span>
                <button
                  type="button"
                  onClick={() => setShowMobileSidebar(false)}
                  className={`p-1.5 rounded-lg ${hoverItem}`}
                  aria-label="Fechar menu"
                >
                  <X size={15} />
                </button>
              </div>
              {renderSidebarContent(true)}
            </aside>
          </div>
        )}

        {/* MAIN VIEWPORT */}
        <main className="flex-1 flex flex-col overflow-hidden relative min-w-0">
          {/* VIEW 1, 2, 3: DAY / 4 DAYS / WEEK TIME GRID */}
          {(viewMode === 'day' || viewMode === 'fourDays' || viewMode === 'week') && (
            <div className="flex-1 flex flex-col overflow-x-auto overflow-y-hidden custom-scrollbar">
              <div
                className={`flex-1 flex flex-col overflow-hidden ${
                  activeColumns.length === 7
                    ? 'min-w-[640px]'
                    : activeColumns.length === 4
                    ? 'min-w-[420px]'
                    : 'min-w-0'
                }`}
              >
              {/* Column Headers + All-Day Row */}
              <div className={`border-b ${borderSubtle} shrink-0`}>
                <div className="flex">
                  <div className={`w-14 sm:w-16 shrink-0 border-r ${borderSubtle} flex items-end justify-center pb-2 text-[10px] ${textMuted}`}>
                    {localGmtLabel}
                  </div>
                  <div
                    className="flex-1 grid"
                    style={{ gridTemplateColumns: `repeat(${activeColumns.length}, minmax(0, 1fr))` }}
                  >
                    {activeColumns.map((colDate, i) => {
                      const isToday = isSameDay(colDate, new Date());
                      const dayEvents = filterCalendarEvents(
                        expandEventsForDay(events, colDate, tasks, includeTasksInCalendar),
                        { visibleCalendarIds, searchQuery }
                      );
                      const allDayEvents = dayEvents.filter((e) => e.isAllDay);

                      return (
                        <div
                          key={colDate.toISOString()}
                          className={`border-r last:border-r-0 ${borderSubtle} px-1.5 sm:px-2 pt-2 pb-1.5 flex flex-col items-center`}
                        >
                          <span
                            className={`text-[11px] font-semibold tracking-wider ${
                              isToday ? 'text-[#1A73E8]' : textMuted
                            }`}
                          >
                            {WEEKDAY_SHORT[colDate.getDay()]}
                          </span>
                          <button
                            onClick={() => {
                              setCurrentDate(colDate);
                              setViewMode('day');
                            }}
                            className={`mt-0.5 w-8 h-8 rounded-full text-sm font-semibold flex items-center justify-center transition-colors ${
                              isToday
                                ? 'bg-[#1A73E8] text-white shadow'
                                : hoverItem
                            }`}
                          >
                            {colDate.getDate()}
                          </button>

                          {/* Working Location Native Pill */}
                          <button
                            type="button"
                            onClick={() => cycleWorkingLocation(colDate)}
                            title="Alternar local de trabalho (Escritório / Casa / Remoto)"
                            className={`mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1 border ${borderSubtle} ${hoverItem}`}
                          >
                            <MapPin size={9} className="text-blue-400 shrink-0" />
                            <span className="truncate">{workingLocations[formatToInputDate(colDate)] || 'Escritório'}</span>
                          </button>

                          {/* All-day chips */}
                          {allDayEvents.length > 0 && (
                            <div className="w-full mt-1.5 space-y-1">
                              {allDayEvents.slice(0, 2).map((ade) => (
                                <button
                                  key={ade.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedEvent(ade);
                                  }}
                                  className="w-full text-left px-2 py-0.5 rounded text-[11px] font-medium text-white truncate shadow-sm"
                                  style={{ backgroundColor: ade.color || '#039BE5' }}
                                >
                                  {ade.entryType === 'outOfOffice' && '✈ '}
                                  {ade.title}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Scrollable 24-Hour Grid */}
              <div ref={gridScrollRef} className="flex-1 overflow-y-auto custom-scrollbar flex relative">
                {/* Hour Labels */}
                <div className={`w-14 sm:w-16 shrink-0 border-r ${borderSubtle} select-none`}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="h-[56px] relative">
                      <span className={`absolute -top-2 right-2 text-[10px] font-mono ${textMuted}`}>
                        {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Day Columns */}
                <div
                  className="flex-1 grid relative"
                  style={{ gridTemplateColumns: `repeat(${activeColumns.length}, minmax(0, 1fr))` }}
                >
                  {activeColumns.map((colDate) => {
                    const dayRaw = filterCalendarEvents(
                      expandEventsForDay(events, colDate, tasks, includeTasksInCalendar),
                      { visibleCalendarIds, searchQuery }
                    );
                    const positioned = arrangeEventsForDay(dayRaw);
                    const isToday = isSameDay(colDate, nowTick);
                    const nowTopPx = (nowTick.getHours() * 60 + nowTick.getMinutes()) * (56 / 60);

                    return (
                      <div key={colDate.toISOString()} className={`relative border-r last:border-r-0 ${borderSubtle}`}>
                        {/* Hour click & drop slots */}
                        {Array.from({ length: 24 }, (_, h) => (
                          <div
                            key={h}
                            onClick={() => openCreateModal('event', colDate, h)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleDropEventOnSlot(colDate, h)}
                            className={`h-[56px] border-b ${borderSubtle} ${
                              isDarkMode ? 'hover:bg-white/[0.02]' : 'hover:bg-blue-50/40'
                            } transition-colors cursor-pointer`}
                          />
                        ))}

                        {/* Red Now Indicator Line */}
                        {isToday && (
                          <div
                            className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                            style={{ top: `${nowTopPx}px` }}
                          >
                            <div className="w-2.5 h-2.5 rounded-full bg-[#EA4335] -ml-1.5 shadow" />
                            <div className="flex-1 h-[2px] bg-[#EA4335]" />
                          </div>
                        )}

                        {/* Positioned Timed Events */}
                        {positioned.map((ev) => {
                          const startMins = ev.startDate.getHours() * 60 + ev.startDate.getMinutes();
                          const durationMins = Math.max(
                            30,
                            (ev.endDate.getTime() - ev.startDate.getTime()) / 60000
                          );
                          const topPx = startMins * (56 / 60);
                          const heightPx = Math.max(26, durationMins * (56 / 60) - 2);
                          const widthPct = 100 / ev.totalCols;
                          const leftPct = ev.colIndex * widthPct;
                          const timeStr = `${String(ev.startDate.getHours()).padStart(2, '0')}:${String(
                            ev.startDate.getMinutes()
                          ).padStart(2, '0')}`;

                          return (
                            <div
                              key={ev.id}
                              draggable={ev.entryType !== 'task'}
                              onDragStart={() => setDraggedEventId(ev.id)}
                              data-testid={`calendar-event-chip-${ev.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEvent(ev);
                              }}
                              className="absolute z-10 rounded-lg px-2 py-1 text-white shadow-md cursor-pointer overflow-hidden hover:brightness-110 transition-all border border-white/20"
                              style={{
                                top: `${topPx}px`,
                                height: `${heightPx}px`,
                                left: `calc(${leftPct}% + 2px)`,
                                width: `calc(${widthPct}% - 4px)`,
                                backgroundColor: ev.color || '#039BE5',
                              }}
                            >
                              <div className="flex items-center gap-1 text-[11px] font-semibold leading-tight truncate">
                                {ev.entryType === 'focusTime' && <Headphones size={11} className="shrink-0" />}
                                {ev.entryType === 'outOfOffice' && <Plane size={11} className="shrink-0" />}
                                <span className="truncate">{ev.title}</span>
                              </div>
                              {heightPx >= 38 && (
                                <div className="text-[10px] opacity-90 truncate">
                                  {timeStr} {ev.meetLink ? '· Google Meet' : ev.location ? `· ${ev.location}` : ''}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
              </div>
            </div>
          )}

          {/* VIEW 4: MONTH VIEW */}
          {viewMode === 'month' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className={`grid grid-cols-7 border-b ${borderSubtle} py-2 text-center text-xs font-semibold ${textMuted}`}>
                {WEEKDAY_SHORT.map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="flex-1 grid grid-cols-7 grid-rows-6 overflow-hidden">
                {monthGridDays.map((cell, idx) => {
                  const isToday = isSameDay(cell.date, new Date());
                  const dayEvents = filterCalendarEvents(
                    expandEventsForDay(events, cell.date, tasks, includeTasksInCalendar),
                    { visibleCalendarIds, searchQuery }
                  );

                  return (
                    <div
                      key={idx}
                      onClick={() => openCreateModal('event', cell.date, 9)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDropEventOnSlot(cell.date)}
                      className={`border-r border-b ${borderSubtle} p-1 sm:p-1.5 flex flex-col overflow-hidden cursor-pointer ${
                        !cell.inMonth ? 'opacity-40' : ''
                      } ${hoverItem}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center ${
                            isToday ? 'bg-[#1A73E8] text-white' : ''
                          }`}
                        >
                          {cell.date.getDate()}
                        </span>
                        {dayEvents.length > 3 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentDate(new Date(cell.date));
                              setViewMode('day');
                            }}
                            className="text-[10px] font-semibold text-[#1A73E8] hover:underline px-1"
                            title="Ver todos os eventos deste dia"
                          >
                            +{dayEvents.length - 3}
                          </button>
                        )}
                      </div>
                      <div className="space-y-1 overflow-hidden">
                        {dayEvents.slice(0, 3).map((ev) => (
                          <button
                            key={ev.id}
                            draggable={ev.entryType !== 'task'}
                            onDragStart={() => setDraggedEventId(ev.id)}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEvent(ev);
                            }}
                            className="w-full text-left px-1.5 py-0.5 rounded text-[11px] font-medium text-white truncate"
                            style={{ backgroundColor: ev.color || '#039BE5' }}
                          >
                            {ev.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW 5: YEAR VIEW (12-Month Executive Overview) */}
          {viewMode === 'year' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 max-w-6xl mx-auto">
                {MONTH_NAMES.map((mName, mIdx) => {
                  const year = currentDate.getFullYear();
                  const firstDow = new Date(year, mIdx, 1).getDay();
                  const numDays = new Date(year, mIdx + 1, 0).getDate();
                  const blanks = Array.from({ length: firstDow }, (_, i) => i);
                  const days = Array.from({ length: numDays }, (_, i) => i + 1);

                  return (
                    <div key={mName} className={`p-4 rounded-2xl border ${cardSurface}`}>
                      <h3 className="text-sm font-semibold mb-2 text-[#1A73E8]">{mName}</h3>
                      <div className="grid grid-cols-7 text-center text-[10px] opacity-60 mb-1">
                        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                          <span key={i}>{d}</span>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-y-1 text-center">
                        {blanks.map((b) => (
                          <span key={`b_${b}`} />
                        ))}
                        {days.map((dNum) => {
                          const dObj = new Date(year, mIdx, dNum);
                          const isToday = isSameDay(dObj, new Date());
                          const hasEv = yearEventDayKeys.has(`${mIdx}-${dNum}`);

                          return (
                            <button
                              key={dNum}
                              onClick={() => {
                                setCurrentDate(dObj);
                                setViewMode('day');
                              }}
                              className={`h-7 w-7 mx-auto rounded-full text-[11px] relative flex items-center justify-center ${
                                isToday
                                  ? 'bg-[#1A73E8] text-white font-bold'
                                  : hoverItem
                              }`}
                            >
                              {dNum}
                              {hasEv && !isToday && (
                                <span className="w-1 h-1 rounded-full bg-[#1A73E8] absolute bottom-0.5" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW 6: SCHEDULE / PROGRAMAÇÃO VIEW */}
          {viewMode === 'schedule' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-6">
              <div className="max-w-4xl mx-auto space-y-3 sm:space-y-4">
                {scheduleDays.map(({ date, items }) => {
                  const isToday = isSameDay(date, new Date());
                  return (
                    <div
                      key={date.toISOString()}
                      className={`rounded-2xl border ${cardSurface} p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:gap-4`}
                    >
                      <div className="sm:w-36 shrink-0 flex items-center sm:items-start gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                            isToday ? 'bg-[#1A73E8] text-white' : 'bg-blue-500/15 text-blue-400'
                          }`}
                        >
                          {date.getDate()}
                        </div>
                        <div>
                          <div className="text-xs font-bold uppercase tracking-wider">
                            {WEEKDAY_SHORT[date.getDay()]}
                          </div>
                          <div className={`text-xs ${textMuted}`}>
                            {MONTH_NAMES[date.getMonth()].slice(0, 3)}, {date.getFullYear()}
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 space-y-2 min-w-0">
                        {items.length === 0 ? (
                          <div className={`text-xs italic ${textMuted} py-2`}>
                            Nenhum compromisso agendado para hoje.
                          </div>
                        ) : (
                          items.map((ev) => {
                            const s = new Date(ev.start);
                            const e = new Date(ev.end);
                            const timeLabel = ev.isAllDay
                              ? 'Dia inteiro'
                              : `${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(
                                  2,
                                  '0'
                                )} – ${String(e.getHours()).padStart(2, '0')}:${String(
                                  e.getMinutes()
                                ).padStart(2, '0')}`;

                            return (
                              <div
                                key={ev.id}
                                onClick={() => setSelectedEvent(ev)}
                                className={`flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 p-2.5 rounded-xl border ${borderSubtle} ${hoverItem} cursor-pointer transition-all`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <span
                                    className="w-3 h-3 rounded-full shrink-0"
                                    style={{ backgroundColor: ev.color || '#039BE5' }}
                                  />
                                  <span className={`text-xs font-mono shrink-0 ${textMuted}`}>
                                    {timeLabel}
                                  </span>
                                  <span className="text-sm font-medium truncate">{ev.title}</span>
                                </div>
                                {ev.meetLink && (
                                  <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-400 text-[11px] font-medium shrink-0">
                                    Google Meet
                                  </span>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* UNDO DELETE EVENT FLOATING BANNER */}
          {undoDeletedEvent && (
            <div
              data-testid="calendar-undo-delete-banner"
              className={`absolute bottom-5 left-4 right-4 sm:right-auto z-40 px-4 py-2.5 rounded-2xl border ${cardSurface} shadow-2xl flex items-center justify-between gap-4`}
            >
              <span className="text-xs font-medium truncate">
                Evento "{undoDeletedEvent.title}" excluído.
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  data-testid="calendar-undo-delete-btn"
                  onClick={handleUndoDeleteEvent}
                  className="px-3 py-1 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <RotateCcw size={12} />
                  Desfazer
                </button>
                <button
                  type="button"
                  onClick={() => setUndoDeletedEvent(null)}
                  className={`p-1 rounded-full ${hoverItem}`}
                  aria-label="Dispensar"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          )}

          {/* EVENT DETAILS POPOVER / DRAWER */}
          {selectedEvent && (() => {
            const selfEmail = data?.user?.email || '';
            const selfName = data?.user?.name || 'Você';
            const selfRsvp = selectedEvent.guests?.find((g) => (selfEmail ? g.email === selfEmail : g.name === selfName))?.responseStatus;
            return (
            <div
              onClick={() => setSelectedEvent(null)}
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            >
              <div
                data-testid="calendar-event-detail-popover"
                onClick={(e) => e.stopPropagation()}
                className={`w-full max-w-md rounded-3xl border ${cardSurface} shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-full flex flex-col`}
              >
                {/* Top Color Header */}
                <div
                  className="px-5 py-4 text-white flex items-start justify-between gap-3 shrink-0"
                  style={{ backgroundColor: selectedEvent.color || '#039BE5' }}
                >
                  <div className="min-w-0">
                    <span className="inline-block px-2 py-0.5 rounded-full bg-black/20 text-[10px] font-semibold uppercase tracking-wider mb-1">
                      {ENTRY_TYPE_META[selectedEvent.entryType || 'event'].badge}
                    </span>
                    <h3 className="text-lg font-bold leading-snug break-words">{selectedEvent.title}</h3>
                    <p className="text-xs opacity-90 mt-0.5">
                      {new Date(selectedEvent.start).toLocaleDateString('pt-BR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })}{' '}
                      ·{' '}
                      {selectedEvent.isAllDay
                        ? 'Dia inteiro'
                        : `${new Date(selectedEvent.start).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })} – ${new Date(selectedEvent.end).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {selectedEvent.entryType !== 'task' && (
                      <>
                        <button
                          data-testid="event-detail-edit-btn"
                          onClick={() => openEditModal(selectedEvent)}
                          className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                          title="Editar evento"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDuplicateEvent(selectedEvent)}
                          className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                          title="Duplicar evento"
                        >
                          <Copy size={15} />
                        </button>
                      </>
                    )}
                    <button
                      data-testid="event-detail-delete-btn"
                      onClick={() => handleDeleteEvent(selectedEvent)}
                      className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={15} />
                    </button>
                    <button
                      onClick={() => setSelectedEvent(null)}
                      className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                      title="Fechar"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Details Body */}
                <div className="p-5 space-y-4 text-xs overflow-y-auto custom-scrollbar">
                  {/* Metadata Badges (Recurrence, Notification, Busy/Free) */}
                  {(selectedEvent.recurrenceRule && selectedEvent.recurrenceRule !== 'none') ||
                  selectedEvent.notificationMinutes ||
                  selectedEvent.busyStatus ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {selectedEvent.recurrenceRule && selectedEvent.recurrenceRule !== 'none' && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border ${borderSubtle} text-[11px]`}>
                          <Repeat size={11} className="text-blue-400" />
                          {RECURRENCE_LABELS[selectedEvent.recurrenceRule]}
                        </span>
                      )}
                      {selectedEvent.notificationMinutes && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border ${borderSubtle} text-[11px]`}>
                          <Bell size={11} className="text-amber-400" />
                          {selectedEvent.notificationMinutes} min antes
                        </span>
                      )}
                      {selectedEvent.busyStatus && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border ${borderSubtle} text-[11px]`}>
                          <Clock size={11} className={selectedEvent.busyStatus === 'free' ? 'text-emerald-400' : 'text-purple-400'} />
                          {selectedEvent.busyStatus === 'free' ? 'Disponível' : 'Ocupado'}
                        </span>
                      )}
                    </div>
                  ) : null}

                  {selectedEvent.description && (
                    <div className="flex items-start gap-3">
                      <AlignLeft size={15} className={`mt-0.5 shrink-0 ${textMuted}`} />
                      <p className="leading-relaxed">{selectedEvent.description}</p>
                    </div>
                  )}

                  {selectedEvent.location && (
                    <div className="flex items-center gap-3">
                      <MapPin size={15} className={`shrink-0 ${textMuted}`} />
                      <span>{selectedEvent.location}</span>
                    </div>
                  )}

                  {/* Google Meet CTA */}
                  {selectedEvent.meetLink && (
                    <div className={`p-3 rounded-2xl border ${borderSubtle} flex items-center justify-between gap-2`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
                          <Video size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold">Entrar com o Google Meet</div>
                          <div className={`text-[11px] truncate ${textMuted}`}>{selectedEvent.meetLink}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedEvent(null);
                          onOpenApp?.('meet', { roomCode: selectedEvent.meetLink });
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#1A73E8] text-white font-semibold text-xs hover:bg-[#1557B0] shrink-0"
                      >
                        Participar
                      </button>
                    </div>
                  )}

                  {/* Guests list */}
                  {selectedEvent.guests && selectedEvent.guests.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-semibold uppercase tracking-wider text-[10px] ${textMuted}`}>
                          {selectedEvent.guests.length} Convidado(s)
                        </span>
                        <button
                          onClick={() => {
                            const emails = selectedEvent.guests?.map((g) => g.email).join(', ');
                            setSelectedEvent(null);
                            onOpenApp?.('mail', {
                              composeTo: emails,
                              composeSubject: `Pauta: ${selectedEvent.title}`,
                            });
                          }}
                          className="flex items-center gap-1 text-[#1A73E8] hover:underline text-[11px] font-medium"
                        >
                          <Mail size={12} /> Enviar e-mail aos convidados
                        </button>
                      </div>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                        {selectedEvent.guests.map((g, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                {(g.name || g.email)[0].toUpperCase()}
                              </div>
                              <span className="truncate">{g.name || g.email}</span>
                            </div>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${
                                g.responseStatus === 'accepted'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : g.responseStatus === 'declined'
                                  ? 'bg-red-500/20 text-red-400'
                                  : 'bg-amber-500/20 text-amber-400'
                              }`}
                            >
                              {g.responseStatus === 'accepted'
                                ? 'Confirmado'
                                : g.responseStatus === 'declined'
                                ? 'Recusou'
                                : 'Pendente'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick Actions: Meeting Notes in Google Docs & Quick Reschedule */}
                  {selectedEvent.entryType === 'task' ? (
                    <button
                      onClick={() => handleToggleCalendarTaskComplete(selectedEvent)}
                      className="w-full py-2.5 rounded-xl bg-[#1A73E8] text-white font-semibold flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={15} />
                      Alternar conclusão no Google Tarefas
                    </button>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          data-testid="create-meeting-notes-btn"
                          onClick={() => handleCreateMeetingNotesDoc(selectedEvent)}
                          className={`flex-1 py-2 px-3 rounded-xl border ${borderSubtle} ${hoverItem} flex items-center justify-center gap-1.5 font-medium min-w-[160px]`}
                        >
                          <FileText size={14} className="text-blue-400" />
                          Criar ata no Google Docs
                        </button>
                        <button
                          onClick={() => handleQuickReschedule(selectedEvent, 'plus30m')}
                          className={`py-2 px-2.5 rounded-xl border ${borderSubtle} ${hoverItem} font-medium`}
                        >
                          +30 min
                        </button>
                        <button
                          onClick={() => handleQuickReschedule(selectedEvent, 'tomorrow')}
                          className={`py-2 px-2.5 rounded-xl border ${borderSubtle} ${hoverItem} font-medium`}
                        >
                          Amanhã
                        </button>
                      </div>

                      {/* RSVP Bar */}
                      <div className={`pt-3 border-t ${borderSubtle} flex flex-wrap items-center justify-between gap-2`}>
                        <span className={textMuted}>Você vai participar?</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            data-testid="rsvp-yes-btn"
                            aria-pressed={selfRsvp === 'accepted'}
                            onClick={() => handleRSVP(selectedEvent, 'accepted')}
                            className={`px-3 py-1 rounded-full border font-semibold ${
                              selfRsvp === 'accepted'
                                ? 'bg-[#0F9D58] border-[#0F9D58] text-white shadow-sm'
                                : isDarkMode
                                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                                : 'border-emerald-600/30 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                            }`}
                          >
                            Sim
                          </button>
                          <button
                            data-testid="rsvp-no-btn"
                            aria-pressed={selfRsvp === 'declined'}
                            onClick={() => handleRSVP(selectedEvent, 'declined')}
                            className={`px-3 py-1 rounded-full border font-semibold ${
                              selfRsvp === 'declined'
                                ? 'bg-[#D93025] border-[#D93025] text-white shadow-sm'
                                : isDarkMode
                                ? 'border-red-500/40 bg-red-500/15 text-red-300 hover:bg-red-500/25'
                                : 'border-red-600/30 bg-red-50 text-red-800 hover:bg-red-100'
                            }`}
                          >
                            Não
                          </button>
                          <button
                            data-testid="rsvp-maybe-btn"
                            aria-pressed={selfRsvp === 'tentative'}
                            onClick={() => handleRSVP(selectedEvent, 'tentative')}
                            className={`px-3 py-1 rounded-full border font-semibold ${
                              selfRsvp === 'tentative'
                                ? 'bg-[#E37400] border-[#E37400] text-white shadow-sm'
                                : isDarkMode
                                ? 'border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
                                : 'border-amber-600/35 bg-amber-50 text-amber-900 hover:bg-amber-100'
                            }`}
                          >
                            Talvez
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            );
          })()}

          {/* CREATE / EDIT FULL MODAL */}
          {showEventModal && (
            <div
              onClick={() => setShowEventModal(false)}
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4"
            >
              <div
                data-testid="calendar-event-modal"
                onClick={(e) => e.stopPropagation()}
                className={`w-full max-w-xl rounded-3xl border ${cardSurface} shadow-2xl overflow-hidden flex flex-col max-h-full`}
              >
                {/* Modal Header */}
                <div className={`px-4 sm:px-6 py-3.5 border-b ${borderSubtle} flex items-start justify-between gap-2`}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(Object.keys(ENTRY_TYPE_META) as CalendarEntryType[]).map((tKey) => (
                      <button
                        key={tKey}
                        type="button"
                        data-testid={`modal-type-${tKey}`}
                        onClick={() => {
                          setEntryType(tKey);
                          setEvColor(ENTRY_TYPE_META[tKey].defaultColor);
                        }}
                        className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
                          entryType === tKey
                            ? 'bg-[#1A73E8] text-white shadow-sm'
                            : `${textMuted} ${hoverItem}`
                        }`}
                      >
                        {ENTRY_TYPE_META[tKey].icon}
                        <span>{ENTRY_TYPE_META[tKey].label}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowEventModal(false)}
                    className={`p-1.5 rounded-full shrink-0 ${hoverItem}`}
                    aria-label="Fechar modal"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Modal Sub-tabs: Detalhes do evento | Encontrar um horário */}
                <div className={`px-6 border-b ${borderSubtle} flex items-center gap-6 text-xs font-semibold`}>
                  <button
                    type="button"
                    onClick={() => setModalTab('details')}
                    className={`py-2.5 border-b-2 transition-colors ${
                      modalTab === 'details'
                        ? 'border-[#1A73E8] text-[#1A73E8]'
                        : `border-transparent ${textMuted}`
                    }`}
                  >
                    Detalhes do registro
                  </button>
                  <button
                    type="button"
                    data-testid="modal-tab-find-time"
                    onClick={() => setModalTab('findTime')}
                    className={`py-2.5 border-b-2 flex items-center gap-1.5 transition-colors ${
                      modalTab === 'findTime'
                        ? 'border-[#1A73E8] text-[#1A73E8]'
                        : `border-transparent ${textMuted}`
                    }`}
                  >
                    <Sparkles size={13} />
                    Encontrar um horário
                  </button>
                </div>

                {/* Modal Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-4 text-xs flex-1">
                  {modalTab === 'details' ? (
                    <>
                      <input
                        data-testid="event-title-input"
                        type="text"
                        value={evTitle}
                        onChange={(e) => setEvTitle(e.target.value)}
                        placeholder={`Adicionar título (${ENTRY_TYPE_META[entryType].label})`}
                        className={`w-full text-lg font-semibold pb-2 border-b ${borderSubtle} bg-transparent outline-none focus:border-[#1A73E8]`}
                        autoFocus
                      />

                      {/* Date & Time Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className={`block text-[11px] mb-1 ${textMuted}`}>Data</label>
                          <input
                            data-testid="event-date-input"
                            type="date"
                            value={evDate}
                            onChange={(e) => setEvDate(e.target.value)}
                            className={`w-full px-3 py-2 rounded-xl border ${borderSubtle} bg-transparent outline-none`}
                          />
                        </div>
                        {!evIsAllDay && (
                          <>
                            <div>
                              <label className={`block text-[11px] mb-1 ${textMuted}`}>Início</label>
                              <input
                                data-testid="event-start-time-input"
                                type="time"
                                value={evStartTime}
                                onChange={(e) => setEvStartTime(e.target.value)}
                                className={`w-full px-3 py-2 rounded-xl border ${borderSubtle} bg-transparent outline-none`}
                              />
                            </div>
                            <div>
                              <label className={`block text-[11px] mb-1 ${textMuted}`}>Término</label>
                              <input
                                data-testid="event-end-time-input"
                                type="time"
                                value={evEndTime}
                                onChange={(e) => setEvEndTime(e.target.value)}
                                className={`w-full px-3 py-2 rounded-xl border ${borderSubtle} bg-transparent outline-none`}
                              />
                            </div>
                          </>
                        )}
                      </div>

                      {/* Real-time Conflict Warning */}
                      {modalConflicts.length > 0 && (
                        <div
                          data-testid="calendar-conflict-warning"
                          className={`p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-2 ${
                            isDarkMode
                              ? 'border-amber-500/40 bg-amber-500/10'
                              : 'border-amber-400/80 bg-amber-50'
                          }`}
                        >
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            <AlertTriangle
                              size={15}
                              className={`shrink-0 mt-0.5 ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`}
                            />
                            <div className="min-w-0">
                              <div className={`font-semibold ${isDarkMode ? 'text-amber-300' : 'text-amber-900'}`}>
                                Conflito com {modalConflicts.length} compromisso(s)
                              </div>
                              <div className={`text-[11px] truncate ${isDarkMode ? 'text-amber-100/80' : 'text-amber-800'}`}>
                                {modalConflicts.slice(0, 2).map((c) => c.title).join(' · ')}
                                {modalConflicts.some((c) => c.autoDeclineMeetings)
                                  ? ' (Recusa automática ativa)'
                                  : ''}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            data-testid="conflict-find-time-btn"
                            onClick={() => setModalTab('findTime')}
                            className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] shrink-0 transition-colors ${
                              isDarkMode
                                ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200'
                                : 'bg-amber-200/90 hover:bg-amber-300 text-amber-950'
                            }`}
                          >
                            Ver horários livres
                          </button>
                        </div>
                      )}

                      {/* All-day & Recurrence */}
                      <div className="flex flex-wrap items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={evIsAllDay}
                            onChange={(e) => setEvIsAllDay(e.target.checked)}
                            className="rounded"
                          />
                          <span>Dia inteiro</span>
                        </label>

                        <div className="flex items-center gap-2">
                          <Repeat size={14} className={textMuted} />
                          <select
                            data-testid="event-recurrence-select"
                            value={evRecurrence}
                            onChange={(e) => setEvRecurrence(e.target.value as CalendarRecurrenceRule)}
                            className={`px-3 py-1.5 rounded-xl border ${borderSubtle} ${
                              isDarkMode ? 'bg-[#20232B]' : 'bg-white'
                            } outline-none`}
                          >
                            <option value="none">Não se repete</option>
                            <option value="daily">Todos os dias</option>
                            <option value="weekdays">Todos os dias úteis (Seg–Sex)</option>
                            <option value="weekly">Semanalmente</option>
                            <option value="monthly">Mensalmente</option>
                            <option value="yearly">Anualmente</option>
                          </select>
                        </div>
                      </div>

                      {/* Focus Time / Out of Office Auto-Decline toggle */}
                      {(entryType === 'focusTime' || entryType === 'outOfOffice') && (
                        <label
                          className={`flex items-center gap-2.5 p-3 rounded-xl border ${borderSubtle} cursor-pointer`}
                        >
                          <input
                            type="checkbox"
                            checked={evAutoDecline}
                            onChange={(e) => setEvAutoDecline(e.target.checked)}
                          />
                          <span>Recusar automaticamente convites de reuniões conflitantes</span>
                        </label>
                      )}

                      {/* Google Meet Video Conferencing */}
                      {entryType === 'event' && (
                        <div className="flex items-center justify-between">
                          {evMeetLink ? (
                            <div className="flex items-center gap-2 text-blue-400 font-medium">
                              <Video size={15} />
                              <span>Videoconferência do Google Meet adicionada ({evMeetLink})</span>
                              <button
                                type="button"
                                onClick={() => setEvMeetLink('')}
                                className="text-red-400 hover:underline ml-2"
                              >
                                Remover
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              data-testid="add-google-meet-btn"
                              onClick={() =>
                                setEvMeetLink(
                                  `https://meet.google.com/${Math.random().toString(36).slice(2, 5)}-${Math.random()
                                    .toString(36)
                                    .slice(2, 6)}-${Math.random().toString(36).slice(2, 5)}`
                                )
                              }
                              className={`px-3.5 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors ${
                                isDarkMode
                                  ? 'bg-blue-500/15 text-blue-300 hover:bg-blue-500/25'
                                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                              }`}
                            >
                              <Video size={15} />
                              Adicionar videoconferência do Google Meet
                            </button>
                          )}
                        </div>
                      )}

                      {/* Guests Input */}
                      {entryType === 'event' && (
                        <div className="space-y-2">
                          <label className={`block text-[11px] ${textMuted}`}>Convidados</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={guestSearch}
                              onChange={(e) => setGuestSearch(e.target.value)}
                              placeholder="Adicionar convidados por nome ou e-mail..."
                              className={`flex-1 px-3 py-2 rounded-xl border ${borderSubtle} bg-transparent outline-none`}
                            />
                            {guestSearch.includes('@') && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEvGuests((prev) => [
                                    ...prev,
                                    { email: guestSearch.trim(), name: guestSearch.trim().split('@')[0], responseStatus: 'needsAction' },
                                  ]);
                                  setGuestSearch('');
                                }}
                                className="px-3 py-2 rounded-xl bg-[#1A73E8] text-white font-medium"
                              >
                                Convidar
                              </button>
                            )}
                          </div>
                          {guestResults.length > 0 && (
                            <div className={`rounded-xl border ${cardSurface} p-1 flex flex-wrap gap-1`}>
                              {guestResults.map((c) => (
                                <button
                                  key={c.email}
                                  type="button"
                                  onClick={() => {
                                    if (!evGuests.some((g) => g.email === c.email)) {
                                      setEvGuests((prev) => [
                                        ...prev,
                                        { name: c.name, email: c.email, avatar: c.avatar, responseStatus: 'accepted' },
                                      ]);
                                    }
                                    setGuestSearch('');
                                    setGuestResults([]);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-400 text-xs font-medium"
                                >
                                  + {c.name} ({c.email})
                                </button>
                              ))}
                            </div>
                          )}
                          {evGuests.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {evGuests.map((g) => (
                                <span
                                  key={g.email}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${borderSubtle}`}
                                >
                                  <span>{g.name || g.email}</span>
                                  <button
                                    type="button"
                                    onClick={() => setEvGuests((prev) => prev.filter((x) => x.email !== g.email))}
                                  >
                                    <X size={12} />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Location & Description */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={`block text-[11px] mb-1 ${textMuted}`}>Local ou Sala</label>
                          <input
                            type="text"
                            value={evLocation}
                            onChange={(e) => setEvLocation(e.target.value)}
                            placeholder="Adicionar local ou sala..."
                            className={`w-full px-3 py-2 rounded-xl border ${borderSubtle} bg-transparent outline-none`}
                          />
                        </div>
                        <div>
                          <label className={`block text-[11px] mb-1 ${textMuted}`}>Agenda</label>
                          <select
                            value={evCalendarId}
                            onChange={(e) => setEvCalendarId(e.target.value)}
                            className={`w-full px-3 py-2 rounded-xl border ${borderSubtle} ${
                              isDarkMode ? 'bg-[#20232B]' : 'bg-white'
                            } outline-none`}
                          >
                            {calendars.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className={`block text-[11px] mb-1 ${textMuted}`}>Descrição / Pauta</label>
                        <textarea
                          rows={2}
                          value={evDesc}
                          onChange={(e) => setEvDesc(e.target.value)}
                          placeholder="Adicionar descrição, links de documentos ou pauta..."
                          className={`w-full px-3 py-2 rounded-xl border ${borderSubtle} bg-transparent outline-none resize-none`}
                        />
                      </div>

                      {/* Notification, Busy/Free & Visibility Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className={`block text-[11px] mb-1 ${textMuted}`}>Notificação</label>
                          <div className="flex items-center gap-1.5">
                            <Bell size={13} className={textMuted} />
                            <select
                              value={evNotificationMins}
                              onChange={(e) => setEvNotificationMins(Number(e.target.value))}
                              className={`w-full px-2.5 py-2 rounded-xl border ${borderSubtle} ${
                                isDarkMode ? 'bg-[#20232B]' : 'bg-white'
                              } outline-none`}
                            >
                              <option value={5}>5 minutos antes</option>
                              <option value={10}>10 minutos antes</option>
                              <option value={15}>15 minutos antes</option>
                              <option value={30}>30 minutos antes</option>
                              <option value={60}>1 hora antes</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className={`block text-[11px] mb-1 ${textMuted}`}>Disponibilidade</label>
                          <select
                            value={evBusyStatus}
                            onChange={(e) => setEvBusyStatus(e.target.value as 'busy' | 'free')}
                            className={`w-full px-2.5 py-2 rounded-xl border ${borderSubtle} ${
                              isDarkMode ? 'bg-[#20232B]' : 'bg-white'
                            } outline-none`}
                          >
                            <option value="busy">Ocupado</option>
                            <option value="free">Disponível (Livre)</option>
                          </select>
                        </div>

                        <div>
                          <label className={`block text-[11px] mb-1 ${textMuted}`}>Visibilidade</label>
                          <select
                            value={evVisibility}
                            onChange={(e) => setEvVisibility(e.target.value as 'default' | 'public' | 'private')}
                            className={`w-full px-2.5 py-2 rounded-xl border ${borderSubtle} ${
                              isDarkMode ? 'bg-[#20232B]' : 'bg-white'
                            } outline-none`}
                          >
                            <option value="default">Visibilidade padrão</option>
                            <option value="public">Público</option>
                            <option value="private">Particular</option>
                          </select>
                        </div>
                      </div>

                      {/* 11 Official Google Calendar Colors */}
                      <div>
                        <label className={`block text-[11px] mb-1.5 ${textMuted}`}>Cor do evento</label>
                        <div className="flex flex-wrap items-center gap-2">
                          {CALENDAR_EVENT_COLORS.map((col) => (
                            <button
                              key={col.id}
                              type="button"
                              title={col.name}
                              onClick={() => setEvColor(col.hex)}
                              className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform ${
                                evColor === col.hex ? 'scale-115 ring-2 ring-white shadow' : 'opacity-80 hover:opacity-100'
                              }`}
                              style={{ backgroundColor: col.hex }}
                            >
                              {evColor === col.hex && <Check size={12} className="text-white stroke-[3]" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    /* TAB: ENCONTRAR UM HORÁRIO (Free/Busy Slot Suggester) */
                    <div className="space-y-3">
                      <p className={textMuted}>
                        Horários livres recomendados para todos os participantes em{' '}
                        <strong>{evDate}</strong>:
                      </p>
                      <div className="space-y-2">
                        {availableSlotsForModalDate.length === 0 ? (
                          <div className={`p-4 rounded-2xl border ${borderSubtle} text-center ${textMuted}`}>
                            Nenhum horário livre encontrado nesta data (possível ausência de dia inteiro ou agenda lotada).
                          </div>
                        ) : (
                          availableSlotsForModalDate.map((slot, idx) => {
                            const s = new Date(slot.start);
                            const e = new Date(slot.end);
                            const startStr = `${String(s.getHours()).padStart(2, '0')}:${String(
                              s.getMinutes()
                            ).padStart(2, '0')}`;
                            const endStr = `${String(e.getHours()).padStart(2, '0')}:${String(
                              e.getMinutes()
                            ).padStart(2, '0')}`;

                            return (
                              <button
                                key={idx}
                                type="button"
                                data-testid={`suggested-slot-${idx}`}
                                onClick={() => {
                                  setEvStartTime(startStr);
                                  setEvEndTime(endStr);
                                  setModalTab('details');
                                  showToast?.(`Horário selecionado: ${startStr} – ${endStr}`);
                                }}
                                className={`w-full p-3 rounded-2xl border ${borderSubtle} ${hoverItem} flex items-center justify-between text-left gap-2`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <Clock size={15} className="text-emerald-400 shrink-0" />
                                  <span className="font-semibold truncate">{slot.label}</span>
                                </div>
                                <span className="text-[#1A73E8] font-medium shrink-0">Aplicar horário →</span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className={`px-6 py-4 border-t ${borderSubtle} flex items-center justify-end gap-2`}>
                  <button
                    type="button"
                    onClick={() => setShowEventModal(false)}
                    className={`px-4 py-2 rounded-xl text-xs font-medium ${hoverItem}`}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    data-testid="save-calendar-event-btn"
                    onClick={handleSaveEvent}
                    className="px-5 py-2 rounded-xl bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-semibold shadow-md transition-all"
                  >
                    Salvar na Agenda
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* KEYBOARD SHORTCUTS MODAL (?) */}
          {showShortcutsModal && (
            <div
              onClick={() => setShowShortcutsModal(false)}
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className={`w-full max-w-md rounded-3xl border ${cardSurface} p-6 shadow-2xl space-y-4`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold">Atalhos de teclado do Google Agenda</h3>
                  <button onClick={() => setShowShortcutsModal(false)} className={`p-1 rounded-full ${hoverItem}`}>
                    <X size={16} />
                  </button>
                </div>
                <div className="space-y-2 text-xs">
                  {[
                    ['T', 'Ir para Hoje'],
                    ['C', 'Criar novo evento'],
                    ['D ou 1', 'Visualização Dia'],
                    ['X ou 2', 'Visualização 4 dias'],
                    ['W ou 3', 'Visualização Semana'],
                    ['M ou 4', 'Visualização Mês'],
                    ['Y ou 5', 'Visualização Ano'],
                    ['A ou 6', 'Visualização Programação (Agenda)'],
                    ['?', 'Abrir guia de atalhos'],
                  ].map(([k, desc]) => (
                    <div key={k} className={`flex items-center justify-between py-1.5 border-b ${borderSubtle}`}>
                      <span className={textMuted}>{desc}</span>
                      <kbd className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 font-mono font-semibold">
                        {k}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
