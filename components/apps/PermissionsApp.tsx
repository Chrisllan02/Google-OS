import React, { useState, useEffect, FormEvent } from 'react';
import { Users, KeyRound, Trash2, Eye, Edit3, ShieldAlert, X } from 'lucide-react';
import { bridge, SharedPermission, ResourceType, AccessLevel } from '../../utils/GASBridge';

interface PermissionsAppProps {
  onClose: () => void;
  data: any;
  isDarkMode?: boolean;
  showToast?: (msg: string) => void;
}

export default function PermissionsApp({ onClose, data, isDarkMode = true, showToast }: PermissionsAppProps) {
  const currentUserEmail = data?.user?.email || '';

  const [sharedByMe, setSharedByMe] = useState<SharedPermission[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<SharedPermission[]>([]);
  const [collabEmail, setCollabEmail] = useState('');
  const [resource, setResource] = useState<ResourceType>('all');
  const [access, setAccess] = useState<AccessLevel>('read');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const toast = (msg: string) => showToast && showToast(msg);

  const cardClass = isDarkMode
    ? 'bg-white/5 border border-white/5 rounded-3xl'
    : 'bg-white border border-gray-200 rounded-3xl shadow-sm';
  const textColor = isDarkMode ? 'text-white' : 'text-[#202124]';
  const subText = isDarkMode ? 'text-white/50' : 'text-gray-500';
  const inputClass = isDarkMode
    ? 'bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-blue-500/60'
    : 'bg-gray-50 border-gray-200 text-[#202124] placeholder:text-gray-400 focus:border-blue-500';

  const loadPermissions = async () => {
    const res = await bridge.getPermissions(currentUserEmail);
    setSharedByMe(res.sharedByMe);
    setSharedWithMe(res.sharedWithMe);
  };

  useEffect(() => { loadPermissions(); }, [currentUserEmail]);

  const handleCreateShare = async (e: FormEvent) => {
    e.preventDefault();
    const email = collabEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      toast('Informe um e-mail de colaborador válido.');
      return;
    }
    await bridge.createPermission(currentUserEmail, email, resource, access);
    setCollabEmail('');
    toast(`Compartilhamento registrado com ${email}`);
    loadPermissions();
  };

  const handleToggleAccess = async (perm: SharedPermission) => {
    const next: AccessLevel = perm.accessLevel === 'read' ? 'write' : 'read';
    await bridge.updatePermission(perm.id, next);
    toast(`Acesso de ${perm.collaboratorEmail} alterado para ${next === 'read' ? 'leitura' : 'escrita'}`);
    loadPermissions();
  };

  const handleRevoke = async (perm: SharedPermission) => {
    await bridge.revokePermission(perm.id);
    setConfirmDeleteId(null);
    toast(`Acessos de ${perm.collaboratorEmail} revogados`);
    loadPermissions();
  };

  const resourceLabel = (r: ResourceType) => r === 'all' ? 'Completo' : r === 'calendar' ? 'Agenda' : 'Tarefas';

  return (
    <div className={`flex flex-col h-full ${isDarkMode ? 'bg-[#191919] text-white' : 'bg-[#F0F2F5] text-[#202124]'} overflow-hidden transition-colors duration-300 font-sans`}>
      {/* Header */}
      <div className={`h-16 flex items-center justify-between px-8 border-b ${isDarkMode ? 'border-white/5 bg-[#191919]/50' : 'border-gray-200 bg-white'} shrink-0 backdrop-blur-xl`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#4285F4]/10 rounded-full"><Users size={20} className="text-[#4285F4]" /></div>
          <h2 className="text-xl font-normal">Permissões de Compartilhamento</h2>
        </div>
        <button onClick={onClose} className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10 text-white/60' : 'hover:bg-gray-100 text-gray-500'}`}>
          <X size={24} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-right-10 duration-300">

          {/* Formulário de nova regra */}
          <div className="md:col-span-1">
            <div className={`${cardClass} p-6`}>
              <div className={`mb-4 flex items-center gap-2 border-b ${isDarkMode ? 'border-white/5' : 'border-gray-100'} pb-3`}>
                <KeyRound className="text-[#4285F4]" size={17} />
                <h3 className={`font-medium ${textColor} text-sm`}>Criar regra de compartilhamento</h3>
              </div>

              <form onSubmit={handleCreateShare} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className={`text-[10px] uppercase tracking-wider font-bold ${subText}`}>E-mail do colaborador</label>
                  <input
                    type="email"
                    placeholder="colaborador@empresa.com"
                    value={collabEmail}
                    onChange={e => setCollabEmail(e.target.value)}
                    className={`w-full rounded-full border px-4 py-2.5 text-sm outline-none transition-colors ${inputClass}`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={`text-[10px] uppercase tracking-wider font-bold ${subText}`}>Recurso do Workspace</label>
                  <select
                    value={resource}
                    onChange={e => setResource(e.target.value as ResourceType)}
                    className={`w-full rounded-full border px-4 py-2.5 text-sm outline-none transition-colors ${isDarkMode ? 'bg-[#191919] border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-[#202124]'}`}
                  >
                    <option value="all">Sincronização geral (Agenda e Tarefas)</option>
                    <option value="calendar">Apenas Agenda</option>
                    <option value="tasks">Apenas Tarefas</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className={`text-[10px] uppercase tracking-wider font-bold ${subText}`}>Direitos de acesso</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['read', 'write'] as AccessLevel[]).map(level => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setAccess(level)}
                        className={`rounded-full border py-2.5 text-center text-xs font-medium transition-all ${
                          access === level
                            ? 'border-[#4285F4] bg-[#4285F4]/15 text-[#4285F4]'
                            : (isDarkMode ? 'border-white/10 text-white/50 hover:text-white' : 'border-gray-200 text-gray-500 hover:text-black')
                        }`}
                      >
                        {level === 'read' ? 'Leitura' : 'Escrita'}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!collabEmail}
                  className="w-full rounded-full bg-[#4285F4] hover:bg-[#3367d6] disabled:opacity-40 text-white font-medium py-2.5 text-sm shadow-md shadow-blue-500/20 transition-all active:scale-95"
                >
                  Aplicar política de acesso
                </button>
              </form>
            </div>
          </div>

          {/* Listas */}
          <div className="md:col-span-2 flex flex-col space-y-6">
            <div className={`${cardClass} p-6`}>
              <div className={`flex items-center gap-2 border-b ${isDarkMode ? 'border-white/5' : 'border-gray-100'} pb-3 mb-4`}>
                <Users className="text-[#4285F4]" size={17} />
                <h3 className={`font-medium ${textColor} text-sm`}>Concedidos por você</h3>
              </div>
              <div className="space-y-2 max-h-[240px] overflow-y-auto custom-scrollbar pr-1">
                {sharedByMe.length === 0 ? (
                  <p className={`text-center py-6 text-xs ${subText}`}>Nenhum recurso compartilhado por você até o momento.</p>
                ) : (
                  sharedByMe.map(perm => (
                    <div key={perm.id} className={`relative overflow-hidden border rounded-2xl p-3.5 text-xs flex items-center justify-between transition-colors ${isDarkMode ? 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]' : 'border-gray-100 bg-gray-50/60 hover:bg-gray-50'}`}>
                      <div>
                        <p className={`font-medium ${textColor}`}>{perm.collaboratorEmail}</p>
                        <div className={`mt-1 flex flex-wrap items-center gap-2 text-[10px] ${subText}`}>
                          <span className="rounded-full bg-[#4285F4]/10 text-[#4285F4] px-2 py-0.5 border border-[#4285F4]/15">
                            {resourceLabel(perm.resourceType)}
                          </span>
                          <span className="rounded-full bg-[#4285F4]/10 text-[#4285F4] px-2 py-0.5 border border-[#4285F4]/15">
                            {perm.accessLevel === 'read' ? 'Somente leitura' : 'Leitura e escrita'}
                          </span>
                          <span className="font-mono text-[9px]">
                            {new Date(perm.createdAt).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleToggleAccess(perm)}
                          title="Inverter nível de acesso"
                          className={`rounded-full p-2 transition-colors ${isDarkMode ? 'hover:bg-white/10 text-white/60 hover:text-white' : 'hover:bg-gray-100 text-gray-400 hover:text-black'}`}
                        >
                          {perm.accessLevel === 'read' ? <Eye size={13} /> : <Edit3 size={13} />}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(perm.id)}
                          title="Revogar acesso"
                          className={`rounded-full p-2 transition-colors hover:bg-[#EA4335]/15 hover:text-[#EA4335] ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {confirmDeleteId === perm.id && (
                        <div className={`absolute inset-0 rounded-2xl flex items-center justify-between px-4 py-2 z-10 border-l-2 border-[#EA4335] ${isDarkMode ? 'bg-black/95' : 'bg-white/98'}`}>
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <ShieldAlert size={13} className="text-[#EA4335]" />
                            <span className={textColor}>Revogar todos os acessos deste colaborador?</span>
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleRevoke(perm)}
                              className="bg-[#EA4335] hover:bg-[#d93025] rounded-full px-3 py-1.5 text-[9px] font-bold text-white transition"
                            >
                              Sim, revogar
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className={`rounded-full px-3 py-1.5 text-[9px] transition ${isDarkMode ? 'bg-white/10 hover:bg-white/15 text-white' : 'bg-gray-100 hover:bg-gray-200 text-black'}`}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className={`${cardClass} p-6`}>
              <div className={`flex items-center gap-2 border-b ${isDarkMode ? 'border-white/5' : 'border-gray-100'} pb-3 mb-4`}>
                <Users className="text-emerald-500" size={17} />
                <h3 className={`font-medium ${textColor} text-sm`}>Recebidos de colegas</h3>
              </div>
              <div className="space-y-2 max-h-[240px] overflow-y-auto custom-scrollbar pr-1">
                {sharedWithMe.length === 0 ? (
                  <p className={`text-center py-6 text-xs ${subText}`}>Nenhum recurso compartilhado com seu e-mail.</p>
                ) : (
                  sharedWithMe.map(perm => (
                    <div key={perm.id} className={`border rounded-2xl p-3.5 text-xs flex items-center justify-between ${isDarkMode ? 'border-white/5 bg-white/[0.02]' : 'border-gray-100 bg-gray-50/60'}`}>
                      <div>
                        <p className={`font-medium ${textColor}`}>{perm.ownerEmail}</p>
                        <div className={`mt-1 flex items-center gap-2 text-[10px] ${subText}`}>
                          <span className="rounded-full bg-[#4285F4]/10 text-[#4285F4] px-2 py-0.5 border border-[#4285F4]/15">
                            {resourceLabel(perm.resourceType)}
                          </span>
                          <span className="rounded-full bg-[#4285F4]/10 text-[#4285F4] px-2 py-0.5 border border-[#4285F4]/15">
                            {perm.accessLevel === 'read' ? 'Somente leitura' : 'Leitura e escrita'}
                          </span>
                        </div>
                      </div>
                      <span className="rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] px-2.5 py-0.5 font-bold">
                        ATIVO
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
