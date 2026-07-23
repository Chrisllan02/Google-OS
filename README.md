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

**Apps incluídos:** Gmail · Drive · Agenda · Meet · Docs · Sheets · Slides · Chat · Keep · Tasks · Search · Segurança · Permissões

[![Licença: MIT](https://img.shields.io/badge/Licença-MIT-blue.svg)](LICENSE)

---

## O que é isso

Um hub único para o dia a dia no Google Workspace: sua Agenda, seus e-mails,
suas tarefas e seu Drive — sem precisar abrir uma aba para cada app. É
**open source, gratuito e roda na sua própria máquina** (ou no seu deploy na
Vercel). Você conecta a sua própria conta do Google com um Client ID OAuth
que você mesmo cria de graça — nenhum dado passa por um servidor nosso.

Alguns apps (**Docs, Sheets, Slides, Meet e Chat**) dependem 100% do editor
oficial do Google e não têm como ser recriados fielmente — para esses, o
Google OS cria/abre o arquivo real na sua conta e o exibe: em nova aba no
navegador (web) ou numa janela própria do shell desktop (veja
[`desktop/README.md`](desktop/README.md)), que se comporta como um "Chrome
embutido" só para esses apps.

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

## Conectar sua conta Google real (grátis, sem servidor)

Sem essa etapa, o app roda em **modo demonstração** com dados fictícios. Para
usar sua Agenda, Tarefas, Gmail e Drive de verdade, crie seu próprio Client ID
OAuth — é gratuito e leva menos de 5 minutos:

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/) e crie
   um projeto novo (ou reaproveite um existente).
2. Vá em **APIs e Serviços → Biblioteca** e ative:
   - Google Calendar API
   - Google Tasks API
   - Gmail API
   - Google Drive API
   - People API *(opcional, usada só para sugestão de contatos)*
3. Vá em **APIs e Serviços → Tela de consentimento OAuth**, escolha **Externo**,
   preencha nome do app e e-mail, e adicione seu próprio e-mail como
   **usuário de teste** (assim o app funciona sem passar pela revisão do
   Google — suficiente para uso pessoal).
4. Vá em **APIs e Serviços → Credenciais → Criar credenciais → ID do cliente OAuth**.
   - Tipo de aplicativo: **Aplicativo da Web**
   - Em **Origens JavaScript autorizadas**, adicione a URL onde o app roda
     (ex.: `http://localhost:3000` para desenvolvimento local, ou a URL do seu
     deploy na Vercel).
5. Copie o **Client ID** gerado (não precisa do "Client secret" — essa etapa
   não usa um) e cole no seu `.env.local`:
   ```bash
   GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
   ```
6. Rode `npm run dev` novamente e clique em **"Conectar conta do Google"** no
   menu de perfil (canto superior direito) ou no aviso de modo demonstração.

A partir daí, Agenda, Tarefas, Gmail e Drive passam a usar dados reais da sua
conta, e o Keep sincroniza suas notas com uma pasta privada do seu Drive
(`appDataFolder`, invisível no Drive normal). O token de acesso fica só na
memória do navegador (nunca em disco) e você pode desconectar a qualquer
momento pelo mesmo menu.

> Cada pessoa que rodar o Google OS cria o **próprio** Client ID — é assim que
> projetos open source como este funcionam sem custo e sem depender de uma
> conta central nossa. Veja mais em [Open Source](#open-source-e-privacidade).

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
| Conta Google (client-side) | Google Identity Services + REST APIs (`utils/GoogleAuth.ts`) | Calendar, Tasks, Gmail, Drive e People direto do navegador, sem backend |
| Desktop | Electron (`desktop/`) | Shell nativo com janelas reais do Google para Docs/Sheets/Slides/Meet/Chat |

### Modo de operação

- **Modo demonstração** (padrão): dados mock, nenhuma conta conectada. Gemini AI funciona com a `GEMINI_API_KEY`.
- **Conta Google conectada** (recomendado): depois de configurar `GOOGLE_CLIENT_ID`
  ([veja acima](#conectar-sua-conta-google-real-grátis-sem-servidor)), Agenda,
  Tarefas, Gmail e Drive passam a chamar as APIs reais do Google **direto do
  navegador** — sem nenhum servidor no meio.
- **Google Apps Script**: roda com dados reais do Workspace via `google.script.run`
  (modo de implantação como Apps Script Web App).
- **Backend Express (opcional)**: `npm run server` sobe o servidor herdado do
  Workspace Hub com autenticação própria, 2FA, auditoria e refresh token
  persistente de Calendar/Tasks — útil para quem quer login que sobrevive a
  reinícios do servidor. Veja [`server/README.md`](server/README.md).

O `GASBridge` detecta automaticamente qual desses ambientes está disponível e
alterna entre eles — a UI não muda.

### Segurança & Governança (herdados do Workspace Hub)

- **Central de Segurança** (app "Segurança" no launcher): controle de verificação em
  duas etapas (TOTP), trilha de auditoria de logs e simulador de ataques.
- **Permissões** (app "Permissões" no launcher): criação, edição e revogação de regras
  de compartilhamento de Agenda/Tarefas com colaboradores.
- **Alerta de eventos**: notificação automática quando um evento da agenda começa em
  até 15 minutos.

---

## App Desktop (Sheets, Slides, Meet e Chat de verdade)

Docs, Sheets, Slides, Meet e Chat não têm como ser recriados fielmente — a
web bloqueia esses sites dentro de `<iframe>`. Rodando o Google OS como app
desktop (Electron), esses apps abrem em **janelas Chrome reais**, com a mesma
sessão de login das outras janelas — como se fossem abas do seu navegador.

```bash
npm run dev            # terminal 1: frontend
npm run electron:dev   # terminal 2: shell desktop
```

Detalhes, arquitetura de segurança das janelas e como gerar o instalador em
[`desktop/README.md`](desktop/README.md).

---

## Open Source e Privacidade

O Google OS é livre para usar, estudar, modificar e redistribuir sob a
[licença MIT](LICENSE). Não existe conta central, banco de dados ou servidor
nosso guardando seus dados:

- No modo padrão (conta Google conectada via `GOOGLE_CLIENT_ID`), o app fala
  **direto com as APIs do Google** a partir do seu navegador. Seus e-mails,
  eventos, tarefas e arquivos nunca passam por nenhum servidor do Google OS.
- O `server/` opcional (herdado do Workspace Hub) só existe para quem quer
  login persistente entre reinícios; ele roda **na sua própria máquina** e
  guarda os dados localmente, criptografados com AES-256.
- Cada usuário cria seu próprio Client ID OAuth gratuito — não há chave
  compartilhada nem limite de uso controlado por terceiros.

Contribuições são bem-vindas: abra uma issue ou um pull request.
