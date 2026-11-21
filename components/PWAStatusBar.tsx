import React, { useState } from 'react';
import { Download, WifiOff, CheckCircle2, Smartphone } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
  isDarkMode?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false, isDarkMode = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    if (compact) return null;
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 size={14} /> Instalado na máquina
      </span>
    );
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => { void install(); }}
        aria-label="Instalar Google OS na máquina"
        className={
          compact
            ? `h-9 px-3 rounded-full text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                isDarkMode
                  ? 'bg-white/10 hover:bg-white/15 text-white border border-white/15'
                  : 'bg-white/80 hover:bg-white text-[#1A73E8] border border-black/10 shadow-sm'
              }`
            : 'inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-semibold transition-colors cursor-pointer'
        }
      >
        <Download size={14} />
        <span>Instalar na máquina</span>
      </button>
    );
  }

  if (isIOS || !compact) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className={
            compact
              ? `h-9 px-3 rounded-full text-xs font-medium inline-flex items-center gap-1.5 border transition-colors cursor-pointer ${
                  isDarkMode ? 'border-white/15 text-white/80 hover:bg-white/10' : 'border-black/10 text-gray-700 hover:bg-black/5'
                }`
              : 'inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-current/20 text-xs font-medium hover:bg-black/5 transition-colors cursor-pointer'
          }
        >
          <Smartphone size={14} />
          <span>{isIOS ? 'Instalar no iOS' : 'Como instalar localmente'}</span>
        </button>

        {showGuide && (
          <div
            className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
            onClick={() => setShowGuide(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Instalar Google OS na máquina"
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-sm rounded-2xl p-6 shadow-2xl border ${
                isDarkMode ? 'bg-[#202124] border-white/15 text-white' : 'bg-white border-gray-200 text-gray-900'
              }`}
            >
              <h3 className="text-base font-semibold">Instalar Google OS na sua máquina</h3>
              {isIOS ? (
                <p className="mt-2 text-xs leading-relaxed opacity-80">
                  1. Toque no botão <strong>Compartilhar</strong> na barra do Safari.<br />
                  2. Role para baixo e toque em <strong>Adicionar à Tela de Início</strong>.
                </p>
              ) : (
                <p className="mt-2 text-xs leading-relaxed opacity-80">
                  No Chrome ou Edge, clique no ícone de <strong>Instalar aplicativo</strong> na barra de endereço (ou no menu do navegador em <em>Salvar e compartilhar → Instalar página como app</em>) para abrir em janela isolada e usar offline.
                </p>
              )}
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="mt-4 w-full rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white py-2 text-xs font-semibold cursor-pointer"
              >
                Entendi
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 left-4 z-[120] flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-medium text-white shadow-lg"
    >
      <WifiOff size={14} />
      <span>Modo Offline — usando dados locais da sua máquina</span>
    </div>
  );
};
