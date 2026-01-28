
import { GoogleIcons } from '../components/GoogleIcons';

export interface DashboardData {
  user: { name: string; email: string; avatar: string; };
  weather: { temp: string; location: string; };
  stats: { storageUsed: number; unreadEmails: number; };
  emails: any[]; labels?: any[]; events: any[]; calendars?: any[]; files: DriveItem[]; 
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
}

export interface DriveResponse {
    category: string; currentFolderId: string | null; currentFolderName: string;
    parentId: string | null; folders: DriveItem[]; files: DriveItem[];
}

export interface FileContentResponse {
    success: boolean; data?: string; mimeType?: string; name?: string; error?: string;
}

export interface EmailAttachment { name: string; mimeType: string; data: string; }

// --- UNIFIED SEARCH RESULT INTERFACE ---
export interface SearchResults {
    emails: any[];
    files: any[];
    events: any[];
    error?: string;
}

class GASBridge {
  private isGasEnvironment(): boolean {
    return typeof window !== 'undefined' && (window as any).google && (window as any).google.script;
  }

  async getInitialData(): Promise<DashboardData> {
    if (this.isGasEnvironment()) {
      return new Promise((resolve) => {
        (window as any).google.script.run
          .withSuccessHandler((res: string) => { try { resolve(JSON.parse(res)); } catch (e) { resolve({} as any); } })
          .withFailureHandler(() => resolve({} as any))
          .getInitialData();
      });
    }
    return Promise.resolve({} as any);
  }

  // --- UNIFIED SEARCH ---
  async searchAll(query: string): Promise<SearchResults> {
      if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).searchAll(query));
      
      // Mock Search
      console.log(`[MOCK] Searching for: ${query}`);
      await new Promise(r => setTimeout(r, 1000)); // Simulate delay
      return Promise.resolve({
          emails: [
              { id: 'e_mock_1', subject: `Re: ${query}`, sender: "Mock Sender", senderInit: "M", preview: `Results found for ${query}...`, time: "Agora" }
          ],
          files: [
              { id: 'f_mock_1', name: `${query} Report.pdf`, type: 'pdf', owner: "Eu", date: "Hoje" }
          ],
          events: [
              { id: 'ev_mock_1', title: `Meeting about ${query}`, start: new Date().toISOString(), end: new Date().toISOString(), location: 'Meet' }
          ]
      });
  }

  // --- MAIL ---
  async getEmailsPaged(start: number, limit: number, folder: string, query: string = ''): Promise<any[]> {
      if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).getEmailsPaged(start, limit, folder, query));
      return Promise.resolve([]);
  }
  async createLabel(name: string): Promise<boolean> {
      if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).createGmailLabel(name));
      return Promise.resolve(true);
  }
  async manageEmail(id: number | string, action: string): Promise<boolean> {
      if (this.isGasEnvironment()) return new Promise((resolve)=>(window as any).google.script.run.withSuccessHandler((r:string)=>resolve(JSON.parse(r).success)).manageEmail(id, action));
      return Promise.resolve(true);
  }
  async batchManageEmails(ids: Array<number | string>, action: string): Promise<boolean> {
      if (this.isGasEnvironment()) return new Promise((resolve)=>(window as any).google.script.run.withSuccessHandler((r:string)=>resolve(JSON.parse(r).success)).batchManageEmails(ids, action));
      return Promise.resolve(true);
  }
  async sendEmail(to: string, subject: string, body: string, attachments: EmailAttachment[] = []): Promise<boolean> {
      if (this.isGasEnvironment()) return new Promise((resolve, reject) => { (window as any).google.script.run.withSuccessHandler((res: string) => resolve(JSON.parse(res).success)).withFailureHandler(reject).sendEmail(to, subject, body, attachments); });
      return Promise.resolve(true);
  }
  async saveDraft(to: string, subject: string, body: string, attachments: EmailAttachment[] = []): Promise<boolean> {
      if (this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).saveDraftReal(to, subject, body, attachments));
      return Promise.resolve(true);
  }
  async getThreadDetails(threadId: string | number): Promise<any> {
      if (this.isGasEnvironment()) return new Promise((resolve)=>(window as any).google.script.run.withSuccessHandler((r:string)=>resolve(JSON.parse(r))).getThreadDetails(threadId));
      return Promise.resolve({ success: false });
  }
  async getEmailAttachment(messageId: string, attachmentIndex: number): Promise<FileContentResponse> {
      if (this.isGasEnvironment()) return new Promise((resolve, reject)=>(window as any).google.script.run.withSuccessHandler((r:string)=>resolve(JSON.parse(r))).withFailureHandler(reject).getEmailAttachmentContent(messageId, attachmentIndex));
      return Promise.resolve({ success: false });
  }
  
  // --- CONTACTS ---
  async searchContacts(query: string): Promise<any[]> {
      if (this.isGasEnvironment()) return new Promise((resolve) => (window as any).google.script.run.withSuccessHandler((r: string) => resolve(JSON.parse(r))).searchContacts(query));
      return Promise.resolve([]);
  }
  
  // --- CALENDAR ---
  async getCalendars(): Promise<any[]> {
      if (this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).getCalendars());
      return Promise.resolve([]);
  }
  async checkFreeBusy(start: string, end: string, emails: string[]): Promise<any> {
      if (this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).checkFreeBusy(start, end, emails));
      return Promise.resolve({ success: true });
  }
  async createCalendarEvent(data: any): Promise<{success: boolean, id?: string, meetLink?: string}> { 
      if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).createCalendarEvent({...data, start: data.start, end: data.end})); 
      return Promise.resolve({success:true}); 
  }
  async updateCalendarEvent(data: any): Promise<{success: boolean}> { 
      if(this.isGasEnvironment()) return new Promise((r) => (window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).updateCalendarEvent(data)); 
      return Promise.resolve({success:true}); 
  }
  async deleteCalendarEvent(id: any, calendarId?: string) { 
      if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).deleteCalendarEvent(id, calendarId)); 
      return Promise.resolve(true); 
  }

  // --- DRIVE ---
  async getDriveItems(p: any, c: any, q: any): Promise<DriveResponse> { 
      if(this.isGasEnvironment()) return new Promise((r,rj)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).withFailureHandler(rj).getDriveItems({folderId:p, category:c, query:q})); 
      return Promise.resolve({files:[], folders:[], category:'root', currentFolderName:'Mock', currentFolderId: null, parentId: null}); 
  }
  async createDriveFolder(n: string, p: any) { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).createDriveFolder(n,p)); return Promise.resolve(true); }
  async renameDriveItem(id: string, n: string) { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).renameDriveItem(id,n)); return Promise.resolve(true); }
  async trashDriveItem(id: string) { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).trashDriveItem(id)); return Promise.resolve(true); }
  async setStarredDriveItem(id: string, s: boolean) { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).setStarredDriveItem(id,s)); return Promise.resolve(true); }
  
  async uploadFileChunk(d: string, n: string, m: string, p: any, offset: number, total: number, fileId?: string) {
      if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).uploadFileChunk(d,n,m,p,offset,total,fileId)); 
      return Promise.resolve({success:true}); 
  }
  async uploadFileToDrive(d: string, n: string, m: string, p: any) { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).uploadFileToDrive(d,n,m,p)); return Promise.resolve(true); }

  async getFileContent(id: string): Promise<FileContentResponse> { if(this.isGasEnvironment()) return new Promise((r,rj)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).withFailureHandler(rj).getFileContent(id)); return Promise.resolve({success:false}); }
  async saveFileContent(id: string, content: string): Promise<boolean> { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).saveFileContent(id, content)); return Promise.resolve(true); }
  async moveDriveItem(itemId: string, targetFolderId: string): Promise<boolean> { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).moveDriveItem(itemId, targetFolderId)); return Promise.resolve(true); }
  async addDrivePermission(fileId: string, email: string, role: string): Promise<boolean> { return Promise.resolve(true); }
  async getDriveShareLink(fileId: string): Promise<string> { return Promise.resolve(""); }

  // --- TASKS ---
  async getTaskLists(): Promise<TaskList[]> {
     if (this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).getTaskLists());
     return Promise.resolve([]);
  }
  async getTasks(listId: string): Promise<TaskItem[]> {
      if (this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).getTasks(listId));
      return Promise.resolve([]);
  }
  async createTaskList(title: string): Promise<TaskList | null> {
      if (this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).createTaskList(title));
      return Promise.resolve(null);
  }
  async deleteTaskList(id: string): Promise<boolean> {
      if (this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).deleteTaskList(id));
      return Promise.resolve(true);
  }
  async createTask(title: string, details?: string, listId?: string, due?: string, parent?: string): Promise<any> { 
      if (this.isGasEnvironment()) return new Promise((resolve) => { (window as any).google.script.run.withSuccessHandler((res: string) => resolve(JSON.parse(res))).createTask(listId, title, details, due, parent); }); 
      return Promise.resolve({ success: true }); 
  }
  async toggleTask(id: string, listId?: string): Promise<boolean> { if (this.isGasEnvironment()) return new Promise((resolve) => { (window as any).google.script.run.withSuccessHandler((res: string) => resolve(JSON.parse(res).success)).toggleTask(id, listId); }); return Promise.resolve(true); }
  async updateTask(task: Partial<TaskItem>): Promise<boolean> { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).updateTask(task)); return Promise.resolve(true); }
  async deleteTask(id: string, listId?: string): Promise<boolean> { if (this.isGasEnvironment()) return new Promise((resolve) => { (window as any).google.script.run.withSuccessHandler((res: string) => resolve(JSON.parse(res).success)).deleteTask(id, listId); }); return Promise.resolve(true); }
  
  // --- NOTES ---
  async addNote(note: NoteItem): Promise<boolean> { if (this.isGasEnvironment()) return new Promise((resolve) => { (window as any).google.script.run.withSuccessHandler((res: string) => resolve(JSON.parse(res).success)).saveNote(note); }); return Promise.resolve(true); }
  async deleteNote(id: number | string): Promise<boolean> { if (this.isGasEnvironment()) return new Promise((resolve) => { (window as any).google.script.run.withSuccessHandler((res: string) => resolve(JSON.parse(res).success)).deleteNote(id); }); return Promise.resolve(true); }
  async uploadKeepImage(base64: string, mime: string): Promise<{success: boolean, id?: string, url?: string}> {
      if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).uploadKeepImage(base64, mime));
      return Promise.resolve({success:true, id: 'mock_img_id', url: 'https://source.unsplash.com/random/200x200'});
  }
}

export const bridge = new GASBridge();
