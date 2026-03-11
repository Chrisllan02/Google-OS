import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Settings, X, Plus, HardDrive, List, LayoutGrid,
  FileText, Folder, File, Image as ImageIcon, ChevronRight, Clock, Star, Trash2, Users, Loader2, ArrowLeft, MoreVertical,
  Edit2, Eye, ExternalLink, Upload, Download, Maximize2, Info, ArrowUp, ArrowDown, HardDrive as HardDriveIcon,
  Check, AlertCircle, Video, Wand2, Sparkles, Bot, Film, Move, CornerUpLeft, UserPlus, Link as LinkIcon, Copy, Globe,
  RotateCcw, Shield, History
} from 'lucide-react';
import { GoogleIcons, GeminiLogo } from '../GoogleIcons';
import { bridge, DriveItem, DriveResponse, Permission, FileVersion } from '../../utils/GASBridge';
import ContextMenu, { ContextMenuItem } from '../ContextMenu';

interface DriveAppProps {
  onClose: () => void;
  data: any;
  onOpenApp?: (type: string, fileData?: any) => void;
  showToast?: (msg: string) => void;
}

const getFileIcon = (type: string, className = "w-6 h-6") => {
  switch(type) {
    case 'sheet': return <GoogleIcons.Sheets className={className} />;
    case 'slide': return <GoogleIcons.Slides className={className} />;
    case 'doc': return <GoogleIcons.Docs className={className} />;
    case 'image': return <ImageIcon className={`${className} text-red-500`} />;
    case 'pdf': return <FileText className={`${className} text-red-600`} />;
    case 'folder': return <Folder className={`${className} text-white/40 fill-current`} />;
    default: return <File className={`${className} text-gray-400`} />;
  }
};

export default function DriveApp({ onClose, data, onOpenApp, showToast }: DriveAppProps) {
  const [driveView, setDriveView] = useState<'list' | 'grid'>('grid');
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('root'); 
  const [content, setContent] = useState<DriveResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<{id: string | null, name: string}[]>([]); 
  const [searchQuery, setSearchQuery] = useState('');
  const [modalMode, setModalMode] = useState<'create_folder' | 'rename' | null>(null);
  const [modalInput, setModalInput] = useState('');
  const [modalTargetId, setModalTargetId] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{ state: 'uploading' | 'success' | 'error', fileName: string, progress: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, items: ContextMenuItem[] } | null>(null);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const appContainerRef = useRef<HTMLDivElement>(null);
  const toast = (msg: string) => showToast && showToast(msg);

  useEffect(() => {
    fetchContent(currentFolderId, category, searchQuery);
  }, [currentFolderId, category]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (!focusedItemId || modalMode) return;

        const allItems = [...(content?.folders || []), ...(content?.files || [])];
        const focusedItem = allItems.find(item => item.id === focusedItemId);
        if (!focusedItem) return;

        switch(e.key) {
            case 'Enter':
                handleFileOpen(focusedItem);
                break;
            case 'Delete':
            case 'Backspace':
                handleTrashItem(focusedItemId);
                break;
            case 'F2':
                e.preventDefault();
                setModalTargetId(focusedItem.id);
                setModalInput(focusedItem.name);
                setModalMode('rename');
                break;
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedItemId, content, modalMode]);


  const fetchContent = async (folderId: string | null, cat: string, query: string = '') => {
      setLoading(true);
      setFocusedItemId(null);
      try {
          const res = await bridge.getDriveItems(folderId, cat, query);
          setContent(res);
      } catch (e) { console.error("Drive Error", e); } 
      finally { setLoading(false); }
  };

  const handleFileUpload = async (file: File) => {
      setUploadStatus({ state: 'uploading', fileName: file.name, progress: 0 });
      try {
          const reader = new FileReader();
          reader.onload = async (ev) => {
              const base64 = (ev.target?.result as string).split(',')[1];
              await bridge.uploadFileToDrive(base64, file.name, file.type, currentFolderId);
              setUploadStatus({ state: 'success', fileName: file.name, progress: 100 });
              toast("Upload concluído");
              fetchContent(currentFolderId, category);
              setTimeout(() => setUploadStatus(null), 3000);
          };
          reader.readAsDataURL(file);
      } catch (e) {
          setUploadStatus({ state: 'error', fileName: file.name, progress: 0 });
      }
  };
  
  const handleCreateFolder = async () => {
      if (!modalInput.trim()) return;
      await bridge.createDriveFolder(modalInput, currentFolderId);
      setModalMode(null); setModalInput('');
      toast("Pasta criada");
      fetchContent(currentFolderId, category);
  };
  
  const handleRename = async () => {
      if (!modalInput.trim() || !modalTargetId) return;
      await bridge.renameDriveItem(modalTargetId, modalInput);
      setModalMode(null); setModalInput(''); setModalTargetId(null);
      toast("Renomeado");
      fetchContent(currentFolderId, category);
  };
  
  const handleFileOpen = (item: DriveItem) => {
      if (item.type === 'folder') {
          setCurrentFolderId(item.id);
      } else if (onOpenApp) {
          onOpenApp(item.type, item);
      }
  };

  const handleTrashItem = async (id: string) => {
    await bridge.trashDriveItem(id);
    toast("Item movido para a lixeira");
    setFocusedItemId(null);
    fetchContent(currentFolderId, category, searchQuery);
  };

  const handleContextMenu = (e: React.MouseEvent, item: DriveItem) => {
    e.preventDefault();
    e.stopPropagation();
    setFocusedItemId(item.id);
    setContextMenu(null);

    const menuItems: ContextMenuItem[] = [
        { label: "Abrir", icon: <ExternalLink size={14} />, action: () => handleFileOpen(item) },
        { isSeparator: true, label: '', action: () => {} },
        { label: "Renomear", icon: <Edit2 size={14} />, action: () => { setModalTargetId(item.id); setModalInput(item.name); setModalMode('rename'); } },
        { isSeparator: true, label: '', action: () => {} },
        { label: "Mover para Lixeira", icon: <Trash2 size={14} />, isDestructive: true, action: () => handleTrashItem(item.id) },
    ];

    setTimeout(() => setContextMenu({ x: e.clientX, y: e.clientY, items: menuItems }), 50);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => { e.dataTransfer.setData('text/plain', id); setDraggingItemId(id); };
  const handleDragOverFolder = (e: React.DragEvent, folderId: string) => { e.preventDefault(); e.stopPropagation(); if (draggingItemId && draggingItemId !== folderId) setDragOverFolderId(folderId); };
  const handleDragLeaveFolder = (e: React.DragEvent) => { e.preventDefault(); setDragOverFolderId(null); };
  const handleItemDropOnFolder = async (e: React.DragEvent, targetFolderId: string) => {
      e.preventDefault(); e.stopPropagation(); setDragOverFolderId(null);
      if (!draggingItemId || draggingItemId === targetFolderId) return;
      toast(`Movendo item...`);
      const success = await bridge.moveDriveItem(draggingItemId, targetFolderId);
      if (success) { toast("Item movido com sucesso!"); fetchContent(currentFolderId, category, searchQuery); } 
      else { toast("Falha ao mover item."); }
      setDraggingItemId(null);
  };
  const handleUploadDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); if (e.dataTransfer.files && e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files[0]); };


  return (
    <div ref={appContainerRef} className="flex flex-col h-full bg-[#191919] select-none text-white relative" onClick={() => { setContextMenu(null); setFocusedItemId(null); }}>
        <div className="h-16 px-6 flex items-center justify-between shrink-0 border-b border-white/5 bg-black/20 z-20">
            <div className="flex items-center gap-2"><div className="p-2 bg-white/10 rounded-full"><HardDrive className="w-5 h-5 text-white"/></div><span className="text-white text-lg font-light tracking-tight">Google Drive</span></div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full cursor-pointer text-white/80"><X size={24} /></button>
        </div>

        <div className="flex-1 flex overflow-hidden">
            <div className="w-60 border-r border-white/5 p-4 flex flex-col gap-1 bg-white/[0.02]">
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-3 px-4 py-3 bg-[#F0F4F9] text-[#1f1f1f] hover:bg-white rounded-2xl font-medium mb-4 shadow-sm w-full"><Plus size={20}/> <span className="text-sm">Novo</span></button>
                <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
                {[{ id: 'root', label: 'Meu Drive', icon: HardDrive }, { id: 'trash', label: 'Lixeira', icon: Trash2 }].map(item => (<button key={item.id} onClick={() => { setCategory(item.id); setCurrentFolderId(null); }} className={`flex items-center gap-3 px-4 py-2 rounded-full text-sm transition-all ${category === item.id ? 'bg-[#C2E7FF] text-[#001D35] font-medium' : 'text-white/70 hover:bg-white/5'}`}><item.icon size={18}/> {item.label}</button>))}
            </div>

            <div className="flex-1 flex flex-col min-w-0" onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }} onDragLeave={() => setIsDragOver(false)} onDrop={handleUploadDrop}>
                <div className="h-14 border-b border-white/5 flex items-center justify-between px-4 shrink-0"><span className="text-sm text-white/80">{content?.currentFolderName || "Meu Drive"}</span><button onClick={() => setModalMode('create_folder')} className="text-xs flex items-center gap-1 bg-white/5 hover:bg-white/10 px-2 py-1 rounded"><Folder size={14}/> Nova Pasta</button></div>

                <div className={`flex-1 overflow-y-auto p-4 custom-scrollbar relative ${isDragOver && !dragOverFolderId ? 'bg-blue-500/10' : ''}`}>
                    {loading ? <div className="absolute inset-0 flex items-center justify-center"><Loader2 size={32} className="animate-spin text-blue-400"/></div> : (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {content?.folders.map(f => {
                                const isBeingDragged = draggingItemId === f.id;
                                const isDropTarget = dragOverFolderId === f.id;
                                const isFocused = focusedItemId === f.id;
                                return (
                                    <div 
                                        key={f.id} draggable onDragStart={(e) => handleDragStart(e, f.id)} onDragEnd={() => setDraggingItemId(null)}
                                        onDragOver={(e) => handleDragOverFolder(e, f.id)} onDragLeave={handleDragLeaveFolder} onDrop={(e) => handleItemDropOnFolder(e, f.id)}
                                        onClick={(e) => { e.stopPropagation(); setFocusedItemId(f.id); }} onDoubleClick={() => handleFileOpen(f)} onContextMenu={(e) => handleContextMenu(e, f)} 
                                        className={`border rounded-xl p-3 cursor-pointer transition-all duration-200 relative ${isBeingDragged ? 'opacity-40' : 'opacity-100'} ${isDropTarget ? 'bg-blue-500/20 border-blue-400' : 'bg-white/5 border-white/5 hover:bg-white/10'} ${isFocused ? 'ring-2 ring-blue-500' : ''}`}
                                    >
                                        <div className="flex items-center gap-2 pointer-events-none"><Folder size={20} className="text-white/60"/> <span className="truncate text-sm">{f.name}</span></div>
                                    </div>
                                );
                            })}
                            {content?.files.map(f => {
                                const isBeingDragged = draggingItemId === f.id;
                                const isFocused = focusedItemId === f.id;
                                return (
                                    <div 
                                        key={f.id} draggable onDragStart={(e) => handleDragStart(e, f.id)} onDragEnd={() => setDraggingItemId(null)}
                                        onClick={(e) => { e.stopPropagation(); setFocusedItemId(f.id); }} onDoubleClick={() => handleFileOpen(f)} onContextMenu={(e) => handleContextMenu(e, f)} 
                                        className={`bg-white/5 border border-white/5 rounded-xl flex flex-col hover:bg-white/10 cursor-pointer transition-all relative ${isBeingDragged ? 'opacity-40' : 'opacity-100'} ${isFocused ? 'ring-2 ring-blue-500' : ''}`}
                                    >
                                        <div className="h-24 flex items-center justify-center pointer-events-none">{getFileIcon(f.type, "w-10 h-10 opacity-70")}</div>
                                        <div className="p-2 border-t border-white/10 flex items-center gap-2 pointer-events-none"><File size={14} className="text-white/50"/> <span className="truncate text-xs">{f.name}</span></div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
        
        {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenu.items} onClose={() => setContextMenu(null)} />}
        {uploadStatus && <div className="absolute bottom-6 right-6 w-80 bg-[#2d2e30] border border-white/10 rounded-xl shadow-2xl z-50"><p className="p-2 text-xs text-white/70 truncate">{uploadStatus.fileName}</p><div className="w-full bg-white/10 h-1"><div className="bg-blue-500 h-full" style={{ width: `${uploadStatus.progress}%` }}></div></div></div>}
        {modalMode && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setModalMode(null)}><div className="bg-[#2d2e30] p-6 rounded-2xl w-[400px]" onClick={e => e.stopPropagation()}><h3 className="text-lg mb-4">{modalMode === 'create_folder' ? 'Nova Pasta' : 'Renomear'}</h3><input type="text" value={modalInput} onChange={e => setModalInput(e.target.value)} className="w-full bg-black/20 p-3 rounded-lg outline-none focus:border-blue-500 border border-white/10 mb-4" autoFocus onKeyDown={(e) => e.key === 'Enter' && (modalMode === 'create_folder' ? handleCreateFolder() : handleRename())} /><button onClick={modalMode === 'create_folder' ? handleCreateFolder : handleRename} className="w-full bg-blue-600 py-2 rounded-lg">Salvar</button></div></div>}
    </div>
  );
}