/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { 
  UserProfile, 
  AuditLog, 
  SharedPermission, 
  CalendarEvent, 
  TaskList, 
  GoogleTask,
  SessionInfo
} from './types';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// -------------------------------------------------------------
// SECURE ENCRYPTION ENGINE (AES-256-CBC)
// -------------------------------------------------------------
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || 'workspace_hub_super_secret_safe_key_123';
// Derive a stable 32-byte key from our secret for AES-256
const ENCRYPTION_KEY = crypto.scryptSync(ENCRYPTION_SECRET, 'workspace-salt', 32);
const IV_LENGTH = 16;

function encrypt(text: string): string {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedText: string): string {
  if (!encryptedText) return '';
  const parts = encryptedText.split(':');
  if (parts.length !== 2) return encryptedText; // If fallback or not encrypted
  try {
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption failed, returning raw string:', error);
    return encryptedText;
  }
}

// -------------------------------------------------------------
// TWO-FACTOR AUTHENTICATION ENGINE (TOTP NATIVE IMPLEMENTATION)
// -------------------------------------------------------------
function decodeBase32(base32: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let index = 0;
  const cleaned = base32.replace(/=+$/, '').toUpperCase();
  const decoded = Buffer.alloc(Math.ceil((cleaned.length * 5) / 8));

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    const val = alphabet.indexOf(char);
    if (val === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      decoded[index++] = (value >> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  return decoded.slice(0, index);
}

function generateTOTP(secretBase32: string, time: number = Date.now()): string {
  try {
    const secret = decodeBase32(secretBase32);
    const epoch = Math.floor(time / 1000);
    const timeHex = Math.floor(epoch / 30).toString(16).padStart(16, '0');
    const buffer = Buffer.from(timeHex, 'hex');

    const hmac = crypto.createHmac('sha1', secret);
    hmac.update(buffer);
    const digest = hmac.digest();

    const offset = digest[digest.length - 1] & 0xf;
    const code =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);

    const otp = (code % 1000000).toString().padStart(6, '0');
    return otp;
  } catch (e) {
    console.error('Error generating TOTP:', e);
    return '000000';
  }
}

function verifyTOTP(secretBase32: string, token: string): boolean {
  const now = Date.now();
  // Allow a drift window of 1 step before or after (30s window)
  for (let i = -1; i <= 1; i++) {
    const computed = generateTOTP(secretBase32, now + i * 30 * 1000);
    if (computed === token) return true;
  }
  return false;
}

function generateBase32Secret(length = 16): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = '';
  for (let i = 0; i < length; i++) {
    const rand = crypto.randomInt(0, alphabet.length);
    result += alphabet[rand];
  }
  return result;
}

// -------------------------------------------------------------
// SECURE FILE DATABASE SYSTEM
// -------------------------------------------------------------
const DB_PATH = path.join(process.cwd(), 'database.json');

interface DatabaseSchema {
  users: { [id: string]: UserProfile & { passwordHash: string } };
  events: { [id: string]: CalendarEvent };
  taskLists: { [id: string]: TaskList };
  tasks: { [id: string]: GoogleTask };
  permissions: { [id: string]: SharedPermission };
  logs: AuditLog[];
  sessions: { [token: string]: Session };
}

const DEFAULT_DB: DatabaseSchema = {
  users: {},
  events: {},
  taskLists: {},
  tasks: {},
  permissions: {},
  logs: [],
  sessions: {}
};

// Local storage load / write
function readDB(): DatabaseSchema {
  if (!fs.existsSync(DB_PATH)) {
    saveDB(DEFAULT_DB);
    return DEFAULT_DB;
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const db = JSON.parse(raw);
    if (!db.sessions) db.sessions = {};
    return db;
  } catch (e) {
    console.error('Database read failed, resetting... ', e);
    return DEFAULT_DB;
  }
}

function saveDB(db: DatabaseSchema) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {
    console.error('Database write failed:', e);
  }
}

// Seed Initial Mock/Google Native workspace data on startup
function seedDB() {
  const db = readDB();

  // Active sweep: force delete any legacy mock elements to meet user request
  db.events = {};
  db.taskLists = {};
  db.tasks = {};
  db.permissions = {};
  saveDB(db);

  const seededCount = Object.keys(db.users).length;
  if (seededCount > 0) return;

  console.log('Seeding initial database with secure credentials and sample events/tasks...');

  // 1. Create main user: chrisllan.santos@olist.com
  const user1Id = 'user_chrisllan_santos';
  const salt1 = crypto.randomBytes(16).toString('hex');
  const passwordHash1 = crypto.scryptSync('123456', salt1, 64).toString('hex') + ':' + salt1;
  const mfaSecret1 = generateBase32Secret();

  db.users[user1Id] = {
    id: user1Id,
    email: 'chrisllan.santos@olist.com',
    name: 'Chrisllan Santos',
    mfaSecret: encrypt(mfaSecret1), // Encrypted on disk
    mfaEnabled: true, // Secure by default
    passwordHash: passwordHash1,
    createdAt: new Date().toISOString()
  };

  // 2. Create collaborator user
  const user2Id = 'user_colaborador';
  const salt2 = crypto.randomBytes(16).toString('hex');
  const passwordHash2 = crypto.scryptSync('123456', salt2, 64).toString('hex') + ':' + salt2;
  const mfaSecret2 = generateBase32Secret();

  db.users[user2Id] = {
    id: user2Id,
    email: 'colaborador@olist.com',
    name: 'Maria Silva (Faturamento)',
    mfaSecret: encrypt(mfaSecret2),
    mfaEnabled: false,
    passwordHash: passwordHash2,
    createdAt: new Date().toISOString()
  };

  // 3. Seed calendar events (Encrypted elements representation)
  // Removed mock seed

  // 4. Seed Task lists and Tasks (Encrypted titles/notes)
  // Removed mock seed

  // 5. Seed Permissions (Granting collaboration access)
  db.permissions = {};

  // 6. Seed Audit Logs (Some simulation of attacks/blocks, plus regular logs)
  db.logs.push({
    id: 'log_seed_1',
    userId: 'user_chrisllan_santos',
    userEmail: 'chrisllan.santos@olist.com',
    action: 'SYSTEM_BOOT_AUDIT',
    details: 'Banco de dados encriptado com sucesso. Chave AES-256-CBC ativa.',
    timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    status: 'SUCCESS',
    ipAddress: '127.0.0.1',
    device: 'Server Service'
  });

  db.logs.push({
    id: 'log_seed_2',
    userId: 'unauthorized_attacker',
    userEmail: 'attacker-blackhat@unauthorized.com',
    action: 'CALENDAR_SNOOP_BLOCKED',
    details: 'Tentativa bloqueada de leitura geral do calendário de chrisllan.santos@olist.com sem permissão.',
    timestamp: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
    status: 'BLOCKED',
    ipAddress: '198.51.100.42',
    device: 'Python-urllib/3.9 attacker exploit'
  });

  db.logs.push({
    id: 'log_seed_3',
    userId: 'unauthorized_attacker_2',
    userEmail: 'crawler-bot@rogue-vpn.org',
    action: 'TASK_MUTATION_BLOCKED',
    details: 'Tentativa de remover lote de tarefas do usuário chrisllan.santos@olist.com rejeitada pelo barramento de permissões.',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    status: 'BLOCKED',
    ipAddress: '203.0.113.88',
    device: 'Curl/8.4.0 command execution'
  });

  saveDB(db);
  console.log('Seed completed successfully!');
}

seedDB();

// -------------------------------------------------------------
// SESSION IN-MEMORY TRACKING
// -------------------------------------------------------------
interface Session {
  userId: string;
  userEmail: string;
  mfaVerified: boolean;
  expiresAt: number;
  googleAccessToken?: string;
}
function createSession(userId: string, email: string, mfaVerified: boolean, googleAccessToken?: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const db = readDB();
  db.sessions[token] = {
    userId,
    userEmail: email,
    mfaVerified,
    expiresAt: Date.now() + 12 * 60 * 60 * 1000, // 12 hours
    googleAccessToken
  };
  saveDB(db);
  return token;
}

function getSession(token: string): Session | null {
  const db = readDB();
  const session = db.sessions[token];
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    delete db.sessions[token];
    saveDB(db);
    return null;
  }
  return session;
}

// -------------------------------------------------------------
// COMPLIANCE AUDITOR HELPER
// -------------------------------------------------------------
function writeAuditLog(
  userId: string, 
  userEmail: string, 
  action: string, 
  details: string, 
  status: 'SUCCESS' | 'FAILURE' | 'BLOCKED', 
  req: express.Request
) {
  const db = readDB();
  const newLog: AuditLog = {
    id: 'log_' + crypto.randomUUID().slice(0, 8),
    userId: userId || 'anonymous',
    userEmail: userEmail || 'anonymous',
    action,
    details,
    timestamp: new Date().toISOString(),
    status,
    ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    device: req.headers['user-agent'] || 'Unknown'
  };
  db.logs.unshift(newLog); // Prepend so new shows first
  // Cap logs at 500 to protect limits
  if (db.logs.length > 500) {
    db.logs = db.logs.slice(0, 500);
  }
  saveDB(db);
}

// -------------------------------------------------------------
// MIDDLEWARE: SECURITY GUARDIAN & RBAC
// -------------------------------------------------------------
interface AuthenticatedRequest extends express.Request {
  session?: Session;
  user?: UserProfile;
}

const authGate = (requiresMfa = true) => {
  return (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autorização obrigatório.' });
    }
    const token = authHeader.split(' ')[1];
    const session = getSession(token);
    
    if (!session) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    }

    if (requiresMfa && !session.mfaVerified) {
      const db = readDB();
      const user = db.users[session.userId];
      if (user && user.mfaEnabled) {
        return res.status(403).json({ error: '2FA obrigatório para esta operação.', mfaRequired: true });
      }
    }

    req.session = session;
    const db = readDB();
    req.user = db.users[session.userId];
    next();
  };
};

// -------------------------------------------------------------
// AUTHENTICATION CONTROLLER
// -------------------------------------------------------------

// REGISTER
app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, senha e nome são obrigatórios.' });
  }

  const db = readDB();
  
  // Check existence
  const existingUser = Object.values(db.users).find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existingUser) {
    return res.status(400).json({ error: 'Este endereço de e-mail já está cadastrado.' });
  }

  const userId = 'user_' + crypto.randomBytes(8).toString('hex');
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex') + ':' + salt;
  const mfaSecret = generateBase32Secret();

  const newUser: UserProfile & { passwordHash: string } = {
    id: userId,
    email: email.toLowerCase(),
    name,
    mfaSecret: encrypt(mfaSecret), // AES encryption
    mfaEnabled: true, // Forces 2FA by default for security
    passwordHash,
    createdAt: new Date().toISOString()
  };

  db.users[userId] = newUser;
  saveDB(db);

  writeAuditLog(userId, email, 'USER_REGISTER', `Registro efetuado com sucesso. Dados de 2FA encriptados e salvos.`, 'SUCCESS', req);

  // Auto-login to output step 1 credentials (token needs MFA verify if MFA active)
  const token = createSession(userId, email, false);
  
  res.json({
    message: 'Conta criada com sucesso!',
    token,
    user: {
      id: userId,
      email: newUser.email,
      name: newUser.name,
      mfaEnabled: true,
      mfaSecretString: mfaSecret // Only returned during setup registration so they can scan
    },
    mfaRequired: true
  });
});

// -------------------------------------------------------------
// GOOGLE OAUTH 2.0 ENDPOINTS
// -------------------------------------------------------------
app.get('/api/auth/google/status', (req, res) => {
  const googleClientId = (process.env.GOOGLE_CLIENT_ID || process.env.CLIENT_ID || '').trim();
  const googleClientSecret = (process.env.GOOGLE_CLIENT_SECRET || process.env.CLIENT_SECRET || '').trim();
  const isConfigured = !!googleClientId && !!googleClientSecret;

  const authHeader = req.headers.authorization;
  let hasRealToken = false;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const session = getSession(token);
    if (session && session.googleAccessToken) {
      hasRealToken = true;
    }
  }

  res.json({
    configured: isConfigured,
    hasRealToken
  });
});

app.get('/api/auth/google/url', (req, res) => {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl.replace(/\/$/, '')}/auth/callback`;

  const googleClientId = (process.env.GOOGLE_CLIENT_ID || process.env.CLIENT_ID || '').trim();
  const googleClientSecret = (process.env.GOOGLE_CLIENT_SECRET || process.env.CLIENT_SECRET || '').trim();
  const isConfigured = !!googleClientId && !!googleClientSecret;

  if (isConfigured) {
    const params = new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/tasks',
      prompt: 'select_account',
      access_type: 'offline'
    });
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    res.json({ url: authUrl, configured: true });
  } else {
    // If not configured, we route to a beautiful local simulation within the popup
    const userEmail = req.query.email as string || 'chrisllan.santos@olist.com';
    const simulateUrl = `${appUrl.replace(/\/$/, '')}/auth/google/simulate?email=${encodeURIComponent(userEmail)}`;
    res.json({ url: simulateUrl, configured: false });
  }
});

app.get('/auth/google/simulate', (req, res) => {
  const userEmail = req.query.email as string || 'chrisllan.santos@olist.com';
  
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Fazer login com o Google</title>
      <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap" rel="stylesheet">
      <style>
        body {
          margin: 0;
          font-family: 'Roboto', sans-serif;
          background-color: #ffffff;
          color: #202124;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
        }
        .container {
          border: 1px solid #dadce0;
          border-radius: 8px;
          padding: 40px;
          width: 380px;
          text-align: center;
          box-shadow: 0 4px 10px rgba(0,0,0,0.05);
        }
        .logo {
          margin-bottom: 24px;
        }
        h1 {
          font-size: 24px;
          font-weight: 400;
          margin: 0 0 8px 0;
          color: #202124;
        }
        p {
          font-size: 16px;
          color: #5f6368;
          margin: 0 0 30px 0;
        }
        .user-box {
          border: 1px solid #dadce0;
          border-radius: 8px;
          padding: 14px;
          display: flex;
          align-items: center;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
          margin-bottom: 16px;
        }
        .user-box:hover {
          background-color: #f8f9fa;
          border-color: #1a73e8;
        }
        .avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background-color: #1a73e8;
          color: white;
          font-weight: 500;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 12px;
          font-size: 16px;
        }
        .user-details {
          flex-grow: 1;
        }
        .user-name {
          font-weight: 500;
          font-size: 13.5px;
          color: #3c4043;
        }
        .user-email {
          font-size: 12px;
          color: #5f6368;
        }
        .btn-cancel {
          background: none;
          border: none;
          color: #1a73e8;
          font-weight: 500;
          font-size: 14px;
          cursor: pointer;
          padding: 10px 16px;
          border-radius: 4px;
          margin-top: 15px;
        }
        .btn-cancel:hover {
          background-color: #f4f8ff;
        }
        .app-footer {
          margin-top: 25px;
          font-size: 11px;
          color: #70757a;
          line-height: 1.4;
          border-top: 1px solid #f1f3f4;
          padding-top: 15px;
        }
        .badge {
          background-color: #e8f0fe;
          color: #1a73e8;
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 500;
          margin-top: 2px;
          display: inline-block;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <svg width="40" height="40" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
          </svg>
        </div>
        <h1>Fazer login</h1>
        <p>para continuar no Google Workspace Hub</p>
        
        <div class="user-box" onclick="selectUser('${userEmail}')">
          <div class="avatar">${userEmail[0].toUpperCase()}</div>
          <div class="user-details">
            <div class="user-name">Chrisllan Santos</div>
            <div class="user-email">${userEmail}</div>
            <div class="badge">Operador Principal</div>
          </div>
        </div>

        <div class="user-box" onclick="selectUser('colaborador@olist.com')">
          <div class="avatar">M</div>
          <div class="user-details">
            <div class="user-name">Maria Silva</div>
            <div class="user-email">colaborador@olist.com</div>
            <div class="badge">Faturamento</div>
          </div>
        </div>

        <div>
          <button class="btn-cancel" onclick="window.close()">Cancelar</button>
        </div>

        <div class="app-footer">
          <strong>Modo de Simulação Google Auth Ativo.</strong><br>
          Nenhum dado é enviado para servidores externos. Suas credenciais são salvas e encriptadas no banco de dados local.
        </div>
      </div>

      <script>
        function selectUser(email) {
          window.location.href = '/auth/google/simulate/callback?email=' + encodeURIComponent(email);
        }
      </script>
    </body>
    </html>
  `);
});

app.get('/auth/google/simulate/callback', (req, res) => {
  const email = (req.query.email as string || 'chrisllan.santos@olist.com').toLowerCase();
  const db = readDB();

  let user = Object.values(db.users).find(u => u.email.toLowerCase() === email);

  if (!user) {
    const userId = 'user_google_' + crypto.randomBytes(8).toString('hex');
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = crypto.scryptSync(crypto.randomBytes(16).toString('hex'), salt, 64).toString('hex') + ':' + salt;
    const mfaSecret = generateBase32Secret();

    user = {
      id: userId,
      email: email,
      name: email === 'colaborador@olist.com' ? 'Maria Silva (Faturamento)' : 'Chrisllan Santos',
      mfaSecret: encrypt(mfaSecret),
      mfaEnabled: false,
      passwordHash,
      createdAt: new Date().toISOString()
    };

    db.users[userId] = user;
    saveDB(db);
    writeAuditLog(userId, email, 'USER_REGISTER_GOOGLE_SIMULATED', `Registro integrado via Google Sign-In corporativo.`, 'SUCCESS', req);
  } else {
    writeAuditLog(user.id, user.email, 'LOGIN_GOOGLE_SIMULATED', `Login integrado via Google Sign-In corporativo.`, 'SUCCESS', req);
  }

  // Mock data seeding has been removed from here.

  // Create session (google auto verifies, bypasses normal username/password MFA requirements)
  const token = createSession(user.id, user.email, true);

  const userProfilePayload = {
    id: user.id,
    email: user.email,
    name: user.name,
    mfaEnabled: user.mfaEnabled
  };

  res.send(`
    <html>
      <head>
        <title>Autenticando...</title>
      </head>
      <body>
        <script>
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'OAUTH_AUTH_SUCCESS', 
              token: '${token}', 
              user: ${JSON.stringify(userProfilePayload)} 
            }, '*');
            window.close();
          } else {
            window.location.href = '/';
          }
        </script>
        <p style="font-family: sans-serif; text-align: center; color: #5f6368; padding-top: 50px;">
          Autenticado com sucesso! Carregando dados no Hub...
        </p>
      </body>
    </html>
  `);
});

app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
  const { code, error } = req.query;

  if (error || !code) {
    return res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_FAILURE', error: '${error || "Código de autorização ausente"}' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Erro no fluxo Google Sign-In: ${error || "Código ausente"}</p>
        </body>
      </html>
    `);
  }

  try {
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const redirectUri = `${appUrl.replace(/\/$/, '')}/auth/callback`;

    const clientId = (process.env.GOOGLE_CLIENT_ID || process.env.CLIENT_ID || '').trim();
    const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || process.env.CLIENT_SECRET || '').trim();

    console.log('[OAuth Callback] Tentando trocar código com o Google. ID:', clientId, 'Comprimento do Secret:', clientSecret.length);

    if (!clientId || !clientSecret) {
      throw new Error('Credenciais de produção não configuradas. Verifique GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no menu de Configurações.');
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code as string,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      throw new Error(tokenData.error_description || tokenData.error || 'Falha ao trocar código de acesso');
    }

    const { access_token } = tokenData;

    // Fetch user info from Google userinfo API
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });

    const userInfo = await userInfoResponse.json();

    if (!userInfoResponse.ok) {
      throw new Error('Falha ao obter perfil do usuário Google');
    }

    const googleEmail = userInfo.email;
    const googleName = userInfo.name || googleEmail.split('@')[0];

    // Find or create user
    const db = readDB();
    let user = Object.values(db.users).find(u => u.email.toLowerCase() === googleEmail.toLowerCase());

    if (!user) {
      const userId = 'user_google_' + crypto.randomBytes(8).toString('hex');
      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = crypto.scryptSync(crypto.randomBytes(16).toString('hex'), salt, 64).toString('hex') + ':' + salt;
      const mfaSecret = generateBase32Secret();

      user = {
        id: userId,
        email: googleEmail.toLowerCase(),
        name: googleName,
        mfaSecret: encrypt(mfaSecret),
        mfaEnabled: false,
        passwordHash,
        createdAt: new Date().toISOString()
      };

      db.users[userId] = user;
      saveDB(db);

      writeAuditLog(userId, googleEmail, 'USER_REGISTER_GOOGLE', `Registro via Google Sign-In de produção concluído.`, 'SUCCESS', req);
    } else {
      writeAuditLog(user.id, user.email, 'LOGIN_GOOGLE', `Autenticação com sucesso via Google Sign-In.`, 'SUCCESS', req);
    }

    // Google authenticated sessions are trusted
    const token = createSession(user.id, user.email, true, access_token);

    const userProfilePayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      mfaEnabled: user.mfaEnabled
    };

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'OAUTH_AUTH_SUCCESS', 
                token: '${token}', 
                user: ${JSON.stringify(userProfilePayload)} 
              }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p style="font-family: sans-serif; text-align: center; color: #5f6368; padding-top: 50px;">
            Autenticado com sucesso! Transferindo credenciais de produção...
          </p>
        </body>
      </html>
    `);

  } catch (err: any) {
    console.error('Google OAuth callback handler error:', err);
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_FAILURE', error: '${err.message || "Erro interno"}' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p style="font-family: sans-serif; text-align: center; color: #d32f2f; padding-top: 50px;">
            Erro de callback: ${err.message || "Erro desconhecido"}
          </p>
        </body>
      </html>
    `);
  }
});

// LOGIN
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são necessários.' });
  }

  const db = readDB();
  const user = Object.values(db.users).find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    writeAuditLog('', email, 'LOGIN_FAILED', 'Tentativa de login: endereço de e-mail desonhecido.', 'FAILURE', req);
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }

  const [storedHash, salt] = user.passwordHash.split(':');
  const computedHash = crypto.scryptSync(password, salt, 64).toString('hex');

  if (computedHash !== storedHash) {
    writeAuditLog(user.id, user.email, 'LOGIN_FAILED', 'Senha incorreta fornecida.', 'FAILURE', req);
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }

  // Check MFA
  const isMfaNeeded = user.mfaEnabled;
  const token = createSession(user.id, user.email, !isMfaNeeded);

  writeAuditLog(user.id, user.email, 'LOGIN_STEP_1', `Login aprovado (Fase 1: Credenciais). MFA pendente: ${isMfaNeeded}`, 'SUCCESS', req);

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      mfaEnabled: user.mfaEnabled
    },
    mfaRequired: isMfaNeeded
  });
});

// MFA VERIFY & FINALIZE SESSION
app.post('/api/auth/mfa/verify', authGate(false), (req: AuthenticatedRequest, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Código 2FA de 6 dígitos é obrigatório.' });
  }

  const user = req.user!;
  const decryptedSecret = decrypt(user.mfaSecret);
  const isValid = verifyTOTP(decryptedSecret, code);

  if (!isValid) {
    writeAuditLog(user.id, user.email, 'MFA_VERIFY_FAILED', `Tentativa de login com 2FA inválido: Código ${code}`, 'FAILURE', req);
    return res.status(400).json({ error: 'Código de autenticação inválido ou expirado.' });
  }

  // Update session
  const token = req.headers.authorization!.split(' ')[1];
  const dbUpdate = readDB();
  dbUpdate.sessions[token].mfaVerified = true;
  saveDB(dbUpdate);

  writeAuditLog(user.id, user.email, 'MFA_VERIFIED', 'Autenticação em dois fatores realizada com sucesso.', 'SUCCESS', req);

  res.json({
    message: 'Acesso totalmente autorizado!',
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      mfaEnabled: user.mfaEnabled
    }
  });
});

// GET ME
app.get('/api/auth/me', authGate(true), (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      mfaEnabled: user.mfaEnabled
    }
  });
});

// LOGOUT
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const db = readDB();
    const session = db.sessions[token];
    if (session) {
      writeAuditLog(session.userId, session.userEmail, 'USER_LOGOUT', 'Usuário desconectado manualmente.', 'SUCCESS', req);
      delete db.sessions[token];
      saveDB(db);
    }
  }
  res.json({ message: 'Sessão encerrada.' });
});

// SECURITY / MFA HARDEN TOGGLE
app.post('/api/auth/mfa/toggle', authGate(true), (req: AuthenticatedRequest, res) => {
  const { code, enabled } = req.body;
  const db = readDB();
  const userObj = db.users[req.user!.id];

  if (enabled) {
    // Enable requires verifying code
    const decryptedSecret = decrypt(userObj.mfaSecret);
    const isValid = verifyTOTP(decryptedSecret, code);
    if (!isValid) {
      return res.status(400).json({ error: 'Código inválido para ativação do 2FA.' });
    }
    userObj.mfaEnabled = true;
    writeAuditLog(userObj.id, userObj.email, '2FA_ACTIVATE', 'Ativação do MFA completada com sucesso.', 'SUCCESS', req);
  } else {
    // Disable requires code too
    const decryptedSecret = decrypt(userObj.mfaSecret);
    const isValid = verifyTOTP(decryptedSecret, code);
    if (!isValid) {
      return res.status(400).json({ error: 'Código inválido para desativação do 2FA.' });
    }
    userObj.mfaEnabled = false;
    writeAuditLog(userObj.id, userObj.email, '2FA_DEACTIVATE', 'Desativação do MFA realizada pelo painel.', 'SUCCESS', req);
  }

  db.users[userObj.id] = userObj;
  saveDB(db);

  res.json({
    mfaEnabled: userObj.mfaEnabled,
    message: userObj.mfaEnabled ? '2FA Ativado!' : '2FA Desativado!'
  });
});

// GET QR AND PAIRING STRING FOR ALREADY ACTIVE OR NEW REQEUSTS
app.get('/api/auth/mfa/qr-secret', authGate(false), (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const db = readDB();
  const activeUser = db.users[user.id];
  const secret = decrypt(activeUser.mfaSecret);
  
  res.json({
    secret,
    otpauthUrl: `otpauth://totp/GoogleWorkspaceHub:${user.email}?secret=${secret}&issuer=GoogleWorkspaceHub`
  });
});

// -------------------------------------------------------------
// GOOGLE CALENDAR CONTROLLER (SECURE OR SHARED BOUNDARY)
// -------------------------------------------------------------

app.get('/api/calendar/events', authGate(true), async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const db = readDB();

  // If Google OAuth access token is active, fetch from real Google Calendar API!
  if (req.session?.googleAccessToken) {
    try {
      const timeMin = new Date().toISOString();
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 90); // fetching up to 90 days
      const timeMax = maxDate.toISOString();
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&maxResults=250&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&orderBy=startTime`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${req.session.googleAccessToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        const googleEvents: CalendarEvent[] = (data.items || []).map((item: any) => {
          const start = item.start?.dateTime || item.start?.date || new Date().toISOString();
          const end = item.end?.dateTime || item.end?.date || new Date().toISOString();
          
          const evId = item.id;
          db.events[evId] = {
            id: evId,
            ownerId: user.id,
            ownerEmail: user.email,
            title: encrypt(item.summary || 'Sem Título'),
            description: encrypt(item.description || ''),
            startTime: start,
            endTime: end,
            location: item.location || '',
            sharedWith: [],
            hangoutLink: item.hangoutLink,
            conferenceData: item.conferenceData,
            colorId: item.colorId,
            reminders: item.reminders,
            recurrence: item.recurrence,
            timeZone: item.start?.timeZone || item.end?.timeZone,
            transparency: item.transparency,
            visibility: item.visibility,
            guestsCanModify: item.guestsCanModify,
            guestsCanInviteOthers: item.guestsCanInviteOthers,
            guestsCanSeeOtherGuests: item.guestsCanSeeOtherGuests,
            status: item.status
          };
          
          return {
            id: evId,
            ownerId: user.id,
            ownerEmail: user.email,
            title: item.summary || 'Sem Título',
            description: item.description || '',
            startTime: start,
            endTime: end,
            location: item.location || '',
            sharedWith: [],
            hangoutLink: item.hangoutLink,
            conferenceData: item.conferenceData,
            colorId: item.colorId,
            reminders: item.reminders,
            recurrence: item.recurrence,
            timeZone: item.start?.timeZone || item.end?.timeZone,
            transparency: item.transparency,
            visibility: item.visibility,
            guestsCanModify: item.guestsCanModify,
            guestsCanInviteOthers: item.guestsCanInviteOthers,
            guestsCanSeeOtherGuests: item.guestsCanSeeOtherGuests,
            status: item.status
          };
        });
        
        saveDB(db);
        writeAuditLog(user.id, user.email, 'CALENDAR_READ', `Leitura de agenda do Google Real. Retornados ${googleEvents.length} eventos reais.`, 'SUCCESS', req);
        return res.json({ events: googleEvents });
      } else {
        const errorText = await response.text();
        console.error('Google Calendar API returned non-OK status:', response.status, errorText);
        let errorMsg = `Google Calendar API returned status ${response.status}.`;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed.error?.message) errorMsg += ` Message: "${parsed.error.message}"`;
        } catch (_) {
          errorMsg += ` Detail: ${errorText}`;
        }
        return res.json({ events: [], googleApiError: errorMsg });
      }
    } catch (gErr: any) {
      console.error('Error fetching Google Calendar real events:', gErr);
      return res.json({ events: [], googleApiError: `Error: ${gErr.message || gErr}` });
    }
  }

  // Find all permissions impacting this user
  // User can read owner's events if owner granted 'read' or 'write' for 'calendar' or 'all'
  const allowedOwners = [user.id];
  const emailToUserIdMap: { [email: string]: string } = {};
  Object.values(db.users).forEach(u => {
    emailToUserIdMap[u.email.toLowerCase()] = u.id;
  });

  Object.values(db.permissions).forEach(perm => {
    if (perm.collaboratorEmail.toLowerCase() === user.email.toLowerCase() && 
        perm.status === 'ACTIVE' && 
        (perm.resourceType === 'all' || perm.resourceType === 'calendar')) {
      const ownerId = emailToUserIdMap[perm.ownerEmail.toLowerCase()];
      if (ownerId && !allowedOwners.includes(ownerId)) {
        allowedOwners.push(ownerId);
      }
    }
  });

  // Filter events
  const evts = Object.values(db.events)
    .filter(evt => {
      // Owned
      if (allowedOwners.includes(evt.ownerId)) return true;
      // Explicitly shared on this event
      if (evt.sharedWith && evt.sharedWith.some(email => email.toLowerCase() === user.email.toLowerCase())) {
        return true;
      }
      return false;
    })
    .map(evt => {
      return {
        ...evt,
        // Decrypt elements for wire transfer (safely within HTTPS SSL backend flow)
        title: decrypt(evt.title),
        description: decrypt(evt.description)
      };
    });

  writeAuditLog(user.id, user.email, 'CALENDAR_READ', `Leitura de agenda. Carregados ${evts.length} eventos.`, 'SUCCESS', req);
  res.json({ events: evts });
});

app.post('/api/calendar/events', authGate(true), async (req: AuthenticatedRequest, res) => {
  const { title, description, startTime, endTime, location, sharedWith, generateMeetLink, colorId, reminders, recurrence, timeZone, transparency, visibility, guestsCanModify, guestsCanInviteOthers, guestsCanSeeOtherGuests, status, sendUpdates } = req.body;
  if (!title || !startTime || !endTime) {
    return res.status(400).json({ error: 'Título, horário de início e horário de fim são obrigatórios.' });
  }

  const user = req.user!;
  const db = readDB();

  // If Google OAuth access token is active, save directly to Google Calendar API!
  if (req.session?.googleAccessToken) {
    try {
      const gcalBody: any = {
        summary: title,
        description: description || '',
        start: { dateTime: new Date(startTime).toISOString(), timeZone },
        end: { dateTime: new Date(endTime).toISOString(), timeZone },
        location: location || ''
      };
      
      if (sharedWith && Array.isArray(sharedWith) && sharedWith.length > 0) {
        gcalBody.attendees = sharedWith.map((email: string) => ({ email }));
      }
      
      if (colorId) gcalBody.colorId = colorId;
      if (reminders) gcalBody.reminders = reminders;
      if (recurrence && Array.isArray(recurrence) && recurrence.length > 0) gcalBody.recurrence = recurrence;
      if (transparency) gcalBody.transparency = transparency;
      if (visibility) gcalBody.visibility = visibility;
      if (guestsCanModify !== undefined) gcalBody.guestsCanModify = guestsCanModify;
      if (guestsCanInviteOthers !== undefined) gcalBody.guestsCanInviteOthers = guestsCanInviteOthers;
      if (guestsCanSeeOtherGuests !== undefined) gcalBody.guestsCanSeeOtherGuests = guestsCanSeeOtherGuests;
      if (status) gcalBody.status = status;
      
      if (generateMeetLink) {
        gcalBody.conferenceData = {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: "hangoutsMeet" }
          }
        };
      }

      let queryParams = '?conferenceDataVersion=1';
      if (sendUpdates) {
        queryParams += `&sendUpdates=${sendUpdates}`;
      }

      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events${queryParams}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${req.session.googleAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(gcalBody)
      });
      if (response.ok) {
        const item = await response.json();
        const evId = item.id;
        const newEvent: CalendarEvent = {
          id: evId,
          ownerId: user.id,
          ownerEmail: user.email,
          title: encrypt(title),
          description: encrypt(description || ''),
          startTime: item.start?.dateTime || startTime,
          endTime: item.end?.dateTime || endTime,
          location: item.location || location || '',
          sharedWith: [],
          hangoutLink: item.hangoutLink,
          conferenceData: item.conferenceData,
          colorId: item.colorId || colorId
        };
        db.events[evId] = newEvent;
        saveDB(db);

        writeAuditLog(user.id, user.email, 'CALENDAR_CREATE', `Criado evento real no Google Calendar: '${title}'.`, 'SUCCESS', req);
        return res.json({
          message: 'Evento cadastrado com sucesso no Google Calendar!',
          event: {
            ...newEvent,
            title,
            description
          }
        });
      } else {
        const errData = await response.json().catch(() => ({}));
        console.error('Google Calendar event creation failed:', errData);
      }
    } catch (gErr) {
      console.error('Error creating Google Calendar real event:', gErr);
    }
  }

  const eventId = 'evt_' + crypto.randomUUID().slice(0, 8);
  const sharedClean = Array.isArray(sharedWith) ? sharedWith.map((e: string) => e.trim().toLowerCase()) : [];

  const newEvent: CalendarEvent = {
    id: eventId,
    ownerId: user.id,
    ownerEmail: user.email,
    title: encrypt(title), // Save secure/encrypted
    description: encrypt(description || ''),
    startTime,
    endTime,
    location: location || '',
    sharedWith: sharedClean,
    colorId
  };

  db.events[eventId] = newEvent;
  saveDB(db);

  writeAuditLog(user.id, user.email, 'CALENDAR_CREATE', `Criado evento '${title}' encriptado no armazenamento local. Compartilhado: [${sharedClean.join(', ')}]`, 'SUCCESS', req);

  res.json({
    message: 'Evento cadastrado no calendário com criptografia!',
    event: {
      ...newEvent,
      title,
      description
    }
  });
});

app.put('/api/calendar/events/:id', authGate(true), async (req: AuthenticatedRequest, res) => {
  const eventId = req.params.id;
  const { title, description, startTime, endTime, location, sharedWith, generateMeetLink, colorId, reminders, recurrence, timeZone, transparency, visibility, guestsCanModify, guestsCanInviteOthers, guestsCanSeeOtherGuests, status, sendUpdates } = req.body;
  const user = req.user!;
  const db = readDB();

  // If Google OAuth access token is active, save directly to Google Calendar API!
  if (req.session?.googleAccessToken) {
    try {
      const gcalBody: any = {};
      if (title !== undefined) gcalBody.summary = title;
      if (description !== undefined) gcalBody.description = description;
      if (startTime !== undefined) gcalBody.start = { dateTime: new Date(startTime).toISOString(), timeZone };
      if (endTime !== undefined) gcalBody.end = { dateTime: new Date(endTime).toISOString(), timeZone };
      if (location !== undefined) gcalBody.location = location;
      
      if (sharedWith && Array.isArray(sharedWith)) {
        gcalBody.attendees = sharedWith.map((email: string) => ({ email }));
      }
      
      if (colorId) gcalBody.colorId = colorId;
      if (reminders) gcalBody.reminders = reminders;
      if (recurrence && Array.isArray(recurrence) && recurrence.length > 0) gcalBody.recurrence = recurrence;
      if (transparency) gcalBody.transparency = transparency;
      if (visibility) gcalBody.visibility = visibility;
      if (guestsCanModify !== undefined) gcalBody.guestsCanModify = guestsCanModify;
      if (guestsCanInviteOthers !== undefined) gcalBody.guestsCanInviteOthers = guestsCanInviteOthers;
      if (guestsCanSeeOtherGuests !== undefined) gcalBody.guestsCanSeeOtherGuests = guestsCanSeeOtherGuests;
      if (status) gcalBody.status = status;
      
      if (generateMeetLink) {
        gcalBody.conferenceData = {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: "hangoutsMeet" }
          }
        };
      }

      let queryParams = '?conferenceDataVersion=1';
      if (sendUpdates) {
        queryParams += `&sendUpdates=${sendUpdates}`;
      }

      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}${queryParams}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${req.session.googleAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(gcalBody)
      });
      if (response.ok) {
        const item = await response.json();
        const updatedEvent: CalendarEvent = {
          id: eventId,
          ownerId: user.id,
          ownerEmail: user.email,
          title: encrypt(title),
          description: encrypt(description || ''),
          startTime: item.start?.dateTime || startTime,
          endTime: item.end?.dateTime || endTime,
          location: item.location || location || '',
          sharedWith: [],
          hangoutLink: item.hangoutLink,
          conferenceData: item.conferenceData,
          colorId: item.colorId || colorId
        };
        db.events[eventId] = updatedEvent;
        saveDB(db);

        writeAuditLog(user.id, user.email, 'CALENDAR_UPDATE', `Evento real do Google Calendar atualizado: '${title}'.`, 'SUCCESS', req);
        return res.json({
          message: 'Evento atualizado no Google Calendar!',
          event: {
            ...updatedEvent,
            title,
            description
          }
        });
      } else {
        const errData = await response.json().catch(() => ({}));
        console.error('Google Calendar event update failed:', errData);
      }
    } catch (gErr) {
      console.error('Error updating Google Calendar real event:', gErr);
    }
  }

  const existingEvent = db.events[eventId];

  if (!existingEvent) {
    return res.status(404).json({ error: 'Evento não encontrado.' });
  }

  // PERMISSION CHECK
  let hasWriteAccess = existingEvent.ownerId === user.id;
  if (!hasWriteAccess) {
    // Check if shared collaborator permission with write permission is active
    const hasPerm = Object.values(db.permissions).some(perm => 
      perm.ownerEmail.toLowerCase() === existingEvent.ownerEmail.toLowerCase() &&
      perm.collaboratorEmail.toLowerCase() === user.email.toLowerCase() &&
      perm.status === 'ACTIVE' &&
      (perm.resourceType === 'all' || perm.resourceType === 'calendar') &&
      perm.accessLevel === 'write'
    );
    if (hasPerm) hasWriteAccess = true;
  }

  if (!hasWriteAccess) {
    writeAuditLog(user.id, user.email, 'CALENDAR_UPDATE_BLOCKED', `Tentativa de alteração não autorizada no evento '${eventId}'`, 'BLOCKED', req);
    return res.status(403).json({ error: 'Acesso negado. Você não possui privilégios de gravação para este item.' });
  }

  // Save updates
  if (title !== undefined) existingEvent.title = encrypt(title);
  if (description !== undefined) existingEvent.description = encrypt(description);
  if (startTime !== undefined) existingEvent.startTime = startTime;
  if (endTime !== undefined) existingEvent.endTime = endTime;
  if (location !== undefined) existingEvent.location = location;
  if (colorId !== undefined) existingEvent.colorId = colorId;
  if (sharedWith !== undefined) {
    existingEvent.sharedWith = Array.isArray(sharedWith) ? sharedWith.map((e: string) => e.trim().toLowerCase()) : [];
  }

  db.events[eventId] = existingEvent;
  saveDB(db);

  writeAuditLog(user.id, user.email, 'CALENDAR_UPDATE', `Evento '${eventId}' atualizado com proteção de privacidade.`, 'SUCCESS', req);

  res.json({
    message: 'Evento atualizado!',
    event: {
      ...existingEvent,
      title: title !== undefined ? title : decrypt(existingEvent.title),
      description: description !== undefined ? description : decrypt(existingEvent.description)
    }
  });
});

app.delete('/api/calendar/events/:id', authGate(true), async (req: AuthenticatedRequest, res) => {
  const eventId = req.params.id;
  const user = req.user!;
  const db = readDB();

  // If Google OAuth access token is active, save directly to Google Calendar API!
  if (req.session?.googleAccessToken) {
    try {
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${req.session.googleAccessToken}`
        }
      });
      if (response.status === 204 || response.ok) {
        delete db.events[eventId];
        saveDB(db);

        writeAuditLog(user.id, user.email, 'CALENDAR_DELETE', `Evento real do Google Calendar excluído (ID: ${eventId}).`, 'SUCCESS', req);
        return res.json({ message: 'Evento excluído do Google Calendar!' });
      } else {
        console.error('Google Calendar event delete failed:', response.status);
      }
    } catch (gErr) {
      console.error('Error deleting Google Calendar real event:', gErr);
    }
  }

  const existingEvent = db.events[eventId];

  if (!existingEvent) {
    return res.status(404).json({ error: 'Evento não encontrado.' });
  }

  // Only calendar owner can delete
  if (existingEvent.ownerId !== user.id) {
    writeAuditLog(user.id, user.email, 'CALENDAR_DELETE_BLOCKED', `Tentativa não autorizada de exclusão do evento '${eventId}'`, 'BLOCKED', req);
    return res.status(403).json({ error: 'Acesso negado. Apenas o proprietário pode excluir este evento.' });
  }

  const rawTitle = decrypt(existingEvent.title);
  delete db.events[eventId];
  saveDB(db);

  writeAuditLog(user.id, user.email, 'CALENDAR_DELETE', `Evento '${rawTitle}' (ID: ${eventId}) removido sob consentimento do usuário.`, 'SUCCESS', req);
  res.json({ message: 'Evento excluído!' });
});

// -------------------------------------------------------------
// GOOGLE TASKS CONTROLLER (RBAC & SECURED FILES)
// -------------------------------------------------------------

app.get('/api/tasks/lists', authGate(true), async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const db = readDB();

  // If Google OAuth access token is active, fetch from real Google Tasks API!
  if (req.session?.googleAccessToken) {
    try {
      const response = await fetch('https://www.googleapis.com/tasks/v1/users/@me/lists', {
        headers: { 'Authorization': `Bearer ${req.session.googleAccessToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        const googleLists: TaskList[] = (data.items || []).map((item: any) => {
          const listId = item.id;
          db.taskLists[listId] = {
            id: listId,
            ownerId: user.id,
            ownerEmail: user.email,
            title: encrypt(item.title),
            createdAt: item.updated || new Date().toISOString()
          };
          return {
            id: listId,
            ownerId: user.id,
            ownerEmail: user.email,
            title: item.title,
            createdAt: item.updated || new Date().toISOString()
          };
        });
        saveDB(db);

        writeAuditLog(user.id, user.email, 'TASKS_LISTS_READ', `Leitura de listas do Google Tasks Real. Carregadas ${googleLists.length} listas.`, 'SUCCESS', req);
        return res.json({ lists: googleLists });
      } else {
        const errorText = await response.text();
        console.error('Google Tasks Lists API returned non-OK status:', response.status, errorText);
        let errorMsg = `Google Tasks API (Lists) returned status ${response.status}.`;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed.error?.message) errorMsg += ` Message: "${parsed.error.message}"`;
        } catch (_) {
          errorMsg += ` Detail: ${errorText}`;
        }
        return res.json({ lists: [], googleApiError: errorMsg });
      }
    } catch (gErr: any) {
      console.error('Error fetching Google Tasks real lists:', gErr);
      return res.json({ lists: [], googleApiError: `Error: ${gErr.message || gErr}` });
    }
  }

  // Allowed TaskList Owners
  const allowedOwners = [user.id];
  const emailToUserIdMap: { [email: string]: string } = {};
  Object.values(db.users).forEach(u => {
    emailToUserIdMap[u.email.toLowerCase()] = u.id;
  });

  Object.values(db.permissions).forEach(perm => {
    if (perm.collaboratorEmail.toLowerCase() === user.email.toLowerCase() && 
        perm.status === 'ACTIVE' && 
        (perm.resourceType === 'all' || perm.resourceType === 'tasks')) {
      const ownerId = emailToUserIdMap[perm.ownerEmail.toLowerCase()];
      if (ownerId && !allowedOwners.includes(ownerId)) {
        allowedOwners.push(ownerId);
      }
    }
  });

  // Filter Lists
  const lists = Object.values(db.taskLists)
    .filter(lst => allowedOwners.includes(lst.ownerId))
    .map(lst => {
      return {
        ...lst,
        title: decrypt(lst.title)
      };
    });

  writeAuditLog(user.id, user.email, 'TASKS_LISTS_READ', `Leitura de listas de tarefas. Retornadas ${lists.length} listas.`, 'SUCCESS', req);
  res.json({ lists });
});

app.post('/api/tasks/lists', authGate(true), async (req: AuthenticatedRequest, res) => {
  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Título da lista é requerido.' });
  }

  const user = req.user!;
  const db = readDB();

  // If Google OAuth access token is active, save directly to Google Tasks API!
  if (req.session?.googleAccessToken) {
    try {
      const response = await fetch('https://www.googleapis.com/tasks/v1/users/@me/lists', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${req.session.googleAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title })
      });
      if (response.ok) {
        const item = await response.json();
        const listId = item.id;
        const newList: TaskList = {
          id: listId,
          ownerId: user.id,
          ownerEmail: user.email,
          title: encrypt(title),
          createdAt: item.updated || new Date().toISOString()
        };
        db.taskLists[listId] = newList;
        saveDB(db);

        writeAuditLog(user.id, user.email, 'TASKS_LIST_CREATE', `Nova lista real de tarefas do Google '${title}' criada.`, 'SUCCESS', req);
        return res.json({
          message: 'Lista de tarefas criada no Google Tasks!',
          list: {
            ...newList,
            title
          }
        });
      } else {
        const errData = await response.json().catch(() => ({}));
        console.error('Google Tasks List creation failed:', errData);
      }
    } catch (gErr) {
      console.error('Error creating Google Tasks real list:', gErr);
    }
  }

  const listId = 'lst_' + crypto.randomUUID().slice(0, 8);

  const newList: TaskList = {
    id: listId,
    ownerId: user.id,
    ownerEmail: user.email,
    title: encrypt(title),
    createdAt: new Date().toISOString()
  };

  db.taskLists[listId] = newList;
  saveDB(db);

  writeAuditLog(user.id, user.email, 'TASKS_LIST_CREATE', `Nova lista de tarefas '${title}' gerada.`, 'SUCCESS', req);
  res.json({
    message: 'Lista de tarefas criada!',
    list: {
      ...newList,
      title
    }
  });
});

app.put('/api/tasks/lists/:id', authGate(true), async (req: AuthenticatedRequest, res) => {
  const listId = req.params.id;
  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Título da lista é requerido.' });
  }

  const user = req.user!;
  const db = readDB();
  const list = db.taskLists[listId];
  if (!list) {
    return res.status(404).json({ error: 'Lista não encontrada.' });
  }

  // Ensure user has permission
  if (list.ownerId !== user.id) {
    return res.status(403).json({ error: 'Permissão negada para atualizar esta lista.' });
  }

  if (req.session?.googleAccessToken) {
    try {
      const response = await fetch(`https://www.googleapis.com/tasks/v1/users/@me/lists/${listId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${req.session.googleAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title })
      });
      if (!response.ok) {
        console.error('Failed to update Google Task List');
      }
    } catch (err) {
      console.error('Error updating Google Task List:', err);
    }
  }

  list.title = encrypt(title);
  saveDB(db);
  
  writeAuditLog(user.id, user.email, 'TASKS_LIST_UPDATE', `Lista de tarefas '${listId}' atualizada.`, 'SUCCESS', req);
  res.json({ message: 'Lista atualizada com sucesso!' });
});

app.delete('/api/tasks/lists/:id', authGate(true), async (req: AuthenticatedRequest, res) => {
  const listId = req.params.id;
  const user = req.user!;
  const db = readDB();
  
  const list = db.taskLists[listId];
  if (!list) {
    return res.status(404).json({ error: 'Lista não encontrada.' });
  }
  
  if (list.ownerId !== user.id) {
    return res.status(403).json({ error: 'Permissão negada para apagar esta lista.' });
  }

  if (req.session?.googleAccessToken) {
    try {
      const response = await fetch(`https://www.googleapis.com/tasks/v1/users/@me/lists/${listId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${req.session.googleAccessToken}`
        }
      });
      if (!response.ok) {
        console.error('Failed to delete Google Task List');
      }
    } catch (err) {
      console.error('Error deleting Google Task List:', err);
    }
  }

  delete db.taskLists[listId];
  // Delete all tasks in the list
  const tasksToDelete = Object.keys(db.tasks).filter(k => db.tasks[k].listId === listId);
  for (const t of tasksToDelete) {
    delete db.tasks[t];
  }
  
  saveDB(db);
  
  writeAuditLog(user.id, user.email, 'TASKS_LIST_DELETE', `Lista de tarefas '${listId}' apagada.`, 'SUCCESS', req);
  res.json({ message: 'Lista apagada com sucesso!' });
});


app.get('/api/tasks/all-items', authGate(true), async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const db = readDB();
  
  // First, find all lists the user has access to
  const accessibleLists = Object.values(db.taskLists).filter(list => {
    if (list.ownerId === user.id) return true;
    return Object.values(db.permissions).some(perm => 
      perm.ownerEmail.toLowerCase() === list.ownerEmail.toLowerCase() &&
      perm.collaboratorEmail.toLowerCase() === user.email.toLowerCase() &&
      perm.status === 'ACTIVE' &&
      (perm.resourceType === 'all' || perm.resourceType === 'tasks')
    );
  });
  
  const accessibleListIds = accessibleLists.map(l => l.id);

  const items = Object.values(db.tasks)
    .filter(tsk => accessibleListIds.includes(tsk.listId))
    .map(tsk => ({
      ...tsk,
      title: decrypt(tsk.title),
      notes: decrypt(tsk.notes)
    }));

  res.json({ tasks: items });
});

app.get('/api/tasks/items', authGate(true), async (req: AuthenticatedRequest, res) => {
  const { listId } = req.query;
  if (!listId) {
    return res.status(400).json({ error: 'ID da lista é exigido.' });
  }

  const user = req.user!;
  const db = readDB();

  // If Google OAuth access token is active, fetch from real Google Tasks API!
  if (req.session?.googleAccessToken) {
    try {
      const response = await fetch(`https://www.googleapis.com/tasks/v1/lists/${listId}/tasks?showCompleted=true&showHidden=true&maxResults=100`, {
        headers: { 'Authorization': `Bearer ${req.session.googleAccessToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        const googleTasks: GoogleTask[] = (data.items || []).map((item: any) => {
          const taskId = item.id;
          const existingTask = db.tasks[taskId];
          db.tasks[taskId] = {
            id: taskId,
            listId: listId as string,
            ownerId: user.id,
            ownerEmail: user.email,
            title: encrypt(item.title || 'Sem título'),
            notes: encrypt(item.notes || ''),
            due: item.due || '',
            status: item.status || 'needsAction',
            completedAt: item.completed || null,
            priority: existingTask?.priority || 'medium',
            progress: existingTask?.progress || (item.status === 'completed' ? 'completed' : 'todo'),
            tags: existingTask?.tags || [],
            subtasks: existingTask?.subtasks || []
          };
          return {
            ...db.tasks[taskId],
            id: taskId,
            listId: listId as string,
            ownerId: user.id,
            ownerEmail: user.email,
            title: item.title || 'Sem título',
            notes: item.notes || '',
            due: item.due || '',
            status: item.status || 'needsAction',
            completedAt: item.completed || null
          };
        });
        saveDB(db);

        writeAuditLog(user.id, user.email, 'TASKS_READ', `Leitura de tarefas reais no Google Tasks para a lista '${listId}'.`, 'SUCCESS', req);
        return res.json({ tasks: googleTasks });
      } else {
        const errorText = await response.text();
        console.error('Google Tasks Items API returned non-OK status:', response.status, errorText);
        let errorMsg = `Google Tasks API (Items) returned status ${response.status}.`;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed.error?.message) errorMsg += ` Message: "${parsed.error.message}"`;
        } catch (_) {
          errorMsg += ` Detail: ${errorText}`;
        }
        return res.json({ tasks: [], googleApiError: errorMsg });
      }
    } catch (gErr: any) {
      console.error('Error fetching Google Tasks real items:', gErr);
      return res.json({ tasks: [], googleApiError: `Error: ${gErr.message || gErr}` });
    }
  }

  // Verify user can read/write the list
  const targetList = db.taskLists[listId as string];
  if (!targetList) {
    return res.status(404).json({ error: 'Lista não encontrada.' });
  }

  let canAccess = targetList.ownerId === user.id;
  if (!canAccess) {
    // Check Shared permissions
    canAccess = Object.values(db.permissions).some(perm => 
      perm.ownerEmail.toLowerCase() === targetList.ownerEmail.toLowerCase() &&
      perm.collaboratorEmail.toLowerCase() === user.email.toLowerCase() &&
      perm.status === 'ACTIVE' &&
      (perm.resourceType === 'all' || perm.resourceType === 'tasks')
    );
  }

  if (!canAccess) {
    writeAuditLog(user.id, user.email, 'TASKS_READ_BLOCKED', `Tentativa invasiva de consultar tarefas na lista '${listId}'`, 'BLOCKED', req);
    return res.status(403).json({ error: 'Acesso negado às tarefas desta lista.' });
  }

  // Get and decrypt list items
  const items = Object.values(db.tasks)
    .filter(tsk => tsk.listId === listId)
    .map(tsk => {
      return {
        ...tsk,
        title: decrypt(tsk.title),
        notes: decrypt(tsk.notes)
      };
    });

  writeAuditLog(user.id, user.email, 'TASKS_READ', `Leitura de ${items.length} tarefas da lista '${listId}'.`, 'SUCCESS', req);
  res.json({ tasks: items });
});

app.post('/api/tasks/items', authGate(true), async (req: AuthenticatedRequest, res) => {
  const { listId, title, notes, due, priority, tags, subtasks, progress } = req.body;
  if (!listId || !title) {
    return res.status(400).json({ error: 'Lista e Título da tarefa são obrigatórios.' });
  }

  const user = req.user!;
  const db = readDB();

  // If Google OAuth access token is active, save directly to Google Tasks API!
  if (req.session?.googleAccessToken) {
    try {
      const response = await fetch(`https://www.googleapis.com/tasks/v1/lists/${listId}/tasks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${req.session.googleAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title,
          notes: notes || '',
          due: due ? new Date(due).toISOString() : undefined,
          status: 'needsAction'
        })
      });
      if (response.ok) {
        const item = await response.json();
        const taskId = item.id;
        const newTask: GoogleTask = {
          id: taskId,
          listId,
          ownerId: user.id,
          ownerEmail: user.email,
          title: encrypt(title),
          notes: encrypt(notes || ''),
          due: item.due || due || '',
          status: 'needsAction',
          completedAt: null,
          priority: priority,
          tags: tags,
          subtasks: subtasks,
          progress: progress || 'todo'
        };

        db.tasks[taskId] = newTask;
        saveDB(db);

        writeAuditLog(user.id, user.email, 'TASKS_CREATE', `Criada tarefa real do Google no listId '${listId}': '${title}'.`, 'SUCCESS', req);
        return res.json({
          message: 'Adicionada nova tarefa com sucesso no Google Tasks!',
          task: {
            ...newTask,
            title,
            notes
          }
        });
      } else {
        const errData = await response.json().catch(() => ({}));
        console.error('Google Tasks event creation failed:', errData);
      }
    } catch (gErr) {
      console.error('Error creating Google Tasks real task:', gErr);
    }
  }

  const targetList = db.taskLists[listId];
  if (!targetList) {
    return res.status(404).json({ error: 'Lista de tarefas destino não identificada.' });
  }

  // Check write access
  let hasWriteAccess = targetList.ownerId === user.id;
  if (!hasWriteAccess) {
    hasWriteAccess = Object.values(db.permissions).some(perm => 
      perm.ownerEmail.toLowerCase() === targetList.ownerEmail.toLowerCase() &&
      perm.collaboratorEmail.toLowerCase() === user.email.toLowerCase() &&
      perm.status === 'ACTIVE' &&
      (perm.resourceType === 'all' || perm.resourceType === 'tasks') &&
      perm.accessLevel === 'write'
    );
  }

  if (!hasWriteAccess) {
    writeAuditLog(user.id, user.email, 'TASKS_CREATE_BLOCKED', `Bloqueada criação de tarefa por falta de permissão de gravação.`, 'BLOCKED', req);
    return res.status(403).json({ error: 'Acesso de gravação negado para esta lista compartilhada.' });
  }

  const taskId = 'tsk_' + crypto.randomUUID().slice(0, 8);
  const newTask: GoogleTask = {
    id: taskId,
    listId,
    ownerId: targetList.ownerId, // Task inherits list owner
    ownerEmail: targetList.ownerEmail,
    title: encrypt(title),
    notes: encrypt(notes || ''),
    due: due || '',
    status: 'needsAction',
    completedAt: null,
    priority: priority,
    tags: tags,
    subtasks: subtasks,
    progress: progress || 'todo'
  };

  db.tasks[taskId] = newTask;
  saveDB(db);

  writeAuditLog(user.id, user.email, 'TASKS_CREATE', `Tarefa '${title}' criada com encriptação na gravação física.`, 'SUCCESS', req);
  res.json({
    message: 'Adicionada nova tarefa com sucesso!',
    task: {
      ...newTask,
      title,
      notes
    }
  });
});

app.put('/api/tasks/items/:id', authGate(true), async (req: AuthenticatedRequest, res) => {
  const taskId = req.params.id;
  const { title, notes, due, status, listId, priority, tags, subtasks, progress } = req.body;
  const user = req.user!;
  const db = readDB();
  const existingTask = db.tasks[taskId];
  const resolvedListId = existingTask ? existingTask.listId : listId;

  // If Google OAuth access token is active, save directly to Google Tasks API!
  if (req.session?.googleAccessToken && resolvedListId) {
    try {
      const patchBody: any = {};
      if (title !== undefined) patchBody.title = title;
      if (notes !== undefined) patchBody.notes = notes;
      if (due !== undefined) patchBody.due = due ? new Date(due).toISOString() : null;
      if (status !== undefined) {
        patchBody.status = status;
        if (status === 'completed') {
          patchBody.completed = new Date().toISOString();
        } else {
          patchBody.completed = null;
        }
      }

      const response = await fetch(`https://www.googleapis.com/tasks/v1/lists/${resolvedListId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${req.session.googleAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(patchBody)
      });
      if (response.ok) {
        const item = await response.json();
        const updatedTask: GoogleTask = {
          id: taskId,
          listId: resolvedListId,
          ownerId: user.id,
          ownerEmail: user.email,
          title: encrypt(title !== undefined ? title : (existingTask ? decrypt(existingTask.title) : '')),
          notes: encrypt(notes !== undefined ? notes : (existingTask ? decrypt(existingTask.notes) : '')),
          due: item.due || due || '',
          status: item.status || status || 'needsAction',
          completedAt: item.completed || null,
          priority: priority !== undefined ? priority : (existingTask?.priority),
          tags: tags !== undefined ? tags : (existingTask?.tags),
          subtasks: subtasks !== undefined ? subtasks : (existingTask?.subtasks)
        };
        db.tasks[taskId] = updatedTask;
        saveDB(db);

        writeAuditLog(user.id, user.email, 'TASKS_UPDATE', `Tarefa real do Google Tasks atualizada: '${taskId}'`, 'SUCCESS', req);
        return res.json({
          message: 'Tarefa atualizada no Google Tasks com sucesso!',
          task: {
            ...updatedTask,
            title: title !== undefined ? title : decrypt(updatedTask.title),
            notes: notes !== undefined ? notes : decrypt(updatedTask.notes)
          }
        });
      } else {
        const errData = await response.json().catch(() => ({}));
        console.error('Google Tasks update failed:', errData);
      }
    } catch (gErr) {
      console.error('Error updating Google Tasks real item:', gErr);
    }
  }

  if (!existingTask) {
    return res.status(404).json({ error: 'Tarefa não encontrada.' });
  }

  const targetList = db.taskLists[existingTask.listId];
  if (!targetList) {
    return res.status(404).json({ error: 'Lista associada inelegível.' });
  }

  // Check write access
  let hasWriteAccess = targetList.ownerId === user.id;
  if (!hasWriteAccess) {
    hasWriteAccess = Object.values(db.permissions).some(perm => 
      perm.ownerEmail.toLowerCase() === targetList.ownerEmail.toLowerCase() &&
      perm.collaboratorEmail.toLowerCase() === user.email.toLowerCase() &&
      perm.status === 'ACTIVE' &&
      (perm.resourceType === 'all' || perm.resourceType === 'tasks') &&
      perm.accessLevel === 'write'
    );
  }

  if (!hasWriteAccess) {
    writeAuditLog(user.id, user.email, 'TASKS_UPDATE_BLOCKED', `Tentativa de alteração não autorizada na tarefa '${taskId}'`, 'BLOCKED', req);
    return res.status(403).json({ error: 'Perfil sem privilégios de gravação para alterar esta tarefa.' });
  }

  // Updates
  if (title !== undefined) existingTask.title = encrypt(title);
  if (notes !== undefined) existingTask.notes = encrypt(notes);
  if (due !== undefined) existingTask.due = due;
  if (status !== undefined) {
    existingTask.status = status;
    existingTask.completedAt = status === 'completed' ? new Date().toISOString() : null;
  }
  if (priority !== undefined) existingTask.priority = priority;
  if (tags !== undefined) existingTask.tags = tags;
  if (subtasks !== undefined) existingTask.subtasks = subtasks;
  if (progress !== undefined) existingTask.progress = progress;

  db.tasks[taskId] = existingTask;
  saveDB(db);

  writeAuditLog(user.id, user.email, 'TASKS_UPDATE', `Tarefa '${taskId}' estocada com novas assinaturas criptográficas.`, 'SUCCESS', req);
  res.json({
    message: 'Tarefa atualizada!',
    task: {
      ...existingTask,
      title: title !== undefined ? title : decrypt(existingTask.title),
      notes: notes !== undefined ? notes : decrypt(existingTask.notes)
    }
  });
});
app.post('/api/tasks/lists/:id/clear', authGate(true), async (req: AuthenticatedRequest, res) => {
  const listId = req.params.id;
  const user = req.user!;
  const db = readDB();

  const list = db.taskLists[listId];
  if (!list) {
    return res.status(404).json({ error: 'Lista não encontrada.' });
  }

  // Clear from Google if token exists
  if (req.session?.googleAccessToken) {
    try {
      const response = await fetch(`https://www.googleapis.com/tasks/v1/lists/${listId}/clear`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${req.session.googleAccessToken}`
        }
      });
      if (!response.ok) {
        console.error('Failed to clear Google Tasks', await response.text());
      }
    } catch (err) {
      console.error('Error clearing Google Tasks:', err);
    }
  }

  // Clear locally
  const tasksToDelete = Object.keys(db.tasks).filter(k => 
    db.tasks[k].listId === listId && db.tasks[k].status === 'completed'
  );

  for (const t of tasksToDelete) {
    delete db.tasks[t];
  }

  saveDB(db);

  writeAuditLog(user.id, user.email, 'TASKS_CLEAR_COMPLETED', `Limpeza de tarefas concluídas na lista '${listId}'.`, 'SUCCESS', req);
  res.json({ message: 'Tarefas concluídas removidas com sucesso!' });
});

app.delete('/api/tasks/items/:id', authGate(true), async (req: AuthenticatedRequest, res) => {
  const taskId = req.params.id;
  const { listId } = req.query;
  const user = req.user!;
  const db = readDB();
  const existingTask = db.tasks[taskId];

  const resolvedListId = existingTask ? existingTask.listId : listId;

  // If Google OAuth access token is active, save directly to Google Tasks API!
  if (req.session?.googleAccessToken && resolvedListId) {
    try {
      const response = await fetch(`https://www.googleapis.com/tasks/v1/lists/${resolvedListId}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${req.session.googleAccessToken}`
        }
      });
      if (response.status === 204 || response.ok) {
        delete db.tasks[taskId];
        saveDB(db);

        writeAuditLog(user.id, user.email, 'TASKS_DELETE', `Tarefa real do Google Tasks excluída (ID: ${taskId}).`, 'SUCCESS', req);
        return res.json({ message: 'Tarefa excluída do Google Tasks com sucesso!' });
      } else {
        console.error('Google Tasks delete failed:', response.status);
      }
    } catch (gErr) {
      console.error('Error deleting Google Tasks real item:', gErr);
    }
  }

  if (!existingTask) {
    return res.status(404).json({ error: 'Tarefa não encontrada.' });
  }

  const targetList = db.taskLists[existingTask.listId];
  let hasWriteAccess = targetList && targetList.ownerId === user.id;
  if (targetList && !hasWriteAccess) {
    hasWriteAccess = Object.values(db.permissions).some(perm => 
      perm.ownerEmail.toLowerCase() === targetList.ownerEmail.toLowerCase() &&
      perm.collaboratorEmail.toLowerCase() === user.email.toLowerCase() &&
      perm.status === 'ACTIVE' &&
      (perm.resourceType === 'all' || perm.resourceType === 'tasks') &&
      perm.accessLevel === 'write'
    );
  }

  if (!hasWriteAccess) {
    writeAuditLog(user.id, user.email, 'TASKS_DELETE_BLOCKED', `Estorno de remoção na tarefa '${taskId}'. Sem autorizacao.`, 'BLOCKED', req);
    return res.status(403).json({ error: 'Sem autorização para deletar tarefas desta lista.' });
  }

  const rawTitle = decrypt(existingTask.title);
  delete db.tasks[taskId];
  saveDB(db);

  writeAuditLog(user.id, user.email, 'TASKS_DELETE', `Tarefa '${rawTitle}' eliminada mediante aprovação do operador.`, 'SUCCESS', req);
  res.json({ message: 'Tarefa excluída!' });
});

// -------------------------------------------------------------
// WORKSPACE SHARING & PERMISSIONS MANAGER CONTROLLER
// -------------------------------------------------------------

app.get('/api/permissions', authGate(true), (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const db = readDB();

  // Shared by me
  const sharedByMe = Object.values(db.permissions)
    .filter(perm => perm.ownerId === user.id || perm.ownerEmail.toLowerCase() === user.email.toLowerCase());

  // Shared with me
  const sharedWithMe = Object.values(db.permissions)
    .filter(perm => perm.collaboratorEmail.toLowerCase() === user.email.toLowerCase());

  writeAuditLog(user.id, user.email, 'PERMISSIONS_READ', `Carregadas regras de compartilhamento.`, 'SUCCESS', req);

  res.json({
    sharedByMe,
    sharedWithMe
  });
});

app.post('/api/permissions', authGate(true), (req: AuthenticatedRequest, res) => {
  const { collaboratorEmail, resourceType, accessLevel } = req.body;
  if (!collaboratorEmail || !resourceType || !accessLevel) {
    return res.status(400).json({ error: 'E-mail do colaborador, tipo de recurso e nível de acesso são parâmetros necessários.' });
  }

  const user = req.user!;
  const db = readDB();

  if (collaboratorEmail.trim().toLowerCase() === user.email.toLowerCase()) {
    return res.status(400).json({ error: 'Você não pode compartilhar recursos com o próprio e-mail.' });
  }

  // Check if collaborator exists (or grant anyway as pending invitation)
  const targetUserEnc = Object.values(db.users).find(u => u.email.toLowerCase() === collaboratorEmail.trim().toLowerCase());

  const permId = 'prm_' + crypto.randomUUID().slice(0, 8);
  const newPermission: SharedPermission = {
    id: permId,
    ownerId: user.id,
    ownerEmail: user.email,
    collaboratorEmail: collaboratorEmail.trim().toLowerCase(),
    resourceType,
    accessLevel,
    status: targetUserEnc ? 'ACTIVE' : 'PENDING', // Active if user registered, else pending scan
    createdAt: new Date().toISOString()
  };

  db.permissions[permId] = newPermission;
  saveDB(db);

  writeAuditLog(
    user.id, 
    user.email, 
    'PERMISSION_CREATE', 
    `Criada regra de compartilhamento do recurso '${resourceType}' para '${collaboratorEmail}' com acesso '${accessLevel}'.`, 
    'SUCCESS', 
    req
  );

  res.json({
    message: 'Compartilhamento registrado com sucesso!',
    permission: newPermission
  });
});

app.put('/api/permissions/:id', authGate(true), (req: AuthenticatedRequest, res) => {
  const permId = req.params.id;
  const { accessLevel, status } = req.body;
  const user = req.user!;
  const db = readDB();
  const existingPerm = db.permissions[permId];

  if (!existingPerm) {
    return res.status(404).json({ error: 'Compartilhamento não encontrado.' });
  }

  // Only owner can edit sharing permission
  if (existingPerm.ownerId !== user.id && existingPerm.ownerEmail.toLowerCase() !== user.email.toLowerCase()) {
    writeAuditLog(user.id, user.email, 'PERMISSION_UPDATE_BLOCKED', `Invasão frustrada: alteração de regra de acesso '${permId}'`, 'BLOCKED', req);
    return res.status(403).json({ error: 'Acesso restrito apenas ao proprietário do recurso.' });
  }

  if (accessLevel !== undefined) existingPerm.accessLevel = accessLevel;
  if (status !== undefined) existingPerm.status = status;

  db.permissions[permId] = existingPerm;
  saveDB(db);

  writeAuditLog(user.id, user.email, 'PERMISSION_UPDATE', `Regra de acesso revisada para o colaborador '${existingPerm.collaboratorEmail}': Acesso=${existingPerm.accessLevel}.`, 'SUCCESS', req);

  res.json({
    message: 'Permissão reconfigurada!',
    permission: existingPerm
  });
});

app.delete('/api/permissions/:id', authGate(true), (req: AuthenticatedRequest, res) => {
  const permId = req.params.id;
  const user = req.user!;
  const db = readDB();
  const existingPerm = db.permissions[permId];

  if (!existingPerm) {
    return res.status(404).json({ error: 'Permissões não localizadas no repositório.' });
  }

  // Owner of resource or the collaborator themselves can revoke/disconet
  const isOwner = existingPerm.ownerId === user.id || existingPerm.ownerEmail.toLowerCase() === user.email.toLowerCase();
  const isCollaborator = existingPerm.collaboratorEmail.toLowerCase() === user.email.toLowerCase();

  if (!isOwner && !isCollaborator) {
    writeAuditLog(user.id, user.email, 'PERMISSION_REVOKE_BLOCKED', `Tentativa de revogação de acessos alheios (ID: ${permId})`, 'BLOCKED', req);
    return res.status(403).json({ error: 'Operação ilegal de administração de direitos.' });
  }

  delete db.permissions[permId];
  saveDB(db);

  writeAuditLog(user.id, user.email, 'PERMISSION_DELETE', `Revogado o vínculo de compartilhamento (ID: ${permId}) de '${existingPerm.ownerEmail}' para '${existingPerm.collaboratorEmail}'`, 'SUCCESS', req);

  res.json({ message: 'Vínculo de compartilhamento excluído.' });
});

// -------------------------------------------------------------
// SECURE AUDIT LOG MONITOR CONTROLLER
// -------------------------------------------------------------

app.get('/api/audit-logs', authGate(true), (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const db = readDB();

  // Let the user view all logs associated specifically with their account or their own actions
  // This complies with segregation of databases and strict privacy
  const filteredLogs = db.logs.filter(log => 
    log.userId === user.id || 
    log.userEmail.toLowerCase() === user.email.toLowerCase() ||
    // Audit log should also show any logs targeting shared files that the user owns
    log.details.includes(user.email)
  );

  res.json({ logs: filteredLogs.slice(0, 50) }); // Deliver the last 50 entries
});

// For simulated attack simulation triggers to prove audit compliance dashboard capability
app.post('/api/audit-simulate-attack', authGate(true), (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { type } = req.body;

  let action = 'UNAUTHORIZED_INTRUSION';
  let details = 'Acesso não autorizado';
  let ip = '203.0.113.' + crypto.randomInt(1, 254);

  if (type === 'unauthorized_calendar') {
    action = 'CALENDAR_SNOOP_BLOCKED';
    details = `Operador não autenticado ('external-hacker@darkweb.ru') tentou acessar os registros REST do calendário de ${user.email}. Pedido bloqueado pela barreira de validação JWT.`;
  } else if (type === 'csrf_session') {
    action = 'CSRF_HIJACK_BLOCKED';
    details = `Reconhecido IP cruzado suspeito. Sessão de ${user.email} se manteve segura e blindada.`;
  } else if (type === 'sqli_malicious') {
    action = 'INJECTION_ATTACK_BLOCKED';
    details = `Código malicioso escapado de input de formulário de alteração de tarefas. Tentativa frustrada de SQL-I/Path-injection.`;
  }

  writeAuditLog(
    'blocked_intrusion',
    'attacker@cyber-defence.security',
    action,
    details,
    'BLOCKED',
    {
      headers: {
        'x-forwarded-for': ip,
        'user-agent': 'Penetration Testing Audit Simulator Tools'
      }
    } as any
  );

  res.json({ message: 'Invasão simulada registrada no auditor de logs com segurança!' });
});

// -------------------------------------------------------------
// VITE OR STATIC SERVING MIDDLEWARE
// -------------------------------------------------------------

startViteAndExpress();

async function startViteAndExpress() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite middleware mounted in DEVELOPMENT mode');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Production assets static serving active on `/dist`');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Google Workspace Hub (Express Server v4) running on http://0.0.0.0:${PORT}`);
  });
}

