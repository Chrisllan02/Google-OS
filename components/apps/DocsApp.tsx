import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  CheckSquare,
  Undo2,
  Redo2,
  Printer,
  Paintbrush,
  Search,
  Link2,
  Image as ImageIcon,
  Table as TableIcon,
  MessageSquarePlus,
  MessageSquare,
  Sparkles,
  Share2,
  Star,
  Clock,
  Check,
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
  FileText,
  FolderOpen,
  Download,
  Copy,
  Trash2,
  Settings,
  Eye,
  Edit3,
  GitPullRequest,
  Languages,
  Mic,
  MicOff,
  HelpCircle,
  Columns,
  Indent,
  Outdent,
  RemoveFormatting,
  AtSign,
  Calendar,
  User,
  Code,
  PenTool,
  RotateCcw,
  Mail,
  Globe,
  Lock,
  WifiOff,
  ListTree,
  Layers,
  ArrowUpDown,
} from 'lucide-react';
import { GoogleIcons } from '../GoogleIcons';
import { AppOpenPayload, bridge, DashboardData, Permission, TaskItem } from '../../utils/GASBridge';
import type { EnrichedDriveItem } from '../../utils/driveLogic';
import { sanitizeHtml, escapeHtml, encodeBase64Utf8, decodeBase64Utf8 } from '../../utils/sanitize';
import {
  DEFAULT_PAGE_SETUP,
  PageSetupConfig,
  DocCommentItem,
  DocVersionSnapshot,
  DocTabSection,
  CommentFilterMode,
  computeDocumentStats,
  extractDocumentOutline,
  countMatchesInHtml,
  findAndReplaceInHtml,
  convertHtmlToMarkdown,
  stripHtmlToText,
  filterComments,
  toggleResolveComment,
  deleteComment,
  buildExportHtmlDocument,
} from '../../utils/docsLogic';

interface DocsAppProps {
  onClose: () => void;
  data: DashboardData;
  onOpenApp?: (type: string, fileData?: AppOpenPayload) => void;
  onUpdateTasks?: (tasks: TaskItem[]) => void;
  showToast?: (msg: string) => void;
  isDarkMode?: boolean;
}

const FONT_FAMILIES = [
  { label: 'Plus Jakarta Sans', value: "'Plus Jakarta Sans', sans-serif" },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: "'Times New Roman', serif" },
  { label: 'Merriweather', value: 'Merriweather, serif' },
  { label: 'Trebuchet MS', value: "'Trebuchet MS', sans-serif" },
  { label: 'Courier New', value: "'Courier New', monospace" },
  { label: 'JetBrains Mono', value: "'JetBrains Mono', monospace" },
];

const TEXT_COLORS = [
  '#111827',
  '#1A73E8',
  '#D93025',
  '#188038',
  '#E37400',
  '#9334E6',
  '#007B83',
  '#5F6368',
];

const HIGHLIGHT_COLORS = [
  'transparent',
  '#FEF08A',
  '#BBF7D0',
  '#BFDBFE',
  '#FBCFE8',
  '#FED7AA',
  '#E9D5FF',
];

interface PersistedDocBundle {
  tabs: DocTabSection[];
  comments: DocCommentItem[];
  versions: DocVersionSnapshot[];
  pageSetup: PageSetupConfig;
  showLiveWordCount?: boolean;
  lineSpacing?: string;
}

const getInitialDocSeed = (): PersistedDocBundle => ({
  tabs: [
    {
      id: 'tab-main',
      title: 'Documento',
      icon: '📄',
      html: '<p><br/></p>',
    },
  ],
  comments: [],
  versions: [],
  pageSetup: { ...DEFAULT_PAGE_SETUP },
  showLiveWordCount: true,
});

export default function DocsApp({
  onClose,
  data,
  onOpenApp,
  onUpdateTasks,
  showToast,
  isDarkMode = false,
}: DocsAppProps) {
  const selfName = data?.user?.name || 'Você';
  const selfEmail = data?.user?.email || '';
  const [driveDocs, setDriveDocs] = useState<EnrichedDriveItem[]>([]);
  const [activeDocId, setActiveDocId] = useState<string>(() => data?.id || 'doc_local_new');
  const [title, setTitle] = useState<string>(() => data?.name || 'Documento sem título');
  const [isStarred, setIsStarred] = useState<boolean>(() => Boolean(data?.isStarred ?? false));
  const [offlineAvailable, setOfflineAvailable] = useState<boolean>(true);
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');

  // Document Bundle State (Tabs, Comments, Versions, Page Setup)
  const [tabs, setTabs] = useState<DocTabSection[]>(() => getInitialDocSeed().tabs);
  const [activeTabId, setActiveTabId] = useState<string>('tab-main');
  const [comments, setComments] = useState<DocCommentItem[]>([]);
  const [versions, setVersions] = useState<DocVersionSnapshot[]>([]);
  const [pageSetup, setPageSetup] = useState<PageSetupConfig>(() => ({ ...DEFAULT_PAGE_SETUP }));
  const [showLiveWordCount, setShowLiveWordCount] = useState<boolean>(true);

  // Editor Modes & UI Panels (responsive defaults prevent mobile/tablet canvas crush)
  const [docMode, setDocMode] = useState<'editing' | 'suggesting' | 'viewing'>('editing');
  const [zoom, setZoom] = useState<number>(100);
  const [showRuler, setShowRuler] = useState<boolean>(true);
  const [showLeftOutline, setShowLeftOutline] = useState<boolean>(
    () => (typeof window !== 'undefined' ? window.innerWidth >= 1024 : true)
  );
  const [showRightComments, setShowRightComments] = useState<boolean>(
    () => (typeof window !== 'undefined' ? window.innerWidth >= 1280 : false)
  );
  const [commentFilter, setCommentFilter] = useState<CommentFilterMode>('open');
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  // Formatting States
  const [headingStyle, setHeadingStyle] = useState<string>('p');
  const [fontFamily, setFontFamily] = useState<string>(FONT_FAMILIES[0].value);
  const [fontSizePt, setFontSizePt] = useState<number>(11);
  const [lineSpacing, setLineSpacing] = useState<string>('1.5');
  const [isBold, setIsBold] = useState<boolean>(false);
  const [isItalic, setIsItalic] = useState<boolean>(false);
  const [isUnderline, setIsUnderline] = useState<boolean>(false);
  const [isStrike, setIsStrike] = useState<boolean>(false);
  const [activeAlign, setActiveAlign] = useState<'left' | 'center' | 'right' | 'justify'>('left');
  const [showTextColorPicker, setShowTextColorPicker] = useState<boolean>(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState<boolean>(false);
  const [showSmartChipMenu, setShowSmartChipMenu] = useState<boolean>(false);
  const [showTableGridPicker, setShowTableGridPicker] = useState<boolean>(false);
  const [showLineSpacingMenu, setShowLineSpacingMenu] = useState<boolean>(false);
  const [hoverTableDims, setHoverTableDims] = useState<{ rows: number; cols: number }>({ rows: 3, cols: 3 });
  const [copiedFormat, setCopiedFormat] = useState<{ fontFamily: string; fontSizePt: number } | null>(null);

  // Modals
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);
  const [showFindReplaceModal, setShowFindReplaceModal] = useState<boolean>(false);
  const [findQuery, setFindQuery] = useState<string>('');
  const [replaceQuery, setReplaceQuery] = useState<string>('');
  const [matchCase, setMatchCase] = useState<boolean>(false);

  const [showWordCountModal, setShowWordCountModal] = useState<boolean>(false);
  const [showPageSetupModal, setShowPageSetupModal] = useState<boolean>(false);
  const [showVersionsModal, setShowVersionsModal] = useState<boolean>(false);
  const [newVersionName, setNewVersionName] = useState<string>('');

  const [showCommentModal, setShowCommentModal] = useState<boolean>(false);
  const [newCommentQuote, setNewCommentQuote] = useState<string>('');
  const [newCommentText, setNewCommentText] = useState<string>('');
  const [newCommentIsSuggestion, setNewCommentIsSuggestion] = useState<boolean>(false);
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});

  const [showLinkModal, setShowLinkModal] = useState<boolean>(false);
  const [linkTextInput, setLinkTextInput] = useState<string>('');
  const [linkUrlInput, setLinkUrlInput] = useState<string>('https://');

  const [showDrawingModal, setShowDrawingModal] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [shareEmailInput, setShareEmailInput] = useState<string>('');
  const [shareRoleInput, setShareRoleInput] = useState<'editor' | 'viewer'>('editor');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [generalAccess, setGeneralAccess] = useState<'restricted' | 'anyone'>('restricted');

  const [showCommandPalette, setShowCommandPalette] = useState<boolean>(false);
  const [commandQuery, setCommandQuery] = useState<string>('');

  const [showTranslateModal, setShowTranslateModal] = useState<boolean>(false);
  const [translateTargetLang, setTranslateTargetLang] = useState<'en' | 'es' | 'pt'>('en');
  const [isVoiceTyping, setIsVoiceTyping] = useState<boolean>(false);

  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renamingTabValue, setRenamingTabValue] = useState<string>('');

  const editorRef = useRef<HTMLDivElement>(null);
  const imageUploadRef = useRef<HTMLInputElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef<boolean>(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((msg: string) => showToast?.(msg), [showToast]);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) || tabs[0],
    [tabs, activeTabId]
  );

  // Load Drive documents list and current document bundle
  const loadDocumentById = useCallback(async (docId: string, fallbackName?: string) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const allItems = await bridge.getAllDriveItems();
    const docItems = allItems.filter((i: EnrichedDriveItem) => i.type === 'doc' && !i.trashed);
    setDriveDocs(docItems);

    const matchedDriveItem = allItems.find((i: EnrichedDriveItem) => i.id === docId);
    const resolvedName = matchedDriveItem?.name || fallbackName || 'Documento sem título';
    setActiveDocId(docId);
    setTitle(resolvedName);
    setIsStarred(Boolean(matchedDriveItem?.isStarred));
    setOfflineAvailable(matchedDriveItem?.offlineAvailable ?? true);
    setGeneralAccess(matchedDriveItem?.generalAccess === 'anyone_with_link' ? 'anyone' : 'restricted');
    setSaveState('saved');

    const perms = await bridge.getFilePermissions(docId);
    setPermissions(perms);

    // Check localStorage for persisted bundle v2
    const rawSaved = localStorage.getItem(`workspace_docs_bundle_v2_${docId}`);
    if (rawSaved) {
      try {
        const parsed: PersistedDocBundle = JSON.parse(rawSaved);
        if (parsed.tabs && parsed.tabs.length > 0) {
          setTabs(parsed.tabs);
          setActiveTabId(parsed.tabs[0].id);
          setComments(parsed.comments || []);
          setVersions(parsed.versions || []);
          setPageSetup(parsed.pageSetup || { ...DEFAULT_PAGE_SETUP });
          setShowLiveWordCount(parsed.showLiveWordCount ?? true);
          setLineSpacing(parsed.lineSpacing || '1.5');
          if (editorRef.current) {
            editorRef.current.innerHTML = sanitizeHtml(parsed.tabs[0].html);
          }
          return;
        }
      } catch {
        // Fallback to seed
      }
    }

    // Check legacy GASBridge content if saved by Calendar/Keep/Meet
    const legacy = await bridge.getFileContent(docId);
    const seed = getInitialDocSeed();
    let loadedLegacyHtml = '';
    if (legacy.success && legacy.data) {
      try {
        const decoded = decodeBase64Utf8(legacy.data);
        if (decoded.trim()) {
          loadedLegacyHtml = sanitizeHtml(decoded);
        }
      } catch {
        if (legacy.data.trim().startsWith('<')) {
          loadedLegacyHtml = sanitizeHtml(legacy.data);
        }
      }
    }

    if (loadedLegacyHtml) {
      const singleTab: DocTabSection = {
        id: 'tab-main',
        title: resolvedName,
        icon: '📄',
        html: loadedLegacyHtml,
      };
      setTabs([singleTab]);
      setActiveTabId(singleTab.id);
      setComments([]);
      setVersions([
        {
          id: 'ver-initial',
          name: `Versão Inicial — ${resolvedName}`,
          createdAt: 'Agora mesmo',
          author: selfName,
          html: loadedLegacyHtml,
        },
      ]);
      setPageSetup({ ...DEFAULT_PAGE_SETUP });
      setShowLiveWordCount(true);
      setLineSpacing('1.5');
      if (editorRef.current) {
        editorRef.current.innerHTML = loadedLegacyHtml;
      }
      return;
    }

    setTabs(seed.tabs);
    setActiveTabId(seed.tabs[0].id);
    setComments(seed.comments);
    setVersions(seed.versions);
    setPageSetup(seed.pageSetup);
    setShowLiveWordCount(seed.showLiveWordCount ?? true);
    setLineSpacing(seed.lineSpacing || '1.5');
    if (editorRef.current) {
      editorRef.current.innerHTML = sanitizeHtml(seed.tabs[0].html);
    }
  }, [selfName]);

  useEffect(() => {
    loadDocumentById(data?.id || 'doc_local_new', data?.name || 'Documento sem título');
  }, [data?.id, data?.name, loadDocumentById]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // Sync editor DOM when switching tabs
  useEffect(() => {
    if (editorRef.current && activeTab) {
      const safeHtml = sanitizeHtml(activeTab.html);
      if (editorRef.current.innerHTML !== safeHtml) {
        editorRef.current.innerHTML = safeHtml;
      }
    }
  }, [activeTabId]);

  // Persist bundle to localStorage + GASBridge
  const persistBundle = useCallback(
    (
      nextTabs: DocTabSection[],
      nextComments: DocCommentItem[],
      nextVersions: DocVersionSnapshot[],
      nextSetup: PageSetupConfig,
      nextLiveCount = showLiveWordCount,
      nextLineSpacing = lineSpacing
    ) => {
      const targetDocId = activeDocId;
      setSaveState('saving');
      const bundle: PersistedDocBundle = {
        tabs: nextTabs,
        comments: nextComments,
        versions: nextVersions,
        pageSetup: nextSetup,
        showLiveWordCount: nextLiveCount,
        lineSpacing: nextLineSpacing,
      };
      try {
        localStorage.setItem(`workspace_docs_bundle_v2_${targetDocId}`, JSON.stringify(bundle));
      } catch {
        // Ignore storage quota errors
      }

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        const primaryHtml = nextTabs[0]?.html || '';
        const encoded = encodeBase64Utf8(primaryHtml);
        await bridge.saveFileContent(targetDocId, encoded);
        setSaveState('saved');
      }, 450);
    },
    [activeDocId, showLiveWordCount, lineSpacing]
  );

  const syncEditorToActiveTab = useCallback(() => {
    if (!editorRef.current) return;
    const currentHtml = editorRef.current.innerHTML;
    setTabs((prev) => {
      const updated = prev.map((t) => (t.id === activeTabId ? { ...t, html: currentHtml } : t));
      persistBundle(updated, comments, versions, pageSetup);
      return updated;
    });
  }, [activeTabId, comments, versions, pageSetup, persistBundle]);

  // Live Document Stats & Outline
  const stats = useMemo(() => computeDocumentStats(activeTab?.html || ''), [activeTab?.html]);
  const outline = useMemo(() => extractDocumentOutline(activeTab?.html || ''), [activeTab?.html]);
  const findMatchesCount = useMemo(
    () => countMatchesInHtml(activeTab?.html || '', findQuery, matchCase),
    [activeTab?.html, findQuery, matchCase]
  );

  // Sync active formatting indicators with current cursor selection
  const syncActiveFormatting = useCallback(() => {
    try {
      setIsBold(document.queryCommandState('bold'));
      setIsItalic(document.queryCommandState('italic'));
      setIsUnderline(document.queryCommandState('underline'));
      setIsStrike(document.queryCommandState('strikeThrough'));

      if (document.queryCommandState('justifyCenter')) setActiveAlign('center');
      else if (document.queryCommandState('justifyRight')) setActiveAlign('right');
      else if (document.queryCommandState('justifyFull')) setActiveAlign('justify');
      else setActiveAlign('left');

      const sel = window.getSelection();
      let node: Node | null = sel?.anchorNode || null;
      let detected = 'p';
      while (node && node !== editorRef.current) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const tag = (node as HTMLElement).tagName.toLowerCase();
          if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'p') {
            detected = tag;
            break;
          }
        }
        node = node.parentNode;
      }
      setHeadingStyle(detected);
    } catch {
      // Ignore queryCommandState errors in detached DOM
    }
  }, []);

  // Title rename sync with Drive
  const handleTitleBlur = async () => {
    const clean = title.trim() || 'Documento sem título';
    setTitle(clean);
    await bridge.renameDriveItem(activeDocId, clean);
    const allItems = await bridge.getAllDriveItems();
    setDriveDocs(allItems.filter((i: EnrichedDriveItem) => i.type === 'doc' && !i.trashed));
    toast(`Documento renomeado para "${clean}"`);
  };

  const handleToggleStar = async () => {
    const next = !isStarred;
    setIsStarred(next);
    await bridge.setStarredDriveItem(activeDocId, next);
    toast(next ? 'Adicionado aos favoritos no Drive' : 'Removido dos favoritos');
  };

  // Rich Text ExecCommand Helper
  const execFormat = (command: string, value?: string) => {
    if (docMode === 'viewing') {
      toast('Documento em modo Visualização. Mude para Edição para formatar.');
      return;
    }
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncActiveFormatting();
    syncEditorToActiveTab();
  };

  const handleChangeLineSpacing = (spacing: string) => {
    setLineSpacing(spacing);
    setShowLineSpacingMenu(false);
    setOpenMenu(null);
    persistBundle(tabs, comments, versions, pageSetup, showLiveWordCount, spacing);
    toast(`Espaçamento entre linhas: ${spacing}`);
  };

  const insertHtmlAtCursor = (htmlSnippet: string) => {
    if (docMode === 'viewing') {
      toast('Modo Visualização ativo.');
      return;
    }
    const safeSnippet = sanitizeHtml(htmlSnippet);
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      document.execCommand('insertHTML', false, safeSnippet);
    } else if (editorRef.current) {
      editorRef.current.innerHTML += safeSnippet;
    }
    syncEditorToActiveTab();
  };

  // Apply Heading Style
  const handleApplyHeading = (tag: string) => {
    setHeadingStyle(tag);
    execFormat('formatBlock', tag.toUpperCase());
  };

  // Apply Font Size
  const handleApplyFontSize = (newPt: number) => {
    const clamped = Math.min(72, Math.max(8, newPt));
    setFontSizePt(clamped);
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && editorRef.current?.contains(sel.anchorNode)) {
      const selectedText = escapeHtml(sel.toString());
      insertHtmlAtCursor(`<span style="font-size:${clamped}pt;">${selectedText}</span>`);
    }
  };

  // Insert Smart Chip (@)
  const handleInsertSmartChip = (
    kind: 'person' | 'date' | 'status' | 'drive' | 'code' | 'meeting',
    payload?: string
  ) => {
    setShowSmartChipMenu(false);
    setOpenMenu(null);
    if (kind === 'person') {
      const name = payload || selfName;
      insertHtmlAtCursor(
        `&nbsp;<span data-smart-chip="person" contenteditable="false" style="background:#E8F0FE;color:#1967D2;padding:2px 8px;border-radius:12px;font-weight:600;font-size:0.9em;display:inline-block;">@${name}</span>&nbsp;`
      );
    } else if (kind === 'date') {
      const dateStr = payload || new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
      insertHtmlAtCursor(
        `&nbsp;<span data-smart-chip="date" contenteditable="false" style="background:#F1F3F4;color:#3C4043;padding:2px 8px;border-radius:12px;font-weight:600;font-size:0.9em;display:inline-block;">📅 ${dateStr}</span>&nbsp;`
      );
    } else if (kind === 'status') {
      const label = payload || 'Em andamento';
      const colors: Record<string, { bg: string; fg: string }> = {
        'Não iniciado': { bg: '#F1F3F4', fg: '#3C4043' },
        'Em andamento': { bg: '#E8F0FE', fg: '#1967D2' },
        'Em revisão': { bg: '#FEF7E0', fg: '#B06000' },
        Aprovado: { bg: '#E6F4EA', fg: '#137333' },
      };
      const c = colors[label] || colors['Em andamento'];
      insertHtmlAtCursor(
        `&nbsp;<span data-smart-chip="status" contenteditable="false" style="background:${c.bg};color:${c.fg};padding:2px 8px;border-radius:12px;font-weight:600;font-size:0.9em;display:inline-block;">● ${label}</span>&nbsp;`
      );
    } else if (kind === 'drive') {
      const docName = payload || title || 'Documento do Drive';
      insertHtmlAtCursor(
        `&nbsp;<span data-smart-chip="drive" contenteditable="false" style="background:#E6F4EA;color:#137333;padding:2px 8px;border-radius:12px;font-weight:600;font-size:0.9em;display:inline-block;">📄 ${docName}</span>&nbsp;`
      );
    } else if (kind === 'code') {
      insertHtmlAtCursor(
        `<pre style="background:#0F172A;color:#E2E8F0;padding:12px 16px;border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:12px;margin:12px 0;">// Bloco de código\n</pre><p><br/></p>`
      );
    } else if (kind === 'meeting') {
      insertHtmlAtCursor(
        `<div style="border:1px solid #CBD5E1;border-radius:12px;padding:14px 16px;margin:14px 0;background:#F8FAFC;">
          <h3 style="margin:0 0 6px 0;color:#1E293B;">📅 Bloco de Notas da Reunião</h3>
          <p style="margin:4px 0;font-size:13px;"><strong>Participantes:</strong> @${escapeHtml(selfName)}</p>
          <p style="margin:4px 0;font-size:13px;"><strong>Pauta & Decisões:</strong> </p>
          <ul style="margin:6px 0 0 18px;font-size:13px;">
            <li>[ ] Próximo passo 1</li>
          </ul>
        </div><p><br/></p>`
      );
    }
    toast('Smart Chip inserido no documento');
  };

  // Insert Table
  const handleInsertTable = (rows: number, cols: number) => {
    setShowTableGridPicker(false);
    setOpenMenu(null);
    let tableHtml = `<table style="width:100%;border-collapse:collapse;margin:16px 0;"><thead><tr style="background:#F1F5F9;">`;
    for (let c = 0; c < cols; c++) {
      tableHtml += `<th style="border:1px solid #CBD5E1;padding:8px 12px;text-align:left;">Coluna ${c + 1}</th>`;
    }
    tableHtml += `</tr></thead><tbody>`;
    for (let r = 0; r < rows - 1; r++) {
      tableHtml += `<tr>`;
      for (let c = 0; c < cols; c++) {
        tableHtml += `<td style="border:1px solid #CBD5E1;padding:8px 12px;">Dados ${r + 1}.${c + 1}</td>`;
      }
      tableHtml += `</tr>`;
    }
    tableHtml += `</tbody></table><p><br/></p>`;
    insertHtmlAtCursor(tableHtml);
    toast(`Tabela ${rows}x${cols} inserida`);
  };

  // Create New Document in Drive
  const handleCreateNewDocument = async () => {
    const docName = `Documento sem título (${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})`;
    const blankHtml = '<p><br/></p>';
    const created = await bridge.createDriveDocument('doc', docName);
    const newBundle: PersistedDocBundle = {
      tabs: [{ id: 'tab-main', title: 'Documento', icon: '📄', html: blankHtml }],
      comments: [],
      versions: [
        {
          id: `v_${Date.now()}`,
          name: 'Versão Inicial',
          createdAt: 'Agora mesmo',
          author: selfName,
          html: blankHtml,
        },
      ],
      pageSetup: { ...DEFAULT_PAGE_SETUP },
      showLiveWordCount: true,
    };
    localStorage.setItem(`workspace_docs_bundle_v2_${created.id}`, JSON.stringify(newBundle));
    setShowTemplateModal(false);
    setOpenMenu(null);
    await loadDocumentById(created.id, created.name);
    toast(`Novo documento "${docName}" criado no Drive`);
  };

  // Duplicate Current Document
  const handleDuplicateDocument = async () => {
    setOpenMenu(null);
    const copyName = `Cópia de ${title}`;
    const created = await bridge.createDriveDocument('doc', copyName);
    const bundle: PersistedDocBundle = {
      tabs,
      comments,
      versions,
      pageSetup,
      showLiveWordCount,
    };
    localStorage.setItem(`workspace_docs_bundle_v2_${created.id}`, JSON.stringify(bundle));
    await loadDocumentById(created.id, copyName);
    toast(`Cópia "${copyName}" criada no Google Drive`);
  };

  // Export / Download Document (.md, .html, .txt, .pdf print)
  const handleDownloadDocument = (format: 'md' | 'html' | 'txt' | 'pdf') => {
    setOpenMenu(null);
    const htmlContent = activeTab?.html || '';
    if (format === 'pdf') {
      window.print();
      toast('Janela de impressão / PDF acionada');
      return;
    }
    let content = '';
    let mime = 'text/plain;charset=utf-8';
    let ext = format;

    if (format === 'md') {
      content = convertHtmlToMarkdown(htmlContent);
      mime = 'text/markdown;charset=utf-8';
    } else if (format === 'html') {
      content = buildExportHtmlDocument(title, sanitizeHtml(htmlContent));
      mime = 'text/html;charset=utf-8';
    } else {
      content = stripHtmlToText(htmlContent);
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast(`Download concluído: ${title}.${ext}`);
  };

  // Find & Replace Actions
  const handleReplaceAction = (replaceAll: boolean) => {
    if (!findQuery.trim()) return;
    const currentHtml = activeTab?.html || '';
    const { updatedHtml, replacements } = findAndReplaceInHtml(
      currentHtml,
      findQuery,
      replaceQuery,
      { matchCase, replaceAll }
    );
    if (replacements > 0) {
      const safeUpdated = sanitizeHtml(updatedHtml);
      if (editorRef.current) editorRef.current.innerHTML = safeUpdated;
      const nextTabs = tabs.map((t) => (t.id === activeTabId ? { ...t, html: safeUpdated } : t));
      setTabs(nextTabs);
      persistBundle(nextTabs, comments, versions, pageSetup);
      toast(`${replacements} ocorrência(s) substituída(s)`);
    } else {
      toast('Nenhuma ocorrência encontrada');
    }
  };

  // Add Comment or Suggestion
  const handleOpenAddComment = () => {
    const sel = window.getSelection();
    const selectedText = sel ? sel.toString().trim() : '';
    setNewCommentQuote(selectedText || title);
    setNewCommentText('');
    setNewCommentIsSuggestion(docMode === 'suggesting');
    setShowCommentModal(true);
    setOpenMenu(null);
  };

  const handleConfirmAddComment = () => {
    if (!newCommentText.trim()) return;
    const item: DocCommentItem = {
      id: `cmt_${Date.now()}`,
      author: selfName,
      authorEmail: selfEmail,
      createdAt: 'Agora mesmo',
      quotedText: newCommentQuote || 'Trecho selecionado',
      text: newCommentText.trim(),
      resolved: false,
      isSuggestion: newCommentIsSuggestion,
      suggestedReplacement: newCommentIsSuggestion ? newCommentText.trim() : undefined,
      replies: [],
    };
    const nextComments = [item, ...comments];
    setComments(nextComments);
    persistBundle(tabs, nextComments, versions, pageSetup);
    setShowCommentModal(false);
    setShowRightComments(true);
    toast(newCommentIsSuggestion ? 'Sugestão registrada no documento' : 'Comentário adicionado');
  };

  const handleAcceptSuggestion = (cmt: DocCommentItem) => {
    if (cmt.quotedText && cmt.suggestedReplacement) {
      const { updatedHtml } = findAndReplaceInHtml(
        activeTab?.html || '',
        cmt.quotedText,
        cmt.suggestedReplacement,
        { replaceAll: false }
      );
      const safeUpdated = sanitizeHtml(updatedHtml);
      if (editorRef.current) editorRef.current.innerHTML = safeUpdated;
      const nextTabs = tabs.map((t) => (t.id === activeTabId ? { ...t, html: safeUpdated } : t));
      const nextComments = comments.map((c) => (c.id === cmt.id ? { ...c, resolved: true } : c));
      setTabs(nextTabs);
      setComments(nextComments);
      persistBundle(nextTabs, nextComments, versions, pageSetup);
      toast('Sugestão aceita e aplicada ao documento');
    }
  };

  const handleToggleResolveComment = (id: string) => {
    const target = comments.find((c) => c.id === id);
    const nextComments = toggleResolveComment(comments, id);
    setComments(nextComments);
    persistBundle(tabs, nextComments, versions, pageSetup);
    toast(target?.resolved ? 'Comentário reaberto' : 'Comentário resolvido');
  };

  const handleDeleteComment = (id: string) => {
    const nextComments = deleteComment(comments, id);
    setComments(nextComments);
    persistBundle(tabs, nextComments, versions, pageSetup);
    toast('Comentário excluído');
  };

  const handleAddReply = (cmtId: string) => {
    const text = (replyInputs[cmtId] || '').trim();
    if (!text) return;
    const nextComments = comments.map((c) =>
      c.id === cmtId
        ? {
            ...c,
            replies: [
              ...c.replies,
              { id: `rep_${Date.now()}`, author: selfName, createdAt: 'Agora', text },
            ],
          }
        : c
    );
    setComments(nextComments);
    setReplyInputs((prev) => ({ ...prev, [cmtId]: '' }));
    persistBundle(tabs, nextComments, versions, pageSetup);
  };

  const handleCreateTaskFromComment = async (cmt: DocCommentItem) => {
    await bridge.createTask(
      `Revisar no Docs (${title}): ${cmt.text}`,
      `Trecho citado: "${cmt.quotedText}" — Autor: ${cmt.author}`,
      'work',
      new Date().toISOString().split('T')[0],
      undefined,
      {
        starred: true,
        linkedSource: { type: 'doc', id: activeDocId, label: title },
      }
    );
    const updatedTasks = await bridge.getTasks('all');
    onUpdateTasks?.(updatedTasks);
    toast('Tarefa vinculada criada no Google Tarefas!');
  };

  // Document Tabs Management
  const handleAddDocTab = () => {
    const newTab: DocTabSection = {
      id: `tab_${Date.now()}`,
      title: `Seção ${tabs.length + 1}`,
      icon: '📑',
      html: `<h1>Seção ${tabs.length + 1}</h1><p>Conteúdo desta aba do documento.</p>`,
    };
    const nextTabs = [...tabs, newTab];
    setTabs(nextTabs);
    setActiveTabId(newTab.id);
    persistBundle(nextTabs, comments, versions, pageSetup);
    toast(`Aba "${newTab.title}" adicionada ao documento`);
  };

  const handleDeleteDocTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length <= 1) {
      toast('O documento precisa ter pelo menos uma aba.');
      return;
    }
    const nextTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(nextTabs);
    if (activeTabId === tabId) {
      setActiveTabId(nextTabs[0].id);
    }
    persistBundle(nextTabs, comments, versions, pageSetup);
  };

  // Version Snapshots
  const handleSaveNamedVersion = () => {
    const name = newVersionName.trim() || `Versão de ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    const snap: DocVersionSnapshot = {
      id: `ver_${Date.now()}`,
      name,
      createdAt: 'Agora mesmo',
      author: selfName,
      html: activeTab?.html || '',
    };
    const nextVersions = [snap, ...versions];
    setVersions(nextVersions);
    setNewVersionName('');
    persistBundle(tabs, comments, nextVersions, pageSetup);
    toast(`Versão "${name}" salva no histórico`);
  };

  const handleRestoreVersion = (ver: DocVersionSnapshot) => {
    const safeHtml = sanitizeHtml(ver.html);
    if (editorRef.current) editorRef.current.innerHTML = safeHtml;
    const nextTabs = tabs.map((t) => (t.id === activeTabId ? { ...t, html: safeHtml } : t));
    setTabs(nextTabs);
    persistBundle(nextTabs, comments, versions, pageSetup);
    setShowVersionsModal(false);
    toast(`Versão "${ver.name}" restaurada com sucesso`);
  };

  // Drawing Canvas Helper
  const handleDrawingPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    isDrawingRef.current = true;
    ctx.strokeStyle = '#1A73E8';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const handleDrawingPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const handleDrawingPointerUp = () => {
    isDrawingRef.current = false;
  };

  const handleInsertDrawingIntoDoc = () => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    insertHtmlAtCursor(
      `<div style="margin:14px 0;"><img src="${dataUrl}" alt="Desenho / Assinatura" style="max-width:340px;border:1px solid #E2E8F0;border-radius:8px;padding:6px;background:#FFF;" /></div><p><br/></p>`
    );
    setShowDrawingModal(false);
    toast('Desenho / assinatura inserido no documento');
  };

  // Translate Document
  const handleTranslateDocument = () => {
    const prefixMap = {
      en: { tag: 'EN', heading: 'Translated Document (English)', note: 'Translated automatically via Google Docs' },
      es: { tag: 'ES', heading: 'Documento Traducido (Español)', note: 'Traducido automáticamente vía Google Docs' },
      pt: { tag: 'PT-BR', heading: 'Documento Traduzido (Português)', note: 'Revisão em Português' },
    };
    const meta = prefixMap[translateTargetLang];
    const newTab: DocTabSection = {
      id: `tab_tr_${Date.now()}`,
      title: `[${meta.tag}] ${activeTab.title}`,
      icon: '🌐',
      html: `<div style="background:#EFF6FF;border:1px solid #BFDBFE;padding:8px 12px;border-radius:8px;font-size:12px;color:#1D4ED8;margin-bottom:16px;">🌐 <strong>${meta.heading}:</strong> ${meta.note}</div>${activeTab.html}`,
    };
    const nextTabs = [...tabs, newTab];
    setTabs(nextTabs);
    setActiveTabId(newTab.id);
    persistBundle(nextTabs, comments, versions, pageSetup);
    setShowTranslateModal(false);
    toast(`Tradução criada na nova aba "${newTab.title}"`);
  };

  // Voice Typing Simulation / Web Speech API
  const handleToggleVoiceTyping = () => {
    if (isVoiceTyping) {
      setIsVoiceTyping(false);
      toast('Digitação por voz encerrada');
      return;
    }
    setIsVoiceTyping(true);
    toast('Microfone ativo — ditando nota executiva...');
    setTimeout(() => {
      insertHtmlAtCursor(
        `<p><em>[Nota ditada por voz]:</em> Priorizar entrega de testes automatizados e revisão de performance antes do fechamento da sprint.</p>`
      );
      setIsVoiceTyping(false);
      toast('Texto transcrito por voz inserido no documento');
    }, 1200);
  };

  // Share Permissions
  const handleInviteCollaborator = async () => {
    const email = shareEmailInput.trim();
    if (!email || !email.includes('@')) {
      toast('Informe um e-mail válido.');
      return;
    }
    await bridge.addDrivePermission(activeDocId, email, shareRoleInput);
    const updated = await bridge.getFilePermissions(activeDocId);
    setPermissions(updated);
    setShareEmailInput('');
    toast(`Acesso concedido para ${email}`);
  };

  const handleRemoveCollaborator = async (email: string) => {
    await bridge.removeDrivePermission(activeDocId, email);
    const updated = await bridge.getFilePermissions(activeDocId);
    setPermissions(updated);
    toast(`Acesso removido: ${email}`);
  };

  const handleChangeGeneralAccess = async (nextAccess: 'restricted' | 'anyone') => {
    setGeneralAccess(nextAccess);
    await bridge.updateDriveItemMeta(activeDocId, {
      generalAccess: nextAccess === 'anyone' ? 'anyone_with_link' : 'restricted',
    });
    toast(
      nextAccess === 'anyone'
        ? 'Acesso geral: qualquer pessoa com o link pode visualizar'
        : 'Acesso geral: restrito às pessoas adicionadas'
    );
  };

  // Scroll to Heading in Editor
  const handleScrollToHeading = (headingText: string) => {
    if (!editorRef.current) return;
    const nodes = editorRef.current.querySelectorAll('h1, h2, h3');
    for (const node of Array.from(nodes) as HTMLElement[]) {
      if ((node.textContent || '').trim() === headingText) {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      }
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setShowFindReplaceModal((v) => !v);
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setShowWordCountModal((v) => !v);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowLinkModal(true);
      } else if (e.altKey && e.key === '/') {
        e.preventDefault();
        setShowCommandPalette((v) => !v);
      } else if (e.key === 'Escape') {
        setOpenMenu(null);
        setShowSmartChipMenu(false);
        setShowTableGridPicker(false);
        setShowTextColorPicker(false);
        setShowHighlightPicker(false);
        setShowLineSpacingMenu(false);
        setShowCommandPalette(false);
        setShowTemplateModal(false);
        setShowFindReplaceModal(false);
        setShowWordCountModal(false);
        setShowPageSetupModal(false);
        setShowVersionsModal(false);
        setShowCommentModal(false);
        setShowLinkModal(false);
        setShowDrawingModal(false);
        setShowTranslateModal(false);
        setShowShareModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const bgMain = isDarkMode ? 'bg-[#13151A] text-[#E8EAED]' : 'bg-[#F8FAFD] text-[#1F1F1F]';
  const bgHeader = isDarkMode ? 'bg-[#1B1E26] border-white/10' : 'bg-[#F8FAFD] border-black/[0.08]';
  const bgToolbar = isDarkMode ? 'bg-[#252934] border-white/10' : 'bg-[#EDF2FA] border-black/[0.05]';
  const bgPanel = isDarkMode ? 'bg-[#181B22] border-white/10' : 'bg-white border-black/[0.08]';
  const hoverBtn = isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/[0.06]';
  const textMuted = isDarkMode ? 'text-white/60' : 'text-[#5F6368]';

  const marginPaddingClass =
    pageSetup.margins === 'narrow'
      ? 'px-4 py-5 sm:px-8 sm:py-8 md:px-10 md:py-10'
      : pageSetup.margins === 'wide'
      ? 'px-6 py-7 sm:px-14 sm:py-12 md:px-24 md:py-16'
      : 'px-5 py-6 sm:px-10 sm:py-10 md:px-16 md:py-14';

  const pageWidthPx = pageSetup.pageless
    ? 980
    : pageSetup.orientation === 'landscape'
    ? 1056
    : 816;

  const openCommentsCount = filterComments(comments, 'open').length;
  const resolvedCommentsCount = filterComments(comments, 'resolved').length;
  const visibleComments = filterComments(comments, commentFilter);

  const commandActions = [
    { label: 'Novo documento em branco', run: () => handleCreateNewDocument() },
    { label: 'Abrir documento do Google Drive', run: () => setShowTemplateModal(true) },
    { label: 'Localizar e substituir (Ctrl+H)', run: () => setShowFindReplaceModal(true) },
    { label: 'Contagem de palavras (Ctrl+Shift+C)', run: () => setShowWordCountModal(true) },
    { label: 'Configuração da página (Margens, Cor, Pageless)', run: () => setShowPageSetupModal(true) },
    { label: 'Histórico de versões do documento', run: () => setShowVersionsModal(true) },
    { label: 'Inserir Tabela 3x3', run: () => handleInsertTable(3, 3) },
    { label: 'Inserir Smart Chip de Pessoa (@)', run: () => handleInsertSmartChip('person', selfName) },
    { label: 'Inserir Bloco de Notas de Reunião', run: () => handleInsertSmartChip('meeting') },
    { label: 'Inserir Desenho ou Assinatura', run: () => setShowDrawingModal(true) },
    { label: 'Traduzir documento para outro idioma', run: () => setShowTranslateModal(true) },
    { label: 'Fazer download como Markdown (.md)', run: () => handleDownloadDocument('md') },
  ];

  return (
    <div
      data-testid="docs-app"
      className={`flex flex-col h-full select-none relative overflow-hidden ${bgMain}`}
      onClick={() => {
        setOpenMenu(null);
        setShowSmartChipMenu(false);
        setShowTableGridPicker(false);
        setShowTextColorPicker(false);
        setShowHighlightPicker(false);
        setShowLineSpacingMenu(false);
      }}
    >
      {/* Hidden Image Upload Input */}
      <input
        ref={imageUploadRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            insertHtmlAtCursor(
              `<div style="margin:12px 0;"><img src="${reader.result}" alt="${escapeHtml(file.name)}" style="max-width:100%;max-height:360px;border-radius:8px;" /></div><p><br/></p>`
            );
            toast(`Imagem "${file.name}" inserida`);
          };
          reader.readAsDataURL(file);
        }}
      />

      {/* TOP HEADER BAR: Row 1 (Icon + Title + Right Collaboration Actions), Row 2 (Full-Width Classic Menu Bar) */}
      <header className={`px-2.5 sm:px-4 pt-2 pb-1.5 border-b ${bgHeader} flex flex-col gap-1 shrink-0`}>
        <div className="flex items-center justify-between gap-2 sm:gap-4 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              type="button"
              data-testid="docs-gallery-btn"
              aria-label="Documentos do Google Drive"
              onClick={(e) => {
                e.stopPropagation();
                setShowTemplateModal(true);
              }}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center shrink-0 hover:scale-105 transition-transform"
              title="Documentos do Google Drive"
            >
              <GoogleIcons.Docs className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
              <input
                data-testid="docs-title-input"
                type="text"
                aria-label="Título do documento"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                className="text-sm sm:text-base font-semibold px-1.5 py-0.5 rounded-lg border border-transparent hover:border-blue-500/40 focus:border-[#1A73E8] bg-transparent outline-none truncate min-w-0 flex-1 max-w-[165px] sm:max-w-[260px] lg:max-w-[320px]"
              />

              <button
                type="button"
                data-testid="docs-star-btn"
                aria-label={isStarred ? 'Remover estrela' : 'Adicionar estrela'}
                onClick={handleToggleStar}
                className={`p-1.5 rounded-lg shrink-0 ${hoverBtn}`}
                title={isStarred ? 'Remover estrela' : 'Adicionar estrela'}
              >
                <Star
                  size={15}
                  className={isStarred ? 'text-amber-400 fill-amber-400' : textMuted}
                />
              </button>

              {/* Document Switcher Dropdown for Drive Docs (desktop/tablet) */}
              <select
                data-testid="docs-switcher-select"
                aria-label="Alternar documento do Google Drive"
                value={activeDocId}
                onChange={(e) => loadDocumentById(e.target.value)}
                className={`hidden md:block text-[11px] px-2 py-0.5 rounded-lg border max-w-[180px] truncate ${
                  isDarkMode ? 'bg-[#252934] border-white/10 text-white/80' : 'bg-white border-black/10 text-gray-700'
                } outline-none cursor-pointer`}
                title="Alternar documento do Google Drive"
              >
                {driveDocs.map((d) => (
                  <option key={d.id} value={d.id}>
                    📄 {d.name}
                  </option>
                ))}
              </select>

              <span className={`hidden lg:inline-flex text-[11px] ${textMuted} items-center gap-1 ml-1 shrink-0`}>
                {saveState === 'saving' ? (
                  <>Salvando no Drive...</>
                ) : (
                  <>
                    <Check size={12} className="text-emerald-500" /> Salvo no Drive
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Right Header Actions: Outline Toggle, Version History, Comments Button, Share Button, Close */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              type="button"
              data-testid="docs-toggle-outline-btn"
              aria-label="Alternar estrutura de tópicos e abas"
              onClick={() => setShowLeftOutline((v) => !v)}
              className={`p-1.5 sm:p-2 rounded-full ${
                showLeftOutline ? 'bg-[#1A73E8]/15 text-[#1A73E8]' : hoverBtn
              }`}
              title="Estrutura de tópicos e abas"
            >
              <ListTree size={16} />
            </button>

            <button
              type="button"
              data-testid="docs-versions-btn"
              aria-label="Histórico de versões"
              onClick={() => setShowVersionsModal(true)}
              className={`p-1.5 sm:p-2 rounded-full ${hoverBtn}`}
              title="Histórico de versões"
            >
              <Clock size={16} />
            </button>

            <button
              type="button"
              data-testid="docs-toggle-comments-btn"
              aria-label="Comentários e sugestões"
              onClick={() => setShowRightComments((v) => !v)}
              className={`px-2 sm:px-2.5 py-1.5 rounded-full border ${
                showRightComments ? 'bg-[#1A73E8]/15 border-[#1A73E8]/40 text-[#1A73E8]' : `${hoverBtn} border-transparent`
              } flex items-center gap-1 text-xs font-medium`}
              title="Comentários e sugestões"
            >
              <MessageSquare size={15} />
              <span>{openCommentsCount}</span>
            </button>

            <button
              type="button"
              data-testid="docs-share-btn"
              aria-label="Compartilhar documento"
              onClick={() => setShowShareModal(true)}
              className="px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-[#C2E7FF] text-[#001D35] hover:bg-[#A8D8F8] text-xs font-semibold flex items-center gap-1.5 shadow-sm"
            >
              {generalAccess === 'anyone' ? <Globe size={14} /> : <Lock size={14} />}
              <span className="hidden sm:inline">Compartilhar</span>
            </button>

            <button
              type="button"
              aria-label="Fechar Google Docs"
              onClick={onClose}
              className={`p-1.5 sm:p-2 rounded-full ${hoverBtn}`}
              title="Fechar Google Docs"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Classic Menu Bar (Full width so all 7 menus stay single-row on tablet/desktop & compact on mobile) */}
        <div
          className="flex items-center flex-wrap gap-x-0.5 gap-y-0.5 sm:pl-12 text-[11px] sm:text-xs relative"
          onClick={(e) => e.stopPropagation()}
        >
              {[
                { id: 'file', label: 'Arquivo' },
                { id: 'edit', label: 'Editar' },
                { id: 'view', label: 'Ver' },
                { id: 'insert', label: 'Inserir' },
                { id: 'format', label: 'Formatar' },
                { id: 'tools', label: 'Ferramentas' },
                { id: 'help', label: 'Ajuda' },
              ].map((menu) => (
                <div key={menu.id} className="relative">
                  <button
                    type="button"
                    data-testid={`docs-menu-${menu.id}`}
                    onClick={() => setOpenMenu(openMenu === menu.id ? null : menu.id)}
                    className={`px-1.5 sm:px-2 py-0.5 rounded-md ${
                      openMenu === menu.id ? 'bg-[#1A73E8]/15 text-[#1A73E8] font-medium' : hoverBtn
                    }`}
                  >
                    {menu.label}
                  </button>

                  {/* Dropdown Menu Panels */}
                  {openMenu === menu.id && (
                    <div
                      className={`absolute ${
                        menu.id === 'format' || menu.id === 'tools' || menu.id === 'help'
                          ? 'right-0 sm:left-0 sm:right-auto'
                          : 'left-0'
                      } top-7 w-60 sm:w-64 max-w-[calc(100vw-24px)] rounded-2xl border ${bgPanel} shadow-2xl py-1.5 z-50 text-xs`}
                    >
                      {menu.id === 'file' && (
                        <>
                          <button
                            onClick={() => handleCreateNewDocument()}
                            className={`w-full flex items-center justify-between px-3.5 py-2 ${hoverBtn}`}
                          >
                            <span className="flex items-center gap-2.5">
                              <Plus size={14} className="text-[#1A73E8]" /> Novo documento em branco
                            </span>
                          </button>
                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              setShowTemplateModal(true);
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2 ${hoverBtn}`}
                          >
                            <span className="flex items-center gap-2.5">
                              <FileText size={14} className="text-[#1A73E8]" /> Abrir documento do Drive...
                            </span>
                          </button>
                          <button
                            onClick={handleDuplicateDocument}
                            className={`w-full flex items-center justify-between px-3.5 py-2 ${hoverBtn}`}
                          >
                            <span className="flex items-center gap-2.5">
                              <Copy size={14} /> Fazer uma cópia
                            </span>
                          </button>
                          <div className="my-1 border-t border-white/10" />
                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              setShowShareModal(true);
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2 ${hoverBtn}`}
                          >
                            <span className="flex items-center gap-2.5">
                              <Share2 size={14} /> Compartilhar
                            </span>
                          </button>
                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              onOpenApp?.('mail', {
                                composeSubject: `Documento: ${title}`,
                                composeBody: activeTab?.html || '',
                              });
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2 ${hoverBtn}`}
                          >
                            <span className="flex items-center gap-2.5">
                              <Mail size={14} /> Enviar por e-mail (Gmail)
                            </span>
                          </button>
                          <div className="my-1 border-t border-white/10" />
                          <div className="px-3.5 py-1 text-[10px] font-semibold uppercase tracking-wider opacity-60">
                            Fazer download
                          </div>
                          <button
                            data-testid="docs-download-md"
                            onClick={() => handleDownloadDocument('md')}
                            className={`w-full flex items-center justify-between px-3.5 py-1.5 ${hoverBtn}`}
                          >
                            <span>Markdown (.md)</span>
                          </button>
                          <button
                            onClick={() => handleDownloadDocument('html')}
                            className={`w-full flex items-center justify-between px-3.5 py-1.5 ${hoverBtn}`}
                          >
                            <span>Página Web (.html)</span>
                          </button>
                          <button
                            onClick={() => handleDownloadDocument('txt')}
                            className={`w-full flex items-center justify-between px-3.5 py-1.5 ${hoverBtn}`}
                          >
                            <span>Texto sem formatação (.txt)</span>
                          </button>
                          <button
                            onClick={() => handleDownloadDocument('pdf')}
                            className={`w-full flex items-center justify-between px-3.5 py-1.5 ${hoverBtn}`}
                          >
                            <span>Documento PDF / Imprimir (.pdf)</span>
                          </button>
                          <div className="my-1 border-t border-white/10" />
                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              setShowVersionsModal(true);
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2 ${hoverBtn}`}
                          >
                            <span className="flex items-center gap-2.5">
                              <Clock size={14} /> Histórico de versões
                            </span>
                          </button>
                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              setShowPageSetupModal(true);
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2 ${hoverBtn}`}
                          >
                            <span className="flex items-center gap-2.5">
                              <Settings size={14} /> Configuração da página
                            </span>
                          </button>
                        </>
                      )}

                      {menu.id === 'edit' && (
                        <>
                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              execFormat('undo');
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2 ${hoverBtn}`}
                          >
                            <span className="flex items-center gap-2.5">
                              <Undo2 size={14} /> Desfazer
                            </span>
                            <kbd className="text-[10px] opacity-60">Ctrl+Z</kbd>
                          </button>
                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              execFormat('redo');
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2 ${hoverBtn}`}
                          >
                            <span className="flex items-center gap-2.5">
                              <Redo2 size={14} /> Refazer
                            </span>
                            <kbd className="text-[10px] opacity-60">Ctrl+Y</kbd>
                          </button>
                          <div className="my-1 border-t border-white/10" />
                          <button
                            data-testid="docs-open-find-replace"
                            onClick={() => {
                              setOpenMenu(null);
                              setShowFindReplaceModal(true);
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2 ${hoverBtn}`}
                          >
                            <span className="flex items-center gap-2.5">
                              <Search size={14} /> Localizar e substituir
                            </span>
                            <kbd className="text-[10px] opacity-60">Ctrl+H</kbd>
                          </button>
                        </>
                      )}

                      {menu.id === 'view' && (
                        <>
                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              setPageSetup((p) => ({ ...p, pageless: !p.pageless }));
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2 ${hoverBtn}`}
                          >
                            <span>Modo sem páginas (Pageless)</span>
                            {pageSetup.pageless && <Check size={14} className="text-[#1A73E8]" />}
                          </button>
                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              setShowRuler((r) => !r);
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2 ${hoverBtn}`}
                          >
                            <span>Mostrar régua horizontal</span>
                            {showRuler && <Check size={14} className="text-[#1A73E8]" />}
                          </button>
                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              setShowLeftOutline((o) => !o);
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2 ${hoverBtn}`}
                          >
                            <span>Mostrar estrutura de tópicos e abas</span>
                            {showLeftOutline && <Check size={14} className="text-[#1A73E8]" />}
                          </button>
                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              setShowRightComments((c) => !c);
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2 ${hoverBtn}`}
                          >
                            <span>Mostrar painel de comentários</span>
                            {showRightComments && <Check size={14} className="text-[#1A73E8]" />}
                          </button>
                        </>
                      )}

                      {menu.id === 'insert' && (
                        <>
                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              imageUploadRef.current?.click();
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2 ${hoverBtn}`}
                          >
                            <span className="flex items-center gap-2.5">
                              <ImageIcon size={14} /> Imagem do computador
                            </span>
                          </button>
                          <button
                            onClick={() => handleInsertTable(3, 3)}
                            className={`w-full flex items-center justify-between px-3.5 py-2 ${hoverBtn}`}
                          >
                            <span className="flex items-center gap-2.5">
                              <TableIcon size={14} /> Tabela (3x3)
                            </span>
                          </button>
                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              setShowDrawingModal(true);
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2 ${hoverBtn}`}
                          >
                            <span className="flex items-center gap-2.5">
                              <PenTool size={14} /> Desenho / Assinatura
                            </span>
                          </button>
                          <div className="my-1 border-t border-white/10" />
                          <div className="px-3.5 py-1 text-[10px] font-semibold uppercase tracking-wider opacity-60">
                            Smart Chips (@)
                          </div>
                          <button
                            onClick={() => handleInsertSmartChip('person', selfName)}
                            className={`w-full flex items-center gap-2.5 px-3.5 py-1.5 ${hoverBtn}`}
                          >
                            <User size={13} className="text-blue-500" /> Chip de Pessoa (@{selfName})
                          </button>
                          <button
                            onClick={() => handleInsertSmartChip('date')}
                            className={`w-full flex items-center gap-2.5 px-3.5 py-1.5 ${hoverBtn}`}
                          >
                            <Calendar size={13} className="text-emerald-500" /> Chip de Data (@Hoje)
                          </button>
                          <button
                            onClick={() => handleInsertSmartChip('status', 'Aprovado')}
                            className={`w-full flex items-center gap-2.5 px-3.5 py-1.5 ${hoverBtn}`}
                          >
                            <Check size={13} className="text-emerald-500" /> Status Dropdown (@Aprovado)
                          </button>
                          <button
                            onClick={() => handleInsertSmartChip('meeting')}
                            className={`w-full flex items-center gap-2.5 px-3.5 py-1.5 ${hoverBtn}`}
                          >
                            <FileText size={13} className="text-purple-500" /> Bloco de Notas de Reunião
                          </button>
                          <button
                            onClick={() => handleInsertSmartChip('code')}
                            className={`w-full flex items-center gap-2.5 px-3.5 py-1.5 ${hoverBtn}`}
                          >
                            <Code size={13} className="text-amber-500" /> Bloco de Código
                          </button>
                          <div className="my-1 border-t border-white/10" />
                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              insertHtmlAtCursor('<hr style="border:none;border-top:1px solid #CBD5E1;margin:18px 0;" /><p><br/></p>');
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2 ${hoverBtn}`}
                          >
                            <span>Linha horizontal</span>
                          </button>
                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              insertHtmlAtCursor(
                                '<div contenteditable="false" style="margin:24px -32px;border-top:2px dashed #94A3B8;text-align:center;font-size:10px;color:#64748B;padding-top:4px;">— Quebra de Página —</div><p><br/></p>'
                              );
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2 ${hoverBtn}`}
                          >
                            <span>Quebra de página</span>
                          </button>
                        </>
                      )}

                      {menu.id === 'format' && (
                        <>
                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              execFormat('bold');
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2 ${hoverBtn}`}
                          >
                            <span className="flex items-center gap-2.5">
                              <Bold size={14} /> Negrito
                            </span>
                            <kbd className="text-[10px] opacity-60">Ctrl+B</kbd>
                          </button>
                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              execFormat('italic');
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2 ${hoverBtn}`}
                          >
                            <span className="flex items-center gap-2.5">
                              <Italic size={14} /> Itálico
                            </span>
                            <kbd className="text-[10px] opacity-60">Ctrl+I</kbd>
                          </button>
                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              execFormat('strikeThrough');
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2 ${hoverBtn}`}
                          >
                            <span className="flex items-center gap-2.5">
                              <Strikethrough size={14} /> Tachado
                            </span>
                          </button>
                          <div className="my-1 border-t border-white/10" />
                          <div className="px-3.5 py-1 text-[10px] font-semibold uppercase tracking-wider opacity-60">
                            Espaçamento entre linhas
                          </div>
                          {(['1.0', '1.15', '1.5', '2.0'] as const).map((sp) => (
                            <button
                              key={sp}
                              type="button"
                              onClick={() => handleChangeLineSpacing(sp)}
                              className={`w-full flex items-center justify-between px-3.5 py-1.5 ${hoverBtn}`}
                            >
                              <span>Espaçamento {sp}</span>
                              {lineSpacing === sp && <Check size={14} className="text-[#1A73E8]" />}
                            </button>
                          ))}
                          <div className="my-1 border-t border-white/10" />
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenu(null);
                              setPageSetup((p) => ({ ...p, columns: p.columns === 1 ? 2 : 1 }));
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2 ${hoverBtn}`}
                          >
                            <span className="flex items-center gap-2.5">
                              <Columns size={14} /> Alternar 1 / 2 Colunas ({pageSetup.columns} col)
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenu(null);
                              execFormat('removeFormat');
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2 ${hoverBtn}`}
                          >
                            <span className="flex items-center gap-2.5">
                              <RemoveFormatting size={14} /> Limpar formatação
                            </span>
                          </button>
                        </>
                      )}

                      {menu.id === 'tools' && (
                        <>
                          <button
                            data-testid="docs-open-word-count"
                            onClick={() => {
                              setOpenMenu(null);
                              setShowWordCountModal(true);
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2 ${hoverBtn}`}
                          >
                            <span>Contagem de palavras</span>
                            <kbd className="text-[10px] opacity-60">Ctrl+Shift+C</kbd>
                          </button>
                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              setShowTranslateModal(true);
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2 ${hoverBtn}`}
                          >
                            <span className="flex items-center gap-2.5">
                              <Languages size={14} /> Traduzir documento...
                            </span>
                          </button>
                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              handleToggleVoiceTyping();
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2 ${hoverBtn}`}
                          >
                            <span className="flex items-center gap-2.5">
                              <Mic size={14} /> Digitação por voz
                            </span>
                          </button>
                        </>
                      )}

                      {menu.id === 'help' && (
                        <>
                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              setShowCommandPalette(true);
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2 ${hoverBtn}`}
                          >
                            <span className="flex items-center gap-2.5">
                              <Search size={14} /> Pesquisar nos menus
                            </span>
                            <kbd className="text-[10px] opacity-60">Alt+/</kbd>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
        </div>
      </header>

      {/* CLASSIC FORMATTING TOOLBAR (relative wrapper prevents overflow-x-auto from clipping popovers) */}
      <div
        className="relative mx-2 sm:mx-3 my-1.5 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`px-2.5 sm:px-3 py-1 rounded-full border ${bgToolbar} flex items-center justify-between gap-1 overflow-x-auto no-scrollbar`}
        >
          <div className="flex items-center gap-0.5">
            {/* Search Menus */}
            <button
              type="button"
              data-testid="docs-toolbar-search-menus"
              aria-label="Pesquisar nos menus"
              onClick={() => setShowCommandPalette(true)}
              className={`p-1.5 rounded-full ${hoverBtn}`}
              title="Pesquisar nos menus (Alt+/)"
            >
              <Search size={14} />
            </button>
            <button type="button" aria-label="Desfazer" onClick={() => execFormat('undo')} className={`p-1.5 rounded-lg ${hoverBtn}`} title="Desfazer (Ctrl+Z)">
              <Undo2 size={14} />
            </button>
            <button type="button" aria-label="Refazer" onClick={() => execFormat('redo')} className={`p-1.5 rounded-lg ${hoverBtn}`} title="Refazer (Ctrl+Y)">
              <Redo2 size={14} />
            </button>
            <button type="button" aria-label="Imprimir" onClick={() => window.print()} className={`p-1.5 rounded-lg ${hoverBtn}`} title="Imprimir (Ctrl+P)">
              <Printer size={14} />
            </button>
            <button
              type="button"
              aria-label="Pintor de formatação"
              onClick={() => {
                if (copiedFormat) {
                  setFontFamily(copiedFormat.fontFamily);
                  setFontSizePt(copiedFormat.fontSizePt);
                  setCopiedFormat(null);
                  toast('Formatação aplicada');
                } else {
                  setCopiedFormat({ fontFamily, fontSizePt });
                  toast('Formatação copiada');
                }
              }}
              className={`p-1.5 rounded-lg ${copiedFormat ? 'bg-[#1A73E8]/20 text-[#1A73E8]' : hoverBtn}`}
              title="Pintor de formatação"
            >
              <Paintbrush size={14} />
            </button>

            {/* Zoom Select */}
            <select
              data-testid="docs-zoom-select"
              aria-label="Zoom da página"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="text-xs bg-transparent px-1.5 py-1 rounded-lg outline-none cursor-pointer font-medium"
              title="Zoom da página"
            >
              {[50, 75, 100, 125, 150].map((z) => (
                <option key={z} value={z} className="text-black">
                  {z}%
                </option>
              ))}
            </select>

            <div className="w-[1px] h-4 bg-current opacity-15 mx-1" />

            {/* Heading Style Select */}
            <select
              data-testid="docs-heading-select"
              aria-label="Estilos de parágrafo"
              value={headingStyle}
              onChange={(e) => handleApplyHeading(e.target.value)}
              className="text-xs bg-transparent px-2 py-1 rounded-lg outline-none cursor-pointer font-medium max-w-[120px]"
              title="Estilos de parágrafo"
            >
              <option value="p" className="text-black">Texto normal</option>
              <option value="h1" className="text-black font-bold">Título 1</option>
              <option value="h2" className="text-black font-semibold">Título 2</option>
              <option value="h3" className="text-black">Título 3</option>
            </select>

            <div className="w-[1px] h-4 bg-current opacity-15 mx-1" />

            {/* Font Family Select */}
            <select
              data-testid="docs-font-select"
              aria-label="Fonte"
              value={fontFamily}
              onChange={(e) => {
                setFontFamily(e.target.value);
                execFormat('fontName', e.target.value);
              }}
              className="text-xs bg-transparent px-2 py-1 rounded-lg outline-none cursor-pointer max-w-[130px] truncate"
              title="Fonte"
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f.label} value={f.value} className="text-black">
                  {f.label}
                </option>
              ))}
            </select>

            <div className="w-[1px] h-4 bg-current opacity-15 mx-1" />

            {/* Font Size Controls */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                aria-label="Diminuir tamanho da fonte"
                onClick={() => handleApplyFontSize(fontSizePt - 1)}
                className={`p-1 rounded ${hoverBtn}`}
                title="Diminuir tamanho da fonte"
              >
                <Minus size={12} />
              </button>
              <input
                type="number"
                aria-label="Tamanho da fonte"
                value={fontSizePt}
                onChange={(e) => handleApplyFontSize(Number(e.target.value) || 11)}
                className="w-8 text-center text-xs bg-transparent border border-current/20 rounded py-0.5 outline-none tabular-nums"
              />
              <button
                type="button"
                aria-label="Aumentar tamanho da fonte"
                onClick={() => handleApplyFontSize(fontSizePt + 1)}
                className={`p-1 rounded ${hoverBtn}`}
                title="Aumentar tamanho da fonte"
              >
                <Plus size={12} />
              </button>
            </div>

            <div className="w-[1px] h-4 bg-current opacity-15 mx-1" />

            {/* Text Formatting Buttons */}
            <button
              type="button"
              data-testid="docs-bold-btn"
              aria-label="Negrito"
              onClick={() => execFormat('bold')}
              className={`p-1.5 rounded-lg ${isBold ? 'bg-[#1A73E8]/20 text-[#1A73E8]' : hoverBtn}`}
              title="Negrito (Ctrl+B)"
            >
              <Bold size={14} />
            </button>
            <button
              type="button"
              aria-label="Itálico"
              onClick={() => execFormat('italic')}
              className={`p-1.5 rounded-lg ${isItalic ? 'bg-[#1A73E8]/20 text-[#1A73E8]' : hoverBtn}`}
              title="Itálico (Ctrl+I)"
            >
              <Italic size={14} />
            </button>
            <button
              type="button"
              aria-label="Sublinhado"
              onClick={() => execFormat('underline')}
              className={`p-1.5 rounded-lg ${isUnderline ? 'bg-[#1A73E8]/20 text-[#1A73E8]' : hoverBtn}`}
              title="Sublinhado (Ctrl+U)"
            >
              <Underline size={14} />
            </button>
            <button
              type="button"
              aria-label="Tachado"
              onClick={() => execFormat('strikeThrough')}
              className={`p-1.5 rounded-lg ${isStrike ? 'bg-[#1A73E8]/20 text-[#1A73E8]' : hoverBtn}`}
              title="Tachado"
            >
              <Strikethrough size={14} />
            </button>

            {/* Text Color Trigger */}
            <button
              type="button"
              aria-label="Cor do texto"
              onClick={() => {
                setShowTextColorPicker((v) => !v);
                setShowHighlightPicker(false);
                setShowTableGridPicker(false);
                setShowSmartChipMenu(false);
                setShowLineSpacingMenu(false);
              }}
              className={`p-1.5 rounded-lg ${showTextColorPicker ? 'bg-[#1A73E8]/20 text-[#1A73E8]' : hoverBtn} font-bold text-xs flex flex-col items-center`}
              title="Cor do texto"
            >
              <span className="leading-none">A</span>
              <span className="w-3.5 h-1 bg-[#1A73E8] rounded-full mt-0.5" />
            </button>

            {/* Highlight Color Trigger */}
            <button
              type="button"
              aria-label="Cor de destaque"
              onClick={() => {
                setShowHighlightPicker((v) => !v);
                setShowTextColorPicker(false);
                setShowTableGridPicker(false);
                setShowSmartChipMenu(false);
                setShowLineSpacingMenu(false);
              }}
              className={`p-1.5 rounded-lg ${showHighlightPicker ? 'bg-[#1A73E8]/20 text-[#1A73E8]' : hoverBtn} text-xs flex flex-col items-center`}
              title="Cor de destaque (Marca-texto)"
            >
              <Edit3 size={12} />
              <span className="w-3.5 h-1 bg-yellow-300 rounded-full mt-0.5" />
            </button>

            <div className="w-[1px] h-4 bg-current opacity-15 mx-1" />

            {/* Link, Comment, Image, Table, Smart Chip (@) */}
            <button
              type="button"
              aria-label="Inserir link"
              onClick={() => setShowLinkModal(true)}
              className={`p-1.5 rounded-lg ${hoverBtn}`}
              title="Inserir link (Ctrl+K)"
            >
              <Link2 size={14} />
            </button>
            <button
              type="button"
              data-testid="docs-add-comment-btn"
              aria-label="Adicionar comentário"
              onClick={handleOpenAddComment}
              className={`p-1.5 rounded-lg ${hoverBtn}`}
              title="Adicionar comentário (Ctrl+Alt+M)"
            >
              <MessageSquarePlus size={14} />
            </button>
            <button
              type="button"
              aria-label="Inserir imagem"
              onClick={() => imageUploadRef.current?.click()}
              className={`p-1.5 rounded-lg ${hoverBtn}`}
              title="Inserir imagem"
            >
              <ImageIcon size={14} />
            </button>

            {/* Table Picker Trigger */}
            <button
              type="button"
              data-testid="docs-insert-table-btn"
              aria-label="Inserir tabela"
              onClick={() => {
                setShowTableGridPicker((v) => !v);
                setShowTextColorPicker(false);
                setShowHighlightPicker(false);
                setShowSmartChipMenu(false);
                setShowLineSpacingMenu(false);
              }}
              className={`p-1.5 rounded-lg ${showTableGridPicker ? 'bg-[#1A73E8]/20 text-[#1A73E8]' : hoverBtn}`}
              title="Inserir tabela"
            >
              <TableIcon size={14} />
            </button>

            {/* Smart Chip (@) Trigger */}
            <button
              type="button"
              data-testid="docs-smart-chip-btn"
              aria-label="Inserir Smart Chip"
              onClick={() => {
                setShowSmartChipMenu((v) => !v);
                setShowTextColorPicker(false);
                setShowHighlightPicker(false);
                setShowTableGridPicker(false);
                setShowLineSpacingMenu(false);
              }}
              className={`px-2 py-1 rounded-lg ${showSmartChipMenu ? 'bg-[#1A73E8]/20 text-[#1A73E8]' : `${hoverBtn} text-[#1A73E8]`} flex items-center gap-1 text-xs font-semibold`}
              title="Inserir Smart Chip (@)"
            >
              <AtSign size={13} />
              <span>Chip</span>
            </button>

            <div className="w-[1px] h-4 bg-current opacity-15 mx-1" />

            {/* Alignment, Line Spacing & Lists */}
            <button
              type="button"
              aria-label="Alinhar à esquerda"
              onClick={() => execFormat('justifyLeft')}
              className={`p-1.5 rounded-lg ${activeAlign === 'left' ? 'bg-[#1A73E8]/20 text-[#1A73E8]' : hoverBtn}`}
              title="Alinhar à esquerda"
            >
              <AlignLeft size={14} />
            </button>
            <button
              type="button"
              aria-label="Centralizar"
              onClick={() => execFormat('justifyCenter')}
              className={`p-1.5 rounded-lg ${activeAlign === 'center' ? 'bg-[#1A73E8]/20 text-[#1A73E8]' : hoverBtn}`}
              title="Centralizar"
            >
              <AlignCenter size={14} />
            </button>
            <button
              type="button"
              aria-label="Alinhar à direita"
              onClick={() => execFormat('justifyRight')}
              className={`p-1.5 rounded-lg ${activeAlign === 'right' ? 'bg-[#1A73E8]/20 text-[#1A73E8]' : hoverBtn}`}
              title="Alinhar à direita"
            >
              <AlignRight size={14} />
            </button>
            <button
              type="button"
              aria-label="Justificar"
              onClick={() => execFormat('justifyFull')}
              className={`p-1.5 rounded-lg ${activeAlign === 'justify' ? 'bg-[#1A73E8]/20 text-[#1A73E8]' : hoverBtn}`}
              title="Justificar"
            >
              <AlignJustify size={14} />
            </button>

            {/* Line Spacing Trigger */}
            <button
              type="button"
              data-testid="docs-line-spacing-btn"
              aria-label="Espaçamento entre linhas"
              onClick={() => {
                setShowLineSpacingMenu((v) => !v);
                setShowTextColorPicker(false);
                setShowHighlightPicker(false);
                setShowTableGridPicker(false);
                setShowSmartChipMenu(false);
              }}
              className={`px-1.5 py-1 rounded-lg ${showLineSpacingMenu ? 'bg-[#1A73E8]/20 text-[#1A73E8]' : hoverBtn} flex items-center gap-0.5 text-[11px] font-medium tabular-nums`}
              title="Espaçamento entre linhas"
            >
              <ArrowUpDown size={13} />
              <span>{lineSpacing}</span>
            </button>

            <button
              type="button"
              aria-label="Inserir checklist"
              onClick={() => insertHtmlAtCursor('<ul><li>[ ] Novo item de checklist</li></ul>')}
              className={`p-1.5 rounded-lg ${hoverBtn}`}
              title="Inserir checklist"
            >
              <CheckSquare size={14} />
            </button>
            <button type="button" aria-label="Lista com marcadores" onClick={() => execFormat('insertUnorderedList')} className={`p-1.5 rounded-lg ${hoverBtn}`} title="Lista com marcadores">
              <List size={14} />
            </button>
            <button type="button" aria-label="Lista numerada" onClick={() => execFormat('insertOrderedList')} className={`p-1.5 rounded-lg ${hoverBtn}`} title="Lista numerada">
              <ListOrdered size={14} />
            </button>
            <button type="button" aria-label="Diminuir recuo" onClick={() => execFormat('outdent')} className={`p-1.5 rounded-lg ${hoverBtn}`} title="Diminuir recuo">
              <Outdent size={14} />
            </button>
            <button type="button" aria-label="Aumentar recuo" onClick={() => execFormat('indent')} className={`p-1.5 rounded-lg ${hoverBtn}`} title="Aumentar recuo">
              <Indent size={14} />
            </button>
            <button type="button" aria-label="Limpar formatação" onClick={() => execFormat('removeFormat')} className={`p-1.5 rounded-lg ${hoverBtn}`} title="Limpar formatação">
              <RemoveFormatting size={14} />
            </button>
          </div>

          {/* Right Mode Switcher: Edição / Sugestão / Visualização */}
          <div className="flex items-center gap-1 shrink-0 pl-2">
            <select
              data-testid="docs-mode-select"
              aria-label="Modo do documento"
              value={docMode}
              onChange={(e) => setDocMode(e.target.value as 'editing' | 'suggesting' | 'viewing')}
              className={`text-xs font-semibold px-2.5 py-1 rounded-full border outline-none cursor-pointer ${
                docMode === 'suggesting'
                  ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                  : docMode === 'viewing'
                  ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                  : 'bg-[#1A73E8]/15 text-[#1A73E8] border-[#1A73E8]/30'
              }`}
            >
              <option value="editing" className="text-black">✎ Edição</option>
              <option value="suggesting" className="text-black">💬 Sugestão</option>
              <option value="viewing" className="text-black">👁 Visualização</option>
            </select>
          </div>
        </div>

        {/* FLOATING TOOLBAR POPOVERS (rendered outside overflow-x-auto so they never clip) */}
        {showTextColorPicker && (
          <div className={`absolute top-full mt-1.5 left-4 sm:left-64 p-2.5 rounded-2xl border ${bgPanel} shadow-2xl flex items-center gap-2 z-40`}>
            <span className={`text-[11px] font-medium ${textMuted}`}>Cor:</span>
            {TEXT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Cor de texto ${c}`}
                onClick={() => {
                  execFormat('foreColor', c);
                  setShowTextColorPicker(false);
                }}
                className="w-6 h-6 rounded-full border border-black/20"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}

        {showHighlightPicker && (
          <div className={`absolute top-full mt-1.5 left-4 sm:left-72 p-2.5 rounded-2xl border ${bgPanel} shadow-2xl flex items-center gap-2 z-40`}>
            <span className={`text-[11px] font-medium ${textMuted}`}>Destaque:</span>
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c === 'transparent' ? 'Sem destaque' : `Destaque ${c}`}
                onClick={() => {
                  execFormat('hiliteColor', c);
                  setShowHighlightPicker(false);
                }}
                className="w-6 h-6 rounded-full border border-black/20"
                style={{ backgroundColor: c === 'transparent' ? '#fff' : c }}
                title={c === 'transparent' ? 'Sem destaque' : c}
              />
            ))}
          </div>
        )}

        {showTableGridPicker && (
          <div className={`absolute top-full mt-1.5 left-4 sm:left-[420px] p-3 rounded-2xl border ${bgPanel} shadow-2xl z-40 w-44`}>
            <div className="text-[11px] font-semibold mb-2 text-center">
              Tabela {hoverTableDims.rows} × {hoverTableDims.cols}
            </div>
            <div className="grid grid-cols-5 gap-1">
              {Array.from({ length: 25 }).map((_, idx) => {
                const r = Math.floor(idx / 5) + 1;
                const c = (idx % 5) + 1;
                const active = r <= hoverTableDims.rows && c <= hoverTableDims.cols;
                return (
                  <button
                    key={idx}
                    type="button"
                    data-testid={`docs-table-cell-${r}x${c}`}
                    aria-label={`Inserir tabela ${r} por ${c}`}
                    onMouseEnter={() => setHoverTableDims({ rows: r, cols: c })}
                    onClick={() => handleInsertTable(r, c)}
                    className={`w-6 h-6 rounded border ${
                      active ? 'bg-[#1A73E8]/30 border-[#1A73E8]' : 'border-current/20'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        )}

        {showSmartChipMenu && (
          <div className={`absolute top-full mt-1.5 left-4 sm:left-[460px] w-60 max-w-[calc(100vw-32px)] rounded-2xl border ${bgPanel} shadow-2xl p-1.5 z-40 text-xs`}>
            <button
              type="button"
              data-testid="docs-chip-person"
              onClick={() => handleInsertSmartChip('person', selfName)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl ${hoverBtn}`}
            >
              <User size={13} className="text-blue-500" /> @{selfName} (Pessoa)
            </button>
            <button
              type="button"
              onClick={() => handleInsertSmartChip('date')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl ${hoverBtn}`}
            >
              <Calendar size={13} className="text-emerald-500" /> @Data de Hoje
            </button>
            <button
              type="button"
              onClick={() => handleInsertSmartChip('status', 'Em andamento')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl ${hoverBtn}`}
            >
              <Check size={13} className="text-amber-500" /> @Status (Em andamento)
            </button>
            <button
              type="button"
              onClick={() => handleInsertSmartChip('drive', title || 'Documento do Drive')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl ${hoverBtn}`}
            >
              <FileText size={13} className="text-emerald-500" /> @Arquivo do Drive
            </button>
            <button
              type="button"
              onClick={() => handleInsertSmartChip('meeting')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl ${hoverBtn}`}
            >
              <Layers size={13} className="text-purple-500" /> @Notas de Reunião
            </button>
          </div>
        )}

        {showLineSpacingMenu && (
          <div className={`absolute top-full mt-1.5 right-4 sm:right-40 w-44 rounded-2xl border ${bgPanel} shadow-2xl p-1.5 z-40 text-xs`}>
            <div className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>
              Espaçamento
            </div>
            {(['1.0', '1.15', '1.5', '2.0'] as const).map((sp) => (
              <button
                key={sp}
                type="button"
                data-testid={`docs-spacing-${sp}`}
                onClick={() => handleChangeLineSpacing(sp)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl ${hoverBtn}`}
              >
                <span>{sp === '1.0' ? 'Simples (1.0)' : sp === '2.0' ? 'Duplo (2.0)' : sp}</span>
                {lineSpacing === sp && <Check size={13} className="text-[#1A73E8]" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* HORIZONTAL RULER (desktop/tablet only) */}
      {showRuler && !pageSetup.pageless && (
        <div
          className={`hidden md:flex h-5 border-b ${
            isDarkMode ? 'bg-[#1B1E26] border-white/10 text-white/40' : 'bg-[#F1F3F4] border-black/10 text-gray-500'
          } items-center justify-center shrink-0 text-[9px] font-mono select-none`}
        >
          <div className="w-full max-w-[816px] flex items-center justify-between px-8">
            {Array.from({ length: 19 }).map((_, idx) => (
              <span key={idx} className="flex flex-col items-center">
                <span>{idx + 1}</span>
                <span className="w-[1px] h-1.5 bg-current opacity-40" />
              </span>
            ))}
          </div>
        </div>
      )}

      {/* MAIN WORKSPACE BODY: Left Document Tabs & Outline + Center Canvas + Right Comments Drawer */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {/* LEFT SIDEBAR: DOCUMENT TABS & OUTLINE (overlay drawer on < lg, static sidebar on lg+) */}
        {showLeftOutline && (
          <>
            <div
              className="absolute inset-0 bg-black/30 z-20 lg:hidden"
              onClick={() => setShowLeftOutline(false)}
            />
            <aside
              data-testid="docs-left-outline"
              className={`absolute inset-y-0 left-0 z-30 w-64 shadow-2xl lg:static lg:shadow-none border-r ${bgPanel} flex flex-col justify-between overflow-y-auto custom-scrollbar p-3.5 shrink-0 text-xs`}
            >
              <div className="space-y-5">
                {/* Document Tabs Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${textMuted}`}>
                      Abas do documento
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        data-testid="docs-add-tab-btn"
                        aria-label="Adicionar nova aba ao documento"
                        onClick={handleAddDocTab}
                        className={`p-1 rounded-lg ${hoverBtn} text-[#1A73E8]`}
                        title="Adicionar nova aba ao documento"
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label="Fechar estrutura de tópicos"
                        onClick={() => setShowLeftOutline(false)}
                        className={`p-1 rounded-lg lg:hidden ${hoverBtn}`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {tabs.map((tab) => {
                      const isActive = tab.id === activeTabId;
                      return (
                        <div
                          key={tab.id}
                          data-testid={`docs-tab-${tab.id}`}
                          onClick={() => setActiveTabId(tab.id)}
                          onDoubleClick={() => {
                            setRenamingTabId(tab.id);
                            setRenamingTabValue(tab.title);
                          }}
                          className={`group flex items-center justify-between px-2.5 py-2 rounded-xl cursor-pointer ${
                            isActive ? 'bg-[#1A73E8]/15 text-[#1A73E8] font-semibold' : hoverBtn
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span>{tab.icon}</span>
                            {renamingTabId === tab.id ? (
                              <input
                                type="text"
                                value={renamingTabValue}
                                onChange={(e) => setRenamingTabValue(e.target.value)}
                                onBlur={() => {
                                  const next = tabs.map((t) =>
                                    t.id === tab.id ? { ...t, title: renamingTabValue.trim() || t.title } : t
                                  );
                                  setTabs(next);
                                  setRenamingTabId(null);
                                  persistBundle(next, comments, versions, pageSetup);
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                                autoFocus
                                className="bg-transparent border-b border-[#1A73E8] outline-none w-full text-xs"
                              />
                            ) : (
                              <span className="truncate">{tab.title}</span>
                            )}
                          </div>
                          {tabs.length > 1 && (
                            <button
                              type="button"
                              aria-label={`Excluir aba ${tab.title}`}
                              onClick={(e) => handleDeleteDocTab(tab.id, e)}
                              className="opacity-60 sm:opacity-0 sm:group-hover:opacity-100 p-1 rounded hover:text-red-500"
                              title="Excluir aba"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Automatic Document Outline (Headings H1, H2, H3) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${textMuted}`}>
                      Estrutura de tópicos
                    </span>
                    <ListTree size={13} className={textMuted} />
                  </div>

                  {outline.length === 0 ? (
                    <p className={`text-[11px] ${textMuted} leading-relaxed`}>
                      Os títulos (H1, H2, H3) que você adicionar ao documento aparecerão aqui.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {outline.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            handleScrollToHeading(item.text);
                            if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                              setShowLeftOutline(false);
                            }
                          }}
                          style={{ paddingLeft: `${(item.level - 1) * 12 + 8}px` }}
                          className={`w-full text-left py-1.5 pr-2 rounded-lg ${hoverBtn} truncate ${
                            item.level === 1 ? 'font-semibold' : textMuted
                          }`}
                        >
                          {item.text}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Live Word Count Pill inside Sidebar */}
              {showLiveWordCount && (
                <button
                  type="button"
                  data-testid="docs-live-word-count-pill"
                  onClick={() => setShowWordCountModal(true)}
                  className={`w-full mt-4 p-2.5 rounded-xl border ${
                    isDarkMode ? 'bg-white/[0.03] border-white/10' : 'bg-[#F1F5F9] border-black/10'
                  } flex items-center justify-between text-[11px] tabular-nums hover:border-[#1A73E8]/50`}
                >
                  <span className="font-semibold">{stats.words} palavras</span>
                  <span className={textMuted}>{stats.readingTimeMinutes} min leitura</span>
                </button>
              )}
            </aside>
          </>
        )}

        {/* CENTER DOCUMENT CANVAS */}
        <main
          className={`flex-1 min-w-0 overflow-y-auto overflow-x-auto custom-scrollbar flex justify-center py-4 px-2 sm:py-6 sm:px-4 md:py-8 md:px-6 ${
            isDarkMode ? 'bg-[#0F1115]' : 'bg-[#F0F4F9]'
          }`}
        >
          <div
            style={{
              maxWidth: zoom === 100 ? `${pageWidthPx}px` : undefined,
              width: zoom === 100 ? '100%' : `${pageWidthPx}px`,
              transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
              transformOrigin: 'top center',
              backgroundColor: pageSetup.pageColor || '#FFFFFF',
            }}
            className={`min-h-[680px] sm:min-h-[1056px] text-[#1F2937] shadow-[0_6px_28px_rgba(15,23,42,0.12)] ${
              pageSetup.pageless ? 'rounded-2xl' : 'rounded-sm'
            } flex flex-col justify-between shrink-0`}
          >
            {/* Editable Document Header */}
            {pageSetup.showHeaderFooter && (
              <div className="px-5 sm:px-10 md:px-16 pt-4 sm:pt-5 pb-2 border-b border-slate-200/70 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                <input
                  type="text"
                  aria-label="Cabeçalho do documento"
                  value={pageSetup.headerText}
                  onChange={(e) => {
                    const next = { ...pageSetup, headerText: e.target.value };
                    setPageSetup(next);
                    persistBundle(tabs, comments, versions, next);
                  }}
                  className="bg-transparent outline-none min-w-0 flex-1 hover:text-slate-700 focus:text-slate-900"
                  placeholder="Cabeçalho do documento..."
                />
                <span className="truncate max-w-[120px] sm:max-w-[200px] shrink-0">{title}</span>
              </div>
            )}

            {/* Main Rich-Text ContentEditable Surface */}
            <div
              ref={editorRef}
              data-testid="docs-editor-canvas"
              contentEditable={docMode !== 'viewing'}
              suppressContentEditableWarning
              onInput={syncEditorToActiveTab}
              onKeyUp={syncActiveFormatting}
              onMouseUp={syncActiveFormatting}
              style={{
                fontFamily,
                fontSize: `${fontSizePt}pt`,
                lineHeight: lineSpacing,
                columnCount: pageSetup.columns,
                columnGap: pageSetup.columns === 2 ? '36px' : undefined,
              }}
              className={`flex-1 outline-none ${marginPaddingClass} max-w-none break-words selection:bg-blue-500/20 [&_h1]:text-xl sm:[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-3 [&_h1]:mt-1 [&_h1]:text-slate-900 [&_h2]:text-base sm:[&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-slate-800 [&_h3]:text-sm sm:[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1.5 [&_p]:mb-2.5 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-3 [&_table]:block [&_table]:overflow-x-auto [&_table]:max-w-full sm:[&_table]:table [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_span[data-smart-chip]]:whitespace-nowrap [&_span[data-smart-chip]]:inline-block`}
            />

            {/* Editable Document Footer */}
            {pageSetup.showHeaderFooter && (
              <div className="px-5 sm:px-10 md:px-16 pb-4 sm:pb-5 pt-2 border-t border-slate-200/70 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                <input
                  type="text"
                  aria-label="Rodapé do documento"
                  value={pageSetup.footerText}
                  onChange={(e) => {
                    const next = { ...pageSetup, footerText: e.target.value };
                    setPageSetup(next);
                    persistBundle(tabs, comments, versions, next);
                  }}
                  className="bg-transparent outline-none min-w-0 flex-1 hover:text-slate-700 focus:text-slate-900"
                  placeholder="Rodapé do documento..."
                />
                {pageSetup.showPageNumbers && (
                  <span className="tabular-nums shrink-0">Página 1 de {stats.pages}</span>
                )}
              </div>
            )}
          </div>
        </main>

        {/* RIGHT SIDEBAR: COMMENTS, SUGGESTIONS & ACTION ITEMS (overlay on < xl, static on xl+) */}
        {showRightComments && (
          <>
            <div
              className="absolute inset-0 bg-black/30 z-20 xl:hidden"
              onClick={() => setShowRightComments(false)}
            />
            <aside
              data-testid="docs-right-comments"
              className={`absolute inset-y-0 right-0 z-30 w-[min(320px,calc(100%-16px))] shadow-2xl xl:static xl:w-80 xl:shadow-none border-l ${bgPanel} flex flex-col overflow-hidden shrink-0 text-xs`}
            >
              <div className="px-3.5 py-3 border-b border-current/10 flex items-center justify-between gap-2">
                <div className="font-bold flex items-center gap-1.5 min-w-0">
                  <MessageSquare size={15} className="text-[#1A73E8] shrink-0" />
                  <span className="truncate">Comentários ({openCommentsCount})</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    data-testid="docs-sidebar-new-comment-btn"
                    onClick={handleOpenAddComment}
                    className="px-2.5 py-1 rounded-lg bg-[#1A73E8] text-white font-semibold flex items-center gap-1"
                  >
                    <Plus size={12} /> Novo
                  </button>
                  <button
                    type="button"
                    aria-label="Fechar painel de comentários"
                    onClick={() => setShowRightComments(false)}
                    className={`p-1.5 rounded-lg xl:hidden ${hoverBtn}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Filter Tabs: Abertos / Resolvidos */}
              <div className="px-3.5 pt-2.5 pb-1 flex items-center gap-1.5 border-b border-current/10">
                <button
                  type="button"
                  data-testid="docs-comments-tab-open"
                  onClick={() => setCommentFilter('open')}
                  className={`flex-1 py-1.5 rounded-lg font-semibold text-[11px] ${
                    commentFilter === 'open'
                      ? 'bg-[#1A73E8]/15 text-[#1A73E8]'
                      : `${hoverBtn} ${textMuted}`
                  }`}
                >
                  Abertos ({openCommentsCount})
                </button>
                <button
                  type="button"
                  data-testid="docs-comments-tab-resolved"
                  onClick={() => setCommentFilter('resolved')}
                  className={`flex-1 py-1.5 rounded-lg font-semibold text-[11px] ${
                    commentFilter === 'resolved'
                      ? 'bg-[#1A73E8]/15 text-[#1A73E8]'
                      : `${hoverBtn} ${textMuted}`
                  }`}
                >
                  Resolvidos ({resolvedCommentsCount})
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3.5 space-y-3 custom-scrollbar">
                {visibleComments.length === 0 ? (
                  <div className="text-center py-10 space-y-2">
                    <MessageSquare size={28} className="mx-auto opacity-30" />
                    <p className="font-semibold">
                      {commentFilter === 'resolved'
                        ? 'Nenhum comentário resolvido'
                        : 'Nenhum comentário aberto'}
                    </p>
                    <p className={`text-[11px] ${textMuted}`}>
                      {commentFilter === 'resolved'
                        ? 'Os comentários marcados como resolvidos aparecerão aqui e podem ser reabertos.'
                        : 'Selecione qualquer trecho do documento e clique em "+ Novo" para comentar ou sugerir edições.'}
                    </p>
                  </div>
                ) : (
                  visibleComments.map((cmt) => (
                    <div
                      key={cmt.id}
                      data-testid={`docs-comment-card-${cmt.id}`}
                      className={`p-3.5 rounded-2xl border ${
                        isDarkMode ? 'bg-white/[0.03] border-white/10' : 'bg-[#F8FAFC] border-black/10'
                      } space-y-2.5`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold truncate">{cmt.author}</div>
                          <div className={`text-[10px] ${textMuted}`}>{cmt.createdAt}</div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {cmt.resolved ? (
                            <button
                              type="button"
                              data-testid={`docs-reopen-comment-${cmt.id}`}
                              onClick={() => handleToggleResolveComment(cmt.id)}
                              className="px-2 py-1 rounded-lg bg-blue-500/15 text-[#1A73E8] font-semibold flex items-center gap-1 text-[11px]"
                              title="Reabrir comentário"
                            >
                              <RotateCcw size={12} /> Reabrir
                            </button>
                          ) : cmt.isSuggestion ? (
                            <button
                              type="button"
                              data-testid={`docs-accept-suggestion-${cmt.id}`}
                              aria-label="Aceitar sugestão no texto"
                              onClick={() => handleAcceptSuggestion(cmt)}
                              className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 font-semibold"
                              title="Aceitar sugestão no texto"
                            >
                              <Check size={13} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              data-testid={`docs-resolve-comment-${cmt.id}`}
                              aria-label="Resolver comentário"
                              onClick={() => handleToggleResolveComment(cmt.id)}
                              className={`p-1.5 rounded-lg ${hoverBtn} text-emerald-500`}
                              title="Resolver comentário"
                            >
                              <Check size={13} />
                            </button>
                          )}
                          {!cmt.resolved && (
                            <button
                              type="button"
                              data-testid={`docs-task-comment-${cmt.id}`}
                              aria-label="Transformar comentário em tarefa"
                              onClick={() => handleCreateTaskFromComment(cmt)}
                              className={`p-1.5 rounded-lg ${hoverBtn} text-[#1A73E8]`}
                              title="Transformar comentário em tarefa no Google Tarefas"
                            >
                              <CheckSquare size={13} />
                            </button>
                          )}
                          <button
                            type="button"
                            data-testid={`docs-delete-comment-${cmt.id}`}
                            aria-label="Excluir comentário"
                            onClick={() => handleDeleteComment(cmt.id)}
                            className={`p-1.5 rounded-lg ${hoverBtn} text-red-500`}
                            title="Excluir comentário"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {cmt.quotedText && (
                        <div className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11px] truncate">
                          "{cmt.quotedText}"
                        </div>
                      )}

                      <p className="leading-relaxed break-words">{cmt.text}</p>

                      {/* Thread Replies */}
                      {cmt.replies.length > 0 && (
                        <div className="pt-2 border-t border-current/10 space-y-2">
                          {cmt.replies.map((rep) => (
                            <div key={rep.id} className="text-[11px]">
                              <span className="font-semibold">{rep.author}</span>{' '}
                              <span className={`text-[10px] ${textMuted}`}>· {rep.createdAt}</span>
                              <p className="mt-0.5 opacity-90 break-words">{rep.text}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reply Input (only for open comments) */}
                      {!cmt.resolved && (
                        <div className="flex items-center gap-1.5 pt-1">
                          <input
                            type="text"
                            value={replyInputs[cmt.id] || ''}
                            onChange={(e) => setReplyInputs((prev) => ({ ...prev, [cmt.id]: e.target.value }))}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddReply(cmt.id)}
                            placeholder="Responder ao comentário..."
                            className={`flex-1 min-w-0 px-2.5 py-1.5 rounded-xl border ${
                              isDarkMode ? 'bg-black/30 border-white/10' : 'bg-white border-black/10'
                            } outline-none text-[11px]`}
                          />
                          <button
                            type="button"
                            onClick={() => handleAddReply(cmt.id)}
                            className="px-2.5 py-1.5 rounded-xl bg-[#1A73E8] text-white text-[11px] font-semibold shrink-0"
                          >
                            Enviar
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </aside>
          </>
        )}
      </div>

      {/* MODAL: DRIVE DOCUMENT PICKER */}
      {showTemplateModal && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowTemplateModal(false)}
        >
          <div
            data-testid="docs-template-modal"
            className={`w-full max-w-xl max-h-[90%] overflow-y-auto custom-scrollbar rounded-3xl border ${bgPanel} p-5 sm:p-6 shadow-2xl space-y-5 text-xs`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold">Documentos do Google Docs</h3>
                <p className={textMuted}>Crie um documento em branco ou abra um arquivo salvo no seu Drive</p>
              </div>
              <button type="button" aria-label="Fechar" onClick={() => setShowTemplateModal(false)} className={`p-1.5 rounded-full ${hoverBtn}`}>
                <X size={16} />
              </button>
            </div>

            <button
              type="button"
              data-testid="docs-template-blank"
              onClick={() => handleCreateNewDocument()}
              className={`w-full p-4 rounded-2xl border border-current/10 ${hoverBtn} text-left flex items-center justify-between gap-3`}
            >
              <div>
                <div className="font-bold text-sm">Documento em branco</div>
                <p className={`text-[11px] mt-0.5 ${textMuted}`}>Página limpa pronta para redação.</p>
              </div>
              <span className="text-xs font-semibold text-[#1A73E8] shrink-0">Criar novo →</span>
            </button>

            <div className="pt-3 border-t border-current/10 space-y-2">
              <div className={`text-[11px] font-bold uppercase tracking-wider ${textMuted}`}>
                Seus documentos no Google Drive
              </div>
              {driveDocs.length === 0 ? (
                <p className={`text-xs py-4 text-center ${textMuted}`}>
                  Nenhum documento salvo no Drive ainda.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {driveDocs.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => {
                        setShowTemplateModal(false);
                        loadDocumentById(doc.id, doc.name);
                      }}
                      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border ${
                        doc.id === activeDocId
                          ? 'border-[#1A73E8] bg-[#1A73E8]/10 text-[#1A73E8] font-semibold'
                          : `border-current/10 ${hoverBtn}`
                      } text-left`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <FileText size={14} className="shrink-0 text-[#1A73E8]" />
                        <span className="truncate">{doc.name}</span>
                      </span>
                      {doc.isStarred && <Star size={12} className="text-amber-400 fill-amber-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: FIND AND REPLACE (Ctrl+H) */}
      {showFindReplaceModal && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowFindReplaceModal(false)}
        >
          <div
            data-testid="docs-find-replace-modal"
            className={`w-full max-w-md max-h-[90%] overflow-y-auto custom-scrollbar rounded-3xl border ${bgPanel} p-5 sm:p-6 shadow-2xl space-y-4 text-xs`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Localizar e substituir</h3>
              <button type="button" aria-label="Fechar localizar e substituir" onClick={() => setShowFindReplaceModal(false)} className={`p-1.5 rounded-full ${hoverBtn}`}>
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Localizar</label>
                <div className="flex items-center gap-2">
                  <input
                    data-testid="docs-find-input"
                    type="text"
                    value={findQuery}
                    onChange={(e) => setFindQuery(e.target.value)}
                    placeholder="Palavra ou termo..."
                    className={`flex-1 min-w-0 px-3 py-2 rounded-xl border ${
                      isDarkMode ? 'bg-black/30 border-white/15' : 'bg-white border-black/15'
                    } outline-none`}
                  />
                  <span className="text-[11px] font-mono tabular-nums px-2 py-1 rounded bg-blue-500/10 text-blue-500 shrink-0">
                    {findMatchesCount} ocor.
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Substituir por</label>
                <input
                  data-testid="docs-replace-input"
                  type="text"
                  value={replaceQuery}
                  onChange={(e) => setReplaceQuery(e.target.value)}
                  placeholder="Novo texto..."
                  className={`w-full px-3 py-2 rounded-xl border ${
                    isDarkMode ? 'bg-black/30 border-white/15' : 'bg-white border-black/15'
                  } outline-none`}
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={matchCase}
                  onChange={(e) => setMatchCase(e.target.checked)}
                />
                <span>Diferenciar maiúsculas de minúsculas</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleReplaceAction(false)}
                className={`px-3.5 py-2 rounded-xl border border-current/15 ${hoverBtn} font-semibold`}
              >
                Substituir
              </button>
              <button
                type="button"
                data-testid="docs-replace-all-btn"
                onClick={() => handleReplaceAction(true)}
                className="px-4 py-2 rounded-xl bg-[#1A73E8] text-white font-semibold"
              >
                Substituir tudo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: WORD COUNT (Ctrl+Shift+C) */}
      {showWordCountModal && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowWordCountModal(false)}
        >
          <div
            data-testid="docs-word-count-modal"
            className={`w-full max-w-sm max-h-[90%] overflow-y-auto custom-scrollbar rounded-3xl border ${bgPanel} p-5 sm:p-6 shadow-2xl space-y-4 text-xs`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Contagem de palavras</h3>
              <button type="button" aria-label="Fechar contagem de palavras" onClick={() => setShowWordCountModal(false)} className={`p-1.5 rounded-full ${hoverBtn}`}>
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2.5 tabular-nums">
              {[
                ['Páginas estimadas', stats.pages],
                ['Palavras', stats.words],
                ['Caracteres', stats.characters],
                ['Caracteres (sem espaços)', stats.charactersNoSpaces],
                ['Parágrafos', stats.paragraphs],
                ['Tempo estimado de leitura', `${stats.readingTimeMinutes} min`],
              ].map(([label, val]) => (
                <div key={String(label)} className="flex items-center justify-between py-1.5 border-b border-current/10">
                  <span className={textMuted}>{label}</span>
                  <span className="font-bold">{val}</span>
                </div>
              ))}
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={showLiveWordCount}
                onChange={(e) => {
                  setShowLiveWordCount(e.target.checked);
                  persistBundle(tabs, comments, versions, pageSetup, e.target.checked);
                }}
              />
              <span>Mostrar contagem de palavras ao digitar</span>
            </label>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowWordCountModal(false)}
                className="px-5 py-2 rounded-xl bg-[#1A73E8] text-white font-semibold"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PAGE SETUP */}
      {showPageSetupModal && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowPageSetupModal(false)}
        >
          <div
            data-testid="docs-page-setup-modal"
            className={`w-full max-w-md max-h-[90%] overflow-y-auto custom-scrollbar rounded-3xl border ${bgPanel} p-5 sm:p-6 shadow-2xl space-y-4 text-xs`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Configuração da página</h3>
              <button type="button" aria-label="Fechar configuração da página" onClick={() => setShowPageSetupModal(false)} className={`p-1.5 rounded-full ${hoverBtn}`}>
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPageSetup((p) => ({ ...p, pageless: false }))}
                className={`p-2.5 rounded-xl border font-semibold ${
                  !pageSetup.pageless ? 'border-[#1A73E8] bg-[#1A73E8]/15 text-[#1A73E8]' : 'border-current/15'
                }`}
              >
                Com páginas (A4 / Carta)
              </button>
              <button
                type="button"
                onClick={() => setPageSetup((p) => ({ ...p, pageless: true }))}
                className={`p-2.5 rounded-xl border font-semibold ${
                  pageSetup.pageless ? 'border-[#1A73E8] bg-[#1A73E8]/15 text-[#1A73E8]' : 'border-current/15'
                }`}
              >
                Sem páginas (Pageless)
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Orientação</label>
                <div className="flex gap-3">
                  {(['portrait', 'landscape'] as const).map((o) => (
                    <label key={o} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={pageSetup.orientation === o}
                        onChange={() => setPageSetup((p) => ({ ...p, orientation: o }))}
                      />
                      <span>{o === 'portrait' ? 'Retrato' : 'Paisagem'}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Margens</label>
                <select
                  value={pageSetup.margins}
                  onChange={(e) => setPageSetup((p) => ({ ...p, margins: e.target.value as PageSetupConfig['margins'] }))}
                  className={`w-full px-3 py-2 rounded-xl border ${
                    isDarkMode ? 'bg-black/30 border-white/15' : 'bg-white border-black/15'
                  } outline-none`}
                >
                  <option value="narrow">Estreita (1,27 cm)</option>
                  <option value="normal">Normal (2,54 cm)</option>
                  <option value="wide">Larga (3,81 cm)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Cor da página</label>
                <div className="flex items-center gap-2">
                  {['#FFFFFF', '#F8FAFC', '#FEFCE8', '#F0FDF4', '#EFF6FF', '#FAF5FF'].map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Cor de página ${color}`}
                      onClick={() => setPageSetup((p) => ({ ...p, pageColor: color }))}
                      className={`w-7 h-7 rounded-full border ${
                        pageSetup.pageColor === color ? 'ring-2 ring-[#1A73E8]' : 'border-black/20'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  persistBundle(tabs, comments, versions, pageSetup);
                  setShowPageSetupModal(false);
                  toast('Configuração da página aplicada');
                }}
                className="px-5 py-2 rounded-xl bg-[#1A73E8] text-white font-semibold"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VERSION HISTORY */}
      {showVersionsModal && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowVersionsModal(false)}
        >
          <div
            data-testid="docs-versions-modal"
            className={`w-full max-w-md max-h-[90%] overflow-y-auto custom-scrollbar rounded-3xl border ${bgPanel} p-5 sm:p-6 shadow-2xl space-y-4 text-xs`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Histórico de versões</h3>
              <button type="button" aria-label="Fechar histórico de versões" onClick={() => setShowVersionsModal(false)} className={`p-1.5 rounded-full ${hoverBtn}`}>
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                data-testid="docs-version-name-input"
                type="text"
                value={newVersionName}
                onChange={(e) => setNewVersionName(e.target.value)}
                placeholder="Nomear versão atual (ex: Aprovado Diretoria)..."
                className={`flex-1 min-w-0 px-3 py-2 rounded-xl border ${
                  isDarkMode ? 'bg-black/30 border-white/15' : 'bg-white border-black/15'
                } outline-none`}
              />
              <button
                type="button"
                data-testid="docs-save-version-btn"
                onClick={handleSaveNamedVersion}
                className="px-3.5 py-2 rounded-xl bg-[#1A73E8] text-white font-semibold shrink-0"
              >
                Salvar versão
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
              {versions.map((ver, idx) => (
                <div
                  key={ver.id}
                  className="p-3 rounded-2xl border border-current/10 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-bold truncate">
                      {ver.name} {idx === 0 && <span className="text-[#1A73E8]">(Mais recente)</span>}
                    </div>
                    <div className={`text-[11px] ${textMuted}`}>
                      {ver.createdAt} · Por {ver.author}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRestoreVersion(ver)}
                    className="px-3 py-1.5 rounded-xl bg-blue-500/15 text-[#1A73E8] font-semibold hover:bg-blue-500/25 shrink-0"
                  >
                    Restaurar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD COMMENT / SUGGESTION */}
      {showCommentModal && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowCommentModal(false)}
        >
          <div
            data-testid="docs-add-comment-modal"
            className={`w-full max-w-md max-h-[90%] overflow-y-auto custom-scrollbar rounded-3xl border ${bgPanel} p-5 sm:p-6 shadow-2xl space-y-4 text-xs`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold">
              {newCommentIsSuggestion ? 'Nova Sugestão de Edição' : 'Novo Comentário'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Trecho selecionado</label>
                <input
                  type="text"
                  value={newCommentQuote}
                  onChange={(e) => setNewCommentQuote(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border ${
                    isDarkMode ? 'bg-black/30 border-white/15' : 'bg-white border-black/15'
                  } outline-none`}
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  {newCommentIsSuggestion ? 'Texto substituto sugerido' : 'Comentário'}
                </label>
                <textarea
                  data-testid="docs-comment-textarea"
                  rows={3}
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Digite seu comentário ou @mencione alguém..."
                  className={`w-full px-3 py-2 rounded-xl border ${
                    isDarkMode ? 'bg-black/30 border-white/15' : 'bg-white border-black/15'
                  } outline-none`}
                  autoFocus
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newCommentIsSuggestion}
                  onChange={(e) => setNewCommentIsSuggestion(e.target.checked)}
                />
                <span>Registrar como sugestão aplicável com 1 clique</span>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCommentModal(false)} className={`px-4 py-2 rounded-xl ${hoverBtn}`}>
                Cancelar
              </button>
              <button
                type="button"
                data-testid="docs-submit-comment-btn"
                onClick={handleConfirmAddComment}
                className="px-5 py-2 rounded-xl bg-[#1A73E8] text-white font-semibold"
              >
                Publicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: INSERT LINK */}
      {showLinkModal && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowLinkModal(false)}
        >
          <div
            className={`w-full max-w-md max-h-[90%] overflow-y-auto custom-scrollbar rounded-3xl border ${bgPanel} p-5 sm:p-6 shadow-2xl space-y-4 text-xs`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold">Inserir link</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={linkTextInput}
                onChange={(e) => setLinkTextInput(e.target.value)}
                placeholder="Texto a exibir"
                className={`w-full px-3 py-2 rounded-xl border ${
                  isDarkMode ? 'bg-black/30 border-white/15' : 'bg-white border-black/15'
                } outline-none`}
              />
              <input
                type="url"
                value={linkUrlInput}
                onChange={(e) => setLinkUrlInput(e.target.value)}
                placeholder="https://..."
                className={`w-full px-3 py-2 rounded-xl border ${
                  isDarkMode ? 'bg-black/30 border-white/15' : 'bg-white border-black/15'
                } outline-none`}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowLinkModal(false)} className={`px-4 py-2 rounded-xl ${hoverBtn}`}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const safeUrl = /^(https?:|mailto:)/i.test(linkUrlInput.trim()) ? linkUrlInput.trim() : '';
                  if (!safeUrl) {
                    toast('Informe um endereço http://, https:// ou mailto:');
                    return;
                  }
                  const label = escapeHtml(linkTextInput.trim() || safeUrl);
                  insertHtmlAtCursor(
                    `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" style="color:#1A73E8;text-decoration:underline;">${label}</a>`
                  );
                  setShowLinkModal(false);
                  setLinkTextInput('');
                  setLinkUrlInput('https://');
                }}
                className="px-5 py-2 rounded-xl bg-[#1A73E8] text-white font-semibold"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DRAWING / SIGNATURE CANVAS */}
      {showDrawingModal && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowDrawingModal(false)}
        >
          <div
            className={`w-full max-w-lg max-h-[90%] overflow-y-auto custom-scrollbar rounded-3xl border ${bgPanel} p-5 sm:p-6 shadow-2xl space-y-4 text-xs`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Desenho & Assinatura Digital</h3>
              <button type="button" aria-label="Fechar quadro de desenho" onClick={() => setShowDrawingModal(false)} className={`p-1.5 rounded-full ${hoverBtn}`}>
                <X size={16} />
              </button>
            </div>
            <canvas
              ref={drawingCanvasRef}
              width={440}
              height={220}
              onPointerDown={handleDrawingPointerDown}
              onPointerMove={handleDrawingPointerMove}
              onPointerUp={handleDrawingPointerUp}
              className="w-full h-[220px] bg-white rounded-2xl border border-slate-300 cursor-crosshair touch-none"
            />
            <div className="flex flex-wrap justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  const ctx = drawingCanvasRef.current?.getContext('2d');
                  if (ctx && drawingCanvasRef.current) {
                    ctx.clearRect(0, 0, drawingCanvasRef.current.width, drawingCanvasRef.current.height);
                  }
                }}
                className={`px-3 py-2 rounded-xl border border-current/15 ${hoverBtn}`}
              >
                Limpar quadro
              </button>
              <button
                type="button"
                onClick={handleInsertDrawingIntoDoc}
                className="px-5 py-2 rounded-xl bg-[#1A73E8] text-white font-semibold"
              >
                Salvar e inserir no documento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TRANSLATE DOCUMENT */}
      {showTranslateModal && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowTranslateModal(false)}
        >
          <div
            className={`w-full max-w-sm max-h-[90%] overflow-y-auto custom-scrollbar rounded-3xl border ${bgPanel} p-5 sm:p-6 shadow-2xl space-y-4 text-xs`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold">Traduzir documento</h3>
            <p className={textMuted}>Uma nova aba traduzida será criada dentro deste documento.</p>
            <select
              value={translateTargetLang}
              onChange={(e) => setTranslateTargetLang(e.target.value as 'en' | 'es' | 'pt')}
              className={`w-full px-3 py-2 rounded-xl border ${
                isDarkMode ? 'bg-black/30 border-white/15' : 'bg-white border-black/15'
              } outline-none`}
            >
              <option value="en">Inglês (English)</option>
              <option value="es">Espanhol (Español)</option>
              <option value="pt">Português (Brasil)</option>
            </select>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowTranslateModal(false)} className={`px-4 py-2 rounded-xl ${hoverBtn}`}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleTranslateDocument}
                className="px-5 py-2 rounded-xl bg-[#1A73E8] text-white font-semibold"
              >
                Traduzir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SHARE & PERMISSIONS */}
      {showShareModal && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowShareModal(false)}
        >
          <div
            data-testid="docs-share-modal"
            className={`w-full max-w-lg max-h-[90%] overflow-y-auto custom-scrollbar rounded-3xl border ${bgPanel} p-5 sm:p-6 shadow-2xl space-y-4 text-xs`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold truncate">Compartilhar "{title}"</h3>
              <button type="button" aria-label="Fechar compartilhamento" onClick={() => setShowShareModal(false)} className={`p-1.5 rounded-full ${hoverBtn}`}>
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={shareEmailInput}
                onChange={(e) => setShareEmailInput(e.target.value)}
                placeholder="Adicionar pessoas ou grupos por e-mail..."
                className={`flex-1 min-w-0 px-3.5 py-2.5 rounded-xl border ${
                  isDarkMode ? 'bg-black/30 border-white/15' : 'bg-white border-black/15'
                } outline-none`}
              />
              <div className="flex gap-2">
                <select
                  aria-label="Papel do colaborador"
                  value={shareRoleInput}
                  onChange={(e) => setShareRoleInput(e.target.value as 'editor' | 'viewer')}
                  className={`flex-1 sm:flex-none px-3 py-2.5 rounded-xl border ${
                    isDarkMode ? 'bg-[#20232B] border-white/15' : 'bg-white border-black/15'
                  } outline-none`}
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Leitor</option>
                </select>
                <button
                  type="button"
                  onClick={handleInviteCollaborator}
                  className="px-4 py-2.5 rounded-xl bg-[#1A73E8] text-white font-semibold shrink-0"
                >
                  Compartilhar
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
              {permissions.map((perm) => (
                <div key={perm.email} className="flex items-center justify-between gap-2 py-1.5">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{perm.name}</div>
                    <div className={`text-[11px] ${textMuted} truncate`}>{perm.email}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 font-medium">
                      {perm.role === 'owner' ? 'Proprietário' : perm.role === 'editor' ? 'Editor' : 'Leitor'}
                    </span>
                    {perm.role !== 'owner' && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCollaborator(perm.email)}
                        className="text-red-500 hover:underline"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* General Access Selector */}
            <div className="p-3 rounded-2xl border border-current/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${generalAccess === 'anyone' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-slate-500/15'}`}>
                  {generalAccess === 'anyone' ? <Globe size={15} /> : <Lock size={15} />}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold">Acesso geral</div>
                  <div className={`text-[11px] ${textMuted}`}>
                    {generalAccess === 'anyone'
                      ? 'Qualquer pessoa com o link pode visualizar'
                      : 'Somente pessoas adicionadas podem abrir'}
                  </div>
                </div>
              </div>
              <select
                data-testid="docs-general-access-select"
                aria-label="Acesso geral do documento"
                value={generalAccess}
                onChange={(e) => handleChangeGeneralAccess(e.target.value as 'restricted' | 'anyone')}
                className={`px-3 py-2 rounded-xl border font-semibold ${
                  isDarkMode ? 'bg-[#20232B] border-white/15' : 'bg-white border-black/15'
                } outline-none cursor-pointer`}
              >
                <option value="restricted">Restrito</option>
                <option value="anyone">Qualquer pessoa com o link</option>
              </select>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-current/10">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(`https://docs.google.com/document/d/${activeDocId}/edit`);
                  toast('Link do documento copiado!');
                }}
                className={`px-3.5 py-2 rounded-xl border border-current/15 ${hoverBtn} flex items-center gap-1.5 font-semibold`}
              >
                <Link2 size={14} /> Copiar link
              </button>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="px-5 py-2 rounded-xl bg-[#1A73E8] text-white font-semibold"
              >
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SEARCH IN MENUS COMMAND PALETTE (Alt+/) */}
      {showCommandPalette && (
        <div
          className="absolute inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm pt-16 sm:pt-20 p-4"
          onClick={() => setShowCommandPalette(false)}
        >
          <div
            data-testid="docs-command-palette"
            className={`w-full max-w-md max-h-[80%] overflow-y-auto custom-scrollbar rounded-3xl border ${bgPanel} p-4 shadow-2xl space-y-3 text-xs`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-[#1A73E8]">
              <Search size={15} className="text-[#1A73E8]" />
              <input
                type="text"
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                placeholder="Pesquisar comandos no Google Docs..."
                className="flex-1 bg-transparent outline-none"
                autoFocus
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {commandActions
                .filter((a) => a.label.toLowerCase().includes(commandQuery.toLowerCase()))
                .map((act) => (
                  <button
                    key={act.label}
                    type="button"
                    onClick={() => {
                      setShowCommandPalette(false);
                      act.run();
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl ${hoverBtn} font-medium`}
                  >
                    {act.label}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
