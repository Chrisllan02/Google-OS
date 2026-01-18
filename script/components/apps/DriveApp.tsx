
import React, { useState } from 'react';
import { 
  Search, Settings, X, Plus, HardDrive, List, LayoutGrid,
  FileText, Folder, File, Image as ImageIcon
} from 'lucide-react';
import { GoogleIcons } from '../GoogleIcons';

interface DriveAppProps {
  onClose: () => void;
  data: any;
}

const getFileIcon = (type: string) => {
  switch(type) {
    case 'sheet': return <GoogleIcons.Sheets className="w-5 h-5" />;
    case 'slide': return <GoogleIcons.Slides className="w-5 h-5" />;
    case 'doc': return <GoogleIcons.Docs className="w-5 h-5" />;
    case 'image': return <ImageIcon className="w-5 h-5 text-red-500" />;
    case 'folder': return <Folder className="w-5 h-5 text-gray-400 fill-gray-400" />;
    default: return <File className="w-5 h-5 text-gray-400" />;
  }
};

export default function DriveApp({ onClose, data }: DriveAppProps) {
  const [driveView, setDriveView] = useState<'list' | 'grid'>('list');
  const [selectedFileIds, setSelectedFileIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const toggleFileSelection = (id: number) => {
      const newSet = new Set(selectedFileIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedFileIds(newSet);
  };

  const appHeaderClass = "h-16 px-6 flex items-center justify-between shrink-0 border-b border-white/5 backdrop-blur-xl z-20 bg-black/20";

  // Filter files based on search query
  const filteredFiles = data?.files?.filter((f: any) => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // Filter suggested files (limit to 4, also filtered by search)
  const suggestedFiles = filteredFiles.slice(0, 4);

  return (
    <div className="flex flex-col h-full bg-[#191919]">
        <div className={appHeaderClass}>
            <div className="flex items-center gap-4 w-64">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-white/10 rounded-full"><HardDrive className="w-5 h-5 text-white"/></div>
                    <span className="text-white text-lg font-light tracking-tight">Google Drive</span>
                </div>
            </div>
            <div className="flex-1 max-w-2xl px-8 relative hidden md:block">
                <div className="bg-white/5 border border-white/10 flex items-center px-4 py-2.5 rounded-full focus-within:bg-white/10 transition-colors">
                    <Search className="text-white/40" size={18} />
                    <input 
                        type="text" 
                        placeholder="Pesquisar no Drive" 
                        className="bg-transparent border-none outline-none ml-3 w-full text-white placeholder:text-white/30 text-sm" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
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
            <div className="w-60 border-r border-white/5 p-4 flex flex-col gap-2 bg-white/5">
                <button className="flex items-center gap-3 px-4 py-3 bg-white/10 rounded-xl text-white text-sm font-medium mb-4 shadow-lg border border-white/10">
                    <Plus size={18} /> Novo
                </button>
                {['Meu Drive', 'Computadores', 'Compartilhados comigo', 'Recentes', 'Com estrela', 'Lixeira'].map(item => (
                    <div key={item} className="flex items-center gap-3 px-4 py-2 rounded-lg text-white/70 hover:bg-white/10 hover:text-white cursor-pointer text-sm transition-colors">
                        <HardDrive size={16} /> {item}
                    </div>
                ))}
                <div className="mt-auto bg-white/5 p-4 rounded-xl">
                    <p className="text-xs text-white/60 mb-2">Armazenamento</p>
                    <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden mb-2">
                        <div className="bg-blue-500 w-[70%] h-full"></div>
                    </div>
                    <p className="text-[10px] text-white/40">70% de 15GB usados</p>
                </div>
            </div>
            <div className="flex-1 flex flex-col bg-[#131313]">
                <div className="h-12 border-b border-white/5 flex items-center justify-between px-4">
                    <span className="text-white/80 text-sm">Meu Drive</span>
                    <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1">
                        <button onClick={() => setDriveView('list')} className={`p-1.5 rounded ${driveView === 'list' ? 'bg-white/10 text-white' : 'text-white/50'}`}><List size={16}/></button>
                        <button onClick={() => setDriveView('grid')} className={`p-1.5 rounded ${driveView === 'grid' ? 'bg-white/10 text-white' : 'text-white/50'}`}><LayoutGrid size={16}/></button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {!searchQuery && (
                        <>
                            <h3 className="text-white/50 text-xs font-medium mb-4 uppercase tracking-wider">Arquivos Sugeridos</h3>
                            <div className="grid grid-cols-4 gap-4 mb-8">
                                {suggestedFiles.map((f:any) => (
                                    <div key={`sug-${f.id}`} className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl p-4 cursor-pointer transition-all">
                                        <div className="flex items-center gap-3 mb-3">
                                            {getFileIcon(f.type)}
                                            <span className="text-white text-sm font-medium truncate">{f.name}</span>
                                        </div>
                                        <div className="w-full h-24 bg-white/5 rounded-lg mb-2 overflow-hidden relative group">
                                            {f.type === 'image' ? <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: 'url(https://source.unsplash.com/random/200x200)' }}></div> : <div className="w-full h-full flex items-center justify-center text-white/20"><FileText size={32}/></div>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                    
                    <h3 className="text-white/50 text-xs font-medium mb-2 uppercase tracking-wider">{searchQuery ? 'Resultados da Pesquisa' : 'Arquivos'}</h3>
                    {filteredFiles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-white/30">
                            <Search size={48} className="mb-2 opacity-50"/>
                            <p className="text-sm">Nenhum arquivo encontrado</p>
                        </div>
                    ) : driveView === 'list' ? (
                        <div className="w-full">
                            <div className="grid grid-cols-12 text-xs text-white/40 border-b border-white/10 pb-2 mb-2 px-2"><div className="col-span-6">Nome</div><div className="col-span-3">Proprietário</div><div className="col-span-3">Data</div></div>
                            {filteredFiles.map((f:any) => (
                                <div key={f.id} className="grid grid-cols-12 items-center text-sm text-white/80 hover:bg-white/5 p-2 rounded-lg cursor-pointer group" onClick={() => toggleFileSelection(f.id)}>
                                    <div className="col-span-6 flex items-center gap-3">{getFileIcon(f.type)}<span className={`${selectedFileIds.has(f.id) ? 'text-blue-400' : ''}`}>{f.name}</span></div>
                                    <div className="col-span-3 text-white/50 text-xs">{f.owner}</div>
                                    <div className="col-span-3 text-white/50 text-xs">{f.date}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-5 gap-4">
                            {filteredFiles.map((f:any) => (
                                <div key={f.id} className={`bg-white/5 border rounded-xl p-4 cursor-pointer flex flex-col items-center text-center gap-3 transition-all ${selectedFileIds.has(f.id) ? 'border-blue-500 bg-blue-500/10' : 'border-white/5 hover:bg-white/10'}`} onClick={() => toggleFileSelection(f.id)}>
                                    <div className="p-3 bg-white/5 rounded-full">{getFileIcon(f.type)}</div>
                                    <span className="text-white text-sm truncate w-full">{f.name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
}
