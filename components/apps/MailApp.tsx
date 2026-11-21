import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, SlidersHorizontal, Settings, X, Plus,
  Clock, Star, AlertOctagon, Trash2, ChevronLeft, ChevronRight,
  Inbox, Tag, Send, FileText, CalendarClock,
  CheckSquare, Mail, ListOrdered, Calendar as CalendarIcon,
  Paperclip as PaperclipIcon,
  Bold, Italic, Underline, List as ListIcon,
  ChevronDown, ChevronUp, Check, Copy,
  Download, Sparkles, Archive, Reply, Forward,
  LayoutTemplate, Video,
  Bookmark, RotateCcw,
  Minimize2, Maximize2, Printer,
  Smile, RemoveFormatting, RefreshCw,
  Loader2, MailOpen, Wand2, Globe, Lock, ShieldAlert, ReplyAll,
  Pin, VolumeX, Keyboard, Link as LinkIcon
} from 'lucide-react';
import { GoogleIcons } from '../GoogleIcons';
import {
  bridge,
  CalendarEvent,
  ContactItem,
  DashboardData,
  EmailAttachment,
  NoteItem,
  TaskItem,
} from '../../utils/GASBridge';
import { askGemini } from '../../utils/gemini';
import { sanitizeHtml, escapeHtml } from '../../utils/sanitize';
import {
  EmailItem,
  EmailThreadMessage,
  InboxCategory,
  MailFilterCriteria,
  MailFolderId,
  MailLabel,
  MailAutoFilterRule,
  filterEmails,
  applyBatchEmailAction,
  applyAutoFilterRules,
  getSmartRepliesForEmail,
  BatchEmailAction,
} from '../../utils/mailLogic';
const TasksApp = lazy(() => import('./TasksApp'));
const KeepApp = lazy(() => import('./KeepApp'));

interface MailAppProps {
  onClose: () => void;
  data: DashboardData;
  searchQuery?: string;
  onUpdateEmails?: (emails: EmailItem[]) => void;
  onUpdateTasks?: (tasks: TaskItem[]) => void;
  onUpdateNotes?: (notes: NoteItem[]) => void;
  showToast?: (msg: string) => void;
  isDarkMode?: boolean;
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });
};

const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (val: boolean) => void; label?: string }) => (
  <button
    type="button"
    aria-label={label || 'Alternar opção'}
    onClick={() => onChange(!checked)}
    className={`w-10 h-5 rounded-full relative transition-colors duration-200 shrink-0 ${
      checked ? 'bg-blue-600' : 'bg-gray-400/40'
    }`}
  >
    <div
      className={`absolute top-1 bottom-1 w-3 h-3 rounded-full bg-white transition-all duration-200 ${
        checked ? 'left-6' : 'left-1'
      }`}
    />
  </button>
);

const ContactInput = ({
  placeholder,
  value,
  onChange,
  onSelect,
  isDarkMode = false,
}: {
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  onSelect?: (email: string) => void;
  isDarkMode?: boolean;
}) => {
  const [suggestions, setSuggestions] = useState<ContactItem[]>([]);
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
    const fetchContacts = async () => {
      if (value.trim().length >= 1) {
        const res = await bridge.searchContacts(value.trim());
        setSuggestions(res);
        setShowSuggestions(res.length > 0);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    };
    const timeout = setTimeout(fetchContacts, 180);
    return () => clearTimeout(timeout);
  }, [value]);

  return (
    <div className="relative flex-1" ref={wrapperRef}>
      <input
        type="text"
        placeholder={placeholder}
        className={`w-full bg-transparent p-2 text-sm outline-none ${
          isDarkMode ? 'text-white placeholder:text-white/40' : 'text-gray-800 placeholder:text-gray-400'
        }`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={async () => {
          const res = await bridge.searchContacts(value.trim());
          setSuggestions(res);
          setShowSuggestions(res.length > 0);
        }}
      />
      {showSuggestions && (
        <div
          className={`absolute top-full left-0 w-full border rounded-xl shadow-xl z-50 overflow-hidden mt-1 max-h-48 overflow-y-auto custom-scrollbar ${
            isDarkMode ? 'bg-[#2d2e30] border-white/10' : 'bg-white border-gray-200'
          }`}
        >
          {suggestions.map((s, i) => (
            <button
              type="button"
              key={i}
              onClick={() => {
                onChange(s.email);
                setShowSuggestions(false);
                if (onSelect) onSelect(s.email);
              }}
              className={`w-full text-left flex items-center gap-3 p-2.5 cursor-pointer transition-colors ${
                isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {s.avatar || s.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold truncate ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                  {s.name} {s.role ? <span className="opacity-60 font-normal">· {s.role}</span> : null}
                </p>
                <p className={`text-[11px] truncate ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>{s.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const EMAIL_TEMPLATES = [
  {
    id: 'tpl_approval',
    title: 'Aprovação Executiva ✓',
    subject: 'Aprovação Executiva — Próximos Passos',
    body: '<p>Olá,</p><p>Revisei o material enviado e está <strong>100% aprovado</strong> da minha parte. Podemos prosseguir com o cronograma planejado.</p><p>Obrigado pelo excelente trabalho!</p>',
  },
  {
    id: 'tpl_followup',
    title: 'Follow-up de Reunião',
    subject: 'Resumo & Action Items da Reunião',
    body: '<p>Olá equipe,</p><p>Obrigado pela reunião de hoje! Seguem os principais pontos definidos:</p><ul><li>Validação dos KPIs prioritários da Sprint</li><li>Alinhamento de entregas até sexta-feira</li></ul>',
  },
  {
    id: 'tpl_status',
    title: 'Status Report Semanal',
    subject: 'Status Report Semanal — Engenharia & Produto',
    body: '<p>Prezados,</p><p>Compartilho o status atualizado da semana:</p><ul><li><strong>Concluído:</strong> Integração completa e testes automatizados</li><li><strong>Em andamento:</strong> Homologação final com stakeholders</li></ul>',
  },
];

export default function MailApp({
  onClose,
  data,
  searchQuery = '',
  onUpdateEmails,
  onUpdateTasks,
  onUpdateNotes,
  showToast,
  isDarkMode = false,
}: MailAppProps) {
  const appHeaderClass = `h-14 sm:h-16 px-3 sm:px-6 flex items-center justify-between gap-2 shrink-0 border-b backdrop-blur-xl z-20 ${
    isDarkMode ? 'border-white/5 bg-black/20' : 'border-black/10 bg-white'
  }`;

  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(data?.events || []);
  const [tasks, setTasks] = useState<TaskItem[]>(data?.tasks || []);
  const [notes, setNotes] = useState<NoteItem[]>(data?.notes || []);

  // Selection State
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set());
  const [lastSelectedEmailId, setLastSelectedEmailId] = useState<string | null>(null);

  // Settings State (persisted in localStorage)
  const [mailSettings, setMailSettings] = useState(() => {
    const defaults = {
      signature: data?.user?.name ? `Atenciosamente,\n${data.user.name}` : '',
      vacationResponder: false,
      vacationSubject: 'Ausência Temporária — Retorno em breve',
      vacationMessage: 'Olá! Estou em foco executivo no momento e responderei sua mensagem assim que possível.',
      density: 'default' as 'default' | 'comfortable' | 'compact',
      undoSendSeconds: 8,
      notifications: true,
      keyboardShortcuts: true,
    };
    try {
      const saved = localStorage.getItem('workspace_mail_settings_v1');
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch {
      return defaults;
    }
  });

  // Navigation & UI
  const [activePane, setActivePane] = useState<
    'agenda' | 'email' | 'compose' | 'tasks' | 'keep' | 'event-create' | 'settings'
  >(data?.compose ? 'compose' : data?.initialPane || 'email');
  const [mobileView, setMobileView] = useState<'list' | 'detail'>(
    data?.compose || data?.initialPane === 'compose' || data?.initialEmailId ? 'detail' : 'list'
  );
  const [mailFolder, setMailFolder] = useState<MailFolderId>('inbox');
  const [inboxCategory, setInboxCategory] = useState<InboxCategory>('all');
  const [showNewMenu, setShowNewMenu] = useState(false);

  // Filtering & Search
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchQuery || '');
  const [filterCriteria, setFilterCriteria] = useState<MailFilterCriteria>({
    from: '',
    to: '',
    subject: '',
    hasAttachment: false,
    unreadOnly: false,
  });
  const [customLabels, setCustomLabels] = useState<MailLabel[]>([
    { id: 'label_project', name: 'Projetos', colorClass: 'text-blue-400' },
    { id: 'label_finance', name: 'Financeiro', colorClass: 'text-emerald-400' },
    { id: 'label_personal', name: 'Pessoal', colorClass: 'text-amber-400' },
  ]);
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [autoRules, setAutoRules] = useState<MailAutoFilterRule[]>(() => {
    const defaults: MailAutoFilterRule[] = [
      {
        id: 'rule_kpi',
        subject: 'Dashboard',
        applyLabelId: 'label_project',
        markImportant: true,
      },
    ];
    try {
      const saved = localStorage.getItem('workspace_mail_rules_v1');
      return saved ? JSON.parse(saved) : defaults;
    } catch {
      return defaults;
    }
  });

  // Active Email & Thread State
  const [activeEmailId, setActiveEmailId] = useState<string | null>(
    data?.initialEmailId ? String(data.initialEmailId) : null
  );
  const [activeThreadMessages, setActiveThreadMessages] = useState<EmailThreadMessage[]>([]);
  const [collapsedMsgIds, setCollapsedMsgIds] = useState<Set<string>>(new Set());
  const [loadingThread, setLoadingThread] = useState(false);
  const [threadSummary, setThreadSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [translatedBodyMap, setTranslatedBodyMap] = useState<Record<string, string>>({});
  const [isTranslating, setIsTranslating] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showLabelMenu, setShowLabelMenu] = useState(false);
  const [showBatchLabelMenu, setShowBatchLabelMenu] = useState(false);
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);

  // Quick Reply State
  const [quickReplyText, setQuickReplyText] = useState('');
  const [isQuickReplying, setIsQuickReplying] = useState(false);

  // Composer State (templates persisted in localStorage)
  const [templates, setTemplates] = useState(() => {
    try {
      const saved = localStorage.getItem('workspace_mail_templates_v1');
      return saved ? JSON.parse(saved) : EMAIL_TEMPLATES;
    } catch {
      return EMAIL_TEMPLATES;
    }
  });
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [showLinkPopover, setShowLinkPopover] = useState(false);
  const [linkUrlInput, setLinkUrlInput] = useState('https://');
  const [linkTextInput, setLinkTextInput] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [composeAttachments, setComposeAttachments] = useState<{ file?: File; name: string; size: string }[]>([]);
  const [composeTo, setComposeTo] = useState(data?.composeTo || '');
  const [composeCc, setComposeCc] = useState('');
  const [composeBcc, setComposeBcc] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [composeSubject, setComposeSubject] = useState(data?.composeSubject || '');
  const [isComposerMinimized, setIsComposerMinimized] = useState(false);
  const [showScheduleSendMenu, setShowScheduleSendMenu] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [confidentialMode, setConfidentialMode] = useState<{ enabled: boolean; expires: string; smsPasscode: boolean }>({
    enabled: false,
    expires: '1 semana',
    smsPasscode: false,
  });

  // Undo Send Banner State
  const [undoSendState, setUndoSendState] = useState<{
    emailId: string;
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body: string;
  } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // AI Composer State
  const [showAiWriter, setShowAiWriter] = useState(false);
  const [aiWritePrompt, setAiWritePrompt] = useState('');
  const [isAiWriting, setIsAiWriting] = useState(false);

  // Event State for Agenda Tab
  const [activeEvent, setActiveEvent] = useState<{
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    location: string;
    description: string;
  }>({
    title: '',
    date: new Date().toISOString().slice(0, 10),
    startTime: '10:00',
    endTime: '11:00',
    location: 'Google Meet',
    description: '',
  });

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toast = (msg: string) => (showToast ? showToast(msg) : console.log(msg));

  // Persist mail settings, rules, and custom templates automatically
  useEffect(() => {
    try {
      localStorage.setItem('workspace_mail_settings_v1', JSON.stringify(mailSettings));
    } catch { /* storage unavailable */ }
  }, [mailSettings]);

  useEffect(() => {
    try {
      localStorage.setItem('workspace_mail_rules_v1', JSON.stringify(autoRules));
    } catch { /* storage unavailable */ }
  }, [autoRules]);

  useEffect(() => {
    try {
      localStorage.setItem('workspace_mail_templates_v1', JSON.stringify(templates));
    } catch { /* storage unavailable */ }
  }, [templates]);

  // Load initial emails and labels from GASBridge
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const [loadedEmails, loadedLabels] = await Promise.all([bridge.getEmails(), bridge.getLabels()]);
      if (!mounted) return;
      setEmails(loadedEmails);
      setCustomLabels(loadedLabels);
      if (onUpdateEmails) onUpdateEmails(loadedEmails);

      if (data?.compose || data?.initialPane === 'compose') {
        setActivePane('compose');
        setMobileView('detail');
        if (data?.composeTo) setComposeTo(data.composeTo);
        if (data?.composeSubject) setComposeSubject(data.composeSubject);
        if (data?.composeBody) {
          setTimeout(() => {
            if (editorRef.current) {
              editorRef.current.innerHTML = sanitizeHtml(data.composeBody || '');
            }
          }, 60);
        }
      }

      if (loadedEmails.length > 0) {
        const requested = data?.initialEmailId
          ? loadedEmails.find((e) => String(e.id) === String(data.initialEmailId))
          : null;
        const firstTarget = requested || loadedEmails.find((e) => e.folder === 'inbox') || loadedEmails[0];
        if (firstTarget) {
          setActiveEmailId(String(firstTarget.id));
          const details = await bridge.getThreadDetails(firstTarget.id);
          if (mounted && details.messages) {
            setActiveThreadMessages(details.messages);
          }
        }
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (data?.events) setCalendarEvents(data.events);
    if (data?.tasks) setTasks(data.tasks);
    if (data?.notes) setNotes(data.notes);
  }, [data]);

  const syncEmails = async (nextEmails: EmailItem[]) => {
    setEmails(nextEmails);
    if (onUpdateEmails) onUpdateEmails(nextEmails);
    await bridge.saveAllEmails(nextEmails);
  };

  const activeEmail = useMemo(
    () => emails.find((e) => String(e.id) === String(activeEmailId)) || null,
    [emails, activeEmailId]
  );

  // Filtered emails using pure mailLogic
  const displayedEmails = useMemo(() => {
    return filterEmails(emails, {
      folder: mailFolder,
      category: inboxCategory,
      searchQuery: localSearch,
      criteria: filterCriteria,
      labels: customLabels,
    });
  }, [emails, mailFolder, inboxCategory, localSearch, filterCriteria, customLabels]);

  const activeEmailIndex = useMemo(
    () => displayedEmails.findIndex((e) => String(e.id) === String(activeEmailId)),
    [displayedEmails, activeEmailId]
  );

  // Folder counts
  const folderCounts = useMemo(() => {
    return {
      inboxUnread: emails.filter((e) => e.folder === 'inbox' && !e.read).length,
      starred: emails.filter((e) => e.isStarred && e.folder !== 'trash' && e.folder !== 'spam').length,
      snoozed: emails.filter((e) => e.folder === 'snoozed' || Boolean(e.snoozedUntil)).length,
      important: emails.filter((e) => e.isImportant && e.folder !== 'trash' && e.folder !== 'spam').length,
      sent: emails.filter((e) => e.folder === 'sent').length,
      scheduled: emails.filter((e) => e.folder === 'scheduled').length,
      drafts: emails.filter((e) => e.folder === 'drafts').length,
      spam: emails.filter((e) => e.folder === 'spam').length,
      trash: emails.filter((e) => e.folder === 'trash').length,
      all: emails.filter((e) => e.folder !== 'trash' && e.folder !== 'spam').length,
    };
  }, [emails]);

  const categoryCounts = useMemo(() => {
    const inboxItems = emails.filter((e) => e.folder === 'inbox' && !e.read);
    return {
      all: inboxItems.length,
      primary: inboxItems.filter((e) => (e.category || 'primary') === 'primary').length,
      promotions: inboxItems.filter((e) => e.category === 'promotions').length,
      social: inboxItems.filter((e) => e.category === 'social').length,
      updates: inboxItems.filter((e) => e.category === 'updates').length,
    };
  }, [emails]);

  const primaryFolders = [
    { id: 'inbox', label: 'Entrada', icon: Inbox, badge: folderCounts.inboxUnread },
    { id: 'starred', label: 'Com estrela', icon: Star, badge: folderCounts.starred },
    { id: 'snoozed', label: 'Adiados', icon: Clock, badge: folderCounts.snoozed },
    { id: 'important', label: 'Importante', icon: Bookmark, badge: folderCounts.important },
    { id: 'sent', label: 'Enviados', icon: Send, badge: 0 },
    { id: 'scheduled', label: 'Agendados', icon: CalendarClock, badge: folderCounts.scheduled },
    { id: 'drafts', label: 'Rascunhos', icon: FileText, badge: folderCounts.drafts },
    { id: 'all', label: 'Todos', icon: Mail, badge: 0 },
    { id: 'spam', label: 'Spam', icon: AlertOctagon, badge: folderCounts.spam },
    { id: 'trash', label: 'Lixeira', icon: Trash2, badge: folderCounts.trash },
  ];

  const handleUpdateTasks = (newTasks: TaskItem[]) => {
    setTasks(newTasks);
    if (onUpdateTasks) onUpdateTasks(newTasks);
  };
  const handleUpdateNotes = (newNotes: NoteItem[]) => {
    setNotes(newNotes);
    if (onUpdateNotes) onUpdateNotes(newNotes);
  };

  // --- SELECTION & BATCH ACTIONS ---
  const handleEmailSelection = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const allIds = displayedEmails.map((email) => String(email.id));

    if (e.shiftKey && lastSelectedEmailId) {
      const start = allIds.indexOf(String(lastSelectedEmailId));
      const end = allIds.indexOf(String(id));
      if (start !== -1 && end !== -1) {
        const [lower, upper] = [Math.min(start, end), Math.max(start, end)];
        const rangeIds = allIds.slice(lower, upper + 1);
        const newSet = new Set(selectedEmailIds);
        rangeIds.forEach((itemId) => newSet.add(itemId));
        setSelectedEmailIds(newSet);
        return;
      }
    }

    const newSet = new Set(selectedEmailIds);
    if (newSet.has(String(id))) {
      newSet.delete(String(id));
    } else {
      newSet.add(String(id));
      setLastSelectedEmailId(String(id));
    }
    setSelectedEmailIds(newSet);
  };

  const handleSelectAll = () => {
    if (displayedEmails.length > 0 && selectedEmailIds.size === displayedEmails.length) {
      setSelectedEmailIds(new Set());
    } else {
      setSelectedEmailIds(new Set(displayedEmails.map((e) => String(e.id))));
    }
  };

  const handleSingleEmailAction = async (
    emailId: string,
    action: BatchEmailAction,
    payload?: { snoozedUntil?: string; labelId?: string }
  ) => {
    const removesFromCurrentView = ['archive', 'trash', 'spam', 'delete_forever', 'snooze', 'mute'].includes(action);
    const next = applyBatchEmailAction(emails, [emailId], action, payload);
    await syncEmails(next);

    if (removesFromCurrentView && String(activeEmailId) === String(emailId)) {
      const remainingVisible = displayedEmails.filter((e) => String(e.id) !== String(emailId));
      const nextCandidate = remainingVisible[Math.min(activeEmailIndex, remainingVisible.length - 1)] || null;
      if (nextCandidate) {
        setActiveEmailId(String(nextCandidate.id));
        const details = await bridge.getThreadDetails(nextCandidate.id);
        if (details.messages) setActiveThreadMessages(details.messages);
      } else {
        setActiveEmailId(null);
        setActiveThreadMessages([]);
        setMobileView('list');
      }
    }

    if (action === 'archive') toast('Conversa arquivada');
    else if (action === 'trash') toast('Conversa movida para a Lixeira');
    else if (action === 'spam') toast('Conversa denunciada como Spam');
    else if (action === 'restore') toast('Conversa movida de volta para a Entrada');
    else if (action === 'delete_forever') toast('Conversa excluída permanentemente');
    else if (action === 'snooze') toast(`Adiado para ${payload?.snoozedUntil || 'Amanhã, 08:00'}`);
    else if (action === 'pin') toast('Conversa fixada no topo');
    else if (action === 'unpin') toast('Conversa desafixada');
    else if (action === 'mute') toast('Conversa silenciada (oculta da Entrada)');
    else if (action === 'unmute') toast('Conversa reativada na Entrada');
  };

  const handleBatchAction = async (
    action: BatchEmailAction,
    payload?: { snoozedUntil?: string; labelId?: string }
  ) => {
    const ids = Array.from(selectedEmailIds) as string[];
    if (ids.length === 0) return;

    const next = applyBatchEmailAction(emails, ids, action, payload);
    await syncEmails(next);
    setSelectedEmailIds(new Set());
    setLastSelectedEmailId(null);
    setShowBatchLabelMenu(false);

    const actionLabels: Record<string, string> = {
      archive: 'arquivados',
      trash: 'movidos para a lixeira',
      spam: 'marcados como spam',
      restore: 'restaurados para a Entrada',
      read: 'marcados como lidos',
      unread: 'marcados como não lidos',
      star: 'marcados com estrela',
      important: 'marcados como importantes',
      snooze: 'adiados',
      add_label: 'etiquetados',
      mute: 'silenciados',
      pin: 'fixados no topo',
    };
    toast(`${ids.length} e-mail(s) ${actionLabels[action] || 'atualizados'}.`);
  };

  const handleEmptyFolder = async (targetFolder: 'trash' | 'spam') => {
    const remaining = emails.filter((e) => e.folder !== targetFolder);
    await syncEmails(remaining);
    toast(targetFolder === 'trash' ? 'Lixeira esvaziada com sucesso!' : 'Todos os itens de Spam foram excluídos!');
  };

  const handleMarkAllAsRead = async () => {
    const ids = displayedEmails.map((e) => String(e.id));
    if (ids.length === 0) return;
    const next = applyBatchEmailAction(emails, ids, 'read');
    await syncEmails(next);
    toast('Todas as mensagens visíveis foram marcadas como lidas.');
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;
    const colors = ['text-blue-400', 'text-emerald-400', 'text-amber-400', 'text-purple-400', 'text-rose-400'];
    const randomColor = colors[customLabels.length % colors.length];
    const created = await bridge.createLabel(newLabelName.trim(), randomColor);
    setCustomLabels((prev) => [...prev, created]);
    setNewLabelName('');
    setIsCreatingLabel(false);
    toast(`Marcador "${created.name}" criado!`);
  };

  const handleDeleteLabel = async (labelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customLabels.filter((l) => l.id !== labelId);
    setCustomLabels(updated);
    await bridge.saveLabels(updated);
    if (mailFolder === labelId) setMailFolder('inbox');
    toast('Marcador removido');
  };

  // --- EMAIL CLICK & THREAD LOADING ---
  const handleEmailClick = async (email: EmailItem) => {
    if (email.folder === 'drafts') {
      setEditingDraftId(String(email.id));
      setComposeTo(email.to || '');
      setComposeCc(email.cc || '');
      setComposeBcc(email.bcc || '');
      setShowCcBcc(Boolean(email.cc || email.bcc));
      setComposeSubject(email.subject === '(Sem assunto)' ? '' : email.subject);
      setActivePane('compose');
      setMobileView('detail');
      setIsComposerMinimized(false);
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.innerHTML = sanitizeHtml(email.body || `<p>${escapeHtml(email.preview || '')}</p>`);
        }
      }, 60);
      return;
    }

    setActiveEmailId(String(email.id));
    setActivePane('email');
    setMobileView('detail');
    setLoadingThread(true);
    setQuickReplyText('');
    setThreadSummary(null);
    setTranslatedBodyMap({});
    setCollapsedMsgIds(new Set());

    if (!email.read) {
      const next = applyBatchEmailAction(emails, [email.id], 'read');
      await syncEmails(next);
    }

    try {
      const details = await bridge.getThreadDetails(email.id);
      if (details.success && details.messages && details.messages.length > 0) {
        setActiveThreadMessages(details.messages);
        if (details.messages.length > 2) {
          // Collapse older messages except the last two by default
          const toCollapse = details.messages.slice(0, -1).map((m: EmailThreadMessage) => m.id);
          setCollapsedMsgIds(new Set(toCollapse));
        }
      } else {
        setActiveThreadMessages([
          {
            id: `msg_${email.id}`,
            from: email.sender,
            fromEmail: email.senderEmail || '',
            senderInit: email.senderInit || email.sender[0] || '?',
            to: email.to || data?.user?.email || '',
            date: email.time,
            body: sanitizeHtml(email.body || `<p>${escapeHtml(email.preview || '')}</p>`),
            attachments: email.attachments || [],
          },
        ]);
      }
    } catch (e) {
      console.error('Failed to load thread', e);
    } finally {
      setLoadingThread(false);
    }
  };

  const handleNavigateThread = (direction: 'prev' | 'next') => {
    if (displayedEmails.length === 0) return;
    const nextIdx =
      direction === 'next'
        ? Math.min(displayedEmails.length - 1, activeEmailIndex + 1)
        : Math.max(0, activeEmailIndex - 1);
    const target = displayedEmails[nextIdx];
    if (target && String(target.id) !== String(activeEmailId)) {
      handleEmailClick(target);
    }
  };

  const handleCreateAutoRuleFromFilter = async () => {
    if (!filterCriteria.from && !filterCriteria.subject) {
      toast('Defina ao menos um remetente ou assunto para criar uma regra automática.');
      return;
    }
    const newRule: MailAutoFilterRule = {
      id: `rule_${Date.now()}`,
      from: filterCriteria.from || undefined,
      subject: filterCriteria.subject || undefined,
      applyLabelId: customLabels[0]?.id || 'label_project',
      markImportant: true,
    };
    const updatedRules = [...autoRules, newRule];
    setAutoRules(updatedRules);
    const processed = applyAutoFilterRules(emails, newRule);
    await syncEmails(processed);
    setShowFilterPanel(false);
    toast('Regra de filtro automático criada e aplicada às conversas!');
  };

  // --- THREAD AI SUMMARY & TRANSLATION ---
  const handleSummarizeThread = async () => {
    if (!activeEmail) return;
    setIsSummarizing(true);
    const transcript = activeThreadMessages
      .map((m) => `${m.from} (${m.date}): ${(m.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`)
      .join('\n');
    try {
      const response = await askGemini({
        task: 'generate',
        prompt: `Resuma esta conversa de e-mail em 3 tópicos curtos e objetivos em português (usando "• "). Assunto: "${activeEmail.subject}".\n\n${transcript.slice(0, 3500)}`,
      });
      setThreadSummary(response.text.trim());
    } catch {
      const senders = Array.from(new Set(activeThreadMessages.map((m) => m.from))).join(', ');
      const latestBody = (activeThreadMessages[activeThreadMessages.length - 1]?.body || activeEmail.preview)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const attachmentCount = activeThreadMessages.reduce(
        (acc, m) => acc + (m.attachments ? m.attachments.length : 0),
        0
      );
      setThreadSummary(
        `• Assunto central: ${activeEmail.subject}\n` +
          `• Participantes (${activeThreadMessages.length} mensagem(ns)): ${senders}\n` +
          `• Última atualização: ${latestBody.slice(0, 140)}${latestBody.length > 140 ? '...' : ''}` +
          (attachmentCount > 0 ? `\n• Anexos na conversa: ${attachmentCount} arquivo(s) disponível(is) para download.` : '')
      );
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleTranslateThread = async () => {
    if (!activeEmail) return;
    if (Object.keys(translatedBodyMap).length > 0) {
      setTranslatedBodyMap({});
      toast('Exibindo idioma original');
      return;
    }
    setIsTranslating(true);
    const nextMap: Record<string, string> = {};
    for (const msg of activeThreadMessages) {
      const plain = (msg.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      try {
        const res = await askGemini({
          task: 'generate',
          prompt: `Traduza o texto a seguir para inglês natural e profissional. Retorne apenas a tradução:\n\n${plain.slice(0, 2000)}`,
        });
        nextMap[msg.id] = `<div class="p-2.5 rounded-lg bg-blue-500/15 border border-blue-500/30 mb-2 text-xs font-semibold">🌐 Traduzido para Inglês (IA)</div><p>${escapeHtml(res.text.trim()).replace(/\n/g, '<br/>')}</p>`;
      } catch {
        nextMap[msg.id] = `<div class="p-2.5 rounded-lg bg-blue-500/15 border border-blue-500/30 mb-2 text-xs font-semibold">🌐 Tradução indisponível offline — exibindo texto limpo</div><p>${escapeHtml(plain)}</p>`;
      }
    }
    setTranslatedBodyMap(nextMap);
    setIsTranslating(false);
    toast('Conversa traduzida para Inglês');
  };

  // --- CANCEL SCHEDULED SEND ---
  const handleCancelScheduledSend = async (email: EmailItem) => {
    const updated = emails.map((e) =>
      String(e.id) === String(email.id)
        ? { ...e, folder: 'drafts', time: 'Rascunho', scheduledFor: undefined }
        : e
    );
    await syncEmails(updated);
    setEditingDraftId(String(email.id));
    setComposeTo(email.to || '');
    setComposeCc(email.cc || '');
    setComposeBcc(email.bcc || '');
    setShowCcBcc(Boolean(email.cc || email.bcc));
    setComposeSubject(email.subject);
    setActivePane('compose');
    setMobileView('detail');
    setIsComposerMinimized(false);
    setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = sanitizeHtml(email.body || `<p>${escapeHtml(email.preview || '')}</p>`);
    }, 60);
    toast('Envio agendado cancelado — mensagem reaberta como Rascunho');
  };

  // --- SNOOZE ---
  const handleSnooze = async (time: 'today' | 'tomorrow' | 'nextWeek') => {
    if (!activeEmail) return;
    const labelMap: Record<string, string> = {
      today: 'Hoje, 18:00',
      tomorrow: 'Amanhã, 08:00',
      nextWeek: 'Seg, 08:00',
    };
    await handleSingleEmailAction(String(activeEmail.id), 'snooze', {
      snoozedUntil: labelMap[time],
    });
    setShowSnoozeMenu(false);
  };

  // --- DOWNLOAD ATTACHMENT ---
  const handleDownloadAttachment = async (msgId: string, attIndex: number | string, filename: string) => {
    toast(`Baixando ${filename}...`);
    try {
      const res = await bridge.getEmailAttachment(msgId, attIndex);
      if (res.success && res.data) {
        const link = document.createElement('a');
        link.href = `data:${res.mimeType || 'text/plain'};base64,${res.data}`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (e) {
      console.error(e);
      toast('Erro ao baixar anexo.');
    }
  };

  // --- CREATE TASK FROM EMAIL ---
  const handleCreateTaskFromEmail = async (emailObj?: EmailItem | null) => {
    const targetEmail = emailObj || activeEmail;
    if (!targetEmail) return;
    const title = targetEmail.subject;
    const details = `E-mail de: ${targetEmail.sender} (${targetEmail.time})`;
    const response = await bridge.createTask(
      title,
      details,
      'default',
      new Date().toISOString(),
      undefined,
      {
        linkedSource: {
          type: 'mail',
          id: String(targetEmail.id),
          label: `E-mail: ${targetEmail.subject.slice(0, 26)}`,
        },
      }
    );
    if (response.success && response.task) {
      const allTasks = await bridge.getTasks('all');
      setTasks(allTasks);
      if (onUpdateTasks) onUpdateTasks(allTasks);
      toast(`Tarefa vinculada ao e-mail "${targetEmail.subject}" criada!`);
      setActivePane('tasks');
      setMobileView('detail');
    }
  };

  // --- COMPOSER & SEND / UNDO SEND / SCHEDULE SEND ---
  const resetComposerFields = () => {
    if (editorRef.current) editorRef.current.innerHTML = '';
    setComposeTo('');
    setComposeCc('');
    setComposeBcc('');
    setShowCcBcc(false);
    setComposeSubject('');
    setComposeAttachments([]);
    setEditingDraftId(null);
    setShowLinkPopover(false);
    setConfidentialMode({ enabled: false, expires: '1 semana', smsPasscode: false });
  };

  const openNewComposer = () => {
    resetComposerFields();
    setActivePane('compose');
    setMobileView('detail');
    setIsComposerMinimized(false);
    setTimeout(() => {
      if (editorRef.current) {
        const sig = mailSettings.signature
          ? `<br/><br/><div class="text-xs opacity-70 border-t border-gray-300/20 pt-2">${escapeHtml(mailSettings.signature).replace(
              /\n/g,
              '<br/>'
            )}</div>`
          : '';
        editorRef.current.innerHTML = sanitizeHtml(sig);
      }
    }, 50);
  };

  const handleApplyTemplate = (tpl: (typeof EMAIL_TEMPLATES)[0]) => {
    if (!composeSubject) setComposeSubject(tpl.subject);
    if (editorRef.current) {
      const sig = mailSettings.signature
        ? `<br/><div class="text-xs opacity-70 border-t border-gray-300/20 pt-2">${escapeHtml(mailSettings.signature).replace(
            /\n/g,
            '<br/>'
          )}</div>`
        : '';
      editorRef.current.innerHTML = sanitizeHtml(`${tpl.body}${sig}`);
    }
    setShowTemplateMenu(false);
    toast(`Modelo "${tpl.title}" aplicado!`);
  };

  const handleSaveCurrentDraftAsTemplate = () => {
    const bodyHtml = editorRef.current?.innerHTML || '';
    const title = composeSubject.trim() || `Modelo Personalizado #${templates.length + 1}`;
    const newTpl = {
      id: `tpl_custom_${Date.now()}`,
      title,
      subject: composeSubject.trim() || title,
      body: bodyHtml || '<p>Olá,</p><p>Segue atualização solicitada.</p>',
    };
    setTemplates((prev: typeof EMAIL_TEMPLATES) => [...prev, newTpl]);
    setShowTemplateMenu(false);
    toast(`Modelo "${title}" salvo na galeria!`);
  };

  const handleInsertLink = () => {
    const rawUrl = linkUrlInput.trim();
    if (!/^(https?:|mailto:)/i.test(rawUrl)) {
      toast('Informe um link válido iniciado com http://, https:// ou mailto:');
      return;
    }
    const label = escapeHtml(linkTextInput.trim() || rawUrl);
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand(
        'insertHTML',
        false,
        `<a href="${escapeHtml(rawUrl)}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline;">${label}</a>`
      );
    }
    setShowLinkPopover(false);
    setLinkUrlInput('https://');
    setLinkTextInput('');
  };

  const handleSendEmail = async () => {
    if (!composeTo.trim() && !composeSubject.trim()) {
      toast('Preencha o destinatário ou assunto para enviar.');
      return;
    }
    const rawBody = sanitizeHtml(editorRef.current ? editorRef.current.innerHTML : '');
    const confidentialBanner = confidentialMode.enabled
      ? `<div style="padding:8px 12px;border-radius:8px;background:#eff6ff;color:#1d4ed8;font-size:12px;margin-bottom:8px;">🔒 <strong>Modo Confidencial Ativo</strong> · Expira em ${escapeHtml(confidentialMode.expires)} · Cópia e encaminhamento bloqueados</div>`
      : '';
    const finalBody = `${confidentialBanner}${rawBody}`;

    const processedAttachments: EmailAttachment[] = [];
    for (const att of composeAttachments) {
      if (att.file) {
        try {
          const base64 = await fileToBase64(att.file);
          processedAttachments.push({ name: att.name, mimeType: att.file.type, data: base64 });
        } catch (err) {
          console.error('Erro anexo', err);
        }
      }
    }

    const recipient = composeTo.trim();
    if (!recipient) {
      toast('Informe pelo menos um destinatário.');
      return;
    }

    const res = await bridge.sendEmail(
      recipient,
      composeSubject || '(Sem assunto)',
      finalBody,
      processedAttachments,
      { cc: composeCc, bcc: composeBcc, draftId: editingDraftId || undefined }
    );
    const updatedEmails = await bridge.getEmails();
    setEmails(updatedEmails);
    if (onUpdateEmails) onUpdateEmails(updatedEmails);

    // Setup Undo Send banner
    if (res?.email) {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      setUndoSendState({
        emailId: res.email.id,
        to: recipient,
        cc: composeCc || undefined,
        bcc: composeBcc || undefined,
        subject: composeSubject || '(Sem assunto)',
        body: rawBody,
      });
      undoTimerRef.current = setTimeout(() => {
        setUndoSendState(null);
      }, mailSettings.undoSendSeconds * 1000);
    }

    setIsComposerMinimized(false);
    setActivePane('email');
    resetComposerFields();
  };

  const handleUndoSend = async () => {
    if (!undoSendState) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    const filtered = emails.filter((e) => String(e.id) !== String(undoSendState.emailId));
    await syncEmails(filtered);
    setComposeTo(undoSendState.to);
    setComposeCc(undoSendState.cc || '');
    setComposeBcc(undoSendState.bcc || '');
    setShowCcBcc(Boolean(undoSendState.cc || undoSendState.bcc));
    setComposeSubject(undoSendState.subject);
    setActivePane('compose');
    setMobileView('detail');
    setIsComposerMinimized(false);
    const bodyToRestore = undoSendState.body;
    setUndoSendState(null);
    setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = sanitizeHtml(bodyToRestore);
    }, 60);
    toast('Envio cancelado! Mensagem reaberta para edição.');
  };

  const handleScheduleSend = async (time: 'tomorrow' | 'afternoon' | 'monday') => {
    const recipient = composeTo.trim();
    if (!recipient) {
      toast('Informe um destinatário para agendar o envio.');
      return;
    }
    const body = sanitizeHtml(editorRef.current ? editorRef.current.innerHTML : '...');
    await bridge.scheduleSend(
      recipient,
      composeSubject || '(Sem assunto)',
      body,
      time,
      [],
      { cc: composeCc, bcc: composeBcc, draftId: editingDraftId || undefined }
    );
    const updated = await bridge.getEmails();
    setEmails(updated);
    if (onUpdateEmails) onUpdateEmails(updated);
    setShowScheduleSendMenu(false);
    setIsComposerMinimized(false);
    setMailFolder('scheduled');
    setActivePane('email');
    resetComposerFields();
    toast('Envio agendado com sucesso!');
  };

  const handleCloseComposer = async () => {
    const content = editorRef.current?.innerText.trim() || '';
    if (content.length > 5 || composeSubject.trim() || composeTo.trim()) {
      await bridge.saveDraft(composeTo, composeSubject, sanitizeHtml(editorRef.current?.innerHTML || ''), [], {
        cc: composeCc,
        bcc: composeBcc,
        draftId: editingDraftId || undefined,
      });
      const updated = await bridge.getEmails();
      setEmails(updated);
      if (onUpdateEmails) onUpdateEmails(updated);
      toast('Rascunho salvo automaticamente');
    }
    setIsComposerMinimized(false);
    setActivePane('email');
    resetComposerFields();
  };

  const handleDiscardDraft = async () => {
    if (editingDraftId) {
      const next = emails.filter((e) => String(e.id) !== String(editingDraftId));
      await syncEmails(next);
    }
    setIsComposerMinimized(false);
    setActivePane('email');
    setMobileView('list');
    resetComposerFields();
    toast('Rascunho descartado');
  };

  // --- REPLY / FORWARD / QUICK REPLY ---
  const handleReply = (replyAll = false) => {
    if (!activeEmail) return;
    setEditingDraftId(null);
    setComposeTo(activeEmail.senderEmail || activeEmail.sender);
    if (replyAll && (activeEmail.to || activeEmail.cc)) {
      setShowCcBcc(true);
      setComposeCc([activeEmail.to, activeEmail.cc].filter(Boolean).join(', '));
    } else {
      setComposeCc('');
      setShowCcBcc(false);
    }
    setComposeBcc('');
    setComposeSubject(
      activeEmail.subject.startsWith('Re:') ? activeEmail.subject : `Re: ${activeEmail.subject}`
    );
    const lastMsg = activeThreadMessages[activeThreadMessages.length - 1];
    const quote = lastMsg
      ? `<br/><br/><div class="gmail_quote" style="opacity:0.75;font-size:12px;">Em ${escapeHtml(lastMsg.date || '')}, <strong>${escapeHtml(lastMsg.from || '')}</strong> escreveu:<br/><blockquote style="margin:6px 0 0 8px;border-left:2px solid #3b82f6;padding-left:10px;">${sanitizeHtml(
          lastMsg.body || escapeHtml(lastMsg.plainBody || '')
        )}</blockquote></div>`
      : '';

    setActivePane('compose');
    setMobileView('detail');
    setIsComposerMinimized(false);
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = sanitizeHtml(quote);
        editorRef.current.focus();
      }
    }, 60);
  };

  const handleForward = () => {
    if (!activeEmail) return;
    setEditingDraftId(null);
    setComposeTo('');
    setComposeCc('');
    setComposeBcc('');
    setShowCcBcc(false);
    setComposeSubject(
      activeEmail.subject.startsWith('Fwd:') ? activeEmail.subject : `Fwd: ${activeEmail.subject}`
    );
    const lastMsg = activeThreadMessages[activeThreadMessages.length - 1];
    const quote = lastMsg
      ? `<br/><br/>---------- Mensagem encaminhada ----------<br/><strong>De:</strong> ${escapeHtml(lastMsg.from || '')}<br/><strong>Data:</strong> ${escapeHtml(lastMsg.date || '')}<br/><strong>Assunto:</strong> ${escapeHtml(activeEmail.subject || '')}<br/><strong>Para:</strong> ${escapeHtml(lastMsg.to || '')}<br/><br/>${sanitizeHtml(
          lastMsg.body || escapeHtml(lastMsg.plainBody || '')
        )}`
      : '';

    setActivePane('compose');
    setMobileView('detail');
    setIsComposerMinimized(false);
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = sanitizeHtml(quote);
        editorRef.current.focus();
      }
    }, 60);
  };

  const handleQuickReply = async (customText?: string) => {
    const textToSend = (customText ?? quickReplyText).trim();
    if (!activeEmail || !textToSend) return;
    setIsQuickReplying(true);
    const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const selfName = data?.user?.name || 'Você';
    const selfEmail = data?.user?.email || '';
    const newReplyMsg: EmailThreadMessage = {
      id: `msg_reply_${Date.now()}`,
      from: selfName,
      fromEmail: selfEmail,
      senderInit: selfName[0]?.toUpperCase() || 'V',
      to: activeEmail.senderEmail || activeEmail.sender,
      date: `Hoje às ${nowTime}`,
      body: `<p>${escapeHtml(textToSend).replace(/\n/g, '<br/>')}</p>`,
    };

    const nextMessages = [...activeThreadMessages, newReplyMsg];
    setActiveThreadMessages(nextMessages);

    const updatedEmails = emails.map((e) =>
      String(e.id) === String(activeEmail.id)
        ? { ...e, messages: nextMessages, preview: `Você: ${textToSend.slice(0, 90)}`, time: nowTime }
        : e
    );
    await syncEmails(updatedEmails);
    setQuickReplyText('');
    setIsQuickReplying(false);
    toast('Resposta enviada na conversa!');
  };

  const handleAiWrite = async () => {
    if (!aiWritePrompt.trim()) return;
    setIsAiWriting(true);
    try {
      const response = await askGemini({
        task: 'generate',
        prompt: `Escreva o corpo de um e-mail profissional e direto em português com base neste pedido: "${aiWritePrompt}". Não inclua linha de assunto.`,
      });
      if (editorRef.current) {
        editorRef.current.innerHTML = escapeHtml(response.text).replace(/\n/g, '<br/>');
      }
      setShowAiWriter(false);
      setAiWritePrompt('');
    } catch {
      if (editorRef.current) {
        const signOff = data?.user?.name ? `<p>Atenciosamente,<br/>${escapeHtml(data.user.name)}</p>` : '<p>Atenciosamente,</p>';
        editorRef.current.innerHTML = `<p>Olá,</p><p>${escapeHtml(aiWritePrompt)}</p><p>Fico à disposição para alinharmos os próximos passos.</p>${signOff}`;
      }
      setShowAiWriter(false);
      setAiWritePrompt('');
      toast('Rascunho estruturado inserido!');
    } finally {
      setIsAiWriting(false);
    }
  };

  // --- AGENDA EVENT CREATION ---
  const handleCreateQuickEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent.title.trim()) {
      toast('Informe um título para o compromisso');
      return;
    }
    const startIso = new Date(`${activeEvent.date}T${activeEvent.startTime || '10:00'}:00`).toISOString();
    const endIso = new Date(`${activeEvent.date}T${activeEvent.endTime || '11:00'}:00`).toISOString();
    const created = {
      id: `ev_${Date.now()}`,
      title: activeEvent.title.trim(),
      start: startIso,
      end: endIso,
      calendarId: 'primary',
      color: '#2563EB',
      location: activeEvent.location || 'Google Meet',
      meetLink: 'https://meet.google.com/new-sync',
      description: activeEvent.description || 'Agendado pelo Gmail Workspace',
    };
    setCalendarEvents((prev) => [created, ...prev]);
    await bridge.createCalendarEvent(created);
    setActiveEvent({ ...activeEvent, title: '', description: '' });
    toast('Compromisso adicionado à Agenda!');
  };

  const smartReplies = useMemo(() => getSmartRepliesForEmail(activeEmail), [activeEmail]);

  // Official Gmail Keyboard Shortcuts Listener
  useEffect(() => {
    if (!mailSettings.keyboardShortcuts) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === '?') {
        e.preventDefault();
        setShowShortcutsModal((prev) => !prev);
      } else if (e.key.toLowerCase() === 'c' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        openNewComposer();
      } else if (e.key.toLowerCase() === 'e' && activeEmail) {
        e.preventDefault();
        handleSingleEmailAction(String(activeEmail.id), 'archive');
      } else if (e.key === '#' && activeEmail) {
        e.preventDefault();
        handleSingleEmailAction(String(activeEmail.id), 'trash');
      } else if (e.key.toLowerCase() === 'r' && activeEmail && activePane === 'email') {
        e.preventDefault();
        handleReply(false);
      } else if (e.key.toLowerCase() === 'a' && activeEmail && activePane === 'email') {
        e.preventDefault();
        handleReply(true);
      } else if (e.key.toLowerCase() === 'f' && activeEmail && activePane === 'email') {
        e.preventDefault();
        handleForward();
      } else if (e.key.toLowerCase() === 's' && activeEmail) {
        e.preventDefault();
        handleSingleEmailAction(String(activeEmail.id), activeEmail.isStarred ? 'unstar' : 'star');
      } else if (e.key.toLowerCase() === 'm' && activeEmail) {
        e.preventDefault();
        handleSingleEmailAction(String(activeEmail.id), activeEmail.isMuted ? 'unmute' : 'mute');
      } else if (e.key.toLowerCase() === 'j') {
        e.preventDefault();
        handleNavigateThread('next');
      } else if (e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handleNavigateThread('prev');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mailSettings.keyboardShortcuts, activeEmail, activePane, displayedEmails, activeEmailIndex]);

  const densityPadding =
    mailSettings.density === 'compact'
      ? 'py-2 px-3'
      : mailSettings.density === 'comfortable'
      ? 'py-3 px-4'
      : 'py-3.5 px-4';

  return (
    <div
      className={`flex flex-col h-full relative transition-colors ${
        isDarkMode ? 'bg-[#191919] text-white' : 'bg-[#F0F2F5] text-[#202124]'
      }`}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Vacation Responder Active Banner */}
      {mailSettings.vacationResponder && (
        <div
          className={`border-b px-6 py-1.5 flex items-center justify-between text-xs shrink-0 ${
            isDarkMode
              ? 'bg-amber-500/20 border-amber-500/30 text-amber-200'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <CalendarClock size={14} />
            <span>
              <strong>Resposta automática de férias ativa:</strong> "{mailSettings.vacationSubject}"
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMailSettings((s) => ({ ...s, vacationResponder: false }))}
            className="underline font-bold"
          >
            Desativar agora
          </button>
        </div>
      )}

      {/* Undo Send Floating Toast */}
      {undoSendState && (
        <div className="fixed bottom-6 left-6 z-50 bg-[#202124] text-white border border-white/15 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-3">
          <span className="text-xs font-medium">Mensagem enviada.</span>
          <button
            type="button"
            onClick={handleUndoSend}
            className="text-xs font-bold text-blue-400 hover:text-blue-300 uppercase tracking-wide flex items-center gap-1"
          >
            <RotateCcw size={13} /> Desfazer
          </button>
          <button
            type="button"
            onClick={() => setUndoSendState(null)}
            className="text-white/50 hover:text-white"
            aria-label="Fechar aviso de envio"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Minimized Composer Bar */}
      {isComposerMinimized && (
        <div
          className={`fixed bottom-4 right-8 z-50 w-72 rounded-t-xl border shadow-2xl px-4 py-2.5 flex items-center justify-between cursor-pointer ${
            isDarkMode ? 'bg-[#2d2e30] border-white/15 text-white' : 'bg-[#202124] border-gray-700 text-white'
          }`}
          onClick={() => {
            setIsComposerMinimized(false);
            setActivePane('compose');
            setMobileView('detail');
          }}
        >
          <div className="flex items-center gap-2 truncate">
            <Mail size={14} className="text-blue-400 shrink-0" />
            <span className="text-xs font-semibold truncate">{composeSubject || 'Nova Mensagem (Rascunho)'}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsComposerMinimized(false);
                setActivePane('compose');
                setMobileView('detail');
              }}
              className="p-1 hover:bg-white/10 rounded"
              title="Maximizar"
            >
              <Maximize2 size={13} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCloseComposer();
              }}
              className="p-1 hover:bg-white/10 rounded"
              title="Salvar e fechar"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className={appHeaderClass}>
        <div className="flex items-center gap-2.5 min-w-0">
          <GoogleIcons.Gmail className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 hover:-translate-y-0.5 transition-transform drop-shadow-md" />
          <div className="flex items-center min-w-0">
            <span className={`text-base sm:text-lg font-medium tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-[#202124]'}`}>
              Google Gmail
            </span>
            <span className={`hidden sm:inline-block ml-2 text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${isDarkMode ? 'bg-white/10 text-white/60' : 'bg-gray-200 text-gray-600'}`}>
              {folderCounts.inboxUnread} não lidos
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={openNewComposer}
            className="bg-[#C2E7FF] text-[#001D35] px-3 sm:px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 sm:gap-2 hover:shadow-md transition-all active:scale-95 min-h-[34px]"
          >
            <Plus size={16} /> <span>Escrever</span>
          </button>
          <button
            type="button"
            onClick={() => setShowShortcutsModal(true)}
            title="Atalhos de Teclado do Gmail (?)"
            aria-label="Atalhos de Teclado do Gmail"
            className={`hidden sm:flex w-9 h-9 rounded-full items-center justify-center transition-colors ${
              isDarkMode
                ? 'bg-white/5 hover:bg-white/10 text-white/80'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <Keyboard size={17} />
          </button>
          <button
            type="button"
            onClick={() => {
              setActivePane('settings');
              setMobileView('detail');
            }}
            title="Configurações do Gmail"
            aria-label="Configurações do Gmail"
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
              activePane === 'settings'
                ? isDarkMode
                  ? 'bg-white/20 text-white'
                  : 'bg-blue-100 text-blue-700'
                : isDarkMode
                ? 'bg-white/5 hover:bg-white/10 text-white/80'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <Settings size={18} />
          </button>
          <div className={`h-6 w-[1px] mx-0.5 sm:mx-1 ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`} />
          <button
            type="button"
            aria-label="Fechar Gmail"
            className={`p-2 rounded-full cursor-pointer transition-colors ${
              isDarkMode ? 'hover:bg-white/10 text-white/80' : 'hover:bg-gray-100 text-gray-600'
            }`}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="flex-1 flex overflow-hidden relative p-2 sm:p-3 gap-2 sm:gap-3">
        {/* LEFT PANEL: Folders, Categories, Search & Email List */}
        <div
          className={`${
            mobileView === 'detail' ? 'hidden lg:flex' : 'flex'
          } w-full lg:w-[46%] lg:min-w-[380px] flex-col rounded-[20px] sm:rounded-[24px] border overflow-hidden relative shadow-sm ${
            isDarkMode ? 'bg-[#1E1E1E] border-white/5' : 'bg-white border-gray-200'
          }`}
        >
          {/* Search & Filter Header */}
          <div className={`flex flex-col border-b shrink-0 ${isDarkMode ? 'border-white/5 bg-[#1E1E1E]' : 'border-gray-100 bg-white'}`}>
            <div className="flex items-center gap-2 px-4 pt-3 pb-2">
              <div
                className={`flex-1 border rounded-xl h-10 flex items-center px-3 relative focus-within:border-blue-500/50 transition-all ${
                  isDarkMode ? 'bg-white/5 border-white/10 focus-within:bg-black/20' : 'bg-gray-100 border-gray-200 focus-within:bg-white'
                }`}
              >
                <Search size={15} className={isDarkMode ? 'text-white/40' : 'text-gray-400'} />
                <input
                  type="text"
                  placeholder="Pesquisar no e-mail (ex: from:gabriel, has:attachment, is:unread)"
                  className={`bg-transparent border-none outline-none flex-1 ml-2 text-xs ${
                    isDarkMode ? 'text-white placeholder:text-white/35' : 'text-gray-800 placeholder:text-gray-400'
                  }`}
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                />
                {localSearch && (
                  <button
                    type="button"
                    onClick={() => setLocalSearch('')}
                    className="p-1 text-white/40 hover:text-white"
                    title="Limpar pesquisa"
                  >
                    <X size={13} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowFilterPanel(!showFilterPanel)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    showFilterPanel
                      ? 'bg-blue-500/20 text-blue-500'
                      : isDarkMode
                      ? 'hover:bg-white/10 text-white/60'
                      : 'hover:bg-gray-200 text-gray-500'
                  }`}
                  title="Filtros Avançados de Pesquisa"
                >
                  <SlidersHorizontal size={15} />
                </button>
              </div>
            </div>

            {/* Advanced Filter Dropdown Panel */}
            {showFilterPanel && (
              <div
                className={`mx-4 mb-3 p-3.5 rounded-xl border shadow-xl z-40 space-y-2.5 ${
                  isDarkMode ? 'bg-[#262729] border-white/10' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider opacity-60">
                    Filtros Avançados do Gmail
                  </span>
                  <button type="button" onClick={() => setShowFilterPanel(false)}>
                    <X size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="De (Remetente)"
                    value={filterCriteria.from || ''}
                    onChange={(e) => setFilterCriteria({ ...filterCriteria, from: e.target.value })}
                    className={`border rounded-lg px-2.5 py-1.5 text-xs outline-none ${
                      isDarkMode ? 'bg-black/30 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-800'
                    }`}
                  />
                  <input
                    type="text"
                    placeholder="Assunto contém"
                    value={filterCriteria.subject || ''}
                    onChange={(e) => setFilterCriteria({ ...filterCriteria, subject: e.target.value })}
                    className={`border rounded-lg px-2.5 py-1.5 text-xs outline-none ${
                      isDarkMode ? 'bg-black/30 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-800'
                    }`}
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(filterCriteria.hasAttachment)}
                        onChange={(e) => setFilterCriteria({ ...filterCriteria, hasAttachment: e.target.checked })}
                      />
                      <span>Contém anexo</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(filterCriteria.unreadOnly)}
                        onChange={(e) => setFilterCriteria({ ...filterCriteria, unreadOnly: e.target.checked })}
                      />
                      <span>Apenas não lidos</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setFilterCriteria({ from: '', to: '', subject: '', hasAttachment: false, unreadOnly: false })
                      }
                      className="text-xs opacity-60 hover:opacity-100 px-2 py-1"
                    >
                      Limpar
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateAutoRuleFromFilter}
                      className="text-xs px-2.5 py-1 rounded-lg border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 font-medium"
                    >
                      Criar filtro automático
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowFilterPanel(false)}
                      className="bg-blue-600 text-white text-xs px-3 py-1 rounded-lg font-medium"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Folders & Labels Strip */}
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar px-4 py-2">
              {primaryFolders.map((folder) => {
                const Icon = folder.icon;
                const active = mailFolder === folder.id;
                return (
                  <button
                    type="button"
                    key={folder.id}
                    onClick={() => {
                      setMailFolder(folder.id);
                      setSelectedEmailIds(new Set());
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap border ${
                      active
                        ? isDarkMode
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                        : isDarkMode
                        ? 'text-white/60 border-transparent hover:bg-white/5'
                        : 'text-gray-600 border-transparent hover:bg-gray-100'
                    }`}
                  >
                    <Icon size={13} />
                    <span>{folder.label}</span>
                    {folder.badge > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          active ? 'bg-blue-500 text-white' : isDarkMode ? 'bg-white/10 text-white/70' : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {folder.badge}
                      </span>
                    )}
                  </button>
                );
              })}

              <div className={`w-[1px] h-5 mx-1 shrink-0 ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`} />

              {/* Custom Labels */}
              {customLabels.map((lbl) => (
                <div
                  key={lbl.id}
                  className={`flex items-center rounded-full border transition-all whitespace-nowrap ${
                    mailFolder === lbl.id
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      : isDarkMode
                      ? 'text-white/65 border-white/10 hover:bg-white/5'
                      : 'text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setMailFolder(lbl.id)}
                    className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 text-xs font-medium min-h-[28px]"
                  >
                    <Tag size={12} className={lbl.colorClass} />
                    <span>{lbl.name}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Excluir marcador ${lbl.name}`}
                    title={`Excluir marcador ${lbl.name}`}
                    onClick={(e) => handleDeleteLabel(lbl.id, e)}
                    className="pr-2 pl-0.5 py-1 opacity-50 hover:opacity-100 hover:text-rose-400 transition-opacity"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}

              {isCreatingLabel ? (
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="text"
                    placeholder="Novo marcador..."
                    value={newLabelName}
                    onChange={(e) => setNewLabelName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateLabel()}
                    className={`w-28 px-2 py-1 rounded-lg text-xs border outline-none ${
                      isDarkMode ? 'bg-black/30 border-white/15 text-white' : 'bg-white border-gray-300 text-gray-800'
                    }`}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleCreateLabel}
                    className="p-1 bg-blue-600 text-white rounded-md text-xs"
                  >
                    <Check size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreatingLabel(false)}
                    className="p-1 opacity-60 hover:opacity-100"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsCreatingLabel(true)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs whitespace-nowrap border border-dashed ${
                    isDarkMode ? 'border-white/15 text-white/60 hover:text-white' : 'border-gray-300 text-gray-600'
                  }`}
                >
                  <Plus size={12} /> Marcador
                </button>
              )}
            </div>

            {/* Inbox Category Tabs (Primary, Promotions, Social, Updates) */}
            {mailFolder === 'inbox' && (
              <div className={`flex items-center border-t px-3 sm:px-4 overflow-x-auto custom-scrollbar gap-1 ${isDarkMode ? 'border-white/5' : 'border-gray-100'}`}>
                {[
                  { id: 'all', label: 'Todas', count: categoryCounts.all },
                  { id: 'primary', label: 'Principal', count: categoryCounts.primary },
                  { id: 'promotions', label: 'Promoções', count: categoryCounts.promotions },
                  { id: 'social', label: 'Social', count: categoryCounts.social },
                  { id: 'updates', label: 'Atualizações', count: categoryCounts.updates },
                ].map((cat) => {
                  const active = inboxCategory === cat.id;
                  return (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => setInboxCategory(cat.id as InboxCategory)}
                      className={`flex-1 min-w-fit px-2 py-2 text-xs font-medium border-b-2 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                        active
                          ? 'border-blue-500 text-blue-400 font-semibold'
                          : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <span>{cat.label}</span>
                      {cat.count > 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-400">
                          {cat.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* List Action Bar (Select All, Mark All Read, Density, Batch Toolbar) */}
            <div
              className={`flex items-center justify-between px-4 py-2 border-t text-xs ${
                isDarkMode ? 'border-white/5 bg-white/[0.02]' : 'border-gray-100 bg-gray-50/80'
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                    displayedEmails.length > 0 && selectedEmailIds.size === displayedEmails.length
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : isDarkMode
                      ? 'border-white/30 hover:border-white/60'
                      : 'border-gray-400'
                  }`}
                  title="Selecionar todos da lista"
                >
                  {displayedEmails.length > 0 && selectedEmailIds.size === displayedEmails.length && (
                    <Check size={11} strokeWidth={3} />
                  )}
                </button>

                {selectedEmailIds.size > 0 ? (
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-blue-400 mr-1">{selectedEmailIds.size} sel.</span>
                    <button
                      type="button"
                      onClick={() => handleBatchAction('archive')}
                      className="p-1.5 rounded hover:bg-white/10"
                      title="Arquivar selecionados"
                    >
                      <Archive size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBatchAction('spam')}
                      className="p-1.5 rounded hover:bg-white/10"
                      title="Denunciar Spam"
                    >
                      <AlertOctagon size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBatchAction('trash')}
                      className="p-1.5 rounded hover:bg-white/10 text-rose-400"
                      title="Excluir selecionados"
                    >
                      <Trash2 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBatchAction('read')}
                      className="p-1.5 rounded hover:bg-white/10"
                      title="Marcar como lidos"
                    >
                      <MailOpen size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBatchAction('star')}
                      className="p-1.5 rounded hover:bg-white/10 text-amber-400"
                      title="Adicionar estrela"
                    >
                      <Star size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBatchAction('mute')}
                      className="p-1.5 rounded hover:bg-white/10"
                      title="Silenciar conversas"
                    >
                      <VolumeX size={14} />
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowBatchLabelMenu(!showBatchLabelMenu)}
                        className="p-1.5 rounded hover:bg-white/10"
                        title="Aplicar marcador"
                      >
                        <Tag size={14} />
                      </button>
                      {showBatchLabelMenu && (
                        <div
                          className={`absolute top-full left-0 mt-1 w-44 rounded-xl border shadow-xl z-50 py-1.5 ${
                            isDarkMode ? 'bg-[#2d2e30] border-white/10 text-white' : 'bg-white border-gray-200 text-gray-800'
                          }`}
                        >
                          {customLabels.map((lbl) => (
                            <button
                              type="button"
                              key={lbl.id}
                              onClick={() => handleBatchAction('add_label', { labelId: lbl.id })}
                              className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2"
                            >
                              <Tag size={12} className={lbl.colorClass} />
                              <span>{lbl.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleMarkAllAsRead}
                      className="opacity-70 hover:opacity-100 flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/5"
                      title="Marcar todas como lidas"
                    >
                      <MailOpen size={13} /> Marcar lidas
                    </button>
                    {(mailFolder === 'trash' || mailFolder === 'spam') && displayedEmails.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleEmptyFolder(mailFolder as 'trash' | 'spam')}
                        className="text-rose-400 hover:underline font-medium flex items-center gap-1"
                      >
                        <Trash2 size={12} />
                        {mailFolder === 'trash' ? 'Esvaziar lixeira agora' : 'Excluir todos os spams'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <span className="opacity-50 text-[11px]">{displayedEmails.length} conversa(s)</span>
                <select
                  aria-label="Densidade da lista"
                  value={mailSettings.density}
                  onChange={(e) =>
                    setMailSettings({
                      ...mailSettings,
                      density: e.target.value as 'default' | 'comfortable' | 'compact',
                    })
                  }
                  className={`text-[11px] rounded px-1.5 py-0.5 border outline-none ${
                    isDarkMode ? 'bg-white/5 border-white/10 text-white/80' : 'bg-white border-gray-200 text-gray-700'
                  }`}
                >
                  <option value="default">Padrão</option>
                  <option value="comfortable">Confortável</option>
                  <option value="compact">Compacta</option>
                </select>
              </div>
            </div>
          </div>

          {/* Email List Items */}
          <div className={`flex-1 overflow-y-auto custom-scrollbar p-3 ${isDarkMode ? 'bg-[#191919]' : 'bg-gray-50/60'}`}>
            <div className="flex flex-col gap-1.5">
              {displayedEmails.map((email) => {
                const isSelected = selectedEmailIds.has(String(email.id));
                const isActive = String(activeEmailId) === String(email.id);
                return (
                  <div
                    key={email.id}
                    onClick={() => handleEmailClick(email)}
                    className={`group relative rounded-2xl transition-all duration-150 ${densityPadding} flex items-start gap-3 cursor-pointer border ${
                      isActive
                        ? isDarkMode
                          ? 'bg-blue-500/15 border-blue-500/40'
                          : 'bg-blue-50/90 border-blue-300'
                        : !email.read
                        ? isDarkMode
                          ? 'bg-white/10 border-l-4 border-l-blue-500 border-white/5'
                          : 'bg-white border-l-4 border-l-blue-600 border-gray-200 shadow-xs'
                        : isDarkMode
                        ? 'bg-white/[0.04] border-transparent hover:bg-[#252628]'
                        : 'bg-white/75 border-gray-100 hover:bg-white'
                    }`}
                  >
                    {/* Left controls: Checkbox + Star + Important */}
                    <div className="flex flex-col items-center gap-1.5 pt-0.5 shrink-0">
                      <button
                        type="button"
                        aria-label={`Selecionar ${email.subject}`}
                        onClick={(e) => handleEmailSelection(e, String(email.id))}
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-blue-500 border-blue-500 text-white'
                            : isDarkMode
                            ? 'border-white/25 hover:border-white/60'
                            : 'border-gray-300 hover:border-gray-500'
                        }`}
                      >
                        {isSelected && <Check size={11} strokeWidth={3} />}
                      </button>

                      <button
                        type="button"
                        aria-label={email.isStarred ? 'Remover estrela' : 'Adicionar estrela'}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSingleEmailAction(String(email.id), email.isStarred ? 'unstar' : 'star');
                        }}
                        className={`transition-transform hover:scale-110 ${
                          email.isStarred
                            ? 'text-amber-400'
                            : isDarkMode
                            ? 'text-white/25 hover:text-amber-300'
                            : 'text-gray-300 hover:text-amber-400'
                        }`}
                      >
                        <Star size={14} fill={email.isStarred ? 'currentColor' : 'none'} />
                      </button>
                    </div>

                    {/* Avatar */}
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                        email.color || 'bg-blue-600'
                      }`}
                    >
                      {email.senderInit || email.sender[0]}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5 gap-2">
                        <div className="flex items-center gap-1.5 truncate">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSingleEmailAction(
                                String(email.id),
                                email.isImportant ? 'unimportant' : 'important'
                              );
                            }}
                            title={email.isImportant ? 'Importante' : 'Marcar como importante'}
                            className={email.isImportant ? 'text-amber-400' : 'opacity-25 hover:opacity-80'}
                          >
                            <Bookmark size={12} fill={email.isImportant ? 'currentColor' : 'none'} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSingleEmailAction(String(email.id), email.isPinned ? 'unpin' : 'pin');
                            }}
                            title={email.isPinned ? 'Desafixar do topo' : 'Fixar no topo'}
                            className={email.isPinned ? 'text-blue-400' : 'opacity-20 hover:opacity-80'}
                          >
                            <Pin size={11} />
                          </button>
                          <span
                            className={`text-xs truncate ${
                              !email.read
                                ? isDarkMode
                                  ? 'text-white font-bold'
                                  : 'text-gray-900 font-bold'
                                : isDarkMode
                                ? 'text-white/75 font-medium'
                                : 'text-gray-700 font-medium'
                            }`}
                          >
                            {email.sender}
                          </span>
                          {email.messages && email.messages.length > 1 && (
                            <span className="text-[10px] opacity-50 font-semibold">({email.messages.length})</span>
                          )}
                          {email.isMuted && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-gray-500/20 text-gray-400">
                              Silenciado
                            </span>
                          )}
                        </div>

                        {/* Time or Hover Quick Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <div className="hidden group-hover:flex items-center gap-1 bg-black/40 backdrop-blur-md px-1.5 py-0.5 rounded-lg">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSingleEmailAction(String(email.id), 'archive');
                              }}
                              className="p-1 hover:text-blue-400"
                              title="Arquivar"
                            >
                              <Archive size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSingleEmailAction(String(email.id), 'trash');
                              }}
                              className="p-1 hover:text-rose-400"
                              title="Excluir"
                            >
                              <Trash2 size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSingleEmailAction(String(email.id), email.read ? 'unread' : 'read');
                              }}
                              className="p-1 hover:text-blue-400"
                              title={email.read ? 'Marcar como não lida' : 'Marcar como lida'}
                            >
                              <MailOpen size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCreateTaskFromEmail(email);
                              }}
                              className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-semibold flex items-center gap-1"
                              title="Adicionar às Tarefas"
                            >
                              <CheckSquare size={10} /> +Tarefa
                            </button>
                          </div>

                          {email.snoozedUntil ? (
                            <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-1">
                              <Clock size={10} /> {email.snoozedUntil}
                            </span>
                          ) : email.scheduledFor ? (
                            <span className="text-[10px] text-blue-400 font-semibold flex items-center gap-1">
                              <CalendarClock size={10} /> {email.scheduledFor}
                            </span>
                          ) : (
                            <span className={`text-[10px] group-hover:hidden ${isDarkMode ? 'text-white/45' : 'text-gray-400'}`}>
                              {email.time}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 mb-0.5">
                        {email.labels?.map((l) => {
                          const found = customLabels.find((c) => c.id === l);
                          return (
                            <span
                              key={l}
                              className={`text-[9px] px-1.5 py-0.2 rounded font-medium ${
                                isDarkMode ? 'bg-white/10 text-white/75' : 'bg-blue-50 text-blue-700'
                              }`}
                            >
                              {found ? found.name : l}
                            </span>
                          );
                        })}
                        <h4
                          className={`text-xs truncate flex-1 ${
                            !email.read
                              ? isDarkMode
                                ? 'text-white font-bold'
                                : 'text-gray-900 font-bold'
                              : isDarkMode
                              ? 'text-white/75 font-medium'
                              : 'text-gray-600 font-medium'
                          }`}
                        >
                          {email.subject}
                        </h4>
                      </div>

                      {mailSettings.density !== 'compact' && (
                        <p className={`text-[11px] truncate ${isDarkMode ? 'text-white/45' : 'text-gray-500'}`}>
                          {email.preview}
                        </p>
                      )}

                      {/* Attachment chips in Default density */}
                      {mailSettings.density === 'default' && email.attachments && email.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {email.attachments.map((att, idx) => (
                            <span
                              key={idx}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadAttachment(String(email.id), att.id || idx, att.name);
                              }}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
                                isDarkMode
                                  ? 'bg-white/5 border-white/10 text-white/70 hover:bg-white/15'
                                  : 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              <PaperclipIcon size={10} />
                              <span className="truncate max-w-[140px]">{att.name}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {displayedEmails.length === 0 && (
                <div className={`flex flex-col items-center justify-center h-64 ${isDarkMode ? 'text-white/35' : 'text-gray-400'}`}>
                  <Mail size={34} className="mb-2 opacity-40" />
                  <p className="text-xs font-medium">Nenhuma conversa encontrada nesta visualização</p>
                  {(localSearch || filterCriteria.from || filterCriteria.subject || filterCriteria.hasAttachment || filterCriteria.unreadOnly) && (
                    <button
                      type="button"
                      onClick={() => {
                        setLocalSearch('');
                        setFilterCriteria({ from: '', to: '', subject: '', hasAttachment: false, unreadOnly: false });
                      }}
                      className="mt-2 text-blue-400 text-xs hover:underline"
                    >
                      Limpar filtros de pesquisa
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Reading Pane, Composer, Agenda, Tasks, Keep, Settings */}
        <div
          className={`${
            mobileView === 'list' ? 'hidden lg:flex' : 'flex'
          } flex-1 w-full lg:w-auto flex-col rounded-[20px] sm:rounded-[24px] border overflow-hidden relative shadow-sm ${
            isDarkMode ? 'bg-[#1E1E1E] border-white/5' : 'bg-white border-gray-200'
          }`}
        >
          {/* Top Navigation Tabs of Right Panel */}
          <div
            className={`min-h-[52px] flex items-center gap-2 px-3 sm:px-4 py-2 border-b shrink-0 z-20 relative ${
              isDarkMode ? 'border-white/5 bg-[#1E1E1E]' : 'border-gray-100 bg-white'
            }`}
          >
            <button
              type="button"
              onClick={() => setMobileView('list')}
              aria-label="Voltar para lista de e-mails"
              className={`lg:hidden shrink-0 px-2.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 min-h-[32px] border ${
                isDarkMode
                  ? 'bg-white/5 border-white/10 text-white/85 hover:bg-white/10'
                  : 'bg-gray-100 border-gray-200 text-gray-800 hover:bg-gray-200'
              }`}
            >
              <ChevronLeft size={14} /> Voltar
            </button>
            <div
              className={`flex backdrop-blur-xl border p-1 rounded-full h-9 items-center gap-1 flex-1 overflow-x-auto custom-scrollbar ${
                isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-100 border-gray-200'
              }`}
            >
              {[
                { id: 'email', label: 'Leitura', icon: GoogleIcons.Gmail },
                { id: 'compose', label: 'Escrever', icon: null },
                { id: 'agenda', label: 'Agenda', icon: GoogleIcons.Calendar },
                { id: 'tasks', label: 'Tasks', icon: GoogleIcons.Tasks },
                { id: 'keep', label: 'Keep', icon: GoogleIcons.Keep },
                { id: 'settings', label: 'Config', icon: null },
              ].map((tab) => {
                const IconComp = tab.icon;
                const isActive = activePane === tab.id;
                return (
                  <button
                    type="button"
                    key={tab.id}
                    onClick={() =>
                      setActivePane(
                        tab.id as 'agenda' | 'email' | 'compose' | 'tasks' | 'keep' | 'event-create' | 'settings'
                      )
                    }
                    className={`flex-1 min-w-fit px-2.5 h-full rounded-full text-xs font-medium transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                      isActive
                        ? isDarkMode
                          ? 'bg-white/15 text-white shadow-xs border border-white/10'
                          : 'bg-white text-gray-900 shadow-xs border border-gray-200'
                        : isDarkMode
                        ? 'text-white/50 hover:text-white'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    {IconComp ? <IconComp className="w-3.5 h-3.5 shrink-0" /> : null}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 1. EMAIL READING PANE */}
          {activePane === 'email' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {activeEmail ? (
                <div className="flex flex-col h-full">
                  {/* Thread Header & Action Toolbar */}
                  <div className={`px-4 sm:px-6 py-3.5 border-b shrink-0 space-y-2.5 ${isDarkMode ? 'border-white/5' : 'border-gray-100'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <h2 className={`text-sm sm:text-base font-bold truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {activeEmail.subject}
                        </h2>
                        {activeEmail.labels?.map((l) => {
                          const found = customLabels.find((c) => c.id === l);
                          return (
                            <span
                              key={l}
                              className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                                isDarkMode
                                  ? 'bg-white/10 text-white/80 border-white/10'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}
                            >
                              {found ? found.name : l}
                              <button
                                type="button"
                                onClick={() =>
                                  handleSingleEmailAction(String(activeEmail.id), 'remove_label', { labelId: l })
                                }
                                className="hover:text-rose-400"
                              >
                                <X size={10} />
                              </button>
                            </span>
                          );
                        })}
                      </div>

                      {/* Right side of Subject Header: Prev/Next Thread Navigation + Star */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {displayedEmails.length > 0 && activeEmailIndex !== -1 && (
                          <div className="flex items-center gap-1 mr-1 text-[11px] opacity-75">
                            <span>
                              {activeEmailIndex + 1} de {displayedEmails.length}
                            </span>
                            <button
                              type="button"
                              aria-label="Conversa anterior"
                              disabled={activeEmailIndex <= 0}
                              onClick={() => handleNavigateThread('prev')}
                              className="p-1 rounded hover:bg-white/10 disabled:opacity-30"
                              title="Conversa anterior (k)"
                            >
                              <ChevronLeft size={14} />
                            </button>
                            <button
                              type="button"
                              aria-label="Próxima conversa"
                              disabled={activeEmailIndex >= displayedEmails.length - 1}
                              onClick={() => handleNavigateThread('next')}
                              className="p-1 rounded hover:bg-white/10 disabled:opacity-30"
                              title="Próxima conversa (j)"
                            >
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            handleSingleEmailAction(
                              String(activeEmail.id),
                              activeEmail.isStarred ? 'unstar' : 'star'
                            )
                          }
                          className={activeEmail.isStarred ? 'text-amber-400' : 'opacity-40 hover:opacity-100'}
                          title="Com estrela (s)"
                        >
                          <Star size={17} fill={activeEmail.isStarred ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                    </div>

                    {/* Reading Action Buttons Bar */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleSingleEmailAction(String(activeEmail.id), 'archive')}
                          className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 transition-colors ${
                            isDarkMode ? 'bg-white/5 hover:bg-white/10 text-white/80' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          }`}
                          title="Arquivar conversa"
                        >
                          <Archive size={13} /> Arquivar
                        </button>

                        {activeEmail.folder === 'trash' || activeEmail.folder === 'spam' ? (
                          <div className="flex items-center gap-1 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleSingleEmailAction(String(activeEmail.id), 'restore')}
                              className="px-2.5 py-1 rounded-lg text-xs bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 flex items-center gap-1 min-h-[28px]"
                            >
                              <RotateCcw size={13} /> Mover para Entrada
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSingleEmailAction(String(activeEmail.id), 'delete_forever')}
                              className="px-2.5 py-1 rounded-lg text-xs bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 flex items-center gap-1 min-h-[28px]"
                              title="Excluir definitivamente"
                            >
                              <Trash2 size={13} /> Excluir definitivamente
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSingleEmailAction(String(activeEmail.id), 'spam')}
                              className={`p-1.5 rounded-lg transition-colors ${
                                isDarkMode ? 'hover:bg-white/10 text-white/70' : 'hover:bg-gray-100 text-gray-600'
                              }`}
                              title="Denunciar Spam"
                            >
                              <AlertOctagon size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSingleEmailAction(String(activeEmail.id), 'trash')}
                              className={`p-1.5 rounded-lg hover:text-rose-400 transition-colors ${
                                isDarkMode ? 'hover:bg-white/10 text-white/70' : 'hover:bg-gray-100 text-gray-600'
                              }`}
                              title="Mover para Lixeira"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => handleSingleEmailAction(String(activeEmail.id), 'unread')}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isDarkMode ? 'hover:bg-white/10 text-white/70' : 'hover:bg-gray-100 text-gray-600'
                          }`}
                          title="Marcar como não lida"
                        >
                          <MailOpen size={14} />
                        </button>

                        {/* Snooze dropdown */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowSnoozeMenu(!showSnoozeMenu)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isDarkMode ? 'hover:bg-white/10 text-white/70' : 'hover:bg-gray-100 text-gray-600'
                            }`}
                            title="Adiar conversa"
                          >
                            <Clock size={14} />
                          </button>
                          {showSnoozeMenu && (
                            <div
                              className={`absolute top-full left-0 mt-1 w-52 border rounded-xl shadow-2xl z-50 py-1.5 ${
                                isDarkMode ? 'bg-[#2d2e30] border-white/10 text-white' : 'bg-white border-gray-200 text-gray-800'
                              }`}
                            >
                              <div className="px-3 py-1 text-[10px] font-bold uppercase opacity-50">Adiar até...</div>
                              <button
                                type="button"
                                onClick={() => handleSnooze('today')}
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 flex justify-between"
                              >
                                <span>Hoje mais tarde</span>
                                <span className="opacity-50">18:00</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSnooze('tomorrow')}
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 flex justify-between"
                              >
                                <span>Amanhã</span>
                                <span className="opacity-50">08:00</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSnooze('nextWeek')}
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 flex justify-between"
                              >
                                <span>Próxima semana</span>
                                <span className="opacity-50">Seg 08:00</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Labels Dropdown */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowLabelMenu(!showLabelMenu)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isDarkMode ? 'hover:bg-white/10 text-white/70' : 'hover:bg-gray-100 text-gray-600'
                            }`}
                            title="Gerenciar Marcadores"
                          >
                            <Tag size={14} />
                          </button>
                          {showLabelMenu && (
                            <div
                              className={`absolute top-full left-0 mt-1 w-48 border rounded-xl shadow-2xl z-50 py-1.5 ${
                                isDarkMode ? 'bg-[#2d2e30] border-white/10 text-white' : 'bg-white border-gray-200 text-gray-800'
                              }`}
                            >
                              <div className="px-3 py-1 text-[10px] font-bold uppercase opacity-50">Marcadores</div>
                              {customLabels.map((lbl) => {
                                const hasLbl = (activeEmail.labels || []).includes(lbl.id);
                                return (
                                  <button
                                    type="button"
                                    key={lbl.id}
                                    onClick={() => {
                                      handleSingleEmailAction(
                                        String(activeEmail.id),
                                        hasLbl ? 'remove_label' : 'add_label',
                                        { labelId: lbl.id }
                                      );
                                      setShowLabelMenu(false);
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 flex items-center justify-between"
                                  >
                                    <span className="flex items-center gap-2">
                                      <Tag size={12} className={lbl.colorClass} /> {lbl.name}
                                    </span>
                                    {hasLbl && <Check size={12} className="text-blue-400" />}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Mute / Unmute Thread */}
                        <button
                          type="button"
                          onClick={() =>
                            handleSingleEmailAction(
                              String(activeEmail.id),
                              activeEmail.isMuted ? 'unmute' : 'mute'
                            )
                          }
                          className={`p-1.5 rounded-lg transition-colors ${
                            activeEmail.isMuted
                              ? 'bg-amber-500/20 text-amber-400'
                              : isDarkMode
                              ? 'hover:bg-white/10 text-white/70'
                              : 'hover:bg-gray-100 text-gray-600'
                          }`}
                          title={activeEmail.isMuted ? 'Reativar conversa (m)' : 'Silenciar conversa (m)'}
                        >
                          <VolumeX size={14} />
                        </button>

                        {/* Add to Tasks */}
                        <button
                          type="button"
                          onClick={() => handleCreateTaskFromEmail(activeEmail)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 whitespace-nowrap min-h-[28px] ${
                            isDarkMode
                              ? 'bg-blue-500/15 text-blue-300 hover:bg-blue-500/25'
                              : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                          }`}
                          title="Adicionar às Tarefas"
                        >
                          <CheckSquare size={13} /> + Tarefa
                        </button>
                      </div>

                      {/* Right Tools: Expand/Collapse, AI Summary, Translate, Print */}
                      <div className="flex items-center gap-1 flex-wrap">
                        {activeThreadMessages.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (collapsedMsgIds.size > 0) {
                                setCollapsedMsgIds(new Set());
                              } else {
                                setCollapsedMsgIds(
                                  new Set(activeThreadMessages.slice(0, -1).map((m) => m.id))
                                );
                              }
                            }}
                            className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 min-h-[28px] ${
                              isDarkMode
                                ? 'bg-white/5 hover:bg-white/10 text-white/75'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            }`}
                            title={collapsedMsgIds.size > 0 ? 'Expandir todas as mensagens' : 'Recolher mensagens anteriores'}
                          >
                            {collapsedMsgIds.size > 0 ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                            <span>{collapsedMsgIds.size > 0 ? 'Expandir tudo' : 'Recolher'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleSummarizeThread}
                          disabled={isSummarizing}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 min-h-[28px] ${
                            isDarkMode
                              ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30'
                              : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
                          }`}
                          title="Resumir conversa"
                        >
                          <Sparkles size={12} /> {isSummarizing ? 'Resumindo...' : 'Resumir'}
                        </button>
                        <button
                          type="button"
                          onClick={handleTranslateThread}
                          disabled={isTranslating}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 min-h-[28px] ${
                            Object.keys(translatedBodyMap).length > 0
                              ? 'bg-blue-600 text-white'
                              : isDarkMode
                              ? 'bg-white/5 hover:bg-white/10 text-white/75'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          }`}
                          title="Traduzir mensagem"
                        >
                          <Globe size={12} /> Traduzir
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowPrintModal(true)}
                          className={`p-1.5 rounded-lg min-h-[28px] ${
                            isDarkMode ? 'hover:bg-white/10 text-white/70' : 'hover:bg-gray-100 text-gray-600'
                          }`}
                          title="Imprimir / Exportar conversa"
                          aria-label="Imprimir ou exportar conversa"
                        >
                          <Printer size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Scheduled Email Banner */}
                  {activeEmail.folder === 'scheduled' && (
                    <div
                      className={`mx-6 mt-3 p-3 rounded-xl border flex items-center justify-between text-xs ${
                        isDarkMode
                          ? 'bg-blue-500/15 border-blue-500/30 text-blue-200'
                          : 'bg-blue-50 border-blue-200 text-blue-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <CalendarClock size={15} />
                        <span>
                          Envio agendado para <strong>{activeEmail.scheduledFor || 'Amanhã, 08:00'}</strong>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCancelScheduledSend(activeEmail)}
                        className="px-3 py-1 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500"
                      >
                        Cancelar envio
                      </button>
                    </div>
                  )}

                  {/* AI Thread Summary Card */}
                  {threadSummary && (
                    <div
                      className={`mx-6 mt-3 p-3.5 rounded-xl border text-xs space-y-1.5 ${
                        isDarkMode
                          ? 'bg-purple-500/15 border-purple-500/30 text-purple-100'
                          : 'bg-purple-50/90 border-purple-200 text-purple-950'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`font-bold flex items-center gap-1.5 ${
                            isDarkMode ? 'text-purple-300' : 'text-purple-800'
                          }`}
                        >
                          <Sparkles size={13} /> Resumo Inteligente da Conversa
                        </span>
                        <button type="button" onClick={() => setThreadSummary(null)} className="opacity-60 hover:opacity-100">
                          <X size={13} />
                        </button>
                      </div>
                      <p className="whitespace-pre-line leading-relaxed">{threadSummary}</p>
                    </div>
                  )}

                  {/* Thread Messages Scroll Area */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4">
                    {loadingThread ? (
                      <div className="flex items-center justify-center h-40">
                        <Loader2 size={28} className="text-blue-500 animate-spin" />
                      </div>
                    ) : (
                      <>
                        {activeThreadMessages.map((msg, i) => {
                          const isCollapsed = collapsedMsgIds.has(msg.id) && i < activeThreadMessages.length - 1;
                          return (
                            <div
                              key={msg.id || i}
                              className={`rounded-2xl border transition-all ${
                                isDarkMode ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-gray-50/60'
                              }`}
                            >
                              <div
                                onClick={() => {
                                  if (i < activeThreadMessages.length - 1) {
                                    const next = new Set(collapsedMsgIds);
                                    if (next.has(msg.id)) next.delete(msg.id);
                                    else next.add(msg.id);
                                    setCollapsedMsgIds(next);
                                  }
                                }}
                                className="flex items-center justify-between gap-2 p-3.5 sm:p-4 cursor-pointer"
                              >
                                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-blue-600 shrink-0">
                                    {msg.senderInit || msg.from[0]}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className={`text-xs font-bold truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                        {msg.from}
                                      </span>
                                      {msg.fromEmail && (
                                        <span className="hidden sm:inline text-[11px] opacity-45 truncate">&lt;{msg.fromEmail}&gt;</span>
                                      )}
                                    </div>
                                    <span className="text-[11px] opacity-50 block truncate">
                                      para {msg.to}
                                      {msg.cc ? ` · Cc: ${msg.cc}` : ''}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[11px] opacity-50">{msg.date}</span>
                                  {i < activeThreadMessages.length - 1 &&
                                    (isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />)}
                                </div>
                              </div>

                              {!isCollapsed && (
                                <div className="px-4 pb-4 pt-1 border-t border-white/5">
                                  <div
                                    className={`text-xs leading-relaxed whitespace-pre-wrap ${
                                      isDarkMode ? 'text-white/90' : 'text-gray-800'
                                    }`}
                                    dangerouslySetInnerHTML={{
                                      __html: sanitizeHtml(translatedBodyMap[msg.id] || msg.body || msg.plainBody || ''),
                                    }}
                                  />
                                  {msg.attachments && msg.attachments.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-white/5">
                                      {msg.attachments.map((att, idx) => (
                                        <button
                                          type="button"
                                          key={idx}
                                          onClick={() => handleDownloadAttachment(msg.id, att.id || idx, att.name)}
                                          className={`rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs border transition-colors ${
                                            isDarkMode
                                              ? 'bg-white/10 hover:bg-white/15 text-white border-white/10'
                                              : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-200'
                                          }`}
                                        >
                                          <Download size={12} className="text-blue-400" />
                                          <span>{att.name}</span>
                                          <span className="opacity-50">({att.size})</span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Smart Replies Chips */}
                        {smartReplies.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-2">
                            {smartReplies.map((replyText, idx) => (
                              <button
                                type="button"
                                key={idx}
                                onClick={() => setQuickReplyText(replyText)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 ${
                                  isDarkMode
                                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/20'
                                    : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                                }`}
                              >
                                <Sparkles size={11} />
                                {replyText}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Action Buttons: Reply, Reply All, Forward */}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleReply(false)}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 ${
                              isDarkMode ? 'border-white/15 hover:bg-white/10' : 'border-gray-300 hover:bg-gray-100'
                            }`}
                          >
                            <Reply size={13} /> Responder
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReply(true)}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 ${
                              isDarkMode ? 'border-white/15 hover:bg-white/10' : 'border-gray-300 hover:bg-gray-100'
                            }`}
                          >
                            <ReplyAll size={13} /> Responder a todos
                          </button>
                          <button
                            type="button"
                            onClick={handleForward}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 ${
                              isDarkMode ? 'border-white/15 hover:bg-white/10' : 'border-gray-300 hover:bg-gray-100'
                            }`}
                          >
                            <Forward size={13} /> Encaminhar
                          </button>
                        </div>

                        {/* Inline Quick Reply Box */}
                        <div
                          className={`border rounded-2xl p-3.5 flex flex-col gap-2.5 ${
                            isDarkMode ? 'bg-black/20 border-white/10' : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <textarea
                            className={`w-full bg-transparent text-xs outline-none resize-none min-h-[54px] ${
                              isDarkMode ? 'text-white placeholder:text-white/40' : 'text-gray-800 placeholder:text-gray-400'
                            }`}
                            placeholder={`Resposta rápida para ${activeEmail.sender}...`}
                            value={quickReplyText}
                            onChange={(e) => setQuickReplyText(e.target.value)}
                          />
                          <div className="flex justify-between items-center pt-2 border-t border-white/5">
                            <span className="text-[10px] opacity-45">
                              Dica: clique em uma sugestão acima ou digite sua resposta
                            </span>
                            <button
                              type="button"
                              onClick={() => handleQuickReply()}
                              disabled={!quickReplyText.trim() || isQuickReplying}
                              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all"
                            >
                              <Send size={12} /> Enviar Resposta
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className={`flex flex-col items-center justify-center h-full ${isDarkMode ? 'text-white/30' : 'text-gray-400'}`}>
                  <Mail size={42} className="mb-3 opacity-40" />
                  <p className="text-xs">Selecione uma conversa à esquerda para leitura</p>
                </div>
              )}
            </div>
          )}

          {/* 2. COMPOSER PANE */}
          {activePane === 'compose' && (
            <div className="flex-1 flex flex-col p-5 overflow-y-auto custom-scrollbar relative">
              {showAiWriter && (
                <div
                  className={`mb-3 border rounded-2xl shadow-xl p-3.5 z-40 ${
                    isDarkMode ? 'bg-[#2d2e30] border-white/15' : 'bg-blue-50/70 border-blue-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold flex items-center gap-1.5 text-blue-400">
                      <Sparkles size={14} /> Help me write (Assistente de Redação)
                    </span>
                    <button type="button" onClick={() => setShowAiWriter(false)}>
                      <X size={13} />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ex: Confirme a reunião de resultados de sexta às 14h..."
                      value={aiWritePrompt}
                      onChange={(e) => setAiWritePrompt(e.target.value)}
                      className={`flex-1 rounded-xl px-3 py-1.5 text-xs border outline-none ${
                        isDarkMode ? 'bg-black/30 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-800'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={handleAiWrite}
                      disabled={!aiWritePrompt.trim() || isAiWriting}
                      className="px-3.5 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Wand2 size={12} /> Gerar
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold">Nova Mensagem</h2>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsComposerMinimized(true);
                      setActivePane('email');
                    }}
                    className="p-1.5 rounded-lg hover:bg-white/10"
                    title="Minimizar para barra flutuante"
                  >
                    <Minimize2 size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseComposer}
                    className="p-1.5 rounded-lg hover:bg-white/10"
                    title="Salvar rascunho e fechar"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Confidential Mode Banner */}
              {confidentialMode.enabled && (
                <div
                  className={`mb-3 p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                    isDarkMode
                      ? 'bg-blue-500/15 border-blue-500/30 text-blue-200'
                      : 'bg-blue-50 border-blue-200 text-blue-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Lock size={14} />
                    <span>
                      <strong>Modo Confidencial Ativo:</strong> Expira em {confidentialMode.expires}
                    </span>
                  </div>
                  <select
                    value={confidentialMode.expires}
                    onChange={(e) => setConfidentialMode({ ...confidentialMode, expires: e.target.value })}
                    className={`border rounded px-2 py-0.5 text-[11px] font-medium ${
                      isDarkMode ? 'bg-black/30 border-white/15 text-white' : 'bg-white border-blue-300 text-blue-900'
                    }`}
                  >
                    <option value="1 dia">Expira em 1 dia</option>
                    <option value="1 semana">Expira em 1 semana</option>
                    <option value="1 mês">Expira em 1 mês</option>
                  </select>
                </div>
              )}

              <div className="space-y-1.5 mb-3">
                <div className={`flex items-center border-b pr-2 ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
                  <span className="text-xs opacity-50 w-12 shrink-0">Para</span>
                  <ContactInput
                    placeholder="Destinatário (digite nome ou e-mail)"
                    value={composeTo}
                    onChange={setComposeTo}
                    isDarkMode={isDarkMode}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCcBcc(!showCcBcc)}
                    className="text-xs opacity-60 hover:opacity-100 px-2 whitespace-nowrap shrink-0"
                  >
                    Cc / Cco
                  </button>
                </div>

                {showCcBcc && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className={`flex items-center border-b ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
                      <span className="text-xs opacity-50 w-8">Cc</span>
                      <input
                        type="text"
                        value={composeCc}
                        onChange={(e) => setComposeCc(e.target.value)}
                        className="flex-1 bg-transparent py-1.5 text-xs outline-none"
                      />
                    </div>
                    <div className={`flex items-center border-b ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
                      <span className="text-xs opacity-50 w-10">Cco</span>
                      <input
                        type="text"
                        value={composeBcc}
                        onChange={(e) => setComposeBcc(e.target.value)}
                        className="flex-1 bg-transparent py-1.5 text-xs outline-none"
                      />
                    </div>
                  </div>
                )}

                <div className={`flex items-center border-b ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
                  <span className="text-xs opacity-50 w-14 shrink-0">Assunto</span>
                  <input
                    type="text"
                    placeholder="Assunto da mensagem"
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    className="flex-1 bg-transparent py-2 text-xs outline-none font-medium"
                  />
                </div>
              </div>

              {/* Formatting & Templates Toolbar */}
              <div
                className={`flex items-center gap-1 border-b pb-2 mb-2 flex-wrap ${
                  isDarkMode ? 'border-white/10' : 'border-gray-200'
                }`}
              >
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    document.execCommand('bold');
                  }}
                  className="p-1.5 rounded hover:bg-white/10"
                  title="Negrito"
                >
                  <Bold size={14} />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    document.execCommand('italic');
                  }}
                  className="p-1.5 rounded hover:bg-white/10"
                  title="Itálico"
                >
                  <Italic size={14} />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    document.execCommand('underline');
                  }}
                  className="p-1.5 rounded hover:bg-white/10"
                  title="Sublinhado"
                >
                  <Underline size={14} />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    document.execCommand('insertUnorderedList');
                  }}
                  className="p-1.5 rounded hover:bg-white/10"
                  title="Lista com marcadores"
                >
                  <ListIcon size={14} />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    document.execCommand('insertOrderedList');
                  }}
                  className="p-1.5 rounded hover:bg-white/10"
                  title="Lista numerada"
                >
                  <ListOrdered size={14} />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    document.execCommand('removeFormat');
                  }}
                  className="p-1.5 rounded hover:bg-white/10"
                  title="Limpar formatação"
                >
                  <RemoveFormatting size={14} />
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowLinkPopover((prev) => !prev)}
                    className={`p-1.5 rounded hover:bg-white/10 ${showLinkPopover ? 'bg-blue-500/20 text-blue-400' : ''}`}
                    title="Inserir Link"
                    aria-label="Inserir Link"
                  >
                    <LinkIcon size={14} />
                  </button>
                  {showLinkPopover && (
                    <div
                      className={`absolute top-full left-0 mt-1 p-3 rounded-xl border shadow-2xl z-50 w-64 space-y-2 ${
                        isDarkMode ? 'bg-[#2d2e30] border-white/15 text-white' : 'bg-white border-gray-200 text-gray-800'
                      }`}
                    >
                      <div className="text-[11px] font-bold opacity-70">Inserir link na mensagem</div>
                      <input
                        type="text"
                        placeholder="Texto do link (opcional)"
                        value={linkTextInput}
                        onChange={(e) => setLinkTextInput(e.target.value)}
                        className={`w-full rounded-lg px-2.5 py-1.5 text-xs border outline-none ${
                          isDarkMode ? 'bg-black/30 border-white/15 text-white' : 'bg-gray-50 border-gray-200 text-gray-800'
                        }`}
                      />
                      <input
                        type="url"
                        placeholder="https://exemplo.com"
                        value={linkUrlInput}
                        onChange={(e) => setLinkUrlInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleInsertLink()}
                        className={`w-full rounded-lg px-2.5 py-1.5 text-xs border outline-none ${
                          isDarkMode ? 'bg-black/30 border-white/15 text-white' : 'bg-gray-50 border-gray-200 text-gray-800'
                        }`}
                      />
                      <div className="flex justify-end gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowLinkPopover(false)}
                          className="px-2.5 py-1 rounded-lg text-xs opacity-70 hover:opacity-100"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleInsertLink}
                          className="px-3 py-1 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500"
                        >
                          Inserir
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-1.5 rounded hover:bg-white/10"
                    title="Inserir Emoji"
                  >
                    <Smile size={14} />
                  </button>
                  {showEmojiPicker && (
                    <div
                      className={`absolute top-full left-0 mt-1 p-2 rounded-xl border shadow-2xl z-50 flex gap-1.5 ${
                        isDarkMode ? 'bg-[#2d2e30] border-white/10' : 'bg-white border-gray-200'
                      }`}
                    >
                      {['👍', '🚀', '✅', '🎉', '📊', '🤝', '💡', '🔥'].map((emo) => (
                        <button
                          type="button"
                          key={emo}
                          onClick={() => {
                            if (editorRef.current) {
                              editorRef.current.innerHTML += ` ${emo} `;
                            }
                            setShowEmojiPicker(false);
                          }}
                          className="text-sm hover:scale-125 transition-transform p-1"
                        >
                          {emo}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 border ${
                      isDarkMode
                        ? 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                        : 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <LayoutTemplate size={12} /> Modelos
                  </button>
                  {showTemplateMenu && (
                    <div
                      className={`absolute top-full left-0 mt-1 w-64 border rounded-xl shadow-2xl z-50 py-1.5 ${
                        isDarkMode ? 'bg-[#2d2e30] border-white/10 text-white' : 'bg-white border-gray-200 text-gray-800'
                      }`}
                    >
                      <div className="px-3 py-1 text-[10px] font-bold uppercase opacity-50">Respostas Prontas</div>
                      {templates.map((tpl) => (
                        <button
                          type="button"
                          key={tpl.id}
                          onClick={() => handleApplyTemplate(tpl)}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-500/10 truncate"
                        >
                          {tpl.title}
                        </button>
                      ))}
                      <div className="border-t border-white/10 mt-1 pt-1">
                        <button
                          type="button"
                          onClick={handleSaveCurrentDraftAsTemplate}
                          className="w-full text-left px-3 py-1.5 text-xs text-blue-400 font-semibold hover:bg-blue-500/10 flex items-center gap-1.5"
                        >
                          <Plus size={12} /> Salvar rascunho como modelo
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setConfidentialMode((c) => ({ ...c, enabled: !c.enabled }))}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 border ${
                    confidentialMode.enabled
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : isDarkMode
                      ? 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                      : 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200'
                  }`}
                  title="Modo Confidencial"
                >
                  <Lock size={12} /> Confidencial
                </button>

                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => setShowAiWriter(!showAiWriter)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                    isDarkMode
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                      : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                  }`}
                >
                  <Sparkles size={12} /> Help me write
                </button>
              </div>

              <div
                ref={editorRef}
                contentEditable
                className={`flex-1 min-h-[160px] w-full outline-none text-xs leading-relaxed p-3 rounded-xl border ${
                  isDarkMode ? 'bg-black/20 border-white/10 text-white/90' : 'bg-gray-50 border-gray-200 text-gray-800'
                }`}
              />

              {composeAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {composeAttachments.map((att, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs bg-white/10 border border-white/10"
                    >
                      <PaperclipIcon size={11} /> {att.name} ({att.size})
                      <button
                        type="button"
                        onClick={() => setComposeAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between items-center mt-3 pt-2 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-blue-600 rounded-full relative">
                    <button
                      type="button"
                      onClick={handleSendEmail}
                      className="pl-5 pr-3.5 py-1.5 hover:bg-blue-500 text-white text-xs font-bold rounded-l-full flex items-center gap-1.5"
                    >
                      <Send size={12} /> Enviar
                    </button>
                    <div className="w-[1px] h-5 bg-blue-700" />
                    <button
                      type="button"
                      aria-label="Opções de agendamento de envio"
                      onClick={() => setShowScheduleSendMenu(!showScheduleSendMenu)}
                      className="px-2.5 py-1.5 hover:bg-blue-500 rounded-r-full text-white"
                    >
                      <ChevronDown size={13} />
                    </button>

                    {showScheduleSendMenu && (
                      <div
                        className={`absolute bottom-full left-0 mb-2 w-60 border rounded-xl shadow-2xl z-50 py-1.5 ${
                          isDarkMode ? 'bg-[#2d2e30] border-white/10 text-white' : 'bg-white border-gray-200 text-gray-800'
                        }`}
                      >
                        <div className="px-3 py-1 text-[10px] font-bold uppercase opacity-50">Agendar envio</div>
                        <button
                          type="button"
                          onClick={() => handleScheduleSend('tomorrow')}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 flex justify-between"
                        >
                          <span>Amanhã de manhã</span>
                          <span className="opacity-50">08:00</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleScheduleSend('afternoon')}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 flex justify-between"
                        >
                          <span>Amanhã à tarde</span>
                          <span className="opacity-50">13:00</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleScheduleSend('monday')}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 flex justify-between"
                        >
                          <span>Segunda-feira</span>
                          <span className="opacity-50">08:00</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-lg hover:bg-white/10"
                    title="Anexar arquivo"
                  >
                    <PaperclipIcon size={15} />
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        const files = Array.from(e.target.files).map((f: File) => ({
                          file: f,
                          name: f.name,
                          size: `${Math.max(1, Math.round(f.size / 1024))} KB`,
                        }));
                        setComposeAttachments((prev) => [...prev, ...files]);
                      }
                    }}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCloseComposer}
                    className="text-xs opacity-60 hover:opacity-100 px-2 py-1"
                  >
                    Salvar rascunho
                  </button>
                  <button
                    type="button"
                    onClick={handleDiscardDraft}
                    aria-label="Descartar rascunho"
                    title="Descartar rascunho"
                    className="p-2 rounded-lg opacity-65 hover:opacity-100 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. INTERACTIVE AGENDA PANE */}
          {activePane === 'agenda' && (
            <div className="flex-1 flex flex-col p-5 overflow-y-auto custom-scrollbar space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold">Agenda Integrada ao Gmail</h3>
                  <p className="text-xs opacity-50">Visualize seus compromissos ou agende reuniões sem sair do e-mail</p>
                </div>
              </div>

              <form
                onSubmit={handleCreateQuickEvent}
                className={`p-3.5 rounded-2xl border space-y-2.5 ${
                  isDarkMode ? 'bg-white/[0.03] border-white/10' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                  <Plus size={14} /> Novo Compromisso Rápido
                </div>
                <input
                  type="text"
                  placeholder="Título da reunião (ex: Revisão de Arquitetura com Gabriel)"
                  value={activeEvent.title}
                  onChange={(e) => setActiveEvent({ ...activeEvent, title: e.target.value })}
                  className={`w-full rounded-xl px-3 py-2 text-xs border outline-none ${
                    isDarkMode ? 'bg-black/30 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-800'
                  }`}
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="date"
                    value={activeEvent.date}
                    onChange={(e) => setActiveEvent({ ...activeEvent, date: e.target.value })}
                    className={`rounded-xl px-2.5 py-1.5 text-xs border outline-none ${
                      isDarkMode ? 'bg-black/30 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-800'
                    }`}
                  />
                  <input
                    type="time"
                    value={activeEvent.startTime}
                    onChange={(e) => setActiveEvent({ ...activeEvent, startTime: e.target.value })}
                    className={`rounded-xl px-2.5 py-1.5 text-xs border outline-none ${
                      isDarkMode ? 'bg-black/30 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-800'
                    }`}
                  />
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold py-1.5"
                  >
                    Agendar
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider opacity-50">Próximos Eventos</h4>
                {calendarEvents.map((ev, idx) => (
                  <div
                    key={ev.id || idx}
                    className={`p-3 rounded-xl border flex items-center justify-between ${
                      isDarkMode ? 'bg-white/[0.03] border-white/10' : 'bg-white border-gray-200'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-bold">{ev.title}</p>
                      <p className="text-[11px] opacity-55">
                        {new Date(ev.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ·{' '}
                        {ev.location || 'Google Meet'}
                      </p>
                    </div>
                    {ev.meetLink && (
                      <span className="px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-400 text-[11px] font-semibold flex items-center gap-1">
                        <Video size={12} /> Meet
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. TASKS & KEEP PANES */}
          {activePane === 'tasks' && (
            <div className="flex-1 relative overflow-hidden">
              <Suspense fallback={<div className="flex-1 h-full flex items-center justify-center"><Loader2 size={20} className="animate-spin opacity-50" /></div>}>
                <TasksApp
                  onClose={() => setActivePane('email')}
                  data={{ ...data, tasks }}
                  onUpdate={handleUpdateTasks}
                  showToast={toast}
                  isDarkMode={isDarkMode}
                />
              </Suspense>
            </div>
          )}
          {activePane === 'keep' && (
            <div className="flex-1 relative overflow-hidden">
              <Suspense fallback={<div className="flex-1 h-full flex items-center justify-center"><Loader2 size={20} className="animate-spin opacity-50" /></div>}>
                <KeepApp
                  onClose={() => setActivePane('email')}
                  data={{ ...data, notes }}
                  onUpdate={handleUpdateNotes}
                  showToast={toast}
                  isDarkMode={isDarkMode}
                />
              </Suspense>
            </div>
          )}

          {/* 5. SETTINGS PANE */}
          {activePane === 'settings' && (
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-5">
              <div>
                <h3 className="text-base font-bold">Configurações Rápidas do Gmail</h3>
                <p className="text-xs opacity-55">
                  Personalize densidade, assinatura automática, tempo de desfazer envio e resposta de férias.
                </p>
              </div>

              <div className="space-y-4">
                <div className={`p-4 rounded-2xl border space-y-2 ${isDarkMode ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 bg-gray-50'}`}>
                  <label className="text-xs font-bold block">Período de cancelamento de envio (Desfazer envio)</label>
                  <select
                    value={mailSettings.undoSendSeconds}
                    onChange={(e) => setMailSettings({ ...mailSettings, undoSendSeconds: Number(e.target.value) })}
                    className={`rounded-xl px-3 py-1.5 text-xs border outline-none ${
                      isDarkMode ? 'bg-black/30 border-white/15 text-white' : 'bg-white border-gray-300 text-gray-800'
                    }`}
                  >
                    <option value={5}>5 segundos</option>
                    <option value={8}>8 segundos (Recomendado)</option>
                    <option value={20}>20 segundos</option>
                    <option value={30}>30 segundos</option>
                  </select>
                </div>

                <div className={`p-4 rounded-2xl border space-y-2 ${isDarkMode ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 bg-gray-50'}`}>
                  <label className="text-xs font-bold block">Assinatura Automática de E-mail</label>
                  <textarea
                    rows={3}
                    value={mailSettings.signature}
                    onChange={(e) => setMailSettings({ ...mailSettings, signature: e.target.value })}
                    className={`w-full rounded-xl p-2.5 text-xs border outline-none ${
                      isDarkMode ? 'bg-black/30 border-white/15 text-white' : 'bg-white border-gray-300 text-gray-800'
                    }`}
                  />
                </div>

                <div className={`p-4 rounded-2xl border space-y-3 ${isDarkMode ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold block">Resposta Automática de Férias</span>
                      <span className="text-[11px] opacity-55">
                        Envia uma resposta automática e exibe o banner de ausência no topo do Gmail
                      </span>
                    </div>
                    <Toggle
                      label="Alternar resposta automática de férias"
                      checked={mailSettings.vacationResponder}
                      onChange={(val) => setMailSettings({ ...mailSettings, vacationResponder: val })}
                    />
                  </div>
                  {mailSettings.vacationResponder && (
                    <div className="space-y-2 pt-2">
                      <input
                        type="text"
                        value={mailSettings.vacationSubject}
                        onChange={(e) => setMailSettings({ ...mailSettings, vacationSubject: e.target.value })}
                        placeholder="Assunto da resposta automática"
                        className={`w-full rounded-xl px-3 py-1.5 text-xs border outline-none ${
                          isDarkMode ? 'bg-black/30 border-white/15 text-white' : 'bg-white border-gray-300 text-gray-800'
                        }`}
                      />
                      <textarea
                        rows={2}
                        value={mailSettings.vacationMessage}
                        onChange={(e) => setMailSettings({ ...mailSettings, vacationMessage: e.target.value })}
                        className={`w-full rounded-xl p-2.5 text-xs border outline-none ${
                          isDarkMode ? 'bg-black/30 border-white/15 text-white' : 'bg-white border-gray-300 text-gray-800'
                        }`}
                      />
                    </div>
                  )}
                </div>

                {/* Active Auto-Filter Rules */}
                <div className={`p-4 rounded-2xl border space-y-2.5 ${isDarkMode ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold block">Regras de Filtro Automático</span>
                      <span className="text-[11px] opacity-55">
                        Classificam e etiquetam conversas automaticamente
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {autoRules.map((rule) => (
                      <div
                        key={rule.id}
                        className={`px-3 py-2 rounded-xl border text-xs flex items-center justify-between ${
                          isDarkMode ? 'bg-black/25 border-white/10' : 'bg-white border-gray-200'
                        }`}
                      >
                        <span>
                          Se {rule.from ? `De contém "${rule.from}" ` : ''}
                          {rule.subject ? `Assunto contém "${rule.subject}"` : ''} →{' '}
                          <strong>Importante + Marcador</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => setAutoRules((prev) => prev.filter((r) => r.id !== rule.id))}
                          className="text-rose-400 hover:underline text-[11px]"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    toast('Configurações do Gmail salvas com sucesso!');
                    setActivePane('email');
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-xs font-bold"
                >
                  Salvar Alterações
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KEYBOARD SHORTCUTS PORTAL MODAL */}
      {showShortcutsModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#181B22] border border-white/15 rounded-2xl w-full max-w-md p-5 shadow-2xl text-white space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Keyboard size={16} className="text-blue-400" />
                  <h4 className="text-sm font-bold">Atalhos de Teclado do Gmail</h4>
                </div>
                <button type="button" onClick={() => setShowShortcutsModal(false)}>
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                {[
                  { key: 'c', label: 'Escrever novo e-mail' },
                  { key: 'e', label: 'Arquivar conversa' },
                  { key: '#', label: 'Mover para Lixeira' },
                  { key: 'r', label: 'Responder mensagem' },
                  { key: 'a', label: 'Responder a todos' },
                  { key: 'f', label: 'Encaminhar conversa' },
                  { key: 's', label: 'Alternar Estrela' },
                  { key: 'm', label: 'Silenciar conversa' },
                  { key: 'j / k', label: 'Próxima / Anterior' },
                  { key: '?', label: 'Abrir ajuda de atalhos' },
                ].map((sc) => (
                  <div
                    key={sc.key}
                    className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2"
                  >
                    <span className="text-white/75">{sc.label}</span>
                    <kbd className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono font-bold text-[11px]">
                      {sc.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* PRINT / EXPORT THREAD PORTAL MODAL */}
      {showPrintModal &&
        activeEmail &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#181B22] border border-white/15 rounded-2xl w-full max-w-lg p-5 shadow-2xl text-white space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Printer size={16} className="text-blue-400" />
                  <h4 className="text-sm font-bold">Imprimir / Exportar Conversa do Gmail</h4>
                </div>
                <button type="button" onClick={() => setShowPrintModal(false)}>
                  <X size={16} />
                </button>
              </div>
              <pre className="bg-black/50 border border-white/10 rounded-xl p-3.5 text-xs font-mono text-white/85 max-h-72 overflow-y-auto whitespace-pre-wrap">
                {`ASSUNTO: ${activeEmail.subject}\nDE: ${activeEmail.sender}\nDATA: ${activeEmail.time}\n----------------------------------------\n` +
                  activeThreadMessages
                    .map((m) => `[${m.date}] ${m.from}:\n${(m.body || '').replace(/<[^>]+>/g, '')}`)
                    .join('\n\n')}
              </pre>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const iframe = document.createElement('iframe');
                    iframe.style.position = 'fixed';
                    iframe.style.right = '0';
                    iframe.style.bottom = '0';
                    iframe.style.width = '0';
                    iframe.style.height = '0';
                    iframe.style.border = '0';
                    document.body.appendChild(iframe);
                    const doc = iframe.contentWindow?.document;
                    if (doc) {
                      const messagesHtml = activeThreadMessages
                        .map(
                          (m) =>
                            `<article style="margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #e5e7eb;">
                              <div style="font-size:12px;color:#4b5563;margin-bottom:6px;">
                                <strong>${escapeHtml(m.from)}</strong> ${m.fromEmail ? `&lt;${escapeHtml(m.fromEmail)}&gt;` : ''} · ${escapeHtml(m.date)}
                                <br/>Para: ${escapeHtml(m.to)}${m.cc ? ` · Cc: ${escapeHtml(m.cc)}` : ''}
                              </div>
                              <div style="font-size:13px;line-height:1.55;">${sanitizeHtml(m.body || escapeHtml(m.plainBody || ''))}</div>
                            </article>`
                        )
                        .join('');
                      doc.open();
                      doc.write(
                        `<!doctype html><html><head><title>${escapeHtml(activeEmail.subject)}</title><style>body{font-family:system-ui,-apple-system,sans-serif;padding:24px;color:#111827;}h1{font-size:18px;margin-bottom:16px;}</style></head><body><h1>${escapeHtml(activeEmail.subject)}</h1>${messagesHtml}</body></html>`
                      );
                      doc.close();
                      iframe.contentWindow?.focus();
                      iframe.contentWindow?.print();
                    }
                    setTimeout(() => {
                      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
                    }, 1500);
                    toast('Diálogo de impressão aberto!');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Printer size={13} /> Imprimir
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const txt = activeThreadMessages
                      .map((m) => `[${m.date}] ${m.from}: ${(m.body || '').replace(/<[^>]+>/g, '')}`)
                      .join('\n\n');
                    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${activeEmail.subject.slice(0, 24).replace(/\s+/g, '_')}.eml.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast('Arquivo da conversa exportado!');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Download size={13} /> Baixar .txt/.eml
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}