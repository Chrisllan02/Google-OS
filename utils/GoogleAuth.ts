// Autenticação Google 100% client-side via Google Identity Services (GIS).
// Não depende de nenhum backend: o usuário cria seu próprio Client ID OAuth
// gratuito no Google Cloud Console (veja README) e conecta a própria conta.
// O token de acesso fica em memória + sessionStorage (nunca em disco/localStorage).

export const GOOGLE_SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/tasks',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/contacts.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

export interface GoogleAuthUser {
    email: string;
    name: string;
    picture: string;
}

interface StoredToken {
    accessToken: string;
    expiresAt: number; // epoch ms
    user: GoogleAuthUser;
}

declare global {
    interface Window {
        google?: any;
    }
}

const STORAGE_KEY = 'google_os_gis_token';
const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

let gisLoadPromise: Promise<void> | null = null;
let tokenClient: any = null;
let cachedToken: StoredToken | null = null;
let listeners: Array<(user: GoogleAuthUser | null) => void> = [];

function loadStoredToken(): StoredToken | null {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed: StoredToken = JSON.parse(raw);
        if (parsed.expiresAt <= Date.now()) return null;
        return parsed;
    } catch {
        return null;
    }
}

cachedToken = loadStoredToken();

function persistToken(token: StoredToken | null) {
    cachedToken = token;
    if (token) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(token));
    } else {
        sessionStorage.removeItem(STORAGE_KEY);
    }
    listeners.forEach(l => l(token?.user || null));
}

function loadGisScript(): Promise<void> {
    if (gisLoadPromise) return gisLoadPromise;
    gisLoadPromise = new Promise((resolve, reject) => {
        if (window.google?.accounts?.oauth2) { resolve(); return; }
        const existing = document.querySelector(`script[src="${GIS_SCRIPT_SRC}"]`);
        if (existing) {
            existing.addEventListener('load', () => resolve());
            existing.addEventListener('error', () => reject(new Error('Falha ao carregar Google Identity Services')));
            return;
        }
        const script = document.createElement('script');
        script.src = GIS_SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Falha ao carregar Google Identity Services'));
        document.head.appendChild(script);
    });
    return gisLoadPromise;
}

async function fetchUserInfo(accessToken: string): Promise<GoogleAuthUser> {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error('Não foi possível obter informações da conta Google.');
    const data = await res.json();
    return { email: data.email, name: data.name || data.email, picture: data.picture || '' };
}

class GoogleAuthService {
    getClientId(): string {
        return (typeof process !== 'undefined' && process.env?.GOOGLE_CLIENT_ID) || '';
    }

    isConfigured(): boolean {
        return !!this.getClientId();
    }

    isSignedIn(): boolean {
        return !!cachedToken && cachedToken.expiresAt > Date.now();
    }

    getUser(): GoogleAuthUser | null {
        return this.isSignedIn() ? cachedToken!.user : null;
    }

    getAccessToken(): string | null {
        return this.isSignedIn() ? cachedToken!.accessToken : null;
    }

    onChange(listener: (user: GoogleAuthUser | null) => void): () => void {
        listeners.push(listener);
        return () => { listeners = listeners.filter(l => l !== listener); };
    }

    async signIn(): Promise<GoogleAuthUser> {
        const clientId = this.getClientId();
        if (!clientId) {
            throw new Error('GOOGLE_CLIENT_ID não configurado. Veja o README para criar um Client ID OAuth gratuito.');
        }
        await loadGisScript();

        return new Promise((resolve, reject) => {
            try {
                tokenClient = window.google!.accounts.oauth2.initTokenClient({
                    client_id: clientId,
                    scope: GOOGLE_SCOPES,
                    callback: async (response: any) => {
                        if (response.error) {
                            reject(new Error(response.error_description || response.error));
                            return;
                        }
                        try {
                            const expiresAt = Date.now() + (response.expires_in || 3600) * 1000;
                            const user = await fetchUserInfo(response.access_token);
                            const token: StoredToken = { accessToken: response.access_token, expiresAt, user };
                            persistToken(token);
                            resolve(user);
                        } catch (e) {
                            reject(e);
                        }
                    },
                    error_callback: (err: any) => {
                        reject(new Error(err?.message || 'Login com Google cancelado ou falhou.'));
                    },
                });
                tokenClient.requestAccessToken({ prompt: cachedToken ? '' : 'consent' });
            } catch (e) {
                reject(e as Error);
            }
        });
    }

    /** Tenta renovar o token silenciosamente (sem popup) quando ele está perto de expirar. */
    async silentRefresh(): Promise<boolean> {
        const clientId = this.getClientId();
        if (!clientId || !cachedToken) return false;
        await loadGisScript();
        return new Promise((resolve) => {
            try {
                const client = window.google!.accounts.oauth2.initTokenClient({
                    client_id: clientId,
                    scope: GOOGLE_SCOPES,
                    callback: async (response: any) => {
                        if (response.error) { resolve(false); return; }
                        const expiresAt = Date.now() + (response.expires_in || 3600) * 1000;
                        const user = cachedToken?.user || await fetchUserInfo(response.access_token);
                        persistToken({ accessToken: response.access_token, expiresAt, user });
                        resolve(true);
                    },
                    error_callback: () => resolve(false),
                });
                client.requestAccessToken({ prompt: '' });
            } catch {
                resolve(false);
            }
        });
    }

    signOut() {
        const token = cachedToken?.accessToken;
        persistToken(null);
        if (token && window.google?.accounts?.oauth2) {
            try { window.google.accounts.oauth2.revoke(token, () => {}); } catch { /* best-effort */ }
        }
    }
}

export const googleAuth = new GoogleAuthService();
