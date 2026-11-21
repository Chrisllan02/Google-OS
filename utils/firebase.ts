import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

import { WORKSPACE_SCOPES } from './googleWorkspaceApi';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
for (const scope of WORKSPACE_SCOPES) {
  googleProvider.addScope(scope);
}

// OAuth access token is kept strictly in memory (never localStorage/sessionStorage).
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) ?? [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const MAX_ID_LEN = 128;

export function sanitizeFirestoreId(rawKey: string): string {
  const cleaned = rawKey.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, MAX_ID_LEN);
  return cleaned && VALID_ID_REGEX.test(cleaned) ? cleaned : 'store_default';
}

export function getWorkspaceAccessToken(): string | null {
  return cachedAccessToken;
}

export function hasWorkspaceAccessToken(): boolean {
  return Boolean(cachedAccessToken);
}

export async function signInWithGoogle(): Promise<{ user: User; accessToken: string | null }> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken ?? null;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export async function signOutGoogle(): Promise<void> {
  cachedAccessToken = null;
  await signOut(auth);
}

export function subscribeAuth(cb: (user: User | null, accessToken: string | null) => void): () => void {
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      cachedAccessToken = null;
      cb(null, null);
      return;
    }
    if (!isSigningIn && !cachedAccessToken) {
      cb(user, null);
      return;
    }
    cb(user, cachedAccessToken);
  });
}

// Zero-knowledge local-first mode: the platform never stores user workspace data on its servers.
// All user data stays strictly on the user's device and directly inside their own Google account.
export async function persistWorkspaceStore(_userId: string, _rawStoreKey: string, _value: unknown): Promise<void> {
  return Promise.resolve();
}

export async function loadUserWorkspaceStores(_userId: string): Promise<Record<string, unknown>> {
  return Promise.resolve({});
}

