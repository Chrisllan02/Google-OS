export type MailFolderId =
  | 'inbox'
  | 'starred'
  | 'snoozed'
  | 'important'
  | 'sent'
  | 'scheduled'
  | 'drafts'
  | 'spam'
  | 'trash'
  | 'all'
  | string;

export type InboxCategory = 'all' | 'primary' | 'promotions' | 'social' | 'updates';

export interface EmailAttachmentItem {
  id?: string | number;
  name: string;
  size: string;
  mimeType?: string;
  data?: string;
}

export interface EmailThreadMessage {
  id: string;
  from: string;
  fromEmail?: string;
  senderInit?: string;
  to: string;
  cc?: string;
  date: string;
  body: string;
  plainBody?: string;
  attachments?: EmailAttachmentItem[];
}

export interface EmailItem {
  id: string;
  threadId?: string;
  sender: string;
  senderInit: string;
  senderEmail?: string;
  to?: string;
  cc?: string;
  bcc?: string;
  subject: string;
  preview: string;
  body?: string;
  time: string;
  color?: string;
  folder: string;
  category?: 'primary' | 'promotions' | 'social' | 'updates';
  read: boolean;
  isStarred?: boolean;
  isImportant?: boolean;
  isPinned?: boolean;
  isMuted?: boolean;
  hasAttachment?: boolean;
  labels?: string[];
  snoozedUntil?: string;
  scheduledFor?: string;
  attachments?: EmailAttachmentItem[];
  messages?: EmailThreadMessage[];
}

export interface MailFilterCriteria {
  from?: string;
  to?: string;
  subject?: string;
  hasAttachment?: boolean;
  unreadOnly?: boolean;
}

export interface MailAutoFilterRule {
  id: string;
  from?: string;
  subject?: string;
  hasAttachment?: boolean;
  applyLabelId?: string;
  markImportant?: boolean;
  markStarred?: boolean;
  archiveImmediately?: boolean;
}

export interface MailLabel {
  id: string;
  name: string;
  colorClass: string;
}

export function parseGmailSearchTokens(rawQuery: string): {
  from?: string;
  to?: string;
  subject?: string;
  inFolder?: string;
  hasAttachment?: boolean;
  isUnread?: boolean;
  isRead?: boolean;
  isStarred?: boolean;
  isImportant?: boolean;
  isMuted?: boolean;
  label?: string;
  freeText: string[];
} {
  const result: {
    from?: string;
    to?: string;
    subject?: string;
    inFolder?: string;
    hasAttachment?: boolean;
    isUnread?: boolean;
    isRead?: boolean;
    isStarred?: boolean;
    isImportant?: boolean;
    isMuted?: boolean;
    label?: string;
    freeText: string[];
  } = { freeText: [] };

  const tokens = rawQuery.trim().split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (lower.startsWith('from:')) {
      result.from = lower.slice(5);
    } else if (lower.startsWith('to:')) {
      result.to = lower.slice(3);
    } else if (lower.startsWith('subject:')) {
      result.subject = lower.slice(8);
    } else if (lower.startsWith('in:')) {
      result.inFolder = lower.slice(3);
    } else if (lower === 'has:attachment') {
      result.hasAttachment = true;
    } else if (lower === 'is:unread') {
      result.isUnread = true;
    } else if (lower === 'is:read') {
      result.isRead = true;
    } else if (lower === 'is:starred') {
      result.isStarred = true;
    } else if (lower === 'is:important') {
      result.isImportant = true;
    } else if (lower === 'is:muted') {
      result.isMuted = true;
    } else if (lower.startsWith('label:')) {
      result.label = lower.slice(6);
    } else {
      result.freeText.push(lower);
    }
  }
  return result;
}

export function filterEmails(
  emails: EmailItem[],
  options: {
    folder: MailFolderId;
    category?: InboxCategory;
    searchQuery?: string;
    criteria?: MailFilterCriteria;
    labels?: MailLabel[];
  }
): EmailItem[] {
  const { folder, category = 'all', searchQuery = '', criteria, labels = [] } = options;
  const parsed = parseGmailSearchTokens(searchQuery);
  const effectiveFolder: MailFolderId = parsed.inFolder
    ? parsed.inFolder === 'anywhere'
      ? 'anywhere'
      : parsed.inFolder
    : folder;
  const hasActiveSearch =
    Boolean(searchQuery.trim()) ||
    Boolean(criteria?.from?.trim()) ||
    Boolean(criteria?.to?.trim()) ||
    Boolean(criteria?.subject?.trim()) ||
    Boolean(criteria?.hasAttachment) ||
    Boolean(criteria?.unreadOnly);

  const filtered = emails.filter((email) => {
    if (effectiveFolder === 'anywhere') {
      // Search across all folders including trash and spam
    } else if (effectiveFolder === 'inbox') {
      if (email.folder !== 'inbox') return false;
      if (!hasActiveSearch && email.isMuted) return false;
      if (!hasActiveSearch && category !== 'all') {
        const emailCat = email.category || 'primary';
        if (emailCat !== category) return false;
      }
    } else if (effectiveFolder === 'starred') {
      if (!email.isStarred || email.folder === 'trash' || email.folder === 'spam') return false;
    } else if (effectiveFolder === 'important') {
      if (!email.isImportant || email.folder === 'trash' || email.folder === 'spam') return false;
    } else if (effectiveFolder === 'snoozed') {
      if (email.folder !== 'snoozed' && !email.snoozedUntil) return false;
    } else if (effectiveFolder === 'sent') {
      if (email.folder !== 'sent') return false;
    } else if (effectiveFolder === 'scheduled') {
      if (email.folder !== 'scheduled') return false;
    } else if (effectiveFolder === 'drafts') {
      if (email.folder !== 'drafts') return false;
    } else if (effectiveFolder === 'spam') {
      if (email.folder !== 'spam') return false;
    } else if (effectiveFolder === 'trash') {
      if (email.folder !== 'trash') return false;
    } else if (effectiveFolder === 'all') {
      if (email.folder === 'trash' || email.folder === 'spam') return false;
    } else if (effectiveFolder.startsWith('label_')) {
      if (email.folder === 'trash' || email.folder === 'spam') return false;
      if (!(email.labels || []).includes(effectiveFolder)) return false;
    }

    const fromFilter = (criteria?.from || parsed.from || '').trim().toLowerCase();
    if (fromFilter) {
      const senderMatch =
        email.sender.toLowerCase().includes(fromFilter) ||
        (email.senderEmail || '').toLowerCase().includes(fromFilter);
      if (!senderMatch) return false;
    }

    const toFilter = (criteria?.to || parsed.to || '').trim().toLowerCase();
    if (toFilter) {
      const toMatch = (email.to || '').toLowerCase().includes(toFilter);
      if (!toMatch) return false;
    }

    const subjectFilter = (criteria?.subject || parsed.subject || '').trim().toLowerCase();
    if (subjectFilter) {
      if (!email.subject.toLowerCase().includes(subjectFilter)) return false;
    }

    if (criteria?.hasAttachment || parsed.hasAttachment) {
      if (!email.hasAttachment && !(email.attachments && email.attachments.length > 0)) return false;
    }

    if (criteria?.unreadOnly || parsed.isUnread) {
      if (email.read) return false;
    }

    if (parsed.isRead && !email.read) return false;
    if (parsed.isStarred && !email.isStarred) return false;
    if (parsed.isImportant && !email.isImportant) return false;
    if (parsed.isMuted && !email.isMuted) return false;

    if (parsed.label) {
      const labelNames = (email.labels || []).map((id) => {
        const found = labels.find((l) => l.id === id);
        return (found ? found.name : id).toLowerCase();
      });
      if (!labelNames.some((n) => n.includes(parsed.label!))) return false;
    }

    if (parsed.freeText.length > 0) {
      const haystack = [
        email.sender,
        email.senderEmail || '',
        email.subject,
        email.preview,
        email.body || '',
        ...(email.messages || []).map((m) => `${m.from} ${m.body}`),
      ]
        .join(' ')
        .toLowerCase();

      for (const term of parsed.freeText) {
        if (!haystack.includes(term)) return false;
      }
    }

    return true;
  });

  // Sort pinned emails first while preserving relative order
  return [...filtered].sort((a, b) => {
    const pinDiff = (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
    if (pinDiff !== 0) return pinDiff;
    return 0;
  });
}

export type BatchEmailAction =
  | 'archive'
  | 'trash'
  | 'spam'
  | 'restore'
  | 'delete_forever'
  | 'read'
  | 'unread'
  | 'star'
  | 'unstar'
  | 'important'
  | 'unimportant'
  | 'pin'
  | 'unpin'
  | 'mute'
  | 'unmute'
  | 'snooze'
  | 'add_label'
  | 'remove_label';

export function applyBatchEmailAction(
  emails: EmailItem[],
  targetIds: Array<string | number>,
  action: BatchEmailAction,
  payload?: { snoozedUntil?: string; labelId?: string }
): EmailItem[] {
  const idSet = new Set(targetIds.map(String));

  if (action === 'delete_forever') {
    return emails.filter((e) => !idSet.has(String(e.id)));
  }

  return emails.map((email) => {
    if (!idSet.has(String(email.id))) return email;

    switch (action) {
      case 'archive':
        return { ...email, folder: 'all', snoozedUntil: undefined };
      case 'trash':
        return { ...email, folder: 'trash', snoozedUntil: undefined };
      case 'spam':
        return { ...email, folder: 'spam', snoozedUntil: undefined };
      case 'restore':
        return { ...email, folder: 'inbox', isMuted: false, snoozedUntil: undefined };
      case 'read':
        return { ...email, read: true };
      case 'unread':
        return { ...email, read: false };
      case 'star':
        return { ...email, isStarred: true };
      case 'unstar':
        return { ...email, isStarred: false };
      case 'important':
        return { ...email, isImportant: true };
      case 'unimportant':
        return { ...email, isImportant: false };
      case 'pin':
        return { ...email, isPinned: true };
      case 'unpin':
        return { ...email, isPinned: false };
      case 'mute':
        return { ...email, isMuted: true };
      case 'unmute':
        return { ...email, isMuted: false };
      case 'snooze':
        return {
          ...email,
          folder: 'snoozed',
          snoozedUntil: payload?.snoozedUntil || 'Amanhã, 08:00',
        };
      case 'add_label': {
        if (!payload?.labelId) return email;
        const nextLabels = Array.from(new Set([...(email.labels || []), payload.labelId]));
        return { ...email, labels: nextLabels };
      }
      case 'remove_label': {
        if (!payload?.labelId) return email;
        return {
          ...email,
          labels: (email.labels || []).filter((l) => l !== payload.labelId),
        };
      }
      default:
        return email;
    }
  });
}

export function applyAutoFilterRules(
  emails: EmailItem[],
  rule: MailAutoFilterRule
): EmailItem[] {
  const fromTerm = (rule.from || '').trim().toLowerCase();
  const subjTerm = (rule.subject || '').trim().toLowerCase();

  return emails.map((email) => {
    if (fromTerm) {
      const matchFrom =
        email.sender.toLowerCase().includes(fromTerm) ||
        (email.senderEmail || '').toLowerCase().includes(fromTerm);
      if (!matchFrom) return email;
    }
    if (subjTerm && !email.subject.toLowerCase().includes(subjTerm)) {
      return email;
    }
    if (rule.hasAttachment && !email.hasAttachment && !(email.attachments && email.attachments.length > 0)) {
      return email;
    }

    const updated = { ...email };
    if (rule.applyLabelId) {
      updated.labels = Array.from(new Set([...(updated.labels || []), rule.applyLabelId]));
    }
    if (rule.markImportant) updated.isImportant = true;
    if (rule.markStarred) updated.isStarred = true;
    if (rule.archiveImmediately && updated.folder === 'inbox') updated.folder = 'all';
    return updated;
  });
}

export function getSmartRepliesForEmail(email?: Partial<EmailItem> | null): string[] {
  if (!email) return [];
  const text = `${email.subject || ''} ${email.preview || ''} ${email.body || ''}`.toLowerCase();

  if (text.includes('dashboard') || text.includes('kpi') || text.includes('métrica') || text.includes('relatório')) {
    return [
      'Obrigado, Gabriel! Vou revisar os KPIs ainda hoje.',
      'Excelente trabalho! Dados validados da minha parte ✓',
      'Pode compartilhar o link atualizado da planilha?',
    ];
  }
  if (text.includes('protótipo') || text.includes('design') || text.includes('figma')) {
    return [
      'Ficou excelente! Deixei meus comentários no Figma.',
      'Vou revisar o fluxo e envio feedback até quarta.',
      'Aprovado! Podemos seguir para implementação.',
    ];
  }
  if (text.includes('reunião') || text.includes('sprint') || text.includes('convite') || text.includes('10h')) {
    return [
      'Confirmado! Estarei presente no horário.',
      'Obrigado! Vou revisar a pauta antes da reunião.',
      'Podemos reagendar para o período da tarde?',
    ];
  }
  return [
    'Recebido, muito obrigado pelo envio!',
    'Vou analisar os detalhes e retorno em breve.',
    'Perfeito, estou de acordo!',
  ];
}
