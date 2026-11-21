import React, { useState, useEffect, useMemo, FormEvent } from 'react';
import {
  Users,
  KeyRound,
  Trash2,
  Eye,
  Edit3,
  ShieldAlert,
  X,
  Search,
  FileText,
  ExternalLink,
  Copy,
  Shield,
  Calendar as CalendarIcon,
  Download,
} from 'lucide-react';
import {
  bridge,
  SharedPermission,
  ResourceType,
  AccessLevel,
  DriveItem,
} from '../../utils/GASBridge';
import { GoogleIcons } from '../GoogleIcons';
import {
  DrivePermissionEntry,
  extractDrivePermissionRows,
  filterDrivePermissionRows,
  filterWorkspacePermissions,
  formatAccessLevelLabel,
  formatResourceTypeLabel,
  isExternalCollaborator,
  permissionsToCsv,
  validateShareRuleInput,
} from '../../utils/securityPermissionsLogic';
import type { AppOpenPayload, DashboardData } from '../../utils/GASBridge';

interface PermissionsAppProps {
  onClose: () => void;
  data: DashboardData;
  isDarkMode?: boolean;
  showToast?: (msg: string) => void;
  onOpenApp?: (type: string, fileData?: AppOpenPayload) => void;
}

export default function PermissionsApp({
  onClose,
  data,
  isDarkMode = false,
  showToast,
  onOpenApp,
}: PermissionsAppProps) {
  const currentUserEmail = data?.user?.email || '';

  const [sharedByMe, setSharedByMe] = useState<SharedPermission[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<SharedPermission[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveItem[]>(data?.files || []);

  // Form states for new sharing rule
  const [collabEmail, setCollabEmail] = useState('');
  const [resource, setResource] = useState<ResourceType>('drive');
  const [access, setAccess] = useState<AccessLevel>('read');
  const [expiresAt, setExpiresAt] = useState('');
  const [formError, setFormError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('');
  const [resourceFilter, setResourceFilter] = useState<'ALL' | ResourceType>('ALL');
  const [accessFilter, setAccessFilter] = useState<'ALL' | AccessLevel>('ALL');

  const toast = (msg: string) => showToast && showToast(msg);

  const cardClass = isDarkMode
    ? 'bg-[#26272B] border border-white/10 rounded-2xl'
    : 'bg-white border border-gray-200 rounded-2xl shadow-sm';
  const textColor = isDarkMode ? 'text-white' : 'text-[#202124]';
  const subText = isDarkMode ? 'text-white/60' : 'text-gray-500';
  const inputClass = isDarkMode
    ? 'bg-white/5 border-white/15 text-white placeholder:text-white/35 focus:border-[#8AB4F8]'
    : 'bg-gray-50 border-gray-200 text-[#202124] placeholder:text-gray-400 focus:border-[#1A73E8] focus:bg-white';

  const loadPermissions = async () => {
    const [wsRes, files] = await Promise.all([
      bridge.getPermissions(currentUserEmail),
      bridge.getAllDriveItems(),
    ]);
    setSharedByMe(wsRes.sharedByMe);
    setSharedWithMe(wsRes.sharedWithMe);
    setDriveFiles(files);
  };

  useEffect(() => {
    loadPermissions();
  }, [currentUserEmail]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirmDeleteId) {
        setConfirmDeleteId(null);
        return;
      }
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmDeleteId, onClose]);

  const handleCreateShare = async (e: FormEvent) => {
    e.preventDefault();
    const validation = validateShareRuleInput(collabEmail, currentUserEmail, expiresAt || undefined);
    if (!validation.valid) {
      setFormError(validation.error || 'Dados inválidos.');
      toast(validation.error || 'Dados inválidos.');
      return;
    }
    setFormError('');
    const email = collabEmail.trim().toLowerCase();
    await bridge.createPermission(currentUserEmail, email, resource, access, expiresAt || undefined);
    setCollabEmail('');
    setExpiresAt('');
    toast(`Regra de compartilhamento aplicada para ${email}.`);
    loadPermissions();
  };

  const handleToggleAccess = async (perm: SharedPermission) => {
    const next: AccessLevel = perm.accessLevel === 'read' ? 'write' : 'read';
    await bridge.updatePermission(perm.id, next);
    toast(
      `Acesso de ${perm.collaboratorEmail} alterado para ${
        next === 'read' ? 'Somente leitura' : 'Leitura e escrita'
      }.`
    );
    loadPermissions();
  };

  const handleRevoke = async (perm: SharedPermission) => {
    await bridge.revokePermission(perm.id);
    setConfirmDeleteId(null);
    toast(`Acessos de ${perm.collaboratorEmail} revogados.`);
    loadPermissions();
  };

  const handleToggleDriveRole = async (row: DrivePermissionEntry) => {
    const nextRole = row.role === 'editor' ? 'viewer' : 'editor';
    await bridge.addDrivePermission(row.fileId, row.email, nextRole);
    toast(
      `Permissão em "${row.fileName}" para ${row.email} alterada para ${
        nextRole === 'editor' ? 'Editor' : 'Leitor'
      }.`
    );
    loadPermissions();
  };

  const handleRevokeDrivePermission = async (row: DrivePermissionEntry) => {
    await bridge.removeDrivePermission(row.fileId, row.email);
    toast(`Acesso de ${row.email} ao arquivo "${row.fileName}" removido.`);
    loadPermissions();
  };

  const handleCopyDriveLink = async (fileId: string, fileName: string) => {
    const link = await bridge.getDriveShareLink(fileId);
    try {
      await navigator.clipboard.writeText(link);
      toast(`Link de compartilhamento de "${fileName}" copiado.`);
    } catch {
      toast(`Link: ${link}`);
    }
  };

  const openDriveItem = (fileId: string) => {
    const target = driveFiles.find((f) => f.id === fileId);
    if (!target || !onOpenApp) return;
    if (target.type === 'doc' || target.type === 'sheet' || target.type === 'slide') {
      onOpenApp(target.type, target);
    } else {
      onOpenApp('drive', target);
    }
  };

  const drivePermissionRows = useMemo(
    () => extractDrivePermissionRows(driveFiles),
    [driveFiles]
  );

  const filteredByMe = useMemo(
    () => filterWorkspacePermissions(sharedByMe, searchQuery, resourceFilter, accessFilter),
    [sharedByMe, searchQuery, resourceFilter, accessFilter]
  );

  const filteredWithMe = useMemo(
    () => filterWorkspacePermissions(sharedWithMe, searchQuery, resourceFilter, accessFilter),
    [sharedWithMe, searchQuery, resourceFilter, accessFilter]
  );

  const filteredDriveRows = useMemo(() => {
    if (resourceFilter !== 'ALL' && resourceFilter !== 'drive') return [];
    return filterDrivePermissionRows(drivePermissionRows, searchQuery, accessFilter);
  }, [drivePermissionRows, searchQuery, resourceFilter, accessFilter]);

  const hasActiveFilters = searchQuery.trim() !== '' || resourceFilter !== 'ALL' || accessFilter !== 'ALL';

  const handleResetFilters = () => {
    setSearchQuery('');
    setResourceFilter('ALL');
    setAccessFilter('ALL');
  };

  const handleExportPermissionsCsv = () => {
    const csv = permissionsToCsv(filteredDriveRows, filteredByMe);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `permissoes-workspace-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Relatório CSV exportado (${filteredDriveRows.length + filteredByMe.length} registros).`);
  };

  const filterTabs: Array<{ id: 'ALL' | ResourceType; label: string }> = [
    { id: 'ALL', label: 'Tudo' },
    { id: 'drive', label: 'Drive & Docs' },
    { id: 'calendar', label: 'Agenda' },
    { id: 'tasks', label: 'Tarefas' },
    { id: 'notes', label: 'Keep' },
  ];

  return (
    <div
      className={`flex flex-col h-full overflow-hidden transition-colors duration-300 font-sans ${
        isDarkMode ? 'bg-[#1D1E22] text-white' : 'bg-[#F8FAFC] text-[#202124]'
      }`}
    >
      {/* Header */}
      <header
        className={`min-h-[60px] py-2.5 flex items-center justify-between gap-2 px-3 sm:px-6 border-b shrink-0 ${
          isDarkMode ? 'border-white/10 bg-[#202124]' : 'border-gray-200 bg-white'
        }`}
      >
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <GoogleIcons.Contacts className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-medium tracking-tight leading-tight truncate">
              Permissões de Compartilhamento
            </h2>
            <p className={`hidden sm:block text-xs truncate ${subText}`}>
              Governança de compartilhamentos no Drive, Agenda, Tarefas e Keep
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportPermissionsCsv}
            aria-label="Exportar CSV de permissões"
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium hidden sm:flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              isDarkMode
                ? 'border-white/15 hover:bg-white/10 text-white'
                : 'border-gray-200 hover:bg-gray-50 text-gray-700'
            }`}
          >
            <Download size={13} />
            CSV
          </button>
          {onOpenApp && (
            <button
              type="button"
              onClick={() => onOpenApp('security')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                isDarkMode
                  ? 'border-white/15 hover:bg-white/10 text-white'
                  : 'border-gray-200 hover:bg-gray-50 text-gray-700'
              }`}
            >
              <Shield size={13} />
              <span className="hidden sm:inline">Central de Segurança</span>
              <span className="sm:hidden">Segurança</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar Permissões"
            className={`p-2 rounded-full transition-colors ${
              isDarkMode ? 'hover:bg-white/10 text-white/70' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <X size={20} />
          </button>
        </div>
      </header>

      {/* Filter & Search Bar */}
      <div
        className={`px-3 sm:px-6 py-2.5 border-b flex flex-wrap items-center justify-between gap-2.5 shrink-0 ${
          isDarkMode ? 'border-white/10 bg-[#232428]' : 'border-gray-200 bg-white'
        }`}
      >
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setResourceFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                resourceFilter === tab.id
                  ? isDarkMode
                    ? 'bg-[#8AB4F8]/20 text-[#8AB4F8]'
                    : 'bg-[#E8F0FE] text-[#174EA6]'
                  : `${subText} hover:bg-black/5`
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <select
            aria-label="Filtrar por nível de acesso"
            value={accessFilter}
            onChange={(e) => setAccessFilter(e.target.value as 'ALL' | AccessLevel)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs outline-none ${
              isDarkMode
                ? 'bg-[#1D1E22] border-white/15 text-white'
                : 'bg-white border-gray-200 text-gray-700'
            }`}
          >
            <option value="ALL">Todos os níveis</option>
            <option value="write">Editores</option>
            <option value="read">Leitores</option>
          </select>

          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs flex-1 sm:flex-none min-w-[150px] ${
              isDarkMode ? 'border-white/15 bg-white/5' : 'border-gray-200 bg-gray-50'
            }`}
          >
            <Search size={13} className={`${subText} shrink-0`} />
            <input
              type="text"
              aria-label="Buscar colaborador ou arquivo"
              placeholder="Filtrar por e-mail ou arquivo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent outline-none flex-1 sm:w-44 min-w-0 text-xs"
            />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-medium text-[#1A73E8] hover:underline whitespace-nowrap px-1"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-5 lg:p-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* Nova regra de compartilhamento */}
          <div className="lg:col-span-4">
            <section className={`${cardClass} p-5`}>
              <div
                className={`mb-4 flex items-center gap-2 border-b pb-3 ${
                  isDarkMode ? 'border-white/10' : 'border-gray-100'
                }`}
              >
                <KeyRound className="text-[#1A73E8]" size={17} />
                <h3 className={`font-medium text-sm ${textColor}`}>
                  Nova regra de compartilhamento
                </h3>
              </div>

              <form onSubmit={handleCreateShare} noValidate className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label htmlFor="perm-collab-email" className={`block text-[11px] font-semibold ${subText}`}>
                    E-mail do colaborador
                  </label>
                  <input
                    id="perm-collab-email"
                    type="email"
                    placeholder="colaborador@empresa.com"
                    value={collabEmail}
                    onChange={(e) => {
                      setCollabEmail(e.target.value);
                      if (formError) setFormError('');
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors ${inputClass}`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="perm-resource" className={`block text-[11px] font-semibold ${subText}`}>
                    Recurso do Workspace
                  </label>
                  <select
                    id="perm-resource"
                    value={resource}
                    onChange={(e) => setResource(e.target.value as ResourceType)}
                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors ${
                      isDarkMode
                        ? 'bg-[#1D1E22] border-white/15 text-white'
                        : 'bg-gray-50 border-gray-200 text-[#202124]'
                    }`}
                  >
                    <option value="drive">Drive & Documentos</option>
                    <option value="calendar">Google Agenda</option>
                    <option value="tasks">Google Tarefas</option>
                    <option value="notes">Google Keep (Notas)</option>
                    <option value="all">Sincronização geral (Workspace completo)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <span className={`block text-[11px] font-semibold ${subText}`}>
                    Nível de acesso
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {(['read', 'write'] as AccessLevel[]).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setAccess(level)}
                        className={`rounded-lg border py-2 text-center text-xs font-medium transition-colors ${
                          access === level
                            ? 'border-[#1A73E8] bg-[#1A73E8]/10 text-[#1A73E8]'
                            : isDarkMode
                            ? 'border-white/15 text-white/60 hover:text-white'
                            : 'border-gray-200 text-gray-600 hover:text-black'
                        }`}
                      >
                        {level === 'read' ? 'Leitor' : 'Editor'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="perm-expiry" className={`flex items-center gap-1 text-[11px] font-semibold ${subText}`}>
                    <CalendarIcon size={12} /> Expiração opcional
                  </label>
                  <input
                    id="perm-expiry"
                    type="date"
                    value={expiresAt}
                    onChange={(e) => {
                      setExpiresAt(e.target.value);
                      if (formError) setFormError('');
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-xs outline-none ${inputClass}`}
                  />
                </div>

                {formError && (
                  <p role="alert" className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                    {formError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={!collabEmail.trim()}
                  className="w-full rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] disabled:opacity-40 text-white font-medium py-2.5 text-sm transition-colors"
                >
                  Aplicar política de acesso
                </button>
              </form>
            </section>
          </div>

          {/* Listas de Permissões */}
          <div className="lg:col-span-8 flex flex-col space-y-5">
            {/* Arquivos Compartilhados do Drive */}
            <section className={`${cardClass} p-5`}>
              <div
                className={`flex items-center justify-between border-b pb-3 mb-3 ${
                  isDarkMode ? 'border-white/10' : 'border-gray-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="text-[#1A73E8]" size={17} />
                  <h3 className={`font-medium text-sm ${textColor}`}>
                    Arquivos & Documentos Compartilhados ({filteredDriveRows.length})
                  </h3>
                </div>
              </div>

              {filteredDriveRows.length === 0 ? (
                <p className={`text-center py-5 text-xs ${subText}`}>
                  Nenhuma permissão individual de arquivo encontrada para este filtro.
                </p>
              ) : (
                <div className="space-y-2 max-h-[240px] overflow-y-auto custom-scrollbar pr-1">
                  {filteredDriveRows.map((row) => (
                    <div
                      key={`${row.fileId}_${row.email}`}
                      className={`border rounded-xl p-3 text-xs flex flex-wrap items-center justify-between gap-2 ${
                        isDarkMode
                          ? 'border-white/10 bg-white/[0.02]'
                          : 'border-gray-100 bg-gray-50/70'
                      }`}
                    >
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => openDriveItem(row.fileId)}
                            className="font-semibold text-[#1A73E8] hover:underline truncate flex items-center gap-1 max-w-full"
                          >
                            <span className="truncate">{row.fileName}</span>
                            <ExternalLink size={11} className="shrink-0" />
                          </button>
                          {isExternalCollaborator(row.email, currentUserEmail) && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-semibold shrink-0">
                              Externo
                            </span>
                          )}
                        </div>
                        <p className={`text-[11px] mt-0.5 truncate ${subText}`}>
                          {row.name} ({row.email}) ·{' '}
                          <span className="font-medium text-[#1A73E8]">
                            {row.role === 'editor' ? 'Editor' : 'Leitor'}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyDriveLink(row.fileId, row.fileName)}
                          aria-label={`Copiar link de ${row.fileName}`}
                          title="Copiar link"
                          className={`p-1.5 rounded-lg transition-colors ${
                            isDarkMode ? 'hover:bg-white/10 text-white/70' : 'hover:bg-gray-200 text-gray-500'
                          }`}
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleDriveRole(row)}
                          aria-label={`Alternar papel de ${row.email} em ${row.fileName}`}
                          title="Alternar Leitor / Editor"
                          className={`p-1.5 rounded-lg transition-colors ${
                            isDarkMode ? 'hover:bg-white/10 text-white/70' : 'hover:bg-gray-200 text-gray-600'
                          }`}
                        >
                          {row.role === 'viewer' ? <Eye size={13} /> : <Edit3 size={13} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRevokeDrivePermission(row)}
                          aria-label={`Remover acesso de ${row.email} em ${row.fileName}`}
                          title="Remover acesso"
                          className="p-1.5 rounded-lg hover:bg-red-500/15 hover:text-red-500 text-gray-400 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Regras de Workspace Concedidas por Você */}
            <section className={`${cardClass} p-5`}>
              <div
                className={`flex items-center gap-2 border-b pb-3 mb-3 ${
                  isDarkMode ? 'border-white/10' : 'border-gray-100'
                }`}
              >
                <Users className="text-[#1A73E8]" size={17} />
                <h3 className={`font-medium text-sm ${textColor}`}>
                  Regras concedidas por você ({filteredByMe.length})
                </h3>
              </div>

              <div className="space-y-2 max-h-[240px] overflow-y-auto custom-scrollbar pr-1">
                {filteredByMe.length === 0 ? (
                  <p className={`text-center py-6 text-xs ${subText}`}>
                    Nenhuma regra de compartilhamento concedida encontrada.
                  </p>
                ) : (
                  filteredByMe.map((perm) => (
                    <div
                      key={perm.id}
                      className={`relative overflow-hidden border rounded-xl p-3.5 text-xs flex items-center justify-between transition-colors ${
                        isDarkMode
                          ? 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
                          : 'border-gray-100 bg-gray-50/70 hover:bg-gray-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className={`font-semibold truncate ${textColor}`}>{perm.collaboratorEmail}</p>
                          {isExternalCollaborator(perm.collaboratorEmail, currentUserEmail) && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-semibold shrink-0">
                              Externo
                            </span>
                          )}
                        </div>
                        <div className={`mt-1 flex flex-wrap items-center gap-2 text-[11px] ${subText}`}>
                          <span className="rounded-md bg-[#1A73E8]/10 text-[#1A73E8] px-2 py-0.5 font-medium">
                            {formatResourceTypeLabel(perm.resourceType)}
                          </span>
                          <span>{formatAccessLevelLabel(perm.accessLevel)}</span>
                          <span className="font-mono text-[10px] tabular-nums">
                            Desde {new Date(perm.createdAt).toLocaleDateString('pt-BR')}
                          </span>
                          {perm.expiresAt && (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                              Expira em {new Date(perm.expiresAt).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleAccess(perm)}
                          aria-label={`Inverter acesso de ${perm.collaboratorEmail}`}
                          title="Inverter Leitor / Editor"
                          className={`rounded-lg p-2 transition-colors ${
                            isDarkMode
                              ? 'hover:bg-white/10 text-white/70 hover:text-white'
                              : 'hover:bg-gray-200 text-gray-500 hover:text-black'
                          }`}
                        >
                          {perm.accessLevel === 'read' ? <Eye size={14} /> : <Edit3 size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(perm.id)}
                          aria-label={`Revogar acesso de ${perm.collaboratorEmail}`}
                          title="Revogar acesso"
                          className={`rounded-lg p-2 transition-colors hover:bg-[#EA4335]/15 hover:text-[#EA4335] ${
                            isDarkMode ? 'text-white/50' : 'text-gray-400'
                          }`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {confirmDeleteId === perm.id && (
                        <div
                          className={`absolute inset-0 rounded-xl flex flex-wrap items-center justify-between gap-2 px-3 py-2 z-10 border-l-4 border-[#EA4335] ${
                            isDarkMode ? 'bg-[#1D1E22]' : 'bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-xs min-w-0 flex-1">
                            <ShieldAlert size={14} className="text-[#EA4335] shrink-0" />
                            <span className="truncate">Revogar {perm.collaboratorEmail}?</span>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleRevoke(perm)}
                              className="bg-[#EA4335] hover:bg-[#d93025] rounded-lg px-2.5 py-1 text-xs font-medium text-white"
                            >
                              Revogar
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className={`rounded-lg px-2.5 py-1 text-xs ${
                                isDarkMode
                                  ? 'bg-white/10 hover:bg-white/15 text-white'
                                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                              }`}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Compartilhamentos Recebidos de Colegas */}
            <section className={`${cardClass} p-5`}>
              <div
                className={`flex items-center gap-2 border-b pb-3 mb-3 ${
                  isDarkMode ? 'border-white/10' : 'border-gray-100'
                }`}
              >
                <Users className="text-emerald-500" size={17} />
                <h3 className={`font-medium text-sm ${textColor}`}>
                  Recebidos de colegas ({filteredWithMe.length})
                </h3>
              </div>

              <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                {filteredWithMe.length === 0 ? (
                  <p className={`text-center py-5 text-xs ${subText}`}>
                    Nenhum recurso compartilhado com seu e-mail no momento.
                  </p>
                ) : (
                  filteredWithMe.map((perm) => (
                    <div
                      key={perm.id}
                      className={`border rounded-xl p-3 text-xs flex items-center justify-between gap-2 ${
                        isDarkMode ? 'border-white/10 bg-white/[0.02]' : 'border-gray-100 bg-gray-50/70'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className={`font-semibold truncate ${textColor}`}>{perm.ownerEmail}</p>
                        <div className={`mt-1 flex flex-wrap items-center gap-2 text-[11px] ${subText}`}>
                          <span className="rounded-md bg-[#1A73E8]/10 text-[#1A73E8] px-2 py-0.5 font-medium">
                            {formatResourceTypeLabel(perm.resourceType)}
                          </span>
                          <span>{formatAccessLevelLabel(perm.accessLevel)}</span>
                        </div>
                      </div>
                      <span className="rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] px-2.5 py-0.5 font-semibold shrink-0">
                        ATIVO
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
