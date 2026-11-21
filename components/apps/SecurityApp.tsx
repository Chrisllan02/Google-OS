import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  ShieldCheck,
  Key,
  RefreshCw,
  AlertTriangle,
  QrCode,
  Terminal,
  Activity,
  Play,
  X,
  CheckCircle2,
  Monitor,
  Smartphone,
  LogOut,
  Copy,
  Download,
  Search,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { bridge, AuditLog, SecurityState, LogStatus } from '../../utils/GASBridge';
import { GoogleIcons } from '../GoogleIcons';
import {
  ActiveSession,
  ConnectedOAuthApp,
  auditLogsToCsv,
  calculateSecurityScore,
  derivePreviewTotpCode,
  evaluateSecurityChecklist,
  filterAuditLogs,
  generateBackupCodes,
  isValidSixDigitCode,
  revokeActiveSession,
  revokeOAuthGrant,
  revokeOtherSessions,
  verifyTotpCode,
} from '../../utils/securityPermissionsLogic';
import type { AppOpenPayload, DashboardData } from '../../utils/GASBridge';

interface SecurityAppProps {
  onClose: () => void;
  data: DashboardData;
  isDarkMode?: boolean;
  showToast?: (msg: string) => void;
  onOpenApp?: (type: string, fileData?: AppOpenPayload) => void;
}

const SESSIONS_KEY = 'workspace_active_sessions_v2';
const OAUTH_APPS_KEY = 'workspace_oauth_apps_v2';
const BACKUP_CODES_KEY = 'workspace_mfa_backup_v1';

function buildCurrentBrowserSession(): ActiveSession {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const platform = /Mac/i.test(ua)
    ? 'macOS'
    : /Windows/i.test(ua)
    ? 'Windows'
    : /Android/i.test(ua)
    ? 'Android'
    : /iPhone|iPad/i.test(ua)
    ? 'iOS'
    : /Linux/i.test(ua)
    ? 'Linux'
    : 'Navegador Web';
  const browser = /Edg\//i.test(ua)
    ? 'Edge'
    : /Chrome\//i.test(ua)
    ? 'Chrome / Chromium'
    : /Firefox\//i.test(ua)
    ? 'Firefox'
    : /Safari\//i.test(ua)
    ? 'Safari'
    : 'Web';
  return {
    id: 'sess_current',
    deviceName: 'Esta sessão (Navegador atual)',
    platform: `${platform} · ${browser}`,
    location: 'Esta máquina',
    ipAddress: 'Local',
    lastActive: 'Ativo agora',
    isCurrent: true,
  };
}

// Deterministic geometric QR preview SVG generated from the secret string (zero external requests)
function SecretQrPreview({ secret }: { secret: string }) {
  const size = 9;
  const cells: boolean[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const isCorner =
        (r < 3 && c < 3) || (r < 3 && c >= size - 3) || (r >= size - 3 && c < 3);
      if (isCorner) {
        cells.push(true);
      } else {
        const ch = secret.charCodeAt((r * size + c) % Math.max(1, secret.length)) || 65;
        cells.push((ch + r * 3 + c * 7) % 2 === 0);
      }
    }
  }
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-20 h-20 rounded-lg bg-white p-1.5 border border-gray-200 shrink-0"
      aria-label="QR Code TOTP"
    >
      {cells.map((on, idx) =>
        on ? (
          <rect
            key={idx}
            x={idx % size}
            y={Math.floor(idx / size)}
            width={0.92}
            height={0.92}
            fill="#111827"
            rx={0.12}
          />
        ) : null
      )}
    </svg>
  );
}

export default function SecurityApp({
  onClose,
  data,
  isDarkMode = false,
  showToast,
  onOpenApp,
}: SecurityAppProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [security, setSecurity] = useState<SecurityState>({ mfaEnabled: false, mfaSecret: '' });

  // 2FA pairing & backup codes
  const [pairingSecret, setPairingSecret] = useState('');
  const [showPairing, setShowPairing] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [backupRotation, setBackupRotation] = useState(0);
  const [backupCodes, setBackupCodes] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(BACKUP_CODES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Sessions & connected third-party OAuth apps (real current browser session only)
  const [sessions, setSessions] = useState<ActiveSession[]>(() => {
    try {
      const raw = localStorage.getItem(SESSIONS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ActiveSession[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return [buildCurrentBrowserSession()];
  });
  const [oauthApps, setOauthApps] = useState<ConnectedOAuthApp[]>(() => {
    try {
      const raw = localStorage.getItem(OAUTH_APPS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ConnectedOAuthApp[];
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });

  // Logs filter & simulator state
  const [logQuery, setLogQuery] = useState('');
  const [logStatusFilter, setLogStatusFilter] = useState<'ALL' | LogStatus>('ALL');
  const [attackLoading, setAttackLoading] = useState<string | null>(null);

  const toast = (msg: string) => showToast && showToast(msg);

  const cardClass = isDarkMode
    ? 'bg-[#26272B] border border-white/10 rounded-2xl'
    : 'bg-white border border-gray-200 rounded-2xl shadow-sm';
  const textColor = isDarkMode ? 'text-white' : 'text-[#202124]';
  const subText = isDarkMode ? 'text-white/60' : 'text-gray-500';
  const inputClass = isDarkMode
    ? 'bg-white/5 border-white/15 text-white placeholder:text-white/35 focus:border-[#8AB4F8]'
    : 'bg-gray-50 border-gray-200 text-[#202124] placeholder:text-gray-400 focus:border-[#1A73E8] focus:bg-white';

  useEffect(() => {
    try {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    } catch {
      // ignore storage errors
    }
  }, [sessions]);

  useEffect(() => {
    try {
      localStorage.setItem(OAUTH_APPS_KEY, JSON.stringify(oauthApps));
    } catch {
      // ignore storage errors
    }
  }, [oauthApps]);

  useEffect(() => {
    try {
      localStorage.setItem(BACKUP_CODES_KEY, JSON.stringify(backupCodes));
    } catch {
      // ignore storage errors
    }
  }, [backupCodes]);

  const loadLogs = async () => {
    setLoadingLogs(true);
    setLogs(await bridge.getAuditLogs());
    setLoadingLogs(false);
  };

  useEffect(() => {
    loadLogs();
    bridge.getSecurityState().then((s) => {
      setSecurity(s);
      if (s.mfaEnabled && backupCodes.length === 0) {
        setBackupCodes(generateBackupCodes(s.mfaSecret || 'WORKSPACE', 6));
      }
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showPairing) {
        setShowPairing(false);
        setVerificationCode('');
        setMfaError('');
        return;
      }
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showPairing, onClose]);

  const handleStartPairing = () => {
    const newSecret = bridge.generateMfaSecret();
    setPairingSecret(newSecret);
    setVerificationCode('');
    setMfaError('');
    setShowPairing(true);
  };

  const handleCancelPairing = () => {
    setShowPairing(false);
    setVerificationCode('');
    setMfaError('');
  };

  const handleToggleMfa = async (enable: boolean) => {
    if (!isValidSixDigitCode(verificationCode)) {
      setMfaError('Digite um código numérico de 6 dígitos do seu autenticador.');
      toast('Digite um código numérico de 6 dígitos do seu autenticador.');
      return;
    }
    const activeSecret = enable ? pairingSecret : security.mfaSecret;
    if (!verifyTotpCode(activeSecret, verificationCode)) {
      setMfaError('Código TOTP incorreto. Confira o código de 6 dígitos exibido no autenticador.');
      await bridge.logAudit(
        'MFA_VERIFICATION_FAILED',
        `Tentativa de ${enable ? 'ativação' : 'desativação'} de 2FA recusada por código TOTP inválido.`,
        'FAILURE'
      );
      loadLogs();
      toast('Código de verificação inválido.');
      return;
    }
    setMfaError('');
    const state = await bridge.setMfaEnabled(enable, enable ? pairingSecret : undefined);
    setSecurity(state);
    setVerificationCode('');
    setShowPairing(false);
    if (enable) {
      setBackupRotation(0);
      setBackupCodes(generateBackupCodes(pairingSecret, 6, 0));
      toast('Verificação em duas etapas (2FA) ativada com códigos de backup.');
    } else {
      setBackupCodes([]);
      toast('Verificação em duas etapas desativada.');
    }
    loadLogs();
  };

  const handleRegenerateBackupCodes = async () => {
    const nextRotation = backupRotation + 1;
    setBackupRotation(nextRotation);
    const nextCodes = generateBackupCodes(security.mfaSecret || 'WORKSPACE', 6, nextRotation);
    setBackupCodes(nextCodes);
    await bridge.logAudit(
      'BACKUP_CODES_REGENERATED',
      'Novos códigos de backup 2FA foram gerados e os anteriores invalidados.'
    );
    toast('Novos códigos de backup gerados.');
    loadLogs();
  };

  const handleCopyText = async (val: string, label: string) => {
    try {
      await navigator.clipboard.writeText(val);
      toast(`${label} copiado para a área de transferência.`);
    } catch {
      toast(`${label}: ${val}`);
    }
  };

  const handleDownloadBackupCodes = () => {
    const content = [
      'Google Workspace OS — Códigos de Backup (2FA)',
      `Conta: ${data?.user?.email || 'Modo local (sem conta conectada)'}`,
      `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
      '',
      ...backupCodes.map((c, idx) => `${idx + 1}. ${c}`),
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workspace-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
    toast('Códigos de backup baixados.');
  };

  const handleRevokeSession = async (session: ActiveSession) => {
    if (session.isCurrent) return;
    setSessions((prev) => revokeActiveSession(prev, session.id));
    await bridge.logAudit(
      'SESSION_REVOKED',
      `Sessão remota encerrada em ${session.deviceName} (${session.ipAddress}).`
    );
    toast(`Sessão em ${session.deviceName} encerrada.`);
    loadLogs();
  };

  const handleRevokeAllOtherSessions = async () => {
    const others = sessions.filter((s) => !s.isCurrent);
    if (others.length === 0) return;
    setSessions((prev) => revokeOtherSessions(prev));
    await bridge.logAudit(
      'SESSIONS_REVOKED_ALL',
      `${others.length} sessão(ões) externa(s) encerrada(s) remotamente.`
    );
    toast('Todas as outras sessões foram encerradas.');
    loadLogs();
  };

  const handleRevokeOAuthApp = async (app: ConnectedOAuthApp) => {
    setOauthApps((prev) => revokeOAuthGrant(prev, app.id));
    await bridge.logAudit(
      'OAUTH_REVOKED',
      `Acesso OAuth do aplicativo "${app.name}" foi revogado.`,
      'BLOCKED'
    );
    toast(`Acesso de ${app.name} revogado.`);
    loadLogs();
  };

  const handleSimulateAttack = async (type: string) => {
    setAttackLoading(type);
    await bridge.simulateAttack(type);
    await loadLogs();
    setAttackLoading(null);
    toast('Evento de segurança registrado no auditor de logs.');
  };

  const handleExportLogsCsv = () => {
    const csv = auditLogsToCsv(filteredLogs);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria-seguranca-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Exportado CSV com ${filteredLogs.length} registro(s).`);
  };

  const filteredLogs = useMemo(
    () => filterAuditLogs(logs, logQuery, logStatusFilter),
    [logs, logQuery, logStatusFilter]
  );

  const logCounts = useMemo(
    () => ({
      ALL: logs.length,
      SUCCESS: logs.filter((l) => l.status === 'SUCCESS').length,
      FAILURE: logs.filter((l) => l.status === 'FAILURE').length,
      BLOCKED: logs.filter((l) => l.status === 'BLOCKED').length,
    }),
    [logs]
  );

  const checklist = useMemo(
    () =>
      evaluateSecurityChecklist({
        mfaEnabled: security.mfaEnabled,
        activeSessionsCount: sessions.length,
        oauthAppsCount: oauthApps.length,
        blockedAttacksCount: logCounts.BLOCKED,
      }),
    [security.mfaEnabled, sessions.length, oauthApps.length, logCounts.BLOCKED]
  );

  const securityScore = useMemo(() => calculateSecurityScore(checklist), [checklist]);

  const handleChecklistAction = (itemId: string) => {
    if (itemId === 'chk_mfa') {
      handleStartPairing();
    } else if (itemId === 'chk_sessions') {
      handleRevokeAllOtherSessions();
    }
  };

  const attacks = [
    {
      type: 'unauthorized_calendar',
      label: 'Leitura Indevida Agenda',
      desc: 'Token inválido tentando ler eventos privados',
      accent: 'text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30',
    },
    {
      type: 'csrf_session',
      label: 'Sequestro de Sessão',
      desc: 'Requisição CSRF originada de IP externo',
      accent: 'text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
    },
    {
      type: 'sqli_malicious',
      label: 'Injeção SQL',
      desc: 'Payload malicioso em campo de notas',
      accent: 'text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30',
    },
  ];

  const previewTotpCode = showPairing
    ? derivePreviewTotpCode(pairingSecret)
    : security.mfaEnabled
    ? derivePreviewTotpCode(security.mfaSecret)
    : '';

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
          <GoogleIcons.Security className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-medium tracking-tight leading-tight truncate">
              Central de Segurança
            </h2>
            <p className={`hidden sm:block text-xs truncate ${subText}`}>
              Autenticação, dispositivos conectados, apps externos e auditoria
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {onOpenApp && (
            <button
              type="button"
              onClick={() => onOpenApp('permissions')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                isDarkMode
                  ? 'border-white/15 hover:bg-white/10 text-white'
                  : 'border-gray-200 hover:bg-gray-50 text-gray-700'
              }`}
            >
              <ExternalLink size={13} />
              <span className="hidden sm:inline">Permissões de Acesso</span>
              <span className="sm:hidden">Permissões</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar Central de Segurança"
            className={`p-2 rounded-full transition-colors ${
              isDarkMode ? 'hover:bg-white/10 text-white/70' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <X size={20} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-5 lg:p-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* Left Column (2FA + Checklist + Sessions + OAuth) */}
          <div className="lg:col-span-5 flex flex-col space-y-5">
            {/* Verificação em 2 Etapas */}
            <section className={`${cardClass} p-5`}>
              <div
                className={`mb-4 flex items-center justify-between border-b pb-3 ${
                  isDarkMode ? 'border-white/10' : 'border-gray-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Shield className="text-[#1A73E8]" size={18} />
                  <h3 className={`font-medium text-sm ${textColor}`}>
                    Verificação em duas etapas (2FA)
                  </h3>
                </div>
                <span
                  className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                    security.mfaEnabled
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {security.mfaEnabled ? 'ATIVA' : 'DESATIVADA'}
                </span>
              </div>

              {security.mfaEnabled ? (
                <div className="space-y-4">
                  <div
                    className={`p-3 rounded-xl border text-xs ${
                      isDarkMode
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    }`}
                  >
                    <p className="font-medium flex items-center gap-1.5">
                      <ShieldCheck size={15} /> Autenticador TOTP configurado
                    </p>
                    <p className="mt-1 opacity-80">
                      Códigos de backup disponíveis abaixo para recuperação de emergência.
                    </p>
                  </div>

                  {backupCodes.length > 0 && (
                    <div
                      className={`p-3 rounded-xl border ${
                        isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <span className={`text-[11px] font-semibold uppercase tracking-wide ${subText}`}>
                          Códigos de backup
                        </span>
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={handleRegenerateBackupCodes}
                            className="text-xs text-[#1A73E8] hover:underline flex items-center gap-1"
                          >
                            <RefreshCw size={11} /> Gerar novos
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyText(backupCodes.join('\n'), 'Códigos de backup')}
                            className="text-xs text-[#1A73E8] hover:underline flex items-center gap-1"
                          >
                            <Copy size={11} /> Copiar
                          </button>
                          <button
                            type="button"
                            onClick={handleDownloadBackupCodes}
                            className="text-xs text-[#1A73E8] hover:underline flex items-center gap-1"
                          >
                            <Download size={11} /> .txt
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 font-mono text-xs tabular-nums">
                        {backupCodes.map((code) => (
                          <div
                            key={code}
                            className={`px-2 py-1 rounded text-center border ${
                              isDarkMode ? 'bg-black/30 border-white/10' : 'bg-white border-gray-200'
                            }`}
                          >
                            {code}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className={`pt-2 border-t space-y-2 ${isDarkMode ? 'border-white/10' : 'border-gray-100'}`}>
                    <label htmlFor="mfa-disable-code" className={`block text-xs ${subText}`}>
                      Para desativar, informe o código atual (<strong className="font-mono">{previewTotpCode}</strong> no autenticador):
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        id="mfa-disable-code"
                        type="text"
                        maxLength={6}
                        placeholder="000000"
                        value={verificationCode}
                        onChange={(e) => {
                          setVerificationCode(e.target.value.replace(/\D/g, ''));
                          if (mfaError) setMfaError('');
                        }}
                        className={`flex-1 min-w-0 text-center tracking-[0.25em] font-mono text-sm font-semibold rounded-lg border px-3 py-2 outline-none ${inputClass}`}
                      />
                      <button
                        type="button"
                        disabled={!isValidSixDigitCode(verificationCode)}
                        onClick={() => handleToggleMfa(false)}
                        className="px-4 py-2 rounded-lg bg-[#EA4335] hover:bg-[#d93025] disabled:opacity-40 text-white text-xs font-medium whitespace-nowrap transition-colors"
                      >
                        Desativar 2FA
                      </button>
                    </div>
                    {mfaError && (
                      <p role="alert" className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                        {mfaError}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className={`${subText} text-xs leading-relaxed`}>
                    Proteja sua conta com verificação em duas etapas via Google Authenticator ou Authy.
                  </p>
                  {!showPairing ? (
                    <button
                      type="button"
                      onClick={handleStartPairing}
                      className="w-full rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white font-medium py-2.5 text-sm flex items-center justify-center gap-2 transition-colors"
                    >
                      <QrCode size={16} />
                      Emparelhar autenticador
                    </button>
                  ) : (
                    <div
                      className={`space-y-3 p-3.5 sm:p-4 rounded-xl border ${
                        isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start gap-3">
                        <SecretQrPreview secret={pairingSecret} />
                        <div className="min-w-0 w-full flex-1 space-y-1.5">
                          <span className={`text-[10px] uppercase tracking-wider font-bold block ${subText}`}>
                            Chave de configuração
                          </span>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <code
                              className={`font-mono text-xs font-semibold px-2 py-1 rounded border select-all truncate min-w-0 ${
                                isDarkMode ? 'bg-black/40 border-white/10 text-emerald-400' : 'bg-white border-gray-200 text-emerald-700'
                              }`}
                            >
                              {pairingSecret}
                            </code>
                            <button
                              type="button"
                              aria-label="Copiar chave secreta"
                              onClick={() => handleCopyText(pairingSecret, 'Chave secreta')}
                              className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 shrink-0"
                            >
                              <Copy size={13} />
                            </button>
                          </div>
                          <p className={`text-[11px] ${subText}`}>
                            Código de teste do autenticador: <strong className="font-mono">{previewTotpCode}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          aria-label="Código de 6 dígitos"
                          maxLength={6}
                          placeholder="Código de 6 dígitos"
                          value={verificationCode}
                          onChange={(e) => {
                            setVerificationCode(e.target.value.replace(/\D/g, ''));
                            if (mfaError) setMfaError('');
                          }}
                          className={`flex-1 min-w-0 text-center tracking-[0.25em] font-mono text-sm font-semibold rounded-lg border px-3 py-2 outline-none ${inputClass}`}
                        />
                        <div className="flex gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleMfa(true)}
                            disabled={!isValidSixDigitCode(verificationCode)}
                            className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] disabled:opacity-40 font-medium text-white text-xs whitespace-nowrap transition-colors"
                          >
                            Validar e ativar 2FA
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelPairing}
                            className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                              isDarkMode
                                ? 'border-white/15 hover:bg-white/10 text-white/80'
                                : 'border-gray-200 hover:bg-gray-100 text-gray-600'
                            }`}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                      {mfaError && (
                        <p role="alert" className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                          {mfaError}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Checklist de Postura de Segurança */}
            <section className={`${cardClass} p-4 sm:p-5`}>
              <div
                className={`mb-3 flex items-center justify-between gap-2 border-b pb-2.5 ${
                  isDarkMode ? 'border-white/10' : 'border-gray-100'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Lock className="text-[#1A73E8] shrink-0" size={17} />
                  <h3 className={`font-medium text-sm truncate ${textColor}`}>Checklist de Proteção</h3>
                </div>
                <span
                  className={`text-xs font-semibold tabular-nums shrink-0 ${
                    securityScore.percentage === 100
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-[#1A73E8]'
                  }`}
                >
                  {securityScore.passed}/{securityScore.total} ({securityScore.percentage}%)
                </span>
              </div>
              <div
                className={`w-full h-1.5 rounded-full overflow-hidden mb-3 ${
                  isDarkMode ? 'bg-white/10' : 'bg-gray-100'
                }`}
              >
                <div
                  className={`h-full transition-all duration-300 ${
                    securityScore.percentage === 100 ? 'bg-emerald-500' : 'bg-[#1A73E8]'
                  }`}
                  style={{ width: `${securityScore.percentage}%` }}
                />
              </div>
              <div className="space-y-2.5">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    className={`flex flex-wrap sm:flex-nowrap items-start justify-between gap-2.5 p-2.5 rounded-xl border ${
                      isDarkMode ? 'border-white/10 bg-white/[0.02]' : 'border-gray-100 bg-gray-50/70'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <CheckCircle2
                        size={16}
                        className={`shrink-0 mt-0.5 ${
                          item.passed ? 'text-emerald-500' : 'text-amber-500'
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium">{item.title}</p>
                        <p className={`text-[11px] ${subText} leading-snug`}>{item.description}</p>
                      </div>
                    </div>
                    {!item.passed && item.actionLabel && (
                      <button
                        type="button"
                        onClick={() => handleChecklistAction(item.id)}
                        className="px-2.5 py-1 rounded-md bg-[#1A73E8] hover:bg-[#1557B0] text-white text-[11px] font-medium shrink-0 transition-colors"
                      >
                        {item.actionLabel}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Sessões & Dispositivos Conectados */}
            <section className={`${cardClass} p-5`}>
              <div
                className={`mb-3 flex items-center justify-between border-b pb-2.5 ${
                  isDarkMode ? 'border-white/10' : 'border-gray-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Monitor className="text-[#1A73E8]" size={17} />
                  <h3 className={`font-medium text-sm ${textColor}`}>
                    Dispositivos Conectados ({sessions.length})
                  </h3>
                </div>
                {sessions.length > 1 && (
                  <button
                    type="button"
                    onClick={handleRevokeAllOtherSessions}
                    className="text-xs text-red-600 dark:text-red-400 hover:underline whitespace-nowrap"
                  >
                    Encerrar outras sessões
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {sessions.map((sess) => (
                  <div
                    key={sess.id}
                    className={`flex items-center justify-between gap-3 p-3 rounded-xl border text-xs ${
                      isDarkMode ? 'border-white/10 bg-white/[0.02]' : 'border-gray-100 bg-gray-50/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`p-2 rounded-lg shrink-0 ${isDarkMode ? 'bg-white/5' : 'bg-white border border-gray-200'}`}>
                        {sess.platform.includes('Android') ? <Smartphone size={15} /> : <Monitor size={15} />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {sess.deviceName}{' '}
                          {sess.isCurrent && (
                            <span className="ml-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              (Atual)
                            </span>
                          )}
                        </p>
                        <p className={`text-[11px] truncate ${subText}`}>
                          {sess.platform} · {sess.location}
                        </p>
                        <p className={`text-[10px] font-mono ${subText}`}>
                          {sess.ipAddress} · {sess.lastActive}
                        </p>
                      </div>
                    </div>
                    {!sess.isCurrent && (
                      <button
                        type="button"
                        onClick={() => handleRevokeSession(sess)}
                        aria-label={`Encerrar sessão ${sess.deviceName}`}
                        className="px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 text-[11px] font-medium flex items-center gap-1 shrink-0"
                      >
                        <LogOut size={12} /> Encerrar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right Column (OAuth Apps + Attack Simulator + Audit Log) */}
          <div className="lg:col-span-7 flex flex-col space-y-5">
            {/* Apps com Acesso OAuth */}
            <section className={`${cardClass} p-5`}>
              <div
                className={`mb-3 flex items-center justify-between border-b pb-2.5 ${
                  isDarkMode ? 'border-white/10' : 'border-gray-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Key className="text-[#1A73E8]" size={17} />
                  <div>
                    <h3 className={`font-medium text-sm ${textColor}`}>
                      Aplicativos Terceiros com Acesso OAuth ({oauthApps.length})
                    </h3>
                  </div>
                </div>
              </div>

              {oauthApps.length === 0 ? (
                <p className={`text-xs py-4 text-center ${subText}`}>
                  Nenhum aplicativo de terceiros com acesso ativo à sua conta.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {oauthApps.map((app) => (
                    <div
                      key={app.id}
                      className={`p-3 rounded-xl border text-xs flex flex-col justify-between gap-2 ${
                        isDarkMode ? 'border-white/10 bg-white/[0.02]' : 'border-gray-100 bg-gray-50/70'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm">{app.name}</span>
                          <span className={`text-[10px] ${subText}`}>{app.grantedAt}</span>
                        </div>
                        <p className={`text-[11px] ${subText} mb-1.5`}>{app.developer}</p>
                        <ul className="space-y-0.5 text-[11px]">
                          {app.scopes.map((sc) => (
                            <li key={sc} className={subText}>
                              • {sc}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRevokeOAuthApp(app)}
                        className="self-start px-2.5 py-1 rounded-md border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 text-[11px] font-medium"
                      >
                        Revogar acesso
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Simulador de Testes de Segurança */}
            <section className={`${cardClass} p-5`}>
              <div
                className={`flex items-center justify-between border-b pb-3 mb-3 ${
                  isDarkMode ? 'border-white/10' : 'border-gray-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Terminal className="text-[#1A73E8]" size={17} />
                  <div>
                    <h3 className={`font-medium text-sm ${textColor}`}>Teste de Defesa & Auditoria</h3>
                    <p className={`text-[11px] ${subText}`}>
                      Simule tentativas anômalas para validar o registro imediato no log de auditoria
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {attacks.map((atk) => (
                  <button
                    key={atk.type}
                    type="button"
                    onClick={() => handleSimulateAttack(atk.type)}
                    disabled={attackLoading !== null}
                    className={`rounded-xl border p-3.5 text-left transition-colors flex flex-col justify-between gap-2 ${
                      isDarkMode ? 'bg-white/[0.02] hover:bg-white/5' : 'bg-gray-50/70 hover:bg-gray-100'
                    } ${atk.accent}`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold mb-1">
                        <AlertTriangle size={13} />
                        <span>{atk.label}</span>
                      </div>
                      <p className={`text-[11px] ${subText} leading-snug`}>{atk.desc}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium">
                      <Play size={10} />
                      {attackLoading === atk.type ? 'Executando...' : 'Simular bloqueio'}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {/* Auditor de Transações & Logs */}
            <section className={`${cardClass} p-5 flex flex-col flex-1 min-h-[340px]`}>
              <div
                className={`flex flex-wrap items-center justify-between gap-3 border-b pb-3 mb-3 ${
                  isDarkMode ? 'border-white/10' : 'border-gray-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Activity className="text-emerald-500" size={18} />
                  <div>
                    <h3 className={`font-medium text-sm ${textColor}`}>Auditor de Logs</h3>
                    <p className={`text-[11px] ${subText}`}>
                      Histórico completo de acessos, alterações e bloqueios
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleExportLogsCsv}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 ${
                      isDarkMode
                        ? 'border-white/15 hover:bg-white/10 text-white'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <Download size={13} /> Exportar CSV
                  </button>
                  <button
                    type="button"
                    onClick={loadLogs}
                    disabled={loadingLogs}
                    aria-label="Atualizar logs"
                    className={`p-1.5 rounded-lg border transition-colors ${
                      isDarkMode
                        ? 'border-white/15 hover:bg-white/10 text-white/70'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                    }`}
                  >
                    <RefreshCw size={14} className={loadingLogs ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {/* Filter Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-1 overflow-x-auto max-w-full">
                  {(
                    [
                      { id: 'ALL', label: 'Todos', count: logCounts.ALL },
                      { id: 'SUCCESS', label: 'Sucesso', count: logCounts.SUCCESS },
                      { id: 'FAILURE', label: 'Falha', count: logCounts.FAILURE },
                      { id: 'BLOCKED', label: 'Bloqueado', count: logCounts.BLOCKED },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setLogStatusFilter(tab.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 tabular-nums transition-colors ${
                        logStatusFilter === tab.id
                          ? isDarkMode
                            ? 'bg-[#8AB4F8]/20 text-[#8AB4F8]'
                            : 'bg-[#E8F0FE] text-[#174EA6]'
                          : `${subText} hover:bg-black/5`
                      }`}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  ))}
                </div>

                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs w-full sm:w-auto ${
                    isDarkMode ? 'border-white/15 bg-white/5' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <Search size={12} className={`${subText} shrink-0`} />
                  <input
                    type="text"
                    aria-label="Filtrar logs"
                    placeholder="Buscar ação ou IP..."
                    value={logQuery}
                    onChange={(e) => setLogQuery(e.target.value)}
                    className="bg-transparent outline-none flex-1 sm:w-36 min-w-0 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-2 overflow-y-auto custom-scrollbar max-h-[340px] pr-1">
                {filteredLogs.length === 0 ? (
                  <div className={`text-center py-10 text-xs ${subText}`}>
                    Nenhum registro encontrado para os filtros aplicados.
                  </div>
                ) : (
                  filteredLogs.map((log) => {
                    const statusStyle =
                      log.status === 'BLOCKED'
                        ? 'bg-rose-500/10 border-rose-500/25 text-rose-600 dark:text-rose-400'
                        : log.status === 'FAILURE'
                        ? 'bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-300'
                        : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-400';
                    return (
                      <div
                        key={log.id}
                        className={`border rounded-xl p-3 text-xs transition-colors ${
                          isDarkMode
                            ? 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
                            : 'border-gray-100 bg-gray-50/60 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-mono font-bold border ${statusStyle}`}
                          >
                            {log.action}
                          </span>
                          <span className={`text-[11px] tabular-nums ${subText}`}>
                            {new Date(log.timestamp).toLocaleTimeString('pt-BR')} ·{' '}
                            {new Date(log.timestamp).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <p className={`${textColor} text-xs leading-relaxed mb-1`}>{log.details}</p>
                        <div className={`flex flex-wrap justify-between items-center text-[10px] ${subText}`}>
                          <span className="font-mono">IP: {log.ipAddress}</span>
                          <span className="font-semibold">STATUS: {log.status}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
