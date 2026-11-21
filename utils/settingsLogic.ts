export interface WorkspaceNotificationSettings {
  emailPriority: boolean;
  calendarInvites: boolean;
  tasksReminders: boolean;
  meetCalls: boolean;
  soundEffects: boolean;
  doNotDisturb: boolean;
}

export interface WorkspacePrivacySettings {
  sessionLockOnIdle: boolean;
  activityAuditLog: boolean;
  telemetryEnabled: boolean;
  maskSensitivePreviews: boolean;
  historyRetentionDays: 30 | 90 | 365;
}

export type WorkspaceLanguage = 'pt-BR' | 'en-US' | 'es-ES';
export type WorkspaceTimezone = 'America/Sao_Paulo' | 'America/New_York' | 'Europe/Lisbon' | 'UTC';
export type WorkspaceDensity = 'comfortable' | 'compact';

export interface WorkspaceUserSettings {
  displayName: string;
  lastPasswordChange: string;
  storagePlanGb: 15 | 100 | 2000;
  language: WorkspaceLanguage;
  timezone: WorkspaceTimezone;
  density: WorkspaceDensity;
  notifications: WorkspaceNotificationSettings;
  privacy: WorkspacePrivacySettings;
}

export const WORKSPACE_SETTINGS_KEY = 'workspace_user_settings_v1';

export const DEFAULT_USER_SETTINGS: WorkspaceUserSettings = {
  displayName: 'Usuário',
  lastPasswordChange: '2026-08-15',
  storagePlanGb: 15,
  language: 'pt-BR',
  timezone: 'America/Sao_Paulo',
  density: 'comfortable',
  notifications: {
    emailPriority: true,
    calendarInvites: true,
    tasksReminders: true,
    meetCalls: true,
    soundEffects: true,
    doNotDisturb: false,
  },
  privacy: {
    sessionLockOnIdle: true,
    activityAuditLog: true,
    telemetryEnabled: false,
    maskSensitivePreviews: false,
    historyRetentionDays: 90,
  },
};

export function parseUserSettings(raw: string | null): WorkspaceUserSettings {
  if (!raw) return structuredClone(DEFAULT_USER_SETTINGS);
  try {
    const parsed = JSON.parse(raw);
    return {
      displayName: typeof parsed.displayName === 'string' && parsed.displayName.trim()
        ? parsed.displayName
        : DEFAULT_USER_SETTINGS.displayName,
      lastPasswordChange:
        typeof parsed.lastPasswordChange === 'string'
          ? parsed.lastPasswordChange
          : DEFAULT_USER_SETTINGS.lastPasswordChange,
      storagePlanGb: [15, 100, 2000].includes(parsed.storagePlanGb) ? parsed.storagePlanGb : 15,
      language: ['pt-BR', 'en-US', 'es-ES'].includes(parsed.language)
        ? parsed.language
        : DEFAULT_USER_SETTINGS.language,
      timezone: ['America/Sao_Paulo', 'America/New_York', 'Europe/Lisbon', 'UTC'].includes(parsed.timezone)
        ? parsed.timezone
        : DEFAULT_USER_SETTINGS.timezone,
      density: ['comfortable', 'compact'].includes(parsed.density)
        ? parsed.density
        : DEFAULT_USER_SETTINGS.density,
      notifications: {
        ...DEFAULT_USER_SETTINGS.notifications,
        ...(parsed.notifications || {}),
      },
      privacy: {
        ...DEFAULT_USER_SETTINGS.privacy,
        ...(parsed.privacy || {}),
        historyRetentionDays: [30, 90, 365].includes(parsed?.privacy?.historyRetentionDays)
          ? parsed.privacy.historyRetentionDays
          : DEFAULT_USER_SETTINGS.privacy.historyRetentionDays,
      },
    };
  } catch {
    return structuredClone(DEFAULT_USER_SETTINGS);
  }
}

export function exportSettingsJson(settings: WorkspaceUserSettings): string {
  return JSON.stringify(settings, null, 2);
}

export function resetUserSettings(displayName?: string): WorkspaceUserSettings {
  const fresh = structuredClone(DEFAULT_USER_SETTINGS);
  if (displayName && displayName.trim()) {
    fresh.displayName = displayName.trim();
  }
  return fresh;
}

export interface StorageBreakdownCategory {
  id: 'drive' | 'docs' | 'gmail' | 'media';
  label: string;
  usedGb: number;
  color: string;
}

export function computeWorkspaceStorageStats(
  files: Array<{ type?: string; sizeBytes?: number; trashed?: boolean }> = [],
  emailsCount: number = 0,
  planGb: number = 15
): {
  totalUsedGb: number;
  planGb: number;
  percentUsed: number;
  categories: StorageBreakdownCategory[];
} {
  let docsMb = 0;
  let mediaMb = 0;
  let driveMb = 0;

  for (const f of files) {
    if (f.trashed) continue;
    const mb = typeof f.sizeBytes === 'number' && f.sizeBytes > 0 ? f.sizeBytes / (1024 * 1024) : 1.5;
    if (f.type === 'doc' || f.type === 'sheet' || f.type === 'slide') {
      docsMb += mb;
    } else if (f.type === 'image' || f.type === 'video') {
      mediaMb += mb;
    } else {
      driveMb += mb;
    }
  }

  // Baseline realistic workspace sync footprint + items
  const driveGb = Number((driveMb / 1024 + 4.2).toFixed(2));
  const docsGb = Number((docsMb / 1024 + 2.8).toFixed(2));
  const mediaGb = Number((mediaMb / 1024 + 3.1).toFixed(2));
  const gmailGb = Number((Math.max(1, emailsCount) * 0.14).toFixed(2));

  const totalUsedGb = Number((driveGb + docsGb + mediaGb + gmailGb).toFixed(2));
  const safePlan = Math.max(1, planGb);
  const percentUsed = Math.min(100, Math.round((totalUsedGb / safePlan) * 100));

  return {
    totalUsedGb,
    planGb: safePlan,
    percentUsed,
    categories: [
      { id: 'drive', label: 'Google Drive & PDFs', usedGb: driveGb, color: '#1A73E8' },
      { id: 'docs', label: 'Docs, Planilhas e Slides', usedGb: docsGb, color: '#059669' },
      { id: 'media', label: 'Mídia & Backups', usedGb: mediaGb, color: '#D97706' },
      { id: 'gmail', label: 'Gmail & Anexos', usedGb: gmailGb, color: '#EA4335' },
    ],
  };
}

export function clearTransientWorkspaceCache(
  storage: { length: number; key: (index: number) => string | null; removeItem: (key: string) => void },
  preserveKeys: string[] = [WORKSPACE_SETTINGS_KEY, 'workspace_nickname', 'workspace_theme']
): number {
  const toRemove: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const k = storage.key(i);
    if (k && k.startsWith('workspace_') && !preserveKeys.includes(k)) {
      toRemove.push(k);
    }
  }
  for (const k of toRemove) {
    storage.removeItem(k);
  }
  return toRemove.length;
}
