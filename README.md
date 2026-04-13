<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Google OS — Workspace Dashboard

Interface unificada para os principais apps do Google Workspace, com Gemini AI integrado.

**Apps incluídos:** Gmail · Drive · Agenda · Meet · Docs · Keep · Tasks · Search

---

## Deploy no Vercel (demo com dados mock)

1. Acesse [vercel.com/new](https://vercel.com/new)
2. Importe o repositório `Chrisllan02/Google-OS`
3. Em **Environment Variables**, adicione:
   - `GEMINI_API_KEY` → sua chave do [Google AI Studio](https://aistudio.google.com/app/apikey)
4. Clique em **Deploy**

---

## Rodar Localmente

**Pré-requisitos:** Node.js 20.19+ (ou 22.12+)

```bash
# 1. Instalar dependências
npm install

# 2. Criar arquivo de variáveis de ambiente
cp .env.example .env.local
# Edite .env.local e adicione sua GEMINI_API_KEY

# 3. Rodar em modo desenvolvimento
npm run dev
```

Acesse `http://localhost:3000`

---

## Arquitetura

| Camada | Tecnologia | Descrição |
|--------|-----------|-----------|
| Frontend | React 19 + TypeScript + Vite | UI principal |
| Estilo | Tailwind CSS (CDN) | Glassmorfismo + dark mode |
| AI | Gemini (`@google/genai`) | Chat + comandos |
| Background | OGL (WebGL) | Aurora animada |
| Video | PeerJS | Google Meet P2P |
| Backend (prod) | Google Apps Script | Acesso real ao Workspace |

### Modo de operação

- **Vercel / local**: roda com dados mock. Gemini AI funciona com a API key.
- **Google Apps Script**: roda com dados reais do Workspace via `google.script.run`.

O `GASBridge` detecta automaticamente o ambiente e alterna entre os modos.
