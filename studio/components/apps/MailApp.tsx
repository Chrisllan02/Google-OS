import React, { useState } from 'react';
import { 
  Search, Settings, X, Plus, Menu, ArrowLeft,
  Inbox, Star, Clock, Send, File, AlertOctagon, Trash2,
  ChevronLeft, ChevronRight, RotateCw, MoreVertical,
  Archive, Mail, AlertCircle, Printer, Reply, Forward,
  ExternalLink, Paperclip, Image as ImageIcon, Smile, Lock, PenTool,
  SlidersHorizontal
} from 'lucide-react';
import { GoogleIcons } from '../GoogleIcons';
import { Tooltip } from '../Tooltip';

const Checkbox = ({ checked, onChange, className = '' }: { checked: boolean; onChange: () => void; className?: string }) => (
  <div 
    onClick={(e) => { e.stopPropagation(); onChange(); }}
    className={`w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-colors ${checked ? 'bg-[#c2e7ff] border-[#c2e7ff]' : `border-[#e8eaed]/50 hover:border-[#e8eaed] ${className}`}`}
  >
    {checked && <div className="w-3 h-3 bg-[#001d35] rounded-sm" />}
  </div>
);

interface MailAppProps {
  onClose: () => void;
  data: any;
  searchQuery?: string;
}

export default function MailApp({ onClose, data, searchQuery = '' }: MailAppProps) {
  const [selectedFolder, setSelectedFolder] = useState('inbox');
  const [selectedEmails, setSelectedEmails] = useState<Set<number>>(new Set());
  const [readingEmail, setReadingEmail] = useState<any>(null);
  const [hoverEmailId, setHoverEmailId] = useState<number | null>(null);

  // Filtro de e-mails baseado na pasta e busca
  const filteredEmails = data?.emails?.filter((email: any) => {
    // Lógica simples de filtro por "pasta" (simulada)
    if (selectedFolder === 'inbox') return true; // Mostrar todos no inbox por enquanto
    if (selectedFolder === 'starred') return false; // Mock
    return true;
  }).filter((email: any) => {
    if (!searchQuery) return true;
    return email.subject.toLowerCase().includes(searchQuery.toLowerCase()) || 
           email.sender.toLowerCase().includes(searchQuery.toLowerCase());
  }) || [];

  const toggleEmailSelection = (id: number) => {
    const newSet = new Set(selectedEmails);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedEmails(newSet);
  };

  const handleEmailClick = (email: any) => {
    setReadingEmail(email);
  };

  const SidebarItem = ({ id, icon: Icon, label, count, color }: any) => (
    <div 
      onClick={() => { setSelectedFolder(id); setReadingEmail(null); }}
      className={`flex items-center justify-between px-6 py-2 rounded-r-full mr-4 cursor-pointer transition-colors ${selectedFolder === id ? 'bg-[#432a28] text-[#e8eaed] font-bold' : 'text-[#e8eaed]/80 hover:bg-[#e8eaed]/5'}`}
    >
      <div className="flex items-center gap-4">
        <Icon size={18} className={selectedFolder === id ? (color || 'text-[#e8eaed]') : 'text-[#9aa0a6]'} />
        <span className="text-sm">{label}</span>
      </div>
      {count && <span className="text-xs font-medium">{count}</span>}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-[#e8eaed] font-sans">
      {/* HEADER DO APP */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-[#e8eaed]/10 shrink-0 bg-[#1e1e1e]">
        <div className="flex items-center gap-3 w-60">
          <Tooltip label="Menu principal">
            <button className="p-3 hover:bg-[#e8eaed]/10 rounded-full transition-colors text-[#e8eaed]">
              <Menu size={20} />
            </button>
          </Tooltip>
          <div className="flex items-center gap-2 pr-4">
            <GoogleIcons.GmailGlass className="w-8 h-8" />
            <span className="text-xl text-[#e8eaed] tracking-tight">Gmail</span>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="flex-1 max-w-3xl">
          <div className="bg-[#303134] flex items-center px-4 py-3 rounded-full focus-within:bg-white focus-within:shadow-md group transition-all">
            <Tooltip label="Pesquisar">
              <button className="text-[#9aa0a6] group-focus-within:text-[#5f6368] mr-3">
                <Search size={20} />
              </button>
            </Tooltip>
            <input 
              type="text" 
              placeholder="Pesquisar e-mail" 
              className="bg-transparent border-none outline-none w-full text-[#e8eaed] group-focus-within:text-black placeholder:text-[#9aa0a6] text-base"
              defaultValue={searchQuery}
            />
            <Tooltip label="Mostrar opções de pesquisa">
              <button className="text-[#9aa0a6] group-focus-within:text-[#5f6368] ml-2">
                <SlidersHorizontal size={18} />
              </button>
            </Tooltip>
          </div>
        </div>

        <div className="flex items-center justify-end w-60 gap-2">
          <Tooltip label="Configurações">
            <button className="p-2 hover:bg-[#e8eaed]/10 rounded-full text-[#e8eaed]"><Settings size={20}/></button>
          </Tooltip>
          <Tooltip label="Google Apps">
            <button className="p-2 hover:bg-[#e8eaed]/10 rounded-full text-[#e8eaed]"><RotateCw size={20}/></button>
          </Tooltip>
          <Tooltip label="Fechar">
            <button onClick={onClose} className="p-2 hover:bg-[#e8eaed]/10 rounded-full text-[#e8eaed]"><X size={24}/></button>
          </Tooltip>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR */}
        <div className="w-64 py-4 flex flex-col gap-2 shrink-0 overflow-y-auto custom-scrollbar">
          <div className="pl-4 pr-6 mb-2">
            <Tooltip label="Escrever">
              <button className="flex items-center gap-3 bg-[#c2e7ff] text-[#001d35] px-6 py-4 rounded-2xl hover:shadow-lg hover:bg-[#c2e7ff] transition-all font-medium text-sm">
                <Plus size={24} />
                Escrever
              </button>
            </Tooltip>
          </div>

          <SidebarItem id="inbox" icon={Inbox} label="Entrada" count={data?.emails?.length} />
          <SidebarItem id="starred" icon={Star} label="Com estrela" />
          <SidebarItem id="snoozed" icon={Clock} label="Adiados" />
          <SidebarItem id="sent" icon={Send} label="Enviados" />
          <SidebarItem id="drafts" icon={File} label="Rascunhos" />
          <SidebarItem id="spam" icon={AlertOctagon} label="Spam" />
          <SidebarItem id="trash" icon={Trash2} label="Lixeira" />
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 bg-[#1b1b1b] m-2 rounded-2xl overflow-hidden flex flex-col relative">
          
          {readingEmail ? (
            /* VISUALIZAÇÃO DE LEITURA */
            <div className="flex flex-col h-full animate-in fade-in zoom-in duration-200">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#e8eaed]/10 bg-[#1e1e1e]">
                <div className="flex items-center gap-4">
                  <Tooltip label="Voltar">
                    <button onClick={() => setReadingEmail(null)} className="p-2 hover:bg-[#e8eaed]/10 rounded-full text-[#e8eaed]">
                      <ArrowLeft size={18} />
                    </button>
                  </Tooltip>
                  <div className="flex items-center gap-1">
                    <Tooltip label="Arquivar"><button className="p-2 hover:bg-[#e8eaed]/10 rounded-full text-[#e8eaed]/70"><Archive size={18} /></button></Tooltip>
                    <Tooltip label="Denunciar spam"><button className="p-2 hover:bg-[#e8eaed]/10 rounded-full text-[#e8eaed]/70"><AlertOctagon size={18} /></button></Tooltip>
                    <Tooltip label="Excluir"><button className="p-2 hover:bg-[#e8eaed]/10 rounded-full text-[#e8eaed]/70"><Trash2 size={18} /></button></Tooltip>
                  </div>
                  <div className="w-[1px] h-5 bg-[#e8eaed]/20 mx-1"></div>
                  <div className="flex items-center gap-1">
                    <Tooltip label="Marcar como não lida"><button className="p-2 hover:bg-[#e8eaed]/10 rounded-full text-[#e8eaed]/70"><Mail size={18} /></button></Tooltip>
                    <Tooltip label="Adiar"><button className="p-2 hover:bg-[#e8eaed]/10 rounded-full text-[#e8eaed]/70"><Clock size={18} /></button></Tooltip>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <span className="text-xs text-[#e8eaed]/50">1 de {filteredEmails.length}</span>
                   <button className="p-2 hover:bg-[#e8eaed]/10 rounded-full text-[#e8eaed]/70"><ChevronLeft size={18}/></button>
                   <button className="p-2 hover:bg-[#e8eaed]/10 rounded-full text-[#e8eaed]/70"><ChevronRight size={18}/></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl text-[#e8eaed]">{readingEmail.subject}</h2>
                  <div className="flex gap-2">
                    <div className="px-2 py-1 bg-[#e8eaed]/10 rounded text-xs text-[#e8eaed]/70">Caixa de Entrada</div>
                  </div>
                </div>

                <div className="flex items-start gap-4 mb-6">
                   <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-medium text-white ${readingEmail.avatarColor || 'bg-blue-600'}`}>
                      {readingEmail.sender[0]}
                   </div>
                   <div className="flex-1">
                      <div className="flex justify-between items-baseline">
                         <span className="font-bold text-[#e8eaed] text-sm">{readingEmail.sender} <span className="text-[#e8eaed]/50 font-normal text-xs">&lt;email@workspace.new&gt;</span></span>
                         <span className="text-xs text-[#e8eaed]/50">{readingEmail.time}</span>
                      </div>
                      <div className="text-xs text-[#e8eaed]/50">para mim</div>
                   </div>
                </div>

                <div className="text-sm text-[#e8eaed] leading-relaxed whitespace-pre-wrap pl-14 mb-10">
                  {readingEmail.preview}
                  <br/><br/>
                  <p>Atenciosamente,<br/>{readingEmail.sender}</p>
                </div>

                <div className="pl-14 flex gap-3">
                   <button className="flex items-center gap-2 px-4 py-2 border border-[#e8eaed]/20 rounded-full text-[#e8eaed]/80 hover:bg-[#e8eaed]/5 text-sm font-medium transition-colors">
                      <Reply size={16} /> Responder
                   </button>
                   <button className="flex items-center gap-2 px-4 py-2 border border-[#e8eaed]/20 rounded-full text-[#e8eaed]/80 hover:bg-[#e8eaed]/5 text-sm font-medium transition-colors">
                      <Forward size={16} /> Encaminhar
                   </button>
                </div>
              </div>
            </div>
          ) : (
            /* LISTA DE EMAILS */
            <div className="flex flex-col h-full">
              {/* TOOLBAR DA LISTA */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-[#e8eaed]/10">
                <div className="flex items-center gap-1">
                  <div className="p-2 hover:bg-[#e8eaed]/10 rounded-md cursor-pointer mr-1">
                    <Checkbox checked={selectedEmails.size > 0} onChange={() => setSelectedEmails(new Set())} className="border-[#e8eaed]/50" />
                  </div>
                  <Tooltip label="Atualizar">
                    <button className="p-2 hover:bg-[#e8eaed]/10 rounded-full text-[#e8eaed]/70"><RotateCw size={18}/></button>
                  </Tooltip>
                  <Tooltip label="Mais">
                    <button className="p-2 hover:bg-[#e8eaed]/10 rounded-full text-[#e8eaed]/70"><MoreVertical size={18}/></button>
                  </Tooltip>
                </div>
                <div className="text-xs text-[#e8eaed]/50">
                  1-{filteredEmails.length} de {filteredEmails.length}
                </div>
              </div>

              {/* LISTA SCROLLABLE */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {filteredEmails.map((email: any) => (
                  <div 
                    key={email.id}
                    onMouseEnter={() => setHoverEmailId(email.id)}
                    onMouseLeave={() => setHoverEmailId(null)}
                    onClick={() => handleEmailClick(email)}
                    className={`flex items-center px-4 py-2.5 border-b border-[#e8eaed]/10 cursor-pointer group transition-colors ${selectedEmails.has(email.id) ? 'bg-[#c2e7ff]/20' : 'hover:bg-[#e8eaed]/5 bg-[#1b1b1b]'}`}
                  >
                    {/* Ações Esquerda */}
                    <div className="flex items-center gap-3 min-w-[40px]" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selectedEmails.has(email.id)} onChange={() => toggleEmailSelection(email.id)} className="border-[#e8eaed]/30" />
                      <button className="text-[#e8eaed]/30 hover:text-[#e8eaed]"><Star size={18} /></button>
                    </div>

                    {/* Conteúdo */}
                    <div className={`flex-1 flex items-center gap-4 min-w-0 pr-4 ${!email.read ? 'font-bold text-[#e8eaed]' : 'text-[#e8eaed]/80'}`}>
                      <span className="w-48 truncate text-sm shrink-0">{email.sender}</span>
                      <div className="flex-1 truncate text-sm flex items-center">
                        <span className="truncate">{email.subject}</span>
                        <span className={`mx-1 ${!email.read ? 'text-[#e8eaed]' : 'text-[#e8eaed]/60'}`}>-</span>
                        <span className="text-[#e8eaed]/60 truncate font-normal">{email.preview}</span>
                      </div>
                    </div>

                    {/* Ações Direita (Hover) & Data */}
                    <div className="flex items-center justify-end min-w-[100px] gap-2">
                      {hoverEmailId === email.id ? (
                        <div className="flex items-center bg-[#1b1b1b] shadow-sm rounded-r-md pl-2" onClick={(e) => e.stopPropagation()}>
                          <Tooltip label="Arquivar"><button className="p-2 hover:bg-[#e8eaed]/10 rounded-full text-[#e8eaed]/70"><Archive size={16}/></button></Tooltip>
                          <Tooltip label="Excluir"><button className="p-2 hover:bg-[#e8eaed]/10 rounded-full text-[#e8eaed]/70"><Trash2 size={16}/></button></Tooltip>
                          <Tooltip label="Marcar como não lida"><button className="p-2 hover:bg-[#e8eaed]/10 rounded-full text-[#e8eaed]/70"><Mail size={16}/></button></Tooltip>
                          <Tooltip label="Adiar"><button className="p-2 hover:bg-[#e8eaed]/10 rounded-full text-[#e8eaed]/70"><Clock size={16}/></button></Tooltip>
                        </div>
                      ) : (
                        <span className={`text-xs font-bold ${!email.read ? 'text-[#e8eaed]' : 'text-[#e8eaed]/60'}`}>{email.time}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* BARRA LATERAL DIREITA (Add-ons) - Estilo Gmail */}
        <div className="w-14 border-l border-[#e8eaed]/10 flex flex-col items-center py-4 gap-6 bg-[#1e1e1e] shrink-0">
           <Tooltip label="Agenda" position="left"><div className="w-5 h-5 cursor-pointer opacity-70 hover:opacity-100 transition-opacity"><GoogleIcons.GmailGlass size={20} className="grayscale" /></div></Tooltip>
           <Tooltip label="Keep" position="left"><div className="w-5 h-5 cursor-pointer opacity-70 hover:opacity-100 transition-opacity"><GoogleIcons.MeetGlass size={20} className="grayscale" /></div></Tooltip>
           <Tooltip label="Tarefas" position="left"><div className="w-5 h-5 cursor-pointer opacity-70 hover:opacity-100 transition-opacity"><GoogleIcons.DriveGlass size={20} className="grayscale" /></div></Tooltip>
           <Tooltip label="Contatos" position="left"><div className="w-5 h-5 cursor-pointer opacity-70 hover:opacity-100 transition-opacity"><GoogleIcons.DocsGlass size={20} className="grayscale" /></div></Tooltip>
           <div className="w-8 h-[1px] bg-[#e8eaed]/10 my-2"></div>
           <Tooltip label="Instalar complementos" position="left"><button className="text-[#e8eaed]/50 hover:text-[#e8eaed]"><Plus size={20}/></button></Tooltip>
        </div>
      </div>
    </div>
  );
}