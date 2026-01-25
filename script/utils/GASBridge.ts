
import { GoogleIcons } from '../components/GoogleIcons';

// Tipagem dos dados do Dashboard
export interface DashboardData {
  user: {
    name: string;
    email: string;
    avatar: string;
  };
  weather: {
    temp: string;
    location: string;
  };
  stats: {
    storageUsed: number;
    unreadEmails: number;
  };
  emails: any[];
  labels?: any[];
  events: any[];
  files: any[];
  tasks: any[];
  notes: any[];
}

export interface DriveItem {
    id: string;
    name: string;
    type: 'folder' | 'doc' | 'sheet' | 'slide' | 'image' | 'pdf' | 'file';
    mimeType?: string;
    owner: string;
    date: string;
    size?: string;
    thumbnail?: string;
    isStarred?: boolean;
}

export interface DriveResponse {
    category: string;
    currentFolderId: string | null;
    currentFolderName: string;
    parentId: string | null;
    folders: DriveItem[];
    files: DriveItem[];
}

export interface FileContentResponse {
    success: boolean;
    data?: string; // base64
    mimeType?: string;
    name?: string;
    error?: string;
}

export interface EmailAttachment {
    name: string;
    mimeType: string;
    data: string; // Base64
}

// Mocks para desenvolvimento local
const MOCK_DATA: DashboardData = {
  user: {
    name: "Dev Criativo",
    email: "dev@workspace.new",
    avatar: "https://ui-avatars.com/api/?name=Dev+Criativo&background=4285F4&color=fff"
  },
  weather: { temp: "24°", location: "São Paulo" },
  stats: { storageUsed: 78, unreadEmails: 3 },
  emails: [
    { id: 1, subject: "Design System v2.0", sender: "Julia Silva", senderInit: "J", color: "bg-purple-500", time: "10:30", preview: "Oi! Atualizei os componentes no Figma...", read: false, hasAttachment: true, messageCount: 2 },
    { id: 2, subject: "Fatura AWS Pendente", sender: "Financeiro", senderInit: "F", color: "bg-orange-500", time: "09:15", preview: "Segue anexo a fatura referente ao mês...", read: false, hasAttachment: true, messageCount: 1 },
  ],
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
        data.events = data.events.map((ev: any) => ({
            ...ev,
            start: new Date(ev.start),
            end: new Date(ev.end)
        }));
    }
    return data as DashboardData;
  }

  async getInitialData(): Promise<DashboardData> {
    if (this.isGasEnvironment()) {
      return new Promise((resolve, reject) => {
        (window as any).google.script.run
          .withSuccessHandler((res: string) => {
              try {
                  const parsed = JSON.parse(res);
                  resolve(this.normalizeData(parsed));
              } catch (e) {
                  console.error("JSON Parse Error", e);
                  resolve(this.normalizeData({} as any));
              }
          })
          .withFailureHandler((err: any) => {
              console.error("GAS Failure", err);
              resolve({} as any);
          })
          .getInitialData();
      });
    } else {
        return Promise.resolve(this.normalizeData(JSON.parse(JSON.stringify(MOCK_DATA))));
    }
  }

  // --- MAIL & OTHER METHODS ---
  async getEmailsPaged(start: number, limit: number, folder: string, query: string = ''): Promise<any[]> {
      if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).getEmailsPaged(start, limit, folder, query));
      return Promise.resolve([]);
  }

  async createLabel(name: string): Promise<boolean> {
      if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).createGmailLabel(name));
      console.log(`[MOCK] Created label: ${name}`);
      return Promise.resolve(true);
  }

  async manageEmail(id: number | string, action: string): Promise<boolean> {
      if (this.isGasEnvironment()) return new Promise((resolve)=>(window as any).google.script.run.withSuccessHandler((r:string)=>resolve(JSON.parse(r).success)).manageEmail(id, action));
      return Promise.resolve(true);
  }

  async batchManageEmails(ids: Array<number | string>, action: string): Promise<boolean> {
      if (this.isGasEnvironment()) return new Promise((resolve)=>(window as any).google.script.run.withSuccessHandler((r:string)=>resolve(JSON.parse(r).success)).batchManageEmails(ids, action));
      console.log(`[MOCK] Batch action ${action} on ${ids.length} emails`);
      return Promise.resolve(true);
  }
  
  async moveThreadToLabel(id: string, label: string): Promise<boolean> {
      if (this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).moveThreadToLabel(id, label));
      return Promise.resolve(true);
  }

  async moveThreadToFolder(id: string, folder: string): Promise<boolean> {
      if (this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).moveThreadToFolder(id, folder));
      return Promise.resolve(true);
  }

  async sendEmail(to: string, subject: string, body: string, attachments: EmailAttachment[] = []): Promise<boolean> {
      if (this.isGasEnvironment()) {
          return new Promise((resolve, reject) => {
              (window as any).google.script.run
                .withSuccessHandler((res: string) => resolve(JSON.parse(res).success))
                .withFailureHandler(reject)
                .sendEmail(to, subject, body, attachments);
          });
      }
      console.log(`[MOCK] Sending email to ${to} with ${attachments.length} attachments`);
      return Promise.resolve(true);
  }

  async saveDraft(to: string, subject: string, body: string): Promise<boolean> {
      if (this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).saveDraftReal(to, subject, body));
      console.log(`[MOCK] Draft saved`);
      return Promise.resolve(true);
  }

  async getThreadDetails(threadId: string | number): Promise<any> {
      if (this.isGasEnvironment()) return new Promise((resolve)=>(window as any).google.script.run.withSuccessHandler((r:string)=>resolve(JSON.parse(r))).getThreadDetails(threadId));
      return Promise.resolve({ success: true, messages: [{
          id: 1, from: "Mock Sender", senderInit: "M", to: "Me", date: "10:00", body: "This is a full mock email body content.", attachments: [{name: "mock.pdf", size: "10KB", id: 0, mimeType: "application/pdf"}]
      }] });
  }

  async getEmailAttachment(messageId: string, attachmentIndex: number): Promise<FileContentResponse> {
      if (this.isGasEnvironment()) return new Promise((resolve, reject)=>(window as any).google.script.run.withSuccessHandler((r:string)=>resolve(JSON.parse(r))).withFailureHandler(reject).getEmailAttachmentContent(messageId, attachmentIndex));
      return Promise.resolve({ success: true, data: "mockbase64", name: "mock.pdf", mimeType: "application/pdf" });
  }

  // --- CONTACTS ---
  async searchContacts(query: string): Promise<any[]> {
      if (this.isGasEnvironment()) return new Promise((resolve) => (window as any).google.script.run.withSuccessHandler((r: string) => resolve(JSON.parse(r))).searchContacts(query));
      // Mock
      if (!query) return Promise.resolve([]);
      return Promise.resolve([
          {name: "Julia Silva", email: "julia@example.com", avatar: "J"},
          {name: "Roberto Alves", email: "roberto@example.com", avatar: "R"}
      ].filter(c => c.name.toLowerCase().includes(query.toLowerCase()) || c.email.toLowerCase().includes(query.toLowerCase())));
  }
  
  // --- CALENDAR METHODS ---
  async createCalendarEvent(data: any): Promise<{success: boolean, id?: string}> { 
      if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).createCalendarEvent({...data, start: data.start.toISOString(), end: data.end.toISOString()})); 
      return Promise.resolve({success:true}); 
  }
  
  async updateCalendarEvent(data: any): Promise<{success: boolean}> { 
      if(this.isGasEnvironment()) {
          return new Promise((r) => (window as any).google.script.run
            .withSuccessHandler((res:string)=>r(JSON.parse(res)))
            .updateCalendarEvent({ ...data, start: new Date(data.start).toISOString(), end: new Date(data.end).toISOString() })); 
      }
      return Promise.resolve({success:true}); 
  }
  
  async deleteCalendarEvent(id: any, deleteAll: boolean = false) { 
      if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).deleteCalendarEvent(id, deleteAll)); 
      return Promise.resolve(true); 
  }

  // --- DRIVE & FILE METHODS ---
  async getDriveItems(p: any, c: any, q: any): Promise<DriveResponse> { 
      if(this.isGasEnvironment()) return new Promise((r,rj)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).withFailureHandler(rj).getDriveItems({folderId:p, category:c, query:q})); 
      return Promise.resolve({files:[], folders:[], category:'root', currentFolderName:'Mock', currentFolderId: null, parentId: null}); 
  }
  async createDriveFolder(n: string, p: any) { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).createDriveFolder(n,p)); return Promise.resolve(true); }
  async renameDriveItem(id: string, n: string) { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).renameDriveItem(id,n)); return Promise.resolve(true); }
  async trashDriveItem(id: string) { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).trashDriveItem(id)); return Promise.resolve(true); }
  async setStarredDriveItem(id: string, s: boolean) { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).setStarredDriveItem(id,s)); return Promise.resolve(true); }
  async uploadFileToDrive(d: string, n: string, m: string, p: any) { if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).uploadFileToDrive(d,n,m,p)); return Promise.resolve(true); }
  async getFileContent(id: string): Promise<FileContentResponse> { if(this.isGasEnvironment()) return new Promise((r,rj)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res))).withFailureHandler(rj).getFileContent(id)); return Promise.resolve({success:false}); }
  
  async moveDriveItem(itemId: string, targetFolderId: string): Promise<boolean> {
      if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).moveDriveItem(itemId, targetFolderId));
      return Promise.resolve(true);
  }

  // Salvar conteúdo de texto (Docs)
  async saveFileContent(id: string, content: string): Promise<boolean> {
      if(this.isGasEnvironment()) return new Promise((r)=>(window as any).google.script.run.withSuccessHandler((res:string)=>r(JSON.parse(res).success)).saveFileContent(id, content));
      console.log(`[MOCK] Saving content to ${id}`);
      return Promise.resolve(true);
  }

  // --- TASKS & NOTES ---
  async createTask(title: string, details?: string): Promise<any> { 
      if (this.isGasEnvironment()) return new Promise((resolve) => { (window as any).google.script.run.withSuccessHandler((res: string) => resolve(JSON.parse(res))).createTask(title, details); }); 
      return Promise.resolve({ success: true, task: { id: Date.now(), title, details, completed: false, date: new Date().toISOString() } }); 
  }
  async toggleTask(id: number | string): Promise<boolean> { if (this.isGasEnvironment()) return new Promise((resolve) => { (window as any).google.script.run.withSuccessHandler((res: string) => resolve(JSON.parse(res).success)).toggleTask(id); }); return Promise.resolve(true); }
  async deleteTask(id: number | string): Promise<boolean> { if (this.isGasEnvironment()) return new Promise((resolve) => { (window as any).google.script.run.withSuccessHandler((res: string) => resolve(JSON.parse(res).success)).deleteTask(id); }); return Promise.resolve(true); }
  async addNote(note: any): Promise<boolean> { if (this.isGasEnvironment()) return new Promise((resolve) => { (window as any).google.script.run.withSuccessHandler((res: string) => resolve(JSON.parse(res).success)).saveNote(note); }); return Promise.resolve(true); }
  async deleteNote(id: number | string): Promise<boolean> { if (this.isGasEnvironment()) return new Promise((resolve) => { (window as any).google.script.run.withSuccessHandler((res: string) => resolve(JSON.parse(res).success)).deleteNote(id); }); return Promise.resolve(true); }
}

export const bridge = new GASBridge();
