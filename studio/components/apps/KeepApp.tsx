
import React, { useState, useEffect, useRef } from 'react';
import { Lightbulb, Square, Settings, X, Search, Plus, Image as ImageIcon, Paintbrush, MoreVertical, Archive, Trash2, Pin, Check, Tag } from 'lucide-react';
import { bridge, NoteItem } from '../../utils/GASBridge';

interface KeepAppProps {
  onClose: () => void;
  data: any;
  onUpdate?: (notes: NoteItem[]) => void;
  showToast?: (msg: string) => void;
}

// Simple Base64 Helper
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
};

export default function KeepApp({ onClose, data, onUpdate, showToast }: KeepAppProps) {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  
  // Creation State
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [selectedColor, setSelectedColor] = useState('default');
  const [newImages, setNewImages] = useState<string[]>([]); // URLs for preview
  const [newImageIds, setNewImageIds] = useState<string[]>([]); // Drive IDs
  const [newLabels, setNewLabels] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // Edit State
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  const [editInputLabel, setEditInputLabel] = useState('');
  const [showLabelInput, setShowLabelInput] = useState(false);
  
  const createRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const toast = (msg: string) => showToast && showToast(msg);

  useEffect(() => {
      if (data?.notes) setNotes(data.notes);
  }, [data]);

  // Click Outside to Save/Close Create
  useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
          if (createRef.current && !createRef.current.contains(e.target as Node)) {
              if (isCreating) handleCreateNote();
              setIsCreating(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCreating, newTitle, newContent, selectedColor, newImageIds, newLabels]);

  const updateParent = (newNotes: NoteItem[]) => {
      setNotes(newNotes);
      if (onUpdate) onUpdate(newNotes);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEditMode: boolean = false) => {
      if (!e.target.files || e.target.files.length === 0) return;
      setIsUploading(true);
      const file = e.target.files[0];
      
      try {
          const base64 = await fileToBase64(file);
          // Optimistic Preview
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = (ev) => {
             const result = ev.target?.result as string;
             if(isEditMode && editingNote) {
                 // For edit mode, we can't easily show local preview mixed with remote IDs without complex logic. 
                 // We'll trust the upload speed for now or add a temp placeholder.
             } else {
                 setNewImages(prev => [...prev, result]);
             }
          };

          const res = await bridge.uploadKeepImage(base64, file.type);
          if (res.success && res.id) {
              if (isEditMode && editingNote) {
                  setEditingNote({ ...editingNote, images: [...(editingNote.images || []), res.id!] });
              } else {
                  setNewImageIds(prev => [...prev, res.id!]);
              }
          } else {
              toast("Erro no upload da imagem");
          }
      } catch (err) {
          console.error(err);
      } finally {
          setIsUploading(false);
      }
  };

  const handleCreateNote = async () => {
      if (!newTitle.trim() && !newContent.trim() && newImageIds.length === 0) {
          resetCreation();
          return;
      }

      const note: NoteItem = {
          id: Date.now(),
          title: newTitle,
          content: newContent,
          color: selectedColor,
          pinned: false,
          date: new Date().toISOString(),
          images: newImageIds,
          labels: newLabels
      };

      const updatedNotes = [note, ...notes];
      updateParent(updatedNotes);
      await bridge.addNote(note);
      toast("Nota criada");
      resetCreation();
  };

  const resetCreation = () => {
      setNewTitle('');
      setNewContent('');
      setSelectedColor('default');
      setNewImages([]);
      setNewImageIds([]);
      setNewLabels([]);
  };

  const handleCloseEdit = async () => {
      if (editingNote) {
          const updatedNotes = notes.map(n => n.id === editingNote.id ? editingNote : n);
          updateParent(updatedNotes);
          await bridge.addNote(editingNote);
          setEditingNote(null);
      }
  };

  const deleteNote = async (id: number) => {
      const updatedNotes = notes.filter(n => n.id !== id);
      updateParent(updatedNotes);
      await bridge.deleteNote(id);
      if (editingNote && editingNote.id === id) setEditingNote(null);
      toast("Nota excluída");
  };

  const togglePin = async (e: React.MouseEvent, note: NoteItem) => {
      e.stopPropagation();
      const updatedNote = { ...note, pinned: !note.pinned };
      const updatedNotes = notes.map(n => n.id === note.id ? updatedNote : n);
      updateParent(updatedNotes);
      await bridge.addNote(updatedNote); 
      if (editingNote && editingNote.id === note.id) setEditingNote(updatedNote);
      toast(updatedNote.pinned ? "Nota fixada" : "Nota desafixada");
  };

  const handleAddLabel = (isEditMode: boolean) => {
      if (!editInputLabel.trim()) return;
      if (isEditMode && editingNote) {
          setEditingNote({ ...editingNote, labels: [...(editingNote.labels || []), editInputLabel] });
      } else {
          setNewLabels(prev => [...prev, editInputLabel]);
      }
      setEditInputLabel('');
      setShowLabelInput(false);
  };

  const removeLabel = (label: string, isEditMode: boolean) => {
      if (isEditMode && editingNote) {
          setEditingNote({ ...editingNote, labels: editingNote.labels?.filter(l => l !== label) });
      } else {
          setNewLabels(prev => prev.filter(l => l !== label));
      }
  };

  // Color Mapping
  const colors: {[key:string]: string} = {
      default: 'bg-[#202124] border-white/20',
      red: 'bg-[#5c2b29] border-transparent',
      orange: 'bg-[#614a19] border-transparent',
      yellow: 'bg-[#635d19] border-transparent',
      green: 'bg-[#345920] border-transparent',
      teal: 'bg-[#16504b] border-transparent',
      blue: 'bg-[#2d555e] border-transparent',
      darkblue: 'bg-[#1e3a5f] border-transparent',
      purple: 'bg-[#42275e] border-transparent',
      pink: 'bg-[#5b2245] border-transparent',
      brown: 'bg-[#442f19] border-transparent',
      gray: 'bg-[#3c3f43] border-transparent'
  };

  const sortedNotes = [...notes].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const NoteContent = ({ note }: { note: NoteItem }) => (
      <>
          {note.images && note.images.length > 0 && (
              <div className="mb-2 -mx-4 -mt-4 rounded-t-xl overflow-hidden relative">
                  <img 
                    src={note.images[0].startsWith('http') ? note.images[0] : `https://lh3.googleusercontent.com/d/${note.images[0]}`} 
                    className="w-full h-auto object-cover max-h-60" 
                    alt="attachment" 
                    onError={(e) => (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x200?text=Imagem+Carregando...'}
                  />
                  {note.images.length > 1 && (
                      <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-1 rounded text-xs text-white">
                          +{note.images.length - 1}
                      </div>
                  )}
              </div>
          )}
          {note.title && <h3 className="text-white font-medium mb-2 text-base pr-6 leading-tight">{note.title}</h3>}
          <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-hidden">{note.content}</p>
          {note.labels && note.labels.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                  {note.labels.map((l, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full bg-black/20 border border-white/10 text-[10px] text-white/70">{l}</span>
                  ))}
              </div>
          )}
      </>
  );

  const appHeaderClass = "h-16 px-6 flex items-center justify-between shrink-0 border-b border-white/5 backdrop-blur-xl z-20 bg-black/20";

  return (
    <div className="flex flex-col h-full bg-[#202124] text-white relative">
        {/* HEADER */}
        <div className={appHeaderClass}>
            <div className="flex items-center gap-4 w-64">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-white/10 rounded-full"><Lightbulb className="w-5 h-5 text-yellow-400"/></div>
                    <span className="text-white text-lg font-light tracking-tight">Google Keep</span>
                </div>
            </div>
            <div className="flex-1 max-w-2xl px-8 relative hidden md:block">
                <div className="bg-white/5 border border-white/10 flex items-center px-4 py-2.5 rounded-full focus-within:bg-white/10 transition-colors">
                    <Search className="text-white/40" size={18} />
                    <input type="text" placeholder="Pesquisar" className="bg-transparent border-none outline-none ml-3 w-full text-white placeholder:text-white/30 text-sm" />
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

        <div className="flex-1 p-8 overflow-y-auto custom-scrollbar relative z-10">
            
            {/* CREATE NOTE INPUT */}
            <div className="max-w-[600px] mx-auto mb-10 relative z-20" ref={createRef}>
                <div className={`bg-[#202124] rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.5)] transition-all duration-200 border ${isCreating ? 'border-white/20' : 'border-white/10'}`} style={{ backgroundColor: selectedColor !== 'default' ? colors[selectedColor].split(' ')[0].replace('bg-', '') : '' }}>
                    {!isCreating ? (
                        <div className="flex items-center justify-between p-3 cursor-text" onClick={() => setIsCreating(true)}>
                            <span className="text-white/70 font-medium ml-2">Criar uma nota...</span>
                            <div className="flex gap-2 text-white/50">
                                <button className="p-2 hover:bg-white/10 rounded-full transition-colors"><Square size={18}/></button>
                                <button className="p-2 hover:bg-white/10 rounded-full transition-colors"><Paintbrush size={18}/></button>
                                <button className="p-2 hover:bg-white/10 rounded-full transition-colors" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}><ImageIcon size={18}/></button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {newImages.map((img, i) => (
                                <img key={i} src={img} className="w-full h-auto rounded-t-xl" alt="Preview" />
                            ))}
                            {isUploading && <div className="p-2 text-xs text-center text-white/50 animate-pulse">Carregando imagem...</div>}
                            
                            <input 
                                type="text" 
                                placeholder="Título" 
                                className="bg-transparent text-white placeholder:text-white/50 font-medium px-4 pt-4 pb-2 outline-none text-base"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                autoFocus
                            />
                            <textarea 
                                placeholder="Criar uma nota..." 
                                className="bg-transparent text-white placeholder:text-white/50 px-4 py-2 outline-none text-sm resize-none min-h-[100px]"
                                value={newContent}
                                onChange={(e) => setNewContent(e.target.value)}
                                onPaste={(e) => {
                                    if (e.clipboardData.files.length > 0) {
                                        e.preventDefault();
                                        // Handle paste image logic if needed
                                    }
                                }}
                            />
                            {/* Create Labels */}
                            <div className="flex flex-wrap gap-2 px-4 pb-2">
                                {newLabels.map((l, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-black/20 rounded-full text-xs flex items-center gap-1">
                                        {l} <X size={10} className="cursor-pointer" onClick={() => removeLabel(l, false)}/>
                                    </span>
                                ))}
                                {showLabelInput && (
                                    <div className="flex items-center gap-1 bg-black/20 rounded-full px-2">
                                        <input 
                                            autoFocus 
                                            className="bg-transparent border-none outline-none text-xs text-white w-20 py-0.5"
                                            value={editInputLabel} 
                                            onChange={(e) => setEditInputLabel(e.target.value)} 
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddLabel(false)}
                                            onBlur={() => setShowLabelInput(false)}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-between p-2">
                                <div className="flex gap-1 text-white/70">
                                    <div className="relative group">
                                        <button className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Cor de fundo"><Paintbrush size={16}/></button>
                                        <div className="absolute top-full left-0 mt-2 bg-[#2d2e30] p-2 rounded-lg shadow-xl grid grid-cols-4 gap-1 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-30 border border-white/10">
                                            {Object.keys(colors).map(c => (
                                                <button key={c} onClick={() => setSelectedColor(c)} className={`w-6 h-6 rounded-full border border-white/20 ${colors[c].split(' ')[0]} ${selectedColor === c ? 'ring-2 ring-white' : ''}`}></button>
                                            ))}
                                        </div>
                                    </div>
                                    <button className="p-2 hover:bg-white/10 rounded-full transition-colors" onClick={() => fileInputRef.current?.click()}><ImageIcon size={16}/></button>
                                    <button className="p-2 hover:bg-white/10 rounded-full transition-colors" onClick={() => setShowLabelInput(true)}><Tag size={16}/></button>
                                    <button className="p-2 hover:bg-white/10 rounded-full transition-colors"><MoreVertical size={16}/></button>
                                </div>
                                <button onClick={() => { handleCreateNote(); setIsCreating(false); }} className="px-4 py-1.5 hover:bg-white/10 rounded text-sm font-medium transition-colors">Fechar</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, false)} />
            <input type="file" ref={editFileInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, true)} />

            {/* MASONRY LAYOUT */}
            {sortedNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-white/20">
                    <Lightbulb size={64} className="mb-4 opacity-20"/>
                    <p>As notas que você adicionar aparecem aqui</p>
                </div>
            ) : (
                <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
                    {sortedNotes.map((n: NoteItem) => {
                        const noteColorClass = colors[n.color || 'default'] || colors.default;
                        return (
                            <div key={n.id} onClick={() => setEditingNote(n)} className={`rounded-xl p-4 shadow-sm break-inside-avoid cursor-default group transition-all border border-transparent hover:border-white/40 relative ${noteColorClass} hover:shadow-md`}>
                                <button 
                                    onClick={(e) => togglePin(e, n)}
                                    className={`absolute top-2 right-2 p-1.5 rounded-full hover:bg-black/20 transition-opacity z-10 ${n.pinned ? 'opacity-100 text-white' : 'opacity-0 group-hover:opacity-100 text-white/50'}`}
                                >
                                    <Pin size={14} className={n.pinned ? "fill-white" : ""}/>
                                </button>
                                <NoteContent note={n} />
                                <div className="mt-4 pt-2 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="flex gap-1 text-white/70">
                                        <button className="p-1.5 hover:bg-white/10 rounded-full transition-colors" title="Arquivar" onClick={(e) => e.stopPropagation()}><Archive size={14}/></button>
                                        <button className="p-1.5 hover:bg-white/10 rounded-full transition-colors" title="Excluir" onClick={(e) => { e.stopPropagation(); deleteNote(n.id); }}><Trash2 size={14}/></button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>

        {/* EDIT MODAL */}
        {editingNote && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={handleCloseEdit}>
                <div 
                    onClick={(e) => e.stopPropagation()}
                    className={`w-full max-w-lg rounded-2xl shadow-2xl transition-all duration-300 transform scale-100 border border-white/20 flex flex-col max-h-[90vh] overflow-hidden ${colors[editingNote.color || 'default']?.split(' ')[0] || 'bg-[#202124]'}`}
                >
                    <div className="overflow-y-auto custom-scrollbar">
                        {editingNote.images && editingNote.images.map((img, i) => (
                             <img key={i} src={img.startsWith('http') ? img : `https://lh3.googleusercontent.com/d/${img}`} className="w-full h-auto" alt="attachment" />
                        ))}
                        {isUploading && <div className="p-4 text-center text-xs text-white/50 animate-pulse">Carregando imagem...</div>}

                        <div className="p-4 flex flex-col gap-2">
                            <div className="flex items-start justify-between">
                                <input 
                                    type="text" 
                                    className="bg-transparent text-white text-xl font-medium placeholder:text-white/50 outline-none flex-1"
                                    placeholder="Título"
                                    value={editingNote.title}
                                    onChange={(e) => setEditingNote({...editingNote, title: e.target.value})}
                                />
                                <button 
                                    onClick={(e) => togglePin(e, editingNote)}
                                    className={`p-2 rounded-full hover:bg-black/10 transition-colors ${editingNote.pinned ? 'text-white' : 'text-white/50'}`}
                                >
                                    <Pin size={20} className={editingNote.pinned ? "fill-white" : ""}/>
                                </button>
                            </div>
                            <textarea 
                                className="bg-transparent text-white text-sm leading-relaxed placeholder:text-white/50 outline-none resize-none min-h-[150px]"
                                placeholder="Nota..."
                                value={editingNote.content}
                                onChange={(e) => setEditingNote({...editingNote, content: e.target.value})}
                            />
                            {/* Edit Labels */}
                            <div className="flex flex-wrap gap-2 mt-2">
                                {editingNote.labels?.map((l, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-black/20 rounded-full text-xs flex items-center gap-1">
                                        {l} <X size={10} className="cursor-pointer" onClick={() => removeLabel(l, true)}/>
                                    </span>
                                ))}
                                {showLabelInput && (
                                    <div className="flex items-center gap-1 bg-black/20 rounded-full px-2">
                                        <input 
                                            autoFocus 
                                            className="bg-transparent border-none outline-none text-xs text-white w-20 py-0.5"
                                            value={editInputLabel} 
                                            onChange={(e) => setEditInputLabel(e.target.value)} 
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddLabel(true)}
                                            onBlur={() => setShowLabelInput(false)}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="p-2 flex items-center justify-between shrink-0">
                         <div className="flex gap-1 text-white/70">
                            <div className="relative group">
                                <button className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Cor de fundo"><Paintbrush size={16}/></button>
                                <div className="absolute bottom-full left-0 mb-2 bg-[#2d2e30] p-2 rounded-lg shadow-xl grid grid-cols-4 gap-1 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-30 border border-white/10">
                                    {Object.keys(colors).map(c => (
                                        <button key={c} onClick={() => setEditingNote({...editingNote, color: c})} className={`w-6 h-6 rounded-full border border-white/20 ${colors[c].split(' ')[0]} ${editingNote.color === c ? 'ring-2 ring-white' : ''}`}></button>
                                    ))}
                                </div>
                            </div>
                            <button className="p-2 hover:bg-white/10 rounded-full transition-colors" onClick={() => editFileInputRef.current?.click()}><ImageIcon size={16}/></button>
                            <button className="p-2 hover:bg-white/10 rounded-full transition-colors" onClick={() => setShowLabelInput(true)}><Tag size={16}/></button>
                            <button onClick={() => deleteNote(editingNote.id)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><Trash2 size={16}/></button>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-[10px] text-white/40">Editado {new Date(editingNote.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            <button onClick={handleCloseEdit} className="px-6 py-2 rounded text-sm font-medium hover:bg-white/10 transition-colors">Fechar</button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}
