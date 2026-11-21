import type { CalendarEvent, DriveItem, EmailItem, NoteItem, TaskItem } from './GASBridge';
import type { EnrichedDriveItem } from './driveLogic';

export type SearchTypeFilter = 'all' | 'files' | 'emails' | 'events' | 'tasks' | 'notes';
export type SearchDateFilter = 'any' | 'today' | '7d' | '30d';

export interface WorkspaceSearchInput {
  emails: EmailItem[];
  files: EnrichedDriveItem[];
  events: CalendarEvent[];
  tasks?: TaskItem[];
  notes?: NoteItem[];
}

export interface SearchFilterOptions {
  query: string;
  typeFilter: SearchTypeFilter;
  dateFilter: SearchDateFilter;
  senderFilter: string;
  fileTypeSubfilter?: string;
  now?: Date;
}

export interface FilteredSearchResults {
  emails: EmailItem[];
  files: DriveItem[];
  events: CalendarEvent[];
  tasks: TaskItem[];
  notes: NoteItem[];
}

export const SEARCH_HISTORY_KEY = 'workspace_search_history_v1';

export function parseSearchOperators(rawQuery: string): {
  cleanQuery: string;
  fromToken: string;
  typeToken: string;
  starredOnly: boolean;
  unreadOnly: boolean;
  hasAttachmentOnly: boolean;
} {
  let clean = rawQuery;
  let fromToken = '';
  let typeToken = '';
  let starredOnly = false;
  let unreadOnly = false;
  let hasAttachmentOnly = false;

  const fromMatch = clean.match(/\bfrom:([^\s]+)/i);
  if (fromMatch) {
    fromToken = fromMatch[1].toLowerCase();
    clean = clean.replace(fromMatch[0], '');
  }

  const typeMatch = clean.match(/\btype:([^\s]+)/i);
  if (typeMatch) {
    typeToken = typeMatch[1].toLowerCase();
    clean = clean.replace(typeMatch[0], '');
  }

  if (/\bis:starred\b/i.test(clean)) {
    starredOnly = true;
    clean = clean.replace(/\bis:starred\b/gi, '');
  }

  if (/\bis:unread\b/i.test(clean)) {
    unreadOnly = true;
    clean = clean.replace(/\bis:unread\b/gi, '');
  }

  if (/\bhas:attachment\b/i.test(clean)) {
    hasAttachmentOnly = true;
    clean = clean.replace(/\bhas:attachment\b/gi, '');
  }

  return {
    cleanQuery: clean.trim().toLowerCase(),
    fromToken,
    typeToken,
    starredOnly,
    unreadOnly,
    hasAttachmentOnly,
  };
}

function matchesDateFilter(isoOrLabel: string | undefined, dateFilter: SearchDateFilter, now: Date): boolean {
  if (dateFilter === 'any') return true;
  if (!isoOrLabel) return true;

  const lowered = isoOrLabel.toLowerCase();
  if (lowered.includes('hoje') || /^\d{1,2}:\d{2}$/.test(lowered)) {
    return true;
  }
  if (lowered.includes('ontem')) {
    return dateFilter !== 'today';
  }

  const parsed = Date.parse(isoOrLabel);
  if (Number.isNaN(parsed)) {
    return dateFilter === '30d';
  }

  const diffDays = Math.abs(now.getTime() - parsed) / (1000 * 60 * 60 * 24);
  if (dateFilter === 'today') return diffDays <= 1;
  if (dateFilter === '7d') return diffDays <= 7;
  return diffDays <= 30;
}

const FILE_SUBTYPES = new Set(['doc', 'sheet', 'slide', 'folder', 'pdf', 'image', 'file']);

export function filterWorkspaceSearchResults(
  data: WorkspaceSearchInput,
  options: SearchFilterOptions
): FilteredSearchResults {
  const { cleanQuery, fromToken, typeToken, starredOnly, unreadOnly, hasAttachmentOnly } = parseSearchOperators(options.query);
  const senderNeedle = (options.senderFilter || fromToken || '').trim().toLowerCase();
  const subType = (options.fileTypeSubfilter || typeToken || '').trim().toLowerCase();
  const now = options.now || new Date();

  const matchText = (...fields: Array<string | undefined>) => {
    if (!cleanQuery) return true;
    return fields.some((f) => (f || '').toLowerCase().includes(cleanQuery));
  };

  const allow = (target: Exclude<SearchTypeFilter, 'all'>) => {
    if (options.typeFilter !== 'all' && options.typeFilter !== target) return false;
    if (!subType || subType === 'all') return true;
    if (FILE_SUBTYPES.has(subType)) return target === 'files';
    if (subType === 'mail' || subType === 'email' || subType === 'emails') return target === 'emails';
    if (subType === 'event' || subType === 'events' || subType === 'calendar') return target === 'events';
    if (subType === 'task' || subType === 'tasks') return target === 'tasks';
    if (subType === 'note' || subType === 'notes' || subType === 'keep') return target === 'notes';
    return target === 'files';
  };

  const emails = allow('emails')
    ? (data.emails || []).filter((e) => {
        if (!matchText(e.subject, e.preview, e.sender, e.senderEmail)) return false;
        if (
          senderNeedle &&
          !(e.sender || '').toLowerCase().includes(senderNeedle) &&
          !(e.senderEmail || '').toLowerCase().includes(senderNeedle)
        ) {
          return false;
        }
        if (starredOnly && !e.isStarred) return false;
        if (unreadOnly && e.read) return false;
        if (hasAttachmentOnly && (!e.attachments || e.attachments.length === 0)) return false;
        if (!matchesDateFilter(e.time, options.dateFilter, now)) return false;
        return true;
      })
    : [];

  const files =
    allow('files') && !unreadOnly && !hasAttachmentOnly
      ? (data.files || []).filter((f: EnrichedDriveItem) => {
          if (f.trashed) return false;
          if (!matchText(f.name, f.owner, f.description, f.type)) return false;
          if (senderNeedle && !(f.owner || '').toLowerCase().includes(senderNeedle)) return false;
          if (subType && subType !== 'all' && subType !== 'file' && (f.type || '').toLowerCase() !== subType) {
            return false;
          }
          if (starredOnly && !f.isStarred) return false;
          if (!matchesDateFilter(f.modifiedIso || f.date, options.dateFilter, now)) return false;
          return true;
        })
      : [];

  const events =
    allow('events') && !unreadOnly && !hasAttachmentOnly && !starredOnly
      ? (data.events || []).filter((ev) => {
          if (!matchText(ev.title, ev.description, ev.location)) return false;
          if (
            senderNeedle &&
            !(ev.guests || []).some(
              (g) =>
                (g.name || '').toLowerCase().includes(senderNeedle) ||
                (g.email || '').toLowerCase().includes(senderNeedle)
            )
          ) {
            return false;
          }
          if (!matchesDateFilter(ev.start, options.dateFilter, now)) return false;
          return true;
        })
      : [];

  const tasks =
    allow('tasks') && !unreadOnly && !hasAttachmentOnly
      ? (data.tasks || []).filter((t) => {
          if (!matchText(t.title, t.details, t.linkedSource?.label)) return false;
          if (
            senderNeedle &&
            !(t.title || '').toLowerCase().includes(senderNeedle) &&
            !(t.details || '').toLowerCase().includes(senderNeedle)
          ) {
            return false;
          }
          if (starredOnly && !t.starred) return false;
          if (!matchesDateFilter(t.date, options.dateFilter, now)) return false;
          return true;
        })
      : [];

  const notes =
    allow('notes') && !unreadOnly && !hasAttachmentOnly
      ? (data.notes || []).filter((n) => {
          if (n.trashed) return false;
          if (!matchText(n.title, n.content, (n.labels || []).join(' '))) return false;
          if (
            senderNeedle &&
            !(n.participants || []).some(
              (p) =>
                (p.name || '').toLowerCase().includes(senderNeedle) ||
                (p.email || '').toLowerCase().includes(senderNeedle)
            )
          ) {
            return false;
          }
          if (starredOnly && !n.pinned) return false;
          if (!matchesDateFilter(n.date, options.dateFilter, now)) return false;
          return true;
        })
      : [];

  return { emails, files, events, tasks, notes };
}

export function addSearchHistoryEntry(history: string[], query: string, maxItems = 8): string[] {
  const trimmed = query.trim();
  if (trimmed.length < 2) return history;
  const deduped = history.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
  return [trimmed, ...deduped].slice(0, maxItems);
}

export function removeSearchHistoryEntry(history: string[], query: string): string[] {
  return history.filter((item) => item !== query);
}
