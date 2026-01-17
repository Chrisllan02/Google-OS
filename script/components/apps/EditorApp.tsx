import React from 'react';
import { 
  X, Lock, Undo, Redo, Printer, SpellCheck, PaintRoller,
  Bold, Italic, Underline
} from 'lucide-react';
import { GoogleIcons } from '../GoogleIcons';

interface EditorAppProps {
  onClose: () => void;
  type: string;
  data: any;
}

const getFileIcon = (type: string) => {
  switch(type) {
    case 'sheet': return <GoogleIcons.Sheets className="w-5 h-5" />;
    case 'slide': return <GoogleIcons.Slides className="w-5 h-5" />;
    case 'doc': return <GoogleIcons.Docs className="w-5 h-5" />;
    default: return null;
  }
};

const getTitle = (type: string) => {
    switch(type) {
        case 'doc': return 'Sem título.docx';
        case 'sheet': return 'Planilha sem título.xlsx';
        case 'slide': return 'Apresentação sem título.ppt';
        default: return 'Documento';
    }
}

export default function EditorApp({ onClose, type, data }: EditorAppProps) {
  return (
    <div className="flex flex-col h-full bg-[#F9FBFD]">
        <div className="h-14 px-4 flex items-center justify-between border-b border-gray-200 bg-white z-20 shrink-0">
            <div className="flex items-center gap-4">
                <div onClick={onClose} className="cursor-pointer">{getFileIcon(type)}</div>
                <div className="flex flex-col">
                    <span className="text-black text-lg leading-tight cursor-text hover:border hover:border-black/20 rounded px-1 -ml-1">{getTitle(type)}</span>
                    <div className="flex gap-2 text-[11px] text-gray-600 mt-0.5"><span className="hover:bg-gray-100 px-1 rounded cursor-pointer">Arquivo</span><span className="hover:bg-gray-100 px-1 rounded cursor-pointer">Editar</span><span className="hover:bg-gray-100 px-1 rounded cursor-pointer">Ver</span></div>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <button className="flex items-center gap-2 bg-[#C2E7FF] text-[#001D35] px-4 py-2 rounded-full text-sm font-medium hover:shadow-md transition-all"><Lock size={16} /> Partilhar</button>
                <div className="w-8 h-8 bg-purple-600 rounded-full text-white flex items-center justify-center font-bold text-xs">D</div>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X size={20}/></button>
            </div>
        </div>
        
        <div className="h-10 bg-[#EDF2FA] mx-4 my-2 rounded-full flex items-center px-4 gap-4 overflow-hidden shrink-0"><div className="flex gap-2 text-gray-700"><Undo size={16}/><Redo size={16}/><Printer size={16}/><SpellCheck size={16}/><PaintRoller size={16}/></div><div className="w-px h-4 bg-gray-300"></div><div className="flex gap-3 text-gray-700"><Bold size={16}/><Italic size={16}/><Underline size={16}/></div></div>
        
        <div className="flex-1 bg-[#E1E5EA] overflow-y-auto flex justify-center p-8 custom-scrollbar">
            {type === 'doc' && (
                <div className="w-[800px] min-h-[1000px] bg-white shadow-lg p-16 outline-none text-black selection:bg-blue-200" contentEditable suppressContentEditableWarning>
                    <h1 className="text-3xl font-bold mb-4">Proposta de Projeto</h1>
                    <p className="mb-4">Este documento descreve o escopo inicial para o projeto.</p>
                </div>
            )}
            {type === 'sheet' && (
                <div className="w-full h-full bg-white shadow overflow-hidden relative">
                    <div className="grid grid-cols-[40px_1fr] h-full">
                        <div className="bg-gray-100 border-r border-gray-300 flex flex-col text-xs text-center text-gray-500 pt-8">{[...Array(50)].map((_, i) => <div key={i} className="h-6 border-b border-gray-300 flex items-center justify-center">{i+1}</div>)}</div>
                        <div className="flex flex-col"><div className="flex h-8 bg-gray-100 border-b border-gray-300">{['A','B','C','D','E','F'].map(l => <div key={l} className="flex-1 border-r border-gray-300 flex items-center justify-center text-xs font-bold text-gray-600">{l}</div>)}</div><div className="flex-1 bg-white relative grid grid-cols-6 grid-rows-[repeat(50,24px)]">{[...Array(300)].map((_, i) => <div key={i} className="border-r border-b border-gray-200 outline-none focus:border-blue-500 focus:border-2 focus:z-10" contentEditable></div>)}</div></div>
                    </div>
                </div>
            )}
            {type === 'slide' && (
                <div className="w-full h-full flex gap-4">
                    <div className="w-48 bg-white border-r border-gray-200 flex flex-col gap-4 p-4 overflow-y-auto">
                        {[1,2,3].map(i => (
                            <div key={i} className={`aspect-video border-2 rounded ${i===1 ? 'border-orange-400 ring-2 ring-orange-200' : 'border-gray-200'} bg-white shadow-sm flex items-center justify-center text-xs text-gray-400`}>Slide {i}</div>
                        ))}
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                        <div className="w-[800px] aspect-video bg-white shadow-2xl flex flex-col items-center justify-center text-black p-12">
                            <h1 className="text-5xl font-bold mb-4 text-center">Q3 Review</h1>
                            <p className="text-2xl text-gray-500">Resultados e Metas</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
}