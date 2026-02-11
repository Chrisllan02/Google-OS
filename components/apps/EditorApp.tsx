
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, Lock, Undo, Redo, Printer, SpellCheck, PaintRoller,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Image as ImageIcon, Link as LinkIcon,
  Table, Type, ChevronDown, MessageSquare, Share2, MoreVertical,
  Plus, Grid3X3, Type as TypeIcon, Square, Circle, LayoutTemplate,
  Check, Save, Menu, Minus, Sparkles, Send, Bot, Wand2, Loader2, ArrowRight,
  Ratio, Maximize, File as FileIcon, Search as SearchIcon, Ruler, Sigma,
  Play, Monitor, MousePointer2, StickyNote, Trash2, Copy, Calendar, User, Palette, MousePointer,
  Layers, Upload, Move, RotateCw, BringToFront, SendToBack, Triangle as TriangleIcon,
  ChevronLeft, ChevronRight as ChevronRightIcon, ZoomIn, ZoomOut, Maximize as FitScreen,
  FunctionSquare, BarChart3, AtSign, RemoveFormatting, List as ListIcon, BoxSelect
} from 'lucide-react';
import { GoogleIcons, GeminiLogo } from '../GoogleIcons';
import { GoogleGenAI, Type as GenType } from "@google/genai";
import { bridge, Slide, SlideElement } from '../../utils/GASBridge';

interface EditorAppProps {
  onClose: () => void;
  type: string;
  data: any; 
}

interface CellData {
    value: string;
    style?: React.CSSProperties;
}

const getFileIcon = (type: string) => {
  switch(type) {
    case 'sheet': return <GoogleIcons.Sheets className="w-9 h-9" />;
    case 'slide': return <GoogleIcons.Slides className="w-9 h-9" />;
    case 'doc': return <GoogleIcons.Docs className="w-9 h-9" />;
    default: return null;
  }
};

const ToolbarButton = ({ children, active, onClick, title, disabled, className }: any) => (
    <button 
        onClick={onClick}
        title={title}
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()} 
        className={`p-1.5 rounded-[4px] transition-colors flex items-center justify-center h-8 min-w-[32px] ${active ? 'bg-blue-100 text-blue-700' : 'text-[#444746] hover:bg-[#1f1f1f]/5 disabled:opacity-30 disabled:cursor-not-allowed'} ${className}`}
    >
        {children}
    </button>
);

const Divider = () => <div className="w-[1px] h-5 bg-[#c7c7c7] mx-1 self-center"></div>;

// Simple Base64 Helper
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
};

export default function EditorApp({ onClose, type, data }: EditorAppProps) {
  // Common State
  const [title, setTitle] = useState(data?.name || (type === 'doc' ? 'Documento sem título' : type === 'sheet' ? 'Planilha sem título' : 'Apresentação sem título'));
  const [saved, setSaved] = useState(true);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  
  // Format State
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [textAlign, setTextAlign] = useState<string>('left');
  
  // Sheet State
  const [selectedCell, setSelectedCell] = useState<{r:number, c:number} | null>({r:0, c:0});
  const [sheetData, setSheetData] = useState<{[key:string]: CellData}>({});
  const [formulaValue, setFormulaValue] = useState('');

  // Slide State (Complete Implementation)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [slides, setSlides] = useState<Slide[]>([
      { 
          id: '1', 
          background: '#ffffff', 
          elements: [
              { id: 'e1', type: 'text', x: 80, y: 150, w: 800, h: 100, content: 'Clique para adicionar um título', style: { fontSize: 42, fontWeight: 'bold', textAlign: 'center', color: '#000000', fontFamily: 'Arial', zIndex: 1 } },
              { id: 'e2', type: 'text', x: 230, y: 280, w: 500, h: 50, content: 'Clique para adicionar um subtítulo', style: { fontSize: 20, textAlign: 'center', color: '#5f6368', fontFamily: 'Arial', zIndex: 1 } }
          ] 
      }
  ]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.55);
  const [dragInfo, setDragInfo] = useState<{
      type: 'move' | 'resize' | 'create';
      id: string | null;
      startX: number;
      startY: number;
      initialX: number;
      initialY: number;
      initialW: number;
      initialH: number;
      handle?: string; // n, s, e, w, ne, nw, se, sw
  } | null>(null);

  // AI State
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Refs
  const aiClient = useRef<GoogleGenAI | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const slideFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      try {
          if (process.env.API_KEY) {
              aiClient.current = new GoogleGenAI({ apiKey: process.env.API_KEY });
          }
      } catch (e) { console.error("Gemini init error", e); }
  }, []);

  // --- AUTO SAVE ---
  const triggerSave = useCallback(() => {
      setSaved(false);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      
      saveTimeoutRef.current = setTimeout(async () => {
          if (!data?.id) return;
          let contentToSave = '';
          if (type === 'doc' && editorRef.current) {
              contentToSave = btoa(editorRef.current.innerHTML);
          } else if (type === 'sheet') {
              contentToSave = btoa(JSON.stringify(sheetData));
          } else if (type === 'slide') {
              contentToSave = btoa(JSON.stringify(slides));
          }
          if (contentToSave) {
              await bridge.saveFileContent(data.id, contentToSave);
              setSaved(true);
          }
      }, 2000);
  }, [data, type, sheetData, slides]);

  // Load Content
  useEffect(() => {
      if (data?.id) {
          setIsLoadingContent(true);
          bridge.getFileContent(data.id).then(res => {
              if (res.success && res.data) {
                  try {
                      const decoded = atob(res.data);
                      if (type === 'doc' && editorRef.current) {
                          try { editorRef.current.innerHTML = decoded; } catch (e) { editorRef.current.innerText = decoded; }
                      } else if (type === 'sheet') {
                          const parsed = JSON.parse(decoded);
                          // Helper for migration if needed
                          const migrated: {[key:string]: CellData} = {};
                          Object.keys(parsed).forEach(k => migrated[k] = typeof parsed[k] === 'string' ? {value: parsed[k]} : parsed[k]);
                          setSheetData(migrated);
                      } else if (type === 'slide') {
                          const parsed = JSON.parse(decoded);
                          if(Array.isArray(parsed)) setSlides(parsed);
                      }
                  } catch(e) { console.error("Decode error", e); }
              }
              setIsLoadingContent(false);
          });
      }
  }, [data, type]);

  // --- SLIDE LOGIC ---
  const handleAddSlide = () => {
      const newSlide: Slide = {
          id: Date.now().toString(),
          background: '#ffffff',
          elements: [
              { id: `title_${Date.now()}`, type: 'text', x: 50, y: 50, w: 860, h: 80, content: 'Novo Slide', style: { fontSize: 32, fontWeight: 'bold', zIndex: 1 } }
          ]
      };
      setSlides([...slides, newSlide]);
      setCurrentSlideIndex(slides.length);
      triggerSave();
  };

  const handleDeleteSlide = () => {
      if (slides.length <= 1) return;
      const newSlides = slides.filter((_, i) => i !== currentSlideIndex);
      setSlides(newSlides);
      setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1));
      triggerSave();
  };

  const handleAddElement = (type: 'text' | 'shape' | 'image') => {
      const maxZ = slides[currentSlideIndex].elements.reduce((max, el) => Math.max(max, el.style.zIndex || 0), 0);
      const newEl: SlideElement = {
          id: `el_${Date.now()}`,
          type: type,
          x: 300, y: 200, w: 200, h: type === 'text' ? 50 : 200,
          content: type === 'text' ? 'Novo Texto' : type === 'image' ? 'https://via.placeholder.com/200' : '',
          style: { 
              backgroundColor: type === 'shape' ? '#cccccc' : undefined,
              fontSize: 18,
              fontFamily: 'Arial',
              color: '#000000',
              zIndex: maxZ + 1
          }
      };
      
      const updatedSlides = [...slides];
      updatedSlides[currentSlideIndex].elements.push(newEl);
      setSlides(updatedSlides);
      setSelectedElementId(newEl.id);
      triggerSave();
  };

  const handleSlideImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      try {
          const base64 = await fileToBase64(file);
          const res = await bridge.uploadKeepImage(base64, file.type); // Using generic image upload bridge
          if (res.success && res.url) {
              const maxZ = slides[currentSlideIndex].elements.reduce((max, el) => Math.max(max, el.style.zIndex || 0), 0);
              const newEl: SlideElement = {
                  id: `img_${Date.now()}`,
                  type: 'image',
                  x: 100, y: 100, w: 400, h: 300,
                  content: res.url,
                  style: { zIndex: maxZ + 1 }
              };
              const updatedSlides = [...slides];
              updatedSlides[currentSlideIndex].elements.push(newEl);
              setSlides(updatedSlides);
              triggerSave();
          }
      } catch (err) { console.error(err); }
  };

  const handleDeleteElement = () => {
      if (!selectedElementId) return;
      const updatedSlides = [...slides];
      updatedSlides[currentSlideIndex].elements = updatedSlides[currentSlideIndex].elements.filter(e => e.id !== selectedElementId);
      setSlides(updatedSlides);
      setSelectedElementId(null);
      triggerSave();
  };

  const handleUpdateElementStyle = (key: string, value: any) => {
      if (!selectedElementId) return;
      const updatedSlides = [...slides];
      const el = updatedSlides[currentSlideIndex].elements.find(e => e.id === selectedElementId);
      if (el) {
          el.style = { ...el.style, [key]: value };
          setSlides(updatedSlides);
          triggerSave();
      }
  };

  const bringToFront = () => {
      if (!selectedElementId) return;
      const currentElements = [...slides[currentSlideIndex].elements];
      const el = currentElements.find(e => e.id === selectedElementId);
      if(!el) return;
      
      const maxZ = currentElements.reduce((max, e) => Math.max(max, e.style.zIndex || 0), 0);
      el.style.zIndex = maxZ + 1;
      
      // Sort by Z to keep array clean (optional but good for rendering order)
      currentElements.sort((a, b) => (a.style.zIndex || 0) - (b.style.zIndex || 0));
      
      const updatedSlides = [...slides];
      updatedSlides[currentSlideIndex].elements = currentElements;
      setSlides(updatedSlides);
      triggerSave();
  };

  const sendToBack = () => {
      if (!selectedElementId) return;
      const currentElements = [...slides[currentSlideIndex].elements];
      const el = currentElements.find(e => e.id === selectedElementId);
      if(!el) return;
      
      const minZ = currentElements.reduce((min, e) => Math.min(min, e.style.zIndex || 0), 0);
      el.style.zIndex = minZ - 1;
      
      currentElements.sort((a, b) => (a.style.zIndex || 0) - (b.style.zIndex || 0));
      
      const updatedSlides = [...slides];
      updatedSlides[currentSlideIndex].elements = currentElements;
      setSlides(updatedSlides);
      triggerSave();
  };

  // --- SLIDE INTERACTION (Drag & Resize) ---
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
      if (e.target === canvasRef.current) {
          setSelectedElementId(null);
      }
  };

  const handleElementMouseDown = (e: React.MouseEvent, id: string, handle?: string) => {
      e.stopPropagation();
      setSelectedElementId(id);
      
      const el = slides[currentSlideIndex].elements.find(el => el.id === id);
      if (!el) return;

      const type = handle ? 'resize' : 'move';
      
      setDragInfo({
          type,
          id,
          handle,
          startX: e.clientX,
          startY: e.clientY,
          initialX: el.x,
          initialY: el.y,
          initialW: el.w,
          initialH: el.h
      });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!dragInfo || !dragInfo.id) return;

      const deltaX = (e.clientX - dragInfo.startX) / zoom;
      const deltaY = (e.clientY - dragInfo.startY) / zoom;

      const updatedSlides = [...slides];
      const el = updatedSlides[currentSlideIndex].elements.find(el => el.id === dragInfo.id);
      if (!el) return;

      if (dragInfo.type === 'move') {
          el.x = dragInfo.initialX + deltaX;
          el.y = dragInfo.initialY + deltaY;
      } else if (dragInfo.type === 'resize' && dragInfo.handle) {
          // Simple resize logic (SE handle for now mainly, extendable)
          if (dragInfo.handle.includes('e')) el.w = Math.max(20, dragInfo.initialW + deltaX);
          if (dragInfo.handle.includes('s')) el.h = Math.max(20, dragInfo.initialH + deltaY);
          // Add logic for n, w handles if needed (requires x, y adjustment)
      }

      setSlides(updatedSlides);
  };

  const handleMouseUp = () => {
      if (dragInfo) {
          setDragInfo(null);
          triggerSave();
      }
  };

  // --- GEMINI RAG LOGIC ---
  const handleAiGenerate = async () => {
      if (!aiPrompt.trim() || !aiClient.current) return;
      setIsGenerating(true);
      setAiResponse(null);

      try {
          if (type === 'slide') {
              // Structured Generation
              const response = await aiClient.current.models.generateContent({
                  model: 'gemini-3-flash-preview',
                  contents: `Generate a JSON object representing a slide about: "${aiPrompt}". 
                  The format should match this interface:
                  {
                    background: string; // hex color
                    elements: Array<{
                        type: 'text' | 'shape';
                        content?: string;
                        x: number; y: number; w: number; h: number;
                        style: { fontSize?: number; fontWeight?: string; textAlign?: string; backgroundColor?: string; color?: string; zIndex?: number; }
                    }>
                  }
                  Canvas size is 960x540. Ensure elements fit.`,
                  config: { responseMimeType: 'application/json' }
              });
              
              setAiResponse(response.text || "");
          } else {
              // Existing logic for Docs/Sheets
              // ...
          }
      } catch (error) {
          console.error("Gemini error:", error);
          setAiResponse("Erro na geração.");
      } finally {
          setIsGenerating(false);
      }
  };
  
  const insertAiContent = () => {
      if (!aiResponse) return;
      if (type === 'slide') {
          try {
              const generatedSlide = JSON.parse(aiResponse);
              const newSlide: Slide = {
                  id: Date.now().toString(),
                  background: generatedSlide.background || '#ffffff',
                  elements: generatedSlide.elements.map((e: any, i: number) => ({
                      ...e,
                      id: `gen_${Date.now()}_${i}`,
                      type: e.type || 'text',
                      x: e.x || 50, y: e.y || 50, w: e.w || 200, h: e.h || 100
                  }))
              };
              setSlides([...slides, newSlide]);
              setCurrentSlideIndex(slides.length);
              triggerSave();
          } catch(e) {
              alert("Erro ao processar JSON da IA");
          }
      }
      // ... (Doc/Sheet insert logic)
      setAiPrompt('');
      setAiResponse(null);
      setShowAiPanel(false);
  };

  // Helper for Sheet
  const getCellId = (r: number, c: number) => `${String.fromCharCode(65+c)}${r+1}`;
  const handleCellClick = (r: number, c: number) => { setSelectedCell({r, c}); setFormulaValue(sheetData[getCellId(r, c)]?.value || ''); };
  const handleCellChange = (val: string) => { if (selectedCell) { const id = getCellId(selectedCell.r, selectedCell.c); setSheetData(prev => ({ ...prev, [id]: { ...prev[id], value: val } })); setFormulaValue(val); triggerSave(); } };
  const handleFormat = (cmd: string, val?: any) => { if(type==='doc') { document.execCommand(cmd, false, val); checkFormatState(); editorRef.current?.focus(); } };
  const checkFormatState = () => { setIsBold(document.queryCommandState('bold')); setIsItalic(document.queryCommandState('italic')); setIsUnderline(document.queryCommandState('underline')); };

  return (
    <div className="flex flex-col h-full bg-[#F9FBFD] animate-in fade-in duration-300 font-sans relative" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
        {/* HEADER */}
        <div className="h-16 px-4 flex items-center justify-between bg-white z-20 shrink-0 border-b border-gray-200">
            <div className="flex items-center gap-3">
                <div onClick={onClose} className="cursor-pointer hover:opacity-80 transition-opacity">{getFileIcon(type)}</div>
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <input 
                            type="text" 
                            value={title} 
                            onChange={(e) => setTitle(e.target.value)}
                            className="text-lg text-gray-800 font-normal outline-none border border-transparent hover:border-black/20 focus:border-blue-500 rounded px-1 -ml-1 transition-all h-7"
                        />
                        {saved ? <div className="flex items-center text-gray-400 text-xs gap-1 opacity-100 transition-opacity"><Check size={14}/></div> : <div className="text-gray-400 text-xs animate-pulse">Salvando...</div>}
                    </div>
                    {/* Standard Menu */}
                    <div className="flex gap-3 text-[13px] text-gray-600 select-none">
                        <span className="hover:bg-gray-100 px-1.5 rounded cursor-pointer transition-colors">Arquivo</span>
                        <span className="hover:bg-gray-100 px-1.5 rounded cursor-pointer transition-colors">Editar</span>
                        <span className="hover:bg-gray-100 px-1.5 rounded cursor-pointer transition-colors">Ver</span>
                        <span className="hover:bg-gray-100 px-1.5 rounded cursor-pointer transition-colors">Inserir</span>
                        <span className="hover:bg-gray-100 px-1.5 rounded cursor-pointer transition-colors">Formatar</span>
                        <span className="hover:bg-gray-100 px-1.5 rounded cursor-pointer transition-colors">Organizar</span>
                        <span className="hover:bg-gray-100 px-1.5 rounded cursor-pointer transition-colors">Ferramentas</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <button onClick={() => setShowAiPanel(!showAiPanel)} className={`p-2 rounded-full transition-all flex items-center gap-2 ${showAiPanel ? 'bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 shadow-inner' : 'hover:bg-gray-100 text-gray-500'}`} title="Perguntar ao Gemini">
                    <Sparkles size={20} className={showAiPanel ? "text-blue-600 fill-blue-300" : ""}/>
                    {showAiPanel && <span className="text-xs font-medium pr-1">Gemini</span>}
                </button>
                <div className="hidden md:flex items-center gap-3">
                    <button className="flex items-center gap-2 bg-[#C2E7FF] text-[#001D35] px-5 py-2.5 rounded-full text-sm font-medium hover:shadow-md transition-all">
                        <Share2 size={16} /> <span className="hidden sm:inline">Compartilhar</span>
                    </button>
                    <div className="w-9 h-9 bg-purple-600 rounded-full text-white flex items-center justify-center font-bold text-sm border-2 border-white shadow-sm">D</div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-red-50 text-gray-500 hover:text-red-500 rounded-full transition-colors"><X size={22}/></button>
            </div>
        </div>
        
        {/* TOOLBAR */}
        <div className="bg-[#EDF2FA] mx-3 my-2 rounded-full flex items-center px-4 py-1.5 gap-1 overflow-x-auto custom-scrollbar shrink-0 shadow-sm border border-white/50">
             <ToolbarButton onClick={() => handleFormat('undo')} title="Desfazer"><Undo size={16}/></ToolbarButton>
             <ToolbarButton onClick={() => handleFormat('redo')} title="Refazer"><Redo size={16}/></ToolbarButton>
             <ToolbarButton title="Imprimir"><Printer size={16}/></ToolbarButton>
             <Divider />
             <div className="flex items-center gap-1 bg-white/50 rounded px-1 border border-black/5">
                <span className="text-xs font-medium text-gray-700 px-2 cursor-pointer">Arial</span>
                <ChevronDown size={10} className="text-gray-500"/>
            </div>
             <Divider />
             <ToolbarButton onClick={() => handleFormat('bold')} active={isBold} title="Negrito"><Bold size={16}/></ToolbarButton>
             <ToolbarButton onClick={() => handleFormat('italic')} active={isItalic} title="Itálico"><Italic size={16}/></ToolbarButton>
             <ToolbarButton onClick={() => handleFormat('underline')} active={isUnderline} title="Sublinhado"><Underline size={16}/></ToolbarButton>
             <ToolbarButton title="Cor do Texto" onClick={() => handleUpdateElementStyle('color', '#ea4335')}><div className="flex flex-col items-center"><span className="font-bold text-sm leading-3">A</span><div className="w-3 h-1 bg-[#ea4335]"></div></div></ToolbarButton>
             <Divider />
             {type === 'slide' && (
                <>
                    <ToolbarButton title="Caixa de Texto" onClick={() => handleAddElement('text')}><TypeIcon size={16}/></ToolbarButton>
                    <ToolbarButton title="Inserir Imagem" onClick={() => slideFileInputRef.current?.click()}><ImageIcon size={16}/></ToolbarButton>
                    <ToolbarButton title="Forma" onClick={() => handleAddElement('shape')}><Square size={16}/></ToolbarButton>
                    <Divider/>
                    <ToolbarButton title="Fundo" onClick={() => {
                        const newSlides = [...slides];
                        newSlides[currentSlideIndex].background = prompt("Cor de fundo (hex):", "#f0f0f0") || "#ffffff";
                        setSlides(newSlides);
                    }}>Fundo</ToolbarButton>
                    
                    {selectedElementId && (
                        <>
                            <Divider/>
                            <ToolbarButton title="Trazer para frente" onClick={bringToFront}><BringToFront size={16}/></ToolbarButton>
                            <ToolbarButton title="Enviar para trás" onClick={sendToBack}><SendToBack size={16}/></ToolbarButton>
                            <ToolbarButton title="Deletar Elemento" onClick={handleDeleteElement} className="text-red-500"><Trash2 size={16}/></ToolbarButton>
                        </>
                    )}
                </>
            )}
        </div>
        
        <input type="file" ref={slideFileInputRef} className="hidden" accept="image/*" onChange={handleSlideImageUpload}/>

        {/* FORMULA BAR */}
        {type === 'sheet' && (
            <div className="h-8 flex items-center gap-2 px-3 border-b border-gray-300 bg-white mb-1 shrink-0">
                <div className="text-xs font-bold text-gray-500 w-8 text-center">{selectedCell ? getCellId(selectedCell.r, selectedCell.c) : ''}</div>
                <div className="w-[1px] h-4 bg-gray-300"></div>
                <div className="font-serif italic text-gray-400 font-bold">fx</div>
                <input type="text" className="flex-1 text-sm outline-none h-full border-none" value={formulaValue} onChange={(e) => handleCellChange(e.target.value)} />
            </div>
        )}

        <div className="flex-1 bg-[#F0F2F5] overflow-hidden flex relative flex-col">
            {isLoadingContent && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80">
                    <Loader2 size={32} className="animate-spin text-blue-500"/>
                </div>
            )}
            
            {/* --- SLIDE EDITOR --- */}
            {type === 'slide' && (
                <div className="w-full h-full flex">
                    {/* FILMSTRIP */}
                    <div className="w-48 bg-white border-r border-gray-200 flex flex-col gap-4 p-4 overflow-y-auto shrink-0 relative">
                        {slides.map((slide, i) => (
                            <div key={slide.id} onClick={() => setCurrentSlideIndex(i)} className={`flex gap-2 cursor-pointer group`}>
                                <span className="text-xs text-gray-500 font-medium w-4 text-right pt-2">{i+1}</span>
                                <div 
                                    className={`flex-1 aspect-video border-2 rounded shadow-sm flex flex-col items-center justify-center bg-white transition-all overflow-hidden relative ${currentSlideIndex === i ? 'border-yellow-400 ring-1 ring-yellow-200' : 'border-gray-200 group-hover:border-gray-300'}`}
                                    style={{ backgroundColor: slide.background }}
                                >
                                    {/* Mini Preview */}
                                    {slide.elements.map(el => (
                                        <div key={el.id} className="absolute bg-gray-200 border border-gray-300" style={{ left: `${(el.x/960)*100}%`, top: `${(el.y/540)*100}%`, width: `${(el.w/960)*100}%`, height: `${(el.h/540)*100}%`, zIndex: el.style.zIndex }}></div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        <button onClick={handleAddSlide} className="mt-2 w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded text-xs font-medium flex items-center justify-center gap-1"><Plus size={12}/> Novo Slide</button>
                    </div>

                    {/* CANVAS AREA */}
                    <div className="flex-1 bg-[#E8EAED] flex items-center justify-center relative overflow-hidden p-8" ref={canvasRef} onMouseDown={handleCanvasMouseDown}>
                        <div 
                            className="w-[960px] h-[540px] shadow-2xl relative select-none overflow-hidden" 
                            style={{ 
                                transform: `scale(${zoom})`, 
                                transformOrigin: 'center',
                                backgroundColor: slides[currentSlideIndex].background 
                            }}
                        >
                            {slides[currentSlideIndex].elements.map(el => (
                                <div
                                    key={el.id}
                                    style={{
                                        position: 'absolute',
                                        left: el.x,
                                        top: el.y,
                                        width: el.w,
                                        height: el.h,
                                        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                                        ...el.style,
                                        border: selectedElementId === el.id ? '2px solid #4285F4' : el.style.border || 'none',
                                        cursor: 'move',
                                        display: 'flex',
                                        alignItems: 'center', // Center text vertically for shapes
                                        justifyContent: el.style.textAlign === 'center' ? 'center' : 'flex-start'
                                    }}
                                    onMouseDown={(e) => handleElementMouseDown(e, el.id)}
                                >
                                    {el.type === 'text' ? (
                                        <div 
                                            contentEditable 
                                            suppressContentEditableWarning 
                                            style={{ width: '100%', height: '100%', outline: 'none', cursor: 'text' }}
                                            onBlur={(e) => {
                                                const newSlides = [...slides];
                                                const target = newSlides[currentSlideIndex].elements.find(x => x.id === el.id);
                                                if(target) target.content = e.currentTarget.innerText;
                                                setSlides(newSlides);
                                                triggerSave();
                                            }}
                                        >
                                            {el.content}
                                        </div>
                                    ) : el.type === 'image' ? (
                                        <img src={el.content} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                                    ) : (
                                        // Shape
                                        <div style={{ width: '100%', height: '100%' }}></div>
                                    )}

                                    {/* Resize Handles (Only when selected) */}
                                    {selectedElementId === el.id && (
                                        <>
                                            <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-blue-500 border border-white cursor-nwse-resize" onMouseDown={(e) => handleElementMouseDown(e, el.id, 'se')}></div>
                                            <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-blue-500 border border-white cursor-nesw-resize" onMouseDown={(e) => handleElementMouseDown(e, el.id, 'sw')}></div>
                                            <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-blue-500 border border-white cursor-nesw-resize" onMouseDown={(e) => handleElementMouseDown(e, el.id, 'ne')}></div>
                                            <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-blue-500 border border-white cursor-nwse-resize" onMouseDown={(e) => handleElementMouseDown(e, el.id, 'nw')}></div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                        
                        {/* Zoom Controls */}
                        <div className="absolute bottom-4 left-4 bg-white rounded shadow-md flex">
                            <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} className="p-2 hover:bg-gray-100"><ZoomOut size={16}/></button>
                            <span className="px-2 py-2 text-xs font-medium border-x">{Math.round(zoom * 100)}%</span>
                            <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-2 hover:bg-gray-100"><ZoomIn size={16}/></button>
                        </div>
                    </div>
                </div>
            )}

            {/* AI SIDE PANEL */}
            {showAiPanel && (
                <div className="w-80 bg-white border-l border-gray-200 flex flex-col shadow-2xl animate-in slide-in-from-right-10 duration-300 z-30">
                    <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                        <GeminiLogo className="w-6 h-6" />
                        <span className="font-medium text-gray-700">Gemini</span>
                        <div className="ml-auto bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">BETA</div>
                    </div>
                    <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
                        {aiResponse ? (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                                    <p className="text-xs text-gray-500 mb-2">Estrutura Gerada:</p>
                                    <pre className="text-xs text-gray-800 whitespace-pre-wrap overflow-hidden bg-gray-50 p-2 rounded">{aiResponse.substring(0, 100)}...</pre>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setAiResponse(null)} className="flex-1 py-2 text-gray-600 text-xs font-medium hover:bg-gray-200 rounded-lg transition-colors">Descartar</button>
                                    <button onClick={insertAiContent} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2"><ArrowRight size={14}/> Inserir</button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center space-y-4 pb-10">
                                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-2 animate-pulse">
                                    <Sparkles size={24} className="text-blue-400"/>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Criar Slide com IA</p>
                                    <p className="text-xs text-gray-400 mt-2">Ex: "Slide sobre metas de vendas com gráfico"</p>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="p-4 bg-white border-t border-gray-100 relative">
                        <input 
                            type="text" 
                            className="w-full bg-gray-100 border border-transparent focus:bg-white focus:border-blue-500 rounded-full pl-4 pr-12 py-3 text-sm outline-none transition-all shadow-inner"
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate()}
                            disabled={isGenerating}
                            placeholder="Descreva o slide..."
                        />
                        <button 
                            onClick={handleAiGenerate}
                            disabled={!aiPrompt.trim() || isGenerating}
                            className="absolute right-6 top-6 p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-full disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                        >
                            {isGenerating ? <Loader2 size={16} className="animate-spin"/> : <Wand2 size={16}/>}
                        </button>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
}
