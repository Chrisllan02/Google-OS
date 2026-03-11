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

const MOCK_DATA: DashboardData = {
  user: { name: "Dev Criativo", email: "dev@workspace.new", avatar: "https://ui-avatars.com/api/?name=Dev+Criativo&background=4285F4&color=fff" },
  weather: { temp: "24°", location: "São Paulo" },
  stats: { storageUsed: 78, unreadEmails: 3 },
  emails: [],
  calendars: [],
  events: [],
  files: [],
  tasks: [],
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
    return Promise.resolve([]);
  }
  async createCalendarEvent(data: Partial<CalendarEvent>): Promise<{success: boolean, id?: string, meetLink?: string}> { return Promise.resolve({success:true}); }
  async checkFreeBusy(start: string, end: string, emails: string[]): Promise<any> { return Promise.resolve({ success: true }); }
  async updateCalendarEvent(data: Partial<CalendarEvent>): Promise<{success: boolean}> { return Promise.resolve({success:true}); }
  async deleteCalendarEvent(id: string, calendarId?: string): Promise<boolean> { return Promise.resolve(true); }
  async rsvpEvent(eventId: string, status: 'accepted'|'declined'|'tentative'): Promise<boolean> { return Promise.resolve(true); }
  
  // --- MAIL & CONTACTS ---
  async searchAll(query: string): Promise<SearchResults> { return Promise.resolve({ emails: [], files: [], events: [] }); }
  async getEmailsPaged(start: number, limit: number, folder: string, query: string = ''): Promise<any[]> { return Promise.resolve([]); }
  async createLabel(name: string): Promise<boolean> { return Promise.resolve(true); }
  async batchManageEmails(ids: Array<number | string>, action: string): Promise<boolean> { return Promise.resolve(true); }
  async snoozeEmail(id: number | string, until: string): Promise<boolean> { return Promise.resolve(true); }
  async sendEmail(to: string, subject: string, body: string, attachments: EmailAttachment[] = []): Promise<boolean> { return Promise.resolve(true); }
  async scheduleSend(to: string, subject: string, body: string, time: string, attachments: EmailAttachment[] = []): Promise<boolean> { return Promise.resolve(true); }
  async saveDraft(to: string, subject: string, body: string, attachments: EmailAttachment[] = []): Promise<boolean> { return Promise.resolve(true); }
  async getThreadDetails(threadId: string | number): Promise<any> { return Promise.resolve({ success: true, messages: [] }); }
  async getEmailAttachment(messageId: string, attachmentIndex: number): Promise<FileContentResponse> { return Promise.resolve({ success: false }); }
  async searchContacts(query: string): Promise<any[]> { return Promise.resolve([]); }

  // --- DRIVE ---
  async getDriveItems(folderId: string | null, category: string, query: string): Promise<DriveResponse> { 
      if(this.isGasEnvironment()) return new Promise((r,rj)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).withFailureHandler(rj).getDriveItems({folderId, category, query})); 
      return Promise.resolve({files: [], folders:[], category:'root', currentFolderName:'Mock', currentFolderId: null, parentId: null}); 
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
  async getTaskLists(): Promise<TaskList[]> { return Promise.resolve([]); }
  async getTasks(listId: string): Promise<TaskItem[]> { return Promise.resolve([]); }
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