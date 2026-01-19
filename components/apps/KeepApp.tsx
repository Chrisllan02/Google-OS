
import React, { useState, useEffect, useRef } from 'react';
import { Lightbulb, Square, Settings, X, Search, Plus, Image as ImageIcon, Paintbrush, MoreVertical, Archive, Trash2, Pin, Check, Clock } from 'lucide-react';
import { bridge } from '../../utils/GASBridge';

interface KeepAppProps {
  onClose: () => void;
  data: any;
  onUpdate?: (notes: any[]) => void;
}

export default function KeepApp({ onClose, data, onUpdate }: KeepAppProps) {
  const [notes, setNotes] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [selectedColor, setSelectedColor] = useState('default');
  
  // Edit State
  const [editingNote, setEditingNote] = useState<any | null>(null);
  
  const createRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      if (data?.notes) setNotes(data.notes);
  }, [data]);

  useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
          if (createRef.current && !createRef.current.contains(e.target as Node)) {
              if (isCreating) handleCreateNote();
              setIsCreating(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCreating, newTitle, newContent, selectedColor]);

  // Save edited note when clicking outside modal or closing
  const handleCloseEdit = async () => {
      if (editingNote) {
          const updatedNotes = notes.map(n => n.id === editingNote.id ? editingNote : n);
          updateParent(updatedNotes);
          await bridge.addNote(editingNote); // Re-save functionality handles update
          setEditingNote(null);
      }
  };

  const updateParent = (newNotes: any[]) => {
      setNotes(newNotes);
      if (onUpdate) onUpdate(newNotes);
  };

  const handleCreateNote = async () => {
      if (!newTitle.trim() && !newContent.trim()) {
          resetCreation();
          return;
      }

      const note = {
          id: Date.now(),
          title: newTitle,
          content: newContent,
          color: selectedColor,
          pinned: false,
          date: new Date().toISOString()
      };

      const updatedNotes = [note, ...notes];
      updateParent(updatedNotes);
      await bridge.addNote(note);
      resetCreation();
  };

  const resetCreation = () => {
      setNewTitle('');
      setNewContent('');
      setSelectedColor('default');
  };

  const deleteNote = async (id: number) => {
      const updatedNotes = notes.filter(n => n.id !== id);
      updateParent(updatedNotes);
      await bridge.deleteNote(id);
      if (editingNote && editingNote.id === id) setEditingNote(null);
  };

  const togglePin = async (e: React.MouseEvent, note: any) => {
      e.stopPropagation();
      const updatedNote = { ...note, pinned: !note.pinned };
      if (editingNote && editingNote.id === note.id) setEditingNote(updatedNote);
      
      const updatedNotes = notes.map(n => n.id === note.id ? updatedNote : n);
      updateParent(updatedNotes);
      await bridge.addNote(updatedNote); 
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
                                <button className="p-2 hover:bg-white/10 rounded-full transition-colors"><ImageIcon size={18}/></button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col">
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
                            />
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
                                    <button className="p-2 hover:bg-white/10 rounded-full transition-colors"><ImageIcon size={16}/></button>
                                </div>
                                <button onClick={() => { handleCreateNote(); setIsCreating(false); }} className="px-4 py-1.5 hover:bg-white/10 rounded text-sm font-medium transition-colors">Fechar</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* MASONRY LAYOUT */}
            {sortedNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-white/20">
                    <Lightbulb size={64} className="mb-4 opacity-20"/>
                    <p>As notas que você adicionar aparecem aqui</p>
                </div>
            ) : (
                <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
                    {sortedNotes.map((n:any) => {
                        const noteColorClass = colors[n.color || 'default'] || colors.default;
                        return (
                            <div key={n.id} onClick={() => setEditingNote(n)} className={`rounded-xl p-4 shadow-sm break-inside-avoid cursor-default group transition-all border border-transparent hover:border-white/40 relative ${noteColorClass} hover:shadow-md`}>
                                <button 
                                    onClick={(e) => togglePin(e, n)}
                                    className={`absolute top-2 right-2 p-1.5 rounded-full hover:bg-black/20 transition-opacity z-10 ${n.pinned ? 'opacity-100 text-white' : 'opacity-0 group-hover:opacity-100 text-white/50'}`}
                                >
                                    <Pin size={14} className={n.pinned ? "fill-white" : ""}/>
                                </button>
                                {n.title && <h3 className="text-white font-medium mb-2 text-base pr-6">{n.title}</h3>}
                                <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-hidden">{n.content}</p>
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
                    ref={modalRef}
                    onClick={(e) => e.stopPropagation()}
                    className={`w-full max-w-lg rounded-2xl shadow-2xl transition-all duration-300 transform scale-100 border border-white/20 ${colors[editingNote.color || 'default']?.split(' ')[0] || 'bg-[#202124]'}`}
                >
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
                            className="bg-transparent text-white text-sm leading-relaxed placeholder:text-white/50 outline-none resize-none min-h-[200px]"
                            placeholder="Nota..."
                            value={editingNote.content}
                            onChange={(e) => setEditingNote({...editingNote, content: e.target.value})}
                        />
                    </div>
                    <div className="p-2 flex items-center justify-between">
                         <div className="flex gap-1 text-white/70">
                            <div className="relative group">
                                <button className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Cor de fundo"><Paintbrush size={16}/></button>
                                <div className="absolute bottom-full left-0 mb-2 bg-[#2d2e30] p-2 rounded-lg shadow-xl grid grid-cols-4 gap-1 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-30 border border-white/10">
                                    {Object.keys(colors).map(c => (
                                        <button key={c} onClick={() => setEditingNote({...editingNote, color: c})} className={`w-6 h-6 rounded-full border border-white/20 ${colors[c].split(' ')[0]} ${editingNote.color === c ? 'ring-2 ring-white' : ''}`}></button>
                                    ))}
                                </div>
                            </div>
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
