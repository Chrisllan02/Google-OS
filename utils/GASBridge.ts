import { GoogleIcons } from '../components/GoogleIcons';
import { googleAuth } from './GoogleAuth';

export interface DashboardData {
  user: { name: string; email: string; avatar: string; };
  weather: { temp: string; location: string; };
  stats: { storageUsed: number; unreadEmails: number; };
  emails: any[]; labels?: any[]; events: CalendarEvent[]; calendars?: CalendarListEntry[]; files: DriveItem[]; 
  tasks: TaskItem[]; taskLists?: TaskList[]; notes: NoteItem[];
}

export interface NoteItem {
    id: number;
    title: string;
    content: string;
    color: string;
    pinned: boolean;
    date: string;
    images?: string[]; 
    labels?: string[]; 
}

export interface TaskList {
    id: string;
    title: string;
}

export interface TaskItem {
    id: string;
    title: string;
    details?: string;
    completed: boolean;
    date?: string;
    parent?: string; 
    position?: string; 
    listId?: string; 
    subtasks?: TaskItem[]; 
}

export interface DriveItem {
    id: string; name: string; type: string; mimeType?: string;
    owner: string; date: string; size?: string; thumbnail?: string; isStarred?: boolean; url?: string;
    webViewLink?: string;
    parentId?: string;
    trashed?: boolean;
    sharedWith?: Permission[];
}

export interface Permission {
    id: string;
    name: string;
    email: string;
    role: 'owner' | 'editor' | 'viewer';
    avatar?: string;
}

export interface FileVersion {
    id: string;
    date: string;
    author: string;
    size: string;
}

export interface Slide {
    id: string;
    background: string; 
    elements: SlideElement[];
    notes?: string;
}

export interface SlideElement {
    id: string;
    type: 'text' | 'image' | 'shape' | 'line';
    content?: string; 
    x: number;
    y: number;
    w: number;
    h: number;
    rotation?: number;
    style: {
        backgroundColor?: string;
        color?: string;
        fontSize?: number;
        fontFamily?: string;
        fontWeight?: string; 
        textAlign?: 'left' | 'center' | 'right' | 'justify';
        border?: string; 
        borderRadius?: number;
        opacity?: number;
        zIndex?: number;
        boxShadow?: string;
    };
}

export interface DriveResponse {
    category: string; currentFolderId: string | null; currentFolderName: string;
    parentId: string | null; folders: DriveItem[]; files: DriveItem[];
}

export interface FileContentResponse {
    success: boolean; data?: string; mimeType?: string; name?: string; error?: string;
}

export interface EmailAttachment { name: string; mimeType: string; data: string; }

export interface SearchResults {
    emails: any[];
    files: any[];
    events: any[];
    error?: string;
}

// --- Segurança & Governança (herdado do Google Workspace Hub) ---
export type LogStatus = 'SUCCESS' | 'FAILURE' | 'BLOCKED';

export interface AuditLog {
    id: string;
    action: string;
    details: string;
    timestamp: string;
    status: LogStatus;
    ipAddress: string;
    device: string;
}

export type ResourceType = 'calendar' | 'tasks' | 'all';
export type AccessLevel = 'read' | 'write';
export type PermissionStatus = 'ACTIVE' | 'REVOKED' | 'PENDING';

export interface SharedPermission {
    id: string;
    ownerEmail: string;
    collaboratorEmail: string;
    resourceType: ResourceType;
    accessLevel: AccessLevel;
    status: PermissionStatus;
    createdAt: string;
}

export interface SecurityState {
    mfaEnabled: boolean;
    mfaSecret: string;
}

export interface CalendarEvent {
    id: string;
    title: string;
    start: string; 
    end: string;   
    isAllDay?: boolean;
    calendarId: string;
    description?: string;
    location?: string;
    recurrence?: string[]; 
    guests?: EventGuest[];
    meetLink?: string;
    color?: string; 
    timeZone?: string;
}

export interface EventGuest {
    email: string;
    name?: string;
    avatar?: string;
    responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
    organizer?: boolean;
}

export interface CalendarListEntry {
    id: string;
    name: string;
    color: string;
    checked: boolean;
    accessRole: 'owner' | 'reader' | 'writer';
}

// --- Dynamic Mock Data Helpers ---
const _d0 = new Date();
const _fmt = (d: Date) => d.toISOString();
const _days = (n: number) => { const d = new Date(_d0); d.setDate(d.getDate() + n); return d; };
const _at = (base: Date, h: number, m = 0): Date => { const d = new Date(base); d.setHours(h, m, 0, 0); return d; };

const MOCK_EMAILS = [
  { id: '1', threadId: 't1', sender: 'Gabriel Silva',  senderInit: 'G', senderEmail: 'gabriel@example.com', subject: 'Dashboard de métricas — revisão urgente',    preview: 'Precisamos revisitar os KPIs antes da reunião de sexta com os stakeholders...', time: '10:32', color: 'bg-purple-600', body: '<p>Oi,</p><p>Precisamos revisitar os KPIs antes da reunião de sexta. Você consegue dar uma olhada no dashboard ainda hoje?</p><p>Att,<br/>Gabriel</p>' },
  { id: '2', threadId: 't2', sender: 'Ana Lima',       senderInit: 'A', senderEmail: 'ana@example.com',     subject: 'Convite para revisão de design',                preview: 'Compartilhei o novo protótipo do Figma com vocês. Podem dar feedback até quarta?', time: '09:15', color: 'bg-pink-600',   body: '<p>Oi equipe!</p><p>Compartilhei o novo protótipo. Podem dar feedback até quarta-feira?</p><p>Obg,<br/>Ana</p>' },
  { id: '3', threadId: 't3', sender: 'Pedro Moreira',  senderInit: 'P', senderEmail: 'pedro@example.com',   subject: 'Re: Sprint Planning da semana',                 preview: 'Confirmado para as 10h de amanhã. Vou trazer os itens de backlog priorizados.',   time: 'Ontem',  color: 'bg-blue-600',   body: '<p>Confirmado para as 10h de amanhã! Trarei os itens de backlog priorizados.</p>' },
  { id: '4', threadId: 't4', sender: 'Workspace OS',   senderInit: 'W', senderEmail: 'noreply@workspace.os',subject: 'Bem-vindo ao Google OS Dashboard',               preview: 'Sua interface unificada do Google Workspace está pronta para uso.',               time: 'Seg',    color: 'bg-[#4285F4]',  body: '<p>Seja bem-vindo! Explore Gmail, Drive, Agenda, Meet e muito mais em um só lugar.</p>' },
  { id: '5', threadId: 't5', sender: 'Carlos Eduardo', senderInit: 'C', senderEmail: 'carlos@example.com',  subject: 'Relatório Q1 2026 aprovado ✓',                  preview: 'O relatório foi aprovado pela diretoria. Parabéns ao time pelo excelente trabalho!',time: '08 abr', color: 'bg-green-600',  body: '<p>Pessoal,</p><p>O relatório Q1 foi aprovado pela diretoria. Excelente trabalho!</p>' },
];

const MOCK_EVENTS: CalendarEvent[] = [
  { id: 'e1', title: 'Daily Stand-up',              start: _fmt(_at(_d0,      9,  0)), end: _fmt(_at(_d0,       9, 30)), calendarId: 'primary', color: '#039BE5', meetLink: 'https://meet.google.com/abc-defg-hij' },
  { id: 'e2', title: 'Design Review — Sprint 12',   start: _fmt(_at(_d0,     14,  0)), end: _fmt(_at(_d0,      15, 30)), calendarId: 'primary', color: '#8E24AA', description: 'Revisão dos entregáveis do Sprint 12', location: 'Sala Aurora' },
  { id: 'e3', title: 'Sprint Planning',             start: _fmt(_at(_days(1), 10,  0)), end: _fmt(_at(_days(1), 11, 30)), calendarId: 'primary', color: '#33B679', description: 'Planejamento do Sprint 13 — backlog refinement' },
  { id: 'e4', title: 'Almoço de equipe 🍕',         start: _fmt(_at(_days(3), 12, 30)), end: _fmt(_at(_days(3), 14,  0)), calendarId: 'primary', color: '#F6BF26', location: 'Restaurante Central' },
  { id: 'e5', title: 'Demo para Stakeholders',      start: _fmt(_at(_days(4), 15,  0)), end: _fmt(_at(_days(4), 16,  0)), calendarId: 'primary', color: '#E67C73', description: 'Demonstração para investidores', meetLink: 'https://meet.google.com/demo-link' },
];

const MOCK_FILES: DriveItem[] = [
  { id: 'f1', name: 'Plano Trimestral Q2 2026',  type: 'doc',   owner: 'eu',           date: 'Editado hoje',            isStarred: true,  webViewLink: '#' },
  { id: 'f2', name: 'Métricas de Marketing',     type: 'sheet', owner: 'eu',           date: 'Editado ontem',           isStarred: false, webViewLink: '#' },
  { id: 'f3', name: 'Apresentação Investidores', type: 'slide', owner: 'eu',           date: 'Editado 2 dias atrás',    isStarred: true,  webViewLink: '#' },
  { id: 'f4', name: 'Budget 2026',               type: 'sheet', owner: 'Ana Lima',     date: 'Editado 5 dias atrás',    isStarred: false, webViewLink: '#' },
  { id: 'f5', name: 'Roadmap do Produto',        type: 'doc',   owner: 'eu',           date: 'Editado semana passada',  isStarred: false, webViewLink: '#' },
  { id: 'f6', name: 'Foto da Equipe',            type: 'image', owner: 'Pedro Moreira',date: '01 abr 2026',             isStarred: false, webViewLink: '#' },
];

const MOCK_TASKS: TaskItem[] = [
  { id: 'tk1', title: 'Finalizar dashboard de métricas', details: 'Revisar KPIs com Gabriel antes da reunião de sexta', completed: false, date: _fmt(_at(_d0,       18, 0)), listId: 'default' },
  { id: 'tk2', title: 'Revisar PR do Gabriel',                                                                          completed: true,  listId: 'default' },
  { id: 'tk3', title: 'Preparar slides para demo de sexta', details: 'Incluir métricas do Q1 e roadmap Q2',             completed: false, date: _fmt(_at(_days(3),  12, 0)), listId: 'default' },
  { id: 'tk4', title: 'Enviar relatório mensal ao cliente',                                                             completed: false, date: _fmt(_at(_days(1),   9, 0)), listId: 'default' },
  { id: 'tk5', title: 'Atualizar documentação da API',                                                                  completed: false, listId: 'default' },
  { id: 'tk6', title: 'Onboarding do novo desenvolvedor',   details: 'Configurar acessos e apresentar o time',         completed: false, date: _fmt(_at(_days(7),  10, 0)), listId: 'default' },
];

const MOCK_NOTES: NoteItem[] = [
  { id: 1, title: 'Ideias para o produto',  content: '• Modo offline\n• Atalhos de teclado globais\n• Templates de documentos\n• Integração com Slack',                            color: 'green',  pinned: true,  date: _fmt(_d0)      },
  { id: 2, title: 'TODO esta semana',       content: '✅ Daily stand-up\n⬜ Design review\n⬜ Sprint planning\n⬜ Enviar relatório',                                               color: 'yellow', pinned: true,  date: _fmt(_d0)      },
  { id: 3, title: 'Feedback do produto',    content: '"A interface é muito mais limpa que o Gmail original. Adoro a integração com o Gemini!" — Ana Lima',                         color: 'teal',   pinned: false, date: _fmt(_days(-1)) },
  { id: 4, title: 'Links úteis',            content: 'Figma: figma.com/file/...\nStorybook: storybook.workspace.os\nAPI Docs: docs.workspace.os/api',                              color: 'blue',   pinned: false, date: _fmt(_days(-2)) },
];

const MOCK_CALENDARS: CalendarListEntry[] = [
  { id: 'primary', name: 'Meu calendário', color: '#4285F4', checked: true, accessRole: 'owner' },
  { id: 'work',    name: 'Trabalho',       color: '#33B679', checked: true, accessRole: 'owner' },
];

const MOCK_DATA: DashboardData = {
  user: { name: "Dev Criativo", email: "dev@workspace.new", avatar: "https://ui-avatars.com/api/?name=Dev+Criativo&background=4285F4&color=fff" },
  weather: { temp: "24°", location: "São Paulo" },
  stats: { storageUsed: 78, unreadEmails: 2 },
  emails:    MOCK_EMAILS,
  calendars: MOCK_CALENDARS,
  events:    MOCK_EVENTS,
  files:     MOCK_FILES,
  tasks:     MOCK_TASKS,
  notes:     MOCK_NOTES,
};

// ===================================================================
// INTEGRAÇÃO REAL COM O GOOGLE (Calendar, Tasks, Gmail, Drive, People)
// Tudo é chamado diretamente do navegador com o token OAuth do usuário
// (utils/GoogleAuth.ts). Nenhum dado passa por um servidor nosso.
// ===================================================================

const CAL_API = 'https://www.googleapis.com/calendar/v3';
const TASKS_API = 'https://tasks.googleapis.com/tasks/v1';
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
const PEOPLE_API = 'https://people.googleapis.com/v1';

async function gapi(url: string, options: RequestInit = {}): Promise<any> {
    const token = googleAuth.getAccessToken();
    if (!token) throw new Error('Conta Google não conectada.');
    const res = await fetch(url, {
        ...options,
        headers: {
            ...(options.headers || {}),
            Authorization: `Bearer ${token}`,
            ...(options.body && !(options.headers as any)?.['Content-Type'] ? { 'Content-Type': 'application/json' } : {}),
        },
    });
    if (res.status === 204) return {};
    let body: any = null;
    try { body = await res.json(); } catch { /* corpo vazio ou não-JSON */ }
    if (!res.ok) {
        const message = body?.error?.message || `Erro ${res.status} na API do Google`;
        throw new Error(message);
    }
    return body;
}

function b64UrlEncode(str: string): string {
    const base64 = btoa(unescape(encodeURIComponent(str)));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64UrlDecode(str: string): string {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '==='.slice((base64.length + 3) % 4);
    try { return decodeURIComponent(escape(atob(padded))); } catch { return atob(padded); }
}

function driveMimeForType(type: string): string {
    switch (type) {
        case 'doc': return 'application/vnd.google-apps.document';
        case 'sheet': return 'application/vnd.google-apps.spreadsheet';
        case 'slide': return 'application/vnd.google-apps.presentation';
        case 'folder': return 'application/vnd.google-apps.folder';
        default: return 'application/octet-stream';
    }
}

function typeForMime(mimeType: string = ''): string {
    if (mimeType === 'application/vnd.google-apps.folder') return 'folder';
    if (mimeType === 'application/vnd.google-apps.spreadsheet') return 'sheet';
    if (mimeType === 'application/vnd.google-apps.presentation') return 'slide';
    if (mimeType === 'application/vnd.google-apps.document') return 'doc';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.startsWith('image/')) return 'image';
    return 'file';
}

const AVATAR_COLORS = ['bg-purple-600', 'bg-pink-600', 'bg-blue-600', 'bg-green-600', 'bg-amber-600', 'bg-teal-600', 'bg-rose-600', 'bg-indigo-600'];
function colorForName(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function parseFromHeader(from: string = ''): { name: string; email: string } {
    const match = from.match(/^(.*?)\s*<(.+)>$/);
    if (match) return { name: match[1].replace(/"/g, '').trim() || match[2], email: match[2].trim() };
    return { name: from.trim(), email: from.trim() };
}

function formatEmailTime(dateStr: string): string {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
    if (date.getFullYear() === now.getFullYear()) return date.toLocaleDateString([], { day: '2-digit', month: 'short' });
    return date.toLocaleDateString();
}

function findHeader(headers: any[] = [], name: string): string {
    return headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
}

/** Percorre recursivamente o payload MIME do Gmail em busca de texto e anexos. */
function walkGmailParts(part: any, acc: { html?: string; text?: string; attachments: any[] }) {
    if (!part) return;
    if (part.filename && part.body?.attachmentId) {
        acc.attachments.push({ filename: part.filename, mimeType: part.mimeType, attachmentId: part.body.attachmentId, size: part.body.size });
    } else if (part.mimeType === 'text/html' && part.body?.data) {
        acc.html = b64UrlDecode(part.body.data);
    } else if (part.mimeType === 'text/plain' && part.body?.data) {
        acc.text = b64UrlDecode(part.body.data);
    }
    (part.parts || []).forEach((p: any) => walkGmailParts(p, acc));
}

function buildRawEmail(to: string, subject: string, bodyHtml: string, attachments: EmailAttachment[] = [], from?: string): string {
    const boundary = `----=_GoogleOS_${Date.now()}`;
    let raw = '';
    if (from) raw += `From: ${from}\r\n`;
    raw += `To: ${to}\r\nSubject: ${subject}\r\nMIME-Version: 1.0\r\n`;
    if (attachments.length === 0) {
        raw += `Content-Type: text/html; charset="UTF-8"\r\n\r\n${bodyHtml}`;
    } else {
        raw += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
        raw += `--${boundary}\r\nContent-Type: text/html; charset="UTF-8"\r\n\r\n${bodyHtml}\r\n\r\n`;
        for (const att of attachments) {
            raw += `--${boundary}\r\nContent-Type: ${att.mimeType}; name="${att.name}"\r\nContent-Disposition: attachment; filename="${att.name}"\r\nContent-Transfer-Encoding: base64\r\n\r\n${att.data}\r\n\r\n`;
        }
        raw += `--${boundary}--`;
    }
    return b64UrlEncode(raw);
}

/** Constrói a árvore de subtarefas a partir da lista plana retornada pela Tasks API (campo `parent`). */
function buildTaskTree(flat: TaskItem[]): TaskItem[] {
    const byId = new Map(flat.map(t => [t.id, { ...t, subtasks: [] as TaskItem[] }]));
    const roots: TaskItem[] = [];
    byId.forEach(task => {
        if (task.parent && byId.has(task.parent)) {
            byId.get(task.parent)!.subtasks!.push(task);
        } else {
            roots.push(task);
        }
    });
    return roots;
}

class GASBridge {
  private isGasEnvironment(): boolean {
    return typeof window !== 'undefined' && (window as any).google && (window as any).google.script;
  }

  private normalizeData(data: any): DashboardData {
    if (data.events) {
        data.events = data.events.map((ev: any) => ({ ...ev, start: new Date(ev.start).toISOString(), end: new Date(ev.end).toISOString() }));
    }
    return data as DashboardData;
  }

  async getInitialData(): Promise<DashboardData> {
    if (this.isGoogleConnected()) {
        try { return await this.getRealInitialData(); }
        catch (e) { console.error('Falha ao carregar dados reais do Google, usando dados de demonstração:', e); }
    }
    if (this.isGasEnvironment()) {
      return new Promise((resolve) => {
        (window as any).google.script.run
          .withSuccessHandler((res: string) => { try { resolve(this.normalizeData(JSON.parse(res))); } catch (e) { resolve(this.normalizeData({} as any)); } })
          .withFailureHandler(() => resolve(this.normalizeData({} as any)))
          .getInitialData();
      });
    } else {
        return Promise.resolve(this.normalizeData(JSON.parse(JSON.stringify(MOCK_DATA))));
    }
  }

  private isGoogleConnected(): boolean {
      return googleAuth.isSignedIn();
  }

  private async getRealInitialData(): Promise<DashboardData> {
      const user = googleAuth.getUser()!;
      const now = new Date();
      const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const [events, calendars, taskLists, drive, emails, notes, storage] = await Promise.all([
          this.getEvents('primary', now.toISOString(), weekAhead.toISOString()).catch(() => []),
          this.getCalendars().catch(() => MOCK_CALENDARS),
          this.getTaskLists().catch(() => []),
          this.getDriveItems(null, 'root', '').catch(() => ({ files: [], folders: [], category: 'root', currentFolderId: null, currentFolderName: 'Meu Drive', parentId: null } as DriveResponse)),
          this.getEmailsPaged(0, 8, 'inbox').catch(() => []),
          this.getKeepNotes().catch(() => []),
          this.getStorageUsedPercent().catch(() => 0),
      ]);

      const tasks = taskLists[0] ? await this.getTasks(taskLists[0].id).catch(() => []) : [];

      return {
          user: {
              name: user.name,
              email: user.email,
              avatar: user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=4285F4&color=fff`,
          },
          weather: MOCK_DATA.weather,
          stats: { storageUsed: storage, unreadEmails: emails.filter((e: any) => !e.read).length },
          emails,
          calendars,
          events,
          files: [...(drive.folders || []), ...(drive.files || [])],
          tasks,
          taskLists,
          notes,
      };
  }

  private async getStorageUsedPercent(): Promise<number> {
      if (!this.isGoogleConnected()) return 0;
      const about = await gapi(`${DRIVE_API}/about?fields=storageQuota`);
      const quota = about?.storageQuota;
      if (!quota?.limit || !quota?.usage) return 0;
      return Math.round((Number(quota.usage) / Number(quota.limit)) * 100);
  }

  // --- MEET SIGNALING ---
  async registerMeeting(roomCode: string, peerId: string): Promise<boolean> { return Promise.resolve(true); }
  async getMeetingPeer(roomCode: string): Promise<string | null> { return Promise.resolve(null); }

  // --- CALENDAR ---
  private eventFromGoogle(ev: any, calendarId: string): CalendarEvent {
      const isAllDay = !!ev.start?.date && !ev.start?.dateTime;
      const meetEntry = ev.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video');
      return {
          id: ev.id,
          title: ev.summary || '(Sem título)',
          start: ev.start?.dateTime || ev.start?.date,
          end: ev.end?.dateTime || ev.end?.date,
          isAllDay,
          calendarId,
          description: ev.description,
          location: ev.location,
          recurrence: ev.recurrence,
          guests: (ev.attendees || []).map((a: any) => ({ email: a.email, name: a.displayName, responseStatus: a.responseStatus, organizer: !!a.organizer })),
          meetLink: ev.hangoutLink || meetEntry?.uri,
          timeZone: ev.start?.timeZone,
      };
  }

  private buildGoogleEventBody(data: Partial<CalendarEvent>): any {
      const body: any = {
          summary: data.title,
          description: data.description,
          location: data.location,
      };
      if (data.start) body.start = data.isAllDay ? { date: data.start.slice(0, 10) } : { dateTime: new Date(data.start).toISOString() };
      if (data.end) body.end = data.isAllDay ? { date: data.end.slice(0, 10) } : { dateTime: new Date(data.end).toISOString() };
      if (data.guests?.length) body.attendees = data.guests.map(g => ({ email: g.email }));
      if (data.recurrence) body.recurrence = data.recurrence;
      if (data.meetLink === '__create__') {
          body.conferenceData = { createRequest: { requestId: `google-os-${Date.now()}` } };
      }
      return body;
  }

  async getCalendars(): Promise<CalendarListEntry[]> {
      if (this.isGoogleConnected()) {
          const res = await gapi(`${CAL_API}/users/me/calendarList`);
          return (res.items || []).map((c: any) => ({
              id: c.id,
              name: c.summaryOverride || c.summary,
              color: c.backgroundColor || '#4285F4',
              checked: c.selected !== false,
              accessRole: c.accessRole === 'owner' ? 'owner' : (c.accessRole === 'reader' ? 'reader' : 'writer'),
          }));
      }
      if (this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).getCalendars());
      return Promise.resolve(MOCK_DATA.calendars || []);
  }
  async getEvents(calendarId: string, start: string, end: string): Promise<CalendarEvent[]> {
    if (this.isGoogleConnected()) {
        const calId = !calendarId || calendarId === 'primary' ? 'primary' : calendarId;
        const params = new URLSearchParams({ timeMin: start, timeMax: end, singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
        const res = await gapi(`${CAL_API}/calendars/${encodeURIComponent(calId)}/events?${params.toString()}`);
        return (res.items || []).filter((ev: any) => ev.status !== 'cancelled').map((ev: any) => this.eventFromGoogle(ev, calId));
    }
    if (this.isGasEnvironment()) {
        return new Promise((resolve) => {
            (window as any).google.script.run
                .withSuccessHandler((res: string) => resolve(JSON.parse(res).map((ev:any) => ({...ev, start: new Date(ev.start), end: new Date(ev.end)}))))
                .getEvents(calendarId, start, end);
        });
    }
    const startMs = new Date(start).getTime();
    const endMs   = new Date(end).getTime();
    const filtered = MOCK_EVENTS.filter(ev => {
        const evStart = new Date(ev.start).getTime();
        const matchesCalendar = !calendarId || calendarId === 'primary' || ev.calendarId === calendarId;
        const inRange = evStart >= startMs && evStart <= endMs;
        return matchesCalendar && inRange;
    });
    return Promise.resolve(filtered.map(ev => ({ ...ev, start: new Date(ev.start) as any, end: new Date(ev.end) as any })));
  }
  async createCalendarEvent(data: Partial<CalendarEvent>): Promise<{success: boolean, id?: string, meetLink?: string}> {
      if (this.isGoogleConnected()) {
          const calId = !data.calendarId || data.calendarId === 'primary' ? 'primary' : data.calendarId;
          const wantsMeet = data.meetLink === '__create__';
          const url = `${CAL_API}/calendars/${encodeURIComponent(calId)}/events${wantsMeet ? '?conferenceDataVersion=1' : ''}`;
          const res = await gapi(url, { method: 'POST', body: JSON.stringify(this.buildGoogleEventBody(data)) });
          return { success: true, id: res.id, meetLink: res.hangoutLink };
      }
      return Promise.resolve({success:true, id: `local_${Date.now()}`});
  }
  async checkFreeBusy(start: string, end: string, emails: string[]): Promise<any> {
      if (this.isGoogleConnected()) {
          const res = await gapi(`${CAL_API}/freeBusy`, {
              method: 'POST',
              body: JSON.stringify({ timeMin: start, timeMax: end, items: emails.map(email => ({ id: email })) }),
          });
          return { success: true, calendars: res.calendars };
      }
      return Promise.resolve({ success: true });
  }
  async updateCalendarEvent(data: Partial<CalendarEvent>): Promise<{success: boolean}> {
      if (this.isGoogleConnected() && data.id) {
          const calId = !data.calendarId || data.calendarId === 'primary' ? 'primary' : data.calendarId;
          await gapi(`${CAL_API}/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(data.id)}`, {
              method: 'PATCH',
              body: JSON.stringify(this.buildGoogleEventBody(data)),
          });
          return { success: true };
      }
      return Promise.resolve({success:true});
  }
  async deleteCalendarEvent(id: string, calendarId?: string): Promise<boolean> {
      if (this.isGoogleConnected()) {
          const calId = !calendarId || calendarId === 'primary' ? 'primary' : calendarId;
          await gapi(`${CAL_API}/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(id)}`, { method: 'DELETE' });
          return true;
      }
      return Promise.resolve(true);
  }
  async rsvpEvent(eventId: string, status: 'accepted'|'declined'|'tentative', calendarId: string = 'primary'): Promise<boolean> {
      if (this.isGoogleConnected()) {
          const user = googleAuth.getUser();
          const event = await gapi(`${CAL_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`);
          const attendees = (event.attendees || []).map((a: any) => a.email === user?.email ? { ...a, responseStatus: status } : a);
          await gapi(`${CAL_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
              method: 'PATCH',
              body: JSON.stringify({ attendees }),
          });
          return true;
      }
      return Promise.resolve(true);
  }
  
  // --- MAIL & CONTACTS ---
  private gmailPageTokens: Record<string, string | undefined> = {};

  private static readonly FOLDER_LABELS: { [key: string]: string } = {
      inbox: 'INBOX', sent: 'SENT', starred: 'STARRED', trash: 'TRASH', drafts: 'DRAFT', spam: 'SPAM',
  };

  private async gmailMessageToEmail(id: string): Promise<any> {
      const msg = await gapi(`${GMAIL_API}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`);
      const { name: sender, email: senderEmail } = parseFromHeader(findHeader(msg.payload?.headers, 'From'));
      const isUnread = (msg.labelIds || []).includes('UNREAD');
      return {
          id: msg.id,
          threadId: msg.threadId,
          sender,
          senderInit: (sender[0] || '?').toUpperCase(),
          senderEmail,
          subject: findHeader(msg.payload?.headers, 'Subject') || '(sem assunto)',
          preview: msg.snippet || '',
          time: formatEmailTime(findHeader(msg.payload?.headers, 'Date')),
          color: colorForName(sender),
          read: !isUnread,
          starred: (msg.labelIds || []).includes('STARRED'),
          labels: msg.labelIds || [],
          hasAttachment: false,
      };
  }

  async searchAll(query: string): Promise<SearchResults> {
    if (!query) return Promise.resolve({ emails: [], files: [], events: [] });
    if (this.isGoogleConnected()) {
        try {
            const [gmailRes, driveRes, calRes] = await Promise.all([
                gapi(`${GMAIL_API}/messages?q=${encodeURIComponent(query)}&maxResults=5`).catch(() => ({ messages: [] })),
                gapi(`${DRIVE_API}/files?q=${encodeURIComponent(`name contains '${query.replace(/'/g, "\\'")}' and trashed=false`)}&pageSize=5&fields=files(id,name,mimeType,webViewLink)`).catch(() => ({ files: [] })),
                gapi(`${CAL_API}/calendars/primary/events?q=${encodeURIComponent(query)}&maxResults=5&singleEvents=true`).catch(() => ({ items: [] })),
            ]);
            const emails = await Promise.all((gmailRes.messages || []).slice(0, 5).map((m: any) => this.gmailMessageToEmail(m.id).catch(() => null)));
            return {
                emails: emails.filter(Boolean),
                files: (driveRes.files || []).map((f: any) => ({ id: f.id, name: f.name, type: typeForMime(f.mimeType), webViewLink: f.webViewLink })),
                events: (calRes.items || []).map((ev: any) => this.eventFromGoogle(ev, 'primary')),
            };
        } catch (e) {
            console.error('Busca real falhou, usando fallback local:', e);
        }
    }
    const q = query.toLowerCase();
    return Promise.resolve({
      emails: MOCK_EMAILS.filter(e => e.subject.toLowerCase().includes(q) || e.preview.toLowerCase().includes(q) || e.sender.toLowerCase().includes(q)),
      files:  MOCK_FILES.filter(f => f.name.toLowerCase().includes(q)),
      events: MOCK_EVENTS.filter(e => e.title.toLowerCase().includes(q)),
    });
  }
  async getEmailsPaged(start: number, limit: number, folder: string, query: string = ''): Promise<any[]> {
    if (this.isGoogleConnected()) {
        const key = `${folder}:${query}`;
        if (start === 0) delete this.gmailPageTokens[key];
        const params = new URLSearchParams({ maxResults: String(limit) });
        const label = GASBridge.FOLDER_LABELS[folder];
        if (label) params.set('labelIds', label);
        if (query) params.set('q', query);
        const pageToken = this.gmailPageTokens[key];
        if (pageToken) params.set('pageToken', pageToken);
        const res = await gapi(`${GMAIL_API}/messages?${params.toString()}`);
        this.gmailPageTokens[key] = res.nextPageToken;
        const ids: string[] = (res.messages || []).map((m: any) => m.id);
        const emails = await Promise.all(ids.map(id => this.gmailMessageToEmail(id).catch(() => null)));
        return emails.filter(Boolean);
    }
    return Promise.resolve([]);
  }
  async createLabel(name: string): Promise<boolean> {
      if (this.isGoogleConnected()) {
          await gapi(`${GMAIL_API}/labels`, { method: 'POST', body: JSON.stringify({ name, labelListVisibility: 'labelShow', messageListVisibility: 'show' }) });
          return true;
      }
      return Promise.resolve(true);
  }
  async batchManageEmails(ids: Array<number | string>, action: string): Promise<boolean> {
      if (this.isGoogleConnected()) {
          const ops: { [key: string]: { add?: string[]; remove?: string[] } } = {
              read: { remove: ['UNREAD'] },
              unread: { add: ['UNREAD'] },
              star: { add: ['STARRED'] },
              unstar: { remove: ['STARRED'] },
              archive: { remove: ['INBOX'] },
          };
          await Promise.all(ids.map(async (id) => {
              const strId = encodeURIComponent(String(id));
              if (action === 'trash') return gapi(`${GMAIL_API}/messages/${strId}/trash`, { method: 'POST' });
              if (action === 'delete') return gapi(`${GMAIL_API}/messages/${strId}`, { method: 'DELETE' });
              const op = ops[action];
              if (!op) return;
              return gapi(`${GMAIL_API}/messages/${strId}/modify`, {
                  method: 'POST',
                  body: JSON.stringify({ addLabelIds: op.add || [], removeLabelIds: op.remove || [] }),
              });
          }));
          return true;
      }
      return Promise.resolve(true);
  }
  async snoozeEmail(id: number | string, until: string): Promise<boolean> { return Promise.resolve(true); }
  async sendEmail(to: string, subject: string, body: string, attachments: EmailAttachment[] = []): Promise<boolean> {
      if (this.isGoogleConnected()) {
          const raw = buildRawEmail(to, subject, body, attachments, googleAuth.getUser()?.email);
          await gapi(`${GMAIL_API}/messages/send`, { method: 'POST', body: JSON.stringify({ raw }) });
          return true;
      }
      return Promise.resolve(true);
  }
  async scheduleSend(to: string, subject: string, body: string, time: string, attachments: EmailAttachment[] = []): Promise<boolean> { return Promise.resolve(true); }
  async saveDraft(to: string, subject: string, body: string, attachments: EmailAttachment[] = []): Promise<boolean> {
      if (this.isGoogleConnected()) {
          const raw = buildRawEmail(to, subject, body, attachments, googleAuth.getUser()?.email);
          await gapi(`${GMAIL_API}/drafts`, { method: 'POST', body: JSON.stringify({ message: { raw } }) });
          return true;
      }
      return Promise.resolve(true);
  }
  async getThreadDetails(threadId: string | number): Promise<any> {
      if (this.isGoogleConnected()) {
          const thread = await gapi(`${GMAIL_API}/threads/${encodeURIComponent(String(threadId))}?format=full`);
          const messages = (thread.messages || []).map((msg: any) => {
              const acc: { html?: string; text?: string; attachments: any[] } = { attachments: [] };
              walkGmailParts(msg.payload, acc);
              const { name: sender, email: senderEmail } = parseFromHeader(findHeader(msg.payload?.headers, 'From'));
              return {
                  id: msg.id,
                  sender,
                  senderEmail,
                  to: findHeader(msg.payload?.headers, 'To'),
                  subject: findHeader(msg.payload?.headers, 'Subject'),
                  date: findHeader(msg.payload?.headers, 'Date'),
                  body: acc.html || (acc.text ? `<p>${acc.text.replace(/\n/g, '<br/>')}</p>` : ''),
                  attachments: acc.attachments,
              };
          });
          return { success: true, messages };
      }
      return Promise.resolve({ success: true, messages: [] });
  }
  async getEmailAttachment(messageId: string, attachmentIndex: number): Promise<FileContentResponse> {
      if (this.isGoogleConnected()) {
          const msg = await gapi(`${GMAIL_API}/messages/${encodeURIComponent(messageId)}?format=full`);
          const acc: { attachments: any[] } = { attachments: [] };
          walkGmailParts(msg.payload, acc as any);
          const target = acc.attachments[attachmentIndex];
          if (!target) return { success: false, error: 'Anexo não encontrado' };
          const att = await gapi(`${GMAIL_API}/messages/${encodeURIComponent(messageId)}/attachments/${target.attachmentId}`);
          const base64 = (att.data || '').replace(/-/g, '+').replace(/_/g, '/');
          return { success: true, data: base64, mimeType: target.mimeType, name: target.filename };
      }
      return Promise.resolve({ success: false });
  }
  async searchContacts(query: string): Promise<any[]> {
    if (!query) return Promise.resolve([]);
    if (this.isGoogleConnected()) {
        try {
            const params = new URLSearchParams({ query, readMask: 'names,emailAddresses,photos', pageSize: '10' });
            const res = await gapi(`${PEOPLE_API}/people:searchContacts?${params.toString()}`);
            return (res.results || []).map((r: any) => {
                const person = r.person || {};
                const name = person.names?.[0]?.displayName || person.emailAddresses?.[0]?.value || '';
                return {
                    name,
                    email: person.emailAddresses?.[0]?.value || '',
                    avatar: person.photos?.[0]?.url || (name[0] || '?').toUpperCase(),
                };
            }).filter((c: any) => c.email);
        } catch (e) {
            console.error('Busca de contatos falhou:', e);
            return [];
        }
    }
    const contacts = [
      { name: 'Gabriel Silva',  email: 'gabriel@example.com', avatar: 'G' },
      { name: 'Ana Lima',       email: 'ana@example.com',     avatar: 'A' },
      { name: 'Pedro Moreira',  email: 'pedro@example.com',   avatar: 'P' },
      { name: 'Carlos Eduardo', email: 'carlos@example.com',  avatar: 'C' },
    ];
    const q = query.toLowerCase();
    return Promise.resolve(contacts.filter(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)));
  }

  // --- DRIVE ---
  private driveItemFromGoogle(f: any): DriveItem {
      return {
          id: f.id,
          name: f.name,
          type: typeForMime(f.mimeType),
          mimeType: f.mimeType,
          owner: f.owners?.[0]?.displayName || f.owners?.[0]?.emailAddress || 'eu',
          date: f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString() : '',
          size: f.size ? `${Math.round(Number(f.size) / 1024)} KB` : undefined,
          thumbnail: f.thumbnailLink,
          isStarred: !!f.starred,
          webViewLink: f.webViewLink,
          parentId: f.parents?.[0],
          trashed: !!f.trashed,
      };
  }

  async getDriveItems(folderId: string | null, category: string, query: string): Promise<DriveResponse> {
      if (this.isGoogleConnected()) {
          const clauses: string[] = [];
          const escaped = query.replace(/'/g, "\\'");
          if (category === 'trash') {
              clauses.push('trashed=true');
          } else {
              clauses.push('trashed=false');
              if (category === 'starred') clauses.push('starred=true');
              else if (category === 'shared') clauses.push('sharedWithMe=true');
              else if (folderId) clauses.push(`'${folderId}' in parents`);
              else clauses.push("'root' in parents");
          }
          if (query) clauses.push(`name contains '${escaped}'`);
          const fields = 'files(id,name,mimeType,owners,modifiedTime,size,thumbnailLink,starred,webViewLink,parents,trashed)';
          const params = new URLSearchParams({ q: clauses.join(' and '), fields, orderBy: 'folder,modifiedTime desc', pageSize: '100' });
          const res = await gapi(`${DRIVE_API}/files?${params.toString()}`);
          const items = (res.files || []).map((f: any) => this.driveItemFromGoogle(f));
          let currentFolderName = 'Meu Drive';
          if (category === 'starred') currentFolderName = 'Com estrela';
          else if (category === 'shared') currentFolderName = 'Compartilhados comigo';
          else if (category === 'trash') currentFolderName = 'Lixeira';
          let parentId: string | null = null;
          if (folderId) {
              try {
                  const folder = await gapi(`${DRIVE_API}/files/${folderId}?fields=name,parents`);
                  currentFolderName = folder.name;
                  parentId = folder.parents?.[0] || null;
              } catch { /* ignore */ }
          }
          return {
              category: category || 'root',
              currentFolderId: folderId,
              currentFolderName,
              parentId,
              folders: items.filter((i: DriveItem) => i.type === 'folder'),
              files: items.filter((i: DriveItem) => i.type !== 'folder'),
          };
      }
      if(this.isGasEnvironment()) return new Promise((r,rj)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).withFailureHandler(rj).getDriveItems({folderId, category, query}));
      return Promise.resolve({ files: MOCK_FILES, folders: [], category: category || 'root', currentFolderName: 'Meu Drive', currentFolderId: null, parentId: null });
  }
  async getFolderTree(parentId?: string | null): Promise<DriveItem[]> {
      if (this.isGoogleConnected()) {
          const q = `'${parentId || 'root'}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
          const res = await gapi(`${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)`);
          return (res.files || []).map((f: any) => ({ id: f.id, name: f.name, type: 'folder', owner: 'eu', date: '' }));
      }
      return Promise.resolve([]);
  }
  async createDriveFolder(name: string, parentId: string | null): Promise<boolean> {
      if (this.isGoogleConnected()) {
          await gapi(`${DRIVE_API}/files`, { method: 'POST', body: JSON.stringify({ name, mimeType: driveMimeForType('folder'), parents: [parentId || 'root'] }) });
          return true;
      }
      if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).createDriveFolder(name,parentId));
      return Promise.resolve(true);
  }
  async renameDriveItem(id: string, name: string): Promise<boolean> {
      if (this.isGoogleConnected()) { await gapi(`${DRIVE_API}/files/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }); return true; }
      if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).renameDriveItem(id,name));
      return Promise.resolve(true);
  }
  async trashDriveItem(id: string): Promise<boolean> {
      if (this.isGoogleConnected()) { await gapi(`${DRIVE_API}/files/${id}`, { method: 'PATCH', body: JSON.stringify({ trashed: true }) }); return true; }
      if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).trashDriveItem(id));
      return Promise.resolve(true);
  }
  async restoreDriveItem(id: string): Promise<boolean> {
      if (this.isGoogleConnected()) { await gapi(`${DRIVE_API}/files/${id}`, { method: 'PATCH', body: JSON.stringify({ trashed: false }) }); return true; }
      return Promise.resolve(true);
  }
  async deleteDriveItemForever(id: string): Promise<boolean> {
      if (this.isGoogleConnected()) { await gapi(`${DRIVE_API}/files/${id}`, { method: 'DELETE' }); return true; }
      return Promise.resolve(true);
  }
  async emptyTrash(): Promise<boolean> {
      if (this.isGoogleConnected()) {
          const res = await gapi(`${DRIVE_API}/files?q=${encodeURIComponent('trashed=true')}&fields=files(id)`);
          await Promise.all((res.files || []).map((f: any) => gapi(`${DRIVE_API}/files/${f.id}`, { method: 'DELETE' })));
          return true;
      }
      return Promise.resolve(true);
  }
  async setStarredDriveItem(id: string, starred: boolean): Promise<boolean> {
      if (this.isGoogleConnected()) { await gapi(`${DRIVE_API}/files/${id}`, { method: 'PATCH', body: JSON.stringify({ starred }) }); return true; }
      if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).setStarredDriveItem(id,starred));
      return Promise.resolve(true);
  }
  async uploadFileToDrive(data: string, name: string, mimeType: string, parentId: string | null): Promise<boolean> {
      if (this.isGoogleConnected()) {
          const token = googleAuth.getAccessToken();
          if (!token) return false;
          const metadata = { name, parents: [parentId || 'root'] };
          const boundary = `----=_GoogleOS_${Date.now()}`;
          const body =
              `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
              `--${boundary}\r\nContent-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n${data}\r\n` +
              `--${boundary}--`;
          const res = await fetch(`${DRIVE_UPLOAD_API}?uploadType=multipart`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
              body,
          });
          return res.ok;
      }
      if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).uploadFileToDrive(data,name,mimeType,parentId));
      return Promise.resolve(true);
  }
  async getFileContent(id: string): Promise<FileContentResponse> {
      if (this.isGasEnvironment()) return new Promise((r,rj)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).withFailureHandler(rj).getFileContent(id));
      return Promise.resolve({success:false});
  }
  async saveFileContent(id: string, content: string): Promise<boolean> {
      if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).saveFileContent(id, content));
      return Promise.resolve(true);
  }
  async moveDriveItem(itemId: string, targetFolderId: string): Promise<boolean> {
      if (this.isGoogleConnected()) {
          const file = await gapi(`${DRIVE_API}/files/${itemId}?fields=parents`);
          const removeParents = (file.parents || []).join(',');
          await gapi(`${DRIVE_API}/files/${itemId}?addParents=${targetFolderId || 'root'}&removeParents=${removeParents}`, { method: 'PATCH', body: JSON.stringify({}) });
          return true;
      }
      if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).moveDriveItem(itemId, targetFolderId));
      return Promise.resolve(true);
  }
  async getFilePermissions(fileId: string): Promise<Permission[]> {
      if (this.isGoogleConnected()) {
          const res = await gapi(`${DRIVE_API}/files/${fileId}/permissions?fields=permissions(id,displayName,emailAddress,role,photoLink)`);
          return (res.permissions || []).map((p: any) => ({ id: p.id, name: p.displayName || p.emailAddress, email: p.emailAddress, role: p.role === 'writer' ? 'editor' : (p.role === 'owner' ? 'owner' : 'viewer'), avatar: p.photoLink }));
      }
      return Promise.resolve([]);
  }
  async addDrivePermission(fileId: string, email: string, role: string): Promise<boolean> {
      if (this.isGoogleConnected()) {
          const gRole = role === 'editor' ? 'writer' : 'reader';
          await gapi(`${DRIVE_API}/files/${fileId}/permissions`, { method: 'POST', body: JSON.stringify({ type: 'user', role: gRole, emailAddress: email }) });
          return true;
      }
      return Promise.resolve(true);
  }
  async removeDrivePermission(fileId: string, email: string): Promise<boolean> {
      if (this.isGoogleConnected()) {
          const res = await gapi(`${DRIVE_API}/files/${fileId}/permissions?fields=permissions(id,emailAddress)`);
          const perm = (res.permissions || []).find((p: any) => p.emailAddress === email);
          if (perm) await gapi(`${DRIVE_API}/files/${fileId}/permissions/${perm.id}`, { method: 'DELETE' });
          return true;
      }
      return Promise.resolve(true);
  }
  async getDriveShareLink(fileId: string): Promise<string> {
      if (this.isGoogleConnected()) {
          try { await gapi(`${DRIVE_API}/files/${fileId}/permissions`, { method: 'POST', body: JSON.stringify({ type: 'anyone', role: 'reader' }) }); } catch { /* já pode ser público */ }
          const file = await gapi(`${DRIVE_API}/files/${fileId}?fields=webViewLink`);
          return file.webViewLink || `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
      }
      return Promise.resolve("");
  }
  async getFileVersions(fileId: string): Promise<FileVersion[]> {
      if (this.isGoogleConnected()) {
          const res = await gapi(`${DRIVE_API}/files/${fileId}/revisions?fields=revisions(id,modifiedTime,lastModifyingUser,size)`);
          return (res.revisions || []).map((r: any) => ({ id: r.id, date: r.modifiedTime, author: r.lastModifyingUser?.displayName || 'eu', size: r.size ? `${Math.round(Number(r.size) / 1024)} KB` : '' }));
      }
      return Promise.resolve([]);
  }

  /** Cria um Doc/Sheet/Slide real no Drive do usuário e devolve o link para abrir no app oficial do Google. */
  async createGoogleAppFile(type: 'doc' | 'sheet' | 'slide', name?: string): Promise<{ id: string; webViewLink: string } | null> {
      if (!this.isGoogleConnected()) return null;
      const defaultNames: { [k: string]: string } = { doc: 'Documento sem título', sheet: 'Planilha sem título', slide: 'Apresentação sem título' };
      const res = await gapi(`${DRIVE_API}/files?fields=id,webViewLink`, {
          method: 'POST',
          body: JSON.stringify({ name: name || defaultNames[type], mimeType: driveMimeForType(type) }),
      });
      return { id: res.id, webViewLink: res.webViewLink };
  }

  /** Resolve o link real de um arquivo do Drive (usado para abrir Docs/Sheets/Slides existentes no app oficial). */
  async getWebViewLink(fileId: string): Promise<string | null> {
      if (!this.isGoogleConnected()) return null;
      const res = await gapi(`${DRIVE_API}/files/${fileId}?fields=webViewLink`);
      return res.webViewLink || null;
  }

  // --- TASKS ---
  private taskFromGoogle(t: any, listId: string): TaskItem {
      return {
          id: t.id,
          title: t.title || '(Sem título)',
          details: t.notes,
          completed: t.status === 'completed',
          date: t.due,
          parent: t.parent,
          position: t.position,
          listId,
      };
  }

  async getTaskLists(): Promise<TaskList[]> {
      if (this.isGoogleConnected()) {
          const res = await gapi(`${TASKS_API}/users/@me/lists`);
          return (res.items || []).map((l: any) => ({ id: l.id, title: l.title }));
      }
      return Promise.resolve([{ id: 'default', title: 'Minhas Tarefas' }]);
  }
  async getTasks(listId: string): Promise<TaskItem[]> {
      if (this.isGoogleConnected()) {
          const list = listId || '@default';
          const params = new URLSearchParams({ showCompleted: 'true', showHidden: 'true', maxResults: '200' });
          const res = await gapi(`${TASKS_API}/lists/${encodeURIComponent(list)}/tasks?${params.toString()}`);
          const flat = (res.items || []).map((t: any) => this.taskFromGoogle(t, list));
          return buildTaskTree(flat);
      }
      return Promise.resolve(MOCK_TASKS);
  }
  async createTaskList(title: string): Promise<TaskList | null> {
      if (this.isGoogleConnected()) {
          const res = await gapi(`${TASKS_API}/users/@me/lists`, { method: 'POST', body: JSON.stringify({ title }) });
          return { id: res.id, title: res.title };
      }
      return Promise.resolve(null);
  }
  async deleteTaskList(id: string): Promise<boolean> {
      if (this.isGoogleConnected()) {
          await gapi(`${TASKS_API}/users/@me/lists/${encodeURIComponent(id)}`, { method: 'DELETE' });
          return true;
      }
      return Promise.resolve(true);
  }
  async createTask(title: string, details?: string, listId?: string, due?: string, parent?: string): Promise<any> {
      if (this.isGoogleConnected()) {
          const list = listId || '@default';
          const params = new URLSearchParams();
          if (parent) params.set('parent', parent);
          const body: any = { title, notes: details || undefined };
          if (due) body.due = new Date(due).toISOString();
          const res = await gapi(`${TASKS_API}/lists/${encodeURIComponent(list)}/tasks${params.toString() ? `?${params}` : ''}`, {
              method: 'POST',
              body: JSON.stringify(body),
          });
          return { success: true, task: this.taskFromGoogle(res, list) };
      }
      return Promise.resolve({ success: true, task: {id: Date.now().toString(), title, completed: false} });
  }
  async toggleTask(id: string | number, listId?: string): Promise<boolean> {
      if (this.isGoogleConnected()) {
          const list = listId || '@default';
          const current = await gapi(`${TASKS_API}/lists/${encodeURIComponent(list)}/tasks/${encodeURIComponent(String(id))}`);
          const nowCompleted = current.status !== 'completed';
          await gapi(`${TASKS_API}/lists/${encodeURIComponent(list)}/tasks/${encodeURIComponent(String(id))}`, {
              method: 'PATCH',
              body: JSON.stringify({ status: nowCompleted ? 'completed' : 'needsAction' }),
          });
          return true;
      }
      return Promise.resolve(true);
  }
  async updateTask(task: Partial<TaskItem>): Promise<boolean> {
      if (this.isGoogleConnected() && task.id) {
          const list = task.listId || '@default';
          const body: any = {};
          if (task.title !== undefined) body.title = task.title;
          if (task.details !== undefined) body.notes = task.details;
          if (task.date !== undefined) body.due = task.date ? new Date(task.date).toISOString() : null;
          if (task.completed !== undefined) body.status = task.completed ? 'completed' : 'needsAction';
          await gapi(`${TASKS_API}/lists/${encodeURIComponent(list)}/tasks/${encodeURIComponent(task.id)}`, {
              method: 'PATCH',
              body: JSON.stringify(body),
          });
          return true;
      }
      return Promise.resolve(true);
  }
  async deleteTask(id: string | number, listId?: string): Promise<boolean> {
      if (this.isGoogleConnected()) {
          const list = listId || '@default';
          await gapi(`${TASKS_API}/lists/${encodeURIComponent(list)}/tasks/${encodeURIComponent(String(id))}`, { method: 'DELETE' });
          return true;
      }
      return Promise.resolve(true);
  }
  
  // --- KEEP (sem API oficial: notas sincronizadas via Drive appDataFolder) ---
  private static readonly KEEP_FILE_NAME = 'google_os_keep_notes.json';
  private keepFileIdCache: string | null = null;

  private async findKeepFileId(): Promise<string | null> {
      if (this.keepFileIdCache) return this.keepFileIdCache;
      const params = new URLSearchParams({ q: `name='${GASBridge.KEEP_FILE_NAME}' and trashed=false`, spaces: 'appDataFolder', fields: 'files(id)' });
      const res = await gapi(`${DRIVE_API}/files?${params.toString()}`);
      this.keepFileIdCache = res.files?.[0]?.id || null;
      return this.keepFileIdCache;
  }

  async getKeepNotes(): Promise<NoteItem[]> {
      if (!this.isGoogleConnected()) return this.readStore<NoteItem[]>('workspace_keep_notes', []);
      try {
          const fileId = await this.findKeepFileId();
          if (!fileId) return [];
          const token = googleAuth.getAccessToken();
          const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, { headers: { Authorization: `Bearer ${token}` } });
          if (!res.ok) return [];
          return await res.json();
      } catch (e) {
          console.error('Falha ao ler notas do Keep (Drive appDataFolder):', e);
          return [];
      }
  }

  private async saveKeepNotes(notes: NoteItem[]): Promise<boolean> {
      if (!this.isGoogleConnected()) { this.writeStore('workspace_keep_notes', notes); return true; }
      const token = googleAuth.getAccessToken();
      if (!token) return false;
      const fileId = await this.findKeepFileId();
      const payload = JSON.stringify(notes);
      if (fileId) {
          const res = await fetch(`${DRIVE_UPLOAD_API}/${fileId}?uploadType=media`, {
              method: 'PATCH',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: payload,
          });
          return res.ok;
      }
      const boundary = `----=_GoogleOS_${Date.now()}`;
      const metadata = { name: GASBridge.KEEP_FILE_NAME, parents: ['appDataFolder'] };
      const body =
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
          `--${boundary}\r\nContent-Type: application/json\r\n\r\n${payload}\r\n` +
          `--${boundary}--`;
      const res = await fetch(`${DRIVE_UPLOAD_API}?uploadType=multipart`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
          body,
      });
      if (res.ok) { const created = await res.json(); this.keepFileIdCache = created.id; }
      return res.ok;
  }

  async addNote(note: NoteItem): Promise<boolean> {
      const notes = await this.getKeepNotes();
      const idx = notes.findIndex(n => n.id === note.id);
      if (idx >= 0) notes[idx] = note; else notes.unshift(note);
      return this.saveKeepNotes(notes);
  }
  async deleteNote(id: number | string): Promise<boolean> {
      const notes = await this.getKeepNotes();
      return this.saveKeepNotes(notes.filter(n => String(n.id) !== String(id)));
  }
  async uploadKeepImage(base64: string, mime: string): Promise<{success: boolean, id?: string, url?: string}> {
      if (this.isGoogleConnected()) {
          const ok = await this.uploadFileToDrive(base64, `keep_${Date.now()}.${mime.split('/')[1] || 'jpg'}`, mime, null);
          return { success: ok };
      }
      return Promise.resolve({success:true, id: 'mock_img_id', url: 'https://source.unsplash.com/random/200x200'});
  }

  // --- SEGURANÇA & AUDITORIA (herdado do Google Workspace Hub) ---
  private readStore<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) as T : fallback;
    } catch { return fallback; }
  }
  private writeStore<T>(key: string, value: T) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage indisponível */ }
  }
  private seedAuditLogs(): AuditLog[] {
    const now = Date.now();
    const mk = (minAgo: number, action: string, details: string, status: LogStatus): AuditLog => ({
        id: `log_${now - minAgo * 60000}_${Math.random().toString(36).slice(2, 7)}`,
        action, details, status,
        timestamp: new Date(now - minAgo * 60000).toISOString(),
        ipAddress: '187.45.101.20',
        device: typeof navigator !== 'undefined' ? navigator.userAgent : 'Desconhecido'
    });
    return [
        mk(2,   'LOGIN_SUCCESS',    'Sessão iniciada no Workspace OS com credenciais válidas.', 'SUCCESS'),
        mk(45,  'CALENDAR_READ',    'Leitura autorizada dos eventos da agenda pessoal.',        'SUCCESS'),
        mk(120, 'TASKS_SYNC',       'Sincronização das listas de tarefas concluída.',           'SUCCESS'),
        mk(300, 'LOGIN_FAILURE',    'Tentativa de login com senha incorreta (1/3).',            'FAILURE'),
    ];
  }
  async getAuditLogs(): Promise<AuditLog[]> {
    let logs = this.readStore<AuditLog[]>('workspace_audit_logs', []);
    if (logs.length === 0) {
        logs = this.seedAuditLogs();
        this.writeStore('workspace_audit_logs', logs);
    }
    return Promise.resolve([...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
  }
  async logAudit(action: string, details: string, status: LogStatus = 'SUCCESS'): Promise<AuditLog> {
    const logs = await this.getAuditLogs();
    const entry: AuditLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        action, details, status,
        timestamp: new Date().toISOString(),
        ipAddress: '187.45.101.20',
        device: typeof navigator !== 'undefined' ? navigator.userAgent : 'Desconhecido'
    };
    this.writeStore('workspace_audit_logs', [entry, ...logs].slice(0, 200));
    return Promise.resolve(entry);
  }
  async simulateAttack(type: string): Promise<AuditLog> {
    const attacks: { [key: string]: { action: string, details: string } } = {
        unauthorized_calendar: { action: 'INTRUSION_CALENDAR', details: 'Script externo tentou ler a agenda sem token de autorização. Requisição bloqueada pelo firewall de aplicação.' },
        csrf_session:          { action: 'CSRF_HIJACK',        details: 'Tentativa de sequestro de sessão via requisição forjada de IP suspeito. Token invalidado e sessão preservada.' },
        sqli_malicious:        { action: 'SQL_INJECTION',      details: "Payload malicioso (' OR 1=1 --) detectado no campo de notas. Entrada sanitizada e transação descartada." },
    };
    const attack = attacks[type] || { action: 'UNKNOWN_ATTACK', details: 'Atividade anômala detectada e bloqueada.' };
    return this.logAudit(attack.action, attack.details, 'BLOCKED');
  }
  async getSecurityState(): Promise<SecurityState> {
    return Promise.resolve(this.readStore<SecurityState>('workspace_security', { mfaEnabled: false, mfaSecret: '' }));
  }
  generateMfaSecret(): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let secret = '';
    for (let i = 0; i < 16; i++) secret += alphabet[Math.floor(Math.random() * alphabet.length)];
    return secret;
  }
  async setMfaEnabled(enabled: boolean, secret?: string): Promise<SecurityState> {
    const state: SecurityState = { mfaEnabled: enabled, mfaSecret: enabled ? (secret || this.generateMfaSecret()) : '' };
    this.writeStore('workspace_security', state);
    await this.logAudit(enabled ? 'MFA_ENABLED' : 'MFA_DISABLED', enabled ? 'Autenticação de dois fatores (TOTP) ativada para a conta.' : 'Autenticação de dois fatores desativada a pedido do usuário.');
    return Promise.resolve(state);
  }

  // --- PERMISSÕES DE COMPARTILHAMENTO (herdado do Google Workspace Hub) ---
  async getPermissions(currentUserEmail: string): Promise<{ sharedByMe: SharedPermission[], sharedWithMe: SharedPermission[] }> {
    const all = this.readStore<SharedPermission[]>('workspace_permissions', []);
    return Promise.resolve({
        sharedByMe:   all.filter(p => p.ownerEmail === currentUserEmail && p.status === 'ACTIVE'),
        sharedWithMe: all.filter(p => p.collaboratorEmail === currentUserEmail && p.status === 'ACTIVE'),
    });
  }
  async createPermission(ownerEmail: string, collaboratorEmail: string, resourceType: ResourceType, accessLevel: AccessLevel): Promise<SharedPermission> {
    const all = this.readStore<SharedPermission[]>('workspace_permissions', []);
    const perm: SharedPermission = {
        id: `perm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        ownerEmail, collaboratorEmail, resourceType, accessLevel,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
    };
    this.writeStore('workspace_permissions', [perm, ...all]);
    await this.logAudit('PERMISSION_GRANTED', `Compartilhamento (${resourceType}/${accessLevel}) concedido para ${collaboratorEmail}.`);
    return Promise.resolve(perm);
  }
  async updatePermission(id: string, accessLevel: AccessLevel): Promise<boolean> {
    const all = this.readStore<SharedPermission[]>('workspace_permissions', []);
    const perm = all.find(p => p.id === id);
    if (!perm) return Promise.resolve(false);
    perm.accessLevel = accessLevel;
    this.writeStore('workspace_permissions', all);
    await this.logAudit('PERMISSION_UPDATED', `Nível de acesso de ${perm.collaboratorEmail} alterado para ${accessLevel.toUpperCase()}.`);
    return Promise.resolve(true);
  }
  async revokePermission(id: string): Promise<boolean> {
    const all = this.readStore<SharedPermission[]>('workspace_permissions', []);
    const perm = all.find(p => p.id === id);
    if (!perm) return Promise.resolve(false);
    perm.status = 'REVOKED';
    this.writeStore('workspace_permissions', all);
    await this.logAudit('PERMISSION_REVOKED', `Todos os acessos de ${perm.collaboratorEmail} foram revogados.`, 'BLOCKED');
    return Promise.resolve(true);
  }
}

export const bridge = new GASBridge();