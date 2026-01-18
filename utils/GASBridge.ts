
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

// Dados Mockados para Desenvolvimento Local
const MOCK_DATA: DashboardData = {
  user: {
    name: "Dev Criativo",
    email: "dev@workspace.new",
    avatar: "https://ui-avatars.com/api/?name=Dev+Criativo&background=4285F4&color=fff"
  },
  weather: { temp: "24°", location: "São Paulo" },
  stats: { storageUsed: 78, unreadEmails: 3 },
  emails: [
    { id: 1, subject: "Design System v2.0", sender: "Julia Silva", senderInit: "J", color: "bg-purple-500", time: "10:30", preview: "Oi! Atualizei os componentes no Figma...", read: false, hasAttachment: true },
    { id: 2, subject: "Fatura AWS Pendente", sender: "Financeiro", senderInit: "F", color: "bg-orange-500", time: "09:15", preview: "Segue anexo a fatura referente ao mês...", read: false, hasAttachment: true },
    { id: 3, subject: "Reunião de Planejamento", sender: "Roberto Alves", senderInit: "R", color: "bg-blue-500", time: "Ontem", preview: "Vamos alinhar as metas do Q3?", read: true, hasAttachment: false },
  ],
  events: [ 
    { id: 1, title: "Reunião Diária", start: new Date(new Date().setHours(9,0)).toISOString(), end: new Date(new Date().setHours(10,0)).toISOString(), color: 'bg-blue-500', location: 'Meet', recurrence: 'daily', guests: [] },
    { id: 2, title: "Almoço Cliente", start: new Date(new Date().setHours(12,30)).toISOString(), end: new Date(new Date().setHours(14,0)).toISOString(), color: 'bg-orange-500', location: 'Restaurante', guests: [] }
  ],
  files: [
    { id: '1', name: "Orçamento 2024.xlsx", type: "sheet", date: "Há 2h", owner: "Eu" },
    { id: '2', name: "Apresentação Vendas.ppt", type: "slide", date: "Há 5h", owner: "Julia" },
    { id: '3', name: "Briefing IA.docx", type: "doc", date: "Ontem", owner: "Legal" },
  ],
  tasks: [
    { id: 1, title: "Revisar Q3 Report", completed: false },
    { id: 2, title: "Email para Marketing", completed: true },
    { id: 3, title: "Deploy da nova feature", completed: false },
  ],
  notes: [
    { id: 1, title: "Ideias Brainstorm", content: "Implementar dark mode, revisar paleta de cores...", color: 'default' },
    { id: 2, title: "Links Úteis", content: "Design system docs, API references...", color: 'yellow' },
  ]
};

class GASBridge {
  private isGasEnvironment(): boolean {
    return typeof window !== 'undefined' && (window as any).google && (window as any).google.script;
  }

  private normalizeData(data: DashboardData): DashboardData {
    if (data.events) {
        data.events = data.events.map(ev => ({
            ...ev,
            start: new Date(ev.start),
            end: new Date(ev.end)
        }));
    }
    return data;
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
                  console.error("Erro ao processar dados do GAS", e);
                  reject(e);
              }
          })
          .withFailureHandler(reject)
          .getInitialData();
      });
    } else {
      return new Promise(resolve => {
          setTimeout(() => {
              const mockClone = JSON.parse(JSON.stringify(MOCK_DATA));
              resolve(this.normalizeData(mockClone));
          }, 1000);
      });
    }
  }

  // --- MAIL METHODS ---

  async manageEmail(id: number | string, action: 'read' | 'unread' | 'archive' | 'trash' | 'spam' | 'star'): Promise<boolean> {
      if (this.isGasEnvironment()) {
          return new Promise((resolve, reject) => {
              (window as any).google.script.run
                .withSuccessHandler((res: string) => resolve(JSON.parse(res).success))
                .withFailureHandler(reject)
                .manageEmail(id, action);
          });
      } else {
          console.log(`[MOCK] Email ${id} action: ${action}`);
          return Promise.resolve(true);
      }
  }

  async sendEmail(to: string, subject: string, body: string): Promise<boolean> {
      if (this.isGasEnvironment()) {
          return new Promise((resolve, reject) => {
              (window as any).google.script.run
                .withSuccessHandler((res: string) => resolve(JSON.parse(res).success))
                .withFailureHandler(reject)
                .sendEmail(to, subject, body);
          });
      } else {
          console.log(`[DEV] Enviando email para ${to}: ${subject}`);
          return new Promise(resolve => setTimeout(() => resolve(true), 1000));
      }
  }

  // --- CALENDAR METHODS ---

  async createCalendarEvent(data: any): Promise<{success: boolean, id?: string}> {
      if (this.isGasEnvironment()) {
          return new Promise((resolve, reject) => {
              (window as any).google.script.run
                .withSuccessHandler((res: string) => resolve(JSON.parse(res)))
                .withFailureHandler(reject)
                .createCalendarEvent({
                    ...data,
                    start: data.start.toISOString(),
                    end: data.end.toISOString()
                });
          });
      } else {
          console.log('[MOCK] Create Event', data);
          return Promise.resolve({ success: true, id: Date.now().toString() });
      }
  }

  async deleteCalendarEvent(id: string): Promise<boolean> {
      if (this.isGasEnvironment()) {
          return new Promise((resolve, reject) => {
              (window as any).google.script.run
                .withSuccessHandler((res: string) => resolve(JSON.parse(res).success))
                .withFailureHandler(reject)
                .deleteCalendarEvent(id);
          });
      } else {
          console.log('[MOCK] Delete Event', id);
          return Promise.resolve(true);
      }
  }

  // --- DRIVE METHODS ---

  async getDriveItems(folderId: string | null = null, category: string = 'root', query: string = ''): Promise<DriveResponse> {
      if (this.isGasEnvironment()) {
          return new Promise((resolve, reject) => {
              (window as any).google.script.run
                .withSuccessHandler((res: string) => {
                    try {
                        const parsed = JSON.parse(res);
                        resolve(parsed);
                    } catch (e) { reject(e); }
                })
                .withFailureHandler(reject)
                .getDriveItems({ folderId, category, query });
          });
      } else {
          // MOCK DRIVE NAVIGATION
          return new Promise(resolve => {
              setTimeout(() => {
                  let name = "Meu Drive";
                  if (category === 'recent') name = "Recentes";
                  if (category === 'starred') name = "Com Estrela";
                  if (category === 'trash') name = "Lixeira";
                  if (folderId && folderId !== 'root') name = "Pasta Mock " + folderId;
                  if (query) name = `Resultados para "${query}"`;

                  resolve({
                      category,
                      currentFolderId: folderId || 'root',
                      currentFolderName: name,
                      parentId: folderId && folderId !== 'root' ? 'root' : null,
                      folders: category === 'root' || folderId ? [
                          { id: 'f1', name: 'Projetos 2024', type: 'folder', owner: 'Eu', date: 'Hoje', size: '-' },
                          { id: 'f2', name: 'Recursos Humanos', type: 'folder', owner: 'RH', date: 'Ontem', size: '-' },
                          { id: 'f3', name: 'Assets Design', type: 'folder', owner: 'Design', date: 'Semana passada', size: '-' },
                      ] : [],
                      files: [
                          { id: 'd1', name: 'Planejamento Q3.pdf', type: 'pdf', owner: 'Eu', date: '10:30', size: '2.4 MB' },
                          { id: 'd2', name: 'Logo Oficial.png', type: 'image', owner: 'Design', date: 'Ontem', size: '1.2 MB' },
                          { id: 'd3', name: 'Relatório Financeiro.xlsx', type: 'sheet', owner: 'Financeiro', date: 'Segunda', size: '450 KB' },
                          { id: 'd4', name: 'Ata de Reunião.docx', type: 'doc', owner: 'Eu', date: '01/05/2024', size: '24 KB' },
                      ]
                  });
              }, 600);
          });
      }
  }

  async createDriveFolder(name: string, parentId: string | null): Promise<boolean> {
      if (this.isGasEnvironment()) {
          return new Promise((resolve, reject) => {
              (window as any).google.script.run
                .withSuccessHandler((res: string) => resolve(JSON.parse(res).success))
                .withFailureHandler(reject)
                .createDriveFolder(name, parentId);
          });
      } else {
          return new Promise(resolve => setTimeout(() => resolve(true), 500));
      }
  }

  async renameDriveItem(id: string, newName: string): Promise<boolean> {
      if (this.isGasEnvironment()) {
          return new Promise((resolve, reject) => {
              (window as any).google.script.run
                .withSuccessHandler((res: string) => resolve(JSON.parse(res).success))
                .withFailureHandler(reject)
                .renameDriveItem(id, newName);
          });
      } else {
          return new Promise(resolve => setTimeout(() => resolve(true), 500));
      }
  }

  async trashDriveItem(id: string): Promise<boolean> {
      if (this.isGasEnvironment()) {
          return new Promise((resolve, reject) => {
              (window as any).google.script.run
                .withSuccessHandler((res: string) => resolve(JSON.parse(res).success))
                .withFailureHandler(reject)
                .trashDriveItem(id);
          });
      } else {
          return new Promise(resolve => setTimeout(() => resolve(true), 500));
      }
  }

  async setStarredDriveItem(id: string, starred: boolean): Promise<boolean> {
      if (this.isGasEnvironment()) {
          return new Promise((resolve, reject) => {
              (window as any).google.script.run
                .withSuccessHandler((res: string) => resolve(JSON.parse(res).success))
                .withFailureHandler(reject)
                .setStarredDriveItem(id, starred);
          });
      } else {
          return new Promise(resolve => setTimeout(() => resolve(true), 500));
      }
  }

  async uploadFileToDrive(data: string, name: string, mimeType: string, parentId: string | null): Promise<boolean> {
      if (this.isGasEnvironment()) {
          return new Promise((resolve, reject) => {
              (window as any).google.script.run
                .withSuccessHandler((res: string) => resolve(JSON.parse(res).success))
                .withFailureHandler(reject)
                .uploadFileToDrive(data, name, mimeType, parentId);
          });
      } else {
          return new Promise(resolve => setTimeout(() => resolve(true), 1500));
      }
  }

  async getFileContent(id: string): Promise<FileContentResponse> {
      if (this.isGasEnvironment()) {
          return new Promise((resolve, reject) => {
              (window as any).google.script.run
                .withSuccessHandler((res: string) => resolve(JSON.parse(res)))
                .withFailureHandler(reject)
                .getFileContent(id);
          });
      } else {
          return new Promise(resolve => setTimeout(() => resolve({
              success: true,
              data: '', // Return empty for mock, component will handle blank preview
              mimeType: 'image/png',
              name: 'Mock File'
          }), 1000));
      }
  }

  // --- TASKS METHODS ---
  async createTask(title: string): Promise<boolean> {
      // Mock implementation - in real GAS, use Tasks API
      console.log(`[MOCK] Creating Task: ${title}`);
      return Promise.resolve(true);
  }

  async toggleTask(id: number): Promise<boolean> {
      console.log(`[MOCK] Toggling Task: ${id}`);
      return Promise.resolve(true);
  }

  async deleteTask(id: number): Promise<boolean> {
      console.log(`[MOCK] Deleting Task: ${id}`);
      return Promise.resolve(true);
  }

  // --- KEEP (NOTES) METHODS ---
  async addNote(note: any): Promise<boolean> {
      // Mock implementation - in real GAS, use Drive App (create text file) or Keep API (advanced)
      console.log(`[MOCK] Creating Note: ${note.title}`);
      return Promise.resolve(true);
  }

  async deleteNote(id: number): Promise<boolean> {
      console.log(`[MOCK] Deleting Note: ${id}`);
      return Promise.resolve(true);
  }
}

export const bridge = new GASBridge();
