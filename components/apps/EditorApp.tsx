import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Save, Loader2, Plus, ChevronLeft, ChevronRight, Trash2,
  Layout, Palette
} from 'lucide-react';
import { GoogleIcons } from '../GoogleIcons';
import { bridge } from '../../utils/GASBridge';

interface EditorAppProps {
  onClose: () => void;
  type: string;
  data: any;
}

// --- Slide type ---
interface DemoSlide {
  id: string;
  bg: string;
  title: string;
  body: string;
}

const SLIDE_THEMES = [
  { label: 'Escuro',   bg: 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)',  fg: '#fff',     sub: 'rgba(255,255,255,0.75)' },
  { label: 'Claro',    bg: '#ffffff',                                             fg: '#1a1a1a',  sub: '#555' },
  { label: 'Cinza',    bg: '#f5f5f5',                                             fg: '#1a1a1a',  sub: '#666' },
  { label: 'Aurora',   bg: 'linear-gradient(135deg, #4285F4 0%, #34A853 100%)',   fg: '#fff',     sub: 'rgba(255,255,255,0.85)' },
  { label: 'Pôr do sol', bg: 'linear-gradient(135deg, #EA4335 0%, #FBBC05 100%)', fg: '#fff',    sub: 'rgba(255,255,255,0.85)' },
];

const getFileIcon = (type: string) => {
  switch (type) {
    case 'sheet': return <GoogleIcons.Sheets className="w-9 h-9" />;
    case 'slide': return <GoogleIcons.Slides className="w-9 h-9" />;
    case 'doc':   return <GoogleIcons.Docs className="w-9 h-9" />;
    default: return null;
  }
};

const ToolbarBtn = ({ children, active, onClick, title }: any) => (
  <button
    onClick={onClick}
    title={title}
    className={`p-1.5 rounded-md transition-colors ${active ? 'bg-black/10 text-gray-800' : 'text-gray-500 hover:bg-black/5 hover:text-gray-700'}`}
  >
    {children}
  </button>
);

const Divider = () => <div className="w-[1px] h-5 bg-gray-300 mx-1 self-center" />;

export default function EditorApp({ onClose, type, data }: EditorAppProps) {
  const [title, setTitle]             = useState(data?.name || (type === 'doc' ? 'Documento sem título' : type === 'sheet' ? 'Planilha sem título' : 'Apresentação sem título'));
  const [saved, setSaved]             = useState(true);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  // Doc state
  const [isBold, setIsBold]           = useState(false);
  const [isItalic, setIsItalic]       = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);

  // Sheet state
  const [cellData, setCellData]       = useState<{ [key: string]: string }>({});
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>({ r: 0, c: 0 });
  const [formulaValue, setFormulaValue] = useState('');

  // Slide state
  const [slides, setSlides] = useState<DemoSlide[]>(() => [
    { id: '1', bg: SLIDE_THEMES[0].bg, title: data?.name || 'Título da Apresentação', body: 'Clique para adicionar um subtítulo' },
    { id: '2', bg: SLIDE_THEMES[1].bg, title: 'Agenda',     body: '• Introdução ao projeto\n• Resultados do período\n• Próximos passos' },
    { id: '3', bg: SLIDE_THEMES[2].bg, title: 'Conclusão',  body: 'Obrigado pela atenção!' },
  ]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showThemePicker, setShowThemePicker] = useState(false);

  const editorRef       = useRef<HTMLDivElement>(null);
  const saveTimeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerSave = useCallback(() => {
    setSaved(false);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      if (!data?.id) { setSaved(true); return; }
      let content = '';
      if (type === 'doc' && editorRef.current)
        content = btoa(unescape(encodeURIComponent(editorRef.current.innerHTML)));
      else if (type === 'sheet')
        content = btoa(unescape(encodeURIComponent(JSON.stringify(cellData))));
      else if (type === 'slide')
        content = btoa(unescape(encodeURIComponent(JSON.stringify(slides))));
      if (content) { await bridge.saveFileContent(data.id, content); }
      setSaved(true);
    }, 2000);
  }, [data, type, cellData, slides]);

  useEffect(() => {
    if (!data?.id) return;
    setIsLoadingContent(true);
    bridge.getFileContent(data.id).then(res => {
      if (res.success && res.data) {
        try {
          const decoded = decodeURIComponent(escape(atob(res.data)));
          if (type === 'doc' && editorRef.current) editorRef.current.innerHTML = decoded;
          else if (type === 'sheet') setCellData(JSON.parse(decoded));
          else if (type === 'slide') setSlides(JSON.parse(decoded));
        } catch (e) { /* ignore decode errors */ }
      }
      setIsLoadingContent(false);
    });
  }, [data, type]);

  const handleFormat = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    setIsBold(document.queryCommandState('bold'));
    setIsItalic(document.queryCommandState('italic'));
    setIsUnderline(document.queryCommandState('underline'));
    triggerSave();
  };

  const getCellId   = (r: number, c: number) => `${String.fromCharCode(65 + c)}${r + 1}`;
  const handleCellClick  = (r: number, c: number) => { setSelectedCell({ r, c }); setFormulaValue(cellData[getCellId(r, c)] || ''); };
  const handleCellChange = (val: string) => {
    if (!selectedCell) return;
    const id = getCellId(selectedCell.r, selectedCell.c);
    setCellData(prev => ({ ...prev, [id]: val }));
    setFormulaValue(val);
    triggerSave();
  };

  const addSlide = () => {
    const newSlide: DemoSlide = { id: Date.now().toString(), bg: SLIDE_THEMES[1].bg, title: `Slide ${slides.length + 1}`, body: 'Clique para adicionar conteúdo' };
    setSlides(prev => [...prev, newSlide]);
    setCurrentSlide(slides.length);
    triggerSave();
  };

  const removeSlide = (idx: number) => {
    if (slides.length <= 1) return;
    setSlides(prev => prev.filter((_, i) => i !== idx));
    setCurrentSlide(prev => Math.min(prev, slides.length - 2));
    triggerSave();
  };

  const updateSlide = (field: 'title' | 'body', value: string) => {
    setSlides(prev => prev.map((s, i) => i === currentSlide ? { ...s, [field]: value } : s));
    triggerSave();
  };

  const applyTheme = (theme: typeof SLIDE_THEMES[0]) => {
    setSlides(prev => prev.map((s, i) => i === currentSlide ? { ...s, bg: theme.bg } : s));
    setShowThemePicker(false);
    triggerSave();
  };

  const currentTheme = SLIDE_THEMES.find(t => slides[currentSlide]?.bg === t.bg) || SLIDE_THEMES[1];
  const fg  = currentTheme.fg;
  const sub = currentTheme.sub;

  // ---- RENDER ----
  return (
    <div className="flex flex-col h-full bg-[#F9FBFD] font-sans">

      {/* Header */}
      <div className="h-16 px-4 flex items-center justify-between bg-white z-20 shrink-0 border-b border-gray-200">
        <div className="flex items-center gap-3">
          {getFileIcon(type)}
          <div>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="text-lg outline-none border border-transparent hover:border-black/20 focus:border-blue-500 rounded px-1"
            />
            <div className="text-xs text-gray-400">{saved ? 'Salvo no Drive' : 'Salvando...'}</div>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-red-50 text-gray-400 rounded-full transition-colors">
          <X size={22} />
        </button>
      </div>

      {/* Toolbar — context-aware */}
      <div className="bg-[#EDF2FA] mx-3 my-2 rounded-full flex items-center px-4 py-1.5 gap-1 shrink-0">
        {type === 'doc' && (
          <>
            <ToolbarBtn onClick={() => handleFormat('bold')}      active={isBold}      title="Negrito"><Bold size={15}/></ToolbarBtn>
            <ToolbarBtn onClick={() => handleFormat('italic')}    active={isItalic}    title="Itálico"><Italic size={15}/></ToolbarBtn>
            <ToolbarBtn onClick={() => handleFormat('underline')} active={isUnderline} title="Sublinhado"><Underline size={15}/></ToolbarBtn>
            <Divider />
            <ToolbarBtn onClick={() => handleFormat('justifyLeft')}   title="Esquerda"><AlignLeft size={15}/></ToolbarBtn>
            <ToolbarBtn onClick={() => handleFormat('justifyCenter')} title="Centro"><AlignCenter size={15}/></ToolbarBtn>
            <ToolbarBtn onClick={() => handleFormat('justifyRight')}  title="Direita"><AlignRight size={15}/></ToolbarBtn>
            <Divider />
            <ToolbarBtn onClick={() => handleFormat('insertUnorderedList')} title="Lista"><List size={15}/></ToolbarBtn>
            <ToolbarBtn onClick={() => handleFormat('insertOrderedList')}   title="Lista numerada"><ListOrdered size={15}/></ToolbarBtn>
          </>
        )}
        {type === 'sheet' && (
          <>
            <span className="text-xs text-gray-500 px-2">
              {selectedCell ? `${String.fromCharCode(65 + selectedCell.c)}${selectedCell.r + 1}` : ''}
            </span>
            <Divider />
            <input
              className="flex-1 bg-white border border-gray-300 rounded px-2 py-0.5 text-sm outline-none focus:border-blue-400"
              placeholder="Fórmula ou valor"
              value={formulaValue}
              onChange={e => handleCellChange(e.target.value)}
            />
          </>
        )}
        {type === 'slide' && (
          <>
            <button onClick={addSlide} className="flex items-center gap-1 text-xs text-gray-600 hover:bg-white px-2 py-1 rounded-full transition-colors">
              <Plus size={14}/> Slide
            </button>
            <Divider />
            <button
              onClick={() => setShowThemePicker(v => !v)}
              className="flex items-center gap-1 text-xs text-gray-600 hover:bg-white px-2 py-1 rounded-full transition-colors relative"
            >
              <Palette size={14}/> Tema
              {showThemePicker && (
                <div className="absolute top-8 left-0 bg-white border border-gray-200 rounded-xl shadow-xl p-2 flex gap-2 z-50">
                  {SLIDE_THEMES.map((t, i) => (
                    <button
                      key={i}
                      onClick={e => { e.stopPropagation(); applyTheme(t); }}
                      className="w-10 h-7 rounded-lg border-2 border-white hover:border-blue-400 transition-all"
                      style={{ background: t.bg }}
                      title={t.label}
                    />
                  ))}
                </div>
              )}
            </button>
            <Divider />
            <button onClick={() => setCurrentSlide(p => Math.max(0, p - 1))} className="p-1 hover:bg-white rounded-full text-gray-500" disabled={currentSlide === 0}>
              <ChevronLeft size={16}/>
            </button>
            <span className="text-xs text-gray-500 px-1">{currentSlide + 1} / {slides.length}</span>
            <button onClick={() => setCurrentSlide(p => Math.min(slides.length - 1, p + 1))} className="p-1 hover:bg-white rounded-full text-gray-500" disabled={currentSlide === slides.length - 1}>
              <ChevronRight size={16}/>
            </button>
            <Divider />
            <button onClick={() => removeSlide(currentSlide)} className="p-1 hover:bg-red-100 text-gray-400 hover:text-red-500 rounded-full transition-colors" disabled={slides.length <= 1} title="Remover slide">
              <Trash2 size={14}/>
            </button>
          </>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden bg-[#F0F2F5]">
        {isLoadingContent ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-blue-500" size={32}/>
          </div>
        ) : type === 'doc' ? (
          <div className="h-full overflow-y-auto flex justify-center p-8">
            <div
              ref={editorRef}
              className="w-[816px] min-h-[1056px] bg-white shadow-lg p-24 outline-none text-gray-800 leading-relaxed"
              contentEditable
              suppressContentEditableWarning
              onInput={() => {
                setIsBold(document.queryCommandState('bold'));
                setIsItalic(document.queryCommandState('italic'));
                setIsUnderline(document.queryCommandState('underline'));
                triggerSave();
              }}
              data-placeholder="Comece a escrever aqui..."
            />
          </div>
        ) : type === 'sheet' ? (
          <div className="h-full overflow-auto">
            <table className="border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky top-0 left-0 z-20 bg-gray-100 border border-gray-300 p-2 min-w-[40px]" />
                  {Array.from({ length: 26 }).map((_, i) => (
                    <th key={i} className="sticky top-0 z-10 bg-gray-100 border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 min-w-[100px]">
                      {String.fromCharCode(65 + i)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 100 }).map((_, r) => (
                  <tr key={r}>
                    <td className="sticky left-0 z-10 bg-gray-100 border border-gray-300 px-2 py-1 text-xs text-center text-gray-500 font-medium">{r + 1}</td>
                    {Array.from({ length: 26 }).map((_, c) => (
                      <td
                        key={c}
                        onClick={() => handleCellClick(r, c)}
                        className={`border border-gray-200 p-0 ${selectedCell?.r === r && selectedCell?.c === c ? 'outline outline-2 outline-blue-500 z-10 relative' : ''}`}
                        contentEditable
                        suppressContentEditableWarning
                        onFocus={() => handleCellClick(r, c)}
                        onBlur={e => handleCellChange(e.currentTarget.innerText)}
                        style={{ minWidth: 100, minHeight: 24 }}
                      >
                        {cellData[getCellId(r, c)] || ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : /* type === 'slide' */ (
          <div className="flex h-full">
            {/* Thumbnails panel */}
            <div className="w-48 bg-[#E8EAF6] border-r border-gray-200 overflow-y-auto p-3 space-y-3 shrink-0">
              {slides.map((slide, idx) => (
                <div
                  key={slide.id}
                  onClick={() => setCurrentSlide(idx)}
                  className={`relative rounded-lg overflow-hidden cursor-pointer transition-all select-none ${currentSlide === idx ? 'ring-2 ring-blue-500 shadow-md' : 'hover:ring-1 hover:ring-blue-300 opacity-80 hover:opacity-100'}`}
                  style={{ aspectRatio: '16/9' }}
                >
                  <div className="absolute inset-0 flex flex-col justify-center items-center p-2" style={{ background: slide.bg }}>
                    <div
                      className="text-[6px] font-bold text-center w-full leading-tight truncate"
                      style={{ color: (SLIDE_THEMES.find(t => t.bg === slide.bg) || SLIDE_THEMES[1]).fg }}
                    >
                      {slide.title}
                    </div>
                  </div>
                  <div className="absolute bottom-1 right-1 text-[8px] bg-black/30 text-white px-1 rounded leading-none py-0.5">
                    {idx + 1}
                  </div>
                </div>
              ))}
              <button
                onClick={addSlide}
                className="w-full py-2 text-xs text-gray-500 hover:bg-white rounded-lg flex items-center justify-center gap-1 transition-colors border-2 border-dashed border-gray-300 hover:border-blue-400"
              >
                <Plus size={12} /> Adicionar slide
              </button>
            </div>

            {/* Main canvas */}
            <div className="flex-1 flex items-center justify-center bg-[#ECEFF1] p-8 overflow-hidden">
              {slides[currentSlide] && (
                <div
                  className="shadow-2xl rounded-lg overflow-hidden relative"
                  style={{ background: slides[currentSlide].bg, aspectRatio: '16/9', width: '100%', maxWidth: 900 }}
                >
                  {/* Accent bar */}
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 opacity-60" style={{ background: fg === '#fff' ? 'rgba(255,255,255,0.5)' : 'rgba(66,133,244,0.5)' }} />

                  <div className="absolute inset-0 flex flex-col justify-center items-center px-16 py-12 gap-6">
                    {/* Title */}
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={e => updateSlide('title', e.currentTarget.innerText)}
                      className="text-4xl font-bold text-center w-full outline-none cursor-text rounded px-2 py-1 hover:bg-black/5 transition-colors leading-tight"
                      style={{ color: fg }}
                    >
                      {slides[currentSlide].title}
                    </div>

                    {/* Body */}
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={e => updateSlide('body', e.currentTarget.innerText)}
                      className="text-xl text-center w-full outline-none cursor-text whitespace-pre-line rounded px-2 py-1 hover:bg-black/5 transition-colors"
                      style={{ color: sub }}
                    >
                      {slides[currentSlide].body}
                    </div>
                  </div>

                  {/* Slide number */}
                  <div className="absolute bottom-4 right-5 text-xs" style={{ color: fg === '#fff' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)' }}>
                    {currentSlide + 1} / {slides.length}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
