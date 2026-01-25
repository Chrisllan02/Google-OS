
import React, { useState } from 'react';
import { 
  User, Moon, Bell, Shield, HardDrive, 
  LogOut, X, ChevronRight, ToggleLeft, ToggleRight,
  Monitor, Smartphone, Globe, RefreshCcw, CreditCard, Laptop,
  Mail, Calendar
} from 'lucide-react';

interface SettingsAppProps {
  onClose: () => void;
  data: any;
  toggleTheme?: () => void;
  isDarkMode?: boolean;
  showToast?: (msg: string) => void;
}

export default function SettingsApp({ onClose, data, toggleTheme, isDarkMode, showToast }: SettingsAppProps) {
  const [activeTab, setActiveTab] = useState('profile');
  const [emailNotif, setEmailNotif] = useState(true);
  const [calNotif, setCalNotif] = useState(true);

  // Helper function for toast
  const toast = (msg: string) => showToast && showToast(msg);

  const handleToggleTheme = () => {
      if (toggleTheme) {
          toggleTheme();
          const newMode = !isDarkMode;
          toast(newMode ? "Modo escuro ativado" : "Modo claro ativado");
      }
  };

  const handleToggleNotification = (setting: string, setter: (val: boolean) => void, val: boolean) => {
      setter(!val);
      toast(`Notificações de ${setting} ${!val ? 'ativadas' : 'desativadas'}`);
  };

  const tabs = [
    { id: 'profile', label: 'Perfil', icon: User },
    { id: 'appearance', label: 'Aparência', icon: Moon },
    { id: 'notifications', label: 'Notificações', icon: Bell },
    { id: 'storage', label: 'Armazenamento', icon: HardDrive },
    { id: 'privacy', label: 'Privacidade', icon: Shield },
  ];

  return (
    <div className={`flex h-full ${isDarkMode ? 'bg-[#191919] text-white' : 'bg-[#F0F2F5] text-[#202124]'} overflow-hidden transition-colors duration-300 font-sans`}>
      {/* Sidebar */}
      <div className={`w-64 border-r ${isDarkMode ? 'border-white/5 bg-white/[0.02]' : 'border-black/5 bg-white'} flex flex-col`}>
        <div className={`h-16 flex items-center px-6 border-b ${isDarkMode ? 'border-white/5' : 'border-black/5'} shrink-0`}>
          <span className="text-xl font-normal tracking-tight">Configurações</span>
        </div>
        <div className="p-3 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-full text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-[#C2E7FF] text-[#001D35]' : (isDarkMode ? 'text-white/70 hover:bg-white/5 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-black')}`}
            >
              <tab.icon size={20} />
              {tab.label}
            </button>
          ))}
        </div>
        <div className={`mt-auto p-4 border-t ${isDarkMode ? 'border-white/5' : 'border-black/5'}`}>
          <button onClick={onClose} className="w-full flex items-center gap-3 px-4 py-3 rounded-full text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors">
            <LogOut size={20} />
            Sair da conta
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 flex flex-col h-full overflow-hidden ${isDarkMode ? '' : 'bg-white m-4 rounded-2xl shadow-sm border border-gray-200'}`}>
        {/* Header */}
        <div className={`h-16 flex items-center justify-between px-8 border-b ${isDarkMode ? 'border-white/5 bg-[#191919]/50' : 'border-gray-100'} shrink-0 backdrop-blur-xl`}>
          <h2 className="text-xl font-normal">{tabs.find(t => t.id === activeTab)?.label}</h2>
          <button onClick={onClose} className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10 text-white/60' : 'hover:bg-gray-100 text-gray-500'}`}>
            <X size={24} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-10 duration-300">
            
            {activeTab === 'profile' && (
              <>
                <div className={`flex items-center gap-6 p-6 ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-white border-gray-200'} rounded-3xl border shadow-sm`}>
                  <img src={data?.user?.avatar} alt="Avatar" className={`w-24 h-24 rounded-full border-4 ${isDarkMode ? 'border-white/10' : 'border-gray-100'}`} />
                  <div>
                    <h3 className="text-2xl font-normal mb-1">{data?.user?.name}</h3>
                    <p className={`${isDarkMode ? 'text-white/50' : 'text-gray-500'} text-sm mb-4`}>{data?.user?.email}</p>
                    <button className={`px-5 py-2 ${isDarkMode ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'} rounded-full text-sm font-medium transition-colors shadow-md`}>Gerenciar sua Conta do Google</button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className={`text-xs font-bold ${isDarkMode ? 'text-white/40' : 'text-gray-400'} uppercase tracking-wider px-2`}>Informações Pessoais</h4>
                  <div className={`${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-white border-gray-200'} rounded-2xl border overflow-hidden`}>
                    <div className={`p-4 flex items-center justify-between border-b ${isDarkMode ? 'border-white/5 hover:bg-white/[0.02]' : 'border-gray-100 hover:bg-gray-50'} cursor-pointer transition-colors`}>
                      <div>
                        <p className="text-sm font-medium">Nome de exibição</p>
                        <p className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>{data?.user?.name}</p>
                      </div>
                      <ChevronRight size={20} className={isDarkMode ? 'text-white/30' : 'text-gray-400'} />
                    </div>
                    <div className={`p-4 flex items-center justify-between ${isDarkMode ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50'} cursor-pointer transition-colors`}>
                      <div>
                        <p className="text-sm font-medium">Senha</p>
                        <p className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Última alteração: há 3 meses</p>
                      </div>
                      <ChevronRight size={20} className={isDarkMode ? 'text-white/30' : 'text-gray-400'} />
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'storage' && (
              <>
                <div className={`p-8 ${isDarkMode ? 'bg-gradient-to-br from-blue-900/20 to-purple-900/20 border-white/10' : 'bg-white border-gray-200'} rounded-3xl border text-center shadow-sm`}>
                    <div className="w-48 h-48 mx-auto relative flex items-center justify-center mb-6">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                            <path className={`${isDarkMode ? 'text-white/10' : 'text-gray-100'}`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.8" />
                            <path className="text-blue-500 drop-shadow-lg" strokeDasharray={`${data?.stats?.storageUsed}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.8" strokeLinecap="round" />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                            <span className="text-3xl font-bold">{data?.stats?.storageUsed}%</span>
                            <span className={`text-xs ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>usado</span>
                        </div>
                    </div>
                    <h3 className="text-lg font-medium mb-1">Armazenamento do Workspace</h3>
                    <p className={`${isDarkMode ? 'text-white/60' : 'text-gray-500'} text-sm mb-6`}>Você usou {Math.round(data?.stats?.storageUsed * 0.15)} GB de 15 GB</p>
                    
                    <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-full text-sm font-medium shadow-lg shadow-blue-500/30 transition-all hover:scale-105 active:scale-95">
                        Obter mais armazenamento
                    </button>
                </div>
              </>
            )}

            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div className={`${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-white border-gray-200'} rounded-2xl border p-5 flex items-center justify-between shadow-sm`}>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 ${isDarkMode ? 'bg-white/10' : 'bg-blue-50'} rounded-full`}>
                        {isDarkMode ? <Moon size={24} className="text-white"/> : <Monitor size={24} className="text-blue-600"/>}
                    </div>
                    <div>
                      <p className="text-base font-medium">Modo Escuro</p>
                      <p className={`text-sm ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Ajustar aparência para ambientes com pouca luz</p>
                    </div>
                  </div>
                  <button onClick={handleToggleTheme} className="text-blue-500 transition-colors transform active:scale-90">
                    {isDarkMode ? <ToggleRight size={40} className="fill-blue-500/20"/> : <ToggleLeft size={40} className="text-gray-300"/>}
                  </button>
                </div>
                
                <h4 className={`text-xs font-bold ${isDarkMode ? 'text-white/40' : 'text-gray-400'} uppercase tracking-wider px-2`}>Tema do Sistema</h4>
                <div className="grid grid-cols-3 gap-4">
                   <div onClick={() => !isDarkMode && handleToggleTheme()} className={`aspect-video rounded-xl border-2 cursor-pointer transition-all bg-[#191919] relative overflow-hidden group ${isDarkMode ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                       <div className="absolute inset-x-4 top-4 bottom-0 bg-[#2d2e30] rounded-t-lg border-t border-x border-white/10"></div>
                       <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white text-xs font-medium">Escuro</div>
                   </div>
                   <div onClick={() => isDarkMode && handleToggleTheme()} className={`aspect-video rounded-xl border-2 cursor-pointer transition-all bg-[#F0F2F5] relative overflow-hidden group ${!isDarkMode ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                       <div className="absolute inset-x-4 top-4 bottom-0 bg-white rounded-t-lg border-t border-x border-gray-200 shadow-sm"></div>
                       <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-gray-800 text-xs font-medium">Claro</div>
                   </div>
                   <div className={`aspect-video rounded-xl border-2 cursor-pointer transition-all bg-gradient-to-br from-[#191919] to-[#F0F2F5] relative overflow-hidden opacity-50`}>
                        <div className="absolute inset-0 flex items-center justify-center text-xs font-medium bg-black/10 backdrop-blur-sm">Automático</div>
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
               <div className="space-y-4">
                  <div className={`${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-white border-gray-200'} rounded-2xl border overflow-hidden`}>
                    <div className={`p-4 flex items-center justify-between border-b ${isDarkMode ? 'border-white/5' : 'border-gray-100'}`}>
                      <div className="flex items-center gap-3">
                          <Mail size={20} className={isDarkMode ? 'text-white/60' : 'text-gray-500'}/>
                          <span className="text-sm font-medium">E-mails prioritários</span>
                      </div>
                      <button className="text-blue-500" onClick={() => handleToggleNotification('E-mail', setEmailNotif, emailNotif)}>
                        {emailNotif ? <ToggleRight size={32} className="fill-blue-500/20"/> : <ToggleLeft size={32} className={isDarkMode ? "text-white/20" : "text-gray-300"}/>}
                      </button>
                    </div>
                    <div className={`p-4 flex items-center justify-between`}>
                      <div className="flex items-center gap-3">
                          <Calendar size={20} className={isDarkMode ? 'text-white/60' : 'text-gray-500'}/>
                          <span className="text-sm font-medium">Convites de agenda</span>
                      </div>
                      <button className="text-blue-500" onClick={() => handleToggleNotification('Agenda', setCalNotif, calNotif)}>
                        {calNotif ? <ToggleRight size={32} className="fill-blue-500/20"/> : <ToggleLeft size={32} className={isDarkMode ? "text-white/20" : "text-gray-300"}/>}
                      </button>
                    </div>
                  </div>
               </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
