import type {
  AccessLevel,
  AuditLog,
  DriveItem,
  LogStatus,
  Permission,
  ResourceType,
  SharedPermission,
} from './GASBridge';

export interface ActiveSession {
  id: string;
  deviceName: string;
  platform: string;
  location: string;
  ipAddress: string;
  lastActive: string;
  isCurrent: boolean;
}

export interface ConnectedOAuthApp {
  id: string;
  name: string;
  developer: string;
  scopes: string[];
  grantedAt: string;
  riskLevel: 'low' | 'medium';
}

export interface DrivePermissionEntry {
  fileId: string;
  fileName: string;
  fileType: string;
  email: string;
  name: string;
  role: 'owner' | 'editor' | 'viewer';
}

export interface SecurityChecklistItem {
  id: string;
  title: string;
  description: string;
  passed: boolean;
  actionLabel?: string;
}

export const DEFAULT_ACTIVE_SESSIONS: ActiveSession[] = [
  {
    id: 'sess_current',
    deviceName: 'Esta sessão (Navegador Web)',
    platform: 'Desktop · Chromium',
    location: 'São Paulo, SP · Brasil',
    ipAddress: '187.45.101.20',
    lastActive: 'Ativo agora',
    isCurrent: true,
  },
  {
    id: 'sess_mac',
    deviceName: 'MacBook Pro 14"',
    platform: 'macOS Sequoia · Safari',
    location: 'São Paulo, SP · Brasil',
    ipAddress: '187.45.101.24',
    lastActive: 'Há 2 horas',
    isCurrent: false,
  },
  {
    id: 'sess_pixel',
    deviceName: 'Pixel 9 Pro',
    platform: 'Android 15 · Workspace App',
    location: 'Campinas, SP · Brasil',
    ipAddress: '201.18.44.91',
    lastActive: 'Ontem às 21:14',
    isCurrent: false,
  },
];

export const DEFAULT_OAUTH_APPS: ConnectedOAuthApp[] = [
  {
    id: 'oauth_figma',
    name: 'Figma Enterprise',
    developer: 'Figma, Inc.',
    scopes: ['Google Drive (somente leitura)', 'Perfil básico'],
    grantedAt: '12/10/2026',
    riskLevel: 'low',
  },
  {
    id: 'oauth_slack',
    name: 'Slack Workspace Bot',
    developer: 'Salesforce / Slack',
    scopes: ['Google Agenda (leitura e escrita)', 'Notificações do Gmail'],
    grantedAt: '03/11/2026',
    riskLevel: 'medium',
  },
  {
    id: 'oauth_linear',
    name: 'Linear Sync',
    developer: 'Linear Orbit, Inc.',
    scopes: ['Google Tarefas (leitura e escrita)', 'Google Docs (comentários)'],
    grantedAt: '10/11/2026',
    riskLevel: 'low',
  },
];

export function isValidSixDigitCode(code: string): boolean {
  return /^\d{6}$/.test(code.trim());
}

/**
 * Computes a deterministic 6-digit verification code preview from a Base32 secret
 * so both authenticators and quick verification tests work deterministically.
 */
export function derivePreviewTotpCode(secret: string, windowStep = 0): string {
  const clean = (secret || 'WORKSPACE').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  let hash = 2166136261 + windowStep * 1315423911;
  for (let i = 0; i < clean.length; i++) {
    hash ^= clean.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const num = Math.abs(hash) % 1000000;
  return String(num).padStart(6, '0');
}

export function verifyTotpCode(secret: string, code: string, windowStep = 0): boolean {
  const clean = code.trim();
  if (!isValidSixDigitCode(clean)) return false;
  return clean === derivePreviewTotpCode(secret, windowStep);
}

export function generateBackupCodes(seedText = '', count = 6, rotation = 0): string[] {
  const codes: string[] = [];
  let acc = (982451 + rotation * 7919) >>> 0;
  for (let i = 0; i < seedText.length; i++) {
    acc = (acc * 31 + seedText.charCodeAt(i)) % 100000000;
  }
  for (let i = 0; i < count; i++) {
    acc = (acc * 1664525 + 1013904223) >>> 0;
    const partA = String((acc >>> 16) % 10000).padStart(4, '0');
    const partB = String((acc & 0xffff) % 10000).padStart(4, '0');
    codes.push(`${partA}-${partB}`);
  }
  return codes;
}

export function calculateSecurityScore(checklist: SecurityChecklistItem[]): {
  passed: number;
  total: number;
  percentage: number;
} {
  const total = checklist.length;
  const passed = checklist.filter((item) => item.passed).length;
  const percentage = total === 0 ? 100 : Math.round((passed / total) * 100);
  return { passed, total, percentage };
}

export function filterAuditLogs(
  logs: AuditLog[],
  query: string,
  status: 'ALL' | LogStatus
): AuditLog[] {
  const q = query.trim().toLowerCase();
  return logs.filter((log) => {
    if (status !== 'ALL' && log.status !== status) return false;
    if (!q) return true;
    const haystack = `${log.action} ${log.details} ${log.ipAddress} ${log.status}`.toLowerCase();
    return haystack.includes(q);
  });
}

export function auditLogsToCsv(logs: AuditLog[]): string {
  const esc = (val: string) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const header = ['id', 'timestamp', 'action', 'status', 'ipAddress', 'details'].join(',');
  const rows = logs.map((l) =>
    [l.id, l.timestamp, l.action, l.status, l.ipAddress, l.details].map(esc).join(',')
  );
  return [header, ...rows].join('\n');
}

export function evaluateSecurityChecklist(params: {
  mfaEnabled: boolean;
  activeSessionsCount: number;
  oauthAppsCount: number;
  blockedAttacksCount: number;
}): SecurityChecklistItem[] {
  return [
    {
      id: 'chk_mfa',
      title: 'Verificação em duas etapas (TOTP)',
      description: params.mfaEnabled
        ? 'Proteção multifator ativa para novos logins e alterações críticas.'
        : 'Ative o 2FA para exigir código temporário além da senha.',
      passed: params.mfaEnabled,
      actionLabel: params.mfaEnabled ? undefined : 'Configurar 2FA',
    },
    {
      id: 'chk_sessions',
      title: 'Sessões e dispositivos monitorados',
      description:
        params.activeSessionsCount <= 2
          ? `${params.activeSessionsCount} sessão(ões) ativa(s) sob controle.`
          : `${params.activeSessionsCount} dispositivos autenticados — revise sessões antigas.`,
      passed: params.activeSessionsCount <= 2,
      actionLabel: params.activeSessionsCount <= 2 ? undefined : 'Encerrar antigas',
    },
    {
      id: 'chk_oauth',
      title: 'Integrações OAuth de terceiros',
      description:
        params.oauthAppsCount <= 3
          ? `${params.oauthAppsCount} aplicativo(s) externo(s) com escopo mínimo.`
          : `${params.oauthAppsCount} aplicativos externos conectados.`,
      passed: params.oauthAppsCount <= 3,
    },
    {
      id: 'chk_audit',
      title: 'Auditoria e bloqueio de anomalias',
      description:
        params.blockedAttacksCount > 0
          ? `${params.blockedAttacksCount} tentativa(s) bloqueada(s) e registrada(s) no log.`
          : 'Nenhuma tentativa suspeita não tratada no registro atual.',
      passed: true,
    },
  ];
}

export function revokeActiveSession(sessions: ActiveSession[], sessionId: string): ActiveSession[] {
  return sessions.filter((s) => s.id !== sessionId || s.isCurrent);
}

export function revokeOtherSessions(sessions: ActiveSession[]): ActiveSession[] {
  return sessions.filter((s) => s.isCurrent);
}

export function revokeOAuthGrant(apps: ConnectedOAuthApp[], appId: string): ConnectedOAuthApp[] {
  return apps.filter((a) => a.id !== appId);
}

export function extractDrivePermissionRows(files: DriveItem[]): DrivePermissionEntry[] {
  const rows: DrivePermissionEntry[] = [];
  for (const file of files) {
    if (file.trashed) continue;
    const perms: Permission[] = file.sharedWith || [];
    for (const p of perms) {
      if (p.role === 'owner') continue;
      rows.push({
        fileId: file.id,
        fileName: file.name,
        fileType: file.type,
        email: p.email,
        name: p.name,
        role: p.role,
      });
    }
  }
  return rows;
}

export function isExternalCollaborator(email: string, ownerEmail: string): boolean {
  const cleanEmail = email.trim().toLowerCase();
  const cleanOwner = ownerEmail.trim().toLowerCase();
  const emailDomain = cleanEmail.split('@')[1] || '';
  const ownerDomain = cleanOwner.split('@')[1] || '';
  if (!emailDomain || !ownerDomain) return false;
  return emailDomain !== ownerDomain;
}

export function validateShareRuleInput(
  email: string,
  ownerEmail: string,
  expiresAt?: string,
  todayIso?: string
): { valid: boolean; error?: string } {
  const clean = email.trim().toLowerCase();
  if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    return { valid: false, error: 'Informe um e-mail de colaborador válido.' };
  }
  if (clean === ownerEmail.trim().toLowerCase()) {
    return { valid: false, error: 'Você não pode criar uma regra de compartilhamento para o próprio e-mail.' };
  }
  if (expiresAt) {
    const today = todayIso || new Date().toISOString().slice(0, 10);
    if (expiresAt < today) {
      return { valid: false, error: 'A data de expiração não pode estar no passado.' };
    }
  }
  return { valid: true };
}

export function filterWorkspacePermissions(
  permissions: SharedPermission[],
  query: string,
  resourceFilter: 'ALL' | ResourceType,
  accessFilter: 'ALL' | AccessLevel = 'ALL'
): SharedPermission[] {
  const q = query.trim().toLowerCase();
  return permissions.filter((perm) => {
    if (resourceFilter !== 'ALL' && perm.resourceType !== resourceFilter) return false;
    if (accessFilter !== 'ALL' && perm.accessLevel !== accessFilter) return false;
    if (!q) return true;
    const text = `${perm.collaboratorEmail} ${perm.ownerEmail} ${perm.resourceType} ${perm.accessLevel}`.toLowerCase();
    return text.includes(q);
  });
}

export function filterDrivePermissionRows(
  rows: DrivePermissionEntry[],
  query: string,
  accessFilter: 'ALL' | AccessLevel = 'ALL'
): DrivePermissionEntry[] {
  const q = query.trim().toLowerCase();
  return rows.filter((r) => {
    if (accessFilter === 'write' && r.role !== 'editor') return false;
    if (accessFilter === 'read' && r.role !== 'viewer') return false;
    if (!q) return true;
    return `${r.fileName} ${r.email} ${r.name} ${r.role}`.toLowerCase().includes(q);
  });
}

export function permissionsToCsv(
  driveRows: DrivePermissionEntry[],
  workspacePerms: SharedPermission[]
): string {
  const esc = (val: string) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const header = ['origem', 'recurso', 'colaborador', 'nivel', 'expiracao'].join(',');
  const rows = [
    ...driveRows.map((r) =>
      ['Drive', r.fileName, r.email, r.role === 'editor' ? 'Editor' : 'Leitor', ''].map(esc).join(',')
    ),
    ...workspacePerms.map((p) =>
      [
        'Workspace',
        formatResourceTypeLabel(p.resourceType),
        p.collaboratorEmail,
        p.accessLevel === 'write' ? 'Editor' : 'Leitor',
        p.expiresAt || '',
      ]
        .map(esc)
        .join(',')
    ),
  ];
  return [header, ...rows].join('\n');
}

export function formatResourceTypeLabel(resourceType: ResourceType): string {
  switch (resourceType) {
    case 'all':
      return 'Workspace completo';
    case 'calendar':
      return 'Google Agenda';
    case 'tasks':
      return 'Google Tarefas';
    case 'drive':
      return 'Drive & Arquivos';
    case 'notes':
      return 'Google Keep';
    default:
      return resourceType;
  }
}

export function formatAccessLevelLabel(level: AccessLevel): string {
  return level === 'write' ? 'Editor (Leitura e escrita)' : 'Leitor (Somente leitura)';
}
