
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
  RemoveFormatting, GripHorizontal, MousePointerClick, RefreshCcw, CalendarDays
} from 'lucide-react';
import { GoogleIcons } from '../GoogleIcons';
import { bridge } from '../../utils/GASBridge';

interface MailAppProps {
  onClose: () => void;
  data: any;
  searchQuery?: string;
}

// --- HELPERS ---

// Expand recurring events based on the view date
const expandEvents = (events: any[], viewDate: Date, viewMode: 'day' | 'week' | 'month') => {
    const expanded: any[] = [];
    
    // Determine View Range
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

        // Single Event check
        if (ev.recurrence === 'none' || !ev.recurrence) {
            if (evStart <= viewEnd && evEnd >= viewStart) {
                expanded.push(ev);
            }
            return;
        }

        // Recurring Event Logic (Simplified)
        let currentIter = new Date(evStart);
        while (currentIter <= viewEnd) {
            if (currentIter >= viewStart) {
                // Clone and project
                const duration = evEnd.getTime() - evStart.getTime();
                const projectedStart = new Date(currentIter);
                const projectedEnd = new Date(currentIter.getTime() + duration);
                
                // Only if visible in the view
                if (projectedStart <= viewEnd && projectedEnd >= viewStart) {
                    expanded.push({ ...ev, start: projectedStart, end: projectedEnd, isVirtual: true });
                }
            }

            // Increment
            if (ev.recurrence === 'daily') {
                currentIter.setDate(currentIter.getDate() + 1);
            } else if (ev.recurrence === 'weekly') {
                currentIter.setDate(currentIter.getDate() + 7);
            } else {
                break; // Safety break
            }
        }
    });
    return expanded;
};

const arrangeEvents = (events: any[]) => {
    // Separate All Day events from timed events
    const timedEvents = events.filter(e => !e.isAllDay);
    
    const sorted = [...timedEvents].sort((a, b) => {
        if (a.start.getTime() === b.start.getTime()) {
            return b.end.getTime() - a.end.getTime(); 
        }
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

    return packedEvents.map(ev => ({
        ...ev,
        widthPercent: 100 / columns.length,
        leftPercent: (ev.colIndex * 100) / columns.length
    }));
};

// --- SUB-COMPONENTS ---

const Checkbox = ({ checked, onChange, className }: { checked: boolean, onChange: (e:any) => void, className?: string }) => (
    <div 
        onClick={(e) => { e.stopPropagation(); onChange(e); }} 
        className={`w-5 h-5 rounded-[4px] border-2 flex items-center justify-center cursor-pointer transition-all ${checked ? 'bg-blue-500 border-blue-500' : 'border-white/40 hover:border-white/60'} ${className}`}
        title={checked ? "Desmarcar" : "Marcar"}
    >
        {checked && <Check size={14} className="text-black" strokeWidth={3} />}
    </div>
);

const ToggleSwitch = ({ checked, onChange }: { checked: boolean, onChange: () => void }) => (
    <div onClick={onChange} className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${checked ? 'bg-blue-600' : 'bg-white/20'}`} title={checked ? "Ativado" : "Desativado"}>
        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 ${checked ? 'left-5' : 'left-1'}`}></div>
    </div>
);

const EmojiPicker = ({ onSelect, onClose }: { onSelect: (emoji: string) => void, onClose: () => void }) => {
    const emojis = [
        "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇",
        "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚",
        "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩",
        "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣",
        "👍", "👎", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "💪", "🧠"
    ];

    return (
        <div className="absolute bottom-12 right-0 bg-[#2d2e30] border border-white/10 rounded-xl shadow-2xl p-2 z-50 animate-in zoom-in duration-200 w-64">
            <div className="flex justify-between items-center px-2 pb-2 border-b border-white/10 mb-2">
                <span className="text-xs font-bold text-white/60 uppercase">Emojis</span>
                <button onClick={(e) => { e.stopPropagation(); onClose(); }}><X size={14} className="text-white/40 hover:text-white" /></button>
            </div>
            <div className="grid grid-cols-6 gap-1 h-40 overflow-y-auto custom-scrollbar">
                {emojis.map((emoji, idx) => (
                    <button 
                        key={idx} 
                        onClick={(e) => { e.stopPropagation(); onSelect(emoji); }} 
                        className="hover:bg-white/10 rounded p-1 text-lg transition-colors flex items-center justify-center h-8"
                    >
                        {emoji}
                    </button>
                ))}
            </div>
        </div>
    );
};

const AdvancedFilterPanel = ({ isOpen, onClose, onApply, setFolder, currentFolder, secondaryFolders, customLabels, filterCriteria, setFilterCriteria }: any) => {
    if (!isOpen) return null;
    return (
        <div className="absolute top-16 left-6 w-[340px] bg-[#2d2e30] border border-white/10 rounded-xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in duration-200 backdrop-blur-xl">
            <div className="mb-4 pb-4 border-b border-white/10">
                <p className="text-[10px] text-white/40 uppercase font-bold mb-2 px-1">Pastas & Filtros</p>
                <div className="grid grid-cols-2 gap-2">
                    {secondaryFolders.map((folder: any) => (
                        <button 
                            key={folder.id}
                            onClick={() => { setFolder(folder.id); onClose(); }}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${currentFolder === folder.id ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/80 hover:bg-white/10'}`}
                        >
                            <folder.icon size={14} />
                            {folder.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="mb-4 pb-4 border-b border-white/10 space-y-2">
                <p className="text-[10px] text-white/40 uppercase font-bold mb-1 px-1">Critérios de Busca</p>
                <input 
                    type="text" 
                    placeholder="De (Remetente)" 
                    className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500"
                    value={filterCriteria?.from || ''}
                    onChange={(e) => setFilterCriteria && setFilterCriteria({...filterCriteria, from: e.target.value})}
                />
                <input 
                    type="text" 
                    placeholder="Assunto" 
                    className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500"
                    value={filterCriteria?.subject || ''}
                    onChange={(e) => setFilterCriteria && setFilterCriteria({...filterCriteria, subject: e.target.value})}
                />
                <div className="flex items-center gap-2 pt-1" onClick={() => setFilterCriteria && setFilterCriteria({...filterCriteria, hasAttachment: !filterCriteria?.hasAttachment})}>
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
            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-white/70 hover:bg-white/5">Fechar</button>
                <button onClick={onApply} className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500">Filtrar</button>
            </div>
        </div>
    );
};

export default function MailApp({ onClose, data, searchQuery = '' }: MailAppProps) {
  const appHeaderClass = "h-20 px-6 flex items-center justify-between shrink-0 border-b border-white/5 backdrop-blur-xl z-20";

  // --- ESTADOS ---
  const [emails, setEmails] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  
  // NAVEGAÇÃO DO PAINEL DIREITO: Agora inclui 'event-create' e 'event-view'
  const [activePane, setActivePane] = useState<'agenda' | 'email' | 'compose' | 'tasks' | 'keep' | 'event-create' | 'event-view'>('agenda');
  
  const [leftPanelMode, setLeftPanelMode] = useState<'list' | 'settings'>('list');
  const [mailFolder, setMailFolder] = useState<string>('inbox');
  const [customLabels, setCustomLabels] = useState<any[]>([
      { id: 'label_finance', name: 'Financeiro', colorClass: 'text-green-400' },
      { id: 'label_project', name: 'Projetos', colorClass: 'text-blue-400' },
      { id: 'label_personal', name: 'Pessoal', colorClass: 'text-yellow-400' }
  ]);
  const [filterCriteria, setFilterCriteria] = useState({ from: '', subject: '', hasAttachment: false });
  const [rightPanelWidth, setRightPanelWidth] = useState(typeof window !== 'undefined' ? window.innerWidth / 2 : 600);
  const [isResizing, setIsResizing] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false); 
  const [calendarViewMode, setCalendarViewMode] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [viewDate, setViewDate] = useState(new Date());
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date()); 
  
  // EVENT STATES (NO POPUPS)
  const [activeEvent, setActiveEvent] = useState<any>(null); // Usado tanto para Visualizar quanto para Editar/Criar
  const [newEventColor, setNewEventColor] = useState('bg-blue-500'); 
  const [guestInput, setGuestInput] = useState(''); // Estado para input de convidado

  // Drag & Resize State for Calendar
  const [dragState, setDragState] = useState<{
      id: number;
      type: 'move' | 'resize';
      startY: number;
      originalStart: Date;
      originalEnd: Date;
  } | null>(null);

  // Settings
  const [settings, setSettings] = useState({
      darkMode: true,
      desktopNotif: true,
      emailSignature: "Atenciosamente,\nDev Criativo\nWorkspace Hub",
      autoReply: false,
      calendarWeekends: true,
      calendarDuration: 60,
      compactView: false,
      smartFeatures: true
  });

  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<number>>(new Set());
  const [activeEmail, setActiveEmail] = useState<any>(null);
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, type: 'email' | 'event', data: any} | null>(null);

  // Composer
  const [composeAttachments, setComposeAttachments] = useState<any[]>([]);
  const [composeTo, setComposeTo] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeBcc, setComposeBcc] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [isComposerMaximized, setIsComposerMaximized] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showFormatting, setShowFormatting] = useState(true); 
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  // Drag & UI
  const [draggedEmail, setDraggedEmail] = useState<any>(null);
  const [dragOverTab, setDragOverTab] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [swipedEmailId, setSwipedEmailId] = useState<number | null>(null);
  
  const [toast, setToast] = useState<{message: string, action?: () => void, timer?: any} | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- ACTIONS ---

  const handleEditorCommand = (command: string, value: string | undefined = undefined) => {
      document.execCommand(command, false, value);
      if (editorRef.current) editorRef.current.focus();
  };

  const handleFormat = (command: string, value?: string) => {
      handleEditorCommand(command, value);
  };

  const handleLink = () => {
      const url = prompt("Inserir Link:", "https://");
      if(url) handleFormat('createLink', url);
  };

  const handleImageUpload = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
          const file = e.target.files[0];
          if(file) {
              const reader = new FileReader();
              reader.onload = (ev) => {
                  if (ev.target?.result) handleFormat('insertImage', ev.target.result as string);
              };
              reader.readAsDataURL(file);
          }
      };
      input.click();
  };

  const handleInsertEmoji = (emoji: string) => {
      handleFormat('insertText', emoji);
      setShowEmojiPicker(false);
  };

  const handleInsertSignature = () => {
      const sig = settings.emailSignature.replace(/\n/g, '<br>');
      const html = `<br><div style="color: rgba(255,255,255,0.5); font-size: 12px; margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">--<br>${sig}</div>`;
      document.execCommand('insertHTML', false, html);
      if (editorRef.current) editorRef.current.focus();
  };

  const handleConfidential = () => {
      showToast("Modo confidencial: O destinatário não poderá encaminhar, copiar ou imprimir este e-mail.");
  };

  const onFileSelected = (e: any) => {
      if (e.target.files?.[0]) {
          setComposeAttachments(prev => [...prev, { name: e.target.files[0].name, size: '2MB' }]);
      }
  };

  const showToast = (msg: string) => setToast({ message: msg });

  // --- INIT DATA ---
  useEffect(() => {
    if (data) {
        if (data.emails) {
             const enhanced = data.emails.map((e:any, index: number) => ({
                 ...e, 
                 folder: 'inbox', 
                 read: false,
                 isStarred: index === 1,
                 labels: index === 0 ? ['label_project'] : [],
                 hasAttachment: index % 2 === 0
             }));
             setEmails(enhanced);
        }
        
        if (data.events) {
            setCalendarEvents(data.events);
        } else {
            // Fallback se não vier do backend
            setCalendarEvents([
                { id: 1, title: 'Reunião Diária', start: new Date(new Date().setHours(9,0)), end: new Date(new Date().setHours(10,0)), color: 'bg-blue-500', location: 'Meet', recurrence: 'daily', guests: [{name: 'Julia Silva', avatar: 'J', color: 'bg-purple-600'}, {name: 'Roberto Alves', avatar: 'R', color: 'bg-orange-500'}] }
            ]);
        }

        if (data.tasks) setTasks(data.tasks);
        if (data.notes) setNotes(data.notes);
    }
  }, [data]);

  // --- CALENDAR LOGIC (DRAG & RESIZE) ---
  useEffect(() => {
      const handleGlobalMouseMove = (e: MouseEvent) => {
          if (!dragState) return;

          const pixelDiff = e.clientY - dragState.startY;
          const snappedMinutes = Math.round(pixelDiff / 15) * 15;

          setCalendarEvents(prev => prev.map(ev => {
              if (ev.id !== dragState.id) return ev;

              const newStart = new Date(dragState.originalStart);
              const newEnd = new Date(dragState.originalEnd);

              if (dragState.type === 'move') {
                  newStart.setMinutes(dragState.originalStart.getMinutes() + snappedMinutes);
                  newEnd.setMinutes(dragState.originalEnd.getMinutes() + snappedMinutes);
              } else if (dragState.type === 'resize') {
                  newEnd.setMinutes(dragState.originalEnd.getMinutes() + snappedMinutes);
                  if (newEnd <= newStart) newEnd.setMinutes(newStart.getMinutes() + 15);
              }

              return { ...ev, start: newStart, end: newEnd };
          }));
      };

      const handleGlobalMouseUp = () => {
          if (dragState) {
              setDragState(null);
              document.body.style.cursor = '';
              showToast('Agenda atualizada (localmente)');
          }
      };

      if (dragState) {
          window.addEventListener('mousemove', handleGlobalMouseMove);
          window.addEventListener('mouseup', handleGlobalMouseUp);
          document.body.style.cursor = dragState.type === 'move' ? 'grabbing' : 'ns-resize';
      }

      return () => {
          window.removeEventListener('mousemove', handleGlobalMouseMove);
          window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
  }, [dragState]);

  const handleCalendarMouseDown = (e: React.MouseEvent, id: number, type: 'move' | 'resize', start: Date, end: Date) => {
      e.stopPropagation();
      setDragState({
          id,
          type,
          startY: e.clientY,
          originalStart: start,
          originalEnd: end
      });
  };

  // --- SHORTCUTS & TIME ---
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) return;
          switch(e.key.toLowerCase()) {
              case 'c': e.preventDefault(); setActivePane('compose'); break;
              case '/': e.preventDefault(); setShowFilterPanel(true); break;
              case 'delete': case '#': if (selectedEmailIds.size > 0 || activeEmail) handleBulkAction('trash'); break;
              case 'r': if (activeEmail) { e.preventDefault(); const replyBox = document.querySelector('textarea') as HTMLTextAreaElement; if(replyBox) replyBox.focus(); } break;
              case 'escape': 
                  setShowFilterPanel(false); setShowNewMenu(false); setContextMenu(null); setShowEmojiPicker(false);
                  if (activePane === 'event-create' || activePane === 'event-view') setActivePane('agenda');
                  break;
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEmailIds, activeEmail, activePane]);

  useEffect(() => {
      const interval = setInterval(() => setCurrentTime(new Date()), 60000);
      return () => clearInterval(interval);
  }, []);

  useEffect(() => {
      const handleClick = () => { setContextMenu(null); };
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
  }, []);

  // --- RESIZE LOGIC ---
  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          if (isResizing) { 
              const newWidth = window.innerWidth - e.clientX;
              if (newWidth > 350 && newWidth < window.innerWidth - 350) setRightPanelWidth(newWidth);
          }
      };
      const handleMouseUp = () => { setIsResizing(false); document.body.style.cursor = ''; document.body.style.userSelect = ''; };
      if (isResizing) {
          window.addEventListener('mousemove', handleMouseMove);
          window.addEventListener('mouseup', handleMouseUp);
          document.body.style.userSelect = 'none';
      } 
      return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isResizing]);

  // --- ACTIONS ---
  const handleCreateLabel = (name: string) => {
      const newLabel = { id: `label_${Date.now()}`, name: name, colorClass: 'text-green-400' };
      setCustomLabels([...customLabels, newLabel]);
      showToast(`Marcador "${name}" criado`);
  };

  const toggleEmailSelection = (id: number) => {
      const newSet = new Set(selectedEmailIds);
      if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
      setSelectedEmailIds(newSet);
  };

  const toggleStar = (id: number) => {
      setEmails(prev => prev.map(e => e.id === id ? { ...e, isStarred: !e.isStarred } : e));
      bridge.manageEmail(id, 'star');
  };

  const toggleReadStatus = (id: number) => {
      const email = emails.find(e => e.id === id);
      if (email) {
          const newReadStatus = !email.read;
          setEmails(prev => prev.map(e => e.id === id ? { ...e, read: newReadStatus } : e));
          bridge.manageEmail(id, newReadStatus ? 'read' : 'unread');
      }
  };

  const handleBulkAction = async (action: 'trash' | 'archive' | 'spam' | 'read' | 'unread') => {
      let msg = '';
      if (action === 'trash') msg = 'Movido para a Lixeira';
      else if (action === 'archive') msg = 'Arquivado';
      else if (action === 'spam') msg = 'Marcado como Spam';
      
      const targetFolder = action === 'trash' ? 'trash' : action === 'archive' ? 'all' : action === 'spam' ? 'spam' : 'inbox';
      const isFolderAction = ['trash', 'archive', 'spam'].includes(action);

      const apply = async (id: number) => {
          if (isFolderAction) {
              setEmails(prev => prev.map(e => e.id === id ? { ...e, folder: targetFolder } : e));
          }
          await bridge.manageEmail(id, action);
      };
      
      if (selectedEmailIds.size > 0) { 
          selectedEmailIds.forEach(apply); 
          setSelectedEmailIds(new Set()); 
      } else if (swipedEmailId) { 
          await apply(swipedEmailId); 
          setSwipedEmailId(null); 
      } else if (activeEmail) { 
          await apply(activeEmail.id); 
          setActiveEmail(null); 
      }
      
      if (msg) showToast(msg);
  };

  const handleSnooze = (id: number) => {
      setEmails(prev => prev.map(e => e.id === id ? { ...e, folder: 'snoozed', read: true } : e));
      showToast('Conversa adiada para amanhã');
      if (activeEmail && activeEmail.id === id) setActiveEmail(null);
  }

  const handleEmailClick = (email: any) => {
      if (email.folder === 'drafts') {
          setComposeTo(email.to || '');
          setComposeSubject(email.subject || '');
          if(editorRef.current) editorRef.current.innerHTML = email.preview || '';
          setActivePane('compose');
      } else {
          setActiveEmail(email);
          setActivePane('email');
          // Optimistic UI update
          if (!email.read) {
              setEmails(prev => prev.map(e => e.id === email.id ? { ...e, read: true } : e));
              bridge.manageEmail(email.id, 'read');
          }
      }
  };

  // SEND REPLY LOGIC
  const handleSendReply = () => {
      if(!replyText.trim()) return;
      
      bridge.sendEmail(activeEmail.sender, "Re: " + activeEmail.subject, replyText);

      const newReply = {
          id: Date.now(),
          sender: "Eu",
          senderInit: "E",
          subject: activeEmail.subject.startsWith("Re:") ? activeEmail.subject : "Re: " + activeEmail.subject,
          preview: replyText,
          time: "Agora",
          read: true,
          folder: 'sent',
          color: 'bg-blue-600'
      };

      setEmails(prev => [newReply, ...prev]);
      showToast('Resposta enviada');
      setReplyText('');
  };

  const handleContextMenu = (e: React.MouseEvent, type: 'email' | 'event', data: any) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, type, data });
  };

  // SEND NEW EMAIL LOGIC
  const handleSendEmail = () => {
      if (!composeTo && !composeSubject) {
          showToast("Adicione um destinatário ou assunto.");
          return;
      }
      
      const body = editorRef.current ? editorRef.current.innerText : "...";
      bridge.sendEmail(composeTo, composeSubject, body);

      const newEmail = {
          id: Date.now(),
          sender: "Eu",
          senderInit: "E",
          subject: composeSubject || "(Sem assunto)",
          preview: body,
          time: "Agora",
          read: true,
          folder: 'sent',
          color: 'bg-blue-600'
      };

      setEmails(prev => [newEmail, ...prev]);
      setActivePane('agenda'); 
      if(editorRef.current) editorRef.current.innerHTML = '';
      setComposeTo('');
      setComposeSubject('');
      setComposeAttachments([]);
      showToast('Mensagem enviada.');
  };

  const handleCloseComposer = () => {
      const content = editorRef.current?.innerText.trim();
      if (content || composeSubject || composeTo) {
          // Save Draft UI
          const draft = {
              id: Date.now(),
              sender: "Rascunho",
              senderInit: "R",
              subject: composeSubject || "(Sem assunto)",
              preview: content || "...",
              time: "Rascunho",
              read: true,
              folder: 'drafts',
              to: composeTo,
              color: 'bg-gray-600'
          };
          setEmails(prev => [draft, ...prev]);
          showToast('Rascunho salvo');
      }
      setActivePane('agenda');
      if(editorRef.current) editorRef.current.innerHTML = '';
      setComposeTo('');
      setComposeSubject('');
      setComposeAttachments([]);
  };

  const handleDragStart = (e: React.DragEvent, email: any) => {
      setDraggedEmail(email);
      const ghost = document.createElement('div');
      ghost.innerText = email.subject;
      ghost.style.background = '#1F1F1F';
      ghost.style.color = 'white';
      ghost.style.padding = '8px 12px';
      ghost.style.borderRadius = '8px';
      ghost.style.border = '1px solid rgba(255,255,255,0.2)';
      ghost.style.position = 'absolute';
      ghost.style.top = '-1000px';
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 0, 0);
      e.dataTransfer.setData('text/plain', JSON.stringify(email));
      setTimeout(() => document.body.removeChild(ghost), 0);
  };

  const handleMoveEmailToFolder = (folderId: string) => {
      if (draggedEmail) {
          setEmails(prev => prev.map(e => e.id === draggedEmail.id ? { ...e, folder: folderId } : e));
          setDraggedEmail(null);
          setDragOverTab(null);
          showToast(`Conversa movida`);
      }
  };

  const handleDropOnTab = (tab: 'agenda' | 'tasks' | 'keep') => {
      if (!draggedEmail) return;
      if (tab === 'tasks') {
          setTasks(prev => [{ id: Date.now(), title: draggedEmail.subject, completed: false }, ...prev]);
          showToast('Tarefa criada');
      } else if (tab === 'agenda') {
          // NOVO: Preenche o formulário e muda para 'event-create' no painel direito
          setActiveEvent({ title: draggedEmail.subject, start: new Date(), end: new Date(), guests: [] });
          setActivePane('event-create');
      } else if (tab === 'keep') {
          setNotes(prev => [{ id: Date.now(), title: draggedEmail.subject, content: draggedEmail.preview }, ...prev]);
          showToast('Nota salva');
      }
      if(tab !== 'agenda') setActivePane(tab);
      setDraggedEmail(null);
      setDragOverTab(null);
  };

  const handleTouchStart = (e: React.TouchEvent, id: number) => {
      setTouchStart(e.targetTouches[0].clientX);
  };
  const handleTouchMove = (e: React.TouchEvent, id: number) => {
      if (touchStart === null) return;
      const currentX = e.targetTouches[0].clientX;
      const diff = touchStart - currentX;
      if (diff > 60) setSwipedEmailId(id); 
      else if (diff < -10 && swipedEmailId === id) setSwipedEmailId(null);
  };
  const handleTouchEnd = () => {
      setTouchStart(null);
  };

  // --- FILTERS ---
  const displayedEmails = emails.filter(e => {
      if (searchQuery) return e.subject.toLowerCase().includes(searchQuery.toLowerCase()) || e.sender.toLowerCase().includes(searchQuery.toLowerCase());
      if (filterCriteria.from && !e.sender.toLowerCase().includes(filterCriteria.from.toLowerCase())) return false;
      if (filterCriteria.subject && !e.subject.toLowerCase().includes(filterCriteria.subject.toLowerCase())) return false;
      if (filterCriteria.hasAttachment && !e.hasAttachment) return false;
      if (mailFolder.startsWith('label_')) return e.labels && e.labels.includes(mailFolder);
      if (mailFolder === 'starred') return e.isStarred;
      return e.folder === mailFolder;
  });

  // --- CALENDAR RENDER ---
  const hours24 = Array.from({ length: 24 }, (_, i) => i);
  // Expand recurrences first
  const expandedEvents = expandEvents(calendarEvents, viewDate, calendarViewMode === 'day' ? 'day' : calendarViewMode === 'week' ? 'week' : 'month');
  
  // Filter for specific views
  const dayEvents = layoutEvents(expandedEvents.filter(ev => new Date(ev.start).getDate() === viewDate.getDate()));
  const allDayEvents = expandedEvents.filter(ev => ev.isAllDay && new Date(ev.start).getDate() === viewDate.getDate());

  function layoutEvents(events: any[]) {
      // Basic overlap logic for Day View
      return arrangeEvents(events);
  }

  const renderCalendar = () => {
      // --- DAY VIEW ---
      if (calendarViewMode === 'day') {
          return (
              <div className="flex-1 flex flex-col h-full bg-[#1E1E1E]">
                  {allDayEvents.length > 0 && (
                      <div className="border-b border-white/10 p-2 bg-white/5 flex flex-col gap-1 shrink-0">
                          <span className="text-[10px] text-white/40 uppercase pl-2">Dia Inteiro</span>
                          {allDayEvents.map(ev => (
                              <div key={ev.id} className={`mx-1 p-1 rounded ${ev.color} text-xs text-white font-medium shadow-sm cursor-pointer hover:brightness-110`} onClick={() => { setActiveEvent(ev); setActivePane('event-view'); }}>
                                  {ev.title}
                              </div>
                          ))}
                      </div>
                  )}
                  <div className="flex-1 overflow-y-auto custom-scrollbar relative" ref={calendarRef}>
                    <div className="relative min-h-[1440px] pb-20">
                        {hours24.map(h => (
                            <div key={h} className="h-[60px] border-b border-white/5 flex relative group" 
                                onClick={() => { 
                                    setActiveEvent({ start: new Date(new Date(viewDate).setHours(h, 0)), end: new Date(new Date(viewDate).setHours(h+1, 0)), title: '', location: '', guests: [], recurrence: 'none' });
                                    setActivePane('event-create'); 
                                }}
                                title={`Adicionar evento às ${h}:00`}>
                                <div className="w-14 text-right pr-3 text-xs text-white/40 -mt-2 pointer-events-none select-none">{h}:00</div>
                                <div className="flex-1 hover:bg-white/5 cursor-pointer relative"><div className="absolute inset-x-0 top-1/2 border-t border-white/[0.03]"></div></div>
                            </div>
                        ))}
                        
                        {dayEvents.map((ev: any) => {
                            const startH = ev.start.getHours();
                            const startM = ev.start.getMinutes();
                            const duration = (ev.end.getTime() - ev.start.getTime()) / (1000 * 60 * 60);
                            const top = startH * 60 + startM; 
                            const height = duration * 60;
                            
                            return (
                                <div 
                                    key={ev.id} 
                                    className={`absolute rounded-lg ${ev.color} text-xs shadow-lg border-l-4 border-black/20 cursor-pointer hover:brightness-110 z-10 transition-none hover:scale-[1.01] overflow-hidden group select-none ${dragState?.id === ev.id ? 'opacity-80 z-50 ring-2 ring-white scale-105' : ''} ${ev.isVirtual ? 'opacity-70 border-dashed border-white/30' : ''}`} 
                                    style={{ 
                                        top: `${top}px`, 
                                        height: `${Math.max(30, height)}px`,
                                        left: `calc(3.5rem + 10px + ${ev.leftPercent}%)`,
                                        width: `calc(${ev.widthPercent}% - 12px)`,
                                    }} 
                                    onMouseDown={(e) => !ev.isVirtual && handleCalendarMouseDown(e, ev.id, 'move', ev.start, ev.end)}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveEvent(ev); // SET THE EVENT
                                        setActivePane('event-view'); // SWITCH PANE
                                    }}
                                    onContextMenu={(e) => handleContextMenu(e, 'event', ev)}
                                >
                                    <div className="p-2 h-full flex flex-col pointer-events-none">
                                        <div className="font-bold text-white truncate flex items-center gap-1">
                                            {ev.title} {ev.recurrence !== 'none' && <RotateCw size={10} className="text-white/70"/>}
                                        </div>
                                        <div className="text-white/80 truncate flex items-center gap-1"><MapPin size={10}/> {ev.location}</div>
                                    </div>
                                    {!ev.isVirtual && (
                                        <div 
                                            className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize flex justify-center items-end hover:bg-black/10 transition-colors pointer-events-auto"
                                            onMouseDown={(e) => handleCalendarMouseDown(e, ev.id, 'resize', ev.start, ev.end)}
                                        >
                                            <div className="w-8 h-1 bg-white/40 rounded-full mb-1"></div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        <div className="absolute left-14 right-0 border-t border-red-500 z-20 pointer-events-none" style={{ top: `${currentTime.getHours() * 60 + currentTime.getMinutes()}px` }}>
                            <div className="absolute -left-1.5 -top-1.5 w-3 h-3 bg-red-500 rounded-full"></div>
                        </div>
                    </div>
                  </div>
              </div>
          );
      }
      
      // --- WEEK VIEW ---
      if (calendarViewMode === 'week') {
          const daysOfWeek = [];
          const startOfWeek = new Date(viewDate);
          const day = startOfWeek.getDay(); 
          const diff = startOfWeek.getDate() - day; 
          startOfWeek.setDate(diff); // Sunday

          for(let i=0; i<7; i++) {
              const d = new Date(startOfWeek);
              d.setDate(startOfWeek.getDate() + i);
              daysOfWeek.push(d);
          }

          return (
              <div className="flex-1 flex flex-col h-full bg-[#1E1E1E]">
                  {/* Week Header */}
                  <div className="flex border-b border-white/10 pl-14">
                      {daysOfWeek.map((d, i) => (
                          <div key={i} className={`flex-1 py-2 text-center border-l border-white/5 ${d.toDateString() === new Date().toDateString() ? 'bg-blue-500/10' : ''}`}>
                              <p className={`text-[10px] uppercase font-bold ${d.toDateString() === new Date().toDateString() ? 'text-blue-400' : 'text-white/50'}`}>{d.toLocaleDateString('pt-BR', {weekday: 'short'})}</p>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg mx-auto mt-1 ${d.toDateString() === new Date().toDateString() ? 'bg-blue-600 text-white font-bold' : 'text-white'}`}>{d.getDate()}</div>
                          </div>
                      ))}
                  </div>
                  {/* Week Grid */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                      <div className="relative min-h-[1440px] flex">
                          {/* Time Col */}
                          <div className="w-14 shrink-0 border-r border-white/10 bg-[#1E1E1E] z-20 sticky left-0">
                              {hours24.map(h => (
                                  <div key={h} className="h-[60px] text-right pr-2 text-xs text-white/40 pt-1 -mt-2.5 bg-[#1E1E1E]">{h}:00</div>
                              ))}
                          </div>
                          {/* Days Cols */}
                          {daysOfWeek.map((d, i) => {
                              const dayEvs = expandedEvents.filter(ev => new Date(ev.start).toDateString() === d.toDateString() && !ev.isAllDay);
                              const layout = arrangeEvents(dayEvs); // Layout per column
                              return (
                                  <div key={i} className="flex-1 border-l border-white/5 relative min-w-[100px] hover:bg-white/[0.02]" onClick={() => { setActiveEvent({ start: new Date(d.setHours(9,0)), end: new Date(d.setHours(10,0)), title: '', guests: [], recurrence: 'none' }); setActivePane('event-create'); }}>
                                      {hours24.map(h => <div key={h} className="h-[60px] border-b border-white/5 pointer-events-none"></div>)}
                                      
                                      {/* Events in this Col */}
                                      {layout.map(ev => {
                                          const startH = ev.start.getHours();
                                          const startM = ev.start.getMinutes();
                                          const duration = (ev.end.getTime() - ev.start.getTime()) / (1000 * 60 * 60);
                                          const top = startH * 60 + startM; 
                                          const height = duration * 60;
                                          return (
                                              <div 
                                                  key={ev.id} 
                                                  className={`absolute rounded-md ${ev.color} text-[10px] p-1 cursor-pointer hover:brightness-110 border-l-2 border-black/20 overflow-hidden ${ev.isVirtual ? 'opacity-70 border-dashed' : 'shadow-md'}`}
                                                  style={{ top: `${top}px`, height: `${Math.max(20, height)}px`, left: `${ev.leftPercent}%`, width: `${ev.widthPercent}%` }}
                                                  onClick={(e) => { e.stopPropagation(); setActiveEvent(ev); setActivePane('event-view'); }}
                                              >
                                                  <span className="font-bold truncate block">{ev.title}</span>
                                                  <span className="truncate block opacity-80">{ev.start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                              </div>
                                          );
                                      })}
                                      {/* Current Time Line */}
                                      {d.toDateString() === new Date().toDateString() && (
                                          <div className="absolute left-0 right-0 border-t border-red-500 z-20 pointer-events-none" style={{ top: `${currentTime.getHours() * 60 + currentTime.getMinutes()}px` }}></div>
                                      )}
                                  </div>
                              )
                          })}
                      </div>
                  </div>
              </div>
          );
      }

      // --- MONTH VIEW ---
      if (calendarViewMode === 'month') {
          const year = viewDate.getFullYear();
          const month = viewDate.getMonth();
          const firstDay = new Date(year, month, 1);
          const lastDay = new Date(year, month + 1, 0);
          const days = [];
          
          const startPad = firstDay.getDay(); // 0 is Sunday
          for(let i=startPad; i>0; i--) days.push({ date: new Date(year, month, 1 - i), isPadding: true });
          for(let i=1; i<=lastDay.getDate(); i++) days.push({ date: new Date(year, month, i), isPadding: false });
          const remaining = 42 - days.length;
          for(let i=1; i<=remaining; i++) days.push({ date: new Date(year, month + 1, i), isPadding: true });

          return (
              <div className="flex-1 flex flex-col bg-[#1E1E1E] overflow-hidden">
                  <div className="grid grid-cols-7 border-b border-white/10 shrink-0">
                      {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                          <div key={d} className="py-2 text-center text-xs font-bold text-white/50 uppercase">{d}</div>
                      ))}
                  </div>
                  <div className="flex-1 grid grid-cols-7 grid-rows-6">
                      {days.map((dObj, idx) => {
                          const dateStr = dObj.date.toDateString();
                          const isToday = dateStr === new Date().toDateString();
                          const dayEvents = expandedEvents.filter(ev => new Date(ev.start).toDateString() === dateStr);
                          
                          return (
                              <div key={idx} className={`border-b border-r border-white/5 p-1 relative flex flex-col group ${dObj.isPadding ? 'bg-black/20' : 'bg-transparent'} hover:bg-white/[0.02] transition-colors`} onClick={() => { setViewDate(dObj.date); setCalendarViewMode('day'); }}>
                                  <div className="flex justify-center mb-1">
                                      <span className={`text-xs w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white font-bold' : dObj.isPadding ? 'text-white/30' : 'text-white/90'}`}>{dObj.date.getDate()}</span>
                                  </div>
                                  <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                                      {dayEvents.slice(0, 4).map(ev => (
                                          <div key={ev.id} className={`text-[9px] px-1.5 py-0.5 rounded-sm ${ev.color} text-white truncate cursor-pointer hover:brightness-110 shadow-sm`} onClick={(e) => { e.stopPropagation(); setActiveEvent(ev); setActivePane('event-view'); }}>
                                              {ev.isAllDay ? '' : <span className="opacity-80 mr-1">{ev.start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>}
                                              {ev.title}
                                          </div>
                                      ))}
                                      {dayEvents.length > 4 && <div className="text-[9px] text-white/50 pl-1 font-medium hover:text-white cursor-pointer">+ mais {dayEvents.length - 4}</div>}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              </div>
          );
      }

      // Year view could be added here similar to month view logic
      return null;
  };

  const primaryFolders = [
      { id: 'inbox', label: 'Entrada', icon: Inbox },
      { id: 'drafts', label: 'Rascunhos', icon: FileIcon },
      { id: 'spam', label: 'Spam', icon: AlertOctagon },
      { id: 'trash', label: 'Lixeira', icon: Trash2 },
  ];

  const secondaryFolders = [
      { id: 'important', label: 'Importantes', icon: AlertCircle },
      { id: 'starred', label: 'Estrela', icon: Star },
      { id: 'sent', label: 'Enviados', icon: Send },
      { id: 'scheduled', label: 'Programados', icon: CalendarClock },
      { id: 'snoozed', label: 'Adiados', icon: Clock },
  ];

  return (
    <div className="flex flex-col h-full bg-[#191919] relative text-white" onContextMenu={(e) => e.preventDefault()}>
        
        {/* HEADER */}
        <div className={appHeaderClass}>
            <div className="flex items-center gap-4 w-72">
                <div className="flex items-center gap-3">
                    <GoogleIcons.GmailGlass className="w-10 h-10 transition-transform duration-300 hover:-translate-y-1 drop-shadow-md" />
                    <span className="text-white text-xl font-light tracking-tight">Email & Calendário</span>
                </div>
            </div>
            <div className="flex-1"></div>
            <div className="flex items-center gap-4 w-64 justify-end">
                <div className="p-2 hover:bg-white/10 rounded-full cursor-pointer text-white/80 transition-colors" onClick={onClose} title="Fechar Aplicativo"><X size={24} /></div>
            </div>
        </div>

        <div className="flex-1 flex overflow-hidden relative p-3 gap-3">
            
            {/* PAINEL ESQUERDO */}
            <div className="flex-1 flex flex-col bg-[#1E1E1E] rounded-[24px] border border-white/5 overflow-hidden relative">
                
                {/* TOP MENU PILLS */}
                <div className="flex flex-col border-b border-white/5 bg-[#1E1E1E] shrink-0">
                    <div className="flex items-center justify-between p-3 gap-2 px-4 h-[70px]">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setLeftPanelMode(leftPanelMode === 'settings' ? 'list' : 'settings')} className={`p-2 rounded-full mr-1 transition-colors ${leftPanelMode === 'settings' ? 'bg-blue-600 text-white' : 'hover:bg-white/10 text-white/70'}`} title="Configurações"><Settings size={20} /></button>
                            <div className="h-5 w-[1px] bg-white/10 mr-1"></div>
                            <Checkbox checked={false} onChange={() => {}} className="hover:bg-white/5" />
                            <div className="relative">
                                <button onClick={() => setShowFilterPanel(!showFilterPanel)} className={`p-2 rounded-full transition-colors flex items-center gap-2 ${['important','starred','sent','scheduled','snoozed'].includes(mailFolder) || mailFolder.startsWith('label_') ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-white/10 text-white/70'}`} title="Filtros e Pastas"><Filter size={20}/></button>
                                <AdvancedFilterPanel isOpen={showFilterPanel} onClose={() => setShowFilterPanel(false)} onApply={() => setShowFilterPanel(false)} setFolder={setMailFolder} currentFolder={mailFolder} secondaryFolders={secondaryFolders} customLabels={customLabels} filterCriteria={filterCriteria} setFilterCriteria={setFilterCriteria} />
                            </div>
                        </div>

                        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar px-2 mx-2 flex-1 mask-linear-fade">
                            {primaryFolders.map(folder => (
                                <button key={folder.id} onClick={() => setMailFolder(folder.id as any)} onDragOver={(e) => e.preventDefault()} onDrop={() => handleMoveEmailToFolder(folder.id)} className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap shrink-0 ${mailFolder === folder.id ? 'bg-white/10 text-white border border-white/10' : 'text-white/60 hover:bg-white/5 hover:text-white border border-transparent'} ${draggedEmail ? 'hover:bg-blue-500/20 hover:border-blue-500 hover:text-blue-400' : ''}`} title={`Ir para ${folder.label}`}>
                                    <folder.icon size={14} />
                                    {folder.label}
                                </button>
                            ))}
                        </div>

                        <div className="relative ml-auto">
                            <button onClick={() => setShowNewMenu(!showNewMenu)} className="flex items-center gap-2 bg-[#C2E7FF] text-[#001D35] px-5 py-2 rounded-full font-medium shadow-md hover:shadow-xl hover:scale-105 transition-all shrink-0" title="Criar novo">
                                <Plus size={20} strokeWidth={2.5} /> <span className="hidden md:inline">Novo</span>
                            </button>
                            {showNewMenu && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowNewMenu(false)}></div>
                                    <div className="absolute top-full right-0 mt-2 w-48 bg-[#2d2e30] border border-white/10 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in zoom-in duration-200 backdrop-blur-xl overflow-hidden">
                                        <button onClick={() => { setActivePane('compose'); setShowNewMenu(false); }} className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors group"><Mail size={16} className="text-red-400 group-hover:scale-110 transition-transform" /><span className="text-sm font-medium text-white/90">Novo E-mail</span></button>
                                        <div className="h-[1px] bg-white/5 w-full"></div>
                                        <button onClick={() => { 
                                            // INSTEAD OF MODAL, SWITCH PANE TO CREATE EVENT
                                            setActiveEvent({ title: '', start: new Date(), end: new Date(new Date().setHours(new Date().getHours() + 1)), guests: [], recurrence: 'none' });
                                            setActivePane('event-create'); 
                                            setShowNewMenu(false); 
                                        }} className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors group"><CalendarIcon size={16} className="text-green-400 group-hover:scale-110 transition-transform" /><span className="text-sm font-medium text-white/90">Novo Evento</span></button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-0 overflow-x-hidden relative bg-[#191919]">
                    {leftPanelMode === 'list' ? (
                        <div className="flex flex-col">
                            {displayedEmails.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-white/30">
                                    <Inbox size={48} className="mb-2 opacity-50"/>
                                    <p className="text-sm">Nenhum e-mail em {primaryFolders.find(f=>f.id===mailFolder)?.label || secondaryFolders.find(f=>f.id===mailFolder)?.label || mailFolder}</p>
                                </div>
                            ) : (
                                displayedEmails.map((email: any) => (
                                    <div key={email.id} className="relative group border-b border-white/10 last:border-0">
                                        <div 
                                            className={`relative z-10 ${!email.read ? 'bg-white/5' : 'bg-[#1E1E1E]'} hover:bg-[#2A2A2A] rounded-2xl transition-all duration-200 p-3 pl-6 flex items-start gap-3 cursor-pointer ${activeEmail?.id === email.id ? 'bg-white/10' : ''}`} 
                                            onClick={() => handleEmailClick(email)} 
                                            draggable="true" 
                                            onDragStart={(e) => handleDragStart(e, email)}
                                            style={{ transform: swipedEmailId === email.id ? 'translateX(-80px)' : 'translateX(0)' }}
                                            onTouchStart={(e) => handleTouchStart(e, email.id)}
                                            onTouchMove={(e) => handleTouchMove(e, email.id)}
                                            onTouchEnd={handleTouchEnd}
                                            onContextMenu={(e) => handleContextMenu(e, 'email', email)}
                                        >
                                            <div className={`flex items-center justify-center pt-2 transition-all duration-300 ease-in-out overflow-hidden ${selectedEmailIds.has(email.id) ? 'w-6 opacity-100 mr-1' : 'w-0 opacity-0 group-hover:w-6 group-hover:opacity-100 group-hover:mr-1'}`} onClick={(e) => e.stopPropagation()}><Checkbox checked={selectedEmailIds.has(email.id)} onChange={() => toggleEmailSelection(email.id)} /></div>
                                            <div className="pt-2 hover:scale-110 transition-transform cursor-pointer" onClick={(e) => { e.stopPropagation(); toggleStar(email.id); }}><Star size={16} className={email.isStarred ? "text-yellow-400 fill-yellow-400" : "text-white/30 hover:text-white/60"} /></div>
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${email.color || 'bg-gradient-to-br from-blue-600 to-purple-600'}`}>{email.senderInit || email.sender[0]}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-0.5 relative h-5"><span className={`text-sm ${!email.read ? 'text-white font-bold' : 'text-white/70 font-medium'}`}>{email.sender}</span><span className={`text-[10px] absolute right-0 top-0 transition-opacity duration-200 group-hover:opacity-0 ${!email.read ? 'text-blue-400 font-bold' : 'text-white/40'}`}>{email.time}</span></div>
                                                <div className="flex items-center gap-2 mb-1">{email.hasAttachment && <PaperclipIcon size={12} className="text-white/60"/><h4 className={`text-xs truncate flex-1 ${!email.read ? 'text-white font-bold' : 'text-white/70 font-medium'}`}>{email.subject}</h4>}</div>
                                                <p className={`text-[11px] truncate ${!email.read ? 'text-white/60' : 'text-white/40'}`}>{email.preview}</p>
                                            </div>
                                        </div>
                                        {/* Swipe Action Background */}
                                        <div className="absolute inset-y-0 right-0 w-24 bg-red-500/20 flex items-center justify-end px-6 rounded-2xl" onClick={() => handleBulkAction('trash')}>
                                            <Trash2 className="text-red-500" size={20} />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="p-4 animate-in fade-in slide-in-from-left-4 duration-300">
                            <div className="flex items-center gap-2 mb-6">
                                <button onClick={() => setLeftPanelMode('list')} className="p-1 hover:bg-white/10 rounded-full text-white/60" title="Voltar para lista"><ArrowLeft size={18}/></button>
                                <h2 className="text-lg font-medium text-white">Configurações</h2>
                            </div>
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <h3 className="text-blue-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2"><User size={14}/> Geral</h3>
                                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div><p className="text-sm font-medium text-white">Tema Escuro</p><p className="text-[10px] text-white/40">Sempre ativo</p></div>
                                            <ToggleSwitch checked={settings.darkMode} onChange={() => setSettings({...settings, darkMode: !settings.darkMode})} />
                                        </div>
                                    </div>
                                </div>
                                <button className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-white text-sm font-medium transition-colors" onClick={() => {setLeftPanelMode('list'); showToast('Configurações salvas');}}>Salvar e Voltar</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* RESIZER */}
            <div className="w-1.5 h-full cursor-col-resize hover:bg-blue-500/50 transition-all rounded-full flex flex-col justify-center items-center opacity-0 hover:opacity-100 group z-50 shrink-0" onMouseDown={() => setIsResizing(true)} title="Redimensionar painéis">
                <div className="w-1 h-8 bg-white/40 rounded-full group-hover:bg-white/80"></div>
            </div>

            {/* PAINEL DIREITO */}
            <div className={`flex flex-col bg-[#1E1E1E] rounded-[24px] border border-white/5 overflow-hidden relative transition-all duration-0 ease-linear`} style={{ width: rightPanelWidth }}>
                
                {/* TABS */}
                <div className="h-14 flex items-center justify-between px-6 border-b border-white/5 shrink-0 bg-[#1E1E1E] z-20 relative">
                    <div className="flex bg-white/5 backdrop-blur-xl border border-white/10 p-1 rounded-[99px] h-[40px] items-center gap-1 w-full overflow-x-auto custom-scrollbar">
                        {['email', 'agenda', 'tasks', 'keep'].map((tab: any) => (
                            <button 
                                key={tab}
                                onClick={() => setActivePane(tab)}
                                onDragOver={(e) => { e.preventDefault(); setDragOverTab(tab); }}
                                onDragLeave={() => setDragOverTab(null)}
                                onDrop={() => handleDropOnTab(tab)}
                                className={`flex-1 min-w-[70px] h-full rounded-full text-xs font-medium transition-all flex items-center justify-center gap-2 ${activePane.includes(tab) ? 'bg-white/10 text-white shadow-sm border border-white/5' : 'text-white/50 hover:bg-white/5 hover:text-white'} ${draggedEmail && dragOverTab === tab ? 'bg-blue-500/30 text-white ring-2 ring-blue-500' : ''}`}
                            >
                                {tab === 'email' && <Mail size={14} />}
                                {tab === 'agenda' && <LayoutTemplate size={14} />}
                                {tab === 'tasks' && <CheckCircle size={14} />}
                                {tab === 'keep' && <StickyNote size={14} />}
                                <span className="capitalize hidden md:inline">{tab === 'email' ? 'Leitura' : tab}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* AGENDA CONTENT */}
                <div className={`absolute inset-0 top-14 bottom-0 w-full transition-opacity duration-300 ${activePane === 'agenda' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                    <div className="p-4 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                             <button className="p-1 hover:bg-white/10 rounded text-white/70" onClick={() => { const d = new Date(viewDate); d.setDate(d.getDate() - (calendarViewMode === 'month' ? 30 : 1)); setViewDate(d); }}><ChevronLeft size={16}/></button>
                             <h2 className="text-lg font-light text-white capitalize">{viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', day: calendarViewMode === 'day' ? 'numeric' : undefined })}</h2>
                             <button className="p-1 hover:bg-white/10 rounded text-white/70" onClick={() => { const d = new Date(viewDate); d.setDate(d.getDate() + (calendarViewMode === 'month' ? 30 : 1)); setViewDate(d); }}><ChevronRight size={16}/></button>
                        </div>
                        <div className="relative">
                            <button onClick={() => setShowViewMenu(!showViewMenu)} className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded text-xs text-white hover:bg-white/10 border border-white/5">{calendarViewMode === 'day' ? 'Dia' : calendarViewMode === 'week' ? 'Semana' : calendarViewMode === 'month' ? 'Mês' : 'Ano'} <ChevronDown size={12}/></button>
                            {showViewMenu && (
                                <div className="absolute top-8 right-0 bg-[#2d2e30] border border-white/10 rounded-lg shadow-xl py-1 z-30 min-w-[100px] animate-in fade-in zoom-in duration-200">
                                    <button onClick={() => { setCalendarViewMode('day'); setShowViewMenu(false); }} className="w-full text-left px-4 py-2 text-xs text-white hover:bg-white/10">Dia</button>
                                    <button onClick={() => { setCalendarViewMode('week'); setShowViewMenu(false); }} className="w-full text-left px-4 py-2 text-xs text-white hover:bg-white/10">Semana</button>
                                    <button onClick={() => { setCalendarViewMode('month'); setShowViewMenu(false); }} className="w-full text-left px-4 py-2 text-xs text-white hover:bg-white/10">Mês</button>
                                    <button onClick={() => { setCalendarViewMode('year'); setShowViewMenu(false); }} className="w-full text-left px-4 py-2 text-xs text-white hover:bg-white/10">Ano</button>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex-1 h-full overflow-hidden flex flex-col relative">
                        {renderCalendar()}
                    </div>
                </div>

                {/* EVENT VIEWER (IN PLACE, NO POPUP) */}
                <div className={`absolute inset-0 top-14 bottom-0 w-full bg-[#1E1E1E] transition-opacity duration-300 ${activePane === 'event-view' ? 'opacity-100 z-20' : 'opacity-0 z-0 pointer-events-none'}`}>
                    {activeEvent && (
                        <div className="h-full flex flex-col">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                                <button onClick={() => setActivePane('agenda')} className="p-2 hover:bg-white/10 rounded-full text-white/70"><ArrowLeft size={18}/></button>
                                <div className="flex gap-2">
                                    <button className="p-2 hover:bg-white/10 rounded-full text-white/70" onClick={() => setActivePane('event-create')}><Pencil size={18}/></button>
                                    <button className="p-2 hover:bg-white/10 rounded-full text-white/70 hover:text-red-400" onClick={() => { 
                                        setCalendarEvents(prev => prev.filter(e => e.id !== activeEvent.id)); 
                                        bridge.deleteCalendarEvent(activeEvent.id);
                                        setActivePane('agenda'); 
                                        showToast('Evento excluído'); 
                                    }}><Trash2 size={18}/></button>
                                </div>
                            </div>
                            <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                                <h2 className="text-2xl font-medium text-white">{activeEvent.title || "(Sem título)"}</h2>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4 text-white/90">
                                        <Clock size={20} className="text-blue-400"/>
                                        <div>
                                            {activeEvent.isAllDay ? (
                                                <p className="text-sm font-medium">{activeEvent.start.toLocaleDateString()} • Dia Inteiro</p>
                                            ) : (
                                                <p className="text-sm font-medium">{activeEvent.start.toLocaleDateString()} • {activeEvent.start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {activeEvent.end.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                                            )}
                                            {activeEvent.recurrence && activeEvent.recurrence !== 'none' && <p className="text-xs text-white/50 mt-1 flex items-center gap-1"><RotateCw size={10}/> Repete: {activeEvent.recurrence === 'daily' ? 'Diariamente' : 'Semanalmente'}</p>}
                                        </div>
                                    </div>
                                    {activeEvent.location && (
                                        <div className="flex items-center gap-4 text-white/90">
                                            <MapPin size={20} className="text-red-400"/>
                                            <p className="text-sm">{activeEvent.location}</p>
                                        </div>
                                    )}
                                    {activeEvent.meetLink && (
                                        <div className="flex items-center gap-4 text-white/90 bg-blue-500/10 p-3 rounded-xl border border-blue-500/30">
                                            <Video size={20} className="text-blue-400"/>
                                            <div className="flex-1">
                                                <p className="text-xs font-bold text-blue-300">Google Meet</p>
                                                <p className="text-xs text-white/60 truncate">meet.google.com/{activeEvent.meetLink}</p>
                                            </div>
                                            <button onClick={() => window.open(`https://meet.google.com/${activeEvent.meetLink}`, '_blank')} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-xs font-medium">Entrar</button>
                                        </div>
                                    )}
                                    <div className="pt-4 border-t border-white/10">
                                        <p className="text-xs text-white/50 font-bold uppercase mb-3 flex items-center gap-2"><Users size={14}/> Convidados ({activeEvent.guests?.length || 0})</p>
                                        {activeEvent.guests?.length > 0 ? (
                                            <div className="space-y-3">
                                                {activeEvent.guests.map((g: any, i: number) => (
                                                    <div key={i} className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${g.color || 'bg-gray-600'}`}>{g.avatar}</div>
                                                        <div>
                                                            <p className="text-sm text-white/90">{g.name}</p>
                                                            {i === 0 && <p className="text-[10px] text-white/40">Organizador</p>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-white/40 italic">Nenhum convidado.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* EVENT CREATOR (IN PLACE, NO POPUP) */}
                <div className={`absolute inset-0 top-14 bottom-0 w-full bg-[#1E1E1E] transition-opacity duration-300 ${activePane === 'event-create' ? 'opacity-100 z-20' : 'opacity-0 z-0 pointer-events-none'}`}>
                    <div className="h-full flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                            <button onClick={() => setActivePane('agenda')} className="p-2 hover:bg-white/10 rounded-full text-white/70"><X size={18}/></button>
                            <button className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium" onClick={async () => {
                                const newEv = { 
                                    id: activeEvent?.id || Date.now().toString(), 
                                    title: activeEvent?.title || 'Novo Evento', 
                                    start: activeEvent?.start || new Date(), 
                                    end: activeEvent?.end || new Date(), 
                                    color: newEventColor, 
                                    location: activeEvent?.location || '',
                                    guests: activeEvent?.guests || [],
                                    isAllDay: activeEvent?.isAllDay || false,
                                    recurrence: activeEvent?.recurrence || 'none',
                                    meetLink: activeEvent?.meetLink,
                                    addMeet: !!activeEvent?.meetLink
                                };
                                
                                // Otimistically update UI
                                setCalendarEvents(prev => {
                                    if (activeEvent?.id) return prev.map(e => e.id === activeEvent.id ? newEv : e);
                                    return [...prev, newEv];
                                });
                                setActivePane('agenda');
                                
                                // Call Backend
                                await bridge.createCalendarEvent(newEv);
                                showToast('Evento salvo');
                            }}>Salvar</button>
                        </div>
                        <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                            <input 
                                type="text" 
                                placeholder="Adicionar título" 
                                className="w-full bg-transparent text-2xl text-white placeholder:text-white/30 outline-none border-b border-white/10 pb-2 focus:border-blue-500 transition-colors"
                                value={activeEvent?.title || ''}
                                onChange={(e) => setActiveEvent({...activeEvent, title: e.target.value})}
                                autoFocus
                            />
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <Clock size={20} className="text-white/50"/>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-white/70">Dia Inteiro</span>
                                            <ToggleSwitch checked={activeEvent?.isAllDay || false} onChange={() => setActiveEvent({...activeEvent, isAllDay: !activeEvent?.isAllDay})} />
                                        </div>
                                        {!activeEvent?.isAllDay && (
                                            <div className="flex gap-2">
                                                <div className="bg-white/5 px-3 py-2 rounded text-sm text-white/80">{activeEvent?.start?.toLocaleDateString()}</div>
                                                <div className="bg-white/5 px-3 py-2 rounded text-sm text-white/80">{activeEvent?.start?.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                                                <span className="self-center text-white/40">-</span>
                                                <div className="bg-white/5 px-3 py-2 rounded text-sm text-white/80">{activeEvent?.end?.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 mt-1">
                                            <RotateCw size={14} className="text-white/50"/>
                                            <select 
                                                className="bg-transparent text-sm text-white/80 border border-white/10 rounded px-2 py-1 outline-none"
                                                value={activeEvent?.recurrence || 'none'}
                                                onChange={(e) => setActiveEvent({...activeEvent, recurrence: e.target.value})}
                                            >
                                                <option value="none">Não se repete</option>
                                                <option value="daily">Diariamente</option>
                                                <option value="weekly">Semanalmente</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Video size={20} className="text-white/50"/>
                                    {activeEvent?.meetLink ? (
                                        <div className="flex items-center gap-2 bg-blue-500/20 px-3 py-1 rounded-full border border-blue-500/30">
                                            <span className="text-sm text-blue-200">Adicionado: Google Meet</span>
                                            <X size={14} className="cursor-pointer text-white/60 hover:text-white" onClick={() => setActiveEvent({...activeEvent, meetLink: undefined})}/>
                                        </div>
                                    ) : (
                                        <button onClick={() => setActiveEvent({...activeEvent, meetLink: "new"})} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white font-medium">Adicionar videoconferência do Google Meet</button>
                                    )}
                                </div>
                                <div className="flex items-center gap-4">
                                    <MapPin size={20} className="text-white/50"/>
                                    <input type="text" placeholder="Adicionar local" className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none py-2 border-b border-white/5 focus:border-white/20" value={activeEvent?.location || ''} onChange={(e) => setActiveEvent({...activeEvent, location: e.target.value})}/>
                                </div>
                                <div className="flex items-center gap-4">
                                    <AlignLeft size={20} className="text-white/50"/>
                                    <textarea placeholder="Adicionar descrição" className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none py-2 resize-none h-20 border-b border-white/5 focus:border-white/20"></textarea>
                                </div>
                                <div className="pl-9">
                                    <p className="text-xs text-white/40 mb-2">Cor do evento</p>
                                    <div className="flex gap-3">
                                        {['bg-blue-500', 'bg-red-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500'].map(color => (
                                            <div 
                                                key={color} 
                                                className={`w-6 h-6 rounded-full cursor-pointer ${color} ${newEventColor === color ? 'ring-2 ring-white scale-110' : 'opacity-50 hover:opacity-100'} transition-all`}
                                                onClick={() => setNewEventColor(color)}
                                            ></div>
                                        ))}
                                    </div>
                                </div>
                                
                                {/* GUESTS INPUT */}
                                <div className="flex items-start gap-4">
                                    <Users size={20} className="text-white/50 mt-2"/>
                                    <div className="flex-1">
                                        <input 
                                            type="text" 
                                            placeholder="Adicionar convidados (Enter)" 
                                            className="w-full bg-transparent text-sm text-white placeholder:text-white/30 outline-none py-2 border-b border-white/5 focus:border-white/20"
                                            value={guestInput}
                                            onChange={(e) => setGuestInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && guestInput.trim()) {
                                                    const newGuest = { name: guestInput, avatar: guestInput[0].toUpperCase(), color: 'bg-gray-500' };
                                                    setActiveEvent(prev => ({ ...prev, guests: [...(prev.guests || []), newGuest] }));
                                                    setGuestInput('');
                                                }
                                            }}
                                        />
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {activeEvent?.guests?.map((g: any, i: number) => (
                                                <div key={i} className="flex items-center gap-2 bg-white/10 rounded-full pl-1 pr-2 py-1">
                                                    <div className="w-5 h-5 rounded-full bg-gray-500 text-[10px] flex items-center justify-center text-white">{g.avatar}</div>
                                                    <span className="text-xs text-white">{g.name}</span>
                                                    <X size={12} className="cursor-pointer hover:text-red-400" onClick={() => setActiveEvent(prev => ({...prev, guests: prev.guests.filter((_, idx) => idx !== i)}))}/>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* EMAIL READER */}
                <div className={`absolute inset-0 top-14 bottom-0 w-full transition-opacity duration-300 ${activePane === 'email' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                    {activeEmail ? (
                        <div className="flex flex-col h-full bg-[#1E1E1E]">
                            <div className="flex items-center justify-between px-6 py-2 border-b border-white/5 bg-white/[0.02]">
                                <div className="flex items-center gap-1">
                                    <button onClick={() => { setActivePane('email'); setActiveEmail(null); }} className="p-2 hover:bg-white/10 rounded-full text-white/70 mr-2"><ArrowLeft size={18}/></button>
                                    <button onClick={() => handleBulkAction('archive')} className="p-2 hover:bg-white/10 rounded-full text-white/70"><Archive size={18}/></button>
                                    <button onClick={() => handleBulkAction('trash')} className="p-2 hover:bg-white/10 rounded-full text-white/70"><Trash2 size={18}/></button>
                                    <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
                                    <button onClick={() => { toggleReadStatus(activeEmail.id); setActivePane('agenda'); setActiveEmail(null); }} className="p-2 hover:bg-white/10 rounded-full text-white/70" title="Marcar como não lida"><Mail size={18}/></button>
                                    <button onClick={() => { handleSnooze(activeEmail.id); }} className="p-2 hover:bg-white/10 rounded-full text-white/70" title="Adiar"><Clock size={18}/></button>
                                </div>
                            </div>
                            <div className="px-6 py-4">
                                <h2 className="text-xl font-medium text-white break-words">{activeEmail.subject}</h2>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-6">
                                <div className="flex items-start gap-4 mb-6">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white shrink-0">{activeEmail.senderInit || activeEmail.sender[0]}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-white text-sm">{activeEmail.sender}</div>
                                        <div className="text-xs text-white/40">para mim</div>
                                    </div>
                                    <div className="text-xs text-white/40">{activeEmail.time}</div>
                                </div>
                                <div className="text-sm text-white/90 leading-7 whitespace-pre-wrap font-light border-b border-white/5 pb-8 min-h-[100px]">{activeEmail.preview}</div>
                                
                                {/* Quick Reply Box */}
                                <div className="mt-6 flex gap-4">
                                    <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-sm font-bold text-white shrink-0">E</div>
                                    <div className="flex-1">
                                        <div className="relative border border-white/10 rounded-lg bg-white/5 focus-within:bg-black/40 focus-within:border-white/30 transition-all overflow-hidden">
                                            {replyText === '' && (
                                                <div className="absolute top-3 left-3 flex gap-2 pointer-events-none">
                                                    <span className="text-white/40 text-sm flex items-center gap-1"><Reply size={14}/> Responder</span>
                                                </div>
                                            )}
                                            <textarea 
                                                className="w-full bg-transparent text-white text-sm p-3 outline-none min-h-[60px] resize-y" 
                                                value={replyText}
                                                onChange={(e) => setReplyText(e.target.value)}
                                            />
                                            {replyText && (
                                                <div className="flex items-center justify-between p-2 bg-black/20 border-t border-white/5">
                                                    <div className="flex gap-2">
                                                        <button className="p-1.5 hover:bg-white/10 rounded text-white/60" title="Anexar arquivo"><PaperclipIcon size={16}/></button>
                                                    </div>
                                                    <button onClick={handleSendReply} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-full text-sm font-medium transition-colors" title="Enviar resposta">Enviar</button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-white/30"><Mail size={48} className="mb-4 opacity-50"/><p>Selecione um e-mail para ler</p></div>
                    )}
                </div>

                <div className={`absolute inset-0 top-14 bottom-0 w-full transition-opacity duration-300 ${activePane === 'tasks' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                    <div className="p-6">
                        <h2 className="text-xl font-medium text-white mb-4">Tarefas</h2>
                        <div className="space-y-2">{tasks.map((t:any) => (<div key={t.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5"><Checkbox checked={t.completed} onChange={() => {}} /><span className={t.completed ? 'line-through text-white/40' : 'text-white'}>{t.title}</span></div>))}</div>
                    </div>
                </div>

                {/* COMPOSER (In Place) */}
                <div className={`absolute inset-0 top-14 bottom-0 w-full bg-[#1E1E1E] transition-opacity duration-300 ${activePane === 'compose' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                     <div className="flex flex-col h-full p-6">
                         <div className="flex items-center justify-between mb-4">
                             <h2 className="text-lg font-medium text-white">Nova Mensagem</h2>
                             <button onClick={handleCloseComposer} className="p-2 hover:bg-white/10 rounded-full text-white/70" title="Salvar e Fechar"><X size={18}/></button>
                         </div>
                         <div className="space-y-1 mb-4">
                             <div className="flex items-center bg-white/5 border-b border-white/10 pr-2 transition-colors focus-within:bg-black/20 focus-within:border-blue-500">
                                <input type="text" placeholder="Para" className="flex-1 bg-transparent p-2 text-sm text-white outline-none" value={composeTo} onChange={(e) => setComposeTo(e.target.value)} />
                                <button onClick={() => setShowCcBcc(!showCcBcc)} className="text-xs text-white/50 hover:text-white px-2">Cc/Cco</button>
                             </div>
                             {showCcBcc && (
                                <div className="animate-in fade-in slide-in-from-top-1">
                                    <input type="text" placeholder="Cc" className="w-full bg-white/5 border-b border-white/10 p-2 text-sm text-white outline-none focus:border-blue-500 transition-colors" value={composeCc} onChange={(e) => setComposeCc(e.target.value)} />
                                    <input type="text" placeholder="Cco" className="w-full bg-white/5 border-b border-white/10 p-2 text-sm text-white outline-none focus:border-blue-500 transition-colors" value={composeBcc} onChange={(e) => setComposeBcc(e.target.value)} />
                                </div>
                             )}
                             <input type="text" placeholder="Assunto" className="w-full bg-white/5 border-b border-white/10 p-2 text-sm text-white outline-none focus:border-blue-500 transition-colors" value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} />
                         </div>
                         <div ref={editorRef} contentEditable className="flex-1 bg-transparent w-full outline-none text-white/90 text-sm leading-relaxed custom-scrollbar overflow-y-auto p-2 border border-transparent focus:border-white/10 rounded-lg"></div>
                         <div className="flex flex-col gap-2 mt-auto pt-2 border-t border-white/10">
                            {showFormatting && (
                                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg mb-2 overflow-x-auto custom-scrollbar">
                                    <button className="p-1.5 hover:bg-white/10 rounded text-white/70" onMouseDown={(e) => { e.preventDefault(); handleFormat('bold'); }}><Bold size={14}/></button>
                                    <button className="p-1.5 hover:bg-white/10 rounded text-white/70" onMouseDown={(e) => { e.preventDefault(); handleFormat('italic'); }}><Italic size={14}/></button>
                                    <button className="p-1.5 hover:bg-white/10 rounded text-white/70" onMouseDown={(e) => { e.preventDefault(); handleFormat('underline'); }}><Underline size={14}/></button>
                                    <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
                                    <button className="p-1.5 hover:bg-white/10 rounded text-white/70" onMouseDown={(e) => { e.preventDefault(); handleFormat('justifyLeft'); }}><AlignLeft size={14}/></button>
                                    <button className="p-1.5 hover:bg-white/10 rounded text-white/70" onMouseDown={(e) => { e.preventDefault(); handleFormat('justifyCenter'); }}><AlignCenter size={14}/></button>
                                    <button className="p-1.5 hover:bg-white/10 rounded text-white/70" onMouseDown={(e) => { e.preventDefault(); handleFormat('justifyRight'); }}><AlignRight size={14}/></button>
                                    <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
                                    <button className="p-1.5 hover:bg-white/10 rounded text-white/70" onMouseDown={(e) => { e.preventDefault(); handleFormat('insertUnorderedList'); }}><ListIcon size={14}/></button>
                                </div>
                            )}
                            <div className="flex justify-between items-center">
                                <div className="flex gap-2 items-center relative">
                                    <button onClick={handleSendEmail} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-full transition-colors flex items-center gap-2">Enviar <Send size={14}/></button>
                                    <div className="flex items-center gap-1 ml-2">
                                        <button onClick={() => setShowFormatting(!showFormatting)} className="p-2 rounded hover:bg-white/10 transition-colors text-white/70"><Type size={18} /></button>
                                        <button onClick={handleLink} className="p-2 hover:bg-white/10 rounded text-white/70"><LinkIcon size={18} /></button>
                                        <div className="relative">
                                            <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2 hover:bg-white/10 rounded text-white/70"><Smile size={18} /></button>
                                            {showEmojiPicker && <EmojiPicker onSelect={handleInsertEmoji} onClose={() => setShowEmojiPicker(false)} />}
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => { setComposeTo(''); setComposeSubject(''); setActivePane('agenda'); }} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-red-400"><Trash2 size={18} /></button>
                            </div>
                         </div>
                     </div>
                </div>

                <div className={`absolute inset-0 top-14 bottom-0 w-full transition-opacity duration-300 ${activePane === 'keep' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                    <div className="flex flex-col h-full p-6">
                        <h2 className="text-xl font-medium text-white mb-4">Keep Notes</h2>
                        <div className="grid grid-cols-1 gap-4">{notes.map((n:any) => (<div key={n.id} className="bg-white/5 p-4 rounded-xl border border-white/5 animate-in fade-in"><h3 className="font-bold text-sm text-white mb-1">{n.title}</h3><p className="text-xs text-white/70">{n.content}</p></div>))}</div>
                    </div>
                </div>

            </div>
        </div>

        {/* MENU DE CONTEXTO */}
        {contextMenu && (
            <div className="fixed z-50 bg-[#2d2e30] border border-white/10 rounded-lg shadow-2xl py-1 min-w-[180px] backdrop-blur-xl animate-in fade-in zoom-in duration-100" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={(e) => e.stopPropagation()}>
                {contextMenu.type === 'email' ? (
                    <>
                        <button className="w-full text-left px-4 py-2.5 text-sm text-white/90 hover:bg-white/10 flex items-center gap-3 transition-colors" onClick={() => { setActivePane('email'); setActiveEmail(contextMenu.data); setContextMenu(null); }}><Reply size={14} className="text-white/60"/> Responder</button>
                        <button className="w-full text-left px-4 py-2.5 text-sm text-white/90 hover:bg-white/10 flex items-center gap-3 transition-colors" onClick={() => { toggleEmailSelection(contextMenu.data.id); setContextMenu(null); }}><CheckSquare size={14} className="text-white/60"/> Selecionar</button>
                        <div className="h-[1px] bg-white/5 w-full my-1"></div>
                        <button className="w-full text-left px-4 py-2.5 text-sm text-white/90 hover:bg-white/10 flex items-center gap-3 transition-colors hover:text-red-400" onClick={() => { handleBulkAction('trash'); setContextMenu(null); }}><Trash2 size={14}/> Excluir</button>
                    </>
                ) : (
                    <>
                        <button className="w-full text-left px-4 py-2.5 text-sm text-white/90 hover:bg-white/10 flex items-center gap-3 transition-colors" onClick={() => { setContextMenu(null); setActiveEvent(contextMenu.data); setActivePane('event-view'); }}><Eye size={14} className="text-white/60"/> Visualizar</button>
                        <button className="w-full text-left px-4 py-2.5 text-sm text-white/90 hover:bg-white/10 flex items-center gap-3 transition-colors" onClick={() => { setContextMenu(null); setActiveEvent(contextMenu.data); setActivePane('event-create'); }}><Pencil size={14} className="text-white/60"/> Editar</button>
                        <div className="h-[1px] bg-white/5 w-full my-1"></div>
                        <div className="px-4 py-2">
                            <p className="text-[10px] text-white/40 mb-2 uppercase">Cor</p>
                            <div className="flex gap-2">
                                {['bg-blue-500', 'bg-red-500', 'bg-green-500'].map(color => (
                                    <div key={color} onClick={() => { 
                                        setCalendarEvents(prev => prev.map(e => e.id === contextMenu.data.id ? {...e, color} : e));
                                        setContextMenu(null);
                                    }} className={`w-4 h-4 rounded-full cursor-pointer ${color} hover:scale-125 transition-transform`}></div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        )}

        {/* TOAST */}
        {toast && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-[#323232] text-white px-6 py-3 rounded-lg shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300 z-50 border border-white/10">
                <span>{toast.message}</span>
                <button onClick={() => setToast(null)} className="ml-2 text-white/50 hover:text-white" title="Fechar"><X size={16}/></button>
            </div>
        )}
    </div>
  );
}