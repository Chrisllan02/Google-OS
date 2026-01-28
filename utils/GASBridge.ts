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
    images?: string[]; // Array of File IDs or URLs
    labels?: string[]; // Array of strings
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
    parent?: string; // ID of parent task
    position?: string; // Sort key
    listId?: string; // Which list it belongs to (frontend helper)
    subtasks?: TaskItem[]; // Helper for frontend tree
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

export interface DriveResponse {
    category: string; currentFolderId: string | null; currentFolderName: string;
    parentId: string | null; folders: DriveItem[]; files: DriveItem[];
}

export interface FileContentResponse {
    success: boolean; data?: string; mimeType?: string; name?: string; error?: string;
}

export interface EmailAttachment { name: string; mimeType: string; data: string; }

export interface SearchResults { emails: any[]; files: any[]; events: any[]; error?: string; }

export interface CalendarEvent {
    id: string;
    title: string;
    start: string; // ISO
    end: string;   // ISO
    isAllDay?: boolean;
    calendarId: string;
    description?: string;
    location?: string;
    recurrence?: string[]; // RRULE array
    guests?: EventGuest[];
    meetLink?: string;
    color?: string; // UI override
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

const MOCK_DATA: DashboardData = {
  user: { name: "Dev Criativo", email: "dev@workspace.new", avatar: "https://ui-avatars.com/api/?name=Dev+Criativo&background=4285F4&color=fff" },
  weather: { temp: "24°", location: "São Paulo" },
  stats: { storageUsed: 78, unreadEmails: 3 },
  emails: [
    { id: 1, subject: "Design System v2.0", sender: "Julia Silva", senderInit: "J", color: "bg-purple-500", time: "10:30", preview: "Oi! Atualizei os componentes no Figma...", read: false, hasAttachment: true, messageCount: 2 },
    { id: 2, subject: "Fatura AWS Pendente", sender: "Financeiro", senderInit: "F", color: "bg-orange-500", time: "09:15", preview: "Segue anexo a fatura referente ao mês...", read: false, hasAttachment: true, messageCount: 1 },
  ],
  calendars: [
      { id: 'primary', name: 'Dev Criativo', color: 'bg-blue-600', checked: true, accessRole: 'owner' },
      { id: 'cal_work', name: 'Trabalho', color: 'bg-orange-500', checked: true, accessRole: 'writer' },
      { id: 'cal_holidays', name: 'Feriados', color: 'bg-green-500', checked: true, accessRole: 'reader' }
  ],
  events: [
      { id: 'ev_1', title: 'Daily Scrum', start: new Date().toISOString(), end: new Date(Date.now() + 3600000).toISOString(), calendarId: 'cal_work', guests: [{email: 'julia@email.com', responseStatus: 'accepted'}, {email: 'dev@workspace.new', responseStatus: 'accepted', organizer: true}] },
      { id: 'ev_2', title: 'Almoço Equipe', start: new Date(Date.now() + 86400000).toISOString(), end: new Date(Date.now() + 90000000).toISOString(), calendarId: 'primary', recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=FR'] }
  ],
  files: [
      { id: 'f1', name: "Orçamento 2024.xlsx", type: 'sheet', mimeType: 'application/vnd.google-apps.spreadsheet', owner: "Eu", date: "Há 2h", size: "1.2 MB", isStarred: true, thumbnail: "https://images.unsplash.com/photo-1543286386-713df548e9cc?w=400" },
      { id: 'f2', name: "Apresentação Vendas.ppt", type: 'slide', mimeType: 'application/vnd.google-apps.presentation', owner: "Julia", date: "Há 5h", size: "15 MB", isStarred: false, thumbnail: "https://images.unsplash.com/photo-1542626991-cbc4e32524cc?w=400" },
      { id: 'f3', name: "Briefing IA.docx", type: 'doc', mimeType: 'application/vnd.google-apps.document', owner: "Legal", date: "Ontem", size: "450 KB", isStarred: false }
  ],
  tasks: [ { id: "task_1", title: "Review Q3 Report", completed: false, date: new Date().toISOString() } ],
  notes: []
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

  // ... (Other methods remain same until createCalendarEvent)

  async createCalendarEvent(data: Partial<CalendarEvent>): Promise<{success: boolean, id?: string, meetLink?: string}> { 
      if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).createCalendarEvent({...data})); 
      
      // Mock creation with Meet Link
      const meetCode = Array(3).fill('').map(() => Math.random().toString(36).substring(2, 5)).join('-');
      return Promise.resolve({success:true, id: Date.now().toString(), meetLink: `https://meet.google.com/${meetCode}`}); 
  }

  // ... (Rest of GASBridge methods)
  async searchAll(query: string): Promise<SearchResults> {
      if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).searchAll(query));
      return Promise.resolve({ emails: [], files: [], events: [] });
  }

  async getEmailsPaged(start: number, limit: number, folder: string, query: string = ''): Promise<any[]> {
      if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).getEmailsPaged(start, limit, folder, query));
      return Promise.resolve([]);
  }
  async createLabel(name: string): Promise<boolean> {
      if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).createGmailLabel(name));
      return Promise.resolve(true);
  }
  async batchManageEmails(ids: Array<number | string>, action: string): Promise<boolean> {
      if (this.isGasEnvironment()) return new Promise((resolve)=>(window as any).google.script.run.withSuccessHandler((r:string)=>resolve(JSON.parse(r).success)).batchManageEmails(ids, action));
      return Promise.resolve(true);
  }
  async snoozeEmail(id: number | string, until: string): Promise<boolean> {
      if (this.isGasEnvironment()) return new Promise((resolve)=>(window as any).google.script.run.withSuccessHandler((r:string)=>resolve(JSON.parse(r).success)).snoozeEmail(id, until));
      return Promise.resolve(true);
  }
  async sendEmail(to: string, subject: string, body: string, attachments: EmailAttachment[] = []): Promise<boolean> {
      if (this.isGasEnvironment()) return new Promise((resolve, reject) => { (window as any).google.script.run.withSuccessHandler((res: string) => resolve(JSON.parse(res).success)).withFailureHandler(reject).sendEmail(to, subject, body, attachments); });
      return Promise.resolve(true);
  }
  async scheduleSend(to: string, subject: string, body: string, time: string, attachments: EmailAttachment[] = []): Promise<boolean> {
      if (this.isGasEnvironment()) return new Promise((resolve)=>(window as any).google.script.run.withSuccessHandler((r:string)=>resolve(JSON.parse(r).success)).scheduleSend(to, subject, body, time, attachments));
      return Promise.resolve(true);
  }
  async saveDraft(to: string, subject: string, body: string, attachments: EmailAttachment[] = []): Promise<boolean> {
      if (this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).saveDraftReal(to, subject, body, attachments));
      return Promise.resolve(true);
  }
  async getThreadDetails(threadId: string | number): Promise<any> {
      if (this.isGasEnvironment()) return new Promise((resolve)=>(window as any).google.script.run.withSuccessHandler((r:string)=>resolve(JSON.parse(r))).getThreadDetails(threadId));
      return Promise.resolve({ success: true, messages: [{ id: 1, from: "Mock", senderInit: "M", to: "Me", date: "10:00", body: "Content.", attachments: [] }] });
  }
  async getEmailAttachment(messageId: string, attachmentIndex: number): Promise<FileContentResponse> {
      if (this.isGasEnvironment()) return new Promise((resolve, reject)=>(window as any).google.script.run.withSuccessHandler((r:string)=>resolve(JSON.parse(r))).withFailureHandler(reject).getEmailAttachmentContent(messageId, attachmentIndex));
      return Promise.resolve({ success: false });
  }
  async searchContacts(query: string): Promise<any[]> {
      if (this.isGasEnvironment()) return new Promise((resolve) => (window as any).google.script.run.withSuccessHandler((r: string) => resolve(JSON.parse(r))).searchContacts(query));
      return Promise.resolve([]);
  }
  async getCalendars(): Promise<CalendarListEntry[]> {
      if (this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).getCalendars());
      return Promise.resolve(MOCK_DATA.calendars || []);
  }
  async checkFreeBusy(start: string, end: string, emails: string[]): Promise<any> {
      if (this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).checkFreeBusy(start, end, emails));
      return Promise.resolve({ success: true });
  }
  async updateCalendarEvent(data: Partial<CalendarEvent>): Promise<{success: boolean}> { 
      if(this.isGasEnvironment()) return new Promise((r) => (window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).updateCalendarEvent(data)); 
      return Promise.resolve({success:true}); 
  }
  async deleteCalendarEvent(id: string, calendarId?: string) { 
      if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).deleteCalendarEvent(id, calendarId)); 
      return Promise.resolve(true); 
  }
  async rsvpEvent(eventId: string, status: 'accepted'|'declined'|'tentative') {
      if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).rsvpEvent(eventId, status));
      return Promise.resolve(true);
  }
  async getDriveItems(p: any, c: any, q: any): Promise<DriveResponse> { 
      if(this.isGasEnvironment()) return new Promise((r,rj)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).withFailureHandler(rj).getDriveItems({folderId:p, category:c, query:q})); 
      const files = (!p && c === 'root') ? MOCK_DATA.files : [];
      return Promise.resolve({files: files, folders:[], category:'root', currentFolderName:'Mock', currentFolderId: null, parentId: null}); 
  }
  async getFolderTree(parentId?: string | null): Promise<DriveItem[]> {
      if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).getFolderTree(parentId));
      if (!parentId || parentId === 'root') {
          return Promise.resolve([
              { id: 'fld_1', name: 'Documentos', type: 'folder', owner: 'me', date: '', isStarred: false, parentId: 'root' },
              { id: 'fld_2', name: 'Projetos', type: 'folder', owner: 'me', date: '', isStarred: false, parentId: 'root' }
          ]);
      }
      return Promise.resolve([]);
  }
  async createDriveFolder(n: string, p: any) { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).createDriveFolder(n,p)); return Promise.resolve(true); }
  async renameDriveItem(id: string, n: string) { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).renameDriveItem(id,n)); return Promise.resolve(true); }
  async trashDriveItem(id: string) { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).trashDriveItem(id)); return Promise.resolve(true); }
  async restoreDriveItem(id: string) { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).restoreDriveItem(id)); return Promise.resolve(true); }
  async deleteDriveItemForever(id: string) { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).deleteDriveItemForever(id)); return Promise.resolve(true); }
  async emptyTrash() { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).emptyTrash()); return Promise.resolve(true); }

  async setStarredDriveItem(id: string, s: boolean) { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).setStarredDriveItem(id,s)); return Promise.resolve(true); }
  async uploadFileChunk(d: string, n: string, m: string, p: any, offset: number, total: number, fileId?: string) { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).uploadFileChunk(d,n,m,p,offset,total,fileId)); return Promise.resolve({success:true}); }
  async uploadFileToDrive(d: string, n: string, m: string, p: any) { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).uploadFileToDrive(d,n,m,p)); return Promise.resolve(true); }
  async getFileContent(id: string): Promise<FileContentResponse> { if(this.isGasEnvironment()) return new Promise((r,rj)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).withFailureHandler(rj).getFileContent(id)); return Promise.resolve({success:false}); }
  async saveFileContent(id: string, content: string): Promise<boolean> { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).saveFileContent(id, content)); return Promise.resolve(true); }
  async moveDriveItem(itemId: string, targetFolderId: string): Promise<boolean> { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).moveDriveItem(itemId, targetFolderId)); return Promise.resolve(true); }
  async getFilePermissions(fileId: string): Promise<Permission[]> {
      if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).getFilePermissions(fileId));
      return Promise.resolve([
          { id: 'user_1', name: 'Eu (Proprietário)', email: 'eu@email.com', role: 'owner', avatar: 'E' },
          { id: 'user_2', name: 'Julia Silva', email: 'julia@email.com', role: 'editor', avatar: 'J' }
      ]);
  }
  async addDrivePermission(fileId: string, email: string, role: string): Promise<boolean> { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).addDrivePermission(fileId, email, role)); return Promise.resolve(true); }
  async removeDrivePermission(fileId: string, email: string): Promise<boolean> { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).removeDrivePermission(fileId, email)); return Promise.resolve(true); }
  async getDriveShareLink(fileId: string): Promise<string> { return Promise.resolve(`https://drive.google.com/file/d/${fileId}/view`); }
  async getFileVersions(fileId: string): Promise<FileVersion[]> {
      if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).getFileVersions(fileId));
      return Promise.resolve([
          { id: 'v2', date: 'Hoje, 10:30', author: 'Eu', size: '1.2 MB' },
          { id: 'v1', date: 'Ontem, 18:00', author: 'Julia Silva', size: '1.1 MB' }
      ]);
  }

  async getTaskLists(): Promise<TaskList[]> { if (this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).getTaskLists()); return Promise.resolve([]); }
  async getTasks(listId: string): Promise<TaskItem[]> { if (this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).getTasks(listId)); return Promise.resolve([]); }
  async createTaskList(title: string): Promise<TaskList | null> { if (this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).createTaskList(title)); return Promise.resolve(null); }
  async deleteTaskList(id: string): Promise<boolean> { if (this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).deleteTaskList(id)); return Promise.resolve(true); }
  async createTask(title: string, details?: string, listId?: string, due?: string, parent?: string): Promise<any> { if (this.isGasEnvironment()) return new Promise((resolve) => { (window as any).google.script.run.withSuccessHandler((res: string) => resolve(JSON.parse(res))).createTask(listId, title, details, due, parent); }); return Promise.resolve({ success: true, task: { id: Date.now(), title, details, completed: false, date: new Date().toISOString() } }); }
  async toggleTask(id: string, listId?: string): Promise<boolean> { if (this.isGasEnvironment()) return new Promise((resolve) => { (window as any).google.script.run.withSuccessHandler((res: string) => resolve(JSON.parse(res).success)).toggleTask(id, listId); }); return Promise.resolve(true); }
  async updateTask(task: Partial<TaskItem>): Promise<boolean> { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).updateTask(task)); return Promise.resolve(true); }
  async deleteTask(id: string, listId?: string): Promise<boolean> { if (this.isGasEnvironment()) return new Promise((resolve) => { (window as any).google.script.run.withSuccessHandler((res: string) => resolve(JSON.parse(res).success)).deleteTask(id, listId); }); return Promise.resolve(true); }
  async addNote(note: NoteItem): Promise<boolean> { if (this.isGasEnvironment()) return new Promise((resolve) => { (window as any).google.script.run.withSuccessHandler((res: string) => resolve(JSON.parse(res).success)).saveNote(note); }); return Promise.resolve(true); }
  async deleteNote(id: number | string): Promise<boolean> { if (this.isGasEnvironment()) return new Promise((resolve) => { (window as any).google.script.run.withSuccessHandler((res: string) => resolve(JSON.parse(res).success)).deleteNote(id); }); return Promise.resolve(true); }
  async uploadKeepImage(base64: string, mime: string): Promise<{success: boolean, id?: string, url?: string}> { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).uploadKeepImage(base64, mime)); return Promise.resolve({success:true, id: 'mock_img_id', url: 'https://source.unsplash.com/random/200x200'}); }
}

export const bridge = new GASBridge();