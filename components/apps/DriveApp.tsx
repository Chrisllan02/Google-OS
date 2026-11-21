import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Plus,
  HardDrive,
  FileText,
  Folder,
  File,
  Image as ImageIcon,
  Trash2,
  Loader2,
  Edit2,
  ExternalLink,
  CheckSquare,
  Search,
  Star,
  Users,
  Clock,
  AlertOctagon,
  Cloud,
  LayoutGrid,
  List,
  Info,
  Share2,
  Link2,
  Copy,
  Download,
  FolderInput,
  History,
  MoreVertical,
  ChevronRight,
  ChevronDown,
  Upload,
  FolderUp,
  RotateCcw,
  Eye,
  Check,
  ArrowUpDown,
  HelpCircle,
  Mail,
  Lock,
  Globe,
  WifiOff,
  Home,
  Palette,
  Menu,
  ArrowUp,
  ArrowDown,
  ShieldCheck,
} from 'lucide-react';
import { GoogleIcons } from '../GoogleIcons';
import { AppOpenPayload, bridge, ContactItem, DashboardData, FileVersion, TaskItem } from '../../utils/GASBridge';
import ContextMenu, { ContextMenuItem } from '../ContextMenu';
import {
  DriveCategory,
  DriveFileTypeFilter,
  DriveOwnerFilter,
  DriveModifiedFilter,
  DriveSortField,
  DriveSortOrder,
  EnrichedDriveItem,
  DRIVE_FOLDER_COLORS,
  formatBytes,
  formatStoragePercent,
  buildFolderBreadcrumbs,
  buildFolderTreeNodes,
  filterAndSortDriveItems,
  calculateStorageBreakdown,
  isDescendantFolder,
} from '../../utils/driveLogic';

interface DriveAppProps {
  onClose: () => void;
  data: DashboardData;
  onOpenApp?: (type: string, fileData?: AppOpenPayload) => void;
  onUpdateTasks?: (tasks: TaskItem[]) => void;
  showToast?: (msg: string) => void;
  isDarkMode?: boolean;
}

const renderItemIcon = (item: EnrichedDriveItem, className = 'w-6 h-6') => {
  switch (item.type) {
    case 'sheet':
      return <GoogleIcons.Sheets className={className} />;
    case 'slide':
      return <GoogleIcons.Slides className={className} />;
    case 'doc':
      return <GoogleIcons.Docs className={className} />;
    case 'image':
      return <ImageIcon className={`${className} text-rose-500`} />;
    case 'pdf':
      return <FileText className={`${className} text-red-500`} />;
    case 'folder':
      return (
        <Folder
          className={`${className} fill-current`}
          style={{ color: item.folderColor || '#5F6368' }}
        />
      );
    default:
      return <File className={`${className} text-blue-400`} />;
  }
};

const TYPE_LABEL_MAP: Record<string, string> = {
  folder: 'Pasta do Google Drive',
  doc: 'Documento do Google Docs',
  sheet: 'Planilha do Google Sheets',
  slide: 'Apresentação do Google Slides',
  pdf: 'Documento PDF',
  image: 'Imagem',
};

export default function DriveApp({
  onClose,
  data,
  onOpenApp,
  onUpdateTasks,
  showToast,
  isDarkMode = true,
}: DriveAppProps) {
  const [allItems, setAllItems] = useState<EnrichedDriveItem[]>(() => data?.files || []);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<DriveCategory>('my-drive');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [expandedSidebarFolders, setExpandedSidebarFolders] = useState<boolean>(true);
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Search, Filters & Sort
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<DriveFileTypeFilter>('all');
  const [ownerFilter, setOwnerFilter] = useState<DriveOwnerFilter>('all');
  const [modifiedFilter, setModifiedFilter] = useState<DriveModifiedFilter>('any');
  const [sortField, setSortField] = useState<DriveSortField>('name');
  const [sortOrder, setSortOrder] = useState<DriveSortOrder>('asc');

  // Menus & Drawers
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showDetailsDrawer, setShowDetailsDrawer] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1280 : true
  );
  const [detailsTab, setDetailsTab] = useState<'details' | 'activity'>('details');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const [descriptionDraft, setDescriptionDraft] = useState('');

  // Modals
  const [modalMode, setModalMode] = useState<'create_folder' | 'rename' | 'create_doc' | null>(null);
  const [pendingDocType, setPendingDocType] = useState<'doc' | 'sheet' | 'slide'>('doc');
  const [modalInput, setModalInput] = useState('');
  const [modalFolderColor, setModalFolderColor] = useState('#1A73E8');
  const [modalTargetId, setModalTargetId] = useState<string | null>(null);

  const [shareItem, setShareItem] = useState<EnrichedDriveItem | null>(null);
  const [shareEmailInput, setShareEmailInput] = useState('');
  const [shareRoleInput, setShareRoleInput] = useState<'editor' | 'viewer'>('editor');
  const [contactSuggestions, setContactSuggestions] = useState<ContactItem[]>([]);

  const [moveItems, setMoveItems] = useState<EnrichedDriveItem[]>([]);
  const [moveDestFolderId, setMoveDestFolderId] = useState<string | null>(null);

  const [versionItem, setVersionItem] = useState<EnrichedDriveItem | null>(null);
  const [previewItem, setPreviewItem] = useState<EnrichedDriveItem | null>(null);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showColorPickerForId, setShowColorPickerForId] = useState<string | null>(null);
  const [undoTrashBanner, setUndoTrashBanner] = useState<{ ids: string[]; label: string } | null>(null);

  // Upload & Drag-and-drop states
  const [uploadStatus, setUploadStatus] = useState<{
    state: 'uploading' | 'success' | 'error';
    fileName: string;
    progress: number;
  } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const versionUploadRef = useRef<HTMLInputElement>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = (msg: string) => showToast?.(msg);

  const loadDriveItems = async () => {
    setLoading(true);
    try {
      const items = await bridge.getAllDriveItems();
      setAllItems(items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDriveItems();
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  // Contact autocomplete inside Share modal
  useEffect(() => {
    if (shareEmailInput.trim().length < 2) {
      setContactSuggestions([]);
      return;
    }
    bridge.searchContacts(shareEmailInput).then(setContactSuggestions);
  }, [shareEmailInput]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedItemId = selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null;
  const selectedItem = useMemo(
    () => (selectedItemId ? allItems.find((i) => i.id === selectedItemId) || null : null),
    [allItems, selectedItemId]
  );
  const selectedItems = useMemo(
    () => allItems.filter((i) => selectedIdSet.has(i.id)),
    [allItems, selectedIdSet]
  );

  // Sync description draft when active selection changes
  useEffect(() => {
    setDescriptionDraft(selectedItem?.description || '');
  }, [selectedItem?.id, selectedItem?.description]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setShowShortcutsModal((v) => !v);
        return;
      }
      if (e.key.toLowerCase() === 'v') {
        e.preventDefault();
        setViewLayout((l) => (l === 'grid' ? 'list' : 'grid'));
        return;
      }
      if (e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setShowDetailsDrawer((d) => !d);
        return;
      }
      if (e.key === 'Escape') {
        setShowNewMenu(false);
        setShowMobileSidebar(false);
        setContextMenu(null);
        setModalMode(null);
        setShareItem(null);
        setMoveItems([]);
        setVersionItem(null);
        setPreviewItem(null);
        setShowShortcutsModal(false);
        setShowColorPickerForId(null);
        setSelectedIds([]);
        return;
      }

      if (selectedItems.length === 0 || modalMode) return;
      if (e.key === 'Enter' && selectedItem) {
        e.preventDefault();
        handleOpenItem(selectedItem);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const ids = selectedItems.map((i) => i.id);
        if (selectedItems.every((i) => i.trashed)) {
          handleBatchDeleteForever(ids);
        } else {
          handleTrashItems(ids);
        }
      } else if ((e.key === 'F2' || e.key.toLowerCase() === 'n') && selectedItem) {
        e.preventDefault();
        setModalTargetId(selectedItem.id);
        setModalInput(selectedItem.name);
        setModalMode('rename');
      } else if (e.key.toLowerCase() === 's' && selectedItem) {
        e.preventDefault();
        handleToggleStar(selectedItem);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItem, selectedItems, modalMode]);

  const breadcrumbs = useMemo(
    () => buildFolderBreadcrumbs(allItems, currentFolderId),
    [allItems, currentFolderId]
  );

  const { folders, files } = useMemo(
    () =>
      filterAndSortDriveItems(allItems, {
        category,
        currentFolderId,
        searchQuery,
        typeFilter,
        ownerFilter,
        modifiedFilter,
        sortField,
        sortOrder,
      }),
    [allItems, category, currentFolderId, searchQuery, typeFilter, ownerFilter, modifiedFilter, sortField, sortOrder]
  );

  const visibleItemsOrdered = useMemo(() => [...folders, ...files], [folders, files]);
  const storageBreakdown = useMemo(() => calculateStorageBreakdown(allItems), [allItems]);
  const folderTreeNodes = useMemo(() => buildFolderTreeNodes(allItems), [allItems]);
  const storagePercentInfo = useMemo(
    () => formatStoragePercent(storageBreakdown.usedBytes, storageBreakdown.totalQuotaBytes),
    [storageBreakdown]
  );

  // Selection helpers
  const handleSelectItemClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (e.metaKey || e.ctrlKey) {
      setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
      return;
    }
    if (e.shiftKey && selectedIds.length > 0) {
      const anchor = selectedIds[selectedIds.length - 1];
      const orderedIds = visibleItemsOrdered.map((i) => i.id);
      const startIdx = orderedIds.indexOf(anchor);
      const endIdx = orderedIds.indexOf(id);
      if (startIdx !== -1 && endIdx !== -1) {
        const [lo, hi] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        setSelectedIds(orderedIds.slice(lo, hi + 1));
        return;
      }
    }
    setSelectedIds([id]);
  };

  const handleToggleItemCheckbox = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleHeaderSortClick = (field: DriveSortField) => {
    if (sortField === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'name' ? 'asc' : 'desc');
    }
  };

  // Actions
  const handleOpenItem = (item: EnrichedDriveItem) => {
    if (item.type === 'folder') {
      setCategory('my-drive');
      setCurrentFolderId(item.id);
      setSelectedIds([]);
      setShowMobileSidebar(false);
      return;
    }
    const nowIso = new Date().toISOString();
    bridge.updateDriveItemMeta(item.id, { lastOpenedIso: nowIso }).then(() => {
      setAllItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, lastOpenedIso: nowIso } : it)));
    });
    if (item.type === 'doc' || item.type === 'sheet' || item.type === 'slide') {
      onOpenApp?.(item.type, item);
    } else {
      setPreviewItem(item);
    }
  };

  const handleCreateFolder = async () => {
    const name = modalInput.trim();
    if (!name) return;
    await bridge.createDriveFolder(name, currentFolderId, modalFolderColor);
    setModalMode(null);
    setModalInput('');
    toast(`Pasta "${name}" criada.`);
    await loadDriveItems();
  };

  const handleCreateNativeDoc = async () => {
    const defaultTitle =
      pendingDocType === 'doc'
        ? 'Documento sem título'
        : pendingDocType === 'sheet'
        ? 'Planilha sem título'
        : 'Apresentação sem título';
    const name = modalInput.trim() || defaultTitle;
    const created = await bridge.createDriveDocument(pendingDocType, name, currentFolderId);
    setModalMode(null);
    setModalInput('');
    await loadDriveItems();
    toast(`${TYPE_LABEL_MAP[pendingDocType]} "${name}" criado!`);
    onOpenApp?.(pendingDocType, created);
  };

  const handleRename = async () => {
    const name = modalInput.trim();
    if (!name || !modalTargetId) return;
    await bridge.renameDriveItem(modalTargetId, name);
    setModalMode(null);
    setModalInput('');
    setModalTargetId(null);
    toast(`Renomeado para "${name}".`);
    await loadDriveItems();
  };

  const handleToggleStar = async (item: EnrichedDriveItem) => {
    const nextStarred = !item.isStarred;
    await bridge.setStarredDriveItem(item.id, nextStarred);
    toast(nextStarred ? `"${item.name}" adicionado a Com estrela.` : `Estrela removida de "${item.name}".`);
    await loadDriveItems();
    if (previewItem?.id === item.id) {
      setPreviewItem({ ...previewItem, isStarred: nextStarred });
    }
  };

  const handleBatchStar = async (itemsToStar: EnrichedDriveItem[]) => {
    const shouldStar = itemsToStar.some((i) => !i.isStarred);
    for (const it of itemsToStar) {
      await bridge.setStarredDriveItem(it.id, shouldStar);
    }
    toast(
      shouldStar
        ? `${itemsToStar.length} item(ns) adicionado(s) a Com estrela.`
        : `Estrela removida de ${itemsToStar.length} item(ns).`
    );
    await loadDriveItems();
  };

  const handleDuplicate = async (item: EnrichedDriveItem) => {
    const copy = await bridge.duplicateDriveItem(item.id);
    if (copy) {
      toast(`Cópia criada: "${copy.name}".`);
      await loadDriveItems();
      setSelectedIds([copy.id]);
    }
  };

  const handleTrashItems = async (ids: string[]) => {
    if (ids.length === 0) return;
    for (const id of ids) {
      await bridge.trashDriveItem(id);
    }
    const label = ids.length === 1 ? 'Item movido para a lixeira.' : `${ids.length} itens movidos para a lixeira.`;
    setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoTrashBanner({ ids, label });
    undoTimerRef.current = setTimeout(() => setUndoTrashBanner(null), 6000);
    await loadDriveItems();
  };

  const handleUndoTrash = async () => {
    if (!undoTrashBanner) return;
    const { ids } = undoTrashBanner;
    setUndoTrashBanner(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    for (const id of ids) {
      await bridge.restoreDriveItem(id);
    }
    toast(ids.length === 1 ? 'Item restaurado da lixeira.' : `${ids.length} itens restaurados da lixeira.`);
    await loadDriveItems();
  };

  const handleBatchRestore = async (ids: string[]) => {
    for (const id of ids) {
      await bridge.restoreDriveItem(id);
    }
    setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    toast(ids.length === 1 ? 'Item restaurado.' : `${ids.length} itens restaurados.`);
    await loadDriveItems();
  };

  const handleBatchDeleteForever = async (ids: string[]) => {
    for (const id of ids) {
      await bridge.deleteDriveItemForever(id);
    }
    setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    toast(ids.length === 1 ? 'Item excluído definitivamente.' : `${ids.length} itens excluídos definitivamente.`);
    await loadDriveItems();
  };

  const handleReportSpam = async (ids: string[]) => {
    for (const id of ids) {
      await bridge.setSpamDriveItem(id, true);
    }
    setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    toast(ids.length === 1 ? 'Item movido para Spam.' : `${ids.length} itens movidos para Spam.`);
    await loadDriveItems();
  };

  const handleNotSpam = async (ids: string[]) => {
    for (const id of ids) {
      await bridge.setSpamDriveItem(id, false);
    }
    setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    toast(ids.length === 1 ? 'Item removido de Spam.' : `${ids.length} itens removidos de Spam.`);
    await loadDriveItems();
  };

  const handleEmptyTrash = async () => {
    await bridge.emptyTrash();
    toast('Lixeira esvaziada com sucesso.');
    setSelectedIds([]);
    await loadDriveItems();
  };

  const handleChangeFolderColor = async (folderId: string, hex: string) => {
    await bridge.updateDriveItemMeta(folderId, { folderColor: hex });
    setShowColorPickerForId(null);
    toast('Cor da pasta atualizada.');
    await loadDriveItems();
  };

  const handleToggleOffline = async (item: EnrichedDriveItem) => {
    const nextOffline = !item.offlineAvailable;
    await bridge.updateDriveItemMeta(item.id, { offlineAvailable: nextOffline });
    toast(nextOffline ? `"${item.name}" disponível offline.` : `Acesso offline desativado para "${item.name}".`);
    await loadDriveItems();
  };

  const handleCommitDescription = async (item: EnrichedDriveItem, desc: string) => {
    if ((item.description || '') === desc) return;
    await bridge.updateDriveItemMeta(item.id, { description: desc });
    setAllItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, description: desc } : it)));
    toast('Descrição salva.');
  };

  const handleCopyShareLink = async (item: EnrichedDriveItem) => {
    const link = await bridge.getDriveShareLink(item.id);
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      /* fallback */
    }
    toast(`Link copiado: ${link}`);
  };

  const handleDownloadItem = async (item: EnrichedDriveItem) => {
    if (item.thumbnail && item.thumbnail.startsWith('data:')) {
      const a = document.createElement('a');
      a.href = item.thumbnail;
      a.download = item.name.includes('.') ? item.name : `${item.name}.png`;
      a.click();
      toast(`Download de "${item.name}" iniciado.`);
      return;
    }

    const stored = await bridge.getFileContent(item.id);
    const hasRealContent = stored.success && Boolean(stored.data);
    const content = hasRealContent
      ? stored.data
      : `Google Drive — ${item.name}\nTipo: ${TYPE_LABEL_MAP[item.type] || item.type}\nProprietário: ${item.owner}\nDescrição: ${item.description || 'Sem descrição'}\nExportado em: ${new Date().toISOString()}`;
    const isHtml = hasRealContent && /<[a-z][\s\S]*>/i.test(content);
    const mime = isHtml ? 'text/html;charset=utf-8' : 'text/plain;charset=utf-8';
    const ext = isHtml ? '.html' : '.txt';
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.name.includes('.') ? item.name : `${item.name}${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Download de "${item.name}" iniciado.`);
  };

  const handleFileUpload = async (file: File) => {
    setUploadStatus({ state: 'uploading', fileName: file.name, progress: 35 });
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const resultStr = (ev.target?.result as string) || '';
        const base64 = resultStr.includes(',') ? resultStr.split(',')[1] : '';
        await bridge.uploadFileToDrive(base64, file.name, file.type, currentFolderId);
        setUploadStatus({ state: 'success', fileName: file.name, progress: 100 });
        toast(`Upload concluído: "${file.name}"`);
        await loadDriveItems();
        setTimeout(() => setUploadStatus(null), 2500);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploadStatus({ state: 'error', fileName: file.name, progress: 0 });
    }
  };

  const handleUploadNewVersion = async (file: File) => {
    if (!versionItem) return;
    const actor = data?.user?.name || 'Você';
    const sizeLabel = formatBytes(file.size || 524288);
    const newVer: FileVersion = {
      id: `v_${Date.now()}`,
      date: 'Agora mesmo',
      author: actor,
      size: sizeLabel,
    };
    const nextVersions = [newVer, ...(versionItem.versions || [])];
    await bridge.updateDriveItemMeta(versionItem.id, {
      date: 'Nova versão enviada agora',
      modifiedIso: new Date().toISOString(),
      size: sizeLabel,
      sizeBytes: file.size || 524288,
      versions: nextVersions,
    });
    await loadDriveItems();
    setVersionItem((prev) => (prev ? { ...prev, versions: nextVersions } : null));
    toast(`Nova versão de "${versionItem.name}" enviada!`);
  };

  const handleRestoreVersion = async (ver: FileVersion) => {
    if (!versionItem) return;
    const actor = data?.user?.name || 'Você';
    const existing =
      versionItem.versions && versionItem.versions.length > 0
        ? versionItem.versions
        : [{ id: 'v1', date: versionItem.date, author: actor, size: versionItem.size || '1.2 MB' }];
    const restoredVersion: FileVersion = {
      ...ver,
      id: `v_${Date.now()}`,
      date: `Restaurada (${ver.date})`,
    };
    const nextVersions = [restoredVersion, ...existing.filter((v) => v.id !== ver.id)];
    const nextActivity = [
      {
        id: `act_${Date.now()}`,
        actor,
        action: `Restaurou versão de ${ver.date}`,
        timestamp: 'Agora',
      },
      ...(versionItem.activityLog || []),
    ];
    await bridge.updateDriveItemMeta(versionItem.id, {
      date: 'Versão restaurada agora',
      modifiedIso: new Date().toISOString(),
      size: ver.size,
      versions: nextVersions,
      activityLog: nextActivity,
    });
    await loadDriveItems();
    setVersionItem((prev) => (prev ? { ...prev, versions: nextVersions, activityLog: nextActivity } : null));
    toast(`Versão de ${ver.date} restaurada.`);
  };

  const handleCreateTaskFromFile = async (item: EnrichedDriveItem) => {
    const sourceType =
      item.type === 'sheet' || item.type === 'slide' || item.type === 'doc'
        ? item.type
        : 'doc';
    const res = await bridge.createTask(
      `Revisar: ${item.name}`,
      `Arquivo do Google Drive (${item.owner})`,
      'default',
      new Date().toISOString(),
      undefined,
      {
        linkedSource: {
          type: sourceType,
          id: item.id,
          label: item.name,
        },
      }
    );
    if (res.success) {
      const allTasks = await bridge.getTasks('all');
      onUpdateTasks?.(allTasks);
      toast(`Tarefa vinculada a "${item.name}" criada no Google Tarefas!`);
    }
  };

  const handleAddCollaborator = async (emailToInvite?: string) => {
    const email = (emailToInvite || shareEmailInput).trim();
    if (!email || !shareItem) return;
    await bridge.addDrivePermission(shareItem.id, email, shareRoleInput);
    setShareEmailInput('');
    setContactSuggestions([]);
    await loadDriveItems();
    const updated = (await bridge.getAllDriveItems()).find((i) => i.id === shareItem.id) || null;
    setShareItem(updated);
    toast(`Acesso concedido para ${email}.`);
  };

  const handleChangeCollaboratorRole = async (email: string, nextRole: 'editor' | 'viewer') => {
    if (!shareItem) return;
    await bridge.addDrivePermission(shareItem.id, email, nextRole);
    await loadDriveItems();
    const updated = (await bridge.getAllDriveItems()).find((i) => i.id === shareItem.id) || null;
    setShareItem(updated);
    toast(`Permissão de ${email} atualizada para ${nextRole === 'editor' ? 'Editor' : 'Leitor'}.`);
  };

  const handleRemoveCollaborator = async (email: string) => {
    if (!shareItem) return;
    await bridge.removeDrivePermission(shareItem.id, email);
    await loadDriveItems();
    const updated = (await bridge.getAllDriveItems()).find((i) => i.id === shareItem.id) || null;
    setShareItem(updated);
    toast(`Acesso removido de ${email}.`);
  };

  const handleMoveConfirm = async () => {
    if (moveItems.length === 0) return;
    for (const item of moveItems) {
      if (item.type === 'folder' && isDescendantFolder(allItems, item.id, moveDestFolderId)) {
        toast('Não é possível mover uma pasta para dentro dela mesma ou de uma subpasta.');
        return;
      }
    }
    for (const item of moveItems) {
      await bridge.moveDriveItem(item.id, moveDestFolderId);
    }
    const label =
      moveItems.length === 1
        ? `"${moveItems[0].name}" movido com sucesso.`
        : `${moveItems.length} itens movidos com sucesso.`;
    setMoveItems([]);
    await loadDriveItems();
    toast(label);
  };

  const handleContextMenu = (e: React.MouseEvent, item: EnrichedDriveItem) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedIdSet.has(item.id)) {
      setSelectedIds([item.id]);
    }
    setContextMenu(null);

    const menuItems: ContextMenuItem[] = item.trashed
      ? [
          {
            label: 'Restaurar da lixeira',
            icon: <RotateCcw size={14} />,
            action: () => handleBatchRestore([item.id]),
          },
          {
            label: 'Excluir definitivamente',
            icon: <Trash2 size={14} />,
            isDestructive: true,
            action: () => handleBatchDeleteForever([item.id]),
          },
        ]
      : item.spam
      ? [
          {
            label: 'Não é spam',
            icon: <ShieldCheck size={14} />,
            action: () => handleNotSpam([item.id]),
          },
          {
            label: 'Excluir definitivamente',
            icon: <Trash2 size={14} />,
            isDestructive: true,
            action: () => handleBatchDeleteForever([item.id]),
          },
        ]
      : [
          { label: 'Abrir / Visualizar', icon: <ExternalLink size={14} />, action: () => handleOpenItem(item) },
          { label: 'Compartilhar', icon: <Share2 size={14} />, action: () => setShareItem(item) },
          { label: 'Copiar link', icon: <Link2 size={14} />, action: () => handleCopyShareLink(item) },
          { isSeparator: true, label: '', action: () => {} },
          {
            label: item.isStarred ? 'Remover de Com estrela' : 'Adicionar a Com estrela',
            icon: <Star size={14} />,
            action: () => handleToggleStar(item),
          },
          {
            label: 'Mover para...',
            icon: <FolderInput size={14} />,
            action: () => {
              setMoveItems([item]);
              setMoveDestFolderId(item.parentId || null);
            },
          },
          {
            label: 'Renomear',
            icon: <Edit2 size={14} />,
            action: () => {
              setModalTargetId(item.id);
              setModalInput(item.name);
              setModalMode('rename');
            },
          },
          ...(item.type === 'folder'
            ? [
                {
                  label: 'Alterar cor da pasta',
                  icon: <Palette size={14} />,
                  action: () => setShowColorPickerForId(item.id),
                },
              ]
            : [
                {
                  label: item.offlineAvailable ? 'Desativar acesso offline' : 'Tornar disponível offline',
                  icon: <WifiOff size={14} />,
                  action: () => handleToggleOffline(item),
                },
                { label: 'Fazer uma cópia', icon: <Copy size={14} />, action: () => handleDuplicate(item) },
                { label: 'Gerenciar versões', icon: <History size={14} />, action: () => setVersionItem(item) },
                { label: 'Fazer download', icon: <Download size={14} />, action: () => handleDownloadItem(item) },
              ]),
          {
            label: 'Adicionar às Tarefas',
            icon: <CheckSquare size={14} />,
            action: () => handleCreateTaskFromFile(item),
          },
          { isSeparator: true, label: '', action: () => {} },
          {
            label: 'Denunciar spam',
            icon: <AlertOctagon size={14} />,
            action: () => handleReportSpam([item.id]),
          },
          {
            label: 'Mover para a lixeira',
            icon: <Trash2 size={14} />,
            isDestructive: true,
            action: () => handleTrashItems([item.id]),
          },
        ];

    setTimeout(() => setContextMenu({ x: e.clientX, y: e.clientY, items: menuItems }), 30);
  };

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggingItemId(id);
  };
  const handleItemDropOnFolder = async (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
    if (!draggingItemId || draggingItemId === targetFolderId) return;
    const dragged = allItems.find((i) => i.id === draggingItemId);
    if (dragged?.type === 'folder' && isDescendantFolder(allItems, dragged.id, targetFolderId)) {
      setDraggingItemId(null);
      toast('Não é possível mover uma pasta para dentro dela mesma ou de uma subpasta.');
      return;
    }
    const moved = await bridge.moveDriveItem(draggingItemId, targetFolderId);
    setDraggingItemId(null);
    if (moved) {
      toast('Item movido com sucesso!');
      await loadDriveItems();
    }
  };

  // Theme tokens
  const bgMain = isDarkMode ? 'bg-[#14161A]/95 text-[#E8EAED]' : 'bg-[#F8FAFD] text-[#202124]';
  const bgSidebar = isDarkMode ? 'bg-[#1A1D24]/95 border-white/10' : 'bg-[#F3F6FC] border-black/10';
  const borderSubtle = isDarkMode ? 'border-white/10' : 'border-black/10';
  const textMuted = isDarkMode ? 'text-[#9AA0A6]' : 'text-[#5F6368]';
  const hoverItem = isDarkMode ? 'hover:bg-white/5' : 'hover:bg-black/5';
  const cardSurface = isDarkMode ? 'bg-[#20232B] border-white/15' : 'bg-white border-black/10';

  const navItems: Array<{ id: DriveCategory; label: string; icon: React.ReactNode }> = [
    { id: 'home', label: 'Página inicial', icon: <Home size={16} /> },
    { id: 'my-drive', label: 'Meu Drive', icon: <HardDrive size={16} /> },
    { id: 'shared', label: 'Compartilhados comigo', icon: <Users size={16} /> },
    { id: 'recent', label: 'Recentes', icon: <Clock size={16} /> },
    { id: 'starred', label: 'Com estrela', icon: <Star size={16} /> },
    { id: 'spam', label: 'Spam', icon: <AlertOctagon size={16} /> },
    { id: 'trash', label: 'Lixeira', icon: <Trash2 size={16} /> },
    { id: 'storage', label: 'Armazenamento', icon: <Cloud size={16} /> },
  ];

  const renderSidebarContent = () => (
    <>
      <div className="space-y-4">
        {/* + Novo Button + Dropdown */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            data-testid="drive-new-btn"
            onClick={() => setShowNewMenu((v) => !v)}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-2xl bg-[#1A73E8] hover:bg-[#1557B0] text-white font-medium text-sm shadow-md transition-all min-h-[40px]"
          >
            <Plus size={18} />
            <span>Novo</span>
          </button>

          {showNewMenu && (
            <div
              data-testid="drive-new-menu"
              className={`absolute left-0 right-0 mt-2 rounded-2xl border ${cardSurface} shadow-2xl p-1.5 z-50 space-y-1 text-xs`}
            >
              <button
                data-testid="drive-new-folder-btn"
                onClick={() => {
                  setShowNewMenu(false);
                  setShowMobileSidebar(false);
                  setModalInput('');
                  setModalFolderColor('#1A73E8');
                  setModalMode('create_folder');
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl ${hoverItem}`}
              >
                <Folder size={15} className="text-blue-400" />
                <span>Nova pasta</span>
              </button>
              <button
                onClick={() => {
                  setShowNewMenu(false);
                  setShowMobileSidebar(false);
                  fileInputRef.current?.click();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl ${hoverItem}`}
              >
                <Upload size={15} className={textMuted} />
                <span>Upload de arquivo</span>
              </button>
              <button
                onClick={() => {
                  setShowNewMenu(false);
                  setShowMobileSidebar(false);
                  folderInputRef.current?.click();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl ${hoverItem}`}
              >
                <FolderUp size={15} className={textMuted} />
                <span>Upload de lote / pasta</span>
              </button>

              <div className={`my-1 border-t ${borderSubtle}`} />

              <button
                data-testid="drive-new-doc-btn"
                onClick={() => {
                  setShowNewMenu(false);
                  setShowMobileSidebar(false);
                  setPendingDocType('doc');
                  setModalInput('');
                  setModalMode('create_doc');
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl ${hoverItem}`}
              >
                <GoogleIcons.Docs className="w-4 h-4" />
                <span>Documentos Google</span>
              </button>
              <button
                data-testid="drive-new-sheet-btn"
                onClick={() => {
                  setShowNewMenu(false);
                  setShowMobileSidebar(false);
                  setPendingDocType('sheet');
                  setModalInput('');
                  setModalMode('create_doc');
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl ${hoverItem}`}
              >
                <GoogleIcons.Sheets className="w-4 h-4" />
                <span>Planilhas Google</span>
              </button>
              <button
                data-testid="drive-new-slide-btn"
                onClick={() => {
                  setShowNewMenu(false);
                  setShowMobileSidebar(false);
                  setPendingDocType('slide');
                  setModalInput('');
                  setModalMode('create_doc');
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl ${hoverItem}`}
              >
                <GoogleIcons.Slides className="w-4 h-4" />
                <span>Apresentações Google</span>
              </button>
            </div>
          )}
        </div>

        {/* Category Navigation */}
        <nav aria-label="Categorias do Google Drive" className="space-y-1">
          {navItems.map((nav) => {
            const isActive = category === nav.id;
            return (
              <div key={nav.id}>
                <button
                  data-testid={`drive-nav-${nav.id}`}
                  onClick={() => {
                    setCategory(nav.id);
                    setSelectedIds([]);
                    if (nav.id !== 'my-drive') setCurrentFolderId(null);
                    setShowMobileSidebar(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all min-h-[34px] ${
                    isActive
                      ? 'bg-[#1A73E8]/15 text-[#1A73E8] font-semibold'
                      : `${textMuted} ${hoverItem}`
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {nav.icon}
                    <span>{nav.label}</span>
                  </span>
                  {nav.id === 'my-drive' && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedSidebarFolders((v) => !v);
                      }}
                      className="p-0.5 rounded hover:bg-white/10"
                    >
                      {expandedSidebarFolders ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </span>
                  )}
                </button>

                {/* Hierarchical Expandable Folder Tree under Meu Drive */}
                {nav.id === 'my-drive' && expandedSidebarFolders && folderTreeNodes.length > 0 && (
                  <div className="pl-3 pr-1 py-1 space-y-0.5">
                    {folderTreeNodes.map(({ folder: fld, depth }) => (
                      <button
                        key={fld.id}
                        onClick={() => {
                          setCategory('my-drive');
                          setCurrentFolderId(fld.id);
                          setSelectedIds([]);
                          setShowMobileSidebar(false);
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleItemDropOnFolder(e, fld.id)}
                        style={{ paddingLeft: `${10 + Math.min(depth, 4) * 14}px` }}
                        className={`w-full flex items-center gap-2 pr-2.5 py-1.5 rounded-lg text-[11px] truncate transition-colors min-h-[28px] ${
                          currentFolderId === fld.id && category === 'my-drive'
                            ? 'bg-blue-500/20 text-blue-400 font-semibold'
                            : `${textMuted} ${hoverItem}`
                        }`}
                      >
                        <Folder
                          size={13}
                          className="shrink-0 fill-current"
                          style={{ color: fld.folderColor || '#1A73E8' }}
                        />
                        <span className="truncate">{fld.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Storage Meter Widget */}
      <div className={`pt-4 border-t ${borderSubtle} space-y-2 text-xs`}>
        <div className="flex items-center justify-between">
          <span className="font-semibold flex items-center gap-1.5">
            <Cloud size={14} className="text-[#1A73E8]" />
            Armazenamento
          </span>
          <span data-testid="drive-storage-percent" className={`text-[11px] font-mono ${textMuted}`}>
            {storagePercentInfo.label}
          </span>
        </div>
        <div className={`w-full h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-white/10' : 'bg-black/10'}`}>
          <div
            className="h-full bg-gradient-to-r from-[#1A73E8] to-[#34A853] rounded-full transition-all"
            style={{ width: `${storagePercentInfo.barWidthPercent}%` }}
          />
        </div>
        <p className={`text-[11px] ${textMuted}`}>
          {formatBytes(storageBreakdown.usedBytes)} de 15 GB usados
        </p>
        <button
          onClick={() => {
            setCategory('storage');
            setShowMobileSidebar(false);
          }}
          className="w-full py-1.5 rounded-xl border border-[#1A73E8]/40 text-[#1A73E8] text-[11px] font-medium hover:bg-[#1A73E8]/10 transition-colors min-h-[30px]"
        >
          Gerenciar armazenamento
        </button>
      </div>
    </>
  );

  return (
    <div
      data-testid="drive-app"
      className={`flex flex-col h-full select-none relative overflow-hidden ${bgMain}`}
      onClick={() => {
        setContextMenu(null);
        setShowNewMenu(false);
        setShowColorPickerForId(null);
      }}
    >
      {/* Hidden file inputs (reset value after selection so re-uploading the same file works) */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
          e.target.value = '';
        }}
      />
      <input
        type="file"
        ref={folderInputRef}
        className="hidden"
        multiple
        onChange={(e) => {
          const filesList = Array.from(e.target.files || []) as File[];
          filesList.forEach((f) => handleFileUpload(f));
          e.target.value = '';
        }}
      />
      <input
        type="file"
        ref={versionUploadRef}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handleUploadNewVersion(e.target.files[0]);
          e.target.value = '';
        }}
      />

      {/* TOP HEADER BAR */}
      <header className={`min-h-16 px-3 sm:px-5 py-2.5 border-b ${borderSubtle} flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 sm:gap-4 shrink-0`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            data-testid="drive-mobile-menu-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowMobileSidebar((v) => !v);
            }}
            className={`md:hidden p-2 rounded-xl border ${borderSubtle} ${hoverItem} min-h-[34px] min-w-[34px] flex items-center justify-center`}
            aria-label="Abrir menu lateral"
            title="Menu"
          >
            <Menu size={16} />
          </button>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <GoogleIcons.Drive className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-semibold tracking-tight leading-none truncate">Google Drive</h1>
            <span className={`hidden sm:inline text-[11px] ${textMuted}`}>Armazenamento em nuvem sincronizado</span>
          </div>
        </div>

        {/* Search Input with Operator Support */}
        <div
          className={`order-3 sm:order-none w-full sm:w-auto sm:flex-1 sm:max-w-xl flex items-center gap-2 px-3 py-2 rounded-2xl border ${borderSubtle} ${
            isDarkMode ? 'bg-white/5' : 'bg-white shadow-xs'
          }`}
        >
          <Search size={15} className={`${textMuted} shrink-0`} />
          <input
            data-testid="drive-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar no Drive (type:pdf, type:image, is:starred, is:offline)..."
            className="bg-transparent text-xs outline-none w-full placeholder:text-gray-400 min-w-0"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="opacity-60 hover:opacity-100 p-0.5"
              aria-label="Limpar pesquisa"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className={`flex items-center p-0.5 sm:p-1 rounded-xl border ${borderSubtle}`}>
            <button
              data-testid="drive-layout-list"
              onClick={() => setViewLayout('list')}
              className={`p-1.5 rounded-lg transition-colors min-h-[28px] min-w-[28px] flex items-center justify-center ${
                viewLayout === 'list' ? 'bg-[#1A73E8] text-white' : textMuted
              }`}
              aria-label="Layout de lista"
              title="Layout de lista (Atalho: V)"
            >
              <List size={15} />
            </button>
            <button
              data-testid="drive-layout-grid"
              onClick={() => setViewLayout('grid')}
              className={`p-1.5 rounded-lg transition-colors min-h-[28px] min-w-[28px] flex items-center justify-center ${
                viewLayout === 'grid' ? 'bg-[#1A73E8] text-white' : textMuted
              }`}
              aria-label="Layout de grade"
              title="Layout de grade (Atalho: V)"
            >
              <LayoutGrid size={15} />
            </button>
          </div>

          <button
            data-testid="drive-toggle-details-btn"
            onClick={() => setShowDetailsDrawer((v) => !v)}
            className={`p-2 rounded-xl border ${borderSubtle} transition-colors min-h-[34px] min-w-[34px] flex items-center justify-center ${
              showDetailsDrawer ? 'bg-blue-500/15 text-blue-400 border-blue-500/40' : hoverItem
            }`}
            aria-label="Ver detalhes e atividade"
            title="Ver detalhes e atividade (Atalho: I)"
          >
            <Info size={16} />
          </button>

          <button
            data-testid="drive-shortcuts-btn"
            onClick={() => setShowShortcutsModal(true)}
            className={`hidden sm:flex p-2 rounded-xl border ${borderSubtle} ${hoverItem} transition-colors min-h-[34px] min-w-[34px] items-center justify-center`}
            aria-label="Atalhos de teclado"
            title="Atalhos de teclado (?)"
          >
            <HelpCircle size={16} />
          </button>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl border ${borderSubtle} hover:bg-red-500/20 hover:text-red-400 transition-colors min-h-[34px] min-w-[34px] flex items-center justify-center`}
            aria-label="Fechar Google Drive"
            title="Fechar Google Drive"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* BODY: SIDEBAR + MAIN CONTENT + DETAILS DRAWER */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* DESKTOP LEFT SIDEBAR */}
        <aside className={`hidden md:flex w-60 lg:w-64 border-r ${bgSidebar} p-4 flex-col justify-between overflow-y-auto custom-scrollbar shrink-0`}>
          {renderSidebarContent()}
        </aside>

        {/* MOBILE SIDEBAR DRAWER OVERLAY */}
        {showMobileSidebar && (
          <div
            className="md:hidden absolute inset-0 z-40 flex bg-black/50 backdrop-blur-[1px]"
            onClick={() => setShowMobileSidebar(false)}
          >
            <aside
              data-testid="drive-mobile-sidebar"
              className={`w-64 max-w-[82vw] h-full border-r ${bgSidebar} p-4 flex flex-col justify-between overflow-y-auto custom-scrollbar shadow-2xl`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
                <span className="text-xs font-bold">Navegação</span>
                <button
                  onClick={() => setShowMobileSidebar(false)}
                  className={`p-1.5 rounded-lg ${hoverItem}`}
                  aria-label="Fechar menu lateral"
                >
                  <X size={15} />
                </button>
              </div>
              {renderSidebarContent()}
            </aside>
          </div>
        )}

        {/* CENTER MAIN VIEWPORT */}
        <main
          className="flex-1 flex flex-col min-w-0 overflow-hidden"
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleFileUpload(e.dataTransfer.files[0]);
            }
          }}
        >
          {/* SUB-HEADER: Breadcrumbs + Filter Chips + Contextual Action Bar */}
          <div className={`px-3 sm:px-5 py-3 border-b ${borderSubtle} flex flex-wrap items-center justify-between gap-2.5 shrink-0`}>
            {/* Breadcrumb Trail or Category Title */}
            <div className="flex items-center gap-1 text-sm font-semibold min-w-0 flex-wrap">
              {category === 'my-drive' ? (
                breadcrumbs.map((crumb, idx) => (
                  <React.Fragment key={crumb.id || 'root'}>
                    {idx > 0 && <ChevronRight size={15} className={`${textMuted} shrink-0`} />}
                    <button
                      onClick={() => {
                        setCurrentFolderId(crumb.id);
                        setSelectedIds([]);
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleItemDropOnFolder(e, crumb.id)}
                      className={`px-2 py-1 rounded-lg ${hoverItem} truncate max-w-[180px] sm:max-w-none ${
                        idx === breadcrumbs.length - 1 ? 'font-bold' : textMuted
                      }`}
                    >
                      {crumb.name}
                    </button>
                  </React.Fragment>
                ))
              ) : (
                <span className="px-2 py-1">
                  {navItems.find((n) => n.id === category)?.label || 'Google Drive'}
                </span>
              )}
            </div>

            {/* Contextual Action Toolbar when 1+ items are selected, or Filter Chips when none */}
            {selectedItems.length > 0 && selectedItem ? (
              <div
                data-testid="drive-selection-toolbar"
                className={`flex flex-wrap items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-2xl border ${cardSurface} shadow-sm text-xs max-w-full`}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setSelectedIds([])}
                  className={`p-1 rounded-lg ${hoverItem}`}
                  aria-label="Limpar seleção"
                  title="Limpar seleção (Esc)"
                >
                  <X size={13} />
                </button>
                <span className="font-semibold truncate max-w-[130px] sm:max-w-[180px] pr-2 border-r border-white/10">
                  {selectedItems.length > 1
                    ? `${selectedItems.length} selecionados`
                    : selectedItem.name}
                </span>

                {selectedItems.every((i) => i.trashed) ? (
                  <>
                    <button
                      onClick={() => handleBatchRestore(selectedItems.map((i) => i.id))}
                      className={`px-2.5 py-1 rounded-lg ${hoverItem} flex items-center gap-1 text-emerald-400 font-medium min-h-[28px]`}
                    >
                      <RotateCcw size={14} /> Restaurar
                    </button>
                    <button
                      onClick={() => handleBatchDeleteForever(selectedItems.map((i) => i.id))}
                      className={`px-2.5 py-1 rounded-lg ${hoverItem} flex items-center gap-1 text-red-400 font-medium min-h-[28px]`}
                    >
                      <Trash2 size={14} /> Excluir definitivamente
                    </button>
                  </>
                ) : selectedItems.every((i) => i.spam) ? (
                  <>
                    <button
                      data-testid="drive-not-spam-btn"
                      onClick={() => handleNotSpam(selectedItems.map((i) => i.id))}
                      className={`px-2.5 py-1 rounded-lg ${hoverItem} flex items-center gap-1 text-emerald-400 font-medium min-h-[28px]`}
                    >
                      <ShieldCheck size={14} /> Não é spam
                    </button>
                    <button
                      onClick={() => handleBatchDeleteForever(selectedItems.map((i) => i.id))}
                      className={`px-2.5 py-1 rounded-lg ${hoverItem} flex items-center gap-1 text-red-400 font-medium min-h-[28px]`}
                    >
                      <Trash2 size={14} /> Excluir definitivamente
                    </button>
                  </>
                ) : (
                  <>
                    {selectedItems.length === 1 && (
                      <button
                        data-testid="drive-toolbar-open-btn"
                        onClick={() => handleOpenItem(selectedItem)}
                        className="px-2.5 py-1 rounded-lg bg-[#1A73E8]/15 text-[#1A73E8] hover:bg-[#1A73E8]/25 flex items-center gap-1 font-semibold min-h-[28px]"
                        title="Abrir item (Enter)"
                      >
                        <ExternalLink size={13} /> Abrir
                      </button>
                    )}
                    {selectedItems.length === 1 && (
                      <>
                        <button
                          data-testid="drive-toolbar-share-btn"
                          onClick={() => setShareItem(selectedItem)}
                          className={`p-1.5 rounded-lg ${hoverItem} min-h-[28px] min-w-[28px] flex items-center justify-center`}
                          aria-label="Compartilhar"
                          title="Compartilhar"
                        >
                          <Share2 size={15} />
                        </button>
                        <button
                          onClick={() => handleCopyShareLink(selectedItem)}
                          className={`p-1.5 rounded-lg ${hoverItem} min-h-[28px] min-w-[28px] flex items-center justify-center`}
                          aria-label="Copiar link"
                          title="Copiar link"
                        >
                          <Link2 size={15} />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() =>
                        selectedItems.length > 1
                          ? handleBatchStar(selectedItems)
                          : handleToggleStar(selectedItem)
                      }
                      className={`p-1.5 rounded-lg ${hoverItem} min-h-[28px] min-w-[28px] flex items-center justify-center`}
                      aria-label={selectedItem.isStarred ? 'Remover estrela' : 'Adicionar estrela'}
                      title={selectedItem.isStarred ? 'Remover estrela' : 'Adicionar estrela'}
                    >
                      <Star
                        size={15}
                        className={selectedItem.isStarred ? 'text-amber-400 fill-amber-400' : ''}
                      />
                    </button>
                    <button
                      data-testid="drive-toolbar-move-btn"
                      onClick={() => {
                        setMoveItems(selectedItems);
                        setMoveDestFolderId(selectedItem.parentId || null);
                      }}
                      className={`p-1.5 rounded-lg ${hoverItem} min-h-[28px] min-w-[28px] flex items-center justify-center`}
                      aria-label="Mover para..."
                      title="Mover para..."
                    >
                      <FolderInput size={15} />
                    </button>
                    {selectedItems.length === 1 && (
                      <>
                        <button
                          data-testid="drive-toolbar-rename-btn"
                          onClick={() => {
                            setModalTargetId(selectedItem.id);
                            setModalInput(selectedItem.name);
                            setModalMode('rename');
                          }}
                          className={`p-1.5 rounded-lg ${hoverItem} min-h-[28px] min-w-[28px] flex items-center justify-center`}
                          aria-label="Renomear"
                          title="Renomear (F2)"
                        >
                          <Edit2 size={15} />
                        </button>
                        {selectedItem.type === 'folder' ? (
                          <div className="relative">
                            <button
                              onClick={() =>
                                setShowColorPickerForId((id) => (id === selectedItem.id ? null : selectedItem.id))
                              }
                              className={`p-1.5 rounded-lg ${hoverItem} min-h-[28px] min-w-[28px] flex items-center justify-center`}
                              aria-label="Cor da pasta"
                              title="Cor da pasta"
                            >
                              <Palette size={15} />
                            </button>
                            {showColorPickerForId === selectedItem.id && (
                              <div
                                className={`absolute right-0 mt-2 p-2.5 rounded-2xl border ${cardSurface} shadow-xl z-40 grid grid-cols-5 gap-1.5 w-40`}
                              >
                                {DRIVE_FOLDER_COLORS.map((col) => (
                                  <button
                                    key={col.id}
                                    onClick={() => handleChangeFolderColor(selectedItem.id, col.hex)}
                                    title={col.name}
                                    aria-label={col.name}
                                    className="w-6 h-6 rounded-full flex items-center justify-center border border-white/20"
                                    style={{ backgroundColor: col.hex }}
                                  >
                                    {selectedItem.folderColor === col.hex && (
                                      <Check size={12} className="text-white" />
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => handleDuplicate(selectedItem)}
                              className={`p-1.5 rounded-lg ${hoverItem} min-h-[28px] min-w-[28px] flex items-center justify-center`}
                              aria-label="Fazer uma cópia"
                              title="Fazer uma cópia"
                            >
                              <Copy size={15} />
                            </button>
                            <button
                              data-testid="drive-toolbar-versions-btn"
                              onClick={() => setVersionItem(selectedItem)}
                              className={`p-1.5 rounded-lg ${hoverItem} min-h-[28px] min-w-[28px] flex items-center justify-center`}
                              aria-label="Gerenciar versões"
                              title="Gerenciar versões"
                            >
                              <History size={15} />
                            </button>
                            <button
                              onClick={() => handleDownloadItem(selectedItem)}
                              className={`p-1.5 rounded-lg ${hoverItem} min-h-[28px] min-w-[28px] flex items-center justify-center`}
                              aria-label="Fazer download"
                              title="Fazer download"
                            >
                              <Download size={15} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleCreateTaskFromFile(selectedItem)}
                          className={`p-1.5 rounded-lg ${hoverItem} min-h-[28px] min-w-[28px] flex items-center justify-center`}
                          aria-label="Criar tarefa no Google Tarefas"
                          title="Criar tarefa no Google Tarefas"
                        >
                          <CheckSquare size={15} />
                        </button>
                      </>
                    )}
                    <button
                      data-testid="drive-toolbar-spam-btn"
                      onClick={() => handleReportSpam(selectedItems.map((i) => i.id))}
                      className={`p-1.5 rounded-lg ${hoverItem} min-h-[28px] min-w-[28px] flex items-center justify-center`}
                      aria-label="Denunciar spam"
                      title="Denunciar spam"
                    >
                      <AlertOctagon size={15} />
                    </button>
                    <button
                      data-testid="drive-toolbar-trash-btn"
                      onClick={() => handleTrashItems(selectedItems.map((i) => i.id))}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 min-h-[28px] min-w-[28px] flex items-center justify-center"
                      aria-label="Mover para a lixeira"
                      title="Mover para a lixeira (Delete)"
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>
            ) : (
              /* Native Filter Chips Row */
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs">
                <select
                  data-testid="drive-type-filter"
                  aria-label="Filtrar por tipo"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as DriveFileTypeFilter)}
                  className={`px-2.5 py-1.5 rounded-xl border ${borderSubtle} ${
                    isDarkMode ? 'bg-[#20232B]' : 'bg-white'
                  } outline-none min-h-[30px]`}
                >
                  <option value="all">Tipo: Todos</option>
                  <option value="folder">Pastas</option>
                  <option value="doc">Documentos</option>
                  <option value="sheet">Planilhas</option>
                  <option value="slide">Apresentações</option>
                  <option value="pdf">PDFs</option>
                  <option value="image">Imagens</option>
                </select>

                <select
                  data-testid="drive-owner-filter"
                  aria-label="Filtrar por proprietário"
                  value={ownerFilter}
                  onChange={(e) => setOwnerFilter(e.target.value as DriveOwnerFilter)}
                  className={`px-2.5 py-1.5 rounded-xl border ${borderSubtle} ${
                    isDarkMode ? 'bg-[#20232B]' : 'bg-white'
                  } outline-none min-h-[30px]`}
                >
                  <option value="all">Pessoas: Todos</option>
                  <option value="me">De minha propriedade</option>
                  <option value="others">Compartilhados comigo</option>
                </select>

                <select
                  aria-label="Filtrar por data de modificação"
                  value={modifiedFilter}
                  onChange={(e) => setModifiedFilter(e.target.value as DriveModifiedFilter)}
                  className={`px-2.5 py-1.5 rounded-xl border ${borderSubtle} ${
                    isDarkMode ? 'bg-[#20232B]' : 'bg-white'
                  } outline-none min-h-[30px]`}
                >
                  <option value="any">Modificado: Qualquer data</option>
                  <option value="today">Hoje</option>
                  <option value="week">Últimos 7 dias</option>
                  <option value="month">Últimos 30 dias</option>
                </select>

                <div className={`inline-flex items-center rounded-xl border ${borderSubtle} overflow-hidden`}>
                  <button
                    data-testid="drive-sort-field-btn"
                    onClick={() => {
                      if (sortField === 'name') setSortField('date');
                      else if (sortField === 'date') setSortField('size');
                      else setSortField('name');
                    }}
                    className={`px-2.5 py-1.5 ${hoverItem} flex items-center gap-1 min-h-[30px]`}
                    title="Alternar critério de ordenação"
                  >
                    <ArrowUpDown size={13} />
                    <span>
                      Ordenar:{' '}
                      {sortField === 'name' ? 'Nome' : sortField === 'date' ? 'Modificação' : 'Tamanho'}
                    </span>
                  </button>
                  <button
                    data-testid="drive-sort-order-btn"
                    onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
                    className={`px-2 py-1.5 border-l ${borderSubtle} ${hoverItem} min-h-[30px] flex items-center justify-center`}
                    aria-label={sortOrder === 'asc' ? 'Ordem crescente' : 'Ordem decrescente'}
                    title={sortOrder === 'asc' ? 'Ordem crescente (A-Z / Mais antigo)' : 'Ordem decrescente (Z-A / Mais recente)'}
                  >
                    {sortOrder === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Trash Banner */}
          {category === 'trash' && (folders.length > 0 || files.length > 0) && (
            <div className="mx-3 sm:mx-5 mt-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span>Os itens na lixeira podem ser restaurados ou excluídos permanentemente.</span>
              <button
                data-testid="drive-empty-trash-btn"
                onClick={handleEmptyTrash}
                className="px-3 py-1.5 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 font-semibold transition-colors min-h-[30px]"
              >
                Esvaziar lixeira
              </button>
            </div>
          )}

          {/* Spam Banner */}
          {category === 'spam' && (folders.length > 0 || files.length > 0) && (
            <div className="mx-3 sm:mx-5 mt-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span>Arquivos marcados como spam ficam isolados do Meu Drive. Selecione para marcar como "Não é spam" ou excluir.</span>
            </div>
          )}

          {/* Storage Breakdown Banner */}
          {category === 'storage' && (
            <div className={`mx-3 sm:mx-5 mt-4 p-4 rounded-2xl border ${cardSurface} space-y-3`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold">Uso detalhado do armazenamento</h3>
                  <p className={`text-xs ${textMuted}`}>
                    Total utilizado nos arquivos do Google Drive: {formatBytes(storageBreakdown.usedBytes)} de 15 GB ({storagePercentInfo.label})
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Docs:{' '}
                    {formatBytes(storageBreakdown.byType.doc)}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Sheets:{' '}
                    {formatBytes(storageBreakdown.byType.sheet)}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Slides:{' '}
                    {formatBytes(storageBreakdown.byType.slide)}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> PDFs & Mídia:{' '}
                    {formatBytes(storageBreakdown.byType.pdf + storageBreakdown.byType.image)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* FILE & FOLDER CONTENT AREA */}
          <div
            className={`flex-1 overflow-y-auto p-3 sm:p-5 custom-scrollbar relative ${
              isDragOver && !dragOverFolderId ? 'bg-blue-500/10' : ''
            }`}
            onClick={() => setSelectedIds([])}
          >
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 size={28} className="animate-spin text-[#1A73E8]" />
              </div>
            ) : folders.length === 0 && files.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-16">
                <div className="w-16 h-16 rounded-3xl bg-blue-500/10 flex items-center justify-center mb-3 text-blue-400">
                  <HardDrive size={30} />
                </div>
                <h3 className="text-sm font-semibold">Nenhum arquivo ou pasta encontrado</h3>
                <p className={`text-xs ${textMuted} mt-1 max-w-xs`}>
                  Clique em &quot;+ Novo&quot; ou arraste arquivos para cá para fazer upload.
                </p>
              </div>
            ) : viewLayout === 'grid' ? (
              /* GRID LAYOUT */
              <div className="space-y-6">
                {folders.length > 0 && (
                  <section>
                    <h4 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${textMuted}`}>
                      Pastas ({folders.length})
                    </h4>
                    <div className={`grid grid-cols-1 sm:grid-cols-2 ${showDetailsDrawer ? 'xl:grid-cols-3' : 'lg:grid-cols-3 xl:grid-cols-4'} gap-3`}>
                      {folders.map((fld) => {
                        const isSelected = selectedIdSet.has(fld.id);
                        const isDropTarget = dragOverFolderId === fld.id;
                        return (
                          <div
                            key={fld.id}
                            data-testid={`drive-folder-card-${fld.id}`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, fld.id)}
                            onDragEnd={() => setDraggingItemId(null)}
                            onDragOver={(e) => {
                              e.preventDefault();
                              setDragOverFolderId(fld.id);
                            }}
                            onDragLeave={() => setDragOverFolderId(null)}
                            onDrop={(e) => handleItemDropOnFolder(e, fld.id)}
                            onClick={(e) => handleSelectItemClick(e, fld.id)}
                            onDoubleClick={() => handleOpenItem(fld)}
                            onContextMenu={(e) => handleContextMenu(e, fld)}
                            className={`group p-3.5 rounded-2xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                              isDropTarget
                                ? 'bg-blue-500/25 border-blue-400 scale-[1.02]'
                                : isSelected
                                ? 'bg-[#1A73E8]/15 border-[#1A73E8] ring-1 ring-[#1A73E8]'
                                : `${cardSurface} ${hoverItem}`
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="relative w-5 h-5 shrink-0 flex items-center justify-center">
                                <span className={isSelected ? 'opacity-0' : 'group-hover:opacity-0 transition-opacity'}>
                                  {renderItemIcon(fld, 'w-5 h-5')}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => handleToggleItemCheckbox(e, fld.id)}
                                  aria-label={`Selecionar pasta ${fld.name}`}
                                  className={`absolute inset-0 w-5 h-5 rounded-md border flex items-center justify-center transition-opacity ${
                                    isSelected
                                      ? 'bg-[#1A73E8] border-[#1A73E8] text-white opacity-100'
                                      : `${borderSubtle} bg-white/80 dark:bg-black/40 opacity-0 group-hover:opacity-100 focus:opacity-100`
                                  }`}
                                >
                                  {isSelected && <Check size={12} />}
                                </button>
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold truncate">{fld.name}</div>
                                <div className={`text-[10px] ${textMuted} truncate`}>{fld.date}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {fld.isStarred && (
                                <Star size={12} className="text-amber-400 fill-amber-400" />
                              )}
                              <button
                                onClick={(e) => handleContextMenu(e, fld)}
                                aria-label={`Opções da pasta ${fld.name}`}
                                className={`p-1.5 rounded-lg ${hoverItem} min-h-[28px] min-w-[28px] flex items-center justify-center`}
                              >
                                <MoreVertical size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {files.length > 0 && (
                  <section>
                    <h4 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${textMuted}`}>
                      Arquivos ({files.length})
                    </h4>
                    <div className={`grid grid-cols-1 sm:grid-cols-2 ${showDetailsDrawer ? 'xl:grid-cols-3' : 'lg:grid-cols-3 xl:grid-cols-4'} gap-4`}>
                      {files.map((file) => {
                        const isSelected = selectedIdSet.has(file.id);
                        return (
                          <div
                            key={file.id}
                            data-testid={`drive-file-card-${file.id}`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, file.id)}
                            onDragEnd={() => setDraggingItemId(null)}
                            onClick={(e) => handleSelectItemClick(e, file.id)}
                            onDoubleClick={() => handleOpenItem(file)}
                            onContextMenu={(e) => handleContextMenu(e, file)}
                            className={`group rounded-2xl border overflow-hidden flex flex-col cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-[#1A73E8]/15 border-[#1A73E8] ring-1 ring-[#1A73E8]'
                                : `${cardSurface} ${hoverItem}`
                            }`}
                          >
                            {/* File Preview Top Area */}
                            <div
                              className={`h-28 relative flex items-center justify-center overflow-hidden ${
                                isDarkMode ? 'bg-black/25' : 'bg-gray-100/80'
                              }`}
                            >
                              {file.thumbnail ? (
                                <img
                                  src={file.thumbnail}
                                  alt={file.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                renderItemIcon(file, 'w-11 h-11 opacity-90')
                              )}

                              {/* Multi-select checkbox */}
                              <button
                                type="button"
                                onClick={(e) => handleToggleItemCheckbox(e, file.id)}
                                aria-label={`Selecionar arquivo ${file.name}`}
                                className={`absolute top-2 left-2 w-6 h-6 rounded-lg border flex items-center justify-center transition-opacity ${
                                  isSelected
                                    ? 'bg-[#1A73E8] border-[#1A73E8] text-white opacity-100'
                                    : 'bg-black/45 border-white/40 text-white opacity-0 group-hover:opacity-100 focus:opacity-100'
                                }`}
                              >
                                {isSelected && <Check size={13} />}
                              </button>

                              {/* Hover Quick Actions */}
                              <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShareItem(file);
                                  }}
                                  className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80"
                                  aria-label={`Compartilhar ${file.name}`}
                                  title="Compartilhar"
                                >
                                  <Share2 size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleStar(file);
                                  }}
                                  className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80"
                                  aria-label={`Estrela em ${file.name}`}
                                  title="Estrela"
                                >
                                  <Star
                                    size={12}
                                    className={file.isStarred ? 'text-amber-400 fill-amber-400' : ''}
                                  />
                                </button>
                              </div>
                            </div>

                            {/* File Footer */}
                            <div className={`p-3 border-t ${borderSubtle} flex items-center justify-between gap-2`}>
                              <div className="flex items-center gap-2.5 min-w-0">
                                {renderItemIcon(file, 'w-4 h-4 shrink-0')}
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold truncate">{file.name}</div>
                                  <div className={`text-[10px] ${textMuted} truncate`}>
                                    {file.owner === 'eu' ? 'Meu Drive' : file.owner} · {file.size || file.date}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {file.offlineAvailable && (
                                  <span title="Disponível offline" className="shrink-0">
                                    <Check size={13} className="text-emerald-400" />
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => handleContextMenu(e, file)}
                                  aria-label={`Opções de ${file.name}`}
                                  className={`p-1 rounded-lg ${hoverItem} min-h-[26px] min-w-[26px] flex items-center justify-center`}
                                >
                                  <MoreVertical size={13} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>
            ) : (
              /* LIST (TABLE) LAYOUT */
              <div className={`rounded-2xl border ${cardSurface} overflow-x-auto`}>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className={`border-b ${borderSubtle} ${textMuted} text-[11px] uppercase`}>
                      <th className="py-3 pl-3 pr-1 w-8">
                        <input
                          type="checkbox"
                          aria-label="Selecionar todos os itens visíveis"
                          checked={
                            visibleItemsOrdered.length > 0 &&
                            visibleItemsOrdered.every((i) => selectedIdSet.has(i.id))
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds(visibleItemsOrdered.map((i) => i.id));
                            } else {
                              setSelectedIds([]);
                            }
                          }}
                        />
                      </th>
                      <th className="py-3 px-3 font-semibold">
                        <button
                          type="button"
                          onClick={() => handleHeaderSortClick('name')}
                          className="inline-flex items-center gap-1 hover:text-[#1A73E8] uppercase"
                        >
                          Nome
                          {sortField === 'name' &&
                            (sortOrder === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                        </button>
                      </th>
                      <th className="hidden md:table-cell py-3 px-3 font-semibold">Proprietário</th>
                      <th className="hidden sm:table-cell py-3 px-3 font-semibold">
                        <button
                          type="button"
                          onClick={() => handleHeaderSortClick('date')}
                          className="inline-flex items-center gap-1 hover:text-[#1A73E8] uppercase"
                        >
                          Última modificação
                          {sortField === 'date' &&
                            (sortOrder === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                        </button>
                      </th>
                      <th className="hidden lg:table-cell py-3 px-3 font-semibold">
                        <button
                          type="button"
                          onClick={() => handleHeaderSortClick('size')}
                          className="inline-flex items-center gap-1 hover:text-[#1A73E8] uppercase"
                        >
                          Tamanho
                          {sortField === 'size' &&
                            (sortOrder === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                        </button>
                      </th>
                      <th className="py-3 px-3 text-right font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleItemsOrdered.map((item) => {
                      const isSelected = selectedIdSet.has(item.id);
                      return (
                        <tr
                          key={item.id}
                          onClick={(e) => handleSelectItemClick(e, item.id)}
                          onDoubleClick={() => handleOpenItem(item)}
                          onContextMenu={(e) => handleContextMenu(e, item)}
                          className={`border-b last:border-b-0 ${borderSubtle} cursor-pointer transition-colors ${
                            isSelected ? 'bg-[#1A73E8]/15' : hoverItem
                          }`}
                        >
                          <td
                            className="py-2.5 pl-3 pr-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              aria-label={`Selecionar ${item.name}`}
                              checked={isSelected}
                              onChange={() =>
                                setSelectedIds((prev) =>
                                  prev.includes(item.id)
                                    ? prev.filter((x) => x !== item.id)
                                    : [...prev, item.id]
                                )
                              }
                            />
                          </td>
                          <td className="py-2.5 px-3 font-medium">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {renderItemIcon(item, 'w-4 h-4 shrink-0')}
                              <span className="truncate max-w-[160px] sm:max-w-xs">{item.name}</span>
                              {item.isStarred && (
                                <Star size={12} className="text-amber-400 fill-amber-400 shrink-0" />
                              )}
                            </div>
                          </td>
                          <td className={`hidden md:table-cell py-2.5 px-3 ${textMuted}`}>
                            {item.owner === 'eu' ? 'eu' : item.owner}
                          </td>
                          <td className={`hidden sm:table-cell py-2.5 px-3 ${textMuted}`}>{item.date}</td>
                          <td className={`hidden lg:table-cell py-2.5 px-3 font-mono ${textMuted}`}>
                            {item.type === 'folder' ? '—' : item.size || formatBytes(item.sizeBytes)}
                          </td>
                          <td
                            className="py-2.5 px-3 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => setShareItem(item)}
                                className={`p-1.5 rounded-lg ${hoverItem} min-h-[28px] min-w-[28px] flex items-center justify-center`}
                                aria-label={`Compartilhar ${item.name}`}
                                title="Compartilhar"
                              >
                                <Share2 size={13} />
                              </button>
                              <button
                                onClick={() => handleToggleStar(item)}
                                className={`p-1.5 rounded-lg ${hoverItem} min-h-[28px] min-w-[28px] flex items-center justify-center`}
                                aria-label={`Estrela em ${item.name}`}
                                title="Estrela"
                              >
                                <Star
                                  size={13}
                                  className={item.isStarred ? 'text-amber-400 fill-amber-400' : ''}
                                />
                              </button>
                              <button
                                onClick={(e) => handleContextMenu(e, item)}
                                className={`p-1.5 rounded-lg ${hoverItem} min-h-[28px] min-w-[28px] flex items-center justify-center`}
                                aria-label={`Mais opções para ${item.name}`}
                                title="Mais opções"
                              >
                                <MoreVertical size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>

        {/* RIGHT DETAILS & ACTIVITY DRAWER (Overlay inside body on < xl, docked sidebar on xl+) */}
        {showDetailsDrawer && (
          <>
            <div
              className="xl:hidden absolute inset-0 z-30 bg-black/45 backdrop-blur-[1px]"
              onClick={() => setShowDetailsDrawer(false)}
            />
            <aside
              data-testid="drive-details-drawer"
              className={`absolute inset-y-0 right-0 z-40 xl:static xl:z-auto w-80 max-w-[90vw] border-l ${bgSidebar} flex flex-col overflow-hidden shrink-0 shadow-2xl xl:shadow-none`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`px-4 pt-3 border-b ${borderSubtle} flex items-center justify-between`}>
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <button
                    onClick={() => setDetailsTab('details')}
                    className={`pb-2.5 border-b-2 transition-colors ${
                      detailsTab === 'details'
                        ? 'border-[#1A73E8] text-[#1A73E8]'
                        : `border-transparent ${textMuted}`
                    }`}
                  >
                    Detalhes
                  </button>
                  <button
                    data-testid="drive-drawer-activity-tab"
                    onClick={() => setDetailsTab('activity')}
                    className={`pb-2.5 border-b-2 transition-colors ${
                      detailsTab === 'activity'
                        ? 'border-[#1A73E8] text-[#1A73E8]'
                        : `border-transparent ${textMuted}`
                    }`}
                  >
                    Atividade
                  </button>
                </div>
                <button
                  onClick={() => setShowDetailsDrawer(false)}
                  aria-label="Fechar painel de detalhes"
                  className={`p-1.5 rounded-lg ${hoverItem} mb-2 min-h-[28px] min-w-[28px] flex items-center justify-center`}
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar text-xs space-y-4">
                {!selectedItem ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2.5">
                      <HardDrive size={20} className="text-[#1A73E8]" />
                      <div>
                        <div className="font-bold">Meu Drive</div>
                        <div className={`text-[11px] ${textMuted}`}>
                          {allItems.filter((i) => !i.trashed && !i.spam).length} itens ativos
                        </div>
                      </div>
                    </div>
                    <p className={textMuted}>
                      Selecione qualquer arquivo ou pasta para inspecionar permissões, versão, disponibilidade offline e histórico de atividades.
                    </p>
                  </div>
                ) : detailsTab === 'details' ? (
                  <>
                    <div className={`p-4 rounded-2xl border ${cardSurface} flex flex-col items-center text-center gap-2`}>
                      {renderItemIcon(selectedItem, 'w-12 h-12')}
                      <div>
                        <div className="font-bold text-sm break-all">{selectedItem.name}</div>
                        <span className={`text-[11px] ${textMuted} mt-0.5 block`}>
                          {TYPE_LABEL_MAP[selectedItem.type] || selectedItem.type}
                        </span>
                      </div>
                      {!selectedItem.trashed && !selectedItem.spam && (
                        <button
                          onClick={() => {
                            handleOpenItem(selectedItem);
                            if (window.innerWidth < 1280) setShowDetailsDrawer(false);
                          }}
                          className="mt-1 px-4 py-1.5 rounded-xl bg-[#1A73E8] hover:bg-[#1557B0] text-white font-semibold text-xs flex items-center gap-1.5 min-h-[30px]"
                        >
                          <ExternalLink size={13} />
                          {selectedItem.type === 'folder' ? 'Abrir pasta' : 'Abrir arquivo'}
                        </button>
                      )}
                    </div>

                    {/* Who has access */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`font-semibold uppercase tracking-wider text-[10px] ${textMuted}`}>
                          Quem tem acesso
                        </span>
                        <button
                          onClick={() => setShareItem(selectedItem)}
                          className="text-[#1A73E8] font-medium hover:underline text-[11px]"
                        >
                          Gerenciar acesso
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#1A73E8] text-white font-bold flex items-center justify-center text-xs shrink-0">
                          {(data?.user?.name || 'Você')[0]?.toUpperCase() || 'V'}
                        </div>
                        <div className="text-[11px]">
                          <div className="font-medium">{data?.user?.name || 'Você'} (Proprietário)</div>
                          <div className={textMuted}>
                            {(selectedItem.sharedWith?.length || 0) > 0
                              ? `Compartilhado com +${selectedItem.sharedWith?.length} pessoa(s)`
                              : selectedItem.generalAccess === 'anyone_with_link'
                              ? 'Qualquer pessoa com o link'
                              : 'Particular para você'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* File properties */}
                    <div className={`pt-3 border-t ${borderSubtle} space-y-2`}>
                      <div className="flex justify-between">
                        <span className={textMuted}>Tamanho</span>
                        <span className="font-medium">
                          {selectedItem.type === 'folder'
                            ? '—'
                            : selectedItem.size || formatBytes(selectedItem.sizeBytes)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className={textMuted}>Proprietário</span>
                        <span className="font-medium">{selectedItem.owner}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={textMuted}>Modificado</span>
                        <span className="font-medium">{selectedItem.date}</span>
                      </div>
                    </div>

                    {/* Offline toggle */}
                    {selectedItem.type !== 'folder' && (
                      <label
                        className={`flex items-center justify-between p-2.5 rounded-xl border ${borderSubtle} cursor-pointer`}
                      >
                        <span className="flex items-center gap-2">
                          <WifiOff size={14} className={textMuted} />
                          <span>Disponível offline</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={Boolean(selectedItem.offlineAvailable)}
                          onChange={() => handleToggleOffline(selectedItem)}
                        />
                      </label>
                    )}

                    {/* Editable Description (buffered draft, saves on blur or click) */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="drive-description-input"
                          className={`block text-[10px] font-semibold uppercase tracking-wider ${textMuted}`}
                        >
                          Descrição
                        </label>
                        {descriptionDraft !== (selectedItem.description || '') && (
                          <button
                            type="button"
                            onClick={() => handleCommitDescription(selectedItem, descriptionDraft)}
                            className="text-[11px] font-semibold text-[#1A73E8] hover:underline"
                          >
                            Salvar
                          </button>
                        )}
                      </div>
                      <textarea
                        id="drive-description-input"
                        data-testid="drive-description-input"
                        rows={3}
                        value={descriptionDraft}
                        onChange={(e) => setDescriptionDraft(e.target.value)}
                        onBlur={() => handleCommitDescription(selectedItem, descriptionDraft)}
                        placeholder="Adicionar descrição a este arquivo..."
                        className={`w-full p-2.5 rounded-xl border ${borderSubtle} bg-transparent outline-none resize-none focus:border-[#1A73E8]`}
                      />
                    </div>
                  </>
                ) : (
                  /* ACTIVITY TAB */
                  <div className="space-y-3">
                    {(selectedItem.activityLog && selectedItem.activityLog.length > 0
                      ? selectedItem.activityLog
                      : [
                          {
                            id: 'default_act',
                            actor: selectedItem.owner === 'eu' ? (data?.user?.name || 'Você') : selectedItem.owner,
                            action: `Modificou ${selectedItem.name}`,
                            timestamp: selectedItem.date,
                          },
                        ]
                    ).map((act) => (
                      <div key={act.id} className={`p-3 rounded-xl border ${borderSubtle} space-y-1`}>
                        <div className="font-semibold">{act.actor}</div>
                        <div className={textMuted}>{act.action}</div>
                        <div className={`text-[10px] ${textMuted}`}>{act.timestamp}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </>
        )}
      </div>

      {/* UNDO TRASH FLOATING BANNER */}
      {undoTrashBanner && (
        <div
          data-testid="drive-undo-trash-banner"
          className={`absolute bottom-5 left-5 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl border shadow-2xl text-xs ${cardSurface}`}
          onClick={(e) => e.stopPropagation()}
        >
          <span>{undoTrashBanner.label}</span>
          <button
            data-testid="drive-undo-trash-btn"
            onClick={handleUndoTrash}
            className="px-2.5 py-1 rounded-lg bg-[#1A73E8]/15 text-[#1A73E8] hover:bg-[#1A73E8]/25 font-semibold"
          >
            Desfazer
          </button>
          <button
            onClick={() => setUndoTrashBanner(null)}
            aria-label="Fechar aviso"
            className="opacity-60 hover:opacity-100"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* CONTEXT MENU */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
          isDarkMode={isDarkMode}
        />
      )}

      {/* UPLOAD TOAST */}
      {uploadStatus && (
        <div
          className={`fixed bottom-6 right-6 w-80 border rounded-2xl shadow-2xl z-50 overflow-hidden p-3 ${cardSurface}`}
        >
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold truncate">{uploadStatus.fileName}</span>
            <span className="text-[#1A73E8] font-mono">{uploadStatus.progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="bg-[#1A73E8] h-full transition-all"
              style={{ width: `${uploadStatus.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* MODAL: CREATE FOLDER / RENAME / CREATE DOC */}
      {modalMode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setModalMode(null)}
        >
          <div
            data-testid="drive-action-modal"
            className={`w-full max-w-md rounded-3xl border ${cardSurface} p-6 shadow-2xl space-y-4`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold">
              {modalMode === 'create_folder'
                ? 'Nova pasta'
                : modalMode === 'create_doc'
                ? `Novo ${TYPE_LABEL_MAP[pendingDocType]}`
                : 'Renomear item'}
            </h3>

            <input
              data-testid="drive-modal-input"
              type="text"
              value={modalInput}
              onChange={(e) => setModalInput(e.target.value)}
              placeholder={
                modalMode === 'create_folder'
                  ? 'Título da pasta...'
                  : modalMode === 'create_doc'
                  ? 'Nome do documento...'
                  : 'Novo nome...'
              }
              className={`w-full px-3.5 py-2.5 rounded-xl border ${borderSubtle} bg-transparent text-sm outline-none focus:border-[#1A73E8]`}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (modalMode === 'create_folder') handleCreateFolder();
                  else if (modalMode === 'create_doc') handleCreateNativeDoc();
                  else handleRename();
                }
              }}
            />

            {modalMode === 'create_folder' && (
              <div>
                <label className={`block text-xs mb-1.5 ${textMuted}`}>Cor da pasta</label>
                <div className="flex items-center gap-2">
                  {DRIVE_FOLDER_COLORS.map((col) => (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => setModalFolderColor(col.hex)}
                      className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        modalFolderColor === col.hex ? 'ring-2 ring-white scale-110' : 'opacity-80'
                      }`}
                      style={{ backgroundColor: col.hex }}
                    >
                      {modalFolderColor === col.hex && <Check size={12} className="text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setModalMode(null)}
                className={`px-4 py-2 rounded-xl text-xs font-medium ${hoverItem}`}
              >
                Cancelar
              </button>
              <button
                data-testid="drive-modal-save-btn"
                onClick={
                  modalMode === 'create_folder'
                    ? handleCreateFolder
                    : modalMode === 'create_doc'
                    ? handleCreateNativeDoc
                    : handleRename
                }
                className="px-5 py-2 rounded-xl bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-semibold"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SHARE & PERMISSIONS */}
      {shareItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShareItem(null)}
        >
          <div
            data-testid="drive-share-modal"
            className={`w-full max-w-lg rounded-3xl border ${cardSurface} p-5 sm:p-6 shadow-2xl space-y-4 text-xs max-h-[90vh] overflow-y-auto custom-scrollbar`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold truncate">Compartilhar &quot;{shareItem.name}&quot;</h3>
              <button
                onClick={() => setShareItem(null)}
                aria-label="Fechar modal de compartilhamento"
                className={`p-1.5 rounded-full ${hoverItem}`}
              >
                <X size={16} />
              </button>
            </div>

            {/* Add people input */}
            <div className="space-y-2">
              <div className="flex flex-wrap sm:flex-nowrap gap-2">
                <input
                  data-testid="drive-share-email-input"
                  type="text"
                  value={shareEmailInput}
                  onChange={(e) => setShareEmailInput(e.target.value)}
                  placeholder="Adicionar pessoas ou grupos por e-mail..."
                  className={`flex-1 min-w-[180px] px-3 py-2 rounded-xl border ${borderSubtle} bg-transparent outline-none`}
                />
                <select
                  aria-label="Papel do novo colaborador"
                  value={shareRoleInput}
                  onChange={(e) => setShareRoleInput(e.target.value as 'editor' | 'viewer')}
                  className={`px-2.5 py-2 rounded-xl border ${borderSubtle} ${
                    isDarkMode ? 'bg-[#20232B]' : 'bg-white'
                  }`}
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Leitor</option>
                </select>
                <button
                  data-testid="drive-share-invite-btn"
                  onClick={() => handleAddCollaborator()}
                  className="px-4 py-2 rounded-xl bg-[#1A73E8] hover:bg-[#1557B0] text-white font-semibold"
                >
                  Compartilhar
                </button>
              </div>

              {contactSuggestions.length > 0 && (
                <div className={`rounded-xl border ${cardSurface} p-1 flex flex-wrap gap-1`}>
                  {contactSuggestions.map((c) => (
                    <button
                      key={c.email}
                      onClick={() => handleAddCollaborator(c.email)}
                      className="px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-400 font-medium"
                    >
                      + {c.name} ({c.email})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* People with access */}
            <div className="space-y-2">
              <span className={`font-semibold uppercase tracking-wider text-[10px] ${textMuted}`}>
                Pessoas com acesso
              </span>
              <div className="space-y-2 max-h-44 overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-[#1A73E8] text-white font-bold flex items-center justify-center shrink-0">
                      {(data?.user?.name || 'Você')[0]?.toUpperCase() || 'V'}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{data?.user?.name || 'Você'} (você)</div>
                      <div className={`text-[11px] ${textMuted} truncate`}>{data?.user?.email || 'Conta local'}</div>
                    </div>
                  </div>
                  <span className={`${textMuted} shrink-0`}>Proprietário</span>
                </div>

                {(shareItem.sharedWith || []).map((p) => (
                  <div key={p.email} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0">
                        {(p.name || p.email)[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{p.name}</div>
                        <div className={`text-[11px] ${textMuted} truncate`}>{p.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        data-testid={`drive-collab-role-${p.email}`}
                        aria-label={`Permissão de ${p.email}`}
                        value={p.role === 'viewer' ? 'viewer' : 'editor'}
                        onChange={(e) =>
                          handleChangeCollaboratorRole(p.email, e.target.value as 'editor' | 'viewer')
                        }
                        className={`px-2 py-1 rounded-lg border ${borderSubtle} ${
                          isDarkMode ? 'bg-[#20232B]' : 'bg-white'
                        } text-[11px]`}
                      >
                        <option value="editor">Editor</option>
                        <option value="viewer">Leitor</option>
                      </select>
                      <button
                        onClick={() => handleRemoveCollaborator(p.email)}
                        className="text-red-400 hover:underline text-[11px]"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* General Access */}
            <div className={`p-3 rounded-2xl border ${borderSubtle} flex flex-wrap items-center justify-between gap-2.5`}>
              <div className="flex items-center gap-2.5 min-w-0">
                {shareItem.generalAccess === 'anyone_with_link' ? (
                  <Globe size={16} className="text-emerald-400 shrink-0" />
                ) : (
                  <Lock size={16} className={`${textMuted} shrink-0`} />
                )}
                <div className="min-w-0">
                  <div className="font-semibold">Acesso geral</div>
                  <div className={`text-[11px] ${textMuted}`}>
                    {shareItem.generalAccess === 'anyone_with_link'
                      ? 'Qualquer pessoa com o link pode acessar'
                      : 'Restrito — somente as pessoas adicionadas'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <select
                  data-testid="drive-general-access-select"
                  aria-label="Acesso geral"
                  value={shareItem.generalAccess || 'restricted'}
                  onChange={async (e) => {
                    const val = e.target.value as 'restricted' | 'anyone_with_link';
                    const role = shareItem.generalRole || 'viewer';
                    await bridge.updateDriveItemMeta(shareItem.id, { generalAccess: val, generalRole: role });
                    setShareItem({ ...shareItem, generalAccess: val, generalRole: role });
                    await loadDriveItems();
                  }}
                  className={`px-2.5 py-1.5 rounded-xl border ${borderSubtle} ${
                    isDarkMode ? 'bg-[#20232B]' : 'bg-white'
                  }`}
                >
                  <option value="restricted">Restrito</option>
                  <option value="anyone_with_link">Qualquer pessoa com o link</option>
                </select>

                {shareItem.generalAccess === 'anyone_with_link' && (
                  <select
                    data-testid="drive-general-role-select"
                    aria-label="Papel do acesso geral"
                    value={shareItem.generalRole || 'viewer'}
                    onChange={async (e) => {
                      const role = e.target.value as 'viewer' | 'commenter' | 'editor';
                      await bridge.updateDriveItemMeta(shareItem.id, { generalRole: role });
                      setShareItem({ ...shareItem, generalRole: role });
                      await loadDriveItems();
                    }}
                    className={`px-2.5 py-1.5 rounded-xl border ${borderSubtle} ${
                      isDarkMode ? 'bg-[#20232B]' : 'bg-white'
                    }`}
                  >
                    <option value="viewer">Leitor</option>
                    <option value="commenter">Comentador</option>
                    <option value="editor">Editor</option>
                  </select>
                )}
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleCopyShareLink(shareItem)}
                  className={`px-3.5 py-2 rounded-xl border ${borderSubtle} ${hoverItem} flex items-center gap-1.5 font-medium`}
                >
                  <Link2 size={14} /> Copiar link
                </button>
                <button
                  onClick={() => {
                    const target = shareItem;
                    setShareItem(null);
                    onOpenApp?.('mail', {
                      composeSubject: `Arquivo compartilhado no Drive: ${target.name}`,
                      composeBody: `<p>Olá,</p><p>Compartilhei o arquivo <strong>${target.name}</strong> com você no Google Drive.</p>`,
                    });
                  }}
                  className={`px-3.5 py-2 rounded-xl border ${borderSubtle} ${hoverItem} flex items-center gap-1.5 font-medium`}
                >
                  <Mail size={14} /> Enviar por Gmail
                </button>
              </div>
              <button
                onClick={() => setShareItem(null)}
                className="px-5 py-2 rounded-xl bg-[#1A73E8] hover:bg-[#1557B0] text-white font-semibold"
              >
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MOVE TO FOLDER PICKER */}
      {moveItems.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setMoveItems([])}
        >
          <div
            data-testid="drive-move-modal"
            className={`w-full max-w-md rounded-3xl border ${cardSurface} p-6 shadow-2xl space-y-4 text-xs`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold truncate">
              {moveItems.length === 1
                ? `Mover "${moveItems[0].name}" para...`
                : `Mover ${moveItems.length} itens para...`}
            </h3>
            <div className="space-y-1 max-h-56 overflow-y-auto custom-scrollbar">
              <button
                onClick={() => setMoveDestFolderId(null)}
                className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl ${
                  moveDestFolderId === null ? 'bg-[#1A73E8]/20 text-[#1A73E8] font-bold' : hoverItem
                }`}
              >
                <HardDrive size={15} />
                <span>Meu Drive (Raiz)</span>
              </button>
              {folderTreeNodes.map(({ folder: fld, depth }) => {
                const isBlocked = moveItems.some(
                  (m) => m.type === 'folder' && isDescendantFolder(allItems, m.id, fld.id)
                );
                return (
                  <button
                    key={fld.id}
                    disabled={isBlocked}
                    onClick={() => setMoveDestFolderId(fld.id)}
                    style={{ paddingLeft: `${10 + Math.min(depth, 4) * 14}px` }}
                    className={`w-full flex items-center justify-between gap-2.5 pr-2.5 py-2.5 rounded-xl transition-colors ${
                      isBlocked
                        ? 'opacity-40 cursor-not-allowed'
                        : moveDestFolderId === fld.id
                        ? 'bg-[#1A73E8]/20 text-[#1A73E8] font-bold'
                        : hoverItem
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Folder size={15} className="shrink-0" style={{ color: fld.folderColor || '#1A73E8' }} />
                      <span className="truncate">{fld.name}</span>
                    </span>
                    {isBlocked && <span className="text-[10px] shrink-0">(indisponível)</span>}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setMoveItems([])} className={`px-4 py-2 rounded-xl ${hoverItem}`}>
                Cancelar
              </button>
              <button
                data-testid="drive-move-confirm-btn"
                onClick={handleMoveConfirm}
                className="px-5 py-2 rounded-xl bg-[#1A73E8] hover:bg-[#1557B0] text-white font-semibold"
              >
                Mover para cá
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VERSION HISTORY */}
      {versionItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setVersionItem(null)}
        >
          <div
            data-testid="drive-versions-modal"
            className={`w-full max-w-md rounded-3xl border ${cardSurface} p-6 shadow-2xl space-y-4 text-xs`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold truncate">Gerenciar versões — {versionItem.name}</h3>
              <button
                onClick={() => setVersionItem(null)}
                aria-label="Fechar histórico de versões"
                className={`p-1 rounded-full ${hoverItem}`}
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
              {(() => {
                const versionList =
                  versionItem.versions && versionItem.versions.length > 0
                    ? versionItem.versions
                    : [{ id: 'v1', date: versionItem.date, author: data?.user?.name || 'Você', size: versionItem.size || '1.2 MB' }];
                return versionList.map((ver, idx) => (
                  <div
                    key={ver.id}
                    className={`p-3 rounded-2xl border ${borderSubtle} flex items-center justify-between gap-2`}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        {idx === 0 ? 'Versão atual' : `Versão ${versionList.length - idx}`} · {ver.date}
                      </div>
                      <div className={`text-[11px] ${textMuted}`}>
                        Por {ver.author} · {ver.size}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      {idx > 0 && (
                        <button
                          data-testid={`drive-restore-version-${ver.id}`}
                          onClick={() => handleRestoreVersion(ver)}
                          className="text-emerald-400 hover:underline font-medium"
                        >
                          Restaurar
                        </button>
                      )}
                      <button
                        onClick={() => handleDownloadItem(versionItem)}
                        className="text-[#1A73E8] hover:underline font-medium"
                      >
                        Baixar
                      </button>
                    </div>
                  </div>
                ));
              })()}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <button
                onClick={() => versionUploadRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-[#1A73E8] hover:bg-[#1557B0] text-white font-semibold flex items-center gap-1.5"
              >
                <Upload size={14} /> Fazer upload de nova versão
              </button>
              <button onClick={() => setVersionItem(null)} className={`px-4 py-2 rounded-xl ${hoverItem}`}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: FILE QUICK PREVIEW (LIGHTBOX) */}
      {previewItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 sm:p-6"
          onClick={() => setPreviewItem(null)}
        >
          <div
            data-testid="drive-preview-modal"
            className={`w-full max-w-2xl rounded-3xl border ${cardSurface} overflow-hidden shadow-2xl`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`px-4 sm:px-6 py-4 border-b ${borderSubtle} flex flex-wrap items-center justify-between gap-2`}>
              <div className="flex items-center gap-2.5 min-w-0">
                {renderItemIcon(previewItem, 'w-5 h-5 shrink-0')}
                <span className="font-bold text-sm truncate">{previewItem.name}</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                {(previewItem.type === 'doc' || previewItem.type === 'sheet' || previewItem.type === 'slide') && (
                  <button
                    onClick={() => {
                      const target = previewItem;
                      setPreviewItem(null);
                      onOpenApp?.(target.type, target);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#1A73E8] text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    <ExternalLink size={13} /> Abrir no editor
                  </button>
                )}
                <button
                  onClick={() => handleToggleStar(previewItem)}
                  className={`p-1.5 rounded-xl border ${borderSubtle} ${hoverItem}`}
                  aria-label="Alternar estrela"
                  title="Estrela"
                >
                  <Star size={14} className={previewItem.isStarred ? 'text-amber-400 fill-amber-400' : ''} />
                </button>
                <button
                  onClick={() => {
                    const target = previewItem;
                    setPreviewItem(null);
                    setShareItem(target);
                  }}
                  className={`p-1.5 rounded-xl border ${borderSubtle} ${hoverItem}`}
                  aria-label="Compartilhar"
                  title="Compartilhar"
                >
                  <Share2 size={14} />
                </button>
                <button
                  onClick={() => handleDownloadItem(previewItem)}
                  className={`px-3 py-1.5 rounded-xl border ${borderSubtle} ${hoverItem} text-xs flex items-center gap-1.5`}
                >
                  <Download size={14} /> Download
                </button>
                <button
                  onClick={() => setPreviewItem(null)}
                  aria-label="Fechar visualização"
                  className={`p-1.5 rounded-full ${hoverItem}`}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-6 sm:p-8 flex flex-col items-center justify-center text-center min-h-[260px]">
              {previewItem.thumbnail ? (
                <img
                  src={previewItem.thumbnail}
                  alt={previewItem.name}
                  className="max-h-72 rounded-2xl shadow-lg object-contain"
                />
              ) : (
                <div className="space-y-3 max-w-md">
                  <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto">
                    {renderItemIcon(previewItem, 'w-10 h-10')}
                  </div>
                  <h4 className="font-bold text-base">{previewItem.name}</h4>
                  <p className={`text-xs ${textMuted}`}>
                    {previewItem.description || 'Documento armazenado com segurança no Google Drive.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: KEYBOARD SHORTCUTS (?) */}
      {showShortcutsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowShortcutsModal(false)}
        >
          <div
            className={`w-full max-w-md rounded-3xl border ${cardSurface} p-6 shadow-2xl space-y-4 text-xs`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Atalhos de teclado do Google Drive</h3>
              <button onClick={() => setShowShortcutsModal(false)} className={`p-1 rounded-full ${hoverItem}`}>
                <X size={16} />
              </button>
            </div>
            <div className="space-y-2">
              {[
                ['V', 'Alternar visualização em Grade / Lista'],
                ['I', 'Mostrar / ocultar painel de Detalhes e Atividade'],
                ['Enter', 'Abrir pasta ou documento selecionado'],
                ['F2 ou N', 'Renomear item selecionado'],
                ['S', 'Adicionar / remover estrela do item selecionado'],
                ['Delete', 'Mover item selecionado para a lixeira'],
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
    </div>
  );
}