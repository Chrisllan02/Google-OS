import React, { useState, useEffect, useMemo } from 'react';
import {
  User,
  Moon,
  Bell,
  Shield,
  HardDrive,
  LogOut,
  X,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  Monitor,
  Mail,
  Calendar,
  Palette,
  CheckSquare,
  Video,
  Volume2,
  BellOff,
  Lock,
  Trash2,
  KeyRound,
  Check,
  ExternalLink,
  EyeOff,
  FileText,
  Download,
  RotateCcw,
  Globe,
  Cpu,
  RefreshCw,
  Wifi,
  WifiOff,
  Cloud,
  Server,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  AppOpenPayload,
  AuroraSettings,
  bridge,
  CloudUserProfile,
  DashboardData,
  DriveItem,
} from '../../utils/GASBridge';
import {
  WORKSPACE_SETTINGS_KEY,
  parseUserSettings,
  computeWorkspaceStorageStats,
  clearTransientWorkspaceCache,
  exportSettingsJson,
  resetUserSettings,
  type WorkspaceUserSettings,
  type WorkspaceNotificationSettings,
  type WorkspacePrivacySettings,
  type WorkspaceLanguage,
  type WorkspaceTimezone,
  type WorkspaceDensity,
} from '../../utils/settingsLogic';
import {
  loadAIConfig,
  saveAIConfig,
  validateLocalEndpoint,
  LOCAL_AI_PRESETS,
  type LocalAIConfig,
  type LocalAIEngine,
} from '../../utils/aiConfig';
import { testLocalAIConnection } from '../../utils/gemini';
import { GoogleSignInButton } from '../GoogleSignInButton';
import { PWAInstallButton } from '../PWAStatusBar';
import { useOnlineStatus } from '../../hooks/usePWAInstall';

interface SettingsAppProps {
  onClose: () => void;
  data: DashboardData;
  toggleTheme?: () => void;
  isDarkMode?: boolean;
  showToast?: (msg: string) => void;
  onUpdateTheme?: (settings: Partial<AuroraSettings>) => void;
  onUpdateNickname?: (nickname: string) => void;
  onOpenApp?: (type: string, fileData?: AppOpenPayload) => void;
  showAurora?: boolean;
  onToggleAurora?: () => void;
  cloudUser?: CloudUserProfile | null;
  hasWorkspaceToken?: boolean;
  authBusy?: boolean;
  onSignInGoogle?: () => void;
  onSignOutGoogle?: () => void;
  onSyncGoogleWorkspace?: () => void;
}

export default function SettingsApp({
  onClose,
  data,
  toggleTheme,
  isDarkMode = false,
  showToast,
  onUpdateTheme,
  onUpdateNickname,
  onOpenApp,
  showAurora = true,
  onToggleAurora,
  cloudUser = null,
  hasWorkspaceToken = false,
  authBusy = false,
  onSignInGoogle,
  onSignOutGoogle,
  onSyncGoogleWorkspace,
}: SettingsAppProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'notifications' | 'storage' | 'privacy' | 'ai-offline'>('profile');
  const isOnline = useOnlineStatus();
  const [aiConfig, setAiConfig] = useState<LocalAIConfig>(() => loadAIConfig());
  const [aiEndpointError, setAiEndpointError] = useState<string>('');
  const [aiTestBusy, setAiTestBusy] = useState<boolean>(false);
  const [aiTestResult, setAiTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [settings, setSettings] = useState<WorkspaceUserSettings>(() => {
    const base = parseUserSettings(localStorage.getItem(WORKSPACE_SETTINGS_KEY));
    if (data?.user?.name && (base.displayName === 'Usuário' || !base.displayName)) {
      base.displayName = data.user.name;
    }
    return base;
  });

  const [nicknameInput, setNicknameInput] = useState<string>(
    () => localStorage.getItem('workspace_nickname') || ''
  );
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState(settings.displayName);

  // Interactive Modals
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showClearCacheConfirm, setShowClearCacheConfirm] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState<boolean>(false);
  const [liveDriveFiles, setLiveDriveFiles] = useState<DriveItem[]>(data?.files || []);

  const toast = (msg: string) => (showToast ? showToast(msg) : console.log(msg));

  const handleSaveAIConfig = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (aiConfig.mode === 'local') {
      const check = validateLocalEndpoint(aiConfig.endpoint);
      if (!check.valid) {
        setAiEndpointError(check.error || 'Endereço de IA local inválido.');
        setAiTestResult(null);
        return;
      }
      if (!aiConfig.model.trim()) {
        setAiEndpointError('Informe o nome do modelo local (ex: llama3.2).');
        return;
      }
      setAiEndpointError('');
      const saved = saveAIConfig({ ...aiConfig, endpoint: check.normalized, model: aiConfig.model.trim() });
      setAiConfig(saved);
      toast(`IA local configurada (${saved.model} em ${saved.endpoint})`);
      return;
    }
    setAiEndpointError('');
    setAiTestResult(null);
    const saved = saveAIConfig({ ...aiConfig, mode: 'cloud' });
    setAiConfig(saved);
    toast('Modo de IA ajustado para Nuvem (Servidor)');
  };

  const handleTestLocalAI = async () => {
    const check = validateLocalEndpoint(aiConfig.endpoint);
    if (!check.valid) {
      setAiEndpointError(check.error || 'Endereço de IA local inválido.');
      setAiTestResult(null);
      return;
    }
    setAiEndpointError('');
    setAiTestBusy(true);
    setAiTestResult(null);
    try {
      const result = await testLocalAIConnection({ ...aiConfig, endpoint: check.normalized });
      setAiTestResult(result);
    } finally {
      setAiTestBusy(false);
    }
  };

  useEffect(() => {
    localStorage.setItem(WORKSPACE_SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    bridge.getSecurityState().then((sec) => {
      setMfaEnabled(Boolean(sec?.mfaEnabled));
    }).catch(() => {});
    bridge.getAllDriveItems().then((items) => {
      if (Array.isArray(items)) setLiveDriveFiles(items);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showPasswordModal) {
        setShowPasswordModal(false);
        setPasswordError('');
        return;
      }
      if (showAccountModal) {
        setShowAccountModal(false);
        return;
      }
      if (showPlanModal) {
        setShowPlanModal(false);
        return;
      }
      if (showClearCacheConfirm) {
        setShowClearCacheConfirm(false);
        return;
      }
      if (showSignOutConfirm) {
        setShowSignOutConfirm(false);
        return;
      }
      if (editingDisplayName) {
        setDisplayNameDraft(settings.displayName);
        setEditingDisplayName(false);
        return;
      }
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    showPasswordModal,
    showAccountModal,
    showPlanModal,
    showClearCacheConfirm,
    showSignOutConfirm,
    editingDisplayName,
    settings.displayName,
    onClose,
  ]);

  const storageStats = useMemo(
    () =>
      computeWorkspaceStorageStats(
        liveDriveFiles,
        (data?.emails || []).length,
        settings.storagePlanGb
      ),
    [liveDriveFiles, data?.emails, settings.storagePlanGb]
  );

  const handleToggleTheme = () => {
    if (toggleTheme) {
      toggleTheme();
      const newMode = !isDarkMode;
      toast(newMode ? 'Modo escuro ativado' : 'Modo claro ativado');
    }
  };

  const toggleNotificationKey = (key: keyof WorkspaceNotificationSettings, label: string) => {
    const nextVal = !settings.notifications[key];
    setSettings((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: nextVal },
    }));
    toast(`${label} ${nextVal ? 'ativado' : 'desativado'}`);
  };

  const togglePrivacyKey = (key: keyof WorkspacePrivacySettings, label: string) => {
    const nextVal = !settings.privacy[key];
    setSettings((prev) => ({
      ...prev,
      privacy: { ...prev.privacy, [key]: nextVal },
    }));
    toast(`${label} ${nextVal ? 'ativado' : 'desativado'}`);
  };

  const handleSaveNickname = () => {
    const trimmed = nicknameInput.trim();
    localStorage.setItem('workspace_nickname', trimmed);
    onUpdateNickname?.(trimmed);
    toast(trimmed ? `Apelido "${trimmed}" salvo` : 'Apelido removido');
  };

  const handleSaveDisplayName = () => {
    const trimmed = displayNameDraft.trim();
    if (!trimmed) return;
    setSettings((prev) => ({ ...prev, displayName: trimmed }));
    setEditingDisplayName(false);
    toast(`Nome de exibição atualizado para "${trimmed}"`);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPasswordInput.length < 6) {
      setPasswordError('A senha deve ter pelo menos 6 caracteres.');
      toast('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordError('As senhas digitadas não conferem.');
      toast('As senhas não conferem');
      return;
    }
    setPasswordError('');
    const todayIso = new Date().toISOString().split('T')[0];
    setSettings((prev) => ({ ...prev, lastPasswordChange: todayIso }));
    setNewPasswordInput('');
    setConfirmPasswordInput('');
    setShowPasswordModal(false);
    toast('Senha da conta atualizada com sucesso');
  };

  const handleSelectPlan = (planGb: 15 | 100 | 2000, label: string) => {
    setSettings((prev) => ({ ...prev, storagePlanGb: planGb }));
    setShowPlanModal(false);
    toast(`Plano atualizado para ${label}`);
  };

  const handleClearCache = () => {
    const removed = clearTransientWorkspaceCache(localStorage);
    setShowClearCacheConfirm(false);
    toast(`${removed} itens de cache local removidos`);
  };

  const handleExportSettings = () => {
    const json = exportSettingsJson(settings);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workspace-configuracoes-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Configurações exportadas em JSON.');
  };

  const handleResetDefaults = () => {
    const fresh = resetUserSettings(data?.user?.name || settings.displayName);
    setSettings(fresh);
    toast('Preferências restauradas para o padrão.');
  };

  const changeAurora = (colors: string[], name: string) => {
    if (onUpdateTheme) {
      onUpdateTheme({ colorStops: colors, speed: 0.5 });
      toast(`Tema ${name} aplicado`);
    }
  };

  const cardSurface = isDarkMode
    ? 'bg-white/5 border-white/10'
    : 'bg-white border-gray-200';
  const rowDivider = isDarkMode ? 'border-white/10' : 'border-gray-100';
  const mutedText = isDarkMode ? 'text-white/60' : 'text-gray-500';

  const tabs: Array<{ id: typeof activeTab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
    { id: 'profile', label: 'Perfil', icon: User },
    { id: 'appearance', label: 'Aparência', icon: Moon },
    { id: 'notifications', label: 'Notificações', icon: Bell },
    { id: 'storage', label: 'Armazenamento', icon: HardDrive },
    { id: 'privacy', label: 'Privacidade', icon: Shield },
    { id: 'ai-offline', label: 'IA e Offline', icon: Cpu },
  ];

  const notificationRows: Array<{
    key: keyof WorkspaceNotificationSettings;
    label: string;
    desc: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  }> = [
    { key: 'emailPriority', label: 'E-mails prioritários', desc: 'Alertar na chegada de mensagens importantes no Gmail', icon: Mail },
    { key: 'calendarInvites', label: 'Convites e lembretes da Agenda', desc: 'Notificar 10 minutos antes de reuniões', icon: Calendar },
    { key: 'tasksReminders', label: 'Prazos do Google Tarefas', desc: 'Avisos de tarefas vencendo hoje', icon: CheckSquare },
    { key: 'meetCalls', label: 'Chamadas recebidas do Meet', desc: 'Toque visual ao receber convite para sala', icon: Video },
    { key: 'soundEffects', label: 'Feedback sonoro da interface', desc: 'Sons sutis para envio, conclusão e alertas', icon: Volume2 },
    { key: 'doNotDisturb', label: 'Modo Não Perturbe', desc: 'Silenciar pop-ups temporariamente durante foco', icon: BellOff },
  ];

  return (
    <div
      className={`relative flex flex-col md:flex-row h-full overflow-hidden transition-colors duration-300 font-sans ${
        isDarkMode ? 'bg-[#191919] text-white' : 'bg-[#F0F2F5] text-[#202124]'
      }`}
    >
      {/* Desktop/Tablet Sidebar */}
      <aside
        className={`hidden md:flex w-56 lg:w-64 border-r shrink-0 flex-col ${
          isDarkMode ? 'border-white/10 bg-white/[0.02]' : 'border-black/5 bg-white'
        }`}
      >
        <div className={`h-16 flex items-center px-6 border-b ${isDarkMode ? 'border-white/10' : 'border-black/5'} shrink-0`}>
          <span className="text-xl font-medium tracking-tight">Configurações</span>
        </div>

        <nav className="p-3 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? isDarkMode
                    ? 'bg-[#8AB4F8]/20 text-[#8AB4F8]'
                    : 'bg-[#E8F0FE] text-[#174EA6]'
                  : isDarkMode
                  ? 'text-white/75 hover:bg-white/5 hover:text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-black'
              }`}
            >
              <tab.icon size={18} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className={`mt-auto p-4 border-t ${isDarkMode ? 'border-white/10' : 'border-black/5'}`}>
          <button
            type="button"
            onClick={() => setShowSignOutConfirm(true)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={18} />
            <span>Sair da conta</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col h-full min-w-0 overflow-hidden ${
          isDarkMode ? '' : 'bg-white md:m-4 md:rounded-2xl md:shadow-sm md:border border-gray-200'
        }`}
      >
        <header
          className={`min-h-[56px] md:h-16 flex items-center justify-between gap-2 px-4 sm:px-6 md:px-8 border-b shrink-0 ${
            isDarkMode ? 'border-white/10 bg-[#191919]/80' : 'border-gray-100'
          }`}
        >
          <div className="min-w-0">
            <span className="md:hidden text-[11px] font-medium opacity-60 block leading-tight">Configurações</span>
            <h2 className="text-base sm:text-lg font-medium truncate">
              {tabs.find((t) => t.id === activeTab)?.label}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowSignOutConfirm(true)}
              aria-label="Sair da conta"
              className="md:hidden px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-500/10 flex items-center gap-1"
            >
              <LogOut size={14} />
              <span>Sair</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar Configurações"
              className={`p-2 rounded-full transition-colors ${
                isDarkMode ? 'hover:bg-white/10 text-white/70' : 'hover:bg-gray-100 text-gray-500'
              }`}
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Mobile Horizontal Tabs */}
        <nav
          aria-label="Categorias de configurações"
          className={`md:hidden flex items-center gap-1.5 px-3 py-2 border-b overflow-x-auto shrink-0 ${
            isDarkMode ? 'border-white/10 bg-white/[0.02]' : 'border-gray-100 bg-gray-50/60'
          }`}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-current={activeTab === tab.id ? 'page' : undefined}
              onClick={(e) => {
                setActiveTab(tab.id);
                e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                activeTab === tab.id
                  ? isDarkMode
                    ? 'bg-[#8AB4F8]/20 text-[#8AB4F8]'
                    : 'bg-[#E8F0FE] text-[#174EA6]'
                  : isDarkMode
                  ? 'text-white/75 hover:bg-white/5'
                  : 'text-gray-600 hover:bg-gray-200/60'
              }`}
            >
              <tab.icon size={14} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          <div className="max-w-2xl mx-auto space-y-5 sm:space-y-6">
            {/* TAB 1: PERFIL */}
            {activeTab === 'profile' && (
              <>
                <div className={`flex flex-col sm:flex-row items-start sm:items-center gap-6 p-6 rounded-2xl border ${cardSurface}`}>
                  <img
                    src={data?.user?.avatar}
                    alt={settings.displayName}
                    className={`w-20 h-20 rounded-full border-2 shrink-0 ${
                      isDarkMode ? 'border-white/15' : 'border-gray-200'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xl font-medium truncate">{settings.displayName}</h3>
                    <p className={`${mutedText} text-sm mb-4 truncate`}>{data?.user?.email}</p>
                    <button
                      type="button"
                      onClick={() => setShowAccountModal(true)}
                      className="px-4 py-2 bg-[#1A73E8] hover:bg-[#1557B0] text-white rounded-lg text-xs font-semibold transition-colors"
                    >
                      Gerenciar sua Conta Google
                    </button>
                  </div>
                </div>

                <div className={`rounded-2xl border p-5 space-y-3 ${cardSurface}`}>
                  <div>
                    <h4 className="text-sm font-semibold">Apelido na tela inicial</h4>
                    <p className={`text-xs ${mutedText} mt-0.5`}>
                      Exibido no cumprimento da Home. Deixe em branco para usar seu primeiro nome.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
                    <input
                      type="text"
                      aria-label="Apelido"
                      value={nicknameInput}
                      onChange={(e) => setNicknameInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveNickname()}
                      placeholder={settings.displayName.split(' ')[0] || 'Seu apelido'}
                      maxLength={30}
                      className={`flex-1 min-w-0 px-4 py-2 rounded-lg border text-sm outline-none transition-colors ${
                        isDarkMode
                          ? 'bg-white/5 border-white/15 text-white placeholder:text-white/35 focus:border-[#8AB4F8]'
                          : 'bg-gray-50 border-gray-200 text-[#202124] placeholder:text-gray-400 focus:border-[#1A73E8]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={handleSaveNickname}
                      className="px-5 py-2 bg-[#1A73E8] hover:bg-[#1557B0] text-white rounded-lg text-sm font-medium transition-colors shrink-0"
                    >
                      Salvar
                    </button>
                  </div>
                </div>

                <div className={`rounded-2xl border overflow-hidden ${cardSurface}`}>
                  <div className={`px-5 py-3 border-b ${rowDivider} text-xs font-semibold ${mutedText}`}>
                    Informações pessoais e credenciais
                  </div>

                  {editingDisplayName ? (
                    <div className={`p-4 border-b ${rowDivider} flex flex-wrap sm:flex-nowrap items-center gap-2`}>
                      <input
                        type="text"
                        aria-label="Novo nome de exibição"
                        value={displayNameDraft}
                        onChange={(e) => setDisplayNameDraft(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveDisplayName()}
                        className="flex-1 min-w-[160px] px-3 py-1.5 rounded-lg border border-current/20 bg-transparent text-sm outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleSaveDisplayName}
                        className="px-3 py-1.5 rounded-lg bg-[#1A73E8] text-white text-xs font-semibold shrink-0"
                      >
                        Aplicar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDisplayNameDraft(settings.displayName);
                          setEditingDisplayName(false);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs hover:bg-black/10 shrink-0"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setDisplayNameDraft(settings.displayName);
                        setEditingDisplayName(true);
                      }}
                      className={`w-full text-left p-4 flex items-center justify-between gap-2 border-b ${rowDivider} ${
                        isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                      } transition-colors`}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium">Nome de exibição</div>
                        <div className={`text-xs truncate ${mutedText}`}>{settings.displayName}</div>
                      </div>
                      <ChevronRight size={18} className={`${mutedText} shrink-0`} />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setPasswordError('');
                      setShowPasswordModal(true);
                    }}
                    className={`w-full text-left p-4 flex items-center justify-between gap-2 ${
                      isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                    } transition-colors`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium">Senha da conta</div>
                      <div className={`text-xs ${mutedText} tabular-nums`}>
                        Última alteração em {new Date(settings.lastPasswordChange).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                    <ChevronRight size={18} className={`${mutedText} shrink-0`} />
                  </button>
                </div>

                {/* Idioma e Fuso Horário */}
                <div className={`rounded-2xl border overflow-hidden ${cardSurface}`}>
                  <div className={`px-5 py-3 border-b ${rowDivider} text-xs font-semibold ${mutedText} flex items-center gap-1.5`}>
                    <Globe size={13} /> Idioma e região
                  </div>
                  <div className={`p-4 flex flex-wrap items-center justify-between gap-3 border-b ${rowDivider}`}>
                    <div>
                      <div className="text-sm font-medium">Idioma do Workspace</div>
                      <div className={`text-xs ${mutedText}`}>Define menus, datas e formatação</div>
                    </div>
                    <select
                      aria-label="Idioma do Workspace"
                      value={settings.language}
                      onChange={(e) => {
                        const language = e.target.value as WorkspaceLanguage;
                        setSettings((prev) => ({ ...prev, language }));
                        toast(`Idioma atualizado para ${language}`);
                      }}
                      className={`px-3 py-1.5 rounded-lg border text-xs outline-none ${
                        isDarkMode ? 'bg-[#25262B] border-white/15 text-white' : 'bg-white border-gray-300 text-gray-800'
                      }`}
                    >
                      <option value="pt-BR">Português (Brasil)</option>
                      <option value="en-US">English (US)</option>
                      <option value="es-ES">Español</option>
                    </select>
                  </div>
                  <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">Fuso horário principal</div>
                      <div className={`text-xs ${mutedText}`}>Sincronizado com Agenda e Tarefas</div>
                    </div>
                    <select
                      aria-label="Fuso horário principal"
                      value={settings.timezone}
                      onChange={(e) => {
                        const timezone = e.target.value as WorkspaceTimezone;
                        setSettings((prev) => ({ ...prev, timezone }));
                        toast(`Fuso horário ajustado para ${timezone}`);
                      }}
                      className={`px-3 py-1.5 rounded-lg border text-xs outline-none ${
                        isDarkMode ? 'bg-[#25262B] border-white/15 text-white' : 'bg-white border-gray-300 text-gray-800'
                      }`}
                    >
                      <option value="America/Sao_Paulo">Brasília (GMT-3)</option>
                      <option value="America/New_York">Nova York (GMT-5)</option>
                      <option value="Europe/Lisbon">Lisboa (GMT+0)</option>
                      <option value="UTC">UTC (GMT+0)</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* TAB 2: APARÊNCIA */}
            {activeTab === 'appearance' && (
              <div className="space-y-5">
                <div className={`rounded-2xl border p-5 flex items-center justify-between ${cardSurface}`}>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-white/10' : 'bg-blue-50'}`}>
                      {isDarkMode ? <Moon size={22} /> : <Monitor size={22} className="text-[#1A73E8]" />}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Modo Escuro</div>
                      <div className={`text-xs ${mutedText}`}>
                        Ajustar aparência para ambientes com pouca luz
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleTheme}
                    aria-label="Alternar modo escuro"
                    className="text-[#1A73E8] transition-transform active:scale-95"
                  >
                    {isDarkMode ? (
                      <ToggleRight size={38} className="fill-blue-500/20" />
                    ) : (
                      <ToggleLeft size={38} className="text-gray-300" />
                    )}
                  </button>
                </div>

                <div className={`rounded-2xl border p-5 flex items-center justify-between ${cardSurface}`}>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-white/10' : 'bg-blue-50'}`}>
                      <Palette size={22} className={isDarkMode ? 'text-white' : 'text-[#1A73E8]'} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Gradiente Animado de Fundo (Aurora)</div>
                      <div className={`text-xs ${mutedText}`}>
                        {showAurora ? 'Ativado (ondas de cores animadas)' : 'Desativado (fundo minimalista limpo)'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Alternar gradiente Aurora"
                    onClick={() => {
                      if (onToggleAurora) {
                        onToggleAurora();
                        toast(!showAurora ? 'Gradiente ativado' : 'Fundo limpo sem gradiente ativado');
                      }
                    }}
                    className="text-[#1A73E8] transition-transform active:scale-95"
                  >
                    {showAurora ? (
                      <ToggleRight size={38} className="fill-blue-500/20" />
                    ) : (
                      <ToggleLeft size={38} className="text-gray-300" />
                    )}
                  </button>
                </div>

                <div className={`rounded-2xl border p-5 flex flex-wrap items-center justify-between gap-3 ${cardSurface}`}>
                  <div>
                    <div className="text-sm font-semibold">Densidade da interface</div>
                    <div className={`text-xs ${mutedText}`}>
                      Ajuste o espaçamento de listas e painéis no Workspace
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(
                      [
                        { id: 'comfortable', label: 'Confortável' },
                        { id: 'compact', label: 'Compacta' },
                      ] as Array<{ id: WorkspaceDensity; label: string }>
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setSettings((prev) => ({ ...prev, density: opt.id }));
                          toast(`Densidade ${opt.label.toLowerCase()} selecionada`);
                        }}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                          settings.density === opt.id
                            ? 'border-[#1A73E8] bg-[#1A73E8]/10 text-[#1A73E8]'
                            : isDarkMode
                            ? 'border-white/15 text-white/70 hover:bg-white/5'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {showAurora && (
                  <div className="space-y-3 pt-1">
                    <h4 className={`text-xs font-semibold ${mutedText} px-1 flex items-center gap-2`}>
                      <Palette size={14} /> Paleta de cores do gradiente
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[
                        { name: 'Google Padrão', colors: ['#4285F4', '#34A853', '#EA4335'], cls: 'from-[#4285F4] via-[#34A853] to-[#EA4335]' },
                        { name: 'Nebulosa', colors: ['#8E24AA', '#D81B60', '#F4511E'], cls: 'from-[#8E24AA] via-[#D81B60] to-[#F4511E]' },
                        { name: 'Oceano', colors: ['#006064', '#00838F', '#0097A7'], cls: 'from-[#006064] via-[#00838F] to-[#0097A7]' },
                      ].map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => changeAurora(preset.colors, preset.name)}
                          className="aspect-video rounded-xl border border-current/15 hover:border-[#1A73E8] overflow-hidden relative group text-left"
                        >
                          <div className={`absolute inset-0 bg-gradient-to-br ${preset.cls} opacity-75 group-hover:opacity-100 transition-opacity`} />
                          <span className="absolute bottom-2.5 left-3 text-xs font-semibold text-white drop-shadow">
                            {preset.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: NOTIFICAÇÕES (100% persistente) */}
            {activeTab === 'notifications' && (
              <div className={`rounded-2xl border overflow-hidden ${cardSurface}`}>
                {notificationRows.map((row, idx) => {
                  const active = settings.notifications[row.key];
                  return (
                    <div
                      key={row.key}
                      className={`p-4 flex items-center justify-between gap-4 ${
                        idx < notificationRows.length - 1 ? `border-b ${rowDivider}` : ''
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <row.icon size={19} className={mutedText} />
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{row.label}</div>
                          <div className={`text-xs ${mutedText} truncate`}>{row.desc}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label={`Alternar ${row.label}`}
                        onClick={() => toggleNotificationKey(row.key, row.label)}
                        className="text-[#1A73E8] shrink-0"
                      >
                        {active ? (
                          <ToggleRight size={34} className="fill-blue-500/20" />
                        ) : (
                          <ToggleLeft size={34} className="text-gray-400" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 4: ARMAZENAMENTO */}
            {activeTab === 'storage' && (
              <div className="space-y-5">
                <div className={`p-7 rounded-2xl border text-center ${cardSurface}`}>
                  <div className="w-40 h-40 mx-auto relative flex items-center justify-center mb-5">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <path
                        className={isDarkMode ? 'text-white/10' : 'text-gray-200'}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.5"
                      />
                      <path
                        className="text-[#1A73E8]"
                        strokeDasharray={`${storageStats.percentUsed}, 100`}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-2xl font-bold tabular-nums">{storageStats.percentUsed}%</span>
                      <span className={`text-xs ${mutedText}`}>usado</span>
                    </div>
                  </div>
                  <h3 className="text-base font-semibold">Armazenamento do Google Workspace</h3>
                  <p className={`${mutedText} text-sm mt-1 mb-5 tabular-nums`}>
                    {storageStats.totalUsedGb} GB de {storageStats.planGb} GB em uso
                  </p>

                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowPlanModal(true)}
                      className="bg-[#1A73E8] hover:bg-[#1557B0] text-white px-5 py-2.5 rounded-lg text-xs font-semibold transition-colors"
                    >
                      Gerenciar plano de armazenamento
                    </button>
                    {onOpenApp && (
                      <button
                        type="button"
                        onClick={() => onOpenApp('drive')}
                        className="px-4 py-2.5 rounded-lg border border-current/15 text-xs font-medium hover:bg-black/5 inline-flex items-center gap-1.5"
                      >
                        <ExternalLink size={14} /> Limpar no Google Drive
                      </button>
                    )}
                  </div>
                </div>

                <div className={`rounded-2xl border p-5 space-y-3 ${cardSurface}`}>
                  <h4 className="text-sm font-semibold">Distribuição por serviço</h4>
                  <div className="space-y-3">
                    {storageStats.categories.map((cat) => {
                      const pct = Math.min(100, Math.round((cat.usedGb / storageStats.planGb) * 100));
                      return (
                        <div key={cat.id} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium">{cat.label}</span>
                            <span className={`${mutedText} font-mono tabular-nums`}>{cat.usedGb} GB</span>
                          </div>
                          <div className={`h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-white/10' : 'bg-gray-100'}`}>
                            <div className="h-full rounded-full" style={{ width: `${Math.max(4, pct)}%`, backgroundColor: cat.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: PRIVACIDADE (100% implementada) */}
            {activeTab === 'privacy' && (
              <div className="space-y-5">
                <div className={`rounded-2xl border overflow-hidden ${cardSurface}`}>
                  <div className={`px-5 py-3 border-b ${rowDivider} text-xs font-semibold ${mutedText}`}>
                    Controles de dados e privacidade do Workspace
                  </div>

                  <div className={`p-4 flex items-center justify-between border-b ${rowDivider}`}>
                    <div className="flex items-center gap-3.5">
                      <Lock size={19} className={mutedText} />
                      <div>
                        <div className="text-sm font-medium">Bloqueio automático por inatividade</div>
                        <div className={`text-xs ${mutedText}`}>Exige validação ao retornar após períodos ociosos</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Alternar bloqueio automático"
                      onClick={() => togglePrivacyKey('sessionLockOnIdle', 'Bloqueio por inatividade')}
                      className="text-[#1A73E8]"
                    >
                      {settings.privacy.sessionLockOnIdle ? (
                        <ToggleRight size={34} className="fill-blue-500/20" />
                      ) : (
                        <ToggleLeft size={34} className="text-gray-400" />
                      )}
                    </button>
                  </div>

                  <div className={`p-4 flex items-center justify-between border-b ${rowDivider}`}>
                    <div className="flex items-center gap-3.5">
                      <FileText size={19} className={mutedText} />
                      <div>
                        <div className="text-sm font-medium">Registrar histórico de auditoria</div>
                        <div className={`text-xs ${mutedText}`}>Mantém logs de acessos e alterações para segurança Zero-Trust</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Alternar logs de auditoria"
                      onClick={() => togglePrivacyKey('activityAuditLog', 'Histórico de auditoria')}
                      className="text-[#1A73E8]"
                    >
                      {settings.privacy.activityAuditLog ? (
                        <ToggleRight size={34} className="fill-blue-500/20" />
                      ) : (
                        <ToggleLeft size={34} className="text-gray-400" />
                      )}
                    </button>
                  </div>

                  <div className={`p-4 flex items-center justify-between border-b ${rowDivider}`}>
                    <div className="flex items-center gap-3.5">
                      <EyeOff size={19} className={mutedText} />
                      <div>
                        <div className="text-sm font-medium">Ocultar prévia de mensagens sensíveis</div>
                        <div className={`text-xs ${mutedText}`}>Exibe apenas o remetente nas notificações da Home</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Ocultar prévia de mensagens"
                      onClick={() => togglePrivacyKey('maskSensitivePreviews', 'Ocultação de prévias')}
                      className="text-[#1A73E8]"
                    >
                      {settings.privacy.maskSensitivePreviews ? (
                        <ToggleRight size={34} className="fill-blue-500/20" />
                      ) : (
                        <ToggleLeft size={34} className="text-gray-400" />
                      )}
                    </button>
                  </div>

                  <div className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium">Retenção do histórico de atividades</div>
                      <div className={`text-xs ${mutedText}`}>Exclusão automática após o período selecionado</div>
                    </div>
                    <select
                      aria-label="Período de retenção"
                      value={settings.privacy.historyRetentionDays}
                      onChange={(e) => {
                        const days = Number(e.target.value) as 30 | 90 | 365;
                        setSettings((prev) => ({
                          ...prev,
                          privacy: { ...prev.privacy, historyRetentionDays: days },
                        }));
                        toast(`Retenção ajustada para ${days} dias`);
                      }}
                      className={`px-3 py-1.5 rounded-lg border text-xs outline-none ${
                        isDarkMode ? 'bg-[#25262B] border-white/15 text-white' : 'bg-white border-gray-300 text-gray-800'
                      }`}
                    >
                      <option value={30}>30 dias</option>
                      <option value={90}>90 dias</option>
                      <option value={365}>365 dias</option>
                    </select>
                  </div>
                </div>

                {/* Links rápidos Segurança & Permissões + Backup & Limpeza */}
                <div className={`rounded-2xl border p-5 space-y-4 ${cardSurface}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">Segurança, MFA e Permissões</div>
                      <div className={`text-xs ${mutedText} mt-0.5`}>
                        Autenticação em 2 fatores: {mfaEnabled ? 'Ativada' : 'Disponível na Central de Segurança'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {onOpenApp && (
                        <>
                          <button
                            type="button"
                            onClick={() => onOpenApp('security')}
                            className="px-3 py-1.5 rounded-lg border border-current/15 text-xs font-medium hover:bg-black/5"
                          >
                            Segurança
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenApp('permissions')}
                            className="px-3 py-1.5 rounded-lg border border-current/15 text-xs font-medium hover:bg-black/5"
                          >
                            Permissões
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className={`pt-4 border-t ${rowDivider} flex flex-wrap items-center justify-between gap-3`}>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">Backup e restauração de preferências</div>
                      <div className={`text-xs ${mutedText}`}>
                        Exporte suas configurações em JSON ou restaure os padrões do Workspace
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleExportSettings}
                        className="px-3 py-1.5 rounded-lg border border-current/15 text-xs font-medium hover:bg-black/5 inline-flex items-center gap-1.5"
                      >
                        <Download size={13} /> Exportar JSON
                      </button>
                      <button
                        type="button"
                        onClick={handleResetDefaults}
                        className="px-3 py-1.5 rounded-lg border border-current/15 text-xs font-medium hover:bg-black/5 inline-flex items-center gap-1.5"
                      >
                        <RotateCcw size={13} /> Restaurar padrões
                      </button>
                    </div>
                  </div>

                  <div className={`pt-4 border-t ${rowDivider} flex flex-wrap items-center justify-between gap-3`}>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">Limpar cache de dados locais</div>
                      <div className={`text-xs ${mutedText}`}>
                        Remove rascunhos temporários mantendo suas preferências de conta
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowClearCacheConfirm(true)}
                      className="px-3.5 py-2 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
                    >
                      <Trash2 size={14} /> Limpar cache
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: IA, CONTA GOOGLE DIRETA E MODO OFFLINE */}
            {activeTab === 'ai-offline' && (
              <div className="space-y-5">
                {/* 1. Conexão Direta Google Workspace (Zero-Server) */}
                <div className={`rounded-2xl border p-5 space-y-4 ${cardSurface}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold">Conta Google Workspace (Conexão Direta)</h3>
                      <p className={`text-xs ${mutedText} mt-1 leading-relaxed`}>
                        {cloudUser && hasWorkspaceToken
                          ? `Conectado diretamente como ${cloudUser.email}. Seus dados trafegam só entre seu navegador e o Google — nada é armazenado em servidores da plataforma.`
                          : 'Conecte sua conta Google pessoal para sincronizar e operar seus apps reais. O token fica apenas na memória da aba e nunca é salvo em servidor.'}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold shrink-0 ${
                        cloudUser && hasWorkspaceToken
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : isDarkMode
                          ? 'bg-white/10 text-white/75'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {cloudUser && hasWorkspaceToken ? (
                        <>
                          <CheckCircle2 size={13} /> Conectado
                        </>
                      ) : (
                        <>Modo local isolado</>
                      )}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {['Gmail', 'Drive', 'Agenda', 'Tarefas', 'Docs', 'Planilhas', 'Slides', 'Meet'].map((svc) => (
                      <span
                        key={svc}
                        className={`px-2 py-0.5 rounded-md border ${
                          isDarkMode
                            ? 'border-white/10 bg-white/5 text-white/75'
                            : 'border-gray-200 bg-gray-50 text-gray-700'
                        }`}
                      >
                        {svc}
                      </span>
                    ))}
                  </div>

                  <div className={`pt-3 border-t ${rowDivider} flex flex-wrap items-center justify-end gap-2.5`}>
                    {cloudUser && hasWorkspaceToken ? (
                      <>
                        {onSignOutGoogle && (
                          <button
                            type="button"
                            onClick={onSignOutGoogle}
                            disabled={authBusy}
                            className="px-3.5 py-2 rounded-lg border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Desconectar conta
                          </button>
                        )}
                        {onSyncGoogleWorkspace && (
                          <button
                            type="button"
                            onClick={onSyncGoogleWorkspace}
                            disabled={authBusy}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-semibold transition-colors disabled:opacity-60 cursor-pointer"
                          >
                            <RefreshCw size={13} className={authBusy ? 'animate-spin' : ''} />
                            <span>Sincronizar agora</span>
                          </button>
                        )}
                      </>
                    ) : (
                      onSignInGoogle && (
                        <GoogleSignInButton onClick={onSignInGoogle} disabled={authBusy} />
                      )
                    )}
                  </div>
                </div>

                {/* 2. Instalação Local e Modo Offline (PWA) */}
                <div className={`rounded-2xl border p-5 ${cardSurface}`}>
                  <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                      <div
                        className={`p-2.5 rounded-xl shrink-0 ${
                          isOnline
                            ? isDarkMode
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-500/15 text-amber-600'
                        }`}
                      >
                        {isOnline ? <Wifi size={18} /> : <WifiOff size={18} />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">Execução Local e Offline (PWA)</div>
                        <div className={`text-xs ${mutedText}`}>
                          {isOnline
                            ? 'Online — aplicativo pronto para instalação isolada e uso sem internet'
                            : 'Offline — operando com seus dados locais preservados nesta máquina'}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 ml-auto">
                      <PWAInstallButton isDarkMode={isDarkMode} />
                    </div>
                  </div>
                </div>

                {/* 3. Motor de IA (Nuvem vs IA Local na máquina do usuário) */}
                <form
                  onSubmit={handleSaveAIConfig}
                  noValidate
                  className={`rounded-2xl border p-5 space-y-4 ${cardSurface}`}
                >
                  <div>
                    <h3 className="text-sm font-semibold">Motor de Inteligência Artificial</h3>
                    <p className={`text-xs ${mutedText} mt-0.5`}>
                      Escolha entre o Gemini em nuvem (configurado via ambiente do servidor) ou uma IA local rodando na sua própria máquina.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Modo de Inteligência Artificial">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={aiConfig.mode === 'cloud'}
                      onClick={() => {
                        setAiConfig((prev) => ({ ...prev, mode: 'cloud' }));
                        setAiEndpointError('');
                        setAiTestResult(null);
                      }}
                      className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                        aiConfig.mode === 'cloud'
                          ? 'border-[#1A73E8] bg-[#1A73E8]/10'
                          : isDarkMode
                          ? 'border-white/15 hover:bg-white/5'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <Cloud size={15} className="text-[#1A73E8]" />
                        <span>Nuvem (Servidor)</span>
                      </div>
                      <p className={`text-[11px] ${mutedText} mt-1`}>
                        Usa o Gemini via rota protegida do servidor (variável de ambiente).
                      </p>
                    </button>

                    <button
                      type="button"
                      role="radio"
                      aria-checked={aiConfig.mode === 'local'}
                      onClick={() => {
                        setAiConfig((prev) => ({ ...prev, mode: 'local' }));
                        setAiEndpointError('');
                      }}
                      className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                        aiConfig.mode === 'local'
                          ? 'border-[#1A73E8] bg-[#1A73E8]/10'
                          : isDarkMode
                          ? 'border-white/15 hover:bg-white/5'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <Server size={15} className="text-[#1A73E8]" />
                        <span>IA Local (Sua Máquina)</span>
                      </div>
                      <p className={`text-[11px] ${mutedText} mt-1`}>
                        Conecta direto ao Ollama ou LM Studio em localhost, 100% privado.
                      </p>
                    </button>
                  </div>

                  {aiConfig.mode === 'cloud' ? (
                    <div
                      className={`rounded-xl border p-3.5 text-xs leading-relaxed ${
                        isDarkMode
                          ? 'border-white/10 bg-white/[0.03] text-white/80'
                          : 'border-blue-100 bg-blue-50/60 text-[#174EA6]'
                      }`}
                    >
                      No modo Nuvem, nenhuma chave fica exposta no navegador. Ao rodar o Google OS localmente na sua máquina, basta definir sua própria chave do Google AI Studio na variável de ambiente <code className="font-mono font-semibold">GEMINI_API_KEY</code> do arquivo <code className="font-mono font-semibold">.env</code>.
                    </div>
                  ) : (
                    <div className="space-y-3.5 pt-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-xs font-medium ${mutedText}`}>Atalhos rápidos:</span>
                        {LOCAL_AI_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              setAiConfig((prev) => ({
                                ...prev,
                                mode: 'local',
                                engine: preset.engine,
                                endpoint: preset.endpoint,
                                model: preset.model,
                              }));
                              setAiEndpointError('');
                              setAiTestResult(null);
                            }}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                              isDarkMode
                                ? 'border-white/15 hover:bg-white/10 text-white'
                                : 'border-gray-300 hover:bg-gray-100 text-gray-800'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="block space-y-1">
                          <span className="text-xs font-medium block">Compatibilidade do servidor local</span>
                          <select
                            aria-label="Compatibilidade do servidor local"
                            value={aiConfig.engine}
                            onChange={(e) => {
                              setAiConfig((prev) => ({
                                ...prev,
                                engine: e.target.value as LocalAIEngine,
                              }));
                              setAiTestResult(null);
                            }}
                            className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${
                              isDarkMode
                                ? 'bg-[#25262B] border-white/15 text-white'
                                : 'bg-white border-gray-300 text-gray-800'
                            }`}
                          >
                            <option value="ollama">Ollama (/api/chat)</option>
                            <option value="openai-compatible">LM Studio / OpenAI-compatível (/v1/chat/completions)</option>
                          </select>
                        </label>

                        <label className="block space-y-1">
                          <span className="text-xs font-medium block">Nome do modelo local</span>
                          <input
                            type="text"
                            aria-label="Nome do modelo local"
                            value={aiConfig.model}
                            onChange={(e) => {
                              setAiConfig((prev) => ({ ...prev, model: e.target.value }));
                              if (aiEndpointError) setAiEndpointError('');
                            }}
                            placeholder="llama3.2"
                            maxLength={80}
                            className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${
                              isDarkMode
                                ? 'bg-white/5 border-white/15 text-white placeholder:text-white/35 focus:border-[#8AB4F8]'
                                : 'bg-gray-50 border-gray-300 text-[#202124] placeholder:text-gray-400 focus:border-[#1A73E8]'
                            }`}
                          />
                        </label>
                      </div>

                      <label className="block space-y-1">
                        <span className="text-xs font-medium block">Endereço local (somente localhost / 127.0.0.1)</span>
                        <input
                          type="url"
                          aria-label="Endereço da IA local"
                          value={aiConfig.endpoint}
                          onChange={(e) => {
                            setAiConfig((prev) => ({ ...prev, endpoint: e.target.value }));
                            if (aiEndpointError) setAiEndpointError('');
                            if (aiTestResult) setAiTestResult(null);
                          }}
                          placeholder="http://localhost:11434"
                          className={`w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none ${
                            isDarkMode
                              ? 'bg-white/5 border-white/15 text-white placeholder:text-white/35 focus:border-[#8AB4F8]'
                              : 'bg-gray-50 border-gray-300 text-[#202124] placeholder:text-gray-400 focus:border-[#1A73E8]'
                          }`}
                        />
                      </label>

                      {aiEndpointError && (
                        <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                          <AlertCircle size={14} className="shrink-0 mt-0.5" />
                          <span>{aiEndpointError}</span>
                        </p>
                      )}

                      {aiTestResult && (
                        <p
                          role="status"
                          className={`flex items-start gap-1.5 text-xs font-medium ${
                            aiTestResult.ok
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {aiTestResult.ok ? (
                            <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle size={14} className="shrink-0 mt-0.5" />
                          )}
                          <span>{aiTestResult.message}</span>
                        </p>
                      )}
                    </div>
                  )}

                  <div className={`pt-3 border-t ${rowDivider} flex flex-wrap items-center justify-end gap-2.5`}>
                    {aiConfig.mode === 'local' && (
                      <button
                        type="button"
                        onClick={() => { void handleTestLocalAI(); }}
                        disabled={aiTestBusy}
                        className={`px-3.5 py-2 rounded-lg border text-xs font-medium transition-colors disabled:opacity-60 cursor-pointer ${
                          isDarkMode
                            ? 'border-white/15 hover:bg-white/10 text-white'
                            : 'border-gray-300 hover:bg-gray-100 text-gray-800'
                        }`}
                      >
                        {aiTestBusy ? 'Testando...' : 'Testar conexão local'}
                      </button>
                    )}
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Salvar IA
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Gerenciar Conta Google */}
      {showAccountModal && (
        <div
          onClick={() => setShowAccountModal(false)}
          className="absolute inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-4 ${isDarkMode ? 'bg-[#242529] border-white/10 text-white' : 'bg-white border-gray-200 text-[#202124]'}`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Conta Google Workspace</h3>
              <button type="button" onClick={() => setShowAccountModal(false)} aria-label="Fechar detalhes da conta" className="p-1 rounded-full hover:bg-black/10">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between gap-2 py-2 border-b border-current/10">
                <span className={mutedText}>Titular</span>
                <span className="font-medium truncate">{settings.displayName}</span>
              </div>
              <div className="flex justify-between gap-2 py-2 border-b border-current/10">
                <span className={mutedText}>E-mail principal</span>
                <span className="font-medium truncate">{data?.user?.email}</span>
              </div>
              <div className="flex justify-between gap-2 py-2 border-b border-current/10">
                <span className={mutedText}>Plano ativo</span>
                <span className="font-medium tabular-nums">Workspace {settings.storagePlanGb} GB</span>
              </div>
              <div className="flex justify-between gap-2 py-2">
                <span className={mutedText}>Proteção Zero-Trust</span>
                <span className="font-medium text-emerald-600">{mfaEnabled ? 'MFA Ativo' : 'Padrão'}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              {onOpenApp && (
                <button
                  type="button"
                  onClick={() => {
                    setShowAccountModal(false);
                    onOpenApp('security');
                  }}
                  className="px-4 py-2 rounded-lg border border-current/15 text-xs font-medium"
                >
                  Abrir Segurança
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowAccountModal(false)}
                className="px-4 py-2 rounded-lg bg-[#1A73E8] text-white text-xs font-semibold"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Alterar Senha */}
      {showPasswordModal && (
        <div
          onClick={() => {
            setShowPasswordModal(false);
            setPasswordError('');
          }}
          className="absolute inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleChangePassword}
            noValidate
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-2xl border p-6 shadow-2xl space-y-4 ${isDarkMode ? 'bg-[#242529] border-white/10 text-white' : 'bg-white border-gray-200 text-[#202124]'}`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <KeyRound size={17} className="text-[#1A73E8]" /> Alterar senha
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordError('');
                }}
                aria-label="Cancelar alteração de senha"
                className="p-1 rounded-full hover:bg-black/10"
              >
                <X size={18} />
              </button>
            </div>
            <input
              type="password"
              aria-label="Nova senha"
              placeholder="Nova senha (mín. 6 caracteres)"
              value={newPasswordInput}
              onChange={(e) => {
                setNewPasswordInput(e.target.value);
                if (passwordError) setPasswordError('');
              }}
              className="w-full px-3 py-2 rounded-lg border border-current/15 bg-transparent text-sm outline-none focus:border-[#1A73E8]"
            />
            <input
              type="password"
              aria-label="Confirmar nova senha"
              placeholder="Confirmar nova senha"
              value={confirmPasswordInput}
              onChange={(e) => {
                setConfirmPasswordInput(e.target.value);
                if (passwordError) setPasswordError('');
              }}
              className="w-full px-3 py-2 rounded-lg border border-current/15 bg-transparent text-sm outline-none focus:border-[#1A73E8]"
            />
            {passwordError && (
              <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-medium">
                {passwordError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordError('');
                }}
                className="px-3.5 py-2 rounded-lg text-xs hover:bg-black/10"
              >
                Cancelar
              </button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-[#1A73E8] text-white text-xs font-semibold">
                Atualizar senha
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Planos de Armazenamento */}
      {showPlanModal && (
        <div
          onClick={() => setShowPlanModal(false)}
          className="absolute inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl space-y-4 ${isDarkMode ? 'bg-[#242529] border-white/10 text-white' : 'bg-white border-gray-200 text-[#202124]'}`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Planos Google One & Workspace</h3>
              <button type="button" onClick={() => setShowPlanModal(false)} aria-label="Fechar planos" className="p-1 rounded-full hover:bg-black/10">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { gb: 15 as const, label: 'Básico · 15 GB', price: 'Gratuito' },
                { gb: 100 as const, label: 'Standard · 100 GB', price: 'R$ 9,90/mês' },
                { gb: 2000 as const, label: 'Premium · 2 TB', price: 'R$ 38,90/mês' },
              ].map((p) => {
                const isCurrent = settings.storagePlanGb === p.gb;
                return (
                  <button
                    key={p.gb}
                    type="button"
                    onClick={() => handleSelectPlan(p.gb, p.label)}
                    className={`p-4 rounded-xl border text-left transition-all space-y-2 ${
                      isCurrent ? 'border-[#1A73E8] bg-[#1A73E8]/10' : 'border-current/15 hover:border-[#1A73E8]'
                    }`}
                  >
                    <div className="text-xs font-semibold">{p.label}</div>
                    <div className="text-sm font-bold tabular-nums">{p.price}</div>
                    {isCurrent && (
                      <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1A73E8]">
                        <Check size={12} /> Plano atual
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Limpeza de Cache */}
      {showClearCacheConfirm && (
        <div
          onClick={() => setShowClearCacheConfirm(false)}
          className="absolute inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-2xl border p-6 shadow-2xl space-y-4 ${isDarkMode ? 'bg-[#242529] border-white/10 text-white' : 'bg-white border-gray-200 text-[#202124]'}`}
          >
            <h3 className="text-base font-semibold">Limpar cache local?</h3>
            <p className={`text-xs ${mutedText}`}>
              Isso apagará estados temporários salvos no navegador e restaurará os arquivos padrão na próxima recarga, preservando seu tema e configurações.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowClearCacheConfirm(false)} className="px-3.5 py-2 rounded-lg text-xs hover:bg-black/10">
                Cancelar
              </button>
              <button type="button" onClick={handleClearCache} className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold">
                Confirmar limpeza
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Sair da Conta */}
      {showSignOutConfirm && (
        <div
          onClick={() => setShowSignOutConfirm(false)}
          className="absolute inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-2xl border p-6 shadow-2xl space-y-4 ${isDarkMode ? 'bg-[#242529] border-white/10 text-white' : 'bg-white border-gray-200 text-[#202124]'}`}
          >
            <h3 className="text-base font-semibold">Encerrar sessão ativa?</h3>
            <p className={`text-xs ${mutedText}`}>
              Você desconectará a conta <strong>{data?.user?.email}</strong> deste Workspace e retornará para a tela inicial.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowSignOutConfirm(false)} className="px-3.5 py-2 rounded-lg text-xs hover:bg-black/10">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSignOutConfirm(false);
                  if (onSignOutGoogle) {
                    onSignOutGoogle();
                  } else {
                    toast('Sessão encerrada com segurança');
                  }
                  onClose();
                }}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold"
              >
                Sair agora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
