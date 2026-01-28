
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
  FunctionSquare, BarChart3, AtSign
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
    rotation: number; 
    content: string; 
    style: {
        fontSize?: number;
        fontFamily?: string;
        fontWeight?: string;
        fontStyle?: string;
        textDecoration?: string;
        color?: string;
        backgroundColor?: string;
        textAlign?: 'left' | 'center' | 'right' | 'justify';
        borderRadius?: number;
        border?: string;
        opacity?: number;
        zIndex?: number; 
    };
}

interface SlideData {
    id: string;
    elements: SlideElement[];
    background: string;
    notes: string;
}

// --- SHEET ENGINE TYPES ---
interface CellData {
    value: string;
    style?: React.CSSProperties;
}

interface AlignmentGuide {
    type: 'vertical' | 'horizontal';
    position: number;
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

export default function EditorApp({ onClose, type, data }: EditorAppProps) {
  // --- GLOBAL STATE ---
  const [title, setTitle] = useState(data?.name || (type === 'doc' ? 'Documento sem título' : type === 'sheet' ? 'Planilha sem título' : 'Apresentação sem título'));
  const [saved, setSaved] = useState(true);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  
  // --- FORMAT STATE (Shared) ---
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [textAlign, setTextAlign] = useState<string>('left');
  const [fontSize, setFontSize] = useState<number>(14);
  const [fontColor, setFontColor] = useState<string>('#000000');
  const [bgColor, setBgColor] = useState<string>('transparent');

  // --- DOCS & SHEETS STATE ---
  const [wordCount, setWordCount] = useState(0);
  const [selectedCell, setSelectedCell] = useState<{r:number, c:number} | null>({r:0, c:0});
  const [sheetData, setSheetData] = useState<{[key:string]: CellData}>({});
  const [formulaValue, setFormulaValue] = useState('');
  
  // Smart Chips State (Docs)
  const [mentionMenu, setMentionMenu] = useState<{x: number, y: number, query: string} | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  // --- SLIDES STATE ---
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [slides, setSlides] = useState<SlideData[]>([
      { 
          id: '1', 
          background: '#ffffff', 
          notes: '',
          elements: [
              { id: 'e1', type: 'text', x: 80, y: 150, w: 800, h: 100, rotation: 0, content: 'Clique para adicionar um título', style: { fontSize: 42, fontWeight: '400', textAlign: 'center', color: '#000000', fontFamily: 'Arial' } },
              { id: 'e2', type: 'text', x: 230, y: 280, w: 500, h: 50, rotation: 0, content: 'Clique para adicionar um subtítulo', style: { fontSize: 20, textAlign: 'center', color: '#5f6368', fontFamily: 'Arial' } }
          ] 
      }
  ]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isPresenting, setIsPresenting] = useState(false);
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, elementId: string} | null>(null);
  const [slideContextMenu, setSlideContextMenu] = useState<{x: number, y: number, slideIndex: number} | null>(null);
  const [draggedSlideIndex, setDraggedSlideIndex] = useState<number | null>(null);
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [showBgMenu, setShowBgMenu] = useState(false);
  const [zoom, setZoom] = useState(0.55); // Default zoom scale
  
  // --- HISTORY & CLIPBOARD ---
  const [history, setHistory] = useState<any[]>([]);
  const [future, setFuture] = useState<any[]>([]);
  const [clipboard, setClipboard] = useState<SlideElement | null>(null); // Internal clipboard for elements
  const [isDragging, setIsDragging] = useState(false);

  // --- SMART GUIDES STATE ---
  const [activeGuides, setActiveGuides] = useState<AlignmentGuide[]>([]);

  // Drag & Resize State
  const [dragInfo, setDragInfo] = useState<{ 
      id: string, 
      startX: number, 
      startY: number, 
      initialX: number, 
      initialY: number, 
      initialW: number, 
      initialH: number,
      initialRotation: number,
      mode: 'move' | 'rotate' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' 
  } | null>(null);

  // --- AI STATE ---
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  
  // --- REFS ---
  const aiClient = useRef<GoogleGenAI | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presentationRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null); // Ref for zoom calculation

  // --- INIT ---
  useEffect(() => {
      try {
          if (process.env.API_KEY) {
              aiClient.current = new GoogleGenAI({ apiKey: process.env.API_KEY });
          }
      } catch (e) { console.error("Gemini init error", e); }
  }, []);

  useEffect(() => {
      const closeMenu = () => { 
          setContextMenu(null); 
          setSlideContextMenu(null);
          setShowShapeMenu(false);
          setShowBgMenu(false);
          setMentionMenu(null);
      };
      window.addEventListener('click', closeMenu);
      return () => window.removeEventListener('click', closeMenu);
  }, []);

  // --- ZOOM HANDLING ---
  const handleZoom = (delta: number) => {
      setZoom(prev => Math.min(2, Math.max(0.1, prev + delta)));
  };
  
  const fitZoom = () => {
      if (canvasRef.current) {
          const parent = canvasRef.current.parentElement;
          if (parent) {
              const wRatio = (parent.clientWidth - 64) / 960; // 32px padding on each side
              const hRatio = (parent.clientHeight - 64) / 540;
              setZoom(Math.min(wRatio, hRatio));
          }
      }
  };

  // Initial Fit
  useEffect(() => {
      if (type === 'slide') setTimeout(fitZoom, 100);
  }, [type]);

  // --- HISTORY MANAGEMENT ---
  const saveHistory = () => {
      let stateToSave;
      if (type === 'slide') stateToSave = JSON.parse(JSON.stringify(slides));
      else if (type === 'sheet') stateToSave = JSON.parse(JSON.stringify(sheetData));
      
      if(stateToSave) {
          setHistory(prev => {
              const newHistory = [...prev, stateToSave];
              if (newHistory.length > 30) newHistory.shift();
              return newHistory;
          });
          setFuture([]);
      }
  };

  const handleUndo = () => {
      if (history.length === 0) return;
      const previousState = history[history.length - 1];
      const newHistory = history.slice(0, -1);
      
      if (type === 'slide') {
          setFuture(prev => [slides, ...prev]);
          setSlides(previousState);
      } else if (type === 'sheet') {
          setFuture(prev => [sheetData, ...prev]);
          setSheetData(previousState);
      }
      
      setHistory(newHistory);
  };

  const handleRedo = () => {
      if (future.length === 0) return;
      const nextState = future[0];
      const newFuture = future.slice(1);
      
      if (type === 'slide') {
          setHistory(prev => [...prev, slides]);
          setSlides(nextState);
      } else if (type === 'sheet') {
          setHistory(prev => [...prev, sheetData]);
          setSheetData(nextState);
      }
      
      setFuture(newFuture);
  };

  // Override handleFormat for Slides & Sheets
  const handleFormat = (command: string, value: any = undefined) => {
      if (type === 'slide') {
          if (command === 'undo') { handleUndo(); return; }
          if (command === 'redo') { handleRedo(); return; }
          if(selectedElementId) {
             saveHistory();
             if(command === 'bold') updateSlideElementStyle('fontWeight', isBold ? 'normal' : 'bold');
             if(command === 'italic') updateSlideElementStyle('fontStyle', isItalic ? 'normal' : 'italic');
             if(command === 'underline') updateSlideElementStyle('textDecoration', isUnderline ? 'none' : 'underline');
             if(command === 'justifyLeft') updateSlideElementStyle('textAlign', 'left');
             if(command === 'justifyCenter') updateSlideElementStyle('textAlign', 'center');
             if(command === 'justifyRight') updateSlideElementStyle('textAlign', 'right');
             if(command === 'justifyFull') updateSlideElementStyle('textAlign', 'justify');
             if(command === 'foreColor') updateSlideElementStyle('color', value);
             if(command === 'hiliteColor') updateSlideElementStyle('backgroundColor', value);
             if(command === 'fontSize') updateSlideElementStyle('fontSize', parseInt(value));
          }
      } else if (type === 'sheet') {
          if (command === 'undo') { handleUndo(); return; }
          if (command === 'redo') { handleRedo(); return; }
          if (selectedCell) {
              saveHistory();
              const id = getCellId(selectedCell.r, selectedCell.c);
              const currentCell = sheetData[id] || { value: '' };
              const currentStyle = currentCell.style || {};
              
              let newStyle = { ...currentStyle };
              
              if(command === 'bold') newStyle.fontWeight = newStyle.fontWeight === 'bold' ? 'normal' : 'bold';
              if(command === 'italic') newStyle.fontStyle = newStyle.fontStyle === 'italic' ? 'normal' : 'italic';
              if(command === 'underline') newStyle.textDecoration = newStyle.textDecoration === 'underline' ? 'none' : 'underline';
              if(command === 'foreColor') newStyle.color = value;
              if(command === 'hiliteColor') newStyle.backgroundColor = value;
              if(command === 'justifyLeft') newStyle.textAlign = 'left';
              if(command === 'justifyCenter') newStyle.textAlign = 'center';
              if(command === 'justifyRight') newStyle.textAlign = 'right';

              setSheetData(prev => ({ ...prev, [id]: { ...currentCell, style: newStyle } }));
              
              // Update local state for UI feedback
              if(command === 'bold') setIsBold(newStyle.fontWeight === 'bold');
              if(command === 'italic') setIsItalic(newStyle.fontStyle === 'italic');
              if(command === 'underline') setIsUnderline(newStyle.textDecoration === 'underline');
              if(command === 'foreColor') setFontColor(value);
              if(command === 'hiliteColor') setBgColor(value);
              
              triggerSave();
          }
      } else {
          document.execCommand(command, false, value);
          checkFormatState();
          editorRef.current?.focus();
      }
  };

  // ... (Load Data, Auto Save logic same as before) ...
  
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
                          const parsed = JSON.parse(decoded);
                          // Compatibility check: old format vs new CellData format
                          const migratedData: {[key:string]: CellData} = {};
                          Object.keys(parsed).forEach(key => {
                              if (typeof parsed[key] === 'string') {
                                  migratedData[key] = { value: parsed[key] };
                              } else {
                                  migratedData[key] = parsed[key];
                              }
                          });
                          setSheetData(migratedData);
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

  const triggerSave = useCallback(() => {
      setSaved(false);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
          if (!data?.id) { setSaved(true); return; }
          let contentToSave = '';
          if (type === 'doc' && editorRef.current) contentToSave = editorRef.current.innerHTML;
          else if (type === 'sheet') contentToSave = JSON.stringify(sheetData);
          else if (type === 'slide') contentToSave = JSON.stringify(slides);
          if (contentToSave) { await bridge.saveFileContent(data.id, contentToSave); setSaved(true); }
      }, 2000);
  }, [data, type, sheetData, slides]);

  const updateSlideElementStyle = (prop: string, value: any) => {
      setSlides(prev => {
          const newSlides = [...prev];
          const slide = newSlides[currentSlideIndex];
          const elIndex = slide.elements.findIndex(e => e.id === selectedElementId);
          if (elIndex > -1) {
              slide.elements[elIndex] = {
                  ...slide.elements[elIndex],
                  ...(['x', 'y', 'w', 'h', 'rotation', 'content'].includes(prop) ? { [prop]: value } : {
                      style: { ...slide.elements[elIndex].style, [prop]: value }
                  })
              };
          }
          return newSlides;
      });
      if (prop === 'fontWeight') setIsBold(value === 'bold');
      if (prop === 'fontStyle') setIsItalic(value === 'italic');
      if (prop === 'textDecoration') setIsUnderline(value === 'underline');
      if (prop === 'textAlign') setTextAlign(value);
      if (prop === 'fontSize') setFontSize(value);
      if (prop === 'color') setFontColor(value);
      if (prop === 'backgroundColor') setBgColor(value);
      triggerSave();
  };

  const getEl = (id: string | null) => slides[currentSlideIndex].elements.find(e => e.id === id);

  useEffect(() => {
      if (type === 'slide' && selectedElementId) {
          const el = getEl(selectedElementId);
          if (el) {
              setIsBold(el.style.fontWeight === 'bold');
              setIsItalic(el.style.fontStyle === 'italic');
              setIsUnderline(el.style.textDecoration === 'underline');
              setTextAlign(el.style.textAlign || 'left');
              setFontSize(el.style.fontSize || 14);
              setFontColor(el.style.color || '#000000');
              setBgColor(el.style.backgroundColor || 'transparent');
          }
      }
  }, [selectedElementId, currentSlideIndex]);

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

  // --- DOC EDITOR LOGIC (MENTIONS & SMART CHIPS) ---
  const handleDocKeyUp = (e: React.KeyboardEvent) => {
      checkFormatState();
      
      if (type !== 'doc') return;

      if (e.key === '@') {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              const rect = range.getBoundingClientRect();
              if (editorRef.current) {
                   const containerRect = editorRef.current.getBoundingClientRect();
                   setMentionMenu({ 
                       x: rect.left - containerRect.left + 40, 
                       y: rect.bottom - containerRect.top + 20, 
                       query: '' 
                   });
              }
          }
      } else if (mentionMenu) {
          if (e.key === 'Escape') {
              setMentionMenu(null);
          } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              setMentionIndex(prev => Math.min(prev + 1, 4));
          } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setMentionIndex(prev => Math.max(prev - 1, 0));
          } else if (e.key === 'Enter') {
              e.preventDefault();
              insertSmartChip('person', 'Usuário Exemplo', 'usuario@exemplo.com');
          }
      }
  };

  const insertSmartChip = (chipType: 'person' | 'date' | 'file', label: string, detail?: string) => {
      setMentionMenu(null);
      const chip = document.createElement('span');
      chip.contentEditable = 'false';
      chip.className = 'inline-flex items-center gap-1 px-1.5 py-0.5 mx-1 rounded-full bg-[#E8F0FE] text-[#1967D2] text-sm font-medium border border-transparent hover:bg-[#D2E3FC] hover:border-[#1967D2]/20 cursor-pointer select-none transition-colors';
      chip.innerHTML = `<span class="pointer-events-none">${chipType === 'person' ? '@' : ''}${label}</span>`;
      
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          document.execCommand('delete', false); 
          range.insertNode(chip);
          range.setStartAfter(chip);
          range.setEndAfter(chip);
          selection.removeAllRanges();
          selection.addRange(range);
          document.execCommand('insertText', false, ' ');
      }
      editorRef.current?.focus();
      triggerSave();
  };

  const handleDocInput = (e: React.FormEvent) => { 
      checkFormatState(); 
  };

  const getCellId = (r: number, c: number) => `${String.fromCharCode(65+c)}${r+1}`;
  
  // --- SHEETS FORMULA ENGINE ---
  const evaluateFormula = (expression: string, cells: {[key:string]: CellData}) => {
      if (!expression.startsWith('=')) return expression;
      let exp = expression.substring(1).toUpperCase();
      try {
          const rangeRegex = /([A-Z]+)(\d+):([A-Z]+)(\d+)/g;
          exp = exp.replace(rangeRegex, (match, c1, r1, c2, r2) => {
              const startCol = c1.charCodeAt(0) - 65;
              const startRow = parseInt(r1) - 1;
              const endCol = c2.charCodeAt(0) - 65;
              const endRow = parseInt(r2) - 1;
              let values = [];
              for (let r = startRow; r <= endRow; r++) {
                  for (let c = startCol; c <= endCol; c++) {
                      const id = getCellId(r, c);
                      const val = parseFloat(cells[id]?.value || '0');
                      if (!isNaN(val)) values.push(val);
                  }
              }
              return `[${values.join(',')}]`;
          });

          const refRegex = /([A-Z]+)(\d+)/g;
          exp = exp.replace(refRegex, (match, col, row) => {
              const id = `${col}${row}`;
              const val = cells[id]?.value;
              return val ? (isNaN(parseFloat(val)) ? `"${val}"` : val) : "0";
          });

          const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
          const avg = (arr: number[]) => sum(arr) / arr.length;
          const max = (arr: number[]) => Math.max(...arr);
          const min = (arr: number[]) => Math.min(...arr);

          const result = new Function('SUM', 'AVG', 'AVERAGE', 'MAX', 'MIN', `return ${exp}`)(sum, avg, avg, max, min);
          return isNaN(result) ? "#ERRO" : result;
      } catch (e) { return "#ERRO"; }
  };

  const handleCellClick = (r: number, c: number) => { 
      setSelectedCell({r, c}); 
      const id = getCellId(r, c);
      setFormulaValue(sheetData[id]?.value || '');
      
      // Update format state for toolbar feedback
      const style = sheetData[id]?.style || {};
      setIsBold(style.fontWeight === 'bold');
      setIsItalic(style.fontStyle === 'italic');
      setIsUnderline(style.textDecoration === 'underline');
      setFontColor(style.color || '#000000');
      setBgColor(style.backgroundColor || 'transparent');
  };
  
  const handleCellChange = (val: string) => { 
      if (selectedCell) { 
          const id = getCellId(selectedCell.r, selectedCell.c); 
          const prevCell = sheetData[id] || {};
          setSheetData(prev => ({...prev, [id]: { ...prevCell, value: val }})); 
          setFormulaValue(val); 
          triggerSave(); 
      } 
  };

  const handleSheetAiInsights = async () => {
      if (!aiClient.current) return;
      let csv = "";
      for (let r=0; r<10; r++) {
          let row = [];
          for (let c=0; c<5; c++) {
              row.push(sheetData[getCellId(r,c)]?.value || "");
          }
          if (row.some(x => x)) csv += row.join(",") + "\n";
      }
      if (!csv) { alert("Planilha vazia."); return; }
      setShowAiPanel(true);
      setAiPrompt("Analisando dados...");
      try {
          const response = await aiClient.current.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: `Analyze this spreadsheet data (CSV format) and provide 3 brief, bulleted insights or trends:\n\n${csv}`
          });
          setAiResponse(response.text || "Sem insights.");
          setAiPrompt("");
      } catch (e) {
          setAiResponse("Erro ao gerar insights.");
      }
  };

  // --- SLIDE MODIFICATION HELPERS ---
  const addSlideElement = (elType: 'text' | 'shape' | 'image', content: string = '') => {
      saveHistory(); 
      const isShape = elType === 'shape';
      const shapeType = isShape ? (content || 'rect') : null;
      const newElement: SlideElement = {
          id: Date.now().toString(),
          type: elType,
          x: 100, y: 100,
          w: elType === 'text' ? 400 : 150,
          h: elType === 'text' ? 60 : 150,
          rotation: 0,
          content: elType === 'text' ? 'Novo Texto' : (isShape ? shapeType! : content),
          style: { 
              fontSize: elType === 'text' ? 24 : 0, 
              color: '#000000', 
              backgroundColor: isShape ? '#dadce0' : 'transparent',
              textAlign: 'left',
              fontFamily: 'Arial',
              zIndex: slides[currentSlideIndex].elements.length + 1
          }
      };
      if (shapeType === 'circle') newElement.style.borderRadius = 999;
      
      const newSlides = [...slides];
      newSlides[currentSlideIndex].elements.push(newElement);
      setSlides(newSlides);
      setSelectedElementId(newElement.id);
      triggerSave();
  };

  const handleElementContentChange = (val: string) => {
      if (selectedElementId) updateSlideElementStyle('content', val);
  };

  const deleteSelectedElement = () => {
      if(selectedElementId) {
          saveHistory();
          const newSlides = [...slides];
          newSlides[currentSlideIndex].elements = newSlides[currentSlideIndex].elements.filter(e => e.id !== selectedElementId);
          setSlides(newSlides);
          setSelectedElementId(null);
          triggerSave();
      }
  }

  const handleLayer = (action: 'front' | 'back') => {
      if(!selectedElementId || !contextMenu) return;
      saveHistory();
      const elId = contextMenu.elementId;
      const newSlides = [...slides];
      const elements = newSlides[currentSlideIndex].elements;
      const idx = elements.findIndex(e => e.id === elId);
      if(idx > -1) {
          const el = elements.splice(idx, 1)[0];
          if(action === 'front') elements.push(el);
          else elements.unshift(el);
          setSlides(newSlides);
          triggerSave();
      }
      setContextMenu(null);
  };
  
  const addNewSlide = () => {
      saveHistory();
      const newSlide: SlideData = { id: Date.now().toString(), background: '#ffffff', notes: '', elements: [] };
      setSlides([...slides, newSlide]);
      setCurrentSlideIndex(slides.length);
      triggerSave();
  };
  
  const duplicateSlide = (index: number) => {
      saveHistory();
      const srcSlide = slides[index];
      const newSlide = { ...JSON.parse(JSON.stringify(srcSlide)), id: Date.now().toString() };
      const newSlides = [...slides];
      newSlides.splice(index + 1, 0, newSlide);
      setSlides(newSlides);
      setCurrentSlideIndex(index + 1);
      triggerSave();
  };

  const deleteSlide = (index: number) => {
      if (slides.length <= 1) return;
      saveHistory();
      const newSlides = slides.filter((_, i) => i !== index);
      setSlides(newSlides);
      if (currentSlideIndex >= newSlides.length) setCurrentSlideIndex(newSlides.length - 1);
      triggerSave();
  };
  
  const changeBackground = (color: string) => {
      saveHistory();
      const newSlides = [...slides];
      newSlides[currentSlideIndex].background = color;
      setSlides(newSlides);
      triggerSave();
      setShowBgMenu(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const reader = new FileReader();
          reader.onload = (ev) => { if (ev.target?.result) addSlideElement('image', ev.target.result as string); };
          reader.readAsDataURL(e.target.files[0]);
      }
  };

  // --- DRAG & DROP SLIDES ---
  const handleDragStart = (e: React.DragEvent, index: number) => { setDraggedSlideIndex(index); e.dataTransfer.effectAllowed = "move"; };
  const handleDragOver = (e: React.DragEvent, index: number) => { e.preventDefault(); if (draggedSlideIndex === null || draggedSlideIndex === index) return; const newSlides = [...slides]; const draggedSlide = newSlides[draggedSlideIndex]; newSlides.splice(draggedSlideIndex, 1); newSlides.splice(index, 0, draggedSlide); setSlides(newSlides); setDraggedSlideIndex(index); if (currentSlideIndex === draggedSlideIndex) setCurrentSlideIndex(index); };
  const handleDragEnd = () => { setDraggedSlideIndex(null); triggerSave(); };

  // --- MOUSE HANDLERS (SMART GUIDES & MOVE) ---
  const handleSlideMouseDown = (e: React.MouseEvent, elId: string, mode: any = 'move') => {
      e.stopPropagation();
      if(e.button === 2) { setSelectedElementId(elId); setContextMenu({ x: e.clientX, y: e.clientY, elementId: elId }); return; }
      saveHistory(); 
      setSelectedElementId(elId);
      const el = slides[currentSlideIndex].elements.find(x => x.id === elId);
      if (el) {
          setIsDragging(true);
          setDragInfo({ id: elId, startX: e.clientX, startY: e.clientY, initialX: el.x, initialY: el.y, initialW: el.w, initialH: el.h, initialRotation: el.rotation, mode });
      }
  };

  const handleSlideMouseMove = (e: React.MouseEvent) => {
      if (!dragInfo) return;
      let dx = (e.clientX - dragInfo.startX) / zoom;
      let dy = (e.clientY - dragInfo.startY) / zoom;
      const newSlides = [...slides];
      const el = newSlides[currentSlideIndex].elements.find(x => x.id === dragInfo.id);
      
      if (el) {
          if (dragInfo.mode === 'move') {
              let newX = dragInfo.initialX + dx;
              let newY = dragInfo.initialY + dy;
              
              const SNAP_THRESHOLD = 5 / zoom;
              const SLIDE_WIDTH = 960;
              const SLIDE_HEIGHT = 540;
              const newGuides: AlignmentGuide[] = [];

              if (Math.abs((newX + el.w/2) - SLIDE_WIDTH/2) < SNAP_THRESHOLD) { newX = (SLIDE_WIDTH/2) - (el.w/2); newGuides.push({ type: 'vertical', position: SLIDE_WIDTH/2 }); }
              if (Math.abs((newY + el.h/2) - SLIDE_HEIGHT/2) < SNAP_THRESHOLD) { newY = (SLIDE_HEIGHT/2) - (el.h/2); newGuides.push({ type: 'horizontal', position: SLIDE_HEIGHT/2 }); }

              setActiveGuides(newGuides);
              el.x = newX;
              el.y = newY;
          } else if (dragInfo.mode === 'rotate') {
              el.rotation = (dragInfo.initialRotation + dx * 0.5) % 360;
          } else {
              if (dragInfo.mode.includes('e')) el.w = Math.max(10, dragInfo.initialW + dx);
              if (dragInfo.mode.includes('s')) el.h = Math.max(10, dragInfo.initialH + dy);
              if (dragInfo.mode.includes('w')) { const newW = Math.max(10, dragInfo.initialW - dx); el.x = dragInfo.initialX + (dragInfo.initialW - newW); el.w = newW; }
              if (dragInfo.mode.includes('n')) { const newH = Math.max(10, dragInfo.initialH - dy); el.y = dragInfo.initialY + (dragInfo.initialH - newH); el.h = newH; }
          }
          setSlides(newSlides);
      }
  };

  const handleSlideMouseUp = () => { if (dragInfo) triggerSave(); setDragInfo(null); setIsDragging(false); setActiveGuides([]); };

  // --- KEYBOARD SHORTCUTS & CLIPBOARD ---
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (type === 'slide') {
              const isCtrl = e.ctrlKey || e.metaKey;
              if (isCtrl && e.key === 'z') { e.preventDefault(); if (e.shiftKey) handleRedo(); else handleUndo(); }
              if (isPresenting) {
                  if (e.key === 'ArrowRight' || e.key === ' ') setCurrentSlideIndex(prev => Math.min(prev + 1, slides.length - 1));
                  if (e.key === 'ArrowLeft') setCurrentSlideIndex(prev => Math.max(prev - 1, 0));
                  if (e.key === 'Escape') setIsPresenting(false);
              } else {
                  if (selectedElementId) {
                      if (e.key === 'Delete' || e.key === 'Backspace') { 
                          if (document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'INPUT') deleteSelectedElement(); 
                      }
                      if (isCtrl && e.key === 'c') {
                          const el = getEl(selectedElementId);
                          if (el && document.activeElement?.tagName !== 'TEXTAREA') {
                              setClipboard(JSON.parse(JSON.stringify(el)));
                          }
                      }
                  }
                  if (isCtrl && e.key === 'v') {
                      if (clipboard && document.activeElement?.tagName !== 'TEXTAREA') {
                          saveHistory();
                          const newEl = { ...JSON.parse(JSON.stringify(clipboard)), id: Date.now().toString(), x: clipboard.x + 20, y: clipboard.y + 20 };
                          const newSlides = [...slides];
                          newSlides[currentSlideIndex].elements.push(newEl);
                          setSlides(newSlides);
                          setSelectedElementId(newEl.id);
                          triggerSave();
                      }
                  }
              }
          } else if (type === 'sheet') {
              const isCtrl = e.ctrlKey || e.metaKey;
              if (isCtrl && e.key === 'z') { e.preventDefault(); if (e.shiftKey) handleRedo(); else handleUndo(); }
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, slides, history, future, type, isPresenting, clipboard, sheetData]);

  // --- AI ---
  const handleAiGenerate = async () => { 
      if (!aiPrompt.trim() || !aiClient.current) return;
      setAiResponse(null);
      try {
          const response = await aiClient.current.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: aiPrompt,
          });
          setAiResponse(response.text || "Sem resposta");
      } catch (e) {
          setAiResponse("Erro ao gerar resposta.");
      }
  };
  const insertAiContent = () => { /* ... logic ... */ };

  return (
    <div className="flex flex-col h-full bg-[#F9FBFD] animate-in fade-in duration-300 font-sans relative text-[#1f1f1f]">
        
        {/* HEADER */}
        <div className="h-16 px-4 flex items-center justify-between bg-white z-20 shrink-0 border-b border-[#dadce0]">
            <div className="flex items-center gap-3 w-1/3">
                <div onClick={onClose} className="cursor-pointer hover:opacity-80 transition-opacity">{getFileIcon(type)}</div>
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="text-lg text-[#1f1f1f] font-normal outline-none border border-transparent hover:border-black/20 focus:border-blue-500 rounded px-1 -ml-1 transition-all h-7 w-64 truncate" />
                        {saved ? <div title="Salvo no Drive" className="text-gray-500"><Check size={14}/></div> : <div className="text-gray-400 text-xs animate-pulse">Salvando...</div>}
                    </div>
                    <div className="flex gap-3 text-[13px] text-[#444746] select-none">
                        <span className="hover:bg-[#f0f4f9] px-1.5 rounded cursor-pointer">Arquivo</span>
                        <span className="hover:bg-[#f0f4f9] px-1.5 rounded cursor-pointer">Editar</span>
                        <span className="hover:bg-[#f0f4f9] px-1.5 rounded cursor-pointer">Ver</span>
                        <span className="hover:bg-[#f0f4f9] px-1.5 rounded cursor-pointer">Inserir</span>
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
                <button onClick={onClose} className="p-2 hover:bg-red-50 text-gray-500 hover:text-red-500 rounded-full transition-colors ml-2"><X size={22}/></button>
            </div>
        </div>
        
        {/* TOOLBAR */}
        <div className="bg-[#EDF2FA] mx-3 my-2 rounded-full flex items-center px-4 py-1.5 gap-1 overflow-x-auto custom-scrollbar shrink-0 shadow-sm border border-white/50 h-11">
             <ToolbarButton onClick={() => handleFormat('undo')} disabled={history.length === 0} title="Desfazer (Ctrl+Z)"><Undo size={18}/></ToolbarButton>
             <ToolbarButton onClick={() => handleFormat('redo')} disabled={future.length === 0} title="Refazer (Ctrl+Shift+Z)"><Redo size={18}/></ToolbarButton>
             <Divider />
             
             {type === 'slide' && (
                 <>
                    <button onClick={() => handleZoom(-0.1)} className="hover:bg-gray-100 p-1 rounded" title="Reduzir Zoom"><ZoomOut size={16}/></button>
                    <button onClick={fitZoom} className="text-xs font-medium px-2 py-1 hover:bg-gray-100 rounded min-w-[3rem]" title="Ajustar à tela">{Math.round(zoom * 100)}%</button>
                    <button onClick={() => handleZoom(0.1)} className="hover:bg-gray-100 p-1 rounded" title="Aumentar Zoom"><ZoomIn size={16}/></button>
                    <button onClick={fitZoom} className="hover:bg-gray-100 p-1 rounded" title="Ajustar"><FitScreen size={14}/></button>
                    <Divider />
                 </>
             )}

             <div className="flex items-center gap-1 bg-white border border-[#c7c7c7] rounded h-7 px-1 mx-1">
                 <button onClick={() => handleFormat('fontSize', Math.max(8, fontSize - 1))} className="hover:bg-gray-100 p-0.5 rounded"><Minus size={12}/></button>
                 <span className="text-sm font-medium w-6 text-center select-none">{fontSize}</span>
                 <button onClick={() => handleFormat('fontSize', Math.min(96, fontSize + 1))} className="hover:bg-gray-100 p-0.5 rounded"><Plus size={12}/></button>
             </div>
             <Divider />
             <ToolbarButton onClick={() => handleFormat('bold')} active={isBold} title="Negrito"><Bold size={18}/></ToolbarButton>
             <ToolbarButton onClick={() => handleFormat('italic')} active={isItalic} title="Itálico"><Italic size={18}/></ToolbarButton>
             <ToolbarButton onClick={() => handleFormat('underline')} active={isUnderline} title="Sublinhado"><Underline size={18}/></ToolbarButton>
             <div className="relative group flex flex-col items-center justify-center h-8 w-8 cursor-pointer hover:bg-[#1f1f1f]/5 rounded-[4px] mx-0.5">
                 <span className="font-bold text-sm leading-none mt-1 select-none">A</span>
                 <div className="w-4 h-1 mt-0.5" style={{backgroundColor: fontColor}}></div>
                 <input type="color" className="absolute inset-0 opacity-0 cursor-pointer" value={fontColor} onChange={(e) => handleFormat('foreColor', e.target.value)} title="Cor do Texto"/>
             </div>
             {(type === 'slide' || type === 'sheet') && (
                 <div className="relative group flex flex-col items-center justify-center h-8 w-8 cursor-pointer hover:bg-[#1f1f1f]/5 rounded-[4px] mx-0.5">
                    <div className="relative"><PaintRoller size={16} /><div className="absolute -bottom-1 left-0 right-0 h-1" style={{backgroundColor: bgColor !== 'transparent' ? bgColor : '#ccc'}}></div></div>
                    <input type="color" className="absolute inset-0 opacity-0 cursor-pointer" value={bgColor === 'transparent' ? '#ffffff' : bgColor} onChange={(e) => handleFormat('hiliteColor', e.target.value)} title="Cor de Preenchimento"/>
                 </div>
             )}
             
             {type === 'sheet' && (
                 <>
                    <Divider/>
                    <ToolbarButton onClick={() => handleFormat('justifyLeft')} active={textAlign === 'left'} title="Esquerda"><AlignLeft size={18}/></ToolbarButton>
                    <ToolbarButton onClick={() => handleFormat('justifyCenter')} active={textAlign === 'center'} title="Centro"><AlignCenter size={18}/></ToolbarButton>
                    <ToolbarButton onClick={() => handleFormat('justifyRight')} active={textAlign === 'right'} title="Direita"><AlignRight size={18}/></ToolbarButton>
                    <Divider/>
                    <ToolbarButton onClick={handleSheetAiInsights} title="Insights com IA" className="text-blue-600 bg-blue-50 hover:bg-blue-100 font-medium px-2 w-auto gap-1"><Sparkles size={14}/> Insights</ToolbarButton>
                 </>
             )}

             <Divider />
             
            {type === 'slide' && (
                <>
                    <ToolbarButton onClick={() => addSlideElement('text')} title="Caixa de Texto"><TypeIcon size={18}/></ToolbarButton>
                    <div className="relative">
                        <ToolbarButton onClick={() => fileInputRef.current?.click()} title="Inserir Imagem"><ImageIcon size={18}/></ToolbarButton>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </div>
                    <div className="relative">
                        <ToolbarButton onClick={() => setShowShapeMenu(!showShapeMenu)} active={showShapeMenu} title="Forma"><Square size={18}/></ToolbarButton>
                        {showShapeMenu && (
                            <div className="absolute top-full left-0 mt-1 bg-white border border-[#dadce0] rounded-lg shadow-xl p-2 grid grid-cols-4 gap-1 z-50">
                                <button onClick={() => { addSlideElement('shape', 'rect'); setShowShapeMenu(false); }} className="p-2 hover:bg-gray-100 rounded" title="Retângulo"><Square size={16}/></button>
                                <button onClick={() => { addSlideElement('shape', 'circle'); setShowShapeMenu(false); }} className="p-2 hover:bg-gray-100 rounded" title="Círculo"><Circle size={16}/></button>
                                <button onClick={() => { addSlideElement('shape', 'triangle'); setShowShapeMenu(false); }} className="p-2 hover:bg-gray-100 rounded" title="Triângulo"><TriangleIcon size={16}/></button>
                                <button onClick={() => { addSlideElement('shape', 'arrow'); setShowShapeMenu(false); }} className="p-2 hover:bg-gray-100 rounded" title="Seta"><ArrowRight size={16}/></button>
                            </div>
                        )}
                    </div>
                    <Divider/>
                    <div className="relative">
                        <ToolbarButton onClick={() => setShowBgMenu(!showBgMenu)} active={showBgMenu} title="Plano de Fundo"><span className="text-xs font-medium">Fundo</span></ToolbarButton>
                        {showBgMenu && (
                            <div className="absolute top-full left-0 mt-1 bg-white border border-[#dadce0] rounded-lg shadow-xl p-3 z-50 w-48">
                                <p className="text-xs font-bold text-gray-500 mb-2">Cor Sólida</p>
                                <div className="grid grid-cols-5 gap-1">
                                    {['#ffffff', '#000000', '#f2f2f2', '#dadce0', '#fbbc04', '#4285f4', '#ea4335', '#34a853', '#46bdc6', '#ff00ff'].map(c => (
                                        <button key={c} onClick={() => changeBackground(c)} className="w-6 h-6 rounded-full border border-gray-200" style={{backgroundColor: c}}></button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>

        <div className="flex-1 bg-[#F0F2F5] overflow-hidden flex relative flex-col">
            {isLoadingContent && (<div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80"><Loader2 size={32} className="animate-spin text-blue-500"/></div>)}
            
            {/* --- DOC EDITOR --- */}
            {type === 'doc' && (
                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col items-center bg-[#F9FBFD]" onClick={() => editorRef.current?.focus()}>
                    <div 
                        className="w-[816px] min-h-[1056px] bg-white shadow-md border border-[#dadce0] px-24 py-20 outline-none text-[#1f1f1f] mt-4 relative" 
                        ref={editorRef} 
                        contentEditable 
                        suppressContentEditableWarning 
                        onInput={handleDocInput}
                        onKeyUp={handleDocKeyUp}
                    ></div>
                    
                    {/* SMART CHIP MENU */}
                    {mentionMenu && (
                        <div 
                            className="absolute z-50 bg-white border border-[#dadce0] rounded-lg shadow-xl w-64 overflow-hidden animate-in fade-in zoom-in duration-200"
                            style={{ top: mentionMenu.y, left: mentionMenu.x }}
                        >
                            <div className="px-3 py-2 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase">Pessoas</div>
                            {['Julia Silva', 'Roberto Alves', 'Ana Costa', 'Carlos Lima'].map((p, i) => (
                                <button key={i} onClick={() => insertSmartChip('person', p)} className="w-full text-left px-3 py-2 text-sm hover:bg-[#e8f0fe] flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">{p[0]}</div>
                                    {p}
                                </button>
                            ))}
                            <div className="px-3 py-2 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase border-t border-gray-100">Datas</div>
                            <button onClick={() => insertSmartChip('date', 'Hoje')} className="w-full text-left px-3 py-2 text-sm hover:bg-[#e8f0fe]">@Hoje</button>
                            <button onClick={() => insertSmartChip('date', 'Amanhã')} className="w-full text-left px-3 py-2 text-sm hover:bg-[#e8f0fe]">@Amanhã</button>
                        </div>
                    )}
                </div>
            )}
            
            {/* --- SHEET EDITOR V2 (Rich Cells) --- */}
            {type === 'sheet' && (
                <div className="flex-1 overflow-auto custom-scrollbar bg-white relative flex flex-col">
                    {/* Formula Bar */}
                    <div className="h-8 flex items-center gap-2 px-3 border-b border-[#dadce0] bg-white shrink-0 sticky top-0 z-20">
                        <div className="text-xs font-bold text-[#5f6368] w-8 text-center">{selectedCell ? getCellId(selectedCell.r, selectedCell.c) : ''}</div>
                        <div className="w-[1px] h-4 bg-[#dadce0]"></div>
                        <div className="font-serif italic text-[#5f6368] font-bold select-none">fx</div>
                        <input 
                            type="text" 
                            className="flex-1 text-sm outline-none h-full border-none pl-2 text-[#1f1f1f]"
                            value={formulaValue}
                            onChange={(e) => handleCellChange(e.target.value)}
                            placeholder={selectedCell ? "Digite um valor ou fórmula (ex: =SUM(A1:A5))" : ""}
                        />
                    </div>

                    <div className="flex-1 relative overflow-auto custom-scrollbar">
                        <div className="flex flex-col min-w-full">
                            <div className="sticky top-0 z-10 flex">
                                <div className="w-10 h-6 bg-[#f8f9fa] border-b border-r border-[#c7c7c7] shrink-0 sticky left-0 z-20"></div>
                                {['A','B','C','D','E','F','G','H','I','J'].map((c, i) => (
                                    <div key={i} className="w-24 h-6 bg-[#f8f9fa] border-b border-r border-[#c7c7c7] flex items-center justify-center text-xs font-bold text-[#5f6368] shrink-0">{c}</div>
                                ))}
                            </div>
                            {[...Array(60)].map((_, r) => (
                                <div key={r} className="flex h-6">
                                    <div className="w-10 bg-[#f8f9fa] border-b border-r border-[#c7c7c7] flex items-center justify-center text-xs shrink-0 sticky left-0 z-10 font-medium text-[#5f6368]">{r+1}</div>
                                    {['A','B','C','D','E','F','G','H','I','J'].map((_, c) => {
                                        const cellId = getCellId(r, c);
                                        const cell = sheetData[cellId] || { value: '' };
                                        const rawValue = cell.value;
                                        const displayValue = evaluateFormula(rawValue, sheetData);
                                        const isSelected = selectedCell?.r === r && selectedCell?.c === c;
                                        return (
                                            <div 
                                                key={cellId}
                                                onClick={() => handleCellClick(r, c)}
                                                className={`w-24 h-full border-b border-r border-[#e7e7e7] text-xs px-1 flex items-center overflow-hidden whitespace-nowrap cursor-cell ${isSelected ? 'border-2 border-blue-500 z-10' : ''}`}
                                                style={{...cell.style}}
                                            >
                                                {displayValue}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Sheet Tabs */}
                    <div className="h-9 bg-[#f8f9fa] border-t border-[#dadce0] flex items-center px-2 gap-1 shrink-0">
                        <button className="p-1 hover:bg-[#e8eaed] rounded"><Plus size={14} className="text-[#444746]"/></button>
                        <button className="p-1 hover:bg-[#e8eaed] rounded"><Menu size={14} className="text-[#444746]"/></button>
                        <div className="bg-white px-4 py-1.5 rounded-t-lg shadow-sm text-sm font-medium text-[#188038] border-b-2 border-[#188038] cursor-pointer">Página1</div>
                    </div>
                </div>
            )}

            {/* --- SLIDE EDITOR --- */}
            {type === 'slide' && (
                <div className="w-full h-full flex" onMouseMove={handleSlideMouseMove} onMouseUp={handleSlideMouseUp} onKeyDown={(e) => e.stopPropagation()}>
                    {/* Sidebar Slides */}
                    <div className="w-48 bg-white border-r border-[#dadce0] flex flex-col gap-4 p-4 overflow-y-auto shrink-0 z-10 custom-scrollbar">
                        {slides.map((slide, i) => (
                            <div 
                                key={slide.id} 
                                draggable 
                                onDragStart={(e) => handleDragStart(e, i)}
                                onDragOver={(e) => handleDragOver(e, i)}
                                onDragEnd={handleDragEnd}
                                onContextMenu={(e) => { e.preventDefault(); setSlideContextMenu({ x: e.clientX, y: e.clientY, slideIndex: i }); }}
                                onClick={() => setCurrentSlideIndex(i)} 
                                className={`flex gap-2 cursor-pointer group ${draggedSlideIndex === i ? 'opacity-50' : 'opacity-100'}`}
                            >
                                <span className="text-xs text-[#444746] font-medium w-4 text-right pt-2">{i+1}</span>
                                <div className={`flex-1 aspect-video border-2 rounded shadow-sm relative bg-white transition-all overflow-hidden ${currentSlideIndex === i ? 'border-[#fbbc04] ring-1 ring-[#fbbc04]' : 'border-[#dadce0] group-hover:border-[#bdc1c6]'}`}>
                                    <div className="absolute inset-0 transform scale-[0.18] origin-top-left w-[555%] h-[555%] pointer-events-none select-none" style={{backgroundColor: slide.background}}>
                                        {slide.elements.map(el => (
                                            <div key={el.id} style={{
                                                position: 'absolute', left: el.x, top: el.y, width: el.w, height: el.h,
                                                transform: `rotate(${el.rotation}deg)`,
                                                backgroundColor: el.style.backgroundColor, border: '1px solid #eee', 
                                                borderRadius: el.content === 'circle' ? '50%' : '0'
                                            }}></div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                         <button onClick={addNewSlide} className="w-full py-2 border border-dashed border-[#c7c7c7] rounded text-[#444746] text-xs hover:bg-[#f0f4f9] transition-colors">+ Novo Slide</button>
                    </div>

                    {/* Main Stage with Zoom */}
                    <div className="flex-1 bg-[#F0F2F5] flex flex-col relative overflow-hidden" tabIndex={0} onClick={() => setSelectedElementId(null)}>
                        <div className="flex-1 overflow-auto custom-scrollbar relative flex items-center justify-center p-8 bg-[#E5E5E5] bg-[radial-gradient(#C7C7C7_1px,transparent_1px)] [background-size:20px_20px]" ref={slideRef}>
                            <div 
                                ref={canvasRef}
                                className="bg-white shadow-2xl relative select-none origin-center transition-transform duration-100" 
                                style={{ 
                                    width: 960, 
                                    height: 540, 
                                    backgroundColor: slides[currentSlideIndex].background,
                                    transform: `scale(${zoom})`
                                }}
                            >
                                {/* Smart Guides */}
                                {activeGuides.map((guide, i) => (
                                    <div key={i} className={`absolute bg-[#EA4335] pointer-events-none z-50 ${guide.type === 'vertical' ? 'w-[1px] h-full top-0' : 'h-[1px] w-full left-0'}`} style={guide.type === 'vertical' ? { left: guide.position } : { top: guide.position }}></div>
                                ))}

                                {slides[currentSlideIndex].elements.map(el => {
                                    const isSelected = selectedElementId === el.id;
                                    return (
                                        <div
                                            key={el.id}
                                            onMouseDown={(e) => handleSlideMouseDown(e, el.id, 'move')}
                                            style={{
                                                position: 'absolute', left: el.x, top: el.y, width: el.w, height: el.h,
                                                transform: `rotate(${el.rotation}deg)`,
                                                ...el.style,
                                                border: isSelected ? '1px solid #4285F4' : '1px solid transparent',
                                                cursor: 'move',
                                                zIndex: el.style.zIndex || 1
                                            }}
                                            className="group flex items-center justify-center"
                                        >
                                            {/* Render Content */}
                                            {el.type === 'text' ? (
                                                <textarea 
                                                    className="w-full h-full bg-transparent outline-none resize-none overflow-hidden p-2 leading-tight"
                                                    style={{...el.style, border: 'none'}}
                                                    value={el.content}
                                                    onChange={(e) => handleElementContentChange(e.target.value)}
                                                    onMouseDown={(e) => e.stopPropagation()} 
                                                    onFocus={() => setSelectedElementId(el.id)}
                                                />
                                            ) : el.type === 'image' ? (
                                                <img src={el.content} className="w-full h-full object-cover pointer-events-none" />
                                            ) : el.type === 'shape' ? (
                                                <>
                                                    {el.content === 'rect' && <div className="w-full h-full" style={{backgroundColor: el.style.backgroundColor}}></div>}
                                                    {el.content === 'circle' && <div className="w-full h-full rounded-full" style={{backgroundColor: el.style.backgroundColor}}></div>}
                                                    {el.content === 'triangle' && <div className="w-full h-full" style={{ width: 0, height: 0, borderLeft: `${el.w/2}px solid transparent`, borderRight: `${el.w/2}px solid transparent`, borderBottom: `${el.h}px solid ${el.style.backgroundColor || '#dadce0'}` }}></div>}
                                                    {el.content === 'arrow' && <div className="w-full h-full flex items-center bg-transparent"><div className="h-1/3 w-[70%]" style={{backgroundColor: el.style.backgroundColor}}></div><div className="w-0 h-0" style={{ borderTop: `${el.h/2}px solid transparent`, borderBottom: `${el.h/2}px solid transparent`, borderLeft: `${el.w*0.3}px solid ${el.style.backgroundColor}` }}></div></div>}
                                                </>
                                            ) : null}
                                            
                                            {/* Handles */}
                                            {isSelected && (
                                                <>
                                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border border-[#4285F4] rounded-full cursor-alias flex items-center justify-center" style={{transform: `scale(${1/zoom})`}} onMouseDown={(e) => handleSlideMouseDown(e, el.id, 'rotate')}><div className="w-0.5 h-3 bg-[#4285F4] absolute top-3"></div></div>
                                                    <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-[#4285F4] cursor-nwse-resize" style={{transform: `scale(${1/zoom})`}} onMouseDown={(e) => handleSlideMouseDown(e, el.id, 'nw')}></div>
                                                    <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-[#4285F4] cursor-nesw-resize" style={{transform: `scale(${1/zoom})`}} onMouseDown={(e) => handleSlideMouseDown(e, el.id, 'ne')}></div>
                                                    <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-[#4285F4] cursor-nesw-resize" style={{transform: `scale(${1/zoom})`}} onMouseDown={(e) => handleSlideMouseDown(e, el.id, 'sw')}></div>
                                                    <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-[#4285F4] cursor-nwse-resize" style={{transform: `scale(${1/zoom})`}} onMouseDown={(e) => handleSlideMouseDown(e, el.id, 'se')}></div>
                                                    <div className="absolute top-1/2 -left-1.5 w-3 h-3 bg-white border border-[#4285F4] cursor-ew-resize -translate-y-1/2" style={{transform: `scale(${1/zoom}) translateY(-50%)`}} onMouseDown={(e) => handleSlideMouseDown(e, el.id, 'w')}></div>
                                                    <div className="absolute top-1/2 -right-1.5 w-3 h-3 bg-white border border-[#4285F4] cursor-ew-resize -translate-y-1/2" style={{transform: `scale(${1/zoom}) translateY(-50%)`}} onMouseDown={(e) => handleSlideMouseDown(e, el.id, 'e')}></div>
                                                </>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                        <div className="h-12 bg-white border-t border-[#dadce0] p-1 flex items-center justify-center shrink-0">
                            <div className="text-xs text-gray-400 font-medium select-none cursor-text">Clique para adicionar anotações do orador</div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- CONTEXT MENUS (Slides) --- */}
            {contextMenu && type === 'slide' && (
                <div className="fixed z-50 bg-white border border-[#dadce0] rounded-lg shadow-xl py-1 w-48" style={{ top: contextMenu.y, left: contextMenu.x }}>
                    <button onClick={() => handleLayer('front')} className="w-full text-left flex items-center gap-3 px-4 py-2 hover:bg-[#f1f3f4] text-sm text-[#3c4043]"><BringToFront size={14}/> Trazer para frente</button>
                    <button onClick={() => handleLayer('back')} className="w-full text-left flex items-center gap-3 px-4 py-2 hover:bg-[#f1f3f4] text-sm text-[#3c4043]"><SendToBack size={14}/> Enviar para trás</button>
                    <div className="h-[1px] bg-[#dadce0] my-1"></div>
                    <button onClick={() => { deleteSelectedElement(); setContextMenu(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2 hover:bg-[#f1f3f4] text-sm text-red-600"><Trash2 size={14}/> Excluir elemento</button>
                </div>
            )}
            {slideContextMenu && type === 'slide' && (
                <div className="fixed z-50 bg-white border border-[#dadce0] rounded-lg shadow-xl py-1 w-48" style={{ top: slideContextMenu.y, left: slideContextMenu.x }}>
                    <button onClick={() => { duplicateSlide(slideContextMenu.slideIndex); setSlideContextMenu(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2 hover:bg-[#f1f3f4] text-sm text-[#3c4043]"><Copy size={14}/> Duplicar slide</button>
                    <div className="h-[1px] bg-[#dadce0] my-1"></div>
                    <button onClick={() => { deleteSlide(slideContextMenu.slideIndex); setSlideContextMenu(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2 hover:bg-[#f1f3f4] text-sm text-red-600"><Trash2 size={14}/> Excluir slide</button>
                </div>
            )}
            
            {/* --- AI PANEL --- */}
            {showAiPanel && (
                <div className="w-80 bg-white border-l border-[#dadce0] flex flex-col shadow-2xl animate-in slide-in-from-right-10 duration-300 z-30">
                     <div className="p-4 border-b border-[#dadce0] flex items-center gap-2 bg-gradient-to-r from-blue-50 to-white">
                        <GeminiLogo className="w-6 h-6" /><span className="font-medium text-[#1f1f1f]">Gemini</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        {aiResponse && (
                            <div className="bg-[#f0f4f9] p-4 rounded-xl text-sm text-[#1f1f1f] mb-4 whitespace-pre-wrap leading-relaxed shadow-inner">
                                {aiResponse}
                            </div>
                        )}
                    </div>
                    <div className="p-4 bg-white border-t border-[#dadce0] relative">
                         <input type="text" className="w-full bg-[#f0f4f9] border border-transparent focus:bg-white focus:border-blue-500 focus:shadow-md rounded-full pl-4 pr-12 py-3 text-sm outline-none transition-all" placeholder="Digite um comando..." value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} />
                         <button onClick={handleAiGenerate} className="absolute right-6 top-6 p-1.5 text-blue-600"><Send size={18}/></button>
                    </div>
                </div>
            )}
        </div>

        {/* PRESENTATION MODE OVERLAY */}
        {isPresenting && type === 'slide' && (
            <div 
                ref={presentationRef}
                className="fixed inset-0 z-[100] bg-black text-white flex flex-col items-center justify-center outline-none animate-in fade-in duration-500" 
                tabIndex={0} 
                autoFocus
            >
                {/* Scaled Slide */}
                <div 
                    style={{ 
                        width: 960, height: 540, 
                        backgroundColor: slides[currentSlideIndex].background,
                        transform: `scale(${Math.min(window.innerWidth / 960, window.innerHeight / 540)})`,
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                >
                    {slides[currentSlideIndex].elements.map(el => (
                        <div key={el.id} style={{
                            position: 'absolute', left: el.x, top: el.y, width: el.w, height: el.h,
                            transform: `rotate(${el.rotation}deg)`,
                            ...el.style,
                        }}>
                             {el.type === 'text' ? <div className="w-full h-full p-2 whitespace-pre-wrap" style={el.style}>{el.content}</div>
                             : el.type === 'image' ? <img src={el.content} className="w-full h-full object-cover" />
                             : el.type === 'shape' ? (
                                <div className="w-full h-full" style={{backgroundColor: el.style.backgroundColor, borderRadius: el.content === 'circle' ? '50%' : '0'}}>
                                    {el.content === 'triangle' && <div style={{width:0, height:0, borderLeft:`${el.w/2}px solid transparent`, borderRight:`${el.w/2}px solid transparent`, borderBottom:`${el.h}px solid ${el.style.backgroundColor}`}}></div>}
                                </div>
                             ) : null}
                        </div>
                    ))}
                </div>

                {/* Controls */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-[#202124]/80 rounded-full flex items-center gap-6 shadow-2xl backdrop-blur-md opacity-0 hover:opacity-100 transition-opacity duration-300">
                     <button onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))} className="p-2 hover:bg-white/10 rounded-full"><ChevronLeft size={24}/></button>
                     <span className="text-sm font-medium">{currentSlideIndex + 1} / {slides.length}</span>
                     <button onClick={() => setCurrentSlideIndex(Math.min(slides.length - 1, currentSlideIndex + 1))} className="p-2 hover:bg-white/10 rounded-full"><ChevronRightIcon size={24}/></button>
                     <div className="w-[1px] h-6 bg-white/20 mx-2"></div>
                     <button onClick={() => setIsPresenting(false)} className="text-xs font-medium bg-red-500 hover:bg-red-400 text-white px-4 py-1.5 rounded-full transition-colors">Sair</button>
                </div>
            </div>
        )}
    </div>
  );
}
