
import React, { useState, useEffect, useRef } from 'react';
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
  RemoveFormatting
} from 'lucide-react';
import { GoogleIcons } from '../GoogleIcons';

interface MailAppProps {
  onClose: () => void;
  data: any;
  searchQuery?: string;
}

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

// Painel de Filtro Expandido que absorve as pastas secundárias
const AdvancedFilterPanel = ({ isOpen, onClose, onApply, setFolder, currentFolder, secondaryFolders, advancedFilters, setAdvancedFilters }: any) => {
    if (!isOpen) return null;
    return (
        <div className="absolute top-16 left-6 w-[340px] bg-[#2d2e30] border border-white/10 rounded-xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in duration-200 backdrop-blur-xl">
            {/* Navigation Section (Absorbed Buttons) */}
            <div className="mb-4 pb-4 border-b border-white/10">
                <p className="text-[10px] text-white/40 uppercase font-bold mb-2 px-1">Pastas & Filtros</p>
                <div className="grid grid-cols-2 gap-2">
                    {secondaryFolders.map((folder: any) => (
                        <button 
                            key={folder.id}
                            onClick={() => { setFolder(folder.id); onClose(); }}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${currentFolder === folder.id ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/80 hover:bg-white/10'}`}
                            title={`Ir para ${folder.label}`}
                        >
                            <folder.icon size={14} />
                            {folder.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Search Fields */}
            <div className="space-y-3 mb-4">
                <p className="text-[10px] text-white/40 uppercase font-bold px-1">Busca Avançada (FASE 1C)</p>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] text-white/50 block mb-1">De</label>
                        <input type="text" placeholder="sender@example.com" value={advancedFilters.from} onChange={(e) => setAdvancedFilters({...advancedFilters, from: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none" />
                    </div>
                    <div>
                        <label className="text-[10px] text-white/50 block mb-1">Para</label>
                        <input type="text" placeholder="recipient@example.com" value={advancedFilters.to} onChange={(e) => setAdvancedFilters({...advancedFilters, to: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none" />
                    </div>
                </div>
                <div>
                    <label className="text-[10px] text-white/50 block mb-1">Assunto</label>
                    <input type="text" placeholder="Search in subject..." value={advancedFilters.subject} onChange={(e) => setAdvancedFilters({...advancedFilters, subject: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-[10px] text-white/50 block mb-1">De (data)</label>
                        <input type="date" value={advancedFilters.dateFrom} onChange={(e) => setAdvancedFilters({...advancedFilters, dateFrom: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none" />
                    </div>
                    <div>
                        <label className="text-[10px] text-white/50 block mb-1">Até (data)</label>
                        <input type="date" value={advancedFilters.dateTo} onChange={(e) => setAdvancedFilters({...advancedFilters, dateTo: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none" />
                    </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                    <Checkbox checked={advancedFilters.hasAttachment} onChange={() => setAdvancedFilters({...advancedFilters, hasAttachment: !advancedFilters.hasAttachment})} />
                    <span className="text-xs text-white/80">Contém anexo</span>
                </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-white/70 hover:bg-white/5" title="Fechar painel">Fechar</button>
                <button onClick={onApply} className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500" title="Aplicar filtros">Filtrar</button>
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
  
  // Layout & Navegação
  const [activePane, setActivePane] = useState<'agenda' | 'email' | 'compose' | 'tasks' | 'keep'>('agenda');
  const [leftPanelMode, setLeftPanelMode] = useState<'list' | 'settings'>('list');
  const [mailFolder, setMailFolder] = useState<'inbox' | 'important' | 'starred' | 'sent' | 'scheduled' | 'snoozed' | 'drafts' | 'spam' | 'trash'>('inbox');
  
  // DIVISÃO DE TELA: Inicializa com 50% da largura da janela
  const [rightPanelWidth, setRightPanelWidth] = useState(typeof window !== 'undefined' ? window.innerWidth / 2 : 600);
  
  const [isResizing, setIsResizing] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  
  // Advanced Search / Filter States (FASE 1C)
  const [advancedFilters, setAdvancedFilters] = useState({
      from: '',
      to: '',
      subject: '',
      hasAttachment: false,
      dateFrom: '',
      dateTo: ''
  });
  
  // Calendar States
  const [calendarViewMode, setCalendarViewMode] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [viewDate, setViewDate] = useState(new Date());
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventTime, setNewEventTime] = useState({ start: '09:00', end: '10:00' });
  const [showViewMenu, setShowViewMenu] = useState(false);

  // Settings States
  const [settings, setSettings] = useState({
      darkMode: true,
      desktopNotif: true,
      emailSignature: "Enviado do meu Workspace Hub",
      autoReply: false,
      calendarWeekends: true,
      calendarDuration: 60,
      compactView: false,
      smartFeatures: true
  });

  // Seleção e Interação
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<number>>(new Set());
  const [activeEmail, setActiveEmail] = useState<any>(null);
  
  // Composer & Reply
  const [composeAttachments, setComposeAttachments] = useState<any[]>([]);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [isComposerMaximized, setIsComposerMaximized] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showFormatting, setShowFormatting] = useState(false); // Gmail formatting toolbar toggle
  
  // Drag and Drop (Desktop) & Swipe (Mobile)
  const [draggedEmail, setDraggedEmail] = useState<any>(null);
  const [dragOverTab, setDragOverTab] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [swipedEmailId, setSwipedEmailId] = useState<number | null>(null);
  
  // UI Auxiliar
  const [toast, setToast] = useState<{message: string, action?: () => void} | null>(null);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const newMenuRef = useRef<HTMLDivElement>(null);

  // --- EFEITOS ---
  useEffect(() => {
    if (data) {
        // Init logic & Data distribution for folder simulation
        if (data.emails) {
             const enhanced = data.emails.map((e:any, index: number) => ({
                 ...e, 
                 folder: 'inbox', // Default
                 read: false,
                 isStarred: index === 1,
                 labels: [], // Novo: etiquetas
                 replies: [] // Novo: threading
             }));
             
             // Adicionar conversas com threading
             enhanced.push(
                 { 
                   id: 101, sender: 'Julia Silva', subject: 'Reunião de Design', 
                   preview: 'Vamos agendar o review do Design System.', 
                   time: '09:00', read: true, folder: 'important', senderInit: 'J', color: 'bg-purple-500',
                   labels: ['urgent'], replies: [
                     { id: 1, from: 'Você', body: 'Ótimo! Quarta 14h?', timestamp: new Date(), read: true, avatar: 'https://ui-avatars.com/api/?name=Voce&background=4285F4' },
                     { id: 2, from: 'Julia Silva', body: 'Perfeito! Te vejo lá.', timestamp: new Date(Date.now() - 3600000), read: true, avatar: 'https://ui-avatars.com/api/?name=Julia+Silva&background=9C27B0' }
                   ]
                 },
                 { 
                   id: 102, sender: 'AWS Billing', subject: 'Fatura Disponível', 
                   preview: 'Sua fatura de Julho está pronta.', 
                   time: 'Ontem', read: false, folder: 'inbox', isStarred: true, senderInit: 'A', color: 'bg-orange-500',
                   labels: ['bills'], replies: []
                 },
                 { 
                   id: 103, sender: 'Equipe Asana', subject: 'Resumo Semanal', 
                   preview: 'Você completou 5 tarefas esta semana.', 
                   time: 'Seg', read: true, folder: 'trash', senderInit: 'E', color: 'bg-red-500',
                   labels: ['work'], replies: []
                 },
                 { 
                   id: 104, sender: 'Newsletter Tech', subject: 'Novidades AI 2024', 
                   preview: 'Tudo sobre os novos modelos.', 
                   time: '10:00', read: false, folder: 'spam', senderInit: 'N', color: 'bg-green-500',
                   labels: [], replies: []
                 },
                 { 
                   id: 105, sender: 'Eu', subject: 'Rascunho de Proposta', 
                   preview: 'Olá cliente, segue a proposta...', 
                   time: '11:30', read: true, folder: 'drafts', senderInit: 'E', color: 'bg-gray-500',
                   labels: [], replies: []
                 },
                 { 
                   id: 106, sender: 'Eu', subject: 'Relatório Enviado', 
                   preview: 'Segue anexo o relatório mensal.', 
                   time: 'Ontem', read: true, folder: 'sent', senderInit: 'E', color: 'bg-blue-500',
                   labels: ['reports'], replies: []
                 },
                 { 
                   id: 107, sender: 'Chefe', subject: 'Adiado: Reunião', 
                   preview: 'Vamos mover para semana que vem.', 
                   time: '08:00', read: false, folder: 'snoozed', senderInit: 'C', color: 'bg-yellow-500',
                   labels: ['urgent'], replies: []
                 },
                 { 
                   id: 108, sender: 'Eu', subject: 'Agendado: Feliz Aniversário', 
                   preview: 'Parabéns!', 
                   time: 'Amanhã', read: true, folder: 'scheduled', senderInit: 'E', color: 'bg-pink-500',
                   labels: [], replies: []
                 },
                 { 
                   id: 109, sender: 'Promoção', subject: 'Oferta Relâmpago', 
                   preview: '50% de desconto hoje.', 
                   time: 'Ontem', read: false, folder: 'spam', senderInit: 'P', color: 'bg-yellow-600',
                   labels: [], replies: []
                 },
                 { 
                   id: 110, sender: 'Lixeira', subject: 'Arquivo Antigo', 
                   preview: 'Este item será excluído em 30 dias.', 
                   time: 'Há 5 dias', read: true, folder: 'trash', senderInit: 'L', color: 'bg-gray-600',
                   labels: [], replies: []
                 }
             );
             setEmails(enhanced);
        }
        
        // Calendar Mocks
        setCalendarEvents([
            { id: 1, title: 'Reunião Diária', start: new Date(new Date().setHours(9,0)), end: new Date(new Date().setHours(10,0)), color: 'bg-blue-500', location: 'Meet' },
            { id: 2, title: 'Almoço Cliente', start: new Date(new Date().setHours(12,30)), end: new Date(new Date().setHours(14,0)), color: 'bg-orange-500', location: 'Restaurante' },
            { id: 3, title: 'Call Noturna', start: new Date(new Date().setHours(20,0)), end: new Date(new Date().setHours(21,0)), color: 'bg-purple-500', location: 'Zoom' }
        ]);
        if (data.tasks) setTasks(data.tasks);
        if (data.notes) setNotes(data.notes);
    }
  }, [data]);

  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          if (!isResizing) return;
          const newWidth = window.innerWidth - e.clientX;
          if (newWidth > 350 && newWidth < window.innerWidth - 350) setRightPanelWidth(newWidth);
      };
      const handleMouseUp = () => setIsResizing(false);
      
      if (isResizing) {
          window.addEventListener('mousemove', handleMouseMove);
          window.addEventListener('mouseup', handleMouseUp);
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
      } else {
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
      }
      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, [isResizing]);

  // Scroll to 8am on calendar mount
  useEffect(() => {
      if (activePane === 'agenda' && calendarRef.current && (calendarViewMode === 'day' || calendarViewMode === 'week')) {
          // 8am is roughly 8 * 60px height
          setTimeout(() => {
             if(calendarRef.current) calendarRef.current.scrollTop = 480; 
          }, 100);
      }
  }, [activePane, calendarViewMode]);

  useEffect(() => {
      if (toast) {
          const timer = setTimeout(() => setToast(null), 4000);
          return () => clearTimeout(timer);
      }
  }, [toast]);

  // Fechar menu "Novo" ao clicar fora
  useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
          if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
              setShowNewMenu(false);
          }
      };
      if (showNewMenu) {
          document.addEventListener('mousedown', handleClickOutside);
      }
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNewMenu]);

  // --- LÓGICA ---

  const toggleEmailSelection = (id: number) => {
      const newSet = new Set(selectedEmailIds);
      if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
      setSelectedEmailIds(newSet);
  };

  const handleBulkAction = (action: string) => {
      showToast(`${selectedEmailIds.size > 0 ? selectedEmailIds.size : '1'} conversa(s) movida(s) para ${action}`);
      if (selectedEmailIds.size > 0) {
          setEmails(prev => prev.filter(e => !selectedEmailIds.has(e.id)));
          setSelectedEmailIds(new Set());
      } else if (swipedEmailId) {
          setEmails(prev => prev.filter(e => e.id !== swipedEmailId));
          setSwipedEmailId(null);
      }
      if (activeEmail && selectedEmailIds.size === 0 && !swipedEmailId) {
          setEmails(prev => prev.filter(e => e.id !== activeEmail.id));
          setActiveEmail(null);
      }
  };

  const handleEmailClick = (email: any) => {
      setActiveEmail(email);
      setActivePane('email');
      setEmails(prev => prev.map(e => e.id === email.id ? { ...e, read: true } : e));
  };

  const handleSendReply = () => {
      if(!replyText.trim() || !activeEmail) return;
      
      // Adicionar reply à thread
      const updatedEmails = emails.map(e => {
          if (e.id === activeEmail.id) {
              const newReply = {
                  id: (e.replies?.length || 0) + 1,
                  from: 'Você',
                  body: replyText,
                  timestamp: new Date(),
                  read: true,
                  avatar: 'https://ui-avatars.com/api/?name=Voce&background=4285F4'
              };
              return {
                  ...e,
                  replies: [...(e.replies || []), newReply],
                  time: 'Agora'
              };
          }
          return e;
      });
      
      setEmails(updatedEmails);
      setActiveEmail(updatedEmails.find(e => e.id === activeEmail.id) || null);
      showToast('Resposta enviada');
      setReplyText('');
  }

  // === CALENDAR HANDLERS (FASE 1B) ===
  const handleAddOrEditEvent = () => {
      if (!newEventTitle.trim()) {
          showToast('Título do evento é obrigatório');
          return;
      }

      if (editingEventId !== null) {
          // MODO EDIÇÃO: Atualizar evento existente
          const updatedEvents = calendarEvents.map(event => {
              if (event.id === editingEventId) {
                  return {
                      ...event,
                      title: newEventTitle,
                      start: new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate(), 
                              parseInt(newEventTime.start.split(':')[0]), parseInt(newEventTime.start.split(':')[1])),
                      end: new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate(),
                              parseInt(newEventTime.end.split(':')[0]), parseInt(newEventTime.end.split(':')[1]))
                  };
              }
              return event;
          });
          setCalendarEvents(updatedEvents);
          showToast('Evento atualizado');
      } else {
          // MODO CRIAÇÃO: Adicionar novo evento
          const newId = Math.max(...calendarEvents.map(e => e.id), 0) + 1;
          const colors = ['bg-blue-500', 'bg-red-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500'];
          
          const newEvent = {
              id: newId,
              title: newEventTitle,
              start: new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate(),
                      parseInt(newEventTime.start.split(':')[0]), parseInt(newEventTime.start.split(':')[1])),
              end: new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate(),
                      parseInt(newEventTime.end.split(':')[0]), parseInt(newEventTime.end.split(':')[1])),
              color: colors[newId % colors.length],
              location: 'Sem local'
          };
          
          setCalendarEvents([...calendarEvents, newEvent]);
          showToast('Evento criado');
      }

      // Resetar form
      setShowEventModal(false);
      setEditingEventId(null);
      setNewEventTitle('');
      setNewEventTime({ start: '09:00', end: '10:00' });
  };

  const handleOpenEventForEdit = (event: any) => {
      setEditingEventId(event.id);
      setNewEventTitle(event.title);
      const startHours = String(event.start.getHours()).padStart(2, '0');
      const startMins = String(event.start.getMinutes()).padStart(2, '0');
      const endHours = String(event.end.getHours()).padStart(2, '0');
      const endMins = String(event.end.getMinutes()).padStart(2, '0');
      setNewEventTime({
          start: `${startHours}:${startMins}`,
          end: `${endHours}:${endMins}`
      });
      setShowEventModal(true);
  };

  const handleDeleteEvent = (eventId: number) => {
      if (confirm('Tem certeza que deseja deletar este evento?')) {
          const updatedEvents = calendarEvents.filter(event => event.id !== eventId);
          setCalendarEvents(updatedEvents);
          showToast('Evento deletado');
          setShowEventModal(false);
      }
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

  const handleDropOnTab = (tab: 'agenda' | 'tasks' | 'keep') => {
      if (!draggedEmail) return;
      if (tab === 'tasks') {
          setTasks(prev => [{ id: Date.now(), title: draggedEmail.subject, completed: false }, ...prev]);
          showToast('Tarefa criada a partir do email');
      } else if (tab === 'agenda') {
          setNewEventTitle(draggedEmail.subject);
          setShowEventModal(true);
      } else if (tab === 'keep') {
          setNotes(prev => [{ id: Date.now(), title: draggedEmail.subject, content: draggedEmail.preview }, ...prev]);
          showToast('Salvo no Google Keep');
      }
      setActivePane(tab);
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

  const onFileSelected = (e: any) => {
      if (e.target.files?.[0]) {
          setComposeAttachments(prev => [...prev, { name: e.target.files[0].name, size: '2MB' }]);
      }
  };

  const showToast = (msg: string) => setToast({ message: msg });

  // --- CORE FILTERING LOGIC ---
  const displayedEmails = emails.filter(e => {
      if (mailFolder === 'starred') return e.isStarred;
      const isCorrectFolder = e.folder === mailFolder;
      if (!isCorrectFolder) return false;
      
      // Advanced search filters (FASE 1C)
      if (advancedFilters.from && !e.sender.toLowerCase().includes(advancedFilters.from.toLowerCase())) return false;
      if (advancedFilters.to && !e.sender.toLowerCase().includes(advancedFilters.to.toLowerCase())) return false;
      if (advancedFilters.subject && !e.subject.toLowerCase().includes(advancedFilters.subject.toLowerCase())) return false;
      if (advancedFilters.hasAttachment && !e.attachments) return false;
      
      // Date filtering
      if (advancedFilters.dateFrom || advancedFilters.dateTo) {
          const emailDate = new Date(e.time).getTime();
          if (advancedFilters.dateFrom && emailDate < new Date(advancedFilters.dateFrom).getTime()) return false;
          if (advancedFilters.dateTo && emailDate > new Date(advancedFilters.dateTo).getTime()) return false;
      }
      
      // Quick search
      if (searchQuery) {
          const lowerQ = searchQuery.toLowerCase();
          return (
              e.subject.toLowerCase().includes(lowerQ) || 
              e.sender.toLowerCase().includes(lowerQ) ||
              e.preview.toLowerCase().includes(lowerQ)
          );
      }
      return true;
  });

  // --- CALENDAR RENDER LOGIC ---
  
  const hours24 = Array.from({ length: 24 }, (_, i) => i);

  const renderCalendar = () => {
      // YEAR VIEW
      if (calendarViewMode === 'year') {
          const months = [
              'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
              'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
          ];
          
          return (
              <div className="flex-1 bg-[#1E1E1E] p-4 overflow-y-auto custom-scrollbar">
                  <div className="grid grid-cols-3 gap-6">
                      {months.map((month, mIdx) => {
                          const daysInMonth = new Date(viewDate.getFullYear(), mIdx + 1, 0).getDate();
                          const firstDay = new Date(viewDate.getFullYear(), mIdx, 1).getDay();
                          const days = [];
                          for (let i = 0; i < firstDay; i++) days.push(null);
                          for (let i = 1; i <= daysInMonth; i++) days.push(i);
                          
                          // Mock functionality to check if a day has events
                          const hasEvent = (d: number) => {
                              // Simplified mock check: random days or matching existing mock events month
                              const mockEventInMonth = calendarEvents.some(e => e.start.getMonth() === mIdx && e.start.getDate() === d);
                              return mockEventInMonth || (d % 10 === 0); 
                          };

                          return (
                              <div key={month} className="mb-2">
                                  <h3 className="text-white text-sm font-bold mb-2 pl-1">{month}</h3>
                                  <div className="grid grid-cols-7 gap-1 text-center">
                                      {['D','S','T','Q','Q','S','S'].map(d => <span key={d} className="text-[10px] text-white/40">{d}</span>)}
                                      {days.map((day, idx) => (
                                          <div 
                                            key={idx} 
                                            className={`h-6 w-6 flex items-center justify-center text-[10px] rounded-full cursor-pointer hover:bg-white/10 ${day === new Date().getDate() && mIdx === new Date().getMonth() ? 'bg-blue-600 text-white' : 'text-white/80'}`}
                                            onClick={() => {
                                                if (day) {
                                                    const newDate = new Date(viewDate.getFullYear(), mIdx, day);
                                                    setViewDate(newDate);
                                                    setCalendarViewMode('day');
                                                }
                                            }}
                                          >
                                              <div className="relative">
                                                  {day}
                                                  {day && hasEvent(day) && day !== new Date().getDate() && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-400 rounded-full"></div>}
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              </div>
          );
      }

      // MONTH VIEW
      if (calendarViewMode === 'month') {
          const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
          const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
          const days = [];
          for (let i = 0; i < firstDay; i++) days.push(null);
          for (let i = 1; i <= daysInMonth; i++) days.push(i);

          return (
              <div className="flex-1 bg-[#1E1E1E] p-2 overflow-y-auto custom-scrollbar">
                  <div className="grid grid-cols-7 gap-1 text-center mb-2 border-b border-white/5 pb-2">
                      {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => <div key={d} className="text-white/40 text-xs font-bold uppercase">{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1 auto-rows-[120px]">
                      {days.map((day, idx) => {
                          const dayEvents = day ? calendarEvents.filter(e => 
                              e.start.getDate() === day && 
                              e.start.getMonth() === viewDate.getMonth() && 
                              e.start.getFullYear() === viewDate.getFullYear()
                          ) : [];

                          return (
                              <div key={idx} className={`border border-white/5 rounded-xl p-1 relative hover:bg-white/5 transition-colors group flex flex-col ${day ? 'cursor-pointer' : ''}`} onClick={() => day && setCalendarViewMode('day')}>
                                  {day && (
                                      <>
                                          <div className="flex justify-center mb-1">
                                              <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${day === new Date().getDate() && viewDate.getMonth() === new Date().getMonth() ? 'bg-blue-600 text-white' : 'text-white/70'}`}>{day}</span>
                                          </div>
                                          <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                                              {dayEvents.slice(0, 3).map(ev => (
                                                  <div key={ev.id} onClick={(e) => { e.stopPropagation(); handleOpenEventForEdit(ev); }} className={`text-[9px] px-1 py-0.5 rounded truncate ${ev.color} text-white font-medium cursor-pointer hover:brightness-110 transition-all`} title={`Clique para editar: ${ev.title}`}>
                                                      {ev.title}
                                                  </div>
                                              ))}
                                              {dayEvents.length > 3 && <div className="text-[9px] text-white/40 pl-1">mais {dayEvents.length - 3}</div>}
                                          </div>
                                      </>
                                  )}
                              </div>
                          );
                      })}
                  </div>
              </div>
          );
      }

      // WEEK VIEW
      if (calendarViewMode === 'week') {
          const startOfWeek = new Date(viewDate);
          startOfWeek.setDate(viewDate.getDate() - viewDate.getDay()); 
          const weekDays = Array.from({length: 7}, (_, i) => {
              const d = new Date(startOfWeek);
              d.setDate(startOfWeek.getDate() + i);
              return d;
          });

          return (
              <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#1E1E1E]">
                  <div className="flex border-b border-white/5 bg-[#1E1E1E] shrink-0 z-20 pl-14">
                      {weekDays.map((d, i) => (
                          <div key={i} className="flex-1 py-2 text-center border-l border-white/5">
                              <div className="text-[10px] text-white/40 uppercase">{d.toLocaleDateString('pt-BR', {weekday: 'short'})}</div>
                              <div className={`text-sm font-bold ${d.getDate() === new Date().getDate() ? 'text-blue-400' : 'text-white'}`}>{d.getDate()}</div>
                          </div>
                      ))}
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar relative" ref={calendarRef}>
                      <div className="flex relative min-h-[1440px] pb-20"> 
                          <div className="w-14 shrink-0 border-r border-white/5 bg-[#1E1E1E] sticky left-0 z-10">
                              {hours24.map(h => (
                                  <div key={h} className="h-[60px] text-right pr-2 text-xs text-white/40 -mt-2 relative">
                                      {h}:00
                                  </div>
                              ))}
                          </div>
                          {weekDays.map((d, dayIdx) => (
                              <div key={dayIdx} className="flex-1 border-l border-white/5 relative">
                                  {hours24.map(h => (
                                      <div key={h} className="h-[60px] border-b border-white/[0.03]"></div>
                                  ))}
                                  {/* Render events for this day */}
                                  {calendarEvents.filter(e => e.start.getDate() === d.getDate()).map(ev => {
                                      const startH = ev.start.getHours();
                                      const startM = ev.start.getMinutes();
                                      const duration = (ev.end.getTime() - ev.start.getTime()) / (1000 * 60 * 60);
                                      const top = startH * 60 + startM;
                                      const height = duration * 60;
                                      return (
                                          <div key={ev.id} onClick={() => handleOpenEventForEdit(ev)} className={`absolute left-1 right-1 p-1 rounded ${ev.color} text-[10px] text-white truncate border-l-2 border-white/50 z-10 cursor-pointer hover:brightness-110 hover:scale-[1.01] transition-all`} style={{ top: `${top}px`, height: `${Math.max(20, height)}px` }} title={`Clique para editar: ${ev.title}`}>
                                              {ev.title}
                                          </div>
                                      )
                                  })}
                              </div>
                          ))}
                          <div className="absolute left-14 right-0 border-t border-red-500 z-30 pointer-events-none" style={{ top: '630px' }}></div>
                      </div>
                  </div>
              </div>
          );
      }

      // DAY VIEW (24H)
      return (
          <div className="flex-1 overflow-y-auto custom-scrollbar relative bg-[#1E1E1E]" ref={calendarRef}>
              <div className="relative min-h-[1440px] pb-20">
                {hours24.map(h => (
                    <div key={h} className="h-[60px] border-b border-white/5 flex relative group" 
                        onClick={() => { setNewEventTime({start: `${h}:00`, end: `${h+1}:00`}); setShowEventModal(true); }}
                        title={`Adicionar evento às ${h}:00`}>
                        <div className="w-14 text-right pr-3 text-xs text-white/40 -mt-2">{h}:00</div>
                        <div className="flex-1 hover:bg-white/5 cursor-pointer relative"><div className="absolute inset-x-0 top-1/2 border-t border-white/[0.03]"></div></div>
                    </div>
                ))}
                {calendarEvents.map((ev: any) => {
                    const startH = ev.start.getHours();
                    const startM = ev.start.getMinutes();
                    const duration = (ev.end.getTime() - ev.start.getTime()) / (1000 * 60 * 60);
                    const top = startH * 60 + startM; 
                    const height = duration * 60;
                    return (
                        <div key={ev.id} onClick={() => handleOpenEventForEdit(ev)} className={`absolute left-16 right-4 p-2 rounded-lg ${ev.color} text-xs shadow-lg border-l-4 border-black/20 cursor-pointer hover:brightness-110 z-10 transition-all hover:scale-[1.02]`} style={{ top: `${top}px`, height: `${Math.max(30, height)}px` }} title={`Clique para editar: ${ev.title}`}>
                            <div className="font-bold text-white truncate">{ev.title}</div>
                            <div className="text-white/80 truncate flex items-center gap-1"><MapPin size={10}/> {ev.location}</div>
                        </div>
                    );
                })}
                <div className="absolute left-14 right-0 border-t border-red-500 z-20 pointer-events-none" style={{ top: '630px' }}>
                    <div className="absolute -left-1.5 -top-1.5 w-3 h-3 bg-red-500 rounded-full"></div>
                </div>
              </div>
          </div>
      );
  };

  // Folders Definition
  // PRIMARY: Visible on bar
  const primaryFolders = [
      { id: 'inbox', label: 'Entrada', icon: Inbox },
      { id: 'drafts', label: 'Rascunhos', icon: FileIcon },
      { id: 'spam', label: 'Spam', icon: AlertOctagon },
      { id: 'trash', label: 'Lixeira', icon: Trash2 },
  ];

  // SECONDARY: Moved to Filter Menu
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
            
            {/* PAINEL ESQUERDO (LISTA OU CONFIGURAÇÕES) */}
            <div className="flex-1 flex flex-col bg-[#1E1E1E] rounded-[24px] border border-white/5 overflow-hidden relative">
                
                {/* TOP MENU PILLS / TOOLBAR */}
                <div className="flex flex-col border-b border-white/5 bg-[#1E1E1E] shrink-0">
                    <div className="flex items-center justify-between p-3 gap-2 px-4 h-[70px]">
                        <div className="flex items-center gap-3">
                            {/* SETTINGS TOGGLE BUTTON */}
                            <button 
                                onClick={() => setLeftPanelMode(leftPanelMode === 'settings' ? 'list' : 'settings')} 
                                className={`p-2 rounded-full mr-1 transition-colors ${leftPanelMode === 'settings' ? 'bg-blue-600 text-white' : 'hover:bg-white/10 text-white/70'}`}
                                title="Configurações"
                            >
                                <Settings size={20} />
                            </button>
                            <div className="h-5 w-[1px] bg-white/10 mr-1"></div>
                            
                            <Checkbox checked={false} onChange={() => {}} className="hover:bg-white/5" />
                            
                            {/* NEW FILTER BUTTON (Absorbs secondary folders) */}
                            <div className="relative">
                                <button 
                                    onClick={() => setShowFilterPanel(!showFilterPanel)} 
                                    className={`p-2 rounded-full transition-colors flex items-center gap-2 ${['important','starred','sent','scheduled','snoozed'].includes(mailFolder) ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-white/10 text-white/70'}`}
                                    title="Filtros e Pastas"
                                >
                                    <Filter size={20}/>
                                    {['important','starred','sent','scheduled','snoozed'].includes(mailFolder) && <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>}
                                </button>
                                <AdvancedFilterPanel 
                                    isOpen={showFilterPanel} 
                                    onClose={() => setShowFilterPanel(false)} 
                                    onApply={() => setShowFilterPanel(false)}
                                    setFolder={setMailFolder}
                                    currentFolder={mailFolder}
                                    secondaryFolders={secondaryFolders}
                                    advancedFilters={advancedFilters}
                                    setAdvancedFilters={setAdvancedFilters}
                                />
                            </div>
                        </div>

                        {/* PRIMARY FOLDERS NAVIGATION */}
                        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar px-2 mx-2 flex-1 mask-linear-fade">
                            {primaryFolders.map(folder => (
                                <button
                                    key={folder.id}
                                    onClick={() => setMailFolder(folder.id as any)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap shrink-0 ${mailFolder === folder.id ? 'bg-white/10 text-white border border-white/10' : 'text-white/60 hover:bg-white/5 hover:text-white border border-transparent'}`}
                                    title={`Ir para ${folder.label}`}
                                >
                                    <folder.icon size={14} />
                                    {folder.label}
                                </button>
                            ))}
                        </div>

                        {/* NOVO MENU DROPDOWN */}
                        <div className="relative" ref={newMenuRef}>
                            <button 
                                onClick={() => setShowNewMenu(!showNewMenu)} 
                                className="flex items-center gap-2 bg-[#C2E7FF] text-[#001D35] px-5 py-2 rounded-full font-medium shadow-md hover:shadow-xl hover:scale-105 transition-all shrink-0 ml-auto"
                                title="Criar novo e-mail ou evento"
                            >
                                <Plus size={20} strokeWidth={2.5} /> 
                                <span className="hidden md:inline">Novo</span>
                            </button>
                            
                            {/* Menu Dropdown */}
                            {showNewMenu && (
                                <div className="absolute right-0 top-full mt-2 bg-[#2d2e30] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 z-50 min-w-56">
                                    <button
                                        onClick={() => {
                                            setActivePane('compose');
                                            setShowNewMenu(false);
                                            setComposeTo('');
                                            setComposeSubject('');
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 transition-colors border-b border-white/5 last:border-b-0"
                                        title="Criar novo e-mail"
                                    >
                                        <Mail size={18} className="text-red-500" />
                                        <div className="text-left">
                                            <p className="font-medium">Novo E-mail</p>
                                            <p className="text-xs text-white/50">Escrever e enviar mensagem</p>
                                        </div>
                                    </button>
                                    
                                    <button
                                        onClick={() => {
                                            setShowEventModal(true);
                                            setShowNewMenu(false);
                                            setNewEventTitle('');
                                            setNewEventTime({ start: '09:00', end: '10:00' });
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 transition-colors border-b border-white/5 last:border-b-0"
                                        title="Criar novo evento no calendário"
                                    >
                                        <CalendarClock size={18} className="text-blue-500" />
                                        <div className="text-left">
                                            <p className="font-medium">Novo Evento</p>
                                            <p className="text-xs text-white/50">Adicionar à agenda</p>
                                        </div>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* CONTENT AREA: SWITCH BETWEEN LIST AND SETTINGS */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 overflow-x-hidden relative">
                    {leftPanelMode === 'settings' ? (
                        /* --- SETTINGS PANEL (In-Place) --- */
                        <div className="p-4 animate-in fade-in slide-in-from-left-4 duration-300">
                            <div className="flex items-center gap-2 mb-6">
                                <button onClick={() => setLeftPanelMode('list')} className="p-1 hover:bg-white/10 rounded-full text-white/60" title="Voltar para lista"><ArrowLeft size={18}/></button>
                                <h2 className="text-lg font-medium text-white">Configurações</h2>
                            </div>
                            
                            <div className="space-y-6">
                                {/* GERAL SECTION */}
                                <div className="space-y-3">
                                    <h3 className="text-blue-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2"><User size={14}/> Geral</h3>
                                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white/5 rounded-full"><Moon size={16} className="text-white/70"/></div>
                                                <div>
                                                    <p className="text-sm font-medium text-white">Tema Escuro</p>
                                                    <p className="text-[10px] text-white/40">Sempre ativo</p>
                                                </div>
                                            </div>
                                            <ToggleSwitch checked={settings.darkMode} onChange={() => setSettings({...settings, darkMode: !settings.darkMode})} />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white/5 rounded-full"><Bell size={16} className="text-white/70"/></div>
                                                <div>
                                                    <p className="text-sm font-medium text-white">Notificações</p>
                                                    <p className="text-[10px] text-white/40">Alertas na área de trabalho</p>
                                                </div>
                                            </div>
                                            <ToggleSwitch checked={settings.desktopNotif} onChange={() => setSettings({...settings, desktopNotif: !settings.desktopNotif})} />
                                        </div>
                                    </div>
                                </div>

                                {/* EMAIL SECTION */}
                                <div className="space-y-3">
                                    <h3 className="text-red-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2"><Mail size={14}/> E-mail</h3>
                                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-white flex items-center gap-2"><PenTool size={14}/> Assinatura</label>
                                            <textarea 
                                                className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-xs text-white h-20 resize-none outline-none focus:border-blue-500 placeholder:text-white/20" 
                                                value={settings.emailSignature}
                                                onChange={(e) => setSettings({...settings, emailSignature: e.target.value})}
                                                placeholder="Sua assinatura de e-mail..."
                                            />
                                        </div>
                                        <div className="h-[1px] bg-white/5 w-full"></div>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium text-white flex items-center gap-2"><MessageSquare size={14}/> Resposta Automática</p>
                                                <p className="text-[10px] text-white/40">Para quando estiver ausente</p>
                                            </div>
                                            <ToggleSwitch checked={settings.autoReply} onChange={() => setSettings({...settings, autoReply: !settings.autoReply})} />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium text-white flex items-center gap-2"><Layout size={14}/> Visualização Compacta</p>
                                            </div>
                                            <ToggleSwitch checked={settings.compactView} onChange={() => setSettings({...settings, compactView: !settings.compactView})} />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium text-white flex items-center gap-2"><Sparkles size={14}/> Recursos Inteligentes</p>
                                                <p className="text-[10px] text-white/40">Sugestões de resposta e resumo</p>
                                            </div>
                                            <ToggleSwitch checked={settings.smartFeatures} onChange={() => setSettings({...settings, smartFeatures: !settings.smartFeatures})} />
                                        </div>
                                    </div>
                                </div>

                                {/* CALENDAR SECTION */}
                                <div className="space-y-3">
                                    <h3 className="text-green-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2"><CalendarIcon size={14}/> Agenda</h3>
                                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium text-white flex items-center gap-2"><Clock size={14}/> Duração Padrão</p>
                                                <p className="text-[10px] text-white/40">Eventos novos</p>
                                            </div>
                                            <select 
                                                className="bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none"
                                                value={settings.calendarDuration}
                                                onChange={(e) => setSettings({...settings, calendarDuration: parseInt(e.target.value)})}
                                            >
                                                <option value={15}>15 min</option>
                                                <option value={30}>30 min</option>
                                                <option value={60}>60 min</option>
                                            </select>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium text-white">Mostrar Fins de Semana</p>
                                            </div>
                                            <ToggleSwitch checked={settings.calendarWeekends} onChange={() => setSettings({...settings, calendarWeekends: !settings.calendarWeekends})} />
                                        </div>
                                    </div>
                                </div>

                                <button className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-white text-sm font-medium transition-colors" onClick={() => {setLeftPanelMode('list'); showToast('Configurações salvas');}} title="Salvar alterações">
                                    Salvar e Voltar
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* --- EMAIL LIST (Default) --- */
                        <>
                            {displayedEmails.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-white/30">
                                    <Inbox size={48} className="mb-2 opacity-50"/>
                                    <p className="text-sm">Nenhum e-mail encontrado em {mailFolder}</p>
                                </div>
                            ) : (
                                displayedEmails.map((email: any) => (
                                    <div key={email.id} className="relative overflow-hidden mb-2 rounded-2xl group">
                                        {/* Swipe Background Action (Delete) */}
                                        <div 
                                            className="absolute inset-y-0 right-0 bg-red-500/20 flex items-center justify-end px-6 rounded-2xl cursor-pointer"
                                            onClick={() => handleBulkAction('lixeira')}
                                            title="Excluir conversa"
                                        >
                                            <Trash2 className="text-red-500" />
                                        </div>

                                        <div 
                                            className={`relative z-10 bg-[#1E1E1E] group-hover:bg-[#2A2A2A] transition-transform duration-200 border border-transparent hover:border-white/5 p-3 flex items-start gap-3 rounded-2xl cursor-pointer ${activeEmail?.id === email.id ? 'bg-white/10 shadow-lg' : ''}`}
                                            style={{ transform: swipedEmailId === email.id ? 'translateX(-80px)' : 'translateX(0)' }}
                                            onClick={() => handleEmailClick(email)}
                                            draggable="true"
                                            onDragStart={(e) => handleDragStart(e, email)}
                                            onDragEnd={() => setDraggedEmail(null)}
                                            onTouchStart={(e) => handleTouchStart(e, email.id)}
                                            onTouchMove={(e) => handleTouchMove(e, email.id)}
                                            onTouchEnd={handleTouchEnd}
                                            title="Clique para ler"
                                        >
                                            {/* CHECKBOX AND AVATAR ROW */}
                                            <div 
                                                className={`flex items-center justify-center pt-2 transition-all duration-300 ease-in-out overflow-hidden ${selectedEmailIds.has(email.id) ? 'w-6 opacity-100 mr-1' : 'w-0 opacity-0 group-hover:w-6 group-hover:opacity-100 group-hover:mr-1'}`}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <Checkbox checked={selectedEmailIds.has(email.id)} onChange={() => toggleEmailSelection(email.id)} />
                                            </div>

                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${email.color || 'bg-gradient-to-br from-blue-600 to-purple-600'}`}>
                                                {email.senderInit || email.sender[0]}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-0.5 relative h-5">
                                                    <span className={`text-sm ${!email.read ? 'font-bold text-white' : 'font-medium text-white/80'}`}>{email.sender}</span>
                                                    
                                                    {/* DEFAULT: TIME */}
                                                    <span className={`text-[10px] absolute right-0 top-0 transition-opacity duration-200 group-hover:opacity-0 ${!email.read ? 'text-blue-400 font-bold' : 'text-white/40'}`}>
                                                        {email.time}
                                                    </span>

                                                    {/* HOVER: QUICK ACTIONS */}
                                                    <div className="absolute right-0 top-[-2px] hidden group-hover:flex items-center gap-1 bg-[#2A2A2A] pl-2 transition-all duration-200" onClick={(e) => e.stopPropagation()}>
                                                        <button onClick={() => handleBulkAction('Arquivado')} className="p-1 hover:bg-white/10 rounded text-white/70 hover:text-white" title="Arquivar">
                                                            <Archive size={14} />
                                                        </button>
                                                        <button onClick={() => handleBulkAction('Lixeira')} className="p-1 hover:bg-white/10 rounded text-white/70 hover:text-white" title="Excluir">
                                                            <Trash2 size={14} />
                                                        </button>
                                                        <button className="p-1 hover:bg-white/10 rounded text-white/70 hover:text-white" title="Marcar como não lida">
                                                            <Mail size={14} />
                                                        </button>
                                                        <button className="p-1 hover:bg-white/10 rounded text-white/70 hover:text-white" title="Adiar">
                                                            <Clock size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <h4 className={`text-xs mb-1 truncate ${!email.read ? 'text-white font-semibold' : 'text-white/70'}`}>{email.subject}</h4>
                                                <p className="text-[11px] text-white/40 truncate">{email.preview}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* RESIZER RESTORED */}
            <div 
                className="w-1.5 h-full cursor-col-resize hover:bg-blue-500/50 transition-all rounded-full flex flex-col justify-center items-center opacity-0 hover:opacity-100 group z-50 shrink-0" 
                onMouseDown={() => setIsResizing(true)}
                title="Redimensionar painéis"
            >
                <div className="w-1 h-8 bg-white/40 rounded-full group-hover:bg-white/80"></div>
            </div>

            {/* PAINEL DIREITO */}
            <div className={`flex flex-col bg-[#1E1E1E] rounded-[24px] border border-white/5 overflow-hidden relative transition-all duration-0 ease-linear`} style={{ width: rightPanelWidth }}>
                
                {/* TABS / DROP ZONES */}
                <div className="h-14 flex items-center justify-between px-6 border-b border-white/5 shrink-0 bg-[#1E1E1E] z-20 relative">
                    <div className="flex bg-white/5 backdrop-blur-xl border border-white/10 p-1 rounded-[99px] h-[40px] items-center gap-1 w-full overflow-x-auto custom-scrollbar">
                        {['email', 'agenda', 'tasks', 'keep'].map((tab: any) => (
                            <button 
                                key={tab}
                                onClick={() => setActivePane(tab)}
                                onDragOver={(e) => { e.preventDefault(); setDragOverTab(tab); }}
                                onDragLeave={() => setDragOverTab(null)}
                                onDrop={() => handleDropOnTab(tab)}
                                className={`flex-1 min-w-[70px] h-full rounded-full text-xs font-medium transition-all flex items-center justify-center gap-2 ${activePane === tab ? 'bg-white/10 text-white shadow-sm border border-white/5' : 'text-white/50 hover:bg-white/5 hover:text-white'} ${draggedEmail && dragOverTab === tab ? 'bg-blue-500/30 text-white ring-2 ring-blue-500' : ''}`}
                                title={`Alternar para ${tab}`}
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

                {/* CONTENTS */}
                
                {/* AGENDA (Interactive Calendar) */}
                <div className={`absolute inset-0 top-14 bottom-0 w-full transition-opacity duration-300 ${activePane === 'agenda' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                    <div className="p-4 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                             <button className="p-1 hover:bg-white/10 rounded text-white/70" onClick={() => {
                                 const d = new Date(viewDate);
                                 if (calendarViewMode === 'year') d.setFullYear(d.getFullYear() - 1);
                                 else d.setDate(d.getDate() - (calendarViewMode === 'month' ? 30 : 1));
                                 setViewDate(d);
                             }} title="Anterior"><ChevronLeft size={16}/></button>
                             <h2 className="text-lg font-light text-white capitalize">{viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', day: (calendarViewMode === 'month' || calendarViewMode === 'year') ? undefined : 'numeric' })}</h2>
                             <button className="p-1 hover:bg-white/10 rounded text-white/70" onClick={() => {
                                 const d = new Date(viewDate);
                                 if (calendarViewMode === 'year') d.setFullYear(d.getFullYear() + 1);
                                 else d.setDate(d.getDate() + (calendarViewMode === 'month' ? 30 : 1));
                                 setViewDate(d);
                             }} title="Próximo"><ChevronRight size={16}/></button>
                        </div>
                        
                        {/* CALENDAR VIEW TOGGLE */}
                        <div className="relative">
                            <button 
                                onClick={() => setShowViewMenu(!showViewMenu)} 
                                className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded text-xs text-white hover:bg-white/10 border border-white/5"
                                title="Alterar visualização"
                            >
                                {calendarViewMode === 'day' ? 'Dia' : calendarViewMode === 'week' ? 'Semana' : calendarViewMode === 'month' ? 'Mês' : 'Ano'}
                                <ChevronDown size={12}/>
                            </button>
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

                {/* EMAIL READER */}
                <div className={`absolute inset-0 top-14 bottom-0 w-full transition-opacity duration-300 ${activePane === 'email' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                    {activeEmail ? (
                        <div className="flex flex-col h-full bg-[#1E1E1E]">
                            <div className="flex items-center justify-between px-6 py-2 border-b border-white/5 bg-white/[0.02]">
                                <div className="flex items-center gap-1">
                                    <button onClick={() => handleBulkAction('Arquivado')} className="p-2 hover:bg-white/10 rounded-full text-white/70" title="Arquivar"><Archive size={18}/></button>
                                    <button onClick={() => handleBulkAction('Spam')} className="p-2 hover:bg-white/10 rounded-full text-white/70" title="Reportar Spam"><AlertOctagon size={18}/></button>
                                    <button onClick={() => handleBulkAction('Lixeira')} className="p-2 hover:bg-white/10 rounded-full text-white/70" title="Excluir"><Trash2 size={18}/></button>
                                    <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
                                    <button className="p-2 hover:bg-white/10 rounded-full text-white/70" title="Marcar como não lida"><Mail size={18}/></button>
                                    <button className="p-2 hover:bg-white/10 rounded-full text-white/70" title="Mover para"><Folder size={18}/></button>
                                </div>
                                <div className="flex items-center gap-1">
                                     <button className="p-2 hover:bg-white/10 rounded-full text-white/70" title="Imprimir"><Printer size={18}/></button>
                                     <button className="p-2 hover:bg-white/10 rounded-full text-white/70" title="Mais opções"><MoreVertical size={18}/></button>
                                </div>
                            </div>

                            <div className="px-6 py-4">
                                <h2 className="text-xl font-medium text-white break-words">{activeEmail.subject}</h2>
                                <div className="flex items-center gap-2 mt-2">
                                     <div className="bg-white/10 px-2 py-0.5 rounded text-[10px] text-white/70">Caixa de Entrada</div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-6">
                                <div className="flex items-start gap-4 mb-6">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white shrink-0">{activeEmail.sender[0]}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline">
                                            <div className="font-bold text-white text-sm">{activeEmail.sender} <span className="text-white/40 font-normal text-xs">&lt;{activeEmail.sender.toLowerCase().replace(' ', '.')}@workspace.new&gt;</span></div>
                                            <div className="text-xs text-white/40">{activeEmail.time}</div>
                                        </div>
                                        <div className="text-xs text-white/40 mt-0.5">para mim <ChevronDown size={10} className="inline"/></div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button className="p-1.5 hover:bg-white/10 rounded text-white/60" title="Responder"><Reply size={16}/></button>
                                        <button className="p-1.5 hover:bg-white/10 rounded text-white/60" title="Encaminhar"><Forward size={16}/></button>
                                    </div>
                                </div>
                                
                                <div className="text-sm text-white/90 leading-7 whitespace-pre-wrap font-light border-b border-white/5 pb-8 min-h-[100px]">
                                    {activeEmail.preview}
                                    <br/><br/>
                                    <p className="text-white/60 italic">--<br/>Enviado via Hub Workspace</p>
                                </div>

                                {/* THREAD DE RESPOSTAS */}
                                {activeEmail.replies && activeEmail.replies.length > 0 && (
                                    <div className="mt-6 space-y-4 border-b border-white/5 pb-6">
                                        <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">{activeEmail.replies.length} resposta{activeEmail.replies.length !== 1 ? 's' : ''}</p>
                                        {activeEmail.replies.map((reply: any) => (
                                            <div key={reply.id} className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                                                <div className="flex items-start gap-3 mb-2">
                                                    <img src={reply.avatar} alt={reply.from} className="w-8 h-8 rounded-full" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start">
                                                            <span className="text-sm font-medium text-white">{reply.from}</span>
                                                            <span className="text-xs text-white/40">{new Date(reply.timestamp).toLocaleString('pt-BR')}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <p className="text-sm text-white/80 leading-6 pl-11">{reply.body}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="mt-6 flex gap-4">
                                    <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-sm font-bold text-white shrink-0">Eu</div>
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
                                                        <button className="p-1.5 hover:bg-white/10 rounded text-white/60" title="Inserir imagem"><ImageIcon size={16}/></button>
                                                    </div>
                                                    <button onClick={handleSendReply} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-full text-sm font-medium transition-colors" title="Enviar resposta">Enviar</button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-2 mt-2">
                                             <button onClick={() => setReplyText('Recebido, obrigado!')} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-white/70 hover:bg-white/10 hover:border-white/30 transition-colors">Recebido, obrigado!</button>
                                             <button onClick={() => setReplyText('Pode me dar mais detalhes?')} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-white/70 hover:bg-white/10 hover:border-white/30 transition-colors">Mais detalhes?</button>
                                        </div>
                                    </div>
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

                {/* TASKS */}
                <div className={`absolute inset-0 top-14 bottom-0 w-full transition-opacity duration-300 ${activePane === 'tasks' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                    <div className="p-6">
                        <h2 className="text-xl font-medium text-white mb-4">Tarefas</h2>
                        <div className="space-y-2">
                            {tasks.map((t:any) => (
                                <div key={t.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 animate-in fade-in">
                                    <Checkbox checked={t.completed} onChange={() => {}} />
                                    <span className={t.completed ? 'line-through text-white/40' : 'text-white'}>{t.title}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* COMPOSER */}
                <div className={`absolute inset-0 top-14 bottom-0 w-full bg-[#1E1E1E] transition-opacity duration-300 ${activePane === 'compose' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                     <div className={`flex flex-col h-full p-6 transition-all duration-300 ${isComposerMaximized ? 'fixed inset-4 bg-[#1E1E1E] z-50 rounded-[24px] border border-white/10 shadow-2xl' : ''}`}>
                         <div className="flex items-center justify-between mb-4">
                             <h2 className="text-lg font-medium text-white">Nova Mensagem</h2>
                             <div className="flex gap-2">
                                <button onClick={() => setIsComposerMaximized(!isComposerMaximized)} className="p-1 hover:bg-white/10 rounded text-white/60" title={isComposerMaximized ? "Restaurar tamanho" : "Maximizar"}>
                                    {isComposerMaximized ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}
                                </button>
                             </div>
                         </div>
                         <div className="space-y-1 mb-4">
                             <input type="text" placeholder="Para" className="w-full bg-white/5 border-b border-white/10 p-2 text-sm text-white outline-none focus:border-blue-500 transition-colors" value={composeTo} onChange={(e) => setComposeTo(e.target.value)} />
                             <input type="text" placeholder="Assunto" className="w-full bg-white/5 border-b border-white/10 p-2 text-sm text-white outline-none focus:border-blue-500 transition-colors" value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} />
                         </div>
                         
                         {composeAttachments.length > 0 && (
                             <div className="flex flex-wrap gap-2 mb-2">
                                 {composeAttachments.map((att, i) => (
                                     <div key={i} className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-xs text-white border border-white/10">
                                         <FileIcon size={12}/> {att.name} <X size={12} className="cursor-pointer hover:text-red-400" onClick={() => setComposeAttachments(prev => prev.filter((_, idx) => idx !== i))} title="Remover anexo" />
                                     </div>
                                 ))}
                             </div>
                         )}

                         <div ref={editorRef} contentEditable className="flex-1 bg-transparent w-full outline-none text-white/90 text-sm leading-relaxed custom-scrollbar overflow-y-auto p-2 border border-transparent focus:border-white/10 rounded-lg"></div>
                         
                         <div className="flex flex-col gap-2 mt-auto pt-2 border-t border-white/10">
                            {/* Formatting Toolbar - Toggleable */}
                            {showFormatting && (
                                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg mb-2 overflow-x-auto custom-scrollbar">
                                    <button className="p-1.5 hover:bg-white/10 rounded text-white/70" title="Desfazer"><Undo size={14}/></button>
                                    <button className="p-1.5 hover:bg-white/10 rounded text-white/70" title="Refazer"><Redo size={14}/></button>
                                    <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
                                    <button className="p-1.5 hover:bg-white/10 rounded text-white/70" title="Negrito"><Bold size={14}/></button>
                                    <button className="p-1.5 hover:bg-white/10 rounded text-white/70" title="Itálico"><Italic size={14}/></button>
                                    <button className="p-1.5 hover:bg-white/10 rounded text-white/70" title="Sublinhado"><Underline size={14}/></button>
                                    <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
                                    <button className="p-1.5 hover:bg-white/10 rounded text-white/70" title="Cor do texto"><Type size={14}/></button>
                                    <button className="p-1.5 hover:bg-white/10 rounded text-white/70" title="Alinhamento"><AlignLeft size={14}/></button>
                                    <button className="p-1.5 hover:bg-white/10 rounded text-white/70" title="Lista"><ListIcon size={14}/></button>
                                    <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
                                    <button className="p-1.5 hover:bg-white/10 rounded text-white/70" title="Citação"><Quote size={14}/></button>
                                    <button className="p-1.5 hover:bg-white/10 rounded text-white/70" title="Tachado"><Strikethrough size={14}/></button>
                                    <button className="p-1.5 hover:bg-white/10 rounded text-white/70" title="Remover formatação"><RemoveFormatting size={14}/></button>
                                </div>
                            )}

                            {/* Main Toolbar */}
                            <div className="flex justify-between items-center">
                                <div className="flex gap-2 items-center">
                                    <button className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-full transition-colors flex items-center gap-2" title="Enviar (Ctrl+Enter)">Enviar <Send size={14}/></button>
                                    
                                    <div className="flex items-center gap-1 ml-2">
                                        <button onClick={() => setShowFormatting(!showFormatting)} className={`p-2 rounded hover:bg-white/10 transition-colors ${showFormatting ? 'bg-white/10 text-white' : 'text-white/70'}`} title="Opções de formatação"><Type size={18} /></button>
                                        <div className="flex items-center gap-0.5">
                                            <input type="file" ref={fileInputRef} className="hidden" onChange={onFileSelected} />
                                            <button onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-white/10 rounded transition-colors text-white/70 hover:text-white" title="Anexar arquivos"><PaperclipIcon size={18} /></button>
                                            <button className="p-2 hover:bg-white/10 rounded transition-colors text-white/70 hover:text-white" title="Inserir link"><LinkIcon size={18} /></button>
                                            <button className="p-2 hover:bg-white/10 rounded transition-colors text-white/70 hover:text-white" title="Inserir emoji"><Smile size={18} /></button>
                                            <button className="p-2 hover:bg-white/10 rounded transition-colors text-white/70 hover:text-white" title="Inserir arquivos com o Drive"><GoogleIcons.Drive className="w-[18px] h-[18px]" /></button>
                                            <button className="p-2 hover:bg-white/10 rounded transition-colors text-white/70 hover:text-white" title="Inserir foto"><ImageIcon size={18} /></button>
                                            <button className="p-2 hover:bg-white/10 rounded transition-colors text-white/70 hover:text-white" title="Ativar/desativar modo confidencial"><Lock size={18} /></button>
                                            <button className="p-2 hover:bg-white/10 rounded transition-colors text-white/70 hover:text-white" title="Inserir assinatura"><PenTool size={18} /></button>
                                            <button className="p-2 hover:bg-white/10 rounded transition-colors text-white/70 hover:text-white" title="Mais opções"><MoreVertical size={18} /></button>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => { setComposeTo(''); setComposeSubject(''); setComposeAttachments([]); if(editorRef.current) editorRef.current.innerHTML = ''; }} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-red-400" title="Descartar rascunho"><Trash2 size={18} /></button>
                            </div>
                         </div>
                     </div>
                </div>

                {/* KEEP */}
                <div className={`absolute inset-0 top-14 bottom-0 w-full transition-opacity duration-300 ${activePane === 'keep' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                    <div className="flex flex-col h-full p-6">
                        <h2 className="text-xl font-medium text-white mb-4">Keep Notes</h2>
                        <div className="grid grid-cols-1 gap-4">
                            {notes.map((n:any) => (
                                <div key={n.id} className="bg-white/5 p-4 rounded-xl border border-white/5 animate-in fade-in">
                                    <h3 className="font-bold text-sm text-white mb-1">{n.title}</h3>
                                    <p className="text-xs text-white/70">{n.content}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>
        </div>

        {/* MODAL NOVO EVENTO */}
        {showEventModal && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => { setShowEventModal(false); setEditingEventId(null); }}>
                <div className="w-[400px] bg-[#1E1E1E] border border-white/10 rounded-2xl shadow-2xl p-6 animate-in zoom-in" onClick={e => e.stopPropagation()}>
                    <h3 className="text-lg font-medium text-white mb-4">{editingEventId !== null ? 'Editar Evento' : 'Novo Evento'}</h3>
                    <input type="text" placeholder="Adicionar título" className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white outline-none mb-4 focus:border-blue-500" autoFocus value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} />
                    
                    <div className="flex gap-2 mb-6">
                        <div className="flex-1">
                            <label className="text-xs text-white/50 mb-2 block">Início</label>
                            <input type="time" className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white outline-none focus:border-blue-500" value={newEventTime.start} onChange={e => setNewEventTime({...newEventTime, start: e.target.value})} />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs text-white/50 mb-2 block">Fim</label>
                            <input type="time" className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white outline-none focus:border-blue-500" value={newEventTime.end} onChange={e => setNewEventTime({...newEventTime, end: e.target.value})} />
                        </div>
                    </div>

                    <div className="flex justify-between gap-2">
                        <div className="flex gap-2">
                            <button className="px-4 py-2 rounded text-sm text-white/70 hover:bg-white/10" onClick={() => { setShowEventModal(false); setEditingEventId(null); }} title="Cancelar">Cancelar</button>
                        </div>
                        <div className="flex gap-2">
                            {editingEventId !== null && (
                                <button className="px-4 py-2 rounded bg-red-600/30 border border-red-500/30 text-sm font-medium text-red-400 hover:bg-red-600/50" onClick={() => handleDeleteEvent(editingEventId)} title="Deletar evento">
                                    <Trash2 size={16} className="inline mr-2" />
                                    Deletar
                                </button>
                            )}
                            <button className="px-6 py-2 rounded bg-blue-600 text-sm font-medium text-white hover:bg-blue-500" onClick={handleAddOrEditEvent} title={editingEventId !== null ? 'Atualizar evento' : 'Salvar evento'}>
                                {editingEventId !== null ? 'Atualizar' : 'Salvar'}
                            </button>
                        </div>
                    </div>
                </div>
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
