import { GoogleIcons } from '../components/GoogleIcons';

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

  // --- MEET SIGNALING ---
  async registerMeeting(roomCode: string, peerId: string): Promise<boolean> { return Promise.resolve(true); }
  async getMeetingPeer(roomCode: string): Promise<string | null> { return Promise.resolve(null); }

  // --- CALENDAR ---
  async getCalendars(): Promise<CalendarListEntry[]> {
      if (this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).getCalendars());
      return Promise.resolve(MOCK_DATA.calendars || []);
  }
  async getEvents(calendarId: string, start: string, end: string): Promise<CalendarEvent[]> {
    if (this.isGasEnvironment()) {
        return new Promise((resolve) => {
            (window as any).google.script.run
                .withSuccessHandler((res: string) => resolve(JSON.parse(res).map((ev:any) => ({...ev, start: new Date(ev.start), end: new Date(ev.end)}))))
                .getEvents(calendarId, start, end);
        });
    }
    return Promise.resolve(MOCK_EVENTS.map(ev => ({ ...ev, start: new Date(ev.start) as any, end: new Date(ev.end) as any })));
  }
  async createCalendarEvent(data: Partial<CalendarEvent>): Promise<{success: boolean, id?: string, meetLink?: string}> { return Promise.resolve({success:true}); }
  async checkFreeBusy(start: string, end: string, emails: string[]): Promise<any> { return Promise.resolve({ success: true }); }
  async updateCalendarEvent(data: Partial<CalendarEvent>): Promise<{success: boolean}> { return Promise.resolve({success:true}); }
  async deleteCalendarEvent(id: string, calendarId?: string): Promise<boolean> { return Promise.resolve(true); }
  async rsvpEvent(eventId: string, status: 'accepted'|'declined'|'tentative'): Promise<boolean> { return Promise.resolve(true); }
  
  // --- MAIL & CONTACTS ---
  async searchAll(query: string): Promise<SearchResults> {
    if (!query) return Promise.resolve({ emails: [], files: [], events: [] });
    const q = query.toLowerCase();
    return Promise.resolve({
      emails: MOCK_EMAILS.filter(e => e.subject.toLowerCase().includes(q) || e.preview.toLowerCase().includes(q) || e.sender.toLowerCase().includes(q)),
      files:  MOCK_FILES.filter(f => f.name.toLowerCase().includes(q)),
      events: MOCK_EVENTS.filter(e => e.title.toLowerCase().includes(q)),
    });
  }
  async getEmailsPaged(start: number, limit: number, folder: string, query: string = ''): Promise<any[]> { return Promise.resolve([]); }
  async createLabel(name: string): Promise<boolean> { return Promise.resolve(true); }
  async batchManageEmails(ids: Array<number | string>, action: string): Promise<boolean> { return Promise.resolve(true); }
  async snoozeEmail(id: number | string, until: string): Promise<boolean> { return Promise.resolve(true); }
  async sendEmail(to: string, subject: string, body: string, attachments: EmailAttachment[] = []): Promise<boolean> { return Promise.resolve(true); }
  async scheduleSend(to: string, subject: string, body: string, time: string, attachments: EmailAttachment[] = []): Promise<boolean> { return Promise.resolve(true); }
  async saveDraft(to: string, subject: string, body: string, attachments: EmailAttachment[] = []): Promise<boolean> { return Promise.resolve(true); }
  async getThreadDetails(threadId: string | number): Promise<any> { return Promise.resolve({ success: true, messages: [] }); }
  async getEmailAttachment(messageId: string, attachmentIndex: number): Promise<FileContentResponse> { return Promise.resolve({ success: false }); }
  async searchContacts(query: string): Promise<any[]> {
    if (!query) return Promise.resolve([]);
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
  async getDriveItems(folderId: string | null, category: string, query: string): Promise<DriveResponse> { 
      if(this.isGasEnvironment()) return new Promise((r,rj)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).withFailureHandler(rj).getDriveItems({folderId, category, query})); 
      return Promise.resolve({ files: MOCK_FILES, folders: [], category: category || 'root', currentFolderName: 'Meu Drive', currentFolderId: null, parentId: null });
  }
  async getFolderTree(parentId?: string | null): Promise<DriveItem[]> { return Promise.resolve([]); }
  async createDriveFolder(name: string, parentId: string | null): Promise<boolean> { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).createDriveFolder(name,parentId)); return Promise.resolve(true); }
  async renameDriveItem(id: string, name: string): Promise<boolean> { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).renameDriveItem(id,name)); return Promise.resolve(true); }
  async trashDriveItem(id: string): Promise<boolean> { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).trashDriveItem(id)); return Promise.resolve(true); }
  async restoreDriveItem(id: string): Promise<boolean> { return Promise.resolve(true); }
  async deleteDriveItemForever(id: string): Promise<boolean> { return Promise.resolve(true); }
  async emptyTrash(): Promise<boolean> { return Promise.resolve(true); }
  async setStarredDriveItem(id: string, starred: boolean): Promise<boolean> { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).setStarredDriveItem(id,starred)); return Promise.resolve(true); }
  async uploadFileToDrive(data: string, name: string, mimeType: string, parentId: string | null): Promise<boolean> { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).uploadFileToDrive(data,name,mimeType,parentId)); return Promise.resolve(true); }
  async getFileContent(id: string): Promise<FileContentResponse> { if(this.isGasEnvironment()) return new Promise((r,rj)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).withFailureHandler(rj).getFileContent(id)); return Promise.resolve({success:false}); }
  async saveFileContent(id: string, content: string): Promise<boolean> { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).saveFileContent(id, content)); return Promise.resolve(true); }
  async moveDriveItem(itemId: string, targetFolderId: string): Promise<boolean> { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).moveDriveItem(itemId, targetFolderId)); return Promise.resolve(true); }
  async getFilePermissions(fileId: string): Promise<Permission[]> { return Promise.resolve([]); }
  async addDrivePermission(fileId: string, email: string, role: string): Promise<boolean> { return Promise.resolve(true); }
  async removeDrivePermission(fileId: string, email: string): Promise<boolean> { return Promise.resolve(true); }
  async getDriveShareLink(fileId: string): Promise<string> { return Promise.resolve(""); }
  async getFileVersions(fileId: string): Promise<FileVersion[]> { return Promise.resolve([]); }

  // --- TASKS ---
  async getTaskLists(): Promise<TaskList[]> { return Promise.resolve([{ id: 'default', title: 'Minhas Tarefas' }]); }
  async getTasks(listId: string): Promise<TaskItem[]> { return Promise.resolve(MOCK_TASKS); }
  async createTaskList(title: string): Promise<TaskList | null> { return Promise.resolve(null); }
  async deleteTaskList(id: string): Promise<boolean> { return Promise.resolve(true); }
  async createTask(title: string, details?: string, listId?: string, due?: string, parent?: string): Promise<any> { return Promise.resolve({ success: true, task: {id: Date.now().toString(), title, completed: false} }); }
  async toggleTask(id: string | number, listId?: string): Promise<boolean> { return Promise.resolve(true); }
  async updateTask(task: Partial<TaskItem>): Promise<boolean> { return Promise.resolve(true); }
  async deleteTask(id: string | number, listId?: string): Promise<boolean> { return Promise.resolve(true); }
  
  // --- KEEP ---
  async addNote(note: NoteItem): Promise<boolean> { return Promise.resolve(true); }
  async deleteNote(id: number | string): Promise<boolean> { return Promise.resolve(true); }
  async uploadKeepImage(base64: string, mime: string): Promise<{success: boolean, id?: string, url?: string}> { return Promise.resolve({success:true, id: 'mock_img_id', url: 'https://source.unsplash.com/random/200x200'}); }
}

export const bridge = new GASBridge();