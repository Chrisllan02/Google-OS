import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  Mail,
  FileText,
  Calendar,
  ExternalLink,
  HardDrive,
  Globe,
  MapPin,
  Loader2,
  Sparkles,
  History,
  CheckSquare,
  StickyNote,
  Folder,
  Filter,
  Trash2,
} from 'lucide-react';
import { GoogleIcons, GeminiLogo } from '../GoogleIcons';
import { bridge, type CalendarEvent, type DriveItem, type NoteItem, type TaskItem } from '../../utils/GASBridge';
import { askGemini, GeminiUnavailableError } from '../../utils/gemini';
import {
  SEARCH_HISTORY_KEY,
  filterWorkspaceSearchResults,
  addSearchHistoryEntry,
  removeSearchHistoryEntry,
  type SearchTypeFilter,
  type SearchDateFilter,
} from '../../utils/searchLogic';
import type { AppOpenPayload, DashboardData, EmailItem, GroundingSource } from '../../utils/GASBridge';

interface SearchAppProps {
  onClose: () => void;
  data: DashboardData;
  searchQuery?: string;
  onOpenApp?: (type: string, fileData?: AppOpenPayload) => void;
  isDarkMode?: boolean;
}

const getFileIcon = (type: string) => {
  switch (type) {
    case 'folder':
      return <Folder className="w-5 h-5 text-blue-500" />;
    case 'sheet':
      return <GoogleIcons.Sheets className="w-5 h-5" />;
    case 'slide':
      return <GoogleIcons.Slides className="w-5 h-5" />;
    case 'doc':
      return <GoogleIcons.Docs className="w-5 h-5" />;
    case 'image':
      return <div className="px-1.5 py-0.5 bg-red-100 rounded text-red-600 font-bold text-[10px]">IMG</div>;
    case 'pdf':
      return <FileText className="w-5 h-5 text-red-500" />;
    default:
      return <FileText className="w-5 h-5 text-gray-400" />;
  }
};

const isSafeHttpUrl = (url?: string): boolean => {
  if (!url) return false;
  return /^https?:\/\//i.test(url.trim());
};

export default function SearchApp({
  onClose,
  data,
  searchQuery = '',
  onOpenApp,
  isDarkMode = false,
}: SearchAppProps) {
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [mode, setMode] = useState<'workspace' | 'web'>('workspace');

  // Filters
  const [typeFilter, setTypeFilter] = useState<SearchTypeFilter>('all');
  const [dateFilter, setDateFilter] = useState<SearchDateFilter>('any');
  const [senderFilter, setSenderFilter] = useState('');
  const [fileTypeSubfilter, setFileTypeSubfilter] = useState<string>('all');

  // Live workspace data snapshot refreshed via GASBridge
  const [liveDataset, setLiveDataset] = useState<{
    emails: EmailItem[];
    files: DriveItem[];
    events: CalendarEvent[];
    tasks: TaskItem[];
    notes: NoteItem[];
  }>({
    emails: data?.emails || [],
    files: data?.files || [],
    events: data?.events || [],
    tasks: data?.tasks || [],
    notes: data?.notes || [],
  });

  // Search history persisted in localStorage
  const [recentHistory, setRecentHistory] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
      return raw ? JSON.parse(raw) : ['Métricas Q2', 'Design System', 'Sprint'];
    } catch {
      return [];
    }
  });

  const [isSearching, setIsSearching] = useState(false);
  const [workspaceSummary, setWorkspaceSummary] = useState<string | null>(null);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [groundingSources, setGroundingSources] = useState<GroundingSource[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(recentHistory));
  }, [recentHistory]);

  const refreshLiveDataset = async () => {
    try {
      const [emails, files, events] = await Promise.all([
        bridge.getEmails(),
        bridge.getAllDriveItems(),
        bridge.getAllEvents(),
      ]);
      setLiveDataset({
        emails,
        files,
        events,
        tasks: data?.tasks || [],
        notes: data?.notes || [],
      });
    } catch {
      // Keep initial dataset
    }
  };

  useEffect(() => {
    refreshLiveDataset();
  }, [data?.tasks, data?.notes]);

  useEffect(() => {
    setLocalQuery(searchQuery);
    if (searchQuery) {
      recordSearchQuery(searchQuery);
      if (mode === 'web') handleWebSearch(searchQuery);
    }
  }, [searchQuery]);

  const recordSearchQuery = (q: string) => {
    setRecentHistory((prev) => addSearchHistoryEntry(prev, q));
  };

  const filteredResults = useMemo(
    () =>
      filterWorkspaceSearchResults(liveDataset, {
        query: localQuery,
        typeFilter,
        dateFilter,
        senderFilter,
        fileTypeSubfilter: fileTypeSubfilter === 'all' ? undefined : fileTypeSubfilter,
      }),
    [liveDataset, localQuery, typeFilter, dateFilter, senderFilter, fileTypeSubfilter]
  );

  // Also compute counts without typeFilter so tab counts always stay accurate
  const countsByType = useMemo(() => {
    const allUnfiltered = filterWorkspaceSearchResults(liveDataset, {
      query: localQuery,
      typeFilter: 'all',
      dateFilter,
      senderFilter,
      fileTypeSubfilter: fileTypeSubfilter === 'all' ? undefined : fileTypeSubfilter,
    });
    return {
      all:
        allUnfiltered.emails.length +
        allUnfiltered.files.length +
        allUnfiltered.events.length +
        allUnfiltered.tasks.length +
        allUnfiltered.notes.length,
      files: allUnfiltered.files.length,
      emails: allUnfiltered.emails.length,
      events: allUnfiltered.events.length,
      tasks: allUnfiltered.tasks.length,
      notes: allUnfiltered.notes.length,
    };
  }, [liveDataset, localQuery, dateFilter, senderFilter, fileTypeSubfilter]);

  const generateWorkspaceSummary = async (query: string) => {
    const total =
      filteredResults.emails.length +
      filteredResults.files.length +
      filteredResults.events.length;
    if (total === 0) return;

    const context = `
      Query: ${query}
      Emails found: ${filteredResults.emails.length}
      Files found: ${filteredResults.files.length}
      Events found: ${filteredResults.events.length}
    `;
    try {
      const response = await askGemini({
        task: 'generate',
        prompt: `Act as a personal assistant. Based on this search data, give a 1-sentence summary in Portuguese of what was found. Data: ${context}`,
      });
      setWorkspaceSummary(response.text || null);
    } catch {
      // Optional AI summary silently skipped if key absent
    }
  };

  const runWorkspaceSearch = async (query: string) => {
    if (!query.trim()) return;
    setIsSearching(true);
    setWorkspaceSummary(null);
    recordSearchQuery(query);
    await refreshLiveDataset();
    setIsSearching(false);
    generateWorkspaceSummary(query);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalQuery(val);
    if (mode === 'workspace') {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
      debounceTimeout.current = setTimeout(() => {
        if (val.trim().length >= 2) recordSearchQuery(val);
      }, 900);
    }
  };

  const handleWebSearch = async (overrideQuery?: string) => {
    const target = (overrideQuery ?? localQuery).trim();
    if (!target) return;
    recordSearchQuery(target);
    setIsGenerating(true);
    setAiResponse(null);
    setGroundingSources([]);

    try {
      const isLocationQuery = /onde|fica|perto|restaurante|mapa|local|endereço/i.test(target);
      const response = await askGemini({
        task: 'search',
        prompt: target,
        tool: isLocationQuery ? 'maps' : 'search',
      });
      setAiResponse(response.text || 'Não encontrei informações sobre isso.');
      setGroundingSources(response.sources);
    } catch (error) {
      setAiResponse(
        error instanceof GeminiUnavailableError
          ? 'Configure a variável GEMINI_API_KEY para habilitar a busca inteligente com IA.'
          : 'Erro ao conectar com a Busca Google.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (mode === 'web') handleWebSearch();
      else runWorkspaceSearch(localQuery);
    } else if (e.key === 'Escape') {
      if (localQuery) setLocalQuery('');
      else onClose();
    }
  };

  const openFileItem = (f: DriveItem) => {
    if (!onOpenApp) return;
    if (f.type === 'doc' || f.type === 'sheet' || f.type === 'slide') {
      onOpenApp(f.type, f);
    } else {
      onOpenApp('drive', f);
    }
  };

  const hasQueryOrActiveFilter =
    Boolean(localQuery.trim()) ||
    Boolean(senderFilter.trim()) ||
    dateFilter !== 'any' ||
    fileTypeSubfilter !== 'all';

  const resetAllFilters = () => {
    setLocalQuery('');
    setTypeFilter('all');
    setDateFilter('any');
    setSenderFilter('');
    setFileTypeSubfilter('all');
  };
  const hasResults =
    filteredResults.emails.length > 0 ||
    filteredResults.files.length > 0 ||
    filteredResults.events.length > 0 ||
    filteredResults.tasks.length > 0 ||
    filteredResults.notes.length > 0;

  const cardClass = isDarkMode
    ? 'bg-[#2C2D31] hover:bg-[#35373C] border-white/10 text-white'
    : 'bg-white hover:bg-gray-50 border-gray-200 hover:border-[#1A73E8]/40 text-[#202124]';
  const mutedText = isDarkMode ? 'text-white/60' : 'text-gray-500';

  const typeTabs: Array<{ id: SearchTypeFilter; label: string; count: number }> = [
    { id: 'all', label: 'Tudo', count: countsByType.all },
    { id: 'files', label: 'Arquivos', count: countsByType.files },
    { id: 'emails', label: 'E-mails', count: countsByType.emails },
    { id: 'events', label: 'Agenda', count: countsByType.events },
    { id: 'tasks', label: 'Tarefas', count: countsByType.tasks },
    { id: 'notes', label: 'Keep', count: countsByType.notes },
  ];

  return (
    <div
      className={`flex flex-col h-full font-sans transition-colors ${
        isDarkMode ? 'bg-[#202124] text-white' : 'bg-[#F8FAFC] text-[#202124]'
      }`}
    >
      {/* HEADER */}
      <header
        className={`shrink-0 border-b ${
          isDarkMode ? 'border-white/10 bg-[#202124]' : 'border-gray-200 bg-white'
        }`}
      >
        <div className="h-14 sm:h-16 px-3.5 sm:px-6 flex items-center justify-between gap-2 sm:gap-5 min-w-0">
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-white/10' : 'bg-blue-50'}`}>
              <Search className="w-5 h-5 text-[#1A73E8]" />
            </div>
            <span className="text-base sm:text-lg font-medium tracking-tight whitespace-nowrap">Pesquisa</span>
          </div>

          {/* Desktop/Tablet Inline Search Box */}
          <div className="hidden md:block flex-1 max-w-2xl min-w-0">
            <div
              className={`border flex items-center px-3.5 py-2 rounded-full transition-colors focus-within:border-[#1A73E8] ${
                isDarkMode ? 'bg-white/5 border-white/15' : 'bg-gray-100 border-gray-200 focus-within:bg-white'
              }`}
            >
              <Search className={`${mutedText} shrink-0`} size={17} />
              <input
                type="text"
                aria-label="Pesquisar no Workspace ou na Web"
                placeholder={
                  mode === 'workspace'
                    ? 'Pesquisar arquivos, e-mails, eventos, tarefas... (ex: from:gabriel, type:sheet)'
                    : 'Perguntar ao Google...'
                }
                className="bg-transparent border-none outline-none ml-2.5 w-full min-w-0 text-sm"
                value={localQuery}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                autoFocus
              />
              {localQuery && (
                <button
                  type="button"
                  aria-label="Limpar pesquisa"
                  onClick={() => setLocalQuery('')}
                  className="p-1 rounded-full hover:bg-black/10 mr-1.5 shrink-0"
                >
                  <X size={14} />
                </button>
              )}

              <div
                className={`flex rounded-full p-0.5 border shrink-0 ${
                  isDarkMode ? 'bg-black/40 border-white/10' : 'bg-gray-200/80 border-gray-300/60'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setMode('workspace')}
                  className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors flex items-center gap-1 whitespace-nowrap ${
                    mode === 'workspace'
                      ? isDarkMode
                        ? 'bg-white/20 text-white'
                        : 'bg-white text-gray-900 shadow-sm'
                      : mutedText
                  }`}
                >
                  <HardDrive size={11} /> Workspace
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('web');
                    if (localQuery.trim()) handleWebSearch();
                  }}
                  className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors flex items-center gap-1 whitespace-nowrap ${
                    mode === 'web' ? 'bg-[#1A73E8] text-white' : mutedText
                  }`}
                >
                  <Globe size={11} /> Web
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Mode Toggle + Close */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div
              className={`flex md:hidden rounded-full p-0.5 border shrink-0 ${
                isDarkMode ? 'bg-black/40 border-white/10' : 'bg-gray-200/80 border-gray-300/60'
              }`}
            >
              <button
                type="button"
                onClick={() => setMode('workspace')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors flex items-center gap-1 whitespace-nowrap ${
                  mode === 'workspace'
                    ? isDarkMode
                      ? 'bg-white/20 text-white'
                      : 'bg-white text-gray-900 shadow-sm'
                    : mutedText
                }`}
              >
                <HardDrive size={11} /> Workspace
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('web');
                  if (localQuery.trim()) handleWebSearch();
                }}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors flex items-center gap-1 whitespace-nowrap ${
                  mode === 'web' ? 'bg-[#1A73E8] text-white' : mutedText
                }`}
              >
                <Globe size={11} /> Web
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar Pesquisa"
              className={`p-2 rounded-full transition-colors shrink-0 ${
                isDarkMode ? 'hover:bg-white/10 text-white/75' : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Mobile Full-Width Search Row (< md) */}
        <div className="block md:hidden px-3.5 pb-2.5">
          <div
            className={`border flex items-center px-3 py-2 rounded-full transition-colors focus-within:border-[#1A73E8] ${
              isDarkMode ? 'bg-white/5 border-white/15' : 'bg-gray-100 border-gray-200 focus-within:bg-white'
            }`}
          >
            <Search className={`${mutedText} shrink-0`} size={15} />
            <input
              type="text"
              aria-label="Pesquisar no Workspace ou na Web (celular)"
              placeholder={
                mode === 'workspace'
                  ? 'Pesquisar arquivos, e-mails, tarefas...'
                  : 'Perguntar ao Google...'
              }
              className="bg-transparent border-none outline-none ml-2 w-full min-w-0 text-xs"
              value={localQuery}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
            />
            {localQuery && (
              <button
                type="button"
                aria-label="Limpar pesquisa"
                onClick={() => setLocalQuery('')}
                className="p-1 rounded-full hover:bg-black/10 shrink-0"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* FILTER BAR (Workspace mode) */}
      {mode === 'workspace' && (
        <div
          className={`px-3.5 sm:px-6 py-2.5 border-b flex flex-wrap items-center justify-between gap-2.5 shrink-0 ${
            isDarkMode ? 'border-white/10 bg-[#25262A]' : 'border-gray-200 bg-white'
          }`}
        >
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-0.5 sm:pb-0">
            {typeTabs.map((tab) => {
              const active = typeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTypeFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors tabular-nums ${
                    active
                      ? isDarkMode
                        ? 'bg-[#8AB4F8]/20 text-[#8AB4F8]'
                        : 'bg-[#E8F0FE] text-[#174EA6]'
                      : `${mutedText} hover:bg-black/5`
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs flex-1 sm:flex-none min-w-[148px] ${isDarkMode ? 'border-white/15 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
              <Filter size={12} className={`${mutedText} shrink-0`} />
              <input
                type="text"
                aria-label="Filtrar por pessoa ou remetente"
                placeholder="Remetente..."
                value={senderFilter}
                onChange={(e) => setSenderFilter(e.target.value)}
                className="bg-transparent outline-none w-full sm:w-32 text-xs min-w-0"
              />
            </div>

            {typeFilter === 'files' && (
              <select
                aria-label="Filtrar por tipo de arquivo"
                value={fileTypeSubfilter}
                onChange={(e) => setFileTypeSubfilter(e.target.value)}
                className={`px-2.5 py-1 rounded-lg border text-xs outline-none ${
                  isDarkMode ? 'bg-[#303134] border-white/15 text-white' : 'bg-white border-gray-200 text-gray-800'
                }`}
              >
                <option value="all">Todos os arquivos</option>
                <option value="doc">Docs</option>
                <option value="sheet">Planilhas</option>
                <option value="slide">Slides</option>
                <option value="folder">Pastas</option>
                <option value="pdf">PDF</option>
              </select>
            )}

            <select
              aria-label="Filtrar por data"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as SearchDateFilter)}
              className={`px-2.5 py-1 rounded-lg border text-xs outline-none ${
                isDarkMode ? 'bg-[#303134] border-white/15 text-white' : 'bg-white border-gray-200 text-gray-800'
              }`}
            >
              <option value="any">Qualquer data</option>
              <option value="today">Hoje</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
            </select>

            {hasQueryOrActiveFilter && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="px-2.5 py-1 rounded-lg text-xs font-medium text-[#1A73E8] hover:bg-[#1A73E8]/10 whitespace-nowrap"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>
      )}

      {/* RESULTS / EMPTY STATE AREA */}
      <div className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
        {!hasQueryOrActiveFilter ? (
          <div className="max-w-3xl mx-auto py-8 space-y-8">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-[#1A73E8]/10 text-[#1A73E8] flex items-center justify-center">
                <Search size={28} />
              </div>
              <h2 className="text-xl font-medium">
                {mode === 'workspace'
                  ? 'Pesquisa Unificada no Workspace'
                  : 'Pesquisar na Web com IA'}
              </h2>
              <p className={`text-sm ${mutedText}`}>
                {mode === 'workspace'
                  ? 'Busque arquivos do Drive, Docs, Planilhas, Slides, E-mails, Eventos da Agenda, Tarefas e Notas.'
                  : 'Faça perguntas em linguagem natural com fontes verificadas do Google Search e Maps.'}
              </p>
            </div>

            {/* Recent Search History */}
            {recentHistory.length > 0 && (
              <div
                className={`rounded-2xl border p-5 space-y-3 ${
                  isDarkMode ? 'bg-[#282A2E] border-white/10' : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <History size={14} className={mutedText} />
                    <span>Pesquisas recentes</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRecentHistory([])}
                    className="text-xs text-red-500 hover:underline flex items-center gap-1"
                  >
                    <Trash2 size={12} /> Limpar histórico
                  </button>
                </div>

                <div className="divide-y divide-current/10">
                  {recentHistory.map((item) => (
                    <div key={item} className="flex items-center justify-between py-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setLocalQuery(item);
                          if (mode === 'web') handleWebSearch(item);
                          else runWorkspaceSearch(item);
                        }}
                        className="flex-1 text-left text-sm hover:text-[#1A73E8] flex items-center gap-2.5 truncate"
                      >
                        <History size={14} className={mutedText} />
                        <span className="truncate">{item}</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Remover "${item}" do histórico`}
                        onClick={() => setRecentHistory((prev) => removeSearchHistoryEntry(prev, item))}
                        className="p-1 rounded-full hover:bg-black/10 opacity-60 hover:opacity-100"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Operators Helper */}
            {mode === 'workspace' && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {['from:gabriel', 'type:sheet', 'type:slide', 'is:starred', 'is:unread', 'has:attachment'].map((op) => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => setLocalQuery(op)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-mono ${
                      isDarkMode
                        ? 'border-white/15 bg-white/5 hover:bg-white/10'
                        : 'border-gray-200 bg-white hover:border-[#1A73E8]'
                    }`}
                  >
                    {op}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : mode === 'workspace' ? (
          isSearching ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 size={28} className="animate-spin text-[#1A73E8]" />
            </div>
          ) : (
            <div className="max-w-5xl mx-auto space-y-7 pb-12">
              {workspaceSummary && (
                <div
                  className={`border p-4 rounded-xl flex items-start gap-3 ${
                    isDarkMode ? 'bg-blue-950/30 border-white/10' : 'bg-blue-50/70 border-blue-200'
                  }`}
                >
                  <Sparkles size={18} className="text-[#1A73E8] mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-xs font-semibold text-[#1A73E8] mb-0.5">Resumo Inteligente</h4>
                    <p className="text-sm leading-relaxed">{workspaceSummary}</p>
                  </div>
                </div>
              )}

              {/* CALENDAR EVENTS (Now directly opens CalendarApp!) */}
              {filteredResults.events.length > 0 && (
                <section className="space-y-3">
                  <h3 className={`text-xs font-semibold flex items-center gap-2 ${mutedText}`}>
                    <Calendar size={14} /> Agenda ({filteredResults.events.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredResults.events.map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => onOpenApp?.('calendar', ev)}
                        className={`${cardClass} p-3.5 rounded-xl border text-left transition-colors flex flex-col gap-1.5`}
                      >
                        <div className="flex justify-between items-start gap-2 w-full">
                          <span className="font-medium truncate text-sm">{ev.title}</span>
                          <span className="text-[11px] font-medium text-[#1A73E8] shrink-0">Evento</span>
                        </div>
                        <div className={`text-xs tabular-nums ${mutedText}`}>
                          {new Date(ev.start).toLocaleDateString('pt-BR')} ·{' '}
                          {new Date(ev.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {ev.location && (
                          <div className={`text-[11px] flex items-center gap-1 ${mutedText}`}>
                            <MapPin size={11} /> <span className="truncate">{ev.location}</span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* DRIVE FILES */}
              {filteredResults.files.length > 0 && (
                <section className="space-y-3">
                  <h3 className={`text-xs font-semibold flex items-center gap-2 ${mutedText}`}>
                    <HardDrive size={14} /> Arquivos no Drive ({filteredResults.files.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredResults.files.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => openFileItem(f)}
                        className={`${cardClass} p-3.5 rounded-xl border text-left transition-colors flex items-center gap-3`}
                      >
                        <div className={`p-2 rounded-lg shrink-0 ${isDarkMode ? 'bg-white/5' : 'bg-gray-100'}`}>
                          {getFileIcon(f.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate text-sm">{f.name}</div>
                          <div className={`text-[11px] truncate mt-0.5 ${mutedText}`}>
                            {f.owner} · {f.date}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* EMAILS */}
              {filteredResults.emails.length > 0 && (
                <section className="space-y-3">
                  <h3 className={`text-xs font-semibold flex items-center gap-2 ${mutedText}`}>
                    <Mail size={14} /> E-mails ({filteredResults.emails.length})
                  </h3>
                  <div className="flex flex-col gap-2 min-w-0">
                    {filteredResults.emails.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => onOpenApp?.('mail', e)}
                        className={`${cardClass} px-3.5 sm:px-4 py-3 rounded-xl border text-left transition-colors flex items-center gap-3 sm:gap-4 w-full min-w-0 overflow-hidden`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                            e.color || 'bg-blue-600'
                          }`}
                        >
                          {e.senderInit || e.sender?.[0] || 'E'}
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex justify-between items-baseline gap-2 mb-0.5 min-w-0">
                            <span className="font-medium truncate text-sm min-w-0">{e.subject}</span>
                            <span className={`text-[11px] whitespace-nowrap tabular-nums shrink-0 ${mutedText}`}>
                              {e.time}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs min-w-0 overflow-hidden">
                            <span className="font-medium shrink-0 max-w-[45%] truncate">{e.sender}</span>
                            <span className={`${mutedText} shrink-0`}>·</span>
                            <span className={`truncate min-w-0 flex-1 ${mutedText}`}>{e.preview}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* TASKS */}
              {filteredResults.tasks.length > 0 && (
                <section className="space-y-3">
                  <h3 className={`text-xs font-semibold flex items-center gap-2 ${mutedText}`}>
                    <CheckSquare size={14} /> Tarefas ({filteredResults.tasks.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredResults.tasks.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onOpenApp?.('tasks', t)}
                        className={`${cardClass} p-3.5 rounded-xl border text-left transition-colors flex flex-col gap-1`}
                      >
                        <div className="flex items-center justify-between gap-2 w-full">
                          <span className={`font-medium text-sm truncate ${t.completed ? 'line-through opacity-60' : ''}`}>
                            {t.title}
                          </span>
                          <span className="text-[11px] text-[#1A73E8] shrink-0">
                            {t.completed ? 'Concluída' : 'Pendente'}
                          </span>
                        </div>
                        {t.details && <p className={`text-xs truncate ${mutedText}`}>{t.details}</p>}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* KEEP NOTES */}
              {filteredResults.notes.length > 0 && (
                <section className="space-y-3">
                  <h3 className={`text-xs font-semibold flex items-center gap-2 ${mutedText}`}>
                    <StickyNote size={14} /> Notas Keep ({filteredResults.notes.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {filteredResults.notes.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => onOpenApp?.('keep', n)}
                        className={`${cardClass} p-3.5 rounded-xl border text-left transition-colors flex flex-col gap-1`}
                      >
                        <span className="font-medium text-sm truncate">{n.title || 'Nota sem título'}</span>
                        <p className={`text-xs line-clamp-2 ${mutedText}`}>{n.content}</p>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {!hasResults && (
                <div className={`text-center py-12 space-y-2 ${mutedText}`}>
                  <p className="text-sm">Nenhum resultado encontrado para os filtros aplicados.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('web');
                      handleWebSearch();
                    }}
                    className="text-[#1A73E8] hover:underline text-sm font-medium"
                  >
                    Tentar pesquisar "{localQuery}" na Web
                  </button>
                </div>
              )}
            </div>
          )
        ) : (
          <div className="max-w-4xl mx-auto h-full flex flex-col">
            {isGenerating ? (
              <div className={`flex flex-col items-center justify-center h-56 ${mutedText}`}>
                <Loader2 size={30} className="animate-spin mb-3 text-[#1A73E8]" />
                <p className="text-sm">Pesquisando na web...</p>
              </div>
            ) : aiResponse ? (
              <div className="flex flex-col gap-6">
                <div
                  className={`border p-6 rounded-2xl ${
                    isDarkMode ? 'bg-[#303134] border-white/10' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <GeminiLogo className="w-5 h-5" />
                    <span className="text-sm font-semibold">Resposta Gerada · Gemini Grounding</span>
                  </div>
                  <div className="leading-relaxed text-sm whitespace-pre-wrap">{aiResponse}</div>
                </div>

                {groundingSources.length > 0 && (
                  <div className="space-y-3">
                    <h3 className={`text-xs font-semibold flex items-center gap-2 ${mutedText}`}>
                      <Globe size={14} /> Fontes & Referências
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {groundingSources.map((source, i) => {
                        if (source.web && isSafeHttpUrl(source.web.uri)) {
                          return (
                            <a
                              key={i}
                              href={source.web.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`${cardClass} p-4 rounded-xl border transition-colors block`}
                            >
                              <h4 className="text-[#1A73E8] text-sm font-medium mb-1 truncate hover:underline">
                                {source.web.title}
                              </h4>
                              <div className={`flex items-center gap-2 text-xs ${mutedText}`}>
                                <ExternalLink size={12} />
                                <span className="truncate">{source.web.uri}</span>
                              </div>
                            </a>
                          );
                        }
                        if (source.maps) {
                          return (
                            <div key={i} className={`${cardClass} p-4 rounded-xl border flex items-center gap-3`}>
                              <MapPin size={18} className="text-red-500" />
                              <span className="font-medium text-sm">{source.maps.title}</span>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className={`flex flex-col items-center justify-center h-56 ${mutedText}`}>
                <Sparkles size={40} className="mb-3 opacity-35" />
                <p className="text-sm">Pressione Enter para pesquisar na web</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
