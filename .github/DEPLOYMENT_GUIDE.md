# 📦 Guia de Deployment - Google-OS

## Arquitetura de Dual-Deployment

Este projeto suporta **dois ambientes de deployment** simultaneamente:

### 1️⃣ **Apps Script** (Produção - Google Workspace Integrado)
- **Local**: `script/` (HTML + Google Apps Script)
- **Backend**: Google Apps Script (acesso nativo a Gmail, Calendar, Drive, etc)
- **Publicação**: Diretamente no Google Cloud via Apps Script Console

### 2️⃣ **Vercel** (Demo Pública - Interface Visual)
- **Local**: `studio/` (React + TypeScript + Vite)
- **Frontend**: React puro (sem backend Google)
- **Publicação**: Deploy em Vercel/Netlify (testes de UX)

---

## 🔄 Fluxo de Sincronização (Studio → Script)

### Regra Fundamental
**Tudo que é desenvolvido em `studio/` deve ser replicado em `script/`**

**Por quê?**
- Apps Script só executa HTML/JavaScript puro
- React é transpilado para JavaScript vanilla
- `script/index.html` é o arquivo final que roda no Apps Script

---

## 📋 Checklist: Adicionar Nova Funcionalidade

### Passo 1: Desenvolver em `studio/`
```bash
npm run dev  # Testa localmente em http://localhost:3000
```

### Passo 2: Build do React
```bash
npm run build  # Gera a versão otimizada em dist/
```

### Passo 3: Converter para `script/index.html`

**Opção A - Manual (Simples)**
1. Copiar os estilos Tailwind de `studio/index.html`
2. Traduzir componentes React em HTML + Vanilla JS
3. Atualizar `script/index.html`

**Opção B - Automático (Recomendado)**
```bash
# (Futuro) Script que transpila automaticamente
npm run sync-to-apps-script
```

### Passo 4: Testar em Apps Script
```
1. Copiar `script/Code.gs` para Google Apps Script
2. Copiar `script/index.html` para Google Apps Script (como arquivo HTML)
3. Deploy como Web App
```

---

## 🎨 Padrão de Conversão React → Vanilla JS

### ❌ Exemplo NO Studio (React)
```tsx
// studio/components/apps/MailApp.tsx
export default function MailApp({ onClose, data }) {
  const [showNewMenu, setShowNewMenu] = useState(false);

  return (
    <button onClick={() => setShowNewMenu(!showNewMenu)}>
      <Plus size={20} /> Novo
    </button>
  );
}
```

### ✅ Equivalente NO Script (Vanilla JS)
```html
<!-- script/index.html -->
<button id="newMenuBtn" onclick="toggleNewMenu()">
  <svg><!-- Plus icon --></svg>
  <span>Novo</span>
</button>

<script>
let showNewMenu = false;

function toggleNewMenu() {
  showNewMenu = !showNewMenu;
  document.getElementById('newMenu').style.display = 
    showNewMenu ? 'block' : 'none';
}
</script>
```

---

## 🚀 Deploy no Vercel (Opção 2)

### Pré-requisitos
- Conta Vercel
- GitHub conectado

### Passos
1. **Conectar repositório no Vercel**
   ```
   https://vercel.com/new
   ```

2. **Configurar build settings**
   ```
   Build Command: npm run build
   Output Directory: dist
   Install Command: npm install
   ```

3. **Environment Variables**
   ```
   VITE_GEMINI_API_KEY=your-key-here
   ```

4. **Deploy**
   ```bash
   git push  # Vercel deploya automaticamente
   ```

### URL Pública
```
https://seu-projeto.vercel.app
```

---

## 🔑 Deploy no Apps Script (Opção 1)

### Pré-requisitos
- Google Account
- Google Cloud Project
- Google Apps Script Console

### Passos

#### 1. Criar Arquivo de Sincronização (`script/appsscript.json`)
```json
{
  "timeZone": "America/Sao_Paulo",
  "dependencies": {
    "enableREST": true
  },
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}
```

#### 2. Prepare os arquivos
```
script/
├── Code.gs (Backend - Google Apps Script)
├── index.html (Frontend - Interface)
└── appsscript.json (Config)
```

#### 3. Upload para Google Apps Script

**Via GitHub** (Recomendado)
```bash
# 1. Autorizar clasp
clasp login

# 2. Vincular projeto
clasp create --type webapp --name "Workspace Hub"

# 3. Push código
clasp push --watch
```

**Via Console Manual**
```
1. Ir para script.google.com
2. Novo projeto
3. Copiar `Code.gs` para o editor
4. Criar arquivo HTML: Index.html
5. Copiar `script/index.html` para esse arquivo
6. Deploy > New Deployment > Web App
7. Selecionar: Execute as > Me / Anyone
```

#### 4. URL Resultante
```
https://script.google.com/macros/d/{SCRIPT_ID}/usercontent/dist/index.html
```

---

## 🔐 Variáveis de Ambiente

### `studio/.env.local` (React/Vite)
```
VITE_GEMINI_API_KEY=your_gemini_key_here
VITE_GOOGLE_CLIENT_ID=your_client_id_here
```

### `script/Code.gs` (Apps Script)
```javascript
const GEMINI_API_KEY = PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY');
```

---

## 📊 Estrutura de Arquivos

```
Google-OS/
├── studio/                    # ✨ Desenvolvimento React
│   ├── components/apps/
│   │   ├── MailApp.tsx       # Versão React (MASTER)
│   │   ├── DriveApp.tsx
│   │   └── ...
│   ├── App.tsx
│   ├── index.tsx
│   └── index.html
│
├── script/                    # 📦 Apps Script (Sincronizado)
│   ├── Code.gs               # Backend Google Apps Script
│   ├── index.html            # Frontend (HTML + Vanilla JS)
│   └── appsscript.json
│
├── components/               # 🔄 Shared (Ambos os ambientes)
│   ├── apps/
│   │   ├── MailApp.tsx      # Versão React (MASTER)
│   │   └── ...
│   └── ...
│
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 🔄 Workflow Recomendado

### 1. **Desenvolvimento Local**
```bash
npm run dev          # Testa em http://localhost:3000
# Editar studio/ e components/
```

### 2. **Build & Test**
```bash
npm run build        # Cria dist/
npm run preview      # Visualiza build
```

### 3. **Sincronizar para Script**
```bash
# Opção A: Manual
# Copiar estilos + componentes traduzidos para script/index.html

# Opção B: Automático (futuro)
npm run sync
```

### 4. **Deploy**

**Para Vercel:**
```bash
git push
# Vercel deploya automaticamente
```

**Para Apps Script:**
```bash
clasp push
# OU manual via console
```

---

## 🚨 Regras Críticas

1. ✅ **SEMPRE sincronizar** `studio/` com `script/`
2. ✅ **NUNCA** editar apenas `script/index.html` (editável, mas será sobrescrito)
3. ✅ **SEMPRE** testar em ambos os ambientes
4. ✅ **NUNCA** regressar funcionalidades
5. ✅ **SEMPRE** manter `studio/` como MASTER

---

## ⚡ Troubleshooting

### Erro: "Module not found" no Apps Script
**Causa**: Dependência npm não é suportada no Apps Script
**Solução**: Usar apenas código vanilla JS em `script/`

### Erro: "Tailwind classes não funcionam" no Apps Script
**Causa**: Apps Script não processamento Tailwind CDN
**Solução**: Inline CSS ou usar CDN completo em `script/index.html`

### Deploy no Vercel falhando
**Causa**: Build command ou dependências incorretas
**Solução**: 
```bash
npm install
npm run build  # Testar localmente
git push
```

---

## 📚 Referências

- [Google Apps Script Docs](https://developers.google.com/apps-script)
- [Vercel Docs](https://vercel.com/docs)
- [React to Vanilla JS](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
- [Clasp CLI](https://github.com/google/clasp)

