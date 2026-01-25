


import React, { useState } from 'react';
import { 
  User, Moon, Bell, Shield, HardDrive, 
  LogOut, X, ChevronRight, ToggleLeft, ToggleRight,
  Monitor, Smartphone, Globe, RefreshCcw, CreditCard
} from 'lucide-react';

interface SettingsAppProps {
  onClose: () => void;
  data: any;
  toggleTheme?: () => void;
  isDarkMode?: boolean;
}

export default function SettingsApp({ onClose, data, toggleTheme, isDarkMode }: SettingsAppProps) {
  const [activeTab, setActiveTab] = useState('profile');
  const [notifications, setNotifications] = useState(true);

  const tabs = [
    { id: 'profile', label: 'Perfil', icon: User },
    { id: 'appearance', label: 'Aparência', icon: Moon },
    { id: 'notifications', label: 'Notificações', icon: Bell },
    { id: 'storage', label: 'Armazenamento', icon: HardDrive },
    { id: 'privacy', label: 'Privacidade', icon: Shield },
  ];

  return (
    <div className={`flex h-full ${isDarkMode ? 'bg-[#191919] text-white' : 'bg-white text-black'} overflow-hidden transition-colors duration-300`}>
      {/* Sidebar */}
      <div className={`w-64 border-r ${isDarkMode ? 'border-white/5 bg-white/[0.02]' : 'border-black/5 bg-gray-50'} flex flex-col`}>
        <div className={`h-16 flex items-center px-6 border-b ${isDarkMode ? 'border-white/5' : 'border-black/5'} shrink-0`}>
          <span className="text-lg font-light tracking-tight">Configurações</span>
        </div>
        <div className="p-3 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${activeTab === tab.id ? 'bg-[#4E79F3] text-white shadow-lg shadow-blue-900/20' : (isDarkMode ? 'text-white/60 hover:bg-white/5 hover:text-white' : 'text-black/60 hover:bg-black/5 hover:text-black')}`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>
        <div className={`mt-auto p-4 border-t ${isDarkMode ? 'border-white/5' : 'border-black/5'}`}>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-colors">
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className={`h-16 flex items-center justify-between px-8 border-b ${isDarkMode ? 'border-white/5 bg-[#191919]/50' : 'border-black/5 bg-white/50'} shrink-0 backdrop-blur-xl`}>
          <h2 className="text-xl font-medium">{tabs.find(t => t.id === activeTab)?.label}</h2>
          <button onClick={onClose} className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10 text-white/60' : 'hover:bg-black/10 text-black/60'}`}>
            <X size={24} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-10 duration-300">
            
            {activeTab === 'profile' && (
              <>
                <div className={`flex items-center gap-6 p-6 ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-black/5 border-black/5'} rounded-2xl border`}>
                  <img src={data?.user?.avatar} alt="Avatar" className={`w-20 h-20 rounded-full border-2 ${isDarkMode ? 'border-white/20' : 'border-black/20'}`} />
                  <div>
                    <h3 className="text-xl font-medium">{data?.user?.name}</h3>
                    <p className={`${isDarkMode ? 'text-white/50' : 'text-black/50'} text-sm mb-3`}>{data?.user?.email}</p>
                    <button className={`px-4 py-2 ${isDarkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-black/10 hover:bg-black/20'} rounded-full text-xs font-medium transition-colors`}>Alterar foto</button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className={`text-xs font-bold ${isDarkMode ? 'text-white/40' : 'text-black/40'} uppercase tracking-wider`}>Informações Pessoais</h4>
                  <div className={`${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-black/5 border-black/5'} rounded-2xl border overflow-hidden`}>
                    <div className={`p-4 flex items-center justify-between border-b ${isDarkMode ? 'border-white/5 hover:bg-white/[0.02]' : 'border-black/5 hover:bg-black/[0.02]'} cursor-pointer`}>
                      <div>
                        <p className="text-sm font-medium">Nome de exibição</p>
                        <p className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-black/50'}`}>{data?.user?.name}</p>
                      </div>
                      <ChevronRight size={16} className={isDarkMode ? 'text-white/30' : 'text-black/30'} />
                    </div>
                    <div className={`p-4 flex items-center justify-between ${isDarkMode ? 'hover:bg-white/[0.02]' : 'hover:bg-black/[0.02]'} cursor-pointer`}>
                      <div>
                        <p className="text-sm font-medium">Senha</p>
                        <p className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-black/50'}`}>••••••••••••</p>
                      </div>
                      <ChevronRight size={16} className={isDarkMode ? 'text-white/30' : 'text-black/30'} />
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'storage' && (
              <>
                <div className={`p-6 ${isDarkMode ? 'bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-white/10' : 'bg-white border-black/10'} rounded-2xl border`}>
                  <div className="flex items-center gap-4 mb-6">
                    <div className={`p-3 ${isDarkMode ? 'bg-white/10' : 'bg-blue-50'} rounded-full`}><HardDrive size={24} className="text-blue-400" /></div>
                    <div>
                      <h3 className="text-lg font-medium">Armazenamento do Workspace</h3>
                      <p className={`${isDarkMode ? 'text-white/60' : 'text-black/60'} text-sm`}>{data?.stats?.storageUsed}% utilizado de 15 GB</p>
                    </div>
                  </div>
                  <div className={`w-full ${isDarkMode ? 'bg-black/40' : 'bg-gray-200'} h-2 rounded-full overflow-hidden mb-2`}>
                    <div className="bg-gradient-to-r from-blue-500 via-purple-500 to-red-500 h-full rounded-full" style={{ width: `${data?.stats?.storageUsed}%` }}></div>
                  </div>
                  <div className={`flex justify-between text-xs ${isDarkMode ? 'text-white/40' : 'text-black/40'} mt-4`}>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Drive</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500"></span> Gmail</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Fotos</span>
                  </div>
                </div>
                
                <button className={`w-full py-4 border border-dashed ${isDarkMode ? 'border-white/10 text-white/50 hover:text-white hover:border-white/30 hover:bg-white/5' : 'border-black/10 text-black/50 hover:text-black hover:border-black/30 hover:bg-black/5'} rounded-xl transition-all flex items-center justify-center gap-2`}>
                  <CreditCard size={18}/> Fazer upgrade do armazenamento
                </button>
              </>
            )}

            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div className={`${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-black/5 border-black/5'} rounded-2xl border p-4 flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 ${isDarkMode ? 'bg-white/10' : 'bg-black/10'} rounded-lg`}><Moon size={20} /></div>
                    <div>
                      <p className="text-sm font-medium">Modo Escuro</p>
                      <p className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-black/50'}`}>Ajustar aparência para ambientes com pouca luz</p>
                    </div>
                  </div>
                  <button onClick={toggleTheme} className="text-blue-500 transition-colors">
                    {isDarkMode ? <ToggleRight size={32} className="fill-blue-500/20"/> : <ToggleLeft size={32} className="text-black/30"/>}
                  </button>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                   {['bg-[#191919]', 'bg-[#0f172a]', 'bg-white'].map((bg, i) => (
                     <div 
                        key={i} 
                        onClick={() => { if ((bg === 'bg-white' && isDarkMode) || (bg !== 'bg-white' && !isDarkMode)) toggleTheme && toggleTheme(); }}
                        className={`h-24 rounded-xl border-2 cursor-pointer transition-all ${bg} ${(isDarkMode && bg !== 'bg-white') || (!isDarkMode && bg === 'bg-white') ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-500/20 hover:border-gray-500/50'}`}
                     ></div>
                   ))}
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
               <div className="space-y-4">
                  {['E-mails prioritários', 'Convites de agenda', 'Tarefas pendentes', 'Menções em documentos'].map((item, i) => (
                    <div key={i} className={`flex items-center justify-between p-4 ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-black/5 border-black/5'} rounded-xl border`}>
                      <span className={`text-sm ${isDarkMode ? 'text-white/80' : 'text-black/80'}`}>{item}</span>
                      <button className="text-blue-500">
                        <ToggleRight size={28} className="fill-blue-500/20"/>
                      </button>
                    </div>
                  ))}
               </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
