import { escapeHtml, encodeBase64Utf8 } from './sanitize';
import { makeInitialsAvatar } from './avatars';
import { getWorkspaceAccessToken } from './firebase';
import { confirmWorkspaceAction } from './workspaceConfirm';
import {
  createCalendarEventRemote,
  createDriveFileRemote,
  createGoogleMeetSpaceRemote,
  createTaskRemote,
  deleteCalendarEventRemote,
  deleteDriveFileRemote,
  deleteTaskRemote,
  fetchCalendarEventsRemote,
  fetchDriveFilesRemote,
  fetchGmailMessagesRemote,
  fetchGoogleDocHtmlRemote,
  fetchGoogleSheetGridRemote,
  fetchGoogleSlidesRemote,
  fetchTasksAndListsRemote,
  renameDriveFileRemote,
  sendGmailMessageRemote,
  trashDriveFileRemote,
  trashGmailMessageRemote,
  updateCalendarEventRemote,
  updateGoogleDocTextRemote,
  updateTaskRemote,
} from './googleWorkspaceApi';
import type { EmailItem, EmailThreadMessage, MailLabel } from './mailLogic';
import { isDescendantFolder, type EnrichedDriveItem } from './driveLogic';

export type { EmailItem, EmailThreadMessage, MailLabel };

const REAL_ONLY_MIGRATION_KEY = 'workspace_real_only_v1';
const USER_SESSION_STORE_KEYS = [
  'workspace_emails_v2',
  'workspace_labels_v2',
  'workspace_events_v2',
  'workspace_calendars_v2',
  'workspace_drive_items_v2',
  'workspace_tasks_v2',
  'workspace_task_lists_v2',
  'workspace_notes_v2',
  'workspace_keep_labels_v2',
  'workspace_audit_logs',
  'workspace_permissions',
  'workspace_permissions_initialized',
  'workspace_active_sessions_v1',
  'workspace_oauth_apps_v1',
];

function createEmptyWorkspaceData(user: CloudUserProfile | null): DashboardData {
  const displayName = user?.name || 'Visitante';
  const email = user?.email || '';
  const avatar = user?.avatar || makeInitialsAvatar(user ? displayName : 'Você', '#5F6368');
  return {
    user: {
      name: displayName,
      email,
      avatar,
    },
    weather: {
      temp: '--',
      location: '',
    },
    stats: {
      storageUsed: 0,
      unreadEmails: 0,
    },
    emails: [],
    labels: [],
    events: [],
    calendars: [
      {
        id: 'primary',
        name: user?.name || 'Agenda principal',
        color: '#039BE5',
        checked: true,
        accessRole: 'owner',
      },
    ],
    files: [],
    tasks: [],
    taskLists: [{ id: 'default', title: 'Minhas Tarefas' }],
    notes: [],
  };
}

export interface AuroraSettings {
  colorStops: string[];
  speed: number;
  amplitude: number;
}

export interface GroundingSource {
  web?: { uri?: string; title?: string };
  maps?: { uri?: string; title?: string };
}

export interface ContactItem {
  name: string;
  email: string;
  avatar: string;
  role?: string;
}

export interface CloudUserProfile {
  uid: string;
  name: string;
  email: string;
  avatar: string;
}

export interface AppOpenLaunchOptions {
  id?: string | number;
  name?: string;
  type?: string;
  query?: string;
  compose?: boolean;
  composeTo?: string;
  composeSubject?: string;
  composeBody?: string;
  emailId?: string;
  initialEmailId?: string | number;
  initialPane?: 'agenda' | 'email' | 'compose' | 'tasks' | 'keep' | 'event-create' | 'settings';
  isStarred?: boolean;
  event?: CalendarEvent;
  noteId?: number;
  eventId?: string;
  taskId?: string;
  roomCode?: string;
  mimeType?: string;
  url?: string;
  content?: string;
}

export type AppOpenPayload =
  | AppOpenLaunchOptions
  | DriveItem
  | EnrichedDriveItem
  | CalendarEvent
  | EmailItem
  | TaskItem
  | NoteItem;

export interface DashboardData {
  user: { name: string; email: string; avatar: string };
  weather: { temp: string; location: string };
  stats: { storageUsed: number; unreadEmails: number };
  emails: EmailItem[];
  labels?: MailLabel[];
  events: CalendarEvent[];
  calendars?: CalendarListEntry[];
  files: EnrichedDriveItem[];
  tasks: TaskItem[];
  taskLists?: TaskList[];
  notes: NoteItem[];
  activeFile?: AppOpenPayload;
  query?: string;
  compose?: boolean;
  composeTo?: string;
  composeSubject?: string;
  composeBody?: string;
  emailId?: string;
  initialEmailId?: string | number;
  initialPane?: 'agenda' | 'email' | 'compose' | 'tasks' | 'keep' | 'event-create' | 'settings';
  isStarred?: boolean;
  event?: CalendarEvent;
  noteId?: number;
  eventId?: string;
  taskId?: string;
  roomCode?: string;
  id?: string;
  name?: string;
  type?: string;
  url?: string;
  content?: string;
}

export interface ChatMessage {
  id: string;
  sender: string;
  avatar: string;
  text: string;
  time: string;
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
  checklist?: Array<{ id: string; text: string; checked: boolean }>;
  reminder?: string;
  archived?: boolean;
  trashed?: boolean;
  drawingDataUrl?: string;
  status?: 'completed' | 'in_progress' | 'upcoming';
  badgeType?: 'plus' | 'brain' | 'media' | 'lock' | 'chat';
  connectedTo?: number[];
  linkedTaskId?: string;
  linkedEventId?: string;
  participants?: Array<{ name: string; avatar: string; email?: string }>;
  chatMessages?: ChatMessage[];
  durationLabel?: string;
}

export type TaskRecurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface TaskLinkedSource {
  type: 'mail' | 'doc' | 'sheet' | 'slide' | 'event';
  id: string;
  label: string;
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
  completedAt?: string;
  starred?: boolean;
  date?: string;
  time?: string;
  recurrence?: TaskRecurrence;
  linkedSource?: TaskLinkedSource;
  parent?: string;
  position?: string;
  listId?: string;
  subtasks?: TaskItem[];
}

export interface DriveItem {
  id: string;
  name: string;
  type: string;
  mimeType?: string;
  owner: string;
  date: string;
  size?: string;
  thumbnail?: string;
  isStarred?: boolean;
  url?: string;
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
  category: string;
  currentFolderId: string | null;
  currentFolderName: string;
  parentId: string | null;
  folders: EnrichedDriveItem[];
  files: EnrichedDriveItem[];
}

export interface FileContentResponse {
  success: boolean;
  data?: string;
  mimeType?: string;
  name?: string;
  error?: string;
}

export interface EmailAttachment {
  name: string;
  mimeType: string;
  data: string;
}

export interface SearchResults {
  emails: EmailItem[];
  files: EnrichedDriveItem[];
  events: CalendarEvent[];
  error?: string;
}

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

export type ResourceType = 'calendar' | 'tasks' | 'drive' | 'notes' | 'all';
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
  expiresAt?: string;
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

interface GasScriptRunner {
  withSuccessHandler: (cb: (res: string) => void) => GasScriptRunner;
  withFailureHandler: (cb: (err: unknown) => void) => GasScriptRunner;
  getInitialData: () => void;
  getCalendars: () => void;
  getEvents: (calendarId: string, start: string, end: string) => void;
  getDriveItems: (params: { folderId: string | null; category: string; query: string }) => void;
  getFileContent: (id: string) => void;
  saveFileContent: (id: string, content: string) => void;
}

interface WindowWithGas extends Window {
  google?: {
    script?: {
      run: GasScriptRunner;
    };
  };
}

class GASBridge {
  private cloudUser: CloudUserProfile | null = null;
  private storeCache = new Map<string, unknown>();

  constructor() {
    this.ensureRealOnlyMigration();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key) this.storeCache.delete(e.key);
        else this.storeCache.clear();
      });
    }
  }

  private ensureRealOnlyMigration(): void {
    if (typeof window === 'undefined') return;
    try {
      if (localStorage.getItem(REAL_ONLY_MIGRATION_KEY) === '1') return;
      for (const key of USER_SESSION_STORE_KEYS) {
        localStorage.removeItem(key);
      }
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (
          /^workspace_doc_content_f\d+$/i.test(k) ||
          /^workspace_sheet_doc_v2_f\d+$/i.test(k) ||
          /^workspace_slide_content_f\d+$/i.test(k)
        ) {
          keysToRemove.push(k);
        }
      }
      for (const k of keysToRemove) {
        localStorage.removeItem(k);
      }
      localStorage.setItem(REAL_ONLY_MIGRATION_KEY, '1');
    } catch {
      /* ignore storage errors */
    }
  }

  clearWorkspaceSessionData(): void {
    this.cloudUser = null;
    this.storeCache.clear();
    if (typeof window === 'undefined') return;
    try {
      for (const key of USER_SESSION_STORE_KEYS) {
        localStorage.removeItem(key);
      }
    } catch {
      /* ignore storage errors */
    }
  }

  setCloudUser(user: CloudUserProfile | null): void {
    this.cloudUser = user;
  }

  getCloudUser(): CloudUserProfile | null {
    return this.cloudUser;
  }

  async hydrateFromCloud(user: CloudUserProfile): Promise<DashboardData> {
    this.cloudUser = user;
    const token = getWorkspaceAccessToken();
    this.writeStore('workspace_calendars_v2', [
      {
        id: 'primary',
        name: user.name || user.email || 'Agenda principal',
        color: '#039BE5',
        checked: true,
        accessRole: 'owner',
      },
    ]);
    if (token) {
      const [emailsRes, driveRes, eventsRes, tasksRes] = await Promise.allSettled([
        fetchGmailMessagesRemote(token, 25),
        fetchDriveFilesRemote(token, 40),
        fetchCalendarEventsRemote(token),
        fetchTasksAndListsRemote(token),
      ]);
      if (emailsRes.status === 'fulfilled') {
        this.writeStore('workspace_emails_v2', emailsRes.value);
      }
      if (driveRes.status === 'fulfilled') {
        this.writeStore('workspace_drive_items_v2', driveRes.value);
      }
      if (eventsRes.status === 'fulfilled') {
        this.writeStore('workspace_events_v2', eventsRes.value);
      }
      if (tasksRes.status === 'fulfilled') {
        this.writeStore(
          'workspace_task_lists_v2',
          tasksRes.value.lists.length > 0 ? tasksRes.value.lists : [{ id: 'default', title: 'Minhas Tarefas' }],
        );
        this.writeStore('workspace_tasks_v2', tasksRes.value.tasks);
      }
      await this.logAudit(
        'WORKSPACE_SYNC',
        `Dados sincronizados diretamente com a conta Google (${user.email}).`,
        'SUCCESS',
      );
    }
    return this.getInitialData();
  }

  async createRealMeetSpace(): Promise<{ meetingUri: string; meetingCode: string } | null> {
    const token = getWorkspaceAccessToken();
    if (!token) return null;
    const ok = await confirmWorkspaceAction({
      title: 'Criar sala real no Google Meet?',
      description: 'Uma nova sala de videoconferência será criada diretamente na sua conta Google Meet.',
      confirmLabel: 'Criar sala no Meet',
    });
    if (!ok) return null;
    const space = await createGoogleMeetSpaceRemote(token);
    return { meetingUri: space.meetingUri, meetingCode: space.meetingCode };
  }

  private getGasRunner(): GasScriptRunner | null {
    if (typeof window === 'undefined') return null;
    return (window as WindowWithGas).google?.script?.run ?? null;
  }

  private normalizeData(data: Partial<DashboardData>): DashboardData {
    const base: DashboardData = {
      ...createEmptyWorkspaceData(this.cloudUser),
      ...data,
    };
    if (Array.isArray(base.events)) {
      base.events = base.events.map((ev) => ({
        ...ev,
        start: new Date(ev.start).toISOString(),
        end: new Date(ev.end).toISOString(),
      }));
    }
    const unreadEmails = (base.emails || []).filter((e) => !e.read && e.folder === 'inbox').length;
    const usedBytes = (base.files || []).reduce((acc, f) => acc + (f.sizeBytes || 0), 0);
    base.stats = {
      storageUsed: Number((usedBytes / (1024 * 1024 * 1024)).toFixed(2)),
      unreadEmails,
    };
    return base;
  }

  async getInitialData(): Promise<DashboardData> {
    const runner = this.getGasRunner();
    if (runner) {
      return new Promise((resolve) => {
        runner
          .withSuccessHandler((res: string) => {
            try {
              resolve(this.normalizeData(JSON.parse(res) as Partial<DashboardData>));
            } catch {
              resolve(this.normalizeData({}));
            }
          })
          .withFailureHandler(() => resolve(this.normalizeData({})))
          .getInitialData();
      });
    }

    const base: DashboardData = createEmptyWorkspaceData(this.cloudUser);
    if (this.hasStoreKey('workspace_task_lists_v2')) base.taskLists = this.readStore<TaskList[]>('workspace_task_lists_v2', base.taskLists || []);
    if (this.hasStoreKey('workspace_tasks_v2')) base.tasks = this.readStore<TaskItem[]>('workspace_tasks_v2', []);
    if (this.hasStoreKey('workspace_emails_v2')) base.emails = this.readStore<EmailItem[]>('workspace_emails_v2', []);
    if (this.hasStoreKey('workspace_labels_v2')) base.labels = this.readStore<MailLabel[]>('workspace_labels_v2', []);
    if (this.hasStoreKey('workspace_notes_v2')) base.notes = this.readStore<NoteItem[]>('workspace_notes_v2', []);
    if (this.hasStoreKey('workspace_events_v2')) base.events = this.readStore<CalendarEvent[]>('workspace_events_v2', []);
    if (this.hasStoreKey('workspace_calendars_v2')) base.calendars = this.readStore<CalendarListEntry[]>('workspace_calendars_v2', base.calendars || []);
    if (this.hasStoreKey('workspace_drive_items_v2')) base.files = this.readStore<EnrichedDriveItem[]>('workspace_drive_items_v2', []);
    return Promise.resolve(this.normalizeData(base));
  }

  // --- MEET SIGNALING ---
  async registerMeeting(roomCode: string, peerId: string): Promise<boolean> {
    const rooms = this.readStore<Record<string, { peerId: string; updatedAt: number }>>('workspace_meet_rooms_v1', {});
    rooms[roomCode.trim().toLowerCase()] = { peerId, updatedAt: Date.now() };
    this.writeStore('workspace_meet_rooms_v1', rooms);
    return Promise.resolve(true);
  }
  async getMeetingPeer(roomCode: string): Promise<string | null> {
    const rooms = this.readStore<Record<string, { peerId: string; updatedAt: number }>>('workspace_meet_rooms_v1', {});
    const entry = rooms[roomCode.trim().toLowerCase()];
    return Promise.resolve(entry?.peerId || null);
  }

  // --- CALENDAR ---
  async getCalendars(): Promise<CalendarListEntry[]> {
    const runner = this.getGasRunner();
    if (runner) {
      return new Promise((resolve) =>
        runner.withSuccessHandler((res: string) => resolve(JSON.parse(res) as CalendarListEntry[])).getCalendars(),
      );
    }
    if (this.hasStoreKey('workspace_calendars_v2')) {
      return Promise.resolve(this.readStore<CalendarListEntry[]>('workspace_calendars_v2', []));
    }
    return Promise.resolve([
      {
        id: 'primary',
        name: this.cloudUser?.name || 'Agenda principal',
        color: '#039BE5',
        checked: true,
        accessRole: 'owner',
      },
    ]);
  }
  async saveCalendars(calendars: CalendarListEntry[]): Promise<boolean> {
    this.writeStore('workspace_calendars_v2', calendars);
    return Promise.resolve(true);
  }
  async getAllEvents(): Promise<CalendarEvent[]> {
    return Promise.resolve(this.readStore<CalendarEvent[]>('workspace_events_v2', []));
  }
  async saveAllEvents(events: CalendarEvent[]): Promise<boolean> {
    this.writeStore('workspace_events_v2', events);
    return Promise.resolve(true);
  }
  async getEvents(calendarId: string, start: string, end: string): Promise<CalendarEvent[]> {
    const runner = this.getGasRunner();
    if (runner) {
      return new Promise((resolve) => {
        runner
          .withSuccessHandler((res: string) =>
            resolve(
              (JSON.parse(res) as CalendarEvent[]).map((ev) => ({
                ...ev,
                start: new Date(ev.start).toISOString(),
                end: new Date(ev.end).toISOString(),
              })),
            ),
          )
          .getEvents(calendarId, start, end);
      });
    }
    const allEvents = await this.getAllEvents();
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    const filtered = allEvents.filter((ev) => {
      const evStart = new Date(ev.start).getTime();
      const matchesCalendar = !calendarId || calendarId === 'primary' || ev.calendarId === calendarId;
      const inRange = evStart >= startMs && evStart <= endMs;
      return matchesCalendar && inRange;
    });
    return Promise.resolve(
      filtered.map((ev) => ({
        ...ev,
        start: new Date(ev.start).toISOString(),
        end: new Date(ev.end).toISOString(),
      })),
    );
  }
  async createCalendarEvent(
    data: Partial<CalendarEvent>,
  ): Promise<{ success: boolean; id?: string; meetLink?: string; event?: CalendarEvent }> {
    const all = await this.getAllEvents();
    const newId = data.id || `ev_${Date.now()}`;
    let newEvent: CalendarEvent = {
      ...data,
      id: newId,
      title: data.title || 'Novo Evento',
      start: data.start ? new Date(data.start).toISOString() : new Date().toISOString(),
      end: data.end ? new Date(data.end).toISOString() : new Date(Date.now() + 3600000).toISOString(),
      calendarId: data.calendarId || 'primary',
      color: data.color || '#039BE5',
      description: data.description || '',
      location: data.location || '',
      guests: data.guests || [],
      meetLink: data.meetLink,
    };
    const token = getWorkspaceAccessToken();
    if (token) {
      const ok = await confirmWorkspaceAction({
        title: 'Criar evento na Google Agenda?',
        description: `O evento "${newEvent.title}" será criado na sua conta Google Calendar.`,
        confirmLabel: 'Criar evento',
      });
      if (!ok) return { success: false };
      const remoteEv = await createCalendarEventRemote(token, newEvent);
      newEvent = { ...newEvent, ...remoteEv };
    }
    const next = [newEvent, ...all.filter((e) => e.id !== newEvent.id)];
    this.writeStore('workspace_events_v2', next);
    return Promise.resolve({ success: true, id: newEvent.id, meetLink: newEvent.meetLink, event: newEvent });
  }
  async checkFreeBusy(_start: string, _end: string, _emails: string[]): Promise<{ success: boolean }> {
    return Promise.resolve({ success: true });
  }
  async updateCalendarEvent(
    data: Partial<CalendarEvent>,
  ): Promise<{ success: boolean; event?: CalendarEvent }> {
    const all = await this.getAllEvents();
    let updatedEvent: CalendarEvent | undefined;
    const next = all.map((ev) => {
      if (ev.id !== data.id) return ev;
      updatedEvent = {
        ...ev,
        ...data,
        start: data.start ? new Date(data.start).toISOString() : ev.start,
        end: data.end ? new Date(data.end).toISOString() : ev.end,
      };
      return updatedEvent;
    });
    const token = getWorkspaceAccessToken();
    if (token && updatedEvent && !updatedEvent.id.startsWith('ev_')) {
      const ok = await confirmWorkspaceAction({
        title: 'Atualizar evento na Google Agenda?',
        description: `As alterações em "${updatedEvent.title}" serão salvas na sua conta Google Calendar.`,
        confirmLabel: 'Atualizar evento',
      });
      if (!ok) return { success: false };
      await updateCalendarEventRemote(token, updatedEvent);
    }
    this.writeStore('workspace_events_v2', next);
    return Promise.resolve({ success: true, event: updatedEvent });
  }
  async deleteCalendarEvent(id: string, _calendarId?: string): Promise<boolean> {
    const all = await this.getAllEvents();
    const baseId = id.includes('_occ_') ? id.split('_occ_')[0] : id;
    const target = all.find((ev) => ev.id === id || ev.id === baseId);
    const token = getWorkspaceAccessToken();
    if (token && target && !target.id.startsWith('ev_')) {
      const ok = await confirmWorkspaceAction({
        title: 'Excluir evento da Google Agenda?',
        description: `O evento "${target.title}" será removido permanentemente da sua conta Google Calendar.`,
        confirmLabel: 'Excluir evento',
        danger: true,
      });
      if (!ok) return false;
      await deleteCalendarEventRemote(token, target.id);
    }
    const next = all.filter((ev) => ev.id !== id && ev.id !== baseId);
    this.writeStore('workspace_events_v2', next);
    return Promise.resolve(true);
  }
  async rsvpEvent(eventId: string, status: 'accepted' | 'declined' | 'tentative'): Promise<boolean> {
    const all = await this.getAllEvents();
    const baseId = eventId.includes('_occ_') ? eventId.split('_occ_')[0] : eventId;
    const activeEmail = this.cloudUser?.email || '';
    const activeName = this.cloudUser?.name || 'Você';
    const next = all.map((ev) => {
      if (ev.id !== eventId && ev.id !== baseId) return ev;
      const existingGuests = ev.guests || [];
      const hasSelf = activeEmail ? existingGuests.some((g) => g.email === activeEmail) : false;
      const guests = hasSelf
        ? existingGuests.map((g) => (g.email === activeEmail ? { ...g, responseStatus: status } : g))
        : [{ name: activeName, email: activeEmail, responseStatus: status }, ...existingGuests];
      return { ...ev, guests };
    });
    this.writeStore('workspace_events_v2', next);
    return Promise.resolve(true);
  }

  // --- MAIL & CONTACTS ---
  async getEmails(): Promise<EmailItem[]> {
    return Promise.resolve(this.readStore<EmailItem[]>('workspace_emails_v2', []));
  }
  async saveAllEmails(emails: EmailItem[]): Promise<boolean> {
    this.writeStore('workspace_emails_v2', emails);
    return Promise.resolve(true);
  }
  async getLabels(): Promise<MailLabel[]> {
    return Promise.resolve(this.readStore<MailLabel[]>('workspace_labels_v2', []));
  }
  async saveLabels(labels: MailLabel[]): Promise<boolean> {
    this.writeStore('workspace_labels_v2', labels);
    return Promise.resolve(true);
  }
  async searchAll(query: string): Promise<SearchResults> {
    if (!query || !query.trim()) return Promise.resolve({ emails: [], files: [], events: [] });
    const q = query.trim().toLowerCase();
    const [allEmails, allFiles, allEvents] = await Promise.all([
      this.getEmails(),
      this.getAllDriveItems(),
      this.getAllEvents(),
    ]);
    return {
      emails: allEmails.filter(
        (e) =>
          (e.subject || '').toLowerCase().includes(q) ||
          (e.preview || '').toLowerCase().includes(q) ||
          (e.sender || '').toLowerCase().includes(q),
      ),
      files: allFiles.filter(
        (f) =>
          !f.trashed &&
          ((f.name || '').toLowerCase().includes(q) ||
            (f.owner || '').toLowerCase().includes(q) ||
            (f.description || '').toLowerCase().includes(q)),
      ),
      events: allEvents.filter(
        (ev) =>
          (ev.title || '').toLowerCase().includes(q) ||
          (ev.description || '').toLowerCase().includes(q) ||
          (ev.location || '').toLowerCase().includes(q),
      ),
    };
  }
  async getEmailsPaged(start: number, limit: number, folder: string, query = ''): Promise<EmailItem[]> {
    const all = await this.getEmails();
    const q = query.trim().toLowerCase();
    const filtered = all.filter((e) => {
      if (folder && folder !== 'all' && !folder.startsWith('label_')) {
        if (folder === 'starred' && !e.isStarred) return false;
        else if (folder === 'important' && !e.isImportant) return false;
        else if (folder !== 'starred' && folder !== 'important' && e.folder !== folder) return false;
      }
      if (folder?.startsWith('label_') && !(e.labels || []).includes(folder)) return false;
      if (!q) return true;
      return (
        (e.subject || '').toLowerCase().includes(q) ||
        (e.sender || '').toLowerCase().includes(q) ||
        (e.preview || '').toLowerCase().includes(q)
      );
    });
    return Promise.resolve(filtered.slice(start, start + limit));
  }
  async createLabel(name: string, colorClass = 'text-blue-400'): Promise<MailLabel> {
    const labels = await this.getLabels();
    const newLabel: MailLabel = { id: `label_${Date.now()}`, name: name.trim(), colorClass };
    this.writeStore('workspace_labels_v2', [...labels, newLabel]);
    return Promise.resolve(newLabel);
  }
  async batchManageEmails(ids: Array<number | string>, action: string): Promise<boolean> {
    const idSet = new Set(ids.map(String));
    const all = await this.getEmails();
    const token = getWorkspaceAccessToken();
    if (token && (action === 'trash' || action === 'delete_forever')) {
      const ok = await confirmWorkspaceAction({
        title: `Mover ${ids.length} e-mail(s) no Gmail?`,
        description: `Essa ação enviará ${ids.length} mensagem(ns) para a lixeira da sua conta Gmail.`,
        confirmLabel: 'Confirmar no Gmail',
        danger: true,
      });
      if (!ok) return false;
      await Promise.allSettled(
        ids.map((id) => trashGmailMessageRemote(token, String(id))),
      );
    }
    const updated = all
      .filter((e) => !(action === 'delete_forever' && idSet.has(String(e.id))))
      .map((e) => {
        if (!idSet.has(String(e.id))) return e;
        if (action === 'archive') return { ...e, folder: 'all' };
        if (action === 'trash') return { ...e, folder: 'trash' };
        if (action === 'spam') return { ...e, folder: 'spam' };
        if (action === 'restore') return { ...e, folder: 'inbox' };
        if (action === 'read') return { ...e, read: true };
        if (action === 'unread') return { ...e, read: false };
        return e;
      });
    this.writeStore('workspace_emails_v2', updated);
    return Promise.resolve(true);
  }
  async snoozeEmail(id: number | string, until: string): Promise<boolean> {
    const all = await this.getEmails();
    const labelMap: Record<string, string> = {
      today: 'Hoje, 18:00',
      tomorrow: 'Amanhã, 08:00',
      nextWeek: 'Seg, 08:00',
    };
    const updated = all.map((e) =>
      String(e.id) === String(id) ? { ...e, folder: 'snoozed', snoozedUntil: labelMap[until] || until } : e,
    );
    this.writeStore('workspace_emails_v2', updated);
    return Promise.resolve(true);
  }
  async sendEmail(
    to: string,
    subject: string,
    body: string,
    attachments: EmailAttachment[] = [],
    meta?: { cc?: string; bcc?: string; draftId?: string },
  ): Promise<{ success: boolean; email: EmailItem }> {
    const all = await this.getEmails();
    const cleaned = meta?.draftId ? all.filter((e) => String(e.id) !== String(meta.draftId)) : all;
    const plainPreview = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
    const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const senderName = this.cloudUser?.name || 'Você';
    const senderEmail = this.cloudUser?.email || '';
    let sentId = `em_${Date.now()}`;
    const token = getWorkspaceAccessToken();
    if (token) {
      const ok = await confirmWorkspaceAction({
        title: 'Enviar e-mail real pelo Gmail?',
        description: `Deseja enviar "${subject || '(Sem assunto)'}" para ${to} usando sua conta Gmail?`,
        confirmLabel: 'Enviar agora',
      });
      if (!ok) {
        return {
          success: false,
          email: {
            id: sentId,
            sender: senderName,
            senderInit: senderName.slice(0, 2).toUpperCase(),
            senderEmail,
            to,
            subject: subject || '(Sem assunto)',
            preview: plainPreview,
            body,
            time: nowTime,
            folder: 'drafts',
            read: true,
          },
        };
      }
      const remoteSent = await sendGmailMessageRemote(token, {
        to,
        subject: subject || '(Sem assunto)',
        body,
        cc: meta?.cc,
        bcc: meta?.bcc,
      });
      sentId = remoteSent.id || sentId;
    }
    const sentItem: EmailItem = {
      id: sentId,
      threadId: `t_${Date.now()}`,
      sender: senderName,
      senderInit: senderName[0]?.toUpperCase() || 'C',
      senderEmail,
      to,
      cc: meta?.cc?.trim() || undefined,
      bcc: meta?.bcc?.trim() || undefined,
      subject: subject || '(Sem assunto)',
      preview: plainPreview || 'Mensagem enviada',
      body,
      time: nowTime,
      color: 'bg-blue-600',
      folder: 'sent',
      category: 'primary',
      read: true,
      isStarred: false,
      isImportant: false,
      hasAttachment: attachments.length > 0,
      attachments: attachments.map((a, idx) => ({
        id: `att_${Date.now()}_${idx}`,
        name: a.name,
        size: `${Math.max(1, Math.round((a.data?.length || 1024) / 1024))} KB`,
        mimeType: a.mimeType,
        data: a.data,
      })),
      messages: [
        {
          id: `msg_${Date.now()}`,
          from: senderName,
          fromEmail: senderEmail,
          senderInit: senderName[0]?.toUpperCase() || 'C',
          to,
          cc: meta?.cc?.trim() || undefined,
          date: `Hoje às ${nowTime}`,
          body,
        },
      ],
    };
    this.writeStore('workspace_emails_v2', [sentItem, ...cleaned]);
    return Promise.resolve({ success: true, email: sentItem });
  }
  async scheduleSend(
    to: string,
    subject: string,
    body: string,
    time: string,
    attachments: EmailAttachment[] = [],
    meta?: { cc?: string; bcc?: string; draftId?: string },
  ): Promise<{ success: boolean; email: EmailItem }> {
    const all = await this.getEmails();
    const cleaned = meta?.draftId ? all.filter((e) => String(e.id) !== String(meta.draftId)) : all;
    const scheduleLabelMap: Record<string, string> = {
      tomorrow: 'Amanhã, 08:00',
      afternoon: 'Amanhã, 13:00',
      monday: 'Segunda-feira, 08:00',
    };
    const scheduledFor = scheduleLabelMap[time] || time;
    const plainPreview = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
    const senderName = this.cloudUser?.name || 'Você';
    const senderEmail = this.cloudUser?.email || '';
    const scheduledItem: EmailItem = {
      id: `em_sched_${Date.now()}`,
      threadId: `t_sched_${Date.now()}`,
      sender: senderName,
      senderInit: senderName[0]?.toUpperCase() || 'V',
      senderEmail,
      to,
      cc: meta?.cc?.trim() || undefined,
      bcc: meta?.bcc?.trim() || undefined,
      subject: subject || '(Sem assunto)',
      preview: plainPreview || 'Envio agendado',
      body,
      time: 'Agendado',
      scheduledFor,
      color: 'bg-blue-600',
      folder: 'scheduled',
      category: 'primary',
      read: true,
      hasAttachment: attachments.length > 0,
      messages: [
        {
          id: `msg_sched_${Date.now()}`,
          from: senderName,
          fromEmail: senderEmail,
          senderInit: senderName[0]?.toUpperCase() || 'V',
          to,
          cc: meta?.cc?.trim() || undefined,
          date: `Agendado para ${scheduledFor}`,
          body,
        },
      ],
    };
    this.writeStore('workspace_emails_v2', [scheduledItem, ...cleaned]);
    return Promise.resolve({ success: true, email: scheduledItem });
  }
  async saveDraft(
    to: string,
    subject: string,
    body: string,
    attachments: EmailAttachment[] = [],
    meta?: { cc?: string; bcc?: string; draftId?: string },
  ): Promise<{ success: boolean; email: EmailItem }> {
    const all = await this.getEmails();
    const cleaned = meta?.draftId ? all.filter((e) => String(e.id) !== String(meta.draftId)) : all;
    const plainPreview = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
    const draftItem: EmailItem = {
      id: meta?.draftId || `draft_${Date.now()}`,
      sender: 'Rascunho',
      senderInit: 'R',
      senderEmail: this.cloudUser?.email || '',
      to,
      cc: meta?.cc?.trim() || undefined,
      bcc: meta?.bcc?.trim() || undefined,
      subject: subject || '(Sem assunto)',
      preview: plainPreview || 'Rascunho salvo...',
      body,
      time: 'Rascunho',
      color: 'bg-gray-600',
      folder: 'drafts',
      category: 'primary',
      read: true,
      hasAttachment: attachments.length > 0,
    };
    this.writeStore('workspace_emails_v2', [draftItem, ...cleaned]);
    return Promise.resolve({ success: true, email: draftItem });
  }
  async getThreadDetails(
    threadIdOrEmailId: string | number,
  ): Promise<{ success: boolean; messages: EmailThreadMessage[] }> {
    const all = await this.getEmails();
    const found = all.find(
      (e) => String(e.id) === String(threadIdOrEmailId) || String(e.threadId) === String(threadIdOrEmailId),
    );
    if (!found) {
      return Promise.resolve({ success: false, messages: [] });
    }
    const messages: EmailThreadMessage[] =
      found.messages && found.messages.length > 0
        ? found.messages
        : [
            {
              id: `msg_${found.id}`,
              from: found.sender,
              fromEmail: found.senderEmail || '',
              senderInit: found.senderInit || found.sender[0] || '?',
              to: found.to || this.cloudUser?.email || '',
              date: found.time || 'Hoje',
              body: found.body || `<p>${found.preview}</p>`,
              attachments: found.attachments || [],
            },
          ];
    return Promise.resolve({ success: true, messages });
  }
  async getEmailAttachment(messageId: string, attachmentIndex: number | string): Promise<FileContentResponse> {
    const content = `Documento exportado do Google Workspace OS\nID da Mensagem: ${messageId}\nAnexo: ${attachmentIndex}\nGerado em: ${new Date().toISOString()}`;
    const base64 = encodeBase64Utf8(content);
    return Promise.resolve({
      success: true,
      data: base64,
      mimeType: 'text/plain;charset=utf-8',
      name: `anexo_${messageId}.txt`,
    });
  }
  async searchContacts(query: string): Promise<ContactItem[]> {
    const [emails, events] = await Promise.all([this.getEmails(), this.getAllEvents()]);
    const byEmail = new Map<string, ContactItem>();
    for (const em of emails) {
      if (em.senderEmail && em.senderEmail.includes('@')) {
        const key = em.senderEmail.toLowerCase();
        if (!byEmail.has(key)) {
          byEmail.set(key, {
            name: em.sender || em.senderEmail.split('@')[0],
            email: em.senderEmail,
            avatar: (em.sender || em.senderEmail)[0].toUpperCase(),
          });
        }
      }
    }
    for (const ev of events) {
      for (const g of ev.guests || []) {
        if (g.email && g.email.includes('@')) {
          const key = g.email.toLowerCase();
          if (!byEmail.has(key)) {
            byEmail.set(key, {
              name: g.name || g.email.split('@')[0],
              email: g.email,
              avatar: (g.name || g.email)[0].toUpperCase(),
            });
          }
        }
      }
    }
    const contacts = Array.from(byEmail.values());
    if (!query) return Promise.resolve(contacts);
    const q = query.toLowerCase();
    return Promise.resolve(
      contacts.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)),
    );
  }

  // --- DRIVE ---
  async getAllDriveItems(): Promise<EnrichedDriveItem[]> {
    return Promise.resolve(this.readStore<EnrichedDriveItem[]>('workspace_drive_items_v2', []));
  }
  async saveAllDriveItems(items: EnrichedDriveItem[]): Promise<boolean> {
    this.writeStore('workspace_drive_items_v2', items);
    return Promise.resolve(true);
  }
  async getDriveItems(folderId: string | null, category: string, query: string): Promise<DriveResponse> {
    const runner = this.getGasRunner();
    if (runner) {
      return new Promise((resolve, reject) =>
        runner
          .withSuccessHandler((res: string) => resolve(JSON.parse(res) as DriveResponse))
          .withFailureHandler(reject)
          .getDriveItems({ folderId, category, query }),
      );
    }
    const all = await this.getAllDriveItems();
    const currentFolder = folderId ? all.find((i) => i.id === folderId) : null;
    const folders = all.filter((i) => i.type === 'folder' && !i.trashed && (i.parentId || null) === (folderId || null));
    const files = all.filter((i) => i.type !== 'folder' && !i.trashed && (i.parentId || null) === (folderId || null));
    return Promise.resolve({
      files,
      folders,
      category: category || 'my-drive',
      currentFolderName: currentFolder ? currentFolder.name : 'Meu Drive',
      currentFolderId: folderId || null,
      parentId: currentFolder?.parentId || null,
    });
  }
  async getFolderTree(_parentId?: string | null): Promise<EnrichedDriveItem[]> {
    const all = await this.getAllDriveItems();
    return Promise.resolve(all.filter((i) => i.type === 'folder' && !i.trashed));
  }
  async createDriveFolder(name: string, parentId: string | null, color = '#1A73E8'): Promise<EnrichedDriveItem> {
    const all = await this.getAllDriveItems();
    const actor = this.cloudUser?.name || 'Você';
    let newFolder: EnrichedDriveItem = {
      id: `fld_${Date.now()}`,
      name: name.trim(),
      type: 'folder',
      owner: 'eu',
      date: 'Criado agora',
      modifiedIso: new Date().toISOString(),
      parentId: parentId || undefined,
      isStarred: false,
      folderColor: color,
      activityLog: [{ id: `act_${Date.now()}`, actor, action: `Criou a pasta "${name.trim()}"`, timestamp: 'Agora' }],
    };
    const token = getWorkspaceAccessToken();
    if (token) {
      const ok = await confirmWorkspaceAction({
        title: 'Criar pasta no Google Drive?',
        description: `A pasta "${name.trim()}" será criada diretamente no seu Google Drive.`,
        confirmLabel: 'Criar pasta',
      });
      if (ok) {
        const remote = await createDriveFileRemote(token, { name: name.trim(), type: 'folder', parentId });
        newFolder = { ...newFolder, ...remote, folderColor: color };
      }
    }
    this.writeStore('workspace_drive_items_v2', [newFolder, ...all]);
    return Promise.resolve(newFolder);
  }
  async createDriveDocument(
    docType: 'doc' | 'sheet' | 'slide',
    name: string,
    parentId: string | null = null,
  ): Promise<EnrichedDriveItem> {
    const all = await this.getAllDriveItems();
    const actor = this.cloudUser?.name || 'Você';
    let newDoc: EnrichedDriveItem = {
      id: `${docType}_${Date.now()}`,
      name: name.trim(),
      type: docType,
      owner: 'eu',
      date: 'Criado agora',
      modifiedIso: new Date().toISOString(),
      size: '128 KB',
      sizeBytes: 131072,
      parentId: parentId || undefined,
      isStarred: false,
      webViewLink: '#',
      versions: [{ id: `v_${Date.now()}`, date: 'Agora mesmo', author: actor, size: '128 KB' }],
      activityLog: [{ id: `act_${Date.now()}`, actor, action: `Criou ${name.trim()}`, timestamp: 'Agora' }],
    };
    const token = getWorkspaceAccessToken();
    if (token) {
      const ok = await confirmWorkspaceAction({
        title: 'Criar arquivo no Google Drive?',
        description: `O arquivo "${name.trim()}" será criado na sua conta Google Drive.`,
        confirmLabel: 'Criar no Drive',
      });
      if (ok) {
        const remote = await createDriveFileRemote(token, { name: name.trim(), type: docType, parentId });
        newDoc = { ...newDoc, ...remote };
      }
    }
    this.writeStore('workspace_drive_items_v2', [newDoc, ...all]);
    return Promise.resolve(newDoc);
  }
  async renameDriveItem(id: string, name: string): Promise<boolean> {
    const all = await this.getAllDriveItems();
    const token = getWorkspaceAccessToken();
    if (token && !/^(fld_|doc_|sheet_|slide_|up_|drv_|f\d)/.test(id)) {
      const ok = await confirmWorkspaceAction({
        title: 'Renomear arquivo no Google Drive?',
        description: `O item será renomeado para "${name.trim()}" no seu Google Drive.`,
        confirmLabel: 'Renomear',
      });
      if (!ok) return false;
      await renameDriveFileRemote(token, id, name.trim());
    }
    const actor = this.cloudUser?.name || 'Você';
    const next = all.map((item) =>
      item.id === id
        ? {
            ...item,
            name: name.trim(),
            date: 'Editado agora',
            modifiedIso: new Date().toISOString(),
            activityLog: [
              { id: `act_${Date.now()}`, actor, action: `Renomeou para "${name.trim()}"`, timestamp: 'Agora' },
              ...(item.activityLog || []),
            ],
          }
        : item,
    );
    this.writeStore('workspace_drive_items_v2', next);
    return Promise.resolve(true);
  }
  async trashDriveItem(id: string): Promise<boolean> {
    const all = await this.getAllDriveItems();
    const target = all.find((i) => i.id === id);
    const token = getWorkspaceAccessToken();
    if (token && !/^(fld_|doc_|sheet_|slide_|up_|drv_|f\d)/.test(id)) {
      const ok = await confirmWorkspaceAction({
        title: 'Mover para a lixeira do Google Drive?',
        description: `O item "${target?.name || id}" será enviado para a lixeira do seu Google Drive.`,
        confirmLabel: 'Mover para lixeira',
        danger: true,
      });
      if (!ok) return false;
      await trashDriveFileRemote(token, id, true);
    }
    const next = all.map((item) => (item.id === id ? { ...item, trashed: true } : item));
    this.writeStore('workspace_drive_items_v2', next);
    return Promise.resolve(true);
  }
  async restoreDriveItem(id: string): Promise<boolean> {
    const all = await this.getAllDriveItems();
    const token = getWorkspaceAccessToken();
    if (token && !/^(fld_|doc_|sheet_|slide_|up_|drv_|f\d)/.test(id)) {
      await trashDriveFileRemote(token, id, false);
    }
    const next = all.map((item) => (item.id === id ? { ...item, trashed: false, spam: false } : item));
    this.writeStore('workspace_drive_items_v2', next);
    return Promise.resolve(true);
  }
  async deleteDriveItemForever(id: string): Promise<boolean> {
    const all = await this.getAllDriveItems();
    const target = all.find((i) => i.id === id);
    const token = getWorkspaceAccessToken();
    if (token && !/^(fld_|doc_|sheet_|slide_|up_|drv_|f\d)/.test(id)) {
      const ok = await confirmWorkspaceAction({
        title: 'Excluir permanentemente do Google Drive?',
        description: `O arquivo "${target?.name || id}" será apagado definitivamente da sua conta Google Drive. Essa ação não pode ser desfeita.`,
        confirmLabel: 'Excluir permanentemente',
        danger: true,
      });
      if (!ok) return false;
      await deleteDriveFileRemote(token, id);
    }
    const next = all.filter((item) => item.id !== id && item.parentId !== id);
    this.writeStore('workspace_drive_items_v2', next);
    return Promise.resolve(true);
  }
  async emptyTrash(): Promise<boolean> {
    const all = await this.getAllDriveItems();
    const next = all.filter((item) => !item.trashed);
    this.writeStore('workspace_drive_items_v2', next);
    return Promise.resolve(true);
  }
  async setStarredDriveItem(id: string, starred: boolean): Promise<boolean> {
    const all = await this.getAllDriveItems();
    const next = all.map((item) => (item.id === id ? { ...item, isStarred: starred } : item));
    this.writeStore('workspace_drive_items_v2', next);
    return Promise.resolve(true);
  }
  async setSpamDriveItem(id: string, spam: boolean): Promise<boolean> {
    const all = await this.getAllDriveItems();
    const actor = this.cloudUser?.name || 'Você';
    const next = all.map((item) =>
      item.id === id
        ? {
            ...item,
            spam,
            trashed: false,
            activityLog: [
              {
                id: `act_${Date.now()}`,
                actor,
                action: spam ? 'Denunciou como spam' : 'Removeu da pasta de spam',
                timestamp: 'Agora',
              },
              ...(item.activityLog || []),
            ],
          }
        : item,
    );
    this.writeStore('workspace_drive_items_v2', next);
    return Promise.resolve(true);
  }
  async duplicateDriveItem(id: string): Promise<EnrichedDriveItem | null> {
    const all = await this.getAllDriveItems();
    const target = all.find((i) => i.id === id);
    if (!target) return Promise.resolve(null);
    const copy: EnrichedDriveItem = {
      ...target,
      id: `drv_copy_${Date.now()}`,
      name: `Cópia de ${target.name}`,
      date: 'Criado agora',
      modifiedIso: new Date().toISOString(),
    };
    this.writeStore('workspace_drive_items_v2', [copy, ...all]);
    return Promise.resolve(copy);
  }
  async updateDriveItemMeta(id: string, patch: Partial<EnrichedDriveItem>): Promise<boolean> {
    const all = await this.getAllDriveItems();
    const next = all.map((item) => (item.id === id ? { ...item, ...patch } : item));
    this.writeStore('workspace_drive_items_v2', next);
    return Promise.resolve(true);
  }
  async uploadFileToDrive(
    data: string,
    name: string,
    mimeType: string,
    parentId: string | null,
  ): Promise<EnrichedDriveItem> {
    const all = await this.getAllDriveItems();
    const actor = this.cloudUser?.name || 'Você';
    const lower = (name || '').toLowerCase();
    const inferredType =
      mimeType?.includes('image') || /\.(png|jpg|jpeg|gif|webp|svg)$/.test(lower)
        ? 'image'
        : mimeType?.includes('pdf') || lower.endsWith('.pdf')
        ? 'pdf'
        : lower.endsWith('.xlsx') || lower.endsWith('.csv')
        ? 'sheet'
        : lower.endsWith('.pptx')
        ? 'slide'
        : 'doc';
    const approxBytes = Math.max(102400, Math.round((data?.length || 200000) * 0.75));
    const sizeMb = (approxBytes / (1024 * 1024)).toFixed(1);
    const uploaded: EnrichedDriveItem = {
      id: `up_${Date.now()}`,
      name,
      type: inferredType,
      mimeType,
      owner: 'eu',
      date: 'Enviado agora',
      modifiedIso: new Date().toISOString(),
      size: `${sizeMb} MB`,
      sizeBytes: approxBytes,
      parentId: parentId || undefined,
      isStarred: false,
      thumbnail: inferredType === 'image' && data ? `data:${mimeType};base64,${data}` : undefined,
      versions: [{ id: `v_${Date.now()}`, date: 'Agora mesmo', author: actor, size: `${sizeMb} MB` }],
      activityLog: [{ id: `act_${Date.now()}`, actor, action: `Fez upload de "${name}"`, timestamp: 'Agora' }],
    };
    this.writeStore('workspace_drive_items_v2', [uploaded, ...all]);
    const isTextLike =
      mimeType?.startsWith('text/') ||
      mimeType?.includes('json') ||
      /\.(txt|md|csv|json|html|xml)$/i.test(lower);
    if (isTextLike && data && data.length <= 270000) {
      try {
        const binary = atob(data);
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        const decoded = new TextDecoder('utf-8').decode(bytes);
        this.writeStore(`workspace_doc_content_${uploaded.id}`, decoded);
      } catch {
        /* ignore non-utf8 */
      }
    }
    return Promise.resolve(uploaded);
  }
  async getFileContent(id: string): Promise<FileContentResponse> {
    const runner = this.getGasRunner();
    if (runner) {
      return new Promise((resolve, reject) =>
        runner
          .withSuccessHandler((res: string) => resolve(JSON.parse(res) as FileContentResponse))
          .withFailureHandler(reject)
          .getFileContent(id),
      );
    }
    const token = getWorkspaceAccessToken();
    if (token && !/^(fld_|doc_|sheet_|slide_|up_|drv_|f\d)/.test(id)) {
      const items = await this.getAllDriveItems();
      const target = items.find((i) => i.id === id);
      try {
        if (target?.mimeType === 'application/vnd.google-apps.document') {
          const html = await fetchGoogleDocHtmlRemote(token, id);
          return { success: true, data: html, mimeType: target.mimeType, name: target.name };
        }
        if (target?.mimeType === 'application/vnd.google-apps.spreadsheet') {
          const sheetData = await fetchGoogleSheetGridRemote(token, id);
          return {
            success: true,
            data: JSON.stringify(sheetData),
            mimeType: target.mimeType,
            name: target.name,
          };
        }
        if (target?.mimeType === 'application/vnd.google-apps.presentation') {
          const slides = await fetchGoogleSlidesRemote(token, id);
          return {
            success: true,
            data: JSON.stringify(slides),
            mimeType: target.mimeType,
            name: target.name,
          };
        }
      } catch {
        /* fallback to local cache if offline */
      }
    }
    const saved = this.readStore<string>(`workspace_doc_content_${id}`, '');
    return Promise.resolve({ success: Boolean(saved), data: saved });
  }
  async saveFileContent(id: string, content: string): Promise<boolean> {
    const runner = this.getGasRunner();
    if (runner) {
      return new Promise((resolve) =>
        runner
          .withSuccessHandler((res: string) => resolve(Boolean((JSON.parse(res) as { success?: boolean }).success)))
          .saveFileContent(id, content),
      );
    }
    const token = getWorkspaceAccessToken();
    if (token && !/^(fld_|doc_|sheet_|slide_|up_|drv_|f\d)/.test(id)) {
      const items = await this.getAllDriveItems();
      const target = items.find((i) => i.id === id);
      if (target?.mimeType === 'application/vnd.google-apps.document') {
        const ok = await confirmWorkspaceAction({
          title: 'Salvar documento no Google Docs?',
          description: `O conteúdo de "${target.name}" será atualizado na sua conta Google Docs.`,
          confirmLabel: 'Salvar no Docs',
        });
        if (!ok) return false;
        const plain = content.replace(/<[^>]+>/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
        await updateGoogleDocTextRemote(token, id, plain);
      }
    }
    this.writeStore(`workspace_doc_content_${id}`, content);
    return Promise.resolve(true);
  }
  async moveDriveItem(itemId: string, targetFolderId: string | null): Promise<boolean> {
    const all = await this.getAllDriveItems();
    const targetItem = all.find((i) => i.id === itemId);
    if (!targetItem) return Promise.resolve(false);
    if (targetItem.type === 'folder' && isDescendantFolder(all, itemId, targetFolderId)) {
      return Promise.resolve(false);
    }
    const actor = this.cloudUser?.name || 'Você';
    const next = all.map((item) =>
      item.id === itemId
        ? {
            ...item,
            parentId: targetFolderId || undefined,
            activityLog: [
              { id: `act_${Date.now()}`, actor, action: 'Moveu o arquivo de pasta', timestamp: 'Agora' },
              ...(item.activityLog || []),
            ],
          }
        : item,
    );
    this.writeStore('workspace_drive_items_v2', next);
    return Promise.resolve(true);
  }
  async getFilePermissions(fileId: string): Promise<Permission[]> {
    const all = await this.getAllDriveItems();
    const item = all.find((i) => i.id === fileId);
    return Promise.resolve(
      item?.sharedWith || [
        {
          id: 'owner_me',
          name: this.cloudUser?.name || 'Você',
          email: this.cloudUser?.email || '',
          role: 'owner',
        },
      ],
    );
  }
  async addDrivePermission(
    fileId: string,
    email: string,
    role: 'owner' | 'editor' | 'viewer' = 'editor',
  ): Promise<boolean> {
    const all = await this.getAllDriveItems();
    const targetFile = all.find((i) => i.id === fileId);
    const nameGuess = email.split('@')[0].replace(/[._]/g, ' ');
    const actor = this.cloudUser?.name || 'Você';
    const next = all.map((item) => {
      if (item.id !== fileId) return item;
      const existing: Permission[] = item.sharedWith || [];
      const filtered = existing.filter((p) => p.email.toLowerCase() !== email.toLowerCase());
      return {
        ...item,
        sharedWith: [...filtered, { id: `perm_${Date.now()}`, name: nameGuess, email, role }],
        activityLog: [
          { id: `act_${Date.now()}`, actor, action: `Compartilhou com ${email} (${role})`, timestamp: 'Agora' },
          ...(item.activityLog || []),
        ],
      };
    });
    this.writeStore('workspace_drive_items_v2', next);
    await this.logAudit(
      'DRIVE_PERMISSION_UPDATED',
      `Permissão (${role}) em "${targetFile?.name || fileId}" atribuída para ${email}.`,
    );
    return Promise.resolve(true);
  }
  async removeDrivePermission(fileId: string, email: string): Promise<boolean> {
    const all = await this.getAllDriveItems();
    const targetFile = all.find((i) => i.id === fileId);
    const next = all.map((item) => {
      if (item.id !== fileId) return item;
      return {
        ...item,
        sharedWith: (item.sharedWith || []).filter((p: Permission) => p.email !== email),
      };
    });
    this.writeStore('workspace_drive_items_v2', next);
    await this.logAudit(
      'DRIVE_PERMISSION_REVOKED',
      `Acesso de ${email} ao arquivo "${targetFile?.name || fileId}" foi revogado.`,
      'BLOCKED',
    );
    return Promise.resolve(true);
  }
  async getDriveShareLink(fileId: string): Promise<string> {
    return Promise.resolve(`https://drive.workspace.os/file/d/${fileId}/view?usp=sharing`);
  }
  async getFileVersions(fileId: string): Promise<FileVersion[]> {
    const all = await this.getAllDriveItems();
    const item = all.find((i) => i.id === fileId);
    return Promise.resolve(
      item?.versions || [
        {
          id: 'v1',
          date: item?.date || 'Hoje',
          author: item?.owner === 'eu' ? this.cloudUser?.name || 'Você' : item?.owner || 'Você',
          size: item?.size || '1.2 MB',
        },
      ],
    );
  }

  // --- TASKS ---
  async getTaskLists(): Promise<TaskList[]> {
    if (this.hasStoreKey('workspace_task_lists_v2')) {
      const saved = this.readStore<TaskList[]>('workspace_task_lists_v2', []);
      if (saved.length > 0) return Promise.resolve(saved);
    }
    return Promise.resolve([{ id: 'default', title: 'Minhas Tarefas' }]);
  }
  async saveTaskLists(lists: TaskList[]): Promise<boolean> {
    this.writeStore('workspace_task_lists_v2', lists);
    return Promise.resolve(true);
  }
  async getTasks(listId?: string): Promise<TaskItem[]> {
    const all = this.readStore<TaskItem[]>('workspace_tasks_v2', []);
    if (!listId || listId === 'all' || listId === '@all') return Promise.resolve(all);
    if (listId === 'starred') return Promise.resolve(all.filter((t) => t.starred));
    const targetId = listId === '@default' ? 'default' : listId;
    return Promise.resolve(all.filter((t) => (t.listId || 'default') === targetId));
  }
  async saveAllTasks(tasks: TaskItem[]): Promise<boolean> {
    this.writeStore('workspace_tasks_v2', tasks);
    return Promise.resolve(true);
  }
  async createTaskList(title: string): Promise<TaskList | null> {
    const lists = await this.getTaskLists();
    const newList: TaskList = { id: `list_${Date.now()}`, title: title.trim() };
    const updated = [...lists, newList];
    this.writeStore('workspace_task_lists_v2', updated);
    return Promise.resolve(newList);
  }
  async renameTaskList(id: string, title: string): Promise<boolean> {
    const lists = await this.getTaskLists();
    const updated = lists.map((l) => (l.id === id ? { ...l, title: title.trim() } : l));
    this.writeStore('workspace_task_lists_v2', updated);
    return Promise.resolve(true);
  }
  async deleteTaskList(id: string): Promise<boolean> {
    if (id === 'default') return Promise.resolve(false);
    const lists = await this.getTaskLists();
    this.writeStore(
      'workspace_task_lists_v2',
      lists.filter((l) => l.id !== id),
    );
    const allTasks = await this.getTasks('all');
    this.writeStore(
      'workspace_tasks_v2',
      allTasks.filter((t) => t.listId !== id),
    );
    return Promise.resolve(true);
  }
  async createTask(
    title: string,
    details?: string,
    listId?: string,
    due?: string,
    parent?: string,
    extra?: Partial<TaskItem>,
  ): Promise<{ success: boolean; task: TaskItem }> {
    const all = await this.getTasks('all');
    const resolvedListId = !listId || listId === '@default' || listId === 'all' ? 'default' : listId;
    let newTask: TaskItem = {
      id: `tk_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      title,
      details: details || '',
      completed: false,
      starred: extra?.starred || false,
      date: due,
      time: extra?.time,
      recurrence: extra?.recurrence || 'none',
      linkedSource: extra?.linkedSource,
      listId: resolvedListId,
      parent,
      subtasks: extra?.subtasks || [],
    };
    const token = getWorkspaceAccessToken();
    if (token && !parent) {
      const ok = await confirmWorkspaceAction({
        title: 'Criar tarefa no Google Tarefas?',
        description: `A tarefa "${title}" será adicionada à sua conta Google Tasks.`,
        confirmLabel: 'Criar tarefa',
      });
      if (!ok) return { success: false, task: newTask };
      const targetList = resolvedListId === 'default' ? '@default' : resolvedListId;
      const remoteTask = await createTaskRemote(token, targetList, { title, details, date: due });
      newTask = { ...newTask, ...remoteTask };
    }
    if (parent) {
      const updated = all.map((t) =>
        t.id === parent ? { ...t, subtasks: [...(t.subtasks || []), newTask] } : t,
      );
      this.writeStore('workspace_tasks_v2', updated);
    } else {
      this.writeStore('workspace_tasks_v2', [newTask, ...all]);
    }
    return Promise.resolve({ success: true, task: newTask });
  }
  async toggleTask(id: string | number, _listId?: string): Promise<boolean> {
    const all = await this.getTasks('all');
    const target = all.find((t) => t.id === id);
    const token = getWorkspaceAccessToken();
    if (token && target && !String(target.id).startsWith('tk_')) {
      const ok = await confirmWorkspaceAction({
        title: 'Atualizar status no Google Tarefas?',
        description: `Marcar "${target.title}" como ${target.completed ? 'pendente' : 'concluída'} na sua conta Google Tasks?`,
        confirmLabel: 'Atualizar tarefa',
      });
      if (!ok) return false;
      const targetList = !target.listId || target.listId === 'default' ? '@default' : target.listId;
      await updateTaskRemote(token, targetList, String(target.id), { completed: !target.completed });
    }
    const updated = all.map((t) => {
      if (t.id !== id) return t;
      const nextCompleted = !t.completed;
      return {
        ...t,
        completed: nextCompleted,
        completedAt: nextCompleted ? new Date().toISOString() : undefined,
      };
    });
    this.writeStore('workspace_tasks_v2', updated);
    return Promise.resolve(true);
  }
  async updateTask(task: Partial<TaskItem>): Promise<boolean> {
    const all = await this.getTasks('all');
    const token = getWorkspaceAccessToken();
    if (token && task.id && !String(task.id).startsWith('tk_')) {
      const ok = await confirmWorkspaceAction({
        title: 'Salvar alterações no Google Tarefas?',
        description: `Atualizar "${task.title || 'tarefa'}" na sua conta Google Tasks?`,
        confirmLabel: 'Salvar alteração',
      });
      if (!ok) return false;
      const targetList = !task.listId || task.listId === 'default' ? '@default' : task.listId;
      await updateTaskRemote(token, targetList, String(task.id), {
        title: task.title,
        details: task.details,
        completed: task.completed,
      });
    }
    const updated = all.map((t) => (t.id === task.id ? { ...t, ...task } : t));
    this.writeStore('workspace_tasks_v2', updated);
    return Promise.resolve(true);
  }
  async deleteTask(id: string | number, _listId?: string): Promise<boolean> {
    const all = await this.getTasks('all');
    const target = all.find((t) => t.id === id);
    const token = getWorkspaceAccessToken();
    if (token && target && !String(target.id).startsWith('tk_')) {
      const ok = await confirmWorkspaceAction({
        title: 'Excluir tarefa do Google Tarefas?',
        description: `A tarefa "${target.title}" será excluída permanentemente da sua conta Google Tasks.`,
        confirmLabel: 'Excluir tarefa',
        danger: true,
      });
      if (!ok) return false;
      const targetList = !target.listId || target.listId === 'default' ? '@default' : target.listId;
      await deleteTaskRemote(token, targetList, String(target.id));
    }
    const updated = all
      .filter((t) => t.id !== id)
      .map((t) => ({
        ...t,
        subtasks: (t.subtasks || []).filter((s) => s.id !== id),
      }));
    this.writeStore('workspace_tasks_v2', updated);
    return Promise.resolve(true);
  }

  // --- KEEP ---
  async getNotes(): Promise<NoteItem[]> {
    return Promise.resolve(this.readStore<NoteItem[]>('workspace_notes_v2', []));
  }
  async saveAllNotes(notes: NoteItem[]): Promise<boolean> {
    this.writeStore('workspace_notes_v2', notes);
    return Promise.resolve(true);
  }
  async getKeepLabels(): Promise<string[]> {
    return Promise.resolve(this.readStore<string[]>('workspace_keep_labels_v2', []));
  }
  async saveKeepLabels(labels: string[]): Promise<boolean> {
    this.writeStore('workspace_keep_labels_v2', labels);
    return Promise.resolve(true);
  }
  async addNote(note: NoteItem): Promise<boolean> {
    const all = await this.getNotes();
    const exists = all.some((n) => n.id === note.id);
    const updated = exists ? all.map((n) => (n.id === note.id ? note : n)) : [note, ...all];
    this.writeStore('workspace_notes_v2', updated);
    return Promise.resolve(true);
  }
  async updateNote(note: Partial<NoteItem>): Promise<boolean> {
    const all = await this.getNotes();
    const updated = all.map((n) => (n.id === note.id ? { ...n, ...note } : n));
    this.writeStore('workspace_notes_v2', updated);
    return Promise.resolve(true);
  }
  async deleteNote(id: number | string): Promise<boolean> {
    const all = await this.getNotes();
    const updated = all.filter((n) => String(n.id) !== String(id));
    this.writeStore('workspace_notes_v2', updated);
    return Promise.resolve(true);
  }
  async copyNoteToDoc(note: NoteItem): Promise<{ success: boolean; doc: EnrichedDriveItem }> {
    const checklistHtml =
      note.checklist && note.checklist.length > 0
        ? `<ul>${note.checklist
            .map((c) => `<li>${c.checked ? '☑' : '☐'} ${escapeHtml(c.text)}</li>`)
            .join('')}</ul>`
        : '';
    const docTitle = `${note.title || 'Nota do Google Keep'} — Documento`;
    const newDoc = await this.createDriveDocument('doc', docTitle);
    const htmlContent = `<h1>${escapeHtml(note.title || 'Nota do Google Keep')}</h1><p>${escapeHtml(note.content || '').replace(/\n/g, '<br/>')}</p>${checklistHtml}`;
    this.writeStore(`workspace_doc_content_${newDoc.id}`, htmlContent);
    return Promise.resolve({ success: true, doc: newDoc });
  }
  async uploadKeepImage(
    base64: string,
    mime: string,
  ): Promise<{ success: boolean; id?: string; url?: string }> {
    return Promise.resolve({
      success: true,
      id: `img_${Date.now()}`,
      url: base64.startsWith('data:') ? base64 : `data:${mime || 'image/png'};base64,${base64}`,
    });
  }

  // --- SEGURANÇA & AUDITORIA ---
  private hasStoreKey(key: string): boolean {
    if (this.storeCache.has(key)) return true;
    try {
      return localStorage.getItem(key) !== null;
    } catch {
      return false;
    }
  }
  private readStore<T>(key: string, fallback: T): T {
    if (this.storeCache.has(key)) {
      return this.storeCache.get(key) as T;
    }
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as T;
      this.storeCache.set(key, parsed);
      return parsed;
    } catch {
      return fallback;
    }
  }
  private writeStore<T>(key: string, value: T): void {
    this.storeCache.set(key, value);
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage indisponível */
    }
  }
  async getAuditLogs(): Promise<AuditLog[]> {
    const logs = this.readStore<AuditLog[]>('workspace_audit_logs', []);
    return Promise.resolve(
      [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    );
  }
  async logAudit(action: string, details: string, status: LogStatus = 'SUCCESS'): Promise<AuditLog> {
    const logs = await this.getAuditLogs();
    const entry: AuditLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      action,
      details,
      status,
      timestamp: new Date().toISOString(),
      ipAddress: 'Local',
      device: typeof navigator !== 'undefined' ? navigator.userAgent : 'Desconhecido',
    };
    this.writeStore('workspace_audit_logs', [entry, ...logs].slice(0, 200));
    return Promise.resolve(entry);
  }
  async simulateAttack(type: string): Promise<AuditLog> {
    const attacks: Record<string, { action: string; details: string }> = {
      unauthorized_calendar: {
        action: 'INTRUSION_CALENDAR',
        details: 'Script externo tentou ler a agenda sem token de autorização. Requisição bloqueada pelo firewall de aplicação.',
      },
      csrf_session: {
        action: 'CSRF_HIJACK',
        details: 'Tentativa de sequestro de sessão via requisição forjada de IP suspeito. Token invalidado e sessão preservada.',
      },
      sqli_malicious: {
        action: 'SQL_INJECTION',
        details: "Payload malicioso (' OR 1=1 --) detectado no campo de notas. Entrada sanitizada e transação descartada.",
      },
    };
    const attack = attacks[type] || { action: 'UNKNOWN_ATTACK', details: 'Atividade anômala detectada e bloqueada.' };
    return this.logAudit(attack.action, attack.details, 'BLOCKED');
  }
  async getSecurityState(): Promise<SecurityState> {
    return Promise.resolve(this.readStore<SecurityState>('workspace_security', { mfaEnabled: false, mfaSecret: '' }));
  }
  generateMfaSecret(): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const bytes = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    let secret = '';
    for (let i = 0; i < bytes.length; i++) secret += alphabet[bytes[i] % alphabet.length];
    return secret;
  }
  async setMfaEnabled(enabled: boolean, secret?: string): Promise<SecurityState> {
    const state: SecurityState = {
      mfaEnabled: enabled,
      mfaSecret: enabled ? secret || this.generateMfaSecret() : '',
    };
    this.writeStore('workspace_security', state);
    await this.logAudit(
      enabled ? 'MFA_ENABLED' : 'MFA_DISABLED',
      enabled
        ? 'Autenticação de dois fatores (TOTP) ativada para a conta.'
        : 'Autenticação de dois fatores desativada a pedido do usuário.',
    );
    return Promise.resolve(state);
  }

  // --- PERMISSÕES DE COMPARTILHAMENTO ---
  async getPermissions(
    currentUserEmail: string,
  ): Promise<{ sharedByMe: SharedPermission[]; sharedWithMe: SharedPermission[] }> {
    const all = this.readStore<SharedPermission[]>('workspace_permissions', []);
    if (!currentUserEmail) {
      return Promise.resolve({ sharedByMe: [], sharedWithMe: [] });
    }
    return Promise.resolve({
      sharedByMe: all.filter((p) => p.ownerEmail === currentUserEmail && p.status === 'ACTIVE'),
      sharedWithMe: all.filter((p) => p.collaboratorEmail === currentUserEmail && p.status === 'ACTIVE'),
    });
  }
  async createPermission(
    ownerEmail: string,
    collaboratorEmail: string,
    resourceType: ResourceType,
    accessLevel: AccessLevel,
    expiresAt?: string,
  ): Promise<SharedPermission> {
    const all = this.readStore<SharedPermission[]>('workspace_permissions', []);
    const perm: SharedPermission = {
      id: `perm_${Date.now()}`,
      ownerEmail,
      collaboratorEmail,
      resourceType,
      accessLevel,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt || undefined,
    };
    this.writeStore('workspace_permissions', [perm, ...all]);
    this.writeStore('workspace_permissions_initialized', true);
    await this.logAudit(
      'PERMISSION_GRANTED',
      `Compartilhamento (${resourceType}/${accessLevel}) concedido para ${collaboratorEmail}.`,
    );
    return Promise.resolve(perm);
  }
  async updatePermission(id: string, accessLevel: AccessLevel): Promise<boolean> {
    const all = this.readStore<SharedPermission[]>('workspace_permissions', []);
    const perm = all.find((p) => p.id === id);
    if (!perm) return Promise.resolve(false);
    perm.accessLevel = accessLevel;
    this.writeStore('workspace_permissions', all);
    await this.logAudit(
      'PERMISSION_UPDATED',
      `Nível de acesso de ${perm.collaboratorEmail} alterado para ${accessLevel.toUpperCase()}.`,
    );
    return Promise.resolve(true);
  }
  async revokePermission(id: string): Promise<boolean> {
    const all = this.readStore<SharedPermission[]>('workspace_permissions', []);
    const perm = all.find((p) => p.id === id);
    if (!perm) return Promise.resolve(false);
    perm.status = 'REVOKED';
    this.writeStore('workspace_permissions', all);
    await this.logAudit(
      'PERMISSION_REVOKED',
      `Todos os acessos de ${perm.collaboratorEmail} foram revogados.`,
      'BLOCKED',
    );
    return Promise.resolve(true);
  }
}

export const bridge = new GASBridge();