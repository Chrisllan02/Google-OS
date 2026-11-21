import React, { useEffect, useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import {
  registerWorkspaceConfirmHandler,
  type WorkspaceConfirmRequest,
} from '../utils/workspaceConfirm';

interface PendingConfirm {
  request: WorkspaceConfirmRequest;
  resolve: (accepted: boolean) => void;
}

export const WorkspaceConfirmDialog: React.FC<{ isDarkMode?: boolean }> = ({ isDarkMode = false }) => {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  useEffect(() => {
    registerWorkspaceConfirmHandler(
      (request) =>
        new Promise<boolean>((resolve) => {
          setPending({ request, resolve });
        }),
    );
    return () => registerWorkspaceConfirmHandler(null);
  }, []);

  useEffect(() => {
    if (!pending) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        pending.resolve(false);
        setPending(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pending]);

  if (!pending) return null;

  const { request, resolve } = pending;
  const finish = (accepted: boolean) => {
    resolve(accepted);
    setPending(null);
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
      onClick={() => finish(false)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ws-confirm-title"
        aria-describedby="ws-confirm-desc"
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-4 ${
          isDarkMode ? 'bg-[#202124] border-white/15 text-white' : 'bg-white border-gray-200 text-gray-900'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${request.danger ? 'bg-red-500/15 text-red-500' : 'bg-blue-500/15 text-[#1A73E8]'}`}>
              <ShieldAlert size={20} />
            </div>
            <h3 id="ws-confirm-title" className="text-base font-semibold">
              {request.title}
            </h3>
          </div>
          <button
            type="button"
            aria-label="Cancelar operação"
            onClick={() => finish(false)}
            className="p-1.5 rounded-full hover:bg-black/10"
          >
            <X size={16} />
          </button>
        </div>

        <p id="ws-confirm-desc" className={`text-sm leading-relaxed ${isDarkMode ? 'text-white/75' : 'text-gray-600'}`}>
          {request.description}
        </p>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => finish(false)}
            className={`px-4 py-2 rounded-lg text-xs font-medium cursor-pointer ${
              isDarkMode ? 'bg-white/10 hover:bg-white/15 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            {request.cancelLabel || 'Cancelar'}
          </button>
          <button
            type="button"
            onClick={() => finish(true)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold text-white cursor-pointer ${
              request.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-[#1A73E8] hover:bg-[#1557B0]'
            }`}
          >
            {request.confirmLabel || 'Confirmar na conta Google'}
          </button>
        </div>
      </div>
    </div>
  );
};
