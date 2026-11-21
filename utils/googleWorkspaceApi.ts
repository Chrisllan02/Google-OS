import type { EmailItem } from './mailLogic';
import type { EnrichedDriveItem } from './driveLogic';
import type { CalendarEvent, Slide, TaskItem, TaskList } from './GASBridge';
import { escapeHtml } from './sanitize';
import { fetchWithTimeout, mapWithConcurrency } from './perfUtils';

const GOOGLE_API_TIMEOUT_MS = 15_000;
const GOOGLE_BATCH_CONCURRENCY = 5;

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/meetings.space.created',
] as const;

export function encodeBase64UrlUtf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeBase64UrlUtf8(input: string): string {
  if (!input) return '';
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  try {
    if (typeof atob === 'function') {
      const binary = atob(padded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    }
    return Buffer.from(padded, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

function sanitizeHeaderValue(value: string): string {
  return (value || '').replace(/[\r\n]+/g, ' ').trim();
}

export function buildRfc2822Base64UrlEmail(params: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
}): string {
  const headers: string[] = [
    `To: ${sanitizeHeaderValue(params.to)}`,
    `Subject: =?UTF-8?B?${encodeBase64UrlUtf8(sanitizeHeaderValue(params.subject)).replace(/-/g, '+').replace(/_/g, '/')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
  ];
  if (params.cc?.trim()) headers.push(`Cc: ${sanitizeHeaderValue(params.cc)}`);
  if (params.bcc?.trim()) headers.push(`Bcc: ${sanitizeHeaderValue(params.bcc)}`);
  const raw = `${headers.join('\r\n')}\r\n\r\n${params.body || ''}`;
  return encodeBase64UrlUtf8(raw);
}

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

interface RawGmailMessage {
  id: string;
  threadId?: string;
  snippet?: string;
  labelIds?: string[];
  internalDate?: string;
  payload?: {
    headers?: Array<{ name?: string; value?: string }>;
    mimeType?: string;
    body?: { data?: string };
    parts?: GmailPart[];
  };
}

function extractBodyFromParts(part?: GmailPart): string {
  if (!part) return '';
  if (part.mimeType === 'text/html' && part.body?.data) {
    return decodeBase64UrlUtf8(part.body.data);
  }
  if (part.parts?.length) {
    for (const child of part.parts) {
      if (child.mimeType === 'text/html' && child.body?.data) {
        return decodeBase64UrlUtf8(child.body.data);
      }
    }
    for (const child of part.parts) {
      const nested = extractBodyFromParts(child);
      if (nested) return nested;
    }
  }
  if (part.body?.data) {
    const plain = decodeBase64UrlUtf8(part.body.data);
    return plain ? `<p>${escapeHtml(plain).replace(/\n/g, '<br/>')}</p>` : '';
  }
  return '';
}

function parseAddress(raw: string): { name: string; email: string } {
  const trimmed = (raw || '').trim();
  const match = trimmed.match(/^(.*?)\s*<([^>]+)>$/);
  if (match) {
    const name = match[1].replace(/^"|"$/g, '').trim();
    const email = match[2].trim();
    return { name: name || email.split('@')[0], email };
  }
  return { name: trimmed.split('@')[0] || 'Contato', email: trimmed };
}

export function parseGmailMessageToEmailItem(raw: RawGmailMessage): EmailItem {
  const headers = raw.payload?.headers ?? [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

  const from = parseAddress(getHeader('From'));
  const toHeader = getHeader('To');
  const subject = getHeader('Subject') || '(Sem assunto)';
  const labels = raw.labelIds ?? [];
  const ms = raw.internalDate ? Number(raw.internalDate) : Date.now();
  const dateObj = Number.isFinite(ms) ? new Date(ms) : new Date();
  const dateStr = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const body = extractBodyFromParts(raw.payload) || `<p>${escapeHtml(raw.snippet || '')}</p>`;

  const folder: EmailItem['folder'] = labels.includes('TRASH')
    ? 'trash'
    : labels.includes('SPAM')
    ? 'spam'
    : labels.includes('DRAFT')
    ? 'drafts'
    : labels.includes('SENT') && !labels.includes('INBOX')
    ? 'sent'
    : labels.includes('INBOX')
    ? 'inbox'
    : 'archive';

  const senderInit = from.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || 'GM';

  return {
    id: raw.id,
    threadId: raw.threadId || raw.id,
    sender: from.name,
    senderInit,
    senderEmail: from.email,
    to: toHeader,
    subject,
    preview: raw.snippet || '',
    body,
    time: dateStr,
    read: !labels.includes('UNREAD'),
    isStarred: labels.includes('STARRED'),
    isImportant: labels.includes('IMPORTANT'),
    folder,
    category: labels.includes('CATEGORY_SOCIAL')
      ? 'social'
      : labels.includes('CATEGORY_PROMOTIONS')
      ? 'promotions'
      : labels.includes('CATEGORY_UPDATES')
      ? 'updates'
      : 'primary',
    labels: labels.filter(
      (l) => !['INBOX', 'UNREAD', 'STARRED', 'SENT', 'DRAFT', 'TRASH', 'SPAM', 'IMPORTANT'].includes(l) && !l.startsWith('CATEGORY_'),
    ),
  };
}

export interface RawDriveFile {
  id: string;
  name: string;
  mimeType?: string;
  modifiedTime?: string;
  size?: string;
  starred?: boolean;
  trashed?: boolean;
  parents?: string[];
  webViewLink?: string;
  owners?: Array<{ displayName?: string; emailAddress?: string }>;
  shared?: boolean;
}

export function mapDriveMimeToAppType(mimeType?: string): string {
  switch (mimeType) {
    case 'application/vnd.google-apps.folder':
      return 'folder';
    case 'application/vnd.google-apps.document':
      return 'doc';
    case 'application/vnd.google-apps.spreadsheet':
      return 'sheet';
    case 'application/vnd.google-apps.presentation':
      return 'slide';
    case 'application/pdf':
      return 'pdf';
    default:
      if (mimeType?.startsWith('image/')) return 'image';
      if (mimeType?.startsWith('video/')) return 'video';
      return 'doc';
  }
}

export function mapAppTypeToDriveMime(type: string): string {
  switch (type) {
    case 'folder':
      return 'application/vnd.google-apps.folder';
    case 'sheet':
      return 'application/vnd.google-apps.spreadsheet';
    case 'slide':
      return 'application/vnd.google-apps.presentation';
    default:
      return 'application/vnd.google-apps.document';
  }
}

export function formatDriveBytes(sizeStr?: string): string {
  const bytes = Number(sizeStr);
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function parseDriveFileToItem(raw: RawDriveFile): EnrichedDriveItem {
  const type = mapDriveMimeToAppType(raw.mimeType);
  const modified = raw.modifiedTime ? new Date(raw.modifiedTime) : new Date();
  return {
    id: raw.id,
    name: raw.name || 'Sem título',
    type,
    mimeType: raw.mimeType,
    owner: raw.owners?.[0]?.displayName || raw.owners?.[0]?.emailAddress || 'Você',
    date: modified.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
    size: type === 'folder' ? 'Pasta' : formatDriveBytes(raw.size),
    isStarred: Boolean(raw.starred),
    trashed: Boolean(raw.trashed),
    parentId: raw.parents?.[0],
    webViewLink: raw.webViewLink,
    url: raw.webViewLink,
    modifiedIso: raw.modifiedTime,
    sizeBytes: Number(raw.size) || 0,
    generalAccess: raw.shared ? 'anyone_with_link' : 'restricted',
  };
}

export interface RawGoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  hangoutLink?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string; organizer?: boolean }>;
  recurrence?: string[];
}

export function parseCalendarEventFromGoogle(raw: RawGoogleCalendarEvent, calendarId = 'primary'): CalendarEvent {
  const isAllDay = Boolean(raw.start?.date && !raw.start?.dateTime);
  const startIso = raw.start?.dateTime || (raw.start?.date ? `${raw.start.date}T09:00:00.000Z` : new Date().toISOString());
  const endIso = raw.end?.dateTime || (raw.end?.date ? `${raw.end.date}T10:00:00.000Z` : new Date(Date.now() + 3600000).toISOString());
  return {
    id: raw.id,
    title: raw.summary || '(Sem título)',
    description: raw.description || '',
    location: raw.location || '',
    meetLink: raw.hangoutLink || '',
    start: new Date(startIso).toISOString(),
    end: new Date(endIso).toISOString(),
    isAllDay,
    calendarId,
    timeZone: raw.start?.timeZone,
    recurrence: raw.recurrence,
    guests: (raw.attendees || []).map((a) => ({
      email: a.email,
      name: a.displayName,
      organizer: a.organizer,
      responseStatus: (a.responseStatus as 'needsAction' | 'declined' | 'tentative' | 'accepted') || 'needsAction',
    })),
  };
}

export interface RawGoogleTask {
  id: string;
  title?: string;
  notes?: string;
  status?: 'needsAction' | 'completed';
  completed?: string;
  due?: string;
  parent?: string;
  position?: string;
}

export function parseGoogleTaskToItem(raw: RawGoogleTask, listId: string): TaskItem {
  return {
    id: raw.id,
    title: raw.title || 'Tarefa sem título',
    details: raw.notes || '',
    completed: raw.status === 'completed',
    completedAt: raw.completed,
    date: raw.due ? raw.due.slice(0, 10) : undefined,
    parent: raw.parent,
    position: raw.position,
    listId,
  };
}

export function extractHtmlFromGoogleDoc(docJson: {
  title?: string;
  body?: {
    content?: Array<{
      paragraph?: {
        paragraphStyle?: { namedStyleType?: string };
        elements?: Array<{ textRun?: { content?: string; textStyle?: { bold?: boolean; italic?: boolean; underline?: boolean } } }>;
      };
    }>;
  };
}): string {
  const blocks = docJson?.body?.content ?? [];
  const parts: string[] = [];
  for (const el of blocks) {
    const para = el.paragraph;
    if (!para?.elements?.length) continue;
    const htmlRuns = para.elements
      .map((item) => {
        const text = item.textRun?.content ?? '';
        if (!text || text === '\n') return '';
        let safe = escapeHtml(text.replace(/\n$/, ''));
        if (item.textRun?.textStyle?.bold) safe = `<strong>${safe}</strong>`;
        if (item.textRun?.textStyle?.italic) safe = `<em>${safe}</em>`;
        if (item.textRun?.textStyle?.underline) safe = `<u>${safe}</u>`;
        return safe;
      })
      .join('');
    if (!htmlRuns.trim()) continue;
    const styleType = para.paragraphStyle?.namedStyleType || 'NORMAL_TEXT';
    if (styleType === 'TITLE' || styleType === 'HEADING_1') parts.push(`<h1>${htmlRuns}</h1>`);
    else if (styleType === 'HEADING_2') parts.push(`<h2>${htmlRuns}</h2>`);
    else if (styleType === 'HEADING_3') parts.push(`<h3>${htmlRuns}</h3>`);
    else parts.push(`<p>${htmlRuns}</p>`);
  }
  return parts.join('\n') || `<p>${escapeHtml(docJson?.title || '')}</p>`;
}

export function extractGridFromGoogleSheet(
  sheetTitle: string,
  values: unknown[][],
): { sheetName: string; grid: Record<string, string> } {
  const grid: Record<string, string> = {};
  const colToLetter = (idx: number): string => {
    let n = idx + 1;
    let out = '';
    while (n > 0) {
      const rem = (n - 1) % 26;
      out = String.fromCharCode(65 + rem) + out;
      n = Math.floor((n - 1) / 26);
    }
    return out;
  };
  values.forEach((row, rIdx) => {
    if (!Array.isArray(row)) return;
    row.forEach((cell, cIdx) => {
      const text = cell === null || cell === undefined ? '' : String(cell);
      if (text !== '') {
        grid[`${colToLetter(cIdx)}${rIdx + 1}`] = text;
      }
    });
  });
  return { sheetName: sheetTitle || 'Planilha', grid };
}

export function extractSlidesFromGooglePresentation(presJson: {
  slides?: Array<{
    objectId?: string;
    pageElements?: Array<{
      objectId?: string;
      shape?: {
        text?: { textElements?: Array<{ textRun?: { content?: string } }> };
      };
    }>;
  }>;
}): Slide[] {
  const slides = presJson?.slides ?? [];
  if (!slides.length) {
    return [{ id: 'slide-1', background: '#ffffff', elements: [] }];
  }
  return slides.map((s, idx) => {
    const elements: Slide['elements'] = [];
    let yOffset = 80;
    for (const pe of s.pageElements ?? []) {
      const text = (pe.shape?.text?.textElements ?? [])
        .map((te) => te.textRun?.content ?? '')
        .join('')
        .trim();
      if (!text) continue;
      const isTitle = elements.length === 0;
      elements.push({
        id: pe.objectId || `el-${idx}-${elements.length}`,
        type: 'text',
        content: text,
        x: 60,
        y: yOffset,
        w: 760,
        h: isTitle ? 90 : 120,
        style: {
          fontSize: isTitle ? 34 : 18,
          fontWeight: isTitle ? '700' : '400',
          color: '#202124',
          textAlign: 'left',
        },
      });
      yOffset += isTitle ? 110 : 130;
    }
    return {
      id: s.objectId || `slide-${idx + 1}`,
      background: '#ffffff',
      elements,
    };
  });
}

async function googleFetch<T>(accessToken: string, url: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithTimeout(
    url,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
    },
    GOOGLE_API_TIMEOUT_MS,
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Google API (${res.status}): ${errText.slice(0, 200) || res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// --- GMAIL REST API ---
export async function fetchGmailMessagesRemote(accessToken: string, maxResults = 25): Promise<EmailItem[]> {
  const list = await googleFetch<{ messages?: Array<{ id: string }> }>(
    accessToken,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`,
  );
  const ids = (list.messages || []).slice(0, maxResults).map((m) => m.id);
  const detailed = await mapWithConcurrency(
    ids,
    GOOGLE_BATCH_CONCURRENCY,
    (id) =>
      googleFetch<RawGmailMessage>(
        accessToken,
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`,
      ).catch(() => null),
  );
  return detailed.filter((m): m is RawGmailMessage => m !== null).map(parseGmailMessageToEmailItem);
}

export async function sendGmailMessageRemote(
  accessToken: string,
  params: { to: string; subject: string; body: string; cc?: string; bcc?: string },
): Promise<{ id: string }> {
  const raw = buildRfc2822Base64UrlEmail(params);
  return googleFetch<{ id: string }>(accessToken, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    body: JSON.stringify({ raw }),
  });
}

export async function trashGmailMessageRemote(accessToken: string, messageId: string): Promise<void> {
  await googleFetch(
    accessToken,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/trash`,
    { method: 'POST' },
  );
}

// --- GOOGLE DRIVE REST API ---
export async function fetchDriveFilesRemote(accessToken: string, pageSize = 40): Promise<EnrichedDriveItem[]> {
  const fields = encodeURIComponent(
    'files(id,name,mimeType,modifiedTime,size,starred,trashed,parents,webViewLink,owners,shared)',
  );
  const data = await googleFetch<{ files?: RawDriveFile[] }>(
    accessToken,
    `https://www.googleapis.com/drive/v3/files?pageSize=${pageSize}&fields=${fields}&orderBy=modifiedTime%20desc`,
  );
  return (data.files || []).map(parseDriveFileToItem);
}

export async function createDriveFileRemote(
  accessToken: string,
  params: { name: string; type: string; parentId?: string | null },
): Promise<EnrichedDriveItem> {
  const mimeType = mapAppTypeToDriveMime(params.type);
  const body: Record<string, unknown> = { name: params.name, mimeType };
  if (params.parentId) body.parents = [params.parentId];
  const fields = encodeURIComponent('id,name,mimeType,modifiedTime,size,starred,trashed,parents,webViewLink,owners,shared');
  const created = await googleFetch<RawDriveFile>(
    accessToken,
    `https://www.googleapis.com/drive/v3/files?fields=${fields}`,
    { method: 'POST', body: JSON.stringify(body) },
  );
  return parseDriveFileToItem(created);
}

export async function renameDriveFileRemote(accessToken: string, fileId: string, name: string): Promise<void> {
  await googleFetch(accessToken, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export async function trashDriveFileRemote(accessToken: string, fileId: string, trashed = true): Promise<void> {
  await googleFetch(accessToken, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ trashed }),
  });
}

export async function deleteDriveFileRemote(accessToken: string, fileId: string): Promise<void> {
  await googleFetch(accessToken, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
  });
}

// --- GOOGLE DOCS / SHEETS / SLIDES REST APIs ---
export async function fetchGoogleDocHtmlRemote(accessToken: string, documentId: string): Promise<string> {
  const doc = await googleFetch<Parameters<typeof extractHtmlFromGoogleDoc>[0]>(
    accessToken,
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`,
  );
  return extractHtmlFromGoogleDoc(doc);
}

export async function updateGoogleDocTextRemote(
  accessToken: string,
  documentId: string,
  plainText: string,
): Promise<void> {
  const doc = await googleFetch<{ body?: { content?: Array<{ endIndex?: number }> } }>(
    accessToken,
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`,
  );
  const content = doc.body?.content ?? [];
  const lastEnd = content[content.length - 1]?.endIndex ?? 1;
  const requests: Record<string, unknown>[] = [];
  if (lastEnd > 2) {
    requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex: lastEnd - 1 } } });
  }
  if (plainText) {
    requests.push({ insertText: { location: { index: 1 }, text: plainText } });
  }
  if (!requests.length) return;
  await googleFetch(
    accessToken,
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`,
    { method: 'POST', body: JSON.stringify({ requests }) },
  );
}

export async function fetchGoogleSheetGridRemote(
  accessToken: string,
  spreadsheetId: string,
): Promise<{ sheetName: string; grid: Record<string, string> }> {
  const meta = await googleFetch<{ sheets?: Array<{ properties?: { title?: string } }> }>(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`,
  );
  const firstSheetTitle = meta.sheets?.[0]?.properties?.title || 'Sheet1';
  const range = encodeURIComponent(`'${firstSheetTitle.replace(/'/g, "''")}'!A1:Z100`);
  const valuesRes = await googleFetch<{ values?: unknown[][] }>(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}`,
  );
  return extractGridFromGoogleSheet(firstSheetTitle, valuesRes.values ?? []);
}

export async function updateGoogleSheetValuesRemote(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  values: string[][],
): Promise<void> {
  const range = encodeURIComponent(`'${sheetName.replace(/'/g, "''")}'!A1`);
  await googleFetch(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}?valueInputOption=USER_ENTERED`,
    { method: 'PUT', body: JSON.stringify({ values }) },
  );
}

export async function fetchGoogleSlidesRemote(accessToken: string, presentationId: string): Promise<Slide[]> {
  const pres = await googleFetch<Parameters<typeof extractSlidesFromGooglePresentation>[0]>(
    accessToken,
    `https://slides.googleapis.com/v1/presentations/${encodeURIComponent(presentationId)}`,
  );
  return extractSlidesFromGooglePresentation(pres);
}

// --- GOOGLE CALENDAR REST API ---
export async function fetchCalendarEventsRemote(accessToken: string): Promise<CalendarEvent[]> {
  const timeMin = encodeURIComponent(new Date(Date.now() - 30 * 86400000).toISOString());
  const data = await googleFetch<{ items?: RawGoogleCalendarEvent[] }>(
    accessToken,
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=60&timeMin=${timeMin}`,
  );
  return (data.items || []).map((ev) => parseCalendarEventFromGoogle(ev, 'primary'));
}

export async function createCalendarEventRemote(
  accessToken: string,
  event: Omit<CalendarEvent, 'id'>,
): Promise<CalendarEvent> {
  const created = await googleFetch<RawGoogleCalendarEvent>(
    accessToken,
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      body: JSON.stringify({
        summary: event.title,
        description: event.description,
        location: event.location,
        start: { dateTime: new Date(event.start).toISOString() },
        end: { dateTime: new Date(event.end).toISOString() },
        attendees: (event.guests || []).map((g) => ({ email: g.email })),
      }),
    },
  );
  return parseCalendarEventFromGoogle(created, event.calendarId || 'primary');
}

export async function updateCalendarEventRemote(accessToken: string, event: CalendarEvent): Promise<void> {
  await googleFetch(
    accessToken,
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(event.id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        summary: event.title,
        description: event.description,
        location: event.location,
        start: { dateTime: new Date(event.start).toISOString() },
        end: { dateTime: new Date(event.end).toISOString() },
      }),
    },
  );
}

export async function deleteCalendarEventRemote(accessToken: string, eventId: string): Promise<void> {
  await googleFetch(
    accessToken,
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE' },
  );
}

// --- GOOGLE TASKS REST API ---
export async function fetchTasksAndListsRemote(
  accessToken: string,
): Promise<{ lists: TaskList[]; tasks: TaskItem[] }> {
  const listRes = await googleFetch<{ items?: Array<{ id: string; title?: string }> }>(
    accessToken,
    'https://tasks.googleapis.com/tasks/v1/users/@me/lists',
  );
  const lists: TaskList[] = (listRes.items || []).map((l) => ({ id: l.id, title: l.title || 'Minhas tarefas' }));
  if (!lists.length) return { lists: [], tasks: [] };

  const taskGroups = await mapWithConcurrency(
    lists.slice(0, 8),
    GOOGLE_BATCH_CONCURRENCY,
    async (list) => {
      const res = await googleFetch<{ items?: RawGoogleTask[] }>(
        accessToken,
        `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(list.id)}/tasks?showCompleted=true&showHidden=true&maxResults=100`,
      ).catch(() => ({ items: [] }));
      return (res.items || []).map((t) => parseGoogleTaskToItem(t, list.id));
    },
  );
  return { lists, tasks: taskGroups.flat() };
}

export async function createTaskRemote(
  accessToken: string,
  listId: string,
  task: { title: string; details?: string; date?: string },
): Promise<TaskItem> {
  const created = await googleFetch<RawGoogleTask>(
    accessToken,
    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks`,
    {
      method: 'POST',
      body: JSON.stringify({
        title: task.title,
        notes: task.details || '',
        due: task.date ? new Date(`${task.date}T12:00:00Z`).toISOString() : undefined,
      }),
    },
  );
  return parseGoogleTaskToItem(created, listId);
}

export async function updateTaskRemote(
  accessToken: string,
  listId: string,
  taskId: string,
  patch: { title?: string; details?: string; completed?: boolean },
): Promise<void> {
  await googleFetch(
    accessToken,
    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.details !== undefined ? { notes: patch.details } : {}),
        ...(patch.completed !== undefined ? { status: patch.completed ? 'completed' : 'needsAction' } : {}),
      }),
    },
  );
}

export async function deleteTaskRemote(accessToken: string, listId: string, taskId: string): Promise<void> {
  await googleFetch(
    accessToken,
    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
    { method: 'DELETE' },
  );
}

// --- GOOGLE MEET REST API ---
export async function createGoogleMeetSpaceRemote(
  accessToken: string,
): Promise<{ name: string; meetingUri: string; meetingCode: string }> {
  return googleFetch<{ name: string; meetingUri: string; meetingCode: string }>(
    accessToken,
    'https://meet.googleapis.com/v2/spaces',
    { method: 'POST', body: JSON.stringify({}) },
  );
}
