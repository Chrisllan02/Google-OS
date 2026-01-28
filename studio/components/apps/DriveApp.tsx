
import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Settings, X, Plus, HardDrive, List, LayoutGrid,
  FileText, Folder, File, Image as ImageIcon, ChevronRight, Clock, Star, Trash2, Users, Loader2, ArrowLeft, MoreVertical,
  Edit2, Eye, ExternalLink, Upload, Download, Maximize2, Info, ArrowUp, ArrowDown, HardDrive as HardDriveIcon,
  Check, AlertCircle, Video, Wand2, Sparkles, Bot, Film, Move, CornerUpLeft, UserPlus, Link as LinkIcon, Copy, Globe
} from 'lucide-react';
import { GoogleIcons, GeminiLogo } from '../GoogleIcons';
import { bridge, DriveItem, DriveResponse } from '../../utils/GASBridge';
import { GoogleGenAI } from "@google/genai";

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
                } else if (!res.success) {
                    setContent(null);
                }
            } catch (e) {
                console.error("Erro ao carregar preview", e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [file]);

    const isImage = file.type === 'image' || file.mimeType?.startsWith('image/');

    return (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-300">
            <div className="flex items-center justify-between px-6 py-4 bg-black/40 border-b border-white/10">
                <div className="flex items-center gap-3 text-white">
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full"><ArrowLeft size={20}/></button>
                    <span className="font-medium truncate max-w-md">{file.name}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => onDownload(file)} className="p-2 hover:bg-white/10 rounded-full text-white/70" title="Download"><Download size={20}/></button>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white/70"><X size={24}/></button>
                </div>
            </div>
            <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 flex items-center justify-center p-8 relative">
                    {loading ? (
                        <Loader2 size={48} className="text-white/50 animate-spin" />
                    ) : content ? (
                        isImage ? (
                            <img src={content.startsWith('http') ? content : `data:${file.mimeType};base64,${content}`} className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" alt={file.name} />
                        ) : (
                             <div className="text-white flex flex-col items-center gap-4">
                                 <FileText size={64} className="opacity-50"/>
                                 <p>Visualização não suportada para este formato.</p>
                                 <button onClick={() => onDownload(file)} className="bg-blue-600 px-4 py-2 rounded-lg text-sm hover:bg-blue-500 transition-colors">Baixar Arquivo</button>
                             </div>
                        )
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default function DriveApp({ onClose, data, onOpenApp, showToast }: DriveAppProps) {
  const [driveView, setDriveView] = useState<'list' | 'grid'>('list');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('root'); 
  const [content, setContent] = useState<DriveResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [modalMode, setModalMode] = useState<'create_folder' | 'rename' | 'move' | null>(null);
  const [modalInput, setModalInput] = useState('');
  const [modalTargetId, setModalTargetId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<DriveItem | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{ state: 'uploading' | 'success' | 'error', fileName: string, progress: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [sortConfig, setSortConfig] = useState<{key: keyof DriveItem, direction: 'asc' | 'desc'}>({ key: 'date', direction: 'desc' });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = (msg: string) => showToast && showToast(msg);

  useEffect(() => {
      fetchContent(currentFolderId, category, searchQuery);
  }, [currentFolderId, category]); 

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

  // --- CHUNKED UPLOAD IMPLEMENTATION ---
  const handleFileUpload = async (file: File) => {
      setUploadStatus({ state: 'uploading', fileName: file.name, progress: 0 });
      setShowNewMenu(false);

      const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
      const totalSize = file.size;
      let offset = 0;
      
      const readBlob = (blob: Blob): Promise<string> => {
          return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve((reader.result as string).split(',')[1]);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
          });
      };

      try {
          let fileId = undefined;
          
          while (offset < totalSize) {
              const chunk = file.slice(offset, offset + CHUNK_SIZE);
              const base64Chunk = await readBlob(chunk);
              
              const response = await bridge.uploadFileChunk(
                  base64Chunk, 
                  file.name, 
                  file.type, 
                  currentFolderId, 
                  offset, 
                  totalSize,
                  fileId
              );
              
              if ((response as any).fileId) fileId = (response as any).fileId;

              offset += CHUNK_SIZE;
              const progress = Math.min(100, Math.round((offset / totalSize) * 100));
              setUploadStatus(prev => prev ? { ...prev, progress } : null);
          }

          setUploadStatus({ state: 'success', fileName: file.name, progress: 100 });
          toast("Upload concluído");
          fetchContent(currentFolderId, category);
          
          setTimeout(() => {
              setUploadStatus(prev => prev?.state === 'success' ? null : prev);
          }, 4000);

      } catch (error) {
          console.error("Upload error", error);
          setUploadStatus({ state: 'error', fileName: file.name, progress: 0 });
          toast("Erro no upload");
      }
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleFileUpload(e.dataTransfer.files[0]);
      }
  };

  const handleCreateFolder = async () => {
      if (!modalInput.trim()) return;
      setLoading(true);
      await bridge.createDriveFolder(modalInput, currentFolderId);
      setModalMode(null);
      setModalInput('');
      toast("Pasta criada");
      fetchContent(currentFolderId, category);
  };

  const handleRename = async () => {
      if (!modalInput.trim() || !modalTargetId) return;
      setLoading(true);
      await bridge.renameDriveItem(modalTargetId, modalInput);
      setModalMode(null);
      setModalInput('');
      setModalTargetId(null);
      toast("Renomeado");
      fetchContent(currentFolderId, category);
  };

  const handleDownload = async (item: DriveItem) => {
      setLoading(true);
      toast("Preparando download...");
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
              toast("Erro no download.");
          }
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const sortedFiles = content?.files || [];

  return (
    <div className="flex flex-col h-full bg-[#191919] select-none text-white relative">
        <div className="h-16 px-6 flex items-center justify-between shrink-0 border-b border-white/5 backdrop-blur-xl z-20 bg-black/20">
            <div className="flex items-center gap-4 w-64">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-white/10 rounded-full"><HardDrive className="w-5 h-5 text-white"/></div>
                    <span className="text-white text-lg font-light tracking-tight">Google Drive</span>
                </div>
            </div>
            <div className="flex items-center gap-4 w-64 justify-end">
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full cursor-pointer text-white/80"><X size={24} /></button>
            </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
            <div className="w-60 border-r border-white/5 p-4 flex flex-col gap-1 bg-white/[0.02]">
                <div className="relative">
                    <button onClick={() => setShowNewMenu(!showNewMenu)} className="flex items-center gap-3 px-4 py-3 bg-[#F0F4F9] text-[#1f1f1f] hover:bg-white rounded-2xl font-medium mb-4 shadow-sm border border-transparent transition-all w-full">
                        <Plus size={20} /> <span className="text-sm">Novo</span>
                    </button>
                    {showNewMenu && (
                        <div className="absolute top-12 left-0 w-56 bg-[#2d2e30] border border-white/10 rounded-xl shadow-2xl py-2 z-50">
                            <button onClick={() => { setModalMode('create_folder'); setShowNewMenu(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-white/90 text-sm"><Folder size={16}/> Nova pasta</button>
                            <button onClick={() => fileInputRef.current?.click()} className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-white/90 text-sm"><Upload size={16}/> Upload de arquivo</button>
                        </div>
                    )}
                    <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
                </div>
            </div>

            <div 
                className={`flex-1 overflow-y-auto p-4 custom-scrollbar relative transition-colors ${isDragOver ? 'bg-blue-500/10 border-2 border-dashed border-blue-500 m-2 rounded-xl' : ''}`} 
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
            >
                {(sortedFiles.length > 0) ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {sortedFiles.map((f:any) => (
                            <div key={f.id} className="relative bg-white/5 border border-white/5 rounded-xl overflow-hidden cursor-pointer flex flex-col hover:bg-white/10" onClick={() => setPreviewFile(f)}>
                                <div className="h-32 bg-white/5 flex items-center justify-center">
                                    {getFileIcon(f.type, "w-12 h-12 opacity-50")}
                                </div>
                                <div className="p-3 flex items-center gap-3 border-t border-white/5 bg-[#191919]">
                                    {getFileIcon(f.type, "w-4 h-4 shrink-0")}
                                    <span className="text-xs truncate w-full text-white/90">{f.name}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-white/30">
                        <HardDriveIcon size={48} className="mb-4 opacity-50" strokeWidth={1} />
                        <p className="text-sm">Esta pasta está vazia</p>
                    </div>
                )}
            </div>
        </div>

        {uploadStatus && (
            <div className="absolute bottom-6 right-6 w-80 bg-[#2d2e30] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300 z-50">
                <div className="bg-[#1f1f1f] px-4 py-3 flex items-center justify-between border-b border-white/5">
                    <span className="text-sm font-medium text-white">{uploadStatus.state === 'uploading' ? 'Fazendo upload...' : 'Upload concluído'}</span>
                    <button onClick={() => setUploadStatus(null)} className="text-white/60 hover:text-white"><X size={16}/></button>
                </div>
                <div className="p-4">
                    <p className="text-xs text-white truncate mb-2">{uploadStatus.fileName}</p>
                    {uploadStatus.state === 'uploading' && (
                        <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                            <div className="bg-blue-500 h-full transition-all duration-200" style={{ width: `${uploadStatus.progress}%` }}></div>
                        </div>
                    )}
                </div>
            </div>
        )}

        {modalMode && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="bg-[#2d2e30] border border-white/10 rounded-2xl p-6 w-[400px] shadow-2xl">
                    <input type="text" value={modalInput} onChange={(e) => setModalInput(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500 mb-6" placeholder="Nome" autoFocus />
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setModalMode(null)} className="px-4 py-2 text-white/70 hover:text-white text-sm">Cancelar</button>
                        <button onClick={() => modalMode === 'create_folder' ? handleCreateFolder() : handleRename()} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-sm font-medium">Salvar</button>
                    </div>
                </div>
            </div>
        )}

        {previewFile && <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} onDownload={handleDownload} />}
    </div>
  );
}
