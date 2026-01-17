
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
const AdvancedFilterPanel = ({ isOpen, onClose, onApply, setFolder, currentFolder, secondaryFolders, customLabels, onCreateLabel }: any) => {
    const [newLabelName, setNewLabelName] = useState('');

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

            {/* Marcadores Section */}
            <div className="mb-4 pb-4 border-b border-white/10">
                <p className="text-[10px] text-white/40 uppercase font-bold mb-2 px-1">Marcadores</p>
                <div className="flex flex-wrap gap-2 mb-3">
                    {customLabels.map((label: any) => (
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
                <div className="flex items-center gap-2 bg-black/20 p-1 rounded-lg border border-white/10">
                    <input 
                        type="text" 
                        placeholder="Novo marcador..." 
                        className="flex-1 bg-transparent border-none outline-none text-xs text-white px-2 h-7"
                        value={newLabelName}
                        onChange={(e) => setNewLabelName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && newLabelName.trim()) {
                                onCreateLabel(newLabelName);
                                setNewLabelName('');
                            }
                        }}
                    />
                    <button 
                        onClick={() => {
                            if (newLabelName.trim()) {
                                onCreateLabel(newLabelName);
                                setNewLabelName('');
                            }
                        }}
                        className="p-1.5 bg-white/10 hover:bg-white/20 rounded text-white transition-colors"
                        disabled={!newLabelName.trim()}
                    >
                        <Plus size={14} />
                    </button>
                </div>
            </div>

            {/* Search Fields */}
            <div className="space-y-3 mb-4">
                <p className="text-[10px] text-white/40 uppercase font-bold px-1">Busca Avançada</p>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] text-white/50 block mb-1">De</label>
                        <input type="text" className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none" />
                    </div>
                    <div>
                        <label className="text-[10px] text-white/50 block mb-1">Para</label>
                        <input type="text" className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none" />
                    </div>
                </div>
                <div>
                    <label className="text-[10px] text-white/50 block mb-1">Assunto</label>
                    <input type="text" className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none" />
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
  const [mailFolder, setMailFolder] = useState<string>('inbox');
  const [customLabels, setCustomLabels] = useState<any[]>([
      { id: 'label_finance', name: 'Financeiro', colorClass: 'text-green-400' },
      { id: 'label_project', name: 'Projetos', colorClass: 'text-blue-400' },
      { id: 'label_personal', name: 'Pessoal', colorClass: 'text-yellow-400' }
  ]);
  
  // DIVISÃO DE TELA: Inicializa com 50% da largura da janela
  const [rightPanelWidth, setRightPanelWidth] = useState(typeof window !== 'undefined' ? window.innerWidth / 2 : 600);
  
  const [isResizing, setIsResizing] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false); // Menu "Novo" Dropdown
  
  // Calendar States
  const [calendarViewMode, setCalendarViewMode] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [viewDate, setViewDate] = useState(new Date());
  const [showEventModal, setShowEventModal] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventTime, setNewEventTime] = useState({ start: '09:00', end: '10:00' });
  const [showViewMenu, setShowViewMenu] = useState(false);

  // Settings States
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

  // Seleção e Interação
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<number>>(new Set());
  const [activeEmail, setActiveEmail] = useState<any>(null);
  
  // Composer & Reply
  const [composeAttachments, setComposeAttachments] = useState<any[]>([]);
  const [composeTo, setComposeTo] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeBcc, setComposeBcc] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [isComposerMaximized, setIsComposerMaximized] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showFormatting, setShowFormatting] = useState(true); // Gmail formatting toolbar toggle
  
  // Drag and Drop (Desktop) & Swipe (Mobile)
  const [draggedEmail, setDraggedEmail] = useState<any>(null);
  const [dragOverTab, setDragOverTab] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [swipedEmailId, setSwipedEmailId] = useState<number | null>(null);
  
  // UI Auxiliar
  const [toast, setToast] = useState<{message: string, action?: () => void} | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
                 labels: index === 0 ? ['label_project'] : []
             }));
             
             enhanced.push(
                 { id: 101, sender: 'Julia Silva', subject: 'Reunião de Design', preview: 'Vamos agendar o review do Design System.', time: '09:00', read: true, folder: 'important', senderInit: 'J', color: 'bg-purple-500', labels: ['label_project'] },
                 { id: 102, sender: 'AWS Billing', subject: 'Fatura Disponível', preview: 'Sua fatura de Julho está pronta.', time: 'Ontem', read: false, folder: 'inbox', isStarred: true, senderInit: 'A', color: 'bg-orange-500', labels: ['label_finance'] },
                 { id: 103, sender: 'Equipe Asana', subject: 'Resumo Semanal', preview: 'Você completou 5 tarefas esta semana.', time: 'Seg', read: true, folder: 'trash', senderInit: 'E', color: 'bg-red-500', labels: [] },
                 { id: 104, sender: 'Newsletter Tech', subject: 'Novidades AI 2024', preview: 'Tudo sobre os novos modelos.', time: '10:00', read: false, folder: 'spam', senderInit: 'N', color: 'bg-green-500', labels: [] },
                 { id: 105, sender: 'Eu', subject: 'Rascunho de Proposta', preview: 'Olá cliente, segue a proposta...', time: '11:30', read: true, folder: 'drafts', senderInit: 'E', color: 'bg-gray-500', labels: ['label_project'] },
                 { id: 106, sender: 'Eu', subject: 'Relatório Enviado', preview: 'Segue anexo o relatório mensal.', time: 'Ontem', read: true, folder: 'sent', senderInit: 'E', color: 'bg-blue-500', labels: ['label_finance'] },
                 { id: 107, sender: 'Chefe', subject: 'Adiado: Reunião', preview: 'Vamos mover para semana que vem.', time: '08:00', read: false, folder: 'snoozed', senderInit: 'C', color: 'bg-yellow-500', labels: [] },
                 { id: 108, sender: 'Eu', subject: 'Agendado: Feliz Aniversário', preview: 'Parabéns!', time: 'Amanhã', read: true, folder: 'scheduled', senderInit: 'E', color: 'bg-pink-500', labels: ['label_personal'] },
                 { id: 109, sender: 'Promoção', subject: 'Oferta Relâmpago', preview: '50% de desconto hoje.', time: 'Ontem', read: false, folder: 'spam', senderInit: 'P', color: 'bg-yellow-600', labels: [] },
                 { id: 110, sender: 'Lixeira', subject: 'Arquivo Antigo', preview: 'Este item será excluído em 30 dias.', time: 'Há 5 dias', read: true, folder: 'trash', senderInit: 'L', color: 'bg-gray-600', labels: [] }
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
      // Auto-insert signature when composer opens and is empty
      if (activePane === 'compose' && editorRef.current && !editorRef.current.innerHTML.trim()) {
          const sig = settings.emailSignature.replace(/\n/g, '<br>');
          editorRef.current.innerHTML = `<div class="editor-content"><br><br><br><div class="signature" style="color: rgba(255,255,255,0.5); font-size: 12px; margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">--<br>${sig}</div></div>`;
      }
  }, [activePane, settings.emailSignature]);

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

  // --- LÓGICA ---

  const handleFormat = (command: string, value?: string) => {
      document.execCommand(command, false, value);
      if (editorRef.current) editorRef.current.focus();
  };

  const handleLink = () => {
      const url = prompt("Inserir Link:", "https://");
      if(url) {
          handleFormat('createLink', url);
      }
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
                  if (ev.target?.result) {
                      handleFormat('insertImage', ev.target.result as string);
                  }
              };
              reader.readAsDataURL(file);
          }
      };
      input.click();
  };

  const handleInsertEmoji = () => {
      handleFormat('insertText', '😊');
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

  const handleCreateLabel = (name: string) => {
      const colors = ['text-red-400', 'text-blue-400', 'text-green-400', 'text-yellow-400', 'text-purple-400', 'text-pink-400'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      const newLabel = {
          id: `label_${Date.now()}`,
          name: name,
          colorClass: randomColor
      };
      setCustomLabels([...customLabels, newLabel]);
      showToast(`Marcador "${name}" criado`);
  };

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
      if(!replyText.trim()) return;
      showToast('Resposta enviada');
      setReplyText('');
  }

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
      if (searchQuery) {
          const lowerQ = searchQuery.toLowerCase();
          return (
              e.subject.toLowerCase().includes(lowerQ) || 
              e.sender.toLowerCase().includes(lowerQ) ||
              e.preview.toLowerCase().includes(lowerQ)
          );
      }

      if (mailFolder.startsWith('label_')) {
          return e.labels && e.labels.includes(mailFolder);
      }

      if (mailFolder === 'starred') return e.isStarred;
      const isCorrectFolder = e.folder === mailFolder;
      if (!isCorrectFolder) return false;
      
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
                                                  <div key={ev.id} className={`text-[9px] px-1 py-0.5 rounded truncate ${ev.color} text-white font-medium`}>
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
                                          <div key={ev.id} className={`absolute left-1 right-1 p-1 rounded ${ev.color} text-[10px] text-white truncate border-l-2 border-white/50 z-10`} style={{ top: `${top}px`, height: `${Math.max(20, height)}px` }}>
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
                        <div key={ev.id} className={`absolute left-16 right-4 p-2 rounded-lg ${ev.color} text-xs shadow-lg border-l-4 border-black/20 cursor-pointer hover:brightness-110 z-10 transition-all hover:scale-[1.02]`} style={{ top: `${top}px`, height: `${Math.max(30, height)}px` }} title={ev.title}>
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
                                    className={`p-2 rounded-full transition-colors flex items-center gap-2 ${['important','starred','sent','scheduled','snoozed'].includes(mailFolder) || mailFolder.startsWith('label_') ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-white/10 text-white/70'}`}
                                    title="Filtros e Pastas"
                                >
                                    <Filter size={20}/>
                                    {(['important','starred','sent','scheduled','snoozed'].includes(mailFolder) || mailFolder.startsWith('label_')) && <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>}
                                </button>
                                <AdvancedFilterPanel 
                                    isOpen={showFilterPanel} 
                                    onClose={() => setShowFilterPanel(false)} 
                                    onApply={() => setShowFilterPanel(false)}
                                    setFolder={setMailFolder}
                                    currentFolder={mailFolder}
                                    secondaryFolders={secondaryFolders}
                                    customLabels={customLabels}
                                    onCreateLabel={handleCreateLabel}
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
                        <div className="relative ml-auto">
                            <button onClick={() => setShowNewMenu(!showNewMenu)} className="flex items-center gap-2 bg-[#C2E7FF] text-[#001D35] px-5 py-2 rounded-full font-medium shadow-md hover:shadow-xl hover:scale-105 transition-all shrink-0" title="Criar novo">
                                <Plus size={20} strokeWidth={2.5} /> <span className="hidden md:inline">Novo</span>
                            </button>
                            
                            {/* DROPDOWN CONTENT */}
                            {showNewMenu && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowNewMenu(false)}></div>
                                    <div className="absolute top-full right-0 mt-2 w-48 bg-[#2d2e30] border border-white/10 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in zoom-in duration-200 backdrop-blur-xl overflow-hidden">
                                        <button 
                                            onClick={() => { setActivePane('compose'); setShowNewMenu(false); }} 
                                            className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors group"
                                        >
                                            <Mail size={16} className="text-red-400 group-hover:scale-110 transition-transform" />
                                            <span className="text-sm font-medium text-white/90">Novo E-mail</span>
                                        </button>
                                        <div className="h-[1px] bg-white/5 w-full"></div>
                                        <button 
                                            onClick={() => { 
                                                setNewEventTime({start: '09:00', end: '10:00'}); 
                                                setShowEventModal(true); 
                                                setShowNewMenu(false); 
                                            }} 
                                            className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors group"
                                        >
                                            <CalendarIcon size={16} className="text-green-400 group-hover:scale-110 transition-transform" />
                                            <span className="text-sm font-medium text-white/90">Novo Evento</span>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* CONTENT AREA: SWITCH BETWEEN LIST AND SETTINGS */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-0 overflow-x-hidden relative bg-[#191919]">
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
                        <div className="flex flex-col">
                            {displayedEmails.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-white/30 pt-20">
                                    <Inbox size={48} className="mb-2 opacity-50"/>
                                    <p className="text-sm">Nenhum e-mail encontrado em {mailFolder}</p>
                                </div>
                            ) : (
                                displayedEmails.map((email: any) => {
                                    // Visual separation logic for Read vs Unread
                                    const isUnread = !email.read;
                                    const rowBg = isUnread ? 'bg-white/5' : 'bg-[#1E1E1E]';
                                    const textClass = isUnread ? 'text-white font-bold' : 'text-white/70 font-medium';
                                    // Remove border logic here, replaced by indicator pill

                                    return (
                                        <div key={email.id} className="relative group border-b border-white/10 last:border-0">
                                            <div 
                                                className={`relative z-10 ${rowBg} hover:bg-[#2A2A2A] rounded-2xl transition-all duration-200 p-3 pl-6 flex items-start gap-3 cursor-pointer ${activeEmail?.id === email.id ? 'bg-white/10' : ''}`}
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
                                                {/* UNREAD INDICATOR PILL */}
                                                {isUnread && (
                                                    <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.6)]"></div>
                                                )}

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
                                                        <span className={`text-sm ${textClass}`}>{email.sender}</span>
                                                        
                                                        {/* TIME */}
                                                        <span className={`text-[10px] absolute right-0 top-0 transition-opacity duration-200 group-hover:opacity-0 ${isUnread ? 'text-blue-400 font-bold' : 'text-white/40'}`}>
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
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h4 className={`text-xs truncate flex-1 ${textClass}`}>{email.subject}</h4>
                                                        {email.labels && email.labels.map((lblId: string) => {
                                                            const label = customLabels.find(l => l.id === lblId);
                                                            if (!label) return null;
                                                            return (
                                                                <span key={lblId} className={`text-[8px] px-1.5 py-0.5 rounded bg-white/10 border border-white/5 ${label.colorClass}`}>
                                                                    {label.name}
                                                                </span>
                                                            )
                                                        })}
                                                    </div>
                                                    <p className={`text-[11px] truncate ${isUnread ? 'text-white/60' : 'text-white/40'}`}>{email.preview}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
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
                                     {activeEmail.labels && activeEmail.labels.map((lblId: string) => {
                                         const label = customLabels.find(l => l.id === lblId);
                                         if (!label) return null;
                                         return (
                                             <div key={lblId} className={`bg-white/10 border border-white/5 px-2 py-0.5 rounded text-[10px] ${label.colorClass}`}>{label.name}</div>
                                         )
                                     })}
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
                         
                         {/* HEADER FIELDS: ROUNDED & COMPLETE */}
                         <div className="space-y-3 mb-4">
                             {/* FROM FIELD */}
                             <div className="flex items-center gap-3 bg-white/5 border border-white/5 rounded-full px-4 py-2">
                                <span className="text-white/50 text-xs w-8">De</span>
                                <div className="flex-1 text-sm text-white font-medium flex items-center gap-2">
                                    {data?.user?.email || 'usuario@workspace.new'} 
                                    <ChevronDown size={12} className="opacity-50"/>
                                </div>
                             </div>

                             {/* TO FIELD + TOGGLE CC/BCC */}
                             <div className="flex items-center gap-3 bg-white/5 border border-white/5 rounded-full px-4 py-2 relative focus-within:bg-black/30 focus-within:border-blue-500/50 transition-colors">
                                <span className="text-white/50 text-xs w-8">Para</span>
                                <input type="text" className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/20" value={composeTo} onChange={(e) => setComposeTo(e.target.value)} />
                                <button onClick={() => setShowCcBcc(!showCcBcc)} className="text-[10px] text-white/50 hover:text-white hover:bg-white/10 px-2 py-1 rounded-full transition-colors">Cc/Cco</button>
                             </div>

                             {/* CC / BCC FIELDS (CONDITIONAL) */}
                             {showCcBcc && (
                                <div className="flex gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="flex-1 flex items-center gap-3 bg-white/5 border border-white/5 rounded-full px-4 py-2 focus-within:bg-black/30 focus-within:border-blue-500/50 transition-colors">
                                        <span className="text-white/50 text-xs w-8">Cc</span>
                                        <input type="text" className="flex-1 bg-transparent text-sm text-white outline-none" value={composeCc} onChange={(e) => setComposeCc(e.target.value)} />
                                    </div>
                                    <div className="flex-1 flex items-center gap-3 bg-white/5 border border-white/5 rounded-full px-4 py-2 focus-within:bg-black/30 focus-within:border-blue-500/50 transition-colors">
                                        <span className="text-white/50 text-xs w-8">Cco</span>
                                        <input type="text" className="flex-1 bg-transparent text-sm text-white outline-none" value={composeBcc} onChange={(e) => setComposeBcc(e.target.value)} />
                                    </div>
                                </div>
                             )}

                             {/* SUBJECT FIELD */}
                             <div className="flex items-center gap-3 bg-white/5 border border-white/5 rounded-full px-4 py-2 focus-within:bg-black/30 focus-within:border-blue-500/50 transition-colors">
                                <span className="text-white/50 text-xs w-8">Assunto</span>
                                <input type="text" className="flex-1 bg-transparent text-sm text-white outline-none" value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} />
                             </div>
                         </div>
                         
                         {composeAttachments.length > 0 && (
                             <div className="flex flex-wrap gap-2 mb-4 px-1">
                                 {composeAttachments.map((att, i) => (
                                     <div key={i} className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-xs text-white border border-white/10">
                                         <FileIcon size={12}/> {att.name} <X size={12} className="cursor-pointer hover:text-red-400" onClick={() => setComposeAttachments(prev => prev.filter((_, idx) => idx !== i))} title="Remover anexo" />
                                     </div>
                                 ))}
                             </div>
                         )}

                         {/* EDITOR BODY - INTUITIVE VISUAL */}
                         <div className="flex-1 relative rounded-2xl overflow-hidden border border-white/10 bg-white/5 shadow-inner flex flex-col">
                             <div 
                                ref={editorRef} 
                                contentEditable 
                                className="flex-1 w-full outline-none text-white/90 text-sm leading-relaxed custom-scrollbar overflow-y-auto p-4"
                                style={{ minHeight: '200px' }}
                                onInput={(e) => {
                                    if(e.currentTarget.innerHTML === '<br>') e.currentTarget.innerHTML = '';
                                }}
                             >
                             </div>
                             {/* Placeholder logic simulated via empty CSS or JS check could be added here, currently relying on visual cue of the box */}
                             {!editorRef.current?.innerHTML && <div className="absolute top-4 left-4 text-white/30 text-sm pointer-events-none">Escreva sua mensagem aqui...</div>}
                         </div>
                         
                         <div className="flex flex-col gap-2 mt-4 pt-2 border-t border-white/10">
                            {/* Formatting Toolbar - Toggleable */}
                            {showFormatting && (
                                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl mb-2 overflow-x-auto custom-scrollbar border border-white/5">
                                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('undo')} className="p-2 hover:bg-white/10 rounded-lg text-white/70 transition-colors" title="Desfazer"><Undo size={14}/></button>
                                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('redo')} className="p-2 hover:bg-white/10 rounded-lg text-white/70 transition-colors" title="Refazer"><Redo size={14}/></button>
                                    <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
                                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('bold')} className="p-2 hover:bg-white/10 rounded-lg text-white/70 transition-colors" title="Negrito"><Bold size={14}/></button>
                                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('italic')} className="p-2 hover:bg-white/10 rounded-lg text-white/70 transition-colors" title="Itálico"><Italic size={14}/></button>
                                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('underline')} className="p-2 hover:bg-white/10 rounded-lg text-white/70 transition-colors" title="Sublinhado"><Underline size={14}/></button>
                                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('strikethrough')} className="p-2 hover:bg-white/10 rounded-lg text-white/70 transition-colors" title="Tachado"><Strikethrough size={14}/></button>
                                    <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
                                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('insertUnorderedList')} className="p-2 hover:bg-white/10 rounded-lg text-white/70 transition-colors" title="Lista com marcadores"><ListIcon size={14}/></button>
                                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('insertOrderedList')} className="p-2 hover:bg-white/10 rounded-lg text-white/70 transition-colors" title="Lista numerada"><ListOrdered size={14}/></button>
                                    <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
                                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('justifyLeft')} className="p-2 hover:bg-white/10 rounded-lg text-white/70 transition-colors" title="Alinhar à esquerda"><AlignLeft size={14}/></button>
                                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('justifyCenter')} className="p-2 hover:bg-white/10 rounded-lg text-white/70 transition-colors" title="Centralizar"><AlignCenter size={14}/></button>
                                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('justifyRight')} className="p-2 hover:bg-white/10 rounded-lg text-white/70 transition-colors" title="Alinhar à direita"><AlignRight size={14}/></button>
                                    <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
                                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('formatBlock', 'blockquote')} className="p-2 hover:bg-white/10 rounded-lg text-white/70 transition-colors" title="Citação"><Quote size={14}/></button>
                                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('removeFormat')} className="p-2 hover:bg-white/10 rounded-lg text-white/70 transition-colors" title="Remover formatação"><RemoveFormatting size={14}/></button>
                                </div>
                            )}

                            {/* Main Toolbar */}
                            <div className="flex justify-between items-center">
                                <div className="flex gap-2 items-center">
                                    <button className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-full transition-colors flex items-center gap-2 shadow-lg shadow-blue-900/20" title="Enviar (Ctrl+Enter)">Enviar <Send size={14}/></button>
                                    
                                    <div className="flex items-center gap-1 ml-2">
                                        <button onClick={() => setShowFormatting(!showFormatting)} className={`p-2 rounded-full hover:bg-white/10 transition-colors ${showFormatting ? 'bg-white/10 text-white' : 'text-white/70'}`} title="Opções de formatação"><Type size={18} /></button>
                                        <div className="flex items-center gap-0.5">
                                            <input type="file" ref={fileInputRef} className="hidden" onChange={onFileSelected} />
                                            <button onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white" title="Anexar arquivos"><PaperclipIcon size={18} /></button>
                                            
                                            {/* Functional Insert Buttons */}
                                            <button onClick={handleLink} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white" title="Inserir link"><LinkIcon size={18} /></button>
                                            <button onClick={handleInsertEmoji} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white" title="Inserir emoji"><Smile size={18} /></button>
                                            <button onClick={() => showToast('Integração com Google Drive simulada')} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white" title="Inserir arquivos com o Drive"><GoogleIcons.Drive className="w-[18px] h-[18px]" /></button>
                                            <button onClick={handleImageUpload} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white" title="Inserir foto"><ImageIcon size={18} /></button>
                                            <button onClick={handleConfidential} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white" title="Ativar/desativar modo confidencial"><Lock size={18} /></button>
                                            <button onClick={handleInsertSignature} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white" title="Inserir assinatura"><PenTool size={18} /></button>
                                            <button className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white" title="Mais opções"><MoreVertical size={18} /></button>
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
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setShowEventModal(false)}>
                <div className="w-[400px] bg-[#1E1E1E] border border-white/10 rounded-2xl shadow-2xl p-6 animate-in zoom-in" onClick={e => e.stopPropagation()}>
                    <h3 className="text-lg font-medium text-white mb-4">Novo Evento</h3>
                    <input type="text" placeholder="Adicionar título" className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white outline-none mb-4 focus:border-blue-500" autoFocus value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} />
                    <div className="flex gap-4 mb-6 text-white/70 text-sm bg-white/5 p-3 rounded-lg"><div className="flex items-center gap-2"><Clock size={16} className="text-blue-400"/> {newEventTime.start} - {newEventTime.end}</div></div>
                    <div className="flex justify-end gap-2">
                        <button className="px-4 py-2 rounded text-sm text-white/70 hover:bg-white/10" onClick={() => setShowEventModal(false)} title="Cancelar criação">Cancelar</button>
                        <button className="px-6 py-2 rounded bg-blue-600 text-sm font-medium text-white hover:bg-blue-500" onClick={() => { 
                            setCalendarEvents(prev => [...prev, { id: Date.now(), title: newEventTitle || 'Novo Evento', start: new Date(), end: new Date(), color: 'bg-blue-500', location: 'Manual' }]);
                            setShowEventModal(false);
                            showToast('Evento criado');
                        }} title="Salvar evento">Salvar</button>
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
