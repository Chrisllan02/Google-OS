
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, SlidersHorizontal, Settings, X, Plus, 
  Clock, Star, AlertOctagon, Trash2, ChevronLeft, ChevronRight, 
  Inbox, Tag, Send, FileText, CalendarClock, MoreVertical, 
  CheckSquare, Square, Mail, ListOrdered, Calendar as CalendarIcon,
  Paperclip, Link as LinkIcon, Minus, Users2,
  MapPin, Users, Bold, Italic, Underline, List, AlignLeft, Type, File as FileIcon,
  ChevronDown, ChevronUp, Palette, Pencil, Check, Copy, GripVertical,
  Download, Sparkles, ArrowUpRight, Folder, Archive, RotateCw, Reply, Forward,
  Image as ImageIcon, MoreHorizontal, LayoutTemplate, Eye, EyeOff, Video, ExternalLink,
  AtSign, Filter, Pin, Bell, Moon, Sun, Shield, PenTool, Layout, Monitor, Globe,
  Keyboard, MessageSquare, Briefcase, Zap, Smartphone, Globe2, StickyNote, CheckCircle,
  Maximize2, Minimize2, Paperclip as PaperclipIcon, XCircle, Printer, Sliders, Menu,
  User, ToggleLeft, ToggleRight, ArrowLeft, AlertCircle, Tags, Mails, Grid,
  Smile, Lock, AlignCenter, AlignRight, List as ListIcon, Strikethrough, Quote, Undo, Redo,
  RemoveFormatting, GripHorizontal, MousePointerClick, RefreshCcw, CalendarDays,
  ToggleLeft as ToggleOff, ToggleRight as ToggleOn, Volume2, BellOff, SunDim, Loader2, Video as VideoIcon,
  MailOpen
} from 'lucide-react';
import { GoogleIcons } from '../GoogleIcons';
import { bridge, EmailAttachment } from '../../utils/GASBridge';
import TasksApp from './TasksApp';
import KeepApp from './KeepApp';

interface MailAppProps {
  onClose: () => void;
  data: any;
  searchQuery?: string;
  onUpdateTasks?: (tasks: any[]) => void;
  onUpdateNotes?: (notes: any[]) => void;
  showToast?: (msg: string) => void;
}

// --- HELPERS ---
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
};

const Toggle = ({ checked, onChange }: { checked: boolean, onChange: (val: boolean) => void }) => (
    <button 
        onClick={() => onChange(!checked)}
        className={`w-10 h-5 rounded-full relative transition-colors duration-200 ${checked ? 'bg-blue-600' : 'bg-white/20'}`}
    >
        <div className={`absolute top-1 bottom-1 w-3 h-3 rounded-full bg-white transition-all duration-200 ${checked ? 'left-6' : 'left-1'}`}></div>
    </button>
);

const ContactInput = ({ placeholder, value, onChange, onSelect }: { placeholder: string, value: string, onChange: (val: string) => void, onSelect?: (email: string) => void }) => {
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const fetch = async () => {
            if (value.length > 1) {
                const res = await bridge.searchContacts(value);
                setSuggestions(res);
                setShowSuggestions(res.length > 0);
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        };
        const timeout = setTimeout(fetch, 300);
        return () => clearTimeout(timeout);
    }, [value]);

    return (
        <div className="relative flex-1" ref={wrapperRef}>
            <input 
                type="text" 
                placeholder={placeholder} 
                className="w-full bg-transparent p-2 text-sm text-white outline-none" 
                value={value} 
                onChange={(e) => onChange(e.target.value)} 
                onFocus={() => value.length > 1 && setShowSuggestions(true)}
            />
            {showSuggestions && (
                <div className="absolute top-full left-0 w-full bg-[#2d2e30] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden mt-1">
                    {suggestions.map((s, i) => (
                        <div 
                            key={i} 
                            onClick={() => { onChange(s.email); setShowSuggestions(false); if(onSelect) onSelect(s.email); }}
                            className="flex items-center gap-3 p-2 hover:bg-white/10 cursor-pointer"
                        >
                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                                {s.avatar || s.name[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-white font-medium truncate">{s.name}</p>
                                <p className="text-xs text-white/50 truncate">{s.email}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


const ComposerToolbar = ({ onFormat }: { onFormat: (cmd: string, val?: string) => void }) => (
    <div className="flex items-center gap-1 border-b border-white/10 pb-2 mb-2 sticky top-0 bg-[#1E1E1E] z-10 pt-1">
        <button onMouseDown={(e) => {e.preventDefault(); onFormat('bold')}} className="p-1.5 hover:bg-white/10 rounded text-white/70 hover:text-white transition-colors" title="Negrito"><Bold size={16}/></button>
        <button onMouseDown={(e) => {e.preventDefault(); onFormat('italic')}} className="p-1.5 hover:bg-white/10 rounded text-white/70 hover:text-white transition-colors" title="Itálico"><Italic size={16}/></button>
        <button onMouseDown={(e) => {e.preventDefault(); onFormat('underline')}} className="p-1.5 hover:bg-white/10 rounded text-white/70 hover:text-white transition-colors" title="Sublinhado"><Underline size={16}/></button>
        <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
        <button onMouseDown={(e) => {e.preventDefault(); onFormat('insertUnorderedList')}} className="p-1.5 hover:bg-white/10 rounded text-white/70 hover:text-white transition-colors" title="Lista com marcadores"><ListIcon size={16}/></button>
        <button onMouseDown={(e) => {e.preventDefault(); onFormat('insertOrderedList')}} className="p-1.5 hover:bg-white/10 rounded text-white/70 hover:text-white transition-colors" title="Lista numerada"><ListOrdered size={16}/></button>
        <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
        <button onMouseDown={(e) => {e.preventDefault(); const url=prompt('URL:'); if(url) onFormat('createLink', url)}} className="p-1.5 hover:bg-white/10 rounded text-white/70 hover:text-white transition-colors" title="Link"><LinkIcon size={16}/></button>
        <button onMouseDown={(e) => {e.preventDefault(); onFormat('removeFormat')}} className="p-1.5 hover:bg-white/10 rounded text-white/70 hover:text-white transition-colors" title="Limpar formatação"><RemoveFormatting size={16}/></button>
    </div>
);

const Checkbox = ({ checked, onChange, className }: { checked: boolean, onChange: (e:any) => void, className?: string }) => (
    <div 
        onClick={(e) => { e.stopPropagation(); onChange(e); }} 
        className={`w-5 h-5 rounded-[4px] border-2 flex items-center justify-center cursor-pointer transition-all ${checked ? 'bg-blue-500 border-blue-500' : 'border-white/40 hover:border-white/60'} ${className}`}
        title={checked ? "Desmarcar" : "Marcar"}
    >
        {checked && <Check size={14} className="text-black" strokeWidth={3} />}
    </div>
);

const AdvancedFilterPanel = ({ isOpen, onClose, onApply, setFolder, currentFolder, customLabels, filterCriteria, setFilterCriteria, onCreateLabel }: any) => {
    const [isCreatingLabel, setIsCreatingLabel] = useState(false);
    const [newLabelName, setNewLabelName] = useState('');

    const handleCreate = async () => {
        if (!newLabelName.trim()) return;
        if(onCreateLabel) await onCreateLabel(newLabelName);
        setIsCreatingLabel(false);
        setNewLabelName('');
    };

    if (!isOpen) return null;
    return (
        <div className="absolute top-[130px] left-4 w-[340px] bg-[#2d2e30] border border-white/10 rounded-xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in duration-200 backdrop-blur-xl">
            <div className="mb-4 pb-4 border-b border-white/10 space-y-2">
                <div className="flex justify-between items-center mb-2">
                    <p className="text-[10px] text-white/40 uppercase font-bold px-1">Critérios de Busca</p>
                    <button onClick={onClose} className="text-white/40 hover:text-white"><X size={14}/></button>
                </div>
                <input 
                    type="text" 
                    placeholder="De (Remetente)" 
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500 transition-colors"
                    value={filterCriteria?.from || ''}
                    onChange={(e) => setFilterCriteria && setFilterCriteria({...filterCriteria, from: e.target.value})}
                />
                <input 
                    type="text" 
                    placeholder="Assunto" 
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500 transition-colors"
                    value={filterCriteria?.subject || ''}
                    onChange={(e) => setFilterCriteria && setFilterCriteria({...filterCriteria, subject: e.target.value})}
                />
                <div className="flex items-center gap-2 pt-1 cursor-pointer hover:opacity-80" onClick={() => setFilterCriteria && setFilterCriteria({...filterCriteria, hasAttachment: !filterCriteria?.hasAttachment})}>
                    <Checkbox checked={filterCriteria?.hasAttachment || false} onChange={() => {}} />
                    <span className="text-xs text-white/70">Contém anexos</span>
                </div>
            </div>
            <div className="mb-4 pb-4 border-b border-white/10">
                <div className="flex justify-between items-center mb-2 px-1">
                    <p className="text-[10px] text-white/40 uppercase font-bold">Marcadores</p>
                    <button onClick={() => setIsCreatingLabel(!isCreatingLabel)} className="text-[10px] text-blue-400 hover:underline">Novo +</button>
                </div>
                
                {isCreatingLabel && (
                    <div className="flex gap-2 mb-3">
                        <input 
                            type="text" 
                            className="flex-1 bg-black/20 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500" 
                            placeholder="Nome do marcador"
                            value={newLabelName}
                            onChange={(e) => setNewLabelName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                        />
                        <button onClick={handleCreate} className="bg-blue-600 text-white px-2 py-1 rounded text-xs">Criar</button>
                    </div>
                )}

                <div className="flex flex-wrap gap-2 mb-3 max-h-[100px] overflow-y-auto custom-scrollbar">
                    {customLabels && customLabels.map((label: any) => (
                        <button 
                            key={label.id}
                            onClick={() => { setFolder(label.id); onClose(); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${currentFolder === label.id ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}
                        >
                            <Tag size={12} className={label.colorClass} />
                            {label.name}
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
                <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-white/70 hover:bg-white/5 font-medium">Cancelar</button>
                <button onClick={onApply} className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 shadow-lg shadow-blue-900/20">Aplicar Filtros</button>
            </div>
        </div>
    );
};

// --- CALENDAR HELPERS ---
const expandEvents = (events: any[], viewDate: Date, viewMode: 'day' | 'week' | 'month') => {
    const expanded: any[] = [];
    let viewStart = new Date(viewDate);
    let viewEnd = new Date(viewDate);

    if (viewMode === 'day') {
        viewStart.setHours(0,0,0,0);
        viewEnd.setHours(23,59,59,999);
    } else if (viewMode === 'week') {
        const day = viewStart.getDay();
        const diff = viewStart.getDate() - day;
        viewStart = new Date(viewStart.setDate(diff));
        viewStart.setHours(0,0,0,0);
        viewEnd = new Date(viewStart);
        viewEnd.setDate(viewStart.getDate() + 6);
        viewEnd.setHours(23,59,59,999);
    } else if (viewMode === 'month') {
        viewStart = new Date(viewStart.getFullYear(), viewStart.getMonth(), 1);
        viewEnd = new Date(viewStart.getFullYear(), viewStart.getMonth() + 1, 0);
        viewEnd.setHours(23,59,59,999);
    }

    events.forEach(ev => {
        const evStart = new Date(ev.start);
        const evEnd = new Date(ev.end);
        if (ev.recurrence === 'none' || !ev.recurrence) {
            if (evStart <= viewEnd && evEnd >= viewStart) expanded.push(ev);
            return;
        }
        let currentIter = new Date(evStart);
        // Safety Break for infinite loops
        let safety = 0;
        while (currentIter <= viewEnd && safety < 100) {
            safety++;
            if (currentIter >= viewStart) {
                const duration = evEnd.getTime() - evStart.getTime();
                const projectedStart = new Date(currentIter);
                const projectedEnd = new Date(currentIter.getTime() + duration);
                // Check if this instance falls within view
                if (projectedStart <= viewEnd && projectedEnd >= viewStart) {
                    expanded.push({ ...ev, start: projectedStart, end: projectedEnd, isVirtual: true, id: ev.id + "_" + safety });
                }
            }
            if (ev.recurrence === 'daily') currentIter.setDate(currentIter.getDate() + 1);
            else if (ev.recurrence === 'weekly') currentIter.setDate(currentIter.getDate() + 7);
            else break;
        }
    });
    return expanded;
};

const arrangeEvents = (events: any[]) => {
    // Basic overlapping logic for day view
    const timedEvents = events.filter(e => !e.isAllDay);
    const sorted = [...timedEvents].sort((a, b) => {
        if (a.start.getTime() === b.start.getTime()) return b.end.getTime() - a.end.getTime(); 
        return a.start.getTime() - b.start.getTime();
    });
    const columns: any[][] = [];
    const packedEvents: any[] = [];
    sorted.forEach((event) => {
        let placed = false;
        for (let i = 0; i < columns.length; i++) {
            const col = columns[i];
            const lastEventInCol = col[col.length - 1];
            if (lastEventInCol.end.getTime() <= event.start.getTime()) {
                col.push(event);
                packedEvents.push({ ...event, colIndex: i });
                placed = true;
                break;
            }
        }
        if (!placed) {
            columns.push([event]);
            packedEvents.push({ ...event, colIndex: columns.length - 1 });
        }
    });
    return packedEvents.map(ev => ({ ...ev, widthPercent: 100 / columns.length, leftPercent: (ev.colIndex * 100) / columns.length }));
};

const eventColors = [
    { id: '1', color: 'bg-[#7986CB]', name: 'Lavender' },
    { id: '2', color: 'bg-[#33B679]', name: 'Sage' },
    { id: '3', color: 'bg-[#8E24AA]', name: 'Grape' },
    { id: '4', color: 'bg-[#E67C73]', name: 'Flamingo' },
    { id: '5', color: 'bg-[#F6BF26]', name: 'Banana' },
    { id: '6', color: 'bg-[#F4511E]', name: 'Tangerine' },
    { id: '7', color: 'bg-[#039BE5]', name: 'Peacock' },
    { id: '8', color: 'bg-[#616161]', name: 'Graphite' },
    { id: '9', color: 'bg-[#3F51B5]', name: 'Blueberry' },
    { id: '10', color: 'bg-[#0B8043]', name: 'Basil' },
    { id: '11', color: 'bg-[#D50000]', name: 'Tomato' }
];

export default function MailApp({ onClose, data, searchQuery = '', onUpdateTasks, onUpdateNotes, showToast }: MailAppProps) {
  const appHeaderClass = "h-20 px-6 flex items-center justify-between shrink-0 border-b border-white/5 backdrop-blur-xl z-20";

  // --- ESTADOS ---
  const [emails, setEmails] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>(data?.tasks || []);
  const [notes, setNotes] = useState<any[]>(data?.notes || []);
  
  // Selection State
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string | number>>(new Set());
  const [lastSelectedEmailId, setLastSelectedEmailId] = useState<string | number | null>(null);

  // Settings State
  const [settingsTab, setSettingsTab] = useState<'general' | 'mail' | 'calendar'>('general');
  const [mailSettings, setMailSettings] = useState({
      signature: 'Atenciosamente,\n[Seu Nome]',
      vacationResponder: false,
      vacationMessage: 'Estarei ausente e responderei assim que possível.',
      density: 'comfortable',
      notifications: true
  });
  const [calendarSettings, setCalendarSettings] = useState({
      workingHours: { start: '09:00', end: '18:00' },
      defaultDuration: 60,
      view: 'week',
      notifications: true
  });
  
  // Pagination State
  const [loadingMore, setLoadingMore] = useState(false);
  const [emailOffset, setEmailOffset] = useState(0);
  
  // Navigation & UI
  const [activePane, setActivePane] = useState<'agenda' | 'email' | 'compose' | 'tasks' | 'keep' | 'event-create' | 'event-view' | 'settings'>('agenda');
  const [mailFolder, setMailFolder] = useState<string>('inbox');
  const [rightPanelWidth, setRightPanelWidth] = useState(typeof window !== 'undefined' ? window.innerWidth / 2 : 600);
  const [showNewMenu, setShowNewMenu] = useState(false); 
  const [calendarViewMode, setCalendarViewMode] = useState<'day' | 'week' | 'month'>('day');
  const [viewDate, setViewDate] = useState(new Date());
  
  // Filtering
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  const [filterCriteria, setFilterCriteria] = useState({ from: '', subject: '', hasAttachment: false });
  const [customLabels, setCustomLabels] = useState<any[]>([
      { id: 'label_project', name: 'Projetos', colorClass: 'text-blue-400' },
      { id: 'label_finance', name: 'Financeiro', colorClass: 'text-green-400' },
      { id: 'label_personal', name: 'Pessoal', colorClass: 'text-yellow-400' }
  ]);

  // Event State
  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [guestInput, setGuestInput] = useState('');
  const [dragState, setDragState] = useState<{ id: number | string; type: 'move' | 'resize'; startY: number; originalStart: Date; originalEnd: Date; } | null>(null);
  const [eventColorId, setEventColorId] = useState('7');
  const [useMeet, setUseMeet] = useState(false);

  // Email State
  const [activeEmail, setActiveEmail] = useState<any>(null);
  const [activeThreadMessages, setActiveThreadMessages] = useState<any[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  
  // Quick Reply State (New)
  const [quickReplyText, setQuickReplyText] = useState('');
  const [isQuickReplying, setIsQuickReplying] = useState(false);

  // Composer State
  const [composeAttachments, setComposeAttachments] = useState<{file: File, name: string, size: string}[]>([]);
  const [composeTo, setComposeTo] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeBcc, setComposeBcc] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [isComposerMinimized, setIsComposerMinimized] = useState(false);
  
  // Ref
  const calendarRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use global toast if available, else console log
  const toast = (msg: string) => showToast ? showToast(msg) : console.log(msg);

  useEffect(() => {
    if (data) {
        if (data.emails) {
             const enhanced = data.emails.map((e:any, index: number) => ({
                 ...e, folder: 'inbox', read: false, isStarred: index === 1, labels: index === 0 ? ['label_project'] : [], hasAttachment: index % 2 === 0
             }));
             setEmails(enhanced);
             setEmailOffset(enhanced.length);
        }
        if (data.events) setCalendarEvents(data.events);
        if (data.tasks) setTasks(data.tasks);
        if (data.notes) setNotes(data.notes);
    }
  }, [data]);

  const handleSaveSettings = () => {
      toast("Configurações salvas com sucesso!");
  };

  const handleCreateLabel = async (name: string) => {
      const newLabel = { id: `label_${Date.now()}`, name, colorClass: 'text-gray-400' };
      setCustomLabels(prev => [...prev, newLabel]);
      toast(`Marcador "${name}" criado`);
      await bridge.createLabel(name);
  };

  // Handle Search Execution
  const executeSearch = async () => {
      setLoadingMore(true);
      let query = localSearch;
      if (filterCriteria.from) query += ` from:${filterCriteria.from}`;
      if (filterCriteria.subject) query += ` subject:${filterCriteria.subject}`;
      if (filterCriteria.hasAttachment) query += ` has:attachment`;
      
      try {
          const results = await bridge.getEmailsPaged(0, 20, mailFolder, query);
          setEmails(results); // Replace current list
          setEmailOffset(results.length);
      } catch (e) {
          console.error(e);
          toast("Erro na busca.");
      } finally {
          setLoadingMore(false);
      }
  };

  // Handle Folder Change (Reset Pagination)
  useEffect(() => {
      if (mailFolder !== 'inbox' && !mailFolder.startsWith('label_')) {
          setEmailOffset(0);
      }
  }, [mailFolder]);

  // Load More Handler
  const handleLoadMore = async () => {
      setLoadingMore(true);
      try {
          let query = localSearch;
          if (filterCriteria.from) query += ` from:${filterCriteria.from}`;
          if (filterCriteria.subject) query += ` subject:${filterCriteria.subject}`;
          if (filterCriteria.hasAttachment) query += ` has:attachment`;

          const newEmails = await bridge.getEmailsPaged(emailOffset, 20, mailFolder, query);
          if (newEmails && newEmails.length > 0) {
              setEmails(prev => [...prev, ...newEmails]);
              setEmailOffset(prev => prev + newEmails.length);
          } else {
              toast("Não há mais mensagens.");
          }
      } catch (e) {
          console.error(e);
          toast("Erro ao carregar mais mensagens.");
      } finally {
          setLoadingMore(false);
      }
  };

  // Sync callbacks
  const handleUpdateTasks = (newTasks: any[]) => { setTasks(newTasks); if(onUpdateTasks) onUpdateTasks(newTasks); };
  const handleUpdateNotes = (newNotes: any[]) => { setNotes(newNotes); if(onUpdateNotes) onUpdateNotes(newNotes); };

  // --- SELECTION LOGIC ---
  const handleEmailSelection = (e: React.MouseEvent, id: string | number) => {
      e.stopPropagation();
      const allIds = displayedEmails.map(email => email.id);

      if (e.shiftKey && lastSelectedEmailId) {
          const start = allIds.indexOf(lastSelectedEmailId);
          const end = allIds.indexOf(id);
          
          if (start !== -1 && end !== -1) {
              const [lower, upper] = [Math.min(start, end), Math.max(start, end)];
              const rangeIds = allIds.slice(lower, upper + 1);
              const newSet = new Set(e.ctrlKey || e.metaKey ? selectedEmailIds : []);
              rangeIds.forEach(itemId => newSet.add(itemId));
              setSelectedEmailIds(newSet);
              return; 
          }
      }

      const newSet = new Set(selectedEmailIds);
      if (newSet.has(id)) {
          newSet.delete(id);
      } else {
          newSet.add(id);
          setLastSelectedEmailId(id);
      }
      setSelectedEmailIds(newSet);
  };

  const handleSelectAll = () => {
      if (selectedEmailIds.size === displayedEmails.length) {
          setSelectedEmailIds(new Set());
      } else {
          const allIds = displayedEmails.map(e => e.id);
          setSelectedEmailIds(new Set(allIds));
      }
  };

  // --- BATCH ACTIONS ---
  const handleBatchAction = async (action: 'archive' | 'trash' | 'read' | 'unread' | 'spam') => {
      const ids = Array.from(selectedEmailIds) as (string | number)[];
      if (ids.length === 0) return;

      if (action === 'archive' || action === 'trash' || action === 'spam') {
          setEmails(prev => prev.filter(e => !selectedEmailIds.has(e.id)));
      } else if (action === 'read') {
          setEmails(prev => prev.map(e => selectedEmailIds.has(e.id) ? { ...e, read: true } : e));
      } else if (action === 'unread') {
          setEmails(prev => prev.map(e => selectedEmailIds.has(e.id) ? { ...e, read: false } : e));
      }

      setSelectedEmailIds(new Set());
      setLastSelectedEmailId(null);
      
      const count = ids.length;
      const actionName = action === 'trash' ? 'excluídos' : action === 'archive' ? 'arquivados' : 'atualizados';
      toast(`${count} e-mails ${actionName}.`);

      await bridge.batchManageEmails(ids, action);
  };

  const handleEmailClick = async (email: any) => {
      if (selectedEmailIds.size > 0) {
          const newSet = new Set(selectedEmailIds);
          if (newSet.has(email.id)) newSet.delete(email.id);
          else newSet.add(email.id);
          setSelectedEmailIds(newSet);
          return;
      }

      if (email.folder === 'drafts') {
          setComposeTo(email.to || '');
          setComposeSubject(email.subject || '');
          if(editorRef.current) editorRef.current.innerHTML = email.preview || '';
          setActivePane('compose');
          setIsComposerMinimized(false);
      } else {
          setActiveEmail(email);
          setActivePane('email');
          setLoadingThread(true);
          setQuickReplyText('');
          
          if (!email.read) {
              setEmails(prev => prev.map(e => e.id === email.id ? { ...e, read: true } : e));
          }

          try {
              const details = await bridge.getThreadDetails(email.id);
              if (details.success && details.messages) {
                  setActiveThreadMessages(details.messages);
              }
          } catch(e) {
              console.error("Failed to load thread", e);
          } finally {
              setLoadingThread(false);
          }
      }
  };

  const handleDownloadAttachment = async (msgId: string, attIndex: number, filename: string) => {
      toast(`Baixando ${filename}...`);
      try {
          const res = await bridge.getEmailAttachment(msgId, attIndex);
          if (res.success && res.data) {
              const link = document.createElement('a');
              link.href = `data:${res.mimeType};base64,${res.data}`;
              link.download = filename;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
          } else {
              toast("Erro ao baixar anexo.");
          }
      } catch(e) {
          console.error(e);
          toast("Erro ao baixar anexo.");
      }
  };

  // --- TASK FROM EMAIL ---
  const handleCreateTaskFromEmail = async () => {
      if (!activeEmail) return;
      const title = activeEmail.subject;
      const details = `E-mail de: ${activeEmail.sender} em ${activeEmail.time}`;
      
      const response = await bridge.createTask(title, details);
      if (response.success && response.task) {
          setTasks(prev => [response.task, ...prev]);
          if(onUpdateTasks) onUpdateTasks([response.task, ...tasks]);
          toast("Tarefa criada a partir do e-mail");
          setActivePane('tasks');
      } else {
          toast("Erro ao criar tarefa");
      }
  };

  // --- CALENDAR LOGIC ---
  const handleSaveEvent = async () => {
      if (!activeEvent.title) { toast("Adicione um título"); return; }
      
      const newEvent = { 
          ...activeEvent, 
          id: activeEvent.id && typeof activeEvent.id === 'string' && activeEvent.id.length > 10 ? activeEvent.id : Date.now().toString(), 
          start: activeEvent.start, 
          end: activeEvent.end, 
          recurrence: activeEvent.recurrence || 'none', 
          color: activeEvent.color || 'bg-blue-500',
          guests: activeEvent.guests || []
      };

      setCalendarEvents(prev => {
          const exists = prev.find(e => e.id === newEvent.id);
          if (exists) return prev.map(e => e.id === newEvent.id ? newEvent : e);
          return [...prev, newEvent];
      });
      
      const isExisting = activeEvent.id && typeof activeEvent.id === 'string' && activeEvent.id.length > 10;

      if (isExisting) {
          await bridge.updateCalendarEvent(newEvent);
          toast("Evento atualizado");
      } else {
          await bridge.createCalendarEvent(newEvent);
          toast("Evento criado");
      }
      
      setActivePane('agenda');
  };

  const handleDeleteEvent = async () => {
      if (activeEvent && activeEvent.id) {
          setCalendarEvents(prev => prev.filter(e => e.id !== activeEvent.id));
          await bridge.deleteCalendarEvent(activeEvent.id);
          toast("Evento excluído");
          setActivePane('agenda');
      }
  };

  const initEventCreation = (start: Date, end: Date) => { setActiveEvent({start, end, title: ''}); setEventColorId('7'); setUseMeet(false); setActivePane('event-create'); };

  const handleAddGuest = (email?: string) => {
      const val = email || guestInput;
      if (val.trim()) {
          const newGuests = [...(activeEvent.guests || []), { name: val, email: val, avatar: val[0].toUpperCase() }];
          setActiveEvent({ ...activeEvent, guests: newGuests });
          setGuestInput('');
      }
  };

  // --- CALENDAR DRAG ---
  useEffect(() => {
      const handleGlobalMouseMove = (e: MouseEvent) => {
          if (!dragState) return;
          const pixelDiff = e.clientY - dragState.startY;
          const snappedMinutes = Math.round(pixelDiff / 15) * 15;
          setCalendarEvents(prev => prev.map(ev => {
              if (ev.id !== dragState.id) return ev;
              const newStart = new Date(dragState.originalStart);
              const newEnd = new Date(dragState.originalEnd);
              if (dragState.type === 'move') { newStart.setMinutes(dragState.originalStart.getMinutes() + snappedMinutes); newEnd.setMinutes(dragState.originalEnd.getMinutes() + snappedMinutes); } 
              else if (dragState.type === 'resize') { newEnd.setMinutes(dragState.originalEnd.getMinutes() + snappedMinutes); if (newEnd <= newStart) newEnd.setMinutes(newStart.getMinutes() + 15); }
              return { ...ev, start: newStart, end: newEnd };
          }));
      };
      const handleGlobalMouseUp = async () => {
          if (dragState) {
              const event = calendarEvents.find(e => e.id === dragState.id);
              if (event) { 
                  await bridge.updateCalendarEvent(event); 
                  toast('Agenda atualizada'); 
              }
              setDragState(null); document.body.style.cursor = '';
          }
      };
      if (dragState) { window.addEventListener('mousemove', handleGlobalMouseMove); window.addEventListener('mouseup', handleGlobalMouseUp); document.body.style.cursor = dragState.type === 'move' ? 'grabbing' : 'ns-resize'; }
      return () => { window.removeEventListener('mousemove', handleGlobalMouseMove); window.removeEventListener('mouseup', handleGlobalMouseUp); };
  }, [dragState, calendarEvents]);

  const handleCalendarMouseDown = (e: React.MouseEvent, id: number | string, type: 'move' | 'resize', start: Date, end: Date) => { e.stopPropagation(); setDragState({ id, type, startY: e.clientY, originalStart: start, originalEnd: end }); };

  // --- EMAIL SENDING ---
  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
          const newFiles = Array.from(e.target.files).map((f: File) => ({ file: f, name: f.name, size: (f.size / 1024).toFixed(1) + ' KB' }));
          setComposeAttachments(prev => [...prev, ...newFiles]);
      }
  };

  const handleFormat = (cmd: string, val?: string) => {
      document.execCommand(cmd, false, val);
      editorRef.current?.focus();
  };

  const handleSendEmail = async () => {
      if (!composeTo && !composeSubject) { toast("Preencha destinatário e assunto"); return; }
      const body = editorRef.current ? editorRef.current.innerHTML : "...";
      const processedAttachments: EmailAttachment[] = [];
      for (const att of composeAttachments) {
          try { const base64 = await fileToBase64(att.file); processedAttachments.push({ name: att.name, mimeType: att.file.type, data: base64 }); } catch (err) { console.error("Erro anexo", err); }
      }
      await bridge.sendEmail(composeTo, composeSubject, body, processedAttachments);
      
      if (isComposerMinimized) {
          setIsComposerMinimized(false);
          setActivePane('agenda'); 
      } else {
          setActivePane('agenda');
      }

      if(editorRef.current) editorRef.current.innerHTML = '';
      setComposeTo(''); setComposeSubject(''); setComposeAttachments([]);
      toast('Mensagem enviada');
    };

  const handleCloseComposer = async () => {
      const content = editorRef.current?.innerText.trim();
      if (content || composeSubject || composeTo) {
          await bridge.saveDraft(composeTo, composeSubject, editorRef.current?.innerHTML || '');
          const draft = { id: Date.now(), sender: "Rascunho", senderInit: "R", subject: composeSubject || "(Sem assunto)", preview: content || "...", time: "Rascunho", read: true, folder: 'drafts', to: composeTo, color: 'bg-gray-600', hasAttachment: composeAttachments.length > 0 };
          setEmails(prev => [draft, ...prev]);
          toast('Rascunho salvo');
      }
      setIsComposerMinimized(false);
      setActivePane('agenda');
      if(editorRef.current) editorRef.current.innerHTML = '';
      setComposeTo(''); setComposeSubject(''); setComposeAttachments([]);
  };

  const handleMinimizeComposer = () => {
      setIsComposerMinimized(!isComposerMinimized);
      if (!isComposerMinimized) {
           setActivePane('agenda');
      } else {
           setActivePane('compose');
      }
  };

  // --- REPLY / FORWARD LOGIC ---
  const handleReply = () => {
      if (!activeEmail) return;
      setComposeTo(activeEmail.sender); 
      setComposeSubject(`Re: ${activeEmail.subject}`);
      
      const lastMsg = activeThreadMessages[activeThreadMessages.length - 1];
      const quote = lastMsg ? `<br/><br/><div class="gmail_quote">Em ${lastMsg.date}, ${lastMsg.from} escreveu:<br/><blockquote class="gmail_quote" style="margin:0 0 0 .8ex;border-left:1px #ccc solid;padding-left:1ex">${lastMsg.body || lastMsg.plainBody}</blockquote></div>` : '';
      
      setActivePane('compose');
      setIsComposerMinimized(false);
      setTimeout(() => {
          if (editorRef.current) {
              editorRef.current.innerHTML = quote;
              editorRef.current.focus();
              const range = document.createRange();
              const sel = window.getSelection();
              range.setStart(editorRef.current, 0);
              range.collapse(true);
              sel?.removeAllRanges();
              sel?.addRange(range);
          }
      }, 100);
  };

  const handleForward = () => {
      if (!activeEmail) return;
      setComposeTo('');
      setComposeSubject(`Fwd: ${activeEmail.subject}`);
      
      const lastMsg = activeThreadMessages[activeThreadMessages.length - 1];
      const quote = lastMsg ? `<br/><br/>---------- Mensagem encaminhada ----------<br/>De: ${lastMsg.from}<br/>Data: ${lastMsg.date}<br/>Assunto: ${activeEmail.subject}<br/>Para: ${lastMsg.to}<br/><br/>${lastMsg.body || lastMsg.plainBody}` : '';

      setActivePane('compose');
      setIsComposerMinimized(false);
      setTimeout(() => {
          if (editorRef.current) {
              editorRef.current.innerHTML = quote;
              editorRef.current.focus();
              const range = document.createRange();
              const sel = window.getSelection();
              range.setStart(editorRef.current, 0);
              range.collapse(true);
              sel?.removeAllRanges();
              sel?.addRange(range);
          }
      }, 100);
  };

  const handleQuickReply = async () => {
      if (!activeEmail || !quickReplyText.trim()) return;
      setIsQuickReplying(true);
      await bridge.sendEmail(activeEmail.sender, `Re: ${activeEmail.subject}`, quickReplyText);
      setQuickReplyText('');
      setIsQuickReplying(false);
      toast("Resposta enviada");
  };

  // --- RENDER & FILTER ---
  const displayedEmails = emails.filter(e => {
      return true;
  }).sort((a, b) => (a.read !== b.read ? (a.read ? 1 : -1) : 0));

  const hours24 = Array.from({ length: 24 }, (_, i) => i);
  // Expand events based on view
  const expandedEvents = expandEvents(calendarEvents, viewDate, calendarViewMode === 'day' ? 'day' : calendarViewMode === 'week' ? 'week' : 'month');
  
  // Arrange Day View Events
  const dayEvents = calendarViewMode === 'day' ? arrangeEvents(expandedEvents.filter(ev => new Date(ev.start).getDate() === viewDate.getDate())) : [];

  const primaryFolders = [ { id: 'inbox', label: 'Entrada', icon: Inbox }, { id: 'drafts', label: 'Rascunhos', icon: FileIcon }, { id: 'spam', label: 'Spam', icon: AlertOctagon }, { id: 'trash', label: 'Lixeira', icon: Trash2 }, ];

  return (
    <div className="flex flex-col h-full bg-[#191919] relative text-white" onContextMenu={(e) => e.preventDefault()}>
        {/* Header */}
        <div className={appHeaderClass}>
            <div className="flex items-center gap-4 w-72">
                <div className="flex items-center gap-3">
                    <GoogleIcons.GmailGlass className="w-10 h-10 hover:-translate-y-1 drop-shadow-md" />
                    <span className="text-white text-xl font-light">Email & Calendário</span>
                </div>
            </div>
            <div className="flex items-center gap-4 w-64 justify-end">
                <button onClick={() => setActivePane('settings')} className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${activePane === 'settings' ? 'bg-white/20' : 'bg-white/5 hover:bg-white/10'}`}>
                    <Settings size={20} className="text-white/80" />
                </button>
                <div className="h-8 w-[1px] bg-white/10"></div>
                <div className="p-2 hover:bg-white/10 rounded-full cursor-pointer text-white/80" onClick={onClose}><X size={24} /></div>
            </div>
        </div>

        <div className="flex-1 flex overflow-hidden relative p-3 gap-3">
            {/* Left Panel (Mail List) */}
            <div className="flex-1 flex flex-col bg-[#1E1E1E] rounded-[24px] border border-white/5 overflow-hidden relative">
                {/* ... (Search & List rendering code remains same) ... */}
                <div className="flex flex-col border-b border-white/5 bg-[#1E1E1E] shrink-0">
                    <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                         <div className="flex-1 bg-white/5 border border-white/10 rounded-xl h-10 flex items-center px-3 relative focus-within:bg-black/20 focus-within:border-blue-500/50 transition-all">
                             <Search size={16} className="text-white/40"/>
                             <input 
                                type="text" 
                                placeholder="Filtrar emails (Enter para buscar)" 
                                className="bg-transparent border-none outline-none flex-1 ml-2 text-sm text-white placeholder:text-white/30"
                                value={localSearch}
                                onChange={(e) => setLocalSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && executeSearch()}
                             />
                             <button onClick={() => setShowFilterPanel(!showFilterPanel)} className={`p-1.5 rounded-lg transition-colors ${showFilterPanel ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-white/10 text-white/60'}`} title="Filtros Avançados">
                                 <SlidersHorizontal size={16}/>
                             </button>
                         </div>
                         <button onClick={() => setShowNewMenu(!showNewMenu)} className="bg-[#C2E7FF] text-[#001D35] h-10 w-10 rounded-xl flex items-center justify-center hover:shadow-lg transition-all hover:scale-105 active:scale-95"><Plus size={24}/></button>
                         
                         {showNewMenu && (
                            <div className="absolute top-[60px] right-4 w-48 bg-[#2d2e30] border border-white/10 rounded-xl shadow-2xl py-1 z-50">
                                <button onClick={() => { setActivePane('compose'); setIsComposerMinimized(false); setShowNewMenu(false); }} className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-white/5"><Mail size={16}/><span className="text-sm">Novo E-mail</span></button>
                                <button onClick={() => { setActiveEvent({ title: '', start: new Date(), end: new Date() }); setActivePane('event-create'); setShowNewMenu(false); }} className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-white/5"><CalendarIcon size={16}/><span className="text-sm">Novo Evento</span></button>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar px-4 py-3 mask-linear-fade">
                        {primaryFolders.map(folder => (
                            <button key={folder.id} onClick={() => setMailFolder(folder.id as any)} className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap ${mailFolder === folder.id ? 'bg-white/10 text-white border border-white/10' : 'text-white/60 hover:bg-white/5'}`}>
                                <folder.icon size={14}/> {folder.label}
                            </button>
                        ))}
                        <div className="w-[1px] h-6 bg-white/10 mx-1 shrink-0"></div>
                        <button onClick={() => setActivePane('settings')} className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap ${activePane === 'settings' ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5'}`}>
                            <Settings size={14}/> Config
                        </button>
                    </div>

                    <AdvancedFilterPanel 
                        isOpen={showFilterPanel} 
                        onClose={() => setShowFilterPanel(false)}
                        onApply={() => { setShowFilterPanel(false); executeSearch(); }}
                        setFolder={setMailFolder}
                        currentFolder={mailFolder}
                        customLabels={customLabels}
                        filterCriteria={filterCriteria}
                        setFilterCriteria={setFilterCriteria}
                        onCreateLabel={handleCreateLabel}
                    />
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 relative bg-[#191919]">
                    <div className="flex flex-col gap-1">
                        {displayedEmails.map((email: any) => (
                            <div key={email.id} className="relative group mb-2">
                                <div className={`relative z-10 ${!email.read ? 'bg-white/10 border-l-4 border-blue-500' : 'bg-white/5'} hover:bg-[#2A2A2A] rounded-2xl transition-all duration-200 py-4 px-4 flex items-start gap-3 cursor-pointer`} onClick={() => handleEmailClick(email)}>
                                    <div className="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                        <div onClick={(e) => handleEmailSelection(e, email.id)} className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer ${selectedEmailIds.has(email.id) ? 'bg-blue-500 border-blue-500' : 'border-white/20'}`}>
                                            {selectedEmailIds.has(email.id) && <Check size={14} className="text-white"/>}
                                        </div>
                                    </div>
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${email.color || 'bg-blue-600'} transition-opacity ${selectedEmailIds.has(email.id) ? 'opacity-0' : 'opacity-100'}`}>
                                        {email.senderInit || email.sender[0]}
                                    </div>
                                    <div className="flex-1 min-w-0 ml-2">
                                        <div className="flex justify-between items-start mb-0.5 relative h-5"><span className={`text-sm ${!email.read ? 'text-white font-bold' : 'text-white/70 font-medium'}`}>{email.sender}</span><span className="text-[10px] text-white/40">{email.time}</span></div>
                                        <div className="flex items-center gap-2 mb-1">{email.hasAttachment && <PaperclipIcon size={12} className="text-white/60"/><h4 className={`text-xs truncate flex-1 ${!email.read ? 'text-white font-bold' : 'text-white/70 font-medium'}`}>{email.subject}</h4>}</div>
                                        <p className={`text-[11px] truncate ${!email.read ? 'text-white/60' : 'text-white/40'}`}>{email.preview}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {displayedEmails.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-64 text-white/30">
                                <Search size={32} className="mb-2 opacity-50"/>
                                <p className="text-sm">Nenhum e-mail encontrado</p>
                                <button onClick={() => { setLocalSearch(""); executeSearch(); }} className="mt-2 text-blue-400 text-xs">Limpar busca</button>
                            </div>
                        )}
                    </div>
                    
                    {/* Load More Pagination */}
                    {displayedEmails.length > 0 && (
                        <div className="flex justify-center p-4">
                            <button 
                                onClick={handleLoadMore}
                                disabled={loadingMore}
                                className="text-xs text-white/50 hover:text-white transition-colors bg-white/5 px-4 py-2 rounded-full disabled:opacity-50 flex items-center gap-2"
                            >
                                {loadingMore ? <Loader2 size={12} className="animate-spin"/> : null}
                                Carregar mais antigos
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel */}
            <div className={`flex flex-col bg-[#1E1E1E] rounded-[24px] border border-white/5 overflow-hidden relative transition-all duration-0 ease-linear`} style={{ width: rightPanelWidth }}>
                <div className="h-14 flex items-center justify-between px-6 border-b border-white/5 shrink-0 bg-[#1E1E1E] z-20 relative">
                    {/* Batch Actions Toolbar */}
                    {selectedEmailIds.size > 0 ? (
                        <div className="flex items-center w-full gap-4 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center gap-2">
                                <button onClick={() => setSelectedEmailIds(new Set())} className="p-1 hover:bg-white/10 rounded"><X size={16}/></button>
                                <span className="text-sm font-medium">{selectedEmailIds.size} selecionados</span>
                            </div>
                            <div className="h-6 w-[1px] bg-white/10 mx-2"></div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => handleBatchAction('archive')} className="p-2 hover:bg-white/10 rounded text-white/70 hover:text-white" title="Arquivar"><Archive size={18}/></button>
                                <button onClick={() => handleBatchAction('trash')} className="p-2 hover:bg-white/10 rounded text-white/70 hover:text-red-400" title="Excluir"><Trash2 size={18}/></button>
                                <button onClick={() => handleBatchAction('read')} className="p-2 hover:bg-white/10 rounded text-white/70 hover:text-white" title="Marcar como lida"><MailOpen size={18}/></button>
                                <button onClick={() => handleBatchAction('spam')} className="p-2 hover:bg-white/10 rounded text-white/70 hover:text-white" title="Reportar Spam"><AlertOctagon size={18}/></button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex bg-white/5 backdrop-blur-xl border border-white/10 p-1 rounded-[99px] h-[40px] items-center gap-1 w-full overflow-x-auto custom-scrollbar">
                            {['email', 'agenda', 'tasks', 'keep'].map((tab: any) => (
                                <button key={tab} onClick={() => setActivePane(tab)} className={`flex-1 min-w-[70px] h-full rounded-full text-xs font-medium transition-all flex items-center justify-center gap-2 ${activePane.includes(tab) ? 'bg-white/10 text-white shadow-sm border border-white/5' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}>
                                    {tab === 'email' && <Mail size={14} />} {tab === 'agenda' && <LayoutTemplate size={14} />} {tab === 'tasks' && <CheckCircle size={14} />} {tab === 'keep' && <StickyNote size={14} />}
                                    <span className="capitalize hidden md:inline">{tab === 'email' ? 'Leitura' : tab}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* SETTINGS VIEW */}
                <div className={`absolute inset-0 top-14 bottom-0 w-full bg-[#1E1E1E] transition-opacity duration-300 ${activePane === 'settings' ? 'opacity-100 z-50' : 'opacity-0 z-0 pointer-events-none'}`}>
                     <div className="flex h-full">
                         {/* Settings Sidebar */}
                         <div className="w-64 border-r border-white/5 p-4 flex flex-col gap-1">
                             <h3 className="text-sm font-bold text-white/40 uppercase mb-2 px-2">Configurações</h3>
                             <button onClick={() => setSettingsTab('general')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${settingsTab === 'general' ? 'bg-[#4E79F3] text-white shadow-lg shadow-blue-900/20' : 'text-white/60 hover:bg-white/5'}`}>
                                 <Sliders size={18}/> Geral
                             </button>
                             <button onClick={() => setSettingsTab('mail')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${settingsTab === 'mail' ? 'bg-[#EA4335] text-white shadow-lg shadow-red-900/20' : 'text-white/60 hover:bg-white/5'}`}>
                                 <Mail size={18}/> Email
                             </button>
                             <button onClick={() => setSettingsTab('calendar')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${settingsTab === 'calendar' ? 'bg-[#34A853] text-white shadow-lg shadow-green-900/20' : 'text-white/60 hover:bg-white/5'}`}>
                                 <CalendarIcon size={18}/> Agenda
                             </button>
                         </div>

                         {/* Settings Content */}
                         <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                             {settingsTab === 'general' && (
                                 <div className="max-w-xl space-y-6 animate-in fade-in slide-in-from-right-10 duration-300">
                                     <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                                         <h4 className="text-lg font-medium text-white mb-4">Notificações e Sistema</h4>
                                         <div className="flex items-center justify-between py-3 border-b border-white/5">
                                             <span className="text-white/80 text-sm">Sons de notificação</span>
                                             <Toggle checked={true} onChange={() => {}}/>
                                         </div>
                                         <div className="flex items-center justify-between py-3">
                                             <span className="text-white/80 text-sm">Tema escuro forçado</span>
                                             <Toggle checked={true} onChange={() => {}}/>
                                         </div>
                                     </div>
                                 </div>
                             )}

                             {settingsTab === 'mail' && (
                                 <div className="max-w-xl space-y-6 animate-in fade-in slide-in-from-right-10 duration-300">
                                     <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                                         <h4 className="text-lg font-medium text-white mb-4">Assinatura de E-mail</h4>
                                         <textarea 
                                             className="w-full h-32 bg-black/20 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-[#EA4335]"
                                             value={mailSettings.signature}
                                             onChange={(e) => setMailSettings({...mailSettings, signature: e.target.value})}
                                         />
                                     </div>
                                     <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                                         <div className="flex items-center justify-between mb-4">
                                             <h4 className="text-lg font-medium text-white">Resposta Automática (Férias)</h4>
                                             <Toggle checked={mailSettings.vacationResponder} onChange={(val) => setMailSettings({...mailSettings, vacationResponder: val})}/>
                                         </div>
                                         {mailSettings.vacationResponder && (
                                             <textarea 
                                                 className="w-full h-24 bg-black/20 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-[#EA4335] animate-in fade-in"
                                                 value={mailSettings.vacationMessage}
                                                 onChange={(e) => setMailSettings({...mailSettings, vacationMessage: e.target.value})}
                                                 placeholder="Mensagem de ausência..."
                                             />
                                         )}
                                     </div>
                                 </div>
                             )}

                             {settingsTab === 'calendar' && (
                                 <div className="max-w-xl space-y-6 animate-in fade-in slide-in-from-right-10 duration-300">
                                     <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                                         <h4 className="text-lg font-medium text-white mb-4">Horário de Trabalho</h4>
                                         <div className="flex gap-4">
                                             <div className="flex-1">
                                                 <label className="text-xs text-white/50 block mb-1">Início</label>
                                                 <input type="time" value={calendarSettings.workingHours.start} onChange={(e) => setCalendarSettings({...calendarSettings, workingHours: {...calendarSettings.workingHours, start: e.target.value}})} className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white text-sm outline-none"/>
                                             </div>
                                             <div className="flex-1">
                                                 <label className="text-xs text-white/50 block mb-1">Fim</label>
                                                 <input type="time" value={calendarSettings.workingHours.end} onChange={(e) => setCalendarSettings({...calendarSettings, workingHours: {...calendarSettings.workingHours, end: e.target.value}})} className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white text-sm outline-none"/>
                                             </div>
                                         </div>
                                     </div>
                                     <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                                         <h4 className="text-lg font-medium text-white mb-4">Preferências</h4>
                                         <div className="flex items-center justify-between py-3">
                                             <span className="text-white/80 text-sm">Visualização Padrão</span>
                                             <select value={calendarSettings.view} onChange={(e) => setCalendarSettings({...calendarSettings, view: e.target.value})} className="bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-white text-sm outline-none">
                                                 <option value="day">Dia</option>
                                                 <option value="week">Semana</option>
                                                 <option value="month">Mês</option>
                                             </select>
                                         </div>
                                     </div>
                                 </div>
                             )}

                             <div className="flex justify-end pt-4">
                                 <button onClick={handleSaveSettings} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-full text-white font-medium text-sm transition-colors shadow-lg">Salvar Alterações</button>
                             </div>
                         </div>
                     </div>
                </div>

                {/* EMAIL READING PANE */}
                <div className={`absolute inset-0 top-14 bottom-0 w-full bg-[#1E1E1E] transition-opacity duration-300 ${activePane === 'email' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                     {/* Reader content ... same as before */}
                     {activeEmail ? (
                        <div className="flex flex-col h-full">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
                                <div className="flex items-center gap-4">
                                    <button onClick={() => setActivePane('agenda')} className="p-2 hover:bg-white/10 rounded-full text-white/60 md:hidden"><ChevronLeft size={20}/></button>
                                    <h2 className="text-lg font-medium text-white truncate max-w-md">{activeEmail.subject}</h2>
                                </div>
                                <div className="flex items-center gap-2 text-white/60">
                                    <button className="p-2 hover:bg-white/10 rounded-full" onClick={handleCreateTaskFromEmail} title="Adicionar às Tarefas"><CheckSquare size={18}/></button>
                                    <button className="p-2 hover:bg-white/10 rounded-full" title="Arquivar"><Archive size={18}/></button>
                                    <button className="p-2 hover:bg-white/10 rounded-full" title="Spam"><AlertOctagon size={18}/></button>
                                    <button className="p-2 hover:bg-white/10 rounded-full hover:text-red-400" title="Excluir"><Trash2 size={18}/></button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pb-20">
                                {loadingThread ? (
                                    <div className="flex items-center justify-center h-40">
                                        <Loader2 size={32} className="text-blue-500 animate-spin" />
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {activeThreadMessages.length > 0 ? activeThreadMessages.map((msg: any, i: number) => (
                                            <div key={i} className={`rounded-xl border border-white/10 p-4 ${i === activeThreadMessages.length - 1 ? 'bg-white/5' : 'bg-transparent'}`}>
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-blue-600`}>
                                                            {msg.senderInit || msg.from[0]}
                                                        </div>
                                                        <div>
                                                            <span className="text-sm font-bold text-white block">{msg.from}</span>
                                                            <span className="text-xs text-white/40">para {msg.to}</span>
                                                        </div>
                                                    </div>
                                                    <span className="text-xs text-white/40">{msg.date}</span>
                                                </div>
                                                <div className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap font-light" dangerouslySetInnerHTML={{__html: msg.body || msg.plainBody}}></div>
                                                {msg.attachments && msg.attachments.length > 0 && (
                                                    <div className="flex gap-2 mt-4 overflow-x-auto">
                                                        {msg.attachments.map((att:any, idx:number) => (
                                                            <button 
                                                                key={idx} 
                                                                onClick={() => handleDownloadAttachment(msg.id, att.id, att.name)}
                                                                className="bg-white/10 hover:bg-white/20 transition-colors rounded px-2 py-1 flex items-center gap-2 text-xs text-white cursor-pointer border border-white/10"
                                                            >
                                                                <PaperclipIcon size={12}/> {att.name} <span className="opacity-50">({att.size})</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )) : (
                                            <div className="text-white/50 text-center">Nenhuma mensagem carregada.</div>
                                        )}
                                        
                                        {/* INLINE QUICK REPLY */}
                                        <div className="bg-black/20 border border-white/10 rounded-xl p-4 flex flex-col gap-3 mt-6">
                                            <div className="flex items-start gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white mt-1">E</div>
                                                <textarea 
                                                    className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 outline-none resize-none min-h-[60px]"
                                                    placeholder="Responder a todos..."
                                                    value={quickReplyText}
                                                    onChange={(e) => setQuickReplyText(e.target.value)}
                                                />
                                            </div>
                                            <div className="flex justify-between items-center pt-2 border-t border-white/5">
                                                <div className="flex gap-2 text-white/40">
                                                    <button className="p-1.5 hover:bg-white/10 rounded transition-colors"><PaperclipIcon size={16}/></button>
                                                    <button className="p-1.5 hover:bg-white/10 rounded transition-colors"><ImageIcon size={16}/></button>
                                                    <button className="p-1.5 hover:bg-white/10 rounded transition-colors"><Smile size={16}/></button>
                                                </div>
                                                <button 
                                                    onClick={handleQuickReply} 
                                                    disabled={!quickReplyText.trim() || isQuickReplying}
                                                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 transition-all"
                                                >
                                                    {isQuickReplying ? <Loader2 size={14} className="animate-spin"/> : <Send size={14}/>} Enviar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-white/30">
                            <Mail size={48} className="mb-4 opacity-50"/>
                            <p>Selecione um e-mail para ler</p>
                        </div>
                    )}
                </div>

                {/* AGENDA PANE */}
                <div className={`absolute inset-0 top-14 bottom-0 w-full transition-opacity duration-300 ${activePane === 'agenda' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                   {/* ... Calendar content ... */}
                   <div className="p-4 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-light text-white capitalize">{viewDate.toLocaleDateString(undefined, {month: 'long', year: 'numeric'})}</h2>
                        </div>
                        <div className="flex bg-white/5 rounded-full p-0.5 border border-white/10">
                            <button onClick={() => setCalendarViewMode('day')} className={`px-3 py-1 text-xs rounded-full transition-colors ${calendarViewMode === 'day' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'}`}>Dia</button>
                            <button onClick={() => setCalendarViewMode('week')} className={`px-3 py-1 text-xs rounded-full transition-colors ${calendarViewMode === 'week' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'}`}>Semana</button>
                            <button onClick={() => setCalendarViewMode('month')} className={`px-3 py-1 text-xs rounded-full transition-colors ${calendarViewMode === 'month' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'}`}>Mês</button>
                        </div>
                    </div>
                    {/* ... Calendar Grid Logic ... */}
                    <div className="flex-1 h-full overflow-hidden flex flex-col relative">
                       {/* Render Calendar (Day/Week/Month) */}
                       {calendarViewMode === 'day' ? (
                            <div className="flex-1 flex flex-col h-full bg-[#1E1E1E]">
                                <div className="flex-1 overflow-y-auto custom-scrollbar relative" ref={calendarRef}>
                                    <div className="relative min-h-[1440px] pb-20">
                                        {hours24.map(h => (
                                            <div key={h} className="h-[60px] border-b border-white/5 flex relative group" onClick={() => initEventCreation(new Date(new Date().setHours(h,0)), new Date(new Date().setHours(h+1,0)))}>
                                                <div className="w-14 text-right pr-3 text-xs text-white/40 -mt-2 pointer-events-none select-none">{h}:00</div>
                                                <div className="flex-1 hover:bg-white/5 cursor-pointer relative"><div className="absolute inset-x-0 top-1/2 border-t border-white/[0.03]"></div></div>
                                            </div>
                                        ))}
                                        {dayEvents.map((ev: any) => {
                                            const startH = ev.start.getHours(); const startM = ev.start.getMinutes();
                                            const duration = (ev.end.getTime() - ev.start.getTime()) / (1000 * 60 * 60);
                                            const top = startH * 60 + startM; const height = duration * 60;
                                            return (
                                                <div key={ev.id} className={`absolute rounded-lg ${ev.color} text-xs shadow-lg border-l-4 border-black/20 cursor-pointer z-10 hover:scale-[1.01] overflow-hidden ${dragState?.id === ev.id ? 'opacity-80 z-50 ring-2 ring-white scale-105' : ''} ${ev.isVirtual ? 'opacity-70 border-dashed border-white/30' : ''}`} style={{ top: `${top}px`, height: `${Math.max(30, height)}px`, left: `calc(3.5rem + 10px + ${ev.leftPercent}%)`, width: `calc(${ev.widthPercent}% - 12px)` }} onMouseDown={(e) => !ev.isVirtual && handleCalendarMouseDown(e, ev.id, 'move', ev.start, ev.end)} onClick={(e) => { e.stopPropagation(); setActiveEvent(ev); setActivePane('event-view'); }}>
                                                    <div className="p-2 h-full flex flex-col pointer-events-none">
                                                        <div className="font-bold text-white truncate flex items-center gap-1">{ev.title} {ev.recurrence !== 'none' && <RotateCw size={10} className="text-white/70"/>}</div>
                                                        <div className="text-white/80 truncate flex items-center gap-1"><MapPin size={10}/> {ev.location || "Sem local"}</div>
                                                        {ev.meetLink && <div className="mt-1 flex items-center gap-1 text-[9px] bg-black/20 px-1.5 py-0.5 rounded w-fit"><VideoIcon size={8} /> Meet</div>}
                                                    </div>
                                                    {!ev.isVirtual && (<div className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize flex justify-center items-end hover:bg-black/10 transition-colors pointer-events-auto" onMouseDown={(e) => handleCalendarMouseDown(e, ev.id, 'resize', ev.start, ev.end)}><div className="w-8 h-1 bg-white/40 rounded-full mb-1"></div></div>)}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ) : calendarViewMode === 'week' ? (
                            /* Week View */
                            <div className="flex-1 flex flex-col h-full bg-[#1E1E1E]">
                                <div className="flex border-b border-white/10 pl-14">
                                    {Array.from({length: 7}).map((_, i) => {
                                        const d = new Date(viewDate);
                                        d.setDate(d.getDate() - d.getDay() + i);
                                        const isToday = d.toDateString() === new Date().toDateString();
                                        return (
                                            <div key={i} className={`flex-1 py-2 text-center border-l border-white/5 ${isToday ? 'bg-blue-500/10' : ''}`}>
                                                <p className={`text-[10px] uppercase font-bold ${isToday ? 'text-blue-400' : 'text-white/50'}`}>{d.toLocaleDateString('pt-BR', {weekday: 'short'})}</p>
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg mx-auto mt-1 ${isToday ? 'bg-blue-600 text-white font-bold' : 'text-white'}`}>{d.getDate()}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                                    <div className="relative min-h-[1440px] flex">
                                        <div className="w-14 shrink-0 border-r border-white/10 bg-[#1E1E1E] z-20 sticky left-0">
                                            {hours24.map(h => (<div key={h} className="h-[60px] text-right pr-2 text-xs text-white/40 pt-1 -mt-2.5">{h}:00</div>))}
                                        </div>
                                        {Array.from({length: 7}).map((_, i) => {
                                            const d = new Date(viewDate);
                                            d.setDate(d.getDate() - d.getDay() + i);
                                            const dayEvs = expandedEvents.filter(ev => new Date(ev.start).toDateString() === d.toDateString() && !ev.isAllDay);
                                            return (
                                                <div key={i} className="flex-1 border-l border-white/5 relative group min-w-[100px]">
                                                    {hours24.map(h => (<div key={h} className="h-[60px] border-b border-white/5" onClick={() => initEventCreation(new Date(new Date(d).setHours(h,0)), new Date(new Date(d).setHours(h+1,0)))}></div>))}
                                                    {dayEvs.map(ev => {
                                                        const startH = ev.start.getHours(); const startM = ev.start.getMinutes();
                                                        const duration = (ev.end.getTime() - ev.start.getTime()) / (1000 * 60 * 60);
                                                        const top = startH * 60 + startM; const height = duration * 60;
                                                        return (
                                                            <div key={ev.id} className={`absolute inset-x-1 rounded ${ev.color} text-[10px] p-1 shadow-sm overflow-hidden cursor-pointer hover:brightness-110 z-10 ${ev.isVirtual ? 'opacity-70' : ''}`} style={{ top: `${top}px`, height: `${Math.max(20, height)}px` }} onClick={(e) => { e.stopPropagation(); setActiveEvent(ev); setActivePane('event-view'); }}>
                                                                <div className="font-bold truncate">{ev.title}</div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* MONTH VIEW */
                            <div className="flex-1 h-full bg-[#1E1E1E] overflow-hidden flex flex-col">
                                <div className="grid grid-cols-7 border-b border-white/10 text-center py-2 bg-white/5 text-xs font-bold text-white/50 uppercase tracking-wider shrink-0">
                                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <div key={d}>{d}</div>)}
                                </div>
                                <div className="flex-1 grid grid-cols-7 grid-rows-5 h-full auto-rows-fr">
                                    {/* Generate Month Days Logic */}
                                    {(() => {
                                        const year = viewDate.getFullYear();
                                        const month = viewDate.getMonth();
                                        const daysInMonth = new Date(year, month + 1, 0).getDate();
                                        const startDayOfWeek = new Date(year, month, 1).getDay(); // 0-6
                                        
                                        // Padding days from prev month
                                        const prevMonthDays = [];
                                        const prevMonthLastDay = new Date(year, month, 0).getDate();
                                        for(let i=startDayOfWeek-1; i>=0; i--) {
                                            prevMonthDays.push({ d: prevMonthLastDay - i, type: 'prev' });
                                        }
                                        
                                        // Current month days
                                        const currentMonthDays = [];
                                        for(let i=1; i<=daysInMonth; i++) {
                                            currentMonthDays.push({ d: i, type: 'current' });
                                        }
                                        
                                        // Padding days for next month
                                        const totalSlots = 35; // Simplified (5 rows)
                                        const nextMonthDays = [];
                                        const remaining = totalSlots - (prevMonthDays.length + currentMonthDays.length);
                                        for(let i=1; i<=remaining; i++) {
                                            nextMonthDays.push({ d: i, type: 'next' });
                                        }
                                        
                                        const allDays = [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];
                                        
                                        return allDays.map((dayObj, index) => {
                                            const isToday = dayObj.type === 'current' && dayObj.d === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
                                            const dayDate = new Date(year, dayObj.type === 'prev' ? month - 1 : dayObj.type === 'next' ? month + 1 : month, dayObj.d);
                                            const dayEvs = expandedEvents.filter(ev => new Date(ev.start).toDateString() === dayDate.toDateString());
                                            
                                            return (
                                                <div key={index} className={`border-r border-b border-white/5 min-h-[80px] p-1 relative group hover:bg-white/[0.02] transition-colors ${dayObj.type !== 'current' ? 'opacity-30 bg-black/20' : ''}`} onClick={() => { setActiveEvent({start: new Date(dayDate.setHours(9,0)), end: new Date(dayDate.setHours(10,0)), title: ''}); setActivePane('event-create'); }}>
                                                    <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white' : 'text-white/60'}`}>
                                                        {dayObj.d}
                                                    </div>
                                                    <div className="flex flex-col gap-1 overflow-hidden">
                                                        {dayEvs.slice(0, 3).map((ev: any) => (
                                                            <div key={ev.id} onClick={(e) => { e.stopPropagation(); setActiveEvent(ev); setActivePane('event-view'); }} className={`text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer ${ev.color} text-white shadow-sm hover:brightness-110`}>
                                                                {ev.title}
                                                            </div>
                                                        ))}
                                                        {dayEvs.length > 3 && <div className="text-[9px] text-white/40 pl-1">+{dayEvs.length - 3} mais</div>}
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* TASKS VIEW */}
                {activePane === 'tasks' && (
                    <div className="absolute inset-0 top-14 bottom-0 w-full z-10">
                        <TasksApp onClose={() => setActivePane('agenda')} data={{...data, tasks: tasks}} onUpdate={handleUpdateTasks} />
                    </div>
                )}

                {/* KEEP VIEW */}
                {activePane === 'keep' && (
                    <div className="absolute inset-0 top-14 bottom-0 w-full z-10">
                        <KeepApp onClose={() => setActivePane('agenda')} data={{...data, notes: notes}} onUpdate={handleUpdateNotes} />
                    </div>
                )}

                {/* EVENT CREATE/EDIT PANE (Full Implementation) */}
                <div className={`absolute inset-0 top-14 bottom-0 w-full bg-[#1E1E1E] transition-opacity duration-300 ${activePane === 'event-create' ? 'opacity-100 z-50' : 'opacity-0 z-0 pointer-events-none'}`}>
                    <div className="max-w-xl mx-auto mt-8 bg-[#2d2e30] rounded-2xl shadow-2xl border border-white/10 overflow-hidden animate-in zoom-in duration-300">
                        <div className="flex justify-between items-center p-6 border-b border-white/5">
                            <input 
                                type="text" 
                                placeholder="Adicionar título" 
                                className="bg-transparent text-2xl text-white placeholder:text-white/30 outline-none w-full font-light"
                                value={activeEvent?.title || ''}
                                onChange={(e) => setActiveEvent({...activeEvent, title: e.target.value})}
                                autoFocus
                            />
                            <button onClick={() => setActivePane('agenda')} className="p-2 hover:bg-white/10 rounded-full text-white/50"><X size={20}/></button>
                        </div>
                        <div className="p-6 space-y-6">
                            {/* Date & Time */}
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-white/5 rounded-full"><Clock size={20} className="text-white/60"/></div>
                                <div className="flex-1 flex flex-col gap-2">
                                    <div className="flex gap-2">
                                        <input type="datetime-local" className="bg-black/20 text-white text-sm rounded-lg px-3 py-2 outline-none border border-white/10 w-full" value={activeEvent?.start ? new Date(activeEvent.start).toISOString().slice(0, 16) : ''} onChange={(e) => setActiveEvent({...activeEvent, start: new Date(e.target.value)})} />
                                        <span className="text-white/40 self-center">-</span>
                                        <input type="datetime-local" className="bg-black/20 text-white text-sm rounded-lg px-3 py-2 outline-none border border-white/10 w-full" value={activeEvent?.end ? new Date(activeEvent.end).toISOString().slice(0, 16) : ''} onChange={(e) => setActiveEvent({...activeEvent, end: new Date(e.target.value)})} />
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-white/60">
                                        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={activeEvent?.isAllDay || false} onChange={(e) => setActiveEvent({...activeEvent, isAllDay: e.target.checked})} /> Dia inteiro</label>
                                        <select value={activeEvent?.recurrence || 'none'} onChange={(e) => setActiveEvent({...activeEvent, recurrence: e.target.value})} className="bg-transparent outline-none hover:text-white cursor-pointer">
                                            <option value="none">Não se repete</option>
                                            <option value="daily">Todos os dias</option>
                                            <option value="weekly">Semanalmente</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Google Meet */}
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-white/5 rounded-full"><VideoIcon size={20} className="text-white/60"/></div>
                                {useMeet ? (
                                    <div className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg flex justify-between items-center shadow-lg shadow-blue-900/20">
                                        <span className="text-sm font-medium">Entrar com Google Meet</span>
                                        <button onClick={() => setUseMeet(false)} className="hover:bg-black/10 p-1 rounded"><X size={14}/></button>
                                    </div>
                                ) : (
                                    <button onClick={() => setUseMeet(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-blue-900/20">Adicionar videoconferência do Google Meet</button>
                                )}
                            </div>

                            {/* Guests */}
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-white/5 rounded-full"><Users size={20} className="text-white/60"/></div>
                                <div className="flex-1">
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {activeEvent?.guests?.map((g: any, i: number) => (
                                            <div key={i} className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-full text-xs text-white">
                                                {g.avatar ? <div className="w-4 h-4 rounded-full bg-purple-500 text-[8px] flex items-center justify-center">{g.avatar}</div> : <User size={10} className="mr-1"/>}
                                                {g.name}
                                                <button onClick={() => setActiveEvent({...activeEvent, guests: activeEvent.guests.filter((_:any, idx:number) => idx !== i)})}><X size={10}/></button>
                                            </div>
                                        ))}
                                    </div>
                                    <ContactInput 
                                        placeholder="Adicionar convidados"
                                        value={guestInput}
                                        onChange={setGuestInput}
                                        onSelect={(email) => handleAddGuest(email)}
                                    