
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
      // showToast("Modo confidencial: O destinatário não poderá encaminhar, copiar ou imprimir este e-mail.");
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
      // bridge.manageEmail(id, 'star');
  };

  const toggleReadStatus = (id: number) => {
      const email = emails.find(e => e.id === id);
      if (email) {
          const newReadStatus = !email.read;
          setEmails(prev => prev.map(e => e.id === id ? { ...e, read: newReadStatus } : e));
          // bridge.manageEmail(id, newReadStatus ? 'read' : 'unread');
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
          // await bridge.manageEmail(id, action);
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
              // bridge.manageEmail(email.id, 'read');
          }
      }
  };

  // SEND REPLY LOGIC
  const handleSendReply = () => {
      if(!replyText.trim()) return;
      
      // bridge.sendEmail(activeEmail.sender, "Re: " + activeEmail.subject, replyText);

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
      // bridge.sendEmail(composeTo, composeSubject, body);

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
                              const dayEvs = expandedEvents.filter