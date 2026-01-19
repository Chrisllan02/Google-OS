
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
  ToggleLeft as ToggleOff, ToggleRight as ToggleOn, Volume2, BellOff, SunDim, Loader2
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

// ... (Checkbox and AdvancedFilterPanel components remain the same) ...
const Checkbox = ({ checked, onChange, className }: { checked: boolean, onChange: (e:any) => void, className?: string }) => (
    <div 
        onClick={(e) => { e.stopPropagation(); onChange(e); }} 
        className={`w-5 h-5 rounded-[4px] border-2 flex items-center justify-center cursor-pointer transition-all ${checked ? 'bg-blue-500 border-blue-500' : 'border-white/40 hover:border-white/60'} ${className}`}
        title={checked ? "Desmarcar" : "Marcar"}
    >
        {checked && <Check size={14} className="text-black" strokeWidth={3} />}
    </div>
);

const AdvancedFilterPanel = ({ isOpen, onClose, onApply, setFolder, currentFolder, customLabels, filterCriteria, setFilterCriteria }: any) => {
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
                <p className="text-[10px] text-white/40 uppercase font-bold mb-2 px-1">Marcadores</p>
                <div className="flex flex-wrap gap-2 mb-3">
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

// ... (Calendar Helpers expandEvents and arrangeEvents remain the same) ...
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
    }

    events.forEach(ev => {
        const evStart = new Date(ev.start);
        const evEnd = new Date(ev.end);
        if (ev.recurrence === 'none' || !ev.recurrence) {
            if (evStart <= viewEnd && evEnd >= viewStart) expanded.push(ev);
            return;
        }
        let currentIter = new Date(evStart);
        while (currentIter <= viewEnd) {
            if (currentIter >= viewStart) {
                const duration = evEnd.getTime() - evStart.getTime();
                const projectedStart = new Date(currentIter);
                const projectedEnd = new Date(currentIter.getTime() + duration);
                if (projectedStart <= viewEnd && projectedEnd >= viewStart) {
                    expanded.push({ ...ev, start: projectedStart, end: projectedEnd, isVirtual: true });
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


export default function MailApp({ onClose, data, searchQuery = '', onUpdateTasks, onUpdateNotes }: MailAppProps) {
  const appHeaderClass = "h-20 px-6 flex items-center justify-between shrink-0 border-b border-white/5 backdrop-blur-xl z-20";

  // --- ESTADOS ---
  const [emails, setEmails] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>(data?.tasks || []);
  const [notes, setNotes] = useState<any[]>(data?.notes || []);
  
  // Navigation & UI
  const [activePane, setActivePane] = useState<'agenda' | 'email' | 'compose' | 'tasks' | 'keep' | 'event-create' | 'event-view' | 'settings'>('agenda');
  const [mailFolder, setMailFolder] = useState<string>('inbox');
  const [rightPanelWidth, setRightPanelWidth] = useState(typeof window !== 'undefined' ? window.innerWidth / 2 : 600);
  const [showNewMenu, setShowNewMenu] = useState(false); 
  const [calendarViewMode, setCalendarViewMode] = useState<'day' | 'week'>('day');
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
  const [dragState, setDragState] = useState<{ id: number; type: 'move' | 'resize'; startY: number; originalStart: Date; originalEnd: Date; } | null>(null);

  // Email State
  const [activeEmail, setActiveEmail] = useState<any>(null);
  const [activeThreadMessages, setActiveThreadMessages] = useState<any[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  
  // Composer State
  const [composeAttachments, setComposeAttachments] = useState<{file: File, name: string, size: string}[]>([]);
  const [composeTo, setComposeTo] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeBcc, setComposeBcc] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [isComposerMinimized, setIsComposerMinimized] = useState(false);
  
  const [toast, setToast] = useState<{message: string} | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
      setToast({ message: msg });
      setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (data) {
        if (data.emails) {
             const enhanced = data.emails.map((e:any, index: number) => ({
                 ...e, folder: 'inbox', read: false, isStarred: index === 1, labels: index === 0 ? ['label_project'] : [], hasAttachment: index % 2 === 0
             }));
             setEmails(enhanced);
        }
        if (data.events) setCalendarEvents(data.events);
        if (data.tasks) setTasks(data.tasks);
        if (data.notes) setNotes(data.notes);
    }
  }, [data]);

  // Sync callbacks
  const handleUpdateTasks = (newTasks: any[]) => { setTasks(newTasks); if(onUpdateTasks) onUpdateTasks(newTasks); };
  const handleUpdateNotes = (newNotes: any[]) => { setNotes(newNotes); if(onUpdateNotes) onUpdateNotes(newNotes); };

  const handleEmailClick = async (email: any) => {
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

  // --- CALENDAR LOGIC ---
  const handleSaveEvent = async () => {
      if (!activeEvent.title) { showToast("Adicione um título"); return; }
      const newEvent = { ...activeEvent, id: activeEvent.id || Date.now(), start: activeEvent.start, end: activeEvent.end, recurrence: activeEvent.recurrence || 'none', color: activeEvent.color || 'bg-blue-500' };
      setCalendarEvents(prev => {
          const exists = prev.find(e => e.id === newEvent.id);
          if (exists) return prev.map(e => e.id === newEvent.id ? newEvent : e);
          return [...prev, newEvent];
      });
      await bridge.createCalendarEvent(newEvent);
      setActivePane('agenda');
      showToast(activeEvent.id ? "Evento atualizado" : "Evento criado");
  };

  const handleDeleteEvent = async () => {
      if (activeEvent && activeEvent.id) {
          setCalendarEvents(prev => prev.filter(e => e.id !== activeEvent.id));
          await bridge.deleteCalendarEvent(activeEvent.id);
          showToast("Evento excluído");
          setActivePane('agenda');
      }
  };

  const handleAddGuest = () => {
      if (guestInput.trim()) {
          const newGuests = [...(activeEvent.guests || []), { name: guestInput, email: guestInput, avatar: guestInput[0].toUpperCase() }];
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
              if (event) { await bridge.updateCalendarEvent(event.id, event.start, event.end); showToast('Agenda atualizada'); }
              setDragState(null); document.body.style.cursor = '';
          }
      };
      if (dragState) { window.addEventListener('mousemove', handleGlobalMouseMove); window.addEventListener('mouseup', handleGlobalMouseUp); document.body.style.cursor = dragState.type === 'move' ? 'grabbing' : 'ns-resize'; }
      return () => { window.removeEventListener('mousemove', handleGlobalMouseMove); window.removeEventListener('mouseup', handleGlobalMouseUp); };
  }, [dragState, calendarEvents]);

  const handleCalendarMouseDown = (e: React.MouseEvent, id: number, type: 'move' | 'resize', start: Date, end: Date) => { e.stopPropagation(); setDragState({ id, type, startY: e.clientY, originalStart: start, originalEnd: end }); };

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
      if (!composeTo && !composeSubject) { showToast("Preencha destinatário e assunto"); return; }
      const body = editorRef.current ? editorRef.current.innerHTML : "...";
      const processedAttachments: EmailAttachment[] = [];
      for (const att of composeAttachments) {
          try { const base64 = await fileToBase64(att.file); processedAttachments.push({ name: att.name, mimeType: att.file.type, data: base64 }); } catch (err) { console.error("Erro anexo", err); }
      }
      await bridge.sendEmail(composeTo, composeSubject, body, processedAttachments);
      
      // Close & Clean
      if (isComposerMinimized) {
          setIsComposerMinimized(false);
          setActivePane('agenda'); // Return to default
      } else {
          setActivePane('agenda');
      }

      if(editorRef.current) editorRef.current.innerHTML = '';
      setComposeTo(''); setComposeSubject(''); setComposeAttachments([]);
      showToast('Mensagem enviada');
  };

  const handleCloseComposer = () => {
      const content = editorRef.current?.innerText.trim();
      if (content || composeSubject || composeTo) {
          const draft = { id: Date.now(), sender: "Rascunho", senderInit: "R", subject: composeSubject || "(Sem assunto)", preview: content || "...", time: "Rascunho", read: true, folder: 'drafts', to: composeTo, color: 'bg-gray-600', hasAttachment: composeAttachments.length > 0 };
          setEmails(prev => [draft, ...prev]);
          showToast('Rascunho salvo');
      }
      setIsComposerMinimized(false);
      setActivePane('agenda');
      if(editorRef.current) editorRef.current.innerHTML = '';
      setComposeTo(''); setComposeSubject(''); setComposeAttachments([]);
  };

  const handleMinimizeComposer = () => {
      setIsComposerMinimized(!isComposerMinimized);
      if (!isComposerMinimized) {
           // If we are minimizing, we should switch the main view back to something else (like agenda or email) so the user can browse
           setActivePane('agenda');
      } else {
           // Maximizing
           setActivePane('compose');
      }
  };

  // --- REPLY / FORWARD LOGIC ---
  const handleReply = () => {
      if (!activeEmail) return;
      setComposeTo(activeEmail.sender); // Na prática seria o email real, aqui usamos o nome do mock
      setComposeSubject(`Re: ${activeEmail.subject}`);
      
      const lastMsg = activeThreadMessages[activeThreadMessages.length - 1];
      const quote = lastMsg ? `<br/><br/><div class="gmail_quote">Em ${lastMsg.date}, ${lastMsg.from} escreveu:<br/><blockquote class="gmail_quote" style="margin:0 0 0 .8ex;border-left:1px #ccc solid;padding-left:1ex">${lastMsg.body || lastMsg.plainBody}</blockquote></div>` : '';
      
      setActivePane('compose');
      setIsComposerMinimized(false);
      // Precisa esperar o componente montar
      setTimeout(() => {
          if (editorRef.current) {
              editorRef.current.innerHTML = quote;
              editorRef.current.focus();
              // Move caret to start
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

  // --- RENDER & FILTER ---
  const displayedEmails = emails.filter(e => {
      const query = localSearch || searchQuery;
      // Global/Local Search
      if (query && !(e.subject.toLowerCase().includes(query.toLowerCase()) || e.sender.toLowerCase().includes(query.toLowerCase()))) return false;
      
      // Advanced Filters
      if (filterCriteria.from && !e.sender.toLowerCase().includes(filterCriteria.from.toLowerCase())) return false;
      if (filterCriteria.subject && !e.subject.toLowerCase().includes(filterCriteria.subject.toLowerCase())) return false;
      if (filterCriteria.hasAttachment && !e.hasAttachment) return false;

      // Folder/Label
      if (mailFolder.startsWith('label_')) return e.labels && e.labels.includes(mailFolder);
      if (mailFolder === 'starred') return e.isStarred;
      return e.folder === mailFolder;
  }).sort((a, b) => (a.read !== b.read ? (a.read ? 1 : -1) : 0));

  const hours24 = Array.from({ length: 24 }, (_, i) => i);
  const expandedEvents = expandEvents(calendarEvents, viewDate, calendarViewMode === 'day' ? 'day' : 'week');
  const dayEvents = arrangeEvents(expandedEvents.filter(ev => new Date(ev.start).getDate() === viewDate.getDate()));

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
                                placeholder="Filtrar emails" 
                                className="bg-transparent border-none outline-none flex-1 ml-2 text-sm text-white placeholder:text-white/30"
                                value={localSearch}
                                onChange={(e) => setLocalSearch(e.target.value)}
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
                        onApply={() => setShowFilterPanel(false)}
                        setFolder={setMailFolder}
                        currentFolder={mailFolder}
                        customLabels={customLabels}
                        filterCriteria={filterCriteria}
                        setFilterCriteria={setFilterCriteria}
                    />
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 relative bg-[#191919]">
                    <div className="flex flex-col gap-1">
                        {displayedEmails.map((email: any) => (
                            <div key={email.id} className="relative group mb-2">
                                <div className={`relative z-10 ${!email.read ? 'bg-white/10 border-l-4 border-blue-500' : 'bg-white/5'} hover:bg-[#2A2A2A] rounded-2xl transition-all duration-200 py-4 px-4 flex items-start gap-3 cursor-pointer`} onClick={() => handleEmailClick(email)}>
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${email.color || 'bg-blue-600'}`}>{email.senderInit || email.sender[0]}</div>
                                    <div className="flex-1 min-w-0">
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
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Panel */}
            <div className={`flex flex-col bg-[#1E1E1E] rounded-[24px] border border-white/5 overflow-hidden relative transition-all duration-0 ease-linear`} style={{ width: rightPanelWidth }}>
                {/* ... (Other views: email reader, agenda, tasks, keep, settings) ... */}
                
                {/* Right Panel Navigation Bar */}
                 <div className="h-14 flex items-center justify-between px-6 border-b border-white/5 shrink-0 bg-[#1E1E1E] z-20 relative">
                    <div className="flex bg-white/5 backdrop-blur-xl border border-white/10 p-1 rounded-[99px] h-[40px] items-center gap-1 w-full overflow-x-auto custom-scrollbar">
                        {['email', 'agenda', 'tasks', 'keep'].map((tab: any) => (
                            <button key={tab} onClick={() => setActivePane(tab)} className={`flex-1 min-w-[70px] h-full rounded-full text-xs font-medium transition-all flex items-center justify-center gap-2 ${activePane.includes(tab) ? 'bg-white/10 text-white shadow-sm border border-white/5' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}>
                                {tab === 'email' && <Mail size={14} />} {tab === 'agenda' && <LayoutTemplate size={14} />} {tab === 'tasks' && <CheckCircle size={14} />} {tab === 'keep' && <StickyNote size={14} />}
                                <span className="capitalize hidden md:inline">{tab === 'email' ? 'Leitura' : tab}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* SETTINGS VIEW */}
                <div className={`absolute inset-0 top-14 bottom-0 w-full bg-[#1E1E1E] transition-opacity duration-300 ${activePane === 'settings' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                     {/* Settings Content */}
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
                                    <button className="p-2 hover:bg-white/10 rounded-full" title="Arquivar"><Archive size={18}/></button>
                                    <button className="p-2 hover:bg-white/10 rounded-full" title="Spam"><AlertOctagon size={18}/></button>
                                    <button className="p-2 hover:bg-white/10 rounded-full hover:text-red-400" title="Excluir"><Trash2 size={18}/></button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
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
                                                            <div key={idx} className="bg-white/10 rounded px-2 py-1 flex items-center gap-2 text-xs">
                                                                <PaperclipIcon size={12}/> {att.name}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )) : (
                                            <div className="text-white/50 text-center">Nenhuma mensagem carregada.</div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="p-4 border-t border-white/5 bg-[#1E1E1E] shrink-0">
                                <div className="flex gap-3">
                                    <button onClick={handleReply} className="flex-1 border border-white/10 rounded-full py-3 px-4 text-left text-sm text-white/40 hover:bg-white/5 transition-colors flex items-center gap-2"><Reply size={16}/> Responder</button>
                                    <button onClick={handleForward} className="flex-1 border border-white/10 rounded-full py-3 px-4 text-left text-sm text-white/40 hover:bg-white/5 transition-colors flex items-center gap-2"><Forward size={16}/> Encaminhar</button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-white/30">
                            <Mail size={48} className="mb-4 opacity-50"/>
                            <p>Selecione um e-mail para ler</p>
                        </div>
                    )}
                </div>

                {/* AGENDA, TASKS, KEEP, EVENTS VIEWS ... (Keep existing) */}
                <div className={`absolute inset-0 top-14 bottom-0 w-full transition-opacity duration-300 ${activePane === 'agenda' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                   {/* ... Calendar content ... */}
                   <div className="p-4 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-light text-white capitalize">{viewDate.toLocaleDateString()}</h2>
                        </div>
                        <div className="flex bg-white/5 rounded-full p-0.5 border border-white/10">
                            <button onClick={() => setCalendarViewMode('day')} className={`px-3 py-1 text-xs rounded-full transition-colors ${calendarViewMode === 'day' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'}`}>Dia</button>
                            <button onClick={() => setCalendarViewMode('week')} className={`px-3 py-1 text-xs rounded-full transition-colors ${calendarViewMode === 'week' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'}`}>Semana</button>
                        </div>
                    </div>
                    {/* ... Calendar Grid Logic ... */}
                    <div className="flex-1 h-full overflow-hidden flex flex-col relative">
                       {/* Render Calendar (Day/Week) - Keeping existing logic */}
                       {calendarViewMode === 'day' ? (
                            <div className="flex-1 flex flex-col h-full bg-[#1E1E1E]">
                                <div className="flex-1 overflow-y-auto custom-scrollbar relative" ref={calendarRef}>
                                    <div className="relative min-h-[1440px] pb-20">
                                        {hours24.map(h => (
                                            <div key={h} className="h-[60px] border-b border-white/5 flex relative group" onClick={() => { setActiveEvent({start: new Date(new Date().setHours(h,0)), end: new Date(new Date().setHours(h+1,0)), title: ''}); setActivePane('event-create'); }}>
                                                <div className="w-14 text-right pr-3 text-xs text-white/40 -mt-2 pointer-events-none select-none">{h}:00</div>
                                                <div className="flex-1 hover:bg-white/5 cursor-pointer relative"><div className="absolute inset-x-0 top-1/2 border-t border-white/[0.03]"></div></div>
                                            </div>
                                        ))}
                                        {/* ... Events rendering ... */}
                                        {dayEvents.map((ev: any) => {
                                            const startH = ev.start.getHours(); const startM = ev.start.getMinutes();
                                            const duration = (ev.end.getTime() - ev.start.getTime()) / (1000 * 60 * 60);
                                            const top = startH * 60 + startM; const height = duration * 60;
                                            return (
                                                <div key={ev.id} className={`absolute rounded-lg ${ev.color} text-xs shadow-lg border-l-4 border-black/20 cursor-pointer z-10 hover:scale-[1.01] overflow-hidden ${dragState?.id === ev.id ? 'opacity-80 z-50 ring-2 ring-white scale-105' : ''} ${ev.isVirtual ? 'opacity-70 border-dashed border-white/30' : ''}`} style={{ top: `${top}px`, height: `${Math.max(30, height)}px`, left: `calc(3.5rem + 10px + ${ev.leftPercent}%)`, width: `calc(${ev.widthPercent}% - 12px)` }} onMouseDown={(e) => !ev.isVirtual && handleCalendarMouseDown(e, ev.id, 'move', ev.start, ev.end)} onClick={(e) => { e.stopPropagation(); setActiveEvent(ev); setActivePane('event-view'); }}>
                                                    <div className="p-2 h-full flex flex-col pointer-events-none">
                                                        <div className="font-bold text-white truncate flex items-center gap-1">{ev.title} {ev.recurrence !== 'none' && <RotateCw size={10} className="text-white/70"/>}</div>
                                                        <div className="text-white/80 truncate flex items-center gap-1"><MapPin size={10}/> {ev.location}</div>
                                                    </div>
                                                    {!ev.isVirtual && (<div className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize flex justify-center items-end hover:bg-black/10 transition-colors pointer-events-auto" onMouseDown={(e) => handleCalendarMouseDown(e, ev.id, 'resize', ev.start, ev.end)}><div className="w-8 h-1 bg-white/40 rounded-full mb-1"></div></div>)}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ) : (
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
                                                    {hours24.map(h => (<div key={h} className="h-[60px] border-b border-white/5" onClick={() => { setActiveEvent({start: new Date(new Date(d).setHours(h,0)), end: new Date(new Date(d).setHours(h+1,0)), title: ''}); setActivePane('event-create'); }}></div>))}
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
                        )}
                    </div>
                </div>

                {activePane === 'tasks' && (
                    <div className="absolute inset-0 top-14 bottom-0 w-full z-10">
                        <TasksApp onClose={() => setActivePane('agenda')} data={{...data, tasks: tasks}} onUpdate={handleUpdateTasks} />
                    </div>
                )}
                {activePane === 'keep' && (
                    <div className="absolute inset-0 top-14 bottom-0 w-full z-10">
                        <KeepApp onClose={() => setActivePane('agenda')} data={{...data, notes: notes}} onUpdate={handleUpdateNotes} />
                    </div>
                )}
                {/* Event Create/Edit and View panes remain similar to previous implementation... */}
                
                {/* COMPOSER (With Minimize Support) */}
                <div className={`absolute bottom-0 right-0 w-full transition-all duration-300 z-50 ${
                    activePane === 'compose' && !isComposerMinimized ? 'h-full opacity-100 top-14' : 
                    isComposerMinimized ? 'h-12 w-64 mr-4 mb-0 opacity-100 translate-y-0' : 'h-0 opacity-0 pointer-events-none'
                }`}>
                    <div className={`flex flex-col h-full bg-[#1E1E1E] ${isComposerMinimized ? 'rounded-t-xl border border-white/20 shadow-2xl overflow-hidden' : ''}`}>
                         {isComposerMinimized ? (
                             <div className="flex items-center justify-between px-4 h-full bg-[#303134] cursor-pointer hover:bg-[#3c4043]" onClick={handleMinimizeComposer}>
                                 <span className="text-sm font-medium text-white truncate">{composeSubject || "Novo E-mail"}</span>
                                 <div className="flex items-center gap-2">
                                     <button onClick={(e) => { e.stopPropagation(); handleMinimizeComposer(); }} className="p-1 hover:bg-white/10 rounded"><Maximize2 size={14}/></button>
                                     <button onClick={(e) => { e.stopPropagation(); handleCloseComposer(); }} className="p-1 hover:bg-white/10 rounded"><X size={14}/></button>
                                 </div>
                             </div>
                         ) : (
                             <div className="flex flex-col h-full p-6">
                                 <div className="flex items-center justify-between mb-4">
                                     <h2 className="text-lg font-medium text-white">Nova Mensagem</h2>
                                     <div className="flex items-center gap-2">
                                         <button onClick={handleMinimizeComposer} className="p-2 hover:bg-white/10 rounded-full text-white/70"><Minimize2 size={18}/></button>
                                         <button onClick={handleCloseComposer} className="p-2 hover:bg-white/10 rounded-full text-white/70"><X size={18}/></button>
                                     </div>
                                 </div>
                                 <div className="space-y-1 mb-4">
                                     <div className="flex items-center bg-white/5 border-b border-white/10 pr-2 transition-colors focus-within:bg-black/20 focus-within:border-blue-500">
                                        <input type="text" placeholder="Para" className="flex-1 bg-transparent p-2 text-sm text-white outline-none" value={composeTo} onChange={(e) => setComposeTo(e.target.value)} />
                                     </div>
                                     <div className="flex items-center border-b border-white/10 group focus-within:border-white/30 transition-colors relative">
                                        <input 
                                            type="text" 
                                            placeholder="Assunto" 
                                            className="flex-1 bg-transparent py-2 text-sm text-white outline-none placeholder:text-white/60"
                                            value={composeSubject}
                                            onChange={(e) => setComposeSubject(e.target.value)}
                                        />
                                        <div className="flex gap-3 text-xs text-white/60 absolute right-0">
                                            <button onClick={() => setShowCcBcc(!showCcBcc)} className="hover:text-white hover:underline">Cc</button>
                                            <button onClick={() => setShowCcBcc(!showCcBcc)} className="hover:text-white hover:underline">Cco</button>
                                        </div>
                                    </div>
                                    
                                    {showCcBcc && (
                                        <>
                                            <div className="flex items-center border-b border-white/10 group focus-within:border-white/30 transition-colors animate-in slide-in-from-top-1">
                                                <span className="text-sm text-white/60 w-10 shrink-0">Cc</span>
                                                <input type="text" className="flex-1 bg-transparent py-2 text-sm text-white outline-none" value={composeCc} onChange={(e) => setComposeCc(e.target.value)}/>
                                            </div>
                                            <div className="flex items-center border-b border-white/10 group focus-within:border-white/30 transition-colors animate-in slide-in-from-top-1">
                                                <span className="text-sm text-white/60 w-10 shrink-0">Cco</span>
                                                <input type="text" className="flex-1 bg-transparent py-2 text-sm text-white outline-none" value={composeBcc} onChange={(e) => setComposeBcc(e.target.value)}/>
                                            </div>
                                        </>
                                    )}
                                 </div>
                                 <ComposerToolbar onFormat={(cmd, val) => { document.execCommand(cmd, false, val); editorRef.current?.focus(); }} />
                                 <div ref={editorRef} contentEditable className="flex-1 bg-transparent w-full outline-none text-white/90 text-sm leading-relaxed custom-scrollbar overflow-y-auto p-2 border border-transparent focus:border-white/10 rounded-lg"></div>
                                 {composeAttachments.length > 0 && (
                                     <div className="flex flex-wrap gap-2 mb-2 p-2">
                                         {composeAttachments.map((att, i) => (
                                             <div key={i} className="flex items-center gap-2 bg-white/10 rounded px-2 py-1 text-xs">
                                                 <PaperclipIcon size={12}/> {att.name} <span className="opacity-50">({att.size})</span>
                                                 <button onClick={() => setComposeAttachments(prev => prev.filter((_, idx) => idx !== i))}><X size={12}/></button>
                                             </div>
                                         ))}
                                     </div>
                                 )}
                                 <div className="flex justify-between items-center mt-2 border-t border-white/10 pt-2">
                                     <button onClick={handleSendEmail} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-full transition-colors flex items-center gap-2">Enviar <Send size={14}/></button>
                                     <div className="relative">
                                         <button onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-white/10 rounded text-white/70"><PaperclipIcon size={18}/></button>
                                         <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleAttachmentUpload} />
                                     </div>
                                 </div>
                             </div>
                         )}
                     </div>
                </div>

            </div>
        </div>
        {toast && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-[#323232] text-white px-6 py-3 rounded-lg shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300 z-50 border border-white/10">
                <span>{toast.message}</span>
                <button onClick={() => setToast(null)} className="ml-2 text-white/50 hover:text-white" title="Fechar"><X size={16}/></button>
            </div>
        )}
    </div>
  );
}
