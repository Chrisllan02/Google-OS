import React, { useState, useEffect } from 'react';
import {
  Shield, ShieldCheck, Key, RefreshCw, AlertTriangle, QrCode,
  Terminal, Activity, Play, X, CheckCircle2
} from 'lucide-react';
import { bridge, AuditLog, SecurityState } from '../../utils/GASBridge';

interface SecurityAppProps {
  onClose: () => void;
  data: any;
  isDarkMode?: boolean;
  showToast?: (msg: string) => void;
}

export default function SecurityApp({ onClose, data, isDarkMode = true, showToast }: SecurityAppProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [security, setSecurity] = useState<SecurityState>({ mfaEnabled: false, mfaSecret: '' });

  const [pairingSecret, setPairingSecret] = useState('');
  const [showPairing, setShowPairing] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [attackLoading, setAttackLoading] = useState<string | null>(null);

  const toast = (msg: string) => showToast && showToast(msg);

  const cardClass = isDarkMode
    ? 'bg-white/5 border border-white/5 rounded-3xl'
    : 'bg-white border border-gray-200 rounded-3xl shadow-sm';
  const textColor = isDarkMode ? 'text-white' : 'text-[#202124]';
  const subText = isDarkMode ? 'text-white/50' : 'text-gray-500';
  const inputClass = isDarkMode
    ? 'bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-blue-500/60'
    : 'bg-gray-50 border-gray-200 text-[#202124] placeholder:text-gray-400 focus:border-blue-500';

  const loadLogs = async () => {
    setLoadingLogs(true);
    setLogs(await bridge.getAuditLogs());
    setLoadingLogs(false);
  };

  useEffect(() => {
    loadLogs();
    bridge.getSecurityState().then(setSecurity);
  }, []);

  const handleStartPairing = () => {
    setPairingSecret(bridge.generateMfaSecret());
    setShowPairing(true);
  };

  const handleToggleMfa = async (enable: boolean) => {
    if (verificationCode.length !== 6) {
      toast('Digite o código de 6 dígitos do seu autenticador.');
      return;
    }
    const state = await bridge.setMfaEnabled(enable, enable ? pairingSecret : undefined);
    setSecurity(state);
    setVerificationCode('');
    setShowPairing(false);
    toast(enable ? 'Verificação em duas etapas ativada' : 'Verificação em duas etapas desativada');
    loadLogs();
  };

  const handleSimulateAttack = async (type: string) => {
    setAttackLoading(type);
    await bridge.simulateAttack(type);
    await loadLogs();
    setAttackLoading(null);
    toast('Invasão simulada registrada no auditor de logs');
  };

  const attacks = [
    { type: 'unauthorized_calendar', label: 'Calendar Snooping', desc: 'Script externo tentando ler a agenda', color: '#EA4335' },
    { type: 'csrf_session', label: 'CSRF Session Hijack', desc: 'Roubo de tokens por IP cruzado suspeito', color: '#FBBC05' },
    { type: 'sqli_malicious', label: 'SQL Injection', desc: 'Comando SQL malicioso no campo de notas', color: '#F43F5E' },
  ];

  return (
    <div className={`flex flex-col h-full ${isDarkMode ? 'bg-[#191919] text-white' : 'bg-[#F0F2F5] text-[#202124]'} overflow-hidden transition-colors duration-300 font-sans`}>
      {/* Header */}
      <div className={`h-16 flex items-center justify-between px-8 border-b ${isDarkMode ? 'border-white/5 bg-[#191919]/50' : 'border-gray-200 bg-white'} shrink-0 backdrop-blur-xl`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#4285F4]/10 rounded-full"><ShieldCheck size={20} className="text-[#4285F4]" /></div>
          <h2 className="text-xl font-normal">Central de Segurança</h2>
        </div>
        <button onClick={onClose} className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10 text-white/60' : 'hover:bg-gray-100 text-gray-500'}`}>
          <X size={24} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 xl:grid-cols-3 gap-6 animate-in fade-in slide-in-from-right-10 duration-300">

          {/* Coluna esquerda: criptografia + 2FA */}
          <div className="xl:col-span-1 flex flex-col space-y-6">
            <div className={`${cardClass} p-6`}>
              <div className={`mb-4 flex items-center gap-2 border-b ${isDarkMode ? 'border-white/5' : 'border-gray-100'} pb-3`}>
                <Key className="text-[#4285F4]" size={18} />
                <h3 className={`font-medium ${textColor} text-sm`}>Criptografia Base</h3>
              </div>
              <div className={`rounded-2xl ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'} border p-3 font-mono text-[11px] leading-relaxed mb-3`}>
                <span className={`${subText} block mb-1`}>PROTEÇÃO ATIVA DA SESSÃO:</span>
                <span className="text-emerald-500 font-bold block">AES-256-CBC</span>
                <span className={subText}>TOTP · SHA-1 · Janela de 30s</span>
              </div>
              <p className={`${subText} text-xs leading-relaxed mb-3`}>
                Com o backend opcional ativo (pasta <code className="font-mono">server/</code>), credenciais e tokens do Google são criptografados em disco com AES-256.
              </p>
              <div className="flex items-center gap-2 text-[11px] text-emerald-500 font-medium">
                <ShieldCheck size={14} />
                <span>Proteção contra escalação ativa</span>
              </div>
            </div>

            <div className={`${cardClass} p-6`}>
              <div className={`mb-4 flex items-center justify-between border-b ${isDarkMode ? 'border-white/5' : 'border-gray-100'} pb-3`}>
                <div className="flex items-center gap-2">
                  <Shield className="text-[#4285F4]" size={18} />
                  <h3 className={`font-medium ${textColor} text-sm`}>Verificação em duas etapas</h3>
                </div>
                <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-mono ${security.mfaEnabled ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500' : 'bg-[#EA4335]/15 border-[#EA4335]/30 text-[#EA4335]'}`}>
                  {security.mfaEnabled ? 'ATIVA' : 'INATIVA'}
                </span>
              </div>

              {security.mfaEnabled ? (
                <div className="space-y-3">
                  <p className={`${subText} text-xs leading-relaxed`}>
                    Autenticação multifator ativa. Para desativar, informe um código do seu app autenticador:
                  </p>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Ex: 054992"
                    value={verificationCode}
                    onChange={e => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    className={`w-full text-center tracking-[0.3em] font-mono text-base font-semibold rounded-full border px-3 py-2.5 outline-none transition-colors ${inputClass}`}
                  />
                  <button
                    disabled={verificationCode.length !== 6}
                    onClick={() => handleToggleMfa(false)}
                    className="w-full rounded-full bg-[#EA4335] hover:bg-[#d93025] disabled:opacity-40 font-medium py-2.5 text-white text-sm transition-all active:scale-95"
                  >
                    Desativar 2FA
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className={`${subText} text-xs leading-relaxed`}>
                    Blinde seu acesso configurando o Google Authenticator ou Authy.
                  </p>
                  {!showPairing ? (
                    <button
                      onClick={handleStartPairing}
                      className="w-full rounded-full bg-[#4285F4] hover:bg-[#3367d6] text-white font-medium py-2.5 text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      <QrCode size={16} />
                      Emparelhar autenticador
                    </button>
                  ) : (
                    <div className={`space-y-3 p-4 rounded-2xl border ${isDarkMode ? 'bg-white/[0.03] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                      <p className={`text-[10px] uppercase tracking-wider font-bold ${subText}`}>Chave secreta (digite no app)</p>
                      <p className={`font-mono text-center py-2.5 rounded-xl border text-sm font-semibold select-all tracking-widest text-emerald-500 ${isDarkMode ? 'bg-black/40 border-white/5' : 'bg-white border-gray-200'}`}>
                        {pairingSecret}
                      </p>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="Código de 6 dígitos"
                        value={verificationCode}
                        onChange={e => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                        className={`w-full text-center tracking-[0.3em] font-mono text-base font-semibold rounded-full border px-3 py-2.5 outline-none transition-colors ${inputClass}`}
                      />
                      <button
                        onClick={() => handleToggleMfa(true)}
                        disabled={verificationCode.length !== 6}
                        className="w-full rounded-full bg-[#4285F4] hover:bg-[#3367d6] disabled:opacity-40 font-medium py-2.5 text-white text-sm transition-all active:scale-95"
                      >
                        Validar e ativar 2FA
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Coluna direita: simulador + auditoria */}
          <div className="xl:col-span-2 flex flex-col space-y-6">
            <div className={`${cardClass} p-6`}>
              <div className={`flex items-center gap-2 border-b ${isDarkMode ? 'border-white/5' : 'border-gray-100'} pb-3 mb-4`}>
                <Terminal className="text-[#4285F4]" size={18} />
                <div>
                  <h3 className={`font-medium ${textColor} text-sm`}>Simulador de Ataques</h3>
                  <p className={`text-[10px] ${subText}`}>Dispare tentativas maliciosas para auditar a resposta do sistema</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {attacks.map(atk => (
                  <button
                    key={atk.type}
                    onClick={() => handleSimulateAttack(atk.type)}
                    disabled={attackLoading !== null}
                    className={`rounded-2xl border p-4 flex flex-col items-center text-center transition-all active:scale-95 ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                    style={{ borderColor: `${atk.color}33`, backgroundColor: `${atk.color}0d` }}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-medium mb-1" style={{ color: atk.color }}>
                      <AlertTriangle size={13} />
                      <span>{atk.label}</span>
                    </div>
                    <p className={`text-[10px] ${subText} mb-3`}>{atk.desc}</p>
                    <span className="rounded-full border px-3 py-1 mt-auto flex items-center gap-1.5 text-[10px] font-medium" style={{ borderColor: `${atk.color}33`, color: atk.color }}>
                      <Play size={9} />
                      {attackLoading === atk.type ? 'Executando...' : 'Iniciar ataque'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className={`${cardClass} p-6 flex flex-col flex-1 min-h-[320px]`}>
              <div className={`flex items-center justify-between border-b ${isDarkMode ? 'border-white/5' : 'border-gray-100'} pb-3 mb-4`}>
                <div className="flex items-center gap-2">
                  <Activity className="text-emerald-500" size={18} />
                  <div>
                    <h3 className={`font-medium ${textColor} text-sm`}>Auditor de Transações & Logs</h3>
                    <p className={`text-[10px] ${subText}`}>Registro centralizado de todas as ações da conta</p>
                  </div>
                </div>
                <button
                  onClick={loadLogs}
                  disabled={loadingLogs}
                  className={`rounded-full border p-2 transition-colors ${isDarkMode ? 'border-white/10 hover:bg-white/5 text-white/60' : 'border-gray-200 hover:bg-gray-50 text-gray-500'}`}
                >
                  <RefreshCw size={14} className={loadingLogs ? 'animate-spin' : ''} />
                </button>
              </div>

              <div className="space-y-2 overflow-y-auto custom-scrollbar max-h-[380px] pr-2">
                {logs.length === 0 ? (
                  <div className={`text-center py-10 text-xs ${subText}`}>Nenhum registro de auditoria coletado.</div>
                ) : (
                  logs.map(log => {
                    const pill = log.status === 'BLOCKED'
                      ? 'bg-rose-500/15 border-rose-500/25 text-rose-500'
                      : log.status === 'FAILURE'
                        ? 'bg-[#FBBC05]/15 border-[#FBBC05]/25 text-[#c79100]'
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500';
                    return (
                      <div key={log.id} className={`border rounded-2xl p-3.5 transition-colors ${isDarkMode ? 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]' : 'border-gray-100 bg-gray-50/60 hover:bg-gray-50'}`}>
                        <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5">
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-mono font-bold border ${pill}`}>{log.action}</span>
                          <span className={`text-[9px] ${subText}`}>
                            {new Date(log.timestamp).toLocaleTimeString('pt-BR')} · {new Date(log.timestamp).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <p className={`${textColor} text-xs leading-relaxed mb-1.5`}>{log.details}</p>
                        <div className={`border-t pt-1.5 flex flex-wrap justify-between items-center text-[9px] gap-2 ${isDarkMode ? 'border-white/[0.03] text-white/30' : 'border-gray-100 text-gray-400'}`}>
                          <span>IP: {log.ipAddress}</span>
                          <span className="flex items-center gap-1">
                            {log.status === 'SUCCESS' && <CheckCircle2 size={10} className="text-emerald-500" />}
                            STATUS: {log.status}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
