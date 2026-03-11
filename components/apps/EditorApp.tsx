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
    <button onClick={onClick} title={title} className={`p-1.5 rounded-md transition-colors ${active ? 'bg-black/10' : 'text-gray-600 hover:bg-black/5'}`}>
        {children}
    </button>
);

const Divider = () => <div className="w-[1px] h-5 bg-gray-300 mx-1 self-center"></div>;

export default function EditorApp({ onClose, type, data }: EditorAppProps) {
  const [title, setTitle] = useState(data?.name || 'Documento sem título');
  const [saved, setSaved] = useState(true);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  
  const [cellData, setCellData] = useState<{[key:string]: string}>({});
  const [selectedCell, setSelectedCell] = useState<{r:number, c:number} | null>({r:0, c:0});
  const [formulaValue, setFormulaValue] = useState('');

  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerSave = useCallback(() => {
    setSaved(false);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    saveTimeoutRef.current = setTimeout(async () => {
        if (!data?.id) return;
        
        let contentToSave = '';
        if (type === 'doc' && editorRef.current) {
            contentToSave = btoa(unescape(encodeURIComponent(editorRef.current.innerHTML)));
        } else if (type === 'sheet') {
            contentToSave = btoa(unescape(encodeURIComponent(JSON.stringify(cellData))));
        }
        
        if (contentToSave) {
            await bridge.saveFileContent(data.id, contentToSave);
            setSaved(true);
        }
    }, 2000);
  }, [data, type, cellData]);

  useEffect(() => {
    if (data?.id) {
        setIsLoadingContent(true);
        bridge.getFileContent(data.id).then(res => {
            if (res.success && res.data) {
                try {
                    const decoded = decodeURIComponent(escape(atob(res.data)));
                    if (type === 'doc' && editorRef.current) {
                        editorRef.current.innerHTML = decoded;
                    } else if (type === 'sheet') {
                        setCellData(JSON.parse(decoded));
                    }
                } catch(e) { console.error("Decode/Parse error", e); }
            }
            setIsLoadingContent(false);
        });
    }
  }, [data, type]);

  const handleFormat = (cmd: string, val?: string) => { document.execCommand(cmd, false, val); checkFormatState(); };
  const checkFormatState = () => { setIsBold(document.queryCommandState('bold')); setIsItalic(document.queryCommandState('italic')); setIsUnderline(document.queryCommandState('underline')); triggerSave(); };

  const getCellId = (r: number, c: number) => `${String.fromCharCode(65+c)}${r+1}`;
  const handleCellClick = (r: number, c: number) => { setSelectedCell({r, c}); setFormulaValue(cellData[getCellId(r, c)] || ''); };
  const handleCellChange = (val: string) => { if (selectedCell) { const id = getCellId(selectedCell.r, selectedCell.c); setCellData(prev => ({ ...prev, [id]: val })); setFormulaValue(val); triggerSave(); } };

  return (
    <div className="flex flex-col h-full bg-[#F9FBFD] font-sans">
        <div className="h-16 px-4 flex items-center justify-between bg-white z-20 shrink-0 border-b border-gray-200">
            <div className="flex items-center gap-3">
                {getFileIcon(type)}
                <div>
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="text-lg outline-none border border-transparent hover:border-black/20 focus:border-blue-500 rounded px-1"/>
                    <div className="text-xs text-gray-500">{saved ? 'Salvo no Drive' : 'Salvando...'}</div>
                </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-red-50 text-gray-500 rounded-full"><X size={22}/></button>
        </div>
        
        <div className="bg-[#EDF2FA] mx-3 my-2 rounded-full flex items-center px-4 py-1.5 gap-1">
            <ToolbarButton onClick={() => handleFormat('bold')} active={isBold} title="Negrito"><Bold size={16}/></ToolbarButton>
            <ToolbarButton onClick={() => handleFormat('italic')} active={isItalic} title="Itálico"><Italic size={16}/></ToolbarButton>
            <ToolbarButton onClick={() => handleFormat('underline')} active={isUnderline} title="Sublinhado"><Underline size={16}/></ToolbarButton>
        </div>
        
        <div className="flex-1 bg-[#F0F2F5] overflow-hidden flex flex-col items-center p-8">
            {isLoadingContent ? <Loader2 className="animate-spin text-blue-500"/> : (
                type === 'doc' ? (
                    <div ref={editorRef} className="w-[816px] min-h-[1056px] bg-white shadow-lg p-24 outline-none" contentEditable onInput={checkFormatState}></div>
                ) : type === 'sheet' ? (
                    <div className="w-full h-full overflow-auto">
                        <table>
                            <thead><tr><th className="sticky top-0 bg-gray-100"></th>{Array.from({length: 26}).map((_, i) => <th key={i} className="sticky top-0 bg-gray-100 p-2 border">{String.fromCharCode(65+i)}</th>)}</tr></thead>
                            <tbody>{Array.from({length: 100}).map((_, r) => <tr key={r}><td className="sticky left-0 bg-gray-100 p-2 border">{r+1}</td>{Array.from({length: 26}).map((_, c) => <td key={c} onClick={() => handleCellClick(r,c)} className={`p-1 border min-w-[100px] ${selectedCell?.r === r && selectedCell?.c === c ? 'border-2 border-blue-500' : ''}`} contentEditable onBlur={(e) => handleCellChange(e.currentTarget.innerText)} suppressContentEditableWarning>{cellData[getCellId(r,c)] || ''}</td>)}</tr>)}</tbody>
                        </table>
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">Preview de Slides Indisponível</div>
                )
            )}
        </div>
    </div>
  );
}