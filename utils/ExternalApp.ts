// Abre apps do Google que não têm como ser recriados dentro do OS (Docs,
// Sheets, Slides, Meet, Chat) usando o app oficial de verdade: em nova aba no
// navegador (web) ou numa janela Chrome real do shell desktop (Electron),
// exatamente como se o usuário tivesse aberto no Chrome.

declare global {
    interface Window {
        electronAPI?: {
            openExternalApp: (url: string, title?: string) => void;
        };
    }
}

export function openExternalApp(url: string, title?: string) {
    if (typeof window !== 'undefined' && window.electronAPI?.openExternalApp) {
        window.electronAPI.openExternalApp(url, title);
        return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
}

export function isElectronShell(): boolean {
    return typeof window !== 'undefined' && !!window.electronAPI;
}

export function meetUrlFromCodeOrLink(codeOrLink: string): string {
    if (codeOrLink.startsWith('http')) return codeOrLink;
    return `https://meet.google.com/${codeOrLink}`;
}

export const GOOGLE_CHAT_URL = 'https://chat.google.com/';
