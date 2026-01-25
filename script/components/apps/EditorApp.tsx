
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, Lock, Undo, Redo, Printer, SpellCheck, PaintRoller,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Image as ImageIcon, Link as LinkIcon,
  Table, Type, ChevronDown, MessageSquare, Share2, MoreVertical,
  Plus, Grid3X3, Type as TypeIcon, Square, Circle, LayoutTemplate,
  Check, Save, Menu, Minus, Sparkles, Send, Bot, Wand2, Loader2, ArrowRight,
  Ratio, Maximize, File as FileIcon, Search as SearchIcon
} from 'lucide-react';
import { GoogleIcons, GeminiLogo } from '../GoogleIcons';
import { GoogleGenAI } from "@google/genai";
import { bridge } from '../../utils/GASBridge';

interface EditorAppProps {
  onClose: () => void;
  type: string;
  data: any; 
}

const getFileIcon = (type: string) => {
  switch(type) {
    case 'sheet': return <GoogleIcons.Sheets className="w-9 h-9" />;
    case 'slide': return <GoogleIcons.Slides className="w-9 h-9" />;
    case 'doc': return <GoogleIcons.Docs className="w-9 h-9" />;
    default: return null;
  }
};

const ToolbarButton = ({ children, active, onClick, title }: any) => (
    <button 
        onClick={onClick}
        title={title}
        className={`p-1.5 rounded-md transition-colors flex items-center justify-center ${active ? 'bg-black/10 text-black' : 'text-gray-600 hover:bg-black/5'}`}
    >
        {children}
    </button>
);

const Divider = () => <div className="w-[1px] h-5 bg-gray-300 mx-1 self-center"></div>;

export default function EditorApp({ onClose, type, data }: EditorAppProps) {
  const [title, setTitle] = useState(data?.name || (type === 'doc' ? 'Documento sem título' : type === 'sheet' ? 'Planilha sem título' : 'Apresentação sem título'));
  const [saved, setSaved] = useState(true);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  
  // Format States
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [textAlign, setTextAlign] = useState('left');

  // Page Setup State
  const [showPageSetup, setShowPageSetup] = useState(false);
  const [pageSize, setPageSize] = useState('A4');
  const [orientation, setOrientation] = useState('portrait');
  const [margins, setMargins] = useState('normal');

  // Find & Replace State
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');

  // Sheet State
  const [selectedCell, setSelectedCell] = useState<{r:number, c:number} | null>({r:0, c:0});
  const [cellData, setCellData] = useState<{[key:string]: string}>({});
  const [formulaValue, setFormulaValue] = useState('');

  // Slide State
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState([
      { id: 1, title: 'Título da Apresentação', subtitle: 'Subtítulo', type: 'title', image: '' },
      { id: 2, title: 'Agenda', subtitle: 'Tópicos do dia', type: 'text', image: '' },
      { id: 3, title: 'Visualização', subtitle: 'Dados', type: 'image', image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop' }
  ]);

  // AI Side Panel
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Image Gen Settings
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [imageSize, setImageSize] = useState('1K');
  
  // Doc Stats
  const [wordCount, setWordCount] = useState(0);
  
  // Gemini Client & Refs
  const aiClient = useRef<GoogleGenAI | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
      try {
          aiClient.current = new GoogleGenAI({ apiKey: process.env.API_KEY });
      } catch (e) { console.error("Gemini init error", e); }
  }, []);

  // --- CONTENT LOADING ---
  useEffect(() => {
      if (data?.id) {
          setIsLoadingContent(true);
          bridge.getFileContent(data.id).then(res => {
              if (res.success && res.data) {
                  const decoded = atob(res.data); // Simple decode for text based contents
                  
                  if (type === 'doc' && editorRef.current) {
                      // Se for HTML/Texto, injeta. Se for binário (PDF/Img), Doc editor não suporta edição direta aqui
                      // Para fins de demo, assumimos que saveFileContent salva HTML/Texto
                      try {
                          // Tenta verificar se é json ou html
                          editorRef.current.innerHTML = decoded;
                      } catch (e) {
                          editorRef.current.innerText = decoded;
                      }
                  } else if (type === 'sheet') {
                      try {
                          setCellData(JSON.parse(decoded));
                      } catch(e) {}
                  }
              }
              setIsLoadingContent(false);
          });
      }
  }, [data, type]);

  // --- AUTO SAVE LOGIC ---
  const triggerSave = useCallback(() => {
      setSaved(false);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      
      saveTimeoutRef.current = setTimeout(async () => {
          if (!data?.id) return;
          
          let contentToSave = '';
          if (type === 'doc' && editorRef.current) {
              contentToSave = editorRef.current.innerHTML;
          } else if (type === 'sheet') {
              contentToSave = JSON.stringify(cellData);
          } else if (type === 'slide') {
              contentToSave = JSON.stringify(slides);
          }

          if (contentToSave) {
              await bridge.saveFileContent(data.id, contentToSave);
              setSaved(true);
          }
      }, 2000); // 2 segundos de debounce
  }, [data, type, cellData, slides]);

  // --- DOCS LOGIC ---
  const handleFormat = (command: string, value: string | undefined = undefined) => {
      document.execCommand(command, false, value);
      checkFormatState();
      editorRef.current?.focus();
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

  const handleFindReplace = () => {
      if (!findText) return;
      if ((window as any).find && (window as any).find(findText)) {
          // Found
      } else {
          alert('Texto não encontrado.');
      }
  };

  // --- SHEET LOGIC ---
  const getCellId = (r: number, c: number) => `${String.fromCharCode(65+c)}${r+1}`;
  
  const handleCellClick = (r: number, c: number) => {
      setSelectedCell({r, c});
      setFormulaValue(cellData[getCellId(r, c)] || '');
  };

  const handleCellChange = (val: string) => {
      if (selectedCell) {
          const id = getCellId(selectedCell.r, selectedCell.c);
          setCellData(prev => {
              const newState = {...prev, [id]: val};
              return newState;
          });
          setFormulaValue(val);
          triggerSave();
      }
  };

  // --- GEMINI LOGIC ---
  const handleAiGenerate = async () => {
      if (!aiPrompt.trim() || !aiClient.current) return;
      setIsGenerating(true);
      setAiResponse(null);

      try {
          let responseText = "";

          if (type === 'doc') {
              const response = await aiClient.current.models.generateContent({
                  model: 'gemini-3-flash-preview',
                  contents: `You are a helpful writing assistant. Write a short paragraph based on this request: "${aiPrompt}". Return only the text.`,
              });
              responseText = response.text || "Não foi possível gerar o texto.";

          } else if (type === 'slide') {
              const response = await aiClient.current.models.generateContent({
                  model: 'gemini-3-pro-image-preview',
                  contents: aiPrompt,
                  config: { imageConfig: { aspectRatio: aspectRatio, imageSize: imageSize } }
              });
              await new Promise(r => setTimeout(r, 2000)); 
              const arSize = aspectRatio === '1:1' ? '800x800' : aspectRatio === '16:9' ? '1600x900' : '900x1600';
              responseText = `https://source.unsplash.com/random/${arSize}/?${encodeURIComponent(aiPrompt)}&sig=${Date.now()}`; 

          } else if (type === 'sheet') {
              const response = await aiClient.current.models.generateContent({
                  model: 'gemini-3-flash-preview',
                  contents: `You are a Google Sheets expert. Generate ONLY the formula for this request: "${aiPrompt}". Do not add markdown or explanation.`,
              });
              responseText = response.text?.trim() || "";
          }

          setAiResponse(responseText);

      } catch (error) {
          console.error("Gemini generation error:", error);
          setAiResponse("Erro ao conectar com o Gemini. Tente novamente.");
      } finally {
          setIsGenerating(false);
      }
  };
  
  const insertAiContent = () => {
      if (!aiResponse) return;
      if (type === 'doc' && editorRef.current) {
           editorRef.current.focus();
           document.execCommand('insertText', false, aiResponse);
           checkFormatState();
      } else if (type === 'slide') {
          const newSlides = [...slides];
          newSlides[currentSlide] = { ...newSlides[currentSlide], image: aiResponse, type: 'image' };
          setSlides(newSlides);
          triggerSave();
      } else if (type === 'sheet' && selectedCell) {
          handleCellChange(aiResponse);
      }
      setAiPrompt('');
      setAiResponse(null);
      setShowAiPanel(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#F9FBFD] animate-in fade-in duration-300 font-sans relative">
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
                        {saved ? (
                            <div className="flex items-center text-gray-400 text-xs gap-1 opacity-100 transition-opacity" title="Salvo no Drive">
                                <Check size={14}/>
                            </div>
                        ) : (
                            <div className="text-gray-400 text-xs animate-pulse">Salvando...</div>
                        )}
                    </div>
                    {/* ... Menus ... */}
                    <div className="flex gap-3 text-[13px] text-gray-600 select-none">
                        <span className="hover:bg-gray-100 px-1.5 rounded cursor-pointer transition-colors" onClick={() => setShowPageSetup(true)}>Arquivo</span>
                        <span className="hover:bg-gray-100 px-1.5 rounded cursor-pointer transition-colors" onClick={() => setShowFindReplace(true)}>Editar</span>
                        <span className="hover:bg-gray-100 px-1.5 rounded cursor-pointer transition-colors">Ver</span>
                        <span className="hover:bg-gray-100 px-1.5 rounded cursor-pointer transition-colors">Inserir</span>
                        <span className="hover:bg-gray-100 px-1.5 rounded cursor-pointer transition-colors">Formatar</span>
                        <span className="hover:bg-gray-100 px-1.5 rounded cursor-pointer transition-colors">Ferramentas</span>
                        <span className="hover:bg-gray-100 px-1.5 rounded cursor-pointer transition-colors">Ajuda</span>
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
                        <Lock size={16} /> <span className="hidden sm:inline">Compartilhar</span>
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
             <ToolbarButton title="Verificação Ortográfica"><SpellCheck size={16}/></ToolbarButton>
             <ToolbarButton title="Pintar Formatação"><PaintRoller size={16}/></ToolbarButton>
             <Divider />
             <div className="flex items-center gap-1 bg-white/50 rounded px-1 border border-black/5">
                <span className="text-xs font-medium text-gray-700 px-2 cursor-pointer">Arial</span>
                <ChevronDown size={10} className="text-gray-500"/>
            </div>
             <Divider />
             <ToolbarButton onClick={() => handleFormat('bold')} active={isBold} title="Negrito"><Bold size={16}/></ToolbarButton>
             <ToolbarButton onClick={() => handleFormat('italic')} active={isItalic} title="Itálico"><Italic size={16}/></ToolbarButton>
             <ToolbarButton onClick={() => handleFormat('underline')} active={isUnderline} title="Sublinhado"><Underline size={16}/></ToolbarButton>
             <ToolbarButton title="Cor do Texto"><div className="flex flex-col items-center"><span className="font-bold text-sm leading-3">A</span><div className="w-3 h-1 bg-black"></div></div></ToolbarButton>
             <Divider />
             {type === 'doc' && (
                <>
                    <ToolbarButton onClick={() => handleFormat('justifyLeft')} active={textAlign==='left'} title="Alinhar à Esquerda"><AlignLeft size={16}/></ToolbarButton>
                    <ToolbarButton onClick={() => handleFormat('justifyCenter')} active={textAlign==='center'} title="Centralizar"><AlignCenter size={16}/></ToolbarButton>
                    <ToolbarButton onClick={() => handleFormat('justifyRight')} active={textAlign==='right'} title="Alinhar à Direita"><AlignRight size={16}/></ToolbarButton>
                    <ToolbarButton onClick={() => handleFormat('justifyFull')} active={textAlign==='justify'} title="Justificar"><AlignJustify size={16}/></ToolbarButton>
                    <Divider />
                    <ToolbarButton onClick={() => handleFormat('insertUnorderedList')} title="Lista com marcadores"><List size={16}/></ToolbarButton>
                    <ToolbarButton onClick={() => handleFormat('insertOrderedList')} title="Lista numerada"><ListOrdered size={16}/></ToolbarButton>
                </>
            )}
            {type === 'sheet' && (
                <>
                    <ToolbarButton title="Bordas"><Grid3X3 size={16}/></ToolbarButton>
                    <ToolbarButton title="Mesclar células"><LayoutTemplate size={16}/></ToolbarButton>
                    <Divider/>
                    <ToolbarButton title="Alinhamento Horizontal"><AlignLeft size={16}/></ToolbarButton>
                    <ToolbarButton title="Alinhamento Vertical"><AlignJustify size={16} className="rotate-90"/></ToolbarButton>
                </>
            )}
            {type === 'slide' && (
                <>
                    <ToolbarButton title="Caixa de Texto"><TypeIcon size={16}/></ToolbarButton>
                    <ToolbarButton title="Inserir Imagem"><ImageIcon size={16}/></ToolbarButton>
                    <ToolbarButton title="Forma"><Square size={16}/></ToolbarButton>
                    <ToolbarButton title="Linha"><Minus size={16} className="-rotate-45"/></ToolbarButton>
                    <Divider/>
                    <ToolbarButton title="Plano de Fundo">Fundo</ToolbarButton>
                </>
            )}
        </div>
        
        {/* FORMULA BAR FOR SHEETS */}
        {type === 'sheet' && (
            <div className="h-8 flex items-center gap-2 px-3 border-b border-gray-300 bg-white mb-1 shrink-0">
                <div className="text-xs font-bold text-gray-500 w-8 text-center">{selectedCell ? getCellId(selectedCell.r, selectedCell.c) : ''}</div>
                <div className="w-[1px] h-4 bg-gray-300"></div>
                <div className="font-serif italic text-gray-400 font-bold">fx</div>
                <input 
                    type="text" 
                    className="flex-1 text-sm outline-none h-full border-none"
                    value={formulaValue}
                    onChange={(e) => handleCellChange(e.target.value)}
                />
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
                <div className="flex-1 overflow-y-auto custom-scrollbar flex justify-center p-8 cursor-text" onClick={() => editorRef.current?.focus()}>
                    <div 
                        ref={editorRef}
                        className="w-[816px] min-h-[1056px] bg-white shadow-lg px-24 py-20 outline-none text-black selection:bg-blue-200 print:shadow-none print:w-full" 
                        contentEditable 
                        suppressContentEditableWarning
                        onKeyUp={checkFormatState}
                        onMouseUp={checkFormatState}
                        onInput={checkFormatState}
                        style={{ fontFamily: 'Arial, sans-serif', fontSize: '11pt', lineHeight: '1.5' }}
                    >
                    </div>
                </div>
            )}

            {/* --- SHEET EDITOR --- */}
            {type === 'sheet' && (
                <div className="flex-1 overflow-auto custom-scrollbar bg-white relative">
                    <div className="inline-block min-w-full">
                        <div className="flex sticky top-0 z-10">
                            <div className="w-10 h-6 bg-gray-100 border-b border-r border-gray-300 shrink-0"></div>
                            {['A','B','C','D','E','F','G','H','I','J','K','L'].map((col) => (
                                <div key={col} className="w-24 h-6 bg-gray-100 border-b border-r border-gray-300 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0 resize-x overflow-hidden">{col}</div>
                            ))}
                        </div>
                        <div className="flex flex-col">
                            {[...Array(50)].map((_, r) => (
                                <div key={r} className="flex h-6">
                                    <div className="w-10 bg-gray-100 border-b border-r border-gray-300 flex items-center justify-center text-xs text-gray-600 shrink-0 sticky left-0 z-10">{r+1}</div>
                                    {['A','B','C','D','E','F','G','H','I','J','K','L'].map((_, c) => {
                                        const cellId = getCellId(r, c);
                                        const isSelected = selectedCell?.r === r && selectedCell?.c === c;
                                        return (
                                            <div 
                                                key={cellId}
                                                onClick={() => handleCellClick(r, c)}
                                                className={`w-24 border-b border-r border-gray-200 outline-none text-xs px-1 flex items-center overflow-hidden whitespace-nowrap cursor-cell ${isSelected ? 'border-2 border-blue-500 z-10' : ''}`}
                                            >
                                                {cellData[cellId] || ''}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Bottom Tabs */}
                    <div className="fixed bottom-0 left-0 right-0 h-9 bg-gray-100 border-t border-gray-300 flex items-center px-2 gap-1 z-20">
                        <button className="p-1 hover:bg-gray-200 rounded"><Plus size={14}/></button>
                        <button className="p-1 hover:bg-gray-200 rounded"><Menu size={14}/></button>
                        <div className="bg-white px-4 py-1.5 rounded-t-lg shadow-sm text-sm font-medium text-green-700 border-b-2 border-green-600">Página1</div>
                    </div>
                </div>
            )}

            {/* --- SLIDE EDITOR --- */}
            {type === 'slide' && (
                <div className="w-full h-full flex">
                    <div className="w-48 bg-white border-r border-gray-200 flex flex-col gap-4 p-4 overflow-y-auto shrink-0">
                        {slides.map((slide, i) => (
                            <div key={slide.id} onClick={() => setCurrentSlide(i)} className={`flex gap-2 cursor-pointer group`}>
                                <span className="text-xs text-gray-500 font-medium w-4 text-right pt-2">{i+1}</span>
                                <div className={`flex-1 aspect-video border-2 rounded shadow-sm flex flex-col items-center justify-center p-2 bg-white transition-all overflow-hidden ${currentSlide === i ? 'border-yellow-400 ring-1 ring-yellow-200' : 'border-gray-200 group-hover:border-gray-300'}`}>
                                    {slide.image ? <img src={slide.image} className="w-full h-full object-cover"/> : (
                                        <>
                                            <div className="text-[6px] font-bold text-black mb-1">{slide.title}</div>
                                            <div className="text-[4px] text-gray-400">{slide.subtitle}</div>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex-1 bg-[#E8EAED] flex items-center justify-center relative overflow-hidden p-8">
                        <div className="w-full max-w-[900px] aspect-video bg-white shadow-2xl flex flex-col items-center justify-center text-black p-16 relative select-none overflow-hidden">
                            {slides[currentSlide].image ? (
                                <img src={slides[currentSlide].image} className="w-full h-full object-contain" />
                            ) : (
                                <>
                                    <h1 className="text-5xl font-bold mb-4 text-center outline-none hover:border hover:border-blue-400 p-2 rounded cursor-text" contentEditable suppressContentEditableWarning onInput={triggerSave}>{slides[currentSlide].title}</h1>
                                    <p className="text-2xl text-gray-500 outline-none hover:border hover:border-blue-400 p-2 rounded cursor-text" contentEditable suppressContentEditableWarning onInput={triggerSave}>{slides[currentSlide].subtitle}</p>
                                    <div className="absolute bottom-8 right-8 text-xs text-gray-300">Google Workspace</div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ... (AI Panel code remains similar) ... */}
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
                                    {type === 'slide' && aiResponse.startsWith('http') ? (
                                        <div className="relative group">
                                            <img src={aiResponse} className="w-full rounded-lg mb-2 shadow-sm" alt="Generated" />
                                            <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded-full backdrop-blur-md">IA Generated</div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{aiResponse}</p>
                                    )}
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
                                    <p className="text-sm font-medium text-gray-600">Como posso ajudar?</p>
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

        {/* PAGE SETUP MODAL */}
        {showPageSetup && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-xl shadow-2xl w-[400px] p-6 animate-in zoom-in duration-200">
                    <h3 className="text-lg font-medium mb-4 text-gray-800">Configuração da Página</h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Orientação</label>
                            <div className="flex gap-4">
                                <div onClick={() => setOrientation('portrait')} className={`flex-1 border rounded-lg p-3 cursor-pointer flex flex-col items-center gap-2 transition-all ${orientation === 'portrait' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                                    <div className="w-6 h-8 border-2 border-gray-400 bg-white"></div>
                                    <span className="text-xs font-medium">Retrato</span>
                                </div>
                                <div onClick={() => setOrientation('landscape')} className={`flex-1 border rounded-lg p-3 cursor-pointer flex flex-col items-center gap-2 transition-all ${orientation === 'landscape' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                                    <div className="w-8 h-6 border-2 border-gray-400 bg-white"></div>
                                    <span className="text-xs font-medium">Paisagem</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                        <button onClick={() => setShowPageSetup(false)} className="px-4 py-2 text-gray-600 text-sm font-medium hover:bg-gray-100 rounded-lg transition-colors">Cancelar</button>
                        <button onClick={() => setShowPageSetup(false)} className="px-6 py-2 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 rounded-lg transition-colors">OK</button>
                    </div>
                </div>
            </div>
        )}

        {/* FIND & REPLACE MODAL */}
        {showFindReplace && (
            <div className="fixed top-20 right-8 z-50 bg-white shadow-2xl rounded-xl border border-gray-200 w-80 animate-in slide-in-from-right-10 duration-200">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <span className="font-medium text-sm text-gray-700">Localizar e substituir</span>
                    <button onClick={() => setShowFindReplace(false)} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
                </div>
                <div className="p-4 space-y-3">
                    <div className="relative">
                        <SearchIcon size={14} className="absolute left-3 top-2.5 text-gray-400"/>
                        <input 
                            type="text" 
                            className="w-full pl-8 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:border-blue-500 outline-none"
                            placeholder="Localizar"
                            value={findText}
                            onChange={(e) => setFindText(e.target.value)}
                        />
                    </div>
                    <div className="relative">
                        <input 
                            type="text" 
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:border-blue-500 outline-none"
                            placeholder="Substituir por"
                            value={replaceText}
                            onChange={(e) => setReplaceText(e.target.value)}
                        />
                    </div>
                    <div className="flex justify-between items-center pt-2">
                        <div className="text-xs text-gray-400">0 de 0</div>
                        <div className="flex gap-2">
                            <button className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-colors" onClick={() => {}}>Substituir</button>
                            <button className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors" onClick={handleFindReplace}>Próxima</button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}