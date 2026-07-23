<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Google OS — Workspace Dashboard

Interface unificada para os principais apps do Google Workspace, com Gemini AI integrado.

> **Projeto unificado:** este repositório absorveu o `Google-Workspace-Hub`. Os recursos
> de segurança (2FA, auditoria de logs, simulador de ataques), o controle de permissões de
> compartilhamento, o alerta de eventos próximos e o backend Express com OAuth real do
> Google (pasta [`server/`](server/README.md)) vieram de lá. O repositório
> `Google-Workspace-Hub` pode ser arquivado/deletado.

**Apps incluídos:** Gmail · Drive · Agenda · Meet · Docs · Keep · Tasks · Search · Segurança · Permissões

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
| Backend opcional | Express + JWT + 2FA + OAuth Google | Herdado do Workspace Hub ([`server/`](server/README.md)) |

### Modo de operação

- **Vercel / local**: roda com dados mock. Gemini AI funciona com a API key.
- **Google Apps Script**: roda com dados reais do Workspace via `google.script.run`.
- **Backend Express (opcional)**: `npm run server` sobe o servidor herdado do
  Workspace Hub com autenticação, 2FA, auditoria e sincronização real de
  Calendar/Tasks via OAuth — veja [`server/README.md`](server/README.md).

O `GASBridge` detecta automaticamente o ambiente e alterna entre os modos.

### Segurança & Governança (herdados do Workspace Hub)

- **Central de Segurança** (app "Segurança" no launcher): controle de verificação em
  duas etapas (TOTP), trilha de auditoria de logs e simulador de ataques.
- **Permissões** (app "Permissões" no launcher): criação, edição e revogação de regras
  de compartilhamento de Agenda/Tarefas com colaboradores.
- **Alerta de eventos**: notificação automática quando um evento da agenda começa em
  até 15 minutos.
