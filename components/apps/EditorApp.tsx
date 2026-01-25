
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, Lock, Undo, Redo, Printer, SpellCheck, PaintRoller,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Image as ImageIcon, Link as LinkIcon,
  Table, Type, ChevronDown, MessageSquare, Share2, MoreVertical,
  Plus, Grid3X3, Type as TypeIcon, Square, Circle, LayoutTemplate,
  Check, Save, Menu, Minus, Sparkles, Send, Bot, Wand2, Loader2, ArrowRight,
  Ratio, Maximize, File as FileIcon, Search as SearchIcon, Ruler, Sigma,
  Play, Monitor, MousePointer2, StickyNote, Trash2, Copy, Calendar, User
} from 'lucide-react';
import { GoogleIcons, GeminiLogo } from '../GoogleIcons';
import { GoogleGenAI } from "@google/genai";
import { bridge } from '../../utils/GASBridge';

interface EditorAppProps {
  onClose: () => void;
  type: string;
  data: any; 
}

// --- SLIDE ENGINE TYPES ---
interface SlideElement {
    id: string;
    type: 'text' | 'image' | 'shape';
    x: number;
    y: number;
    w: number;
    h: number;
    content: string; // Texto ou Base64/URL da imagem
    style: {
        fontSize?: number;
        fontWeight?: string;
        fontStyle?: string;
        textDecoration?: string;
        color?: string;
        backgroundColor?: string;
        textAlign?: 'left' | 'center' | 'right';
        borderRadius?: number;
        border?: string;
        opacity?: number;
    };
}

interface SlideData {
    id: string;
    elements: SlideElement[];
    background: string;
    notes: string;
}

const getFileIcon = (type: string) => {
  switch(type) {
    case 'sheet': return <GoogleIcons.Sheets className="w-9 h-9" />;
    case 'slide': return <GoogleIcons.Slides className="w-9 h-9" />;
    case 'doc': return <GoogleIcons.Docs className="w-9 h-9" />;
    default: return null;
  }
};

const ToolbarButton = ({ children, active, onClick, title, disabled }: any) => (
    <button 
        onClick={onClick}
        title={title}
        disabled={disabled}
        className={`p-1.5 rounded-[4px] transition-colors flex items-center justify-center h-8 w-8 ${active ? 'bg-blue-100 text-blue-700' : 'text-[#444746] hover:bg-[#1f1f1f]/5 disabled:opacity-30 disabled:cursor-not-allowed'}`}
    >
        {children}
    </button>
);

const Divider = () => <div className="w-[1px] h-5 bg-[#c7c7c7] mx-1 self-center"></div>;

export default function EditorApp({ onClose, type, data }: EditorAppProps) {
  // --- GLOBAL STATE ---
  const [title, setTitle] = useState(data?.name || (type === 'doc' ? 'Documento sem título' : type === 'sheet' ? 'Planilha sem título' : 'Apresentação sem título'));
  const [saved, setSaved] = useState(true);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  
  // --- FORMAT STATE ---
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [textAlign, setTextAlign] = useState('left');

  // --- DOCS STATE ---
  const [wordCount, setWordCount] = useState(0);
  const [showSmartChips, setShowSmartChips] = useState(false);
  const [smartChipPos, setSmartChipPos] = useState({ top: 0, left: 0 });

  // --- SHEETS STATE ---
  const [selectedCell, setSelectedCell] = useState<{r:number, c:number} | null>({r:0, c:0});
  const [cellData, setCellData] = useState<{[key:string]: string}>({});
  const [formulaValue, setFormulaValue] = useState('');

  // --- SLIDES STATE ---
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [slides, setSlides] = useState<SlideData[]>([
      { 
          id: '1', 
          background: '#ffffff', 
          notes: '',
          elements: [
              { id: 'e1', type: 'text', x: 80, y: 150, w: 800, h: 100, content: 'Clique para adicionar um título', style: { fontSize: 42, fontWeight: '400', textAlign: 'center', color: '#000' } },
              { id: 'e2', type: 'text', x: 230, y: 280, w: 500, h: 50, content: 'Clique para adicionar um subtítulo', style: { fontSize: 20, textAlign: 'center', color: '#5f6368' } }
          ] 
      }
  ]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isPresenting, setIsPresenting] = useState(false);
  const [dragInfo, setDragInfo] = useState<{ id: string, startX: number, startY: number, initialX: number, initialY: number, mode: 'move' | 'resize' } | null>(null);

  // --- AI STATE ---
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null); // Texto ou URL/Base64
  const [generatedImage, setGeneratedImage] = useState<string | null>(null); // Para armazenar imagem gerada especificamente
  const [isGenerating, setIsGenerating] = useState(false);
  
  // --- REFS ---
  const aiClient = useRef<GoogleGenAI | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- INIT ---
  useEffect(() => {
      try {
          if (process.env.API_KEY) {
              aiClient.current = new GoogleGenAI({ apiKey: process.env.API_KEY });
          }
      } catch (e) { console.error("Gemini init error", e); }
  }, []);

  useEffect(() => {
      if (data?.id) {
          setIsLoadingContent(true);
          bridge.getFileContent(data.id).then(res => {
              if (res.success && res.data) {
                  try {
                      const decoded = atob(res.data);
                      if (type === 'doc' && editorRef.current) {
                          try { editorRef.current.innerHTML = decoded; } catch (e) { editorRef.current.innerText = decoded; }
                          checkFormatState();
                      } else if (type === 'sheet') {
                          setCellData(JSON.parse(decoded));
                      } else if (type === 'slide') {
                          const parsed = JSON.parse(decoded);
                          if (Array.isArray(parsed) && parsed.length > 0) setSlides(parsed);
                      }
                  } catch(e) { console.error("Decode error", e); }
              }
              setIsLoadingContent(false);
          });
      }
  }, [data, type]);

  // --- AUTO SAVE ---
  const triggerSave = useCallback(() => {
      setSaved(false);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      
      saveTimeoutRef.current = setTimeout(async () => {
          if (!data?.id) { setSaved(true); return; }
          let contentToSave = '';
          if (type === 'doc' && editorRef.current) contentToSave = editorRef.current.innerHTML;
          else if (type === 'sheet') contentToSave = JSON.stringify(cellData);
          else if (type === 'slide') contentToSave = JSON.stringify(slides);

          if (contentToSave) {
              await bridge.saveFileContent(data.id, contentToSave);
              setSaved(true);
          }
      }, 2000);
  }, [data, type, cellData, slides]);

  // --- DOCS HANDLERS ---
  const handleDocInput = (e: React.FormEvent<HTMLDivElement>) => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const text = selection.anchorNode?.textContent;
          
          // Basic Smart Chip Trigger detection (@)
          if (e.nativeEvent instanceof InputEvent && (e.nativeEvent as InputEvent).data === '@') {
             setShowSmartChips(true);
             setSmartChipPos({ top: rect.bottom + 5, left: rect.left });
          } else {
             setShowSmartChips(false);
          }
      }
      checkFormatState();
  };

  const insertSmartChip = (text: string, type: 'person' | 'date' | 'file') => {
      const chipColor = type === 'person' ? 'bg-[#ceead6]' : type === 'date' ? 'bg-[#fad2cf]' : 'bg-[#d2e3fc]';
      const chipHtml = `<span class="${chipColor} px-1.5 py-0.5 rounded-full text-xs font-medium border border-black/10 mx-1 select-none" contenteditable="false">${text}</span>&nbsp;`;
      document.execCommand('insertHTML', false, chipHtml);
      setShowSmartChips(false);
      editorRef.current?.focus();
  };

  const handleFormat = (command: string, value: string | undefined = undefined) => {
      if (type === 'slide' && selectedElementId) {
           const newSlides = [...slides];
           const el = newSlides[currentSlideIndex].elements.find(e => e.id === selectedElementId);
           if(el) {
               if(command === 'bold') el.style.fontWeight = el.style.fontWeight === 'bold' ? 'normal' : 'bold';
               if(command === 'italic') el.style.fontStyle = el.style.fontStyle === 'italic' ? 'normal' : 'italic';
               if(command === 'underline') el.style.textDecoration = el.style.textDecoration === 'underline' ? 'none' : 'underline';
               if(command === 'justifyLeft') el.style.textAlign = 'left';
               if(command === 'justifyCenter') el.style.textAlign = 'center';
               if(command === 'justifyRight') el.style.textAlign = 'right';
               setSlides(newSlides);
               triggerSave();
           }
      } else {
          document.execCommand(command, false, value);
          checkFormatState();
          editorRef.current?.focus();
      }
  };

  const checkFormatState = () => {
      setIsBold(document.queryCommandState('bold'));
      setIsItalic(document.queryCommandState('italic'));
      setIsUnderline(document.queryCommandState('underline'));
      if (editorRef.current) {
          const text = editorRef.current.innerText || "";
          setWordCount(text.trim().split(/\s+/).filter(w => w.length > 0).length);
      }
      triggerSave();
  };

  // --- SHEETS HANDLERS ---
  const getCellId = (r: number, c: number) => `${String.fromCharCode(65+c)}${r+1}`;
  const handleCellClick = (r: number, c: number) => { setSelectedCell({r, c}); setFormulaValue(cellData[getCellId(r, c)] || ''); };
  const handleCellChange = (val: string) => {
      if (selectedCell) {
          const id = getCellId(selectedCell.r, selectedCell.c);
          setCellData(prev => ({...prev, [id]: val}));
          setFormulaValue(val);
          triggerSave();
      }
  };

  // --- SLIDES HANDLERS ---
  const addSlideElement = (elType: 'text' | 'shape' | 'image', content: string = '') => {
      const newElement: SlideElement = {
          id: Date.now().toString(),
          type: elType,
          x: 100, y: 100,
          w: elType === 'text' ? 400 : 200,
          h: elType === 'text' ? 60 : 200,
          content: elType === 'text' ? 'Novo Texto' : content,
          style: { 
              fontSize: 20, 
              color: '#000', 
              backgroundColor: elType === 'shape' ? '#dadce0' : 'transparent',
              borderRadius: elType === 'shape' ? 0 : 0
          }
      };
      const newSlides = [...slides];
      newSlides[currentSlideIndex].elements.push(newElement);
      setSlides(newSlides);
      setSelectedElementId(newElement.id);
      triggerSave();
  };

  const deleteSelectedElement = () => {
      if(selectedElementId) {
          const newSlides = [...slides];
          newSlides[currentSlideIndex].elements = newSlides[currentSlideIndex].elements.filter(e => e.id !== selectedElementId);
          setSlides(newSlides);
          setSelectedElementId(null);
          triggerSave();
      }
  }

  const handleSlideMouseDown = (e: React.MouseEvent, elId: string) => {
      e.stopPropagation();
      setSelectedElementId(elId);
      const el = slides[currentSlideIndex].elements.find(x => x.id === elId);
      if (el) {
          setDragInfo({ id: elId, startX: e.clientX, startY: e.clientY, initialX: el.x, initialY: el.y, mode: 'move' });
      }
  };

  const handleSlideMouseMove = (e: React.MouseEvent) => {
      if (!dragInfo) return;
      const dx = e.clientX - dragInfo.startX;
      const dy = e.clientY - dragInfo.startY;
      const newSlides = [...slides];
      const el = newSlides[currentSlideIndex].elements.find(x => x.id === dragInfo.id);
      if (el) {
          el.x = dragInfo.initialX + dx;
          el.y = dragInfo.initialY + dy;
          setSlides(newSlides);
      }
  };

  const handleSlideMouseUp = () => {
      if (dragInfo) triggerSave();
      setDragInfo(null);
  };

  const handleElementContentChange = (val: string) => {
      if (selectedElementId) {
          const newSlides = [...slides];
          const el = newSlides[currentSlideIndex].elements.find(x => x.id === selectedElementId);
          if (el) { el.content = val; setSlides(newSlides); triggerSave(); }
      }
  };

  const addNewSlide = () => {
      const newSlide: SlideData = {
          id: Date.now().toString(),
          background: '#ffffff',
          notes: '',
          elements: [{ id: 'title_'+Date.now(), type: 'text', x: 80, y: 50, w: 800, h: 60, content: 'Novo Slide', style: { fontSize: 32, fontWeight: 'bold' } }]
      };
      setSlides([...slides, newSlide]);
      setCurrentSlideIndex(slides.length);
      triggerSave();
  };

  // --- GEMINI HANDLERS ---
  const handleAiGenerate = async () => {
      if (!aiPrompt.trim() || !aiClient.current) return;
      setIsGenerating(true);
      setAiResponse(null);
      setGeneratedImage(null);

      try {
          if (type === 'doc') {
              const response = await aiClient.current.models.generateContent({
                  model: 'gemini-3-flash-preview',
                  contents: `Act as a professional writer. Write a paragraph about: "${aiPrompt}". Return only plain text/html suitable for a document.`,
              });
              setAiResponse(response.text || "Sem resposta.");
          } else if (type === 'slide') {
              // REAL IMAGE GENERATION
              const response = await aiClient.current.models.generateContent({
                  model: 'gemini-2.5-flash-image',
                  contents: { parts: [{ text: aiPrompt }] },
              });
              
              let foundImage = false;
              // Parse response for image
              if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
                  for (const part of response.candidates[0].content.parts) {
                      if (part.inlineData) {
                          const base64 = part.inlineData.data;
                          const mime = part.inlineData.mimeType || 'image/png';
                          setGeneratedImage(`data:${mime};base64,${base64}`);
                          setAiResponse("Imagem gerada com sucesso!");
                          foundImage = true;
                          break;
                      }
                  }
              }
              
              if (!foundImage) {
                   setAiResponse(response.text || "Não foi possível gerar a imagem. Tente descrever com mais detalhes.");
              }

          } else if (type === 'sheet') {
              const response = await aiClient.current.models.generateContent({
                  model: 'gemini-3-flash-preview',
                  contents: `Act as a Google Sheets expert. Provide the formula for: "${aiPrompt}". Return ONLY the formula starting with =.`,
              });
              setAiResponse(response.text?.trim() || "");
          }
      } catch (error) {
          console.error(error);
          setAiResponse("Erro ao conectar com Gemini.");
      } finally {
          setIsGenerating(false);
      }
  };
  
  const insertAiContent = () => {
      if (type === 'doc' && editorRef.current && aiResponse) {
           editorRef.current.focus();
           document.execCommand('insertText', false, aiResponse);
           checkFormatState();
      } else if (type === 'slide' && generatedImage) {
          addSlideElement('image', generatedImage);
      } else if (type === 'sheet' && selectedCell && aiResponse) {
          handleCellChange(aiResponse);
      }
      setAiPrompt('');
      setAiResponse(null);
      setGeneratedImage(null);
      setShowAiPanel(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#F9FBFD] animate-in fade-in duration-300 font-sans relative text-[#1f1f1f]">
        
        {/* HEADER */}
        <div className="h-16 px-4 flex items-center justify-between bg-white z-20 shrink-0 border-b border-[#dadce0]">
            <div className="flex items-center gap-3 w-1/3">
                <div onClick={onClose} className="cursor-pointer hover:opacity-80 transition-opacity">{getFileIcon(type)}</div>
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <input 
                            type="text" 
                            value={title} 
                            onChange={(e) => setTitle(e.target.value)}
                            className="text-lg text-[#1f1f1f] font-normal outline-none border border-transparent hover:border-black/20 focus:border-blue-500 rounded px-1 -ml-1 transition-all h-7 w-64 truncate"
                        />
                        {saved ? <div title="Salvo no Drive" className="text-gray-500"><Check size={14}/></div> : <div className="text-gray-400 text-xs animate-pulse">Salvando...</div>}
                    </div>
                    <div className="flex gap-3 text-[13px] text-[#444746] select-none">
                        <span className="hover:bg-[#f0f4f9] px-1.5 rounded cursor-pointer transition-colors">Arquivo</span>
                        <span className="hover:bg-[#f0f4f9] px-1.5 rounded cursor-pointer transition-colors">Editar</span>
                        <span className="hover:bg-[#f0f4f9] px-1.5 rounded cursor-pointer transition-colors">Ver</span>
                        <span className="hover:bg-[#f0f4f9] px-1.5 rounded cursor-pointer transition-colors">Inserir</span>
                        <span className="hover:bg-[#f0f4f9] px-1.5 rounded cursor-pointer transition-colors">Formatar</span>
                        <span className="hover:bg-[#f0f4f9] px-1.5 rounded cursor-pointer transition-colors">Ferramentas</span>
                        <span className="hover:bg-[#f0f4f9] px-1.5 rounded cursor-pointer transition-colors">Ajuda</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3 w-1/3 justify-end">
                {type === 'slide' && (
                    <button onClick={() => setIsPresenting(true)} className="flex items-center gap-2 bg-white border border-[#dadce0] px-4 py-2 rounded-full text-sm font-medium hover:bg-[#f0f4f9] transition-all shadow-sm h-10">
                        <Play size={16} fill="currentColor"/> <span className="hidden lg:inline">Apresentar</span>
                    </button>
                )}
                <button onClick={() => setShowAiPanel(!showAiPanel)} className={`w-10 h-10 rounded-full transition-all flex items-center justify-center ${showAiPanel ? 'bg-blue-100 text-blue-700' : 'hover:bg-[#f0f4f9] text-[#444746]'}`} title="Perguntar ao Gemini">
                    <Sparkles size={20} className={showAiPanel ? "fill-blue-300" : ""}/>
                </button>
                <button className="hidden md:flex items-center gap-2 bg-[#C2E7FF] text-[#001D35] px-5 h-10 rounded-full text-sm font-medium hover:shadow-md transition-all">
                    <Lock size={16} /> <span className="hidden lg:inline">Compartilhar</span>
                </button>
                <div className="w-9 h-9 bg-purple-600 rounded-full text-white flex items-center justify-center font-bold text-sm border-2 border-white shadow-sm cursor-pointer">D</div>
                <button onClick={onClose} className="p-2 hover:bg-red-50 text-gray-500 hover:text-red-500 rounded-full transition-colors ml-2"><X size={22}/></button>
            </div>
        </div>
        
        {/* TOOLBAR */}
        <div className="bg-[#EDF2FA] mx-3 my-2 rounded-full flex items-center px-4 py-1.5 gap-1 overflow-x-auto custom-scrollbar shrink-0 shadow-sm border border-white/50 h-11">
             <ToolbarButton onClick={() => handleFormat('undo')} title="Desfazer"><Undo size={18}/></ToolbarButton>
             <ToolbarButton onClick={() => handleFormat('redo')} title="Refazer"><Redo size={18}/></ToolbarButton>
             <ToolbarButton title="Imprimir"><Printer size={18}/></ToolbarButton>
             <ToolbarButton title="Pintar Formatação"><PaintRoller size={18}/></ToolbarButton>
             <Divider />
             <div className="flex items-center gap-1 hover:bg-[#e0e4e9] rounded px-2 h-8 cursor-pointer transition-colors">
                <span className="text-sm font-medium text-[#1f1f1f]">Arial</span>
                <ChevronDown size={12} className="text-[#444746]"/>
            </div>
             <div className="w-[1px] h-5 bg-[#c7c7c7] mx-1 self-center"></div>
             <div className="flex items-center gap-1 hover:bg-[#e0e4e9] rounded px-2 h-8 cursor-pointer transition-colors mr-1">
                <span className="text-sm font-medium text-[#1f1f1f]">11</span>
                <ChevronDown size={12} className="text-[#444746]"/>
            </div>
             <Divider />
             <ToolbarButton onClick={() => handleFormat('bold')} active={isBold} title="Negrito"><Bold size={18}/></ToolbarButton>
             <ToolbarButton onClick={() => handleFormat('italic')} active={isItalic} title="Itálico"><Italic size={18}/></ToolbarButton>
             <ToolbarButton onClick={() => handleFormat('underline')} active={isUnderline} title="Sublinhado"><Underline size={18}/></ToolbarButton>
             <ToolbarButton title="Cor do Texto"><div className="flex flex-col items-center justify-center h-full"><span className="font-bold text-sm leading-none mt-1">A</span><div className="w-4 h-1 bg-black mt-0.5"></div></div></ToolbarButton>
             <Divider />
             {type === 'doc' && (
                <>
                    <ToolbarButton onClick={() => handleFormat('justifyLeft')} active={textAlign==='left'} title="Alinhar à Esquerda"><AlignLeft size={18}/></ToolbarButton>
                    <ToolbarButton onClick={() => handleFormat('justifyCenter')} active={textAlign==='center'} title="Centralizar"><AlignCenter size={18}/></ToolbarButton>
                    <ToolbarButton onClick={() => handleFormat('justifyRight')} active={textAlign==='right'} title="Alinhar à Direita"><AlignRight size={18}/></ToolbarButton>
                    <ToolbarButton onClick={() => handleFormat('justifyFull')} active={textAlign==='justify'} title="Justificar"><AlignJustify size={18}/></ToolbarButton>
                    <Divider />
                    <ToolbarButton onClick={() => handleFormat('insertUnorderedList')} title="Lista com marcadores"><List size={18}/></ToolbarButton>
                    <ToolbarButton onClick={() => handleFormat('insertOrderedList')} title="Lista numerada"><ListOrdered size={18}/></ToolbarButton>
                </>
            )}
            {type === 'sheet' && (
                <>
                    <ToolbarButton title="Bordas"><Grid3X3 size={18}/></ToolbarButton>
                    <ToolbarButton title="Mesclar células"><LayoutTemplate size={18}/></ToolbarButton>
                    <Divider/>
                    <ToolbarButton title="Alinhamento Horizontal"><AlignLeft size={18}/></ToolbarButton>
                    <ToolbarButton title="Alinhamento Vertical"><AlignJustify size={18} className="rotate-90"/></ToolbarButton>
                </>
            )}
            {type === 'slide' && (
                <>
                    <ToolbarButton onClick={() => addSlideElement('text')} title="Caixa de Texto"><TypeIcon size={18}/></ToolbarButton>
                    <ToolbarButton onClick={() => addSlideElement('image', 'https://source.unsplash.com/random/400x300')} title="Inserir Imagem"><ImageIcon size={18}/></ToolbarButton>
                    <ToolbarButton onClick={() => addSlideElement('shape')} title="Forma"><Square size={18}/></ToolbarButton>
                    <Divider/>
                    <ToolbarButton title="Plano de Fundo"><span className="text-xs font-medium">Fundo</span></ToolbarButton>
                    <ToolbarButton title="Layout"><span className="text-xs font-medium">Layout</span></ToolbarButton>
                    <ToolbarButton title="Tema"><span className="text-xs font-medium">Tema</span></ToolbarButton>
                </>
            )}
        </div>
        
        {/* FORMULA BAR FOR SHEETS */}
        {type === 'sheet' && (
            <div className="h-9 flex items-center gap-2 px-3 border-b border-[#dadce0] bg-white mb-0 shrink-0">
                <div className="relative group">
                    <div className="text-xs font-bold text-[#444746] w-10 text-center bg-gray-100 rounded py-1 border border-[#dadce0]">{selectedCell ? getCellId(selectedCell.r, selectedCell.c) : ''}</div>
                </div>
                <div className="w-[1px] h-5 bg-[#dadce0] mx-1"></div>
                <div className="font-serif italic text-gray-500 font-bold px-1 cursor-pointer hover:bg-gray-100 rounded"><Sigma size={18}/></div>
                <div className="flex-1 h-7 border border-[#dadce0] rounded-sm overflow-hidden flex items-center px-2 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                    <input 
                        type="text" 
                        className="flex-1 text-sm outline-none h-full border-none text-[#1f1f1f]"
                        value={formulaValue}
                        onChange={(e) => handleCellChange(e.target.value)}
                        placeholder="Fx"
                    />
                </div>
            </div>
        )}

        <div className="flex-1 bg-[#F0F2F5] overflow-hidden flex relative flex-col">
            {isLoadingContent && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80">
                    <Loader2 size={32} className="animate-spin text-blue-500"/>
                </div>
            )}
            
            {/* --- DOC EDITOR --- */}
            {type === 'doc' && (
                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col items-center bg-[#F9FBFD]" onClick={() => editorRef.current?.focus()}>
                    {/* Ruler Mock */}
                    <div className="w-[816px] h-6 bg-[#F9FBFD] border-b border-gray-300 mb-4 mt-2 flex items-end px-10 text-[9px] text-[#444746] sticky top-0 z-10 select-none">
                        <div className="flex-1 flex justify-between relative h-full items-end">
                             {[1,2,3,4,5,6,7].map(n => <span key={n} className="mb-0.5">{n}</span>)}
                             <div className="absolute left-0 bottom-0 w-full h-[5px] bg-white border-x border-t border-gray-300"></div>
                             <div className="absolute left-0 bottom-0 w-4 h-3 bg-blue-400 opacity-20"></div>
                             <div className="absolute right-0 bottom-0 w-4 h-3 bg-blue-400 opacity-20"></div>
                        </div>
                    </div>
                    <div className="relative">
                        <div 
                            ref={editorRef}
                            className="w-[816px] min-h-[1056px] bg-white shadow-md border border-[#dadce0] px-24 py-20 outline-none text-[#1f1f1f] selection:bg-blue-200 print:shadow-none print:w-full mb-10" 
                            contentEditable 
                            suppressContentEditableWarning
                            onKeyUp={handleDocInput}
                            onMouseUp={checkFormatState}
                            onInput={handleDocInput}
                            style={{ fontFamily: 'Arial, sans-serif', fontSize: '11pt', lineHeight: '1.5' }}
                        >
                        </div>
                        {/* SMART CHIPS MENU */}
                        {showSmartChips && (
                            <div className="absolute bg-white shadow-xl border border-gray-200 rounded-lg p-2 flex flex-col gap-1 w-56 z-50 animate-in fade-in zoom-in duration-200" style={{ top: smartChipPos.top, left: smartChipPos.left }}>
                                <div className="text-xs font-bold text-gray-400 px-2 py-1 uppercase">Pessoas</div>
                                <button onClick={() => insertSmartChip("@Julia Silva", 'person')} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded text-sm text-gray-700 text-left"><User size={14}/> Julia Silva</button>
                                <button onClick={() => insertSmartChip("@Roberto Alves", 'person')} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded text-sm text-gray-700 text-left"><User size={14}/> Roberto Alves</button>
                                <div className="h-px bg-gray-100 my-1"></div>
                                <div className="text-xs font-bold text-gray-400 px-2 py-1 uppercase">Data</div>
                                <button onClick={() => insertSmartChip("@Hoje", 'date')} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded text-sm text-gray-700 text-left"><Calendar size={14}/> Data de hoje</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- SHEET EDITOR --- */}
            {type === 'sheet' && (
                <div className="flex-1 overflow-auto custom-scrollbar bg-white relative">
                    <div className="inline-block min-w-full">
                        <div className="flex sticky top-0 z-10 shadow-sm">
                            <div className="w-10 h-6 bg-[#f8f9fa] border-b border-r border-[#c7c7c7] shrink-0"></div>
                            {['A','B','C','D','E','F','G','H','I','J','K','L','M','N'].map((col, idx) => (
                                <div key={col} className={`w-24 h-6 bg-[#f8f9fa] border-b border-r border-[#c7c7c7] flex items-center justify-center text-xs font-bold shrink-0 resize-x overflow-hidden ${selectedCell?.c === idx ? 'bg-[#e8f0fe] text-[#1967d2]' : 'text-[#444746]'}`}>{col}</div>
                            ))}
                        </div>
                        <div className="flex flex-col">
                            {[...Array(60)].map((_, r) => (
                                <div key={r} className="flex h-6">
                                    <div className={`w-10 bg-[#f8f9fa] border-b border-r border-[#c7c7c7] flex items-center justify-center text-xs shrink-0 sticky left-0 z-10 ${selectedCell?.r === r ? 'bg-[#e8f0fe] text-[#1967d2] font-bold' : 'text-[#444746]'}`}>{r+1}</div>
                                    {['A','B','C','D','E','F','G','H','I','J','K','L','M','N'].map((_, c) => {
                                        const cellId = getCellId(r, c);
                                        const isSelected = selectedCell?.r === r && selectedCell?.c === c;
                                        return (
                                            <input 
                                                key={cellId}
                                                onFocus={() => handleCellClick(r, c)}
                                                onChange={(e) => handleCellChange(e.target.value)}
                                                value={cellData[cellId] || ''}
                                                className={`w-24 h-full border-b border-r border-[#e7e7e7] outline-none text-xs px-1 flex items-center overflow-hidden whitespace-nowrap ${isSelected ? 'border-2 border-blue-500 z-20 relative' : ''}`}
                                            />
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Bottom Tabs */}
                    <div className="fixed bottom-0 left-0 right-0 h-9 bg-[#f8f9fa] border-t border-[#c7c7c7] flex items-center px-2 gap-1 z-20">
                        <button className="p-1 hover:bg-[#e8eaed] rounded"><Plus size={14}/></button>
                        <button className="p-1 hover:bg-[#e8eaed] rounded"><Menu size={14}/></button>
                        <div className="bg-white px-4 py-1.5 rounded-t-lg shadow-sm text-sm font-medium text-[#188038] border-b-2 border-[#188038]">Página1</div>
                        <div className="px-4 py-1.5 text-sm font-medium text-[#444746] hover:bg-[#e8eaed] rounded cursor-pointer">Página2</div>
                    </div>
                </div>
            )}

            {/* --- SLIDE EDITOR (Advanced) --- */}
            {type === 'slide' && (
                <div className="w-full h-full flex" onMouseMove={handleSlideMouseMove} onMouseUp={handleSlideMouseUp}>
                    {/* Sidebar Slides */}
                    <div className="w-48 bg-white border-r border-[#dadce0] flex flex-col gap-4 p-4 overflow-y-auto shrink-0 z-10 custom-scrollbar">
                        {slides.map((slide, i) => (
                            <div key={slide.id} onClick={() => setCurrentSlideIndex(i)} className={`flex gap-2 cursor-pointer group`}>
                                <span className="text-xs text-[#444746] font-medium w-4 text-right pt-2">{i+1}</span>
                                <div className={`flex-1 aspect-video border-2 rounded shadow-sm relative bg-white transition-all overflow-hidden ${currentSlideIndex === i ? 'border-[#fbbc04] ring-1 ring-[#fbbc04]' : 'border-[#dadce0] group-hover:border-[#bdc1c6]'}`}>
                                    {/* Mini Preview of Elements */}
                                    <div className="absolute inset-0 transform scale-[0.18] origin-top-left w-[555%] h-[555%] pointer-events-none select-none bg-white">
                                        {slide.elements.map(el => (
                                            <div key={el.id} style={{
                                                position: 'absolute', left: el.x, top: el.y, width: el.w, height: el.h,
                                                fontSize: el.style.fontSize, fontWeight: el.style.fontWeight, color: el.style.color,
                                                backgroundColor: el.style.backgroundColor, border: '1px solid #eee', overflow: 'hidden'
                                            }}>
                                                {el.type === 'text' ? el.content : el.type === 'image' ? <img src={el.content} className="w-full h-full object-cover"/> : null}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                        <button onClick={addNewSlide} className="w-full py-2 border border-dashed border-[#c7c7c7] rounded text-[#444746] text-xs hover:bg-[#f0f4f9] transition-colors">+ Novo Slide</button>
                    </div>

                    {/* Main Stage (Canvas) */}
                    <div className="flex-1 bg-[#F0F2F5] flex flex-col relative overflow-hidden">
                        <div className="flex-1 flex items-center justify-center p-8 overflow-auto custom-scrollbar" ref={slideRef} onClick={() => setSelectedElementId(null)}>
                            <div 
                                className="bg-white shadow-2xl relative select-none" 
                                style={{ width: 960, height: 540, backgroundColor: slides[currentSlideIndex].background }}
                            >
                                {slides[currentSlideIndex].elements.map(el => (
                                    <div
                                        key={el.id}
                                        onMouseDown={(e) => handleSlideMouseDown(e, el.id)}
                                        style={{
                                            position: 'absolute',
                                            left: el.x, top: el.y, width: el.w, height: el.h,
                                            ...el.style,
                                            border: selectedElementId === el.id ? '2px solid #4285F4' : '1px solid transparent',
                                            cursor: 'move'
                                        }}
                                        className="group"
                                    >
                                        {el.type === 'text' ? (
                                            <textarea 
                                                className="w-full h-full bg-transparent outline-none resize-none overflow-hidden p-2"
                                                style={{...el.style, border: 'none'}}
                                                value={el.content}
                                                onChange={(e) => handleElementContentChange(e.target.value)}
                                                onMouseDown={(e) => e.stopPropagation()} 
                                            />
                                        ) : el.type === 'image' ? (
                                            <img src={el.content} className="w-full h-full object-cover pointer-events-none" />
                                        ) : (
                                            <div className="w-full h-full" style={{backgroundColor: el.style.backgroundColor, borderRadius: el.style.borderRadius}}></div>
                                        )}
                                        
                                        {/* Resize Handles (Visual Only for now) */}
                                        {selectedElementId === el.id && (
                                            <>
                                                <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-blue-500 border border-white"></div>
                                                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 border border-white"></div>
                                                <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-blue-500 border border-white"></div>
                                                <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-blue-500 border border-white"></div>
                                                
                                                {/* Delete Button */}
                                                <button 
                                                    onMouseDown={(e) => { e.stopPropagation(); deleteSelectedElement(); }}
                                                    className="absolute -top-8 right-0 bg-white shadow-md p-1 rounded hover:bg-red-50 text-red-500"
                                                    title="Excluir"
                                                >
                                                    <Trash2 size={14}/>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        {/* Speaker Notes */}
                        <div className="h-12 bg-white border-t border-[#dadce0] p-1 flex items-center justify-center shrink-0">
                            <div className="text-xs text-gray-400 font-medium select-none cursor-text">Clique para adicionar anotações do orador</div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- AI PANEL (GEMINI) --- */}
            {showAiPanel && (
                <div className="w-80 bg-white border-l border-[#dadce0] flex flex-col shadow-2xl animate-in slide-in-from-right-10 duration-300 z-30">
                    <div className="p-4 border-b border-[#dadce0] flex items-center gap-2 bg-gradient-to-r from-blue-50 to-white">
                        <GeminiLogo className="w-6 h-6" />
                        <span className="font-medium text-[#1f1f1f]">Gemini</span>
                        <div className="ml-auto bg-white border border-[#dadce0] text-[#1f1f1f] text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">BETA</div>
                    </div>
                    <div className="flex-1 p-4 overflow-y-auto bg-[#F9FBFD]">
                        {aiResponse ? (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-[#dadce0]">
                                    {generatedImage ? (
                                        <div className="relative group">
                                            <img src={generatedImage} className="w-full rounded-lg mb-2 shadow-sm" alt="Generated" />
                                            <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded-full backdrop-blur-md">IA Generated</div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-[#1f1f1f] whitespace-pre-wrap leading-relaxed">{aiResponse}</p>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => { setAiResponse(null); setGeneratedImage(null); }} className="flex-1 py-2 text-[#444746] text-xs font-medium hover:bg-[#e0e4e9] rounded-full transition-colors">Descartar</button>
                                    <button onClick={insertAiContent} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-full transition-colors flex items-center justify-center gap-2"><Sparkles size={14}/> Inserir</button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-[#444746] text-center space-y-6 pb-10 px-4">
                                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-[#dadce0]">
                                    <Sparkles size={20} className="text-blue-500"/>
                                </div>
                                <div>
                                    <p className="text-sm font-medium mb-1">Como posso ajudar?</p>
                                    <p className="text-xs text-[#444746]/70">
                                        {type === 'doc' && "Posso escrever, resumir ou reescrever textos para você."}
                                        {type === 'sheet' && "Posso criar fórmulas complexas ou analisar seus dados."}
                                        {type === 'slide' && "Posso criar imagens realistas para seus slides."}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2 justify-center">
                                    <button onClick={() => setAiPrompt("Resuma este documento")} className="text-xs bg-white border border-[#dadce0] px-3 py-1.5 rounded-full hover:bg-[#f0f4f9]">Resumir</button>
                                    <button onClick={() => setAiPrompt("Melhore o tom para ser mais profissional")} className="text-xs bg-white border border-[#dadce0] px-3 py-1.5 rounded-full hover:bg-[#f0f4f9]">Tom Profissional</button>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="p-4 bg-white border-t border-[#dadce0] relative">
                        <input 
                            type="text" 
                            className="w-full bg-[#f0f4f9] border border-transparent focus:bg-white focus:border-blue-500 focus:shadow-md rounded-full pl-4 pr-12 py-3 text-sm outline-none transition-all"
                            placeholder="Digite um comando..."
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate()}
                            disabled={isGenerating}
                        />
                        <button 
                            onClick={handleAiGenerate}
                            disabled={!aiPrompt.trim() || isGenerating}
                            className="absolute right-6 top-6 p-1.5 text-blue-600 hover:bg-blue-50 rounded-full disabled:text-gray-400 disabled:hover:bg-transparent transition-colors"
                        >
                            {isGenerating ? <Loader2 size={18} className="animate-spin"/> : <Send size={18}/>}
                        </button>
                    </div>
                </div>
            )}
        </div>

        {/* PRESENTATION MODE OVERLAY */}
        {isPresenting && (
            <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col animate-in fade-in duration-300">
                <div className="flex-1 flex items-center justify-center relative">
                    <div 
                        className="bg-white relative overflow-hidden shadow-2xl" 
                        style={{ 
                            width: '100%', height: '100%', maxHeight: '100vh', aspectRatio: '16/9',
                            backgroundColor: slides[currentSlideIndex].background 
                        }}
                    >
                        {slides[currentSlideIndex].elements.map(el => (
                            <div
                                key={el.id}
                                style={{
                                    position: 'absolute',
                                    left: el.x, top: el.y, width: el.w, height: el.h,
                                    ...el.style,
                                }}
                            >
                                {el.type === 'text' ? el.content : el.type === 'image' ? <img src={el.content} className="w-full h-full object-cover"/> : <div style={{width:'100%', height:'100%', backgroundColor: el.style.backgroundColor}}></div>}
                            </div>
                        ))}
                    </div>
                    
                    {/* Controls Overlay */}
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-[#202124]/90 rounded-full flex items-center gap-6 shadow-2xl backdrop-blur-md opacity-0 hover:opacity-100 transition-opacity duration-200">
                        <div className="text-sm font-medium text-white/80 select-none">
                            Slide {currentSlideIndex + 1} / {slides.length}
                        </div>
                        <div className="h-4 w-[1px] bg-white/20"></div>
                        <div className="flex gap-2">
                            <button onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))} className="p-2 hover:bg-white/10 rounded-full disabled:opacity-30" disabled={currentSlideIndex===0}><ChevronDown className="rotate-90" size={20}/></button>
                            <button onClick={() => setCurrentSlideIndex(Math.min(slides.length - 1, currentSlideIndex + 1))} className="p-2 hover:bg-white/10 rounded-full disabled:opacity-30" disabled={currentSlideIndex===slides.length-1}><ChevronDown className="-rotate-90" size={20}/></button>
                        </div>
                        <div className="h-4 w-[1px] bg-white/20"></div>
                        <button onClick={() => setIsPresenting(false)} className="text-xs font-medium bg-red-500 hover:bg-red-400 text-white px-4 py-1.5 rounded-full transition-colors">Sair</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}
