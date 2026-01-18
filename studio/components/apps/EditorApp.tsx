
import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Lock, Undo, Redo, Printer, SpellCheck, PaintRoller,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Image as ImageIcon, Link as LinkIcon,
  Table, Type, ChevronDown, MessageSquare, Share2, MoreVertical,
  Plus, Grid3X3, Type as TypeIcon, Square, Circle, LayoutTemplate,
  Check, Save, Menu, Minus
} from 'lucide-react';
import { GoogleIcons } from '../GoogleIcons';

interface EditorAppProps {
  onClose: () => void;
  type: string;
  data: any;
}

const getAppColor = (type: string) => {
    switch(type) {
        case 'doc': return 'text-blue-600 bg-blue-50';
        case 'sheet': return 'text-green-600 bg-green-50';
        case 'slide': return 'text-yellow-600 bg-yellow-50';
        default: return 'text-gray-600 bg-gray-50';
    }
}

const getMainColor = (type: string) => {
    switch(type) {
        case 'doc': return '#4285F4';
        case 'sheet': return '#34A853';
        case 'slide': return '#FBBC04';
        default: return '#5f6368';
    }
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
  const [title, setTitle] = useState('Documento sem título');
  const [saved, setSaved] = useState(true);
  const [content, setContent] = useState('');
  
  // Format States
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [textAlign, setTextAlign] = useState('left');

  // Sheet State
  const [selectedCell, setSelectedCell] = useState<{r:number, c:number} | null>({r:0, c:0});
  const [cellData, setCellData] = useState<{[key:string]: string}>({});
  const [formulaValue, setFormulaValue] = useState('');

  // Slide State
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState([
      { id: 1, title: 'Título da Apresentação', subtitle: 'Subtítulo' },
      { id: 2, title: 'Agenda', subtitle: 'Tópicos do dia' },
      { id: 3, title: 'Resultados', subtitle: 'Análise de dados' }
  ]);

  const editorRef = useRef<HTMLDivElement>(null);

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
      if (document.queryCommandState('justifyLeft')) setTextAlign('left');
      if (document.queryCommandState('justifyCenter')) setTextAlign('center');
      if (document.queryCommandState('justifyRight')) setTextAlign('right');
      setSaved(false);
      setTimeout(() => setSaved(true), 2000);
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
          setCellData(prev => ({...prev, [id]: val}));
          setFormulaValue(val);
          setSaved(false);
          setTimeout(() => setSaved(true), 1000);
      }
  };

  return (
    <div className="flex flex-col h-full bg-[#F9FBFD] animate-in fade-in duration-300">
        
        {/* HEADER */}
        <div className="h-16 px-4 flex items-center justify-between bg-white z-20 shrink-0">
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
                            <div className="flex items-center text-gray-400 text-xs gap-1 opacity-0 hover:opacity-100 transition-opacity" title="Salvo no Drive">
                                <Check size={14}/>
                            </div>
                        ) : (
                            <div className="text-gray-400 text-xs animate-pulse">Salvando...</div>
                        )}
                    </div>
                    <div className="flex gap-3 text-[13px] text-gray-600 select-none">
                        <span className="hover:bg-gray-100 px-1.5 rounded cursor-pointer transition-colors">Arquivo</span>
                        <span className="hover:bg-gray-100 px-1.5 rounded cursor-pointer transition-colors">Editar</span>
                        <span className="hover:bg-gray-100 px-1.5 rounded cursor-pointer transition-colors">Ver</span>
                        <span className="hover:bg-gray-100 px-1.5 rounded cursor-pointer transition-colors">Inserir</span>
                        <span className="hover:bg-gray-100 px-1.5 rounded cursor-pointer transition-colors">Formatar</span>
                        <span className="hover:bg-gray-100 px-1.5 rounded cursor-pointer transition-colors">Ferramentas</span>
                        <span className="hover:bg-gray-100 px-1.5 rounded cursor-pointer transition-colors">Ajuda</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <button className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"><MessageSquare size={20}/></button>
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
                <span className="text-xs font-medium text-gray-700 px-2 cursor-pointer">100%</span>
                <ChevronDown size={10} className="text-gray-500"/>
            </div>
            <Divider />
            <div className="flex items-center gap-1 bg-white/50 rounded px-1 border border-black/5">
                <span className="text-xs font-medium text-gray-700 px-2 cursor-pointer">Texto normal</span>
                <ChevronDown size={10} className="text-gray-500"/>
            </div>
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

        {/* EDITOR AREA */}
        <div className="flex-1 bg-[#F0F2F5] overflow-hidden flex relative">
            
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
                        style={{ fontFamily: 'Arial, sans-serif', fontSize: '11pt', lineHeight: '1.5' }}
                    >
                        <h1 style={{ fontSize: '26pt', fontWeight: 'bold', paddingBottom: '10px', color: '#000' }}>Proposta de Projeto: Workspace Hub</h1>
                        <p style={{ paddingBottom: '12px' }}>Este documento delineia a visão estratégica para o desenvolvimento do novo sistema operacional web.</p>
                        <h2 style={{ fontSize: '18pt', fontWeight: 'bold', paddingTop: '14px', paddingBottom: '6px', color: '#444' }}>1. Objetivos Principais</h2>
                        <ul>
                            <li>Criar uma interface unificada.</li>
                            <li>Garantir compatibilidade com Apps Script.</li>
                            <li>Oferecer experiência premium de UI/UX.</li>
                        </ul>
                        <br/>
                        <p>O foco inicial será na recriação fiel dos aplicativos principais: <b>Drive</b>, <b>Gmail</b> e <b>Agenda</b>.</p>
                    </div>
                </div>
            )}

            {/* --- SHEET EDITOR --- */}
            {type === 'sheet' && (
                <div className="flex-1 overflow-auto custom-scrollbar bg-white relative">
                    <div className="inline-block min-w-full">
                        {/* Headers */}
                        <div className="flex sticky top-0 z-10">
                            <div className="w-10 h-6 bg-gray-100 border-b border-r border-gray-300 shrink-0"></div>
                            {['A','B','C','D','E','F','G','H','I','J','K','L'].map((col) => (
                                <div key={col} className="w-24 h-6 bg-gray-100 border-b border-r border-gray-300 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0 resize-x overflow-hidden">{col}</div>
                            ))}
                        </div>
                        {/* Grid */}
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
                        <div className="px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded cursor-pointer">Página2</div>
                    </div>
                </div>
            )}

            {/* --- SLIDE EDITOR --- */}
            {type === 'slide' && (
                <div className="w-full h-full flex">
                    {/* Filmstrip */}
                    <div className="w-48 bg-white border-r border-gray-200 flex flex-col gap-4 p-4 overflow-y-auto shrink-0">
                        {slides.map((slide, i) => (
                            <div 
                                key={slide.id} 
                                onClick={() => setCurrentSlide(i)}
                                className={`flex gap-2 cursor-pointer group`}
                            >
                                <span className="text-xs text-gray-500 font-medium w-4 text-right pt-2">{i+1}</span>
                                <div className={`flex-1 aspect-video border-2 rounded shadow-sm flex flex-col items-center justify-center p-2 bg-white transition-all ${currentSlide === i ? 'border-yellow-400 ring-1 ring-yellow-200' : 'border-gray-200 group-hover:border-gray-300'}`}>
                                    <div className="text-[6px] font-bold text-black mb-1">{slide.title}</div>
                                    <div className="text-[4px] text-gray-400">{slide.subtitle}</div>
                                    <div className="mt-2 w-full h-1 bg-gray-100 rounded"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    {/* Main Canvas */}
                    <div className="flex-1 bg-[#E8EAED] flex items-center justify-center relative overflow-hidden p-8">
                        <div className="w-full max-w-[900px] aspect-video bg-white shadow-2xl flex flex-col items-center justify-center text-black p-16 relative select-none">
                            <h1 
                                className="text-5xl font-bold mb-4 text-center outline-none hover:border hover:border-blue-400 p-2 rounded cursor-text"
                                contentEditable
                                suppressContentEditableWarning
                            >
                                {slides[currentSlide].title}
                            </h1>
                            <p 
                                className="text-2xl text-gray-500 outline-none hover:border hover:border-blue-400 p-2 rounded cursor-text"
                                contentEditable
                                suppressContentEditableWarning
                            >
                                {slides[currentSlide].subtitle}
                            </p>
                            
                            {/* Fake UI Elements for Slide */}
                            <div className="absolute bottom-8 right-8 text-xs text-gray-300">Google Workspace</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
}
