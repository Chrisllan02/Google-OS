
import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Settings, X, Plus, HardDrive, List, LayoutGrid,
  FileText, Folder, File, Image as ImageIcon, ChevronRight, Clock, Star, Trash2, Users, Loader2, ArrowLeft, MoreVertical,
  Edit2, Eye, ExternalLink, Upload, Download, Maximize2, Info, ArrowUp, ArrowDown, HardDrive as HardDriveIcon,
  Check, AlertCircle
} from 'lucide-react';
import { GoogleIcons } from '../GoogleIcons';
import { bridge, DriveItem, DriveResponse } from '../../utils/GASBridge';

interface DriveAppProps {
  onClose: () => void;
  data: any;
  onOpenApp?: (type: string, fileData?: any) => void;
}

const getFileIcon = (type: string, className = "w-6 h-6") => {
  switch(type) {
    case 'sheet': return <GoogleIcons.Sheets className={className} />;
    case 'slide': return <GoogleIcons.Slides className={className} />;
    case 'doc': return <GoogleIcons.Docs className={className} />;
    case 'image': return <ImageIcon className={`${className} text-red-500`} />;
    case 'pdf': return <FileText className={`${className} text-red-600`} />;
    case 'folder': return <Folder className={`${className} text-[#5f6368] fill-[#5f6368]`} />;
    default: return <File className={`${className} text-gray-400`} />;
  }
};

const PreviewModal = ({ file, onClose, onDownload }: { file: DriveItem, onClose: () => void, onDownload: (file: DriveItem) => void }) => {
    const [loading, setLoading] = useState(true);
    const [content, setContent] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await bridge.getFileContent(file.id);
                if (res.success && res.data) {
                    setContent(res.data);
                }
            } catch (e) {
                console.error("Erro ao carregar preview", e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [file]);

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col animate-in fade-in duration-300">
            <div className="flex items-center justify-between px-6 py-4 bg-black/40">
                <div className="flex items-center gap-3 text-white">
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full"><ArrowLeft size={20}/></button>
                    <span className="font-medium truncate max-w-md">{file.name}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => onDownload(file)} className="p-2 hover:bg-white/10 rounded-full text-white/70" title="Download"><Download size={20}/></button>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white/70"><X size={24}/></button>
                </div>
            </div>
            <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
                {loading ? (
                    <Loader2 size={48} className="text-white/50 animate-spin" />
                ) : content ? (
                    file.type === 'image' || file.mimeType?.startsWith('image/') ? (
                        <img src={`data:${file.mimeType};base64,${content}`} className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" alt={file.name} />
                    ) : file.type === 'pdf' || file.mimeType === 'application/pdf' ? (
                        <iframe src={`data:${file.mimeType};base64,${content}`} className="w-full h-full rounded-lg bg-white" title={file.name} />
                    ) : (
                        <div className="text-center text-white/50">
                            <File size={64} className="mx-auto mb-4 opacity-50" />
                            <p>Visualização não disponível para este formato.</p>
                        </div>
                    )
                ) : (
                    <div className="text-white/50">Falha ao carregar visualização.</div>
                )}
            </div>
        </div>
    );
};

export default function DriveApp({ onClose, data, onOpenApp }: DriveAppProps) {
  // --- STATE ---
  const [driveView, setDriveView] = useState<'list' | 'grid'>('list');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  
  // Navigation & Search
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('root'); 
  const [content, setContent] = useState<DriveResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{id: string | null, name: string}[]>([]); 
  const [searchQuery, setSearchQuery] = useState('');

  // Interaction State
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, item: DriveItem} | null>(null);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [modalMode, setModalMode] = useState<'create_folder' | 'rename' | null>(null);
  const [modalInput, setModalInput] = useState('');
  const [modalTargetId, setModalTargetId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<DriveItem | null>(null);
  
  // Upload State
  const [uploadStatus, setUploadStatus] = useState<{ state: 'uploading' | 'success' | 'error', fileName: string, progress: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Advanced UI State
  const [showDetails, setShowDetails] = useState(false);
  const [detailsItem, setDetailsItem] = useState<DriveItem | null>(null);
  const [sortConfig, setSortConfig] = useState<{key: keyof DriveItem, direction: 'asc' | 'desc'}>({ key: 'date', direction: 'desc' });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- EFFECTS ---
  useEffect(() => {
      fetchContent(currentFolderId, category, searchQuery);
  }, [currentFolderId, category]); 

  useEffect(() => {
      const closeMenus = () => { setContextMenu(null); setShowNewMenu(false); };
      window.addEventListener('click', closeMenus);
      return () => window.removeEventListener('click', closeMenus);
  }, []);

  useEffect(() => {
      if (selectedIds.size === 1) {
          const id = Array.from(selectedIds)[0];
          const item = content?.files.find(f => f.id === id) || content?.folders.find(f => f.id === id);
          setDetailsItem(item || null);
      } else {
          setDetailsItem(null);
      }
  }, [selectedIds, content]);

  const fetchContent = async (folderId: string | null, cat: string, query: string = '') => {
      setLoading(true);
      try {
          const res = await bridge.getDriveItems(folderId, cat, query);
          setContent(res);
      } catch (e) {
          console.error("Failed to load drive items", e);
      } finally {
          setLoading(false);
      }
  };

  const handleSearch = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          fetchContent(null, 'root', searchQuery);
          setCategory('root'); 
          setCurrentFolderId(null);
          setHistory([]);
      }
  };

  // --- SORTING ---
  const handleSort = (key: keyof DriveItem) => {
      setSortConfig(current => ({
          key,
          direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
      }));
  };

  const getSortedItems = (items: DriveItem[]) => {
      return [...items].sort((a, b) => {
          let aVal: any = a[sortConfig.key];
          let bVal: any = b[sortConfig.key];
          
          if (!aVal) return 1;
          if (!bVal) return -1;

          if (typeof aVal === 'string') aVal = aVal.toLowerCase();
          if (typeof bVal === 'string') bVal = bVal.toLowerCase();

          if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
  };

  const sortedFolders = content?.folders ? getSortedItems(content.folders) : [];
  const sortedFiles = content?.files ? getSortedItems(content.files) : [];

  // --- ACTIONS ---
  const handleNavigate = (folderId: string | null, folderName: string) => {
      if (folderId) {
          setHistory(prev => {
              const exists = prev.findIndex(h => h.id === folderId);
              if (exists !== -1) return prev.slice(0, exists);
              
              const currentName = content?.currentFolderName || 'Meu Drive';
              const currentId = content?.currentFolderId || null;
              // Avoid duplicating simple back navigation
              if (prev.length > 0 && prev[prev.length - 1].id === currentId) return prev;
              
              return [...prev, { id: currentId, name: currentName }];
          });
      }
      setCurrentFolderId(folderId);
      setCategory('root');
      setSearchQuery('');
      setSelectedIds(new Set());
      setLastSelectedId(null);
  };

  const handleBreadcrumbClick = (id: string | null, index: number) => {
      if (id === currentFolderId) return;
      setCurrentFolderId(id);
      setHistory(prev => prev.slice(0, index));
  };

  const handleCategoryChange = (cat: string) => {
      setCategory(cat);
      setCurrentFolderId(null);
      setHistory([]);
      setSelectedIds(new Set());
      setLastSelectedId(null);
      setSearchQuery('');
  };

  const handleSelection = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const allItems = [...sortedFolders, ...sortedFiles];
      const allIds = allItems.map(item => item.id);

      // SHIFT + CLICK
      if (e.shiftKey && lastSelectedId) {
          const start = allIds.indexOf(lastSelectedId);
          const end = allIds.indexOf(id);
          
          if (start !== -1 && end !== -1) {
              const [lower, upper] = [Math.min(start, end), Math.max(start, end)];
              const rangeIds = allIds.slice(lower, upper + 1);
              
              // Se Ctrl/Cmd estiver pressionado, ADICIONA à seleção existente
              // Se não, SUBSTITUI a seleção pelo intervalo
              const newSet = new Set(e.ctrlKey || e.metaKey ? selectedIds : []);
              rangeIds.forEach(itemId => newSet.add(itemId));
              setSelectedIds(newSet);
              return; 
          }
      }

      // CTRL/CMD + CLICK
      if (e.ctrlKey || e.metaKey) {
          const newSet = new Set(selectedIds);
          if (newSet.has(id)) {
              newSet.delete(id);
          } else {
              newSet.add(id);
              setLastSelectedId(id);
          }
          setSelectedIds(newSet);
      } else {
          // NORMAL CLICK
          setSelectedIds(new Set([id]));
          setLastSelectedId(id);
      }
  };

  const handleContextMenu = (e: React.MouseEvent, item: DriveItem) => {
      e.preventDefault();
      e.stopPropagation();
      if (!selectedIds.has(item.id)) {
          setSelectedIds(new Set([item.id]));
          setLastSelectedId(item.id);
      }
      setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  const handleCreateFolder = async () => {
      if (!modalInput.trim()) return;
      setLoading(true);
      await bridge.createDriveFolder(modalInput, currentFolderId);
      setModalMode(null);
      setModalInput('');
      fetchContent(currentFolderId, category);
  };

  const handleRename = async () => {
      if (!modalInput.trim() || !modalTargetId) return;
      setLoading(true);
      await bridge.renameDriveItem(modalTargetId, modalInput);
      setModalMode(null);
      setModalInput('');
      setModalTargetId(null);
      fetchContent(currentFolderId, category);
  };

  const handleDelete = async (id: string) => {
      setLoading(true);
      await bridge.trashDriveItem(id);
      fetchContent(currentFolderId, category);
  };

  const handleStar = async (id: string, currentStatus: boolean) => {
      setLoading(true);
      await bridge.setStarredDriveItem(id, !currentStatus);
      fetchContent(currentFolderId, category);
  };

  const handleFileOpen = (item: DriveItem) => {
      if (item.type === 'folder') {
          handleNavigate(item.id, item.name);
      } else if (['doc', 'sheet', 'slide'].includes(item.type)) {
          if (onOpenApp) onOpenApp(item.type, item);
      } else {
          setPreviewFile(item);
      }
  };

  const handleDownload = async (item: DriveItem) => {
      try {
          const res = await bridge.getFileContent(item.id);
          if (res.success && res.data) {
              const link = document.createElement('a');
              link.href = `data:${res.mimeType};base64,${res.data}`;
              link.download = item.name;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
          } else {
              alert("Erro ao preparar download.");
          }
      } catch (e) {
          console.error("Download failed", e);
      }
  };

  const handleFileUpload = (file: File) => {
      if (file.size > 10 * 1024 * 1024) { 
          alert("Arquivo muito grande. Limite de 10MB.");
          return;
      }

      setUploadStatus({ state: 'uploading', fileName: file.name, progress: 0 });
      setShowNewMenu(false);

      const reader = new FileReader();
      
      reader.onprogress = (event) => {
          if (event.lengthComputable) {
              const percentLoaded = Math.round((event.loaded / event.total) * 30); // Reading phase
              setUploadStatus(prev => prev ? { ...prev, progress: percentLoaded } : null);
          }
      };

      reader.onload = async (ev) => {
          // Simulate upload progress since GAS call is opaque
          let progress = 30;
          const interval = setInterval(() => {
              progress += (90 - progress) * 0.1;
              setUploadStatus(prev => prev && prev.state === 'uploading' ? { ...prev, progress: Math.round(progress) } : prev);
          }, 200);

          try {
              const base64 = (ev.target?.result as string).split(',')[1];
              await bridge.uploadFileToDrive(base64, file.name, file.type, currentFolderId);
              
              clearInterval(interval);
              setUploadStatus({ state: 'success', fileName: file.name, progress: 100 });
              fetchContent(currentFolderId, category);
              
              // Auto close success message
              setTimeout(() => {
                  setUploadStatus(prev => prev?.state === 'success' ? null : prev);
              }, 3000);
          } catch (error) {
              clearInterval(interval);
              setUploadStatus({ state: 'error', fileName: file.name, progress: 0 });
              console.error(error);
          }
      };
      reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleFileUpload(e.dataTransfer.files[0]);
      }
  };

  // --- RENDER HELPERS ---
  const appHeaderClass = "h-16 px-6 flex items-center justify-between shrink-0 border-b border-white/5 backdrop-blur-xl z-20 bg-black/20";

  return (
    <div className="flex flex-col h-full bg-[#191919] select-none text-white relative">
        
        {/* HEADER */}
        <div className={appHeaderClass}>
            <div className="flex items-center gap-4 w-64">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-white/10 rounded-full"><HardDrive className="w-5 h-5 text-white"/></div>
                    <span className="text-white text-lg font-light tracking-tight">Google Drive</span>
                </div>
            </div>
            <div className="flex-1 max-w-2xl px-8 relative hidden md:block">
                <div className="bg-white/5 border border-white/10 flex items-center px-4 py-2.5 rounded-full focus-within:bg-white/10 transition-colors focus-within:border-white/20">
                    <Search className="text-white/40" size={18} />
                    <input 
                        type="text" 
                        placeholder="Pesquisar no Drive (Enter)" 
                        className="bg-transparent border-none outline-none ml-3 w-full text-white placeholder:text-white/30 text-sm" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleSearch}
                    />
                </div>
            </div>
            <div className="flex items-center gap-4 w-64 justify-end">
                <button className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                    <Settings size={20} className="text-white/80" />
                </button>
                <div className="h-8 w-[1px] bg-white/10"></div>
                <div className={`p-2 hover:bg-white/10 rounded-full cursor-pointer text-white/80 transition-colors`} onClick={onClose}><X size={24} /></div>
            </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
            
            {/* SIDEBAR */}
            <div className="w-60 border-r border-white/5 p-4 flex flex-col gap-1 bg-white/[0.02]">
                <div className="relative">
                    <button onClick={(e) => { e.stopPropagation(); setShowNewMenu(!showNewMenu); }} className="flex items-center gap-3 px-4 py-3 bg-[#F0F4F9] text-[#1f1f1f] hover:bg-white rounded-2xl font-medium mb-4 shadow-sm border border-transparent transition-all w-full">
                        <Plus size={20} /> <span className="text-sm">Novo</span>
                    </button>
                    {showNewMenu && (
                        <div className="absolute top-12 left-0 w-56 bg-[#2d2e30] border border-white/10 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in duration-200">
                            <button onClick={() => { setModalMode('create_folder'); setShowNewMenu(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-white/90 text-sm"><Folder size={16} className="text-gray-400"/> Nova pasta</button>
                            <div className="h-[1px] bg-white/10 my-1"></div>
                            <button onClick={() => fileInputRef.current?.click()} className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-white/90 text-sm"><Upload size={16} className="text-blue-400"/> Upload de arquivo</button>
                            <div className="h-[1px] bg-white/10 my-1"></div>
                            <button onClick={() => { onOpenApp && onOpenApp('doc'); setShowNewMenu(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-white/90 text-sm"><GoogleIcons.Docs className="w-4 h-4"/> Documento Google</button>
                            <button onClick={() => { onOpenApp && onOpenApp('sheet'); setShowNewMenu(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-white/90 text-sm"><GoogleIcons.Sheets className="w-4 h-4"/> Planilha Google</button>
                            <button onClick={() => { onOpenApp && onOpenApp('slide'); setShowNewMenu(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-white/90 text-sm"><GoogleIcons.Slides className="w-4 h-4"/> Apresentação Google</button>
                        </div>
                    )}
                    <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
                </div>
                
                {[
                    { id: 'root', label: 'Meu Drive', icon: HardDrive },
                    { id: 'shared', label: 'Compartilhados comigo', icon: Users },
                    { id: 'recent', label: 'Recentes', icon: Clock },
                    { id: 'starred', label: 'Com estrela', icon: Star },
                    { id: 'trash', label: 'Lixeira', icon: Trash2 }
                ].map(item => (
                    <button 
                        key={item.id} 
                        onClick={() => handleCategoryChange(item.id)}
                        className={`flex items-center gap-3 px-4 py-2 rounded-full text-sm transition-all ${category === item.id ? 'bg-[#C2E7FF] text-[#001D35] font-medium' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}
                    >
                        <item.icon size={18} className={category === item.id ? 'text-[#001D35]' : ''} /> {item.label}
                    </button>
                ))}

                <div className="mt-auto bg-white/5 p-4 rounded-xl border border-white/5">
                    <p className="text-xs text-white/60 mb-2">Armazenamento</p>
                    <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden mb-2">
                        <div className="bg-blue-500 w-[70%] h-full"></div>
                    </div>
                    <p className="text-[10px] text-white/40">70% de 15GB usados</p>
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex flex-col bg-[#131313] min-w-0">
                
                {/* TOOLBAR & BREADCRUMBS */}
                <div className="h-14 border-b border-white/5 flex items-center justify-between px-4 shrink-0">
                    <div className="flex items-center gap-1 text-sm text-white/80 overflow-hidden">
                        {/* Root Item */}
                        <button 
                            onClick={() => handleCategoryChange('root')} 
                            className={`px-2 py-1 hover:bg-white/10 rounded transition-colors ${!currentFolderId && category === 'root' ? 'font-medium text-white' : 'text-white/60'}`}
                        >
                            Meu Drive
                        </button>
                        
                        {/* Breadcrumbs History */}
                        {history.map((folder, index) => (
                            <React.Fragment key={folder.id}>
                                <ChevronRight size={14} className="text-white/30" />
                                <button 
                                    onClick={() => handleBreadcrumbClick(folder.id, index + 1)} 
                                    className="px-2 py-1 hover:bg-white/10 rounded transition-colors text-white/60 truncate max-w-[120px]"
                                >
                                    {folder.name}
                                </button>
                            </React.Fragment>
                        ))}

                        {/* Current Folder Name */}
                        {currentFolderId && (
                            <>
                                <ChevronRight size={14} className="text-white/30" />
                                <span className="px-2 py-1 font-medium text-white truncate max-w-[150px]">
                                    {content?.currentFolderName}
                                </span>
                            </>
                        )}
                        
                        {/* Special Category Names if no folder selected */}
                        {!currentFolderId && category !== 'root' && (
                            <>
                                <ChevronRight size={14} className="text-white/30" />
                                <span className="px-2 py-1 font-medium text-white">
                                    {category === 'recent' ? 'Recentes' : category === 'starred' ? 'Com Estrela' : category === 'trash' ? 'Lixeira' : 'Drive'}
                                </span>
                            </>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-[1px] bg-white/10 mx-2"></div>
                        <div className="flex bg-white/5 rounded-full p-1 border border-white/5">
                            <button onClick={() => setDriveView('list')} className={`p-1.5 rounded-full transition-all ${driveView === 'list' ? 'bg-white/10 text-white shadow-sm' : 'text-white/50 hover:text-white'}`}><List size={16}/></button>
                            <button onClick={() => setDriveView('grid')} className={`p-1.5 rounded-full transition-all ${driveView === 'grid' ? 'bg-white/10 text-white shadow-sm' : 'text-white/50 hover:text-white'}`}><LayoutGrid size={16}/></button>
                        </div>
                        <button 
                            onClick={() => setShowDetails(!showDetails)}
                            className={`p-2 rounded-full transition-all ${showDetails ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-white/10 text-white/60'}`}
                            title="Ver detalhes"
                        >
                            <Info size={18}/>
                        </button>
                    </div>
                </div>

                {/* FILE LISTING */}
                <div 
                    className={`flex-1 overflow-y-auto p-4 custom-scrollbar relative transition-colors ${isDragOver ? 'bg-blue-500/10 border-2 border-dashed border-blue-500 m-2 rounded-xl' : ''}`} 
                    onContextMenu={(e) => e.preventDefault()}
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => { setSelectedIds(new Set()); setLastSelectedId(null); }}
                >
                    {isDragOver && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                            <div className="text-blue-400 font-medium text-lg flex flex-col items-center gap-2">
                                <Upload size={48} />
                                Solte arquivos para fazer upload
                            </div>
                        </div>
                    )}
                    {loading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-[#131313]/80 z-10">
                            <Loader2 size={40} className="text-blue-500 animate-spin" />
                        </div>
                    ) : (
                        <>
                            {/* FOLDERS SECTION */}
                            {sortedFolders.length > 0 && (
                                <div className="mb-6">
                                    <h3 className="text-white/50 text-xs font-medium mb-3 uppercase tracking-wider px-2">Pastas</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                                        {sortedFolders.map(folder => (
                                            <div 
                                                key={folder.id} 
                                                onDoubleClick={() => handleNavigate(folder.id, folder.name)}
                                                onClick={(e) => handleSelection(e, folder.id)}
                                                onContextMenu={(e) => handleContextMenu(e, folder)}
                                                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all group ${selectedIds.has(folder.id) ? 'bg-[#C2E7FF]/20 border-[#C2E7FF]/50' : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'}`}
                                            >
                                                <Folder className={`w-5 h-5 shrink-0 ${selectedIds.has(folder.id) ? 'text-[#C2E7FF]' : 'text-white/40 group-hover:text-white/60'}`} fill="currentColor" />
                                                <span className={`text-sm truncate ${selectedIds.has(folder.id) ? 'text-[#C2E7FF] font-medium' : 'text-white/80'}`}>{folder.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* FILES SECTION */}
                            {(sortedFiles.length > 0) ? (
                                <div>
                                    <h3 className="text-white/50 text-xs font-medium mb-3 uppercase tracking-wider px-2">Arquivos</h3>
                                    {driveView === 'list' ? (
                                        <div className="w-full">
                                            <div className="grid grid-cols-12 text-xs text-white/40 border-b border-white/10 pb-2 mb-2 px-4 sticky top-0 bg-[#131313] z-10">
                                                <div className="col-span-6 flex items-center gap-1 cursor-pointer hover:text-white" onClick={() => handleSort('name')}>
                                                    Nome {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? <ArrowUp size={10}/> : <ArrowDown size={10}/>)}
                                                </div>
                                                <div className="col-span-3 flex items-center gap-1 cursor-pointer hover:text-white" onClick={() => handleSort('owner')}>
                                                    Proprietário {sortConfig.key === 'owner' && (sortConfig.direction === 'asc' ? <ArrowUp size={10}/> : <ArrowDown size={10}/>)}
                                                </div>
                                                <div className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-white" onClick={() => handleSort('date')}>
                                                    Data {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? <ArrowUp size={10}/> : <ArrowDown size={10}/>)}
                                                </div>
                                                <div className="col-span-1 text-right flex items-center justify-end gap-1 cursor-pointer hover:text-white" onClick={() => handleSort('size')}>
                                                    Tamanho {sortConfig.key === 'size' && (sortConfig.direction === 'asc' ? <ArrowUp size={10}/> : <ArrowDown size={10}/>)}
                                                </div>
                                            </div>
                                            {sortedFiles.map((f:any) => (
                                                <div 
                                                    key={f.id} 
                                                    onClick={(e) => handleSelection(e, f.id)}
                                                    onDoubleClick={() => handleFileOpen(f)}
                                                    onContextMenu={(e) => handleContextMenu(e, f)}
                                                    className={`grid grid-cols-12 items-center text-sm py-2.5 px-4 rounded-lg cursor-pointer border border-transparent transition-all group ${selectedIds.has(f.id) ? 'bg-[#C2E7FF]/20 text-[#C2E7FF]' : 'text-white/80 hover:bg-white/5'}`}
                                                >
                                                    <div className="col-span-6 flex items-center gap-3">
                                                        {getFileIcon(f.type, "w-5 h-5")}
                                                        <span className="truncate">{f.name}</span>
                                                        {f.isStarred && <Star size={12} className="text-yellow-400 fill-yellow-400 ml-2" />}
                                                    </div>
                                                    <div className="col-span-3 text-white/40 text-xs truncate group-hover:text-white/60">{f.owner}</div>
                                                    <div className="col-span-2 text-white/40 text-xs truncate group-hover:text-white/60">{f.date}</div>
                                                    <div className="col-span-1 text-white/40 text-xs text-right group-hover:text-white/60">{f.size}</div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                            {sortedFiles.map((f:any) => (
                                                <div 
                                                    key={f.id} 
                                                    onClick={(e) => handleSelection(e, f.id)}
                                                    onDoubleClick={() => handleFileOpen(f)}
                                                    onContextMenu={(e) => handleContextMenu(e, f)}
                                                    className={`relative bg-white/5 border rounded-xl overflow-hidden cursor-pointer flex flex-col transition-all group ${selectedIds.has(f.id) ? 'border-[#C2E7FF] ring-1 ring-[#C2E7FF] bg-[#C2E7FF]/5' : 'border-white/5 hover:bg-white/10 hover:border-white/20'}`}
                                                >
                                                    <div className="h-32 bg-white/5 flex items-center justify-center relative overflow-hidden">
                                                        {f.type === 'image' || f.thumbnail ? (
                                                            <div className="w-full h-full bg-cover bg-center opacity-80 group-hover:opacity-100 transition-opacity" style={{ backgroundImage: f.thumbnail ? `url(${f.thumbnail})` : 'url(https://source.unsplash.com/random/200x200)' }}></div>
                                                        ) : (
                                                            getFileIcon(f.type, "w-12 h-12 opacity-50 group-hover:scale-110 transition-transform")
                                                        )}
                                                        {f.isStarred && <div className="absolute top-2 right-2 bg-black/40 p-1 rounded-full"><Star size={12} className="text-yellow-400 fill-yellow-400" /></div>}
                                                    </div>
                                                    <div className="p-3 flex items-center gap-3 border-t border-white/5 bg-[#191919]">
                                                        {getFileIcon(f.type, "w-4 h-4 shrink-0")}
                                                        <span className={`text-xs truncate w-full ${selectedIds.has(f.id) ? 'text-[#C2E7FF]' : 'text-white/90'}`}>{f.name}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                !content?.folders?.length && (
                                    <div className="flex flex-col items-center justify-center h-64 text-white/30">
                                        <HardDriveIcon size={48} className="mb-4 opacity-50" strokeWidth={1} />
                                        <p className="text-sm">Esta pasta está vazia</p>
                                    </div>
                                )
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* DETAILS PANEL (RIGHT SIDEBAR) */}
            {showDetails && (
                <div className="w-80 border-l border-white/5 bg-[#191919] flex flex-col animate-in slide-in-from-right-10 duration-300 shadow-2xl z-20">
                    <div className="h-14 flex items-center justify-between px-4 border-b border-white/5">
                        <span className="text-sm font-medium text-white">Detalhes</span>
                        <button onClick={() => setShowDetails(false)} className="p-1.5 hover:bg-white/10 rounded-full text-white/60"><X size={16}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                        {detailsItem ? (
                            <div className="space-y-6">
                                <div className="flex flex-col items-center">
                                    <div className="w-24 h-24 bg-white/5 rounded-2xl flex items-center justify-center mb-4 border border-white/10">
                                        {detailsItem.type === 'image' || detailsItem.thumbnail ? (
                                            <div className="w-full h-full bg-cover bg-center rounded-2xl opacity-80" style={{ backgroundImage: detailsItem.thumbnail ? `url(${detailsItem.thumbnail})` : 'url(https://source.unsplash.com/random/200x200)' }}></div>
                                        ) : (
                                            getFileIcon(detailsItem.type, "w-10 h-10")
                                        )}
                                    </div>
                                    <h3 className="text-sm font-medium text-white text-center break-words w-full">{detailsItem.name}</h3>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-white/5">
                                    <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Propriedades</h4>
                                    
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-white/50">Tipo</span>
                                            <span className="text-white/80">{detailsItem.type.toUpperCase()}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-white/50">Tamanho</span>
                                            <span className="text-white/80">{detailsItem.size || '-'}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-white/50">Armazenamento</span>
                                            <span className="text-white/80">0 Bytes usados</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-white/50">Local</span>
                                            <span className="text-white/80 flex items-center gap-1"><Folder size={10}/> {content?.currentFolderName || 'Meu Drive'}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-white/50">Proprietário</span>
                                            <span className="text-white/80">{detailsItem.owner}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-white/50">Modificado</span>
                                            <span className="text-white/80">{detailsItem.date}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-white/50">Aberto</span>
                                            <span className="text-white/80">{detailsItem.date}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-white/50">Criado</span>
                                            <span className="text-white/80">{detailsItem.date}</span>
                                        </div>
                                    </div>
                                </div>

                                {detailsItem.type !== 'folder' && (
                                    <div className="flex gap-2 pt-4">
                                        <button onClick={() => handleDownload(detailsItem)} className="flex-1 bg-white/5 hover:bg-white/10 text-white text-xs font-medium py-2 rounded-lg flex items-center justify-center gap-2 border border-white/5 transition-colors">
                                            <Download size={14}/> Download
                                        </button>
                                        <button onClick={() => handleFileOpen(detailsItem)} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium py-2 rounded-lg flex items-center justify-center gap-2 transition-colors">
                                            <Eye size={14}/> Visualizar
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-white/30 text-center">
                                <HardDriveIcon size={48} className="mb-4 opacity-50" strokeWidth={1} />
                                <p className="text-sm">Selecione um arquivo ou pasta para ver os detalhes</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* CONTEXT MENU */}
        {contextMenu && (
            <div className="fixed z-50 bg-[#2d2e30] border border-white/10 rounded-xl shadow-2xl py-1 w-56 animate-in fade-in zoom-in duration-100 backdrop-blur-xl" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={(e) => e.stopPropagation()}>
                <div className="px-4 py-2 border-b border-white/5 mb-1">
                    <p className="text-xs font-medium text-white truncate">{contextMenu.item.name}</p>
                    <p className="text-[10px] text-white/40">{contextMenu.item.type === 'folder' ? 'Pasta' : 'Arquivo'}</p>
                </div>
                <button onClick={() => { handleFileOpen(contextMenu.item); setContextMenu(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2 hover:bg-white/10 text-white/90 text-sm"><Eye size={14}/> Abrir</button>
                {contextMenu.item.type !== 'folder' && (
                    <button onClick={() => { handleDownload(contextMenu.item); setContextMenu(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2 hover:bg-white/10 text-white/90 text-sm"><Download size={14}/> Download</button>
                )}
                <button onClick={() => { setModalTargetId(contextMenu.item.id); setModalInput(contextMenu.item.name); setModalMode('rename'); setContextMenu(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2 hover:bg-white/10 text-white/90 text-sm"><Edit2 size={14}/> Renomear</button>
                <button onClick={() => { handleStar(contextMenu.item.id, contextMenu.item.isStarred || false); setContextMenu(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2 hover:bg-white/10 text-white/90 text-sm"><Star size={14} className={contextMenu.item.isStarred ? 'fill-yellow-400 text-yellow-400' : ''}/> {contextMenu.item.isStarred ? 'Remover estrela' : 'Adicionar estrela'}</button>
                <div className="h-[1px] bg-white/10 my-1"></div>
                <button onClick={() => { handleDelete(contextMenu.item.id); setContextMenu(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2 hover:bg-white/10 text-red-400 text-sm"><Trash2 size={14}/> Mover para lixeira</button>
            </div>
        )}

        {/* MODAL (CREATE/RENAME) */}
        {modalMode && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-[#2d2e30] border border-white/10 rounded-2xl p-6 w-[400px] shadow-2xl animate-in zoom-in duration-200">
                    <h3 className="text-lg font-medium text-white mb-4">{modalMode === 'create_folder' ? 'Nova Pasta' : 'Renomear'}</h3>
                    <input 
                        type="text" 
                        value={modalInput} 
                        onChange={(e) => setModalInput(e.target.value)} 
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500 mb-6"
                        placeholder="Nome"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && (modalMode === 'create_folder' ? handleCreateFolder() : handleRename())}
                    />
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setModalMode(null)} className="px-4 py-2 text-white/70 hover:text-white text-sm font-medium">Cancelar</button>
                        <button onClick={() => modalMode === 'create_folder' ? handleCreateFolder() : handleRename()} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-sm font-medium">Salvar</button>
                    </div>
                </div>
            </div>
        )}

        {/* PREVIEW OVERLAY */}
        {previewFile && (
            <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} onDownload={handleDownload} />
        )}

        {/* UPLOAD STATUS INDICATOR */}
        {uploadStatus && (
            <div className="absolute bottom-6 right-6 w-80 bg-[#2d2e30] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300 z-50">
                <div className="bg-[#1f1f1f] px-4 py-3 flex items-center justify-between border-b border-white/5">
                    <span className="text-sm font-medium text-white">
                        {uploadStatus.state === 'uploading' ? 'Fazendo upload...' : uploadStatus.state === 'success' ? 'Upload concluído' : 'Falha no upload'}
                    </span>
                    <button onClick={() => setUploadStatus(null)} className="text-white/60 hover:text-white"><X size={16}/></button>
                </div>
                <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 bg-white/10 rounded flex items-center justify-center">
                            {uploadStatus.state === 'success' ? <Check size={16} className="text-green-400"/> : 
                             uploadStatus.state === 'error' ? <AlertCircle size={16} className="text-red-400"/> :
                             <FileText size={16} className="text-white/60"/>}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-white truncate" title={uploadStatus.fileName}>{uploadStatus.fileName}</p>
                        </div>
                    </div>
                    {uploadStatus.state === 'uploading' && (
                        <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                            <div className="bg-blue-500 h-full transition-all duration-200" style={{ width: `${uploadStatus.progress}%` }}></div>
                        </div>
                    )}
                </div>
            </div>
        )}
    </div>
  );
}
