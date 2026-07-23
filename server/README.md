# Backend opcional — herdado do Google Workspace Hub

Este diretório contém o servidor Express completo que era o coração do projeto
`Google-Workspace-Hub`, incorporado ao Google OS durante a fusão dos dois projetos.
O frontend do Google OS funciona 100% sem ele (modo demo com dados mock); este
backend existe para quem quiser dados reais e recursos de segurança no servidor.

## O que ele oferece

- **Autenticação local**: registro/login com senha + JWT.
- **2FA (TOTP)**: implementação nativa compatível com Google Authenticator/Authy.
- **Criptografia AES-256-CBC**: credenciais, eventos e tarefas criptografados em disco (`ENCRYPTION_SECRET`).
- **Google OAuth 2.0 real**: com `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` configurados,
  sincroniza de verdade com **Google Calendar** e **Google Tasks** (CRUD completo de
  eventos, listas e tarefas).
- **Permissões de compartilhamento**: conceda/revogue acesso de leitura/escrita a
  colaboradores por recurso (`/api/permissions`).
- **Auditoria**: trilha de logs de todas as ações (`/api/audit-logs`) + simulador de
  ataques para demonstração (`/api/audit-simulate-attack`).

## Como rodar

```bash
# 1. Configure as variáveis no .env.local (veja .env.example na raiz)
# 2. Em desenvolvimento (monta o Vite como middleware na porta 3000):
npm run server

# Em produção (serve o build estático de dist/):
npm run build && npm run server:prod
```

## Principais endpoints

| Rota | Descrição |
|------|-----------|
| `POST /api/auth/register` · `POST /api/auth/login` | Autenticação local |
| `POST /api/auth/mfa/verify` · `POST /api/auth/mfa/toggle` | 2FA TOTP |
| `GET /api/auth/google/url` · `GET /auth/callback` | OAuth Google |
| `GET/POST/PUT/DELETE /api/calendar/events` | Eventos (mock ou Google real) |
| `GET/POST/PUT/DELETE /api/tasks/lists` · `/api/tasks/items` | Tarefas |
| `GET/POST/PUT/DELETE /api/permissions` | Compartilhamentos |
| `GET /api/audit-logs` | Trilha de auditoria |

> Observação: os apps **Segurança** e **Permissões** do frontend rodam, por padrão,
> em modo local (estado salvo no navegador via `GASBridge`), mantendo o padrão dos
> demais apps do Google OS. Este servidor é a base para plugar esses apps em dados
> reais quando desejado.
